# Local Storage Operations Runbook

The current production path stores private customer assets on the server filesystem. This is intentional for the near-term deployment; S3-compatible buckets remain a scale/durability upgrade.

## Required Layout

- `STORAGE_ROOT` must be outside `public`.
- Customer files must live under `customer-assets/{siteId}/{customerId}/...`.
- Downloads must go through scoped API routes, not direct static hosting.

## Monitoring

Track:

- Free disk and inode usage.
- Count and size under `customer-assets`.
- Missing JSON references.
- Orphaned local files.
- Soft-deleted assets eligible for cleanup.

## Backup

Back up both:

- `data/platform-state.json`
- `STORAGE_ROOT`

They must be restored together to avoid missing/orphan drift.

## Cleanup

Default cleanup should be dry-run. Only delete files after reviewing the audit output.

Recommended policy:

- Dry-run daily for assets soft-deleted for at least 7 days.
- Delete weekly after reviewing audit output.
- Never delete from a path inside `public`.

## Multi-Instance Constraint

Do not run multiple app instances with independent local disks. Use a shared volume or migrate to object storage first.
