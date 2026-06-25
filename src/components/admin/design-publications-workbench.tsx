"use client";

import { useMemo, useState } from "react";
import { Clock3, Download, History, RefreshCcw, Send } from "lucide-react";
import {
  DesignWorkbenchLayout,
  PublicationConfidence,
  WorkbenchMetricStrip,
  WorkbenchSearchInput,
  WorkbenchSearchRow,
  WorkbenchSelect,
  WorkbenchSidebarCard,
  WorkbenchTableHeader,
  WorkbenchTableRow,
  WorkbenchTableShell
} from "@/components/admin/design-workbench";
import { PublicationActions, RestorePublicationButton } from "@/components/admin/design-actions";
import { downloadCsv } from "@/components/admin/export-utils";
import { StatusPill } from "@/components/ui";

type PublicationItem = {
  id: string;
  version: number;
  isActive: boolean;
  pageCount: number;
  sectionCount: number;
  publishedAt: string;
  publishedBy: string;
};

export function DesignPublicationsWorkbench({
  publications,
  latestVersion,
  latestPublishedAt,
  latestPageCount,
  latestSectionCount,
  hasDirtyDraft,
  dirtyPages,
  settingsDirty,
  canPublish,
  preflightScore,
  preflightStale = false,
  firstPageId,
  siteId
}: {
  publications: PublicationItem[];
  latestVersion?: number;
  latestPublishedAt?: string;
  latestPageCount: number;
  latestSectionCount: number;
  hasDirtyDraft: boolean;
  dirtyPages: number;
  settingsDirty: boolean;
  canPublish: boolean;
  preflightScore: number;
  preflightStale?: boolean;
  firstPageId?: string;
  siteId: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [publisherFilter, setPublisherFilter] = useState("all");
  const [preflight, setPreflight] = useState({
    canPublish,
    score: preflightScore,
    stale: preflightStale,
    loading: false,
    message: preflightStale ? "发布检查将在点击时执行，避免切换页面时等待完整校验。" : "发布检查已就绪。"
  });

  const publisherOptions = useMemo(
    () => ["all", ...Array.from(new Set(publications.map((publication) => publication.publishedBy)))],
    [publications]
  );

  const filteredPublications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return publications.filter((publication) => {
      if (statusFilter === "active" && !publication.isActive) return false;
      if (statusFilter === "archived" && publication.isActive) return false;
      if (publisherFilter !== "all" && publication.publishedBy !== publisherFilter) return false;
      if (!normalizedQuery) return true;
      return [
        `v${publication.version}_发布快照`,
        publication.publishedBy,
        publication.publishedAt,
        `${publication.pageCount} pages`,
        `${publication.sectionCount} sections`
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [publications, publisherFilter, query, statusFilter]);

  function exportPublications() {
    downloadCsv(
      `${siteId}-theme-publications.csv`,
      filteredPublications.map((publication) => ({
        publicationId: publication.id,
        version: publication.version,
        isActive: publication.isActive,
        pageCount: publication.pageCount,
        sectionCount: publication.sectionCount,
        publishedAt: publication.publishedAt,
        publishedBy: publication.publishedBy
      })),
      ["publicationId", "version", "isActive", "pageCount", "sectionCount", "publishedAt", "publishedBy"]
    );
  }

  async function refreshPreflight() {
    setPreflight((current) => ({ ...current, loading: true, message: "正在执行发布检查..." }));
    const response = await fetch(`/api/sites/${siteId}/admin/publish-preflight`);
    const json = (await response.json().catch(() => ({}))) as {
      canPublish?: boolean;
      score?: number;
      blockerCount?: number;
      warningCount?: number;
      error?: string;
    };
    if (!response.ok) {
      setPreflight((current) => ({
        ...current,
        loading: false,
        stale: true,
        message: `发布检查失败：${json.error ?? "unknown error"}`
      }));
      return;
    }
    setPreflight({
      canPublish: Boolean(json.canPublish),
      score: Number(json.score ?? 0),
      stale: false,
      loading: false,
      message: `检查完成：${json.blockerCount ?? 0} 个阻断项，${json.warningCount ?? 0} 个提醒。`
    });
  }

  return (
    <div className="grid gap-5">
      <WorkbenchMetricStrip
        items={[
          { label: "Current release", value: latestVersion ? `v${latestVersion}` : "-" },
          { label: "Snapshot count", value: publications.length },
          { label: "Latest pages", value: latestPageCount },
          { label: "Confidence", value: preflight.stale ? "待检查" : `${preflight.score}%` }
        ]}
      />

      <DesignWorkbenchLayout
        aside={
          <div className="grid gap-4">
            <WorkbenchSidebarCard eyebrow="release metadata" title="Release metadata">
              <dl className="grid gap-3 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Current version</dt>
                  <dd className="text-[#18212f]">{latestVersion ? `v${latestVersion}` : "-"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Published at</dt>
                  <dd className="text-right text-[#18212f]">{latestPublishedAt ?? "未发布"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Snapshot scope</dt>
                  <dd className="text-right text-[#18212f]">{latestPageCount} pages / {latestSectionCount} sections</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Draft status</dt>
                  <dd>
                    <StatusPill label={hasDirtyDraft ? "Needs publish" : "Aligned"} tone={hasDirtyDraft ? "warn" : "good"} />
                  </dd>
                </div>
              </dl>
            </WorkbenchSidebarCard>

            <WorkbenchSidebarCard eyebrow="confidence" title="Release confidence">
              <PublicationConfidence label="发布置信度" value={preflight.stale ? 0 : preflight.score} />
              <div className="mt-4 space-y-2 text-[12px] text-[#667085]">
                <div className="flex items-center justify-between gap-3">
                  <span>草稿页面</span>
                  <span>{dirtyPages}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>设置差异</span>
                  <span>{settingsDirty ? "有" : "无"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>自动化检查</span>
                  <span>{preflight.stale ? "待检查" : preflight.canPublish ? "通过" : "待处理"}</span>
                </div>
              </div>
              <button
                className="admin_btn mt-4 inline-flex h-[32px] items-center gap-1"
                disabled={preflight.loading}
                onClick={refreshPreflight}
                type="button"
              >
                <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                {preflight.loading ? "检查中" : "刷新发布检查"}
              </button>
              <p className="mt-2 text-[12px] leading-5 text-[#98a2b3]">{preflight.message}</p>
            </WorkbenchSidebarCard>
          </div>
        }
        sidebar={
          <WorkbenchSidebarCard eyebrow="timeline" title="Version timeline">
            <div className="grid gap-4">
              {publications.slice(0, 8).map((publication, index) => (
                <div className="relative pl-6" key={publication.id}>
                  {index < publications.slice(0, 8).length - 1 ? (
                    <span className="absolute left-[10px] top-4 bottom-[-20px] w-px bg-[#d8e0ea]" />
                  ) : null}
                  <span className="absolute left-1 top-1 h-4 w-4 rounded-full border-2 border-[#2f6fed] bg-white" />
                  <div className="text-[18px] font-semibold text-[#2f6fed]">{`v${publication.version}`}</div>
                  <div className="mt-1 text-[12px] text-[#667085]">{publication.publishedAt}</div>
                  <div className="text-[12px] text-[#98a2b3]">{publication.publishedBy}</div>
                </div>
              ))}
            </div>
          </WorkbenchSidebarCard>
        }
      >
        <WorkbenchTableShell>
          <div className="border-b border-[#edf2f7] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#98a2b3]">publication history</div>
                <h3 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#18212f]">Release registry</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#667085]">
                  查看所有发布快照、版本记录和恢复入口。发布是整站级 snapshot，不是单页保存。
                </p>
              </div>
              <div className="shrink-0">
                <PublicationActions
                  canPublish={Boolean(firstPageId) && preflight.canPublish && !preflight.stale}
                  onBeforePublish={refreshPreflight}
                  pageId={firstPageId}
                  siteId={siteId}
                />
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="rounded-[18px] border border-[#edf2f7] bg-[#fbfcfe] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] text-[#667085]">Current draft</div>
                  <div className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[#18212f]">
                    {hasDirtyDraft ? "Needs publish" : "Aligned"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill label={latestVersion ? "Released" : "No release"} tone={latestVersion ? "good" : "warn"} />
                  <span className="rounded-full bg-white px-3 py-1 text-[12px] text-[#667085]">
                    {dirtyPages} dirty pages
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-4">
            <WorkbenchSearchRow
              actions={
                <div className="flex items-center gap-2">
                  <WorkbenchSelect
                    onChange={setStatusFilter}
                    options={[
                      { value: "all", label: "全部状态" },
                      { value: "active", label: "当前线上" },
                      { value: "archived", label: "历史版本" }
                    ]}
                    value={statusFilter}
                  />
                  <WorkbenchSelect
                    onChange={setPublisherFilter}
                    options={publisherOptions.map((value) => ({
                      value,
                      label: value === "all" ? "全部发布人" : value
                    }))}
                    value={publisherFilter}
                  />
                  <button className="admin_btn inline-flex h-[34px] items-center gap-1" onClick={exportPublications} type="button">
                    <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                    导出 CSV
                  </button>
                </div>
              }
              controls={<WorkbenchSearchInput onChange={setQuery} placeholder="搜索快照名称、版本、发布人..." value={query} />}
            />
            <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[#667085]">
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">{filteredPublications.length} visible snapshots</span>
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">{filteredPublications.filter((publication) => publication.isActive).length} current</span>
            </div>
          </div>

          <WorkbenchTableHeader
            className="grid-cols-[120px_minmax(0,1.5fr)_170px_150px_150px]"
            columns={["Version", "Snapshot", "Scope", "Published at", "Actions"]}
          />

          <div className="grid">
            {filteredPublications.map((publication) => (
              <WorkbenchTableRow
                className="grid-cols-[120px_minmax(0,1.5fr)_170px_150px_150px] items-center"
                key={publication.id}
              >
                <div>
                  <div className="flex items-center gap-2 text-[13px] font-medium text-[#12b76a]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#12b76a]" />
                    已发布
                  </div>
                  <div className="mt-3 inline-flex h-[30px] items-center rounded-[10px] bg-[#f5f8ff] px-3 text-[13px] font-medium text-[#2f6fed]">
                    {`v${publication.version}`}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[18px] font-semibold tracking-[-0.03em] text-[#18212f]">
                      {`v${publication.version}_发布快照`}
                    </div>
                    {publication.isActive ? <StatusPill label="当前" tone="good" /> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] text-[#667085]">
                    <span className="inline-flex items-center gap-1">
                      <History className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {publication.publishedBy}
                    </span>
                    <span>Production</span>
                  </div>
                </div>

                <div className="text-[13px] text-[#18212f]">
                  {publication.pageCount} pages / {publication.sectionCount} sections
                </div>

                <div className="text-[13px] text-[#667085]">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {publication.publishedAt}
                  </span>
                </div>

                <div className="flex items-center justify-end">
                  <RestorePublicationButton
                    isActive={publication.isActive}
                    publicationId={publication.id}
                    siteId={siteId}
                    version={publication.version}
                  />
                </div>
              </WorkbenchTableRow>
            ))}
          </div>

          {!filteredPublications.length ? (
            <div className="grid min-h-[220px] place-items-center text-center">
              <div>
                <Send className="mx-auto h-8 w-8 text-[#98a2b3]" strokeWidth={1.8} />
                <div className="mt-4 text-[15px] font-semibold text-[#18212f]">
                  {publications.length ? "当前筛选下没有发布记录" : "还没有发布记录"}
                </div>
                <div className="mt-2 max-w-[420px] text-[13px] leading-6 text-[#667085]">
                  {publications.length
                    ? "调整搜索条件或切换筛选查看历史版本。"
                    : "先在装修器或导航页保存草稿，再发布整站快照。发布后前台才读取最新版本。"}
                </div>
              </div>
            </div>
          ) : null}
        </WorkbenchTableShell>
      </DesignWorkbenchLayout>
    </div>
  );
}
