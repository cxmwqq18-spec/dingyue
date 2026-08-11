"use client";

import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function DesignerWorkbenchError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [loginHref] = useState(() => {
    if (typeof window === "undefined") return "/";
    const match = window.location.pathname.match(/^\/site\/[^/]+\/admin/);
    return `${match?.[0] ?? ""}/login`;
  });

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#eef1f5] px-5 py-10 text-[#101828]">
      <section className="w-full max-w-[620px] rounded-[16px] border border-[#d9dde4] bg-white p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.55)]" data-designer-error="true">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#fff4e6] text-[#b06d2c]">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b06d2c]">Designer workbench unavailable</p>
            <h1 className="mt-1 text-[20px] font-semibold">店铺装修器没有载入完成</h1>
            <p className="mt-2 text-[13px] leading-6 text-[#667085]">
              页面草稿仍保存在后台。可以重试当前工作台，或者先重新登录再进入装修器。
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 text-[12px] leading-5 text-[#667085]">
          <div className="rounded-[10px] border border-[#d9dde4] bg-[#f7f8fb] px-4 py-3">1. 重试当前工作台。</div>
          <div className="rounded-[10px] border border-[#d9dde4] bg-[#f7f8fb] px-4 py-3">2. 确认站点后台登录没有过期。</div>
          <div className="rounded-[10px] border border-[#d9dde4] bg-[#f7f8fb] px-4 py-3">3. 如果持续失败，检查 Prisma migration 和服务日志。</div>
        </div>

        {error?.digest ? <p className="mt-3 font-mono text-[10px] text-[#98a2b3]">错误编号：{error.digest}</p> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#2f6fed] bg-[#2f6fed] px-4 text-sm font-medium text-white transition hover:bg-[#2457c5]"
            onClick={reset}
            type="button"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
            重试装修器
          </button>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9dde4] bg-white px-4 text-sm font-medium text-[#344054] transition hover:bg-[#f7f8fb]"
            href={loginHref}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            重新登录
          </Link>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9dde4] bg-white px-4 text-sm font-medium text-[#344054] transition hover:bg-[#f7f8fb]"
            href="../.."
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            返回后台
          </Link>
        </div>
      </section>
    </main>
  );
}
