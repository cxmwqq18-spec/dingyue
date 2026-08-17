import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { upsertVideoThemeCategoryRelational, upsertVideoThemeRelational } from "@/lib/stores/site-store";
import { toVideoTheme, toVideoThemeCategory } from "@/lib/stores/prisma-mappers";
import { parseVideoThemeImport, previewVideoThemeImport, type VideoThemeImportPreview } from "@/lib/video-theme-import";

async function previewForSite(siteId: string, buffer: Buffer): Promise<VideoThemeImportPreview> {
  const [categories, themes] = await Promise.all([
    prisma.videoThemeCategory.findMany({ where: { siteId }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.videoTheme.findMany({ where: { siteId }, include: { category: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
  ]);
  return previewVideoThemeImport(parseVideoThemeImport(buffer), categories.map(toVideoThemeCategory), themes.map(toVideoTheme));
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  try {
    const form = await request.formData();
    const mode = form.get("mode") === "commit" ? "commit" : "preview";
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "import_file_required" }, { status: 400 });
    const preview = await previewForSite(siteId, Buffer.from(await file.arrayBuffer()));
    if (mode === "preview") {
      return NextResponse.json({ ok: true, mode, ...preview });
    }
    if (preview.errors.length) {
      return NextResponse.json({ ok: false, mode, ...preview, error: "import_validation_failed" }, { status: 422 });
    }

    const categoryIds = new Map<string, string>();
    for (const category of preview.categories) {
      const existing = await prisma.videoThemeCategory.findUnique({
        where: { siteId_slug: { siteId, slug: category.slug } },
        select: { id: true }
      });
      const saved = await upsertVideoThemeCategoryRelational({
        siteId,
        categoryId: existing?.id,
        ...category
      });
      categoryIds.set(saved.category.slug, saved.category.id);
    }
    for (const theme of preview.themes) {
      const existing = await prisma.videoTheme.findUnique({
        where: { siteId_slug: { siteId, slug: theme.slug } },
        select: { id: true }
      });
      const categoryId = categoryIds.get(theme.categorySlug) ??
        (await prisma.videoThemeCategory.findUnique({
          where: { siteId_slug: { siteId, slug: theme.categorySlug } },
          select: { id: true }
        }))?.id;
      if (!categoryId) throw new Error(`import_category_not_found:${theme.categorySlug}`);
      await upsertVideoThemeRelational({
        siteId,
        themeId: existing?.id,
        categoryId,
        ...theme
      });
    }
    return NextResponse.json({ ok: true, mode, ...preview, imported: { categories: preview.categories.length, themes: preview.themes.length } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_import_failed" }, { status: 400 });
  }
}
