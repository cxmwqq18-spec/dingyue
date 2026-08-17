"use client";

import { AlertTriangle, LogIn, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function SiteAdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [adminHref] = useState(() => {
    if (typeof window === "undefined") return "/";
    const match = window.location.pathname.match(/^\/site\/[^/]+\/admin/);
    return match?.[0] ?? "/";
  });
  const [loginHref] = useState(() => `${adminHref}/login`);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#eef1f5] px-5 py-10 text-[#101828]">
      <section className="w-full max-w-[560px] rounded-[16px] border border-[#d9dde4] bg-white p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.55)]" data-admin-error="true">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#fff4e6] text-[#b06d2c]">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b06d2c]">Store admin unavailable</p>
            <h1 className="mt-1 text-[20px] font-semibold">后台暂时没有载入完成</h1>
            <p className="mt-2 text-[13px] leading-6 text-[#667085]">
              可能是登录状态过期、数据库迁移未完成，或服务正在重启。你的草稿不会因为这次异常自动发布。
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[10px] border border-[#f2d3a4] bg-[#fff8ed] px-4 py-3 text-[12px] leading-5 text-[#8a5a1f]">
          请先点击“重试”。如果仍然失败，请检查 `CreativePack.galleryImageAlts` migration 是否已经执行，并确认当前账号仍有站点后台权限。
        </div>

        {error?.digest ? <p className="mt-3 font-mono text-[10px] text-[#98a2b3]">错误编号：{error.digest}</p> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#2f6fed] bg-[#2f6fed] px-4 text-sm font-medium text-white transition hover:bg-[#2457c5]"
            onClick={reset}
            type="button"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
            重试
          </button>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9dde4] bg-white px-4 text-sm font-medium text-[#344054] transition hover:bg-[#f7f8fb]"
            href={loginHref}
          >
            <LogIn className="h-4 w-4" strokeWidth={1.8} />
            重新登录
          </Link>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9dde4] bg-white px-4 text-sm font-medium text-[#344054] transition hover:bg-[#f7f8fb]"
            href={adminHref}
          >
            <LogIn className="h-4 w-4" strokeWidth={1.8} />
            返回后台
          </Link>
        </div>
      </section>
    </main>
  );
}
