import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const sourceRoot = path.join(process.cwd(), "src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  const resolvedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};

const jiti = createJiti(import.meta.url);
const {
  aidreamcapesPublicSeoPageMetadata,
  dreamshootPublicSeoPageMetadata,
  getDreamshootPublicSeoPageMetadataForSite
} = jiti("../src/lib/dreamshoot-seo-content.ts");
const {
  dreamshootAiStudioTemplates,
  dreamshootAiStudioTemplatesForSite
} = jiti("../src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");

const publicPaths = ["/about-us", "/contact-us", "/creators-circle", "/partner-registration"];
const aidreamcapesSite = {
  id: "site_aidreamcapes",
  slug: "aidreamcapes",
  name: "Aidreamcapes",
  primaryDomain: "www.aidreamcapes.com",
  branding: { logoText: "Aidreamcapes" }
};

for (const pathName of publicPaths) {
  const templateKey = pathName.slice(1);
  const mydreamshootsSeed = dreamshootPublicSeoPageMetadata[pathName];
  const aidreamcapesSeed = aidreamcapesPublicSeoPageMetadata[pathName];
  assert.ok(mydreamshootsSeed, `${pathName} should expose MyDreamShoots public SEO metadata`);
  assert.ok(aidreamcapesSeed, `${pathName} should expose Aidreamcapes public SEO metadata`);
  assert.notEqual(mydreamshootsSeed.title, aidreamcapesSeed.title, `${pathName} titles should stay brand-isolated`);
  assert.equal(getDreamshootPublicSeoPageMetadataForSite(undefined, pathName)?.title, mydreamshootsSeed.title);
  assert.equal(getDreamshootPublicSeoPageMetadataForSite(aidreamcapesSite, pathName)?.title, aidreamcapesSeed.title);
  assert.equal(dreamshootAiStudioTemplates[templateKey].seo?.title, mydreamshootsSeed.title);
  assert.equal(dreamshootAiStudioTemplatesForSite(aidreamcapesSite)[templateKey].seo?.title, aidreamcapesSeed.title);
  assert.doesNotMatch(
    dreamshootAiStudioTemplatesForSite(aidreamcapesSite)[templateKey].seo?.title ?? "",
    /MyDreamShoots/i,
    `${pathName} Aidreamcapes template SEO title must not fall back to MyDreamShoots`
  );
}

console.log("dreamshoot public SEO template smoke passed");
