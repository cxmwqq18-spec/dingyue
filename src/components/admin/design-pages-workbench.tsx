"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Download,
  FileText,
  Folder,
  Layers3,
  SearchCode
} from "lucide-react";
import {
  DesignWorkbenchLayout,
  WorkbenchActionButton,
  WorkbenchMetricStrip,
  WorkbenchRowLink,
  WorkbenchSearchInput,
  WorkbenchSearchRow,
  WorkbenchSectionTabs,
  WorkbenchSelect,
  WorkbenchSidebarCard,
  WorkbenchTableHeader,
  WorkbenchTableRow,
  WorkbenchTableShell
} from "@/components/admin/design-workbench";
import { downloadCsv } from "@/components/admin/export-utils";
import { StatusPill } from "@/components/ui";

type PageItem = {
  id: string;
  title: string;
  slug: string;
  pageType: string;
  templateKey?: string;
  dirty: boolean;
  sectionDelta: number;
  blockDelta: number;
  draftVersion: number;
  publishedVersion: number;
  sectionCount: number;
  blockCount: number;
  designerHref: string;
  previewHref: string;
  liveHref: string;
};

function routeGroup(page: PageItem) {
  if (page.slug === "/" || page.pageType === "home") return "core";
  if (
    page.pageType === "pricing" ||
    page.pageType === "ai_tool" ||
    page.pageType === "collection" ||
    page.pageType === "cart" ||
    page.pageType === "search"
  ) {
    return "commerce";
  }
  if (
    page.pageType === "policy" ||
    page.pageType === "help" ||
    page.pageType === "blog" ||
    page.pageType === "content"
  ) {
    return "content";
  }
  return "system";
}

function routeGroupLabel(group: string) {
  if (group === "core") return "Core";
  if (group === "commerce") return "Commerce";
  if (group === "content") return "Content";
  return "System";
}

function pageTone(page: PageItem) {
  return page.dirty ? "warn" : "good";
}

function pageStatusLabel(page: PageItem) {
  return page.dirty ? "Draft" : "Published";
}

function sectionDeltaLabel(page: PageItem) {
  if (page.sectionDelta === 0) return `${page.sectionCount}`;
  return `${page.sectionCount} (${page.sectionDelta > 0 ? "+" : ""}${page.sectionDelta})`;
}

function blockDeltaLabel(page: PageItem) {
  if (page.blockDelta === 0) return `${page.blockCount}`;
  return `${page.blockCount} (${page.blockDelta > 0 ? "+" : ""}${page.blockDelta})`;
}

export function DesignPagesWorkbench({
  pages,
  publishBlockers
}: {
  pages: PageItem[];
  publishBlockers: number;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id ?? "");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return pages.filter((page) => {
      if (group !== "all" && routeGroup(page) !== group) return false;
      if (statusFilter === "draft" && !page.dirty) return false;
      if (statusFilter === "published" && page.dirty) return false;
      if (!normalized) return true;
      return [page.title, page.slug, page.pageType, page.templateKey ?? ""].some((item) =>
        item.toLowerCase().includes(normalized)
      );
    });
  }, [group, pages, query, statusFilter]);

  const selected =
    filtered.find((page) => page.id === selectedPageId) ??
    pages.find((page) => page.id === selectedPageId) ??
    filtered[0] ??
    pages[0];

  const dirtyCount = pages.filter((page) => page.dirty).length;
  const publishedCount = pages.length - dirtyCount;
  const hiddenCount = pages.filter((page) => routeGroup(page) === "system").length;
  const tabs = [
    { key: "all", label: "All pages" },
    { key: "core", label: "Core" },
    { key: "commerce", label: "Commerce" },
    { key: "content", label: "Content" },
    { key: "system", label: "System" }
  ];

  function exportPages() {
    downloadCsv(
      "site-pages.csv",
      filtered.map((page) => ({
        pageId: page.id,
        title: page.title,
        slug: page.slug,
        pageType: page.pageType,
        templateKey: page.templateKey ?? "",
        routeGroup: routeGroup(page),
        draftStatus: page.dirty ? "draft" : "published",
        sectionCount: page.sectionCount,
        blockCount: page.blockCount,
        draftVersion: page.draftVersion,
        publishedVersion: page.publishedVersion
      })),
      ["pageId", "title", "slug", "pageType", "templateKey", "routeGroup", "draftStatus", "sectionCount", "blockCount", "draftVersion", "publishedVersion"]
    );
  }

  return (
    <div className="grid gap-5">
      <WorkbenchMetricStrip
        items={[
          { label: "Total pages", value: pages.length },
          { label: "Published", value: publishedCount },
          { label: "Drafts", value: dirtyCount },
          { label: "Publish blockers", value: publishBlockers }
        ]}
      />

      <DesignWorkbenchLayout
        aside={
          selected ? (
            <div className="grid gap-4">
              <WorkbenchSidebarCard eyebrow="selected page" title={selected.title}>
                <div className="flex items-center gap-2">
                  <StatusPill label={pageStatusLabel(selected)} tone={pageTone(selected)} />
                  <span className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-[11px] text-[#667085]">
                    {routeGroupLabel(routeGroup(selected))}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 text-[13px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#667085]">Route</dt>
                    <dd className="font-mono text-[#18212f]">{selected.slug}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#667085]">Template</dt>
                    <dd className="font-mono text-[#18212f]">{selected.templateKey ?? "theme-page"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#667085]">Sections</dt>
                    <dd className="text-[#18212f]">{selected.sectionCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#667085]">Blocks</dt>
                    <dd className="text-[#18212f]">{selected.blockCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#667085]">Draft version</dt>
                    <dd className="text-[#18212f]">v{selected.draftVersion}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#667085]">Live version</dt>
                    <dd className="text-[#18212f]">v{selected.publishedVersion}</dd>
                  </div>
                </dl>
                <div className="mt-5 grid gap-2">
                  <WorkbenchActionButton href={selected.designerHref} label="Edit in Designer" primary />
                  <WorkbenchActionButton href={selected.previewHref} label="Preview route" />
                  <WorkbenchActionButton href={selected.liveHref} label="Open live page" />
                </div>
              </WorkbenchSidebarCard>

              <WorkbenchSidebarCard eyebrow="route map" title="Route groups">
                <div className="grid gap-2">
                  {[
                    { label: "Core pages", value: pages.filter((page) => routeGroup(page) === "core").length, icon: Folder },
                    { label: "Commerce routes", value: pages.filter((page) => routeGroup(page) === "commerce").length, icon: Layers3 },
                    { label: "Content routes", value: pages.filter((page) => routeGroup(page) === "content").length, icon: SearchCode },
                    { label: "System routes", value: hiddenCount, icon: FileText }
                  ].map((item) => (
                    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#edf2f7] bg-[#fbfcfe] px-3 py-3" key={item.label}>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#e4e7ec] bg-white text-[#667085]">
                          <item.icon className="h-4 w-4" strokeWidth={1.8} />
                        </span>
                        <span className="text-[13px] text-[#18212f]">{item.label}</span>
                      </div>
                      <span className="font-mono text-[12px] text-[#667085]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </WorkbenchSidebarCard>
            </div>
          ) : null
        }
      >
        <div className="grid gap-4">
          <WorkbenchTableShell>
            <div className="border-b border-[#edf2f7] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#98a2b3]">page tree</div>
                  <h3 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#18212f]">Page registry</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#667085]">
                    管理站点页面、路由和模板。每个页面都走草稿、发布和回滚，不只是首页。
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {selected ? <WorkbenchActionButton href={selected.designerHref} label="Edit selected" /> : null}
                  {selected ? <WorkbenchActionButton href={selected.designerHref} label="Open Designer" primary /> : null}
                </div>
              </div>
            </div>

            <div className="px-5 pt-4">
              <WorkbenchSectionTabs active={group} items={tabs} onChange={setGroup} />
              <WorkbenchSearchRow
                actions={
                  <div className="flex items-center gap-2">
                    <WorkbenchSelect
                      onChange={setGroup}
                      options={tabs.map((item) => ({ value: item.key, label: item.label }))}
                      value={group}
                    />
                    <WorkbenchSelect
                      onChange={(value) => setStatusFilter(value as "all" | "draft" | "published")}
                      options={[
                        { value: "all", label: "All status" },
                        { value: "draft", label: "Draft" },
                        { value: "published", label: "Published" }
                      ]}
                      value={statusFilter}
                    />
                    <button className="admin_btn inline-flex h-[34px] items-center gap-1" onClick={exportPages} type="button">
                      <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                      导出页面
                    </button>
                  </div>
                }
                controls={<WorkbenchSearchInput onChange={setQuery} placeholder="Search pages, routes, template keys..." value={query} />}
              />
              <div className="mb-4 flex flex-wrap gap-2 text-[12px] text-[#667085]">
                <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">{filtered.length} visible pages</span>
                <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">{filtered.filter((page) => page.dirty).length} draft</span>
              </div>
            </div>

            <WorkbenchTableHeader
              className="grid-cols-[minmax(0,1.65fr)_180px_110px_110px_120px_170px_150px]"
              columns={["Page / Route", "Template", "Sections", "Blocks", "Status", "Preview", "Editor"]}
            />

            <div className="grid">
              {filtered.map((page) => (
                <button
                  className="appearance-none text-left"
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                  type="button"
                >
                  <WorkbenchTableRow
                    active={selected?.id === page.id}
                    className="grid-cols-[minmax(0,1.65fr)_180px_110px_110px_120px_170px_150px] items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] text-[#667085]">
                          <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold text-[#18212f]">{page.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#98a2b3]">
                            <span className="font-mono">{page.slug}</span>
                            <span>·</span>
                            <span>{routeGroupLabel(routeGroup(page))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-[12px] text-[#667085]">{page.templateKey ?? "theme-page"}</div>
                    <div className="text-[13px] text-[#18212f]">{sectionDeltaLabel(page)}</div>
                    <div className="text-[13px] text-[#18212f]">{blockDeltaLabel(page)}</div>
                    <div>
                      <StatusPill label={pageStatusLabel(page)} tone={pageTone(page)} />
                    </div>
                    <div className="min-w-0">
                      <WorkbenchRowLink href={page.previewHref} label="Preview route" />
                    </div>
                    <div className="min-w-0">
                      <WorkbenchRowLink href={page.designerHref} label="Edit in Designer" />
                    </div>
                  </WorkbenchTableRow>
                </button>
              ))}
            </div>

            {!filtered.length ? (
              <div className="px-6 py-12 text-center text-[13px] text-[#98a2b3]">当前筛选下没有页面。</div>
            ) : null}
          </WorkbenchTableShell>
        </div>
      </DesignWorkbenchLayout>
    </div>
  );
}
