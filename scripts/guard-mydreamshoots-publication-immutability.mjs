#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const scriptsRoot = path.join(repoRoot, "scripts");
const formalOwner = "src/lib/stores/theme-store.ts";
const migrationOnlyPaths = new Set([
  "scripts/sync-fan-holiday-storefront-theme.mjs",
  "scripts/sync-grownstride-test-public-state-from-json.mjs",
  "scripts/sync-grownstride-test-store.mjs"
]);
const allowedFixtureOrMigrationPaths = new Set([
  "scripts/db-import-relational-state.mjs",
  "scripts/migrate-storefront-single-source.mjs",
  "scripts/migrate-dreamshoot-demo.mjs",
  "scripts/migrate-aidreamcapes-demo.mjs",
  "scripts/migrate-lumen-wedding-demo.mjs",
  "scripts/create-spanish-xby-stores.mjs",
  // The lifecycle smoke intentionally exercises pointer rollback and restores
  // the original row in its finally block. Keep this exception explicit so a
  // production script cannot gain the same bypass by being named `smoke-*`.
  "scripts/smoke-mydreamshoots-publication-db-lifecycle.mjs"
]);
const failures = [];

function collectFiles(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) return collectFiles(path.join(directory, entry.name), relative);
    return entry.name.endsWith(".mjs") || entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
      ? [relative]
      : [];
  });
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function propertyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;
}

function accessChain(node) {
  const parts = [];
  let current = node;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    const name = ts.isPropertyAccessExpression(current) ? current.name.text : propertyName(current.argumentExpression);
    if (!name) return [];
    parts.unshift(name);
    current = current.expression;
  }
  if (ts.isIdentifier(current)) parts.unshift(current.text);
  return parts;
}

function objectContainsProperty(node, name) {
  if (!ts.isObjectLiteralExpression(node)) return false;
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property)) {
      if (propertyName(property.name) === name) {
        return !(ts.isObjectLiteralExpression(property.initializer) && property.initializer.properties.length === 0);
      }
      if (objectContainsProperty(property.initializer, name)) return true;
    } else if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) {
      return true;
    }
  }
  return false;
}

function isPublicationWrite(chain) {
  const model = chain.at(-2);
  const operation = chain.at(-1);
  return ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"].includes(operation) &&
    ["themePublication", "activeThemePublication"].includes(model);
}

function checkFile(relative) {
  const absolute = path.join(repoRoot, relative);
  const source = fs.readFileSync(absolute, "utf8");
  const sourceFile = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true, relative.endsWith(".ts") || relative.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.JS);
  if (sourceFile.parseDiagnostics.length) {
    failures.push({ file: relative, line: 1, kind: "parse-error", match: sourceFile.parseDiagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")).join("; ") });
    return;
  }
  const fixtureOrSmoke = relative.startsWith("scripts/fixtures/");
  const allowed = relative === formalOwner || fixtureOrSmoke || allowedFixtureOrMigrationPaths.has(relative) || migrationOnlyPaths.has(relative);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const chain = accessChain(node.expression);
      if (isPublicationWrite(chain) && !allowed && !(migrationOnlyPaths.has(relative) && process.env.DATABASE_TARGET === "test")) failures.push({ file: relative, line: lineOf(sourceFile, node), kind: "publication-write", match: chain.join(".") });
      if (chain.at(-1) === "update" || chain.at(-1) === "updateMany" || chain.at(-1) === "upsert") {
        const model = chain.at(-2);
        if (["themePage", "themeSettings", "storefrontProfile"].includes(model) && node.arguments.some((argument) => objectContainsProperty(argument, "publishedJson")) && !allowed && !(migrationOnlyPaths.has(relative) && process.env.DATABASE_TARGET === "test")) {
          failures.push({ file: relative, line: lineOf(sourceFile, node), kind: "published-json-write", match: chain.join(".") });
        }
      }
      if (chain.at(-1) === "publishSeoSnapshotRelational" || chain.at(-1) === "publishReviewedDraftSiteRelational") {
        if (!allowed && relative !== "scripts/publish-approved-draft-site.mjs") failures.push({ file: relative, line: lineOf(sourceFile, node), kind: "legacy-publication-api", match: chain.join(".") });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const files = [
  ...collectFiles(scriptsRoot, "scripts"),
  formalOwner
].filter((relative) => relative !== "scripts/guard-mydreamshoots-publication-immutability.mjs");
for (const relative of files.sort()) checkFile(relative);

const result = {
  ok: failures.length === 0,
  rule: "Only the formal publication owner may materialize published rows, append publications, or switch the active pointer",
  checked: files,
  failures
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
