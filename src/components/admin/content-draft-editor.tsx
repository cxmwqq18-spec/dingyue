"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, RefreshCcw, Save, Search, Send } from "lucide-react";
import { FieldEditor, parseFieldValue } from "@/components/designer/field-editor-registry";
import { updatePageBlockSetting, updatePageSectionSetting } from "@/components/designer/designer-draft-operations";
import { clonePage, safeBlocks } from "@/components/designer/designer-theme-utils";
import { saveAllThemePageDrafts } from "@/components/designer/designer-theme-persistence";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";
import { blockLabel, getSectionSchema, readThemeFieldValue, resolveThemeBlockSchema, resolveThemeFieldSchema } from "@/lib/section-schema";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import { downloadCsv } from "@/components/admin/export-utils";
import type {
  CreativePack,
  MediaAsset,
  Product,
  Site,
  SiteAiApp,
  ThemeDraftMeta,
  ThemePage,
  ThemePageJson
} from "@/lib/types";

type PageDraftMap = Record<string, ThemePageJson>;
type PagePublishedMap = Record<string, ThemePageJson>;

function sectionTitle(page: ThemePage, sectionId: string) {
  const section = page.draftJson.sections[sectionId];
  const schema = section ? getSectionSchema(section.type) : undefined;
  return schema?.label ?? section?.type ?? sectionId;
}

export type ContentDraftEditorProps = {
  site: Site;
  editablePages: ThemePage[];
  allPages: ThemePage[];
  products: Product[];
  siteAiApps: SiteAiApp[];
  mediaAssets: MediaAsset[];
  creativePacks: CreativePack[];
  publicationCount: number;
  latestPublicationVersion?: number;
};

export function ContentDraftEditor({
  site,
  editablePages,
  allPages,
  products,
  siteAiApps,
  mediaAssets,
  creativePacks,
  publicationCount,
  latestPublicationVersion
}: ContentDraftEditorProps) {
  const router = useRouter();
  const draftSeed = useMemo<PageDraftMap>(
    () => Object.fromEntries(editablePages.map((page) => [page.id, clonePage(page.draftJson)])),
    [editablePages]
  );
  const publishedSeed = useMemo<PagePublishedMap>(
    () => Object.fromEntries(editablePages.map((page) => [page.id, clonePage(page.publishedJson)])),
    [editablePages]
  );
  const [drafts, setDrafts] = useState<PageDraftMap>(() =>
    draftSeed
  );
  const [publishedPages, setPublishedPages] = useState<PagePublishedMap>(() =>
    publishedSeed
  );
  const [draftVersions, setDraftVersions] = useState<Record<string, ThemeDraftMeta>>(
    () => Object.fromEntries(allPages.flatMap((page) => page.draftMeta ? [[page.id, page.draftMeta] as const] : []))
  );
  const [selectedPageId, setSelectedPageId] = useState(editablePages[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "live">("all");
  const [message, setMessage] = useState("内容页现在支持区块内容草稿编辑、保存、回滚和整站发布。");
  const [busy, setBusy] = useState<"save" | "publish" | "rollback" | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fieldOptions = useMemo(
    () => ({ pages: allPages, products, siteAiApps, mediaAssets, creativePacks }),
    [allPages, products, siteAiApps, mediaAssets, creativePacks]
  );

  const pageStates = useMemo(
    () =>
      editablePages.map((page) => {
        const pageDraft = drafts[page.id] ?? page.draftJson;
        const pagePublished = publishedPages[page.id] ?? page.publishedJson;
        const dirty = JSON.stringify(pageDraft) !== JSON.stringify(pagePublished);
        return { page, pageDraft, pagePublished, dirty };
      }),
    [drafts, editablePages, publishedPages]
  );
  const editablePageIds = useMemo(() => new Set(editablePages.map((page) => page.id)), [editablePages]);
  const allPageStates = useMemo(() => {
    const editableStateById = new Map(pageStates.map((item) => [item.page.id, item]));
    return allPages.map((page) => {
      const editableState = editableStateById.get(page.id);
      const pageDraft = editableState?.pageDraft ?? page.draftJson;
      const pagePublished = editableState?.pagePublished ?? page.publishedJson;
      const dirty = JSON.stringify(pageDraft) !== JSON.stringify(pagePublished);
      return { page, pageDraft, pagePublished, dirty, editable: editablePageIds.has(page.id) };
    });
  }, [allPages, editablePageIds, pageStates]);
  const globalSettingsDirty = useMemo(
    () => JSON.stringify(site.themeSettings.draftJson) !== JSON.stringify(site.themeSettings.publishedJson),
    [site.themeSettings.draftJson, site.themeSettings.publishedJson]
  );

  const filteredPages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return pageStates.filter(({ page, dirty }) => {
      if (statusFilter === "draft" && !dirty) return false;
      if (statusFilter === "live" && dirty) return false;
      if (!normalized) return true;
      return [page.title, page.slug, page.pageType, page.templateKey ?? ""].join(" ").toLowerCase().includes(normalized);
    });
  }, [pageStates, query, statusFilter]);

  const selectedPageState =
    filteredPages.find(({ page }) => page.id === selectedPageId) ??
    pageStates.find(({ page }) => page.id === selectedPageId) ??
    filteredPages[0] ??
    pageStates[0];
  const selectedPage = selectedPageState?.page;
  const draft = selectedPageState?.pageDraft;
  const dirtyCount = pageStates.filter((item) => item.dirty).length;
  const wholeSiteDirtyCount = allPageStates.filter((item) => item.dirty).length + (globalSettingsDirty ? 1 : 0);
  const hiddenDraftCount = allPageStates.filter((item) => item.dirty && !item.editable).length + (globalSettingsDirty ? 1 : 0);
  const safePage = clampPage(page, filteredPages.length, pageSize);
  const visiblePages = pageItems(filteredPages, safePage, pageSize);

  useEffect(() => {
    setDrafts(draftSeed);
  }, [draftSeed]);

  useEffect(() => {
    setPublishedPages(publishedSeed);
  }, [publishedSeed]);

  useEffect(() => {
    setDraftVersions(Object.fromEntries(allPages.flatMap((page) => page.draftMeta ? [[page.id, page.draftMeta] as const] : [])));
  }, [allPages]);

  useEffect(() => {
    if (!editablePages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(editablePages[0]?.id ?? "");
    }
  }, [editablePages, selectedPageId]);

  useEffect(() => {
    setPage((current) => clampPage(current, filteredPages.length, pageSize));
  }, [filteredPages.length, pageSize]);

  useEffect(() => {
    setPublishConfirmOpen(false);
  }, [hiddenDraftCount, selectedPageId, wholeSiteDirtyCount]);

  function setDraft(pageId: string, next: ThemePageJson) {
    setPublishConfirmOpen(false);
    setDrafts((current) => ({
      ...current,
      [pageId]: next
    }));
  }

  function currentDraftVersions(): Record<string, ThemeDraftMeta | undefined> {
    return Object.fromEntries(allPages.map((page) => [page.id, draftVersions[page.id] ?? page.draftMeta]));
  }

  function editableDraftPayload() {
    const currentVersions = currentDraftVersions();
    return editablePages.map((page) => ({
      pageId: page.id,
      draftJson: drafts[page.id] ?? page.draftJson,
      expected: currentVersions[page.id]
    }));
  }

  function editSectionSetting(sectionId: string, fieldId: string, value: string) {
    if (!selectedPage || !draft) return;
    const section = draft.sections[sectionId];
    if (!section) return;
    const schema = getSectionSchema(section.type);
    const field = resolveThemeFieldSchema(schema.settings, fieldId);
    if (!field) return;
    const parsed = parseFieldValue(field, value);
    const next = updatePageSectionSetting(draft, sectionId, field.id, parsed);
    if (!next) return;
    setDraft(selectedPage.id, next);
  }

  function editBlockSetting(sectionId: string, blockId: string, fieldId: string, value: string) {
    if (!selectedPage || !draft) return;
    const section = draft.sections[sectionId];
    if (!section) return;
    const schema = getSectionSchema(section.type);
    const block = safeBlocks(section).find((item) => item.id === blockId);
    const blockSchema = resolveThemeBlockSchema(schema, block?.type);
    const field = resolveThemeFieldSchema(blockSchema?.settings, fieldId);
    if (!field) return;
    const parsed = parseFieldValue(field, value);
    const next = updatePageBlockSetting(draft, sectionId, blockId, field.id, parsed);
    if (!next) return;
    setDraft(selectedPage.id, next);
  }

  async function saveEditableDrafts() {
    if (!selectedPage || !draft) return;
    setBusy("save");
    const result = await saveAllThemePageDrafts(site.id, editableDraftPayload());
    setBusy(null);
    if (Object.keys(result.draftVersions).length) {
      setDraftVersions((current) => ({ ...current, ...result.draftVersions }));
    }
    if (!result.ok) {
      setMessage(result.errors.some((item) => item.status === 409) ? "保存被拦截：内容页草稿版本已变化，请刷新后重新检查。" : "保存失败：内容草稿未能全部写入。");
      return;
    }
    return result;
  }

  async function save() {
    const result = await saveEditableDrafts();
    if (!result?.ok) return;
    setMessage(`内容草稿已保存，${editablePages.length} 个内容页已写入草稿区。线上内容仍保持不变，直到发布整站快照。`);
    router.refresh();
  }

  function requestPublish() {
    if (!selectedPage || !draft) return;
    setPublishConfirmOpen(true);
  }

  async function publish() {
    if (!selectedPage || !draft) return;
    setBusy("publish");
    const saved = await saveAllThemePageDrafts(site.id, editableDraftPayload());
    if (Object.keys(saved.draftVersions).length) {
      setDraftVersions((current) => ({ ...current, ...saved.draftVersions }));
    }
    if (!saved.ok) {
      setBusy(null);
      setMessage(saved.errors.some((item) => item.status === 409) ? "发布前保存被拦截：内容页草稿版本已变化，请刷新后重新检查。" : "发布失败：内容草稿保存未完成。");
      return;
    }
    const nextDraftVersions = { ...currentDraftVersions(), ...saved.draftVersions };
    const response = await fetch(`/api/sites/${site.id}/theme/pages/${selectedPage.id}/publish`, {
      method: "POST",
      headers: siteAdminJsonHeaders(site.id),
      body: JSON.stringify({
        actor: "site_admin_demo",
        expectedPageVersions: Object.fromEntries(
          Object.entries(nextDraftVersions)
            .filter((entry): entry is [string, ThemeDraftMeta] => Boolean(entry[1]))
            .map(([pageId, version]) => [pageId, { revision: version.revision, etag: version.etag }])
        ),
        expectedSettingsVersion: site.themeSettings.draftMeta
          ? { revision: site.themeSettings.draftMeta.revision, etag: site.themeSettings.draftMeta.etag }
          : undefined,
        expectedPublishedVersion: currentPublishedVersion
      })
    });
    const result = (await response.json().catch(() => ({}))) as {
      publishedVersion?: number;
      pageDraftVersions?: Record<string, ThemeDraftMeta>;
      error?: string;
    };
    setBusy(null);
    if (!response.ok) {
      setMessage(
        response.status === 409 && result.error === "theme_publish_global_visual_changes_unacknowledged"
          ? "发布已拦截：当前草稿包含全局视觉变化，请到发布历史页查看具体变化并勾选确认后再发布。"
          : response.status === 409
            ? `发布已拦截：${result.error ?? "版本已变化，请刷新后重新检查。"}`
            : `发布失败：${result.error ?? "unknown error"}`
      );
      return;
    }
    if (result.pageDraftVersions) setDraftVersions(result.pageDraftVersions);
    const nextVersion = result.publishedVersion ?? selectedPageState?.pageDraft.version ?? 1;
    setPublishedPages(
      Object.fromEntries(
        editablePages.map((page) => {
          const nextPage = clonePage(drafts[page.id] ?? page.draftJson);
          nextPage.version = nextVersion;
          return [page.id, nextPage];
        })
      )
    );
    setDrafts((current) =>
      Object.fromEntries(
        editablePages.map((page) => {
          const nextPage = clonePage(current[page.id] ?? page.draftJson);
          nextPage.version = nextVersion;
          return [page.id, nextPage];
        })
      )
    );
    setMessage(`${selectedPage.title} 已通过整站发布流上线，当前快照版本 v${result.publishedVersion ?? ""}，所有内容页草稿状态已同步。`);
    setPublishConfirmOpen(false);
    router.refresh();
  }

  async function rollback() {
    if (!selectedPage) return;
    setBusy("rollback");
    const response = await fetch(`/api/sites/${site.id}/theme/pages/${selectedPage.id}/rollback`, {
      method: "POST",
      headers: siteAdminJsonHeaders(site.id)
    });
    const result = (await response.json().catch(() => ({}))) as { draftVersion?: ThemeDraftMeta; error?: string };
    setBusy(null);
    if (!response.ok) {
      setMessage(`回滚失败：${result.error ?? "unknown error"}`);
      return;
    }
    if (result.draftVersion) {
      const draftVersion = result.draftVersion;
      setDraftVersions((current) => ({ ...current, [selectedPage.id]: draftVersion }));
    }
    setDraft(selectedPage.id, clonePage(selectedPageState?.pagePublished ?? selectedPage.publishedJson));
    setMessage(`${selectedPage.title} 草稿已恢复到线上版本。`);
    router.refresh();
  }

  function exportPageInventory() {
    downloadCsv(
      `${site.slug}-content-pages.csv`,
      pageStates.map(({ page, pageDraft, dirty }) => ({
        pageId: page.id,
        title: page.title,
        slug: page.slug,
        pageType: page.pageType,
        templateKey: page.templateKey ?? "",
        sectionCount: pageDraft.sectionsOrder.length,
        draftStatus: dirty ? "draft" : "live"
      })),
      ["pageId", "title", "slug", "pageType", "templateKey", "sectionCount", "draftStatus"]
    );
    setMessage(`已导出 ${pageStates.length} 条内容页记录。`);
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setPage(1);
  }

  function updatePageSize(nextPageSize: number) {
    setPageSize(nextPageSize);
    setPage(1);
  }

  if (!selectedPage || !draft) {
    return (
      <div className="right_box border border-[#eee] bg-white p-5 text-sm text-[#666]">
        当前没有可编辑的内容页。
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(selectedPageState?.pagePublished ?? selectedPage.publishedJson);
  const currentPublishedVersion = Math.max(1, ...allPages.map((page) => page.publishedJson.version ?? 0));

  return (
    <div className="grid gap-5">
      <div className="right_box border border-[#eee] bg-white p-3">
        <div className="xt_tt">
          <span>内容草稿编辑器</span>
          <div className="clear" />
        </div>
        <div className="search mt-3 border border-[#f1f1f1] bg-[#fafafa] px-3 py-1">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={dirty ? "tag_org" : "tag_green"}>{dirty ? "当前页草稿有修改" : "当前页与线上一致"}</span>
              <span className="tag_gray">内容待发布 {dirtyCount}</span>
              <span className={wholeSiteDirtyCount ? "tag_org" : "tag_green"}>整站待发布 {wholeSiteDirtyCount}</span>
              <span className={hiddenDraftCount ? "tag_org" : "tag_green"}>全局/非内容草稿 {hiddenDraftCount}</span>
              <span className="min-w-0 break-words text-[12px] text-[#666]">{message}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap" href={`/site/${site.slug}/admin/design/workbench?pageId=${encodeURIComponent(selectedPage.id)}`} prefetch={false}>
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                全站检查
              </Link>
              <button className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55" disabled={busy !== null} onClick={rollback} type="button">
                <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                {busy === "rollback" ? "回滚中" : "恢复草稿"}
              </button>
              <button className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55" disabled={busy !== null} onClick={save} type="button">
                <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                {busy === "save" ? "保存中" : "保存草稿"}
              </button>
              <button className="input_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55" disabled={busy !== null} onClick={requestPublish} type="button">
                <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
                {busy === "publish" ? "发布中" : "发布整站"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="right_box border border-[#eee] bg-white p-3">
          <div className="xt_tt">
            <span>内容页</span>
            <div className="clear" />
          </div>
          <div className="search mt-3 border border-[#f1f1f1] bg-[#fafafa] px-3 py-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-[#999]" strokeWidth={1.8} />
                <input className="inputtext w-full" onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、slug、pageType" value={query} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className="selectmini min-w-[120px]" onChange={(event) => setStatusFilter(event.target.value as "all" | "draft" | "live")} value={statusFilter}>
                  <option value="all">全部状态</option>
                  <option value="draft">仅草稿</option>
                  <option value="live">仅线上一致</option>
                </select>
                <button className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap" onClick={resetFilters} type="button">
                  重置
                </button>
                <button className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap" onClick={exportPageInventory} type="button">
                  <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                  导出页面
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-[12px] text-[#666]">
                <span className="tag_gray">可见 {filteredPages.length}</span>
                <span className="tag_gray">草稿页 {dirtyCount}</span>
                <span className={hiddenDraftCount ? "tag_org" : "tag_green"}>发布检查 {hiddenDraftCount ? "需确认" : "通过"}</span>
                <span className="tag_gray">内容页 {editablePages.length}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {visiblePages.map(({ page, pageDraft, dirty: pageDirty }) => {
              const selected = page.id === selectedPageId;
              return (
                <button
                  className={`border px-3 py-3 text-left ${selected ? "border-[#479dff] bg-[#fbfdff]" : "border-[#eee] bg-white hover:border-[#d5dae1]"}`}
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-[#333]">{page.title}</span>
                    <span className={pageDirty ? "tag_org" : "tag_green"}>{pageDirty ? "草稿待发布" : "线上一致"}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[#999]">{page.slug}</p>
                  <p className="mt-1 text-[12px] text-[#666]">{pageDraft.sectionsOrder.length} 个区块</p>
                </button>
              );
            })}
            {!filteredPages.length ? <div className="px-3 py-6 text-center text-[12px] text-[#999]">当前筛选下没有内容页。</div> : null}
          </div>
          {filteredPages.length > 10 ? (
            <AdminPagination onPageChange={setPage} onPageSizeChange={updatePageSize} page={safePage} pageSize={pageSize} total={filteredPages.length} />
          ) : null}
        </div>

        <div className="grid gap-5">
          {draft.sectionsOrder.map((sectionId) => {
            const section = draft.sections[sectionId];
            if (!section) return null;
            const schema = getSectionSchema(section.type);
            const blocks = safeBlocks(section);
            return (
              <div className="right_box border border-[#eee] bg-white p-3" key={sectionId}>
                <div className="xt_tt">
                  <span>{sectionTitle(selectedPage, sectionId)}</span>
                  <em className="ml-2 not-italic font-mono text-[10px] text-[#999]">{section.type}</em>
                  <div className="clear" />
                </div>
                {schema.description ? <div className="tixing mt-3">{schema.description}</div> : null}
                <div className="mt-4 grid gap-4">
                  {schema.settings.map((field) => (
                    <FieldEditor
                      field={field}
                      key={`${sectionId}:${field.id}`}
                      onChange={(value) => editSectionSetting(sectionId, field.id, value)}
                      options={fieldOptions}
                      site={site}
                      value={readThemeFieldValue(section.settings, field)}
                    />
                  ))}
                </div>

                {blocks.length ? (
                  <div className="mt-5 grid gap-4">
                    {blocks.map((block, blockIndex) => {
                      const blockSchema = resolveThemeBlockSchema(schema, block.type);
                      if (!blockSchema) return null;
                      return (
                        <div className="rounded-[6px] border border-[#e6eaf0] bg-[#fafafa] p-4" key={block.id}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <span className="font-medium text-[#333]">{blockLabel(blockSchema, block, blockIndex)}</span>
                            <span className="font-mono text-[10px] text-[#999]">{block.type}</span>
                          </div>
                          <div className="grid gap-4">
                            {blockSchema.settings.map((field) => (
                              <FieldEditor
                                field={field}
                                key={`${sectionId}:${block.id}:${field.id}`}
                                onChange={(value) => editBlockSetting(sectionId, block.id, field.id, value)}
                                options={fieldOptions}
                                site={site}
                                value={readThemeFieldValue(block.settings, field)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {publishConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-[720px] rounded-[12px] border border-[#d9dde4] bg-white shadow-[0_28px_70px_-28px_rgba(15,23,42,0.45)]">
            <div className="border-b border-[#eef0f4] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#667085]">确认发布</p>
                  <h2 className="mt-1 text-[18px] font-semibold text-[#222]">发布整站内容快照</h2>
                </div>
                <button className="admin_btn h-[30px] px-3" disabled={busy !== null} onClick={() => setPublishConfirmOpen(false)} type="button">
                  取消
                </button>
              </div>
            </div>
            <div className="grid gap-4 px-5 py-4">
              <p className="text-[13px] leading-6 text-[#667085]">
                当前入口只编辑内容页，但发布动作会覆盖整站 published snapshot。确认前请检查隐藏草稿和全局设置范围。
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[8px] border border-[#eef0f4] bg-[#fafafa] p-4">
                  <p className="text-[12px] font-medium text-[#667085]">发布范围</p>
                  <div className="mt-3 grid gap-2 text-[13px] text-[#333]">
                    <div className="flex justify-between gap-3"><span>当前内容页</span><strong>{selectedPage.title}</strong></div>
                    <div className="flex justify-between gap-3"><span>内容待发布</span><strong>{dirtyCount}</strong></div>
                    <div className="flex justify-between gap-3"><span>整站待发布</span><strong>{wholeSiteDirtyCount}</strong></div>
                    <div className="flex justify-between gap-3"><span>隐藏草稿</span><strong>{hiddenDraftCount}</strong></div>
                    <div className="flex justify-between gap-3"><span>全局设置</span><strong>{globalSettingsDirty ? "有变更" : "无变更"}</strong></div>
                  </div>
                </div>
                <div className="rounded-[8px] border border-[#eef0f4] bg-[#fafafa] p-4">
                  <p className="text-[12px] font-medium text-[#667085]">版本确认</p>
                  <div className="mt-3 grid gap-2 text-[13px] text-[#333]">
                    <div className="flex justify-between gap-3"><span>当前线上版本</span><strong>v{currentPublishedVersion}</strong></div>
                    <div className="flex justify-between gap-3"><span>最近发布版本</span><strong>v{latestPublicationVersion ?? currentPublishedVersion}</strong></div>
                    <div className="flex justify-between gap-3"><span>发布记录</span><strong>{publicationCount}</strong></div>
                    <div className="flex justify-between gap-3"><span>当前页草稿版本</span><strong>v{draftVersions[selectedPage.id]?.revision ?? selectedPage.draftMeta?.revision ?? 1}</strong></div>
                    <div className="flex justify-between gap-3"><span>主题设置草稿版本</span><strong>v{site.themeSettings.draftMeta?.revision ?? 1}</strong></div>
                  </div>
                </div>
              </div>
              <div className="rounded-[8px] border border-[#f7d794] bg-[#fff8e8] px-4 py-3 text-[13px] leading-6 text-[#8a5a00]">
                确认后会先保存当前可编辑内容页，再用页面版本、主题设置版本和线上版本做一次发布校验；若任一版本变化，会阻止发布。
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[#eef0f4] px-5 py-4">
              <button className="admin_btn h-[34px] px-4" disabled={busy !== null} onClick={() => setPublishConfirmOpen(false)} type="button">
                返回检查
              </button>
              <button className="input_btn h-[34px] px-4 disabled:cursor-not-allowed disabled:opacity-55" disabled={busy !== null} onClick={() => void publish()} type="button">
                {busy === "publish" ? "发布中" : "确认发布整站"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
