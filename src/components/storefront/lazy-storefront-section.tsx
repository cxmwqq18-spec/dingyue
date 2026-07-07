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

export function LazyStorefrontSection({ apiPath, intrinsicSize, sectionId, sectionType }: LazyStorefrontSectionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<LazyStorefrontSectionState>({ status: "idle" });

  useEffect(() => {
    const node = ref.current;
    if (!node || node.dataset.lazyStorefrontLoaded === "true") return;

    let cancelled = false;
    let controller: AbortController | undefined;
    const load = async () => {
      try {
        setState({ status: "loading" });
        controller = new AbortController();
        const response = await fetch(apiPath, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`section_fetch_${response.status}`);
        const payload = (await response.json()) as StorefrontSectionPayload;
        if (cancelled || !payload?.section || !(payload.clientSite || payload.site) || payload.id !== sectionId) return;
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
      { rootMargin: "900px 0px" }
    );
    observer.observe(node);
    const cancelSectionLoad = () => {
      cancelled = true;
      controller?.abort();
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
        <div className="mx-auto max-w-[var(--site-content-width)] px-5 py-8 text-sm text-[var(--site-body)]">
          This section could not load. Refresh the page to try again.
        </div>
      ) : null}
    </div>
  );
}

function LazyMountedStorefrontSection({ intrinsicSize, payload }: { intrinsicSize: string; payload: StorefrontSectionPayload }) {
  const [Mount, setMount] = useState<((props: StorefrontSectionPayload) => ReactElement) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@/components/theme-renderer").then((module) => {
      if (!cancelled) setMount(() => module.LazyStorefrontSectionMount);
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
      />
    );
  }

  return <Mount {...payload} />;
}
