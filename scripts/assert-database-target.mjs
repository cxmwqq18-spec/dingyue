#!/usr/bin/env node
import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertDatabaseTarget,
  databaseTargetSummary,
  hasArgument
} from "./lib/database-target.mjs";

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
if (!target) {
  console.error("Usage: node scripts/assert-database-target.mjs --target=local|test|production");
  process.exit(1);
}

try {
  const summary = assertDatabaseTarget({
    expectedTarget: target,
    requireProductionConfirmation: target === "production",
    productionConfirmed: hasArgument("--confirm-production")
  });
  console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
} catch (error) {
  let observed = null;
  try {
    observed = databaseTargetSummary();
  } catch (summaryError) {
    observed = { error: summaryError instanceof Error ? summaryError.message : String(summaryError) };
  }
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), observed }, null, 2));
  process.exit(1);
}
