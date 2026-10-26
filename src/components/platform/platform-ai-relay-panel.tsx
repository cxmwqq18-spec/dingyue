"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, Eye, EyeOff, Link2, RefreshCw, Save, Trash2 } from "lucide-react";
import { WorkbenchActionButton, WorkbenchTableHeader, WorkbenchTableRow, WorkbenchTableShell } from "@/components/admin/design-workbench";
import { ErpCheckboxRow, ErpField, ErpFormGrid, ErpInput, ErpSection, ErpToolbar, ErpToolbarField } from "@/components/admin/erp-primitives";
import { StatusPill } from "@/components/ui";
import { platformJsonHeaders } from "@/lib/client-csrf";
import { platformAiProviderTypeLabel } from "@/lib/ai-provider-type";

type RelayRow = {
  id: string;
  label: string;
  baseUrl: string;
  apiKeyPreview: string;
  apiKeyConfigured: boolean;
  protocol: string;
  enabled: boolean;
  lastSyncedAt?: string;
  lastSyncStatus?: "succeeded" | "failed";
  lastSyncError?: string;
  lastSyncModelCount: number;
  createdAt: string;
  updatedAt: string;
};

type RelayProviderRow = {
  id: string;
  label: string;
  modelType: string;
  providerType: "image" | "video" | "text" | "audio";
  apiProtocol?: string;
  priority: number;
  preferred: boolean;
  enabled: boolean;
  videoModelFamily?: string;
  syncState?: "manual" | "synced" | "upstream_removed";
  upstreamModelId?: string;
};

type RelayPayload = {
  ok: boolean;
  relays: RelayRow[];
  providers: Record<string, RelayProviderRow[]>;
};

type RelayPlanEntry = {
  upstreamModelId: string;
  label: string;
  providerType: "image" | "video" | "audio" | "text";
  apiProtocol: string;
  videoModelFamily: "auto" | "grok" | "gemini";
  action: "create" | "update" | "unchanged" | "remove";
  needsReview: boolean;
  reason: string;
  providerId?: string;
};

type RelayPlan = {
  relayId: string;
  entries: RelayPlanEntry[];
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
};

const actionLabel: Record<RelayPlanEntry["action"], string> = {
  create: "新增",
  update: "更新",
  unchanged: "未变",
  remove: "停用"
};

function relayErrorLabel(code?: string, message?: string) {
  if (message) return message;
  return {
    platform_login_required: "平台登录已失效，请重新登录后再保存。",
    platform_forbidden: "当前平台账号没有权限修改中转平台配置。",
    csrf_token_required: "安全令牌缺失，请刷新页面后重试。",
    csrf_token_mismatch: "安全令牌不匹配，请刷新页面后重试。",
    rate_limited: "操作太频繁，请稍等后重试。",
    missing_ai_relay_label: "请输入中转平台名称。",
    missing_ai_relay_url: "请输入中转平台地址。",
    invalid_ai_relay_url: "请输入有效的 http/https 中转平台地址。",
    missing_ai_relay_api_key: "请输入中转平台 API Key。",
    missing_ai_relay: "请选择中转平台。",
    ai_relay_not_found: "中转平台不存在。",
    ai_relay_model_list_failed: "读取中转平台模型目录失败。"
  }[code ?? ""] ?? code ?? "unknown error";
}

export function PlatformAiRelayPanel() {
  const router = useRouter();
  const [payload, setPayload] = useState<RelayPayload>({ ok: true, relays: [], providers: {} });
  const [message, setMessage] = useState("配置中转平台后，可一键读取上游模型目录并同步为平台通道。API Key 只保存在服务端。");
  const [editing, setEditing] = useState<RelayRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ label: "", baseUrl: "", apiKey: "", enabled: true });
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [plan, setPlan] = useState<RelayPlan | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [revealingKey, setRevealingKey] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/platform/ai-relays", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return;
    const result = (await response.json().catch(() => ({}))) as RelayPayload;
    if (result?.ok) setPayload(result);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function request(endpoint: string, init: RequestInit) {
    const response = await fetch(endpoint, { ...init, credentials: "same-origin", headers: platformJsonHeaders(init.headers) });
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string; plan?: RelayPlan; apiKey?: string; relay?: RelayRow };
    if (!response.ok) {
      if (response.status === 401 && result.error === "platform_login_required") router.push("/platform/login");
      throw new Error(relayErrorLabel(result.error, result.message));
    }
    return result;
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setForm({ label: "", baseUrl: "", apiKey: "", enabled: true });
    setKeyVisible(false);
    setMessage("填写中转平台地址与 API Key，保存后即可读取上游模型目录。");
  }

  function startEdit(relay: RelayRow) {
    setCreating(false);
    setEditing(relay);
    setForm({ label: relay.label, baseUrl: relay.baseUrl, apiKey: "", enabled: relay.enabled });
    setKeyVisible(false);
    setMessage("API Key 留空表示保留已保存的密钥。");
  }

  function closeEditor() {
    setCreating(false);
    setEditing(null);
    setKeyVisible(false);
  }

  async function revealApiKey() {
    if (keyVisible) { setKeyVisible(false); return; }
    if (form.apiKey.trim()) { setKeyVisible(true); return; }
    if (!editing) { setMessage("新增时请直接粘贴 API Key。"); return; }
    setRevealingKey(true);
    setMessage("正在读取当前保存的 API Key…");
    try {
      const result = await request("/api/platform/ai-relays", { method: "POST", body: JSON.stringify({ action: "reveal", relayId: editing.id }) });
      if (!result.apiKey) { setMessage("该中转平台尚未保存 API Key。"); return; }
      setForm((current) => ({ ...current, apiKey: result.apiKey ?? "" }));
      setKeyVisible(true);
      setMessage("已显示当前保存的密钥；如需更换，把新的 key 完整粘贴进来再保存。");
    } catch (error) {
      setMessage(`读取失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setRevealingKey(false);
    }
  }

  async function save() {
    if (!form.label.trim()) { setMessage("请输入中转平台名称。"); return; }
    if (!form.baseUrl.trim()) { setMessage("请输入中转平台地址。"); return; }
    if (!editing && !form.apiKey.trim()) { setMessage("请输入中转平台 API Key。"); return; }
    setSaving(true);
    try {
      const result = await request("/api/platform/ai-relays", {
        method: "PUT",
        body: JSON.stringify({
          id: editing?.id,
          label: form.label.trim(),
          baseUrl: form.baseUrl.trim(),
          apiKey: form.apiKey.trim() || undefined,
          enabled: form.enabled
        })
      });
      if (editing) {
        const preview = result.relay?.apiKeyPreview || editing.apiKeyPreview;
        setMessage(!form.apiKey.trim()
          ? `中转平台配置已保存。API Key 未填写，保留原值 ${preview}。`
          : preview === editing.apiKeyPreview
            ? `中转平台配置已保存。注意：本次提交的 API Key 与原 key 相同（${preview}），不是新的 key。`
            : `中转平台配置已保存。API Key 已更新为 ${preview}。`);
      } else {
        setMessage("中转平台已创建，可读取模型目录。");
      }
      closeEditor();
      await load();
    } catch (error) {
      setMessage(`保存失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function preview(relay: RelayRow) {
    setSyncingId(relay.id);
    setPlan(null);
    try {
      const result = await request("/api/platform/ai-relays", {
        method: "POST",
        body: JSON.stringify({ action: "preview", relayId: relay.id })
      });
      setPlan(result.plan ?? null);
      setMessage(`已读取上游模型目录，新增 ${result.plan?.created ?? 0}、更新 ${result.plan?.updated ?? 0}、停用 ${result.plan?.removed ?? 0}。确认后再写入。`);
    } catch (error) {
      setMessage(`读取失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSyncingId(null);
    }
  }

  async function sync(relay: RelayRow) {
    setSyncingId(relay.id);
    setPlan(null);
    try {
      const result = await request("/api/platform/ai-relays", {
        method: "POST",
        body: JSON.stringify({ action: "sync", relayId: relay.id })
      });
      setMessage(result.message ?? "同步完成。");
      await load();
    } catch (error) {
      setMessage(`同步失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSyncingId(null);
    }
  }

  async function remove(relay: RelayRow) {
    if (!window.confirm(`确定删除中转平台「${relay.label}」吗？已同步的通道会保留但不再归属该中转。`)) return;
    setSyncingId(relay.id);
    try {
      await request("/api/platform/ai-relays", { method: "DELETE", body: JSON.stringify({ relayId: relay.id }) });
      setMessage("中转平台已删除。");
      await load();
    } catch (error) {
      setMessage(`删除失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSyncingId(null);
    }
  }

  const relayRows = useMemo(() => payload.relays ?? [], [payload.relays]);
  const syncedTotal = useMemo(
    () => relayRows.reduce((total, relay) => total + (payload.providers?.[relay.id]?.length ?? 0), 0),
    [payload.providers, relayRows]
  );

  return (
    <ErpSection
      description="中转平台连接只保存地址与密钥；模型目录按需从中转平台实时读取，同步时按模型 ID 幂等写入通道，优先与能力参数仍由人工维护。"
      eyebrow="relay"
      title="中转平台与模型同步"
      action={<WorkbenchActionButton label="新增中转平台" onClick={startCreate} primary />}
    >
      <ErpToolbar>
        <div className="flex flex-wrap gap-2">
          <ErpToolbarField label="中转平台" value={String(relayRows.length)} />
          <ErpToolbarField label="已同步通道" value={String(syncedTotal)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <WorkbenchActionButton label="刷新" onClick={() => void load()} quiet />
        </div>
      </ErpToolbar>

      {creating || editing ? (
        <div className="mt-4 rounded-[8px] border border-[#e6ebf2] bg-[#fbfcfe] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-semibold text-[#1d2939]">{editing ? `编辑中转平台：${editing.label}` : "新增中转平台"}</h3>
            <button className="admin_btn inline-flex h-[32px] items-center px-3 text-[12px]" onClick={closeEditor} type="button">取消</button>
          </div>
          <ErpFormGrid>
            <ErpField label="平台名称"><ErpInput autoComplete="off" onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="例如：影灵中转" value={form.label} /></ErpField>
            <ErpField label="平台地址" hint="填写中转平台根地址，模型目录按 /v1/models 读取。"><ErpInput autoComplete="url" className="font-mono" onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://yinglingapi.com" value={form.baseUrl} /></ErpField>
            <ErpField label="API Key" hint={editing ? "留空保留已保存的密钥；点「显示」可查看当前已保存的 key。" : "密钥仅保存于服务端。"} span="full">
              <div className="flex gap-2">
                <ErpInput autoComplete="new-password" className="min-w-0 flex-1 font-mono" onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder={editing ? "留空保留当前 key（点「显示」可查看）" : "粘贴中转平台 API Key"} type={keyVisible ? "text" : "password"} value={form.apiKey} />
                <button aria-label={keyVisible ? "隐藏 API Key" : "显示 API Key"} className="admin_btn inline-flex h-[38px] shrink-0 items-center gap-1 px-3" disabled={revealingKey} onClick={() => void revealApiKey()} type="button">{keyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{revealingKey ? "读取中" : keyVisible ? "隐藏" : "显示"}</button>
              </div>
            </ErpField>
          </ErpFormGrid>
          <div className="mt-4"><ErpCheckboxRow checked={form.enabled} label="启用该中转平台" onChange={(value) => setForm((current) => ({ ...current, enabled: value }))} /></div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="input_btn inline-flex h-[38px] items-center gap-1.5 px-4 disabled:opacity-55" disabled={saving} onClick={() => void save()} type="button"><Save className="h-3.5 w-3.5" />{saving ? "保存中" : "保存"}</button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <WorkbenchTableShell>
          <WorkbenchTableHeader className="md:grid-cols-[minmax(180px,0.8fr)_minmax(200px,1fr)_minmax(150px,0.6fr)_minmax(220px,0.9fr)_minmax(280px,1.2fr)]" columns={["中转平台", "平台地址", "模型目录", "上次同步", "操作"]} />
          {relayRows.length ? relayRows.map((relay) => {
            const synced = payload.providers?.[relay.id] ?? [];
            return (
              <WorkbenchTableRow className="md:grid-cols-[minmax(180px,0.8fr)_minmax(200px,1fr)_minmax(150px,0.6fr)_minmax(220px,0.9fr)_minmax(280px,1.2fr)]" key={relay.id}>
                <div className="min-w-0"><div className="truncate text-[14px] font-semibold text-[#18212f]">{relay.label}</div><div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{relay.apiKeyConfigured ? relay.apiKeyPreview : "no API key"}</div></div>
                <div className="truncate font-mono text-[12px] text-[#667085]" title={relay.baseUrl}>{relay.baseUrl}</div>
                <div className="flex flex-wrap gap-2"><StatusPill label={`${synced.length} 通道`} tone={synced.length ? "good" : "neutral"} />{relay.enabled ? <StatusPill label="启用" tone="good" /> : <StatusPill label="停用" tone="warn" />}</div>
                <div className="text-[12px] leading-5 text-[#667085]">{relay.lastSyncedAt ? <span className="font-mono text-[11px]">{new Date(relay.lastSyncedAt).toLocaleString("zh-CN")}</span> : <span className="text-[#98a2b3]">尚未同步</span>}{relay.lastSyncStatus === "failed" ? <span className="mt-1 block text-[11px] text-[#b42318]">{relay.lastSyncError ?? "同步失败"}</span> : null}</div>
                <div className="flex flex-wrap gap-2">
                  <button className="admin_btn inline-flex h-[32px] items-center gap-1 px-3 text-[12px] disabled:opacity-55" disabled={syncingId === relay.id} onClick={() => void preview(relay)} type="button"><CloudDownload className="h-3.5 w-3.5" />{syncingId === relay.id ? "读取中" : "预览差异"}</button>
                  <button className="admin_btn inline-flex h-[32px] items-center gap-1 px-3 text-[12px] disabled:opacity-55" disabled={syncingId === relay.id} onClick={() => void sync(relay)} type="button"><RefreshCw className="h-3.5 w-3.5" />{syncingId === relay.id ? "同步中" : "立即同步"}</button>
                  <button className="admin_btn inline-flex h-[32px] items-center gap-1 px-3 text-[12px]" onClick={() => startEdit(relay)} type="button"><Link2 className="h-3.5 w-3.5" />编辑</button>
                  <button className="admin_btn inline-flex h-[32px] items-center gap-1 px-3 text-[12px] text-[#b42318] disabled:opacity-55" disabled={syncingId === relay.id} onClick={() => void remove(relay)} type="button"><Trash2 className="h-3.5 w-3.5" />删除</button>
                </div>
              </WorkbenchTableRow>
            );
          }) : (
            <div className="px-5 py-12 text-center text-[13px] text-[#98a2b3]">还没有中转平台连接。新增中转平台后即可读取上游模型目录并同步为平台通道。</div>
          )}
        </WorkbenchTableShell>
      </div>

      {plan ? (
        <div className="mt-4 rounded-[8px] border border-[#e6ebf2] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-semibold text-[#1d2939]">同步预览（新增 {plan.created} / 更新 {plan.updated} / 停用 {plan.removed} / 未变 {plan.unchanged}）</h3>
            <button className="admin_btn inline-flex h-[32px] items-center px-3 text-[12px]" onClick={() => setPlan(null)} type="button">关闭</button>
          </div>
          <WorkbenchTableShell>
            <WorkbenchTableHeader className="md:grid-cols-[minmax(200px,1.2fr)_minmax(110px,0.6fr)_minmax(150px,0.8fr)_minmax(90px,0.5fr)_minmax(200px,1fr)]" columns={["上游模型 ID", "能力类型", "适配协议", "动作", "说明"]} />
            {plan.entries.map((entry) => (
              <WorkbenchTableRow className="md:grid-cols-[minmax(200px,1.2fr)_minmax(110px,0.6fr)_minmax(150px,0.8fr)_minmax(90px,0.5fr)_minmax(200px,1fr)]" key={`${entry.action}:${entry.upstreamModelId}`}>
                <div className="truncate font-mono text-[12px] text-[#18212f]">{entry.upstreamModelId || "(未知)"}</div>
                <div><StatusPill label={platformAiProviderTypeLabel(entry.providerType)} tone={entry.providerType === "video" ? "neutral" : "good"} /></div>
                <div className="truncate font-mono text-[11px] text-[#667085]">{entry.apiProtocol}</div>
                <div><StatusPill label={actionLabel[entry.action]} tone={entry.action === "create" ? "good" : entry.action === "remove" ? "warn" : "neutral"} /></div>
                <div className="text-[12px] leading-5 text-[#8a94a6]">{entry.needsReview ? "需人工确认能力：" : ""}{entry.reason}</div>
              </WorkbenchTableRow>
            ))}
          </WorkbenchTableShell>
        </div>
      ) : null}

      <div aria-live="polite" className="mt-3 rounded-md bg-[#f8fafc] px-3 py-2 text-[12px] leading-5 text-[#667085]">{message}</div>
    </ErpSection>
  );
}
