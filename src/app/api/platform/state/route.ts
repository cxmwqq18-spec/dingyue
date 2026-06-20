import { NextResponse } from "next/server";
import { readPlatformState, writePlatformState } from "@/lib/server-store";
import { platformState } from "@/lib/data";

export async function GET() {
  const state = readPlatformState();
  return NextResponse.json({
    ok: true,
    sites: state.sites.length,
    customers: state.customers.length,
    products: state.products.length,
    jobs: state.jobs.length,
    customerModels: state.customerModels.length,
    albums: state.albums.length
  });
}

export async function POST(request: Request) {
  if (request.headers.get("x-smoke-reset") !== "true") {
    return NextResponse.json({ error: "smoke_reset_header_required" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { reset?: boolean };
  if (body.reset) {
    writePlatformState(JSON.parse(JSON.stringify(platformState)));
  }
  const state = readPlatformState();
  return NextResponse.json({
    ok: true,
    reset: Boolean(body.reset),
    sites: state.sites.length,
    customers: state.customers.length,
    products: state.products.length,
    jobs: state.jobs.length,
    customerModels: state.customerModels.length,
    albums: state.albums.length
  });
}
