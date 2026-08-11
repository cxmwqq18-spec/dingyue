import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import {
  applyXfcartThemeEditRelational,
  type XfcartThemeEditPayload
} from "@/lib/stores/theme-store";
import type { SectionBlockInstance, SectionInstance, ThemeSettingValue } from "@/lib/types";

function valueFromForm(value: FormDataEntryValue | null): ThemeSettingValue | undefined {
  if (value === null) return undefined;
  const text = String(value);
  if (text === "true") return true;
  if (text === "false") return false;
  return text;
}

function extractElementById(html: string, id: string): string {
  const idToken = `id="${id}"`;
  const idIndex = html.indexOf(idToken);
  if (idIndex < 0) return "";
  const start = html.lastIndexOf("<div", idIndex);
  if (start < 0) return "";
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(start, tagPattern.lastIndex);
  }
  return "";
}

async function requestPayload(request: Request): Promise<XfcartThemeEditPayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Partial<XfcartThemeEditPayload> & {
      section?: SectionInstance;
      block?: SectionBlockInstance;
    };
    return {
      t: String(body.t ?? ""),
      page: body.page ? String(body.page) : undefined,
      theme_id: body.theme_id ? String(body.theme_id) : undefined,
      themeKey: body.themeKey ? String(body.themeKey) : undefined,
      theme_key: body.theme_key ? String(body.theme_key) : undefined,
      x: body.x ? String(body.x) : undefined,
      i: body.i ? String(body.i) : undefined,
      k: body.k,
      n: body.n ? String(body.n) : undefined,
      v: body.v,
      section: body.section,
      block: body.block,
      sectionsOrder: Array.isArray(body.sectionsOrder) ? body.sectionsOrder.map((item) => String(item)) : undefined
    };
  }
  const form = await request.formData();
  return {
    t: String(form.get("t") ?? ""),
    page: String(form.get("page") ?? "index"),
    theme_id: form.get("theme_id") ? String(form.get("theme_id")) : undefined,
    themeKey: form.get("themeKey") ? String(form.get("themeKey")) : undefined,
    theme_key: form.get("theme_key") ? String(form.get("theme_key")) : undefined,
    x: form.get("x") ? String(form.get("x")) : undefined,
    i: form.get("i") ? String(form.get("i")) : undefined,
    k: form.get("k") ? String(form.get("k")) : undefined,
    n: form.get("n") ? String(form.get("n")) : undefined,
    v: valueFromForm(form.get("v")),
    sectionsOrder: form.getAll("sectionsOrder").map((item) => String(item)).filter(Boolean)
  };
}

async function renderPreviewSectionFromRoute(request: Request, siteSlug: string, pageId: string, sectionId: string) {
  const previewUrl = new URL(`/site/${siteSlug}/admin/design/preview/${pageId}`, request.url);
  try {
    const response = await fetchWithTimeout(previewUrl, {
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") ?? ""
      },
      timeoutMs: 2500
    });
    if (!response.ok) return "";
    return extractElementById(await response.text(), `xfcart-section-${sectionId}`);
  } catch {
    return "";
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ state: "error", msg: "site_admin_login_required" }, { status: 401 });
  }
  const payload = await requestPayload(request);
  if (!payload.t) {
    return NextResponse.json({ state: "error", msg: "invalid_xfcart_theme_action" }, { status: 400 });
  }
  try {
    const result = await applyXfcartThemeEditRelational(siteId, payload, "site_admin_demo");
    const site = result.site;
    const pageId = result.pageId ?? site.pages[0]?.id;
    const html =
      pageId && result.sectionId && (result.responseType === "th1" || result.responseType === "add")
        ? await renderPreviewSectionFromRoute(request, site.slug, pageId, result.sectionId)
        : "";
    return NextResponse.json({
      state: "ok",
      ok: true,
      types: result.responseType,
      id: result.sectionId ?? "",
      html,
      pageDraftVersions: Object.fromEntries(site.pages.flatMap((page) => (page.draftMeta ? [[page.id, page.draftMeta] as const] : []))),
      settingsDraftVersion: site.themeSettings.draftMeta,
      theme_id: payload.theme_id ?? "",
      themeKey: payload.themeKey ?? payload.theme_key ?? "",
      page: payload.page ?? "index"
    });
  } catch (error) {
    return NextResponse.json({ state: "error", msg: error instanceof Error ? error.message : "xfcart_theme_edit_failed" }, { status: 400 });
  }
}
