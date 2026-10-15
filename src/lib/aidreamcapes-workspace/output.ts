import "server-only";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveTaskRenderFile, storyboardRenderHash } from "./media-render";
import { mockShotClipForOutput } from "./mock-runtime";
import { WorkspaceError, type WorkspaceTask } from "./types";

export type WorkspaceOutputKind = "video" | "subtitles" | "clip";

function renderRoot() {
  return path.resolve(process.env.AIVIDEOSUGC_RENDER_ROOT?.trim() || path.join(process.cwd(), "data", "aidreamcapes-workspace-render"));
}

function outputUrl(task: WorkspaceTask, kind: Exclude<WorkspaceOutputKind, "clip">) {
  return `/api/sites/${task.siteId}/aivideosugc/tasks/${task.taskId}/output?kind=${kind}`;
}

function mapFilesystemError(error: unknown): never {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT" || code === "ENOTDIR") throw new WorkspaceError("workspace_output_missing", 404);
  throw new WorkspaceError("workspace_output_unavailable", 503);
}

/** Resolve a customer download. Mock renders are rejected by default, which keeps them out of publishing flows. */
export async function resolveWorkspaceOutput(
  task: WorkspaceTask,
  kind: WorkspaceOutputKind,
  options: { allowMockDownload?: boolean; shotId?: string; versionId?: string } = {},
) {
  const video = task.video;
  if (task.status !== "completed" || !video || video.status !== "done" || !video.renderId) {
    throw new WorkspaceError("workspace_video_not_ready", 404);
  }
  if (video.stale || task.storyboardStale || !task.storyboard || video.storyboardHash !== storyboardRenderHash(task)) {
    throw new WorkspaceError("workspace_output_stale", 409);
  }

  const taggedMockClip = video.clips.some((clip) => task.storyboard!.shots.some((shot) => shot.shotId === clip.shotId &&
    shot.versions.some((version) => version.vid === clip.vid && (version as typeof version & { mock?: boolean }).mock === true)));
  const mockRender = (video as typeof video & { mock?: boolean }).mock === true || taggedMockClip;
  if (mockRender && !options.allowMockDownload) throw new WorkspaceError("workspace_mock_output_unpublishable", 409);
  if (kind === "clip" && !mockRender) throw new WorkspaceError("workspace_output_kind_invalid", 400);

  let file: { path: string; contentType: string; filename: string };
  let expectedPath: string;
  if (kind === "clip") {
    if (!options.shotId || !options.versionId) throw new WorkspaceError("workspace_output_kind_invalid", 400);
    file = mockShotClipForOutput(task, options.shotId, options.versionId);
    expectedPath = path.resolve(renderRoot(), task.siteId, task.customerId, task.taskId, "mock-clips", options.shotId, `${options.versionId}.mp4`);
  } else {
    const expectedUrl = outputUrl(task, kind);
    if (kind === "video" && video.finalUrl !== expectedUrl) throw new WorkspaceError("workspace_output_stale", 409);
    if (kind === "subtitles") {
      if (!video.subtitleUrl) throw new WorkspaceError("workspace_subtitles_not_available", 404);
      if (video.subtitleUrl !== expectedUrl) throw new WorkspaceError("workspace_output_stale", 409);
    }
    file = resolveTaskRenderFile(task, kind);
    expectedPath = path.resolve(renderRoot(), task.siteId, task.customerId, task.taskId, video.renderId,
      kind === "video" ? "final.mp4" : "subtitles.srt");
  }

  const root = renderRoot();
  const filePath = path.resolve(file.path);
  if (filePath !== expectedPath) throw new WorkspaceError("workspace_output_path_invalid", 404);

  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const rootReal = await fs.realpath(root);
    const renderDirectoryReal = await fs.realpath(path.dirname(filePath));
    const expectedDirectoryReal = path.join(rootReal, path.relative(root, path.dirname(filePath)));
    if (renderDirectoryReal !== expectedDirectoryReal) throw new WorkspaceError("workspace_output_path_invalid", 404);

    const [entry, fileReal] = await Promise.all([fs.lstat(filePath), fs.realpath(filePath)]);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.size === 0) throw new WorkspaceError("workspace_output_missing", 404);
    const expectedFileReal = path.join(renderDirectoryReal, path.basename(filePath));
    const relative = path.relative(renderDirectoryReal, fileReal);
    if (fileReal !== expectedFileReal || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new WorkspaceError("workspace_output_path_invalid", 404);
    }
    handle = await fs.open(fileReal, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size === 0 || opened.dev !== entry.dev || opened.ino !== entry.ino) {
      await handle.close();
      handle = undefined;
      throw new WorkspaceError("workspace_output_missing", 404);
    }
    const result = { ...file, path: fileReal, size: opened.size, handle };
    handle = undefined;
    return result;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof WorkspaceError) throw error;
    return mapFilesystemError(error);
  }
}
