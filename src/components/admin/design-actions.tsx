"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, RefreshCcw, RotateCcw, Send, Undo2 } from "lucide-react";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { PublishGlobalVisualChange } from "@/lib/theme/publish-preflight";
import type { ThemeDraftMeta } from "@/lib/types";

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
  publishDisabledReason = "发布前校验存在阻断项，请先到发布历史页处理。",
  pageVersions = {},
  settingsVersion,
  publishedVersion
}: {
  siteId: string;
  pageId: string;
  designerHref: string;
  previewHref: string;
  liveHref: string;
  dirty: boolean;
  canPublish?: boolean;
  publishDisabledReason?: string;
  pageVersions?: Record<string, ThemeDraftMeta | undefined>;
  settingsVersion?: ThemeDraftMeta;
  publishedVersion?: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(dirty ? "该页面有未发布草稿。" : "页面草稿与线上版本一致。");
  const [busy, setBusy] = useState<"publish" | "rollback" | null>(null);
  const hasReviewedVersions = Object.keys(pageVersions).length > 0 && Object.values(pageVersions).every(Boolean) && Boolean(settingsVersion) && publishedVersion !== undefined;

  async function run(action: "publish" | "rollback") {
    if (action === "publish" && !canPublish) {
      setMessage(publishDisabledReason);
      return;
    }
    if (action === "publish" && !hasReviewedVersions) {
      setMessage("发布版本集合不完整，请从装修器或发布历史页确认发布。");
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
      body: JSON.stringify(
        action === "publish"
          ? {
              actor: "site_admin_demo",
              expectedPageVersions: Object.fromEntries(
                Object.entries(pageVersions)
                  .filter((entry): entry is [string, ThemeDraftMeta] => Boolean(entry[1]))
                  .map(([id, version]) => [id, { revision: version.revision, etag: version.etag }])
              ),
              expectedSettingsVersion: settingsVersion ? { revision: settingsVersion.revision, etag: settingsVersion.etag } : undefined,
              expectedPublishedVersion: publishedVersion
            }
          : { actor: "site_admin_demo" }
      )
    });
    const json = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage(
        action === "publish" && json.error === "theme_publish_global_visual_changes_unacknowledged"
          ? "发布已拦截：当前草稿包含全局视觉变化，请到发布历史页查看具体变化并勾选确认后再发布。"
          : `${action === "publish" ? "发布" : "回滚"}失败：${json.error ?? "unknown error"}`
      );
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
  onBeforePublish,
  pageVersions,
  settingsVersion,
  publishedVersion,
  dirtyPages,
  settingsDirty,
  globalVisualChanges = []
}: {
  siteId: string;
  pageId?: string;
  canPublish: boolean;
  onBeforePublish?: () => Promise<void>;
  pageVersions: Record<string, ThemeDraftMeta | undefined>;
  settingsVersion?: ThemeDraftMeta;
  publishedVersion: number;
  dirtyPages: number;
  settingsDirty: boolean;
  globalVisualChanges?: PublishGlobalVisualChange[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"publish" | "reset" | null>(null);
  const [message, setMessage] = useState("发布会写入整站 published snapshot；重置只恢复 draft，不会改线上。");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ackGlobalVisualChanges, setAckGlobalVisualChanges] = useState(false);
  const reviewedPageCount = Object.keys(pageVersions).length;
  const hasReviewedVersions = reviewedPageCount > 0 && Object.values(pageVersions).every(Boolean) && Boolean(settingsVersion);
  const hasGlobalVisualChanges = globalVisualChanges.length > 0;

  async function requestPublish() {
    if (!pageId) return;
    if (!canPublish && onBeforePublish) {
      setBusy("publish");
      try {
        await onBeforePublish();
      } finally {
        setBusy(null);
        setMessage("已刷新发布检查，请确认通过后再次发布。");
      }
      return;
    }
    if (!canPublish) {
      setMessage("发布检查尚未通过，请先刷新发布检查。");
      return;
    }
    if (!hasReviewedVersions) {
      setMessage("发布版本集合不完整，请刷新页面后重新检查。");
      return;
    }
    setAckGlobalVisualChanges(false);
    setConfirmOpen(true);
  }

  async function publish() {
    if (!pageId) return;
    if (hasGlobalVisualChanges && !ackGlobalVisualChanges) {
      setMessage("发布已暂停：请先确认本次会一起上线的全局样式变化。");
      return;
    }
    setBusy("publish");
    const response = await fetch(`/api/sites/${siteId}/theme/pages/${pageId}/publish`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({
        actor: "site_admin_demo",
        expectedPageVersions: Object.fromEntries(
          Object.entries(pageVersions)
            .filter((entry): entry is [string, ThemeDraftMeta] => Boolean(entry[1]))
            .map(([id, version]) => [id, { revision: version.revision, etag: version.etag }])
        ),
        expectedSettingsVersion: settingsVersion ? { revision: settingsVersion.revision, etag: settingsVersion.etag } : undefined,
        expectedPublishedVersion: publishedVersion,
        acknowledgedGlobalVisualChanges: hasGlobalVisualChanges ? ackGlobalVisualChanges : true
      })
    });
    const json = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      const error = json.error ?? "版本已变化，请刷新后重新检查。";
      setMessage(
        response.status === 409 && error === "theme_publish_global_visual_changes_unacknowledged"
          ? "发布已拦截：存在全局视觉变化，请刷新发布检查并勾选确认后再发布。"
          : response.status === 409
            ? `发布已拦截：${error}`
            : `发布失败：${json.error ?? "unknown error"}`
      );
      return;
    }
    setConfirmOpen(false);
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
          onClick={() => void requestPublish()}
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
      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-[620px] rounded-[12px] border border-[#d9dde4] bg-white shadow-[0_28px_70px_-28px_rgba(15,23,42,0.45)]">
            <div className="border-b border-[#eef0f4] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#667085]">确认发布</p>
                  <h2 className="mt-1 text-[18px] font-semibold text-[#222]">发布整站快照</h2>
                </div>
                <button className="admin_btn h-[30px] px-3" disabled={busy !== null} onClick={() => setConfirmOpen(false)} type="button">
                  取消
                </button>
              </div>
            </div>
            <div className="grid gap-4 px-5 py-4 text-[13px] leading-6 text-[#667085]">
              <p>发布会把所有页面草稿和主题设置写入同一个线上 snapshot。确认前请检查本次范围和版本。</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[8px] border border-[#eef0f4] bg-[#fafafa] p-4">
                  <p className="text-[12px] font-medium text-[#667085]">发布范围</p>
                  <div className="mt-3 grid gap-2 text-[#333]">
                    <div className="flex justify-between gap-3"><span>页面版本集合</span><strong>{reviewedPageCount}</strong></div>
                    <div className="flex justify-between gap-3"><span>待发布页面</span><strong>{dirtyPages}</strong></div>
                    <div className="flex justify-between gap-3"><span>全局设置</span><strong>{settingsDirty ? "有变更" : "无变更"}</strong></div>
                  </div>
                </div>
                <div className="rounded-[8px] border border-[#eef0f4] bg-[#fafafa] p-4">
                  <p className="text-[12px] font-medium text-[#667085]">版本校验</p>
                  <div className="mt-3 grid gap-2 text-[#333]">
                    <div className="flex justify-between gap-3"><span>当前线上版本</span><strong>v{publishedVersion}</strong></div>
                    <div className="flex justify-between gap-3"><span>主题设置草稿版本</span><strong>v{settingsVersion?.revision ?? 1}</strong></div>
                  </div>
                </div>
              </div>
              {hasGlobalVisualChanges ? (
                <div className="rounded-[8px] border border-[#ffd089] bg-[#fff9ed] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-[#8a5a00]">检测到全局视觉变化</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#8a5a00]">
                        这些设置会随本次整站发布一起上线，即使当前页面没有改动。
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-medium text-[#8a5a00]">
                      {globalVisualChanges.length} changes
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {globalVisualChanges.slice(0, 8).map((change) => (
                      <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 text-[12px]" key={change.id}>
                        <span className="font-medium text-[#4a3b1a]">{change.label}</span>
                        <span className="min-w-0 text-[#8a5a00]">
                          <span className="font-mono">{change.live}</span>
                          <span className="px-2">-&gt;</span>
                          <span className="font-mono">{change.draft}</span>
                        </span>
                      </div>
                    ))}
                    {globalVisualChanges.length > 8 ? <div className="text-[12px] text-[#8a5a00]">还有 {globalVisualChanges.length - 8} 项变化未展开。</div> : null}
                  </div>
                  <label className="mt-4 flex items-start gap-2 text-[12px] font-medium text-[#4a3b1a]">
                    <input
                      checked={ackGlobalVisualChanges}
                      className="mt-1 h-4 w-4 accent-[#f4a719]"
                      onChange={(event) => setAckGlobalVisualChanges(event.currentTarget.checked)}
                      type="checkbox"
                    />
                    <span>确认发布全局样式变化</span>
                  </label>
                </div>
              ) : null}
              <div className="rounded-[8px] border border-[#f7d794] bg-[#fff8e8] px-4 py-3 text-[#8a5a00]">
                若页面、全局设置或线上版本在确认前发生变化，这次发布会被版本校验拦截。
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[#eef0f4] px-5 py-4">
              <button className="admin_btn h-[34px] px-4" disabled={busy !== null} onClick={() => setConfirmOpen(false)} type="button">
                返回检查
              </button>
              <button className="input_btn h-[34px] px-4 disabled:cursor-not-allowed disabled:opacity-55" disabled={busy !== null || (hasGlobalVisualChanges && !ackGlobalVisualChanges)} onClick={() => void publish()} type="button">
                {busy === "publish" ? "发布中" : "确认发布"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
    setMessage(`已恢复 v${json.sourceVersion ?? version} 到草稿，线上未改变；发布会把该历史全局设置一起上线。`);
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
