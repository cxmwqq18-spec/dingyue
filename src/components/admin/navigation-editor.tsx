"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, GripVertical, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  DesignWorkbenchLayout,
  WorkbenchActionButton,
  WorkbenchMetricStrip,
  WorkbenchRowLink,
  WorkbenchSearchInput,
  WorkbenchSearchRow,
  WorkbenchSectionTabs,
  WorkbenchSidebarCard,
  WorkbenchTableHeader,
  WorkbenchTableRow,
  WorkbenchTableShell
} from "@/components/admin/design-workbench";
import { downloadCsv } from "@/components/admin/export-utils";
import { StatusPill } from "@/components/ui";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { ThemeDraftMeta, ThemeNavLink, ThemeSettings } from "@/lib/types";

type NavLink = ThemeNavLink;
type ActiveTab = "header" | "footer";

function normalizeLinks(links: NavLink[]) {
  return links
    .map((link) => {
      const group = link.group?.trim();
      return {
        label: link.label.trim(),
        href: link.href.trim() || "#",
        ...(group ? { group } : {})
      };
    })
    .filter((link) => link.label);
}

function inferLinkType(href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) return "Custom link";
  if (href.startsWith("/policies/")) return "Policy page";
  if (href.startsWith("/blog")) return "Blog route";
  if (href.startsWith("/help")) return "Help page";
  if (href.startsWith("/tools/")) return "AI tool";
  return "Page";
}

function saveStateLabel(dirty: boolean) {
  return dirty ? "Unsaved changes" : "All changes saved";
}

function sampleTarget(href: string) {
  if (href === "#") return "Unassigned";
  if (href.startsWith("/")) return href;
  return href.replace(/^https?:\/\//, "");
}

function footerGroupLabel(group?: string) {
  if (!group) return "Unassigned";
  if (group === "product") return "Product";
  if (group === "company") return "Company";
  if (group === "support") return "Support";
  return group;
}

export function NavigationEditor({
  siteId,
  publishHref,
  liveHref,
  initialSettings,
  publishedSettings,
  draftMeta
}: {
  siteId: string;
  publishHref: string;
  liveHref: string;
  initialSettings: ThemeSettings;
  publishedSettings: ThemeSettings;
  draftMeta?: ThemeDraftMeta;
}) {
  const router = useRouter();
  const [headerLinks, setHeaderLinks] = useState<NavLink[]>(initialSettings.navigation.headerLinks);
  const [footerLinks, setFooterLinks] = useState<NavLink[]>(initialSettings.navigation.footerLinks);
  const [activeTab, setActiveTab] = useState<ActiveTab>("header");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("导航草稿已载入。保存后仍需发布整站快照才会影响线上前台。");
  const [saving, setSaving] = useState(false);
  const [draftVersion, setDraftVersion] = useState<ThemeDraftMeta | undefined>(draftMeta);

  const draftNavigation = useMemo(
    () => ({
      headerLinks: normalizeLinks(headerLinks),
      footerLinks: normalizeLinks(footerLinks)
    }),
    [footerLinks, headerLinks]
  );
  const savedDraftNavigation = useMemo(
    () => ({
      headerLinks: normalizeLinks(initialSettings.navigation.headerLinks),
      footerLinks: normalizeLinks(initialSettings.navigation.footerLinks)
    }),
    [initialSettings.navigation.footerLinks, initialSettings.navigation.headerLinks]
  );
  const publishedNavigation = useMemo(
    () => ({
      headerLinks: normalizeLinks(publishedSettings.navigation.headerLinks),
      footerLinks: normalizeLinks(publishedSettings.navigation.footerLinks)
    }),
    [publishedSettings.navigation.footerLinks, publishedSettings.navigation.headerLinks]
  );
  const draftSettings = useMemo<ThemeSettings>(
    () => ({
      ...initialSettings,
      navigation: draftNavigation
    }),
    [draftNavigation, initialSettings]
  );

  const hasUnsavedChanges = JSON.stringify(draftNavigation) !== JSON.stringify(savedDraftNavigation);
  const hasUnpublishedChanges = JSON.stringify(savedDraftNavigation) !== JSON.stringify(publishedNavigation);
  const publishedHeaderCount = publishedSettings.navigation.headerLinks.length;
  const publishedFooterCount = publishedSettings.navigation.footerLinks.length;
  const activeLinks = activeTab === "header" ? headerLinks : footerLinks;
  const filteredLinks = activeLinks
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return true;
      return [link.label, link.href].some((item) => item.toLowerCase().includes(normalized));
    });

  useEffect(() => {
    setHeaderLinks(initialSettings.navigation.headerLinks);
    setFooterLinks(initialSettings.navigation.footerLinks);
  }, [initialSettings.navigation.footerLinks, initialSettings.navigation.headerLinks]);

  useEffect(() => {
    setDraftVersion(draftMeta);
  }, [draftMeta]);

  function updateActiveLinks(updater: (links: NavLink[]) => NavLink[]) {
    if (activeTab === "header") {
      setHeaderLinks((current) => updater(current));
      return;
    }
    setFooterLinks((current) => updater(current));
  }

  async function save() {
    setSaving(true);
    const response = await fetch(`/api/sites/${siteId}/theme/settings/draft`, {
      method: "PUT",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({
        draftJson: draftSettings,
        expectedRevision: draftVersion?.revision,
        expectedEtag: draftVersion?.etag
      })
    });
    const json = (await response.json().catch(() => ({}))) as { draftVersion?: ThemeDraftMeta; error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(response.status === 409 ? "保存被拦截：导航草稿版本已变化，请刷新后重新检查。" : `保存失败：${json.error ?? "unknown error"}`);
      return;
    }
    if (json.draftVersion) setDraftVersion(json.draftVersion);
    setMessage("导航草稿已保存。进入发布历史发布全站快照后，线上导航才会更新。");
    router.refresh();
  }

  function resetToPublished() {
    setHeaderLinks(publishedSettings.navigation.headerLinks);
    setFooterLinks(publishedSettings.navigation.footerLinks);
    setMessage("导航草稿已恢复到线上发布版本。");
  }

  function exportNavigation() {
    const rows = [
      ...normalizeLinks(headerLinks).map((link, index) => ({
        group: "header",
        order: index + 1,
        label: link.label,
        href: link.href,
        menuGroup: "",
        type: inferLinkType(link.href)
      })),
      ...normalizeLinks(footerLinks).map((link, index) => ({
        group: "footer",
        order: index + 1,
        label: link.label,
        href: link.href,
        menuGroup: link.group ?? "",
        type: inferLinkType(link.href)
      }))
    ];
    downloadCsv(`${siteId}-navigation.csv`, rows, ["group", "order", "label", "href", "menuGroup", "type"]);
  }

  function update(index: number, patch: Partial<NavLink>) {
    updateActiveLinks((current) =>
      current.map((link, itemIndex) => (itemIndex === index ? { ...link, ...patch } : link))
    );
  }

  function remove(index: number) {
    updateActiveLinks((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addLink() {
    updateActiveLinks((current) => [...current, { label: "New link", href: "#" }]);
  }

  function publicationStateLabel() {
    if (hasUnsavedChanges) return "Unsaved changes";
    if (hasUnpublishedChanges) return "Draft saved";
    return "Live matches draft";
  }

  function publicationStatusLabel() {
    if (hasUnsavedChanges || hasUnpublishedChanges) return "Draft";
    return "Published";
  }

  return (
    <div className="grid gap-5">
      <WorkbenchMetricStrip
        items={[
          { label: "Header links", value: headerLinks.length },
          { label: "Footer links", value: footerLinks.length },
          { label: "Live header", value: publishedHeaderCount },
          { label: "Live footer", value: publishedFooterCount }
        ]}
      />

      <DesignWorkbenchLayout
        aside={
          <div className="grid gap-4">
            <WorkbenchSidebarCard eyebrow="publication" title="Publication">
              <div className="rounded-[16px] border border-[#edf2f7] bg-[#fbfcfe] px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ecfdf3] text-[#22c55e]">
                    <Save className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[#18212f]">
                      {publicationStateLabel()}
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-[#667085]">{message}</div>
                  </div>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Status</dt>
                  <dd>
                    <StatusPill
                      label={publicationStatusLabel()}
                      tone={hasUnsavedChanges || hasUnpublishedChanges ? "warn" : "good"}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Changes</dt>
                  <dd className="text-[#18212f]">
                    {hasUnsavedChanges ? saveStateLabel(true) : publicationStateLabel()}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Scope</dt>
                  <dd className="text-[#18212f]">Theme settings</dd>
                </div>
              </dl>
              <div className="mt-5 grid gap-2">
                <WorkbenchActionButton href={publishHref} label="Publish changes" primary />
                <WorkbenchActionButton href={liveHref} label="View live store" />
              </div>
            </WorkbenchSidebarCard>

            <WorkbenchSidebarCard eyebrow="navigation summary" title="Summary">
              <dl className="grid gap-3 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Total links</dt>
                  <dd className="text-[#18212f]">{headerLinks.length + footerLinks.length}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Header group</dt>
                  <dd className="text-[#18212f]">{headerLinks.length}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#667085]">Footer group</dt>
                  <dd className="text-[#18212f]">{footerLinks.length}</dd>
                </div>
              </dl>
              <div className="mt-4 space-y-2 text-[12px] leading-6 text-[#667085]">
                <p>Use header links for primary browsing and funnel entry.</p>
                <p>Footer links can be grouped into `product`, `company`, and `support` columns.</p>
                <p>Publishing writes navigation into the live theme snapshot.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="admin_btn inline-flex h-[34px] items-center gap-1" onClick={resetToPublished} type="button">
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                  恢复线上
                </button>
                <button className="admin_btn inline-flex h-[34px] items-center gap-1" onClick={exportNavigation} type="button">
                  <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                  导出导航
                </button>
              </div>
            </WorkbenchSidebarCard>
          </div>
        }
      >
        <WorkbenchTableShell>
          <div className="border-b border-[#edf2f7] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#98a2b3]">storefront navigation</div>
                <h3 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#18212f]">Navigation registry</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#667085]">
                  管理全站头部、底部和公开路由入口。保存草稿后仍需发布整站快照。
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <WorkbenchActionButton label="Add link" onClick={addLink} />
                <WorkbenchActionButton label="Restore live" onClick={resetToPublished} />
                <WorkbenchActionButton label="Export CSV" onClick={exportNavigation} />
                <WorkbenchActionButton label={saving ? "Saving..." : "Save navigation"} onClick={save} primary />
              </div>
            </div>
          </div>

          <div className="px-5 pt-4">
            <WorkbenchSectionTabs
              active={activeTab}
              items={[
                { key: "header", label: "Header links" },
                { key: "footer", label: "Footer links" }
              ]}
              onChange={(key) => setActiveTab(key as ActiveTab)}
            />
            <WorkbenchSearchRow
              actions={
                <div className="flex items-center gap-2">
                  <WorkbenchActionButton label="Add link" onClick={addLink} quiet />
                  <WorkbenchActionButton label="Restore live" onClick={resetToPublished} quiet />
                </div>
              }
              controls={<WorkbenchSearchInput onChange={setQuery} placeholder="Search links" value={query} />}
            />
          </div>

          <div className="px-5 pb-4">
            <div className="flex items-center gap-3 rounded-[16px] border border-[#edf2f7] bg-[#fbfcfe] px-4 py-4">
              <span className="inline-flex h-[24px] items-center rounded-full bg-[#f2f4f7] px-2.5 text-[11px] text-[#667085]">
                {activeTab === "header" ? "Primary" : "Utility"}
              </span>
              <span className="text-[14px] font-medium text-[#18212f]">
                {activeTab === "header" ? "Header navigation" : "Footer navigation"}
              </span>
              <span className="text-[12px] text-[#98a2b3]">
                {activeTab === "header"
                  ? "These links appear in the storefront header."
                  : "These links appear in the storefront footer and can be assigned to footer columns."}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[#667085]">
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">{filteredLinks.length} visible links</span>
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">{activeLinks.length} in current group</span>
              {activeTab === "footer" ? (
                <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">
                  grouped footer columns
                </span>
              ) : null}
            </div>
          </div>

          <WorkbenchTableHeader
            className={
              activeTab === "footer"
                ? "grid-cols-[44px_minmax(0,1.2fr)_140px_180px_minmax(0,1.15fr)_120px_84px]"
                : "grid-cols-[44px_minmax(0,1.4fr)_180px_minmax(0,1.3fr)_120px_84px]"
            }
            columns={
              activeTab === "footer"
                ? ["", "Label", "Footer column", "Type", "Target", "Status", "Actions"]
                : ["", "Label", "Type", "Target", "Status", "Actions"]
            }
          />

          <div className="grid">
            {filteredLinks.map(({ link, index: sourceIndex }) => {
              return (
              <WorkbenchTableRow
                className={
                  activeTab === "footer"
                    ? "grid-cols-[44px_minmax(0,1.2fr)_140px_180px_minmax(0,1.15fr)_120px_84px] items-center"
                    : "grid-cols-[44px_minmax(0,1.4fr)_180px_minmax(0,1.3fr)_120px_84px] items-center"
                }
                key={`${activeTab}:${sourceIndex}`}
              >
                <div className="flex items-center justify-center text-[#98a2b3]">
                  <GripVertical className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <input
                    className="w-full rounded-[10px] border border-[#d8e0ea] px-3 py-2 text-[13px] text-[#18212f] outline-none"
                    onChange={(event) => update(sourceIndex, { label: event.target.value })}
                    value={link.label}
                  />
                </div>
                {activeTab === "footer" ? (
                  <div>
                    <select
                      className="w-full rounded-[10px] border border-[#d8e0ea] bg-white px-3 py-2 text-[13px] text-[#18212f] outline-none"
                      onChange={(event) => update(sourceIndex, { group: event.target.value || undefined })}
                      value={link.group ?? ""}
                    >
                      <option value="">Unassigned</option>
                      <option value="product">Product</option>
                      <option value="company">Company</option>
                      <option value="support">Support</option>
                    </select>
                    <div className="mt-1 truncate text-[12px] text-[#98a2b3]">{footerGroupLabel(link.group)}</div>
                  </div>
                ) : null}
                <div className="text-[13px] text-[#475467]">{inferLinkType(link.href)}</div>
                <div className="min-w-0">
                  <input
                    className="w-full rounded-[10px] border border-[#d8e0ea] px-3 py-2 text-[13px] text-[#18212f] outline-none"
                    onChange={(event) => update(sourceIndex, { href: event.target.value })}
                    value={link.href}
                  />
                  <div className="mt-1 truncate text-[12px] text-[#98a2b3]">{sampleTarget(link.href)}</div>
                </div>
                <div>
                  <StatusPill
                    label={hasUnsavedChanges ? "Unsaved" : hasUnpublishedChanges ? "Draft" : "Live"}
                    tone={hasUnsavedChanges || hasUnpublishedChanges ? "warn" : "good"}
                  />
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#f0d5d5] text-[#d92d20]"
                    onClick={() => remove(sourceIndex)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </WorkbenchTableRow>
            );
            })}
          </div>

          {!filteredLinks.length ? (
            <div className="px-6 py-12 text-center text-[13px] text-[#98a2b3]">No links match the current filter.</div>
          ) : null}

          <div className="border-t border-[#edf2f7] px-5 py-4">
            <WorkbenchRowLink href={liveHref} label="Open live storefront" />
          </div>
        </WorkbenchTableShell>
      </DesignWorkbenchLayout>
    </div>
  );
}
