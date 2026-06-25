"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, RefreshCcw, RotateCcw, Send, Undo2 } from "lucide-react";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";

function actionButtonClass(tone: "dark" | "light" | "warn" = "light") {
  if (tone === "dark") return "input_btn border-[#00a95f] bg-[#09c878] text-white hover:bg-[#08b66d]";
  if (tone === "warn") return "admin_btn border-[#f4a719] bg-white text-[#b36b00] hover:border-[#f4a719] hover:text-[#f4a719]";
  return "admin_btn border-[#ddd] bg-white text-[#555] hover:border-[#479dff] hover:text-[#479dff]";
}

export function DesignPageActions({
  siteId,
  pageId,
  designerHref,
  previewHref,
  liveHref,
  dirty,
  canPublish = true,
  publishDisabledReason = "发布前校验存在阻断项，请先到发布历史页处理。"
}: {
  siteId: string;
  pageId: string;
  designerHref: string;
  previewHref: string;
  liveHref: string;
  dirty: boolean;
  canPublish?: boolean;
  publishDisabledReason?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(dirty ? "该页面有未发布草稿。" : "页面草稿与线上版本一致。");
  const [busy, setBusy] = useState<"publish" | "rollback" | null>(null);

  async function run(action: "publish" | "rollback") {
    if (action === "publish" && !canPublish) {
      setMessage(publishDisabledReason);
      return;
    }
    setBusy(action);
    const endpoint =
      action === "publish"
        ? `/api/sites/${siteId}/theme/pages/${pageId}/publish`
        : `/api/sites/${siteId}/theme/pages/${pageId}/rollback`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const json = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage(`${action === "publish" ? "发布" : "回滚"}失败：${json.error ?? "unknown error"}`);
      return;
    }
    setMessage(action === "publish" ? `已发布全站快照 v${json.publishedVersion ?? ""}。` : "已把该页草稿还原为线上版本。");
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Link className={`inline-flex min-h-[30px] items-center gap-1 border px-2 text-xs font-normal transition active:scale-[0.98] ${actionButtonClass("light")}`} href={designerHref}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
          装修
        </Link>
        <Link className={`inline-flex min-h-[30px] items-center gap-1 border px-2 text-xs font-normal transition active:scale-[0.98] ${actionButtonClass("light")}`} href={previewHref}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
          预览
        </Link>
        <Link className={`inline-flex min-h-[30px] items-center gap-1 border px-2 text-xs font-normal transition active:scale-[0.98] ${actionButtonClass("light")}`} href={liveHref}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
          前台
        </Link>
        <button
          className={`inline-flex min-h-[30px] items-center gap-1 border px-2 text-xs font-normal transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${actionButtonClass("dark")}`}
          disabled={busy !== null || !canPublish}
          onClick={() => run("publish")}
          type="button"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
          {busy === "publish" ? "发布中" : "发布全站"}
        </button>
        <button
          className={`inline-flex min-h-[30px] items-center gap-1 border px-2 text-xs font-normal transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${actionButtonClass("warn")}`}
          disabled={busy !== null || !dirty}
          onClick={() => run("rollback")}
          type="button"
        >
          <Undo2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          回滚草稿
        </button>
      </div>
      <p className="text-xs leading-5 text-[#999]">{message}</p>
    </div>
  );
}

export function PublicationActions({
  siteId,
  pageId,
  canPublish,
  onBeforePublish
}: {
  siteId: string;
  pageId?: string;
  canPublish: boolean;
  onBeforePublish?: () => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"publish" | "reset" | null>(null);
  const [message, setMessage] = useState("发布会写入整站 published snapshot；重置只恢复 draft，不会改线上。");

  async function publish() {
    if (!pageId) return;
    if (!canPublish && onBeforePublish) {
      setBusy("publish");
      await onBeforePublish();
      setBusy(null);
      setMessage("已刷新发布检查，请确认通过后再次发布。");
      return;
    }
    if (!canPublish) {
      setMessage("发布检查尚未通过，请先刷新发布检查。");
      return;
    }
    setBusy("publish");
    const response = await fetch(`/api/sites/${siteId}/theme/pages/${pageId}/publish`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const json = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage(`发布失败：${json.error ?? "unknown error"}`);
      return;
    }
    setMessage(`当前草稿已发布为 v${json.publishedVersion ?? ""}。`);
    router.refresh();
  }

  async function resetDraft() {
    setBusy("reset");
    const response = await fetch(`/api/sites/${siteId}/theme/reset-draft`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const json = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage(`重置失败：${json.error ?? "unknown error"}`);
      return;
    }
    setMessage(`草稿已从线上发布版本 v${json.sourceVersion ?? ""} 恢复。`);
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          className={`inline-flex min-h-[30px] items-center gap-1 border px-3 text-xs font-normal transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${actionButtonClass("dark")}`}
          disabled={!pageId || busy !== null}
          onClick={publish}
          type="button"
        >
          <Send className="h-4 w-4" strokeWidth={1.8} />
          {busy === "publish" ? "发布中" : "发布当前草稿"}
        </button>
        <button
          className={`inline-flex min-h-[30px] items-center gap-1 border px-3 text-xs font-normal transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${actionButtonClass("warn")}`}
          disabled={busy !== null}
          onClick={resetDraft}
          type="button"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.8} />
          {busy === "reset" ? "恢复中" : "恢复草稿到线上"}
        </button>
        <button
          className={`inline-flex min-h-[30px] items-center gap-1 border px-3 text-xs font-normal transition active:scale-[0.98] ${actionButtonClass("light")}`}
          onClick={() => router.refresh()}
          type="button"
        >
          <RefreshCcw className="h-4 w-4" strokeWidth={1.8} />
          刷新状态
        </button>
      </div>
      <p className="text-xs leading-5 text-[#999]">{message}</p>
    </div>
  );
}

export function RestorePublicationButton({
  siteId,
  publicationId,
  version,
  isActive = false
}: {
  siteId: string;
  publicationId: string;
  version: number;
  isActive?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(isActive ? "当前线上版本，可恢复到草稿继续编辑。" : "历史版本可恢复到草稿后预览再发布。");

  async function restore() {
    setBusy(true);
    const response = await fetch(`/api/sites/${siteId}/theme/publications/${publicationId}/restore-draft`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const json = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(`恢复失败：${json.error ?? "unknown error"}`);
      return;
    }
    setMessage(`已把 v${json.sourceVersion ?? version} 恢复到草稿，线上版本未改变。`);
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <button
        className={`inline-flex min-h-[30px] items-center justify-center gap-1 border px-2 text-xs font-normal transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${actionButtonClass(isActive ? "light" : "warn")}`}
        disabled={busy}
        onClick={restore}
        type="button"
      >
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
        {busy ? "恢复中" : "恢复到草稿"}
      </button>
      <p className="text-xs leading-5 text-[#999]">{message}</p>
    </div>
  );
}
