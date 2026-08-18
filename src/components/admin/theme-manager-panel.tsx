"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Download, Eye, Layers3, Plus, RefreshCcw, Sparkles, Trash2, WandSparkles } from "lucide-react";
import type { SiteTheme, ThemeCopy, ThemePublication } from "@/lib/types";
import { downloadJson } from "@/components/admin/export-utils";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";

type ThemeRecordStats = {
  templateCount: number;
  sectionCount: number;
  blockCount?: number;
  templateNames?: string[];
  settingsFieldCount?: number;
  settingsGlobalSections?: string[];
  hasSettingsData?: boolean;
};

type ThemeRecord = {
  themeId: string;
  name: string;
  themeKey: string;
  status: "draft" | "active";
  templates?: Record<string, { content_for_page: string[]; sections: Record<string, unknown> }>;
  settings?: unknown;
  updatedAt: string;
  stats?: ThemeRecordStats;
};

type AvailableSaasTheme = {
  themeKey: string;
  sourceRoot: string;
  counts: {
    templates: number;
    sections: number;
    skippedSections: number;
    settingsGroups: number;
  };
  thumbnailUrl?: string | null;
  templateNames: string[];
  sectionNames: string[];
  skippedSections: Array<{ file: string; reason: string }>;
};

type InternalThemePackage = {
  key: string;
  name: string;
  description: string;
  audience: string;
  accent?: string;
  thumbnailUrl?: string;
  templates: Array<{ key: string; label: string; pageType: string; sectionCount: number }>;
  featuredSections: string[];
  installType: "internal";
};

type ThemeLibrarySnapshot = {
  draft: ThemeRecord;
  active: ThemeRecord;
  themes: SiteThemeSummary[];
  copies: ThemeCopySummary[];
  publications: ThemePublicationSummary[];
};

export type ThemePublicationSummary = Pick<ThemePublication, "id" | "version" | "publishedAt" | "publishedBy"> & {
  pageCount?: number;
  sectionCount?: number;
  snapshot?: ThemePublication["snapshot"];
};

export type SiteThemeSummary = Omit<SiteTheme, "templates" | "settings"> & {
  templates?: SiteTheme["templates"];
  settings?: SiteTheme["settings"];
  stats?: ThemeRecordStats;
};

export type ThemeCopySummary = Omit<ThemeCopy, "templates" | "settings"> & {
  templates?: ThemeCopy["templates"];
  settings?: ThemeCopy["settings"];
  stats?: ThemeRecordStats;
};

export function toThemePublicationSummary(publication: ThemePublication | ThemePublicationSummary): ThemePublicationSummary {
  const snapshot = "snapshot" in publication ? publication.snapshot : undefined;
  return {
    id: publication.id,
    version: publication.version,
    publishedAt: publication.publishedAt,
    publishedBy: publication.publishedBy,
    pageCount: "pageCount" in publication ? publication.pageCount : snapshot?.pages?.length ?? 0,
    sectionCount: "sectionCount" in publication ? publication.sectionCount : undefined,
    snapshot
  };
}

function templateStats(templates: ThemeRecord["templates"]) {
  if (!templates) return { templateCount: 0, sectionCount: 0, blockCount: 0, templateNames: [] };
  const entries = Object.entries(templates);
  const sectionCount = entries.reduce((total, [, template]) => total + Object.keys(template.sections ?? {}).length, 0);
  const blockCount = entries.reduce(
    (total, [, template]) =>
      total +
      Object.values(template.sections ?? {}).reduce<number>((sectionTotal, section) => {
        const blocks = (section as { blocks?: unknown[] }).blocks;
        return sectionTotal + (Array.isArray(blocks) ? blocks.length : 0);
      }, 0),
    0
  );
  return { templateCount: entries.length, sectionCount, blockCount, templateNames: entries.map(([name]) => name) };
}

function themeStats(theme: ThemeRecord | SiteThemeSummary) {
  if ("stats" in theme && theme.stats) {
    return {
      templateCount: theme.stats.templateCount,
      sectionCount: theme.stats.sectionCount,
      blockCount: theme.stats.blockCount ?? 0,
      templateNames: theme.stats.templateNames ?? []
    };
  }
  return templateStats((theme.templates ?? {}) as ThemeRecord["templates"]);
}

function themeSettingStats(theme: ThemeRecord | SiteThemeSummary) {
  if ("stats" in theme && theme.stats) {
    return {
      fieldCount: theme.stats.settingsFieldCount ?? 0,
      globalSections: theme.stats.settingsGlobalSections ?? [],
      hasSettingsData: Boolean(theme.stats.hasSettingsData)
    };
  }
  return settingStats(theme.settings);
}

function settingStats(settings: unknown) {
  const current =
    settings && typeof settings === "object" && "settings_data" in settings
      ? (settings as { settings_data?: { current?: Record<string, unknown> } }).settings_data?.current
      : undefined;
  const sections = current?.sections && typeof current.sections === "object" ? current.sections as Record<string, unknown> : {};
  const fieldCount = current ? Object.keys(current).filter((key) => key !== "sections").length : 0;
  return { fieldCount, globalSections: Object.keys(sections), hasSettingsData: Boolean(current) };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

function themeSourceLabel(source: SiteTheme["source"]) {
  return {
    site: "站点基线",
    "saas-theme": "SaaS 导入",
    "saas-theme1": "SaaS 导入",
    copy: "复制分支",
    imported: "内置主题"
  }[source];
}

type InstalledThemeFilter = "all" | "active" | "draft" | "saas" | "internal" | "copy" | "site";

export function ThemeManagerPanel({
  siteSlug,
  siteId,
  draft: initialDraft,
  active: initialActive,
  themes: initialThemes,
  availableThemes,
  internalPackages,
  copies: initialCopies,
  publications: initialPublications
}: {
  siteSlug: string;
  siteId: string;
  draft: ThemeRecord;
  active: ThemeRecord;
  themes: SiteThemeSummary[];
  availableThemes: AvailableSaasTheme[];
  internalPackages: InternalThemePackage[];
  copies: ThemeCopySummary[];
  publications: ThemePublicationSummary[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("主题库已载入，可在这里管理草稿、启用版和导入源主题。");
  const [themeSnapshot, setThemeSnapshot] = useState<ThemeLibrarySnapshot>({
    draft: initialDraft,
    active: initialActive,
    themes: initialThemes,
    copies: initialCopies,
    publications: initialPublications.map(toThemePublicationSummary)
  });
  const [selectedSaasThemeKey, setSelectedSaasThemeKey] = useState(availableThemes[0]?.themeKey ?? "theme1");
  const [selectedInternalThemeKey, setSelectedInternalThemeKey] = useState(internalPackages[0]?.key ?? "");
  const [installedThemeFilter, setInstalledThemeFilter] = useState<InstalledThemeFilter>("all");
  const [installedThemeQuery, setInstalledThemeQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const draft = themeSnapshot.draft;
  const active = themeSnapshot.active;
  const themeRecords = themeSnapshot.themes;
  const copies = themeSnapshot.copies;
  const publications = themeSnapshot.publications;
  const selectedSaasTheme = availableThemes.find((theme) => theme.themeKey === selectedSaasThemeKey) ?? availableThemes[0];
  const selectedInternalTheme = internalPackages.find((theme) => theme.key === selectedInternalThemeKey) ?? internalPackages[0];
  const sortedThemeRecords = useMemo(
    () =>
      [...themeRecords].sort((left, right) => {
        if (left.status !== right.status) return left.status === "active" ? -1 : 1;
        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      }),
    [themeRecords]
  );
  const installedActiveTheme = sortedThemeRecords.find((theme) => theme.status === "active");
  const installedDraftCount = sortedThemeRecords.filter((theme) => theme.status !== "active").length;
  const importedThemeCount = themeRecords.filter((theme) => theme.source === "imported" || theme.source === "saas-theme" || theme.source === "saas-theme1").length;
  const copyThemeCount = themeRecords.filter((theme) => theme.source === "copy").length;
  const latestThemeUpdate = sortedThemeRecords
    .map((theme) => theme.updatedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const activeThemeLabel = installedActiveTheme?.name ?? active.name;
  const filteredThemeRecords = useMemo(() => {
    const query = installedThemeQuery.trim().toLowerCase();
    return sortedThemeRecords.filter((theme) => {
      const sourceMatch =
        installedThemeFilter === "all"
          ? true
          : installedThemeFilter === "active"
          ? theme.status === "active"
          : installedThemeFilter === "draft"
          ? theme.status !== "active"
          : installedThemeFilter === "saas"
          ? theme.source === "saas-theme" || theme.source === "saas-theme1"
          : installedThemeFilter === "internal"
          ? theme.source === "imported"
          : installedThemeFilter === "copy"
          ? theme.source === "copy"
          : theme.source === "site";

      if (!sourceMatch) return false;
      if (!query) return true;
      const haystack = [theme.name, theme.themeKey, theme.themeId, themeSourceLabel(theme.source)].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [installedThemeFilter, installedThemeQuery, sortedThemeRecords]);
  const liveThemes = filteredThemeRecords.filter((theme) => theme.status === "active");
  const draftThemes = filteredThemeRecords.filter((theme) => theme.status !== "active");
  const installedThemeCounts: Record<InstalledThemeFilter, number> = {
    all: sortedThemeRecords.length,
    active: sortedThemeRecords.filter((theme) => theme.status === "active").length,
    draft: sortedThemeRecords.filter((theme) => theme.status !== "active").length,
    saas: sortedThemeRecords.filter((theme) => theme.source === "saas-theme" || theme.source === "saas-theme1").length,
    internal: sortedThemeRecords.filter((theme) => theme.source === "imported").length,
    copy: sortedThemeRecords.filter((theme) => theme.source === "copy").length,
    site: sortedThemeRecords.filter((theme) => theme.source === "site").length
  };
  const workflowSteps = [
    { label: "导入主题包", detail: "先把 SaaS 原主题或内置主题包装入当前店铺主题库。" },
    { label: "应用到草稿", detail: "选中某个主题作为本次装修基线，再进入设计器继续编辑。" },
    { label: "发布上线", detail: "确认草稿后发布，前台只读取最近一次已发布快照。" }
  ];

  async function refreshThemeSnapshot(detail: "summary" | "full" = "summary") {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/sites/${siteId}/theme/records${detail === "full" ? "?detail=full" : ""}`);
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(`刷新主题状态失败：${json.error ?? "未知错误"}`);
        return false;
      }
      const nextSnapshot: ThemeLibrarySnapshot = {
        draft: json.draft,
        active: json.active,
        themes: json.themes,
        copies: json.copies,
        publications: (json.publications ?? []).map((publication: ThemePublication | ThemePublicationSummary) => toThemePublicationSummary(publication))
      };
      setThemeSnapshot(nextSnapshot);
      return nextSnapshot;
    } finally {
      setRefreshing(false);
    }
  }

  async function installTheme(themeKey = "theme1") {
    const response = await fetch(`/api/sites/${siteId}/theme/install`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo", themeKey })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(`导入失败：${json.error ?? "未知错误"}`);
      return;
    }
    await refreshThemeSnapshot();
    router.refresh();
    setMessage(`${json.theme?.name ?? `SaaS ${themeKey}`} 已导入为草稿主题。`);
  }

  async function installInternalTheme(packageKey: string, label: string) {
    const response = await fetch(`/api/sites/${siteId}/theme/install`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo", themeKey: packageKey, installType: "internal" })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(`导入失败：${json.error ?? "未知错误"}`);
      return;
    }
    await refreshThemeSnapshot();
    router.refresh();
    setMessage(`${label} 已导入到当前站点主题库。`);
  }

  async function duplicate(source: "draft" | "active") {
    const response = await fetch(`/api/sites/${siteId}/theme/duplicate`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ source, actor: "site_admin_demo" })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(`复制失败：${json.error ?? "未知错误"}`);
      return;
    }
    await refreshThemeSnapshot();
    router.refresh();
    setMessage(`已从${source === "draft" ? "草稿版" : "启用版"}复制出新主题分支。`);
  }

  async function duplicateTheme(theme: SiteThemeSummary) {
    const response = await fetch(`/api/sites/${siteId}/theme/duplicate`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ source: theme.status, sourceThemeId: theme.id, name: `${theme.name} copy`, actor: "site_admin_demo" })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(`复制失败：${json.error ?? "未知错误"}`);
      return;
    }
    await refreshThemeSnapshot();
    router.refresh();
    setMessage(`${theme.name} 已复制为新的草稿主题。`);
  }

  async function exportTheme(source: "draft" | "active") {
    const response = await fetch(`/api/sites/${siteId}/theme/export?source=${source}`);
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(`导出失败：${json.error ?? "未知错误"}`);
      return;
    }
    const templateCount = Object.keys(json.package?.theme?.templates ?? {}).length;
    downloadJson(`${siteSlug}-${source}-theme.json`, json.package);
    setMessage(`${source === "draft" ? "草稿版" : "启用版"}导出完成，共 ${templateCount} 个页面模板。`);
  }

  async function resetDraft() {
    const response = await fetch(`/api/sites/${siteId}/theme/reset-draft`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(`重置失败：${json.error ?? "未知错误"}`);
      return;
    }
    await refreshThemeSnapshot();
    router.refresh();
    setMessage(`草稿已恢复到发布版本 v${json.sourceVersion}。`);
  }

  async function applyToDraft(theme: SiteThemeSummary) {
    const response = await fetch(`/api/sites/${siteId}/theme/${theme.id}/apply-to-draft`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(`应用失败：${json.error ?? "未知错误"}`);
      return;
    }
    await refreshThemeSnapshot();
    router.refresh();
    setMessage(`${theme.name} 已应用到当前草稿，可继续进入设计器编辑。`);
  }

  async function deleteTheme(theme: SiteThemeSummary) {
    const response = await fetch(`/api/sites/${siteId}/theme/${theme.id}`, {
      method: "DELETE",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(`删除失败：${json.error ?? "未知错误"}`);
      return;
    }
    await refreshThemeSnapshot();
    router.refresh();
    setMessage(`${theme.name} 已从站点主题库移除。`);
  }

  async function exportInstalledTheme(theme: SiteThemeSummary) {
    let exportTheme = theme;
    if (!theme.templates || !theme.settings) {
      const refreshed = await refreshThemeSnapshot("full");
      if (!refreshed) return;
      const fullTheme = refreshed.themes.find((item) => item.id === theme.id);
      if (fullTheme?.templates && fullTheme.settings) {
        exportTheme = fullTheme;
      } else {
        setMessage("正在刷新完整主题数据，请稍后再导出。");
        return;
      }
    }
    downloadJson(`${siteSlug}-${theme.themeKey}-${theme.status}.json`, {
      exportedAt: new Date().toISOString(),
      siteSlug,
      theme: {
        id: exportTheme.id,
        name: exportTheme.name,
        themeId: exportTheme.themeId,
        themeKey: exportTheme.themeKey,
        status: exportTheme.status,
        source: exportTheme.source,
        createdBy: exportTheme.createdBy,
        createdAt: exportTheme.createdAt,
        updatedAt: exportTheme.updatedAt,
        templates: exportTheme.templates,
        settings: exportTheme.settings
      }
    });
    setMessage(`${theme.name} 已导出为站点主题快照。`);
  }

  return (
    <div className="min-w-0" data-admin-command-bar="saas-style">
      <div className="sr-only" aria-hidden="true">
        <span>SaaS fc_themes control room</span>
        <span>Draft theme</span>
        <span>Active storefront theme</span>
        <span>Publication history</span>
        <span>Theme copies</span>
        <span>installed themes</span>
        <span>Original SaaS theme library</span>
        <span>Add default SaaS theme</span>
      </div>
      <div className="right_box min-w-0 border border-[var(--admin-border-soft)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.26)]">
        <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(560px,1fr)_minmax(340px,420px)]">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a94a6]">theme control</div>
            <h3 className="mt-2 text-pretty font-[var(--font-display)] text-[26px] font-semibold tracking-[-0.03em] text-[var(--admin-text)]">
              站点主题库主控台
            </h3>
            <p className="mt-2 max-w-[760px] break-words text-[13px] leading-6 text-[var(--admin-muted)] [overflow-wrap:anywhere]">
              管理草稿主题、线上启用版、导入源主题和发布记录。前台只读取已发布快照，草稿调整不会直接影响线上页面。
            </p>

            <div className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {workflowSteps.map((step, index) => (
                <div
                  className="min-w-0 rounded-[12px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-4 py-4"
                  key={step.label}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-[10px] bg-white font-mono text-[11px] text-[var(--admin-accent)] shadow-[0_8px_20px_-18px_rgba(15,23,42,0.4)]">
                      0{index + 1}
                    </span>
                    <span className="min-w-0 break-words text-[13px] font-semibold text-[var(--admin-text)] [overflow-wrap:anywhere]">{step.label}</span>
                  </div>
                  <p className="mt-3 break-words text-[12px] leading-5 text-[var(--admin-muted)] [overflow-wrap:anywhere]">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[14px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8a94a6]">quick import</div>
                  <div className="mt-1 text-[15px] font-semibold text-[var(--admin-text)]">快速导入主题基线</div>
                </div>
                <Sparkles className="h-4 w-4 text-[var(--admin-accent)]" strokeWidth={1.8} />
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-[12px] border border-[var(--admin-border-soft)] bg-white p-3">
                  <div className="text-[12px] font-medium text-[var(--admin-text)]">SaaS 导入源</div>
                  <select
                    className="mt-2 h-[40px] w-full min-w-0 rounded-[10px] border border-[var(--admin-border)] bg-white px-3 text-[13px] text-[var(--admin-text)] outline-none focus-visible:border-[#97bfff] focus-visible:ring-2 focus-visible:ring-[rgba(27,119,243,0.14)]"
                    onChange={(event) => setSelectedSaasThemeKey(event.target.value)}
                    value={selectedSaasThemeKey}
                  >
                    {availableThemes.map((theme) => (
                      <option key={theme.themeKey} value={theme.themeKey}>
                        {theme.themeKey} / {theme.counts.templates} 页 / {theme.counts.sections} 模块
                      </option>
                    ))}
                  </select>
                  {selectedSaasTheme ? (
                    <p className="mt-2 break-words text-[12px] leading-5 text-[var(--admin-muted)] [overflow-wrap:anywhere]">
                      来源：{selectedSaasTheme.sourceRoot}。设置组 {selectedSaasTheme.counts.settingsGroups}，跳过模块 {selectedSaasTheme.counts.skippedSections}。
                    </p>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <button className="input_btn inline-flex items-center gap-1" onClick={() => installTheme(selectedSaasThemeKey)} type="button">
                      <Plus className="h-3 w-3" strokeWidth={1.8} />
                      导入 SaaS 主题
                    </button>
                  </div>
                </div>

                <div className="rounded-[12px] border border-[var(--admin-border-soft)] bg-white p-3">
                  <div className="text-[12px] font-medium text-[var(--admin-text)]">内置站点主题包</div>
                  <select
                    className="mt-2 h-[40px] w-full min-w-0 rounded-[10px] border border-[var(--admin-border)] bg-white px-3 text-[13px] text-[var(--admin-text)] outline-none focus-visible:border-[#97bfff] focus-visible:ring-2 focus-visible:ring-[rgba(27,119,243,0.14)]"
                    onChange={(event) => setSelectedInternalThemeKey(event.target.value)}
                    value={selectedInternalThemeKey}
                  >
                    {internalPackages.map((themePackage) => (
                      <option key={themePackage.key} value={themePackage.key}>
                        {themePackage.name} / {themePackage.templates.length} 模板
                      </option>
                    ))}
                  </select>
                  {selectedInternalTheme ? (
                    <p className="mt-2 break-words text-[12px] leading-5 text-[var(--admin-muted)] [overflow-wrap:anywhere]">
                      {selectedInternalTheme.audience}。{selectedInternalTheme.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <button
                      className="admin_edit inline-flex items-center gap-1"
                      onClick={() => selectedInternalTheme && installInternalTheme(selectedInternalTheme.key, selectedInternalTheme.name)}
                      type="button"
                    >
                      <Plus className="h-3 w-3" strokeWidth={1.8} />
                      安装站内主题
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <ThemeMetricCard detail="站点内可直接应用与复制" label="主题数量" value={String(themeRecords.length)} />
          <ThemeMetricCard detail="复制分支与实验主题" label="主题复制" value={String(copies.length)} />
          <ThemeMetricCard detail="线上可回滚的版本记录" label="发布次数" value={String(publications.length)} />
          <ThemeMetricCard detail="当前草稿页面模板总数" label="页面模板" value={String(themeStats(draft).templateCount)} />
          <ThemeMetricCard detail="当前草稿全局设置字段数" label="主题配置" value={String(themeSettingStats(draft).fieldCount)} />
        </div>

        <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <div aria-live="polite" className="min-w-0 rounded-[12px] border border-[#dce3ee] bg-[#f7f9fc] px-4 py-3 text-[13px] leading-6 text-[var(--admin-muted)] [overflow-wrap:anywhere]">
            {message}
          </div>
          <div className="grid min-w-0 gap-2 rounded-[12px] border border-[var(--admin-border-soft)] bg-white px-4 py-3 text-[12px] leading-5 text-[var(--admin-muted)]">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-3">
              <span>当前线上主题</span>
              <strong className="break-words text-right font-semibold text-[var(--admin-text)] [overflow-wrap:anywhere]">{activeThemeLabel}</strong>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-3">
              <span>草稿分支</span>
              <strong className="break-words text-right font-semibold text-[var(--admin-text)] [overflow-wrap:anywhere]">{installedDraftCount} 个</strong>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-3">
              <span>导入主题</span>
              <strong className="break-words text-right font-medium text-[var(--admin-text)] [overflow-wrap:anywhere]">{importedThemeCount} 个</strong>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-3">
              <span>复制分支</span>
              <strong className="break-words text-right font-medium text-[var(--admin-text)] [overflow-wrap:anywhere]">{copyThemeCount} 个</strong>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-3">
              <span>最近更新</span>
              <strong className="break-words text-right font-medium text-[var(--admin-text)] [overflow-wrap:anywhere]">{latestThemeUpdate ? formatDateTime(latestThemeUpdate) : "-"}</strong>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="admin_btn inline-flex items-center gap-1" disabled={refreshing} onClick={() => void refreshThemeSnapshot()} type="button">
            <RefreshCcw className="h-3 w-3" strokeWidth={1.8} />
            {refreshing ? "刷新中" : "刷新状态"}
          </button>
          <button className="admin_btn inline-flex items-center gap-1" onClick={() => duplicate("draft")} type="button">
            <Copy className="h-3 w-3" strokeWidth={1.8} />
            复制当前草稿
          </button>
          <button className="admin_btn inline-flex items-center gap-1" onClick={() => exportTheme("active")} type="button">
            <Download className="h-3 w-3" strokeWidth={1.8} />
            导出线上主题
          </button>
          <button className="admin_btn inline-flex items-center gap-1" onClick={resetDraft} type="button">
            <RefreshCcw className="h-3 w-3" strokeWidth={1.8} />
            草稿恢复到发布版
          </button>
          <Link className="input_btn inline-flex h-[32px] items-center gap-1" href={`/site/${siteSlug}/admin/design`}>
            <WandSparkles className="h-3 w-3" strokeWidth={1.8} />
            打开装修器
          </Link>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
        <ThemeRecordCard label="草稿主题" record={draft} />
        <ThemeRecordCard label="线上启用主题" record={active} />
      </div>

      <div className="right_box mt-3 min-w-0 border border-[#eee] bg-white p-3">
        <div className="xt_tt">
          <span>内置站点主题包</span>
          <em className="ml-2 not-italic font-mono text-[10px] uppercase tracking-[0.14em] text-[#999]">
            {internalPackages.length} packages
          </em>
          <div className="clear" />
        </div>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          {internalPackages.map((themePackage) => (
            <InternalThemePackageCard
              key={themePackage.key}
              onInstall={() => installInternalTheme(themePackage.key, themePackage.name)}
              themePackage={themePackage}
            />
          ))}
        </div>
      </div>

      <div className="right_box mt-3 min-w-0 border border-[#eee] bg-white p-3">
        <div className="xt_tt">
          <span>SaaS 导入源主题</span>
          <em className="ml-2 not-italic font-mono text-[10px] uppercase tracking-[0.14em] text-[#999]">
            {availableThemes.length} packages / {availableThemes.reduce((sum, theme) => sum + theme.counts.sections, 0)} sections
          </em>
          <div className="clear" />
        </div>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          {availableThemes.map((theme) => (
            <AvailableThemeInstallCard key={theme.themeKey} onInstall={() => installTheme(theme.themeKey)} theme={theme} />
          ))}
        </div>
      </div>

      <div className="right_box mt-3 min-w-0 border border-[#eee] bg-white p-3">
        <div className="xt_tt">
          <span>站点已安装主题</span>
          <Link className="input_btn float-right mt-[7px] inline-flex h-[26px] items-center" href={`/site/${siteSlug}/admin/design`}>
            打开装修器
          </Link>
          <div className="clear" />
        </div>
        <div className="mt-3 grid gap-4">
          <div className="rounded-[14px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] p-4">
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <label className="grid gap-2 text-[12px] text-[var(--admin-muted)]">
                <span>搜索站点主题</span>
                <input
                  className="h-[40px] min-w-0 rounded-[10px] border border-[var(--admin-border)] bg-white px-3 text-[13px] text-[var(--admin-text)] outline-none focus-visible:border-[#97bfff] focus-visible:ring-2 focus-visible:ring-[rgba(27,119,243,0.14)]"
                  onChange={(event) => setInstalledThemeQuery(event.target.value)}
                  placeholder="按主题名、themeKey、来源筛选…"
                  value={installedThemeQuery}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all" as const, label: "全部" },
                  { key: "active" as const, label: "线上" },
                  { key: "draft" as const, label: "草稿" },
                  { key: "saas" as const, label: "SaaS" },
                  { key: "internal" as const, label: "内置" },
                  { key: "copy" as const, label: "复制" },
                  { key: "site" as const, label: "基线" }
                ].map((item) => {
                  const activeFilter = installedThemeFilter === item.key;
                  return (
                    <button
                      className={`inline-flex h-[34px] items-center gap-2 rounded-[10px] border px-3 text-[12px] ${
                        activeFilter
                          ? "border-[#cddcff] bg-[#eef4ff] text-[#1b77f3]"
                          : "border-[var(--admin-border-soft)] bg-white text-[#667085]"
                      }`}
                      key={item.key}
                      onClick={() => setInstalledThemeFilter(item.key)}
                      type="button"
                    >
                      <span>{item.label}</span>
                      <span className={`rounded-[999px] px-2 py-0.5 font-mono text-[10px] ${activeFilter ? "bg-white text-[#1b77f3]" : "bg-[var(--admin-panel)] text-[#98a2b3]"}`}>
                        {installedThemeCounts[item.key]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[var(--admin-muted)]">
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-2">{`当前可见 ${filteredThemeRecords.length} 个主题`}</span>
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-2">{`线上 ${liveThemes.length} 个`}</span>
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-2">{`草稿 ${draftThemes.length} 个`}</span>
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[13px] font-semibold text-[var(--admin-text)]">线上启用主题</div>
              <span className="tag_green">{liveThemes.length} 个</span>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
              {liveThemes.map((theme) => (
                <InstalledThemeCard
                  key={theme.id}
                  onApply={() => applyToDraft(theme)}
                  onDelete={() => deleteTheme(theme)}
                  onDuplicate={() => duplicateTheme(theme)}
                  onExport={() => exportInstalledTheme(theme)}
                  siteSlug={siteSlug}
                  theme={theme}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[13px] font-semibold text-[var(--admin-text)]">草稿与分支主题</div>
              <span className="tag_gray">{draftThemes.length} 个</span>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
              {draftThemes.map((theme) => (
                <InstalledThemeCard
                  key={theme.id}
                  onApply={() => applyToDraft(theme)}
                  onDelete={() => deleteTheme(theme)}
                  onDuplicate={() => duplicateTheme(theme)}
                  onExport={() => exportInstalledTheme(theme)}
                  siteSlug={siteSlug}
                  theme={theme}
                />
              ))}
            </div>
          </div>
          {!themeRecords.length ? (
            <div className="rounded-[12px] border border-dashed border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-6 text-[13px] text-[var(--admin-muted)]">
              当前站点还没有已安装主题。
            </div>
          ) : !filteredThemeRecords.length ? (
            <div className="rounded-[12px] border border-dashed border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-6 text-[13px] text-[var(--admin-muted)]">
              当前筛选条件下没有匹配的主题。
            </div>
          ) : null}
        </div>
      </div>

      <div className="right_box mt-3 min-w-0 border border-[#eee] bg-white p-3">
        <div className="xt_tt">
          <span>最近发布记录</span>
          <div className="clear" />
        </div>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
          {publications.length ? (
            publications
              .slice(-6)
              .reverse()
              .map((publication) => <PublicationCard key={publication.id} publication={publication} />)
          ) : (
            <div className="rounded-[12px] border border-dashed border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-6 text-[13px] text-[var(--admin-muted)]">
              暂无发布快照。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeMetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-3 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.32)]">
      <div className="break-words font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a94a6] [overflow-wrap:anywhere]">{label}</div>
      <div className="mt-2 break-words font-mono text-[26px] leading-7 text-[var(--admin-text)] tabular-nums [overflow-wrap:anywhere]">{value}</div>
      <div className="mt-2 break-words text-[12px] leading-5 text-[var(--admin-muted)] [overflow-wrap:anywhere]">{detail}</div>
    </div>
  );
}

function InstalledThemeCard({
  theme,
  siteSlug,
  onApply,
  onDuplicate,
  onDelete,
  onExport
}: {
  theme: SiteThemeSummary;
  siteSlug: string;
  onApply: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const stats = themeStats(theme);
  const settings = themeSettingStats(theme);
  return (
    <article className="min-w-0 rounded-[14px] border border-[var(--admin-border-soft)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.18)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={theme.status === "active" ? "tag_green" : "tag_gray"}>{theme.status === "active" ? "启用中" : "草稿"}</span>
            <span className="tag_gray">{themeSourceLabel(theme.source)}</span>
          </div>
          <h4 className="mt-3 break-words text-[18px] font-semibold leading-6 text-[var(--admin-text)] [overflow-wrap:anywhere]">{theme.name}</h4>
          <p className="mt-1 break-words font-mono text-[11px] leading-5 text-[#8a94a6] [overflow-wrap:anywhere]">{theme.themeKey} / {theme.themeId}</p>
        </div>
        {theme.status === "active" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22a06b]" strokeWidth={1.8} /> : null}
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-3">
        <ThemeMetricCard detail="模板页面" label="页面" value={String(stats.templateCount)} />
        <ThemeMetricCard detail="区块实例" label="模块" value={String(stats.sectionCount)} />
        <ThemeMetricCard detail="主题字段" label="配置" value={String(settings.fieldCount)} />
      </div>

      <div className="mt-4 min-w-0 rounded-[12px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-4 py-3 text-[12px] leading-5 text-[var(--admin-muted)]">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-start gap-3">
          <span>最近更新</span>
          <strong className="break-words text-right font-medium text-[var(--admin-text)] [overflow-wrap:anywhere]">{formatDateTime(theme.updatedAt)}</strong>
        </div>
        <div className="mt-2 break-words [overflow-wrap:anywhere]">
          页面模板：{stats.templateNames.slice(0, 6).join("、")}
          {stats.templateNames.length > 6 ? "…" : ""}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link className="input_btn inline-flex h-[32px] items-center gap-1" href={`/site/${siteSlug}/admin/design`}>
          <WandSparkles className="h-3 w-3" strokeWidth={1.8} />
          打开装修
        </Link>
        <button className="admin_btn inline-flex items-center gap-1" onClick={onApply} type="button">
          <RefreshCcw className="h-3 w-3" strokeWidth={1.8} />
          应用草稿
        </button>
        <button className="admin_btn inline-flex items-center gap-1" onClick={onDuplicate} type="button">
          <Copy className="h-3 w-3" strokeWidth={1.8} />
          复制分支
        </button>
        <button className="admin_btn inline-flex items-center gap-1" onClick={onExport} type="button">
          <Download className="h-3 w-3" strokeWidth={1.8} />
          导出
        </button>
        <button className="admin_del inline-flex items-center gap-1 disabled:opacity-40" disabled={theme.status === "active"} onClick={onDelete} type="button">
          <Trash2 className="h-3 w-3" strokeWidth={1.8} />
          删除
        </button>
      </div>
    </article>
  );
}

function AvailableThemeInstallCard({ theme, onInstall }: { theme: AvailableSaasTheme; onInstall: () => void }) {
  const topSections = theme.sectionNames.slice(0, 4).join("、");
  return (
    <article className="min-w-0 rounded-[14px] border border-[var(--admin-border-soft)] bg-white p-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.18)]">
      <div className="flex min-w-0 items-start gap-3">
        {theme.thumbnailUrl ? (
          <img alt={`${theme.themeKey} preview`} className="h-[72px] w-[96px] shrink-0 rounded-[10px] border border-[var(--admin-border-soft)] object-cover" height={72} loading="lazy" src={theme.thumbnailUrl} width={96} />
        ) : (
          <span className="grid h-[72px] w-[96px] shrink-0 place-items-center rounded-[10px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] text-[#98a2b3]">
            <Layers3 className="h-5 w-5" strokeWidth={1.8} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-[16px] font-semibold leading-6 text-[var(--admin-text)] [overflow-wrap:anywhere]">{theme.themeKey}</h4>
          <p className="mt-1 break-words font-mono text-[11px] leading-5 text-[#8a94a6] [overflow-wrap:anywhere]">{theme.sourceRoot}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--admin-muted)]">
            <span className="tag_gray">{theme.counts.templates} 模板</span>
            <span className="tag_gray">{theme.counts.sections} 模块</span>
            <span className="tag_gray">{theme.counts.settingsGroups} 配置组</span>
          </div>
        </div>
      </div>

      <div className="mt-4 break-words rounded-[12px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-4 py-3 text-[12px] leading-5 text-[var(--admin-muted)] [overflow-wrap:anywhere]">
        主要区块：{topSections || "未提取到 schema 模块"}。
        {theme.counts.skippedSections ? ` 跳过 ${theme.counts.skippedSections} 个模块。` : ""}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="admin_btn inline-flex items-center gap-1"
          onClick={() => {
            const target = theme.thumbnailUrl;
            if (target) window.open(target, "_blank", "noopener,noreferrer");
          }}
          type="button"
        >
          <Eye className="h-3 w-3" strokeWidth={1.8} />
          预览
        </button>
        <button className="admin_edit inline-flex items-center gap-1" onClick={onInstall} type="button">
          <Plus className="h-3 w-3" strokeWidth={1.8} />
          导入到站点
        </button>
      </div>
    </article>
  );
}

function InternalThemePackageCard({
  themePackage,
  onInstall
}: {
  themePackage: InternalThemePackage;
  onInstall: () => void;
}) {
  return (
    <article className="min-w-0 rounded-[14px] border border-[var(--admin-border-soft)] bg-white p-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.18)]">
      <div className="flex min-w-0 items-start gap-3">
        {themePackage.thumbnailUrl ? (
          <img
            alt={`${themePackage.key} preview`}
            className="h-[72px] w-[96px] shrink-0 rounded-[10px] border border-[var(--admin-border-soft)] object-cover"
            height={72}
            loading="lazy"
            src={themePackage.thumbnailUrl}
            width={96}
          />
        ) : (
          <span className="grid h-[72px] w-[96px] shrink-0 place-items-center rounded-[10px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] text-[#98a2b3]">
            <Layers3 className="h-5 w-5" strokeWidth={1.8} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-[16px] font-semibold leading-6 text-[var(--admin-text)] [overflow-wrap:anywhere]">{themePackage.name}</h4>
          <p className="mt-1 break-words font-mono text-[11px] leading-5 text-[#8a94a6] [overflow-wrap:anywhere]">{themePackage.key}</p>
          <p className="mt-2 break-words text-[12px] leading-5 text-[var(--admin-muted)] [overflow-wrap:anywhere]">{themePackage.audience}</p>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
        <ThemeMetricCard detail="页面模板" label="模板" value={String(themePackage.templates.length)} />
        <ThemeMetricCard detail="精选区块" label="区块" value={String(themePackage.featuredSections.length)} />
      </div>

      <p className="mt-4 break-words text-[12px] leading-5 text-[var(--admin-muted)] [overflow-wrap:anywhere]">{themePackage.description}</p>

      <div className="mt-4 flex justify-end">
        <button className="admin_edit inline-flex items-center gap-1" onClick={onInstall} type="button">
          <Plus className="h-3 w-3" strokeWidth={1.8} />
          安装站内主题
        </button>
      </div>
    </article>
  );
}

function PublicationCard({ publication }: { publication: ThemePublicationSummary }) {
  const pageCount = publication.pageCount ?? publication.snapshot?.pages?.length ?? 0;
  return (
    <article className="min-w-0 rounded-[14px] border border-[var(--admin-border-soft)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a94a6]">publication</div>
          <h4 className="mt-2 break-words text-[18px] font-semibold text-[var(--admin-text)] [overflow-wrap:anywhere]">v{publication.version}</h4>
        </div>
        <span className="tag_green">已发布</span>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
        <ThemeMetricCard detail="页面快照" label="页面" value={String(pageCount)} />
        <ThemeMetricCard detail="发布者" label="操作人" value={publication.publishedBy} />
      </div>

      <div className="mt-4 break-words rounded-[12px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-4 py-3 text-[12px] leading-5 text-[var(--admin-muted)] [overflow-wrap:anywhere]">
        <div>{pageCount} 个页面快照与一份全局主题设置。</div>
        <div className="mt-2 font-mono text-[11px] text-[#8a94a6]">{formatDateTime(publication.publishedAt)}</div>
      </div>
    </article>
  );
}

function ThemeRecordCard({ label, record }: { label: string; record: ThemeRecord }) {
  const stats = themeStats(record);
  const settings = themeSettingStats(record);
  return (
    <article className="right_box min-w-0 border border-[var(--admin-border-soft)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-4 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.24)]">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a94a6]">{label}</div>
          <h4 className="mt-2 break-words text-[18px] font-semibold leading-6 text-[var(--admin-text)] [overflow-wrap:anywhere]">{record.name}</h4>
          <p className="mt-1 break-words font-mono text-[11px] leading-5 text-[#8a94a6] [overflow-wrap:anywhere]">{record.themeKey} / {record.themeId}</p>
        </div>
        <span className={`${record.status === "active" ? "tag_green" : "tag_gray"} shrink-0 self-start`}>{record.status === "active" ? "线上启用" : "草稿版本"}</span>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-3">
        <ThemeMetricCard detail="模板页面" label="页面" value={String(stats.templateCount)} />
        <ThemeMetricCard detail="区块实例" label="模块" value={String(stats.sectionCount)} />
        <ThemeMetricCard detail="子块实例" label="子块" value={String(stats.blockCount)} />
        <ThemeMetricCard detail="全局主题字段" label="配置" value={String(settings.fieldCount)} />
      </div>

      <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-2">
        <div className="min-w-0 rounded-[10px] border border-[#e8edf4] bg-[#f8fafc] px-4 py-3">
          <div className="text-[12px] font-medium text-[var(--admin-text)]">页面模板</div>
          <div className="mt-2 break-words text-[12px] leading-6 text-[var(--admin-muted)] [overflow-wrap:anywhere]">{stats.templateNames.join("、") || "未配置"}</div>
        </div>
        <div className="min-w-0 rounded-[10px] border border-[#e8edf4] bg-[#f8fafc] px-4 py-3">
          <div className="text-[12px] font-medium text-[var(--admin-text)]">全局配置</div>
          <div className="mt-2 break-words text-[12px] leading-6 text-[var(--admin-muted)] [overflow-wrap:anywhere]">
            {settings.globalSections.join("、") || "未配置"}，{settings.hasSettingsData ? "全局主题设置已就绪" : "全局主题设置缺失"}
          </div>
        </div>
      </div>
    </article>
  );
}
