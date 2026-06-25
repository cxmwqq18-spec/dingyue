"use client";

import dynamic from "next/dynamic";
import type { ContentDraftEditorProps } from "@/components/admin/content-draft-editor";

const ContentDraftEditorDynamic = dynamic(
  () => import("@/components/admin/content-draft-editor").then((mod) => mod.ContentDraftEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-4 py-6 text-[13px] text-[#667085]">
        内容草稿编辑器加载中...
      </div>
    )
  }
);

export function ContentDraftEditorLazy(props: ContentDraftEditorProps) {
  return <ContentDraftEditorDynamic {...props} />;
}
