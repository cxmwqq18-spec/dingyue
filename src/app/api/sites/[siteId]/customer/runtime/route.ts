import { NextResponse } from "next/server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import { getThemeRuntimeForCustomer } from "@/lib/server-store";
import { readStorefrontCustomerRuntimeStateForSiteFromDatabase } from "@/lib/storefront-state";
import type { ThemeRuntimeData } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const customerRuntimeCache = createServerTtlCache(
  "customer-runtime-api",
  Number(process.env.STOREFRONT_CUSTOMER_RUNTIME_API_TTL_MS ?? 12_000)
);

function emptyRuntime(): ThemeRuntimeData {
  return {
    jobs: [],
    assets: [],
    albums: [],
    ledger: [],
    subscriptions: [],
    orders: [],
    customerModels: []
  };
}

function trimRuntime(runtime: ThemeRuntimeData, profile: string): ThemeRuntimeData {
  if (profile === "workspace") {
    return {
      ...runtime,
      jobs: (runtime.jobs ?? []).slice(0, 8),
      assets: (runtime.assets ?? []).slice(0, 24),
      albums: (runtime.albums ?? []).slice(0, 8),
      ledger: (runtime.ledger ?? []).slice(0, 12),
      subscriptions: (runtime.subscriptions ?? []).slice(0, 4),
      orders: (runtime.orders ?? []).slice(0, 6),
      customerModels: (runtime.customerModels ?? []).slice(0, 4)
    };
  }
  return {
    ...runtime,
    jobs: (runtime.jobs ?? []).slice(0, 12),
    assets: (runtime.assets ?? []).slice(0, 24),
    albums: (runtime.albums ?? []).slice(0, 12),
    ledger: (runtime.ledger ?? []).slice(0, 16),
    subscriptions: (runtime.subscriptions ?? []).slice(0, 6),
    orders: (runtime.orders ?? []).slice(0, 12),
    customerModels: (runtime.customerModels ?? []).slice(0, 8)
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const current = await getCurrentCustomerForSite(siteId);
  if (!current) {
    return NextResponse.json({ ok: false, error: "customer_login_required", runtime: emptyRuntime() }, { status: 401 });
  }

  const profile = new URL(request.url).searchParams.get("profile") ?? "account";
  const normalizedProfile = profile === "workspace" ? "workspace" : profile === "account" ? "account" : "full";
  const runtime = await customerRuntimeCache.get(
    `${siteId}:${current.customer.id}:${normalizedProfile}`,
    async () => {
      const state = await readStorefrontCustomerRuntimeStateForSiteFromDatabase({
        siteId,
        sessionId: current.sessionId,
        profile: normalizedProfile
      });
      if (!state) return undefined;
      return trimRuntime(getThemeRuntimeForCustomer(state, siteId, current.customer.id), normalizedProfile);
    },
    normalizedProfile === "workspace" ? 8_000 : 12_000
  );
  if (!runtime) {
    return NextResponse.json({ ok: false, error: "customer_runtime_unavailable", runtime: emptyRuntime() }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    runtime: {
      ...runtime,
      customer: current.customer
    }
  }, {
    headers: { "Cache-Control": "private, max-age=8" }
  });
}
