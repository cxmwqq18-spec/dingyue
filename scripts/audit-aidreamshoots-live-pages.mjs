#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { argumentValue } from "./lib/database-target.mjs";

const baseUrl = "https://aidreamshoots.eu";
const reportPath = argumentValue("--report");
const routes = [
  "/",
  "/collections",
  "/collections/soccer",
  "/collections/avatar",
  "/collections/gala-photo",
  "/tools",
  "/pricing",
  "/blog",
  "/workflow",
  "/faq",
  "/about-us",
  "/contact-us",
  "/privacy",
  "/terms",
  "/cookies",
  "/refunds"
];
const expectedCanonical = (route) => `https://aidreamshoots.eu${route}`;
const htmlValue = (html, pattern) => html.match(pattern)?.[1]?.trim() || null;
const stripVisibleText = (html) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const results = [];
for (const route of routes) {
  const requestedUrl = `${baseUrl}${route}`;
  let response;
  let finalUrl = requestedUrl;
  let redirectLocation = null;
  try {
    response = await fetch(requestedUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
      headers: { "user-agent": "AIdreamshoots-live-page-audit/1.0" }
    });
    if (response.status >= 300 && response.status < 400) {
      redirectLocation = response.headers.get("location");
      if (redirectLocation) {
        finalUrl = new URL(redirectLocation, requestedUrl).toString();
        response = await fetch(finalUrl, {
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
          headers: { "user-agent": "AIdreamshoots-live-page-audit/1.0" }
        });
      }
    }
    const html = await response.text();
    const visibleText = stripVisibleText(html).toLowerCase();
    const canonical = htmlValue(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
      || htmlValue(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    const robots = htmlValue(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
    const ogTitle = htmlValue(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const title = htmlValue(html, /<title[^>]*>([^<]+)<\/title>/i);
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    const jsonLdCount = (html.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []).length;
    const brandLeak = ["mydreamshoots", "aidreamcapes", "mydreamshoots.com", "aidreamcapes.com"]
      .filter((marker) => visibleText.includes(marker));
    const failures = [];
    if (response.status !== 200) failures.push(`status_${response.status}`);
    if (canonical !== expectedCanonical(route)) failures.push(`canonical_${canonical || "missing"}`);
    if (!robots || !/index\s*,\s*follow/i.test(robots)) failures.push(`robots_${robots || "missing"}`);
    if (!title) failures.push("title_missing");
    if (!ogTitle) failures.push("og_title_missing");
    if (h1Count !== 1) failures.push(`h1_count_${h1Count}`);
    if (jsonLdCount < 1) failures.push("jsonld_missing");
    if (brandLeak.length) failures.push(`brand_leak_${brandLeak.join(",")}`);
    results.push({ route, status: response.status, redirectLocation, finalUrl, title, canonical, robots, ogTitle, h1Count, jsonLdCount, brandLeak, failures });
  } catch (error) {
    results.push({ route, status: null, error: String(error), failures: ["request_error"] });
  }
}

const report = {
  createdAt: new Date().toISOString(),
  targetDomain: "aidreamshoots.eu",
  routes: results.length,
  passed: results.filter((result) => result.failures.length === 0).length,
  failed: results.filter((result) => result.failures.length > 0).length,
  results
};
if (reportPath) {
  const absolutePath = path.resolve(reportPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  report.reportPath = absolutePath;
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.failed ? 1 : 0;
