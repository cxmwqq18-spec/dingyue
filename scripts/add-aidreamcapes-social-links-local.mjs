import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { AIDREAMCAPES_SOCIAL_SITE_ID, AIDREAMCAPES_SOCIAL_LINKS, withAidreamcapesSocialLinks } from "./lib/aidreamcapes-social-links.mjs";

loadRuntimeEnv();
const target = assertDatabaseTarget({ expectedTarget: "local" });
const SITE_ID = AIDREAMCAPES_SOCIAL_SITE_ID;
assert.equal(SITE_ID, "site_aidreamcapes");
const APPLY = hasArgument("--apply-local");
const prisma = new PrismaClient();

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

try {
  const report = await prisma.$transaction(async (tx) => {
    const settings = await tx.themeSettings.findUnique({
      where: { siteId: SITE_ID },
      select: { id: true, siteId: true, draftJson: true, publishedJson: true, updatedAt: true }
    });
    assert.ok(settings, "current Aidreamcapes ThemeSettings row is required");
    assert.equal(settings.siteId, SITE_ID);
    // Public live settings currently use draftJson as the current navigation field.
    // Patch it independently; publishedJson is kept consistent without copying either whole document.
    const draftJson = withAidreamcapesSocialLinks(settings.draftJson);
    const publishedJson = withAidreamcapesSocialLinks(settings.publishedJson);
    const nextByField = { draftJson, publishedJson };
    const changes = ["draftJson", "publishedJson"].filter((field) =>
      JSON.stringify(settings[field].aidreamcapesV2Navigation.footer.socialLinks) !==
      JSON.stringify(nextByField[field].aidreamcapesV2Navigation.footer.socialLinks)
    );

    if (APPLY && changes.length) {
      // Patch only the requested JSONB fields. Equality and updatedAt prevent overwriting an intervening edit.
      const socialJson = JSON.stringify(publishedJson.aidreamcapesV2Navigation.footer.socialLinks);
      const count = await tx.$executeRaw`
        UPDATE "ThemeSettings"
        SET "draftJson" = jsonb_set("draftJson", '{aidreamcapesV2Navigation,footer,socialLinks}', ${socialJson}::jsonb, true),
            "publishedJson" = jsonb_set("publishedJson", '{aidreamcapesV2Navigation,footer,socialLinks}', ${socialJson}::jsonb, true),
            "updatedAt" = NOW()
        WHERE "id" = ${settings.id}
          AND "siteId" = ${SITE_ID}
          AND "updatedAt" = ${settings.updatedAt}
          AND "publishedJson" = ${JSON.stringify(settings.publishedJson)}::jsonb
          AND "draftJson" = ${JSON.stringify(settings.draftJson)}::jsonb
      `;
      assert.equal(count, 1, "current navigation changed during the operation; no stale overwrite is allowed");
      const current = await tx.themeSettings.findUniqueOrThrow({ where: { siteId: SITE_ID } });
      assert.deepEqual(current.draftJson, draftJson, "live current-navigation readback differs from the field-level patch");
      assert.deepEqual(current.publishedJson, publishedJson, "published readback differs from the field-level patch");
    }

    return {
      mode: APPLY ? "apply-local" : "dry-run",
      siteId: SITE_ID,
      owner: `ThemeSettings:${settings.id}`,
      target: { host: target.host, port: target.port, database: target.database },
      writes: APPLY && changes.length ? 1 : 0,
      fields: changes.map((field) => `${field}.aidreamcapesV2Navigation.footer.socialLinks`),
      beforeHash: digest(settings.draftJson),
      afterHash: digest(draftJson),
      liveField: "draftJson.aidreamcapesV2Navigation.footer.socialLinks",
      links: AIDREAMCAPES_SOCIAL_LINKS,
      readbackVerified: APPLY && changes.length > 0
    };
  }, { isolationLevel: "Serializable" });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
