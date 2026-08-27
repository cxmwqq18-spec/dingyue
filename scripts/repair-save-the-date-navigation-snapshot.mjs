#!/usr/bin/env node

if (process.argv.includes("--apply")) {
  throw new Error("repair-save-the-date-navigation-snapshot is retired: it must not alter published navigation or active pointers.");
}

console.log(JSON.stringify({ ok: true, mode: "read-only", retiredWritePath: true }, null, 2));
