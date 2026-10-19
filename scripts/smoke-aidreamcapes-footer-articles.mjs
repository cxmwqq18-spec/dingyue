#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = (process.env.AIDREAMCAPES_FOOTER_BASE_URL || "http://127.0.0.1:3002/site/aidreamcapes").replace(/\/$/, "");
const routes = ["/", "/blog", "/about-us"];

async function getHtml(route) {
  const url = route === "/" ? baseUrl : `${baseUrl}${route}`;
  const response = await fetch(url, { redirect: "follow", headers: { connection: "close" } });
  assert.equal(response.status, 200, `${url} returned HTTP ${response.status}`);
  return response.text();
}

function articleLinks(html, route) {
  const footer = html.match(/<footer\b[^>]*class=["']site["'][\s\S]*?<\/footer>/i)?.[0] ?? "";
  const section = footer.match(/<section\b[^>]*aria-labelledby=["']aidreamcapes-latest-articles-title["'][\s\S]*?<\/section>/i)?.[0] ?? "";
  assert.ok(section, `${route} must render the current blog directory inside the server-rendered footer`);
  return [...section.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: match[1].replace(/^\/site\/aidreamcapes(?=\/|$)/, "") || "/",
    title: match[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
  }));
}

const [homeHtml, blogHtml, aboutHtml] = await Promise.all(routes.map(getHtml));
const homeLinks = articleLinks(homeHtml, "/");
const blogLinks = articleLinks(blogHtml, "/blog");
const aboutLinks = articleLinks(aboutHtml, "/about-us");
assert.ok(homeLinks.length >= 5, `homepage footer must contain at least five current article links, found ${homeLinks.length}`);
assert.deepEqual(homeLinks, blogLinks, "homepage and blog footer must show the same current LivePage articles in the same order");
assert.deepEqual(homeLinks, aboutLinks, "homepage and About Us footer must show the same current LivePage articles in the same order");
assert.match(aboutHtml, /NARUEBET NAKPHONG/, "About Us must include the current legal representative details");
assert.match(aboutHtml, /About AIVideosUGC: AI Product Photos and Video Ads/, "About Us must expose its updated SEO title in SSR HTML");

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  serverRenderedRoutes: routes,
  footerArticleCount: homeLinks.length,
  firstArticle: homeLinks[0],
  aboutUsUpdated: true
}, null, 2));
