#!/usr/bin/env node
/**
 * Guards the release retention rule before it is allowed to delete anything.
 *
 *   node scripts/smoke-aidreamcapes-release-retention.mjs
 */
import assert from "node:assert/strict";
import { planReleaseRetention } from "./lib/aidreamcapes-release-retention.mjs";

const releases = [
  { name: "aaa-seo", mtime: 100 },
  { name: "bbb-seo", mtime: 200 },
  { name: "ccc-seo", mtime: 300 },
  { name: "ddd-seo", mtime: 400 },
  { name: "old-candidate", mtime: 50 }
];

{
  const plan = planReleaseRetention({ releases, keepCount: 3, currentRelease: "/srv/releases/ddd-seo" });
  assert.deepEqual(plan.keep, ["ddd-seo", "ccc-seo", "bbb-seo"]);
  assert.deepEqual(plan.delete, ["old-candidate", "aaa-seo"]);
}

{
  // The served release survives even when it is older than the keep window.
  const plan = planReleaseRetention({ releases, keepCount: 2, currentRelease: "/srv/releases/aaa-seo" });
  assert.deepEqual(plan.keep, ["ddd-seo", "ccc-seo", "aaa-seo"]);
  assert.deepEqual(plan.delete, ["old-candidate", "bbb-seo"]);
}

{
  // A unit file that still points at an old directory protects it.
  const plan = planReleaseRetention({ releases, keepCount: 1, currentRelease: "/srv/releases/ddd-seo", systemdReleases: ["/srv/releases/bbb-seo"] });
  assert.deepEqual(plan.keep, ["ddd-seo", "bbb-seo"]);
  assert.deepEqual(plan.delete, ["old-candidate", "aaa-seo", "ccc-seo"]);
}

{
  // .keep markers survive.
  const marked = releases.map((entry) => (entry.name === "old-candidate" ? { ...entry, keepMarker: true } : entry));
  const plan = planReleaseRetention({ releases: marked, keepCount: 1, currentRelease: "/srv/releases/ddd-seo" });
  assert.deepEqual(plan.keep, ["ddd-seo", "old-candidate"]);
  assert.deepEqual(plan.delete, ["aaa-seo", "bbb-seo", "ccc-seo"]);
}

{
  // Unknown current release, unsafe names and a zero keep count are refused.
  assert.throws(() => planReleaseRetention({ releases, keepCount: 3, currentRelease: "" }), /current release/);
  assert.throws(() => planReleaseRetention({ releases, keepCount: 3, currentRelease: "/srv/releases/missing-seo" }), /current release/);
  assert.throws(() => planReleaseRetention({ releases: [...releases, { name: "../etc", mtime: 1 }], keepCount: 3, currentRelease: "/srv/releases/ddd-seo" }), /unsafe release/);
  assert.throws(() => planReleaseRetention({ releases, keepCount: 0, currentRelease: "/srv/releases/ddd-seo" }), /keepCount/);
}

console.log(JSON.stringify({ ok: true, cases: 5 }));
