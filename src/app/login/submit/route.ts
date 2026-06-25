import { NextResponse } from "next/server";
import { handleCustomerLoginForm } from "@/lib/customer-auth";
import { getSiteByHostForPublicAuth } from "@/lib/stores/site-store";

export async function POST(request: Request) {
  const site = await getSiteByHostForPublicAuth(request.headers.get("host"));
  if (!site) return NextResponse.redirect(new URL("/", request.url), 303);
  return handleCustomerLoginForm(request, site, "/app", "/login");
}
