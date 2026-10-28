"use client";

import type { ReactNode } from "react";
import { ArrowRight, ImageIcon, Link2, Sparkles, UserRound, Video, X } from "lucide-react";
import { WORKSPACE_MODULES, type WorkspaceView } from "@/lib/aidreamcapes-workspace/navigation";
import { ProductUrlImport, type ProductUrlImportProps } from "./product-url-import";
import productStyles from "./product-url-import.module.css";
import styles from "./workspace.module.css";

export const workspaceModuleIcons = { agent: Sparkles, video: Video, images: ImageIcon, product: Link2, actors: UserRound };

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
};

export function WorkspaceTools({ all = false, disabled, onNavigate }: { all?: boolean; disabled: boolean; onNavigate: (view: WorkspaceView) => void }) {
  const modules = WORKSPACE_MODULES.filter((item) => item.group === "create" && (all || ["product", "actors", "images"].includes(item.id)));
  return <div className={styles.tools}>{modules.map((item) => {
    const Icon = workspaceModuleIcons[item.id as keyof typeof workspaceModuleIcons];
    return <button key={item.id} className={styles.tool} disabled={disabled} onClick={() => onNavigate(item.id)}><span className={`${styles.toolIcon} ${item.id === "images" ? styles.violet : ""}`}><Icon size={30} /></span><span><h3>{item.title}</h3><p>{item.summary}</p></span></button>;
  })}</div>;
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
      <h2>Your product library</h2>
      <p className={styles.help} style={{ marginTop: 4 }}>Every product page you confirm is saved here. Click one to use its photo and details in the video form below.</p>
      {importsLoading
        ? <p className={styles.help} role="status" style={{ marginTop: 12 }}>Loading your products…</p>
        : imports.length
          ? <div className={productStyles.historyList} style={{ marginTop: 12 }}>
            {imports.map((record) => {
              const title = record.title || "Imported product";
              return <div key={record.id} className={productStyles.historyRow}>
                <button type="button" className={productStyles.historyItem} disabled={disabled} onClick={() => onBackfill(record)}>
                  {/* Imported customer assets use authenticated URLs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={productStyles.historyThumb} loading="lazy" decoding="async" src={record.previewUrl} alt={title} />
                  <span className={productStyles.historyCopy}>
                    <span className={productStyles.historyTitle}>{title}</span>
                    <span className={productStyles.historyMeta}>{new Date(record.updatedAt).toLocaleString()} · {historySourceLabel(record)}</span>
                  </span>
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
