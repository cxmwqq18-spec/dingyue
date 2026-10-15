import "server-only";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { constants } from "node:fs";
import { WorkspaceError, type WorkspaceTask } from "./types";
import { assertWorkspaceSite } from "./catalogs";
import { isWorkspaceStabilityMockMode } from "./stability";

const run = promisify(execFile);
const MOCK_BALANCE = 1_000;
const SAFE_ID = /^[a-zA-Z0-9_-]{1,180}$/;
type ReservationState = "held" | "settled" | "refunded" | "cancelled";
type Reservation = { key: string; siteId: string; customerId: string; taskId: string; operationId: string; credits: number; state: ReservationState };
type Ledger = { available: number; reserved: number; spent: number; reservations: Map<string, Reservation> };
const ledgers = new Map<string, Ledger>();

function requireMockMode() {
  if (!isWorkspaceStabilityMockMode()) throw new WorkspaceError("workspace_stability_mock_mode_required", 409);
}

function safeId(value: string) {
  if (!SAFE_ID.test(value)) throw new WorkspaceError("workspace_render_identifier_invalid", 400);
  return value;
}

function ledgerKey(siteId: string, customerId: string) {
  assertWorkspaceSite(siteId);
  return `${siteId}:${safeId(customerId)}`;
}

function ledgerFor(siteId: string, customerId: string): Ledger {
  const key = ledgerKey(siteId, customerId);
  let ledger = ledgers.get(key);
  if (!ledger) {
    ledger = { available: MOCK_BALANCE, reserved: 0, spent: 0, reservations: new Map() };
    ledgers.set(key, ledger);
  }
  return ledger;
}

function reservationKey(siteId: string, customerId: string, taskId: string, operationId: string) {
  if (typeof operationId !== "string" || operationId.length < 1 || operationId.length > 180 || /[\u0000-\u001f\u007f]/u.test(operationId)) {
    throw new WorkspaceError("workspace_mock_operation_invalid", 400);
  }
  return `${ledgerKey(siteId, customerId)}:${safeId(taskId)}:${encodeURIComponent(operationId)}`;
}

/** In-process only; never connects to customer credits, generation jobs, or a platform ledger. */
export function reserveMockCredits(input: { siteId: string; customerId: string; taskId: string; operationId: string; credits: number }) {
  requireMockMode();
  if (!Number.isSafeInteger(input.credits) || input.credits < 0) throw new WorkspaceError("workspace_mock_quote_invalid", 422);
  const ledger = ledgerFor(input.siteId, input.customerId);
  const key = reservationKey(input.siteId, input.customerId, input.taskId, input.operationId);
  const prior = ledger.reservations.get(key);
  if (prior) {
    if (prior.credits !== input.credits) throw new WorkspaceError("workspace_mock_reservation_conflict", 409);
    return { ...prior };
  }
  if (ledger.available < input.credits) throw new WorkspaceError("workspace_mock_credits_insufficient", 402);
  const reservation: Reservation = { ...input, key, state: "held" };
  ledger.available -= input.credits;
  ledger.reserved += input.credits;
  ledger.reservations.set(key, reservation);
  return { ...reservation };
}

function findReservation(input: { siteId: string; customerId: string; taskId: string; operationId: string }) {
  requireMockMode();
  const ledger = ledgerFor(input.siteId, input.customerId);
  const key = reservationKey(input.siteId, input.customerId, input.taskId, input.operationId);
  const reservation = ledger.reservations.get(key);
  if (!reservation) throw new WorkspaceError("workspace_mock_reservation_missing", 404);
  return { ledger, reservation };
}

export function settleMockCredits(input: { siteId: string; customerId: string; taskId: string; operationId: string }) {
  const { ledger, reservation } = findReservation(input);
  if (reservation.state === "settled") return { ...reservation };
  if (reservation.state !== "held") throw new WorkspaceError("workspace_mock_reservation_state_conflict", 409);
  ledger.reserved -= reservation.credits;
  ledger.spent += reservation.credits;
  reservation.state = "settled";
  return { ...reservation };
}

function releaseMockCredits(input: { siteId: string; customerId: string; taskId: string; operationId: string }, state: "refunded" | "cancelled") {
  const { ledger, reservation } = findReservation(input);
  if (reservation.state === state) return { ...reservation };
  if (reservation.state !== "held") throw new WorkspaceError("workspace_mock_reservation_state_conflict", 409);
  ledger.reserved -= reservation.credits;
  ledger.available += reservation.credits;
  reservation.state = state;
  return { ...reservation };
}

export function refundMockCredits(input: { siteId: string; customerId: string; taskId: string; operationId: string }) {
  return releaseMockCredits(input, "refunded");
}

export function cancelMockCredits(input: { siteId: string; customerId: string; taskId: string; operationId: string }) {
  return releaseMockCredits(input, "cancelled");
}

export function mockLedgerSnapshot(siteId: string, customerId: string) {
  requireMockMode();
  const ledger = ledgerFor(siteId, customerId);
  return {
    initial: MOCK_BALANCE,
    available: ledger.available,
    reserved: ledger.reserved,
    spent: ledger.spent,
    reservations: [...ledger.reservations.values()].map((reservation) => ({ ...reservation })),
  };
}

function renderRoot() {
  return path.resolve(process.env.AIVIDEOSUGC_RENDER_ROOT?.trim() || path.join(process.cwd(), "data", "aidreamcapes-workspace-render"));
}

export function mockShotClipPath(task: Pick<WorkspaceTask, "siteId" | "customerId" | "taskId">, shotId: string, versionId: string) {
  assertWorkspaceSite(task.siteId);
  return path.join(renderRoot(), task.siteId, safeId(task.customerId), safeId(task.taskId), "mock-clips", safeId(shotId), `${safeId(versionId)}.mp4`);
}

export function mockShotClipUrl(task: Pick<WorkspaceTask, "siteId" | "taskId">, shotId: string, versionId: string) {
  assertWorkspaceSite(task.siteId);
  const query = new URLSearchParams({ kind: "clip", shotId: safeId(shotId), versionId: safeId(versionId) });
  return `/api/sites/${task.siteId}/aivideosugc/tasks/${safeId(task.taskId)}/output?${query.toString()}`;
}

async function createSyntheticClip(file: string, duration: number) {
  try {
    await run(process.env.AIVIDEOSUGC_FFMPEG_BIN?.trim() || "ffmpeg", [
      "-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=0x204060:s=640x360:r=30",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", String(duration), "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", file,
    ], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new WorkspaceError("workspace_mock_ffmpeg_unavailable", 503);
    throw new WorkspaceError("workspace_mock_media_generation_failed", 502);
  }
}

export async function createMockShotClip(task: WorkspaceTask, shotId: string, versionId: string, duration: number) {
  requireMockMode();
  if (!Number.isFinite(duration) || duration <= 0 || duration > 30) throw new WorkspaceError("workspace_mock_media_duration_invalid", 422);
  const file = mockShotClipPath(task, shotId, versionId);
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const root = renderRoot();
  const rootReal = await fs.realpath(root);
  const relativeDirectory = path.relative(root, path.dirname(file));
  if (!relativeDirectory || relativeDirectory.startsWith("..") || path.isAbsolute(relativeDirectory) || await fs.realpath(path.dirname(file)) !== path.join(rootReal, relativeDirectory)) {
    throw new WorkspaceError("workspace_mock_media_path_invalid", 404);
  }
  try {
    const entry = await fs.lstat(file);
    if (entry.isFile() && !entry.isSymbolicLink() && entry.size > 0) return file;
    throw new WorkspaceError("workspace_mock_media_path_invalid", 404);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporaryFile = path.join(path.dirname(file), `${safeId(versionId)}.pending-${randomUUID()}.mp4`);
  try {
    await createSyntheticClip(temporaryFile, duration);
    const generated = await fs.lstat(temporaryFile);
    if (!generated.isFile() || generated.isSymbolicLink() || generated.size === 0) throw new WorkspaceError("workspace_mock_media_generation_failed", 502);
    await fs.rename(temporaryFile, file);
  } catch (error) {
    await fs.rm(temporaryFile, { force: true }).catch(() => undefined);
    throw error;
  }
  const entry = await fs.lstat(file);
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size === 0) throw new WorkspaceError("workspace_mock_media_generation_failed", 502);
  return file;
}

async function readContainedMockFile(file: string) {
  const root = renderRoot();
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const rootReal = await fs.realpath(root);
    const directoryReal = await fs.realpath(path.dirname(file));
    const expectedDirectory = path.join(rootReal, path.relative(root, path.dirname(file)));
    if (directoryReal !== expectedDirectory) throw new WorkspaceError("workspace_mock_media_path_invalid", 404);
    const [entry, fileReal] = await Promise.all([fs.lstat(file), fs.realpath(file)]);
    const relative = path.relative(directoryReal, fileReal);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.size === 0 || relative !== path.basename(file) || path.isAbsolute(relative)) {
      throw new WorkspaceError("workspace_mock_media_path_invalid", 404);
    }
    handle = await fs.open(fileReal, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size === 0 || opened.dev !== entry.dev || opened.ino !== entry.ino) throw new WorkspaceError("workspace_mock_media_path_invalid", 404);
    const bytes = await handle.readFile();
    await handle.close();
    handle = undefined;
    return bytes;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof WorkspaceError) throw error;
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT" || code === "ENOTDIR") throw new WorkspaceError("workspace_mock_media_missing", 404);
    throw new WorkspaceError("workspace_mock_media_unavailable", 503);
  }
}

export async function readMockShotClip(task: WorkspaceTask, url: string, shotId: string, versionId: string) {
  requireMockMode();
  if (url !== mockShotClipUrl(task, shotId, versionId)) throw new WorkspaceError("workspace_mock_clip_url_invalid", 403);
  return readContainedMockFile(mockShotClipPath(task, shotId, versionId));
}

export function mockShotClipForOutput(task: WorkspaceTask, shotId: string, versionId: string) {
  requireMockMode();
  safeId(shotId);
  safeId(versionId);
  const shot = task.storyboard?.shots.find((entry) => entry.shotId === shotId);
  const version = shot?.versions.find((entry) => entry.vid === versionId);
  if (!shot || !version || (version as typeof version & { mock?: boolean }).mock !== true || version.clipUrl !== mockShotClipUrl(task, shotId, versionId)) {
    throw new WorkspaceError("workspace_output_not_found", 404);
  }
  if (shot.curVer !== versionId || !task.video?.clips.some((clip) => clip.shotId === shotId && clip.vid === versionId)) {
    throw new WorkspaceError("workspace_output_stale", 409);
  }
  return { path: mockShotClipPath(task, shotId, versionId), contentType: "video/mp4", filename: `${task.taskId}-${shotId}-${versionId}.mp4` };
}
