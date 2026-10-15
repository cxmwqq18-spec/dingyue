import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody, imageTask } from "@/lib/aidreamcapes-workspace/api";
import { verifyQuote } from "@/lib/aidreamcapes-workspace/quote";
import { quoteWorkspaceAction } from "@/lib/aidreamcapes-workspace/provider";
import { getCustomerAssetsRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { submitGenerationJob } from "@/lib/generation-submit";
import { settleGenerationJobRelational } from "@/lib/stores/job-store";
import { prisma } from "@/lib/prisma";
import { publicUrlForRequest } from "@/lib/session";
import { resolveWorkerBaseUrls } from "@/lib/worker";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
import { dispatchWorkspaceJob } from "@/lib/aidreamcapes-workspace/dispatch";
import { workspaceAssetHasMedia } from "@/lib/aidreamcapes-workspace/asset-contracts";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    const customerId = auth.current.customer.id;
    const [jobs, { assets }] = await Promise.all([
      prisma.generationJob.findMany({ where: { siteId, customerId, aiApp: { slug: "image_generator" } }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, status: true, creditsReserved: true, createdAt: true, updatedAt: true } }),
      getCustomerAssetsRelational({ siteId, customerId, roles: ["output"], take: 100 })
    ]);
    return workspaceResponse({ jobs, assets: assets.filter(a => workspaceAssetHasMedia(a, { siteId, customerId, kind: "image" })).map(toThemeRuntimeAssetRelational) });
  } catch (error) { return workspaceFailure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params; const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response;
    const body = await jsonBody(request); const customerId = auth.current.customer.id; const task = await imageTask(customerId, body);
    const expectedCredits = await verifyQuote(task, "generate_image", undefined, body.quoteToken);
    const pricing = await quoteWorkspaceAction({ siteId, action: "generate_image", task });
    if (!pricing.available || pricing.credits !== expectedCredits) throw new WorkspaceError("workspace_quote_price_changed", 409);
    const key = request.headers.get("idempotency-key");
    if (!key || key.length > 180) throw new WorkspaceError("idempotency_key_required", 428);
    const { assets } = await getCustomerAssetsRelational({ siteId, customerId });
    const assetIds = Object.values(task.input.images).flat().map(url => {
      const asset = assets.find(a => a.siteId === siteId && a.customerId === customerId &&
        workspaceAssetHasMedia(a, { siteId, customerId, kind: "image" }) && toThemeRuntimeAssetRelational(a).previewUrl === url);
      if (!asset) throw new WorkspaceError("asset_not_owned", 403);
      return asset.id;
    });
    const baseUrls = resolveWorkerBaseUrls(publicUrlForRequest(request, "/").origin);
    const result = await submitGenerationJob({ siteId, customerId, aiAppSlug: "image_generator", entryPoint: "customer_workspace", authContext: { kind: "customer", actorId: customerId },
      idempotencyKey: `ugc-image:${key}`, baseUrls, skipWorkerDispatch: true, includeWorkerPayload: true,
      params: { assetIds, fields: { userDirection: task.input.fields.detail, aspectRatio: task.input.options.aspect }, providerSelection: { mode: "fixed_provider", providerId: pricing.providerId, fallbackEnabled: false }, workspace: { kind: "image", expectedCredits } } });
    if (result.reused && result.job.status !== "queued") return workspaceResponse({ ok: true, job: { id: result.job.id, status: result.job.status, creditsReserved: result.job.creditsReserved }, customerBalance: result.customerBalance, reused: true }, 202);
    if (result.job.creditsReserved !== expectedCredits) {
      await settleGenerationJobRelational({ siteId, jobId: result.job.id, requestId: `req_${result.job.id}`, status: "failed", error: "workspace_quote_price_changed" });
      throw new WorkspaceError("workspace_quote_price_changed", 409);
    }
    const dispatched = await dispatchWorkspaceJob({ siteId, customerId, job: result.job, siteAiApp: result.siteAiApp, baseUrls, failureCode: "workspace_image_generation_failed" });
    return workspaceResponse({ ok: true, job: { id: result.job.id, status: result.job.status, creditsReserved: result.job.creditsReserved }, customerBalance: result.customerBalance,
      reused: result.reused || dispatched.admission.state !== "claimed", dispatchNote: dispatched.note }, 202);
  } catch (error) { return workspaceFailure(error); }
}
