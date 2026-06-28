import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { normalizeCreativePackIconName } from "@/lib/creative-pack-icons";
import { prisma } from "@/lib/prisma";
import { clearSiteReadCache } from "@/lib/stores/site-store";
import { toToolCategory } from "@/lib/stores/prisma-mappers";
import { isMissingToolMenuTableError, slugifyToolTaxonomy } from "@/lib/tool-menu-taxonomy";

function categoryBody(body: Record<string, unknown>) {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugifyToolTaxonomy(body.slug) : undefined;
  const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;
  const status = body.status === "draft" || body.status === "paused" ? body.status : "active";
  return {
    label,
    slug,
    parentId,
    description: typeof body.description === "string" ? body.description.trim() || null : null,
    icon: normalizeCreativePackIconName(typeof body.icon === "string" ? body.icon : typeof body.iconName === "string" ? body.iconName : null),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    status
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string; categoryId: string }> }) {
  const { siteId, categoryId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  try {
    const existing = await prisma.toolCategory.findFirst({ where: { id: categoryId, siteId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    const body = categoryBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (body.label.length < 2) return NextResponse.json({ error: "category_label_required" }, { status: 400 });
    if (body.parentId) {
      if (body.parentId === categoryId) return NextResponse.json({ error: "category_parent_self_reference" }, { status: 400 });
      const parent = await prisma.toolCategory.findFirst({ where: { id: body.parentId, siteId }, select: { id: true } });
      if (!parent) return NextResponse.json({ error: "parent_category_not_found" }, { status: 404 });
    }
    const category = await prisma.toolCategory.update({
      where: { id: categoryId },
      data: {
        label: body.label,
        ...(body.slug ? { slug: body.slug } : {}),
        parentId: body.parentId,
        description: body.description,
        icon: body.icon,
        sortOrder: body.sortOrder,
        status: body.status
      },
      include: { parent: true }
    });
    clearSiteReadCache();
    return NextResponse.json({ ok: true, category: toToolCategory(category) });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return NextResponse.json({ error: "tool_menu_tables_not_ready" }, { status: 503 });
    return NextResponse.json({ error: "category_slug_exists" }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string; categoryId: string }> }) {
  const { siteId, categoryId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  try {
    const existing = await prisma.toolCategory.findFirst({ where: { id: categoryId, siteId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    await prisma.toolCategory.delete({ where: { id: categoryId } });
    clearSiteReadCache();
    return NextResponse.json({ ok: true, deletedCategoryId: categoryId });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return NextResponse.json({ error: "tool_menu_tables_not_ready" }, { status: 503 });
    throw error;
  }
}
