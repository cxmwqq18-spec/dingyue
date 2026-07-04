import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteSlug = process.env.SMOKE_SITE_SLUG || "mydreamshoots";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashPassword(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function textFromHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return { response, text };
}

async function assertPricing() {
  for (const billing of ["monthly", "yearly"]) {
    const { response, text } = await fetchText(`/site/${siteSlug}/pricing?billing=${billing}`);
    assert(response.ok, `pricing ${billing} failed with ${response.status}`);
    const visible = textFromHtml(text);
    for (const tier of ["Starter", "Pro", "Premium"]) {
      assert(visible.includes(tier), `pricing ${billing} missing ${tier}`);
    }
    assert(!text.includes("audience="), `pricing ${billing} still exposes audience query`);
    assert(!/Single\s+(Starter|Pro|Premium)/i.test(visible), `pricing ${billing} still shows Single plans`);
    assert(!/Couple\s+(Starter|Pro|Premium)/i.test(visible), `pricing ${billing} still shows Couple plans`);
    assert(
      !/Add-on credits|One-shot trial|Small credit pack|Medium credit pack|Large credit pack/i.test(visible),
      `pricing ${billing} still shows one-time add-on purchase cards`
    );
  }
}

async function assertCartPriceSelection() {
  const { response, text } = await fetchText(`/site/${siteSlug}/cart?product=prod_dreamshoot_pro&price=price_dreamshoot_pro_yearly`);
  assert(response.ok, `cart failed with ${response.status}`);
  const visible = textFromHtml(text);
  assert(visible.includes("Pro"), "cart does not show selected Pro plan");
  assert(visible.includes("$240") || visible.includes("240"), "cart does not show yearly Pro price");
  assert(!text.includes("audience="), "cart still exposes audience query");
}

async function assertCheckoutUnauthBlocked() {
  const response = await fetch(`${baseUrl}/api/sites/site_dreamshoot/checkout/subscription`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customerId: "cust_dreamshoot_nora",
      priceId: "price_dreamshoot_pro_monthly",
      intentId: uid("smoke_unauth")
    })
  });
  const json = await response.json().catch(() => ({}));
  assert(response.status === 401 || response.status === 403, `unauth checkout expected auth block, got ${response.status}`);
  assert(
    ["customer_login_required", "customer_session_required", "csrf_token_required"].includes(String(json.error)),
    `unauth checkout returned unexpected error ${JSON.stringify(json)}`
  );
}

async function assertCustomerCheckoutPaymentNotReady() {
  const email = process.env.SMOKE_CUSTOMER_EMAIL || "1621417163@qq.com";
  const password = process.env.SMOKE_CUSTOMER_PASSWORD || "mydreamshoots123";
  const login = await fetch(`${baseUrl}/api/sites/site_dreamshoot/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!login.ok) {
    console.log("↷ skipping payment-not-ready assertion because demo customer login is unavailable");
    return false;
  }
  const cookies = cookiesFrom(login);
  const csrf = cookieValue(cookies, "customer_csrf_site_dreamshoot");
  assert(csrf, "demo customer login did not set customer CSRF cookie");
  const response = await fetch(`${baseUrl}/api/sites/site_dreamshoot/checkout/subscription`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cookie": cookies.join("; "),
      "x-csrf-token": csrf
    },
    body: JSON.stringify({
      customerId: "cust_dreamshoot_nora",
      priceId: "price_dreamshoot_pro_monthly",
      intentId: uid("smoke_not_ready")
    })
  });
  const json = await response.json().catch(() => ({}));
  assert(response.status === 409, `payment-not-ready checkout expected 409, got ${response.status}: ${JSON.stringify(json)}`);
  assert(json.error === "payment_provider_not_enabled_for_customer", `payment-not-ready checkout returned unexpected error ${JSON.stringify(json)}`);
  assert(json.checkoutStatus === "payment_provider_not_ready", `payment-not-ready checkout returned unexpected status ${JSON.stringify(json)}`);
  return true;
}

function cookiesFrom(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : String(response.headers.get("set-cookie") || "")
        .split(/,(?=\s*[^;,=]+=)/)
        .map((value) => value.trim())
        .filter(Boolean);
  return values.map((cookie) => cookie.split(";")[0]).filter(Boolean);
}

function cookieValue(cookies, name) {
  const prefix = `${name}=`;
  const cookie = cookies.find((value) => value.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

async function createSmokeSite() {
  const suffix = uid("checkout").replace(/[^a-z0-9_]/gi, "").toLowerCase();
  const siteId = `site_${suffix}`;
  const productId = `prod_${suffix}`;
  const priceId = `price_${suffix}`;
  const customerId = `cust_${suffix}`;
  const adminId = `admin_${suffix}`;
  const email = `${suffix}@example.test`;
  const password = "SmokePass1!";

  await prisma.$transaction([
    prisma.site.create({
      data: {
        id: siteId,
        name: "Smoke Checkout",
        slug: `smoke-${suffix}`,
        status: "active",
        primaryDomain: `smoke-${suffix}.localhost`,
        timezone: "UTC",
        currency: "usd",
        signupCreditGrant: 0,
        branding: {
          logoText: "Smoke Checkout",
          tagline: "Smoke checkout site",
          primaryColor: "#111111",
          accentColor: "#d19a52",
          backgroundColor: "#ffffff"
        }
      }
    }),
    prisma.siteAdmin.create({
      data: {
        id: adminId,
        siteId,
        email,
        passwordHash: hashPassword(password),
        displayName: "Smoke Admin",
        role: "owner"
      }
    }),
    prisma.customer.create({
      data: {
        id: customerId,
        siteId,
        email,
        passwordHash: hashPassword(password),
        name: "Smoke Customer",
        status: "active"
      }
    }),
    prisma.creditBalance.create({
      data: {
        id: `bal_${suffix}`,
        siteId,
        customerId,
        balance: 0,
        reserved: 0
      }
    }),
    prisma.product.create({
      data: {
        id: productId,
        siteId,
        name: "Smoke Pro",
        type: "subscription",
        status: "active"
      }
    }),
    prisma.price.create({
      data: {
        id: priceId,
        siteId,
        productId,
        label: "Smoke Pro Monthly",
        amountCents: 100,
        currency: "usd",
        interval: "month",
        creditsGranted: 7,
        stripePriceId: `smoke_${suffix}`,
        metadata: { tier: "pro", billing: "monthly" }
      }
    })
  ]);

  return { siteId, priceId, customerId, email, password, expectedCredits: 7 };
}

async function assertSameIntentIdempotent() {
  const smoke = await createSmokeSite();
  try {
    const login = await fetch(`${baseUrl}/api/sites/${smoke.siteId}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: smoke.email, password: smoke.password })
    });
    assert(login.ok, `smoke login failed with ${login.status}: ${await login.text()}`);
    const cookies = cookiesFrom(login);
    const csrf = cookieValue(cookies, `customer_csrf_${smoke.siteId}`);
    assert(csrf, "smoke login did not set customer CSRF cookie");

    const intentId = uid("same_intent");
    const requestBody = JSON.stringify({
      customerId: smoke.customerId,
      priceId: smoke.priceId,
      intentId
    });
    const request = () => fetch(`${baseUrl}/api/sites/${smoke.siteId}/checkout/subscription`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
        "x-csrf-token": csrf
      },
      body: requestBody
    });

    const [first, second] = await Promise.all([request(), request()]);
    const firstJson = await first.json().catch(() => ({}));
    const secondJson = await second.json().catch(() => ({}));
    assert(first.ok, `first idempotent checkout failed ${first.status}: ${JSON.stringify(firstJson)}`);
    assert(second.ok, `second idempotent checkout failed ${second.status}: ${JSON.stringify(secondJson)}`);
    assert(firstJson.order?.id && firstJson.order.id === secondJson.order?.id, "same intent returned different orders");

    const [orders, grants, balance] = await Promise.all([
      prisma.order.findMany({ where: { siteId: smoke.siteId, customerId: smoke.customerId } }),
      prisma.creditLedger.findMany({ where: { siteId: smoke.siteId, customerId: smoke.customerId, type: "grant" } }),
      prisma.creditBalance.findUnique({ where: { customerId: smoke.customerId } })
    ]);
    assert(orders.length === 1, `expected one order for same intent, got ${orders.length}`);
    assert(grants.length === 1, `expected one grant ledger for same intent, got ${grants.length}`);
    assert(balance?.balance === smoke.expectedCredits, `expected balance ${smoke.expectedCredits}, got ${balance?.balance}`);
  } finally {
    await prisma.site.deleteMany({ where: { id: smoke.siteId } });
  }
}

async function main() {
  console.log(`Smoke target: ${baseUrl}`);
  await assertPricing();
  console.log("✓ pricing has three tiers and no audience query");
  await assertCartPriceSelection();
  console.log("✓ cart selects the requested billing price");
  await assertCheckoutUnauthBlocked();
  console.log("✓ checkout blocks unauthenticated requests");
  const checkedPaymentReadiness = await assertCustomerCheckoutPaymentNotReady();
  if (checkedPaymentReadiness) {
    console.log("✓ checkout reports payment-not-ready clearly");
  }
  await assertSameIntentIdempotent();
  console.log("✓ same checkout intent is idempotent and grants credits once");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
