import aidreamcapesRedirects from "@/lib/aidreamcapes-site-v2-redirects.json";

// The middleware applies this map before SSR, even if an audit row remains.
const redirectSources = new Set((aidreamcapesRedirects as [string, string][]).map(([source]) => source));

export type AidreamcapesFooterArticle = {
  href: string;
  title: string;
};

type CurrentLivePage = {
  pageType?: string;
  slug: string;
  title: string;
  updatedAt?: Date | string;
  liveContentJson?: unknown;
};

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function articleData(page: CurrentLivePage): RecordValue | undefined {
  const pageJson = record(page.liveContentJson);
  const sections = record(pageJson?.sections);
  if (!sections) return undefined;

  const sectionOrder = Array.isArray(pageJson?.sectionsOrder)
    ? pageJson.sectionsOrder.filter((value): value is string => typeof value === "string")
    : Object.keys(sections);

  for (const sectionId of sectionOrder) {
    const section = record(sections[sectionId]);
    const settings = record(section?.settings);
    const data = record(settings?.data);
    if (section?.type === "aidreamcapes_v2_page" && settings?.layout === "article" && data) return data;
  }

  return undefined;
}

function updatedTimestamp(value: Date | string | undefined): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Build footer links from the current relational LivePage.contentJson projection.
 * ThemePage JSON and snapshots are deliberately not used as fallback sources.
 */
export function latestAidreamcapesArticles(pages: readonly CurrentLivePage[]): AidreamcapesFooterArticle[] {
  const seen = new Set<string>();
  return pages.flatMap((page) => {
    if (!page.slug.startsWith("/blog/") || redirectSources.has(page.slug) || seen.has(page.slug)) return [];
    const data = articleData(page);
    // An article pageType alone does not prove there is renderable public copy.
    if (!data) return [];

    const title = string(data.h1) ?? string(data.label) ?? page.title.trim();
    if (!title) return [];
    seen.add(page.slug);

    return [{ href: page.slug, title, updatedAt: updatedTimestamp(page.updatedAt) }];
  })
    .sort((left, right) => right.updatedAt - left.updatedAt || left.href.localeCompare(right.href))
    .map(({ href, title }) => ({ href, title }));
}

/** Use the site's current homepage locale copy for this shared footer label. */
export function aidreamcapesLatestArticlesHeading(homeContentJson: unknown): string {
  const pageJson = record(homeContentJson);
  const sections = record(pageJson?.sections);
  if (!sections) return "Latest articles";

  for (const section of Object.values(sections)) {
    const sectionValue = record(section);
    if (sectionValue?.type !== "aidreamcapes_v2_page") continue;
    const settings = record(sectionValue.settings);
    if (settings?.layout !== "home") continue;
    const data = record(settings.data);
    const experience = record(data?.homeExperience);
    const labels = record(experience?.labels);
    const translated = string(labels?.["Latest articles"]);
    if (translated) return translated;
    if (experience?.language === "zh-CN") return "博客文章";
  }

  return "Latest articles";
}
