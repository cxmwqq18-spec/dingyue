"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Save, Search } from "lucide-react";
import {
  creativePackIconByName,
  creativePackIconOptions,
} from "@/lib/creative-pack-icons";
import type { ToolCategory, ToolMenuItem } from "@/lib/types";

type ToolTaxonomyPayload = {
  categories?: ToolCategory[];
  items?: ToolMenuItem[];
  error?: string;
};

function updateToolDetailJson(
  tool: ToolMenuItem,
  field: keyof NonNullable<ToolMenuItem["detailJson"]>,
  value: string,
): ToolMenuItem {
  const listFields = new Set(["useCases", "workflow"]);
  const nextValue = listFields.has(field)
    ? value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : value;
  return {
    ...tool,
    detailJson: {
      ...(tool.detailJson ?? {}),
      [field]: nextValue,
    },
  };
}

function detailFieldValue(
  tool: ToolMenuItem,
  field: keyof NonNullable<ToolMenuItem["detailJson"]>,
): string {
  const value = tool.detailJson?.[field];
  return Array.isArray(value)
    ? value.join("\n")
    : typeof value === "string"
      ? value
      : "";
}

function categoryPath(category: ToolCategory, categories: ToolCategory[]) {
  const parent =
    category.parent ??
    (category.parentId
      ? categories.find((item) => item.id === category.parentId)
      : undefined);
  return parent ? `${parent.label} / ${category.label}` : category.label;
}

function TreeCategorySelect({
  categories,
  excludeId,
  onChange,
  placeholder = "未分类",
  rootOnly = false,
  value,
}: {
  categories: ToolCategory[];
  excludeId?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rootOnly?: boolean;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const roots = useMemo(
    () =>
      categories.filter(
        (category) => !category.parentId && category.id !== excludeId,
      ),
    [categories, excludeId],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, ToolCategory[]>();
    for (const category of categories) {
      if (!category.parentId || category.id === excludeId) continue;
      const list = map.get(category.parentId) ?? [];
      list.push(category);
      map.set(category.parentId, list);
    }
    return map;
  }, [categories, excludeId]);
  const selected = categories.find((category) => category.id === value);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (category: ToolCategory) => {
    if (!normalizedQuery) return true;
    return `${category.label} ${category.slug} ${category.description ?? ""}`
      .toLowerCase()
      .includes(normalizedQuery);
  };
  const visibleRoots = roots.filter(
    (root) =>
      matches(root) || (childrenByParent.get(root.id) ?? []).some(matches),
  );

  return (
    <div className="relative">
      <button
        className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-left text-sm"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span
          className={
            selected ? "truncate text-zinc-900" : "truncate text-zinc-400"
          }
        >
          {selected ? categoryPath(selected, categories) : placeholder}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-zinc-400"
          strokeWidth={1.8}
        />
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-full min-w-[280px] rounded-xl border border-zinc-200 bg-white p-2 shadow-xl">
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5">
            <Search className="h-4 w-4 text-zinc-400" strokeWidth={1.8} />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索分类名称或 slug"
              value={query}
            />
          </label>
          <div className="mt-2 max-h-[280px] overflow-y-auto pr-1">
            <button
              className="w-full rounded-lg px-2 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              type="button"
            >
              {placeholder}
            </button>
            {visibleRoots.map((root) => {
              const children = (childrenByParent.get(root.id) ?? []).filter(
                matches,
              );
              const showRoot = matches(root);
              return (
                <div key={root.id}>
                  {showRoot ? (
                    <button
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                      onClick={() => {
                        onChange(root.id);
                        setOpen(false);
                      }}
                      type="button"
                    >
                      <span className="truncate">{root.label}</span>
                      <span className="text-xs font-normal text-zinc-400">
                        {childrenByParent.get(root.id)?.length ?? 0}
                      </span>
                    </button>
                  ) : null}
                  {!rootOnly &&
                    children.map((child) => (
                      <button
                        className="w-full rounded-lg px-2 py-2 pl-6 text-left text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                        key={child.id}
                        onClick={() => {
                          onChange(child.id);
                          setOpen(false);
                        }}
                        type="button"
                      >
                        <span className="mr-2 text-zinc-300">└</span>
                        {child.label}
                      </button>
                    ))}
                </div>
              );
            })}
            {visibleRoots.length ? null : (
              <div className="px-2 py-6 text-center text-sm text-zinc-400">
                没有匹配的分类。
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ToolTaxonomyEditor({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [menuItems, setMenuItems] = useState<ToolMenuItem[]>([]);
  const [categoryDraft, setCategoryDraft] = useState({
    label: "",
    slug: "",
    parentId: "",
    icon: "sparkles",
    description: "",
    sortOrder: 0,
    status: "active" as ToolCategory["status"],
  });
  const [message, setMessage] = useState(
    "维护 Tools 前台下拉菜单使用的分类树和工具菜单项。",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadToolTaxonomy() {
      try {
        setLoading(true);
        const [categoriesResponse, itemsResponse] = await Promise.all([
          fetch(`/api/sites/${siteId}/tool-categories`, {
            signal: controller.signal,
          }),
          fetch(`/api/sites/${siteId}/tool-menu-items`, {
            signal: controller.signal,
          }),
        ]);
        const categoriesResult = (await categoriesResponse
          .json()
          .catch(() => ({}))) as ToolTaxonomyPayload;
        const itemsResult = (await itemsResponse
          .json()
          .catch(() => ({}))) as ToolTaxonomyPayload;
        if (!active) return;
        if (categoriesResponse.ok)
          setCategories(categoriesResult.categories ?? []);
        if (itemsResponse.ok) setMenuItems(itemsResult.items ?? []);
        if (!categoriesResponse.ok || !itemsResponse.ok)
          setMessage(
            categoriesResult.error ??
              itemsResult.error ??
              "Tools 分类数据加载失败。",
          );
      } catch (error) {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error ? error.message : "Tools 分类数据加载失败。",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadToolTaxonomy();
    return () => {
      active = false;
      controller.abort();
    };
  }, [siteId]);

  const rootCategories = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories],
  );
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        id: category.id,
        label: categoryPath(category, categories),
      })),
    [categories],
  );

  function updateCategory(
    id: string,
    field: keyof ToolCategory,
    value: string | number,
  ) {
    setCategories((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "sortOrder" ? Number(value) : value }
          : item,
      ),
    );
  }

  function updateMenuItem(
    id: string,
    field: keyof ToolMenuItem,
    value: string | number,
  ) {
    setMenuItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "sortOrder" ? Number(value) : value }
          : item,
      ),
    );
  }

  function updateMenuDetail(
    id: string,
    field: keyof NonNullable<ToolMenuItem["detailJson"]>,
    value: string,
  ) {
    setMenuItems((current) =>
      current.map((item) =>
        item.id === id ? updateToolDetailJson(item, field, value) : item,
      ),
    );
  }

  async function createCategory() {
    const response = await fetch(`/api/sites/${siteId}/tool-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(categoryDraft),
    });
    const result = (await response.json().catch(() => ({}))) as {
      category?: ToolCategory;
      error?: string;
    };
    if (response.ok && result.category) {
      setCategories((current) =>
        [...current, result.category!].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
        ),
      );
      setCategoryDraft({
        label: "",
        slug: "",
        parentId: "",
        icon: "sparkles",
        description: "",
        sortOrder: 0,
        status: "active",
      });
      setMessage("Tools 分类已新增，前台下拉菜单会读取这份数据。");
      router.refresh();
      return;
    }
    setMessage(result.error ?? "Tools 分类新增失败。");
  }

  async function saveCategory(category: ToolCategory) {
    const response = await fetch(
      `/api/sites/${siteId}/tool-categories/${category.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(category),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      category?: ToolCategory;
      error?: string;
    };
    if (response.ok && result.category) {
      setCategories((current) =>
        current.map((item) =>
          item.id === result.category?.id ? result.category : item,
        ),
      );
      setMessage(`${category.label} 分类已保存。`);
      router.refresh();
      return;
    }
    setMessage(result.error ?? `${category.label} 保存失败。`);
  }

  async function saveMenuItem(item: ToolMenuItem) {
    const response = await fetch(
      `/api/sites/${siteId}/tool-menu-items/${item.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      item?: ToolMenuItem;
      error?: string;
    };
    if (response.ok && result.item) {
      setMenuItems((current) =>
        current.map((entry) =>
          entry.id === result.item?.id ? result.item : entry,
        ),
      );
      setMessage(`${item.title} 的 Tools 菜单配置已保存。`);
      router.refresh();
      return;
    }
    setMessage(result.error ?? `${item.title} 保存失败。`);
  }

  return (
    <details
      className="mt-5 rounded-[12px] border border-zinc-200 bg-white p-5"
      open
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4">
        <span>
          <span className="block font-mono text-xs uppercase tracking-[0.2em] text-clay">
            Tools menu
          </span>
          <span className="mt-2 block text-lg font-semibold">
            Tools 下拉分类
          </span>
          <span className="mt-1 block text-sm leading-6 text-zinc-500">
            放在商品套餐中统一维护，后续工具收费时可和 AI 拍摄包、Credits
            入口一起管理。
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-4 py-2 text-sm">
          {loading
            ? "加载中"
            : `${categories.length} 个分类 / ${menuItems.length} 个工具项`}
        </span>
      </summary>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{message}</p>
      <div className="mt-4 grid gap-3 rounded-[12px] border border-zinc-100 bg-zinc-50 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.8fr)_minmax(0,0.65fr)_auto]">
        <input
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          onChange={(event) =>
            setCategoryDraft((draft) => ({
              ...draft,
              label: event.target.value,
            }))
          }
          placeholder="分类名称"
          value={categoryDraft.label}
        />
        <input
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          onChange={(event) =>
            setCategoryDraft((draft) => ({
              ...draft,
              slug: event.target.value,
            }))
          }
          placeholder="slug，可留空自动生成"
          value={categoryDraft.slug}
        />
        <TreeCategorySelect
          categories={categories}
          onChange={(value) =>
            setCategoryDraft((draft) => ({ ...draft, parentId: value }))
          }
          placeholder="作为一级分类"
          rootOnly
          value={categoryDraft.parentId}
        />
        <select
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          onChange={(event) =>
            setCategoryDraft((draft) => ({
              ...draft,
              icon: event.target.value,
            }))
          }
          value={categoryDraft.icon}
        >
          {creativePackIconOptions.map((option) => (
            <option key={option.name} value={option.name}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98]"
          onClick={createCategory}
          type="button"
        >
          新增分类
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="list min-w-[1120px]">
          <thead>
            <tr>
              <th className="bgtt aleft">分类</th>
              <th className="bgtt">树形父级</th>
              <th className="bgtt">Icon</th>
              <th className="bgtt">排序</th>
              <th className="bgtt">状态</th>
              <th className="bgtt aleft">说明</th>
              <th className="bgtt">保存</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const Icon = creativePackIconByName(category.icon).icon;
              return (
                <tr key={category.id}>
                  <td className="aleft">
                    <input
                      className="inputtext input100"
                      onChange={(event) =>
                        updateCategory(category.id, "label", event.target.value)
                      }
                      value={category.label}
                    />
                    <input
                      className="inputtext input100 mt-2 font-mono text-[11px]"
                      onChange={(event) =>
                        updateCategory(category.id, "slug", event.target.value)
                      }
                      value={category.slug}
                    />
                  </td>
                  <td>
                    <TreeCategorySelect
                      categories={rootCategories}
                      excludeId={category.id}
                      onChange={(value) =>
                        updateCategory(category.id, "parentId", value)
                      }
                      placeholder="一级分类"
                      rootOnly
                      value={category.parentId ?? ""}
                    />
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-[8px] border border-[var(--admin-border-soft)] bg-white">
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <select
                        className="selectmini max-w-[150px]"
                        onChange={(event) =>
                          updateCategory(
                            category.id,
                            "icon",
                            event.target.value,
                          )
                        }
                        value={category.icon ?? "camera"}
                      >
                        {creativePackIconOptions.map((option) => (
                          <option key={option.name} value={option.name}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <input
                      className="inputtext input100 text-center"
                      onChange={(event) =>
                        updateCategory(
                          category.id,
                          "sortOrder",
                          event.target.value,
                        )
                      }
                      type="number"
                      value={category.sortOrder}
                    />
                  </td>
                  <td>
                    <select
                      className="selectmini input100"
                      onChange={(event) =>
                        updateCategory(
                          category.id,
                          "status",
                          event.target.value,
                        )
                      }
                      value={category.status}
                    >
                      <option value="active">active</option>
                      <option value="draft">draft</option>
                      <option value="paused">paused</option>
                    </select>
                  </td>
                  <td className="aleft">
                    <input
                      className="inputtext input100"
                      onChange={(event) =>
                        updateCategory(
                          category.id,
                          "description",
                          event.target.value,
                        )
                      }
                      value={category.description ?? ""}
                    />
                  </td>
                  <td>
                    <button
                      className="input_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap"
                      onClick={() => saveCategory(category)}
                      type="button"
                    >
                      <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                      保存
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="list min-w-[1480px]">
          <thead>
            <tr>
              <th className="bgtt aleft">工具菜单项</th>
              <th className="bgtt">树形归属分类</th>
              <th className="bgtt">排序</th>
              <th className="bgtt">状态</th>
              <th className="bgtt aleft">前台链接</th>
              <th className="bgtt aleft">详情页文案</th>
              <th className="bgtt">保存</th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map((tool) => (
              <tr key={tool.id}>
                <td className="aleft">
                  <input
                    className="inputtext input100"
                    onChange={(event) =>
                      updateMenuItem(tool.id, "title", event.target.value)
                    }
                    value={tool.title}
                  />
                  <input
                    className="inputtext input100 mt-2"
                    onChange={(event) =>
                      updateMenuItem(tool.id, "description", event.target.value)
                    }
                    value={tool.description ?? ""}
                  />
                </td>
                <td>
                  <TreeCategorySelect
                    categories={categories}
                    onChange={(value) =>
                      updateMenuItem(tool.id, "categoryId", value)
                    }
                    value={tool.categoryId ?? ""}
                  />
                  {tool.categoryId ? (
                    <p className="mt-1 text-[11px] leading-4 text-zinc-400">
                      {
                        categoryOptions.find(
                          (option) => option.id === tool.categoryId,
                        )?.label
                      }
                    </p>
                  ) : null}
                </td>
                <td>
                  <input
                    className="inputtext input100 text-center"
                    onChange={(event) =>
                      updateMenuItem(tool.id, "sortOrder", event.target.value)
                    }
                    type="number"
                    value={tool.sortOrder}
                  />
                </td>
                <td>
                  <select
                    className="selectmini input100"
                    onChange={(event) =>
                      updateMenuItem(tool.id, "status", event.target.value)
                    }
                    value={tool.status}
                  >
                    <option value="active">active</option>
                    <option value="draft">draft</option>
                    <option value="paused">paused</option>
                  </select>
                </td>
                <td className="aleft">
                  <input
                    className="inputtext input100 font-mono text-[11px]"
                    onChange={(event) =>
                      updateMenuItem(tool.id, "href", event.target.value)
                    }
                    value={tool.href}
                  />
                  <input
                    className="inputtext input100 mt-2 font-mono text-[11px]"
                    onChange={(event) =>
                      updateMenuItem(tool.id, "imageUrl", event.target.value)
                    }
                    placeholder="imageUrl"
                    value={tool.imageUrl ?? ""}
                  />
                </td>
                <td className="aleft min-w-[360px]">
                  <input
                    className="inputtext input100"
                    onChange={(event) =>
                      updateMenuDetail(tool.id, "title", event.target.value)
                    }
                    placeholder="详情页标题，留空用菜单标题"
                    value={detailFieldValue(tool, "title")}
                  />
                  <input
                    className="inputtext input100 mt-2"
                    onChange={(event) =>
                      updateMenuDetail(tool.id, "subtitle", event.target.value)
                    }
                    placeholder="详情页首屏说明"
                    value={detailFieldValue(tool, "subtitle")}
                  />
                  <input
                    className="inputtext input100 mt-2"
                    onChange={(event) =>
                      updateMenuDetail(tool.id, "ctaLabel", event.target.value)
                    }
                    placeholder="CTA 文案"
                    value={detailFieldValue(tool, "ctaLabel")}
                  />
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <textarea
                      className="inputtext min-h-[72px] resize-y text-[12px] leading-5"
                      onChange={(event) =>
                        updateMenuDetail(
                          tool.id,
                          "guideBody",
                          event.target.value,
                        )
                      }
                      placeholder="Guide 正文"
                      value={detailFieldValue(tool, "guideBody")}
                    />
                    <textarea
                      className="inputtext min-h-[72px] resize-y text-[12px] leading-5"
                      onChange={(event) =>
                        updateMenuDetail(
                          tool.id,
                          "detailBody",
                          event.target.value,
                        )
                      }
                      placeholder="详情说明正文"
                      value={detailFieldValue(tool, "detailBody")}
                    />
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <textarea
                      className="inputtext min-h-[80px] resize-y text-[12px] leading-5"
                      onChange={(event) =>
                        updateMenuDetail(
                          tool.id,
                          "workflow",
                          event.target.value,
                        )
                      }
                      placeholder="Workflow，每行一条"
                      value={detailFieldValue(tool, "workflow")}
                    />
                    <textarea
                      className="inputtext min-h-[80px] resize-y text-[12px] leading-5"
                      onChange={(event) =>
                        updateMenuDetail(
                          tool.id,
                          "useCases",
                          event.target.value,
                        )
                      }
                      placeholder="Use cases，每行一条"
                      value={detailFieldValue(tool, "useCases")}
                    />
                  </div>
                </td>
                <td>
                  <button
                    className="input_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap"
                    onClick={() => saveMenuItem(tool)}
                    type="button"
                  >
                    <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                    保存
                  </button>
                </td>
              </tr>
            ))}
            {menuItems.length ? null : (
              <tr>
                <td
                  className="py-10 text-center text-sm text-zinc-400"
                  colSpan={7}
                >
                  暂无工具菜单项。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
