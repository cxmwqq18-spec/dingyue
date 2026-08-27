#!/usr/bin/env node

if (process.argv.includes("--apply")) {
  throw new Error("repair-mydreamshoots-save-date-cta-media is retired: save media changes as draft and publish through the approved current-state workflow.");
}

console.log(JSON.stringify({ ok: true, mode: "read-only", retiredWritePath: true }, null, 2));
