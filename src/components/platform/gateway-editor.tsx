"use client";

import { useEffect, useState } from "react";
import { platformJsonHeaders } from "@/lib/client-csrf";
import type { AiGatewayGroup, PlatformAiProvider } from "@/lib/types";

const fallbackModelOptions = ["gpt-image-2", "gpt-4.1-mini", "claude-3-7-sonnet"];

function statusLabel(status: AiGatewayGroup["status"]) {
  return {
    active: "启用",
    paused: "暂停"
  }[status] ?? status;
}

function accountPoolLabel(mode: AiGatewayGroup["accountPoolMode"]) {
  return {
    shared: "共享账号池",
    dedicated: "独立账号池"
  }[mode] ?? mode;
}

export function GatewayEditor({
  siteId,
  group,
  providers = []
}: {
  siteId: string;
  group: AiGatewayGroup;
  providers?: Array<Pick<PlatformAiProvider, "id" | "label" | "aiUrl" | "modelType" | "preferred">>;
}) {
  const [item, setItem] = useState(group);
  const [message, setMessage] = useState("平台 AI 中转默认对所有站点域名开放；这里仅保留兜底策略参数，不再作为域名访问开关。");

  useEffect(() => {
    setItem(group);
  }, [group]);

  function update<K extends keyof AiGatewayGroup>(key: K, value: AiGatewayGroup[K]) {
    setItem((current) => ({ ...current, [key]: value }));
  }

  const modelOptions = Array.from(new Set([
    ...providers.map((provider) => provider.modelType).filter(Boolean),
    ...item.modelAllowlist,
    ...fallbackModelOptions
  ])).filter(Boolean);

  function toggleModel(model: string, checked: boolean) {
    update(
      "modelAllowlist",
      checked
        ? Array.from(new Set([...item.modelAllowlist, model]))
        : item.modelAllowlist.filter((value) => value !== model)
    );
  }

  async function save() {
    const response = await fetch(`/api/platform/sites/${siteId}/gateway-groups/${group.id}`, {
      method: "PUT",
      headers: platformJsonHeaders(),
      body: JSON.stringify(item)
    });
    const result = (await response.json().catch(() => ({}))) as { gatewayGroup?: AiGatewayGroup; error?: string };
    if (response.ok && result.gatewayGroup) {
      setItem(result.gatewayGroup);
      setMessage(`${result.gatewayGroup.name} 已保存。`);
    } else {
      setMessage(result.error ?? "网关策略保存失败。");
    }
  }

  return (
    <div className="grid gap-3">
      <div className="tixing">{item.name}: {message}</div>
      {providers.length ? (
        <div className="rounded-[10px] border border-[#e7edf3] bg-[#f8fafd] px-4 py-3">
          <div className="text-[12px] font-semibold text-[#667085]">平台 AI URL</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {providers.map((provider) => (
              <div className="min-w-0 rounded-[8px] border border-[#e7edf3] bg-white px-3 py-2" key={provider.id}>
                <div className="flex items-center gap-2 text-[12px] font-semibold text-[#18212f]">
                  {provider.label}
                  {provider.preferred ? <span className="tag_green">优先</span> : null}
                </div>
                <div className="mt-1 truncate font-mono text-[11px] text-[#667085]">{provider.aiUrl}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="list">
          <tbody>
            <tr>
              <th className="bgtt aright" style={{ width: 120 }}>策略状态</th>
              <td className="aleft">
                <select className="selectmini input150" onChange={(event) => update("status", event.target.value as AiGatewayGroup["status"])} value={item.status}>
                  <option value="active">{statusLabel("active")}</option>
                  <option value="paused">{statusLabel("paused")}</option>
                </select>
              </td>
              <th className="bgtt aright" style={{ width: 120 }}>账号池模式</th>
              <td className="aleft">
                <select className="selectmini input150" onChange={(event) => update("accountPoolMode", event.target.value as AiGatewayGroup["accountPoolMode"])} value={item.accountPoolMode}>
                  <option value="shared">{accountPoolLabel("shared")}</option>
                  <option value="dedicated">{accountPoolLabel("dedicated")}</option>
                </select>
              </td>
            </tr>
            <tr>
              <th className="bgtt aright">月额度</th>
              <td className="aleft">
                <input className="inputall input150" onChange={(event) => update("monthlyQuota", Number(event.target.value))} type="number" value={item.monthlyQuota} />
              </td>
              <th className="bgtt aright">每分钟限制</th>
              <td className="aleft">
                <input className="inputall input150" onChange={(event) => update("rateLimitPerMinute", Number(event.target.value))} type="number" value={item.rateLimitPerMinute} />
              </td>
            </tr>
            <tr>
              <th className="bgtt aright">模型白名单</th>
              <td className="aleft" colSpan={3}>
                <details className="relative max-w-[640px]">
                  <summary className="inputall flex min-h-[42px] cursor-pointer list-none items-center justify-between gap-3 whitespace-nowrap">
                    <span className="min-w-0 truncate">
                      {item.modelAllowlist.length ? item.modelAllowlist.join(", ") : "请选择可用模型"}
                    </span>
                    <span className="shrink-0 text-[11px] text-[#98a2b3]">多选</span>
                  </summary>
                  <div className="absolute z-20 mt-2 grid max-h-[240px] w-full gap-1 overflow-auto rounded-[8px] border border-[#dbe3ef] bg-white p-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.36)]">
                    {modelOptions.map((model) => (
                      <label className="flex items-center gap-2 rounded-[6px] px-2 py-2 text-[12px] text-[#475467] hover:bg-[#f8fafd]" key={model}>
                        <input checked={item.modelAllowlist.includes(model)} onChange={(event) => toggleModel(model, event.target.checked)} type="checkbox" />
                        <span className="font-mono">{model}</span>
                      </label>
                    ))}
                  </div>
                </details>
              </td>
            </tr>
            <tr>
              <th className="bgtt aright">重试状态码</th>
              <td className="aleft" colSpan={3}>
                <input
                  className="inputall w-full max-w-[560px]"
                  onChange={(event) => update("retryStatusCodes", event.target.value.split(",").map((code) => Number(code.trim())).filter((code) => Number.isInteger(code)))}
                  value={item.retryStatusCodes.join(", ")}
                />
              </td>
            </tr>
            <tr>
              <th className="bgtt" />
              <td className="aleft" colSpan={3}>
                <button className="input_btn" onClick={save} type="button">保存策略</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
