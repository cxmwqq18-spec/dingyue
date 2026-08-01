import { NextResponse } from "next/server";
import { handleCustomerLoginForm } from "@/lib/customer-auth";
import { getSiteByHostForPublicAuth } from "@/lib/stores/site-store";

export async function POST(request: Request) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0]?.trim() ?? "";
  const site = await getSiteByHostForPublicAuth(host);
  if (!site) return NextResponse.redirect(new URL("/", request.url), 303);
  return handleCustomerLoginForm(request, site, "/app/create", "/login");
}
