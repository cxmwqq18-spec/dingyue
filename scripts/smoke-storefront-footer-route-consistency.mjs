#!/usr/bin/env node
import assert from "node:assert/strict";

const expectedProfile = (process.env.STOREFRONT_FOOTER_EXPECTED_PROFILE || "mydreamshoots").trim().toLowerCase();
const storefrontBaseUrl = (process.env.STOREFRONT_FOOTER_BASE_URL || (expectedProfile === "aidreamcapes"
  ? "http://127.0.0.1:3002/site/aidreamcapes"
  : "http://127.0.0.1:3002/site/mydreamshoots")).replace(/\/$/, "");
const routePaths = (process.env.STOREFRONT_FOOTER_PATHS || (expectedProfile === "aidreamcapes"
  ? "/workflow,/marketing,/ai-video-generation/ugc-ad-video,/refunds,/digital-delivery,/content,/cookies"
  : "/,/pricing,/about-us,/contact-us,/workflow,/best-packages,/ai-video-generation,/ai-image-generation/unblur-image,/blog"))
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
  ["Digital Delivery Policy", "/digital-delivery"],
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
const aidreamcapesExpectedLinks = [
  ["AI Video", "/ai-video-generation"],
  ["AI Image", "/ai-image-generation"],
  ["Marketing Hub", "/marketing"],
  ["Pricing", "/pricing"],
  ["Workflow", "/workflow"],
  ["Affiliate Program", "/creators-circle"],
  ["Blog", "/blog"],
  ["About Us", "/about-us"],
  ["Contact Us", "/contact-us"],
  ["Refund Policy", "/refunds"],
  ["Digital Delivery Policy", "/digital-delivery"],
  ["Privacy Policy", "/privacy"],
  ["Content Policy", "/content"],
  ["Terms of Service", "/terms"],
  ["Cookie Policy", "/cookies"]
];
const aidreamcapesExpectedGroups = ["Product", "Resources & Company", "Support"];

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
    label: match[2].replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/gi, "'").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim()
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
  } else if (expectedProfile === "aidreamcapes") {
    assert(!footer.includes("/ai-video-generation/product-ad-video"), `${url} must not use the legacy Marketing Hub detail route`);
    const missing = aidreamcapesExpectedLinks.filter(([label, href]) =>
      !links.some((link) => link.href === href && link.label.includes(label))
    );
    assert.deepEqual(missing, [], `${url} is missing ${missing.map(([label, href]) => `${label} (${href})`).join(", ")}`);
    const headings = [...footer.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
      .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
    for (const heading of aidreamcapesExpectedGroups) {
      assert(headings.includes(heading), `${url} is missing the ${heading} footer group`);
    }
    const mergedSection = footer.match(/<section\b[\s\S]*?<h2\b[^>]*>Resources &amp; Company<\/h2>[\s\S]*?<\/section>/i)?.[0] ?? "";
    assert(mergedSection, `${url} is missing the merged Resources & Company footer section`);
    assert(!/Prompt Guide/i.test(footer), `${url} must not expose Prompt Guide in the footer`);
    assert(!/Company details/i.test(footer), `${url} must hide the Company details label`);
    assert(!/<dt\b[^>]*>Website<\/dt>/i.test(footer), `${url} must hide the Website row`);
    assert(!/<dt\b[^>]*>Phone<\/dt>/i.test(footer), `${url} must hide the Phone row`);
    assert(/<img\b[^>]*src=["'][^"']+aidreamcapes[^"']+\.(?:svg|png|webp)/i.test(footer), `${url} must render the Aidreamcapes footer logo`);
    for (const paymentKey of ["visa", "mastercard", "amex", "paypal", "apple-pay", "google-pay"]) {
      assert(footer.includes(`data-payment-method="${paymentKey}"`), `${url} is missing the ${paymentKey} payment method`);
    }
    for (const [label, href] of [["Children's Privacy", "/children-privacy"], ["State Privacy", "/state-privacy"]]) {
      assert(links.some((link) => link.href === href && link.label.includes(label)), `${url} is missing ${label} (${href})`);
    }
    const expectedOrder = aidreamcapesExpectedLinks.map(([label]) => label);
    const actualOrder = links
      .filter((link) => expectedOrder.includes(link.label))
      .map((link) => link.label);
    assert.deepEqual(actualOrder, expectedOrder, `${url} has an unexpected Aidreamcapes footer menu order`);
    const supportSection = footer.match(/<section\b[\s\S]*?<h2\b[^>]*>Support<\/h2>[\s\S]*?<\/section>/i)?.[0] ?? "";
    assert(supportSection, `${url} is missing the Support footer section`);
  }
  const internalSignature = Array.from(new Set(
    links
      .filter((link) => link.href.startsWith("/") && !link.href.startsWith("/cdn-cgi/"))
      .map((link) => `${link.label}\t${link.href}`)
  )).sort();
  if (expectedProfile === "aidreamcapes" && routePath === "/marketing") {
    assert(/data-aidreamcapes-marketing-directory="true"/.test(html), `${url} must render the Marketing Hub directory page`);
  }
  return { routePath, internalSignature };
}

if (expectedProfile === "aidreamcapes") {
  for (const path of ["/refunds", "/digital-delivery", "/content", "/cookies"]) {
    const response = await fetch(pageUrl(path), { redirect: "follow", headers: { connection: "close" } });
    assert.equal(response.status, 200, `${pageUrl(path)} returned HTTP ${response.status}`);
  }
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
  expectedLinkCount: expectedProfile === "aidreamcapes" ? aidreamcapesExpectedLinks.length : expectedLinks.length,
  hiddenLinkCount: expectedProfile === "aidreamcapes" ? 0 : 2,
  internalLinkCount: baseline.internalSignature.length
}, null, 2));
