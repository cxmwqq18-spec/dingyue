"use client";

import { DesignerStatePill } from "@/components/designer/designer-sidebar-primitives";
import type { ThemePage, ThemePageJson } from "@/lib/types";

type PageDraftMap = Record<string, ThemePageJson>;
type PagePublishedMap = Record<string, ThemePageJson>;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type PageTreeMode = "switcher" | "tree" | "full" | "directory";

type PageDirectoryGroup = {
  key: string;
  label: string;
  description: string;
  match: (page: ThemePage) => boolean;
};

const PAGE_DIRECTORY_GROUPS: PageDirectoryGroup[] = [
  {
    key: "storefront",
    label: "门店首页",
    description: "首页与品牌首屏",
    match: (page) => page.pageType === "home" || page.slug === "/"
  },
  {
    key: "commerce",
    label: "商品/套餐",
    description: "订阅、套餐、购物链路",
    match: (page) => ["pricing", "collection", "package_detail", "cart"].includes(page.pageType)
  },
  {
    key: "ai-workflow",
    label: "AI 工作流",
    description: "工具、生成、进度、相册",
    match: (page) => ["ai_tool", "workspace", "job_progress", "job_detail", "album"].includes(page.pageType)
  },
  {
    key: "customer",
    label: "客户中心",
    description: "登录、账户、订阅",
    match: (page) => ["login", "account"].includes(page.pageType)
  },
  {
    key: "content",
    label: "内容/政策",
    description: "帮助、博客、协议",
    match: (page) => ["policy", "privacy", "refunds", "content", "help", "blog", "article"].includes(page.pageType)
  },
  {
    key: "system",
    label: "系统页面",
    description: "搜索、异常页",
    match: (page) => ["search", "404"].includes(page.pageType)
  }
];

function pageDraftFor(page: ThemePage, drafts: PageDraftMap) {
  return drafts[page.id] ?? page.draftJson;
}

function pagePublishedFor(page: ThemePage, publishedPages: PagePublishedMap) {
  return publishedPages[page.id] ?? page.publishedJson;
}

function pageSectionCount(page: ThemePage, drafts: PageDraftMap) {
  return pageDraftFor(page, drafts).sectionsOrder.length;
}

function pageIsDirty(page: ThemePage, drafts: PageDraftMap, publishedPages: PagePublishedMap) {
  return JSON.stringify(pageDraftFor(page, drafts)) !== JSON.stringify(pagePublishedFor(page, publishedPages));
}

function pageTypeDisplayLabel(page: ThemePage) {
  const labels: Record<string, string> = {
    home: "首页",
    pricing: "定价",
    collection: "套餐列表",
    package_detail: "套餐详情",
    cart: "购物车",
    ai_tool: "AI 工具",
    workspace: "工作台",
    job_progress: "任务进度",
    job_detail: "任务详情",
    album: "相册",
    login: "登录",
    account: "账户订阅",
    policy: "政策",
    privacy: "隐私",
    refunds: "退款",
    content: "内容协议",
    help: "帮助",
    blog: "博客列表",
    article: "文章详情",
    search: "搜索",
    "404": "404"
  };
  return labels[page.pageType] ?? page.pageType;
}

function directoryGroupsFor(pages: ThemePage[]) {
  const grouped = PAGE_DIRECTORY_GROUPS.map((group) => ({
    ...group,
    pages: pages.filter((page) => group.match(page))
  })).filter((group) => group.pages.length > 0);

  const matchedIds = new Set(grouped.flatMap((group) => group.pages.map((page) => page.id)));
  const otherPages = pages.filter((page) => !matchedIds.has(page.id));
  return otherPages.length
    ? [
        ...grouped,
        {
          key: "other",
          label: "其他页面",
          description: "未归类模板",
          match: () => false,
          pages: otherPages
        }
      ]
    : grouped;
}

export function PageTree({
  mode = "full",
  density = "default",
  surface = "card",
  showHeader = true,
  pages,
  drafts,
  publishedPages,
  activePage,
  selectedPageId,
  currentPageDirty,
  onSelectPage,
  pageOptionLabel
}: {
  mode?: PageTreeMode;
  density?: "default" | "compact";
  surface?: "card" | "plain";
  showHeader?: boolean;
  pages: ThemePage[];
  drafts: PageDraftMap;
  publishedPages: PagePublishedMap;
  activePage: ThemePage;
  selectedPageId: string;
  currentPageDirty: boolean;
  onSelectPage: (pageId: string) => void;
  pageOptionLabel: (page: ThemePage) => string;
}) {
  const compact = density === "compact";
  const groups = directoryGroupsFor(pages);
  const switcher = (
    <div className={cx("border-b border-[#cfd4dc] bg-white", compact ? "px-2 py-2" : "mt-3 px-3 py-3")} data-designer-layout="saas-visible-page-switcher">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cx("truncate font-medium text-[#383838]", compact ? "text-[13px]" : "text-sm")}>{activePage.title}</p>
        </div>
        <DesignerStatePill label={currentPageDirty ? "草稿" : "线上"} tone={currentPageDirty ? "draft" : "live"} />
      </div>
      <div className={cx("grid grid-cols-[minmax(0,1fr)_auto] gap-2", compact ? "mt-2" : "mt-3")}>
        <select
          className={cx("w-full rounded-[4px] border border-[#c4c7cc] bg-white px-2.5 py-2 text-[#383838] outline-none transition focus:border-[#f4a719]", compact ? "text-xs" : "text-sm")}
          onChange={(event) => onSelectPage(event.target.value)}
          value={selectedPageId}
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {pageOptionLabel(page)}
            </option>
          ))}
        </select>
          <span className="inline-flex items-center rounded-[4px] border border-[#d9dde4] bg-[#f7f8fb] px-2 text-[10px] font-mono uppercase tracking-[0.08em] text-[#7c8087]">
            {pages.length} 页
          </span>
      </div>
      <p className="mt-2 truncate text-[10px] leading-4 text-[#909294]">{activePage.slug}</p>
    </div>
  );

  const treeBody = (
    <>
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8a94a6]">全站页面装修目录</p>
          <DesignerStatePill label={`${pages.length} 页`} />
        </div>
      ) : null}
      <div
        className={cx("grid gap-1.5", showHeader ? (compact ? "mt-2" : "mt-3") : undefined)}
        data-designer-layout="saas-full-site-page-directory"
      >
        {groups.map((group) => {
          const groupDirtyCount = group.pages.filter((page) => pageIsDirty(page, drafts, publishedPages)).length;
          return (
            <section className="page_directory__group_8b29" key={group.key}>
              <div className="flex items-center justify-between gap-1 px-2 py-1">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-[#6b7282]">{group.label}</p>
                  <p className="truncate text-[9px] leading-3 text-[#909294]">{group.description}</p>
                </div>
                <span className="shrink-0 rounded-[3px] border border-[#d9dde4] bg-[#f7f8fb] px-1.5 py-0.5 font-mono text-[9px] text-[#909294]">
                  {groupDirtyCount ? `${groupDirtyCount} 草稿` : `${group.pages.length} 页`}
                </span>
              </div>
              <div className="grid gap-0">
                {group.pages.map((page) => {
                  const selected = page.id === selectedPageId;
                  const dirty = pageIsDirty(page, drafts, publishedPages);
                  const sectionCount = pageSectionCount(page, drafts);
                  return (
                    <button
                      className={cx(
                        "page_directory__row_51dd group grid min-h-[34px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-[4px] border border-transparent px-2 py-1.5 text-left transition",
                        selected ? "bg-white text-[#383838] shadow-[8px_0_0_0_#fff]" : "text-[#6b7282] hover:bg-[#f7f8fb] hover:text-[#383838]"
                      )}
	                      data-designer-page-dirty={dirty ? "true" : "false"}
	                      data-designer-page-id={page.id}
	                      data-designer-page-selected={selected ? "true" : "false"}
                      key={page.id}
                      onClick={() => onSelectPage(page.id)}
                      title={`${page.title} · ${page.slug} · ${page.templateKey ?? page.pageType}`}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className={cx("block truncate text-[11px] leading-4", selected ? "font-medium text-[#262b35]" : "font-normal")}>
                          {pageTypeDisplayLabel(page)}
                        </span>
                        <span className={cx("block truncate font-mono text-[9px] leading-3", selected ? "text-[#7c8087]" : "text-[#909294]")}>
                          {page.slug}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className={cx("font-mono text-[9px] leading-3", selected ? "text-[#7c8087]" : "text-[#909294]")}>{sectionCount} 模块</span>
                        <DesignerStatePill
                          className={cx("scale-[0.82] origin-right", selected && "border-[#d8dbe1]")}
                          label={dirty ? "草稿" : "线上"}
                          tone={dirty ? "draft" : selected ? "selected" : "live"}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );

  const tree = surface === "plain" ? (
    <div
      className={cx("min-h-0", mode === "directory" ? "h-full overflow-hidden" : "p-0")}
      data-designer-layout="saas-page-card-tree"
    >
      {treeBody}
    </div>
  ) : (
    <div
      className={cx(
        "min-h-0 rounded-[8px] border border-[#d9dde4] bg-[#f3f5f7]",
        mode === "directory" ? "h-full overflow-hidden" : undefined,
        compact ? "p-2.5" : "p-3"
      )}
      data-designer-layout="saas-page-card-tree"
    >
      {treeBody}
    </div>
  );

  if (mode === "switcher") return switcher;
  if (mode === "tree") return tree;
  if (mode === "directory") return tree;
  return (
    <>
      {switcher}
      {tree}
    </>
  );
}
