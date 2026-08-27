#!/usr/bin/env node

if (process.argv.includes("--apply")) {
  throw new Error("publish-local-image-audit-repair is retired: use owner-approved draft data and the current-state publisher.");
}

console.log(JSON.stringify({ ok: true, mode: "read-only", retiredWritePath: true }, null, 2));
