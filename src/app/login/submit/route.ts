import { NextResponse } from "next/server";
import { getSiteByHostFromState } from "@/lib/domain-routing";
import { handleCustomerLoginForm } from "@/lib/customer-auth";
import { readPlatformState } from "@/lib/server-store";

export async function POST(request: Request) {
  const state = readPlatformState();
  const site = getSiteByHostFromState(state, request.headers.get("host"));
  if (!site) return NextResponse.redirect(new URL("/", request.url), 303);
  return handleCustomerLoginForm(request, site, "/app", "/login");
}
