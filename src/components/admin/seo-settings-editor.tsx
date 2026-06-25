"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
} from "lucide-react";
import {
  DesignWorkbenchLayout,
  WorkbenchActionButton,
  WorkbenchMetricStrip,
  WorkbenchSidebarCard,
  WorkbenchTableShell
} from "@/components/admin/design-workbench";
import { downloadCsv } from "@/components/admin/export-utils";
import { StatusPill } from "@/components/ui";
import type { Site, ThemeSettings } from "@/lib/types";
import { normalizeThemeSeo } from "@/lib/theme/seo";

type PageSummary = {
  id: string;
  title: string;
  slug: string;
  pageType: string;
};

type SeoSettings = NonNullable<ThemeSettings["seo"]>;
type PageSeo = SeoSettings["pages"][string];

function cleanPath(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback || "/";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return `/${trimmed}`;
}

function pageScore(page: PageSeo) {
  let score = 0;
  if (page.title.trim().length >= 12 && page.title.trim().length <= 68) score += 30;
  if (page.description.trim().length >= 70 && page.description.trim().length <= 170) score += 30;
  if (page.keywords?.trim()) score += 8;
  if (page.canonicalPath?.trim()) score += 18;
  if (page.ogImage?.trim()) score += 14;
  return score;
}

function seoDiffers(left: ThemeSettings["seo"], right: ThemeSettings["seo"]) {
  return JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);
}

export function SeoSettingsEditor({
  site,
  pages,
  initialSettings,
  publishedSettings
}: {
  site: Pick<Site, "id" | "name" | "slug" | "branding" | "primaryDomain" | "pages" | "themeSettings">;
  pages: PageSummary[];
  initialSettings: ThemeSettings;
  publishedSettings: ThemeSettings;
}) {
  const router = useRouter();
  const normalizedInitial = useMemo(
    () => normalizeThemeSeo(site as Site, initialSettings),
    [initialSettings, site]
  );
  const normalizedPublished = useMemo(
    () => normalizeThemeSeo(site as Site, publishedSettings),
    [publishedSettings, site]
  );
  const [seo, setSeo] = useState<SeoSettings>(normalizedInitial);
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id ?? "");
  const [searchEngine, setSearchEngine] = useState<"google" | "bing">("google");
  const [message, setMessage] = useState(
    "SEO 草稿已载入。保存后仍需发布整站快照，线上页面 metadata 才会更新。"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSeo(normalizedInitial);
  }, [normalizedInitial]);

  useEffect(() => {
    if (!pages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(pages[0]?.id ?? "");
    }
  }, [pages, selectedPageId]);

  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  const selectedSeo = selectedPage ? seo.pages[selectedPage.id] : undefined;
  const dirty = seoDiffers(seo, normalizedPublished);
  const missingTitleCount = pages.filter((page) => !seo.pages[page.id]?.title.trim()).length;
  const missingDescriptionCount = pages.filter((page) => !seo.pages[page.id]?.description.trim()).length;
  const missingKeywordCount = pages.filter((page) => !seo.pages[page.id]?.keywords?.trim() && !seo.siteKeywords?.trim()).length;
  const noIndexCount = pages.filter((page) => seo.pages[page.id]?.index === false).length;
  const averageScore = pages.length
    ? Math.round(
        pages.reduce((sum, page) => sum + pageScore(seo.pages[page.id]), 0) / pages.length
      )
    : 0;
  const warningsCount =
    missingTitleCount +
    missingDescriptionCount +
    missingKeywordCount +
    (seo.defaultOgImage ? 0 : 1) +
    noIndexCount;
  const draftSettings = useMemo<ThemeSettings>(() => ({ ...initialSettings, seo }), [initialSettings, seo]);

  function resetToPublished() {
    setSeo(normalizedPublished);
    setMessage("SEO 草稿已恢复到线上发布版本。");
  }

  function exportSeo() {
    downloadCsv(
      `${site.slug}-seo-pages.csv`,
      pages.map((page) => {
        const pageSeo = seo.pages[page.id];
        return {
          pageId: page.id,
          title: page.title,
          slug: page.slug,
          pageType: page.pageType,
          seoTitle: pageSeo.title,
          seoDescription: pageSeo.description,
          seoKeywords: pageSeo.keywords ?? seo.siteKeywords ?? "",
          canonicalPath: pageSeo.canonicalPath ?? "",
          index: pageSeo.index,
          ogImage: pageSeo.ogImage ?? ""
        };
      }),
      ["pageId", "title", "slug", "pageType", "seoTitle", "seoDescription", "seoKeywords", "canonicalPath", "index", "ogImage"]
    );
  }

  function updateGlobal(patch: Partial<SeoSettings>) {
    setSeo((current) => ({ ...current, ...patch }));
  }

  function updateRobots(key: "index" | "follow", value: boolean) {
    setSeo((current) => ({ ...current, robots: { ...current.robots, [key]: value } }));
  }

  function updatePage(pageId: string, patch: Partial<PageSeo>) {
    setSeo((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [pageId]: {
          ...current.pages[pageId],
          ...patch
        }
      }
    }));
  }

  async function save() {
    setSaving(true);
    const response = await fetch(`/api/sites/${site.id}/theme/settings/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftJson: draftSettings })
    });
    const json = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(`保存失败：${json.error ?? "unknown error"}`);
      return;
    }
    setMessage("SEO 草稿已保存。进入发布历史发布整站快照后，前台 metadata 才会更新。");
    router.refresh();
  }

  const previewTitle = selectedSeo?.title || seo.siteTitle || site.name;
  const previewUrl = `https://${site.primaryDomain}${selectedPage?.slug === "/" ? "" : selectedPage?.slug ?? ""}`;
  const previewDescription = selectedSeo?.description || seo.siteDescription || "站点默认描述将在这里显示。";

  return (
    <div className="grid gap-5">
      <WorkbenchMetricStrip
        items={[
          { label: "Page count", value: pages.length },
          { label: "SEO score", value: `${averageScore}%` },
          { label: "Indexed", value: pages.length - noIndexCount },
          { label: "Warnings", value: warningsCount }
        ]}
      />

      <DesignWorkbenchLayout
        aside={
          <div className="grid gap-4">
            <WorkbenchSidebarCard eyebrow="publish readiness" title="Publish readiness">
              <div className="space-y-3 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#667085]">页面标题 (Title)</span>
                  <span className="text-[#18212f]">
                    {missingTitleCount === 0 ? "全部已设置" : `${missingTitleCount} 待补`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#667085]">描述 (Meta Description)</span>
                  <span className="text-[#18212f]">
                    {missingDescriptionCount === 0 ? "全部已设置" : `${missingDescriptionCount} 待补`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#667085]">关键词 (Keywords)</span>
                  <span className="text-[#18212f]">
                    {missingKeywordCount === 0 ? "全部已覆盖" : `${missingKeywordCount} 待补`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#667085]">索引控制 (Robots)</span>
                  <span className="text-[#18212f]">{noIndexCount ? `${noIndexCount} 个 noindex` : "已配置"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#667085]">开放图谱 (Open Graph)</span>
                  <span className="text-[#18212f]">{seo.defaultOgImage ? "已配置" : "缺失"}</span>
                </div>
              </div>
              <div className="mt-4 rounded-[16px] border border-[#d6f5df] bg-[#f0fdf4] px-4 py-4">
                <div className="text-[15px] font-semibold text-[#16a34a]">SEO 基础设置完整</div>
                <div className="mt-1 text-[12px] leading-5 text-[#15803d]">
                  当前配置有助于搜索引擎抓取与展示。
                </div>
              </div>
            </WorkbenchSidebarCard>

            <WorkbenchSidebarCard eyebrow="search preview" title="SERP preview">
              <div className="flex items-center gap-2">
                <button
                  className={`inline-flex h-[36px] items-center rounded-[10px] border px-3 text-[13px] ${
                    searchEngine === "google"
                      ? "border-[#d8e0ea] bg-white font-medium text-[#18212f]"
                      : "border-[#edf2f7] bg-white text-[#667085]"
                  }`}
                  onClick={() => setSearchEngine("google")}
                  type="button"
                >
                  Google
                </button>
                <button
                  className={`inline-flex h-[36px] items-center rounded-[10px] border px-3 text-[13px] ${
                    searchEngine === "bing"
                      ? "border-[#d8e0ea] bg-white font-medium text-[#18212f]"
                      : "border-[#edf2f7] bg-white text-[#667085]"
                  }`}
                  onClick={() => setSearchEngine("bing")}
                  type="button"
                >
                  Bing
                </button>
              </div>
              <div className="mt-4 rounded-[16px] border border-[#edf2f7] bg-white px-4 py-4">
                <div className={`text-[28px] leading-8 ${searchEngine === "google" ? "text-[#1a0dab]" : "text-[#2563eb]"}`}>{previewTitle}</div>
                <div className={`mt-2 text-[14px] ${searchEngine === "google" ? "text-[#188038]" : "text-[#0f766e]"}`}>
                  {previewUrl}
                </div>
                <div className={`mt-3 text-[14px] leading-6 ${searchEngine === "google" ? "text-[#4d5156]" : "text-[#475467]"}`}>
                  {previewDescription}
                </div>
              </div>
            </WorkbenchSidebarCard>

            <WorkbenchSidebarCard eyebrow="selected page" title={selectedPage?.title ?? "未选择页面"}>
              {selectedPage && selectedSeo ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={selectedSeo.index === false ? "Noindex" : "Index"} tone={selectedSeo.index === false ? "warn" : "good"} />
                    <StatusPill label={selectedSeo.ogImage ? "OG set" : "OG fallback"} tone={selectedSeo.ogImage ? "good" : "neutral"} />
                  </div>
                  <dl className="mt-4 grid gap-3 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#667085]">Route</dt>
                      <dd className="font-mono text-[#18212f]">{selectedPage.slug}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#667085]">Page type</dt>
                      <dd className="text-[#18212f]">{selectedPage.pageType}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#667085]">Index</dt>
                      <dd className="text-[#18212f]">{selectedSeo.index === false ? "Noindex" : "Index"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#667085]">Open Graph</dt>
                      <dd className="text-[#18212f]">{selectedSeo.ogImage ? "自定义" : "默认"}</dd>
                    </div>
                  </dl>
                </>
              ) : null}
            </WorkbenchSidebarCard>
          </div>
        }
      >
        <WorkbenchTableShell>
          <div className="border-b border-[#edf2f7] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#98a2b3]">seo settings</div>
                <h3 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#18212f]">TDK metadata workspace</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#667085]">
                  统一维护 Title、Description、Keywords、canonical、robots 和搜索预览。
                </p>
              </div>
              <div className="shrink-0">
                <div className="flex items-center gap-2">
                  <WorkbenchActionButton label="恢复线上" onClick={resetToPublished} />
                  <WorkbenchActionButton label="导出 CSV" onClick={exportSeo} />
                  <WorkbenchActionButton label={saving ? "保存中..." : "保存设置"} onClick={save} primary />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 px-5 py-5">
            <section className="rounded-[18px] border border-[#e6ebf2] bg-white">
              <div className="border-b border-[#edf2f7] px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[22px] font-semibold tracking-[-0.03em] text-[#18212f]">站点元数据</div>
                  <StatusPill label={dirty ? "Draft" : "Published"} tone={dirty ? "warn" : "good"} />
                </div>
              </div>
              <div className="grid gap-5 px-5 py-5 xl:grid-cols-[220px_minmax(0,1fr)]">
                <div className="text-[13px] leading-6 text-[#667085]">
                  站点默认 TDK 会落到首页以及未单独覆盖的页面。
                </div>
                <div className="grid gap-5">
                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-[#344054]">默认 Title (网站标题)</span>
                    <input
                      className="h-[44px] rounded-[12px] border border-[#d8e0ea] px-4 text-[14px] text-[#18212f] outline-none"
                      onChange={(event) => updateGlobal({ siteTitle: event.target.value })}
                      value={seo.siteTitle}
                    />
                    <span className="text-right text-[12px] text-[#98a2b3]">{seo.siteTitle.trim().length}/60</span>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-[#344054]">默认 Description (Meta 描述)</span>
                    <textarea
                      className="min-h-[96px] rounded-[12px] border border-[#d8e0ea] px-4 py-3 text-[14px] leading-6 text-[#18212f] outline-none"
                      onChange={(event) => updateGlobal({ siteDescription: event.target.value })}
                      value={seo.siteDescription}
                    />
                    <span className="text-right text-[12px] text-[#98a2b3]">{seo.siteDescription.trim().length}/160</span>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-[#344054]">默认 Keywords (关键词)</span>
                    <input
                      className="h-[44px] rounded-[12px] border border-[#d8e0ea] px-4 text-[14px] text-[#18212f] outline-none"
                      onChange={(event) => updateGlobal({ siteKeywords: event.target.value })}
                      placeholder="AI headshots, photo packages, creator portraits"
                      value={seo.siteKeywords ?? ""}
                    />
                    <span className="text-[12px] leading-5 text-[#98a2b3]">用英文逗号分隔。页面没有单独设置 Keywords 时会继承这里。</span>
                  </label>

                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <label className="grid gap-2">
                      <span className="text-[14px] font-medium text-[#344054]">网站地址 (Site URL)</span>
                      <input
                        className="h-[44px] rounded-[12px] border border-[#d8e0ea] bg-[#f8fafc] px-4 text-[14px] text-[#667085] outline-none"
                        readOnly
                        value={`https://${site.primaryDomain}`}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[14px] font-medium text-[#344054]">社交分享图 (Social / Share Image)</span>
                      <div className="grid gap-3 xl:grid-cols-[1fr_120px]">
                        <input
                          className="h-[44px] rounded-[12px] border border-[#d8e0ea] px-4 text-[14px] text-[#18212f] outline-none"
                          onChange={(event) => updateGlobal({ defaultOgImage: event.target.value })}
                          value={seo.defaultOgImage ?? ""}
                        />
                        <div className="flex items-center justify-center rounded-[12px] border border-[#d8e0ea] bg-[#f8fafc] text-[#667085]">
                          <ImageIcon className="h-5 w-5" strokeWidth={1.8} />
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[18px] border border-[#e6ebf2] bg-white">
              <div className="border-b border-[#edf2f7] px-5 py-4">
                <div className="text-[22px] font-semibold tracking-[-0.03em] text-[#18212f]">页面元数据默认设置</div>
              </div>
              <div className="grid gap-5 px-5 py-5 xl:grid-cols-[220px_minmax(0,1fr)]">
                <div className="text-[13px] leading-6 text-[#667085]">
                  这些规则会作为页面默认值，除非页面级 SEO 覆盖它们。
                </div>
                <div className="grid gap-5">
                  <label className="grid gap-2">
                    <span className="text-[14px] font-medium text-[#344054]">默认标题模板 (Title Template)</span>
                    <input
                      className="h-[44px] rounded-[12px] border border-[#d8e0ea] px-4 text-[14px] text-[#18212f] outline-none"
                      onChange={(event) => updateGlobal({ titleTemplate: event.target.value })}
                      value={seo.titleTemplate}
                    />
                  </label>

                  <div className="grid gap-3">
                    <span className="text-[14px] font-medium text-[#344054]">默认 Robots 指令</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={`rounded-[10px] border px-4 py-2 text-[13px] ${
                          seo.robots.index && seo.robots.follow
                            ? "border-[#bfd0f5] bg-[#f5f8ff] text-[#2f6fed]"
                            : "border-[#d8e0ea] bg-white text-[#344054]"
                        }`}
                        onClick={() => {
                          updateRobots("index", true);
                          updateRobots("follow", true);
                        }}
                        type="button"
                      >
                        index, follow
                      </button>
                      <button
                        className={`rounded-[10px] border px-4 py-2 text-[13px] ${
                          !seo.robots.index && seo.robots.follow
                            ? "border-[#bfd0f5] bg-[#f5f8ff] text-[#2f6fed]"
                            : "border-[#d8e0ea] bg-white text-[#344054]"
                        }`}
                        onClick={() => {
                          updateRobots("index", false);
                          updateRobots("follow", true);
                        }}
                        type="button"
                      >
                        noindex, follow
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[18px] border border-[#e6ebf2] bg-white">
              <div className="border-b border-[#edf2f7] px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[22px] font-semibold tracking-[-0.03em] text-[#18212f]">页面级 SEO</div>
                  <select
                    className="h-[40px] rounded-[12px] border border-[#d8e0ea] bg-white px-3 text-[13px] text-[#18212f]"
                    onChange={(event) => setSelectedPageId(event.target.value)}
                    value={selectedPageId}
                  >
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedPage && selectedSeo ? (
                <div className="grid gap-5 px-5 py-5 xl:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="text-[13px] leading-6 text-[#667085]">
                    当前页面可覆盖默认 TDK、canonical、分享图和索引策略。
                  </div>
                  <div className="grid gap-5">
                    <label className="grid gap-2">
                      <span className="text-[14px] font-medium text-[#344054]">页面 Title</span>
                      <input
                        className="h-[44px] rounded-[12px] border border-[#d8e0ea] px-4 text-[14px] text-[#18212f] outline-none"
                        onChange={(event) => updatePage(selectedPage.id, { title: event.target.value })}
                        value={selectedSeo.title}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[14px] font-medium text-[#344054]">页面 Description</span>
                      <textarea
                        className="min-h-[96px] rounded-[12px] border border-[#d8e0ea] px-4 py-3 text-[14px] leading-6 text-[#18212f] outline-none"
                        onChange={(event) => updatePage(selectedPage.id, { description: event.target.value })}
                        value={selectedSeo.description}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[14px] font-medium text-[#344054]">页面 Keywords</span>
                      <input
                        className="h-[44px] rounded-[12px] border border-[#d8e0ea] px-4 text-[14px] text-[#18212f] outline-none"
                        onChange={(event) => updatePage(selectedPage.id, { keywords: event.target.value })}
                        placeholder={seo.siteKeywords || "AI headshots, portrait generator, photo packages"}
                        value={selectedSeo.keywords ?? ""}
                      />
                      <span className="text-[12px] leading-5 text-[#98a2b3]">
                        留空时使用站点默认 Keywords；保存后会进入页面 metadata 的 keywords 字段。
                      </span>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[14px] font-medium text-[#344054]">Canonical</span>
                      <input
                        className="h-[44px] rounded-[12px] border border-[#d8e0ea] px-4 text-[14px] text-[#18212f] outline-none"
                        onBlur={(event) =>
                          updatePage(selectedPage.id, {
                            canonicalPath: cleanPath(event.target.value, selectedPage.slug)
                          })
                        }
                        onChange={(event) => updatePage(selectedPage.id, { canonicalPath: event.target.value })}
                        value={selectedSeo.canonicalPath ?? selectedPage.slug}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[14px] font-medium text-[#344054]">页面 OG / 分享图</span>
                      <div className="grid gap-3 xl:grid-cols-[1fr_120px]">
                        <input
                          className="h-[44px] rounded-[12px] border border-[#d8e0ea] px-4 text-[14px] text-[#18212f] outline-none"
                          onChange={(event) => updatePage(selectedPage.id, { ogImage: event.target.value })}
                          placeholder={seo.defaultOgImage || "/assets/site/share-image.png"}
                          value={selectedSeo.ogImage ?? ""}
                        />
                        <div className="flex items-center justify-center rounded-[12px] border border-[#d8e0ea] bg-[#f8fafc] text-[#667085]">
                          <ImageIcon className="h-5 w-5" strokeWidth={1.8} />
                        </div>
                      </div>
                      <span className="text-[12px] leading-5 text-[#98a2b3]">
                        留空时使用默认分享图；支持 media id、/assets 路径或完整 URL。
                      </span>
                    </label>

                    <div className="flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-[13px] text-[#344054]">
                        <input
                          checked={selectedSeo.index !== false}
                          onChange={(event) => updatePage(selectedPage.id, { index: event.target.checked })}
                          type="checkbox"
                        />
                        {selectedSeo.index === false ? (
                          <EyeOff className="h-4 w-4 text-[#98a2b3]" strokeWidth={1.8} />
                        ) : (
                          <Eye className="h-4 w-4 text-[#98a2b3]" strokeWidth={1.8} />
                        )}
                        Allow indexing
                      </label>
                      <label className="inline-flex items-center gap-2 text-[13px] text-[#344054]">
                        <input
                          checked={selectedSeo.follow !== false}
                          onChange={(event) => updatePage(selectedPage.id, { follow: event.target.checked })}
                          type="checkbox"
                        />
                        Follow links
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <div className="flex items-center justify-between rounded-[16px] border border-[#edf2f7] bg-[#fbfcfe] px-4 py-4">
              <div className="text-[13px] text-[#667085]">{message}</div>
              <WorkbenchActionButton label={saving ? "保存中..." : "保存设置"} onClick={save} primary />
            </div>
          </div>
        </WorkbenchTableShell>
      </DesignWorkbenchLayout>
    </div>
  );
}
