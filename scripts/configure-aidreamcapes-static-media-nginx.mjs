#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const CONFIG_PATH = "/www/server/panel/vhost/nginx/aivideosugc.com.conf";
const MEDIA_ROOT = "/www/wwwroot/aidreamcapes.com/shared/aidreamcapes-public-media/";
const READABLE_ROOT = "/www/wwwroot/aidreamcapes.com/shared/sites/public-media/";
const LOCATION = "/assets/sites/site_aidreamcapes/public-media/";
const MARKER = "# Aidreamcapes immutable public media; scoped to www.aivideosugc.com.";
const READABLE_MARKER = "# Aidreamcapes readable media URLs; extension-qualified and scoped to www.aivideosugc.com.";

function argument(name) {
  return process.argv.slice(2).find((value) => value === name || value.startsWith(`${name}=`));
}

function matchingBrace(source, openIndex) {
  let depth = 0;
  let quote = "";
  let comment = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (comment) {
      if (char === "\n") comment = false;
      continue;
    }
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "#") { comment = true; continue; }
    if (char === "\"" || char === "'") { quote = char; continue; }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return index;
  }
  throw new Error("nginx_server_block_unclosed");
}

function findTargetServerBlock(source) {
  const declaration = /\bserver_name\s+([^;]+);/g;
  const matches = [];
  for (const match of source.matchAll(declaration)) {
    const names = match[1].trim().split(/\s+/);
    if (!names.includes("www.aivideosugc.com")) continue;
    const serverStart = source.lastIndexOf("server {", match.index);
    if (serverStart < 0) throw new Error("target_server_block_not_found");
    const open = source.indexOf("{", serverStart);
    const close = matchingBrace(source, open);
    if (match.index > close) throw new Error("target_server_block_parse_error");
    if (!/\blisten\s+443\b/.test(source.slice(serverStart, close + 1))) continue;
    matches.push({ start: serverStart, open, close });
  }
  if (matches.length !== 1) throw new Error(`expected_one_www_aivideosugc_tls_vhost_found_${matches.length}`);
  return matches[0];
}

export function updateConfig(source) {
  const block = findTargetServerBlock(source);
  const body = source.slice(block.start, block.close + 1);
  const readableLocations = [
    `    ${READABLE_MARKER}\n    location ~* ^/ai-image-generation/actors/([^/]+\\.(?:avif|gif|jpe?g|png|svg|webp))$ {\n        alias ${READABLE_ROOT}actor/$1;\n        sendfile on;\n        expires 1h;\n        add_header Cache-Control "public, max-age=3600" always;\n        access_log off;\n    }\n`,
    `    location ~* ^/ai-image-generation/([^/]+\\.(?:avif|gif|jpe?g|png|svg|webp))$ {\n        alias ${READABLE_ROOT}image/$1;\n        sendfile on;\n        expires 1h;\n        add_header Cache-Control "public, max-age=3600" always;\n        access_log off;\n    }\n`,
    `    location ~* ^/ai-video-generation/actors/([^/]+\\.(?:m4v|mov|mp4|webm))$ {\n        alias ${READABLE_ROOT}actor/$1;\n        sendfile on;\n        expires 1h;\n        add_header Cache-Control "public, max-age=3600" always;\n        access_log off;\n    }\n`,
    `    location ~* ^/ai-video-generation/([^/]+\\.(?:m4v|mov|mp4|webm))$ {\n        alias ${READABLE_ROOT}video/$1;\n        sendfile on;\n        expires 1h;\n        add_header Cache-Control "public, max-age=3600" always;\n        access_log off;\n    }\n`,
    `    location ~* ^/ai-actors/([^/]+\\.(?:m4a|mp3|ogg|wav))$ {\n        alias ${READABLE_ROOT}actor/$1;\n        sendfile on;\n        expires 1h;\n        add_header Cache-Control "public, max-age=3600" always;\n        access_log off;\n    }\n`,
  ];
  const newRoutesPresent = readableLocations.every((location) => body.includes(location.trim().split("\n")[0]) && body.includes(location.match(/alias ([^;]+);/)?.[1] ?? ""));
  if (newRoutesPresent) return { source, changed: false };
  const routeRegex = /location\s+\^~\s+\/assets\/sites\/site_aidreamcapes\/public-media\/\s*\{/g;
  const existing = [...body.matchAll(routeRegex)];
  if (existing.length > 1) throw new Error("duplicate_aidreamcapes_static_media_locations");
  const expected = `${MARKER}\n    location ^~ ${LOCATION} {\n        alias ${MEDIA_ROOT};\n        sendfile on;\n        expires 1y;\n        add_header Cache-Control "public, max-age=31536000, immutable" always;\n        access_log off;\n    }\n\n`;
  if (existing.length === 1) {
    const start = body.lastIndexOf(MARKER, existing[0].index);
    if (start < 0) throw new Error("existing_aidreamcapes_media_location_missing_marker");
    const open = body.indexOf("{", existing[0].index);
    const close = matchingBrace(body, open);
    const configured = body.slice(start, close + 1);
    if (!configured.includes(`alias ${MEDIA_ROOT}`) || !configured.includes("max-age=31536000, immutable")) {
      throw new Error("existing_aidreamcapes_media_location_has_unexpected_config");
    }
  }
  const assetsAnchor = [...body.matchAll(/\n\s*location\s+\/assets\/\s*\{/g)];
  if (assetsAnchor.length !== 1) throw new Error(`expected_one_assets_proxy_location_found_${assetsAnchor.length}`);
  const localAnchor = block.start + assetsAnchor[0].index + 1;
  const oldLocationAlreadyPresent = body.includes("location ^~ /assets/sites/site_aidreamcapes/public-media/");
  if (!oldLocationAlreadyPresent) return { source: `${source.slice(0, localAnchor)}    ${expected}${readableLocations.join("\n")}${source.slice(localAnchor)}`, changed: true };
  const existingRoute = /location\s+\^~\s+\/assets\/sites\/site_aidreamcapes\/public-media\/\s*\{/g.exec(body);
  const routeOpen = body.indexOf("{", existingRoute.index);
  const routeClose = matchingBrace(body, routeOpen);
  const insertion = block.start + routeClose + 1;
  const missing = readableLocations.filter((location) => !body.includes(location.match(/location ([^\n]+)/)?.[1] ?? ""));
  return { source: `${source.slice(0, insertion)}\n${READABLE_MARKER}\n${missing.join("\n")}${source.slice(insertion)}`, changed: missing.length > 0 };
}

function atomicWrite(filePath, contents) {
  const temporary = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(temporary, contents, { mode: fs.statSync(filePath).mode & 0o777 });
  fs.renameSync(temporary, filePath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const applyArg = argument("--apply");
  const dryRun = Boolean(argument("--dry-run"));
  const configArg = argument("--config=");
  const configPath = configArg ? path.resolve(configArg.slice("--config=".length)) : CONFIG_PATH;
  if (!dryRun && applyArg !== "--apply=aidreamcapes-static-media-nginx-20261018") {
    throw new Error("Production config writes require --apply=aidreamcapes-static-media-nginx-20261018.");
  }

  const before = fs.readFileSync(configPath, "utf8");
  const plan = updateConfig(before);
  if (!plan.changed) {
    console.log(JSON.stringify({ ok: true, changed: false, configPath, host: "www.aivideosugc.com", location: LOCATION, alias: MEDIA_ROOT }));
    process.exit(0);
  }
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, changed: true, configPath, host: "www.aivideosugc.com", location: LOCATION, alias: MEDIA_ROOT }));
    process.exit(0);
  }

  if (!fs.statSync(configPath).isFile()) throw new Error("nginx_config_not_regular_file");
  const backupPath = `${configPath}.before-aidreamcapes-static-media-20261018`;
  if (!fs.existsSync(backupPath)) fs.copyFileSync(configPath, backupPath, fs.constants.COPYFILE_EXCL);
  atomicWrite(configPath, plan.source);
  try {
    execFileSync("nginx", ["-t"], { stdio: "inherit" });
    execFileSync("systemctl", ["reload", "nginx"], { stdio: "inherit" });
    const active = execFileSync("systemctl", ["is-active", "nginx"], { encoding: "utf8" }).trim();
    if (active !== "active") throw new Error(`nginx_not_active:${active}`);
  } catch (error) {
    atomicWrite(configPath, before);
    try { execFileSync("nginx", ["-t"], { stdio: "inherit" }); } catch {}
    try { execFileSync("systemctl", ["reload", "nginx"], { stdio: "inherit" }); } catch {}
    throw error;
  }
  console.log(JSON.stringify({ ok: true, changed: true, configPath, backupPath, host: "www.aivideosugc.com", location: LOCATION, alias: MEDIA_ROOT, nginx: "active" }));
}
