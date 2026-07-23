"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, PlugZap, Power, PowerOff, Save, ShieldCheck, Trash2, X } from "lucide-react";
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
  preferred: boolean;
  enabled: boolean;
  supportsGenerationN: boolean;
  supportsEditN: boolean;
  maxImagesPerRequest: number;
  status: {
    configured: boolean;
    enabled: boolean;
    runnable: boolean;
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
  accepted?: boolean;
  jobId?: string;
  currentProviderId: string;
  modelTypes: string[];
  providers: AiProviderRow[];
  summary: {
    totalProviders: number;
    enabledProviders: number;
    configuredProviders: number;
    runnableProviders: number;
    currentConfigured: boolean;
  };
  test?: {
    ok: boolean;
    status?: number;
    method?: "HEAD" | "GET";
    message: string;
  };
};

type ProviderFormState = {
  id: string;
  label: string;
  aiUrl: string;
  apiKey: string;
  modelType: string;
  makeCurrent: boolean;
  enabled: boolean;
  supportsGenerationN: boolean;
  supportsEditN: boolean;
  maxImagesPerRequest: number;
};

const defaultProviderForm: ProviderFormState = {
  id: "",
  label: "",
  aiUrl: "",
  apiKey: "",
  modelType: "gpt-image-2",
  makeCurrent: true,
  enabled: true,
  supportsGenerationN: false,
  supportsEditN: false,
  maxImagesPerRequest: 1
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
    ai_provider_not_found: "AI 供应商不存在。",
    ai_provider_delete_last: "至少需要保留一个 AI 供应商。",
    ai_provider_delete_failed: "AI 供应商删除失败。"
  }[code ?? ""] ?? code ?? "unknown error";
}

function providerCapabilityText(provider: Pick<AiProviderRow, "supportsGenerationN" | "supportsEditN" | "maxImagesPerRequest">) {
  const maxImages = Math.max(1, Math.min(Math.trunc(Number(provider.maxImagesPerRequest) || 1), 20));
  const generation = provider.supportsGenerationN ? "文生图 n" : "文生图单张";
  const edit = provider.supportsEditN ? "图生图 n" : "图生图单张";
  return `${generation} / ${edit} / 单次参考图 ${maxImages}`;
}

function providerRunnable(provider?: AiProviderRow) {
  return Boolean(provider?.enabled && provider.status.configured);
}

function providerSummary(providers: AiProviderRow[], currentProvider?: AiProviderRow): AiProviderPayload["summary"] {
  return {
    totalProviders: providers.length,
    enabledProviders: providers.filter((provider) => provider.enabled).length,
    configuredProviders: providers.filter((provider) => provider.status.configured).length,
    runnableProviders: providers.filter(providerRunnable).length,
    currentConfigured: providerRunnable(currentProvider)
  };
}

export function PlatformAiProviderPanel({
  initialStatus
}: {
  initialStatus: AiProviderPayload;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ProviderFormState>(defaultProviderForm);
  const [customModelType, setCustomModelType] = useState("");
  const [editForm, setEditForm] = useState<ProviderFormState | null>(null);
  const [editCustomModelType, setEditCustomModelType] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingEdit, setTestingEdit] = useState(false);
  const [currentActionId, setCurrentActionId] = useState<string | null>(null);
  const [enableActionId, setEnableActionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("维护平台级 AI 供应商，只有启用的通道会进入生成队列。API Key 只显示掩码。");
  const [editMessage, setEditMessage] = useState("");

  const modelTypes = useMemo(() => Array.from(new Set(["gpt-image-2", "gpt-5.5", ...status.modelTypes])).filter(Boolean), [status.modelTypes]);
  const effectiveModelType = customModelType.trim() || form.modelType;
  const effectiveEditModelType = editCustomModelType.trim() || editForm?.modelType || "gpt-image-2";
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return status.providers.filter((provider) => {
      if (!normalized) return true;
      return [provider.label, provider.aiUrl, provider.modelType, provider.status.apiKeyPreview].join(" ").toLowerCase().includes(normalized);
    });
  }, [query, status.providers]);

  function edit(provider: AiProviderRow) {
    setEditForm({
      id: provider.id,
      label: provider.label,
      aiUrl: provider.aiUrl,
      apiKey: "",
      modelType: provider.modelType,
      makeCurrent: provider.isCurrent,
      enabled: provider.enabled,
      supportsGenerationN: provider.supportsGenerationN,
      supportsEditN: provider.supportsEditN,
      maxImagesPerRequest: provider.maxImagesPerRequest || 1
    });
    setEditCustomModelType(modelTypes.includes(provider.modelType) ? "" : provider.modelType);
    setEditMessage("API Key 留空会保留原密钥；AI URL 可以清空保存。");
  }

  function validateProviderForm(nextForm: ProviderFormState, modelType: string, mode: "create" | "edit", action: "save" | "test") {
    if (!nextForm.label.trim()) return "请输入供应商名称。";
    if (!modelType.trim()) return "请选择或输入模型类型。";
    if (!nextForm.aiUrl.trim()) {
      if (mode === "edit" && action === "save") return "";
      return mode === "create" ? "请先填写 AI URL，或点击列表里的“编辑”修改已有供应商。" : "AI URL 为空，无法测试连通性。";
    }
    if (action === "test" && !nextForm.apiKey.trim() && !nextForm.id) return "请先填写 API Key 后再测试连通性。";
    return "";
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

  async function saveProvider(nextForm: ProviderFormState, modelType: string, mode: "create" | "edit") {
    const validationError = validateProviderForm(nextForm, modelType, mode, "save");
    if (validationError) {
      if (mode === "edit") setEditMessage(validationError);
      else setMessage(validationError);
      return;
    }
    if (mode === "edit") {
      setSavingEdit(true);
      setEditMessage("正在保存供应商参数...");
    } else {
      setSaving(true);
      setMessage("正在保存 AI 供应商配置...");
    }
    try {
      const result = await request("/api/platform/ai-providers", {
        method: "PUT",
        body: JSON.stringify({
          ...nextForm,
          modelType,
          apiKey: nextForm.apiKey.trim() || undefined
        })
      });
      setStatus(result);
      if (mode === "edit") {
        setEditForm(null);
        setEditCustomModelType("");
        setEditMessage("");
        setMessage(`${nextForm.label.trim() || "AI 供应商"} 已保存，列表已更新。`);
      } else {
        setForm(defaultProviderForm);
        setCustomModelType("");
        setMessage("AI 供应商配置已保存。");
      }
    } catch (error) {
      const text = `保存失败：${error instanceof Error ? error.message : "unknown error"}`;
      if (mode === "edit") setEditMessage(text);
      else setMessage(text);
    } finally {
      if (mode === "edit") setSavingEdit(false);
      else setSaving(false);
    }
  }

  async function testConnection(nextForm: ProviderFormState, modelType: string, mode: "create" | "edit") {
    const validationError = validateProviderForm(nextForm, modelType, mode, "test");
    if (validationError) {
      if (mode === "edit") setEditMessage(validationError);
      else setMessage(validationError);
      return;
    }
    if (mode === "edit") {
      setTestingEdit(true);
      setEditMessage("正在测试连通性...");
    } else {
      setTesting(true);
      setMessage("正在测试连通性...");
    }
    try {
      const result = await request("/api/platform/ai-providers", {
        method: "POST",
        body: JSON.stringify({
          action: "test",
          id: nextForm.id,
          aiUrl: nextForm.aiUrl,
          apiKey: nextForm.apiKey.trim() || undefined,
          modelType
        })
      });
      if (result.providers?.length) setStatus(result);
      const test = result.test;
      const text = result.accepted && result.jobId
        ? `连通性测试已入队：${result.jobId}。可在异步任务中查看结果。`
        : test?.ok
          ? `连通性测试通过：${test.method ?? "GET"} ${test.status ?? 200}`
          : `连通性测试未通过：${test?.message ?? "provider unreachable"}`;
      if (mode === "edit") setEditMessage(text);
      else setMessage(text);
    } catch (error) {
      const text = `测试失败：${error instanceof Error ? error.message : "unknown error"}`;
      if (mode === "edit") setEditMessage(text);
      else setMessage(text);
    } finally {
      if (mode === "edit") setTestingEdit(false);
      else setTesting(false);
    }
  }

  async function makeCurrent(providerId: string) {
    const previousStatus = status;
    setCurrentActionId(providerId);
    setStatus((currentStatus) => {
      const providers = currentStatus.providers.map((provider) => ({
        ...provider,
        isCurrent: provider.id === providerId,
        preferred: provider.id === providerId,
        enabled: provider.id === providerId ? true : provider.enabled,
        status: provider.id === providerId ? { ...provider.status, enabled: true, runnable: provider.status.configured } : provider.status
      }));
      const currentProvider = providers.find((provider) => provider.id === providerId);
      return {
        ...currentStatus,
        currentProviderId: providerId,
        providers,
        summary: providerSummary(providers, currentProvider)
      };
    });
    setMessage("正在切换优先 AI 供应商...");
    try {
      const result = await request("/api/platform/ai-providers", {
        method: "POST",
        body: JSON.stringify({ providerId })
      });
      setStatus(result);
      setMessage("优先 AI 供应商已切换。");
    } catch (error) {
      setStatus(previousStatus);
      setMessage(`切换失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setCurrentActionId(null);
    }
  }

  async function setProviderEnabled(provider: AiProviderRow, enabled: boolean) {
    const previousStatus = status;
    setEnableActionId(provider.id);
    setStatus((currentStatus) => {
      const updatedProviders = currentStatus.providers.map((item) => {
        if (item.id !== provider.id) return item;
        return {
          ...item,
          enabled,
          status: { ...item.status, enabled, runnable: enabled && item.status.configured }
        };
      });
      const enabledCurrent = updatedProviders.find((item) => item.enabled && item.preferred) ?? updatedProviders.find((item) => item.enabled);
      const nextProviders = updatedProviders.map((item) => ({
        ...item,
        isCurrent: item.id === enabledCurrent?.id,
        preferred: item.enabled && item.id === enabledCurrent?.id
      }));
      return {
        ...currentStatus,
        currentProviderId: enabledCurrent?.id ?? "",
        providers: nextProviders,
        summary: providerSummary(nextProviders, enabledCurrent)
      };
    });
    setMessage(`正在${enabled ? "启用" : "禁用"} AI 通道...`);
    try {
      const result = await request("/api/platform/ai-providers", {
        method: "POST",
        body: JSON.stringify({ action: "enabled", providerId: provider.id, enabled })
      });
      setStatus(result);
      if (editForm?.id === provider.id) {
        setEditForm((draft) => draft ? { ...draft, enabled } : draft);
      }
      setMessage(`AI 通道「${provider.label}」已${enabled ? "启用" : "禁用"}。`);
    } catch (error) {
      setStatus(previousStatus);
      setMessage(`${enabled ? "启用" : "禁用"}失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setEnableActionId(null);
    }
  }

  async function deleteProvider(provider: AiProviderRow) {
    if (status.providers.length <= 1) {
      setMessage("至少需要保留一个 AI 供应商。");
      return;
    }
    const confirmed = window.confirm(`确定删除 AI 供应商「${provider.label}」吗？删除后所有站点会自动继承剩余供应商队列。`);
    if (!confirmed) return;
    const previousStatus = status;
    setDeletingId(provider.id);
    setStatus((currentStatus) => {
      const providers = currentStatus.providers.filter((item) => item.id !== provider.id);
      const currentProvider = providers.find((item) => item.enabled && item.isCurrent) ?? providers.find((item) => item.enabled) ?? providers[0];
      const nextProviders = providers.map((item) => ({
        ...item,
        isCurrent: item.id === currentProvider?.id,
        preferred: item.id === currentProvider?.id
      }));
      return {
        ...currentStatus,
        currentProviderId: currentProvider?.id ?? "",
        providers: nextProviders,
        summary: providerSummary(nextProviders, currentProvider)
      };
    });
    setMessage("正在删除 AI 供应商...");
    try {
      const result = await request("/api/platform/ai-providers", {
        method: "DELETE",
        body: JSON.stringify({ providerId: provider.id })
      });
      setStatus(result);
      if (editForm?.id === provider.id) setEditForm(null);
      setMessage(`AI 供应商「${provider.label}」已删除。`);
    } catch (error) {
      setStatus(previousStatus);
      setMessage(`删除失败：${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  }

  const current = status.providers.find((provider) => provider.id === status.currentProviderId);

  return (
    <div className="grid gap-4">
      <ErpToolbar>
        <div className="flex flex-wrap gap-2">
          <ErpToolbarField label="Providers" value={`${status.summary.enabledProviders}/${status.summary.totalProviders}`} />
          <ErpToolbarField label="Current" value={current?.label ?? "missing"} />
          <ErpToolbarField label="Model" value={current?.modelType ?? "missing"} />
          <ErpToolbarField label="API Key" value={current?.status.apiKeyConfigured ? current.status.apiKeyPreview : "missing"} />
        </div>
      </ErpToolbar>

      <ErpStatGrid
        columns={3}
        items={[
          { label: "供应商数量", value: String(status.summary.totalProviders), detail: "平台级 AI provider", icon: Bot, tone: status.summary.totalProviders ? "good" : "warn" },
          { label: "已启用", value: String(status.summary.enabledProviders), detail: `${status.summary.runnableProviders} 个可运行通道`, icon: ShieldCheck, tone: status.summary.runnableProviders ? "good" : "warn" },
          { label: "优先供应商", value: status.summary.currentConfigured ? "ready" : "missing", detail: current?.enabled ? current.aiUrl : "未选择已启用供应商", icon: PlugZap, tone: status.summary.currentConfigured ? "good" : "warn" }
        ]}
      />

      <div className="grid gap-4">
        <ErpSection description="支持维护多个 AI 供应商，只有启用通道会进入生成队列。API Key 留空会保留原值。测试连通性会向 AI URL 发起 HEAD/GET，并携带 Authorization。" eyebrow="ai provider" title="AI 供应商配置">
          <div className="grid gap-4">
            <ErpInfoList
              items={[
                { label: "优先供应商", value: current?.label ?? "missing", tone: current ? "good" : "warn" },
                { label: "模型类型", value: current?.modelType ?? "missing", tone: current?.modelType ? "good" : "warn" },
                { label: "启用状态", value: current?.enabled ? "启用" : "未启用", tone: current?.enabled ? "good" : "warn" },
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
              <ErpField label="单次最多参考图">
                <ErpInput
                  min={1}
                  max={20}
                  onChange={(event) => setForm((draft) => ({ ...draft, maxImagesPerRequest: Math.max(1, Math.min(Math.trunc(Number(event.target.value) || 1), 20)) }))}
                  type="number"
                  value={form.maxImagesPerRequest}
                />
              </ErpField>
            </ErpFormGrid>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
                <input checked={form.supportsGenerationN} onChange={(event) => setForm((draft) => ({ ...draft, supportsGenerationN: event.target.checked }))} type="checkbox" />
                文生图支持 n 多图返回
              </label>
              <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
                <input checked={form.supportsEditN} onChange={(event) => setForm((draft) => ({ ...draft, supportsEditN: event.target.checked }))} type="checkbox" />
                图生图支持 n 多图返回
              </label>
              <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
                <input checked={form.makeCurrent} onChange={(event) => setForm((draft) => ({ ...draft, makeCurrent: event.target.checked, enabled: event.target.checked ? true : draft.enabled }))} type="checkbox" />
                保存后设为优先供应商
              </label>
              <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
                <input checked={form.enabled} onChange={(event) => setForm((draft) => ({ ...draft, enabled: event.target.checked, makeCurrent: event.target.checked ? draft.makeCurrent : false }))} type="checkbox" />
                保存后启用通道
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="tixing min-w-0 flex-1">{message}</div>
              <div className="flex flex-wrap gap-2">
                <button className="admin_btn inline-flex h-[38px] items-center justify-center gap-1 whitespace-nowrap px-4 disabled:opacity-55" disabled={testing} onClick={() => testConnection(form, effectiveModelType, "create")} type="button">
                  <PlugZap className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {testing ? "测试中" : "测试连通性"}
                </button>
                <button className="input_btn inline-flex h-[38px] items-center justify-center gap-1 whitespace-nowrap px-4 disabled:opacity-55" disabled={saving} onClick={() => saveProvider(form, effectiveModelType, "create")} type="button">
                  <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {saving ? "保存中" : "保存配置"}
                </button>
              </div>
            </div>
          </div>
        </ErpSection>

        <ErpSection description="选择平台优先使用的 AI 供应商。生成任务只会把已启用的非敏感供应商队列带给 worker，按优先项再到其他配置 fallback。" eyebrow="providers" title="供应商列表">
          <WorkbenchSearchRow
            controls={<WorkbenchSearchInput onChange={setQuery} placeholder="搜索名称、URL、模型、key 掩码" value={query} />}
            actions={<WorkbenchActionButton label="重置" onClick={() => setQuery("")} quiet />}
          />
          <WorkbenchTableShell>
            <WorkbenchTableHeader className="md:grid-cols-[minmax(180px,0.75fr)_minmax(320px,1.25fr)_minmax(180px,0.5fr)_minmax(330px,0.95fr)]" columns={["供应商", "AI URL", "状态", "操作"]} />
            {filtered.length ? filtered.map((provider) => (
              <WorkbenchTableRow className="md:grid-cols-[minmax(180px,0.75fr)_minmax(320px,1.25fr)_minmax(180px,0.5fr)_minmax(330px,0.95fr)]" key={provider.id}>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[#18212f]">{provider.label}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{provider.modelType} / {provider.status.apiKeyPreview || "missing key"}</div>
                  <div className="mt-1 truncate text-[11px] text-[#667085]">{providerCapabilityText(provider)}</div>
                </div>
                <div className="truncate font-mono text-[12px] text-[#667085]">{provider.aiUrl}</div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={provider.enabled ? "启用" : "禁用"} tone={provider.enabled ? "good" : "warn"} />
                  <StatusPill label={provider.status.configured ? "已配置" : "缺失"} tone={provider.status.configured ? "good" : "warn"} />
                  {provider.isCurrent && provider.enabled ? <StatusPill label="优先" tone="good" /> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="admin_btn inline-flex h-[32px] items-center justify-center whitespace-nowrap px-3 text-[12px]" onClick={() => edit(provider)} type="button">编辑</button>
                  <button className="admin_btn inline-flex h-[32px] items-center justify-center whitespace-nowrap px-3 text-[12px]" disabled={provider.isCurrent || currentActionId === provider.id} onClick={() => makeCurrent(provider.id)} type="button">
                    {currentActionId === provider.id ? "切换中" : "设为优先"}
                  </button>
                  <button
                    className="admin_btn inline-flex h-[32px] items-center justify-center gap-1 whitespace-nowrap px-3 text-[12px] disabled:opacity-55"
                    disabled={enableActionId === provider.id}
                    onClick={() => setProviderEnabled(provider, !provider.enabled)}
                    type="button"
                  >
                    {provider.enabled ? <PowerOff className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} /> : <Power className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />}
                    {enableActionId === provider.id ? "处理中" : provider.enabled ? "禁用" : "启用"}
                  </button>
                  <button
                    className="admin_btn inline-flex h-[32px] items-center justify-center gap-1 whitespace-nowrap px-3 text-[12px] text-[#b42318] disabled:opacity-55"
                    disabled={status.providers.length <= 1 || deletingId === provider.id}
                    onClick={() => deleteProvider(provider)}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                    {deletingId === provider.id ? "删除中" : "删除"}
                  </button>
                </div>
              </WorkbenchTableRow>
            )) : (
              <div className="px-5 py-10 text-center text-[13px] text-[#98a2b3]">暂无 AI 供应商。</div>
            )}
          </WorkbenchTableShell>
        </ErpSection>
      </div>

      {editForm ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`编辑${editForm.label || "AI 供应商"}`}>
          <div className="max-h-[calc(100vh-48px)] w-full max-w-2xl overflow-auto rounded-[8px] border border-[#dbe3ef] bg-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.42)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] px-5 py-4">
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-[#667085]">编辑供应商</div>
                <h3 className="mt-1 truncate text-[18px] font-semibold text-[#18212f]">编辑 AI 供应商</h3>
                <p className="mt-1 text-[12px] leading-5 text-[#667085]">在弹窗内修改供应商参数，保存后关闭并更新列表。</p>
              </div>
              <button
                aria-label="关闭编辑弹窗"
                className="admin_btn inline-flex h-9 w-9 shrink-0 items-center justify-center p-0"
                disabled={savingEdit}
                onClick={() => {
                  setEditForm(null);
                  setEditCustomModelType("");
                  setEditMessage("");
                }}
                type="button"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <div className="grid gap-4 px-5 py-4">
              <ErpFormGrid>
                <ErpField label="供应商名称">
                  <ErpInput onChange={(event) => setEditForm((draft) => draft ? { ...draft, label: event.target.value } : draft)} placeholder="OpenAI Primary" value={editForm.label} />
                </ErpField>
                <ErpField label="模型类型">
                  <ErpSelect onChange={(event) => setEditForm((draft) => draft ? { ...draft, modelType: event.target.value } : draft)} value={editForm.modelType}>
                    {modelTypes.map((modelType) => <option key={modelType} value={modelType}>{modelType}</option>)}
                  </ErpSelect>
                </ErpField>
                <ErpField label="AI URL" span="full">
                  <ErpInput className="font-mono" onChange={(event) => setEditForm((draft) => draft ? { ...draft, aiUrl: event.target.value } : draft)} placeholder="可清空，清空后该供应商会显示为缺失" value={editForm.aiUrl} />
                </ErpField>
                <ErpField label="API Key">
                  <ErpInput autoComplete="off" className="font-mono" onChange={(event) => setEditForm((draft) => draft ? { ...draft, apiKey: event.target.value } : draft)} placeholder="留空则保留当前 key" type="password" value={editForm.apiKey} />
                </ErpField>
                <ErpField label="扩展模型">
                  <ErpInput className="font-mono" onChange={(event) => setEditCustomModelType(event.target.value)} placeholder="自定义 modelType，可留空" value={editCustomModelType} />
                </ErpField>
                <ErpField label="单次最多参考图">
                  <ErpInput
                    min={1}
                    max={20}
                    onChange={(event) => setEditForm((draft) => draft ? { ...draft, maxImagesPerRequest: Math.max(1, Math.min(Math.trunc(Number(event.target.value) || 1), 20)) } : draft)}
                    type="number"
                    value={editForm.maxImagesPerRequest}
                  />
                </ErpField>
              </ErpFormGrid>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
                  <input checked={editForm.supportsGenerationN} onChange={(event) => setEditForm((draft) => draft ? { ...draft, supportsGenerationN: event.target.checked } : draft)} type="checkbox" />
                  文生图支持 n 多图返回
                </label>
                <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
                  <input checked={editForm.supportsEditN} onChange={(event) => setEditForm((draft) => draft ? { ...draft, supportsEditN: event.target.checked } : draft)} type="checkbox" />
                  图生图支持 n 多图返回
                </label>
                <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
                  <input checked={editForm.makeCurrent} onChange={(event) => setEditForm((draft) => draft ? { ...draft, makeCurrent: event.target.checked, enabled: event.target.checked ? true : draft.enabled } : draft)} type="checkbox" />
                  保存后设为优先供应商
                </label>
                <label className="inline-flex items-center gap-2 text-[12px] text-[#667085]">
                  <input checked={editForm.enabled} onChange={(event) => setEditForm((draft) => draft ? { ...draft, enabled: event.target.checked, makeCurrent: event.target.checked ? draft.makeCurrent : false } : draft)} type="checkbox" />
                  启用该通道
                </label>
              </div>
              <div className="rounded-[8px] border border-[#e7edf3] bg-[#f8fafc] px-3 py-2 text-[12px] leading-5 text-[#667085]">
                {editMessage || "API Key 留空会保留原密钥；AI URL 支持清空。"}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  className="admin_btn inline-flex h-[38px] items-center justify-center gap-1 whitespace-nowrap px-4 disabled:opacity-55"
                  disabled={testingEdit || savingEdit}
                  onClick={() => testConnection(editForm, effectiveEditModelType, "edit")}
                  type="button"
                >
                  <PlugZap className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {testingEdit ? "测试中" : "测试连通性"}
                </button>
                <button
                  className="input_btn inline-flex h-[38px] items-center justify-center gap-1 whitespace-nowrap px-4 disabled:opacity-55"
                  disabled={savingEdit}
                  onClick={() => saveProvider(editForm, effectiveEditModelType, "edit")}
                  type="button"
                >
                  <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {savingEdit ? "保存中" : "保存修改"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
