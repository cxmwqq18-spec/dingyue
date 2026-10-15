import type { NextRequest } from "next/server";
import { developerFailure, developerResponse, developerJsonBody } from "@/lib/aidreamcapes-workspace/developer-http";
import { authenticateDeveloperKey, assertDeveloperDraftAssets, developerIdempotencyKey, parseDeveloperTaskInput } from "@/lib/aidreamcapes-workspace/developer-api";
import { enqueueTaskCreatedWebhook } from "@/lib/aidreamcapes-workspace/webhooks";
import { createTask, listTasks, publicTask } from "@/lib/aidreamcapes-workspace/store";
import { defaultTaskInput, sceneSchema } from "@/lib/aidreamcapes-workspace/catalogs";
import { validateTaskInput } from "@/lib/aidreamcapes-workspace/pipeline";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
import { getWorkspaceCatalog } from "@/lib/aidreamcapes-workspace/provider";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const key = await authenticateDeveloperKey(request, siteId, "read");
    return developerResponse({ tasks: (await listTasks(siteId, key.customerId)).map(publicTask) });
  } catch (error) { return developerFailure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const key = await authenticateDeveloperKey(request, siteId, "write");
    const idempotency = request.headers.get("idempotency-key");
    if (!idempotency) throw new WorkspaceError("idempotency_key_required", 400);
    const idempotencyKey = developerIdempotencyKey(key.id, idempotency);
    const body = await developerJsonBody(request);
    const scene = sceneSchema(typeof body.sceneId === "string" ? body.sceneId : "texture_closeup");
    const input = parseDeveloperTaskInput(scene.id, body.input ?? defaultTaskInput(scene.id));
    const catalog = await getWorkspaceCatalog(siteId);
    validateTaskInput(scene.id, input, [], false, catalog.models);
    await assertDeveloperDraftAssets(siteId, key.customerId, input);
    const task = await createTask(siteId, key.customerId, scene.id, input, [], typeof body.title === "string" ? body.title : undefined, idempotencyKey);
    await enqueueTaskCreatedWebhook(siteId, key.customerId, { taskId: task.taskId, title: task.title, status: task.status, revision: task.revision, createdAt: task.createdAt });
    return developerResponse({ task: publicTask(task) }, 201);
  } catch (error) { return developerFailure(error); }
}
