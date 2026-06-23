"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, Save, ShieldCheck, Trash2 } from "lucide-react";
import {
  WorkbenchActionButton,
  WorkbenchSearchInput,
  WorkbenchSearchRow,
  WorkbenchTableHeader,
  WorkbenchTableRow,
  WorkbenchTableShell
} from "@/components/admin/design-workbench";
import {
  ErpField,
  ErpFormGrid,
  ErpInfoList,
  ErpInput,
  ErpSection,
  ErpStatGrid,
  ErpToolbar,
  ErpToolbarField
} from "@/components/admin/erp-primitives";
import { StatusPill } from "@/components/ui";

type CloudflareAccountRow = {
  id: string;
  label: string;
  email: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  isCurrent: boolean;
  status: {
    configured: boolean;
    accountIdConfigured: boolean;
    apiTokenConfigured: boolean;
    apiTokenPreview: string;
    label: string;
    email: string;
    accountId: string;
  };
};

type CloudflarePayload = {
  ok: boolean;
  currentAccountId: string;
  accounts: CloudflareAccountRow[];
  summary: {
    totalAccounts: number;
    configuredAccounts: number;
    currentConfigured: boolean;
  };
};

function csrfTokenFromCookie(): string {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("platform_csrf="))
    ?.slice("platform_csrf=".length) ?? "";
}

function errorLabel(code?: string): string {
  return {
    platform_login_required: "平台登录已失效，请重新登录后再保存。",
    missing_cloudflare_label: "请输入 Cloudflare 账号名称。",
    invalid_cloudflare_email: "请输入有效的 Cloudflare 邮箱。",
    missing_cloudflare_account_id: "请输入 Cloudflare Account ID。",
    missing_cloudflare_account: "请选择 Cloudflare 账号。",
    cloudflare_account_not_found: "Cloudflare 账号不存在。",
    cloudflare_account_not_current: "该账号不是当前全局账号。",
    csrf_token_required: "安全令牌缺失，请刷新页面后重试。",
    platform_forbidden: "当前平台账号没有权限修改 Cloudflare 配置。"
  }[code ?? ""] ?? code ?? "unknown error";
}

export function PlatformCloudflarePanel({
  initialStatus
}: {
  initialStatus: CloudflarePayload;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ id: "", label: "", email: "", accountId: "", apiToken: "", makeCurrent: true });
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState("");
  const [message, setMessage] = useState("配置多个 Cloudflare 账号后，可以选择一个作为当前平台 DNS 运维账号。");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return status.accounts.filter((account) => {
      if (!normalized) return true;
      return [account.label, account.email, account.accountId, account.status.apiTokenPreview].join(" ").toLowerCase().includes(normalized);
    });
  }, [query, status.accounts]);

  function edit(account: CloudflareAccountRow) {
    setForm({ id: account.id, label: account.label, email: account.email, accountId: account.accountId, apiToken: "", makeCurrent: account.isCurrent });
    setMessage(`正在编辑 ${account.label}。API Token 留空会保留原密钥。`);
  }

  async function save() {
    setSaving(true);
    const response = await fetch("/api/platform/cloudflare", {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfTokenFromCookie()
      },
      body: JSON.stringify({
        ...form,
        apiToken: form.apiToken.trim() || undefined
      })
    });
    const result = (await response.json().catch(() => ({}))) as CloudflarePayload & { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(`保存失败：${errorLabel(result.error)}`);
      if (response.status === 401 && result.error === "platform_login_required") {
        router.push("/platform/login");
      }
      return;
    }
    setStatus(result);
    setForm({ id: "", label: "", email: "", accountId: "", apiToken: "", makeCurrent: true });
    setMessage("Cloudflare 账号配置已保存。");
    router.refresh();
  }

  async function updateCurrent(accountId: string, action: "set_current" | "clear_current") {
    setActingId(accountId);
    const response = await fetch("/api/platform/cloudflare", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfTokenFromCookie()
      },
      body: JSON.stringify({ accountId, action })
    });
    const result = (await response.json().catch(() => ({}))) as CloudflarePayload & { error?: string };
    setActingId("");
    if (!response.ok) {
      setMessage(`${action === "clear_current" ? "取消失败" : "切换失败"}：${errorLabel(result.error)}`);
      if (response.status === 401 && result.error === "platform_login_required") {
        router.push("/platform/login");
      }
      return;
    }
    setStatus(result);
    setMessage(action === "clear_current" ? "当前全局 Cloudflare 账号已取消。" : "当前全局 Cloudflare 账号已切换。");
    if (action === "clear_current" && form.id === accountId) {
      setForm((current) => ({ ...current, makeCurrent: false }));
    }
    router.refresh();
  }

  async function deleteAccount(account: CloudflareAccountRow) {
    const confirmed = window.confirm(`确认删除 Cloudflare 账号「${account.label}」？删除后不会再作为平台 DNS 运维账号使用。`);
    if (!confirmed) return;
    setActingId(account.id);
    const response = await fetch("/api/platform/cloudflare", {
      method: "DELETE",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfTokenFromCookie()
      },
      body: JSON.stringify({ accountId: account.id })
    });
    const result = (await response.json().catch(() => ({}))) as CloudflarePayload & { error?: string };
    setActingId("");
    if (!response.ok) {
      setMessage(`删除失败：${errorLabel(result.error)}`);
      if (response.status === 401 && result.error === "platform_login_required") {
        router.push("/platform/login");
      }
      return;
    }
    setStatus(result);
    if (form.id === account.id) {
      setForm({ id: "", label: "", email: "", accountId: "", apiToken: "", makeCurrent: true });
    }
    setMessage(`Cloudflare 账号「${account.label}」已删除。`);
    router.refresh();
  }

  const current = status.accounts.find((account) => account.id === status.currentAccountId);

  return (
    <div className="grid gap-4">
      <ErpToolbar>
        <div className="flex flex-wrap gap-2">
          <ErpToolbarField label="Accounts" value={`${status.summary.configuredAccounts}/${status.summary.totalAccounts}`} />
          <ErpToolbarField label="Current" value={current?.label ?? "missing"} />
          <ErpToolbarField label="Token" value={current?.status.apiTokenConfigured ? current.status.apiTokenPreview : "missing"} />
        </div>
      </ErpToolbar>

      <ErpStatGrid
        columns={3}
        items={[
          { label: "账号数量", value: String(status.summary.totalAccounts), detail: "可维护多个 CF 账号", icon: Cloud, tone: status.summary.totalAccounts ? "good" : "warn" },
          { label: "已配置", value: String(status.summary.configuredAccounts), detail: "包含 Account ID 与 API Token", icon: ShieldCheck, tone: status.summary.configuredAccounts ? "good" : "warn" },
          { label: "当前全局", value: status.summary.currentConfigured ? "ready" : "missing", detail: current?.email ?? "未选择当前账号", icon: Save, tone: status.summary.currentConfigured ? "good" : "warn" }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <ErpSection description="API Token 需要具备 Zone Read 与 DNS Edit 权限。密钥只显示掩码，不会回传完整 token。" eyebrow="cloudflare account" title="Cloudflare 账号配置">
          <div className="grid gap-4">
            <ErpInfoList
              items={[
                { label: "当前账号", value: current?.label ?? "missing", tone: current ? "good" : "warn" },
                { label: "邮箱名称", value: current?.email ?? "missing", tone: current?.email ? "good" : "warn" },
                { label: "Account ID", value: current?.accountId ?? "missing", tone: current?.accountId ? "good" : "warn" },
                { label: "API Token", value: current?.status.apiTokenConfigured ? current.status.apiTokenPreview : "missing", tone: current?.status.apiTokenConfigured ? "good" : "warn" }
              ]}
            />
            <ErpFormGrid>
              <ErpField label="账号名称">
                <ErpInput onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Main Cloudflare" value={form.label} />
              </ErpField>
              <ErpField label="邮箱名称">
                <ErpInput onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="admin@example.com" type="email" value={form.email} />
              </ErpField>
              <ErpField label="Account ID">
                <ErpInput className="font-mono" onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} placeholder="Cloudflare account id" value={form.accountId} />
              </ErpField>
              <ErpField label="API Token">
                <ErpInput autoComplete="off" className="font-mono" onChange={(event) => setForm((current) => ({ ...current, apiToken: event.target.value }))} placeholder={form.id ? "留空则保留当前 token" : "Cloudflare API token"} type="password" value={form.apiToken} />
              </ErpField>
            </ErpFormGrid>
            <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
              <input checked={form.makeCurrent} onChange={(event) => setForm((current) => ({ ...current, makeCurrent: event.target.checked }))} type="checkbox" />
              保存后设为当前全局账号
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="tixing min-w-0 flex-1">{message}</div>
              <button className="input_btn inline-flex h-[38px] items-center gap-1 px-4 disabled:opacity-55" disabled={saving} onClick={save} type="button">
                <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                {saving ? "保存中" : "保存账号"}
              </button>
            </div>
          </div>
        </ErpSection>

        <ErpSection description="选择哪个 Cloudflare 账号作为平台 DNS 运维记录的全局账号。" eyebrow="accounts" title="账号列表">
          <WorkbenchSearchRow
            controls={<WorkbenchSearchInput onChange={setQuery} placeholder="搜索账号、邮箱、account id" value={query} />}
            actions={<WorkbenchActionButton label="重置" onClick={() => setQuery("")} quiet />}
          />
          <WorkbenchTableShell>
            <WorkbenchTableHeader className="md:grid-cols-[minmax(170px,1fr)_minmax(150px,0.75fr)_minmax(140px,0.65fr)_260px]" columns={["账号", "Account ID", "状态", "操作"]} />
            {filtered.length ? filtered.map((account) => (
              <WorkbenchTableRow className="md:grid-cols-[minmax(170px,1fr)_minmax(150px,0.75fr)_minmax(140px,0.65fr)_260px]" key={account.id}>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[#18212f]">{account.label}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{account.email}</div>
                </div>
                <div className="truncate font-mono text-[12px] text-[#667085]">{account.accountId}</div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={account.status.configured ? "已配置" : "缺失"} tone={account.status.configured ? "good" : "warn"} />
                  {account.isCurrent ? <StatusPill label="当前" tone="good" /> : null}
                </div>
                <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                  <button className="admin_btn h-[32px] shrink-0 px-3 text-[12px]" onClick={() => edit(account)} type="button">编辑</button>
                  {account.isCurrent ? (
                    <button className="admin_btn h-[32px] shrink-0 px-3 text-[12px]" disabled={actingId === account.id} onClick={() => updateCurrent(account.id, "clear_current")} type="button">
                      取消当前
                    </button>
                  ) : (
                    <button className="admin_btn h-[32px] shrink-0 px-3 text-[12px]" disabled={actingId === account.id} onClick={() => updateCurrent(account.id, "set_current")} type="button">
                      设为当前
                    </button>
                  )}
                  <button className="admin_btn inline-flex h-[32px] shrink-0 items-center gap-1 px-3 text-[12px] text-[#b42318]" disabled={actingId === account.id} onClick={() => deleteAccount(account)} type="button">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    删除
                  </button>
                </div>
              </WorkbenchTableRow>
            )) : (
              <div className="px-5 py-10 text-center text-[13px] text-[#98a2b3]">暂无 Cloudflare 账号。</div>
            )}
          </WorkbenchTableShell>
        </ErpSection>
      </div>
    </div>
  );
}
