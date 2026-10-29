# AIVIDEOSUGC Render Root (release-independent, production)

Date: 2026-10-29 · Status: applied on the aivideosugc production server

## Why

Workspace video render artefacts (`final.mp4`, subtitles, mock clips) are served
from `resolveWorkspaceOutput` (`src/lib/aidreamcapes-workspace/output.ts`).
The default root is **cwd-relative**: `<release>/data/aidreamcapes-workspace-render`.
Because every deploy switches the service WorkingDirectory to a fresh release
directory (and old releases are pruned), task output URLs that reference a
render file silently broke after the next deploy — library cards could not
play the finished video at all.

## Fix applied (server ops, no code change)

Render files now live in a **release-independent** shared directory and are
pinned via env:

```
/www/wwwroot/aidreamcapes.com/data/aidreamcapes-workspace-render
AIVIDEOSUGC_RENDER_ROOT=/www/wwwroot/aidreamcapes.com/data/aidreamcapes-workspace-render
```

- The env var was appended to the deploy base `.env.local`
  (`/www/wwwroot/aidreamcapes.com/.env.local`); `deploy-aidreamcapes-release.mjs`
  copies that file into every new release, so future releases inherit it.
- The existing ~113 MB render tree was rsynced from the then-current release
  (`c7c80b8ea…-seo`) into the shared path, and the running service was
  restarted with the variable in its environment.
- The previous release directory was intentionally left in place as a
  rollback copy.

## Rules going forward

1. Never **place or default** render data inside a release directory. Any new
   environment must set `AIVIDEOSUGC_RENDER_ROOT` to a path outside
   `releases/<commit>-…`.
2. Do not add `data/aidreamcapes-workspace-render`-like directories to
   `sourcePaths` in `deploy-aidreamcapes-release.mjs`; the env var is the
   mechanism.
3. When verifying a deploy, confirm the running process environment actually
   contains `AIVIDEOSUGC_RENDER_ROOT`
   (`tr '\0' '\n' < /proc/<MainPID>/environ | grep AIVIDEOSUGC`).
4. Relational task rows stay the source of truth; render files are durable
   scratch/derived artefacts. A missing render file surfaces as
   `workspace_output_missing` (404) and the workspace offers a re-render
   rather than pretending the task failed.

## Related incident (2026-10-29): truncated deploy env template

`/www/wwwroot/aidreamcapes.com/.env.local` is the **deploy template**: the
release script copies it to both `.env.local` and `.env` of every new release,
and `build-aidreamcapes-prebuilt.mjs` reads `current/.env.local` (asserting
more than 10 keys). After the template was accidentally reduced to a single
`AIVIDEOSUGC_FFPROBE_BIN` line, builds refused to run and — had a deploy
succeeded — releases would have shipped without `DATABASE_URL` and the rest
of the runtime config (the live service only kept working because Next loads
the intact `.env` at runtime).

Recovery applied: the full 70-key env was restored from the current release's
intact `.env`, the two `AIVIDEOSUGC_*` overrides re-added, and the template
copied back into the live release (both files). The template must always hold
the complete production env; treat "template line count drops" as an incident,
not a cleanup.
