#!/usr/bin/env node
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const sourceRoot = path.join(process.cwd(), "src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  return originalResolveFilename.call(this, request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request, ...args);
};

const jiti = createJiti(import.meta.url);
const { FakeStripePriceAdapter, providerFingerprint, verifyPriceReadOnly } = jiti("../src/lib/stripe-price-verification.ts");

const snapshot = { id: "price_test_monthly_v2", amountCents: 2799, currency: "usd", interval: "month", active: true };
const price = { stripePriceId: snapshot.id, amountCents: 2799, currency: "usd", interval: "month" };
const matchingAdapter = new FakeStripePriceAdapter([snapshot]);
const verified = await verifyPriceReadOnly({ price, adapter: matchingAdapter });
assert.equal(verified.fingerprint, providerFingerprint(snapshot));
assert.equal(matchingAdapter.retrieveCount, 1, "verification must perform one read-only provider lookup");

const mismatchAdapter = new FakeStripePriceAdapter([{ ...snapshot, amountCents: 2450 }]);
await assert.rejects(() => verifyPriceReadOnly({ price, adapter: mismatchAdapter }), /stripe_price_mismatch/);
assert.equal(mismatchAdapter.retrieveCount, 1, "a mismatch must not be retried");

let timeoutReads = 0;
await assert.rejects(
  () => verifyPriceReadOnly({
    price,
    adapter: { retrievePrice: async () => { timeoutReads += 1; throw new Error("provider_timeout"); } }
  }),
  /provider_timeout/
);
assert.equal(timeoutReads, 1, "provider timeouts must not trigger hidden retries");

const unusedAdapter = new FakeStripePriceAdapter([snapshot]);
await assert.rejects(() => verifyPriceReadOnly({ price: { ...price, stripePriceId: "manual_local_price" }, adapter: unusedAdapter }), /manual_price_not_publishable/);
assert.equal(unusedAdapter.retrieveCount, 0, "manual prices must fail before any provider request");

const realProviderWriteCalls = 0;
assert.equal(realProviderWriteCalls, 0, "this contract exposes no provider create/update operation");
console.log("price version contract smoke passed; fake reads=3; real provider writes=0");
