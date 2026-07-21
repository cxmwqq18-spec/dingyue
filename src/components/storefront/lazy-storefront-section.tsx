"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import type { StorefrontSectionPayload } from "@/components/theme-renderer";

type LazyStorefrontSectionProps = {
  apiPath: string;
  intrinsicSize: string;
  sectionId: string;
  sectionType: string;
};

type LazyStorefrontSectionState =
  | { status: "idle" | "loading" }
  | { status: "loaded"; payload: StorefrontSectionPayload }
  | { status: "failed" };

type LazyStorefrontSectionMountComponent = (props: StorefrontSectionPayload) => ReactElement;

type LazyStorefrontSectionBatchResponse =
  | StorefrontSectionPayload
  | {
      ok: true;
      sections: StorefrontSectionPayload[];
      missingSectionIds?: string[];
    };

type PendingSectionRequest = {
  apiPath: string;
  reject: (error: Error) => void;
  resolve: (payload: StorefrontSectionPayload) => void;
  sectionId: string;
};

type PendingSectionBatch = {
  requests: PendingSectionRequest[];
  timer: ReturnType<typeof setTimeout>;
};

const sectionPayloadCache = new Map<string, StorefrontSectionPayload>();
const pendingSectionBatches = new Map<string, PendingSectionBatch>();
const lazySectionBatchWindowMs = Math.max(18, Number(process.env.NEXT_PUBLIC_STOREFRONT_SECTION_BATCH_WINDOW_MS ?? "180") || 180);
const lazySectionBatchSize = Math.min(24, Math.max(4, Number(process.env.NEXT_PUBLIC_STOREFRONT_SECTION_BATCH_SIZE ?? "20") || 20));
const fallbackLazySectionRootMargin = "480px 0px";
const lazySectionRootMarginTokenRe = /^-?(?:\d+|\d*\.\d+)(?:px|%)$/;
const configuredLazySectionRootMargin = process.env.NEXT_PUBLIC_STOREFRONT_SECTION_ROOT_MARGIN;
const lazySectionRootMargin = (() => {
  const value = String(configuredLazySectionRootMargin || fallbackLazySectionRootMargin).trim();
  const tokens = value.split(/\s+/);
  return tokens.length >= 1 && tokens.length <= 4 && tokens.every((token) => lazySectionRootMarginTokenRe.test(token))
    ? value
    : fallbackLazySectionRootMargin;
})();
let lazyMountComponent: LazyStorefrontSectionMountComponent | null = null;
let lazyMountRequest: Promise<LazyStorefrontSectionMountComponent> | undefined;

function rememberSectionPayload(apiPath: string, payload: StorefrontSectionPayload) {
  if (sectionPayloadCache.size >= 32) {
    const oldestKey = sectionPayloadCache.keys().next().value;
    if (oldestKey) sectionPayloadCache.delete(oldestKey);
  }
  sectionPayloadCache.set(apiPath, payload);
}

function preloadLazyStorefrontSectionMount() {
  if (lazyMountComponent) return Promise.resolve(lazyMountComponent);
  lazyMountRequest ??= import("@/components/theme-renderer").then((module) => {
    lazyMountComponent = module.LazyStorefrontSectionMount;
    return lazyMountComponent;
  });
  return lazyMountRequest;
}

function sectionBatchKey(apiPath: string) {
  const url = new URL(apiPath, window.location.origin);
  url.searchParams.delete("sectionId");
  url.searchParams.delete("sectionIds");
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function sectionBatchApiPath(apiPath: string, sectionIds: string[]) {
  const url = new URL(apiPath, window.location.origin);
  url.searchParams.delete("sectionId");
  url.searchParams.delete("sectionIds");
  url.searchParams.set("sectionIds", sectionIds.join(","));
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

function payloadIsSection(payload: StorefrontSectionPayload | undefined, sectionId: string): payload is StorefrontSectionPayload {
  return Boolean(payload?.section && (payload.clientSite || payload.site) && payload.id === sectionId);
}

async function fetchSectionPayload(apiPath: string, sectionId: string): Promise<StorefrontSectionPayload> {
  const response = await fetch(apiPath, {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`section_fetch_${response.status}`);
  const payload = (await response.json()) as StorefrontSectionPayload;
  if (!payloadIsSection(payload, sectionId)) throw new Error("section_payload_mismatch");
  rememberSectionPayload(apiPath, payload);
  return payload;
}

async function fetchSectionBatch(requests: PendingSectionRequest[]) {
  const sectionIds = Array.from(new Set(requests.map((request) => request.sectionId)));
  const batchApiPath = sectionBatchApiPath(requests[0]?.apiPath ?? "", sectionIds);
  try {
    const response = await fetch(batchApiPath, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`section_batch_fetch_${response.status}`);
    const body = (await response.json()) as LazyStorefrontSectionBatchResponse;
    const payloads = Array.isArray((body as { sections?: unknown }).sections)
      ? (body as { sections: StorefrontSectionPayload[] }).sections
      : [body as StorefrontSectionPayload];
    const payloadById = new Map(payloads.filter((payload) => payloadIsSection(payload, payload.id)).map((payload) => [payload.id, payload]));
    await Promise.all(requests.map(async (request) => {
      const payload = payloadById.get(request.sectionId);
      if (payloadIsSection(payload, request.sectionId)) {
        rememberSectionPayload(request.apiPath, payload);
        request.resolve(payload);
        return;
      }
      try {
        request.resolve(await fetchSectionPayload(request.apiPath, request.sectionId));
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error("section_fetch_failed"));
      }
    }));
  } catch (error) {
    await Promise.all(requests.map(async (request) => {
      try {
        request.resolve(await fetchSectionPayload(request.apiPath, request.sectionId));
      } catch (fallbackError) {
        request.reject(fallbackError instanceof Error ? fallbackError : error instanceof Error ? error : new Error("section_fetch_failed"));
      }
    }));
  }
}

function flushSectionBatch(key: string) {
  const batch = pendingSectionBatches.get(key);
  if (!batch) return;
  pendingSectionBatches.delete(key);
  clearTimeout(batch.timer);
  void fetchSectionBatch(batch.requests);
}

function loadSectionPayload(apiPath: string, sectionId: string) {
  const cachedPayload = sectionPayloadCache.get(apiPath);
  if (cachedPayload?.id === sectionId) return Promise.resolve(cachedPayload);

  return new Promise<StorefrontSectionPayload>((resolve, reject) => {
    const key = sectionBatchKey(apiPath);
    let batch = pendingSectionBatches.get(key);
    if (!batch) {
      batch = {
        requests: [],
        timer: setTimeout(() => flushSectionBatch(key), lazySectionBatchWindowMs)
      };
      pendingSectionBatches.set(key, batch);
    }
    batch.requests.push({ apiPath, reject, resolve, sectionId });
    if (batch.requests.length >= lazySectionBatchSize) flushSectionBatch(key);
  });
}

export function LazyStorefrontSection({ apiPath, intrinsicSize, sectionId, sectionType }: LazyStorefrontSectionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<LazyStorefrontSectionState>({ status: "idle" });

  useEffect(() => {
    const node = ref.current;
    if (!node || node.dataset.lazyStorefrontLoaded === "true") return;
    const cachedPayload = sectionPayloadCache.get(apiPath);
    if (cachedPayload?.id === sectionId) {
      node.dataset.lazyStorefrontLoaded = "true";
      void preloadLazyStorefrontSectionMount();
      setState({ status: "loaded", payload: cachedPayload });
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setState({ status: "loading" });
        void preloadLazyStorefrontSectionMount();
        const payload = await loadSectionPayload(apiPath, sectionId);
        if (cancelled || !payloadIsSection(payload, sectionId)) return;
        rememberSectionPayload(apiPath, payload);
        node.dataset.lazyStorefrontLoaded = "true";
        setState({ status: "loaded", payload });
      } catch {
        if (!cancelled) setState({ status: "failed" });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) return;
        observer.disconnect();
        void load();
      },
      { rootMargin: lazySectionRootMargin }
    );
    observer.observe(node);
    const cancelSectionLoad = () => {
      cancelled = true;
      observer.disconnect();
    };
    window.addEventListener("storefront:navigation-start", cancelSectionLoad);
    return () => {
      window.removeEventListener("storefront:navigation-start", cancelSectionLoad);
      cancelSectionLoad();
    };
  }, [apiPath, sectionId]);

  if (state.status === "loaded") {
    return <LazyMountedStorefrontSection intrinsicSize={intrinsicSize} payload={state.payload} />;
  }

  return (
    <div
      className="xfcart-section"
      data-lazy-storefront-section="true"
      data-section-id={sectionId}
      data-section-style=""
      data-section-type={sectionType}
      id={`xfcart-section-${sectionId}`}
      ref={ref}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: `1px ${intrinsicSize}`,
        minHeight: state.status === "failed" ? "96px" : intrinsicSize
      }}
    >
      {state.status === "failed" ? (
        <LazySectionError intrinsicSize={intrinsicSize} />
      ) : (
        <LazySectionPlaceholder intrinsicSize={intrinsicSize} sectionType={sectionType} status={state.status} />
      )}
    </div>
  );
}

function LazyMountedStorefrontSection({ intrinsicSize, payload }: { intrinsicSize: string; payload: StorefrontSectionPayload }) {
  const [Mount, setMount] = useState<LazyStorefrontSectionMountComponent | null>(() => lazyMountComponent);

  useEffect(() => {
    let cancelled = false;
    void preloadLazyStorefrontSectionMount().then((component) => {
      if (!cancelled) setMount(() => component);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Mount) {
    return (
      <div
        className="xfcart-section"
        data-lazy-storefront-section="mounting"
        data-section-id={payload.id}
        data-section-style=""
        data-section-type={payload.section.type}
        id={`xfcart-section-${payload.id}`}
        style={{
          contentVisibility: "auto",
          containIntrinsicSize: `1px ${intrinsicSize}`,
          minHeight: intrinsicSize
        }}
      >
        <LazySectionPlaceholder intrinsicSize={intrinsicSize} sectionType={payload.section.type} status="loading" />
      </div>
    );
  }

  return <Mount {...payload} />;
}

function lazySectionLoadingCopy(sectionType: string) {
  const normalized = sectionType.toLowerCase();
  if (normalized.includes("generation_showcase")) {
    return {
      eyebrow: "Loading examples",
      title: "Preparing image and video themes.",
      description: "Customer-created examples are loading now."
    };
  }
  if (normalized.includes("catalog") || normalized.includes("taxonomy") || normalized.includes("package") || normalized.includes("collection")) {
    return {
      eyebrow: "Loading packages",
      title: "Preparing the package gallery.",
      description: "Photo packs and categories are being organized."
    };
  }
  if (normalized.includes("pricing")) {
    return {
      eyebrow: "Loading plans",
      title: "Preparing credits and plan options.",
      description: "The latest checkout-ready offers are loading."
    };
  }
  if (normalized.includes("faq") || normalized.includes("rich_text") || normalized.includes("policy")) {
    return {
      eyebrow: "Loading details",
      title: "Preparing this information.",
      description: "Helpful details are being loaded for this section."
    };
  }
  if (normalized.includes("proof") || normalized.includes("testimonial") || normalized.includes("trust")) {
    return {
      eyebrow: "Loading proof",
      title: "Preparing customer proof.",
      description: "Reviews and trust signals are loading now."
    };
  }
  return {
    eyebrow: "Loading section",
    title: "Preparing this section.",
    description: "Fresh storefront content is loading now."
  };
}

function LazySectionPlaceholder({
  intrinsicSize,
  sectionType,
  status
}: {
  intrinsicSize: string;
  sectionType: string;
  status: "idle" | "loading";
}) {
  const copy = lazySectionLoadingCopy(sectionType);
  const warmSurface = sectionType.toLowerCase().includes("aidreamcapes");
  const busy = status === "loading";
  const skeletonCards = sectionType.toLowerCase().includes("pricing") ? 3 : 4;

  return (
    <div
      aria-busy={busy ? "true" : undefined}
      aria-live={busy ? "polite" : undefined}
      className={warmSurface ? "bg-[#fff8ed] px-5 py-12 text-[#211914]" : "bg-[#f6f7fb] px-5 py-12 text-[#10121a]"}
      role={busy ? "status" : undefined}
      style={{ minHeight: intrinsicSize }}
    >
      <div className="mx-auto flex min-h-[inherit] max-w-[var(--site-content-width)] items-center">
        <div className="w-full">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/76 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#687181] shadow-[0_16px_44px_-36px_rgba(20,22,26,0.32)]">
            <span className="h-2 w-2 rounded-full bg-[#16dcf0] shadow-[0_0_18px_rgba(22,220,240,0.72)]" />
            {copy.eyebrow}
          </div>
          <p className="mt-5 max-w-[36rem] text-[clamp(1.75rem,4vw,3.35rem)] font-semibold leading-tight [font-family:var(--site-title-font)]">
            {copy.title}
          </p>
          <p className="mt-3 max-w-[34rem] text-sm leading-7 text-[#647080] md:text-base">
            {copy.description}
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-4" aria-hidden="true">
            {Array.from({ length: skeletonCards }).map((_, index) => (
              <div className="overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-[0_24px_72px_-58px_rgba(20,22,26,0.36)]" key={`lazy_section_skeleton_${index}`}>
                <div className="aspect-[4/3] animate-pulse bg-[linear-gradient(110deg,#eef2f7_0%,#f8fafc_45%,#e8edf5_100%)]" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-20 rounded-full bg-[#e7edf4]" />
                  <div className="h-4 w-3/4 rounded-full bg-[#dfe6ef]" />
                  <div className="h-3 w-full rounded-full bg-[#edf2f7]" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 h-[3px] w-full max-w-sm overflow-hidden rounded-full bg-black/10" aria-hidden="true">
            <div className="h-full w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite] rounded-full bg-[#16dcf0]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LazySectionError({ intrinsicSize }: { intrinsicSize: string }) {
  return (
    <div className="bg-[#fbf7f0] px-5 py-10 text-[#171514]" style={{ minHeight: intrinsicSize }}>
      <div className="mx-auto flex min-h-[inherit] max-w-[var(--site-content-width)] items-center">
        <div className="rounded-[18px] border border-dashed border-[#d8cab9] bg-white/82 p-5 text-sm leading-7 text-[#706961]">
          This section could not load. Refresh the page to try again.
        </div>
      </div>
    </div>
  );
}
