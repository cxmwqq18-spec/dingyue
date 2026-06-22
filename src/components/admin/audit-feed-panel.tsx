"use client";

import { useState } from "react";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";

type AuditFeedItem = {
  id: string;
  label: string;
  detail: string;
  at: string;
};

export function AuditFeedPanel({ items }: { items: AuditFeedItem[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const safePage = clampPage(page, items.length, pageSize);
  const visibleItems = pageItems(items, safePage, pageSize);

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[0.7fr_1fr_0.5fr]">
          <span>动作</span>
          <span>详情</span>
          <span>时间</span>
        </div>
        {visibleItems.map((item) => (
          <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[0.7fr_1fr_0.5fr]" key={item.id}>
            <span className="font-medium text-slate-900">{item.label}</span>
            <span className="truncate font-mono text-xs text-slate-500">{item.detail}</span>
            <span className="font-mono text-xs text-slate-400">{new Date(item.at).toLocaleDateString("zh-CN")}</span>
          </div>
        ))}
      </div>
      <AdminPagination
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
        page={safePage}
        pageSize={pageSize}
        total={items.length}
      />
    </div>
  );
}
