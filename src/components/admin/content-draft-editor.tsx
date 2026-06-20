"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCcw, Save, Search, Send } from "lucide-react";
import { FieldEditor, parseFieldValue } from "@/components/designer/field-editor-registry";
import { updatePageBlockSetting, updatePageSectionSetting } from "@/components/designer/designer-draft-operations";
import { clonePage, safeBlocks } from "@/components/designer/designer-theme-utils";
import { saveAllThemePageDrafts } from "@/components/designer/designer-theme-persistence";
import { blockLabel, getSectionSchema } from "@/lib/section-schema";
import { downloadCsv } from "@/components/admin/export-utils";
import type {
  CreativePack,
  MediaAsset,
  Product,
  Site,
  SiteAiApp,
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

export function ContentDraftEditor({
  site,
  editablePages,
  allPages,
  products,
  siteAiApps,
  mediaAssets,
  creativePacks
}: {
  site: Site;
  editablePages: ThemePage[];
  allPages: ThemePage[];
  products: Product[];
  siteAiApps: SiteAiApp[];
  mediaAssets: MediaAsset[];
  creativePacks: CreativePack[];
}) {
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
  const [selectedPageId, setSelectedPageId] = useState(editablePages[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "live">("all");
  const [message, setMessage] = useState("内容页现在支持 section 内容草稿编辑、保存、回滚和整站发布。");
  const [busy, setBusy] = useState<"save" | "publish" | "rollback" | null>(null);
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

  useEffect(() => {
    setDrafts(draftSeed);
  }, [draftSeed]);

  useEffect(() => {
    setPublishedPages(publishedSeed);
  }, [publishedSeed]);

  useEffect(() => {
    if (!editablePages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(editablePages[0]?.id ?? "");
    }
  }, [editablePages, selectedPageId]);

  function setDraft(pageId: string, next: ThemePageJson) {
    setDrafts((current) => ({
      ...current,
      [pageId]: next
    }));
  }

  function editSectionSetting(sectionId: string, fieldId: string, value: string) {
    if (!selectedPage || !draft) return;
    const section = draft.sections[sectionId];
    if (!section) return;
    const schema = getSectionSchema(section.type);
    const field = schema.settings.find((item) => item.id === fieldId);
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
    const blockSchema = schema.blocks?.find((item) => item.type === block?.type);
    const field = blockSchema?.settings.find((item) => item.id === fieldId);
    if (!field) return;
    const parsed = parseFieldValue(field, value);
    const next = updatePageBlockSetting(draft, sectionId, blockId, field.id, parsed);
    if (!next) return;
    setDraft(selectedPage.id, next);
  }

  async function save() {
    if (!selectedPage || !draft) return;
    setBusy("save");
    const ok = await saveAllThemePageDrafts(
      site.id,
      editablePages.map((page) => ({
        pageId: page.id,
        draftJson: drafts[page.id] ?? page.draftJson
      }))
    );
    setBusy(null);
    if (!ok) {
      setMessage("保存失败：内容草稿未能全部写入。");
      return;
    }
    setMessage(`内容草稿已保存，${editablePages.length} 个内容页已写入草稿区。线上内容仍保持不变，直到发布整站快照。`);
    router.refresh();
  }

  async function publish() {
    if (!selectedPage || !draft) return;
    setBusy("publish");
    const saved = await saveAllThemePageDrafts(
      site.id,
      editablePages.map((page) => ({
        pageId: page.id,
        draftJson: drafts[page.id] ?? page.draftJson
      }))
    );
    if (!saved) {
      setBusy(null);
      setMessage("发布失败：内容草稿保存未完成。");
      return;
    }
    const response = await fetch(`/api/sites/${site.id}/theme/pages/${selectedPage.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const result = (await response.json().catch(() => ({}))) as { publishedVersion?: number; error?: string };
    setBusy(null);
    if (!response.ok) {
      setMessage(`发布失败：${result.error ?? "unknown error"}`);
      return;
    }
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
    router.refresh();
  }

  async function rollback() {
    if (!selectedPage) return;
    setBusy("rollback");
    const response = await fetch(`/api/sites/${site.id}/theme/pages/${selectedPage.id}/rollback`, {
      method: "POST"
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setMessage(`回滚失败：${result.error ?? "unknown error"}`);
      return;
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
  }

  if (!selectedPage || !draft) {
    return (
      <div className="right_box border border-[#eee] bg-white p-5 text-sm text-[#666]">
        当前没有可编辑的内容页。
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(selectedPageState?.pagePublished ?? selectedPage.publishedJson);

  return (
    <div className="grid gap-5">
      <div className="right_box border border-[#eee] bg-white p-3">
        <div className="xt_tt">
          <span>内容草稿编辑器</span>
          <div className="clear" />
        </div>
        <div className="search mt-3 border border-[#f1f1f1] bg-[#fafafa] px-3 py-1">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className={dirty ? "tag_org" : "tag_green"}>{dirty ? "当前页草稿有修改" : "当前页与线上一致"}</span>
              <span className="tag_gray">内容脏页 {dirtyCount}</span>
              <span className="text-[12px] text-[#666]">{message}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="admin_btn inline-flex h-[30px] items-center gap-1 disabled:cursor-not-allowed disabled:opacity-55" disabled={busy !== null} onClick={rollback} type="button">
                <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                {busy === "rollback" ? "回滚中" : "恢复草稿"}
              </button>
              <button className="admin_btn inline-flex h-[30px] items-center gap-1 disabled:cursor-not-allowed disabled:opacity-55" disabled={busy !== null} onClick={save} type="button">
                <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                {busy === "save" ? "保存中" : "保存草稿"}
              </button>
              <button className="input_btn inline-flex h-[30px] items-center gap-1 disabled:cursor-not-allowed disabled:opacity-55" disabled={busy !== null} onClick={publish} type="button">
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
                <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={resetFilters} type="button">
                  重置
                </button>
                <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={exportPageInventory} type="button">
                  <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                  导出页面
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-[12px] text-[#666]">
                <span className="tag_gray">可见 {filteredPages.length}</span>
                <span className="tag_gray">草稿页 {dirtyCount}</span>
                <span className="tag_gray">内容页 {editablePages.length}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {filteredPages.map(({ page, pageDraft, dirty: pageDirty }) => {
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
                    <span className={pageDirty ? "tag_org" : "tag_green"}>{pageDirty ? "draft" : "live"}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[#999]">{page.slug}</p>
                  <p className="mt-1 text-[12px] text-[#666]">{pageDraft.sectionsOrder.length} sections</p>
                </button>
              );
            })}
            {!filteredPages.length ? <div className="px-3 py-6 text-center text-[12px] text-[#999]">当前筛选下没有内容页。</div> : null}
          </div>
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
                      value={section.settings[field.id]}
                    />
                  ))}
                </div>

                {blocks.length ? (
                  <div className="mt-5 grid gap-4">
                    {blocks.map((block, blockIndex) => {
                      const blockSchema = schema.blocks?.find((item) => item.type === block.type);
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
                                value={block.settings[field.id]}
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
    </div>
  );
}
