"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Bot, Eye, EyeOff, PlugZap, Power, PowerOff, Plus, Save, Search, ShieldCheck, Trash2, X } from "lucide-react";
import {
  WorkbenchActionButton,
  WorkbenchTableHeader,
  WorkbenchTableRow,
  WorkbenchTableShell
} from "@/components/admin/design-workbench";
import {
  ErpCheckboxRow,
  ErpField,
  ErpFormGrid,
  ErpInput,
  ErpSection,
  ErpSelect,
  ErpStatGrid,
  ErpToolbar,
  ErpToolbarField
} from "@/components/admin/erp-primitives";
import { StatusPill } from "@/components/ui";
import { platformAiProviderTypeLabel, platformAiProviderTypes, type PlatformAiProviderType } from "@/lib/ai-provider-type";
import { platformJsonHeaders } from "@/lib/client-csrf";
import {
  IMAGE_PROVIDER_ASPECT_RATIOS,
  IMAGE_PROVIDER_OUTPUT_FORMATS,
  IMAGE_PROVIDER_QUALITIES,
  IMAGE_PROVIDER_RESOLUTIONS,
  type ImageProviderAspectRatio,
  type ImageProviderOutputFormat,
  type ImageProviderQuality,
  type ImageProviderResolution
} from "@/lib/tokengo-image";
import type { AiProviderProtocolSetting } from "@/lib/video-provider-family";

type AiProviderRow = {
  id: string;
  label: string;
  aiUrl: string;
  modelType: string;
  providerType: PlatformAiProviderType;
  priority: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  isCurrent: boolean;
  preferred: boolean;
  enabled: boolean;
  supportsGenerationN: boolean;
  supportsEditN: boolean;
  maxImagesPerRequest: number;
  imageAspectRatio: ImageProviderAspectRatio;
  imageResolution: ImageProviderResolution;
  imageQuality: ImageProviderQuality;
  imageOutputFormat: ImageProviderOutputFormat;
  apiProtocol?: AiProviderProtocolSetting;
  videoModelFamily?: "auto" | "grok" | "gemini";
  videoDurations?: number[];
  videoAspectRatios?: string[];
  videoNativeSpeech?: boolean | null;
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
    protocol: string;
  };
};

type AiProviderPayload = {
  ok: boolean;
  source?: "relational" | "json-fallback";
  message?: string;
  accepted?: boolean;
  jobId?: string;
  currentProviderId: string;
  currentProviderIds?: Record<PlatformAiProviderType, string>;
  modelTypes: string[];
  providers: AiProviderRow[];
  summary: {
    totalProviders: number;
    enabledProviders: number;
    configuredProviders: number;
    runnableProviders: number;
    currentConfigured: boolean;
    byType?: Record<PlatformAiProviderType, {
      totalProviders: number;
      enabledProviders: number;
      configuredProviders: number;
      runnableProviders: number;
      currentProviderId: string;
      currentConfigured: boolean;
    }>;
  };
  test?: { ok: boolean; status?: number; method?: "HEAD" | "GET"; message: string };
  apiKey?: string;
};

type ProviderFormState = {
  id: string;
  label: string;
  aiUrl: string;
  apiKey: string;
  modelType: string;
  providerType: PlatformAiProviderType;
  apiProtocol: AiProviderProtocolSetting;
  videoModelFamily: "auto" | "grok" | "gemini";
  videoDurations: number[];
  videoAspectRatios: string[];
  videoNativeSpeech: boolean | null;
  priority: number;
  makeCurrent: boolean;
  enabled: boolean;
  supportsGenerationN: boolean;
  supportsEditN: boolean;
  maxImagesPerRequest: number;
  imageAspectRatio: ImageProviderAspectRatio;
  imageResolution: ImageProviderResolution;
  imageQuality: ImageProviderQuality;
  imageOutputFormat: ImageProviderOutputFormat;
};

type EditorMode = "create" | "edit";

const videoProtocolOptions: Array<[AiProviderProtocolSetting, string]> = [
  ["auto", "自动识别旧通道"],
  ["lk888-media", "LK888 Media Task"],
  ["openai-videos", "OpenAI Videos 兼容"],
  ["huitu-openapi", "Huitu OpenAPI"],
  ["tokengo-media", "TokenGo Media"]
];

const durations = [6, 10, 15];
const aspects = ["9:16", "1:1", "16:9"];

function emptyProviderForm(providerType: PlatformAiProviderType, priority = 0): ProviderFormState {
  return {
    id: "", label: "", aiUrl: "", apiKey: "", modelType: "", providerType,
    apiProtocol: "auto", videoModelFamily: "auto", videoDurations: [...durations],
    videoAspectRatios: [...aspects], videoNativeSpeech: null, priority,
    makeCurrent: true, enabled: true, supportsGenerationN: false,
    supportsEditN: providerType === "image", maxImagesPerRequest: providerType === "image" ? 8 : 1,
    imageAspectRatio: "auto", imageResolution: "1K", imageQuality: "low", imageOutputFormat: "png"
  };
}

function providerForm(provider: AiProviderRow): ProviderFormState {
  return {
    ...emptyProviderForm(provider.providerType, provider.priority),
    id: provider.id,
    label: provider.label,
    aiUrl: provider.aiUrl,
    modelType: provider.modelType,
    apiProtocol: provider.apiProtocol ?? "auto",
    videoModelFamily: provider.videoModelFamily ?? "auto",
    videoDurations: provider.videoDurations?.length ? provider.videoDurations : [...durations],
    videoAspectRatios: provider.videoAspectRatios?.length ? provider.videoAspectRatios : [...aspects],
    videoNativeSpeech: provider.videoNativeSpeech ?? null,
    makeCurrent: provider.isCurrent,
    enabled: provider.enabled,
    supportsGenerationN: provider.supportsGenerationN,
    supportsEditN: provider.supportsEditN,
    maxImagesPerRequest: provider.maxImagesPerRequest || 1,
    imageAspectRatio: provider.imageAspectRatio ?? "auto",
    imageResolution: provider.imageResolution ?? "1K",
    imageQuality: provider.imageQuality ?? "low",
    imageOutputFormat: provider.imageOutputFormat ?? "png"
  };
}

function errorLabel(code?: string): string {
  return {
    platform_login_required: "平台登录已失效，请重新登录后再保存。",
    platform_forbidden: "当前平台账号没有权限修改 AI 供应商配置。",
    csrf_token_required: "安全令牌缺失，请刷新页面后重试。",
    csrf_token_mismatch: "安全令牌不匹配，请刷新页面后重试。",
    rate_limited: "操作太频繁，请稍等后重试。",
    missing_ai_provider_label: "请输入供应商名称。",
    missing_ai_provider_url: "请输入 AI URL。",
    invalid_ai_provider_url: "请输入有效的 http/https AI URL。",
    missing_ai_provider_api_key: "请输入 API Key，或编辑已有供应商时保留原密钥。",
    missing_ai_provider_model_type: "请输入模型 ID。",
    invalid_ai_provider_priority: "调用优先级必须是 0 或更大的整数。",
    missing_ai_provider: "请选择 AI 供应商。",
    ai_provider_not_found: "AI 供应商不存在。",
    ai_provider_delete_last: "至少需要保留一个 AI 供应商。",
    ai_provider_delete_failed: "AI 供应商删除失败。"
  }[code ?? ""] ?? code ?? "unknown error";
}

function normalizeProviderPriority(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : Math.max(0, Math.trunc(fallback));
}

function providerCapabilityText(provider: AiProviderRow) {
  if (provider.providerType === "video") {
    const speech = provider.videoNativeSpeech === null || provider.videoNativeSpeech === undefined ? "音频自动识别" : provider.videoNativeSpeech ? "原生音频" : "无原生音频";
    return `${(provider.videoDurations ?? durations).join("/")}s · ${(provider.videoAspectRatios ?? aspects).join("/")} · ${speech}`;
  }
  if (provider.providerType === "image") {
    const mode = provider.supportsEditN ? "支持图生图" : "纯文生图";
    return `${mode} · 最多 ${provider.maxImagesPerRequest} 张参考图`;
  }
  if (provider.providerType === "audio") return "独立音频供应商 · 仅配置";
  return "Chat Completions";
}

function protocolText(protocol: string) {
  return ({
    "lk888-media": "LK888 Media Task",
    "openai-videos": "OpenAI Videos 兼容",
    "huitu-openapi": "Huitu OpenAPI",
    "tokengo-media": "TokenGo Media",
    "tokengo-image": "TokenGo Images",
    "openai-compatible": "OpenAI 兼容",
    auto: "自动识别旧通道"
  } as Record<string, string>)[protocol] ?? protocol ?? "未知";
}

function providerRunnable(provider?: AiProviderRow) {
  return Boolean(provider?.enabled && provider.status.configured);
}

function compareProviderRows(left: AiProviderRow, right: AiProviderRow) {
  return left.providerType.localeCompare(right.providerType) ||
    Number(right.enabled) - Number(left.enabled) ||
    Number(right.status.configured) - Number(left.status.configured) ||
    normalizeProviderPriority(left.priority, Number.MAX_SAFE_INTEGER) - normalizeProviderPriority(right.priority, Number.MAX_SAFE_INTEGER) ||
    Number(right.preferred) - Number(left.preferred) ||
    left.label.localeCompare(right.label);
}

function currentProviderIdsFromProviders(providers: AiProviderRow[]): Record<PlatformAiProviderType, string> {
  const ordered = [...providers].sort(compareProviderRows);
  return Object.fromEntries(platformAiProviderTypes.map((providerType) => {
    const current = ordered.find((provider) => provider.providerType === providerType && provider.enabled);
    return [providerType, current?.id ?? ""];
  })) as Record<PlatformAiProviderType, string>;
}

function ProviderEditor({
  mode,
  form,
  setForm,
  modelTypes,
  saving,
  testing,
  keyVisible,
  revealingKey,
  message,
  onClose,
  onSave,
  onTest,
  onReveal
}: {
  mode: EditorMode;
  form: ProviderFormState;
  setForm: Dispatch<SetStateAction<ProviderFormState | null>>;
  modelTypes: string[];
  saving: boolean;
  testing: boolean;
  keyVisible: boolean;
  revealingKey: boolean;
  message: string;
  onClose: () => void;
  onSave: () => void;
  onTest: () => void;
  onReveal: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const update = <K extends keyof ProviderFormState>(key: K, value: ProviderFormState[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
  };
  const toggleNumber = (key: "videoDurations" | "videoAspectRatios", value: number | string) => {
    setForm((current) => {
      if (!current) return current;
      const list = current[key] as Array<number | string>;
      const next = list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
      return { ...current, [key]: next } as ProviderFormState;
    });
  };
  const protocolOptions = form.providerType === "video"
    ? videoProtocolOptions
    : form.providerType === "image"
      ? [["auto", "自动识别旧通道"], ["tokengo-image", "TokenGo Images"], ["openai-compatible", "OpenAI 兼容"]] as Array<[AiProviderProtocolSetting, string]>
      : [["auto", "自动识别旧通道"], ["openai-compatible", "OpenAI 兼容"]] as Array<[AiProviderProtocolSetting, string]>;

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-slate-950/45 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section aria-label={mode === "create" ? "新增 AI 供应商" : `编辑 ${form.label || "AI 供应商"}`} aria-modal="true" className="flex h-full w-full max-w-[760px] flex-col border-l border-[#dbe3ef] bg-white shadow-[-24px_0_70px_-36px_rgba(15,23,42,0.5)]" role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-[#e8edf4] px-6 py-5">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7f8ca0]">DreamOps · AI Gateway</p>
            <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.03em] text-[#152238]">{mode === "create" ? "接入 AI 供应商" : "编辑 AI 供应商"}</h2>
            <p className="mt-1 max-w-[600px] text-[12px] leading-5 text-[#667085]">使用统一配置维护模型 ID、协议适配器与实际能力。自动识别可继续运行已有供应商。</p>
          </div>
          <button aria-label="关闭面板" className="admin_btn inline-flex h-9 w-9 shrink-0 items-center justify-center p-0" disabled={saving} onClick={onClose} type="button"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6">
            <section>
              <div className="mb-3 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-blue-50 text-[11px] font-semibold text-blue-700">01</span><h3 className="text-[14px] font-semibold text-[#1d2939]">连接信息</h3></div>
              <ErpFormGrid>
                <ErpField label="供应商名称"><ErpInput autoComplete="off" onChange={(event) => update("label", event.target.value)} placeholder="例如：2Ken Grok Imagine Video" value={form.label} /></ErpField>
                <ErpField label="能力类型"><ErpSelect onChange={(event) => { const providerType = event.target.value as PlatformAiProviderType; setForm((current) => current ? { ...emptyProviderForm(providerType, current.priority), ...current, providerType, apiProtocol: "auto", supportsEditN: providerType === "image" ? current.supportsEditN : false } : current); }} value={form.providerType}><option value="image">AI 生图</option><option value="video">AI 生成视频</option><option value="text">AI 文本生成</option><option value="audio">AI 音频</option></ErpSelect></ErpField>
                <ErpField label="模型 ID" hint="直接填写供应商 API 要求的 model 值；支持新模型，无需等候下拉选项更新。"><ErpInput autoComplete="off" list="platform-ai-provider-models" onChange={(event) => update("modelType", event.target.value)} placeholder={form.providerType === "video" ? "例如：grok-imagine-video-1.5" : form.providerType === "image" ? "例如：gpt-image-2" : form.providerType === "audio" ? "填写供应商音频模型 ID" : "例如：gpt-5.5"} value={form.modelType} /><datalist id="platform-ai-provider-models">{modelTypes.map((model) => <option key={model} value={model} />)}</datalist></ErpField>
                <ErpField label="接口协议" hint="自动模式保留旧通道的域名与模型识别规则。"><ErpSelect onChange={(event) => update("apiProtocol", event.target.value as AiProviderProtocolSetting)} value={form.apiProtocol}>{protocolOptions.map(([protocol, label]) => <option key={protocol} value={protocol}>{label}</option>)}</ErpSelect></ErpField>
                <ErpField label="API Base URL" hint="填写供应商的 API 根地址；适配器会负责拼接任务端点。" span="full"><ErpInput autoComplete="url" className="font-mono" onChange={(event) => update("aiUrl", event.target.value)} placeholder="https://api.example.com/v1" value={form.aiUrl} /></ErpField>
                <ErpField label="API Key" hint={mode === "edit" ? "留空保留已保存的密钥；可通过显示按钮读取当前密钥。" : "密钥仅保存于服务端，列表只显示掩码。"} span="full">
                  <div className="flex gap-2"><ErpInput autoComplete="new-password" className="min-w-0 flex-1 font-mono" onChange={(event) => update("apiKey", event.target.value)} placeholder={mode === "edit" ? "留空保留当前 key" : "粘贴供应商 API Key"} type={keyVisible ? "text" : "password"} value={form.apiKey} /><button aria-label={keyVisible ? "隐藏 API Key" : "显示 API Key"} className="admin_btn inline-flex h-[38px] shrink-0 items-center gap-1 px-3" disabled={revealingKey || saving} onClick={onReveal} type="button">{keyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{revealingKey ? "读取中" : keyVisible ? "隐藏" : "显示"}</button></div>
                </ErpField>
              </ErpFormGrid>
            </section>

            {form.providerType === "video" ? (
              <section className="border-t border-[#edf1f6] pt-5">
                <div className="mb-1 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-violet-50 text-[11px] font-semibold text-violet-700">02</span><h3 className="text-[14px] font-semibold text-[#1d2939]">视频模型能力</h3></div>
                <p className="mb-4 pl-8 text-[11px] leading-5 text-[#667085]">只勾选供应商文档已确认支持的参数；工作台目录与实际派发会遵守这些设置。</p>
                <ErpFormGrid>
                  <ErpField label="模型系列" hint="影响 Grok / Gemini 的模型家族分派与计价。"><ErpSelect onChange={(event) => update("videoModelFamily", event.target.value as ProviderFormState["videoModelFamily"])} value={form.videoModelFamily}><option value="auto">按模型 ID 自动识别</option><option value="grok">Grok 系列</option><option value="gemini">Gemini / Veo 系列</option></ErpSelect></ErpField>
                  <ErpField label="原生语音" hint="角色口播场景只会开放给确认支持原生音频的模型。"><ErpSelect onChange={(event) => update("videoNativeSpeech", event.target.value === "auto" ? null : event.target.value === "yes")} value={form.videoNativeSpeech === null || form.videoNativeSpeech === undefined ? "auto" : form.videoNativeSpeech ? "yes" : "no"}><option value="auto">自动识别（兼容旧模型）</option><option value="yes">支持原生语音</option><option value="no">不支持原生语音</option></ErpSelect></ErpField>
                  <ErpField label="单次参考图上限" hint="用于视频生成可用性检查与任务派发。"><ErpInput min={1} max={20} onChange={(event) => update("maxImagesPerRequest", Math.max(1, Math.min(20, Math.trunc(Number(event.target.value) || 1))))} type="number" value={form.maxImagesPerRequest} /></ErpField>
                </ErpFormGrid>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div><p className="mb-2 text-[12px] font-medium text-[#475467]">支持时长</p><div className="flex flex-wrap gap-2">{durations.map((duration) => <ErpCheckboxRow key={duration} checked={form.videoDurations.includes(duration)} label={`${duration} 秒`} onChange={() => toggleNumber("videoDurations", duration)} />)}</div></div>
                  <div><p className="mb-2 text-[12px] font-medium text-[#475467]">支持画幅</p><div className="flex flex-wrap gap-2">{aspects.map((aspect) => <ErpCheckboxRow key={aspect} checked={form.videoAspectRatios.includes(aspect)} label={aspect} onChange={() => toggleNumber("videoAspectRatios", aspect)} />)}</div></div>
                </div>
                <p className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">参考音频克隆和首尾帧传输尚未接入这些旧通道，保存能力声明不会启用这两项。</p>
              </section>
            ) : null}

            {form.providerType === "image" ? (
              <section className="border-t border-[#edf1f6] pt-5">
                <div className="mb-1 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-50 text-[11px] font-semibold text-emerald-700">02</span><h3 className="text-[14px] font-semibold text-[#1d2939]">图片能力</h3></div>
                <p className="mb-4 pl-8 text-[11px] leading-5 text-[#667085]">图片参数会作为该供应商的默认值传给 worker。</p>
                <ErpFormGrid>
                  <ErpField label="图片比例"><ErpSelect onChange={(event) => update("imageAspectRatio", event.target.value as ImageProviderAspectRatio)} value={form.imageAspectRatio}>{IMAGE_PROVIDER_ASPECT_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{ratio === "auto" ? "自动" : ratio}</option>)}</ErpSelect></ErpField>
                  <ErpField label="分辨率"><ErpSelect onChange={(event) => update("imageResolution", event.target.value as ImageProviderResolution)} value={form.imageResolution}>{IMAGE_PROVIDER_RESOLUTIONS.map((value) => <option key={value}>{value}</option>)}</ErpSelect></ErpField>
                  <ErpField label="生成质量"><ErpSelect onChange={(event) => update("imageQuality", event.target.value as ImageProviderQuality)} value={form.imageQuality}>{IMAGE_PROVIDER_QUALITIES.map((value) => <option key={value} value={value}>{({ auto: "自动", low: "低", medium: "中", high: "高" } as Record<ImageProviderQuality, string>)[value]}</option>)}</ErpSelect></ErpField>
                  <ErpField label="输出格式"><ErpSelect onChange={(event) => update("imageOutputFormat", event.target.value as ImageProviderOutputFormat)} value={form.imageOutputFormat}>{IMAGE_PROVIDER_OUTPUT_FORMATS.map((value) => <option key={value}>{value.toUpperCase()}</option>)}</ErpSelect></ErpField>
                </ErpFormGrid>
                <div className="mt-4 flex flex-wrap gap-2"><ErpCheckboxRow checked={form.supportsGenerationN} label="文生图支持多图返回" onChange={(value) => update("supportsGenerationN", value)} /><ErpCheckboxRow checked={form.supportsEditN} label="支持参考图编辑" onChange={(value) => update("supportsEditN", value)} /><ErpCheckboxRow checked={form.makeCurrent} label="保存后设为类型优先" onChange={(value) => setForm((current) => current ? { ...current, makeCurrent: value, enabled: value || current.enabled } : current)} /></div>
              </section>
            ) : null}

            {form.providerType === "text" ? <section className="border-t border-[#edf1f6] pt-5"><h3 className="text-[14px] font-semibold text-[#1d2939]">文本模型能力</h3><p className="mt-1 text-[11px] leading-5 text-[#667085]">目前通过 OpenAI 兼容的 Chat Completions 接口生成结构化分镜。</p></section> : null}

            {form.providerType === "audio" ? <section className="border-t border-[#edf1f6] pt-5"><h3 className="text-[14px] font-semibold text-[#1d2939]">音频供应商配置</h3><p className="mt-1 text-[11px] leading-5 text-[#667085]">保存独立音频供应商的连接信息与模型 ID；音频任务适配器尚未接入，启用配置不会触发音频生成。</p></section> : null}

            <section className="border-t border-[#edf1f6] pt-5">
              <div className="mb-3 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-700">03</span><h3 className="text-[14px] font-semibold text-[#1d2939]">调度策略</h3></div>
              <ErpFormGrid>
                <ErpField label="调用优先级" hint="数字越小越先调用；同类型通道按此值 fallback。"><ErpInput min={0} onChange={(event) => update("priority", normalizeProviderPriority(event.target.value))} type="number" value={form.priority} /></ErpField>
                <ErpField label="通道状态"><ErpSelect onChange={(event) => { const enabled = event.target.value === "enabled"; update("enabled", enabled); if (!enabled) update("makeCurrent", false); }} value={form.enabled ? "enabled" : "disabled"}><option value="enabled">{form.providerType === "audio" ? "启用配置" : "启用，加入生成队列"}</option><option value="disabled">禁用，保留配置</option></ErpSelect></ErpField>
              </ErpFormGrid>
              <div className="mt-4"><ErpCheckboxRow checked={form.makeCurrent} label="保存后设为该类型优先供应商" onChange={(value) => setForm((current) => current ? { ...current, makeCurrent: value, enabled: value || current.enabled } : current)} /></div>
            </section>
          </div>
        </div>
        <footer className="flex flex-col gap-3 border-t border-[#e8edf4] bg-[#fbfcfe] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="min-w-0 flex-1 text-[12px] leading-5 text-[#667085]">{message}</p>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button className="admin_btn inline-flex h-[38px] items-center gap-1.5 px-3.5 disabled:opacity-55" disabled={testing || saving} onClick={onTest} type="button"><PlugZap className="h-3.5 w-3.5" />{testing ? "测试中" : "测试连接"}</button>
            <button className="input_btn inline-flex h-[38px] items-center gap-1.5 px-4 disabled:opacity-55" disabled={saving || testing} onClick={onSave} type="button"><Save className="h-3.5 w-3.5" />{saving ? "保存中" : mode === "create" ? "创建供应商" : "保存修改"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function PlatformAiProviderPanel({ initialStatus }: { initialStatus: AiProviderPayload }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PlatformAiProviderType>("all");
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [editorForm, setEditorForm] = useState<ProviderFormState | null>(null);
  const [message, setMessage] = useState("自动识别保留旧视频通道；新接入模型可填写模型 ID 并明确指定 API 协议。API Key 只显示掩码。");
  const [editorMessage, setEditorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const [revealingKey, setRevealingKey] = useState(false);
  const [currentActionId, setCurrentActionId] = useState<string | null>(null);
  const [enableActionId, setEnableActionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const modelTypes = useMemo(() => Array.from(new Set(["gpt-image-2", "gpt-5.5", ...status.modelTypes])).filter(Boolean), [status.modelTypes]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return status.providers.filter((provider) => {
      if (typeFilter !== "all" && provider.providerType !== typeFilter) return false;
      if (!normalized) return true;
      return [provider.label, provider.aiUrl, provider.modelType, provider.providerType, platformAiProviderTypeLabel(provider.providerType), provider.status.apiKeyPreview, provider.status.protocol].join(" ").toLowerCase().includes(normalized);
    }).sort(compareProviderRows);
  }, [query, status.providers, typeFilter]);

  async function request(endpoint: string, init: RequestInit) {
    const response = await fetch(endpoint, { ...init, credentials: "same-origin", headers: platformJsonHeaders(init.headers) });
    const result = (await response.json().catch(() => ({}))) as AiProviderPayload & { error?: string; apiKey?: string };
    if (!response.ok) {
      if (response.status === 401 && result.error === "platform_login_required") router.push("/platform/login");
      throw new Error(errorLabel(result.error));
    }
    return result;
  }

  function closeEditor() {
    if (saving) return;
    setEditorMode(null); setEditorForm(null); setEditorMessage(""); setKeyVisible(false); setRevealingKey(false);
  }

  function startCreate(providerType: PlatformAiProviderType) {
    const priority = status.providers.filter((provider) => provider.providerType === providerType).reduce((max, provider) => Math.max(max, normalizeProviderPriority(provider.priority) + 1), 0);
    setEditorMode("create"); setEditorForm(emptyProviderForm(providerType, priority)); setEditorMessage(providerType === "audio" ? "可保存独立音频供应商配置；音频生成尚未接入。" : "新供应商默认为启用；先测试接口，再保存并加入对应能力队列。"); setKeyVisible(false);
  }

  function edit(provider: AiProviderRow) {
    setEditorMode("edit"); setEditorForm(providerForm(provider)); setEditorMessage("修改协议或能力配置会影响后续新任务；正在运行的任务保持原有 provider ID。"); setKeyVisible(false); setRevealingKey(false);
  }

  function validateForm(form: ProviderFormState, action: "save" | "test") {
    if (!form.label.trim()) return "请输入供应商名称。";
    if (!form.modelType.trim()) return "请输入模型 ID。";
    if (!Number.isInteger(form.priority) || form.priority < 0) return "调用优先级必须是 0 或更大的整数。";
    if (!form.aiUrl.trim()) return "请输入 AI Base URL。";
    try { const parsed = new URL(form.aiUrl.trim()); if (!["https:", "http:"].includes(parsed.protocol)) throw new Error(); } catch { return "请输入有效的 http/https AI URL。"; }
    if (action === "save" && !form.apiKey.trim() && !form.id) return "请输入 API Key。";
    if (action === "test" && !form.apiKey.trim() && !form.id) return "请先填写 API Key 后再测试连接。";
    if (form.providerType === "video" && (!form.videoDurations.length || !form.videoAspectRatios.length)) return "至少选择一个视频时长和画幅。";
    return "";
  }

  async function saveProvider() {
    if (!editorForm || !editorMode) return;
    const error = validateForm(editorForm, "save");
    if (error) { setEditorMessage(error); return; }
    setSaving(true); setEditorMessage("正在保存供应商配置…");
    try {
      const result = await request("/api/platform/ai-providers", { method: "PUT", body: JSON.stringify({ ...editorForm, apiKey: editorForm.apiKey.trim() || undefined }) });
      setStatus(result); setMessage(`${editorForm.label.trim()} 已保存，供应商队列已更新。`); setEditorMode(null); setEditorForm(null); setKeyVisible(false); setEditorMessage("");
    } catch (error) { setEditorMessage(`保存失败：${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setSaving(false); }
  }

  async function testConnection() {
    if (!editorForm) return;
    const error = validateForm(editorForm, "test");
    if (error) { setEditorMessage(error); return; }
    setTesting(true); setEditorMessage("正在测试供应商连通性…");
    try {
      const result = await request("/api/platform/ai-providers", { method: "POST", body: JSON.stringify({ action: "test", id: editorForm.id, aiUrl: editorForm.aiUrl, apiKey: editorForm.apiKey.trim() || undefined, modelType: editorForm.modelType, providerType: editorForm.providerType, apiProtocol: editorForm.apiProtocol }) });
      if (result.providers?.length) setStatus(result);
      setEditorMessage(result.accepted && result.jobId ? `连通性测试已入队：${result.jobId}。请在异步任务记录中查看结果。` : result.test?.ok ? `连接成功：${result.test.method ?? "GET"} ${result.test.status ?? 200}` : `连接失败：${result.test?.message ?? "供应商未响应"}`);
    } catch (error) { setEditorMessage(`测试失败：${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setTesting(false); }
  }

  async function revealApiKey() {
    if (!editorForm) return;
    if (keyVisible) { setKeyVisible(false); return; }
    if (editorForm.apiKey.trim()) { setKeyVisible(true); return; }
    if (!editorForm.id) { setEditorMessage("请先输入 API Key。"); return; }
    setRevealingKey(true); setEditorMessage("正在读取当前保存的 API Key…");
    try {
      const result = await request("/api/platform/ai-providers", { method: "POST", body: JSON.stringify({ action: "reveal", providerId: editorForm.id }) });
      if (!result.apiKey) { setEditorMessage("该供应商尚未保存 API Key。"); return; }
      setEditorForm((form) => form ? { ...form, apiKey: result.apiKey ?? "" } : form); setKeyVisible(true); setEditorMessage("已显示当前密钥；留空保存会保留原值。");
    } catch (error) { setEditorMessage(`读取失败：${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setRevealingKey(false); }
  }

  async function makeCurrent(providerId: string) {
    const target = status.providers.find((provider) => provider.id === providerId); if (!target) return;
    setCurrentActionId(providerId); setMessage(`正在切换${platformAiProviderTypeLabel(target.providerType)}优先供应商…`);
    try { const result = await request("/api/platform/ai-providers", { method: "POST", body: JSON.stringify({ providerId }) }); setStatus(result); setMessage(`${platformAiProviderTypeLabel(target.providerType)}优先供应商已切换。`); }
    catch (error) { setMessage(`切换失败：${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setCurrentActionId(null); }
  }

  async function setProviderEnabled(provider: AiProviderRow, enabled: boolean) {
    setEnableActionId(provider.id); setMessage(`正在${enabled ? "启用" : "禁用"} AI 通道…`);
    try { const result = await request("/api/platform/ai-providers", { method: "POST", body: JSON.stringify({ action: "enabled", providerId: provider.id, enabled }) }); setStatus(result); setMessage(`AI 通道「${provider.label}」已${enabled ? "启用" : "禁用"}。`); }
    catch (error) { setMessage(`${enabled ? "启用" : "禁用"}失败：${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setEnableActionId(null); }
  }

  async function deleteProvider(provider: AiProviderRow) {
    if (status.providers.length <= 1) { setMessage("至少需要保留一个 AI 供应商。"); return; }
    if (!window.confirm(`确定删除 AI 供应商「${provider.label}」吗？删除后站点会使用剩余通道。`)) return;
    setDeletingId(provider.id); setMessage("正在删除 AI 供应商…");
    try { const result = await request("/api/platform/ai-providers", { method: "DELETE", body: JSON.stringify({ providerId: provider.id }) }); setStatus(result); setMessage(`AI 供应商「${provider.label}」已删除。`); if (editorForm?.id === provider.id) closeEditor(); }
    catch (error) { setMessage(`删除失败：${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setDeletingId(null); }
  }

  const currentProviderIds = status.currentProviderIds ?? currentProviderIdsFromProviders(status.providers);
  const currentImageProvider = status.providers.find((provider) => provider.id === currentProviderIds.image);
  const currentVideoProvider = status.providers.find((provider) => provider.id === currentProviderIds.video);
  const counts = { all: status.providers.length, image: status.providers.filter((item) => item.providerType === "image").length, video: status.providers.filter((item) => item.providerType === "video").length, text: status.providers.filter((item) => item.providerType === "text").length, audio: status.providers.filter((item) => item.providerType === "audio").length };

  return (
    <div className="grid gap-4">
      <ErpToolbar>
        <div className="flex flex-wrap gap-2"><ErpToolbarField label="供应商" value={`${status.summary.enabledProviders}/${status.summary.totalProviders} 启用`} /><ErpToolbarField label="生图优先" value={currentImageProvider?.label ?? "未设置"} /><ErpToolbarField label="视频优先" value={currentVideoProvider?.label ?? "未设置"} /></div>
        <div className="flex flex-wrap gap-2">{platformAiProviderTypes.map((type) => <button className="admin_btn inline-flex h-[34px] items-center gap-1.5 px-3" key={type} onClick={() => startCreate(type)} type="button"><Plus className="h-3.5 w-3.5" />新增{platformAiProviderTypeLabel(type)}</button>)}</div>
      </ErpToolbar>

      {!status.ok ? <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium leading-5 text-amber-800">{status.message ?? "AI 供应商配置暂时无法从数据库读取，请检查数据库连接后刷新。"}</div> : null}

      <ErpStatGrid columns={3} items={[
        { label: "供应商", value: String(status.summary.totalProviders), detail: `生图 ${counts.image} · 视频 ${counts.video} · 文本 ${counts.text} · 音频 ${counts.audio}`, icon: Bot, tone: status.summary.totalProviders ? "good" : "warn" },
        { label: "已启用", value: String(status.summary.enabledProviders), detail: `${status.summary.runnableProviders} 个通道具备完整连接配置`, icon: ShieldCheck, tone: status.summary.runnableProviders ? "good" : "warn" },
        { label: "当前视频通道", value: currentVideoProvider?.modelType ?? "未设置", detail: currentVideoProvider ? `${protocolText(currentVideoProvider.apiProtocol ?? "auto")} · P${currentVideoProvider.priority}` : "添加并启用一个视频模型", icon: PlugZap, tone: providerRunnable(currentVideoProvider) ? "good" : "warn" }
      ]} />

      <ErpSection description="新增和编辑使用同一套配置流程。自动协议保持旧通道识别逻辑；明确选择协议后会按该适配器提交、轮询和恢复任务。" eyebrow="AI Gateway" title="模型与供应商">
        <div className="mb-4 flex flex-col gap-3 border-b border-[#edf1f6] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1 rounded-lg border border-[#e5eaf1] bg-[#f7f9fc] p-1">{(["all", ...platformAiProviderTypes] as const).map((type) => <button aria-pressed={typeFilter === type} className={`rounded-md px-3 py-2 text-[12px] font-medium transition ${typeFilter === type ? "bg-white text-[#245bd3] shadow-sm" : "text-[#667085] hover:text-[#1d2939]"}`} key={type} onClick={() => setTypeFilter(type)} type="button">{type === "all" ? "全部" : platformAiProviderTypeLabel(type)} <span className="ml-1 font-mono text-[10px] text-[#98a2b3]">{counts[type]}</span></button>)}</div>
          <div className="flex flex-wrap gap-2"><label className="relative min-w-[240px] flex-1 lg:max-w-[380px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" /><input className="erp-input pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="搜索供应商、模型 ID、协议或 URL" value={query} /></label><WorkbenchActionButton label="清除" onClick={() => { setQuery(""); setTypeFilter("all"); }} quiet /></div>
        </div>
        <WorkbenchTableShell>
          <WorkbenchTableHeader className="md:grid-cols-[minmax(210px,0.9fr)_minmax(150px,0.6fr)_minmax(240px,1fr)_minmax(165px,0.6fr)_minmax(330px,1.2fr)]" columns={["模型 / 供应商", "类型 / 优先级", "API Base URL", "状态", "操作"]} />
          {filtered.length ? filtered.map((provider) => <WorkbenchTableRow className="md:grid-cols-[minmax(210px,0.9fr)_minmax(150px,0.6fr)_minmax(240px,1fr)_minmax(165px,0.6fr)_minmax(330px,1.2fr)]" key={provider.id}>
            <div className="min-w-0"><div className="truncate text-[14px] font-semibold text-[#18212f]">{provider.label}</div><div className="mt-1 truncate font-mono text-[11px] text-[#667085]">{provider.modelType}</div><div className="mt-1 text-[11px] leading-5 text-[#8a94a6]">{protocolText(provider.apiProtocol ?? "auto")} · {providerCapabilityText(provider)}</div></div>
            <div className="flex flex-wrap items-center gap-2"><StatusPill label={platformAiProviderTypeLabel(provider.providerType)} tone={provider.providerType === "video" ? "neutral" : "good"} /><span className="font-mono text-[11px] text-[#98a2b3]">P{provider.priority}</span></div>
            <div className="truncate font-mono text-[12px] text-[#667085]" title={provider.aiUrl}>{provider.aiUrl || "未配置"}</div>
            <div className="flex flex-wrap gap-2"><StatusPill label={provider.enabled ? "启用" : "禁用"} tone={provider.enabled ? "good" : "warn"} /><StatusPill label={provider.status.configured ? "已配置" : "缺失"} tone={provider.status.configured ? "good" : "warn"} />{provider.isCurrent && provider.enabled ? <StatusPill label="优先" tone="good" /> : null}<span className="w-full truncate font-mono text-[10px] text-[#98a2b3]">{provider.status.apiKeyConfigured ? provider.status.apiKeyPreview : "no API key"}</span></div>
            <div className="flex flex-wrap gap-2"><button className="admin_btn inline-flex h-[32px] items-center px-3 text-[12px]" onClick={() => edit(provider)} type="button">编辑配置</button><button className="admin_btn inline-flex h-[32px] items-center px-3 text-[12px]" disabled={provider.isCurrent || currentActionId === provider.id} onClick={() => void makeCurrent(provider.id)} type="button">{currentActionId === provider.id ? "切换中" : "设为优先"}</button><button className="admin_btn inline-flex h-[32px] items-center gap-1 px-3 text-[12px] disabled:opacity-55" disabled={enableActionId === provider.id} onClick={() => void setProviderEnabled(provider, !provider.enabled)} type="button">{provider.enabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}{enableActionId === provider.id ? "处理中" : provider.enabled ? "禁用" : "启用"}</button><button className="admin_btn inline-flex h-[32px] items-center gap-1 px-3 text-[12px] text-[#b42318] disabled:opacity-55" disabled={status.providers.length <= 1 || deletingId === provider.id} onClick={() => void deleteProvider(provider)} type="button"><Trash2 className="h-3.5 w-3.5" />{deletingId === provider.id ? "删除中" : "删除"}</button></div>
          </WorkbenchTableRow>) : <div className="px-5 py-12 text-center text-[13px] text-[#98a2b3]">没有匹配的 AI 供应商。检查筛选条件，或新增一个模型通道。</div>}
        </WorkbenchTableShell>
        <div aria-live="polite" className="mt-3 rounded-md bg-[#f8fafc] px-3 py-2 text-[12px] leading-5 text-[#667085]">{message}</div>
      </ErpSection>

      {editorMode && editorForm ? <ProviderEditor mode={editorMode} form={editorForm} setForm={setEditorForm} modelTypes={modelTypes} saving={saving} testing={testing} keyVisible={keyVisible} revealingKey={revealingKey} message={editorMessage} onClose={closeEditor} onSave={() => void saveProvider()} onTest={() => void testConnection()} onReveal={() => void revealApiKey()} /> : null}
    </div>
  );
}
