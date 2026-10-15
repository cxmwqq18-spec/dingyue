import { createHash } from "node:crypto";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";

export type MusicGenerationStatus = "queued" | "mock_complete" | "cancelled";
export interface MusicGenerationJob {
  id: string;
  siteId: typeof AIVIDEOSUGC_SITE_ID;
  customerId: string;
  taskId: string;
  taskRevision: number;
  idempotencyKey: string;
  requestHash: string;
  prompt: string;
  durationSeconds: number;
  tempoBpm: number;
  status: MusicGenerationStatus;
  revision: number;
  capabilityState: "mock_only";
  rightsStatus: "unlicensed" | "licensed";
  testOnly: boolean;
  fixtureKey: string | null;
  createdAt: string;
  updatedAt: string;
  queuedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface MusicGenerationRequest {
  taskId: string;
  taskRevision: number;
  prompt: string;
  durationSeconds: number;
  tempoBpm: number;
  idempotencyKey: string;
  rightsAcknowledgedUnlicensed: true;
}

export const MUSIC_GENERATION_ZERO_SIDE_EFFECTS = Object.freeze({
  externalRequestCount: 0 as const,
  providerCalls: 0 as const,
  realLedgerWrites: 0 as const,
});

const SAFE_ID = /^[a-zA-Z0-9_-]{1,180}$/;
const SAFE_IDEMPOTENCY_KEY = /^[a-zA-Z0-9._:-]{1,128}$/;

export function musicGenerationCapabilities(mode = process.env.AIVIDEOSUGC_STABILITY_MODE): Record<string, unknown> {
  const normalized = mode?.trim().toLowerCase();
  if (normalized && normalized !== "live" && normalized !== "mock") {
    throw new WorkspaceError("workspace_stability_mode_invalid", 500);
  }
  const mockOnly = normalized === "mock";
  return {
    capabilityState: mockOnly ? "mock_only" : "not_configured",
    generationAvailable: mockOnly,
    productionReady: false,
    provider: null,
    billing: "none",
    outputPurpose: "test_only",
    rightsStatus: "unlicensed",
    canAttachAsLicensedAdMusic: false,
    canAdvertise: false,
    canPublish: false,
    bounds: { promptCharacters: { min: 1, max: 500 }, durationSeconds: { min: 5, max: 30 }, tempoBpm: { min: 40, max: 200 } },
    ...MUSIC_GENERATION_ZERO_SIDE_EFFECTS,
  };
}

export function assertMusicGenerationMockEnabled(mode = process.env.AIVIDEOSUGC_STABILITY_MODE): void {
  if (musicGenerationCapabilities(mode).capabilityState !== "mock_only") {
    throw new WorkspaceError("music_generation_not_configured", 503);
  }
}

export function validateMusicGenerationRequest(value: Record<string, unknown>, idempotencyHeader?: string | null): MusicGenerationRequest {
  const taskId = value.taskId;
  const taskRevision = value.taskRevision;
  const prompt = typeof value.prompt === "string" ? value.prompt.trim() : "";
  const durationSeconds = value.durationSeconds;
  const tempoBpm = value.tempoBpm ?? 100;
  const idempotencyKey = idempotencyHeader || value.idempotencyKey;
  if (typeof taskId !== "string" || !SAFE_ID.test(taskId)) throw new WorkspaceError("music_generation_task_invalid");
  if (!Number.isSafeInteger(taskRevision) || Number(taskRevision) < 1) throw new WorkspaceError("revision_required", 428);
  if (!prompt || prompt.length > 500 || /[\u0000-\u001f\u007f]/u.test(prompt)) throw new WorkspaceError("music_generation_prompt_invalid", 422);
  if (!Number.isSafeInteger(durationSeconds) || Number(durationSeconds) < 5 || Number(durationSeconds) > 30) {
    throw new WorkspaceError("music_generation_duration_invalid", 422);
  }
  if (!Number.isSafeInteger(tempoBpm) || Number(tempoBpm) < 40 || Number(tempoBpm) > 200) {
    throw new WorkspaceError("music_generation_tempo_invalid", 422);
  }
  if (typeof idempotencyKey !== "string" || !SAFE_IDEMPOTENCY_KEY.test(idempotencyKey)) {
    throw new WorkspaceError("idempotency_key_required");
  }
  if (value.rightsAcknowledgedUnlicensed !== true) throw new WorkspaceError("music_generation_unlicensed_ack_required", 403);
  return {
    taskId,
    taskRevision: Number(taskRevision),
    prompt,
    durationSeconds: Number(durationSeconds),
    tempoBpm: Number(tempoBpm),
    idempotencyKey,
    rightsAcknowledgedUnlicensed: true,
  };
}

export function musicGenerationRequestHash(input: Pick<MusicGenerationRequest, "taskId" | "taskRevision" | "prompt" | "durationSeconds" | "tempoBpm">): string {
  return createHash("sha256").update(JSON.stringify({
    siteId: AIVIDEOSUGC_SITE_ID,
    taskId: input.taskId,
    taskRevision: input.taskRevision,
    prompt: input.prompt,
    durationSeconds: input.durationSeconds,
    tempoBpm: input.tempoBpm,
    rightsStatus: "unlicensed",
    testOnly: true,
  })).digest("hex");
}

export function makeQueuedMusicGenerationJob(input: {
  id: string;
  customerId: string;
  request: MusicGenerationRequest;
  requestHash: string;
  now?: string;
}): MusicGenerationJob {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id,
    siteId: AIVIDEOSUGC_SITE_ID,
    customerId: input.customerId,
    taskId: input.request.taskId,
    taskRevision: input.request.taskRevision,
    idempotencyKey: input.request.idempotencyKey,
    requestHash: input.requestHash,
    prompt: input.request.prompt,
    durationSeconds: input.request.durationSeconds,
    tempoBpm: input.request.tempoBpm,
    status: "queued",
    revision: 1,
    capabilityState: "mock_only",
    rightsStatus: "unlicensed",
    testOnly: true,
    fixtureKey: null,
    createdAt: now,
    updatedAt: now,
    queuedAt: now,
    completedAt: null,
    cancelledAt: null,
  };
}

export function replayMusicGenerationIdempotentJob(existing: MusicGenerationJob | null | undefined, requestHash: string) {
  if (!existing) return null;
  if (existing.requestHash !== requestHash) throw new WorkspaceError("idempotency_conflict", 409);
  return { job: existing, created: false as const };
}

export function transitionMusicGenerationJob(
  job: MusicGenerationJob,
  action: "run_mock" | "cancel",
  expectedRevision: number,
  now = new Date().toISOString(),
  fixtureKey?: string,
): MusicGenerationJob {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new WorkspaceError("revision_required", 428);
  if (job.revision !== expectedRevision) throw new WorkspaceError("revision_conflict", 409);
  if (job.status !== "queued") throw new WorkspaceError(action === "cancel" ? "music_generation_not_cancellable" : "music_generation_not_runnable", 409);
  if (action === "cancel") {
    return { ...job, status: "cancelled", revision: job.revision + 1, updatedAt: now, cancelledAt: now };
  }
  if (!fixtureKey || !/^mock-music\/[a-zA-Z0-9_-]{1,180}\/[a-zA-Z0-9_-]{1,180}\/[a-zA-Z0-9_-]{1,180}\.wav$/.test(fixtureKey)) {
    throw new WorkspaceError("music_generation_fixture_key_invalid", 500);
  }
  return { ...job, status: "mock_complete", revision: job.revision + 1, updatedAt: now, completedAt: now, fixtureKey };
}

export function publicMusicGenerationJob(job: MusicGenerationJob) {
  return {
    id: job.id,
    taskId: job.taskId,
    taskRevision: job.taskRevision,
    prompt: job.prompt,
    durationSeconds: job.durationSeconds,
    tempoBpm: job.tempoBpm,
    status: job.status,
    revision: job.revision,
    capabilityState: job.capabilityState,
    rightsStatus: job.rightsStatus,
    testOnly: job.testOnly,
    productionReady: false as const,
    fixtureAvailable: job.status === "mock_complete" && job.fixtureKey !== null,
    canAttachAsLicensedAdMusic: false as const,
    canAdvertise: false as const,
    canPublish: false as const,
    billing: "none" as const,
    ...MUSIC_GENERATION_ZERO_SIDE_EFFECTS,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    queuedAt: job.queuedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
  };
}

export function assertMusicGenerationAttachable(
  job: MusicGenerationJob,
  task: { siteId: string; customerId: string; taskId: string; revision: number },
  expectedRevision: number,
): never {
  if (job.revision !== expectedRevision) throw new WorkspaceError("revision_conflict", 409);
  if (job.siteId !== task.siteId || job.customerId !== task.customerId || job.taskId !== task.taskId) {
    throw new WorkspaceError("music_generation_task_not_owned", 403);
  }
  if (task.revision !== job.taskRevision) throw new WorkspaceError("revision_conflict", 409);
  if (job.status !== "mock_complete") throw new WorkspaceError("music_generation_not_ready", 409);
  if (job.rightsStatus !== "licensed" || job.testOnly) throw new WorkspaceError("music_generation_unlicensed", 403);
  throw new WorkspaceError("music_generation_attachment_disabled", 403);
}

/** Deterministic, local-only PCM fixture. This is synthetic test audio, not licensed music. */
export function createDeterministicMusicWav(input: { requestHash: string; durationSeconds: number; tempoBpm: number }): Buffer {
  if (!/^[0-9a-f]{64}$/.test(input.requestHash) || !Number.isSafeInteger(input.durationSeconds) || input.durationSeconds < 5 || input.durationSeconds > 30 ||
      !Number.isSafeInteger(input.tempoBpm) || input.tempoBpm < 40 || input.tempoBpm > 200) {
    throw new WorkspaceError("music_generation_fixture_input_invalid", 422);
  }
  const sampleRate = 8_000;
  const sampleCount = sampleRate * input.durationSeconds;
  const dataBytes = sampleCount * 2;
  const bytes = Buffer.alloc(44 + dataBytes);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(36 + dataBytes, 4);
  bytes.write("WAVE", 8, "ascii");
  bytes.write("fmt ", 12, "ascii");
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36, "ascii");
  bytes.writeUInt32LE(dataBytes, 40);
  const seed = Buffer.from(input.requestHash, "hex");
  const baseFrequency = 110 + (seed.readUInt16BE(0) % 330);
  const secondFrequency = baseFrequency * (1.25 + (seed[2] % 31) / 100);
  const beatHz = input.tempoBpm / 60;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const time = sample / sampleRate;
    const beat = Math.sin(2 * Math.PI * beatHz * time) >= 0 ? 1 : 0.55;
    const fadeIn = Math.min(1, time / 0.08);
    const fadeOut = Math.min(1, (input.durationSeconds - time) / 0.12);
    const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
    const waveform = (Math.sin(2 * Math.PI * baseFrequency * time) * 0.55 +
      Math.sin(2 * Math.PI * secondFrequency * time) * 0.3 +
      Math.sin(2 * Math.PI * baseFrequency * 0.5 * time) * 0.15) * beat * envelope * 0.32;
    bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(waveform * 32767))), 44 + sample * 2);
  }
  return bytes;
}
