import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { normalizeCreativePackIconName } from "@/lib/creative-pack-icons";
import { prisma } from "@/lib/prisma";
import { clearSiteReadCache } from "@/lib/stores/site-store";
import { toToolCategory, uid } from "@/lib/stores/prisma-mappers";
import { ensureDefaultToolMenuTaxonomy, isMissingToolMenuTableError, slugifyToolTaxonomy } from "@/lib/tool-menu-taxonomy";

function categoryBody(body: Record<string, unknown>) {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const slug = slugifyToolTaxonomy(typeof body.slug === "string" && body.slug.trim() ? body.slug : label);
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

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const admin = await hasSiteAdminSession(siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  if (admin) await ensureDefaultToolMenuTaxonomy(siteId);
  let categories: Array<Parameters<typeof toToolCategory>[0]>;
  try {
    categories = await prisma.toolCategory.findMany({
      where: { siteId, status: admin ? undefined : "active" },
      include: { parent: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
    });
  } catch (error) {
    if (!isMissingToolMenuTableError(error)) throw error;
    categories = [];
  }
  return NextResponse.json({ ok: true, categories: categories.map(toToolCategory) });
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const body = categoryBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (body.label.length < 2 || !body.slug) return NextResponse.json({ error: "category_label_required" }, { status: 400 });
  try {
    if (body.parentId) {
      const parent = await prisma.toolCategory.findFirst({ where: { id: body.parentId, siteId }, select: { id: true } });
      if (!parent) return NextResponse.json({ error: "parent_category_not_found" }, { status: 404 });
    }
    const category = await prisma.toolCategory.create({
      data: { id: uid("tool_cat"), siteId, ...body },
      include: { parent: true }
    });
    clearSiteReadCache();
    return NextResponse.json({ ok: true, category: toToolCategory(category) });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return NextResponse.json({ error: "tool_menu_tables_not_ready" }, { status: 503 });
    return NextResponse.json({ error: "category_slug_exists" }, { status: 409 });
  }
}
