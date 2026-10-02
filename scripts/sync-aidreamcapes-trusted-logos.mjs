#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "public/assets/dreamshoot/generated/trusted-logos");
const targetRoot = path.join(repoRoot, "public/assets/sites/site_aidreamcapes/trusted-logos");

async function main() {
  const sourceStat = await fs.stat(sourceRoot).catch(() => undefined);
  if (!sourceStat?.isDirectory()) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: "external_public_static_media",
      sourceRoot,
      targetRoot
    }, null, 2));
    return;
  }

  await fs.mkdir(targetRoot, { recursive: true });
  await fs.cp(sourceRoot, targetRoot, { recursive: true });
  console.log(JSON.stringify({
    ok: true,
    sourceRoot,
    targetRoot
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
