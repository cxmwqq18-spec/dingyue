import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const repoRoot = process.cwd();

const mediaAltSource = fs.readFileSync(path.join(repoRoot, "src/lib/storefront-media-alt.ts"), "utf8");
const compiled = ts.transpileModule(mediaAltSource, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const mediaAltExports = {};
vm.runInNewContext(compiled, {
  exports: mediaAltExports,
  require: (id) => {
    if (id === "@/lib/spanish-storefronts") {
      return { isSpanishStorefrontSite: (site) => /(?:aidreamshoots|aidreamcapes)\.eu/i.test(String(site?.primaryDomain ?? "")) };
    }
    throw new Error(`Unexpected module import in smoke: ${id}`);
  }
});

const { storefrontCardImageAlt, storefrontMeaningfulAlt, storefrontVideoPosterAlt } = mediaAltExports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const blockedPattern = /\b(?:package gallery example|gallery scene example|package showcase frame|package cover frame|featured package scene|related package scene|private gallery visual frame|private storefront gallery|private gallery workflow|private AI album workflow|visual frame|detailed storefront visual|storefront visual showing|finished gallery example|private AI photo example|how to plan this|on MyDreamShoots|on myDreamshoots|on AIdreamcapes|AI-generated video poster)\b/i;

const samples = [
  storefrontCardImageAlt({
    brand: "MyDreamShoots",
    category: "professional-headshots",
    description: "professional AI headshot with clean studio lighting",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/professional-headshots/professional-headshots-03.webp",
    index: 2,
    locale: "en",
    meta: "AI Headshots",
    role: "gallery",
    title: "Professional Headshots"
  }),
  storefrontCardImageAlt({
    brand: "MyDreamShoots",
    category: "world-cup-fan-photos",
    description: "Football supporter portrait with green and yellow stadium flags, World Cup Fan Photos package gallery example for myDreamshoots.",
    imageAlts: [
      "Football supporter portrait with green and yellow stadium flags, World Cup Fan Photos package gallery example for myDreamshoots."
    ],
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-01.webp",
    index: 0,
    locale: "en",
    meta: "Fan Photos",
    role: "gallery",
    title: "World Cup Fan Photos"
  }),
  storefrontCardImageAlt({
    brand: "MyDreamShoots",
    category: "background-remover",
    description: "clean product portrait on a transparent background",
    imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-product.webp",
    index: 5,
    locale: "en",
    meta: "Tools",
    role: "card",
    title: "Background Remover"
  }),
  storefrontCardImageAlt({
    brand: "AIdreamshoots",
    category: "retratos-profesionales",
    description: "retrato profesional con luz de estudio",
    imageUrl: "/assets/sites/site_aidreamshoots/creative-packs/pack-galleries/creator-portraits/creator-portraits-02.webp",
    index: 1,
    locale: "es",
    meta: "Perfiles",
    role: "gallery",
    title: "Retratos Profesionales"
  }),
  storefrontVideoPosterAlt({
    brand: "MyDreamShoots",
    locale: "en",
    meta: "a refined moving portrait from customer frames",
    title: "Cinematic Portrait Motion"
  })
];

for (const alt of samples) {
  assert(alt.length <= 118, `alt is too long: ${alt}`);
  assert(!blockedPattern.test(alt), `alt uses blocked template copy: ${alt}`);
  assert((alt.match(/\b(?:AI|photo|gallery|package|preview|portrait|video|MyDreamShoots)\b/gi) ?? []).length <= 4, `alt has dense repeated SEO terms: ${alt}`);
}

assert(
  storefrontMeaningfulAlt("professional AI headshot with clean studio lighting, close portrait with clear facial detail, Professional Headshots package gallery example for myDreamshoots.") === "",
  "legacy stored MyDreamShoots gallery alt should be rejected"
);

assert(
  storefrontMeaningfulAlt("Photo AI hero image showing a private gallery workflow for MyDreamShoots.") === "",
  "stored tool hero workflow alt should be rejected"
);

assert(
  storefrontMeaningfulAlt("AI creator workflow result with polished studio presentation, detailed storefront visual showing the subject, setting, and intended gallery use, AI Video Add-ons: how to plan this myDreamshoots photo package category for myDreamshoots.") === "",
  "long stored category SEO alt should be rejected"
);

assert(
  storefrontMeaningfulAlt("Football fan portrait in a stadium.") === "Football fan portrait in a stadium",
  "short natural alt should be accepted"
);

console.log(JSON.stringify({ ok: true, samples }, null, 2));
