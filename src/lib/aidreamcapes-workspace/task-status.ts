import type { WorkspaceTask } from "./types";

/**
 * Single source of truth for the library/editor/detail status display.
 * The four previous ad-hoc derivations (statusLabels, taskNeedsAttention,
 * the card badge precedence and the detail modal statusWord) all consume
 * this one function so a task can no longer show different states in
 * different places.
 *
 * Precedence: cancelled → completed → in-flight (planning/generating/
 * rendering) → failed (only when nothing is in flight) → ready → draft.
 * A shot counts as failed only when its CURRENT version failed, so an old
 * failed attempt never drags a task with a finished clip into "Needs
 * attention".
 */
export type DerivedTaskStatus = "cancelled" | "completed" | "rendering" | "generating" | "planning" | "failed" | "ready" | "draft";
export type TaskFailureStage = "planning" | "shot" | "composite" | "render";

export interface TaskStatusView {
  status: DerivedTaskStatus;
  failureStage?: TaskFailureStage;
  failureCode?: string;
}

type StoryboardShot = NonNullable<WorkspaceTask["storyboard"]>["shots"][number];

const RETENTION_EXPIRED_CODE = "workspace_clip_retention_expired";

/**
 * Judges only the shot's CURRENT version: an old failed attempt with a newer
 * finished version never fails the task. Returns the failure code to surface.
 */
function shotCurrentFailure(shot: StoryboardShot): string | undefined {
  const version = shot.versions?.find((item) => item.vid === shot.curVer) ?? shot.versions?.at(-1);
  if (version?.status === "expired" || shot.genStatus === "expired") return RETENTION_EXPIRED_CODE;
  if (shot.genStatus === "fail" && shot.error && (!version || version.status !== "done")) return shot.error;
  return undefined;
}

export function deriveTaskStatus(task: WorkspaceTask): TaskStatusView {
  if (task.status === "cancelled") return { status: "cancelled" };
  const shots = task.storyboard?.shots ?? [];
  const operation = task.operation;
  const opInFlight = Boolean(operation && ["pending", "run"].includes(operation.state));
  const shotInFlight = shots.some((shot) => shot.genStatus === "run" || shot.compositeStatus === "run");
  const finished = Boolean(task.video?.finalUrl);

  if (task.status === "completed" && finished) return { status: "completed" };
  if (opInFlight) {
    if (operation!.action === "render") return { status: "rendering" };
    if (operation!.action === "generate_shot" || operation!.action === "compose_shot") return { status: "generating" };
    return { status: "planning" };
  }
  if (shotInFlight) return { status: "generating" };
  if (task.status === "rendering") return { status: "rendering" };
  if (finished) return { status: "completed" };

  // Failure checks run only when nothing is in flight, so polling windows
  // always read as generating/rendering, never as a failure.
  if (operation?.state === "fail") {
    const stage: TaskFailureStage = operation.action === "render" ? "render"
      : operation.action === "compose_shot" ? "composite"
      : operation.action === "generate_shot" ? "shot" : "planning";
    return { status: "failed", failureStage: stage, failureCode: operation.error ?? task.error ?? undefined };
  }
  if (task.status === "failed" || task.video?.status === "fail") {
    const failedShotCode = shots.map((shot) => shotCurrentFailure(shot)).find(Boolean);
    return {
      status: "failed",
      failureStage: task.status === "failed" ? "render" : "shot",
      failureCode: task.error ?? failedShotCode ?? task.video?.error ?? undefined
    };
  }
  const failedShotCode = shots.map((shot) => shotCurrentFailure(shot)).find(Boolean);
  if (failedShotCode) {
    const failedShot = shots.find((shot) => shotCurrentFailure(shot));
    return { status: "failed", failureStage: failedShot?.compositeStatus === "fail" ? "composite" : "shot", failureCode: failedShotCode };
  }

  if (shots.length > 0) return { status: "ready" };
  return { status: "draft" };
}

/** True when the task has work in flight (planning, generating or rendering). */
export function taskStatusInFlight(view: TaskStatusView): boolean {
  return view.status === "planning" || view.status === "generating" || view.status === "rendering";
}
