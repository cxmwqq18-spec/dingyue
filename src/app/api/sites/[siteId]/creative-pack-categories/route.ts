import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { toCreativePackCategory, uid } from "@/lib/stores/prisma-mappers";

function slugifyCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function ensureDefaultCreativePackCategories(siteId: string) {
  const existing = await prisma.creativePackCategory.count({ where: { siteId } });
  if (existing > 0) return;
  const packs = await prisma.creativePack.findMany({
    where: { siteId },
    select: { id: true, category: true, name: true },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }]
  });
  const parentBySlug = new Map<string, string>();
  for (const pack of packs) {
    const parentSlug = slugifyCategory(pack.category || "photo-packages") || "photo-packages";
    const childSlug = slugifyCategory(pack.name) || `${parentSlug}-${pack.id}`;
    let parentId = parentBySlug.get(parentSlug);
    if (!parentId) {
      const parent = await prisma.creativePackCategory.upsert({
        where: { siteId_slug: { siteId, slug: parentSlug } },
        create: {
          id: uid("pack_cat"),
          siteId,
          slug: parentSlug,
          label: titleFromSlug(parentSlug),
          description: `${titleFromSlug(parentSlug)} photo package group.`,
          sortOrder: parentBySlug.size
        },
        update: {}
      });
      parentId = parent.id;
      parentBySlug.set(parentSlug, parentId);
    }
    const child = await prisma.creativePackCategory.upsert({
      where: { siteId_slug: { siteId, slug: childSlug } },
      create: {
        id: uid("pack_cat"),
        siteId,
        parentId,
        slug: childSlug,
        label: pack.name,
        description: `${pack.name} package page.`,
        sortOrder: 0
      },
      update: {}
    });
    await prisma.creativePack.update({ where: { id: pack.id }, data: { categoryId: child.id, category: child.slug } });
  }
}

function categoryBody(body: Record<string, unknown>) {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const slug = slugifyCategory(typeof body.slug === "string" && body.slug.trim() ? body.slug : label);
  const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;
  const status = body.status === "draft" || body.status === "paused" ? body.status : "active";
  return {
    label,
    slug,
    parentId,
    description: typeof body.description === "string" ? body.description.trim() || null : null,
    heroTitle: typeof body.heroTitle === "string" ? body.heroTitle.trim() || null : null,
    heroSubtitle: typeof body.heroSubtitle === "string" ? body.heroSubtitle.trim() || null : null,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    status
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  const admin = await hasSiteAdminSession(siteId);
  if (admin) await ensureDefaultCreativePackCategories(siteId);
  const categories = await prisma.creativePackCategory.findMany({
    where: { siteId, status: admin ? undefined : "active" },
    include: { parent: true },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
  });
  return NextResponse.json({ ok: true, categories: categories.map(toCreativePackCategory) });
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const body = categoryBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (body.label.length < 2 || !body.slug) return NextResponse.json({ error: "category_label_required" }, { status: 400 });
  if (body.parentId) {
    const parent = await prisma.creativePackCategory.findFirst({ where: { id: body.parentId, siteId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "parent_category_not_found" }, { status: 404 });
  }
  try {
    const category = await prisma.creativePackCategory.create({
      data: { id: uid("pack_cat"), siteId, ...body },
      include: { parent: true }
    });
    return NextResponse.json({ ok: true, category: toCreativePackCategory(category) });
  } catch {
    return NextResponse.json({ error: "category_slug_exists" }, { status: 409 });
  }
}
