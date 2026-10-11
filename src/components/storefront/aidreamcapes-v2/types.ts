// Shapes of the Aidreamcapes.com v2 page payload stored in LivePage.contentJson
// (sections.v2_main.settings.data). Built by scripts/lib/aidreamcapes-site-v2-content.mjs.

export type V2Image = { src: string; alt: string; width?: number; height?: number; srcSet?: string; sizes?: string };
export type V2VisualImage = { src: string; w: number; h: number; alt: string; kind: "photo" | "video"; objectPosition?: string };
export type V2VisualFrame = "1:1" | "9:16" | "16:9" | "4:5";
export type V2VisualStripItem = V2VisualImage;
export type V2VisualActorCard = { image: V2VisualImage; label: string; selected?: boolean };
export type V2VisualStep = { source: V2VisualImage; sourceTitle?: string; sourceHint?: string; hideSourceCopy?: boolean; result: V2VisualImage; options: [string, string][]; credits: string; prompt?: string; mode?: "photo" | "video"; items: V2Item[]; actorCards?: V2VisualActorCard[] };
export type V2VisualTitle = { h2: string; lead?: string };
export type V2VisualTitles = Partial<Record<"m2" | "m3" | "m4" | "m5" | "m6" | "m7" | "m8" | "examples" | "templates" | "faq" | "beforeAfter" | "gallery" | "plan", V2VisualTitle>>;
export type V2VisualPickerCard = { image: V2VisualImage; label: string; chips: string[]; href: string; prompt: string; kind: "photo" | "video"; tool?: string };
export type V2VisualPicker = { title: string; lead?: string; chips: { id: string; label: string }[]; cards: V2VisualPickerCard[]; button: string; href: string };
export type V2VisualUse = {
  frame?: "phone" | "browser" | "listing" | "post" | "split" | "tiktok" | "reels" | "amazon" | "none";
  image: V2VisualImage;
  imageB?: V2VisualImage;
  img?: V2Image;
  alt?: string;
  h: string;
  d: string;
};
export type V2VisualInput = { good: V2VisualImage; bad: V2VisualImage; good_label: string; bad_label: string; darkened?: boolean };
export type V2VisualOutput = { image: V2VisualImage; frame: V2VisualFrame; label: string; length?: 6 | 10 | 15; spec: string };
export type V2AfterMock = {
  type: "limited" | "tiktok" | "carousel" | "callout" | "steps";
  badge?: string; countdown?: string; caption?: string; cta?: string;
  title?: string; tag1?: string; tag2?: string; tag3?: string;
  [key: string]: unknown;
};
export type V2VisualAfter = { image: V2VisualImage; zones: string[]; items: string[]; mock?: V2AfterMock };
export type V2VisualSize = { frame: V2VisualFrame; image: V2VisualImage; label: string };
export type V2VisualLimitation = { label: string; detail?: string; supported: boolean };
export type V2Visual = {
  strip: V2VisualStripItem[];
  steps?: V2VisualStep;
  picker: V2VisualPicker;
  uses: V2VisualUse[];
  input: V2VisualInput[];
  outputs: V2VisualOutput[];
  after?: V2VisualAfter;
  sizes?: V2VisualSize[];
  limitations: { h2: string; items: V2VisualLimitation[] };
  titles?: V2VisualTitles;
  overview?: string;
};
export type V2Video = { src: string; width: number; height: number; duration?: number; name?: string; description?: string; uploadDate?: string; poster: V2Image };
export type V2HeroMedia =
  | { kind: "pair"; before: V2Image; after: V2Image }
  | { kind: "image"; image: V2Image }
  | { kind: "video"; video: V2Video }
  | { kind: "loop"; video: V2Video; inset?: V2Image };
export type V2BenefitIcon = "bolt" | "layers" | "target" | "coins" | "clock" | "refresh" | "globe" | "shield" | "sparkle" | "check" | "users" | "play";
export type V2Item = {
  t: string;
  d: string;
  img?: V2Image;
  alt?: string;
  frame?: "phone" | "browser" | "none";
  icon?: V2BenefitIcon;
};
export type V2ImageItem = V2Item;
export type V2Faq = { q: string; a: string };
export type V2Crumb = { label: string; href: string };
export type V2Card = { key: string; name: string; line?: string; kind: "video" | "photo"; href: string; image: V2Image; tags: string[]; industries: string[]; platforms: string[]; filterTags?: string[]; cardType?: "template" | "case"; videoExample?: boolean; product?: string; mediaRef?: string; video?: V2Video };
export type V2Example = { key: string; title: string; product: string; kind: "clip" | "scene" | "photo"; href: string; mediaRef: string; image: V2Image; video?: V2Video };
export type V2ExampleGroup = { label: string; items: V2Example[] };
export type V2Examples = { h2: string; lead?: string; groups: V2ExampleGroup[] };
export type V2Tool = { id: string; group?: string; label: string; description: string; href: string; image?: V2Image };
export type V2FlowStep = { label: string; image: V2Image; tall?: boolean };
export type V2Flow = { t: string; d: string; steps: V2FlowStep[]; id?: string; filterTags?: string[]; cta?: { label: string; href: string } };
export type V2Maker = { options: [string, string][]; cta: string; href: string; urlInput?: boolean; uploadTitle?: string };
export type V2Plan = { name: string; price: string; credits: string; who: string; features: string[]; popular: boolean };
export type V2MoreSection = { eyebrow: string; h2: string; lead?: string; items: V2ImageItem[] };
export type V2Section = { h2: string; paras: string[] };
export type V2EnrichmentSection = { h2: string; paras: string[]; items?: V2Item[] };
export type V2EnrichmentBlock = { h2: string; items: V2Item[] };
export type V2FitBlock = { h2: string; good: V2Item[]; not_ideal: V2Item[] };
export type V2CompareBlock = { h2: string; items: V2Item[] };
export type V2GlossaryEntry = { term: string; definition: string; related: { label: string; href: string }[] };
// A row of facts. When `links` is present each name in `value` also leads to its own page.
export type V2SpecRow = [label: string, value: string, links?: { label: string; href: string }[]];
export type V2DirectorySpecs = { title: string; lead?: string; columns: string[]; rows: string[][] };
export type V2DirectoryScene = { t: string; d: string; href?: string; image?: V2Image };
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
