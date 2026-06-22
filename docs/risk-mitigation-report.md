# Risk Mitigation Report

## Scope

This report covers three production-hardening areas requested for `dingyue`:

- RBAC, CSRF, and rate limiting coverage.
- Server-local private file storage operations.
- Theme designer concurrency and disaster recovery.

## 1. RBAC / CSRF / Rate Limits

### Risks

- Cookie-authenticated mutation APIs can be CSRF targets if they accept POST/PUT/PATCH/DELETE without a request-bound token.
- Some admin APIs still use a boolean session check instead of permission-level RBAC, so support/admin/owner roles are not always distinguished.
- In-memory rate limiting is useful for local/demo, but does not protect a multi-instance production deployment.

### Preventive Controls

- Require backend authorization on every mutation route; UI visibility is not a security boundary.
- Use a shared mutation guard pattern: authenticate session, check permission, check CSRF token, then apply rate limit.
- Keep login, checkout, upload, job creation, and admin mutations on stricter limits.
- In production, move rate limiting to Redis, a shared store, reverse proxy, or edge/WAF.

### Current Status

- `src/lib/api-auth.ts` provides session checks for platform, site admin, and customer scopes.
- `src/lib/security/rate-limit.ts` provides an in-memory limiter for generation, checkout, login, upload, and generic APIs.
- Some newer routes have local CSRF checks, but full mutation coverage still needs a systematic route-by-route migration.

## 2. Local File Storage Operations

### Risks

- Disk full can block uploads and worker outputs.
- Soft-deleted files can accumulate and silently consume disk.
- JSON state can reference missing files, and local storage can contain orphaned files.
- Multiple application instances cannot safely use independent local disks for customer assets.
- Future S3 migration requires stable storage keys and a cleanup/audit trail.

### Preventive Controls

- Keep files outside `public`; serve only through scoped API checks.
- Use path traversal checks and scoped keys under `customer-assets/{siteId}/{customerId}/...`.
- Run a scheduled dry-run cleanup report before actual deletion.
- Monitor free disk, file counts, missing references, orphaned files, and soft-delete backlog.
- Back up `STORAGE_ROOT` and `data/platform-state.json` together; restore drills must validate both.

### Recommended Runbook

- Daily: run storage health and alert if missing/orphan counts increase unexpectedly.
- Daily: run cleanup dry-run for soft-deleted assets older than 7 days.
- Weekly: perform backup restore drill into a staging path.
- Before multi-instance deploy: use a shared mounted volume or migrate to S3-compatible storage.

## 3. Designer Concurrency / Disaster Recovery

### Risks

- Two browser tabs can overwrite each other with last-write-wins behavior.
- Publish can happen from a stale draft if the editor does not compare versions.
- Restore from publication must not mutate the live published snapshot directly.
- JSON-file persistence still has process-level race risk under multi-process writes.

### Preventive Controls

- Add draft revision metadata: `revision`, `updatedAt`, and `etag`.
- Mutating draft/publish/restore APIs should accept `expectedRevision` or `expectedEtag` and return `409 theme_draft_conflict` for stale writes.
- Publication restore should only restore draft and return `liveMutated: false`.
- Keep publication snapshots append-only.
- Production should move designer persistence to a transactional DB or single-writer queue.

## Remaining Work

- Migrate all state-changing routes to a single guard helper with RBAC + CSRF + rate limit.
- Add storage health scripts and wire them into readiness dashboards.
- Add designer draft revision metadata to persisted state and update UI save/publish calls to pass expected revisions.
- Add CI/smoke coverage for CSRF failures, storage health, and designer stale-write conflicts.
