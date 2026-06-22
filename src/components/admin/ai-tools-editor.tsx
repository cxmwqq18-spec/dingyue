"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { SiteAiApp } from "@/lib/types";

export function AiToolsEditor({ siteId, apps }: { siteId: string; apps: SiteAiApp[] }) {
  const router = useRouter();
  const [items, setItems] = useState(apps);
  const [message, setMessage] = useState("工具启用状态、扣费点数和 worker 路由会保存到本站配置。");

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

  async function save(app: SiteAiApp) {
    const response = await fetch(`/api/sites/${siteId}/ai/apps/${app.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: app.enabled,
        creditCost: app.creditCost,
        routeKey: app.routeKey
      })
    });
    const result = (await response.json().catch(() => ({}))) as { siteAiApp?: SiteAiApp; error?: string };
    if (response.ok && result.siteAiApp) {
      setItems((current) => current.map((item) => (item.id === result.siteAiApp?.id ? result.siteAiApp : item)));
      setMessage(`${app.aiApp.name} 已保存。`);
      router.refresh();
      return;
    }
    setMessage(result.error ?? `${app.aiApp.name} 保存失败。`);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#333]">AI 工具配置</h2>
          <p className="mt-1 text-[12px] text-[#666]">{message}</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="list min-w-[940px]">
          <thead>
            <tr>
              <th className="bgtt aleft">工具</th>
              <th className="bgtt">启用</th>
              <th className="bgtt">单次扣费</th>
              <th className="bgtt aleft">Worker 路由</th>
              <th className="bgtt">保存</th>
            </tr>
          </thead>
          <tbody>
            {items.map((app) => (
              <tr key={app.id}>
                <td className="aleft">
                  <h3 className="font-semibold text-[#333]">{app.aiApp.name}</h3>
                  <p className="mt-1 max-w-xl text-[12px] leading-5 text-[#666]">{app.aiApp.description}</p>
                </td>
                <td>
                  <select
                    className="selectmini input100"
                    onChange={(event) => update(app.id, "enabled", event.target.value === "true")}
                    value={String(app.enabled)}
                  >
                    <option value="true">启用</option>
                    <option value="false">停用</option>
                  </select>
                </td>
                <td>
                  <input className="inputtext input100 text-center" min={0} onChange={(event) => update(app.id, "creditCost", event.target.value)} type="number" value={app.creditCost} />
                </td>
                <td className="aleft">
                  <input className="inputtext w-full font-mono" onChange={(event) => update(app.id, "routeKey", event.target.value)} value={app.routeKey} />
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
    </div>
  );
}
