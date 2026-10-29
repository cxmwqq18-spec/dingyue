"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErpField, ErpFormGrid, ErpInput, ErpSection } from "@/components/admin/erp-primitives";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { AidreamcapesPartnerBadge } from "@/lib/types";

type BadgeRow = {
  key: string;
  label: string;
  href: string;
  imageUrl: string;
  imageHeight: number;
};

const MAX_BADGES = 12;

function toRows(badges: AidreamcapesPartnerBadge[]): BadgeRow[] {
  return badges.map((badge, index) => ({
    key: badge.key || `badge-${index + 1}`,
    label: badge.label,
    href: badge.href,
    imageUrl: badge.imageUrl,
    imageHeight: badge.imageHeight ?? 40
  }));
}

export function FriendLinksPageClient({
  initialBadges,
  liveHref,
  siteId
}: {
  initialBadges: AidreamcapesPartnerBadge[];
  liveHref: string;
  siteId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<BadgeRow[]>(() => toRows(initialBadges));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateRow(index: number, patch: Partial<BadgeRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function moveRow(index: number, delta: -1 | 1) {
    setRows((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { key: `badge-${current.length + 1}`, label: "", href: "", imageUrl: "", imageHeight: 40 }
    ]);
  }

  async function save() {
    for (const [index, row] of rows.entries()) {
      if (!row.label.trim()) {
        setMessage(`保存失败：第 ${index + 1} 个徽章缺少名称。`);
        return;
      }
      if (!/^(?:https:\/\/\S+|\/assets\/\S+)$/i.test(row.href.trim())) {
        setMessage(`保存失败：第 ${index + 1} 个徽章的跳转地址必须是 https:// 链接。`);
        return;
      }
      if (!/^(?:https:\/\/\S+|\/assets\/\S+)$/i.test(row.imageUrl.trim())) {
        setMessage(`保存失败：第 ${index + 1} 个徽章的图片地址必须是 https:// 链接或 /assets/ 站内路径。`);
        return;
      }
    }
    setSaving(true);
    const response = await fetch(`/api/sites/${siteId}/theme/footer-partner-badges`, {
      body: JSON.stringify({ badges: rows }),
      headers: siteAdminJsonHeaders(siteId),
      method: "PUT"
    });
    const result = (await response.json().catch(() => ({}))) as { badges?: AidreamcapesPartnerBadge[]; error?: string };
    setSaving(false);
    if (response.status === 409) {
      setMessage("保存被拦截：友链数据刚被其他编辑更新过，请刷新页面后重试。");
      return;
    }
    if (!response.ok || !result.badges) {
      setMessage(`保存失败：${result.error ?? "unknown error"}`);
      return;
    }
    setRows(toRows(result.badges));
    setMessage("友链徽章已保存并即时生效，前台下一次请求即为最新内容，无需发布或部署。");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <ErpSection
        action={
          <div className="flex items-center gap-2">
            <a className="admin_btn inline-flex h-[34px] items-center justify-center whitespace-nowrap px-3.5" href={liveHref} rel="noreferrer" target="_blank">
              预览前台
            </a>
            <button className="input_btn inline-flex h-[34px] items-center justify-center whitespace-nowrap px-3.5" disabled={saving} onClick={save} type="button">
              {saving ? "保存中…" : "保存并即时生效"}
            </button>
          </div>
        }
        description="徽章按下方顺序显示在前台页脚底部。点击徽章在新窗口打开对应网站；图片支持 https 外链或站内 /assets/ 路径。"
        eyebrow="friend links"
        title="友链徽章列表"
      >
        {message ? (
          <div className="tixing mb-3">{message}</div>
        ) : null}
        <div className="grid gap-3">
          {rows.map((row, index) => (
            <div
              className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-3"
              key={`${row.key}-${index}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[var(--admin-border-soft)] bg-[#f8fafc]">
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- badge artwork is an external hotlink or a site asset path
                    <img alt={row.label || "badge preview"} className="max-h-10 max-w-[88px] object-contain" height={40} loading="lazy" src={row.imageUrl} />
                  ) : (
                    <span className="text-[11px] text-[#98a2b3]">无预览</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <ErpFormGrid columns={2}>
                    <ErpField hint="显示在前台页脚底部的徽章图片地址。" label={`#${index + 1} 图片地址`}>
                      <ErpInput
                        onChange={(event) => updateRow(index, { imageUrl: event.target.value })}
                        placeholder="https://partner.example/assets/badge.png"
                        value={row.imageUrl}
                      />
                    </ErpField>
                    <ErpField hint="点击徽章跳转的网站，必须为 https:// 链接。" label="跳转链接">
                      <ErpInput
                        onChange={(event) => updateRow(index, { href: event.target.value })}
                        placeholder="https://partner.example"
                        value={row.href}
                      />
                    </ErpField>
                    <ErpField hint="用于无障碍描述与提示气泡。" label="名称（alt）">
                      <ErpInput
                        onChange={(event) => updateRow(index, { label: event.target.value })}
                        placeholder="Partner Name"
                        value={row.label}
                      />
                    </ErpField>
                    <ErpField hint="内部标识，保存后用于追踪，无需修改。" label="标识 key">
                      <ErpInput
                        onChange={(event) => updateRow(index, { key: event.target.value })}
                        value={row.key}
                      />
                    </ErpField>
                  </ErpFormGrid>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button className="admin_btn h-[30px] px-2.5" disabled={index === 0} onClick={() => moveRow(index, -1)} type="button">
                    上移
                  </button>
                  <button className="admin_btn h-[30px] px-2.5" disabled={index === rows.length - 1} onClick={() => moveRow(index, 1)} type="button">
                    下移
                  </button>
                  <button className="admin_del h-[30px] px-2.5" onClick={() => removeRow(index)} type="button">
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-[var(--admin-border-soft)] p-6 text-center text-[13px] text-[#8a94a6]">
              当前没有友链徽章，前台页脚不会显示该模块。点击下方按钮新增。
            </div>
          ) : null}
          <div>
            <button className="admin_btn h-[34px] px-3.5" disabled={rows.length >= MAX_BADGES || saving} onClick={addRow} type="button">
              + 新增徽章{rows.length >= MAX_BADGES ? "（已达上限 12 个）" : ""}
            </button>
          </div>
        </div>
      </ErpSection>
    </div>
  );
}
