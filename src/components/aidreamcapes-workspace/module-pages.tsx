"use client";

import { ArrowRight, ImageIcon, Link2, Sparkles, UserRound, Video } from "lucide-react";
import { WORKSPACE_MODULES, type WorkspaceView } from "@/lib/aidreamcapes-workspace/navigation";
import { ProductUrlImport, type ConfirmedProductBrief, type ProductUrlImportProps } from "./product-url-import";
import productStyles from "./product-url-import.module.css";
import styles from "./workspace.module.css";

export const workspaceModuleIcons = { agent: Sparkles, video: Video, images: ImageIcon, product: Link2, actors: UserRound };

export function WorkspaceTools({ all = false, disabled, onNavigate }: { all?: boolean; disabled: boolean; onNavigate: (view: WorkspaceView) => void }) {
  const modules = WORKSPACE_MODULES.filter((item) => item.group === "create" && (all || ["product", "actors", "images"].includes(item.id)));
  return <div className={styles.tools}>{modules.map((item) => {
    const Icon = workspaceModuleIcons[item.id as keyof typeof workspaceModuleIcons];
    return <button key={item.id} className={styles.tool} disabled={disabled} onClick={() => onNavigate(item.id)}><span className={`${styles.toolIcon} ${item.id === "images" ? styles.violet : ""}`}><Icon size={30} /></span><span><h3>{item.title}</h3><p>{item.summary}</p></span></button>;
  })}</div>;
}

export function ProductVideoPage({ products, disabled, onCreate, ...importProps }: ProductUrlImportProps & { products: { id: string; previewUrl: string; label?: string; confirmedBrief?: ConfirmedProductBrief }[]; disabled: boolean; onCreate: () => void }) {
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
