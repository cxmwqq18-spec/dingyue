"use client";

import type { ReactNode } from "react";
import { ArrowRight, Captions, ImageIcon, Link2, MessageSquare, Package, Sparkles, UserRound, Video, X } from "lucide-react";
import { WORKSPACE_MODULES, type WorkspaceView } from "@/lib/aidreamcapes-workspace/navigation";
import { ProductUrlImport, type ConfirmedProductBrief, type ProductUrlImportProps } from "./product-url-import";
import productStyles from "./product-url-import.module.css";
import styles from "./workspace.module.css";

export const workspaceModuleIcons = { agent: Sparkles, video: Video, images: ImageIcon, videoLink: Link2, product: Package, actors: UserRound, chat: MessageSquare, subtitles: Captions };

export type ProductImportRecord = {
  id: string;
  assetId: string;
  previewUrl: string;
  sourceUrl: string;
  fetchedPageUrl: string | null;
  title: string | null;
  brief: unknown;
  createdAt: string;
  updatedAt: string;
};

/** Inline generation run started from this page; the page stays put while it progresses. */
export type ProductInlineRun = {
  taskId: string;
  title: string;
  status: string;
  state: "running" | "ready" | "failed";
  videoUrl?: string;
  /** The page stopped tracking, but the task is still generating in the background. */
  soft?: boolean;
};

export function WorkspaceTools({ all = false, disabled, onNavigate }: { all?: boolean; disabled: boolean; onNavigate: (view: WorkspaceView) => void }) {
  const modules = WORKSPACE_MODULES.filter((item) => item.group === "create" && (all || ["product", "actors", "images"].includes(item.id)));
  return <div className={styles.tools}>{modules.map((item) => {
    const Icon = workspaceModuleIcons[item.id as keyof typeof workspaceModuleIcons];
    return <button key={item.id} className={styles.tool} disabled={disabled} onClick={() => onNavigate(item.id)}><span className={`${styles.toolIcon} ${item.id === "images" ? styles.violet : ""}`}><Icon size={30} /></span><span><h3>{item.title}</h3><p>{item.summary}</p></span></button>;
  })}</div>;
}

/** The original URL to Video module: import a product page, then continue to a video draft. */
export function UrlToVideoPage({ products, disabled, onCreate, ...importProps }: ProductUrlImportProps & { products: { id: string; previewUrl: string; label?: string; confirmedBrief?: ConfirmedProductBrief }[]; disabled: boolean; onCreate: () => void }) {
  return <><div className={styles.pageTitle}><h1>URL to Video</h1><p>Import a product page, review its details, then continue to a video draft.</p></div>
    <ProductUrlImport {...importProps} />
    <section className={styles.panel}>
      <h2>Product for your video</h2>
      {products.length ? <>
        <div className={productStyles.importedProducts}>
          {products.map((item) => {
            const brief = item.confirmedBrief;
            const title = item.label || brief?.title?.value || "Imported product";
            return <article key={item.id} className={productStyles.importedProduct}>
              {/* Imported customer assets may use authenticated URLs. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt={title} />
              <div className={productStyles.importedProductCopy}>
                <span className={productStyles.productStatus}>Product photo added</span>
                <h3>{title}</h3>
                {brief?.description && <p>{brief.description.value}</p>}
                <div className={productStyles.importedProductMeta}>
                  {brief?.possiblePrice && <span>Possible price · unconfirmed: {brief.possiblePrice.value.currency ? `${brief.possiblePrice.value.currency} ` : ""}{brief.possiblePrice.value.amount}</span>}
                  {brief?.fetchedPageUrl && <a href={brief.fetchedPageUrl} target="_blank" rel="noreferrer">View source product page</a>}
                </div>
              </div>
            </article>;
          })}
        </div>
        <p className={productStyles.continueNote}>Review the product details above, add a short video description, then save your draft.</p>
        <div className={styles.footerActions}><button className={`${styles.button} ${styles.primary}`} disabled={disabled} onClick={onCreate}><span>Continue to video draft</span><ArrowRight size={16} /></button></div>
      </> : <p className={styles.help} style={{ marginTop: 12 }}>Paste a product page link above. After you confirm the photo, this section will show the product name, picture, and details before you continue.</p>}
    </section>
  </>;
}

function historySourceLabel(record: ProductImportRecord): string {
  const source = record.fetchedPageUrl ?? record.sourceUrl;
  try { return new URL(source).hostname.replace(/^www\./, ""); } catch { return source; }
}

export function ProductVideoPage({
  disabled,
  imports,
  importsLoading,
  onBackfill,
  onDeleteImport,
  createSlot,
  ...importProps
}: ProductUrlImportProps & {
  disabled: boolean;
  imports: ProductImportRecord[];
  importsLoading: boolean;
  onBackfill: (record: ProductImportRecord) => void;
  onDeleteImport: (importId: string) => void;
  createSlot?: ReactNode;
}) {
  return <>
    <div className={styles.pageTitle}><h1>Product Links</h1><p>Paste a product page link to save its photo and details into your product library, then create a video right here — without leaving this page.</p></div>
    <ProductUrlImport {...importProps} />
    <section className={styles.panel} aria-label="Your product library">
      <h2 className={productStyles.historyHeading}>Your product library{imports.length > 0 && <span className={productStyles.historyCount}>{imports.length}</span>}</h2>
      <p className={styles.help} style={{ marginTop: 4 }}>Every product page you confirm is saved here. Click one to use its photos and details in the video form below.</p>
      {importsLoading
        ? <p className={styles.help} role="status" style={{ marginTop: 12 }}>Loading your products…</p>
        : imports.length
          ? <div className={productStyles.historyList} style={{ marginTop: 12 }}>
            {imports.map((record) => {
              const title = record.title || "Imported product";
              // The stored brief carries the sourced product facts; they live
              // on the library row so nothing dangles outside the list.
              const brief = record.brief as { description?: { value?: unknown }; possiblePrice?: { value?: { amount?: number | string; currency?: string } }; importedAssetUrls?: unknown } | null;
              const rawDescription = typeof brief?.description?.value === "string" ? brief.description.value : "";
              // Commerce descriptions often repeat the title; keep the row scannable.
              const description = rawDescription.toLowerCase().startsWith(title.toLowerCase())
                ? rawDescription.slice(title.length).replace(/^[\s:–—.-]+/, "")
                : rawDescription;
              const price = brief?.possiblePrice?.value;
              const importedPhotos = Array.isArray(brief?.importedAssetUrls) ? brief.importedAssetUrls.length : 0;
              return <div key={record.id} className={productStyles.historyRow}>
                <button type="button" className={productStyles.historyItem} disabled={disabled} onClick={() => onBackfill(record)}>
                  {/* Imported customer assets use authenticated URLs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={productStyles.historyThumb} loading="lazy" decoding="async" src={record.previewUrl} alt={title} />
                  <span className={productStyles.historyCopy}>
                    <span className={productStyles.historyTitle}>{title}</span>
                    {description && <span className={productStyles.historyDescription}>{description}</span>}
                    <span className={productStyles.historyChips}>
                      <span className={productStyles.historyChip}>{new Date(record.updatedAt).toLocaleDateString()}</span>
                      <span className={productStyles.historyChip}>{historySourceLabel(record)}</span>
                      {importedPhotos > 1 && <span className={productStyles.historyChip}>{importedPhotos} photos</span>}
                      {price?.amount != null && price.amount !== "" && <span className={`${productStyles.historyChip} ${productStyles.historyChipPrice}`}>Possible price · unconfirmed: {price.currency ? `${price.currency} ` : ""}{price.amount}</span>}
                    </span>
                  </span>
                  <span className={productStyles.historyUse} aria-hidden="true"><span>Use</span><ArrowRight size={14} /></span>
                </button>
                <button type="button" className={productStyles.historyDelete} aria-label={`Remove ${title} from your product library`} disabled={disabled} onClick={() => onDeleteImport(record.id)}><X size={14} /></button>
              </div>;
            })}
          </div>
          : <p className={productStyles.historyEmpty} style={{ marginTop: 12 }}>No products yet. Paste a product page link above to add your first one.</p>}
    </section>
    <section className={styles.panel} aria-label="Create your video">
      <h2>Create your video</h2>
      <p className={styles.help} style={{ marginTop: 4 }}>Use a product from your library, add a short description, and generate — everything stays on this page.</p>
      {createSlot}
    </section>
  </>;
}

export function BatchDraftPage() {
  return <>
    <div className={styles.pageTitle}>
      <h1>Batch Drafts</h1>
      <p>Create several editable video drafts from one scene and brief. Batch creation is being updated and will be available again soon.</p>
    </div>
    <section className={styles.panel} aria-label="Batch draft availability">
      <div className={styles.empty}>
        <h2>Coming soon</h2>
        <p>Batch Drafts is temporarily unavailable while we update this feature.</p>
        <button className={styles.button} type="button" disabled aria-disabled="true">Coming soon</button>
      </div>
    </section>
  </>;
}
