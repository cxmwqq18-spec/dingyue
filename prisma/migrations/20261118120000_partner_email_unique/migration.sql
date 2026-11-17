-- PartnerApplication: at most one live (pending/approved) application per
-- (siteId, email). The store lowercases and trims emails before insert, so a
-- plain column index is case-safe. Rejected/archived rows stay outside the
-- index so admins can still let a creator reapply. Partial indexes are outside
-- Prisma's schema DSL, same as the CHECK constraints in this migration family.
--
-- Pre-deploy step (run BEFORE this migration, duplicate rows make the index
-- build fail):
--   SELECT "siteId", "email", count(*) FROM "PartnerApplication"
--   WHERE status IN ('pending','approved') GROUP BY 1, 2 HAVING count(*) > 1;
-- Review the rows and delete the losers (keep the earliest, or the one an
-- admin has already acted on). Do not blanket-delete.

CREATE UNIQUE INDEX IF NOT EXISTS "PartnerApplication_siteId_email_live_key"
  ON "PartnerApplication"("siteId", "email")
  WHERE status IN ('pending', 'approved');
