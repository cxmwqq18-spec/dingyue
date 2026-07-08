import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const password = "SmokePass1!";

const storefronts = [
  {
    label: "Aidreamcapes",
    siteId: "site_aidreamcapes",
    siteSlug: "aidreamcapes",
    cartPath: "/cart?product=prod_aidreamcapes_starter&price=price_aidreamcapes_trailhead_monthly"
  },
  {
    label: "MyDreamShoots",
    siteId: "site_dreamshoot",
    siteSlug: process.env.SMOKE_DREAMSHOOT_SITE_SLUG || "mydreamshoots",
    cartPath: "/cart?product=prod_dreamshoot_pro&price=price_dreamshoot_pro_yearly"
  }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashPassword(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

async function createSmokeCustomer(siteId, label) {
  const customerId = uid("cust_cart_translate");
  const email = `${customerId}@example.test`;
  await prisma.customer.create({
    data: {
      id: customerId,
      siteId,
      email,
      passwordHash: hashPassword(password),
      name: `${label} Cart Translate Smoke`,
      status: "active",
      balance: {
        create: {
          id: uid("bal_cart_translate"),
          siteId,
          balance: 0,
          reserved: 0
        }
      }
    }
  });
  return { id: customerId, email, password };
}

function isDomTranslationCrash(text) {
  return /insertBefore|NotFoundError|Failed to execute|client-side exception|Application error|Runtime NotFoundError/i.test(text);
}

async function mutateCheckoutTextLikeBrowserTranslation(checkoutButton) {
  return checkoutButton.evaluate((button) => {
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue?.includes("Complete checkout")) continue;
      const outer = document.createElement("font");
      outer.setAttribute("style", "vertical-align: inherit;");
      const inner = document.createElement("font");
      inner.setAttribute("style", "vertical-align: inherit;");
      inner.textContent = "Translated checkout";
      outer.appendChild(inner);
      node.parentNode?.insertBefore(outer, node);
      node.parentNode?.removeChild(node);
      return true;
    }
    return false;
  });
}

async function assertTranslatedCartCheckout(browser, storefront) {
  const customer = await createSmokeCustomer(storefront.siteId, storefront.label);
  const context = await browser.newContext();
  const page = await context.newPage();
  const clientErrors = [];
  page.on("pageerror", (error) => clientErrors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && isDomTranslationCrash(text)) clientErrors.push(text);
  });

  try {
    const login = await context.request.post(`${baseUrl}/api/sites/${storefront.siteId}/auth/login`, {
      data: { email: customer.email, password: customer.password }
    });
    assert(login.ok(), `${storefront.label} smoke login failed with ${login.status()}: ${await login.text()}`);

    await page.goto(`${baseUrl}/site/${storefront.siteSlug}${storefront.cartPath}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const checkoutButton = await page.getByRole("button", { name: /complete checkout/i }).elementHandle({ timeout: 20000 });
    assert(checkoutButton, `${storefront.label} checkout button did not render`);

    const mutated = await mutateCheckoutTextLikeBrowserTranslation(checkoutButton);
    assert(mutated, `${storefront.label} checkout button text could not be mutated`);

    const checkoutResponsePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/sites/${storefront.siteId}/checkout/subscription`) &&
      response.request().method() === "POST"
    );
    await checkoutButton.click();
    const checkoutResponse = await checkoutResponsePromise;
    await page.waitForTimeout(1500);

    const bodyText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    assert([200, 409].includes(checkoutResponse.status()), `${storefront.label} checkout returned unexpected status ${checkoutResponse.status()}`);
    assert(!clientErrors.some(isDomTranslationCrash), `${storefront.label} cart crashed after translated checkout click: ${clientErrors.join(" | ")}`);
    assert(!isDomTranslationCrash(bodyText), `${storefront.label} cart rendered a client error after translated checkout click`);
    assert(/Payments are not ready|Checkout complete|Complete checkout/i.test(bodyText), `${storefront.label} cart did not remain readable after checkout click`);
    console.log(`✓ ${storefront.label} cart checkout survives browser-translated button text`);
  } finally {
    await context.close();
    await prisma.customer.deleteMany({ where: { id: customer.id } }).catch(() => undefined);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const storefront of storefronts) {
      await assertTranslatedCartCheckout(browser, storefront);
    }
  } finally {
    await browser.close();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
