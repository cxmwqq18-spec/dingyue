import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { expectedRevision, jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { getMusicCatalogTrackForCustomer } from "@/lib/aidreamcapes-workspace/music-catalog";
import { evaluateMusicRights, normalizeMusicTerritory } from "@/lib/aidreamcapes-workspace/music-catalog-rights";
import { getTask, publicTask, saveTask } from "@/lib/aidreamcapes-workspace/store";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; trackId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, trackId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await jsonBody(request);
    const revision = expectedRevision(request, body);
    if (typeof body.taskId !== "string" || !body.taskId.trim()) throw new WorkspaceError("task_id_required");
    const territory = normalizeMusicTerritory(body.territory);
    if (!territory) throw new WorkspaceError("music_territory_invalid");
    if (body.usage !== undefined && body.usage !== "ads") throw new WorkspaceError("music_ads_license_required", 422);

    const customerId = auth.current.customer.id;
    const task = await getTask(siteId, customerId, body.taskId.trim());
    if (task.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
    if (task.operation?.state === "pending" || task.operation?.state === "run" ||
        task.storyboard?.shots.some((shot) => shot.genStatus === "run" || shot.compositeStatus === "run")) {
      throw new WorkspaceError("task_busy", 409);
    }
    if (task.input.musicUrl) throw new WorkspaceError("music_source_conflict", 409);

    const { track, license } = await getMusicCatalogTrackForCustomer(siteId, customerId, trackId);
    const decision = evaluateMusicRights({ track, license, siteId, customerId, territory, usage: "ads" });
    if (!decision.allowed) throw new WorkspaceError(decision.code, 403);
    if (!license) throw new WorkspaceError("music_license_required", 403);

    const previousSelection = task.musicSelection ?? null;
    task.musicSelection = {
      trackId: track.id,
      licenseId: license.id,
      licenseRevision: license.revision,
      territory,
      usage: "ads",
      attributionRequired: decision.attributionRequired,
      ...(decision.attributionRequired && decision.attributionText ? { attributionText: decision.attributionText } : {}),
      attachedAt: new Date().toISOString(),
    };
    task.revisions = [...task.revisions, {
      at: task.musicSelection.attachedAt,
      field: "musicSelection",
      before: previousSelection,
      after: task.musicSelection,
    }].slice(-100);
    if (task.video) task.video.stale = true;
    const saved = await saveTask(task, revision);

    return workspaceResponse({
      task: publicTask(saved),
      track: { id: track.id, title: track.title, artist: track.artist, attributionText: task.musicSelection.attributionText },
    });
  } catch (error) {
    return workspaceFailure(error);
  }
}
