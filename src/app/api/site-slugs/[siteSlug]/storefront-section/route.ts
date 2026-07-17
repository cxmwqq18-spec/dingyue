import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { renderStorefrontSectionPayload } from "@/lib/storefront-render";

export const dynamic = "force-dynamic";

function queryRecord(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  searchParams.forEach((value, key) => {
    if (key === "pagePath" || key === "routeMode" || key === "sectionId" || key === "sectionIds") return;
    const current = query[key];
    if (Array.isArray(current)) current.push(value);
    else if (typeof current === "string") query[key] = [current, value];
    else query[key] = value;
  });
  return query;
}

function sectionIdsFromParams(searchParams: URLSearchParams): string[] {
  const sectionIds = [
    ...searchParams.getAll("sectionId"),
    ...searchParams.getAll("sectionIds").flatMap((value) => value.split(","))
  ].map((value) => value.trim()).filter(Boolean);
  return Array.from(new Set(sectionIds)).slice(0, 24);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const pagePath = searchParams.get("pagePath") || "/";
  const sectionIds = sectionIdsFromParams(searchParams);
  const routeMode = searchParams.get("routeMode") === "host" ? "host" : "path";
  if (!sectionIds.length) {
    return NextResponse.json({ ok: false, error: "section_id_required" }, { status: 400 });
  }

  const slug = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
  const query = queryRecord(searchParams);
  const payloads = (await Promise.all(sectionIds.map((sectionId) =>
    renderStorefrontSectionPayload({
      siteSlug,
      slug,
      sectionId,
      query,
      routeMode
    })
  ))).filter((payload): payload is NonNullable<typeof payload> => Boolean(payload));

  if (sectionIds.length > 1) {
    if (!payloads.length) {
      return NextResponse.json({ ok: false, error: "section_not_found" }, { status: 404 });
    }
    const foundIds = new Set(payloads.map((payload) => payload.id));
    const hasPrivateRuntime = payloads.some((payload) => Boolean(payload.runtime?.customer || payload.runtime?.auth || payload.runtime?.jobDetail));
    return NextResponse.json({
      ok: true,
      sections: payloads,
      missingSectionIds: sectionIds.filter((sectionId) => !foundIds.has(sectionId))
    }, {
      headers: {
        "Cache-Control": hasPrivateRuntime ? "private, no-store" : "public, max-age=30, stale-while-revalidate=120"
      }
    });
  }

  const payload = payloads[0];
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
