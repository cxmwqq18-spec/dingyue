import { NextResponse } from "next/server";
import { handleCustomerLoginForm } from "@/lib/customer-auth";
import { getSiteBySlugForPublicAuth } from "@/lib/stores/site-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const site = await getSiteBySlugForPublicAuth(siteSlug);
  if (!site) return NextResponse.redirect(new URL("/", request.url), 303);

  return handleCustomerLoginForm(request, site, `/site/${site.slug}/app/create`, `/site/${site.slug}/login`);
}
