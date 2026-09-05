#!/usr/bin/env node
import assert from "node:assert/strict";

const storefrontBaseUrl = (process.env.STOREFRONT_FOOTER_BASE_URL || "http://127.0.0.1:3002/site/mydreamshoots").replace(/\/$/, "");
const expectedProfile = (process.env.STOREFRONT_FOOTER_EXPECTED_PROFILE || "mydreamshoots").trim().toLowerCase();
const routePaths = (process.env.STOREFRONT_FOOTER_PATHS || "/,/pricing,/about-us,/contact-us,/workflow,/best-packages,/ai-video-generation,/ai-image-generation/unblur-image,/blog")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => value === "/" ? "/" : `/${value.replace(/^\/+|\/+$/g, "")}`);
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
  ["Shipping", "/shipping"],
  ["Privacy Policy", "/privacy"],
  ["Content policy", "/content"],
  ["Terms of Service", "/terms"],
  ["Cookie Policy", "/cookies"]
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

function pageUrl(routePath) {
  return routePath === "/" ? storefrontBaseUrl : `${storefrontBaseUrl}${routePath}`;
}

function normalizeHref(href) {
  return href.replace(/^\/site\/[^/]+(?=\/|$)/, "") || "/";
}

async function readFooter(routePath) {
  const url = pageUrl(routePath);
  const response = await fetch(url, { redirect: "follow", headers: { connection: "close" } });
  assert.equal(response.status, 200, `${url} returned HTTP ${response.status}`);
  const html = await response.text();
  const footer = html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] ?? "";
  assert.ok(footer, `${url} must contain an SSR footer`);
  const links = [...footer.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: normalizeHref(match[1]),
    label: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  }));
  if (expectedProfile === "mydreamshoots") {
    const missing = expectedLinks.filter(([label, href]) =>
      !links.some((link) => link.href === href && link.label.includes(label))
    );
    assert.deepEqual(missing, [], `${url} is missing ${missing.map(([label, href]) => `${label} (${href})`).join(", ")}`);
    const hiddenLinks = [
      ["How it works", "/workflow"],
      ["Pricing", "/pricing"]
    ];
    const unexpected = hiddenLinks.filter(([label, href]) =>
      links.some((link) => link.href === href && link.label.includes(label))
    );
    assert.deepEqual(unexpected, [], `${url} must hide ${unexpected.map(([label, href]) => `${label} (${href})`).join(", ")}`);
    const socialAnchors = [...footer.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
    const missingSocial = expectedSocialLinks.filter(([platform, href]) =>
      !socialAnchors.some((anchor) => anchor.includes(`data-social-platform="${platform}"`) && anchor.includes(`href="${href}"`))
    );
    assert.deepEqual(missingSocial, [], `${url} is missing social links: ${missingSocial.map(([platform, href]) => `${platform} (${href})`).join(", ")}`);
  }
  const internalSignature = Array.from(new Set(
    links
      .filter((link) => link.href.startsWith("/") && !link.href.startsWith("/cdn-cgi/"))
      .map((link) => `${link.label}\t${link.href}`)
  )).sort();
  return { routePath, internalSignature };
}

const results = [];
for (const routePath of routePaths) results.push(await readFooter(routePath));
const baseline = results[0];
for (const result of results.slice(1)) {
  assert.deepEqual(
    result.internalSignature,
    baseline.internalSignature,
    `footer link signature differs between ${baseline.routePath} and ${result.routePath}`
  );
}

console.log(JSON.stringify({
  ok: true,
  storefrontBaseUrl,
  expectedProfile,
  routeCount: results.length,
  expectedLinkCount: expectedLinks.length,
  hiddenLinkCount: 2,
  internalLinkCount: baseline.internalSignature.length
}, null, 2));
