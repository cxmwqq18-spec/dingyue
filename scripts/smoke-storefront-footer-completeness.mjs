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
  ["Blog", "/blog"],
  ["About us", "/about-us"],
  ["Contact us", "/contact-us"],
  ["Creators Circle", "/creators-circle"],
  ["Refund Policy", "/refunds"],
  ["Digital Delivery Policy", "/digital-delivery"],
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
const hiddenLinks = [
  ["How it works", "/workflow"],
  ["Pricing", "/pricing"]
];
const expectedSocialLinks = [
  ["instagram", "https://www.instagram.com/mydreamshoots/"],
  ["facebook", "https://www.facebook.com/mydreamshoots/"],
  ["threads", "https://www.threads.com/@mydreamshoots"],
  ["pinterest", "https://www.pinterest.com/myDreamshoots/"],
  ["youtube", "https://www.youtube.com/@myDreamshoots"],
  ["x", "https://x.com/myDreamshoots"],
  ["tiktok", "https://www.tiktok.com/@mydreamshoots"]
];
const unexpected = hiddenLinks.filter(([label, href]) =>
  renderedLinks.some((link) => link.href === href && link.label.includes(label))
);

assert.deepEqual(missing, [], `storefront footer is missing ${missing.map(([label, href]) => `${label} (${href})`).join(", ")}`);
assert.deepEqual(unexpected, [], `storefront footer must hide ${unexpected.map(([label, href]) => `${label} (${href})`).join(", ")}`);
const socialAnchors = [...footer.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
const missingSocial = expectedSocialLinks.filter(([platform, href]) =>
  !socialAnchors.some((anchor) => anchor.includes("data-social-platform=\"" + platform + "\"") && anchor.includes("href=\"" + href + "\""))
);
assert.deepEqual(missingSocial, [], "storefront footer is missing social links: " + missingSocial.map(([platform, href]) => platform + " (" + href + ")").join(", "));
console.log(JSON.stringify({ ok: true, baseUrl, expectedLinkCount: expectedLinks.length, hiddenLinkCount: hiddenLinks.length }, null, 2));
