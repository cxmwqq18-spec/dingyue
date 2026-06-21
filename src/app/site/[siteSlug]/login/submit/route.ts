import { NextResponse } from "next/server";
import { handleCustomerLoginForm } from "@/lib/customer-auth";
import { readPlatformState } from "@/lib/server-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return NextResponse.redirect(new URL("/", request.url), 303);

  return handleCustomerLoginForm(request, site, `/site/${site.slug}/app`, `/site/${site.slug}/login`);
}
