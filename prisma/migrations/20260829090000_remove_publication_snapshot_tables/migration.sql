-- Public SSR now reads the latest draft records directly. These tables are
-- retired storage and must not be used as an application data source.
-- Run only after the encrypted pre-change database backup is verified.

ALTER TABLE IF EXISTS "ThemePublication" DROP CONSTRAINT IF EXISTS "ThemePublication_approvalId_fkey";
ALTER TABLE IF EXISTS "ActiveThemePublication" DROP CONSTRAINT IF EXISTS "ActiveThemePublication_publicationId_fkey";

DROP TABLE IF EXISTS "ActiveThemePublication";
DROP TABLE IF EXISTS "ThemePublication";
DROP TABLE IF EXISTS "ThemePublishApprovalItem";
DROP TABLE IF EXISTS "ThemePublishApproval";
DROP TABLE IF EXISTS "SitePublishedState";
