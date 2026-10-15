import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const source = path.join(root, "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-teams-brands-"));

try {
  for (const name of ["types", "team-brand-core"]) {
    const result = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    });
    fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
  }
  const require = createRequire(path.join(temp, "entry.cjs"));
  const { WorkspaceError } = require("./types.js");
  const core = require("./team-brand-core.js");
  const denied = fn => assert.throws(fn, error => error instanceof WorkspaceError);

  for (const role of ["owner", "admin", "editor", "viewer"]) core.assertTeamPermission(role, "read");
  for (const role of ["owner", "admin"]) core.assertTeamPermission(role, "manage_team");
  for (const role of ["editor", "viewer"]) denied(() => core.assertTeamPermission(role, "manage_team"));
  for (const role of ["owner", "admin", "editor"]) core.assertTeamPermission(role, "write_brand");
  denied(() => core.assertTeamPermission("viewer", "write_brand"));
  core.assertCanInviteRole("owner", "admin");
  core.assertCanInviteRole("admin", "editor");
  core.assertCanInviteRole("admin", "viewer");
  denied(() => core.assertCanInviteRole("admin", "admin"));
  denied(() => core.assertCanInviteRole("editor", "viewer"));
  core.assertCanRemoveMember("owner", "admin");
  core.assertCanRemoveMember("admin", "editor");
  denied(() => core.assertCanRemoveMember("admin", "admin"));
  denied(() => core.assertCanRemoveMember("editor", "viewer"));

  const pending = { siteId: "site_aidreamcapes", ownerSiteId: "site_aidreamcapes", invitedCustomerId: "customer-invited", status: "pending" };
  core.assertInviteAcceptance(pending, "customer-invited", "site_aidreamcapes");
  denied(() => core.assertInviteAcceptance(pending, "different-customer", "site_aidreamcapes"));
  denied(() => core.assertInviteAcceptance(pending, "customer-invited", "site_dreamshoot"));
  denied(() => core.assertInviteAcceptance({ ...pending, ownerSiteId: "site_dreamshoot" }, "customer-invited", "site_aidreamcapes"));
  denied(() => core.assertInviteAcceptance({ ...pending, status: "accepted" }, "customer-invited", "site_aidreamcapes"));

  assert.equal(core.assertExpectedRevision(3, 3), 3);
  assert.throws(() => core.assertExpectedRevision(3, 2), error => error.code === "revision_conflict" && error.status === 409);
  assert.throws(() => core.assertExpectedRevision(3, undefined), error => error.code === "revision_required" && error.status === 428);

  const drafted = core.normalizeBrandFactInput({ factKey: "materials", factValue: "Cotton blend", sourceUrl: "https://shop.example/products/item", sourceLabel: "Product page" });
  assert.equal(drafted.confirmed, false);
  assert.equal(drafted.confirmedByCustomerId, null);
  assert.equal(drafted.confirmedAt, null);
  assert.equal(drafted.sourceType, "product_url");
  assert.equal(drafted.sourceUrl, "https://shop.example/products/item");
  denied(() => core.normalizeBrandFactInput({ factKey: "materials", factValue: "Cotton blend", confirmed: true }));
  const first = { ...drafted, id: "fact-1", brandProfileId: "brand-1", siteId: "site_aidreamcapes", ownerCustomerId: "owner-a", revision: 1 };
  const confirmed = core.updateBrandFactSnapshot(first, { confirm: true }, "editor-a", new Date("2026-10-14T00:00:00Z"));
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.confirmedByCustomerId, "editor-a");
  assert.equal(confirmed.confirmedAt.toISOString(), "2026-10-14T00:00:00.000Z");
  assert.equal(confirmed.revision, 2);
  const edited = core.updateBrandFactSnapshot(confirmed, { factValue: "Organic cotton blend" }, "editor-a");
  assert.equal(edited.confirmed, false);
  assert.equal(edited.confirmedByCustomerId, null);
  assert.equal(edited.confirmedAt, null);
  assert.equal(edited.revision, 3);
  assert.equal(edited.sourceType, "product_url");

  denied(() => core.assertTeamSite("site_dreamshoot", "site_dreamshoot"));
  denied(() => core.assertTeamSite("site_aidreamcapes", "site_dreamshoot"));
  const teamsSource = fs.readFileSync(path.join(source, "teams.ts"), "utf8");
  const brandsSource = fs.readFileSync(path.join(source, "brands.ts"), "utf8");
  const migration = fs.readFileSync(path.join(root, "prisma/migrations/20261014150000_add_aidreamcapes_teams_brands/migration.sql"), "utf8");
  for (const serviceSource of [teamsSource, brandsSource]) {
    assert.match(serviceSource, /AIVIDEOSUGC_SITE_ID/);
    assert.match(serviceSource, /ownerCustomerId/);
    for (const match of serviceSource.matchAll(/\$(?:queryRaw|executeRaw)(?:<[^`]*>)?`([\s\S]*?)`/g)) {
      assert.match(match[1], /AIVIDEOSUGC_SITE_ID/);
    }
  }
  assert.match(teamsSource, /actor\."customerId" = \$\{customerId\}/);
  assert.match(teamsSource, /i\."invitedCustomerId" = \$\{customerId\}/);
  assert.match(brandsSource, /actor\."customerId" = \$\{customerId\}/);
  assert.match(brandsSource, /f\."revision" = \$\{expectedRevision\}/);
  assert.equal((migration.match(/CHECK \("siteId" = 'site_aidreamcapes'\)/g) ?? []).length, 6);
  assert.match(migration, /AidreamcapesBrandFactVersion_fact_revision_unique/);
  assert.match(migration, /AidreamcapesTeamMember_single_owner/);
  assert.match(migration, /invitedCustomerId/);
  assert.match(migration, /TG_TABLE_NAME = 'AidreamcapesBrandFactVersion' AND NOT EXISTS[\s\S]*NEW\."changedByCustomerId" AND "siteId" = 'site_aidreamcapes'/);

  const routes = [
    "src/app/api/sites/[siteId]/aivideosugc/teams/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/teams/[teamId]/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/teams/[teamId]/members/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/teams/[teamId]/members/[customerId]/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/teams/[teamId]/invites/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/teams/invites/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/teams/invites/[inviteId]/accept/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/brands/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/brands/[brandId]/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/brands/[brandId]/facts/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/brands/[brandId]/facts/[factId]/route.ts"
  ];
  for (const file of routes) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(content, /workspaceAuth/);
    assert.doesNotMatch(content, /fetch\(|sendEmail|provider|ledger|charge|generation/i);
  }
  console.log("Aidreamcapes team and brand smoke checks passed; permissions, invite ownership, optimistic revisions, and unconfirmed facts verified.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
