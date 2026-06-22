"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, PlugZap, Save, ShieldCheck } from "lucide-react";
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
  ErpSelect,
  ErpStatGrid,
  ErpToolbar,
  ErpToolbarField
} from "@/components/admin/erp-primitives";
import { StatusPill } from "@/components/ui";
import { platformJsonHeaders } from "@/lib/client-csrf";

type AiProviderRow = {
  id: string;
  label: string;
  aiUrl: string;
  modelType: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  isCurrent: boolean;
  status: {
    configured: boolean;
    aiUrlConfigured: boolean;
    apiKeyConfigured: boolean;
    apiKeyPreview: string;
    label: string;
    aiUrl: string;
    modelType: string;
  };
};

type AiProviderPayload = {
  ok: boolean;
  currentProviderId: string;
  modelTypes: string[];
  providers: AiProviderRow[];
  summary: {
    totalProviders: number;
    configuredProviders: number;
    currentConfigured: boolean;
  };
  test?: {
    ok: boolean;
    status?: number;
    method?: "HEAD" | "GET";
    message: string;
  };
};

function errorLabel(code?: string): string {
  return {
    platform_login_required: "平台登录已失效，请重新登录后再保存。",
    platform_forbidden: "当前平台账号没有权限修改 AI 供应商配置。",
    csrf_token_required: "安全令牌缺失，请刷新页面后重试。",
    csrf_token_mismatch: "安全令牌不匹配，请刷新页面后重试。",
    missing_ai_provider_label: "请输入供应商名称。",
    missing_ai_provider_url: "请输入 AI URL。",
    invalid_ai_provider_url: "请输入有效的 http/https AI URL。",
    missing_ai_provider_api_key: "请输入 API Key，或编辑已有供应商时保留原密钥。",
    missing_ai_provider_model_type: "请选择或输入模型类型。",
    missing_ai_provider: "请选择 AI 供应商。",
    ai_provider_not_found: "AI 供应商不存在。"
  }[code ?? ""] ?? code ?? "unknown error";
}

export function PlatformAiProviderPanel({
  initialStatus
}: {
  initialStatus: AiProviderPayload;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ id: "", label: "", aiUrl: "", apiKey: "", modelType: "gpt-image-2", makeCurrent: true });
  const [customModelType, setCustomModelType] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("维护平台级 AI 供应商，选择一个作为优先供应商。API Key 只显示掩码。");

  const modelTypes = useMemo(() => Array.from(new Set(["gpt-image-2", "gpt-5.5", ...status.modelTypes])).filter(Boolean), [status.modelTypes]);
  const effectiveModelType = customModelType.trim() || form.modelType;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return status.providers.filter((provider) => {
      if (!normalized) return true;
      return [provider.label, provider.aiUrl, provider.modelType, provider.status.apiKeyPreview].join(" ").toLowerCase().includes(normalized);
    });
  }, [query, status.providers]);

  function edit(provider: AiProviderRow) {
    setForm({ id: provider.id, label: provider.label, aiUrl: provider.aiUrl, apiKey: "", modelType: provider.modelType, makeCurrent: provider.isCurrent });
    setCustomModelType(modelTypes.includes(provider.modelType) ? "" : provider.modelType);
    setMessage(`正在编辑 ${provider.label}。API Key 留空会保留原密钥。`);
  }

  async function request(endpoint: string, init: RequestInit) {
    const response = await fetch(endpoint, {
      ...init,
      credentials: "same-origin",
      headers: platformJsonHeaders(init.headers)
    });
    const result = (await response.json().catch(() => ({}))) as AiProviderPayload & { error?: string };
    if (!response.ok) {
      if (response.status === 401 && result.error === "platform_login_required") router.push("/platform/login");
      throw new Error(errorLabel(result.error));
    }
    return result;
  }

  async function save() {
    setSaving(true);
    try {
      const result = await request("/api/platform/ai-providers", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          modelType: effectiveModelType,
          apiKey: form.apiKey.trim() || undefined
        })
      });
      setStatus(result);
      setForm({ id: "", label: "", aiUrl: "", apiKey: "", modelType: "gpt-image-2", makeCurrent: true });
      setCustomModelType("");
      setMessage("AI 供应商配置已保存。");
      router.refresh();
    } catch (error) {
      setMessage(`保存失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const result = await request("/api/platform/ai-providers", {
        method: "POST",
        body: JSON.stringify({
          action: "test",
          id: form.id,
          aiUrl: form.aiUrl,
          apiKey: form.apiKey.trim() || undefined,
          modelType: effectiveModelType
        })
      });
      setStatus(result);
      const test = result.test;
      setMessage(test?.ok ? `连通性测试通过：${test.method ?? "GET"} ${test.status ?? 200}` : `连通性测试未通过：${test?.message ?? "provider unreachable"}`);
    } catch (error) {
      setMessage(`测试失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setTesting(false);
    }
  }

  async function makeCurrent(providerId: string) {
    try {
      const result = await request("/api/platform/ai-providers", {
        method: "POST",
        body: JSON.stringify({ providerId })
      });
      setStatus(result);
      setMessage("优先 AI 供应商已切换。");
      router.refresh();
    } catch (error) {
      setMessage(`切换失败：${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const current = status.providers.find((provider) => provider.id === status.currentProviderId);

  return (
    <div className="grid gap-4">
      <ErpToolbar>
        <div className="flex flex-wrap gap-2">
          <ErpToolbarField label="Providers" value={`${status.summary.configuredProviders}/${status.summary.totalProviders}`} />
          <ErpToolbarField label="Current" value={current?.label ?? "missing"} />
          <ErpToolbarField label="Model" value={current?.modelType ?? "missing"} />
          <ErpToolbarField label="API Key" value={current?.status.apiKeyConfigured ? current.status.apiKeyPreview : "missing"} />
        </div>
      </ErpToolbar>

      <ErpStatGrid
        columns={3}
        items={[
          { label: "供应商数量", value: String(status.summary.totalProviders), detail: "平台级 AI provider", icon: Bot, tone: status.summary.totalProviders ? "good" : "warn" },
          { label: "已配置", value: String(status.summary.configuredProviders), detail: "包含 URL、Key 与模型", icon: ShieldCheck, tone: status.summary.configuredProviders ? "good" : "warn" },
          { label: "优先供应商", value: status.summary.currentConfigured ? "ready" : "missing", detail: current?.aiUrl ?? "未选择优先供应商", icon: PlugZap, tone: status.summary.currentConfigured ? "good" : "warn" }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <ErpSection description="支持维护多个 AI 供应商，API Key 留空会保留原值。测试连通性会向 AI URL 发起 HEAD/GET，并携带 Authorization。" eyebrow="ai provider" title="AI 供应商配置">
          <div className="grid gap-4">
            <ErpInfoList
              items={[
                { label: "优先供应商", value: current?.label ?? "missing", tone: current ? "good" : "warn" },
                { label: "模型类型", value: current?.modelType ?? "missing", tone: current?.modelType ? "good" : "warn" },
                { label: "AI URL", value: current?.aiUrl ?? "missing", tone: current?.aiUrl ? "good" : "warn" },
                { label: "API Key", value: current?.status.apiKeyConfigured ? current.status.apiKeyPreview : "missing", tone: current?.status.apiKeyConfigured ? "good" : "warn" }
              ]}
            />
            <ErpFormGrid>
              <ErpField label="供应商名称">
                <ErpInput onChange={(event) => setForm((draft) => ({ ...draft, label: event.target.value }))} placeholder="OpenAI Primary" value={form.label} />
              </ErpField>
              <ErpField label="模型类型">
                <ErpSelect onChange={(event) => setForm((draft) => ({ ...draft, modelType: event.target.value }))} value={form.modelType}>
                  {modelTypes.map((modelType) => <option key={modelType} value={modelType}>{modelType}</option>)}
                </ErpSelect>
              </ErpField>
              <ErpField label="AI URL" span="full">
                <ErpInput className="font-mono" onChange={(event) => setForm((draft) => ({ ...draft, aiUrl: event.target.value }))} placeholder="https://api.example.com/v1/models" value={form.aiUrl} />
              </ErpField>
              <ErpField label="API Key">
                <ErpInput autoComplete="off" className="font-mono" onChange={(event) => setForm((draft) => ({ ...draft, apiKey: event.target.value }))} placeholder={form.id ? "留空则保留当前 key" : "AI provider API key"} type="password" value={form.apiKey} />
              </ErpField>
              <ErpField label="扩展模型">
                <ErpInput className="font-mono" onChange={(event) => setCustomModelType(event.target.value)} placeholder="自定义 modelType，可留空" value={customModelType} />
              </ErpField>
            </ErpFormGrid>
            <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
              <input checked={form.makeCurrent} onChange={(event) => setForm((draft) => ({ ...draft, makeCurrent: event.target.checked }))} type="checkbox" />
              保存后设为优先供应商
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="tixing min-w-0 flex-1">{message}</div>
              <div className="flex flex-wrap gap-2">
                <button className="admin_btn inline-flex h-[38px] items-center gap-1 px-4 disabled:opacity-55" disabled={testing} onClick={testConnection} type="button">
                  <PlugZap className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {testing ? "测试中" : "测试连通性"}
                </button>
                <button className="input_btn inline-flex h-[38px] items-center gap-1 px-4 disabled:opacity-55" disabled={saving} onClick={save} type="button">
                  <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {saving ? "保存中" : "保存配置"}
                </button>
              </div>
            </div>
          </div>
        </ErpSection>

        <ErpSection description="选择平台优先使用的 AI 供应商。生成任务会把非敏感供应商队列带给 worker，按优先项再到其他配置 fallback。" eyebrow="providers" title="供应商列表">
          <WorkbenchSearchRow
            controls={<WorkbenchSearchInput onChange={setQuery} placeholder="搜索名称、URL、模型、key 掩码" value={query} />}
            actions={<WorkbenchActionButton label="重置" onClick={() => setQuery("")} quiet />}
          />
          <WorkbenchTableShell>
            <WorkbenchTableHeader className="md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(130px,0.6fr)_minmax(160px,0.7fr)]" columns={["供应商", "AI URL", "状态", "操作"]} />
            {filtered.length ? filtered.map((provider) => (
              <WorkbenchTableRow className="md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(130px,0.6fr)_minmax(160px,0.7fr)]" key={provider.id}>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[#18212f]">{provider.label}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{provider.modelType} / {provider.status.apiKeyPreview || "missing key"}</div>
                </div>
                <div className="truncate font-mono text-[12px] text-[#667085]">{provider.aiUrl}</div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={provider.status.configured ? "已配置" : "缺失"} tone={provider.status.configured ? "good" : "warn"} />
                  {provider.isCurrent ? <StatusPill label="优先" tone="good" /> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="admin_btn h-[32px] px-3 text-[12px]" onClick={() => edit(provider)} type="button">编辑</button>
                  <button className="admin_btn h-[32px] px-3 text-[12px]" disabled={provider.isCurrent} onClick={() => makeCurrent(provider.id)} type="button">设为优先</button>
                </div>
              </WorkbenchTableRow>
            )) : (
              <div className="px-5 py-10 text-center text-[13px] text-[#98a2b3]">暂无 AI 供应商。</div>
            )}
          </WorkbenchTableShell>
        </ErpSection>
      </div>
    </div>
  );
}
