"use client";

import type { Dispatch, SetStateAction } from "react";

export const adminPageSizeOptions = [10, 20, 50] as const;

export function pageItems<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(page, 1), pageCount(total, pageSize));
}

export function AdminPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: Dispatch<SetStateAction<number>> | ((page: number) => void);
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pages = pageCount(total, pageSize);
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-3 py-2 text-[12px] text-[#667085] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap">
          显示 {start}-{end} / 共 {total} 条
        </span>
        <label className="inline-flex items-center gap-1 whitespace-nowrap">
          每页
          <select
            className="h-[30px] rounded-[6px] border border-[var(--admin-border-soft)] bg-white px-2 text-[12px] text-[var(--admin-text)]"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {adminPageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          条
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="admin_btn inline-flex h-[30px] shrink-0 items-center justify-center whitespace-nowrap px-3 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          type="button"
        >
          上一页
        </button>
        <span className="whitespace-nowrap font-mono text-[var(--admin-text)]">
          {page} / {pages}
        </span>
        <button
          className="admin_btn inline-flex h-[30px] shrink-0 items-center justify-center whitespace-nowrap px-3 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page >= pages}
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          type="button"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
