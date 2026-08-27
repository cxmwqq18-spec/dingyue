#!/usr/bin/env node

if (process.argv.includes("--apply")) {
  throw new Error("restore-mydreamshoots-homepage-copy-from-publication is retired: create a reviewed draft from current data instead of restoring history.");
}

console.log(JSON.stringify({ ok: true, mode: "read-only", retiredWritePath: true }, null, 2));
