import { ArrowUpRight, ChevronRight, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { PartnerApplicationForm, type PartnerApplicationField } from "@/components/storefront/partner-application-form";
import { AidreamcapesBlogFilter, type AidreamcapesBlogCard } from "@/components/storefront/aidreamcapes-blog-filter";
import type {
  SectionBlockInstance,
  SectionInstance,
  Site,
  ThemePageJson,
  ThemeRuntimeData
} from "@/lib/types";
import type { StorefrontContext } from "@/lib/storefront-context/types";
import { resolveStorefrontBindings } from "@/lib/storefront-context/core";

type Resolve = (value: string) => string;

export type AidreamcapesPublicSectionProps = {
  id: string;
  page: ThemePageJson;
  pagePath: string;
  query: Record<string, string | string[] | undefined>;
  section: SectionInstance;
  site: Site & { __storefrontBasePath?: string };
  runtime?: ThemeRuntimeData;
  mode: "published" | "preview";
  storefrontContext?: StorefrontContext;
  resolveAsset: Resolve;
  resolveHref: Resolve;
};

const read = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};

const setting = (section: SectionInstance, key: string, fallback = "") => read(section.settings[key], fallback);
const blockValue = (block: SectionBlockInstance, key: string, fallback = "") => read(block.settings[key], fallback);
const blocks = (section: SectionInstance, type?: string) => (section.blocks ?? []).filter((block) => !type || block.type === type);
const pageSections = (page: ThemePageJson) => page.sectionsOrder.map((id) => page.sections[id]).filter(Boolean) as SectionInstance[];

const textList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap((item) => typeof item === "string" ? [item] : []);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.flatMap((item) => typeof item === "string" ? [item] : []) : [];
  } catch {
    return value.split("|").map((item) => item.trim()).filter(Boolean);
  }
};

function htmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return htmlText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}

function headingsFromHtml(value: string): Array<{ id: string; label: string; level: number }> {
  const result: Array<{ id: string; label: string; level: number }> = [];
  const matcher = /<h([23])([^>]*)>([\s\S]*?)<\/h[23]>/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(value))) {
    const label = htmlText(match[3] ?? "");
    if (!label) continue;
    const id = match[2]?.match(/\sid=["']([^"']+)["']/i)?.[1] ?? slugify(label);
    result.push({ id, label, level: Number(match[1] ?? 2) });
  }
  return result.slice(0, 12);
}

function addHeadingIds(value: string): string {
  const used = new Set<string>();
  return value.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h[23]>/gi, (full, level: string, attrs: string, body: string) => {
    const existing = attrs.match(/\sid=["']([^"']+)["']/i)?.[1];
    const base = existing || slugify(body);
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = base + "-" + suffix++;
    used.add(id);
    return existing ? full : "<h" + level + attrs + " id=\"" + id + "\">" + body + "</h" + level + ">";
  });
}

function resolved(value: string, storefrontContext?: StorefrontContext): string {
  if (!value) return "";
  return storefrontContext ? resolveStorefrontBindings(value, storefrontContext).value ?? value : value;
}

function sectionWithPrototypeAnchor(section: SectionInstance, pagePath: string): SectionInstance {
  if (pagePath !== "/workflow" || setting(section, "layout") !== "prompt_guide" || setting(section, "anchor")) return section;
  return { ...section, settings: { ...section.settings, anchor: "prompt-guide" } };
}

function Eyebrow({ children, tone = "cyan" }: { children: string; tone?: "cyan" | "pink" | "amber" | "violet" }) {
  if (!children) return null;
  return <p className={["ac-eyebrow", "ac-eyebrow-" + tone].join(" ")}>{children}</p>;
}

function ActionButtons({ section, resolveHref }: { section: SectionInstance; resolveHref: Resolve }) {
  const primaryCta = setting(section, "primaryCta");
  const primaryHref = setting(section, "primaryHref", setting(section, "targetHref"));
  const secondaryCta = setting(section, "secondaryCta");
  const secondaryHref = setting(section, "secondaryHref");
  if (!primaryCta && !secondaryCta) return null;
  return (
    <div className="ac-actions">
      {primaryCta && primaryHref ? <a className="ac-button" href={resolveHref(primaryHref)}>{primaryCta}<ArrowUpRight size={15} strokeWidth={1.8} /></a> : null}
      {secondaryCta && secondaryHref ? <a className="ac-button ac-button-ghost" href={resolveHref(secondaryHref)}>{secondaryCta}<ChevronRight size={15} strokeWidth={1.8} /></a> : null}
    </div>
  );
}

function pageImageSources(page: ThemePageJson, resolveAsset: Resolve): string[] {
  const sources = pageSections(page).flatMap((section) => [
    setting(section, "imageUrl"),
    ...(section.blocks ?? []).map((block) => blockValue(block, "imageUrl"))
  ]).filter(Boolean).map(resolveAsset);
  return Array.from(new Set(sources));
}

function ImageFrame({ src, alt, className = "", objectPosition, loading = "lazy" }: { src: string; alt: string; className?: string; objectPosition?: string; loading?: "eager" | "lazy" }) {
  if (!src) return null;
  return <img className={className} src={src} alt={alt} height={1000} loading={loading} sizes="(max-width: 768px) 100vw, 50vw" style={objectPosition ? { objectPosition } : undefined} width={1600} />;
}

function HeroOrbit({ page, section, resolveAsset }: { page: ThemePageJson; section: SectionInstance; resolveAsset: Resolve }) {
  const sources = pageImageSources(page, resolveAsset);
  const current = setting(section, "imageUrl") ? resolveAsset(setting(section, "imageUrl")) : sources[0] ?? "";
  const explicitSide = setting(section, "secondaryImageUrl") ? resolveAsset(setting(section, "secondaryImageUrl")) : "";
  const side = explicitSide || sources.find((source) => source !== current) || "";
  if (!current) return null;
  return (
    <div className="ac-hero-orbit" aria-label={setting(section, "imageAlt", setting(section, "title"))}>
      <figure className="ac-orbit-card ac-orbit-main">
        <ImageFrame src={current} alt={setting(section, "imageAlt", setting(section, "title"))} loading="eager" objectPosition={setting(section, "imageObjectPosition")} />
        {setting(section, "imageCaption") ? <figcaption className="ac-image-label">{setting(section, "imageCaption")}</figcaption> : null}
      </figure>
      {side ? <figure className="ac-orbit-card ac-orbit-side"><ImageFrame src={side} alt={setting(section, "secondaryImageAlt", setting(section, "imageAlt", setting(section, "title")))} objectPosition={setting(section, "secondaryImageObjectPosition")} /><figcaption className="ac-image-label">{setting(section, "secondaryImageCaption", setting(section, "imageCaption"))}</figcaption></figure> : null}
      {setting(section, "orbitNote") ? <span className="ac-orbit-note">{setting(section, "orbitNote")}</span> : null}
    </div>
  );
}

function RichTextCards({ items }: { items: SectionBlockInstance[] }) {
  if (!items.length) return null;
  return (
    <div className="ac-card-grid">
      {items.map((item, index) => (
        <article className="ac-card" key={item.id + "-" + index}>
          {blockValue(item, "meta") ? <p className="ac-card-index">{blockValue(item, "meta")}</p> : null}
          <h3>{blockValue(item, "title", blockValue(item, "label"))}</h3>
          {blockValue(item, "description", blockValue(item, "text")) ? <p>{blockValue(item, "description", blockValue(item, "text"))}</p> : null}
        </article>
      ))}
    </div>
  );
}

function PageHero({ section, page, resolveAsset, resolveHref }: { section: SectionInstance; page: ThemePageJson; resolveAsset: Resolve; resolveHref: Resolve }) {
  const title = setting(section, "title");
  const subtitle = setting(section, "subtitle", setting(section, "body"));
  const image = setting(section, "imageUrl");
  const hasImage = Boolean(image && resolveAsset(image));
  return (
    <section className="ac-page-hero" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="hero">
      <div className="ac-container">
        {hasImage ? (
          <div className="ac-hero-grid">
            <div className="ac-hero-copy">
              <Eyebrow tone={setting(section, "eyebrowTone", "cyan") as "cyan" | "pink" | "amber" | "violet"}>{setting(section, "eyebrow")}</Eyebrow>
              <h1 className="ac-display-xl">{title}</h1>
              {subtitle ? <p className="ac-lead">{subtitle}</p> : null}
              <ActionButtons section={section} resolveHref={resolveHref} />
              {blocks(section, "stat").length ? <div className="ac-hero-meta">{blocks(section, "stat").slice(0, 3).map((item, index) => <div key={item.id + "-" + index}><strong>{blockValue(item, "value", String(index + 1).padStart(2, "0"))}</strong><span>{blockValue(item, "label", blockValue(item, "title"))}</span></div>)}</div> : null}
            </div>
            <HeroOrbit page={page} section={section} resolveAsset={resolveAsset} />
          </div>
        ) : (
          <div className={subtitle ? "ac-directory-header" : "ac-directory-header ac-directory-header-single"}>
            <div className="ac-directory-copy">
              <Eyebrow tone={setting(section, "eyebrowTone", "cyan") as "cyan" | "pink" | "amber" | "violet"}>{setting(section, "eyebrow")}</Eyebrow>
              <h1 className="ac-display-lg">{title}</h1>
              <ActionButtons section={section} resolveHref={resolveHref} />
            </div>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function FeatureSection({ section, resolveAsset, resolveHref }: { section: SectionInstance; resolveAsset: Resolve; resolveHref: Resolve }) {
  const title = setting(section, "title");
  const paragraphs = textList(section.settings.bodyParagraphs);
  const body = setting(section, "body", setting(section, "subtitle"));
  const cards = blocks(section, "rich_text_card").length ? blocks(section, "rich_text_card") : blocks(section, "card");
  const image = setting(section, "imageUrl") ? resolveAsset(setting(section, "imageUrl")) : "";
  const hasQuote = Boolean(body);
  if (!title && !body && !paragraphs.length && !cards.length && !image) return null;
  return (
    <section className="ac-section" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="feature">
      <div className="ac-container">
        <div className={image || hasQuote ? "ac-feature-split" : "ac-feature-split ac-feature-split-single"}>
          <div className="ac-feature-copy">
            <Eyebrow tone={setting(section, "eyebrowTone", "pink") as "cyan" | "pink" | "amber" | "violet"}>{setting(section, "eyebrow")}</Eyebrow>
            <h2 className="ac-display-md">{title}</h2>
            {paragraphs.length ? paragraphs.map((paragraph, index) => <p className="ac-copy" key={paragraph.slice(0, 24) + "-" + index}>{paragraph}</p>) : body ? <p className="ac-copy">{body}</p> : null}
            <ActionButtons section={section} resolveHref={resolveHref} />
            <RichTextCards items={cards} />
          </div>
          {image ? <div className="ac-feature-media"><ImageFrame src={image} alt={setting(section, "imageAlt", title)} /></div> : hasQuote ? <div className="ac-quote-panel"><p>{body}</p><span>{setting(section, "eyebrow")}</span></div> : null}
        </div>
      </div>
    </section>
  );
}

function StorySection({ section, resolveAsset, resolveHref }: { section: SectionInstance; resolveAsset: Resolve; resolveHref: Resolve }) {
  const title = setting(section, "title");
  const paragraphs = textList(section.settings.bodyParagraphs);
  const body = setting(section, "body");
  const image = setting(section, "imageUrl") ? resolveAsset(setting(section, "imageUrl")) : "";
  const cards = blocks(section, "rich_text_card").length ? blocks(section, "rich_text_card") : blocks(section, "card");
  return (
    <section className="ac-section" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="story">
      <div className="ac-container">
        <div className={image ? "ac-story-grid" : "ac-story-grid ac-story-grid-single"}>
          {image ? <div className="ac-feature-media"><ImageFrame src={image} alt={setting(section, "imageAlt", title)} /></div> : null}
          <div className="ac-story-copy">
            <Eyebrow tone={setting(section, "eyebrowTone", "amber") as "cyan" | "pink" | "amber" | "violet"}>{setting(section, "eyebrow")}</Eyebrow>
            <h2 className="ac-display-md">{title}</h2>
            {paragraphs.length ? paragraphs.map((paragraph, index) => <p className="ac-copy" key={paragraph.slice(0, 24) + "-" + index}>{paragraph}</p>) : body ? <p className="ac-copy">{body}</p> : null}
            <RichTextCards items={cards} />
            <ActionButtons section={section} resolveHref={resolveHref} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ApplicationSection({ section, siteId, resolveAsset, resolveHref }: { section: SectionInstance; siteId: string; resolveAsset: Resolve; resolveHref: Resolve }) {
  const fields: PartnerApplicationField[] = blocks(section, "form_field").map((field, index) => ({
    id: section.type + "-" + index,
    label: blockValue(field, "label"),
    placeholder: blockValue(field, "placeholder"),
    fieldType: blockValue(field, "fieldType", "text") as PartnerApplicationField["fieldType"],
    required: blockValue(field, "required") === "true" || Boolean(field.settings.required)
  }));
  if (!fields.length) return null;
  return (
    <section className="ac-section" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="application_form">
      <div className="ac-container">
        <div className="ac-feature-split">
          <div className="ac-feature-copy">
            <Eyebrow tone="pink">{setting(section, "eyebrow")}</Eyebrow>
            <h2 className="ac-display-md">{setting(section, "title")}</h2>
            {setting(section, "body") ? <p className="ac-copy">{setting(section, "body")}</p> : null}
            <ActionButtons section={section} resolveHref={resolveHref} />
          </div>
          <div className="ac-form-card">
            {setting(section, "imageUrl") ? <div className="ac-form-image"><ImageFrame src={resolveAsset(setting(section, "imageUrl"))} alt={setting(section, "imageAlt", setting(section, "title"))} /></div> : null}
            {fields.length ? <PartnerApplicationForm fields={fields} siteId={read(section.settings.siteId, siteId)} dark /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function LoginSection({ section, pagePath, query, site, runtime, mode, resolveAsset }: Omit<AidreamcapesPublicSectionProps, "storefrontContext" | "resolveHref" | "id" | "page"> & { resolveAsset: Resolve }) {
  const methods = blocks(section, "login_method");
  const auth = runtime?.auth;
  const queryMode = read(query.mode);
  const initialMode = queryMode === "register" || queryMode === "password_reset" ? queryMode : "login";
  const showRealLoginForm = Boolean(auth) && pagePath === "/login" && mode !== "preview";
  const imageUrl = setting(section, "imageUrl");
  return (
    <section className="ac-page-hero" id={setting(section, "anchor", "start")} data-aidreamcapes-public-section="login">
      <div className="ac-container">
        <div className="ac-auth-shell">
          <div className="ac-auth-story">
            <Eyebrow tone="cyan">{setting(section, "eyebrow")}</Eyebrow>
            <h1 className="ac-display-lg">{setting(section, "title")}</h1>
            {setting(section, "subtitle") ? <p className="ac-lead">{setting(section, "subtitle")}</p> : null}
            <div className="ac-benefit-list">
              {methods.map((method, index) => <div className="ac-benefit" key={method.id + "-" + index}><span className="ac-benefit-icon">{String(index + 1).padStart(2, "0")}</span><div><strong>{blockValue(method, "label")}</strong><span>{blockValue(method, "helper")}</span></div></div>)}
            </div>
          </div>
          <aside className="ac-auth-card" aria-label="Account access form">
            {imageUrl ? <div className="ac-auth-image"><ImageFrame src={resolveAsset(imageUrl)} alt={setting(section, "imageCaption", setting(section, "title"))} /></div> : null}
            <div className="ac-auth-card-top"><div><h2>{setting(section, "formTitle", "Account access")}</h2><p>{setting(section, "formIntro", setting(section, "imageCaption"))}</p></div></div>
            <div className="ac-auth-form">
              {showRealLoginForm ? <LoginForm defaultEmail={read(query.email)} defaultName={auth?.defaultName} initialMode={initialMode as "login" | "register" | "password_reset"} initialMessage={auth?.initialMessage} locale="en" returnTo={read(query.next)} siteId={site.id} siteSlug={site.slug} storefrontBasePath={site.__storefrontBasePath} /> : <div className="grid gap-3">{methods.map((method, index) => <a className="ac-button ac-button-ghost" href={blockValue(method, "href", "/login")} key={method.id + "-" + index}>{blockValue(method, "label")}<ArrowUpRight size={15} /></a>)}</div>}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function TrustSection({ section, storefrontContext, resolveHref }: { section: SectionInstance; storefrontContext?: StorefrontContext; resolveHref: Resolve }) {
  const items = blocks(section, "stat");
  if (!items.length) return null;
  return <section className="ac-section ac-section-tight" id={setting(section, "anchor", "trust")} data-aidreamcapes-public-section="trust"><div className="ac-container"><div className="ac-grid-3">{items.map((item, index) => { const title = resolved(blockValue(item, "value", blockValue(item, "title")), storefrontContext); const label = resolved(blockValue(item, "label", blockValue(item, "description")), storefrontContext); const href = blockValue(item, "href"); return <article className="ac-card" key={item.id + "-" + index}><ShieldCheck size={18} color="var(--ac-green)" strokeWidth={1.7} /><h3>{title}</h3><p>{label}</p>{href && blockValue(item, "linkLabel") ? <a className="ac-card-link" href={resolveHref(href)}>{blockValue(item, "linkLabel")}<ArrowUpRight size={14} /></a> : null}</article>; })}</div></div></section>;
}

function StepsSection({ section }: { section: SectionInstance }) {
  const items = blocks(section, "card");
  if (!items.length) return null;
  return <section className="ac-section" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="steps"><div className="ac-container"><div className="ac-directory-header"><div><Eyebrow tone="violet">{setting(section, "eyebrow")}</Eyebrow><h2 className="ac-display-md">{setting(section, "title")}</h2></div>{setting(section, "subtitle") ? <p>{setting(section, "subtitle")}</p> : null}</div><div className="ac-number-list">{items.map((item, index) => <div className="ac-number-row" key={item.id + "-" + index}><span>{blockValue(item, "meta", String(index + 1).padStart(2, "0"))}</span><h3>{blockValue(item, "title")}</h3><p>{blockValue(item, "text", blockValue(item, "description"))}</p></div>)}</div></div></section>;
}

function FeatureGridSection({ section, resolveAsset }: { section: SectionInstance; resolveAsset: Resolve }) {
  const items = blocks(section, "card");
  if (!items.length) return null;
  return <section className="ac-section ac-section-tight" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="feature_grid"><div className="ac-container"><div className="ac-section-head"><div><Eyebrow tone="pink">{setting(section, "eyebrow")}</Eyebrow><h2 className="ac-display-md">{setting(section, "title")}</h2></div>{setting(section, "subtitle") ? <p>{setting(section, "subtitle")}</p> : null}</div><div className="ac-grid-3">{items.map((item, index) => <article className="ac-card ac-image-card" key={item.id + "-" + index}>{blockValue(item, "imageUrl") ? <div className="ac-card-image"><ImageFrame src={resolveAsset(blockValue(item, "imageUrl"))} alt={blockValue(item, "imageAlt", blockValue(item, "title"))} /></div> : null}<p className="ac-card-index">{blockValue(item, "meta", String(index + 1).padStart(2, "0"))}</p><h3>{blockValue(item, "title")}</h3><p>{blockValue(item, "description", blockValue(item, "text"))}</p></article>)}</div></div></section>;
}

function VideoSection({ section, resolveAsset }: { section: SectionInstance; resolveAsset: Resolve }) {
  const video = setting(section, "videoUrl");
  const poster = setting(section, "imageUrl");
  if (!video && !poster) return null;
  return <section className="ac-section ac-section-tight" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="video"><div className="ac-container"><div className="ac-video-layout"><div><Eyebrow tone="cyan">{setting(section, "eyebrow")}</Eyebrow><h2 className="ac-display-md">{setting(section, "title")}</h2>{setting(section, "subtitle") ? <p className="ac-copy">{setting(section, "subtitle")}</p> : null}</div>{video || poster ? <div className="ac-video-frame">{video ? <video controls poster={poster ? resolveAsset(poster) : undefined} preload="metadata"><source src={resolveAsset(video)} /></video> : <ImageFrame src={resolveAsset(poster)} alt={setting(section, "title")} />}</div> : null}</div></div></section>;
}

function ConversionSection({ section, resolveHref }: { section: SectionInstance; resolveHref: Resolve }) {
  const stats = blocks(section, "stat");
  return <section className="ac-section" id={setting(section, "anchor", "conversion")} data-aidreamcapes-public-section="conversion"><div className="ac-container"><div className={["ac-cta-band", stats.length ? "ac-cta-with-stats" : ""].filter(Boolean).join(" ")}><Eyebrow tone="pink">{setting(section, "eyebrow")}</Eyebrow><h2>{setting(section, "title")}</h2>{setting(section, "subtitle") ? <p>{setting(section, "subtitle")}</p> : null}<ActionButtons section={section} resolveHref={resolveHref} />{stats.length ? <div className="ac-cta-stats">{stats.map((stat, index) => <div key={stat.id + "-" + index}><strong>{blockValue(stat, "value")}</strong><span>{blockValue(stat, "label")}</span></div>)}</div> : null}</div></div></section>;
}

function FaqSection({ section }: { section: SectionInstance }) {
  const items = blocks(section, "faq_item");
  if (!items.length) return null;
  return <section className="ac-section ac-section-tight" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="faq"><div className="ac-container"><div className="ac-section-head"><div><Eyebrow tone="cyan">{setting(section, "eyebrow")}</Eyebrow><h2 className="ac-display-md">{setting(section, "title")}</h2></div>{setting(section, "subtitle") ? <p>{setting(section, "subtitle")}</p> : null}</div><div className="ac-faq-list">{items.map((item, index) => <details key={item.id + "-" + index} open={index === 0}><summary>{blockValue(item, "question")}<span>+</span></summary><p>{blockValue(item, "answer")}</p></details>)}</div></div></section>;
}

function articleSectionForPage(page: Site["pages"][number]): SectionInstance | undefined {
  return page.publishedJson.sectionsOrder.map((id) => page.publishedJson.sections[id]).find((section) => section?.type === "blog_article");
}

function articleCards(site: Site, currentPath: string, resolveAsset: Resolve): AidreamcapesBlogCard[] {
  return site.pages.filter((page) => page.slug.startsWith("/blog/") && page.slug !== currentPath).flatMap((page) => {
    const article = articleSectionForPage(page);
    if (!article) return [];
    const title = setting(article, "title", page.title);
    const body = setting(article, "body");
    const tags = textList(setting(article, "tags").replace(/\|/g, "\n")).slice(0, 4);
    return [{ id: page.id, href: page.slug, title, summary: setting(article, "summary", htmlText(body).slice(0, 160)), imageUrl: setting(article, "imageUrl") ? resolveAsset(setting(article, "imageUrl")) : "", imageAlt: setting(article, "imageAlt", title), author: setting(article, "author"), publishedAt: setting(article, "publishedAt"), readMinutes: setting(article, "readMinutes"), tags }];
  });
}

function BlogListSection({ section, site, pagePath, resolveAsset, resolveHref }: { section: SectionInstance; site: Site; pagePath: string; resolveAsset: Resolve; resolveHref: Resolve }) {
  const cards = articleCards(site, pagePath, resolveAsset).map((card) => ({ ...card, href: resolveHref(card.href) }));
  if (!cards.length) return null;
  return <section className="ac-section ac-section-tight" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="blog_list"><div className="ac-container"><div className="ac-section-head"><div><Eyebrow tone="violet">{setting(section, "guideType")}</Eyebrow><h2 className="ac-display-md">{setting(section, "title")}</h2></div>{setting(section, "subtitle") ? <p>{setting(section, "subtitle")}</p> : null}</div><AidreamcapesBlogFilter cards={cards} /></div></section>;
}

function relatedLinksFrom(section: SectionInstance): Array<{ href: string; label: string }> {
  const value = section.settings.relatedLinks;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return typeof record.href === "string" && typeof record.label === "string" ? [{ href: record.href, label: record.label }] : [];
  }).slice(0, 3);
}

function ArticleSection({ section, resolveAsset, resolveHref }: { section: SectionInstance; resolveAsset: Resolve; resolveHref: Resolve }) {
  const body = setting(section, "body");
  const headings = headingsFromHtml(body);
  const image = setting(section, "imageUrl");
  const relatedLinks = relatedLinksFrom(section);
  return <>
    <section className="ac-page-hero ac-article-hero" data-aidreamcapes-public-section="article_hero"><div className="ac-container"><div className={["ac-article-hero-layout", image ? "" : "ac-article-hero-single"].filter(Boolean).join(" ")}><div><div className="ac-article-meta">{setting(section, "author") ? <span>{setting(section, "author")}</span> : null}{setting(section, "publishedAt") ? <span>/ {setting(section, "publishedAt")}</span> : null}{setting(section, "readMinutes") ? <span>/ {setting(section, "readMinutes")} min read</span> : null}</div><h1 className="ac-display-lg">{setting(section, "title")}</h1>{setting(section, "summary") ? <p className="ac-lead">{setting(section, "summary")}</p> : null}<div className="ac-actions">{setting(section, "primaryCta") && setting(section, "targetHref") ? <a className="ac-button" href={resolveHref(setting(section, "targetHref"))}>{setting(section, "primaryCta")}<ArrowUpRight size={15} /></a> : null}{setting(section, "secondaryCta") && setting(section, "secondaryHref") ? <a className="ac-button ac-button-ghost" href={resolveHref(setting(section, "secondaryHref"))}>{setting(section, "secondaryCta")}<ChevronRight size={15} /></a> : null}</div></div>{image ? <figure className="ac-article-cover"><ImageFrame src={resolveAsset(image)} alt={setting(section, "imageAlt", setting(section, "title"))} /></figure> : null}</div></div></section>
    <section className="ac-section ac-section-tight" data-aidreamcapes-public-section="article_body"><div className="ac-container"><div className="ac-article-shell">{headings.length ? <aside className="ac-article-aside"><h2>On this page</h2><nav aria-label="Article contents">{headings.map((heading) => <a href={"#" + heading.id} key={heading.id}>{heading.label}</a>)}</nav></aside> : null}<article className="ac-article-prose" dangerouslySetInnerHTML={{ __html: addHeadingIds(body) }} /></div></div></section>
    {relatedLinks.length ? <section className="ac-section ac-section-tight" data-aidreamcapes-public-section="article_related"><div className="ac-container"><Eyebrow tone="cyan">Keep reading</Eyebrow><div className="ac-related-links">{relatedLinks.map((link) => <a className="ac-button ac-button-ghost" href={resolveHref(link.href)} key={link.href}>{link.label}<ArrowUpRight size={15} /></a>)}</div></div></section> : null}
  </>;
}

function PolicySection({ section, page, pagePath, storefrontContext, resolveHref }: { section: SectionInstance; page: ThemePageJson; pagePath: string; storefrontContext?: StorefrontContext; resolveHref: Resolve }) {
  const intro = pageSections(page).find((item) => item.type === "rich_text");
  const body = setting(section, "body");
  const headings = headingsFromHtml(body);
  const title = intro ? setting(intro, "title", setting(section, "title")) : setting(section, "title");
  const subtitle = intro ? setting(intro, "subtitle", setting(intro, "body")) : "";
  const contactEmail = setting(section, "contactEmail", storefrontContext?.profile?.identity.supportEmail ?? "");
  const isContact = pagePath === "/contact-us";
  return <>
    {!isContact ? <section className="ac-page-hero" data-aidreamcapes-public-section="policy_intro"><div className="ac-container"><div className={subtitle ? "ac-directory-header" : "ac-directory-header ac-directory-header-single"}><div><Eyebrow tone={pagePath === "/terms" ? "amber" : "cyan"}>{setting(section, "eyebrow")}</Eyebrow><h1 className="ac-display-lg">{title}</h1></div>{subtitle ? <p>{subtitle}</p> : null}</div></div></section> : null}
    <section className="ac-section ac-section-tight" id={setting(section, "anchor", section.type)} data-aidreamcapes-public-section="policy"><div className="ac-container">{isContact ? <div className="ac-contact-layout"><div className="ac-feature-copy"><Eyebrow tone="pink">{setting(section, "eyebrow")}</Eyebrow><h2 className="ac-display-md">{setting(section, "title")}</h2>{setting(section, "body") ? <p className="ac-copy">{htmlText(setting(section, "body"))}</p> : null}{contactEmail ? <a className="ac-button" href={"mailto:" + contactEmail}>Email support<ArrowUpRight size={15} /></a> : null}</div><div className="ac-form-card">{contactEmail ? <div className="ac-policy-notice"><strong>Support details</strong><span>{contactEmail}</span></div> : null}<div className="ac-article-prose" dangerouslySetInnerHTML={{ __html: addHeadingIds(body) }} /></div></div> : <div className="ac-policy-layout">{headings.length ? <aside className="ac-policy-aside"><h2>On this page</h2><nav aria-label="Policy contents">{headings.map((heading) => <a href={"#" + heading.id} key={heading.id}>{heading.label}</a>)}</nav></aside> : null}<article className="ac-policy-paper"><div className="ac-policy-notice"><strong>Last updated:</strong><span>{setting(section, "lastUpdated")}</span>{contactEmail ? <span>Contact: <a href={"mailto:" + contactEmail}>{contactEmail}</a></span> : null}</div><div className="ac-article-prose" dangerouslySetInnerHTML={{ __html: addHeadingIds(body) }} /></article></div>}{!isContact ? <div className="ac-policy-links">{[["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"], ["Contact Us", "/contact-us"]].filter(([, href]) => href !== pagePath).map(([label, href]) => <a href={resolveHref(href)} key={href}>{label}</a>)}</div> : null}</div></section>
  </>;
}

export function AidreamcapesPublicSection(props: AidreamcapesPublicSectionProps) {
  const { section, page, pagePath, site, storefrontContext, resolveAsset, resolveHref } = props;
  const routedSection = sectionWithPrototypeAnchor(section, pagePath);
  const isFirstRichText = pageSections(page).find((item) => item.type === "rich_text") === section;
  if (routedSection.type === "rich_text") {
    if (pagePath === "/privacy" || pagePath === "/terms") return null;
    if (setting(routedSection, "layout") === "application_form") return <ApplicationSection section={routedSection} siteId={site.id} resolveAsset={resolveAsset} resolveHref={resolveHref} />;
    if (isFirstRichText) {
      if (pagePath === "/blog" || pagePath === "/contact-us" || pagePath === "/pricing") {
        return <PageHero section={{ ...routedSection, settings: { ...routedSection.settings, imageUrl: "" } }} page={page} resolveAsset={resolveAsset} resolveHref={resolveHref} />;
      }
      return <PageHero section={routedSection} page={page} resolveAsset={resolveAsset} resolveHref={resolveHref} />;
    }
    const paragraphs = textList(routedSection.settings.bodyParagraphs);
    if (setting(routedSection, "layout") === "prompt_guide") return <FeatureSection section={routedSection} resolveAsset={resolveAsset} resolveHref={resolveHref} />;
    if (paragraphs.length || setting(routedSection, "layout") === "about_story" || setting(routedSection, "layout") === "about_company") return <StorySection section={routedSection} resolveAsset={resolveAsset} resolveHref={resolveHref} />;
    return <FeatureSection section={routedSection} resolveAsset={resolveAsset} resolveHref={resolveHref} />;
  }
  if (routedSection.type === "login_method_panel") return <LoginSection {...props} section={routedSection} />;
  if (routedSection.type === "trust_signal_bar") return <TrustSection section={routedSection} storefrontContext={storefrontContext} resolveHref={resolveHref} />;
  if (routedSection.type === "studio_steps") return <StepsSection section={routedSection} />;
  if (routedSection.type === "video_feature") return <VideoSection section={routedSection} resolveAsset={resolveAsset} />;
  if (routedSection.type === "conversion_panel") return <ConversionSection section={routedSection} resolveHref={resolveHref} />;
  if (routedSection.type === "faq") return <FaqSection section={routedSection} />;
  if (routedSection.type === "feature_grid") return <FeatureGridSection section={routedSection} resolveAsset={resolveAsset} />;
  if (routedSection.type === "blog_list") return <BlogListSection section={routedSection} site={site} pagePath={pagePath} resolveAsset={resolveAsset} resolveHref={resolveHref} />;
  if (routedSection.type === "blog_article") return <ArticleSection section={routedSection} resolveAsset={resolveAsset} resolveHref={resolveHref} />;
  if (routedSection.type === "policy_content") return <PolicySection section={routedSection} page={page} pagePath={pagePath} storefrontContext={storefrontContext} resolveHref={resolveHref} />;
  if (routedSection.type === "application_form") return <ApplicationSection section={routedSection} siteId={site.id} resolveAsset={resolveAsset} resolveHref={resolveHref} />;
  if (routedSection.type === "footer" || routedSection.type === "header") return null;
  return null;
}
