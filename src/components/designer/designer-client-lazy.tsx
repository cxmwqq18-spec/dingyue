"use client";

import dynamic from "next/dynamic";
import type { DesignerClientProps } from "@/components/designer/designer-client";

const DesignerClientDynamic = dynamic(
  () => import("@/components/designer/designer-client").then((mod) => mod.DesignerClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[100dvh] items-center justify-center bg-[#252b37] text-white/74">
        <div className="rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] shadow-2xl">
          店铺装修器加载中...
        </div>
      </div>
    )
  }
);

export function DesignerClientLazy(props: DesignerClientProps) {
  return <DesignerClientDynamic {...props} />;
}
