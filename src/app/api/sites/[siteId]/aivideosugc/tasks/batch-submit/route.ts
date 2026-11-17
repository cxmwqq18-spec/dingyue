import { after, type NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { assertOwnedImages, catalogForCustomer, jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { defaultTaskInput, sceneSchema, WORKSPACE_ASPECTS, WORKSPACE_DURATIONS } from "@/lib/aidreamcapes-workspace/catalogs";
import { validateTaskInput } from "@/lib/aidreamcapes-workspace/pipeline";
import { createBatchDrafts, mockBatchRunner, resumeBatch, type BatchInputItem } from "@/lib/aidreamcapes-workspace/batch";
import { productionBatchRunner } from "@/lib/aidreamcapes-workspace/batch-executor";
import { publicTask } from "@/lib/aidreamcapes-workspace/store";
import { quoteComposerGeneration } from "@/lib/aidreamcapes-workspace/provider";
import { getCustomerAssetsRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { prisma } from "@/lib/prisma";
import { WorkspaceError, type SceneId, type TaskInput } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ siteId: string }> };

/** Bulk ceiling for the one-shot submit endpoint; the plain batch route keeps its 10-item default. */
const MAX_SUBMIT_ITEMS = Number(process.env.AIVIDEOSUGC_BATCH_SUBMIT_MAX_ITEMS) || 100;
const MAX_PROMPT_LENGTH = 10_000;

type ItemFailure = { index: number; error: string };

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code;
  return "task_creation_failed";
}

interface SubmitItem {
  tag?: unknown; title?: unknown; prompt?: unknown;
  referenceImageAssetIds?: unknown;
  duration?: unknown; aspect?: unknown; resolution?: unknown; modelId?: unknown;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

/**
 * One-shot batch submit (P1 批量生成): creates the batch drafts AND starts the
 * production executor (storyboard → quoted clip dispatch → stitch), then
 * returns immediately. Reference images must already be customer assets
 * (uploaded via reference-upload); ownership is re-validated here.
 */
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const customerId = auth.current.customer.id;

    const requestKey = request.headers.get("idempotency-key")?.trim();
    if (!requestKey || requestKey.length > 200) return workspaceResponse({ error: "idempotency_key_required" }, 400);

    const body = await jsonBody(request) as { items?: unknown; validate?: unknown };
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_SUBMIT_ITEMS) {
      return workspaceResponse({ error: "batch_items_invalid", maxItems: MAX_SUBMIT_ITEMS }, 400);
    }
    const validateOnly = body.validate === true;

    const catalog = await catalogForCustomer(siteId, customerId);
    const imageLimit = catalog.imageReferenceMax ?? 4;

    const { assets } = await getCustomerAssetsRelational({ siteId, customerId });
    const ownedPreviewById = new Map(assets
      .filter((asset) => asset.siteId === siteId && asset.customerId === customerId && !asset.deletedAt)
      .map((asset) => [asset.id, toThemeRuntimeAssetRelational(asset).previewUrl]));

    const items: BatchInputItem[] = [];
    const failures: ItemFailure[] = [];
    for (const [index, raw] of body.items.entries()) {
      try {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new WorkspaceError("batch_item_invalid");
        const item = raw as SubmitItem;
        const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
        if (prompt.length < 1 || prompt.length > MAX_PROMPT_LENGTH) throw new WorkspaceError("workspace_prompt_invalid");

        const duration = item.duration === undefined ? 30 : Number(item.duration);
        if (!Number.isSafeInteger(duration) || !(WORKSPACE_DURATIONS as readonly number[]).includes(duration)) throw new WorkspaceError("invalid_options");
        const aspect = typeof item.aspect === "string" ? item.aspect : "9:16";
        if (!(WORKSPACE_ASPECTS as readonly string[]).includes(aspect)) throw new WorkspaceError("invalid_options");
        const resolution = typeof item.resolution === "string" ? item.resolution : "1080p";
        const modelId = typeof item.modelId === "string" && item.modelId.trim() ? item.modelId.trim() : undefined;

        const sceneId: SceneId = "process_demo";
        const scene = sceneSchema(sceneId);
        const assetIds = stringArray(item.referenceImageAssetIds);
        const referenceUrls = assetIds.map((id) => ownedPreviewById.get(id)).filter((url): url is string => Boolean(url));
        if (referenceUrls.length !== assetIds.length) throw new WorkspaceError("workspace_reference_not_owned", 403);
        if (referenceUrls.length < 1 || referenceUrls.length > imageLimit) throw new WorkspaceError("workspace_reference_count_invalid", 422);

        const input: TaskInput = defaultTaskInput(sceneId);
        input.options.duration = duration as TaskInput["options"]["duration"];
        input.options.aspect = aspect as TaskInput["options"]["aspect"];
        input.options.resolution = resolution;
        if (modelId) input.modelId = modelId;
        const imageField = scene.sections.flatMap((section) => section.fields).find((field) => field.type === "images" && field.required);
        const requiredText = scene.sections.flatMap((section) => section.fields).find((field) => field.required && (field.type === "text" || field.type === "textarea"));
        if (!imageField || !requiredText) throw new WorkspaceError("workspace_scene_invalid");
        input.images[imageField.id] = referenceUrls;
        input.fields[requiredText.id] = prompt;
        // Direct path: the prompt is the complete provider direction, exactly
        // like the interactive composer's direct mode.
        input.direct = true;
        input.creativeDirection = prompt;

        const validated = validateTaskInput(sceneId, input, catalog.actors, false, catalog.models);
        await assertOwnedImages(siteId, customerId, validated, catalog.actors);
        const title = typeof item.tag === "string" && item.tag.trim()
          ? item.tag.trim()
          : typeof item.title === "string" ? item.title.trim() : "";
        items.push({ sceneId, input: validated, ...(title ? { title: title.slice(0, 160) } : {}) });
      } catch (error) {
        failures.push({ index, error: errorCode(error) });
      }
    }
    if (failures.length) return workspaceResponse({ tasks: [], failed: failures }, 400);

    // Balance pre-check with the same pricing path the confirm dialog uses, so
    // a bulk run never starts when it cannot be paid through.
    let totalCredits = 0;
    for (const item of items) {
      const quote = await quoteComposerGeneration({
        siteId, direct: true, modelId: item.input.modelId, duration: item.input.options.duration,
        aspect: item.input.options.aspect, resolution: item.input.options.resolution,
        imageInputCount: Object.values(item.input.images).flat().length, videoInputCount: 0, audioInputCount: 0
      });
      if (!quote.available || !Number.isSafeInteger(quote.credits)) {
        return workspaceResponse({ error: quote.reason || "workspace_video_provider_unavailable" }, 422);
      }
      totalCredits += quote.credits!;
    }
    // balance is the net spendable amount: reserving already moves credits out
    // of balance into reserved, so subtracting reserved here double-counts and
    // rejects affordable batches.
    const balance = await prisma.creditBalance.findFirst({ where: { siteId, customerId }, select: { balance: true } });
    const available = balance?.balance ?? 0;
    if (totalCredits > available) {
      return workspaceResponse({ error: "insufficient_batch_credits", required: totalCredits, available }, 402);
    }

    const quoteSummary = { creditsPerItem: items.length ? Math.round(totalCredits / items.length) : 0, totalCredits, available };

    if (validateOnly) {
      return workspaceResponse({ validateOnly: true, items: items.length, quote: quoteSummary, failed: [] }, 200);
    }

    const snapshot = await createBatchDrafts({
      siteId, customerId, idempotencyKey: requestKey, items, actors: catalog.actors, maxItems: MAX_SUBMIT_ITEMS
    });

    // Execute outside the request; resumeBatch owns claim/lease/finish and the
    // runner advances each item to its final stitched video. A crashed worker
    // is recovered by re-invoking the batch resume endpoint.
    const batchId = snapshot.batch.batchId;
    const expectedRevision = snapshot.batch.revision;
    const runner = productionBatchRunner() ?? mockBatchRunner;
    after(async () => {
      try {
        await resumeBatch({ siteId, customerId, batchId, expectedRevision, runner });
      } catch (error) {
        console.error("[aivideosugc-workspace] batch submit execution", error);
      }
    });

    return workspaceResponse({ batch: snapshot.batch, tasks: snapshot.tasks.map(task => ({ ...publicTask(task), batch: task.batch })), quote: quoteSummary }, 201);
  } catch (error) {
    return workspaceFailure(error);
  }
}

export async function GET() {
  return new Response(null, { status: 200, headers: { Allow: "POST,OPTIONS" } });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "POST,OPTIONS" } });
}
