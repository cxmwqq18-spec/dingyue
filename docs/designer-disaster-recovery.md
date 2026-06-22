# Designer Concurrency And Disaster Recovery

## Risk

The designer edits draft JSON and then publishes a snapshot. Without revision checks, multiple tabs can overwrite each other.

## Required Behavior

- Draft saves should include an expected draft revision or etag.
- Stale writes should return `409 theme_draft_conflict`.
- Publish should verify the draft version the user reviewed.
- Restore from publication should restore draft only and never mutate live published JSON directly.
- Publications should be append-only snapshots.

## Recovery

If a bad draft is saved:

1. Do not publish.
2. Restore draft from the latest known-good publication.
3. Preview draft.
4. Publish only after review.

If a bad publication is live:

1. Restore draft from the previous good publication.
2. Preview the restored draft.
3. Publish a new version.
4. Keep both bad and fixed publications for audit.
