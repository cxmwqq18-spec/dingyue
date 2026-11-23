import { after, type NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody, parseInput, assertOwnedImages } from "@/lib/aidreamcapes-workspace/api";
import { createTask, countTasks, listTasks, publicTask, publicTaskSummary } from "@/lib/aidreamcapes-workspace/store";
import { refreshTask, taskHasPendingProviderWork, continueDirectTask, directTaskNeedsServerContinuation } from "@/lib/aidreamcapes-workspace/runner";
import { sceneSchema, defaultTaskInput } from "@/lib/aidreamcapes-workspace/catalogs";
import { validateTaskInput } from "@/lib/aidreamcapes-workspace/pipeline";
import { catalogForCustomer } from "@/lib/aidreamcapes-workspace/api";
import { normalizeConfirmedProductBrief } from "@/lib/aidreamcapes-workspace/product-brief-snapshot";
import { resolveWorkspacePreset } from "@/lib/aidreamcapes-workspace/presets.server";
import type { WorkspacePresetRequest } from "@/lib/aidreamcapes-workspace/preset-contract";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
import { publicUrlForRequest } from "@/lib/session";
import { resolveWorkerBaseUrls } from "@/lib/worker";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    // The library pages one screen at a time (the browser fetches the next
    // page on demand), and `total` lets the pager show the exact page count
    // without walking the list.
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit"));
    const rawOffset = Number(url.searchParams.get("offset"));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.trunc(rawLimit), 100) : 20;
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.trunc(rawOffset) : 0;
    const filter = url.searchParams.get("filter") === "subtitle_ready" ? "subtitle_ready" as const : undefined;
    const rawSubtitle = url.searchParams.get("subtitle");
    const subtitle = rawSubtitle === "with" || rawSubtitle === "without" ? rawSubtitle : undefined;
    const query = url.searchParams.get("q")?.trim() || undefined;
    const [page, total] = await Promise.all([
      listTasks(siteId, auth.current.customer.id, { limit: limit + 1, offset, filter, query, subtitle }),
      countTasks(siteId, auth.current.customer.id, { filter, query, subtitle })
    ]);
    const hasMore = page.length > limit;
    const tasks = page.slice(0, limit);
    // Provider progress used to be refreshed inline for every pending task,
    // which put external I/O in the list's critical path. The browser re-polls
    // in-flight tasks every few seconds and the drawer re-fetches on open, so
    // the refreshes and direct continuations now run after the response.
    const hasProviderWork = tasks.some((task) => taskHasPendingProviderWork(task) || directTaskNeedsServerContinuation(task));
    if (hasProviderWork) {
      const bases = resolveWorkerBaseUrls(publicUrlForRequest(request, "/").origin);
      after(async () => {
        const refreshed = new Map<string, Awaited<ReturnType<typeof refreshTask>>>();
        for (const task of tasks) {
          if (!taskHasPendingProviderWork(task)) continue;
          try {
            const updated = await refreshTask(task).catch(() => task);
            refreshed.set(task.taskId, updated);
          } catch (error) { console.error("[aivideosugc-workspace] library refresh", error); }
        }
        for (const task of tasks) {
          const current = refreshed.get(task.taskId) ?? task;
          if (!directTaskNeedsServerContinuation(current)) continue;
          try { await continueDirectTask(current, bases); }
          catch (error) { console.error("[aivideosugc-workspace] direct continuation", error); }
        }
      });
    }
    return workspaceResponse({ tasks: tasks.map(publicTaskSummary), hasMore, total });
  }
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
