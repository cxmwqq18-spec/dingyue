"use client";

import { useState } from "react";
import { CopyPlus } from "lucide-react";
import type { Site } from "@/lib/types";
import { platformJsonHeaders } from "@/lib/client-csrf";

function siteCreateErrorLabel(code?: string) {
  return {
    missing_site_name_or_owner_email: "请填写店铺名称和管理员邮箱。",
    invalid_site_slug: "店铺标识格式无效，请检查后重试。",
    invalid_owner_email: "请输入有效的管理员邮箱。",
    site_slug_exists: "这个店铺标识已被使用，请更换一个。",
    site_domain_exists: "这个域名已被其他店铺使用，请更换域名。",
    source_site_not_found: "复制来源已不存在，请刷新后重新选择。"
  }[code ?? ""] ?? "店铺创建失败，请检查输入后重试。";
}

export function SiteCreatePanel({ sites }: { sites: Site[] }) {
  const [name, setName] = useState("Nova Image Studio");
  const [slug, setSlug] = useState("nova");
  const [ownerEmail, setOwnerEmail] = useState("owner@nova.localhost");
  const [ownerPassword, setOwnerPassword] = useState("nova123");
  const [sourceSiteId, setSourceSiteId] = useState(sites[0]?.id ?? "");
  const [message, setMessage] = useState("创建一个新的独立店铺，自动复制主题、套餐、AI 工具和网关策略，并生成独立后台账号。");
  const [creating, setCreating] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setMessage("正在创建店铺…");
    try {
      const response = await fetch("/api/platform/sites", {
        method: "POST",
        headers: platformJsonHeaders(),
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), ownerEmail: ownerEmail.trim(), ownerPassword, sourceSiteId })
      });
      const result = (await response.json().catch(() => ({}))) as { site?: Site; error?: string };
      if (response.ok && result.site) {
        setMessage(`${result.site.name} 已创建，正在进入站点后台。`);
        const fallbackPath = `/site/${result.site.slug}/admin/login`;
        try {
          const bridge = await fetch(`/api/platform/sites/${result.site.id}/admin-bridge`, {
            method: "POST",
            headers: platformJsonHeaders(),
            body: JSON.stringify({ path: "/admin" })
          });
          const bridgeResult = (await bridge.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
          if (bridge.ok && bridgeResult.redirectTo) {
            window.location.href = bridgeResult.redirectTo;
            return;
          }
          setMessage(`${result.site.name} 已创建，但平台桥接失败：${bridgeResult.error ?? "site_admin_bridge_failed"}`);
        } catch {
          setMessage(`${result.site.name} 已创建，但平台桥接请求失败，正在进入站点后台。`);
        }
        window.location.href = fallbackPath;
        return;
      } else {
        setMessage(siteCreateErrorLabel(result.error));
      }
    } catch {
      setMessage("店铺创建请求失败，请检查网络后重试。");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form className="admin-form-table" onSubmit={create}>
      <div aria-live="polite" className="tixing">
        {message}
      </div>
      <table className="list">
        <tbody>
          <tr>
            <th className="bgtt aright" style={{ width: 120 }}>店铺名称</th>
            <td className="aleft"><input className="inputall input200" disabled={creating} onChange={(event) => setName(event.target.value)} required value={name} /></td>
            <th className="bgtt aright" style={{ width: 120 }}>店铺标识</th>
            <td className="aleft"><input className="inputall input150" disabled={creating} onChange={(event) => setSlug(event.target.value)} required value={slug} /></td>
          </tr>
          <tr>
            <th className="bgtt aright">登录邮箱</th>
            <td className="aleft"><input className="inputall input200" disabled={creating} onChange={(event) => setOwnerEmail(event.target.value)} required type="email" value={ownerEmail} /></td>
            <th className="bgtt aright">登录密码</th>
            <td className="aleft">
              <input
                autoComplete="new-password"
                className="inputall input150"
                disabled={creating}
                onChange={(event) => setOwnerPassword(event.target.value)}
                required
                type="password"
                value={ownerPassword}
              />
            </td>
          </tr>
          <tr>
            <th className="bgtt aright">复制来源</th>
            <td className="aleft" colSpan={3}>
              <select className="selectmini input200" disabled={creating || sites.length === 0} onChange={(event) => setSourceSiteId(event.target.value)} required value={sourceSiteId}>
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
              <button className="input_btn" disabled={creating || sites.length === 0} type="submit">
                <CopyPlus className="mr-2 inline h-3.5 w-3.5" strokeWidth={1.8} />
                {creating ? "创建中…" : "创建并进入后台"}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </form>
  );
}
