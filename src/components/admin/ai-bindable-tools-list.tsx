"use client";

import { useState } from "react";
import type { SiteAiApp } from "@/lib/types";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";
import { StatusPill } from "@/components/ui";

export function AiBindableToolsList({ apps }: { apps: SiteAiApp[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const safePage = clampPage(page, apps.length, pageSize);
  const visibleApps = pageItems(apps, safePage, pageSize);

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleApps.map((app) => (
          <div className="rounded-[14px] border border-zinc-200 bg-white p-4" key={app.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-900">{app.aiApp.name}</p>
              <StatusPill label={app.enabled ? "已启用" : "已停用"} tone={app.enabled ? "good" : "warn"} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{app.aiApp.description}</p>
            <div className="mt-4 grid gap-2 text-xs text-slate-500">
              <div className="flex items-center justify-between gap-3 rounded-[8px] bg-slate-50 px-3 py-2">
                <span>顾客扣费</span>
                <span className="font-mono text-slate-800">{app.creditCost} 点/次</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[8px] bg-slate-50 px-3 py-2">
                <span>worker routeKey</span>
                <span className="truncate font-mono text-slate-800">{app.routeKey}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[8px] bg-slate-50 px-3 py-2">
                <span>前台绑定值</span>
                <span className="truncate font-mono text-slate-800">{app.aiApp.slug}</span>
              </div>
            </div>
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
        total={apps.length}
      />
    </div>
  );
}
