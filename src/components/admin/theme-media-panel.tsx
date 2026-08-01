"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, ImageIcon, PencilLine, Plus, RefreshCcw, Save, Search, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { downloadCsv } from "@/components/admin/export-utils";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import { fallbackImageForSeed, resolveMediaAssetUrl } from "@/lib/media";
import type { MediaAsset, Site } from "@/lib/types";

type UsageFilter = "all" | MediaAsset["usage"];
type SourceFilter = "all" | NonNullable<MediaAsset["sourceType"]>;

const usageTabs: Array<{ value: UsageFilter; label: string }> = [
  { value: "all", label: "资源列表" },
  { value: "theme", label: "装修素材" },
  { value: "pack_cover", label: "套餐封面" },
  { value: "policy", label: "政策页" },
  { value: "brand", label: "品牌资产" }
];

const usageOptions: MediaAsset["usage"][] = ["theme", "pack_cover", "policy", "brand"];
const sourceOptions: NonNullable<MediaAsset["sourceType"]>[] = ["site_upload", "external_url", "theme_seed", "manual"];

function emptyAsset(siteId: string): MediaAsset {
  const createdAt = new Date().toISOString();
  return {
    id: "",
    siteId,
    label: "",
    storageKey: `sites/${siteId}/theme/`,
    mimeType: "image/webp",
    usage: "theme",
    sourceType: "manual",
    previewUrl: "",
    originUrl: "",
    altText: "",
    notes: "",
    createdAt
  };
}

function previewFor(site: Site, asset: MediaAsset) {
  if (!asset.id && !asset.previewUrl && !asset.originUrl) return "";
  return asset.previewUrl || asset.originUrl || resolveMediaAssetUrl(site, asset.id || asset.storageKey) || fallbackImageForSeed(`${site.slug}-${asset.label || asset.storageKey}`);
}

function cloneAsset(asset: MediaAsset): MediaAsset {
  return JSON.parse(JSON.stringify(asset)) as MediaAsset;
}

export function ThemeMediaPanel({
  site,
  media,
  initialTotal,
  usageCounts,
  sourceCounts,
  compact = false
}: {
  site: Site;
  media: MediaAsset[];
  initialTotal?: number;
  usageCounts?: Record<string, number>;
  sourceCounts?: Record<string, number>;
  compact?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(media);
  const [total, setTotal] = useState(initialTotal ?? media.length);
  const [hasMore, setHasMore] = useState((initialTotal ?? media.length) > media.length);
  const [draft, setDraft] = useState<MediaAsset>(emptyAsset(site.id));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<MediaAsset | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UsageFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [message, setMessage] = useState("Theme media is separated from customer private uploads and feeds the designer resource selector.");
  const [submitting, setSubmitting] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [watermarking, setWatermarking] = useState(false);
  const didMountFilters = useRef(false);
  const editing = Boolean(editingId);

  useEffect(() => {
    setItems(media);
    setTotal(initialTotal ?? media.length);
    setHasMore((initialTotal ?? media.length) > media.length);
  }, [initialTotal, media]);

  async function loadMediaPage(params: { append?: boolean; resetOffset?: boolean } = {}) {
    setLoadingPage(true);
    try {
      const append = Boolean(params.append);
      const offset = append && !params.resetOffset ? items.length : 0;
      const searchParams = new URLSearchParams({
        limit: "40",
        offset: String(offset)
      });
      if (filter !== "all") searchParams.set("usage", filter);
      if (sourceFilter !== "all") searchParams.set("source", sourceFilter);
      if (query.trim()) searchParams.set("q", query.trim());
      const response = await fetch(`/api/sites/${site.id}/media-assets?${searchParams.toString()}`);
      const result = (await response.json().catch(() => ({}))) as {
        assets?: MediaAsset[];
        pageInfo?: { total?: number; hasMore?: boolean };
        error?: string;
      };
      if (!response.ok || !result.assets) {
        setMessage(result.error ?? "加载素材失败。");
        return;
      }
      setItems((current) => (append ? [...current, ...result.assets!] : result.assets!));
      setTotal(result.pageInfo?.total ?? result.assets.length);
      setHasMore(Boolean(result.pageInfo?.hasMore));
    } finally {
      setLoadingPage(false);
    }
  }

  const filtered = useMemo(() => {
    return items.filter((asset) => {
      const matchesFilter = filter === "all" ? true : asset.usage === filter;
      const matchesSource = sourceFilter === "all" ? true : (asset.sourceType ?? "manual") === sourceFilter;
      const haystack = `${asset.label} ${asset.storageKey} ${asset.mimeType} ${asset.usage} ${asset.previewUrl ?? ""} ${asset.originUrl ?? ""} ${asset.altText ?? ""}`.toLowerCase();
      const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
      return matchesFilter && matchesSource && matchesQuery;
    });
  }, [filter, items, query, sourceFilter]);

  useEffect(() => {
    if (!didMountFilters.current) {
      didMountFilters.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      void loadMediaPage({ resetOffset: true });
    }, 180);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sourceFilter, query]);

  function beginEditing(asset: MediaAsset) {
    setEditingId(asset.id);
    setEditingDraft(cloneAsset(asset));
    setMessage(`正在编辑 ${asset.label}。保存后会写回当前站点素材库。`);
  }

  function updateForm<K extends keyof MediaAsset>(key: K, value: MediaAsset[K]) {
    if (editingId) {
      setEditingDraft((current) => (current ? { ...current, [key]: value } : current));
      return;
    }
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(asset: MediaAsset, mode: "create" | "update") {
    setSubmitting(true);
    try {
      const endpoint = mode === "create" ? `/api/sites/${site.id}/media-assets` : `/api/sites/${site.id}/media-assets/${asset.id}`;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset)
      });
      const result = (await response.json().catch(() => ({}))) as { asset?: MediaAsset; error?: string };
      if (!response.ok || !result.asset) {
        setMessage(result.error ?? `${mode === "create" ? "Create" : "Save"} failed.`);
        return;
      }
      if (mode === "create") {
        setItems((current) => [result.asset!, ...current]);
        setTotal((current) => current + 1);
        setDraft(emptyAsset(site.id));
        setMessage(`${result.asset.label} created in site media library.`);
      } else {
        setItems((current) => current.map((item) => (item.id === result.asset?.id ? result.asset : item)));
        setMessage(`${result.asset.label} updated.`);
      }
      setEditingId(null);
      setEditingDraft(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(asset: MediaAsset) {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/sites/${site.id}/media-assets/${asset.id}`, { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Delete failed.");
        return;
      }
      setItems((current) => current.filter((item) => item.id !== asset.id));
      setTotal((current) => Math.max(0, current - 1));
      if (editingId === asset.id) {
        setEditingId(null);
        setEditingDraft(null);
      }
      setMessage(`${asset.label} removed from site media.`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function resetFilters() {
    setFilter("all");
    setSourceFilter("all");
    setQuery("");
  }

  function exportAssets() {
    downloadCsv(
      `${site.slug}-site-media.csv`,
      filtered.map((asset) => ({
        assetId: asset.id,
        label: asset.label,
        usage: asset.usage,
        sourceType: asset.sourceType ?? "manual",
        mimeType: asset.mimeType,
        storageKey: asset.storageKey,
        previewUrl: asset.previewUrl ?? "",
        originUrl: asset.originUrl ?? "",
        altText: asset.altText ?? "",
        notes: asset.notes ?? "",
        createdAt: asset.createdAt
      })),
      ["assetId", "label", "usage", "sourceType", "mimeType", "storageKey", "previewUrl", "originUrl", "altText", "notes", "createdAt"]
    );
    setMessage(`已导出 ${filtered.length} 条站点素材记录。`);
  }

  async function refreshPublicWatermarks() {
    setWatermarking(true);
    setMessage("正在刷新当前站点公共展示素材水印，客户上传和用户生成结果不会被处理。");
    try {
      const response = await fetch(`/api/sites/${site.id}/admin/media-watermark`, {
        method: "POST",
        headers: siteAdminJsonHeaders(site.id),
        body: JSON.stringify({ dryRun: false })
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        discovered?: number;
        processed?: number;
        changed?: number;
        skipped?: number;
        failures?: Array<{ filePath: string; error: string }>;
        text?: string;
      };
      if (!response.ok && !result.processed) {
        setMessage(`展示水印刷新失败：${result.error ?? "unknown error"}`);
        return;
      }
      const failures = result.failures?.length ?? 0;
      setMessage(
        `展示水印刷新完成：${result.text ?? "site domain"}，发现 ${result.discovered ?? 0} 个，处理 ${result.processed ?? 0} 个，更新 ${result.changed ?? 0} 个，跳过 ${result.skipped ?? 0} 个，失败 ${failures} 个。`
      );
      router.refresh();
    } finally {
      setWatermarking(false);
    }
  }

  const activeAsset = editingId ? editingDraft ?? draft : draft;
  const activePreviewUrl = previewFor(site, activeAsset);

  return (
    <div className="mt-5 grid gap-3" data-admin-media="saas-source-library">
      <div className="sr-only" aria-hidden="true">
        <span>SaaS media library</span>
        <span>Theme media library</span>
        <span data-admin-media-grid="saas-source-cards">legacy media grid contract</span>
      </div>
      <div className="right_box border border-[#eee] bg-white p-3">
        <div className="xt_tt">
          <span>站点素材库</span>
          <em className="ml-2 not-italic font-mono text-[10px] text-[#999]">sources manager</em>
          <div className="clear" />
        </div>
        <div className="tixing mt-3">{message}</div>
        <div className="search mt-3 border border-[#f1f1f1] bg-[#fafafa] px-3 py-1">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {usageTabs.map((tab) => {
                const count = tab.value === "all" ? initialTotal ?? total : usageCounts?.[tab.value] ?? items.filter((asset) => asset.usage === tab.value).length;
                const active = filter === tab.value;
                return (
                  <button
                    className={`${active ? "input_btn" : "admin_btn"} inline-flex h-[30px] items-center`}
                    key={tab.value}
                    onClick={() => setFilter(tab.value)}
                    type="button"
                  >
                    {tab.label}（{count}）
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="selectmini min-w-[150px]" onChange={(event) => setSourceFilter(event.target.value as SourceFilter)} value={sourceFilter}>
                <option value="all">全部来源</option>
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="flex min-w-0 items-center gap-2">
                <Search className="h-4 w-4 text-[#999]" strokeWidth={1.8} />
                <input
                  className="inputtext min-w-[260px]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="请输入图片名称 / 存储路径"
                  value={query}
                />
              </div>
              <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={resetFilters} type="button">
                重置
              </button>
              <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={exportAssets} type="button">
                <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                导出素材
              </button>
              <button
                className="input_btn inline-flex h-[30px] items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={watermarking || submitting}
                onClick={refreshPublicWatermarks}
                type="button"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${watermarking ? "animate-spin" : ""}`} strokeWidth={1.8} />
                {watermarking ? "刷新中" : "刷新展示水印"}
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-[#666]">
            <span className="tag_gray">可见 {filtered.length} / {total}</span>
            <span className="tag_gray">装修素材 {usageCounts?.theme ?? items.filter((asset) => asset.usage === "theme").length}</span>
            <span className="tag_gray">封面 {usageCounts?.pack_cover ?? items.filter((asset) => asset.usage === "pack_cover").length}</span>
            <span className="tag_gray">外链 {sourceCounts?.external_url ?? items.filter((asset) => asset.sourceType === "external_url").length}</span>
            <span className="tag_gray inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" strokeWidth={1.8} />
              展示资源水印
            </span>
          </div>
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? "xl:grid-cols-[1.1fr_0.9fr]" : "xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
        <div className="right_box border border-[#eee] bg-white p-3">
          <div className="xt_tt">
            <span>资源列表</span>
            <div className="clear" />
          </div>
          <div className="mt-3 overflow-x-auto" data-admin-media-grid="saas-source-table">
            <table className="list min-w-[900px]">
              <thead>
                <tr>
                  <th className="bgtt w-[80px]">预览</th>
                  <th className="bgtt aleft">名称</th>
                  <th className="bgtt">用途</th>
                  <th className="bgtt">来源</th>
                  <th className="bgtt">类型</th>
                  <th className="bgtt aleft">存储路径</th>
                  <th className="bgtt w-[170px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((asset) => {
                  const isEditing = asset.id === editingId;
                  return (
                    <tr className={isEditing ? "bg-[#f2f6fc]" : ""} key={asset.id}>
                      <td>
                        <img
                          alt={asset.altText || asset.label}
                          className="mx-auto h-11 w-14 border border-[#eee] object-cover"
                          decoding="async"
                          loading="lazy"
                          src={previewFor(site, asset)}
                        />
                      </td>
                      <td className="aleft">
                        <div className="font-semibold text-[#333]">{asset.label}</div>
                        <div className="mt-1 truncate font-mono text-[11px] text-[#999]">{asset.id}</div>
                      </td>
                      <td><span className="tag_gray">{asset.usage}</span></td>
                      <td className="font-mono text-[11px]">{asset.sourceType ?? "manual"}</td>
                      <td className="font-mono text-[11px]">{asset.mimeType}</td>
                      <td className="aleft truncate font-mono text-[11px] text-[#777]">{asset.storageKey}</td>
                      <td>
                        <div className="flex flex-wrap justify-center gap-1">
                          <button className="admin_edit inline-flex items-center gap-1" onClick={() => beginEditing(asset)} type="button">
                            <PencilLine className="h-3 w-3" strokeWidth={1.8} />
                            编辑
                          </button>
                          {(asset.previewUrl || asset.originUrl) ? (
                            <a className="admin_btn inline-flex items-center gap-1" href={asset.previewUrl || asset.originUrl} rel="noreferrer" target="_blank">
                              <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
                              预览
                            </a>
                          ) : null}
                          <button className="admin_del inline-flex items-center gap-1" onClick={() => remove(asset)} type="button">
                            <Trash2 className="h-3 w-3" strokeWidth={1.8} />
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7}>当前筛选下没有素材。右侧可以直接创建本地资源、网络资源或手动资源记录。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {hasMore ? (
            <div className="mt-3 flex justify-center">
              <button className="admin_btn inline-flex h-[32px] items-center" disabled={loadingPage} onClick={() => loadMediaPage({ append: true })} type="button">
                {loadingPage ? "加载中" : "加载更多素材"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <div className="right_box border border-[#eee] bg-white p-3">
            <div className="xt_tt">
              <span>{editing ? "编辑资源" : "添加资源"}</span>
              <div className="clear" />
            </div>
            <div className="tixing mt-3">对应原 SaaS sources.html + sources_sel.html 的站点级资源池，并直接服务装修器资源选择器。</div>
            <table className="list admin-form-table mt-3">
              <tbody>
                <tr>
                  <th className="bgtt w-[110px]">名称</th>
                  <td className="aleft"><input className="inputtext w-full" onChange={(event) => updateForm("label", event.target.value)} value={activeAsset.label} /></td>
                </tr>
                <tr>
                  <th className="bgtt">用途</th>
                  <td className="aleft">
                    <select className="selectmini w-full" onChange={(event) => updateForm("usage", event.target.value as MediaAsset["usage"])} value={activeAsset.usage}>
                      {usageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </td>
                </tr>
                <tr>
                  <th className="bgtt">来源</th>
                  <td className="aleft">
                    <select className="selectmini w-full" onChange={(event) => updateForm("sourceType", event.target.value as NonNullable<MediaAsset["sourceType"]>)} value={activeAsset.sourceType ?? "manual"}>
                      {sourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </td>
                </tr>
                <tr>
                  <th className="bgtt">存储路径</th>
                  <td className="aleft"><input className="inputtext w-full font-mono" onChange={(event) => updateForm("storageKey", event.target.value)} value={activeAsset.storageKey} /></td>
                </tr>
                <tr>
                  <th className="bgtt">预览地址</th>
                  <td className="aleft"><input className="inputtext w-full font-mono" onChange={(event) => updateForm("previewUrl", event.target.value)} value={activeAsset.previewUrl ?? ""} /></td>
                </tr>
                <tr>
                  <th className="bgtt">原始地址</th>
                  <td className="aleft"><input className="inputtext w-full font-mono" onChange={(event) => updateForm("originUrl", event.target.value)} value={activeAsset.originUrl ?? ""} /></td>
                </tr>
                <tr>
                  <th className="bgtt">MIME</th>
                  <td className="aleft"><input className="inputtext w-full" onChange={(event) => updateForm("mimeType", event.target.value)} value={activeAsset.mimeType} /></td>
                </tr>
                <tr>
                  <th className="bgtt">Alt</th>
                  <td className="aleft"><input className="inputtext w-full" onChange={(event) => updateForm("altText", event.target.value)} value={activeAsset.altText ?? ""} /></td>
                </tr>
                <tr>
                  <th className="bgtt">备注</th>
                  <td className="aleft">
                    <textarea className="inputall min-h-20 w-full resize-y" onChange={(event) => updateForm("notes", event.target.value)} value={activeAsset.notes ?? ""} />
                  </td>
                </tr>
                <tr>
                  <th className="bgtt">操作</th>
                  <td className="aleft">
                    <button
                      className="input_btn inline-flex h-[30px] items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={submitting}
                      onClick={() => submit(activeAsset, editing ? "update" : "create")}
                      type="button"
                    >
                      {editing ? <Save className="h-3.5 w-3.5" strokeWidth={1.8} /> : <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />}
                      {editing ? "保存资源" : "添加资源"}
                    </button>
                    {editing ? (
                      <button
                        className="admin_btn ml-2"
                        onClick={() => {
                          setEditingId(null);
                          setEditingDraft(null);
                        }}
                        type="button"
                      >
                        取消编辑
                      </button>
                    ) : null}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="right_box border border-[#eee] bg-white p-3">
            <div className="xt_tt">
              <span>当前资源预览</span>
              <div className="clear" />
            </div>
            <div className="mt-3 grid gap-3">
              {activePreviewUrl ? (
                <img
                  alt={activeAsset.altText || activeAsset.label || "Site media preview"}
                  className="aspect-[4/3] w-full border border-[#eee] object-cover"
                  decoding="async"
                  loading="lazy"
                  src={activePreviewUrl}
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center border border-dashed border-[#ddd] bg-[#fafafa] px-4 text-center text-[12px] text-[#999]">
                  填写预览地址或选择已有资源后显示预览
                </div>
              )}
              <div className="grid gap-2 text-[12px] leading-5 text-[#666]">
                <p className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-[#999]" strokeWidth={1.8} />装修器中的 image_picker / media_asset 直接读取这批站点素材。</p>
                <p className="flex items-center gap-2"><UploadCloud className="h-4 w-4 text-[#999]" strokeWidth={1.8} />可用 /assets/...、外部 URL 或站点路径记录，第一版不接真实对象存储上传。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
