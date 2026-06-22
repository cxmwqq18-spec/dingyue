"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Plus, Star, Trash2 } from "lucide-react";
import { downloadCsv } from "@/components/admin/export-utils";
import { platformJsonHeaders } from "@/lib/client-csrf";
import type { SiteDomain } from "@/lib/types";

function describeDomainError(code?: string) {
  return {
    missing_domain: "请输入域名。",
    invalid_domain: "域名格式不正确。",
    site_domain_exists: "这个域名已经存在。",
    site_domain_not_found: "域名记录不存在。",
    site_requires_primary_domain: "站点至少需要保留一个主域名。",
    platform_login_required: "平台后台登录已失效，请重新登录。"
  }[code ?? ""] ?? code ?? "unknown error";
}

export function DomainPanel({ siteId, domains }: { siteId: string; domains: SiteDomain[] }) {
  const router = useRouter();
  const [items, setItems] = useState(domains);
  const [domain, setDomain] = useState("");
  const [newPrimary, setNewPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("域名与店铺绑定。主域名会影响前台站点入口和 host 路由。");

  useEffect(() => {
    setItems(domains);
  }, [domains]);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!domain.trim()) {
      setMessage("请输入域名。");
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/platform/sites/${siteId}/domains`, {
      method: "POST",
      headers: platformJsonHeaders(),
      body: JSON.stringify({ domain, isPrimary: newPrimary })
    });
    const result = (await response.json().catch(() => ({}))) as { domain?: SiteDomain; error?: string };
    setSaving(false);
    if (response.ok && result.domain) {
      setItems((current) => {
        const next = newPrimary
          ? current.map((item) => ({
              ...item,
              isPrimary: false
            }))
          : current;
        return [...next, result.domain as SiteDomain];
      });
      setDomain("");
      setNewPrimary(false);
      setMessage(`${result.domain.domain} 已加入待生效列表。`);
      router.refresh();
    } else {
      setMessage(`域名添加失败：${describeDomainError(result.error)}`);
    }
  }

  async function updateStatus(domainId: string, status: SiteDomain["status"]) {
    setSaving(true);
    const response = await fetch(`/api/platform/sites/${siteId}/domains/${domainId}`, {
      method: "PATCH",
      headers: platformJsonHeaders(),
      body: JSON.stringify({ status })
    });
    const result = (await response.json().catch(() => ({}))) as { domain?: SiteDomain; error?: string };
    setSaving(false);
    if (!response.ok || !result.domain) {
      setMessage(`域名状态更新失败：${describeDomainError(result.error)}`);
      return;
    }
    setItems((current) => current.map((item) => (item.id === domainId ? { ...item, status: result.domain?.status ?? item.status } : item)));
    setMessage(`${result.domain.domain} 状态已更新为 ${result.domain.status}。`);
    router.refresh();
  }

  async function makePrimary(domainId: string) {
    setSaving(true);
    const response = await fetch(`/api/platform/sites/${siteId}/domains/${domainId}`, {
      method: "PATCH",
      headers: platformJsonHeaders(),
      body: JSON.stringify({ isPrimary: true })
    });
    const result = (await response.json().catch(() => ({}))) as { domain?: SiteDomain; error?: string };
    setSaving(false);
    if (!response.ok || !result.domain) {
      setMessage(`主域名切换失败：${describeDomainError(result.error)}`);
      return;
    }
    setItems((current) =>
      current.map((item) => ({
        ...item,
        isPrimary: item.id === domainId,
        status: item.id === domainId ? "active" : item.status
      }))
    );
    setMessage(`${result.domain.domain} 已设为主域名。`);
    router.refresh();
  }

  async function removeDomain(domainId: string) {
    setSaving(true);
    const response = await fetch(`/api/platform/sites/${siteId}/domains/${domainId}`, {
      method: "DELETE",
      headers: platformJsonHeaders()
    });
    const result = (await response.json().catch(() => ({}))) as { deletedDomain?: SiteDomain; error?: string };
    setSaving(false);
    if (!response.ok || !result.deletedDomain) {
      setMessage(`删除域名失败：${describeDomainError(result.error)}`);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== domainId));
    setMessage(`${result.deletedDomain.domain} 已从平台域名列表移除。`);
    router.refresh();
  }

  function exportDomains() {
    downloadCsv(
      `${siteId}-platform-domains.csv`,
      items.map((item) => ({
        domainId: item.id,
        domain: item.domain,
        status: item.status,
        type: item.isPrimary ? "primary" : "alias"
      })),
      ["domainId", "domain", "status", "type"]
    );
    setMessage(`已导出 ${items.length} 条域名记录。`);
  }

  return (
    <div className="grid gap-3">
      <form className="search grid gap-2 border border-[#f1f1f1] bg-[#fafafa] px-3 py-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]" onSubmit={add}>
        <input
          className="inputtext min-w-0"
          onChange={(event) => setDomain(event.target.value)}
          placeholder="studio.example.com"
          value={domain}
        />
        <label className="inline-flex h-[32px] items-center gap-2 rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[12px] text-[#475467]">
          <input checked={newPrimary} onChange={(event) => setNewPrimary(event.target.checked)} type="checkbox" />
          设为主域名
        </label>
        <button className="admin_btn inline-flex h-[32px] items-center gap-1" onClick={exportDomains} type="button">
          <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
          导出域名
        </button>
        <button className="input_btn inline-flex h-[32px] items-center gap-1 disabled:cursor-not-allowed disabled:opacity-55" disabled={saving} type="submit">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          添加域名
        </button>
      </form>
      <div className="tixing">{message}</div>
      <div className="overflow-x-auto">
        <table className="list">
          <thead>
            <tr>
              <th className="bgtt">域名</th>
              <th className="bgtt" style={{ width: 110 }}>状态</th>
              <th className="bgtt" style={{ width: 90 }}>主域名</th>
              <th className="bgtt" style={{ width: 150 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="aleft">
                  <span className="block font-mono">{item.domain}</span>
                  <span className="font-mono text-[11px] text-[#999]">{item.id}</span>
                </td>
                <td>
                  <div className="flex flex-col items-center gap-2">
                    <span className={item.status === "active" ? "cgreen" : item.status === "failed" ? "cred" : "corg"}>{item.status}</span>
                    <select
                      className="selectmini min-w-[96px]"
                      disabled={saving}
                      onChange={(event) => updateStatus(item.id, event.target.value as SiteDomain["status"])}
                      value={item.status}
                    >
                      <option value="active">active</option>
                      <option value="pending">pending</option>
                      <option value="failed">failed</option>
                    </select>
                  </div>
                </td>
                <td>{item.isPrimary ? "是" : "否"}</td>
                <td>
                  <div className="flex flex-wrap justify-center gap-1">
                    {!item.isPrimary ? (
                      <button className="admin_btn inline-flex items-center gap-1" disabled={saving} onClick={() => makePrimary(item.id)} type="button">
                        <Star className="h-3.5 w-3.5" strokeWidth={1.8} />
                        设主域名
                      </button>
                    ) : (
                      <span className="tag_green">当前主域名</span>
                    )}
                    {items.length > 1 ? (
                      <button className="admin_del inline-flex items-center gap-1" disabled={saving} onClick={() => removeDomain(item.id)} type="button">
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        删除
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
