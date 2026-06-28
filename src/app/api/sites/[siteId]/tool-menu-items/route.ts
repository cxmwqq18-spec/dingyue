import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { clearSiteReadCache } from "@/lib/stores/site-store";
import { toToolMenuItem, uid } from "@/lib/stores/prisma-mappers";
import { ensureDefaultToolMenuTaxonomy, isMissingToolMenuTableError, slugifyToolTaxonomy } from "@/lib/tool-menu-taxonomy";

function itemBody(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const href = typeof body.href === "string" && body.href.trim() ? body.href.trim() : "/tools";
  const slug = slugifyToolTaxonomy(typeof body.slug === "string" && body.slug.trim() ? body.slug : title || href);
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
    href,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    status
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const admin = await hasSiteAdminSession(siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  if (admin) await ensureDefaultToolMenuTaxonomy(siteId);
  let items: Array<Parameters<typeof toToolMenuItem>[0]>;
  try {
    items = await prisma.toolMenuItem.findMany({
      where: { siteId, status: admin ? undefined : "active" },
      include: { category: { include: { parent: true } } },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }]
    });
  } catch (error) {
    if (!isMissingToolMenuTableError(error)) throw error;
    items = [];
  }
  return NextResponse.json({ ok: true, items: items.map(toToolMenuItem) });
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const body = itemBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (body.title.length < 2 || !body.slug) return NextResponse.json({ error: "tool_title_required" }, { status: 400 });
  try {
    if (body.categoryId) {
      const category = await prisma.toolCategory.findFirst({ where: { id: body.categoryId, siteId }, select: { id: true } });
      if (!category) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    }
    const item = await prisma.toolMenuItem.create({
      data: { id: uid("tool_item"), siteId, ...body },
      include: { category: { include: { parent: true } } }
    });
    clearSiteReadCache();
    return NextResponse.json({ ok: true, item: toToolMenuItem(item) });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return NextResponse.json({ error: "tool_menu_tables_not_ready" }, { status: 503 });
    return NextResponse.json({ error: "tool_slug_exists" }, { status: 409 });
  }
}
