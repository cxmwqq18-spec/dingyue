import "server-only";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WorkspaceError } from "./types";
import { assertMusicGenerationMockEnabled, createDeterministicMusicWav, type MusicGenerationJob } from "./music-generation-core";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,180}$/;

function renderRoot() {
  const configured = process.env.AIDREAMCAPES_MUSIC_FIXTURE_ROOT?.trim();
  if (configured) return path.resolve(configured);
  // Never store fixtures inside a release directory: deploys delete releases,
  // which would delete the fixtures with them. When the process runs from a
  // release checkout, anchor the fixture root at the shared app data
  // directory one level above the releases folder.
  if (process.env.NODE_ENV === "production" && process.cwd().includes(`${path.sep}releases${path.sep}`)) {
    return path.resolve(process.cwd(), "..", "..", "data", "aidreamcapes-music-fixtures");
  }
  return path.join(process.cwd(), "data", "aidreamcapes-music-fixtures");
}

function fixturePath(job: MusicGenerationJob, root = renderRoot()) {
  if (job.siteId !== "site_aidreamcapes" || [job.customerId, job.taskId, job.id].some((value) => !SAFE_ID.test(value))) {
    throw new WorkspaceError("music_generation_fixture_path_invalid", 404);
  }
  const key = `mock-music/${job.customerId}/${job.taskId}/${job.id}.wav`;
  const resolvedRoot = path.resolve(root);
  const file = path.resolve(resolvedRoot, "site_aidreamcapes", job.customerId, job.taskId, "mock-music", `${job.id}.wav`);
  const relative = path.relative(resolvedRoot, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new WorkspaceError("music_generation_fixture_path_invalid", 404);
  return { key, root: resolvedRoot, file, directory: path.dirname(file) };
}

async function verifyExistingFixture(file: string, expected: Buffer) {
  const entry = await fs.lstat(file);
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size !== expected.length) {
    throw new WorkspaceError("music_generation_fixture_path_invalid", 404);
  }
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== entry.size || opened.dev !== entry.dev || opened.ino !== entry.ino || !(await handle.readFile()).equals(expected)) {
      throw new WorkspaceError("music_generation_fixture_conflict", 409);
    }
  } finally {
    await handle.close();
  }
}

/** Writes a deterministic WAV only below the private Aidreamcapes workspace render root. */
export async function writeMusicGenerationFixture(job: MusicGenerationJob, rootOverride?: string): Promise<string> {
  assertMusicGenerationMockEnabled();
  const { key, root, file, directory } = fixturePath(job, rootOverride);
  const bytes = createDeterministicMusicWav({ requestHash: job.requestHash, durationSeconds: job.durationSeconds, tempoBpm: job.tempoBpm });
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const [rootReal, directoryReal] = await Promise.all([fs.realpath(root), fs.realpath(directory)]);
  const publicRoot = path.resolve(process.cwd(), "public");
  const publicRelativeRoot = path.relative(publicRoot, rootReal);
  if (!publicRelativeRoot.startsWith("..") && !path.isAbsolute(publicRelativeRoot)) {
    throw new WorkspaceError("music_generation_fixture_path_invalid", 404);
  }
  const expectedDirectory = path.join(rootReal, "site_aidreamcapes", job.customerId, job.taskId, "mock-music");
  if (directoryReal !== expectedDirectory) throw new WorkspaceError("music_generation_fixture_path_invalid", 404);

  try {
    await verifyExistingFixture(file, bytes);
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const temporaryFile = `${file}.pending-${randomUUID()}`;
  try {
    await fs.writeFile(temporaryFile, bytes, { flag: "wx", mode: 0o600 });
    try {
      await fs.link(temporaryFile, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await verifyExistingFixture(file, bytes);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError("music_generation_fixture_write_failed", 503);
  } finally {
    await fs.rm(temporaryFile, { force: true }).catch(() => undefined);
  }
  return key;
}
