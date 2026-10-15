"use client";

import { FormEvent, useEffect, useState } from "react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import styles from "./product-url-import.module.css";

export type ProductBriefConfidence = "high" | "medium" | "low";
export type SourcedProductBriefValue<T> = {
  value: T;
  sourceUrl: string;
  sourceLabel: string;
  confidence: ProductBriefConfidence;
  confirmed: false;
};

export type ProductBriefPreview = {
  sourceUrl: string;
  fetchedPageUrl: string;
  draft: {
    title: SourcedProductBriefValue<string> | null;
    description: SourcedProductBriefValue<string> | null;
    detectedImages: Array<SourcedProductBriefValue<string> & { sourcePageUrl: string }>;
    possiblePrice: SourcedProductBriefValue<{ amount: string; currency?: string }> | null;
    confirmed: false;
    reviewRequired: true;
  };
};

export type ConfirmedProductBrief = {
  sourceUrl: string;
  fetchedPageUrl: string;
  title: SourcedProductBriefValue<string> | null;
  description: SourcedProductBriefValue<string> | null;
  candidateImages: Array<SourcedProductBriefValue<string> & { sourcePageUrl: string }>;
  possiblePrice: SourcedProductBriefValue<{ amount: string; currency?: string }> | null;
  selectionConfirmed: true;
  priceConfirmed: false;
  reviewRequired: true;
  customerConfirmedAt: string;
};

export type ImportedProductAsset = {
  id: string;
  previewUrl: string;
  label?: string;
};

type PreviewResponse = {
  ok?: boolean;
  preview?: ProductBriefPreview;
  error?: string;
};
type ProductUrlImportResponse = {
  ok?: boolean;
  asset?: ImportedProductAsset;
  product?: { title?: string | null };
  error?: string;
};

export type ProductUrlImportProps = {
  siteId: string;
  customerId?: string;
  csrfToken?: string;
  loginHref: string;
  initialUrl?: string;
  onImported: (asset: ImportedProductAsset, title?: string, brief?: ConfirmedProductBrief) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isSourcedValue<T>(value: unknown, validate: (input: unknown) => input is T): value is SourcedProductBriefValue<T> {
  if (!isRecord(value)) return false;
  return validate(value.value) && isHttpsUrl(value.sourceUrl) && typeof value.sourceLabel === "string" &&
    ["high", "medium", "low"].includes(String(value.confidence)) && value.confirmed === false;
}

function parsePreview(value: unknown): ProductBriefPreview | undefined {
  if (!isRecord(value) || !isHttpsUrl(value.sourceUrl) || !isHttpsUrl(value.fetchedPageUrl) || !isRecord(value.draft)) return;
  const draft = value.draft;
  const titleOk = draft.title === null || isSourcedValue(draft.title, (input): input is string => typeof input === "string");
  const descriptionOk = draft.description === null || isSourcedValue(draft.description, (input): input is string => typeof input === "string");
  const priceOk = draft.possiblePrice === null || isSourcedValue(draft.possiblePrice, (input): input is { amount: string; currency?: string } => {
    if (!isRecord(input) || typeof input.amount !== "string") return false;
    return input.currency === undefined || typeof input.currency === "string";
  });
  const imageOk = Array.isArray(draft.detectedImages) && draft.detectedImages.every((image) => {
    if (!isRecord(image) || !isHttpsUrl(image.sourcePageUrl)) return false;
    return isSourcedValue(image, (input): input is string => typeof input === "string" && isHttpsUrl(input));
  });
  if (!titleOk || !descriptionOk || !priceOk || !imageOk || draft.confirmed !== false || draft.reviewRequired !== true) return;
  return value as unknown as ProductBriefPreview;
}

function errorMessage(code: string | undefined, status: number): string {
  if (code === "product_url_invalid") return "That link is not valid. Check the address and try again.";
  if (code === "product_url_blocked") return "We can’t open that link. Use a public HTTPS product page or upload a photo instead.";
  if (code === "product_image_not_found") return "We couldn’t find a product photo on that page. Upload a photo instead.";
  if (code === "product_image_unsupported") return "The product photo can’t be used. Upload a JPG or PNG instead.";
  if (code === "product_page_unsupported") return "We couldn’t read that product page. Upload a photo instead.";
  if (code === "product_url_fetch_failed") return "We couldn’t load that product page. Check the link or try another public page.";
  if (status === 401 || status === 403) return "Please log in again to import a product photo.";
  if (status === 429) return "Too many import attempts. Please wait a moment and try again.";
  return "We couldn’t import that product page. Try another public link or upload a photo instead.";
}

function priceText(price: { amount: string; currency?: string }): string {
  return `${price.currency ? `${price.currency} ` : ""}${price.amount}`;
}

function loginHrefForProduct(loginHref: string, sourceUrl: string): string {
  const login = new URL(loginHref, "https://workspace.invalid");
  const next = new URL(login.searchParams.get("next") || "/app/create?view=product", "https://workspace.invalid");
  if (next.pathname.endsWith("/app")) next.pathname = `${next.pathname}/create`;
  for (const key of ["source", "preset", "task", "scene", "template", "tool_id", "prompt"]) next.searchParams.delete(key);
  next.searchParams.set("view", "product");
  next.searchParams.set("tool", "url-to-video");
  try {
    const raw = sourceUrl.trim();
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname.includes(".") && !parsed.username && !parsed.password && (!parsed.port || parsed.port === "443") && raw.length <= 2048) {
      parsed.protocol = "https:";
      next.searchParams.set("url", parsed.toString());
    } else {
      next.searchParams.delete("url");
    }
  } catch {
    next.searchParams.delete("url");
  }
  login.searchParams.set("next", `${next.pathname}${next.search}`);
  return `${login.pathname}${login.search}${login.hash}`;
}

export function ProductUrlImport({ siteId, customerId, csrfToken, loginHref, initialUrl, onImported }: ProductUrlImportProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState<"preview" | "import" | "">("");
  const [preview, setPreview] = useState<ProductBriefPreview | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setPreview(null);

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      setError("Enter a complete product page link starting with https://.");
      return;
    }
    if (parsed.protocol !== "https:" || !parsed.hostname) {
      setError("Enter a public product page link starting with https://.");
      return;
    }

    setBusy("preview");
    setStatus("Reading the product page for your review…");
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/aivideosugc/tasks/product-brief`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          ...customerJsonHeaders(siteId),
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ url: parsed.toString() }),
      });
      const result = (await response.json().catch(() => ({}))) as PreviewResponse;
      const parsedPreview = parsePreview(result.preview);
      if (!response.ok || result.ok !== true || !parsedPreview) {
        setError(errorMessage(result.error, response.status));
        setStatus("");
        return;
      }
      setPreview(parsedPreview);
      setStatus("");
    } catch {
      setStatus("");
      setError("We couldn’t reach the product page. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  async function confirmImport() {
    if (!preview || !customerId || busy) return;
    setBusy("import");
    setError("");
    setStatus("Adding the confirmed product photo…");
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/customers/${encodeURIComponent(customerId)}/assets/import-url`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            ...customerJsonHeaders(siteId),
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({ url: preview.sourceUrl }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as ProductUrlImportResponse;
      if (!response.ok || !result.asset?.id || !result.asset.previewUrl) {
        setError(errorMessage(result.error, response.status));
        setStatus("");
        return;
      }

      const brief: ConfirmedProductBrief = {
        sourceUrl: preview.sourceUrl,
        fetchedPageUrl: preview.fetchedPageUrl,
        title: preview.draft.title,
        description: preview.draft.description,
        candidateImages: preview.draft.detectedImages,
        possiblePrice: preview.draft.possiblePrice,
        selectionConfirmed: true,
        priceConfirmed: false,
        reviewRequired: true,
        customerConfirmedAt: new Date().toISOString(),
      };
      const title = preview.draft.title?.value.trim() || result.product?.title?.trim() || undefined;
      onImported({ ...result.asset, ...(title ? { label: title } : {}) }, title, brief);
      setStatus(title ? `Product photo and “${title}” added.` : "Product photo added.");
      setUrl("");
      setPreview(null);
    } catch {
      setStatus("");
      setError("We couldn’t reach the product page. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  function cancelPreview() {
    setPreview(null);
    setError("");
    setStatus("");
  }

  return (
    <section className={styles.panel} aria-labelledby="product-url-import-title">
      <div className={styles.heading}>
        <h2 id="product-url-import-title">Import from a product page</h2>
        <p>Use a public HTTPS product or shop page. This is for product pages, not video links or ad references.</p>
      </div>
      {customerId ? (
        preview ? (
          <div className={styles.preview} aria-label="Product page preview">
            <p className={styles.previewNotice}>Review the product name, description, photo, and any possible price below. They were read from this page and are unconfirmed; confirm the photo only if it matches your product. Prices always need separate verification.</p>
            <p className={styles.previewSource}><span>Page source: </span><a href={preview.fetchedPageUrl} target="_blank" rel="noreferrer">{preview.fetchedPageUrl}</a></p>
            <div className={styles.productSummary}>
              {preview.draft.detectedImages[0] ? (
                // Product image hosts vary, so render this already validated HTTPS URL directly.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.draft.detectedImages[0].value} alt={preview.draft.title?.value || "Product from this page"} />
              ) : <div className={styles.noProductImage}>No product photo found</div>}
              <div className={styles.productSummaryCopy}>
                <span className={styles.summaryEyebrow}>Product found</span>
                <h3>{preview.draft.title?.value || "Product name not found"}</h3>
                <p>{preview.draft.description?.value || "No product description was found on this page."}</p>
                {preview.draft.possiblePrice && <span className={styles.summaryPrice}>Possible price · unconfirmed: {priceText(preview.draft.possiblePrice.value)}</span>}
                <span className={styles.summaryImageCount}>{preview.draft.detectedImages.length ? `Main product photo · ${preview.draft.detectedImages.length} photo${preview.draft.detectedImages.length === 1 ? "" : "s"} found` : "No photo found"}</span>
              </div>
            </div>
            <div className={styles.previewActions}>
              <button className={styles.clear} type="button" onClick={cancelPreview} disabled={busy !== ""}>Cancel</button>
              <button className={styles.submit} type="button" onClick={confirmImport} disabled={busy !== ""}>{busy === "import" ? "Adding photo…" : "Confirm product photo"}</button>
            </div>
            <p className={styles.note}>Confirming imports the product photo and keeps these page details with it. When you add it to a video draft, the product name and page facts are included for review; you still write and save the video description yourself.</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.label} htmlFor="product-page-url">Product page URL</label>
            <div className={styles.controls}>
              <input
                className={styles.input}
                id="product-page-url"
                name="url"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://store.example/products/item"
                value={url}
                onChange={(event) => setUrl(event.currentTarget.value)}
                required
                disabled={busy !== ""}
              />
              {url && <button className={styles.clear} type="button" onClick={() => { setUrl(""); setError(""); setStatus(""); }} disabled={busy !== ""}>Clear</button>}
              <button className={styles.submit} type="submit" disabled={busy !== "" || !url.trim()}>{busy === "preview" ? "Reading page…" : "Preview product"}</button>
            </div>
            <p className={styles.note}>We’ll read the page and show its product facts for review. Nothing is added until you confirm a photo; the page must be publicly readable with a usable product image.</p>
            {status && <p className={styles.status} role="status" aria-live="polite">{status}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
          </form>
        )
      ) : (
        <div className={styles.loginPrompt}>
          <label className={styles.label} htmlFor="product-page-url">Product page URL</label>
          <input
            className={styles.input}
            id="product-page-url"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://store.example/products/item"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
          />
          <p>Log in to preview a product page and add its photo to your workspace. The link will be ready when you return.</p>
          <a className={styles.submit} href={loginHrefForProduct(loginHref, url)}>Log in to preview</a>
        </div>
      )}
      {preview && status && <p className={styles.status} role="status" aria-live="polite">{status}</p>}
      {preview && error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
