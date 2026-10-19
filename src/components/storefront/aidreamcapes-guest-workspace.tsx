"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import type { AidreamcapesCreateIntent } from "@/lib/aidreamcapes-create-intent";

// Guest (unsigned) version of the create workspace, AIVideosUGC only. The page
// renders the start form with the URL prefill already applied; any action that
// needs an account (upload or generate) opens the sign-up modal. After login
// the visitor returns to this same URL so the prefill is intact. No account,
// order or generation data is ever loaded for guests, and no public page data
// is fetched in the browser.

type GuestWorkspaceProps = {
  siteId: string;
  siteSlug: string;
  initialIntent?: AidreamcapesCreateIntent;
  initialReturnTo?: string;
};

function AuthModal({ siteId, siteSlug, returnTo, onClose }: { siteId: string; siteSlug: string; returnTo: string; onClose: () => void }) {
  return (
    <div aria-modal="true" className="guest-auth-backdrop" onClick={onClose} role="dialog">
      <div className="guest-auth-modal" onClick={(event) => event.stopPropagation()}>
        <button aria-label="Close" className="guest-auth-close" onClick={onClose} type="button">
          <X strokeWidth={1.8} />
        </button>
        <LoginForm initialMode="register" locale="en" returnTo={returnTo} siteId={siteId} siteSlug={siteSlug} storefrontBasePath="" />
      </div>
    </div>
  );
}

export function AidreamcapesGuestCreateWorkspace({ siteId, siteSlug, initialIntent, initialReturnTo = "/app/create" }: GuestWorkspaceProps) {
  const [authOpen, setAuthOpen] = useState(false);

  const intent = initialIntent;
  const kind = intent?.kind ?? "video";
  const promptText = intent?.prompt ?? "";
  const toolText = intent?.kind === "video" ? intent.tool : (intent?.kind === "photo" ? (intent.tool ?? "") : "");
  const productUrl = intent?.kind === "video" ? intent.productUrl ?? "" : "";
  const sizeText = intent?.kind === "video" ? intent.size ?? "9:16" : "1:1";
  const lengthText = intent?.kind === "video" ? String(intent.length ?? 15) : "";
  const isUrlTool = kind === "video" && intent?.kind === "video" && intent.tool === "url-to-video";

  function requireAuth(event: React.SyntheticEvent) {
    event.preventDefault();
    setAuthOpen(true);
  }

  return (
    <div className="guest-workspace">
      <header className="guest-top">
        <Link className="guest-brand" href="/">AIVideosUGC</Link>
        <nav aria-label="Workspace menu" className="guest-top-nav">
          <Link href="/app/create" className="is-active">Home</Link>
          <Link href="/app/inspirations" prefetch={false}>Inspirations</Link>
        </nav>
        <Link className="guest-login" href="/login">Log In</Link>
      </header>
      <main className="guest-main">
        <div className="guest-create-card">
          <h1>{kind === "photo" ? "Photo" : "Video"}</h1>
          <div className="guest-tabs" role="tablist" aria-label="Create mode">
            <Link aria-selected={kind === "video"} className={kind === "video" ? "is-active" : ""} href="/app/create" role="tab">Video</Link>
            <Link aria-selected={kind === "photo"} className={kind === "photo" ? "is-active" : ""} href="/app/create?tool_id=image_generator" role="tab">Photo</Link>
          </div>
          <form className="guest-form" onSubmit={requireAuth}>
            <button className="guest-drop" onClick={requireAuth} type="button">
              <span className="guest-drop-icon" aria-hidden="true">↑</span>
              <b>Drop your product photo here</b>
              <span>JPG, PNG or WebP · any clear photo works</span>
            </button>
            {isUrlTool ? (
              <label className="guest-field">
                <span>Paste your product page link</span>
                <input defaultValue={productUrl} name="url" placeholder="https://yourstore.com/products/..." readOnly type="url" />
              </label>
            ) : null}
            <label className="guest-field">
              <span>Description</span>
              <textarea defaultValue={promptText} maxLength={600} name="prompt" readOnly rows={4} />
            </label>
            <div className="guest-opts">
              {toolText ? <span className="opt">Tool <b>{toolText}</b></span> : null}
              <span className="opt">Size <b>{sizeText}</b></span>
              {lengthText ? <span className="opt">Length <b>{lengthText} seconds</b></span> : null}
            </div>
            <button className="guest-generate" type="submit">{kind === "photo" ? "Generate Image" : "Generate video"} →</button>
            <small>See the cost before you start</small>
          </form>
        </div>
      </main>
      {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} returnTo={initialReturnTo} siteId={siteId} siteSlug={siteSlug} /> : null}
    </div>
  );
}
