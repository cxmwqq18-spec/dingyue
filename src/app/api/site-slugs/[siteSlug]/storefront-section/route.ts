import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { renderStorefrontSectionPayload } from "@/lib/storefront-render";

export const dynamic = "force-dynamic";

function queryRecord(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  searchParams.forEach((value, key) => {
    if (key === "pagePath" || key === "routeMode" || key === "sectionId") return;
    const current = query[key];
    if (Array.isArray(current)) current.push(value);
    else if (typeof current === "string") query[key] = [current, value];
    else query[key] = value;
  });
  return query;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const pagePath = searchParams.get("pagePath") || "/";
  const sectionId = searchParams.get("sectionId") || "";
  const routeMode = searchParams.get("routeMode") === "host" ? "host" : "path";
  if (!sectionId) {
    return NextResponse.json({ ok: false, error: "section_id_required" }, { status: 400 });
  }

  const payload = await renderStorefrontSectionPayload({
    siteSlug,
    slug: pagePath.startsWith("/") ? pagePath : `/${pagePath}`,
    sectionId,
    query: queryRecord(searchParams),
    routeMode
  });
  if (!payload) {
    return NextResponse.json({ ok: false, error: "section_not_found" }, { status: 404 });
  }

  const hasPrivateRuntime = Boolean(payload.runtime?.customer || payload.runtime?.auth || payload.runtime?.jobDetail);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": hasPrivateRuntime ? "private, no-store" : "public, max-age=30, stale-while-revalidate=120"
    }
  });
}
