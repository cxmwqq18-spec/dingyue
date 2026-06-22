"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { platformJsonHeaders } from "@/lib/client-csrf";
import type { AiGatewayGroup } from "@/lib/types";

export function GatewayEditor({ siteId, group }: { siteId: string; group: AiGatewayGroup }) {
  const router = useRouter();
  const [item, setItem] = useState(group);
  const [message, setMessage] = useState("网关策略用于控制模型白名单、额度、重试状态码和账号池模式。");

  useEffect(() => {
    setItem(group);
  }, [group]);

  function update<K extends keyof AiGatewayGroup>(key: K, value: AiGatewayGroup[K]) {
    setItem((current) => ({ ...current, [key]: value }));
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
      router.refresh();
    } else {
      setMessage(result.error ?? "网关策略保存失败。");
    }
  }

  return (
    <div>
      <div className="tixing">{item.name}: {message}</div>
      <div className="overflow-x-auto">
        <table className="list">
          <tbody>
            <tr>
              <th className="bgtt aright" style={{ width: 120 }}>状态</th>
              <td className="aleft">
                <select className="selectmini input150" onChange={(event) => update("status", event.target.value as AiGatewayGroup["status"])} value={item.status}>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                </select>
              </td>
              <th className="bgtt aright" style={{ width: 120 }}>账号池</th>
              <td className="aleft">
                <select className="selectmini input150" onChange={(event) => update("accountPoolMode", event.target.value as AiGatewayGroup["accountPoolMode"])} value={item.accountPoolMode}>
                  <option value="shared">shared</option>
                  <option value="dedicated">dedicated</option>
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
                <input
                  className="inputall w-full max-w-[560px]"
                  onChange={(event) => update("modelAllowlist", event.target.value.split(",").map((model) => model.trim()).filter(Boolean))}
                  value={item.modelAllowlist.join(", ")}
                />
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
