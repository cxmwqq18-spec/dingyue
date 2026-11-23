import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type SpeechWindow = { start: number; end: number };

/**
 * Silence below this level (dBFS) for at least {@link SILENCE_SECONDS} is
 * treated as "nobody is speaking". Speech sits well above it; ambient music
 * beds usually sit above it too, so this can only ever shorten a cue that
 * hangs over a real silent gap — it never guesses new timings.
 */
const SILENCE_NOISE = "-35dB";
const SILENCE_SECONDS = 0.5;
const TRIM_MIN_SECONDS = 0.25;
const MAX_SHRINK = 0.5;

/**
 * Measure the silent gaps of a rendered video with FFmpeg and return the
 * complement — the windows where the audio actually carries sound. Used when
 * a task has no measured speech cues, so the burned captions still follow the
 * voice instead of a text model's guess.
 */
export async function measureSpeechWindows(file: string, duration: number): Promise<SpeechWindow[]> {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const bin = process.env.AIVIDEOSUGC_FFMPEG_BIN?.trim() || "ffmpeg";
  let stderr = "";
  try {
    const result = await run(bin, [
      "-hide_banner", "-nostdin", "-i", file,
      "-af", `silencedetect=noise=${SILENCE_NOISE}:d=${SILENCE_SECONDS}`,
      "-f", "null", "-"
    ], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    stderr = result.stderr;
  } catch (error) {
    // A failed probe is not a reason to fail the subtitle operation; the plan
    // keeps its own timing when the audio cannot be measured.
    return [];
  }
  const silences: SpeechWindow[] = [];
  let open: number | undefined;
  for (const line of stderr.split(/\r?\n/u)) {
    const start = /silence_start:\s*(-?\d+(?:\.\d+)?)/u.exec(line);
    if (start) {
      open = Math.max(0, Number(start[1]));
      continue;
    }
    const end = /silence_end:\s*(-?\d+(?:\.\d+)?)/u.exec(line);
    if (end && open !== undefined) {
      silences.push({ start: open, end: Math.min(duration, Number(end[1])) });
      open = undefined;
    }
  }
  if (open !== undefined && duration - open >= SILENCE_SECONDS) silences.push({ start: open, end: duration });

  const windows: SpeechWindow[] = [];
  let cursor = 0;
  for (const silence of silences) {
    if (silence.start - cursor >= 0.05) windows.push({ start: cursor, end: silence.start });
    cursor = Math.max(cursor, silence.end);
  }
  if (duration - cursor >= 0.05) windows.push({ start: cursor, end: duration });
  return windows;
}

/**
 * Pull caption cues inward so they sit inside measured sound windows. A cue is
 * only shortened, never moved, and never by more than half of its length — a
 * wrong silence reading can therefore not swallow whole lines.
 */
export function clampCuesToSpeech<T extends { start: number; end: number; text: string }>(lines: T[], windows: SpeechWindow[]): T[] {
  if (!windows.length) return lines;
  const ordered = [...windows].sort((a, b) => a.start - b.start);
  const clamped: T[] = [];
  let previousEnd = 0;
  for (const line of lines) {
    const overlapping = ordered.filter((window) => Math.min(line.end, window.end) - Math.max(line.start, window.start) > 0.05);
    let start = line.start;
    let end = line.end;
    if (overlapping.length) {
      const first = overlapping[0];
      const last = overlapping[overlapping.length - 1];
      const nextStart = Math.max(start, first.start - 0.05);
      const nextEnd = Math.min(end, last.end + 0.10);
      const shrunk = end - start - (nextEnd - nextStart);
      if (nextEnd - nextStart >= TRIM_MIN_SECONDS && shrunk <= (end - start) * MAX_SHRINK) {
        start = nextStart;
        end = nextEnd;
      }
    }
    if (start < previousEnd) start = previousEnd;
    if (end - start < 0.20) {
      clamped.push({ ...line });
      previousEnd = Math.max(previousEnd, line.end);
      continue;
    }
    clamped.push({ ...line, start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000 });
    previousEnd = end;
  }
  // Rounding can create a one-millisecond overlap; keep the sequence valid.
  for (let index = 1; index < clamped.length; index++) {
    if (clamped[index].start < clamped[index - 1].end) {
      clamped[index].start = clamped[index - 1].end;
      if (clamped[index].end <= clamped[index].start) clamped[index].end = Math.min(clamped[index].start + 0.2, 24 * 60 * 60);
    }
  }
  return clamped;
}
