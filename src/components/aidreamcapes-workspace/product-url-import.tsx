"use client";

import { FormEvent, useEffect, useState } from "react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import { ShopifyBadge } from "./shopify-badge";
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
    variants: SourcedProductBriefValue<{ label?: string; price?: string; currency?: string }[]> | null;
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
  /** Variant facts from the page's JSON-LD; older snapshots predate this field. */
  variants?: SourcedProductBriefValue<{ label?: string; price?: string; currency?: string }[]> | null;
  /** Every photo imported with this confirmation, in workflow order. */
  importedAssetUrls?: string[];
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

/** Compact task-side product snapshot (as persisted in product-import history). */
export type ProductBriefSnapshotLike = {
  sourceUrl: string;
  fetchedPageUrl: string;
  title: { value: string; sourceUrl: string; sourceLabel: string; confidence: ProductBriefConfidence } | null;
  description: { value: string; sourceUrl: string; sourceLabel: string; confidence: ProductBriefConfidence } | null;
  possiblePrice: { amount: string; currency?: string; sourceUrl: string; sourceLabel: string; confidence: ProductBriefConfidence } | null;
  importedAssetUrls?: string[];
  confirmedAt: string;
};

/** Rebuild a confirmable brief from a stored snapshot so a history item can backfill the form. */
export function confirmedBriefFromSnapshot(snapshot: ProductBriefSnapshotLike): ConfirmedProductBrief {
  return {
    sourceUrl: snapshot.sourceUrl,
    fetchedPageUrl: snapshot.fetchedPageUrl,
    title: snapshot.title ? { ...snapshot.title, confirmed: false } : null,
    description: snapshot.description ? { ...snapshot.description, confirmed: false } : null,
    candidateImages: [],
    possiblePrice: snapshot.possiblePrice ? {
      value: { amount: snapshot.possiblePrice.amount, ...(snapshot.possiblePrice.currency ? { currency: snapshot.possiblePrice.currency } : {}) },
      sourceUrl: snapshot.possiblePrice.sourceUrl,
      sourceLabel: snapshot.possiblePrice.sourceLabel,
      confidence: snapshot.possiblePrice.confidence,
      confirmed: false,
    } : null,
    ...(snapshot.importedAssetUrls?.length ? { importedAssetUrls: snapshot.importedAssetUrls } : {}),
    selectionConfirmed: true,
    priceConfirmed: false,
    reviewRequired: true,
    customerConfirmedAt: snapshot.confirmedAt,
  };
}

type PreviewResponse = {
  ok?: boolean;
  preview?: ProductBriefPreview;
  error?: string;
};
type ProductUrlImportResponse = {
  ok?: boolean;
  asset?: ImportedProductAsset;
  assets?: ImportedProductAsset[];
  failed?: Array<{ url: string; error: string }>;
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
  /** Optional multi-asset callback: every selected product photo is imported. */
  onImportedMany?: (assets: ImportedProductAsset[], title?: string, brief?: ConfirmedProductBrief) => void;
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
  const variantsOk = draft.variants === null || draft.variants === undefined || isSourcedValue(draft.variants, (input): input is { label?: string; price?: string; currency?: string }[] =>
    Array.isArray(input) && input.length <= 24 && input.every((entry) => isRecord(entry) && (typeof entry.label === "string" || entry.label === undefined) && (entry.price === undefined || typeof entry.price === "string") && (entry.currency === undefined || typeof entry.currency === "string")));
  if (!titleOk || !descriptionOk || !priceOk || !imageOk || !variantsOk || draft.confirmed !== false || draft.reviewRequired !== true) return;
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
  const next = new URL(login.searchParams.get("next") || "/app/create?view=videoLink", "https://workspace.invalid");
  if (next.pathname.endsWith("/app")) next.pathname = `${next.pathname}/create`;
  for (const key of ["source", "preset", "task", "scene", "template", "tool_id", "prompt"]) next.searchParams.delete(key);
  next.searchParams.set("view", "videoLink");
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

export function ProductUrlImport({ siteId, customerId, csrfToken, loginHref, initialUrl, onImported, onImportedMany }: ProductUrlImportProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState<"preview" | "import" | "">("");
  const [preview, setPreview] = useState<ProductBriefPreview | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

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
      setSelectedImages(parsedPreview.draft.detectedImages.map((image) => image.value).slice(0, 8));
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
    if (!selectedImages.length) { setError("Select at least one product photo to import."); return; }
    setBusy("import");
    setError("");
    setStatus(`Adding ${selectedImages.length} product photo${selectedImages.length === 1 ? "" : "s"}…`);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/customers/${encodeURIComponent(customerId)}/assets/import-images`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            ...customerJsonHeaders(siteId),
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({ urls: selectedImages, label: preview.draft.title?.value?.trim() || undefined }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as ProductUrlImportResponse;
      const assets = (result.assets ?? []).filter((asset) => asset?.id && asset.previewUrl);
      if (!response.ok || !assets.length) {
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
        variants: preview.draft.variants,
        importedAssetUrls: assets.map((asset) => asset.previewUrl),
        selectionConfirmed: true,
        priceConfirmed: false,
        reviewRequired: true,
        customerConfirmedAt: new Date().toISOString(),
      };
      const title = preview.draft.title?.value.trim() || result.product?.title?.trim() || undefined;
      await recordImport(assets[0].id, brief, title);
      const labeled = assets.map((asset) => ({ ...asset, ...(title ? { label: title } : {}) }));
      if (onImportedMany) onImportedMany(labeled, title, brief);
      else onImported(labeled[0], title, brief);
      const skipped = result.failed?.length ?? 0;
      setStatus(
        `Added ${assets.length} product photo${assets.length === 1 ? "" : "s"}${title ? ` for “${title}”` : ""}${skipped ? ` (${skipped} could not be imported)` : ""}.`
      );
      setUrl("");
      setPreview(null);
      setSelectedImages([]);
    } catch {
      setStatus("");
      setError("We couldn’t reach the product page. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  function cancelPreview() {
    setPreview(null);
    setSelectedImages([]);
    setError("");
    setStatus("");
  }

  /** Persist the confirmed import into the customer's product library. */
  async function recordImport(assetId: string, brief: ConfirmedProductBrief, title?: string) {
    if (!customerId) return;
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/customers/${encodeURIComponent(customerId)}/product-imports`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            ...customerJsonHeaders(siteId),
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({
            assetId,
            sourceUrl: brief.sourceUrl,
            fetchedPageUrl: brief.fetchedPageUrl,
            title: title ?? null,
            brief: {
              sourceUrl: brief.sourceUrl,
              fetchedPageUrl: brief.fetchedPageUrl,
              title: brief.title,
              description: brief.description,
              candidateImages: brief.candidateImages,
              possiblePrice: brief.possiblePrice,
              variants: brief.variants,
              importedAssetUrls: brief.importedAssetUrls,
              selectionConfirmed: brief.selectionConfirmed,
              priceConfirmed: brief.priceConfirmed,
              reviewRequired: brief.reviewRequired,
              customerConfirmedAt: brief.customerConfirmedAt
            }
          })
        },
      );
      if (!response.ok) console.error("[aidreamcapes] product import history failed", response.status);
    } catch {
      // History is supplementary; the confirmed brief still rides on the task.
    }
  }

  // Shop photos often block hotlinking; preview them through our own origin so
  // the grid shows the same image the importer will fetch.
  function previewSrc(url: string) {
    if (!customerId) return url;
    return `/api/sites/${encodeURIComponent(siteId)}/customers/${encodeURIComponent(customerId)}/product-images/preview?url=${encodeURIComponent(url)}`;
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
                <img src={previewSrc(preview.draft.detectedImages[0].value)} alt={preview.draft.title?.value || "Product from this page"} />
              ) : <div className={styles.noProductImage}>No product photo found</div>}
              <div className={styles.productSummaryCopy}>
                <span className={styles.summaryEyebrow}>Product found</span>
                <h3>{preview.draft.title?.value || "Product name not found"}</h3>
                <p>{preview.draft.description?.value || "No product description was found on this page."}</p>
                {preview.draft.possiblePrice && <span className={styles.summaryPrice}>Possible price · unconfirmed: {priceText(preview.draft.possiblePrice.value)}</span>}
                {preview.draft.variants?.value.length ? <span className={styles.summaryVariants}>Options found: {preview.draft.variants.value.slice(0, 6).map((variant) => [variant.label, variant.price ? `${variant.price}${variant.currency ? ` ${variant.currency}` : ""}` : ""].filter(Boolean).join(" · ")).filter(Boolean).join(" | ")}{preview.draft.variants.value.length > 6 ? " …" : ""}</span> : null}
                <span className={styles.summaryImageCount}>{preview.draft.detectedImages.length ? `Main product photo · ${preview.draft.detectedImages.length} photo${preview.draft.detectedImages.length === 1 ? "" : "s"} found` : "No photo found"}</span>
              </div>
            </div>
            <div className={styles.imagePicker}>
              <div className={styles.imagePickerHead}>
                <span>Photos to import</span>
                <span className={styles.imagePickerCount}>{selectedImages.length} of {preview.draft.detectedImages.length} selected</span>
              </div>
              <p className={styles.imagePickerHint}>Main sets the product look; Detail and Alt photos add angles the model can reference.</p>
              <div className={styles.imageGrid}>
                {preview.draft.detectedImages.map((image) => {
                  const checked = selectedImages.includes(image.value);
                  const order = selectedImages.indexOf(image.value);
                  return (
                    <label key={image.value} className={`${styles.imageOption} ${checked ? styles.imageOptionSelected : ""}`}>
                      {/* Product image hosts vary, so render this validated HTTPS URL directly. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewSrc(image.value)} alt={preview.draft.title?.value || "Product photo"} loading="lazy" />
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedImages((current) => checked ? current.filter((url) => url !== image.value) : [...current, image.value].slice(0, 8))}
                        aria-label={`Import ${preview.draft.title?.value || "product"} photo`}
                      />
                      {checked && <span className={styles.imageRole}>{order === 0 ? "Main" : order === 1 ? "Detail" : `Alt ${order + 1}`}</span>}
                    </label>
                  );
                })}
              </div>
              <div className={styles.imagePickerActions}>
                <button type="button" className={styles.recommended} onClick={() => setSelectedImages(preview.draft.detectedImages.slice(0, 4).map((image) => image.value))} disabled={busy !== "" || preview.draft.detectedImages.length === 0}>Recommended 4</button>
                <button type="button" className={styles.clear} onClick={() => setSelectedImages(preview.draft.detectedImages.map((image) => image.value).slice(0, 8))} disabled={busy !== ""}>Select all</button>
                <button type="button" className={styles.clear} onClick={() => setSelectedImages([])} disabled={busy !== ""}>Clear</button>
              </div>
            </div>
            <div className={styles.previewActions}>
              <button className={styles.clear} type="button" onClick={cancelPreview} disabled={busy !== ""}>Cancel</button>
              <button className={styles.submit} type="button" onClick={confirmImport} disabled={busy !== "" || !selectedImages.length}>{busy === "import" ? "Adding photos…" : `Import ${selectedImages.length || ""} photo${selectedImages.length === 1 ? "" : "s"}`}</button>
            </div>
            <p className={styles.note}>Confirming imports the product photo and keeps these page details with it. When you add it to a video draft, the product name and page facts are included for review; you still write and save the video description yourself.</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="product-page-url">Product page URL</label>
              <ShopifyBadge />
            </div>
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
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="product-page-url">Product page URL</label>
            <ShopifyBadge />
          </div>
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
