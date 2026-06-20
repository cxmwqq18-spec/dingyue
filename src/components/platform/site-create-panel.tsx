"use client";

import { useState } from "react";
import { CopyPlus } from "lucide-react";
import type { Site } from "@/lib/types";

export function SiteCreatePanel({ sites }: { sites: Site[] }) {
  const [name, setName] = useState("Nova Image Studio");
  const [slug, setSlug] = useState("nova");
  const [ownerEmail, setOwnerEmail] = useState("owner@nova.localhost");
  const [ownerPassword, setOwnerPassword] = useState("nova123");
  const [sourceSiteId, setSourceSiteId] = useState(sites[0]?.id ?? "");
  const [message, setMessage] = useState("创建一个新的独立店铺，自动复制主题、套餐、AI 工具和网关策略，并生成独立后台账号。");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/platform/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, ownerEmail, ownerPassword, sourceSiteId })
    });
    const result = (await response.json().catch(() => ({}))) as { site?: Site; error?: string };
    if (response.ok && result.site) {
      setMessage(`${result.site.name} 已创建，正在进入站点后台。`);
      const bridge = await fetch(`/api/platform/sites/${result.site.id}/admin-bridge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/admin" })
      });
      const bridgeResult = (await bridge.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
      if (bridge.ok && bridgeResult.redirectTo) {
        window.location.href = bridgeResult.redirectTo;
        return;
      }
      setMessage(`${result.site.name} 已创建，但平台桥接失败：${bridgeResult.error ?? "site_admin_bridge_failed"}`);
      window.location.href = `/site/${result.site.slug}/admin/login`;
    } else {
      setMessage(result.error ?? "店铺创建失败。");
    }
  }

  return (
    <form className="admin-form-table" onSubmit={create}>
      <div className="tixing">
        {message}
      </div>
      <table className="list">
        <tbody>
          <tr>
            <th className="bgtt aright" style={{ width: 120 }}>店铺名称</th>
            <td className="aleft"><input className="inputall input200" onChange={(event) => setName(event.target.value)} value={name} /></td>
            <th className="bgtt aright" style={{ width: 120 }}>店铺标识</th>
            <td className="aleft"><input className="inputall input150" onChange={(event) => setSlug(event.target.value)} value={slug} /></td>
          </tr>
          <tr>
            <th className="bgtt aright">登录邮箱</th>
            <td className="aleft"><input className="inputall input200" onChange={(event) => setOwnerEmail(event.target.value)} type="email" value={ownerEmail} /></td>
            <th className="bgtt aright">登录密码</th>
            <td className="aleft">
              <input
                autoComplete="new-password"
                className="inputall input150"
                onChange={(event) => setOwnerPassword(event.target.value)}
                type="password"
                value={ownerPassword}
              />
            </td>
          </tr>
          <tr>
            <th className="bgtt aright">复制来源</th>
            <td className="aleft" colSpan={3}>
              <select className="selectmini input200" onChange={(event) => setSourceSiteId(event.target.value)} value={sourceSiteId}>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
              <span className="ml-2 text-[12px] text-[#999]">复制主题、商品、AI 工具和 gateway 策略，不复制客户数据。</span>
            </td>
          </tr>
          <tr>
            <th className="bgtt" />
            <td className="aleft" colSpan={3}>
              <button className="input_btn" type="submit">
                <CopyPlus className="mr-2 inline h-3.5 w-3.5" strokeWidth={1.8} />
                创建并进入后台
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </form>
  );
}
