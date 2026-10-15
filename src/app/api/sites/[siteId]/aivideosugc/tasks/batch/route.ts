import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { assertOwnedImages, catalogForCustomer, jsonBody, parseInput, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { defaultTaskInput, sceneSchema } from "@/lib/aidreamcapes-workspace/catalogs";
import { validateTaskInput } from "@/lib/aidreamcapes-workspace/pipeline";
import { createBatchDrafts, type BatchInputItem } from "@/lib/aidreamcapes-workspace/batch";
import { publicTask } from "@/lib/aidreamcapes-workspace/store";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };
type ItemFailure = { index: number; error: string };

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code;
  return "task_creation_failed";
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;

    const requestKey = request.headers.get("idempotency-key")?.trim();
    if (!requestKey || requestKey.length > 200) return workspaceResponse({ error: "idempotency_key_required" }, 400);

    const body = await jsonBody(request);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 10) {
      return workspaceResponse({ error: "batch_items_invalid" }, 400);
    }

    const catalog = await catalogForCustomer(siteId, auth.current.customer.id);
    const items: BatchInputItem[] = [];
    const validationFailures: ItemFailure[] = [];
    for (const [index, raw] of body.items.entries()) {
      try {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new WorkspaceError("batch_item_invalid");
        const item = raw as Record<string, unknown>;
        if (typeof item.sceneId !== "string") throw new WorkspaceError("workspace_scene_invalid");
        const scene = sceneSchema(item.sceneId);
        const input = item.input === undefined ? defaultTaskInput(scene.id) : parseInput(item.input);
        const validated = validateTaskInput(scene.id, input, catalog.actors, false, catalog.models);
        await assertOwnedImages(siteId, auth.current.customer.id, validated, catalog.actors);
        if (item.title !== undefined && typeof item.title !== "string") throw new WorkspaceError("task_title_invalid");
        items.push({ sceneId: scene.id, input: validated, ...(typeof item.title === "string" ? { title: item.title } : {}) });
      } catch (error) {
        validationFailures.push({ index, error: errorCode(error) });
      }
    }

    // Validation is all-or-nothing so a malformed request never leaves a partial batch.
    if (validationFailures.length) return workspaceResponse({ tasks: [], failed: validationFailures }, 400);

    const snapshot = await createBatchDrafts({ siteId, customerId: auth.current.customer.id, idempotencyKey: requestKey, items, actors: catalog.actors });
    const tasks = snapshot.tasks.map(task => ({ ...publicTask(task), batch: task.batch }));
    return workspaceResponse({ batch: snapshot.batch, tasks }, 201);
  } catch (error) {
    return workspaceFailure(error);
  }
}
