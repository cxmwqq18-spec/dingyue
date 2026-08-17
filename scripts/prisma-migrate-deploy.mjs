#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
if (!target) throw new Error("prisma:migrate:deploy requires --target=local|test|production.");

assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed: hasArgument("--confirm-production")
});

const forwarded = [];
const rawArgs = process.argv.slice(2);
for (let index = 0; index < rawArgs.length; index += 1) {
  const arg = rawArgs[index];
  if (arg === "--target") {
    index += 1;
    continue;
  }
  if (arg.startsWith("--target=") || arg === "--confirm-production") continue;
  forwarded.push(arg);
}
const result = spawnSync(
  process.execPath,
  ["-r", "./scripts/load-runtime-env.mjs", "./node_modules/prisma/build/index.js", "migrate", "deploy", ...forwarded],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" }
);
process.exit(result.status ?? 1);
