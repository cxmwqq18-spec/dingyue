#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const batchId = "aidreamcapes-eu-lifestyle-diverse-20260913-v1";
const manifestPath = path.resolve(".tmp", "aidreamcapes-eu-image-regeneration", batchId, "manifest.json");
const batchDir = path.dirname(manifestPath);
const paidAttempts = 161;

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

async function imageFingerprints(filePath) {
  const { data, info } = await sharp(filePath).resize(32, 32, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const average = data.reduce((sum, value) => sum + value, 0) / data.length;
  let averageHash = "";
  let differenceHash = "";
  for (let index = 0; index < data.length; index += 1) averageHash += data[index] >= average ? "1" : "0";
  for (let row = 0; row < info.height; row += 1) {
    for (let column = 0; column < info.width - 1; column += 1) {
      const left = data[row * info.width + column];
      const right = data[row * info.width + column + 1];
      differenceHash += left >= right ? "1" : "0";
    }
  }
  return { averageHash, differenceHash };
}

function readProviderAudit(taskId) {
  const auditPath = path.join(batchDir, batchId + "-" + taskId + "-provider.json");
  if (!fs.existsSync(auditPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(auditPath, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const oldAuditPath = path.join(batchDir, batchId + "-provider-audit.json");
  const oldAudit = fs.existsSync(oldAuditPath) ? JSON.parse(fs.readFileSync(oldAuditPath, "utf8")) : {};
  let succeeded = 0;
  let failed = 0;
  let ambiguous = 0;

  for (const task of manifest.tasks) {
    if (fs.existsSync(task.stageFile)) {
      const input = fs.readFileSync(task.stageFile);
      const metadata = await sharp(task.stageFile).metadata();
      if (!metadata.width || !metadata.height) throw new Error("Invalid staged image: " + task.id);
      const fingerprints = await imageFingerprints(task.stageFile);
      const audit = readProviderAudit(task.id);
      task.status = "succeeded";
      task.error = "";
      task.outputHash = sha256(input);
      task.outputFingerprints = fingerprints;
      task.providerRequestId = audit?.status >= 200 && audit.status < 300 ? audit.requestId || "" : task.providerRequestId || "";
      succeeded += 1;
      continue;
    }

    const audit = readProviderAudit(task.id);
    if (audit?.status === null) {
      task.status = "unknown_provider_state";
      task.error = audit.error || "provider_request_unknown";
      task.providerRequestId = "";
      ambiguous += 1;
    } else if (audit?.status >= 400) {
      task.status = "failed";
      task.error = "provider_status_" + audit.status;
      task.providerRequestId = audit.requestId || "";
      failed += 1;
    } else {
      task.status = "planned";
      task.error = "";
      task.providerRequestId = "";
    }
  }

  if (ambiguous !== 0) throw new Error("Recovery found unresolved provider states; inspect before resuming.");
  manifest.mode = "planned";
  manifest.runtime = {
    paidCreateAttempts: paidAttempts,
    succeeded,
    failed,
    ambiguous,
    startedAt: oldAudit.startedAt || manifest.createdAt,
    resumedAt: new Date().toISOString(),
    providerRequestIds: Array.isArray(oldAudit.providerRequestIds) ? oldAudit.providerRequestIds : [],
    recovery: {
      recoveredAt: new Date().toISOString(),
      reason: "restore staged outputs after accidental plan-mode manifest rebuild",
      stagedSuccessCount: succeeded
    }
  };
  manifest.safety.paidCreateAttemptsAuthorizedByBatchScope = 180;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, manifestPath, paidCreateAttempts: paidAttempts, succeeded, failed, ambiguous, missing: manifest.tasks.filter((task) => task.status === "planned").map((task) => task.id) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
