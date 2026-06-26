import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { clearPublicCreativePackCategoriesCache, clearPublicCreativePacksCache } from "@/lib/creative-pack-api-cache";
import { prisma } from "@/lib/prisma";
import { toCreativePackCategory } from "@/lib/stores/prisma-mappers";

function slugifyCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function categoryBody(body: Record<string, unknown>) {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugifyCategory(body.slug) : undefined;
  const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;
  const status = body.status === "draft" || body.status === "paused" ? body.status : "active";
  return {
    label,
    slug,
    parentId,
    description: typeof body.description === "string" ? body.description.trim() || null : null,
    heroTitle: typeof body.heroTitle === "string" ? body.heroTitle.trim() || null : null,
    heroSubtitle: typeof body.heroSubtitle === "string" ? body.heroSubtitle.trim() || null : null,
    icon: typeof body.icon === "string" ? body.icon.trim() || null : typeof body.iconName === "string" ? body.iconName.trim() || null : null,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    status
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string; categoryId: string }> }) {
  const { siteId, categoryId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const existing = await prisma.creativePackCategory.findFirst({ where: { id: categoryId, siteId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  const body = categoryBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (body.label.length < 2) return NextResponse.json({ error: "category_label_required" }, { status: 400 });
  if (body.parentId) {
    if (body.parentId === categoryId) return NextResponse.json({ error: "category_parent_self_reference" }, { status: 400 });
    const parent = await prisma.creativePackCategory.findFirst({ where: { id: body.parentId, siteId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "parent_category_not_found" }, { status: 404 });
  }
  try {
    const category = await prisma.creativePackCategory.update({
      where: { id: categoryId },
      data: {
        label: body.label,
        ...(body.slug ? { slug: body.slug } : {}),
        parentId: body.parentId,
        description: body.description,
        heroTitle: body.heroTitle,
        heroSubtitle: body.heroSubtitle,
        icon: body.icon,
        imageUrl: body.imageUrl,
        sortOrder: body.sortOrder,
        status: body.status
      },
      include: { parent: true }
    });
    await prisma.creativePack.updateMany({ where: { siteId, categoryId }, data: { category: category.slug } });
    clearPublicCreativePackCategoriesCache(siteId);
    clearPublicCreativePacksCache();
    return NextResponse.json({ ok: true, category: toCreativePackCategory(category) });
  } catch {
    return NextResponse.json({ error: "category_slug_exists" }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string; categoryId: string }> }) {
  const { siteId, categoryId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const existing = await prisma.creativePackCategory.findFirst({ where: { id: categoryId, siteId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  await prisma.creativePackCategory.delete({ where: { id: categoryId } });
  clearPublicCreativePackCategoriesCache(siteId);
  clearPublicCreativePacksCache();
  return NextResponse.json({ ok: true, deletedCategoryId: categoryId });
}
