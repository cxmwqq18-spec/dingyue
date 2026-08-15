#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

assertDatabaseTarget({ expectedTarget: "local" });
const result = spawnSync(
  process.execPath,
  ["-r", "./scripts/load-runtime-env.mjs", "./node_modules/prisma/build/index.js", "db", "push", ...process.argv.slice(2)],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" }
);
process.exit(result.status ?? 1);
