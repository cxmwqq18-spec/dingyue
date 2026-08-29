#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = (process.env.STOREFRONT_FOOTER_BASE_URL || "http://127.0.0.1:3002/site/mydreamshoots").replace(/\/$/, "");
const response = await fetch(baseUrl, { redirect: "follow", headers: { connection: "close" } });
assert.equal(response.status, 200, `storefront footer readback failed with HTTP ${response.status}`);
const html = await response.text();
const footer = html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] ?? "";
assert.ok(footer, "storefront SSR HTML must contain a footer");

const expectedLinks = [
  ["AI Video Generation", "/ai-video-generation"],
  ["Best AI video", "/best-ai-video"],
  ["AI Save the Date", "/best-save-the-date"],
  ["AI Image Generation", "/ai-image-generation"],
  ["AI Photo Packages", "/best-packages"],
  ["How it works", "/workflow"],
  ["Pricing", "/pricing"],
  ["Blog", "/blog"],
  ["About us", "/about-us"],
  ["Contact us", "/contact-us"],
  ["Creators Circle", "/creators-circle"],
  ["Refund Policy", "/refunds"],
  ["Shipping", "/shipping"],
  ["Privacy Policy", "/privacy"],
  ["Content policy", "/content"],
  ["Terms of Service", "/terms"],
  ["Cookie Policy", "/cookies"]
];

const renderedLinks = [...footer.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
  href: match[1].replace(/^\/site\/mydreamshoots(?=\/|$)/, "") || "/",
  label: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}));
const missing = expectedLinks.filter(([label, href]) =>
  !renderedLinks.some((link) => link.href === href && link.label.includes(label))
);

assert.deepEqual(missing, [], `storefront footer is missing ${missing.map(([label, href]) => `${label} (${href})`).join(", ")}`);
console.log(JSON.stringify({ ok: true, baseUrl, expectedLinkCount: expectedLinks.length }, null, 2));
