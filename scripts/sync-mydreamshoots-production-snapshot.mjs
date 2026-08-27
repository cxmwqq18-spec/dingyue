#!/usr/bin/env node

if (process.argv.includes("--full-current") || process.argv.includes("--apply")) {
  throw new Error("sync-mydreamshoots-production-snapshot is retired: it no longer copies production snapshots or changes active publications.");
}

console.log(JSON.stringify({ ok: true, mode: "read-only", retiredWritePath: true }, null, 2));
