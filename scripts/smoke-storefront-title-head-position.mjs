import assert from "node:assert/strict";

const defaultPort = process.env.PORT || "3037";
const defaultTargets = [
  { label: "MyDreamShoots local host render", url: `http://127.0.0.1:${defaultPort}/`, host: "www.mydreamshoots.com" },
  { label: "Aidreamcapes local host render", url: `http://127.0.0.1:${defaultPort}/`, host: "www.aidreamcapes.com" }
];

const argTargets = process.argv.slice(2).map((url) => {
  const parsed = new URL(url);
  return { label: url, url, host: parsed.host };
});

const targets = argTargets.length ? argTargets : defaultTargets;

function titleText(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

for (const target of targets) {
  const response = await fetch(target.url, {
    headers: {
      accept: "text/html",
      "x-forwarded-host": target.host
    },
    redirect: "manual"
  });
  assert.equal(response.status, 200, `${target.label} should return 200`);

  const html = await response.text();
  const headOpen = html.search(/<head\b[^>]*>/i);
  assert.notEqual(headOpen, -1, `${target.label} should include <head>`);

  const headOpenEnd = html.indexOf(">", headOpen);
  const headClose = html.search(/<\/head>/i);
  const titleOpen = html.search(/<title\b/i);
  assert.ok(headOpenEnd > headOpen, `${target.label} should have a complete <head> tag`);
  assert.ok(headClose > headOpenEnd, `${target.label} should close <head>`);
  assert.ok(titleOpen > headOpenEnd && titleOpen < headClose, `${target.label} title should be inside <head>`);
  assert.equal(html.slice(headOpenEnd + 1, headOpenEnd + 7).toLowerCase(), "<title", `${target.label} should start <head> with <title>`);

  console.log(`${target.label}: <head><title> verified - ${titleText(html)}`);
}
