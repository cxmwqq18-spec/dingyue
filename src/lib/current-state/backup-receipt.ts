import type { VerifiedBackupReceipt } from "@/lib/types";

const SHA256_RE = /^[a-f0-9]{64}$/i;

export function databaseIdentityFromUrl(rawUrl: string | undefined): string {
  if (!rawUrl?.trim()) throw new Error("database_url_required");
  const url = new URL(rawUrl);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("unsupported_database_protocol");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database) throw new Error("database_identity_incomplete");
  const schema = url.searchParams.get("schema") || "public";
  return `${url.protocol}//${url.hostname}:${url.port || "5432"}/${database}/${schema}`;
}

function assertIso(value: string, field: string): void {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error(`verified_backup_receipt_${field}_invalid`);
  }
}

/**
 * Fail-closed validation for the external backup contract. This function is
 * deliberately pure: it never creates, archives, restores, or mounts a
 * backup. The receipt must come from an independently verified backup step.
 */
export function assertVerifiedBackupReceipt(
  receipt: VerifiedBackupReceipt | undefined,
  expected: { target: string; databaseIdentity: string }
): VerifiedBackupReceipt {
  if (!receipt) throw new Error("verified_backup_receipt_required");
  if (receipt.target !== expected.target) throw new Error("verified_backup_receipt_target_mismatch");
  if (receipt.databaseIdentity !== expected.databaseIdentity) throw new Error("verified_backup_receipt_database_mismatch");
  if (!receipt.backupPath.trim() || !receipt.backupPath.startsWith("/")) throw new Error("verified_backup_receipt_path_missing");
  if (receipt.backupPath.includes("/www/wwwroot/") || receipt.backupPath.includes("/node_modules/")) {
    throw new Error("verified_backup_receipt_not_external");
  }
  if (!Number.isSafeInteger(receipt.byteSize) || receipt.byteSize <= 0) {
    throw new Error("verified_backup_receipt_size_invalid");
  }
  if (!SHA256_RE.test(receipt.sha256)) throw new Error("verified_backup_receipt_sha256_invalid");
  if (!receipt.criticalReadbackHash.trim()) throw new Error("verified_backup_receipt_readback_hash_missing");
  assertIso(receipt.createdAt, "created_at");
  assertIso(receipt.archiveListVerifiedAt, "archive_list_verified_at");
  assertIso(receipt.isolatedRestoreVerifiedAt, "isolated_restore_verified_at");
  return receipt;
}
