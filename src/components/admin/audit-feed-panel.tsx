"use client";

import { useState } from "react";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";
import { formatAuditDateTime, labelAuditEvent, labelAuditObject, normalizeAuditKey } from "@/lib/audit-labels";

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
          <span>操作事件</span>
          <span>影响对象</span>
          <span>发生时间</span>
        </div>
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[0.7fr_1fr_0.5fr]" key={item.id}>
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">{labelAuditEvent(item.label)}</span>
                <span className="mt-1 block truncate font-mono text-xs text-slate-400">{normalizeAuditKey(item.label)}</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-slate-600">{labelAuditObject(item.detail)}</span>
                <span className="mt-1 block truncate font-mono text-xs text-slate-400">{item.detail}</span>
              </span>
              <span className="font-mono text-xs text-slate-400">{formatAuditDateTime(item.at)}</span>
            </div>
          ))
        ) : (
          <div className="px-4 py-8 text-center">
            <div className="text-sm font-medium text-slate-700">暂无敏感操作记录</div>
            <p className="mt-2 text-xs leading-5 text-slate-400">发布装修、调整积分、维护管理员或修改站点设置后，这里会保留本站操作痕迹。</p>
          </div>
        )}
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
