import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import {
  applySaasThemeActionRelational,
  type SaasThemeAction
} from "@/lib/stores/theme-store";
import type { SectionBlockInstance, SectionInstance } from "@/lib/types";

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
    const tag = match[0];
    if (tag.startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(start, tagPattern.lastIndex);
  }
  return "";
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

function fallbackSectionHtml(sectionId: string, section?: SectionInstance): string {
  if (!section) return "";
  const title =
    valueToText(section.settings.title) ||
    valueToText(section.settings.name) ||
    firstBlockText(section.blocks, "title") ||
    firstBlockText(section.blocks, "label") ||
    section.type;
  const body =
    valueToText(section.settings.sub_title) ||
    valueToText(section.settings.subtitle) ||
    valueToText(section.settings.body) ||
    valueToText(section.settings.text) ||
    firstBlockText(section.blocks, "sub_title") ||
    firstBlockText(section.blocks, "text") ||
    "";
  return `<div id="xfcart-section-${escapeHtml(sectionId)}" class="xfcart-section" data-section-id="${escapeHtml(sectionId)}" data-section-type="${escapeHtml(String(section.type))}"><section style="padding:32px;font-family:Arial,sans-serif"><p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#777;margin:0 0 12px">SaaS iframe patch</p><h2 style="margin:0;font-size:28px;line-height:1.1">${escapeHtml(title)}</h2>${body ? `<p style="margin:12px 0 0;color:#555;line-height:1.6">${escapeHtml(body)}</p>` : ""}</section></div>`;
}

function firstBlockText(blocks: SectionBlockInstance[] | undefined, key: string): string {
  return valueToText(blocks?.map((block) => block.settings[key]).find(Boolean));
}

function valueToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    };
    return entities[char] ?? char;
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { action?: SaasThemeAction; actor?: string } | null;
  if (!body?.action?.type) {
    return NextResponse.json({ error: "invalid_saas_theme_action" }, { status: 400 });
  }
  try {
    const result = await applySaasThemeActionRelational(siteId, body.action, body.actor ?? "site_admin_demo");
    const site = result.site;
    const pageId = "pageId" in body.action ? body.action.pageId : site.pages[0]?.id;
    let html =
      pageId && result.sectionId && (result.responseType === "th1" || result.responseType === "add")
        ? await renderPreviewSectionFromRoute(request, site.slug, pageId, result.sectionId)
        : "";
    if (!html && pageId && result.sectionId && (result.responseType === "th1" || result.responseType === "add")) {
      const page = site.pages.find((item) => item.id === pageId);
      html = fallbackSectionHtml(result.sectionId, page?.draftJson.sections[result.sectionId]);
    }
    return NextResponse.json({
      ok: true,
      siteId,
      action: body.action.type,
      types: result.responseType,
      id: result.sectionId ?? "",
      html
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "saas_theme_action_failed" }, { status: 400 });
  }
}
