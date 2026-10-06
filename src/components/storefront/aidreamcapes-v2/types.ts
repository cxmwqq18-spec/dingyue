// Shapes of the Aidreamcapes.com v2 page payload stored in LivePage.contentJson
// (sections.v2_main.settings.data). Built by scripts/lib/aidreamcapes-site-v2-content.mjs.

export type V2Image = { src: string; alt: string; width?: number; height?: number; srcSet?: string; sizes?: string };
export type V2Video = { src: string; width: number; height: number; duration?: number; name?: string; description?: string; uploadDate?: string; poster: V2Image };
export type V2HeroMedia =
  | { kind: "pair"; before: V2Image; after: V2Image }
  | { kind: "image"; image: V2Image }
  | { kind: "video"; video: V2Video }
  | { kind: "loop"; video: V2Video; inset?: V2Image };
export type V2Item = { t: string; d: string };
export type V2Faq = { q: string; a: string };
export type V2Crumb = { label: string; href: string };
export type V2Card = { key: string; name: string; line: string; kind: "video" | "photo"; href: string; image: V2Image; tags: string[]; industries: string[]; platforms: string[]; cardType?: "template" | "case"; label?: string; spec?: string; product?: string; mediaRef?: string; video?: V2Video };
export type V2Example = { key: string; title: string; product: string; kind: "clip" | "scene" | "photo"; label: string; href: string; mediaRef: string; image: V2Image; spec?: string; video?: V2Video };
export type V2ExampleGroup = { label: string; items: V2Example[] };
export type V2Examples = { h2: string; lead?: string; groups: V2ExampleGroup[] };
export type V2Tool = { id: string; group?: string; label: string; description: string; href: string; image?: V2Image };
export type V2FlowStep = { label: string; image: V2Image; tall?: boolean };
export type V2Flow = { t: string; d: string; steps: V2FlowStep[]; cta?: { label: string; href: string } };
export type V2Maker = { options: [string, string][]; cta: string; href: string; urlInput?: boolean };
export type V2Plan = { name: string; price: string; credits: string; who: string; features: string[]; popular: boolean };
export type V2Section = { h2: string; paras: string[] };
export type V2EnrichmentSection = { h2: string; paras: string[]; items?: V2Item[] };
export type V2EnrichmentBlock = { h2: string; items: V2Item[] };
export type V2FitBlock = { h2: string; good: V2Item[]; not_ideal: V2Item[] };
export type V2CompareBlock = { h2: string; items: V2Item[] };
export type V2GlossaryEntry = { term: string; definition: string; related: { label: string; href: string }[] };
// A row of facts. When `links` is present each name in `value` also leads to its own page.
export type V2SpecRow = [label: string, value: string, links?: { label: string; href: string }[]];
export type V2Article = { title: string; href: string; text: string; minutes: number; section: string };

export type V2Base = {
  id: string;
  label: string;
  eyebrow: string;
  h1: string;
  lead: string;
  breadcrumbs: V2Crumb[];
  faq: V2Faq[];
};

export type V2Data = V2Base & Record<string, unknown>;

export type V2Resolvers = {
  href: (value: string) => string;
  asset: (value: string) => string;
  // The plain link for a workspace address, used where a form must submit there directly.
  direct?: (value: string) => string;
};

export function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
