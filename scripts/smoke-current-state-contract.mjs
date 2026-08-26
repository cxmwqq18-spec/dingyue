#!/usr/bin/env node
import assert from "node:assert/strict";
import { assertVerifiedBackupReceipt } from "../src/lib/current-state/backup-receipt.ts";

const receipt = {
  target: "local",
  databaseIdentity: "postgresql://127.0.0.1:15433/dingyue_local/public",
  backupPath: "/external-backups/dingyue-local.tar.gz",
  byteSize: 1024,
  sha256: "a".repeat(64),
  createdAt: "2026-08-26T00:00:00.000Z",
  archiveListVerifiedAt: "2026-08-26T00:01:00.000Z",
  isolatedRestoreVerifiedAt: "2026-08-26T00:02:00.000Z",
  criticalReadbackHash: "critical-readback-sha256"
};

assert.deepEqual(
  assertVerifiedBackupReceipt(receipt, {
    target: "local",
    databaseIdentity: receipt.databaseIdentity
  }),
  receipt
);

for (const [label, expected] of [
  ["missing receipt", undefined],
  ["wrong target", { ...receipt, target: "production" }],
  ["bad checksum", { ...receipt, sha256: "not-a-sha" }],
  ["missing restore verification", { ...receipt, isolatedRestoreVerifiedAt: "" }]
]) {
  assert.throws(
    () => assertVerifiedBackupReceipt(expected, { target: "local", databaseIdentity: receipt.databaseIdentity }),
    undefined,
    label
  );
}

console.log(JSON.stringify({ ok: true, checks: 5, contract: "verified-backup-receipt" }, null, 2));
