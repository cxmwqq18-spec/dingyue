import { chromium } from "playwright";

const origin = process.env.PLATFORM_ORIGIN || "http://127.0.0.1:3002";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const browserErrors = [];
const failedResponses = [];

page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on("response", (response) => {
  if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
});

try {
  await page.goto(`${origin}/platform?module=gateway`, { waitUntil: "networkidle" });
  if (new URL(page.url()).pathname === "/platform/login") {
    await page.locator('input[type="email"]').fill("platform@local.test");
    await page.locator('input[type="password"]').fill("platform123");
    await page.getByRole("button", { name: "进入平台后台" }).click();
    await page.waitForURL((url) => url.pathname === "/platform");
    await page.goto(`${origin}/platform?module=gateway`, { waitUntil: "networkidle" });
  }

  const pageText = await page.locator("body").innerText();
  if (pageText.replace(/\s/g, "").includes("暂无AI供应商")) {
    throw new Error("Gateway provider list is empty");
  }
  if (!pageText.includes("AI 文本生成") || !pageText.includes("gpt-5.5")) {
    throw new Error("Gateway provider form does not expose GPT-5.5 text generation");
  }
  if (browserErrors.length || failedResponses.length) {
    throw new Error([
      browserErrors.length ? `Browser errors:\n${browserErrors.join("\n")}` : "",
      failedResponses.length ? `Failed responses:\n${failedResponses.join("\n")}` : "",
    ].filter(Boolean).join("\n"));
  }

  console.log("PASS: provider list is populated and GPT-5.5 text generation is configurable");
} finally {
  await browser.close();
}
