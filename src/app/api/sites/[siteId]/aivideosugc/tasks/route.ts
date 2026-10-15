import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody, parseInput, assertOwnedImages } from "@/lib/aidreamcapes-workspace/api";
import { createTask, listTasks, publicTask } from "@/lib/aidreamcapes-workspace/store";
import { sceneSchema, defaultTaskInput } from "@/lib/aidreamcapes-workspace/catalogs";
import { validateTaskInput } from "@/lib/aidreamcapes-workspace/pipeline";
import { catalogForCustomer } from "@/lib/aidreamcapes-workspace/api";
import { normalizeConfirmedProductBrief } from "@/lib/aidreamcapes-workspace/product-brief-snapshot";
import { resolveWorkspacePreset } from "@/lib/aidreamcapes-workspace/presets.server";
import type { WorkspacePresetRequest } from "@/lib/aidreamcapes-workspace/preset-contract";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  try { const { siteId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response; return workspaceResponse({ tasks: (await listTasks(siteId, auth.current.customer.id)).map(publicTask) }); }
  catch (error) { return workspaceFailure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params; const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response;
    const body = await jsonBody(request); const scene = sceneSchema(String(body.sceneId));
    let sourceTemplate;
    if (body.preset !== undefined) {
      const preset = body.preset && typeof body.preset === "object" && !Array.isArray(body.preset) ? body.preset as Record<string, unknown> : undefined;
      if (!preset || typeof preset.sourcePage !== "string" || typeof preset.presetId !== "string" || typeof preset.sourceUpdatedAt !== "string") throw new WorkspaceError("workspace_template_request_invalid");
      const resolved = await resolveWorkspacePreset(siteId, { sourcePage: preset.sourcePage, presetId: preset.presetId } satisfies WorkspacePresetRequest);
      if (!resolved || resolved.kind !== "video") throw new WorkspaceError("workspace_template_not_found", 404);
      if (resolved.sourceUpdatedAt !== preset.sourceUpdatedAt) throw new WorkspaceError("workspace_template_changed", 409);
      sourceTemplate = resolved;
    }
    const productBrief = body.productBrief === undefined ? undefined : normalizeConfirmedProductBrief(body.productBrief);
    const input = body.input ? parseInput(body.input) : defaultTaskInput(scene.id);
    const catalog = await catalogForCustomer(siteId, auth.current.customer.id); validateTaskInput(scene.id, input, catalog.actors, false, catalog.models); await assertOwnedImages(siteId, auth.current.customer.id, input, catalog.actors);
    return workspaceResponse({ task: publicTask(await createTask(siteId, auth.current.customer.id, scene.id, input, catalog.actors, sourceTemplate?.title ?? (typeof body.title === "string" ? body.title : undefined), request.headers.get("idempotency-key")?.slice(0, 180), productBrief, sourceTemplate)) }, 201);
  } catch (error) { return workspaceFailure(error); }
}
