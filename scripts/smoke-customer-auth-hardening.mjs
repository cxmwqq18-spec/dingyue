import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "customer-auth-hardening-"));
const originalNodeEnv = process.env.NODE_ENV;
const realSha256 = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const codeHash = (siteId, email, code) => createHash("sha256").update(`${siteId}:${email}:${code}`).digest("hex");

class StoreError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function loadTs(relativePath, overrides = {}) {
  const sourcePath = path.join(root, relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: sourcePath
  }).outputText;
  const outputPath = path.join(temp, `${path.basename(relativePath).replace(/\.[^.]+$/, "")}-${Math.random().toString(36).slice(2)}.cjs`);
  fs.writeFileSync(outputPath, compiled);
  const loaded = new Module(outputPath);
  loaded.filename = outputPath;
  loaded.paths = Module._nodeModulePaths(path.dirname(outputPath));
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = specifier => Object.hasOwn(overrides, specifier) ? overrides[specifier] : nativeRequire(specifier);
  loaded._compile(compiled, outputPath);
  return loaded.exports;
}

function makeEmailPrisma({ customer, initialVerification, sendError } = {}) {
  const state = {
    verification: initialVerification ? structuredClone(initialVerification) : null,
    customer: customer ? structuredClone(customer) : null,
    sessions: ["old-session-1", "old-session-2"],
    nextSession: 0
  };

  const verificationDelegate = {
    async deleteMany() { return { count: 0 }; },
    async create({ data }) { state.verification = structuredClone(data); return state.verification; },
    async findFirst({ where }) {
      const row = state.verification;
      if (!row || row.siteId !== where.siteId || row.email !== where.email || row.purpose !== where.purpose || row.consumedAt) return null;
      if (!(row.expiresAt > where.expiresAt.gt)) return null;
      return structuredClone(row);
    },
    async updateMany({ where, data }) {
      const row = state.verification;
      if (!row || row.id !== where.id || row.siteId !== where.siteId && where.siteId !== undefined || row.email !== where.email && where.email !== undefined || row.purpose !== where.purpose && where.purpose !== undefined) return { count: 0 };
      if (where.consumedAt === null && row.consumedAt) return { count: 0 };
      if (where.expiresAt?.gt && !(row.expiresAt > where.expiresAt.gt)) return { count: 0 };
      if (where.attempts?.lt !== undefined && !(row.attempts < where.attempts.lt)) return { count: 0 };
      if (data.attempts?.increment) row.attempts += data.attempts.increment;
      if (data.consumedAt !== undefined) row.consumedAt = data.consumedAt;
      return { count: 1 };
    },
    async update({ where, data }) {
      const row = state.verification;
      if (!row || row.id !== where.id) throw new Error("verification_missing");
      Object.assign(row, data);
      return row;
    }
  };
  const customerDelegate = {
    async findUnique() { return state.customer ? structuredClone(state.customer) : null; },
    async create({ data }) {
      state.customer = { id: data.id, siteId: data.siteId, email: data.email, name: data.name, status: data.status, passwordHash: data.passwordHash, balance: { balance: 0, reserved: 0 } };
      return structuredClone(state.customer);
    },
    async update({ where, data }) {
      if (!state.customer || state.customer.id !== where.id) throw new Error("customer_missing");
      Object.assign(state.customer, data);
      return structuredClone(state.customer);
    }
  };
  const sessionDelegate = {
    async deleteMany() { const count = state.sessions.length; state.sessions = []; return { count }; },
    async create({ data }) {
      const session = { ...data, id: `new-session-${++state.nextSession}`, createdAt: new Date() };
      state.sessions.push(session.id);
      return session;
    }
  };
  const tx = { customerEmailVerification: verificationDelegate, customer: customerDelegate, customerSession: sessionDelegate };
  const prisma = {
    site: { async findUnique() { return { id: "site_aidreamcapes", slug: "aidreamcapes", name: "Aidreamcapes", signupCreditGrant: 0, branding: {} }; } },
    customer: customerDelegate,
    customerEmailVerification: verificationDelegate,
    customerSession: sessionDelegate,
    platformEmailSettings: { async findUnique() { return null; } },
    platformEmailConfig: { async findMany() { return []; } },
    siteEmailConfigAssignment: { async findMany() { return []; } },
    async $transaction(callback) {
      const snapshot = structuredClone(state);
      try { return await callback(tx); }
      catch (error) { Object.assign(state, snapshot); throw error; }
    }
  };
  return { prisma, state, sendVerificationEmail: async () => { if (sendError) throw sendError; return { messageId: "mail-1" }; } };
}

function mapperStubs() {
  return {
    "@/lib/server-store": { StoreError },
    "@/lib/ai-provider-type": { inferPlatformAiProviderType() {}, normalizePlatformAiProviderType(value) { return value; } },
    "@/lib/video-provider-family": { normalizeAiProviderProtocol(value) { return value ?? "auto"; } },
    "@/lib/storefront-media-alt": { storefrontGalleryMediaPairs() { return []; } },
    "@/lib/video-frame-config": { normalizeVideoFrameLimit(value) { return value; }, normalizeVideoModelPricing(value) { return value; } },
    "@/lib/tokengo-image": {
      normalizeImageProviderAspectRatio(value) { return value; }, normalizeImageProviderOutputFormat(value) { return value; },
      normalizeImageProviderQuality(value) { return value; }, normalizeImageProviderResolution(value) { return value; }
    }
  };
}

async function main() {
try {
  const mapper = loadTs("src/lib/stores/prisma-mappers.ts", mapperStubs());
  const oldHash = realSha256("legacy-password");
  assert.equal(mapper.verifyRelationalPassword("legacy-password", oldHash), true, "legacy SHA-256 customers remain able to authenticate");
  assert.equal(mapper.verifyRelationalPassword("wrong-password", oldHash), false);
  const strongHash = mapper.hashRelationalPassword("legacy-password");
  assert.match(strongHash, /^scrypt:v1:32768:8:1:/);
  assert.notEqual(strongHash, mapper.hashRelationalPassword("legacy-password"), "password hashes use independent random salts");
  assert.equal(mapper.verifyRelationalPassword("legacy-password", strongHash), true);
  assert.equal(mapper.verifyRelationalPassword("wrong-password", strongHash), false);

  const model = {
    _runtimeDataModel: { models: {
      Customer: { fields: ["id", "siteId", "email", "name", "status", "passwordHash"].map(name => ({ name })) },
      CustomerSession: { fields: ["id", "siteId", "customerId", "createdAt", "expiresAt"].map(name => ({ name })) }
    } }
  };
  let dbCustomer = { id: "customer-1", siteId: "site_aidreamcapes", email: "person@example.test", name: "Person", status: "active", passwordHash: oldHash, balance: { balance: 40, reserved: 0 } };
  let sessionCreates = 0;
  let customerCreates = 0;
  const customerClient = {
    ...model,
    customer: {
      async findUnique() { return dbCustomer ? structuredClone(dbCustomer) : null; },
      async update({ data }) { Object.assign(dbCustomer, data); return structuredClone(dbCustomer); },
      async create() { customerCreates++; throw new Error("legacy_login_must_not_register"); }
    },
    customerSession: { async create({ data }) { sessionCreates++; return { ...data, id: `session-${sessionCreates}`, createdAt: new Date() }; } }
  };
  const prismaStub = {};
  const customerStore = loadTs("src/lib/stores/customer-store.ts", {
    "server-only": {}, "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    "@/lib/prisma": { prisma: prismaStub, runPrismaWriteWithReconnect: fn => fn(), runPrismaReadWithReconnect: fn => fn() },
    "@/lib/server-store": { StoreError },
    "@/lib/stores/relational-fallback": { shouldFallbackRelationalRead: () => false, warnRelationalFallback() {} },
    "@/lib/stores/prisma-mappers": mapper
  });
  const login = await customerStore.createExistingCustomerSessionRelational({ siteId: "site_aidreamcapes", email: "PERSON@example.test", password: "legacy-password" }, customerClient);
  assert.equal(login.createdCustomer, false);
  assert.equal(sessionCreates, 1);
  assert.match(dbCustomer.passwordHash, /^scrypt:v1:/, "successful legacy login upgrades the stored password hash");
  assert.equal(customerCreates, 0);
  dbCustomer = { ...dbCustomer, status: "blocked" };
  await assert.rejects(customerStore.createExistingCustomerSessionRelational({ siteId: "site_aidreamcapes", email: "person@example.test", password: "legacy-password" }, customerClient), error => error instanceof StoreError && error.status === 403);
  assert.equal(sessionCreates, 1, "blocked customers do not receive a session");
  dbCustomer = null;
  await assert.rejects(customerStore.createCustomerSessionRelational({ siteId: "site_aidreamcapes", email: "new@example.test", password: "new-password" }, customerClient), error => error instanceof StoreError && error.status === 401);
  assert.equal(customerCreates, 0, "legacy form helper cannot create customers without email verification");

  let blockedSessionsDeleted = 0;
  const statusClient = {
    customer: { async findFirst() { return { id: "customer-1" }; } },
    customerSession: {},
    async $transaction(callback) {
      return callback({
        customer: { async update({ data }) { return { id: "customer-1", siteId: "site_aidreamcapes", email: "person@example.test", name: "Person", status: data.status, balance: { balance: 0, reserved: 0 } }; } },
        customerSession: { async deleteMany() { blockedSessionsDeleted++; return { count: 2 }; } }
      });
    }
  };
  await customerStore.updateCustomerStatusRelational({ siteId: "site_aidreamcapes", customerId: "customer-1", status: "blocked" }, statusClient);
  assert.equal(blockedSessionsDeleted, 1, "blocking an account deletes its site-scoped sessions");
  const blockedSession = await customerStore.getCustomerBySessionRelational({ siteId: "site_aidreamcapes", sessionId: "old-session" }, {
    customerSession: { async findFirst() { return { id: "old-session", siteId: "site_aidreamcapes", customerId: "customer-1", createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000), customer: { id: "customer-1", siteId: "site_aidreamcapes", email: "person@example.test", name: "Person", status: "blocked", balance: { balance: 0, reserved: 0 } } }; } }
  });
  assert.equal(blockedSession, undefined, "blocked sessions are rejected on readback too");

  const emailState = makeEmailPrisma({ sendError: new Error("smtp_secret_must_not_be_exposed") });
  const emailAuth = loadTs("src/lib/customer-email-auth.ts", {
    "server-only": {}, "@/lib/prisma": { prisma: emailState.prisma }, "@/lib/customer-password-policy": {
      getCustomerPasswordPolicyError: () => null, normalizeCustomerPassword: value => value ?? ""
    }, "@/lib/resend-email": { sendVerificationEmail: emailState.sendVerificationEmail },
    "@/lib/server-store": { StoreError }, "@/lib/stores/prisma-mappers": mapper
  });
  process.env.NODE_ENV = "production";
  const emailResult = await emailAuth.requestCustomerEmailCode({ siteId: "site_aidreamcapes", email: "new@example.test", purpose: "register" });
  assert.equal(emailResult.deliveryStatus, "failed");
  assert.equal(emailResult.devCode, undefined, "production responses never include a verification code when delivery fails");
  assert.equal(emailResult.deliveryError, undefined, "production responses do not expose raw mail-provider errors");
  assert.ok(emailState.state.verification.codeHash && !JSON.stringify(emailResult).includes(emailState.state.verification.codeHash));

  const email = "reset@example.test";
  const correctCode = "654321";
  const verification = { id: "verification-1", siteId: "site_aidreamcapes", email, purpose: "password_reset", codeHash: codeHash("site_aidreamcapes", email, correctCode), attempts: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + 600_000), consumedAt: null };
  const resetCustomer = { id: "customer-reset", siteId: "site_aidreamcapes", email, name: "Reset", status: "past_due", passwordHash: oldHash, balance: { balance: 5, reserved: 0 } };
  const resetState = makeEmailPrisma({ customer: resetCustomer, initialVerification: verification });
  const resetAuth = loadTs("src/lib/customer-email-auth.ts", {
    "server-only": {}, "@/lib/prisma": { prisma: resetState.prisma }, "@/lib/customer-password-policy": {
      getCustomerPasswordPolicyError: () => null, normalizeCustomerPassword: value => value ?? ""
    }, "@/lib/resend-email": { sendVerificationEmail: resetState.sendVerificationEmail },
    "@/lib/server-store": { StoreError }, "@/lib/stores/prisma-mappers": mapper
  });
  for (let attempt = 1; attempt <= 5; attempt++) {
    await assert.rejects(resetAuth.verifyCustomerEmailCode({ siteId: "site_aidreamcapes", email, code: "000000", password: "new-password", confirmPassword: "new-password", purpose: "password_reset" }), error => error instanceof StoreError && error.message === "invalid_verification_code");
    assert.equal(resetState.state.verification.attempts, attempt, `wrong code attempt ${attempt} commits its counter`);
  }
  assert.ok(resetState.state.verification.consumedAt, "fifth wrong code consumes the verification record");
  await assert.rejects(resetAuth.verifyCustomerEmailCode({ siteId: "site_aidreamcapes", email, code: "000000", password: "new-password", confirmPassword: "new-password", purpose: "password_reset" }), error => error instanceof StoreError && error.message === "verification_code_expired");

  resetState.state.verification = structuredClone(verification);
  resetState.state.sessions = ["old-session-1", "old-session-2"];
  const reset = await resetAuth.verifyCustomerEmailCode({ siteId: "site_aidreamcapes", email, code: correctCode, password: "new-password", confirmPassword: "new-password", purpose: "password_reset" });
  assert.equal(reset.customer.status, "past_due", "password reset preserves account status");
  assert.match(resetState.state.customer.passwordHash, /^scrypt:v1:/);
  assert.equal(resetState.state.sessions.length, 1, "password reset revokes every old session and creates one new session");
  assert.equal(resetState.state.sessions[0], reset.session.id);

  const blockedVerification = { ...verification, id: "verification-blocked", codeHash: codeHash("site_aidreamcapes", email, "123456"), attempts: 0, consumedAt: null };
  resetState.state.verification = blockedVerification;
  resetState.state.customer.status = "blocked";
  resetState.state.sessions = [];
  await assert.rejects(resetAuth.verifyCustomerEmailCode({ siteId: "site_aidreamcapes", email, code: "123456", password: "new-password", confirmPassword: "new-password", purpose: "password_reset" }), error => error instanceof StoreError && error.message === "customer_account_blocked");
  assert.equal(resetState.state.customer.status, "blocked", "password reset cannot reactivate a blocked account");
  assert.equal(resetState.state.sessions.length, 0, "a blocked account receives no session through password reset");

  const formStoreCalls = { existing: 0, legacy: 0 };
  const customerAuth = loadTs("src/lib/customer-auth.ts", {
    "next/server": { NextResponse: { redirect(url, status) { return { url: String(url), status, cookies: { set() {} } }; } } },
    "@/lib/server-store": { StoreError },
    "@/lib/session": { customerSessionCookie: () => "customer_session_site_aidreamcapes", publicUrlForRequest: (request, pathValue) => new URL(pathValue, request.url), shouldUseSecureCookie: () => false },
    "@/lib/security/csrf": { setCsrfCookie() {} },
    "@/lib/stores/customer-store": {
      async createExistingCustomerSessionRelational() { formStoreCalls.existing++; return { customer: {}, session: { id: "session-form", expiresAt: new Date(Date.now() + 60_000).toISOString() } }; },
      async createCustomerSessionRelational() { formStoreCalls.legacy++; throw new Error("unsafe_login_path_called"); }
    }
  });
  const formRequest = new Request("https://aidreamcapes.example/site/aidreamcapes/login/submit", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email: "known@example.test", password: "existing-password" })
  });
  const formResult = await customerAuth.handleCustomerLoginForm(formRequest, { id: "site_aidreamcapes" }, "/site/aidreamcapes/app/create", "/site/aidreamcapes/login");
  assert.equal(formResult.status, 303);
  assert.equal(formStoreCalls.existing, 1);
  assert.equal(formStoreCalls.legacy, 0, "legacy HTML form delegates only to existing-customer login");

  const apiAuthSource = fs.readFileSync(path.join(root, "src/lib/api-auth.ts"), "utf8");
  assert.match(apiAuthSource, /const customerSessionCacheTtlMs = 0;/, "customer sessions are checked against database state on each app instance");
  assert.ok(apiAuthSource.includes("getCustomerBySessionRelational({ siteId, sessionId })"), "customer session reads validate revocation against relational state");

  console.log("PASS: salted scrypt with legacy login upgrade, verified registration-only path, blocked account/session enforcement, cross-instance session revocation, non-rollback OTP throttling, production OTP secrecy, and password-reset session revocation");
} finally {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  fs.rmSync(temp, { recursive: true, force: true });
}
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
