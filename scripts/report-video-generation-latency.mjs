#!/usr/bin/env node
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function numberArg(name, fallback, min, max) {
  const parsed = Number(argValue(name, String(fallback)));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

const take = numberArg("take", 40, 1, 500);
const hours = numberArg("hours", 72, 1, 24 * 30);
const scan = numberArg("scan", Math.max(200, take * 10), take, 2000);
const outputJson = process.argv.includes("--json");

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function isVideoJob(job) {
  const request = recordValue(job.requestJson);
  const fields = recordValue(request.fields);
  return request.mode === "video" ||
    request.outputType === "video" ||
    typeof request.videoThemeId === "string" ||
    fields.mode === "video" ||
    fields.outputType === "video" ||
    typeof fields.videoThemeId === "string";
}

function timestampMs(value) {
  if (!(typeof value === "string" || value instanceof Date)) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function secondsBetween(start, end) {
  if (start === undefined || end === undefined || end < start) return null;
  return Math.round((end - start) / 1000);
}

function timingMs(timing, key) {
  return timestampMs(timing[key]);
}

function providerName(job) {
  const result = recordValue(job.resultJson);
  const providerTrace = Array.isArray(result.providerTrace) ? result.providerTrace : [];
  const firstTrace = recordValue(providerTrace[0]);
  if (typeof firstTrace.provider === "string" && firstTrace.provider.trim()) return firstTrace.provider.trim();
  const costTrace = recordValue(result.costTrace);
  const providerErrors = Array.isArray(costTrace.providerErrors) ? costTrace.providerErrors : [];
  const firstError = recordValue(providerErrors[0]);
  if (typeof firstError.provider === "string" && firstError.provider.trim()) return firstError.provider.trim();
  return "unknown";
}

function requestSummary(job) {
  const request = recordValue(job.requestJson);
  const fields = recordValue(request.fields);
  const frameIds = Array.from(new Set([
    ...stringArray(fields.frameAssetIds),
    ...stringArray(request.assetIds)
  ]));
  return {
    durationSeconds: fields.durationSeconds ?? request.durationSeconds ?? null,
    aspectRatio: fields.aspectRatio ?? request.aspectRatio ?? null,
    resolution: fields.resolution ?? request.resolution ?? null,
    frames: frameIds.length
  };
}

function latencyRow(job, nowMs = Date.now()) {
  const result = recordValue(job.resultJson);
  const timing = recordValue(result.timing);
  const createdMs = timestampMs(job.createdAt);
  const updatedMs = timestampMs(job.updatedAt);
  const active = job.status === "queued" || job.status === "running";
  const workerAcceptedMs = timingMs(timing, "workerAcceptedAt");
  const referencePreparedMs = timingMs(timing, "referencePreparedAt");
  const providerTaskCreatedMs = timingMs(timing, "providerTaskCreatedAt");
  const providerCompletedMs = timingMs(timing, "providerCompletedAt");
  const downloadedMs = timingMs(timing, "downloadedAt");
  const storedMs = timingMs(timing, "storedAt");
  const settledMs = timingMs(timing, "settledAt");
  const optimizedStoredMs = timingMs(timing, "optimizedStoredAt");
  const providerFirstProgressMs = timingMs(timing, "providerFirstProgressAt");
  const providerLastProgressMs = timingMs(timing, "providerLastProgressAt");
  const terminalMs = settledMs ?? storedMs ?? downloadedMs ?? providerCompletedMs ?? (active ? nowMs : updatedMs);
  const incompleteStageEndMs = active ? nowMs : terminalMs;
  const slot = Array.isArray(result.outputSlots) ? recordValue(result.outputSlots[0]) : {};
  return {
    id: job.id,
    status: job.status,
    provider: providerName(job),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    stage: typeof result.lastWorkerStage === "string" ? result.lastWorkerStage : null,
    progress: Number.isFinite(Number(result.lastWorkerProgress)) ? Number(result.lastWorkerProgress) : null,
    providerTaskId: typeof slot.providerTaskId === "string" ? slot.providerTaskId : null,
    hasDetailedTiming: Object.keys(timing).length > 0,
    request: requestSummary(job),
    seconds: {
      total: secondsBetween(createdMs, terminalMs),
      submitToWorker: secondsBetween(createdMs, workerAcceptedMs ?? (!workerAcceptedMs ? incompleteStageEndMs : undefined)),
      prepareReferences: secondsBetween(workerAcceptedMs, referencePreparedMs ?? (workerAcceptedMs && !referencePreparedMs ? incompleteStageEndMs : undefined)),
      createProviderTask: secondsBetween(referencePreparedMs, providerTaskCreatedMs ?? (referencePreparedMs && !providerTaskCreatedMs ? incompleteStageEndMs : undefined)),
      providerGeneration: secondsBetween(providerTaskCreatedMs, providerCompletedMs ?? (providerTaskCreatedMs ? incompleteStageEndMs : undefined)),
      providerProgressWindow: secondsBetween(providerFirstProgressMs, providerLastProgressMs),
      downloadResult: secondsBetween(providerCompletedMs, downloadedMs ?? (providerCompletedMs && !downloadedMs ? incompleteStageEndMs : undefined)),
      saveAndSettle: secondsBetween(downloadedMs, settledMs ?? storedMs ?? (downloadedMs ? incompleteStageEndMs : undefined)),
      backgroundOptimization: secondsBetween(settledMs ?? storedMs, optimizedStoredMs)
    }
  };
}

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))];
}

function finiteNumbers(rows, key) {
  return rows
    .map((row) => row.seconds[key])
    .filter((value) => Number.isFinite(value));
}

function summarizeGroup(rows) {
  const totals = finiteNumbers(rows, "total");
  const providerGeneration = finiteNumbers(rows, "providerGeneration");
  const createProviderTask = finiteNumbers(rows, "createProviderTask");
  const downloadResult = finiteNumbers(rows, "downloadResult");
  return {
    count: rows.length,
    totalSeconds: {
      min: totals.length ? Math.min(...totals) : null,
      p50: percentile(totals, 0.5),
      p90: percentile(totals, 0.9),
      max: totals.length ? Math.max(...totals) : null
    },
    providerGenerationSeconds: {
      count: providerGeneration.length,
      p50: percentile(providerGeneration, 0.5),
      p90: percentile(providerGeneration, 0.9),
      max: providerGeneration.length ? Math.max(...providerGeneration) : null
    },
    createProviderTaskSeconds: {
      p50: percentile(createProviderTask, 0.5),
      max: createProviderTask.length ? Math.max(...createProviderTask) : null
    },
    downloadResultSeconds: {
      p50: percentile(downloadResult, 0.5),
      max: downloadResult.length ? Math.max(...downloadResult) : null
    }
  };
}

function formatSeconds(value) {
  if (!Number.isFinite(value)) return "-";
  if (value < 60) return `${value}s`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return seconds ? `${minutes}m${seconds}s` : `${minutes}m`;
}

function printTextReport(report) {
  console.log("Video generation latency report");
  console.log(`Window: last ${hours}h, max ${take} video jobs, scanned up to ${scan} total jobs`);
  console.log("Safety: read-only database query; no provider calls or paid creates were made.");
  console.log("");
  console.log("Groups:");
  for (const [key, summary] of Object.entries(report.groups)) {
    console.log(`- ${key}: count=${summary.count}, total p50=${formatSeconds(summary.totalSeconds.p50)}, p90=${formatSeconds(summary.totalSeconds.p90)}, max=${formatSeconds(summary.totalSeconds.max)}, provider p50=${formatSeconds(summary.providerGenerationSeconds.p50)}, p90=${formatSeconds(summary.providerGenerationSeconds.p90)}`);
  }
  console.log("");
  console.log("Recent jobs:");
  for (const row of report.rows.slice(0, 20)) {
    console.log(`- ${row.id} ${row.status} ${row.provider}: total=${formatSeconds(row.seconds.total)}, provider=${formatSeconds(row.seconds.providerGeneration)}, progressWindow=${formatSeconds(row.seconds.providerProgressWindow)}, create=${formatSeconds(row.seconds.createProviderTask)}, download=${formatSeconds(row.seconds.downloadResult)}, stage=${row.stage ?? "-"}`);
  }
}

try {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const jobs = [];
  let cursor;
  let scanned = 0;
  while (jobs.length < take && scanned < scan) {
    const batch = await prisma.generationJob.findMany({
      where: { createdAt: { gte: since } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(100, scan - scanned),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        requestJson: true,
        resultJson: true
      }
    });
    if (!batch.length) break;
    scanned += batch.length;
    for (const job of batch) {
      if (isVideoJob(job)) jobs.push(job);
      if (jobs.length >= take) break;
    }
    cursor = batch[batch.length - 1].id;
  }
  const rows = jobs.map((job) => latencyRow(job));
  const groupedRows = new Map();
  for (const row of rows) {
    const key = `${row.provider}|${row.status}`;
    groupedRows.set(key, [...(groupedRows.get(key) ?? []), row]);
  }
  const groups = Object.fromEntries(Array.from(groupedRows.entries()).map(([key, groupRows]) => [key, summarizeGroup(groupRows)]));
  const report = {
    generatedAt: new Date().toISOString(),
    windowHours: hours,
    take,
    scannedJobCount: scanned,
    videoJobCount: rows.length,
    groups,
    rows
  };
  if (outputJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }
} finally {
  await prisma.$disconnect();
}
