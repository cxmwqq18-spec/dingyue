#!/usr/bin/env node

if (process.argv.includes("--apply")) {
  throw new Error("repair-mydreamshoots-ai-image-directory-social-media is retired: social metadata must be saved as reviewed draft data and released through the current-state publisher.");
}

console.log(JSON.stringify({ ok: true, mode: "read-only", retiredWritePath: true }, null, 2));
