import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlatformAdmin, requirePlatformMutation } from "@/lib/api-auth";
import { cloudflareAccountStatus } from "@/lib/cloudflare-dns";
import { StoreError } from "@/lib/server-store";
import {
  clearCurrentPlatformCloudflareAccountRelational,
  deletePlatformCloudflareAccountRelational,
  getPlatformOverviewRelational,
  setCurrentPlatformCloudflareAccountRelational,
  upsertPlatformCloudflareAccountRelational
} from "@/lib/stores/platform-store";

async function payload() {
  const overview = await getPlatformOverviewRelational();
  const accounts = overview.platformCloudflareAccounts;
  const current = accounts.find((account) => account.id === overview.currentCloudflareAccountId);
  return {
    ok: true,
    currentAccountId: current?.id ?? "",
    accounts: accounts.map((account) => ({
      id: account.id,
      label: account.label,
      email: account.email,
      accountId: account.accountId,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt ?? account.createdAt,
      updatedBy: account.updatedBy,
      isCurrent: account.id === current?.id,
      status: cloudflareAccountStatus(account)
    })),
    summary: {
      totalAccounts: accounts.length,
      configuredAccounts: accounts.filter((account) => cloudflareAccountStatus(account).configured).length,
      currentConfigured: cloudflareAccountStatus(current).configured
    }
  };
}

export async function GET() {
  const current = await getCurrentPlatformAdmin();
  if (!current) return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  return NextResponse.json(await payload());
}

export async function PUT(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:cloudflare" });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    label?: string;
    email?: string;
    accountId?: string;
    apiToken?: string;
    makeCurrent?: boolean;
  };
  if (!body.label?.trim()) return NextResponse.json({ error: "missing_cloudflare_label" }, { status: 400 });
  if (!body.email?.trim() || !body.email.includes("@")) return NextResponse.json({ error: "invalid_cloudflare_email" }, { status: 400 });
  if (!body.accountId?.trim()) return NextResponse.json({ error: "missing_cloudflare_account_id" }, { status: 400 });
  await upsertPlatformCloudflareAccountRelational({
    id: body.id,
    label: body.label,
    email: body.email,
    accountId: body.accountId,
    apiToken: body.apiToken,
    makeCurrent: body.makeCurrent,
    actor: permission.current.platformAdmin.id
  });
  return NextResponse.json(await payload());
}

export async function POST(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:cloudflare" });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as { accountId?: string; action?: "set_current" | "clear_current" };
  if (!body.accountId) return NextResponse.json({ error: "missing_cloudflare_account" }, { status: 400 });
  try {
    if (body.action === "clear_current") {
      await clearCurrentPlatformCloudflareAccountRelational({ accountId: body.accountId, actor: permission.current.platformAdmin.id });
    } else {
      await setCurrentPlatformCloudflareAccountRelational({ accountId: body.accountId, actor: permission.current.platformAdmin.id });
    }
    return NextResponse.json(await payload());
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "cloudflare_current_account_failed" }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:cloudflare" });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as { accountId?: string };
  if (!body.accountId) return NextResponse.json({ error: "missing_cloudflare_account" }, { status: 400 });
  try {
    await deletePlatformCloudflareAccountRelational({ accountId: body.accountId, actor: permission.current.platformAdmin.id });
    return NextResponse.json(await payload());
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "cloudflare_delete_account_failed" }, { status });
  }
}
