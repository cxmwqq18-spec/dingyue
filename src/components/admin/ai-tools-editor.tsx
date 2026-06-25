"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { AiProviderConfig, AiWorkflowConfig, AiWorkflowField, AiWorkflowStep, SiteAiApp } from "@/lib/types";

const providerModes: Array<{ label: string; value: AiProviderConfig["mode"] }> = [
  { label: "平台默认通道", value: "platform_fallback" },
  { label: "优先指定通道", value: "preferred_provider" },
  { label: "固定指定通道", value: "fixed_provider" }
];

function fieldsStepFromApp(app: SiteAiApp): AiWorkflowStep {
  const fields: AiWorkflowField[] = app.aiApp.parameterSchema.map((field) => (
    field.type === "select"
      ? {
          id: field.id,
          label: field.label,
          type: "select",
          required: true,
          options: (field.options ?? []).map((option) => ({ label: option, value: option })),
          default: field.options?.[0] ?? ""
        }
      : {
          id: field.id,
          label: field.label,
          type: "text",
          required: true,
          default: ""
        }
  ));
  return {
    id: "generation_options",
    title: "Set generation options",
    description: "Choose the style and request details before starting generation.",
    kind: "fields",
    fields
  };
}

function defaultWorkflowConfig(app: SiteAiApp): AiWorkflowConfig {
  return {
    version: 1,
    flowName: app.aiApp.name,
    description: app.aiApp.description,
    submitLabel: "Start generation",
    materialRules: [
      "Use clear source photos where the face or product is visible.",
      "Select the private uploads that should guide this request.",
      "Review credits before starting generation."
    ],
    promptTemplate: "Create a private image generation for {{flowName}} using {{fields}} and the selected source photos.",
    steps: [
      {
        id: "source_photos",
        title: "Select source photos",
        description: "Choose the private uploads that should guide this request.",
        kind: "asset_select",
        assetRules: { min: 1, max: 4, roles: ["input"], accept: ["image/*"], required: true }
      },
      fieldsStepFromApp(app),
      {
        id: "review_request",
        title: "Review request",
        description: "Confirm selected photos, generation options, credits and delivery.",
        kind: "review"
      }
    ]
  };
}

function workflowFor(app: SiteAiApp): AiWorkflowConfig {
  const config = app.workflowConfig ?? defaultWorkflowConfig(app);
  const hasAssetStep = config.steps.some((step) => step.kind === "asset_select");
  const hasFieldsStep = config.steps.some((step) => step.kind === "fields");
  const steps = [
    ...(hasAssetStep ? [] : defaultWorkflowConfig(app).steps.filter((step) => step.kind === "asset_select")),
    ...config.steps,
    ...(hasFieldsStep ? [] : [fieldsStepFromApp(app)])
  ];
  return { ...config, steps };
}

function providerFor(app: SiteAiApp): AiProviderConfig {
  return app.providerConfig ?? { mode: "platform_fallback", fallbackEnabled: true };
}

function assetStep(config: AiWorkflowConfig): AiWorkflowStep {
  return config.steps.find((step) => step.kind === "asset_select") ?? config.steps[0];
}

export function AiToolsEditor({ siteId, apps }: { siteId: string; apps: SiteAiApp[] }) {
  const router = useRouter();
  const [items, setItems] = useState(apps);
  const [message, setMessage] = useState("维护当前站点的启用状态、顾客单次扣费和 worker routeKey。");

  useEffect(() => {
    setItems(apps);
  }, [apps]);

  function update(id: string, field: "enabled" | "creditCost" | "routeKey", value: string | boolean) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "creditCost" ? Number(value) : value
            }
          : item
      )
    );
  }

  function updateWorkflow(id: string, updater: (config: AiWorkflowConfig, app: SiteAiApp) => AiWorkflowConfig) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, workflowConfig: updater(workflowFor(item), item) } : item)));
  }

  function updateProvider(id: string, updater: (config: AiProviderConfig) => AiProviderConfig) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, providerConfig: updater(providerFor(item)) } : item)));
  }

  async function save(app: SiteAiApp) {
    const response = await fetch(`/api/sites/${siteId}/ai/apps/${app.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: app.enabled,
        creditCost: app.creditCost,
        routeKey: app.routeKey,
        workflowConfig: workflowFor(app),
        providerConfig: providerFor(app)
      })
    });
    const result = (await response.json().catch(() => ({}))) as { siteAiApp?: SiteAiApp; error?: string };
    if (response.ok && result.siteAiApp) {
      setItems((current) => current.map((item) => (item.id === result.siteAiApp?.id ? result.siteAiApp : item)));
      setMessage(`${app.aiApp.name} 的本站配置已保存，前台生成页和任务创建会读取新值。`);
      router.refresh();
      return;
    }
    setMessage(result.error ?? `${app.aiApp.name} 保存失败。`);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#333]">本站 AI 工具维护</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#666]">{message}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-3 py-3 text-[12px] leading-5 text-[#667085] md:grid-cols-3">
        <p>
          <span className="font-semibold text-[var(--admin-text)]">工具名称/说明</span>
          <br />
          来自平台 AI 工具目录，这里只读。
        </p>
        <p>
          <span className="font-semibold text-[var(--admin-text)]">启用/扣费/路由</span>
          <br />
          保存到当前站点的 SiteAiApp 配置。
        </p>
        <p>
          <span className="font-semibold text-[var(--admin-text)]">运行时作用</span>
          <br />
          顾客提交任务时预留积分，并把 routeKey 发给 worker。
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="list min-w-[1080px]">
          <thead>
            <tr>
              <th className="bgtt aleft">平台工具（只读）</th>
              <th className="bgtt">前台开放</th>
              <th className="bgtt">顾客单次扣费</th>
              <th className="bgtt aleft">Worker routeKey</th>
              <th className="bgtt">保存本站配置</th>
            </tr>
          </thead>
          <tbody>
            {items.map((app) => (
              <tr key={app.id}>
                <td className="aleft">
                  <h3 className="font-semibold text-[#333]">{app.aiApp.name}</h3>
                  <p className="mt-1 max-w-xl text-[12px] leading-5 text-[#666]">{app.aiApp.description}</p>
                  <p className="mt-2 font-mono text-[11px] text-[#98a2b3]">slug: {app.aiApp.slug}</p>
                </td>
                <td>
                  <select
                    className="selectmini input100"
                    aria-label={`${app.aiApp.name} 是否开放给前台`}
                    onChange={(event) => update(app.id, "enabled", event.target.value === "true")}
                    value={String(app.enabled)}
                  >
                    <option value="true">启用</option>
                    <option value="false">停用</option>
                  </select>
                </td>
                <td>
                  <input
                    className="inputtext input100 text-center"
                    min={0}
                    onChange={(event) => update(app.id, "creditCost", event.target.value)}
                    title="顾客创建生成任务时预留/扣除的积分数量"
                    type="number"
                    value={app.creditCost}
                  />
                  <p className="mt-1 text-[11px] leading-4 text-[#98a2b3]">创建任务时预留/扣除的积分</p>
                </td>
                <td className="aleft">
                  <input
                    className="inputtext w-full font-mono"
                    onChange={(event) => update(app.id, "routeKey", event.target.value)}
                    title="写入生成任务 requestJson.worker，并随 worker payload 发送"
                    value={app.routeKey}
                  />
                  <p className="mt-1 text-[11px] leading-4 text-[#98a2b3]">写入任务 worker 字段，用来匹配后端执行流程</p>
                </td>
                <td>
                  <button className="input_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap" onClick={() => save(app)} type="button">
                    <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                    保存
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 grid gap-4">
        {items.map((app) => {
          const workflow = workflowFor(app);
          const provider = providerFor(app);
          const uploadStep = assetStep(workflow);
          const minAssets = uploadStep.assetRules?.min ?? 1;
          const maxAssets = uploadStep.assetRules?.max ?? 4;
          return (
            <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-4" key={`${app.id}-workflow`}>
              <div className="flex flex-col gap-2 border-b border-[var(--admin-border-soft)] pb-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[var(--admin-text)]">{app.aiApp.name} 生成流程</h3>
                  <p className="mt-1 text-[12px] leading-5 text-[#667085]">配置前台按步骤提交的内容。routeKey 仍作为底层执行入口，普通用户不会看到。</p>
                </div>
                <span className="rounded-[6px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-2.5 py-1 font-mono text-[11px] text-[#667085]">
                  workflow v{workflow.version || 1}
                </span>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <label className="grid gap-1 text-[12px] font-medium text-[#475467]">
                  前台流程名称
                  <input
                    className="inputtext"
                    onChange={(event) => updateWorkflow(app.id, (config) => ({ ...config, flowName: event.target.value }))}
                    value={workflow.flowName ?? app.aiApp.name}
                  />
                </label>
                <label className="grid gap-1 text-[12px] font-medium text-[#475467]">
                  提交按钮文案
                  <input
                    className="inputtext"
                    onChange={(event) => updateWorkflow(app.id, (config) => ({ ...config, submitLabel: event.target.value }))}
                    value={workflow.submitLabel ?? "Start generation"}
                  />
                </label>
                <label className="grid gap-1 text-[12px] font-medium text-[#475467] xl:col-span-2">
                  前台说明
                  <input
                    className="inputtext"
                    onChange={(event) => updateWorkflow(app.id, (config) => ({ ...config, description: event.target.value }))}
                    value={workflow.description ?? app.aiApp.description}
                  />
                </label>
                <div className="grid gap-3 rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] p-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-[12px] font-medium text-[#475467]">
                    最少上传图片
                    <input
                      className="inputtext"
                      min={0}
                      onChange={(event) => updateWorkflow(app.id, (config) => ({
                        ...config,
                        steps: config.steps.map((step) => step.kind === "asset_select" ? { ...step, assetRules: { ...(step.assetRules ?? {}), min: Number(event.target.value) } } : step)
                      }))}
                      type="number"
                      value={minAssets}
                    />
                  </label>
                  <label className="grid gap-1 text-[12px] font-medium text-[#475467]">
                    最多上传图片
                    <input
                      className="inputtext"
                      min={Math.max(1, minAssets)}
                      onChange={(event) => updateWorkflow(app.id, (config) => ({
                        ...config,
                        steps: config.steps.map((step) => step.kind === "asset_select" ? { ...step, assetRules: { ...(step.assetRules ?? {}), max: Number(event.target.value) } } : step)
                      }))}
                      type="number"
                      value={maxAssets}
                    />
                  </label>
                </div>
                <div className="grid gap-3 rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] p-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-[12px] font-medium text-[#475467]">
                    AI 通道策略
                    <select
                      className="selectmini"
                      onChange={(event) => updateProvider(app.id, (config) => ({ ...config, mode: event.target.value as AiProviderConfig["mode"] }))}
                      value={provider.mode}
                    >
                      {providerModes.map((mode) => (
                        <option key={mode.value} value={mode.value}>{mode.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[12px] font-medium text-[#475467]">
                    模型/通道标识
                    <input
                      className="inputtext"
                      onChange={(event) => updateProvider(app.id, (config) => ({ ...config, modelType: event.target.value }))}
                      placeholder="例如 gpt-image-2"
                      value={provider.modelType ?? ""}
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-[12px] font-medium text-[#475467]">
                  Material rules，每行一条，前台展示为素材要求
                  <textarea
                    className="inputtext min-h-[116px] resize-y leading-5"
                    onChange={(event) => updateWorkflow(app.id, (config) => ({ ...config, materialRules: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) }))}
                    value={(workflow.materialRules ?? []).join("\n")}
                  />
                </label>
                <label className="grid gap-1 text-[12px] font-medium text-[#475467]">
                  Prompt 模板，后端会按用户选择拼接并保存快照
                  <textarea
                    className="inputtext min-h-[116px] resize-y font-mono text-[12px] leading-5"
                    onChange={(event) => updateWorkflow(app.id, (config) => ({ ...config, promptTemplate: event.target.value }))}
                    value={workflow.promptTemplate ?? ""}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
