import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const PREVIEW_MIME_TYPES: Record<string, string> = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
};
const MAX_PREVIEW_BYTES = 12 * 1024 * 1024;

export class MusicPreviewPathError extends Error {
  code: "unsafe_music_preview_path" | "music_preview_missing" | "music_preview_unavailable";

  constructor(code: "unsafe_music_preview_path" | "music_preview_missing" | "music_preview_unavailable") {
    super(code);
    this.name = "MusicPreviewPathError";
    this.code = code;
  }
}

export function aidreamcapesMusicPreviewRoot(cwd = process.cwd()): string {
  return path.join(cwd, "data", "aidreamcapes-music-previews", "site_aidreamcapes");
}

export function resolveContainedMusicPreviewPath(root: string, assetKey: string): string {
  if (typeof assetKey !== "string" || !assetKey || assetKey.includes("\\") || assetKey.includes("%") ||
      /[\u0000-\u001f\u007f]/u.test(assetKey) || path.isAbsolute(assetKey)) {
    throw new MusicPreviewPathError("unsafe_music_preview_path");
  }
  const segments = assetKey.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(segment))) {
    throw new MusicPreviewPathError("unsafe_music_preview_path");
  }
  const extension = path.extname(assetKey).toLowerCase();
  if (!PREVIEW_MIME_TYPES[extension]) throw new MusicPreviewPathError("unsafe_music_preview_path");

  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  const relative = path.relative(resolvedRoot, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new MusicPreviewPathError("unsafe_music_preview_path");
  }
  return candidate;
}

export async function readContainedMusicPreviewFile(root: string, assetKey: string): Promise<{ bytes: Buffer; contentType: string }> {
  const filePath = resolveContainedMusicPreviewPath(root, assetKey);
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const rootReal = await fs.realpath(root);
    const [entry, fileReal] = await Promise.all([fs.lstat(filePath), fs.realpath(filePath)]);
    const relative = path.relative(rootReal, fileReal);
    const extension = path.extname(filePath).toLowerCase();
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.size || entry.size > MAX_PREVIEW_BYTES ||
        !relative || relative.startsWith("..") || path.isAbsolute(relative) || !PREVIEW_MIME_TYPES[extension]) {
      throw new MusicPreviewPathError("unsafe_music_preview_path");
    }
    handle = await fs.open(fileReal, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== entry.size || opened.dev !== entry.dev || opened.ino !== entry.ino) {
      throw new MusicPreviewPathError("unsafe_music_preview_path");
    }
    const bytes = await handle.readFile();
    await handle.close();
    handle = undefined;
    return { bytes, contentType: PREVIEW_MIME_TYPES[extension] };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof MusicPreviewPathError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") throw new MusicPreviewPathError("music_preview_missing");
    throw new MusicPreviewPathError("music_preview_unavailable");
  }
}
