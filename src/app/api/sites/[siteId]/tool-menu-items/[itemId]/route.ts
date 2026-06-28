import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { clearSiteReadCache } from "@/lib/stores/site-store";
import { toToolMenuItem } from "@/lib/stores/prisma-mappers";
import { isMissingToolMenuTableError, slugifyToolTaxonomy } from "@/lib/tool-menu-taxonomy";

function itemBody(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugifyToolTaxonomy(body.slug) : undefined;
  const categoryId = typeof body.categoryId === "string" && body.categoryId.trim() ? body.categoryId.trim() : null;
  const status = body.status === "draft" || body.status === "paused" ? body.status : "active";
  return {
    title,
    slug,
    categoryId,
    description: typeof body.description === "string" ? body.description.trim() || null : null,
    badge: typeof body.badge === "string" ? body.badge.trim() || null : null,
    icon: typeof body.icon === "string" ? body.icon.trim() || null : null,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null,
    href: typeof body.href === "string" && body.href.trim() ? body.href.trim() : "/tools",
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    status
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string; itemId: string }> }) {
  const { siteId, itemId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  try {
    const existing = await prisma.toolMenuItem.findFirst({ where: { id: itemId, siteId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "tool_not_found" }, { status: 404 });
    const body = itemBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (body.title.length < 2) return NextResponse.json({ error: "tool_title_required" }, { status: 400 });
    if (body.categoryId) {
      const category = await prisma.toolCategory.findFirst({ where: { id: body.categoryId, siteId }, select: { id: true } });
      if (!category) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    }
    const item = await prisma.toolMenuItem.update({
      where: { id: itemId },
      data: {
        title: body.title,
        ...(body.slug ? { slug: body.slug } : {}),
        categoryId: body.categoryId,
        description: body.description,
        badge: body.badge,
        icon: body.icon,
        imageUrl: body.imageUrl,
        href: body.href,
        sortOrder: body.sortOrder,
        status: body.status
      },
      include: { category: { include: { parent: true } } }
    });
    clearSiteReadCache();
    return NextResponse.json({ ok: true, item: toToolMenuItem(item) });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return NextResponse.json({ error: "tool_menu_tables_not_ready" }, { status: 503 });
    return NextResponse.json({ error: "tool_slug_exists" }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string; itemId: string }> }) {
  const { siteId, itemId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  try {
    const existing = await prisma.toolMenuItem.findFirst({ where: { id: itemId, siteId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "tool_not_found" }, { status: 404 });
    await prisma.toolMenuItem.delete({ where: { id: itemId } });
    clearSiteReadCache();
    return NextResponse.json({ ok: true, deletedItemId: itemId });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return NextResponse.json({ error: "tool_menu_tables_not_ready" }, { status: 503 });
    throw error;
  }
}
