import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { chromium } from "playwright";

// Mount the real customer component in a local browser fixture. Every API call
// is intercepted below; this smoke does not start the app or touch a database.
const require = createRequire(import.meta.url);
const compiledWebpack = require("next/dist/compiled/webpack/webpack");
compiledWebpack.init();
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-team-brand-workbench-"));
const componentRoot = path.resolve("src/components/aidreamcapes-workspace");
const componentPath = path.join(componentRoot, "team-brand-workbench.tsx");
const css = fs.readFileSync(path.join(componentRoot, "team-brand-workbench.module.css"), "utf8");
const classNames = [...new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]))];
const classes = Object.fromEntries(classNames.map((name) => [name, `tb-${name}`]));
const component = fs.readFileSync(componentPath, "utf8")
  .replace('"@/lib/client-csrf"', '"./csrf"')
  .replace('"./team-brand-workbench.module.css"', '"./styles"');
fs.writeFileSync(path.join(folder, "team-brand-workbench.js"), ts.transpileModule(component, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText);
fs.writeFileSync(path.join(folder, "styles.js"), `module.exports = ${JSON.stringify(classes)};`);
fs.writeFileSync(path.join(folder, "csrf.js"), `exports.customerJsonHeaders = (siteId) => ({ "Content-Type": "application/json", "x-csrf-token": "fixture-csrf", "x-fixture-site": siteId });`);
fs.writeFileSync(path.join(folder, "entry.js"), `
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const { TeamBrandWorkbench } = require("./team-brand-workbench");
  const customerId = new URLSearchParams(window.location.search).has("guest") ? "" : "customer-current";
  createRoot(document.getElementById("root")).render(React.createElement(TeamBrandWorkbench, { siteId: "site_aidreamcapes", customerId, csrfToken: "fixture-csrf" }));
`);
await new Promise((resolve, reject) => compiledWebpack.webpack({
  mode: "development",
  devtool: false,
  entry: path.join(folder, "entry.js"),
  output: { path: folder, filename: "bundle.js" },
  resolve: { modules: [path.resolve("node_modules")] }
}, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString())) : resolve()));

const scopedCss = css.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => `.${classes[name] ?? name}`);
const html = `<html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;padding:22px;background:#f3f4f6;color:#101623;font-family:Arial,sans-serif}
  :root{--ink:#101623;--muted:#73777d;--line:#e3e6ec;--surface:#fff;--canvas:#f3f4f6;--purple:#6035ff}
  ${scopedCss}
</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;

const teams = [
  { id: "team-one", ownerCustomerId: "customer-current", name: "Luna Studio", revision: 1, role: "owner" }
];
const brands = [];
const membersByTeam = {
  "team-one": [
    { customerId: "customer-current", name: "Current workspace", role: "owner" },
    { customerId: "customer-editor", name: "Studio editor", role: "editor" }
  ]
};
const invitesByTeam = { "team-one": [] };
const receivedInvites = [{ id: "invite-incoming", teamId: "team-shared", invitedCustomerId: "customer-current", invitedByCustomerId: "customer-owner", role: "viewer", status: "pending", createdAt: "2026-10-15T08:00:00.000Z", teamName: "Northstar Studio" }];
const factsByBrand = {};
const calls = [];
const unexpected = [];
const external = [];
const pageErrors = [];
let nextTeam = 1;
let nextBrand = 1;
let nextFact = 1;
let nextInvite = 1;
let denyAcceptOnce = true;
let denyRemoveOnce = true;
let conflictTeamPatchOnce = true;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1180, height: 980 } });
const page = await context.newPage();
page.on("pageerror", (error) => pageErrors.push(error.message));
await page.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.hostname !== "teams.fixture") { external.push(request.url()); return route.abort(); }
  if (url.pathname === "/bundle.js") return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(folder, "bundle.js"), "utf8") });
  if (!url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "text/html", body: html });

  const method = request.method();
  const pathname = url.pathname;
  const base = "/api/sites/site_aidreamcapes/aivideosugc";
  calls.push({ method, pathname });
  const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const json = () => request.postDataJSON();
  const revision = () => Number(request.headers()["if-match"]);
  const csrf = () => assert.equal(request.headers()["x-csrf-token"], "fixture-csrf", `${method} ${pathname} carries CSRF`);

  if (pathname === `${base}/teams` && method === "GET") return reply({ teams: [...teams] });
  if (pathname === `${base}/brands` && method === "GET") return reply({ brands: [...brands] });
  if (pathname === `${base}/teams/invites` && method === "GET") return reply({ invites: [...receivedInvites] });

  if (pathname === `${base}/teams` && method === "POST") {
    csrf();
    const body = json();
    assert.deepEqual(Object.keys(body), ["name"]);
    const team = { id: `team-new-${nextTeam++}`, ownerCustomerId: "customer-current", name: body.name, revision: 1, role: "owner" };
    teams.push(team);
    membersByTeam[team.id] = [{ customerId: "customer-current", name: "Current workspace", role: "owner" }];
    invitesByTeam[team.id] = [];
    return reply({ team }, 201);
  }

  const acceptMatch = pathname.match(new RegExp(`^${base}/teams/invites/([^/]+)/accept$`));
  if (acceptMatch && method === "POST") {
    csrf();
    assert.equal(acceptMatch[1], "invite-incoming");
    if (denyAcceptOnce) { denyAcceptOnce = false; return reply({ error: "customer_auth_required" }, 403); }
    const invite = receivedInvites[0];
    invite.status = "accepted";
    invite.respondedAt = "2026-10-15T09:00:00.000Z";
    const team = { id: invite.teamId, ownerCustomerId: "customer-owner", name: invite.teamName, revision: 1, role: invite.role };
    teams.push(team);
    membersByTeam[team.id] = [
      { customerId: "customer-owner", name: "Team owner", role: "owner" },
      { customerId: "customer-current", name: "Current workspace", role: "viewer" }
    ];
    invitesByTeam[team.id] = [invite];
    brands.push({ id: "brand-shared", teamId: team.id, ownerCustomerId: "customer-owner", name: "Northstar Goods", revision: 1, profile: { website: "https://northstar.example", description: "A shared team brand" }, role: "viewer" });
    factsByBrand["brand-shared"] = [{ id: "fact-shared", brandProfileId: "brand-shared", factKey: "materials", factValue: "Cotton canvas", sourceType: "product_url", sourceUrl: "https://northstar.example/materials", sourceLabel: "Materials page", confirmed: true, confirmedByCustomerId: "customer-owner", confirmedAt: "2026-10-01T08:00:00.000Z", revision: 2 }];
    return reply({ invite, membership: membersByTeam[team.id][1] });
  }

  const teamMatch = pathname.match(new RegExp(`^${base}/teams/([^/]+)$`));
  if (teamMatch && method === "GET") {
    const team = teams.find((item) => item.id === teamMatch[1]);
    return team ? reply({ team }) : reply({ error: "team_not_found" }, 404);
  }
  if (teamMatch && method === "PATCH") {
    csrf();
    const team = teams.find((item) => item.id === teamMatch[1]);
    if (!team) return reply({ error: "team_not_found" }, 404);
    if (conflictTeamPatchOnce) { conflictTeamPatchOnce = false; return reply({ error: "revision_conflict" }, 409); }
    assert.equal(revision(), team.revision, "team update carries If-Match revision");
    const body = json();
    assert.equal(body.revision, team.revision);
    team.name = body.name;
    team.revision += 1;
    return reply({ team });
  }

  const membersMatch = pathname.match(new RegExp(`^${base}/teams/([^/]+)/members$`));
  if (membersMatch && method === "GET") return reply({ members: [...(membersByTeam[membersMatch[1]] ?? [])] });
  const memberMatch = pathname.match(new RegExp(`^${base}/teams/([^/]+)/members/([^/]+)$`));
  if (memberMatch && method === "DELETE") {
    csrf();
    if (denyRemoveOnce) { denyRemoveOnce = false; return reply({ error: "customer_role_forbidden" }, 403); }
    const memberRows = membersByTeam[memberMatch[1]] ?? [];
    const index = memberRows.findIndex((member) => member.customerId === memberMatch[2]);
    if (index < 0) return reply({ error: "team_member_not_found" }, 404);
    memberRows.splice(index, 1);
    return reply({ ok: true });
  }

  const teamInvitesMatch = pathname.match(new RegExp(`^${base}/teams/([^/]+)/invites$`));
  if (teamInvitesMatch && method === "GET") return reply({ invites: [...(invitesByTeam[teamInvitesMatch[1]] ?? [])] });
  if (teamInvitesMatch && method === "POST") {
    csrf();
    const body = json();
    assert.deepEqual(Object.keys(body).sort(), ["customerId", "role"]);
    assert.equal(body.customerId, "customer-recipient");
    assert.equal(body.role, "editor");
    const invite = { id: `invite-outgoing-${nextInvite++}`, teamId: teamInvitesMatch[1], invitedCustomerId: body.customerId, invitedByCustomerId: "customer-current", role: body.role, status: "pending", createdAt: "2026-10-15T09:10:00.000Z" };
    invitesByTeam[teamInvitesMatch[1]].push(invite);
    return reply({ invite }, 201);
  }

  if (pathname === `${base}/brands` && method === "POST") {
    csrf();
    const body = json();
    assert.deepEqual(Object.keys(body).sort(), ["name", "profile", "teamId"].sort());
    const team = teams.find((item) => item.id === body.teamId);
    assert.ok(team);
    const brand = { id: `brand-new-${nextBrand++}`, teamId: team.id, ownerCustomerId: "customer-current", name: body.name, revision: 1, profile: body.profile, role: team.role };
    brands.push(brand);
    factsByBrand[brand.id] = [];
    return reply({ brand }, 201);
  }

  const brandMatch = pathname.match(new RegExp(`^${base}/brands/([^/]+)$`));
  if (brandMatch && method === "GET") {
    const brand = brands.find((item) => item.id === brandMatch[1]);
    return brand ? reply({ brand }) : reply({ error: "brand_not_found" }, 404);
  }
  if (brandMatch && method === "PATCH") {
    csrf();
    const brand = brands.find((item) => item.id === brandMatch[1]);
    if (!brand) return reply({ error: "brand_not_found" }, 404);
    assert.equal(revision(), brand.revision, "brand update carries If-Match revision");
    const body = json();
    assert.equal(body.revision, brand.revision);
    brand.name = body.name;
    brand.profile = body.profile;
    brand.revision += 1;
    return reply({ brand });
  }

  const factsMatch = pathname.match(new RegExp(`^${base}/brands/([^/]+)/facts$`));
  if (factsMatch && method === "GET") return reply({ facts: [...(factsByBrand[factsMatch[1]] ?? [])] });
  if (factsMatch && method === "POST") {
    csrf();
    const body = json();
    assert.deepEqual(Object.keys(body).sort(), ["factKey", "factValue", "sourceLabel", "sourceUrl"].sort());
    assert.equal(body.factKey, "materials");
    assert.equal(body.sourceUrl, "https://luna.example/materials");
    assert.equal(body.sourceLabel, "Materials page");
    assert.equal(Object.hasOwn(body, "confirmed"), false, "fact creation never sets confirmation");
    const fact = { id: `fact-new-${nextFact++}`, brandProfileId: factsMatch[1], factKey: body.factKey, factValue: body.factValue, sourceType: body.sourceUrl ? "product_url" : "manual", sourceUrl: body.sourceUrl, sourceLabel: body.sourceLabel, confirmed: false, confirmedByCustomerId: null, confirmedAt: null, revision: 1 };
    factsByBrand[factsMatch[1]].push(fact);
    return reply({ fact }, 201);
  }

  const factMatch = pathname.match(new RegExp(`^${base}/brands/([^/]+)/facts/([^/]+)$`));
  if (factMatch && method === "PATCH") {
    csrf();
    const fact = (factsByBrand[factMatch[1]] ?? []).find((item) => item.id === factMatch[2]);
    if (!fact) return reply({ error: "brand_fact_not_found" }, 404);
    assert.equal(revision(), fact.revision, "fact update carries If-Match revision");
    const body = json();
    assert.equal(body.revision, fact.revision);
    if (body.confirm === true) {
      fact.confirmed = true;
      fact.confirmedByCustomerId = "customer-current";
      fact.confirmedAt = "2026-10-15T09:20:00.000Z";
    } else {
      fact.factKey = body.factKey;
      fact.factValue = body.factValue;
      fact.sourceUrl = body.sourceUrl;
      fact.sourceLabel = body.sourceLabel;
      fact.confirmed = false;
      fact.confirmedByCustomerId = null;
      fact.confirmedAt = null;
    }
    fact.revision += 1;
    return reply({ fact });
  }

  unexpected.push(`${method} ${pathname}`);
  return reply({ error: "unexpected_fixture_request" }, 500);
});

function acceptNextDialog(expected) {
  page.once("dialog", async (dialog) => {
    assert.ok(dialog.message().includes(expected), `confirmation includes “${expected}”`);
    await dialog.accept();
  });
}

function waitForTeamDetails(teamId) {
  return Promise.all([
    page.waitForResponse((response) => response.url().endsWith(`/teams/${teamId}`) && response.request().method() === "GET"),
    page.waitForResponse((response) => response.url().endsWith(`/teams/${teamId}/members`) && response.request().method() === "GET"),
    page.waitForResponse((response) => response.url().endsWith(`/teams/${teamId}/invites`) && response.request().method() === "GET")
  ]);
}

function waitForBrandDetails(brandId) {
  return Promise.all([
    page.waitForResponse((response) => response.url().endsWith(`/brands/${brandId}`) && response.request().method() === "GET"),
    page.waitForResponse((response) => response.url().endsWith(`/brands/${brandId}/facts`) && response.request().method() === "GET")
  ]);
}

async function settleReact() {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

try {
  await page.goto("https://teams.fixture/site/aidreamcapes/app/create?view=teams");
  await page.getByRole("heading", { name: "Teams & brands", exact: true }).waitFor();
  await page.getByText("Luna Studio", { exact: true }).first().waitFor();
  assert.equal(calls.filter((call) => call.method === "GET" && call.pathname.endsWith("/teams")).length, 1, "initial team list loads once");

  // Conflict recovery and optimistic team revision.
  await page.getByLabel("Team name", { exact: true }).fill("Updated Luna Studio");
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "This record changed in another session" }).waitFor();
  const refreshedTeam = waitForTeamDetails("team-one");
  await page.getByRole("button", { name: "Reload", exact: true }).last().click();
  await refreshedTeam;
  await settleReact();
  await page.getByLabel("Team name", { exact: true }).fill("Updated Luna Studio");
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Team details saved." }).waitFor();
  assert.equal(teams[0].revision, 2);

  // Remove confirmation is explicit; a denied response is surfaced without hiding the member.
  acceptNextDialog("Remove Studio editor");
  await page.getByRole("button", { name: "Remove Studio editor", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "cannot make that change" }).waitFor();
  await page.getByText("Studio editor", { exact: true }).waitFor();
  acceptNextDialog("Remove Studio editor");
  await page.getByRole("button", { name: "Remove Studio editor", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Studio editor was removed" }).waitFor();
  await page.getByText("Studio editor", { exact: true }).waitFor({ state: "detached" });

  // Creating a team selects it, and selection uses the actual team list.
  await page.getByLabel("New team name", { exact: true }).fill("Aurora Team");
  await page.getByRole("button", { name: "Create team", exact: true }).click();
  await page.getByText("Aurora Team", { exact: true }).first().waitFor();
  assert.ok(teams.some((team) => team.name === "Aurora Team" && team.role === "owner"));
  assert.equal(await page.getByLabel("Select a team", { exact: true }).inputValue(), "team-new-1", "creating a team selects it");
  let selectedTeamLoad = waitForTeamDetails("team-one");
  await page.getByLabel("Select a team", { exact: true }).selectOption("team-one");
  await selectedTeamLoad;
  await settleReact();
  await page.getByText("Updated Luna Studio", { exact: true }).first().waitFor();
  selectedTeamLoad = waitForTeamDetails("team-new-1");
  await page.getByLabel("Select a team", { exact: true }).selectOption({ label: "Aurora Team · Owner" });
  await selectedTeamLoad;
  await settleReact();
  await page.getByText("Aurora Team", { exact: true }).first().waitFor();

  // Invite an existing customer by workspace ID. The API returns no token/link.
  await page.getByLabel("Recipient workspace ID", { exact: true }).fill("customer-recipient");
  await page.getByRole("button", { name: "Create invitation", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "No email or shareable link was sent" }).waitFor();
  assert.equal(await page.getByText(/https?:\/\/.*invite/i).count(), 0, "no synthetic invitation link is rendered");
  assert.ok(invitesByTeam[teams.find((team) => team.name === "Aurora Team").id].length === 1);

  // Keyboard activation changes workspace sections.
  const brandsTab = page.getByRole("button", { name: "Brands & facts", exact: true });
  await brandsTab.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Brand profile", exact: true }).waitFor();
  await page.getByLabel("New brand name", { exact: true }).fill("Aurora Goods");
  await page.getByLabel("New brand website", { exact: true }).fill("https://aurora.example");
  await page.getByLabel("New brand description", { exact: true }).fill("Everyday pieces for the home.");
  const createBrandButton = page.getByRole("button", { name: "Create brand", exact: true });
  await createBrandButton.focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Brand name", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Brand name", { exact: true }).inputValue(), "Aurora Goods");
  assert.equal(brands.length, 1);

  await page.getByLabel("Brand name", { exact: true }).fill("Aurora Home");
  await page.getByLabel("Brand description", { exact: true }).fill("Useful, considered home goods.");
  await page.getByRole("button", { name: "Save brand", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Brand profile saved." }).waitFor();
  assert.equal(brands[0].revision, 2);

  // A customer-sourced fact starts unconfirmed; confirmation and edits use revisions.
  await page.getByLabel("New fact key", { exact: true }).fill("materials");
  await page.getByLabel("New fact value", { exact: true }).fill("Recycled cotton canvas");
  await page.getByLabel("New fact source", { exact: true }).fill("https://luna.example/materials");
  await page.getByLabel("New fact source label", { exact: true }).fill("Materials page");
  await page.getByRole("button", { name: "Add unconfirmed fact", exact: true }).click();
  await page.getByText("Recycled cotton canvas", { exact: true }).waitFor();
  await page.getByText("Review needed", { exact: true }).waitFor();
  acceptNextDialog("Confirm “materials”");
  await page.getByRole("button", { name: "Confirm this fact", exact: true }).click();
  await page.getByText("Confirmed", { exact: true }).waitFor();
  const createdFact = factsByBrand[brands[0].id][0];
  assert.equal(createdFact.confirmed, true);
  assert.equal(createdFact.revision, 2);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Edit fact value", { exact: true }).fill("Recycled cotton canvas with a linen blend");
  await page.getByRole("button", { name: "Save fact", exact: true }).click();
  await page.getByText("Fact updated. Its confirmation was cleared", { exact: false }).waitFor();
  await page.getByText("Review needed", { exact: true }).waitFor();
  assert.equal(createdFact.confirmed, false, "editing a confirmed fact clears confirmation");
  assert.equal(createdFact.revision, 3, "fact edit increments its revision");

  // Received invitations use the real accept route; a 403 is visible and retryable.
  await page.getByRole("button", { name: "Teams & access", exact: true }).click();
  await page.getByRole("heading", { name: "Invitations for you", exact: true }).waitFor();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "cannot make that change" }).waitFor();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "You joined Northstar Studio" }).waitFor();
  await page.getByLabel("Select a team", { exact: true }).selectOption({ label: "Northstar Studio · Viewer" });
  await page.getByText("Northstar Studio", { exact: true }).first().waitFor();
  await page.getByLabel("Team name", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Team name", { exact: true }).isDisabled(), true, "viewer cannot rename a team");
  assert.equal(await page.getByRole("button", { name: "Create invitation", exact: true }).count(), 0, "viewer cannot invite team members");
  assert.equal(await page.getByRole("button", { name: "Remove Team owner", exact: true }).isDisabled(), true, "team owner removal is disabled");

  await page.getByRole("button", { name: "Brands & facts", exact: true }).click();
  const brandSelect = page.getByLabel("Select a brand", { exact: true });
  const sharedBrandLoad = waitForBrandDetails("brand-shared");
  await brandSelect.selectOption("brand-shared");
  await sharedBrandLoad;
  await settleReact();
  await page.getByLabel("Brand name", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Brand name", { exact: true }).inputValue(), "Northstar Goods");
  assert.equal(await page.getByLabel("Brand name", { exact: true }).isDisabled(), true, "viewer cannot edit brand details");
  assert.equal(await page.getByRole("button", { name: "Edit", exact: true }).isDisabled(), true, "viewer cannot edit facts");
  assert.equal(await page.getByRole("button", { name: "Confirm this fact", exact: true }).count(), 0, "viewer cannot confirm facts");

  const callsBeforeGuest = calls.length;
  await page.goto("https://teams.fixture/site/aidreamcapes/app/create?view=teams&guest=1");
  await page.getByRole("heading", { name: "Log in to manage your workspace", exact: true }).waitFor();
  const loginHref = new URL(await page.getByRole("link", { name: "Log in", exact: true }).last().getAttribute("href"), "https://teams.fixture");
  assert.equal(loginHref.pathname, "/site/aidreamcapes/login");
  assert.equal(loginHref.searchParams.get("next"), "/site/aidreamcapes/app/create?view=teams");
  assert.equal(calls.length, callsBeforeGuest, "guest state shows a login path without requesting private APIs");

  const teamInvitePost = calls.find((call) => call.method === "POST" && /\/teams\/[^/]+\/invites$/.test(call.pathname));
  const acceptPost = calls.find((call) => call.method === "POST" && call.pathname.endsWith("/teams/invites/invite-incoming/accept"));
  assert.ok(teamInvitePost, "owner invitation uses the actual team invite endpoint");
  assert.ok(acceptPost, "received invite uses the actual accept endpoint");
  assert.equal(calls.filter((call) => call.method === "POST" && call.pathname.endsWith("/accept")).length, 2, "accept retried after the fixture denial");

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "390px layout has no horizontal overflow");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(external, [], "no external network requests");
  assert.deepEqual(unexpected, [], "only the team, invite, brand, and fact APIs are requested");
  console.log(`PASS TeamBrandWorkbench actual browser component: team create/select/edit, optimistic conflict and reload, confirmed member removal with denial/retry, existing-customer invite, received invite denial/accept, brand create/edit, sourced fact confirm/revision, viewer permissions, guest login without API calls, keyboard use, 390px fit, no unexpected network. Requests: ${calls.length}.`);
} catch (error) {
  console.error({ calls, unexpected, external, body: await page.locator("body").innerText().catch(() => "") });
  throw error;
} finally {
  await browser.close();
  fs.rmSync(folder, { recursive: true, force: true });
}
