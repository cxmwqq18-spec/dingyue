import { TemplateDirectory, templateDetailResolvers } from "./template-directory";
import { WorkspaceEntryBehavior } from "@/components/aidreamcapes-workspace/entry-behavior";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
/* eslint-disable react/jsx-key -- block lists are [id, element] tuples; orderedBlocks renders each one inside a keyed Fragment. */
import type { SectionInstance } from "@/lib/types";
import { AidreamcapesV2ActorFilters, AidreamcapesV2ActorScenePicker, AidreamcapesV2HeroTabs, AidreamcapesV2MotionPreference, AidreamcapesV2TemplateFilters } from "./behavior";
import { TeamCards,
  BRAND_NAME, ThematicLinkChips, Boxes, Collage, QuickStart, CompanyDetails, CompareTableBlock, Crumbs, CtaBand, DefinitionBlock, StartNote, TextSections, withStartLinks, Faq, Gallery, GlossaryEntries, HeroMedia, Img, Intro, MakeToolGroup, Maker, MoreSections, PairGrid, PageHero, Plans, RichText, Section, SecHead, Single, Specs, Steps, TemplateGrid, ToolRow, ExampleGallery, EnrichmentOverview, EnrichmentBlockSection, FitSection, DirectorySpecs, DirectoryScenes, normalizeStepLabel, ActorScenePanel, SellerScenarioSection, ReasonsSection, TrustCards, ReviewWall, ClosingStatement, LinkCardsSection, AudienceTag,
} from "./parts";
import type { V2Company } from "./company";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { list, text, type V2Card, type V2CompareTable, type V2Data, type V2Definition, type V2DirectoryScene, type V2Examples, type V2Flow, type V2HeroMedia, type V2Image, type V2Item, type V2Maker, type V2Plan, type V2Resolvers, type V2Section, type V2SpecRow, type V2TextSection, type V2Tool, type V2ActorScenePicker, type V2SellerScenarioBlock, type V2BlockId, type V2CardBlock, type V2ReviewBlock, type V2ClosingBlock, type V2LinkCardBlock } from "./types";
import { VisualAfter, VisualDirectoryFilter, VisualFreshLook, VisualInput, VisualLimitations, VisualOverview, VisualOutputs, VisualPicker, VisualSizes, VisualSteps, VisualStrip, VisualUses } from "./visual";
import type { V2Visual, V2MoreSection } from "./types";
import { presetSourcePage } from "@/lib/aidreamcapes-workspace/preset-contract";
import { AIDREAMCAPES_V2_HOME_CSS } from "./styles";
import { AidreamcapesV2PricingSection } from "./pricing";
import { HomeExperienceSection } from "./home-experience";
import { HomeExperienceBehavior } from "./home-experience-behavior";
import { HOME_EXPERIENCE_KINDS, type HomeCampaignSections, type HomeExperienceData } from "./home-experience-types";
import { copyLabel } from "./types";
import "./home-experience.css";
import { HomeComposer, type HomeComposerData } from "./home-composer";
import { HomeComposerBehavior } from "./home-composer-behavior";
import { HomeBrandTools } from "./home-brand-tools";
import type { HomeBrandTool, HomeBrandToolsDemo } from "./home-brand-tools-types";
import { AidreamcapesDirectoryLanding } from "./directory-landings";

export const AIDREAMCAPES_V2_SECTION_TYPE = "aidreamcapes_v2_page";

export function isAidreamcapesV2Section(section: SectionInstance | undefined): boolean {
  return section?.type === AIDREAMCAPES_V2_SECTION_TYPE;
}

type Props = { data: V2Data; r: V2Resolvers };

function pickerSourcePage(data: V2Data): string | undefined {
  if (data.id === "home") return "/";
  const lastHref = data.breadcrumbs.at(-1)?.href;
  return presetSourcePage(lastHref);
}

function ctaTitle(data: V2Data, fallback: string): string {
  return text(data.ctaTitle) || fallback;
}

function ctaLead(data: V2Data, fallback: string): string {
  return text(data.ctaLead) || fallback;
}

// The "why use it" block shows on every layout once the page data lists benefits.
export function BenefitsSection({ data, r, fallbackTitle, eyebrow }: { data: V2Data; r: V2Resolvers; fallbackTitle: string; eyebrow?: string }) {
  const items = list<V2Item>(data.benefits);
  if (!items.length) return null;
  return <Section eyebrow={copyLabel(r, eyebrow ?? "Why use it")} lead={text(data.benefitsLead) || undefined} title={text(data.benefitsH2) || fallbackTitle}><Boxes items={items} r={r} /></Section>;
}


// The three-step heading falls back through the visual title to the same default as before.
export function stepsTitle(data: V2Data, visual: V2Visual | undefined): string {
  return text(data.stepsH2) || visual?.titles?.m2?.h2 || "Three steps";
}

function RelatedGroupsSection({ groups, r, title = "Related tools" }: { groups: { title: string; links: { label: string; href: string }[] }[]; r: V2Resolvers; title?: string }) {
  const visible = groups.filter((group) => group.links?.length);
  if (!visible.length) return null;
  return <Section eyebrow="Related tools" title={title}>
    <style dangerouslySetInnerHTML={{ __html: ".adc2 .related-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.adc2 .related-groups>div{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 22px}.adc2 .related-groups h3{margin:0 0 12px;font-size:16px;color:var(--ink)}.adc2 .related-groups ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px}.adc2 .related-groups a{color:var(--ink-2);text-decoration:underline;text-underline-offset:3px}.adc2 .related-groups a:hover{color:var(--ink)}@media(max-width:520px){.adc2 .related-groups ul{grid-template-columns:1fr}}" }} />
    <div className="related-groups">
      {visible.map((group) => <div key={group.title}>
        <h3>{group.title}</h3>
        <ThematicLinkChips links={group.links} r={r} />
      </div>)}
    </div>
  </Section>;
}

function RelatedLinksSection({ links, r, title = "Related Pages", lead }: { links: { label: string; href: string }[]; r: V2Resolvers; title?: string; lead?: string }) {
  if (!links.length) return null;
  return <Section eyebrow={copyLabel(r, "Related Pages")} lead={lead} title={copyLabel(r, title)}>
    <ThematicLinkChips links={links} r={r} />
  </Section>;
}

// One block of a page: the id a page's `blockOrder` uses for it, and what it renders.
// "always" marks behavior scripts that stay on the page whatever the order.
type PageBlock = [V2BlockId | "always", ReactNode];

// The blocks a page adds through its own data. They render only when the page has them.
function pageOwnBlocks(data: V2Data, r: V2Resolvers): PageBlock[] {
  return [
    ["reasons", <ReasonsSection block={data.reasons as V2CardBlock | undefined} r={r} />],
    ["platforms", <LinkCardsSection block={data.platformLinks as V2LinkCardBlock | undefined} eyebrow="Where it runs" r={r} />],
    ["trust", <TrustCards block={data.trust as V2CardBlock | undefined} r={r} />],
    ["reviews", <ReviewWall block={data.reviews as V2ReviewBlock | undefined} r={r} id={data.id === "home" ? "home-seller-examples" : undefined} />],
    ["closing", <ClosingStatement block={data.closing as V2ClosingBlock | undefined} r={r} />]
  ];
}

// Without `blockOrder` a layout shows its blocks in its own order. With it, only the listed
// blocks show, in the listed order. When the page lists its own related links, the
// "related" block shows those links instead of the layout's related tools.
function orderedBlocks(
  data: V2Data,
  r: V2Resolvers,
  blocks: PageBlock[],
  afterBlocks: Partial<Record<V2BlockId, ReactNode>> = {},
  beforeBlocks: Partial<Record<V2BlockId, ReactNode>> = {}
): ReactNode {
  const configuredOrder = list<V2BlockId>(data.blockOrder);
  const order = configuredOrder.length
    ? [...configuredOrder, "always" as const]
    : blocks.map(([id]) => id);
  const relatedLinks = list<{ label: string; href: string }>(data.relatedLinks);
  const render = (id: V2BlockId | "always") => <Fragment key={id}>
    {id === "always" ? null : beforeBlocks[id]}
    {id === "related" && relatedLinks.length
      ? <RelatedLinksSection lead={text(data.relatedLead) || undefined} links={relatedLinks} r={r} title={text(data.relatedH2) || "Related Pages"} />
      : blocks.filter(([blockId]) => blockId === id).map(([, node], index) => <Fragment key={index}>{node}</Fragment>)}
    {id === "always" ? null : afterBlocks[id]}
  </Fragment>;
  return order.map(render);
}

function splitPhotoHubExamples(examples: V2Examples | undefined) {
  if (!examples) return { fresh: [], gallery: undefined as V2Examples | undefined };
  const fresh: { label: string; image: V2Image }[] = [];
  const galleryItems: V2Examples["groups"][number]["items"] = [];
  for (const group of examples.groups) {
    const [first, ...rest] = group.items;
    if (first?.image) fresh.push({ label: group.label, image: first.image });
    galleryItems.push(...rest);
  }
  return {
    fresh,
    gallery: galleryItems.length ? { ...examples, groups: [{ label: "", items: galleryItems }] } : undefined
  };
}

// The home examples are a list of flows. Until a page's data has been refreshed it can still hold the
// older layout (one smartwatch flow and one water bottle flow); show that the same way meanwhile.
function homeExampleFlows(examples: unknown): V2Flow[] {
  const value = (examples ?? {}) as { flows?: unknown; image?: V2Image; output?: V2Image; versions?: V2Image[]; bottle?: V2Image; bottleAd?: V2Image };
  if (Array.isArray(value.flows)) return value.flows as V2Flow[];
  const flows: V2Flow[] = [];
  if (value.image && value.output) {
    flows.push({ t: "Smartwatch", d: "Product photo, then a vertical video ad, then three different openings to test.", steps: [
      { label: "Your product", image: value.image }, { label: "Video ad", image: value.output },
      ...list<V2Image>(value.versions).map((image, index) => ({ label: `Version ${"ABC"[index]}`, image, tall: true }))] });
  }
  if (value.bottle && value.bottleAd) {
    flows.push({ t: "Water bottle", d: "Lifestyle photo for the product page, then a feed ad for social.", steps: [{ label: "Lifestyle photo", image: value.bottle }, { label: "Feed ad", image: value.bottleAd }] });
  }
  return flows;
}

function HomePage({ data, r }: Props) {
  const experience = data.homeExperience as HomeExperienceData | undefined;
  if (experience) r = { ...r, copy: experience.labels };
  // Optional presentation schema activates after the separately deployed LivePage fields arrive.
  const relocate = experience?.blocks.find(block => block.after === "audience")?.presentation?.contentLayout === "benefits-workflow" && data.brandToolsDemo !== undefined;
  const benefitItems = list<HomeBrandTool>(data.benefits);
  const workflow = list<V2MoreSection>(data.more_sections)[0];
  const toolsDemo = data.brandToolsDemo as HomeBrandToolsDemo | undefined;
  if (relocate && (
    benefitItems.length !== 6 ||
    benefitItems.some((item) => !item.id || !item.img || !item.href || !item.cta || !item.t || !item.d) ||
    !text(data.benefitsEyebrow) || !text(data.benefitsH2) || !text(data.benefitsLead) ||
    toolsDemo?.version !== 2 || !toolsDemo.labels.promptValue || !toolsDemo.product || !toolsDemo.presenter || toolsDemo.actors.length !== 5 || toolsDemo.shots.length !== 3 ||
    workflow?.items.length !== 6
  )) {
    throw new Error("The homepage tool directory requires six complete tool cards and the six-step workflow");
  }
  const campaign: HomeCampaignSections | undefined = relocate ? { workflow } : undefined;
  const additions = experience ? Object.fromEntries(HOME_EXPERIENCE_KINDS.map((after) => [
    after,
    relocate && (after === "audience" || after === "reviews") ? null : <HomeExperienceSection after={after} campaign={campaign} experience={experience} key={after} r={r} />
  ])) : {};
  const beforeBlocks = relocate && experience
    ? { features: <><HomeExperienceSection after="audience" campaign={campaign} experience={experience} r={r} /><HomeExperienceSection after="reviews" experience={experience} r={r} /></> }
    : {};
  const hero = data.hero as { videoHref: string; photoHref: string };
  const visual = data.visual as V2Visual | undefined;
  const make = data.make as { title: string; lead: string; video: V2Tool[]; photo: V2Tool[] };
  const ugc = data.ugc as { eyebrow?: string; title?: string; paras?: string[]; formats?: V2Item[]; composer?: HomeComposerData } | undefined;
  const audience = data.audience as { title?: string; lead?: string; items?: V2Item[] } | undefined;
  const relatedGroups = list<{ title: string; links: { label: string; href: string }[] }>(data.relatedGroups);
  const sellerScenarios = data.sellerScenarios as V2SellerScenarioBlock | undefined;
  return <div className={`home-v2${experience ? " home-v4" : ""}`}>
    <style dangerouslySetInnerHTML={{ __html: AIDREAMCAPES_V2_HOME_CSS }} />
    {orderedBlocks(data, r, [
    ["hero",
      <section className="hero hero-center">
        <div className="wrap">
          <div className="hero-copy">
            <div className="eyebrow hero-kicker">
              <span>{data.eyebrow}</span>
              <AudienceTag labels={r.copy} />
            </div>
            <h1>{data.h1}</h1>
            <p className="lead">{data.lead}</p>
          </div>
          <div className="hero-ctas">
            <WorkspaceEntryLink className="btn btn-grad" href={r.href(hero.videoHref)}>{copyLabel(r, "Make my video →")}</WorkspaceEntryLink>
            <WorkspaceEntryLink className="btn btn-ghost" href={r.href(hero.photoHref)}>{copyLabel(r, "Make my photos →")}</WorkspaceEntryLink>
          </div>
          <StartNote note={text(data.startNote)} r={r} />
        </div>
      </section>],
    ["strip", visual ? <VisualStrip includeOverview visual={visual} r={r} /> : null],
    ["definition", visual && ugc?.title ? (
        <Section id="home-ai-ugc" eyebrow={ugc.eyebrow ?? "AI UGC ads"} title={ugc.title}>
          <Intro paras={list<string>(ugc.paras)} r={r} />
          <HomeComposer data={ugc.composer} r={r} />
          {list<V2Item>(ugc.formats).length ? <div style={{ marginTop: 22 }}><Boxes className="ideas" items={list<V2Item>(ugc.formats)} numbered /></div> : null}
        </Section>
      ) : null],
    ["picker", visual ? <VisualPicker maxCards={20} sectionId="home-product-scenes" pageId={data.id} sourcePage={pickerSourcePage(data)} visual={visual} r={r} /> : null],
    ["steps", visual ? <VisualSteps sectionId="home-product-image-steps" eyebrow={text(data.stepsEyebrow) || undefined} actions={experience?.blocks.find((block) => block.after === "hero")?.actions} buttonLabel={text((data.maker as V2Maker | undefined)?.cta) || "Make my video"} stepsH2={text(data.stepsH2)} stepsLead={text(data.stepsLead)} visual={visual} r={r} /> : null],
    ["benefits", campaign && toolsDemo ? <HomeBrandTools items={benefitItems} demo={toolsDemo} header={{ eyebrow: text(data.benefitsEyebrow), title: text(data.benefitsH2), lead: text(data.benefitsLead) }} r={r} /> : <BenefitsSection data={data} fallbackTitle="Everything you need to scale your brand" r={r} />],
    ["features", <MoreSections numbered r={r} sections={campaign ? list<V2MoreSection>(data.more_sections).slice(1) : data.more_sections as never} />],
    ["audience", audience?.title ? <Section eyebrow={copyLabel(r, "For growing teams")} lead={audience.lead ?? ""} title={audience.title}>{list<V2Item>(audience.items).some((item) => item.teamIcon) ? <TeamCards items={list<V2Item>(audience.items)} r={r} /> : <Boxes className="ideas" items={list<V2Item>(audience.items)} r={r} />}</Section> : null],
    ["tools",
      <section className="sec">
        <div className="wrap">
          <SecHead eyebrow="One workflow" lead={make.lead} title={make.title} />
          <div className="make">
            <MakeToolGroup allHref="/ai-video-generation" allLabel="All video tools" guide={{ description: "Ready-made ideas for unboxing, before-and-after, beauty and more.", href: "/templates", label: "Browse video templates", secondaryHref: "/ai-video-generation", secondaryLabel: "All video tools", title: "Start from a template" }} r={r} subtitle="For TikTok, Reels, Shorts and your product page" title="Video" tools={make.video} />
            <MakeToolGroup allHref="/ai-image-generation" allLabel="All photo tools" r={r} subtitle="For Amazon, Shopify and social ads" title="Photo" tools={make.photo} />
          </div>
        </div>
      </section>],
    ["related", <RelatedGroupsSection groups={relatedGroups} r={r} />],
    ["compare",
      <Section eyebrow={copyLabel(r, "Why stores switch")} title={text(data.compareH2) || "A faster way to keep testing new ads"}>
        <div className="cmp-wrap">
          <table className="cmp">
            <thead><tr><th scope="col"><span className="sr-only">{copyLabel(r, "Topic")}</span></th><th scope="col">{copyLabel(r, "Photoshoot or creator")}</th><th scope="col">{BRAND_NAME}</th></tr></thead>
            <tbody>{list<string[]>(data.compare).map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>],
    ["seller_scenarios", sellerScenarios ? <SellerScenarioSection scenarios={sellerScenarios} r={r} /> : null],
    ["pricing", <AidreamcapesV2PricingSection r={r} />],
    ...pageOwnBlocks(data, r),
    ["faq", <Faq items={data.faq} title={visual?.titles?.faq?.h2 ?? "Questions before you start"} r={r} />],
    ["cta", <CtaBand href="/app/create" lead={ctaLead(data, "Upload a photo, pick a template and get a video ad or store-ready photos.")} r={r} title={ctaTitle(data, "Your next ad starts with one product photo")} />],
    ["always", <><AidreamcapesV2HeroTabs /><AidreamcapesV2MotionPreference />{experience ? <HomeExperienceBehavior /> : null}{ugc?.composer ? <HomeComposerBehavior /> : null}</>]
  ], additions, beforeBlocks)}
  </div>;
}

// Each step of a flow shares the row by the shape of its picture, so every step ends up the same height and the row fits its box.
const flowAspect = (step: V2Flow["steps"][number]) => (step.tall ? 9 / 16 : (step.image.width ?? 4) / (step.image.height ?? 3)).toFixed(3);

// A link to the full start-to-finish examples under a page's own examples.
function MoreExamples({ r }: { r: V2Resolvers }) {
  return <p className="meta-line" style={{ marginTop: 18 }}><WorkspaceEntryLink href={r.href("/inspiration")}>See start-to-finish product examples →</WorkspaceEntryLink></p>;
}

function Flows({ flows, r, filterChips }: { flows: V2Flow[]; r: V2Resolvers; filterChips?: { id: string; label: string }[] }) {
  const indexesFor = (flow: V2Flow) => (filterChips ?? []).map((chip, index) => ({ chip, index: index + 1 }))
    .filter(({ chip }) => flow.filterTags?.includes(chip.id))
    .map(({ index }) => index);
  return (
    <div className={`ex${filterChips?.length ? " v-filter-grid" : ""}`}>
      {flows.map((flow) => (
        <div className={`exrow${filterChips?.length ? " v-filter-card" : ""}`} data-filter-indexes={filterChips?.length ? indexesFor(flow).join(" ") : undefined} key={flow.t}>
          <div className="meta"><h3>{flow.t}</h3><p>{flow.d}</p>{flow.cta ? <WorkspaceEntryLink className="flow-cta" href={r.href(flow.cta.href)}>{flow.cta.label} →</WorkspaceEntryLink> : null}</div>
          <div className="flow">
            {flow.steps.map((step, index) => (
              <Fragment key={`${step.label}-${index}`}>
                {index > 0 ? <div aria-hidden="true" className="fsep">›</div> : null}
                <div className="fcell" style={{ "--a": flowAspect(step) } as CSSProperties}><figure><Img className={step.tall ? "v916" : undefined} image={step.image} r={r} /></figure><small>{normalizeStepLabel(step.label)}</small></div>
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Video types read best as one row: when every group holds a single example,
// show them side by side with the group name as the card title.
function oneRowWhenSingles(examples: V2Examples | undefined): V2Examples | undefined {
  if (!examples?.groups.length || !examples.groups.every((group) => group.items?.length === 1)) return examples;
  return { ...examples, groups: [{ label: "", items: examples.groups.map((group) => ({ ...group.items[0], title: group.label })) }] };
}

function VideoHubPage({ data, r }: Props) {
  const visual = data.visual as V2Visual | undefined;
  const maker = data.maker as V2Maker | undefined;
  const relatedGroups = list<{ title: string; links: { label: string; href: string }[] }>(data.relatedGroups);
  const sellerScenarios = data.sellerScenarios as V2SellerScenarioBlock | undefined;
  if (visual) return <>{orderedBlocks(data, r, [
    ["hero", <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} right={<Collage cards={list<V2Card>(data.heroCards).filter((card) => !visual.picker.cards.some((pick) => pick.image.src === card.image.src))} r={r} />} title={data.h1}>
        <Maker note={text(data.startNote)} maker={maker ?? { options: [], cta: "Make my video", href: text(data.appHref) }} r={r} />
      </PageHero>
    </>],
    ["strip", <VisualStrip visual={visual} r={r} />],
    ["definition", data.blockOrder && data.definition ? <DefinitionBlock definition={data.definition as V2Definition} r={r} /> : <Section eyebrow="About" title="What is an AI video generator?"><Intro paras={list<string>(data.intro)} r={r} /></Section>],
    ["picker", <VisualPicker eyebrow="Choose a tool" pageId={data.id} sourcePage={pickerSourcePage(data)} relatedGroups={relatedGroups} visual={visual} r={r} />],
    ["benefits", <BenefitsSection data={data} fallbackTitle="Reasons to use an AI video generator" r={r} />],
    ["steps", <VisualSteps buttonLabel={maker?.cta ?? "Make my video"} stepsH2={text(data.stepsH2)} stepsLead={text(data.stepsLead)} visual={visual} r={r} />],
    ["features", data.blockOrder ? <MoreSections r={r} sections={data.more_sections as never} /> : null],
    ["compare", data.blockOrder && data.compareTable ? <CompareTableBlock block={data.compareTable as V2CompareTable} r={r} /> : null],
    ["examples", <div className="vh-types"><ExampleGallery examples={oneRowWhenSingles(data.examples as V2Examples | undefined)} r={r} /></div>],
    ["seller_scenarios", sellerScenarios ? <SellerScenarioSection scenarios={sellerScenarios} r={r} /> : null],
    ...pageOwnBlocks(data, r),
    ["faq", <Faq items={data.faq} title="Questions About AI Video" r={r} />],
    ["cta", <CtaBand href={text(data.appHref)} lead={ctaLead(data, "Upload a product photo and see the cost before you start.")} r={r} title={ctaTitle(data, "Make your first video today")} />]
  ])}</>;
  return (
    <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} right={<Collage cards={list<V2Card>(data.heroCards)} r={r} />} title={data.h1}>
        <Maker note={text(data.startNote)} maker={{ options: [["Size", "9:16 · TikTok & Reels"], ["Length", "15 seconds"]], cta: "Make my video", href: text(data.appHref) }} r={r} />
      </PageHero>
      <Section eyebrow="About" title="Short videos from your product photos"><Intro paras={list<string>(data.intro)} r={r} /></Section>
      <EnrichmentOverview r={r} sections={data.overview as never} />
      <Section eyebrow="Video tools" title="Pick the video you need"><ToolRow r={r} tools={list<V2Tool>(data.tools)} /></Section>
      <EnrichmentBlockSection block={data.toolChooser as never} eyebrow="Choose a tool" r={r} />
      <BenefitsSection data={data} fallbackTitle={`Why stores make videos with ${BRAND_NAME}`} r={r} />
      <EnrichmentBlockSection block={data.compare as never} eyebrow="Compare your options" r={r} />
      <Section eyebrow="How it works" lead={text(data.stepsLead)} title={stepsTitle(data, undefined)}><Steps items={list<V2Item>(data.steps)} /></Section>
      <MoreSections r={r} sections={data.more_sections as never} />
      <EnrichmentBlockSection block={data.inputGuide as never} eyebrow="Before you start" r={r} />
      <EnrichmentBlockSection block={data.scenePromptExamples as never} eyebrow="Scene examples" r={r} />
      <EnrichmentBlockSection block={data.results as never} eyebrow="Your result" r={r} />
      <EnrichmentBlockSection block={data.troubleshooting as never} eyebrow="Adjust a result" r={r} />
      <EnrichmentBlockSection block={data.sceneRecipes as never} eyebrow="Ideas" r={r} />
      <FitSection block={data.fit as never} r={r} />
      <EnrichmentBlockSection block={data.afterDownload as never} eyebrow="After download" r={r} />
      <Section eyebrow="Video templates" title="Ready-made video ideas"><TemplateGrid cards={list<V2Card>(data.cards)} r={r} /></Section>
      <ExampleGallery examples={data.examples as V2Examples | undefined} r={r} />
      {sellerScenarios ? <SellerScenarioSection scenarios={sellerScenarios} r={r} /> : null}
      <Faq items={data.faq} title="Questions About AI Video" r={r} />
      <CtaBand href={text(data.appHref)} lead={ctaLead(data, "Upload a product photo and see the cost before you start.")} r={r} title={ctaTitle(data, "Make your first video today")} />
    </>
  );
}

function ToolPage({ data, r }: Props) {
  const hero = data.hero as { single?: V2Image; cards?: V2Card[] };
  const heroMedia = data.heroMedia as V2HeroMedia | undefined;
  const gallery = data.gallery as { images: V2Image[] } | undefined;
  const pairs = list<{ before: V2Image; after: V2Image }>(data.pairs);
  const maker = data.maker as V2Maker;
  const visual = data.visual as V2Visual | undefined;
  const relatedGroups = list<{ title: string; links: { label: string; href: string }[] }>(data.relatedGroups);
  const relatedLinks = list<{ label: string; href: string }>(data.relatedLinks);
  const video = data.group === "video";
  const photoHub = data.id === "photo-hub";
  const actorScenePicker = data.actorScenePicker as V2ActorScenePicker | undefined;
  const sellerScenarios = data.sellerScenarios as V2SellerScenarioBlock | undefined;
  const photoExamples = photoHub ? splitPhotoHubExamples(data.examples as V2Examples | undefined) : undefined;
  if (visual) {
    const heroBlock = <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} quick={<QuickStart href={maker.href} label={maker.cta} r={r} />} right={photoHub ? <Collage cards={hero.cards ?? []} r={r} /> : heroMedia ? <HeroMedia media={heroMedia} r={r} /> : hero.single ? <Single image={hero.single} r={r} /> : <Collage cards={hero.cards ?? []} r={r} />} title={data.h1}>
        <Maker note={text(data.startNote)} maker={maker} r={r} />
        {actorScenePicker ? <ActorScenePanel pageId={data.id} picker={actorScenePicker} r={r} /> : null}
      </PageHero>
    </>;
    const definition: PageBlock = ["definition", data.definition ? <DefinitionBlock definition={data.definition as V2Definition} r={r} /> : null];
    const actorScript: PageBlock = ["always", actorScenePicker ? <AidreamcapesV2ActorScenePicker /> : null];
    const siblings: PageBlock = ["related", list<V2Tool>(data.siblings).length ? <Section eyebrow="Explore related tools" title="Explore related tools"><ToolRow r={r} tools={list<V2Tool>(data.siblings)} /></Section> : null];
    const scenarios: PageBlock = ["seller_scenarios", sellerScenarios ? <SellerScenarioSection scenarios={sellerScenarios} r={r} /> : null];
    const faq: PageBlock = ["faq", <Faq items={data.faq} title={visual.titles?.faq?.h2 ?? `Questions about ${data.label}`} r={r} />];
    const tail: PageBlock[] = [
      ["related", <RelatedLinksSection lead={text(data.relatedLead) || undefined} links={relatedLinks} r={r} title={text(data.relatedH2) || "Related Pages"} />],
      ["cta", <CtaBand href={maker.href} lead={ctaLead(data, "Upload a product photo and see the cost before you start.")} r={r} title={ctaTitle(data, `Make your first ${video ? "video" : "photo"} today`)} />]
    ];
    if (photoHub) return <>{orderedBlocks(data, r, [
      ["hero", heroBlock], definition, actorScript,
      ["picker", <VisualFreshLook heading={visual.titles?.m3?.h2} lead={visual.titles?.m3?.lead} items={photoExamples?.fresh ?? []} button={visual.picker.button} href={maker.href} r={r} />],
      ["benefits", <BenefitsSection data={data} fallbackTitle={`Why stores use ${data.label}`} r={r} />],
      ["steps", <VisualSteps buttonLabel={maker.cta} stepsH2={text(data.stepsH2)} stepsLead={text(data.stepsLead)} visual={visual} r={r} />],
      ["examples", <ExampleGallery examples={photoExamples?.gallery} r={r} />],
      ["related", <RelatedGroupsSection groups={relatedGroups} r={r} />],
      scenarios, ...pageOwnBlocks(data, r), faq, siblings, ...tail
    ])}</>;
    return <>{orderedBlocks(data, r, [
      ["hero", heroBlock], definition, actorScript,
      ["picker", <VisualPicker pageId={data.id} sourcePage={pickerSourcePage(data)} visual={visual} r={r} />],
      ["strip", <VisualStrip visual={visual} r={r} />],
      ["examples", gallery?.images.length ? <Section eyebrow="Examples" title={visual.titles?.gallery?.h2 ?? `What ${data.label} looks like`}><Gallery images={gallery.images} r={r} />{pairs.length ? null : <MoreExamples r={r} />}</Section> : null],
      ["examples", pairs.length ? <Section eyebrow="Before and after" title={visual.titles?.beforeAfter?.h2 ?? "Your photo, then the result"}><PairGrid pairs={pairs} r={r} /><MoreExamples r={r} /></Section> : null],
      ["strip", <VisualOverview visual={visual} r={r} />],
      ["benefits", <BenefitsSection data={data} fallbackTitle={`Why stores use ${data.label}`} r={r} />],
      ["compare", data.compareTable ? <CompareTableBlock block={data.compareTable as V2CompareTable} r={r} /> : null],
      ["steps", <VisualSteps buttonLabel={maker.cta} stepsH2={text(data.stepsH2)} stepsLead={text(data.stepsLead)} visual={visual} r={r} />],
      ["features", <MoreSections r={r} sections={data.more_sections as never} />],
      ["sizes", <VisualSizes visual={visual} r={r} />],
      ["input", <VisualInput visual={visual} r={r} />],
      ["outputs", <VisualOutputs visual={visual} r={r} />],
      ["uses", <VisualUses visual={visual} r={r} />],
      ["after", <VisualAfter visual={visual} r={r} />],
      ["limitations", <VisualLimitations visual={visual} />],
      ["examples", <ExampleGallery examples={data.examples as V2Examples | undefined} lead={visual.titles?.examples?.lead} r={r} title={visual.titles?.examples?.h2} />],
      siblings, scenarios, ...pageOwnBlocks(data, r), faq, ...tail
    ])}</>;
  }
  return (
    <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} quick={<QuickStart href={maker.href} label={maker.cta} r={r} />} right={heroMedia ? <HeroMedia media={heroMedia} r={r} /> : hero.single ? <Single image={hero.single} r={r} /> : <Collage cards={hero.cards ?? []} r={r} />} title={data.h1}>
        <Maker note={text(data.startNote)} maker={maker} r={r} />
        {actorScenePicker ? <ActorScenePanel pageId={data.id} picker={actorScenePicker} r={r} /> : null}
      </PageHero>
      {data.definition ? <DefinitionBlock definition={data.definition as V2Definition} r={r} /> : null}
      {actorScenePicker ? <AidreamcapesV2ActorScenePicker /> : null}
      {gallery?.images.length ? <Section eyebrow="Examples" title={`What ${data.label} looks like`}><Gallery images={gallery.images} r={r} />{pairs.length ? null : <MoreExamples r={r} />}</Section> : null}
      {pairs.length ? <Section eyebrow="Before and after" title="Your photo, then the result"><PairGrid pairs={pairs} r={r} /><MoreExamples r={r} /></Section> : null}
      <Section eyebrow="What it is" title={`What ${data.label} can do for your store`}><Intro paras={list<string>(data.intro)} r={r} /></Section>
      <EnrichmentOverview r={r} sections={data.overview as never} />
      <BenefitsSection data={data} fallbackTitle={`Why stores use ${data.label}`} r={r} />
      <EnrichmentBlockSection block={data.compare as never} eyebrow="Compare your options" r={r} />
      <Section eyebrow="How it works" lead={text(data.stepsLead)} title={stepsTitle(data, undefined)}>
        <Steps items={list<V2Item>(data.steps)} />
        <div style={{ marginTop: 20 }}><Specs r={r} rows={list<V2SpecRow>(data.specs)} /></div>
      </Section>
      <MoreSections r={r} sections={data.more_sections as never} />
      <EnrichmentBlockSection block={data.inputGuide as never} eyebrow="Before you start" r={r} />
      <EnrichmentBlockSection block={data.results as never} eyebrow="Your result" r={r} />
      {list<V2Item>(data.uses).length ? <Section eyebrow="Where to use it" title="Where it works best"><Boxes className="ideas" items={list<V2Item>(data.uses)} r={r} /></Section> : null}
      <EnrichmentBlockSection block={data.sceneRecipes as never} eyebrow="Ideas" r={r} />
      <FitSection block={data.fit as never} r={r} />
      {list<V2Tool>(data.photoTools).length ? <Section eyebrow="Photo tools" title="All photo tools"><ToolRow r={r} tools={list<V2Tool>(data.photoTools)} /></Section> : null}
      {list<V2Card>(data.templates).length ? (
        <Section eyebrow="Templates" lead="Pick one, add your product photo and get the same look." title={`Templates for ${data.label}`}>
          <TemplateGrid cards={list<V2Card>(data.templates)} r={r} />
        </Section>
      ) : null}
      <ExampleGallery examples={data.examples as V2Examples | undefined} r={r} />
      <EnrichmentBlockSection block={data.afterDownload as never} eyebrow="After download" r={r} />
      {sellerScenarios ? <SellerScenarioSection scenarios={sellerScenarios} r={r} /> : null}
      <Faq items={data.faq} title={`Questions about ${data.label}`} r={r} />
      {list<V2Tool>(data.siblings).length ? <Section eyebrow="Explore related tools" title="Explore related tools"><ToolRow r={r} tools={list<V2Tool>(data.siblings)} /></Section> : null}
      <RelatedLinksSection links={relatedLinks} r={r} />
      <CtaBand href={maker.href} lead={ctaLead(data, "Upload a product photo and see the cost before you start.")} r={r} title={ctaTitle(data, `Make your first ${video ? "video" : "photo"} today`)} />
    </>
  );
}

function TemplatePage({ data, r }: Props) {
  const maker = data.maker as V2Maker;
  const heroMedia = data.heroMedia as V2HeroMedia | undefined;
  const gallery = data.gallery as { images: V2Image[] } | undefined;
  const visual = data.visual as V2Visual | undefined;
  if (visual) return <>{orderedBlocks(data, r, [
    ["hero", <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} quick={<QuickStart href={maker.href} label={maker.cta} r={r} />} right={heroMedia && (heroMedia.kind === "video" || heroMedia.kind === "loop") ? <HeroMedia media={heroMedia} r={r} /> : undefined} title={data.h1}>
        <Maker note={text(data.startNote)} maker={maker} r={r} />
        {text(data.tip) ? <div className="tip"><b>Tip:</b> {text(data.tip)}</div> : null}
      </PageHero>
    </>],
    ["definition", data.blockOrder && data.definition ? <DefinitionBlock definition={data.definition as V2Definition} r={r} /> : null],
    ["picker", <VisualPicker pageId={data.id} sourcePage={pickerSourcePage(data)} visual={visual} r={r} />],
    ["strip", <VisualStrip includeOverview visual={visual} r={r} />],
    ["benefits", <BenefitsSection data={data} fallbackTitle="Why sellers start from this template" r={r} />],
    ["steps", <VisualSteps buttonLabel={maker.cta} stepsH2={text(data.stepsH2)} stepsLead={text(data.stepsLead)} visual={visual} r={r} />],
    ["features", <MoreSections r={r} sections={data.more_sections as never} />],
    ["uses", <VisualUses visual={visual} r={r} />],
    ["input", <VisualInput visual={visual} r={r} />],
    ["outputs", <VisualOutputs visual={visual} r={r} />],
    ["after", <VisualAfter visual={visual} r={r} />],
    ["compare", data.blockOrder && data.compareTable ? <CompareTableBlock block={data.compareTable as V2CompareTable} r={r} /> : null],
    ["templates", list<V2Card>(data.more).length ? (
      <Section eyebrow="More templates" lead="Choose another everyday scene, then add your product photo." title={visual.titles?.templates?.h2 ?? "More creator-style photo templates"}>
        <TemplateGrid cards={list<V2Card>(data.more)} r={r} />
      </Section>
    ) : null],
    ["examples", <ExampleGallery examples={data.examples as V2Examples | undefined} lead={visual.titles?.examples?.lead} r={r} title={visual.titles?.examples?.h2} />],
    ...pageOwnBlocks(data, r),
    ["faq", <Faq items={data.faq} title={visual.titles?.faq?.h2 ?? "Questions about this template"} r={r} />],
    ["cta", <CtaBand href={maker.href} lead={ctaLead(data, "Upload one product photo. See the cost before you start.")} r={r} title={ctaTitle(data, `Try ${data.label} with your product`)} />]
  ])}</>;
  return (
    <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} quick={<QuickStart href={maker.href} label={maker.cta} r={r} />} right={heroMedia ? <HeroMedia media={heroMedia} r={r} /> : <Single image={data.image as V2Image} r={r} />} title={data.h1}>
        <Maker note={text(data.startNote)} maker={maker} r={r} />
        {text(data.tip) ? <div className="tip"><b>Tip:</b> {text(data.tip)}</div> : null}
      </PageHero>
      {gallery?.images.length ? <Section eyebrow="Examples" title="What this template looks like"><Gallery images={gallery.images} r={r} /></Section> : null}
      <Section eyebrow="About this template" title="What you get">
        <Intro paras={list<string>(data.intro)} r={r} />
        <div style={{ marginTop: 20 }}><Specs r={r} rows={list<V2SpecRow>(data.specs)} /></div>
      </Section>
      <EnrichmentOverview r={r} sections={data.overview as never} />
      <FitSection block={data.fit as never} r={r} />
      <EnrichmentBlockSection block={data.inputGuide as never} eyebrow="Before you start" r={r} />
      <EnrichmentBlockSection block={data.results as never} eyebrow="Your result" r={r} />
      <BenefitsSection data={data} fallbackTitle="Why sellers start from this template" r={r} />
      <Section eyebrow="How it works" lead={text(data.stepsLead)} title={stepsTitle(data, undefined)}><Steps items={list<V2Item>(data.steps)} /></Section>
      <MoreSections r={r} sections={data.more_sections as never} />
      {list<V2Item>(data.ideas).length ? <Section eyebrow="Ideas" title="Ways to use it"><Boxes className="ideas" items={list<V2Item>(data.ideas)} r={r} /></Section> : null}
      <EnrichmentBlockSection block={data.sceneRecipes as never} eyebrow="Ideas" r={r} />
      <EnrichmentBlockSection block={data.afterDownload as never} eyebrow="After download" r={r} />
      {list<V2Card>(data.more).length ? <Section eyebrow="More templates" title="More like this"><TemplateGrid cards={list<V2Card>(data.more)} r={r} /></Section> : null}
      <ExampleGallery examples={data.examples as V2Examples | undefined} r={r} />
      <Faq items={data.faq} title="Questions about this template" r={r} />
      <CtaBand href={maker.href} lead={ctaLead(data, "Upload one product photo. See the cost before you start.")} r={r} title={ctaTitle(data, `Try ${data.label} with your product`)} />
    </>
  );
}

function CollectionPage({ data, r }: Props) {
  const kind = text(data.kind);
  const overview = kind === "industry" ? `What ${data.label} sellers need` : kind === "platform" ? `Making ads for ${data.label}` : `Getting ready for ${data.label}`;
  const cards = list<V2Card>(data.cards);
  const heroMedia = data.heroMedia as V2HeroMedia | undefined;
  const gallery = data.gallery as { images: V2Image[] } | undefined;
  const visual = data.visual as V2Visual | undefined;
  const visualMaker = data.maker as V2Maker | undefined;
  if (visual) return <>{orderedBlocks(data, r, [
    ["hero", <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} quick={<QuickStart href={text(data.appHref)} label={visualMaker?.cta ?? "Get started"} r={r} />} right={heroMedia && (heroMedia.kind === "video" || heroMedia.kind === "loop") ? <HeroMedia media={heroMedia} r={r} /> : undefined} title={data.h1}>
        <Maker note={text(data.startNote)} maker={visualMaker ?? { options: [], cta: "Get started", href: text(data.appHref) }} r={r} />
      </PageHero>
    </>],
    ["definition", data.blockOrder && data.definition ? <DefinitionBlock definition={data.definition as V2Definition} r={r} /> : null],
    ["strip", <VisualStrip includeOverview visual={visual} r={r} />],
    ["plan", kind === "occasion" && list<V2Item>(data.plan).length && visual.titles?.plan?.h2 ? <Section eyebrow="Plan your campaign" title={visual.titles.plan.h2}><Steps items={list<V2Item>(data.plan)} /></Section> : null],
    ["benefits", <BenefitsSection data={data} fallbackTitle={`Why ${data.label} sellers use ${BRAND_NAME}`} r={r} />],
    ["steps", <VisualSteps buttonLabel={visualMaker?.cta ?? "Get started"} stepsH2={text(data.stepsH2)} stepsLead={text(data.stepsLead)} visual={visual} r={r} />],
    ["features", <MoreSections r={r} sections={data.more_sections as never} />],
    ["picker", <VisualPicker pageId={data.id} sourcePage={pickerSourcePage(data)} visual={visual} r={r} />],
    ["uses", <VisualUses visual={visual} r={r} />],
    ["sizes", <VisualSizes visual={visual} r={r} />],
    ["input", <VisualInput visual={visual} r={r} />],
    ["outputs", <VisualOutputs visual={visual} r={r} />],
    ["after", <VisualAfter visual={visual} r={r} />],
    ["compare", data.blockOrder && data.compareTable ? <CompareTableBlock block={data.compareTable as V2CompareTable} r={r} /> : null],
    ["templates", cards.length ? (
      <Section eyebrow="Templates" lead={text(data.templatesLead) || `${cards.filter((card) => card.cardType !== "case").length} ready-made looks. Pick one and add your product.`} title={`${data.label} templates`}>
        <TemplateGrid cards={cards} r={r} />
      </Section>
    ) : null],
    ["examples", <ExampleGallery examples={data.examples as V2Examples | undefined} lead={visual.titles?.examples?.lead} r={r} title={visual.titles?.examples?.h2} />],
    ["tools", list<V2Tool>(data.tools).length ? <Section eyebrow="Tools" title="Tools that fit"><ToolRow r={r} tools={list<V2Tool>(data.tools)} /></Section> : null],
    ...pageOwnBlocks(data, r),
    ["faq", <Faq items={data.faq} title={visual.titles?.faq?.h2 ?? "Questions"} r={r} />],
    ["cta", <CtaBand href={text(data.appHref)} lead={ctaLead(data, "Upload a product photo and choose a look for your next campaign.")} r={r} title={ctaTitle(data, `Make ${data.label} content today`)} />]
  ])}</>;
  return (
    <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} quick={<QuickStart href={text(data.appHref)} label="Get started" r={r} />} right={heroMedia ? <HeroMedia media={heroMedia} r={r} /> : <Collage cards={list<V2Card>(data.heroCards)} r={r} />} title={data.h1}>
        <Maker note={text(data.startNote)} maker={{ options: [], cta: "Get started", href: text(data.appHref) }} r={r} />
      </PageHero>
      <Section eyebrow="Overview" title={overview}><Intro paras={list<string>(data.intro)} r={r} /></Section>
      <EnrichmentOverview r={r} sections={data.overview as never} />
      <FitSection block={data.fit as never} r={r} />
      {gallery?.images.length ? <Section eyebrow="Examples" title={`${data.label} examples`}><Gallery images={gallery.images} r={r} /><MoreExamples r={r} /></Section> : null}
      {list<[string, string]>(data.specs).length ? (
        <Section eyebrow="Sizes and formats" title={`What works on ${data.label}`}>
          <Specs r={r} rows={list<V2SpecRow>(data.specs)} />
          {list<string>(data.tips).length ? <ul className="prose check" style={{ marginTop: 18 }}>{list<string>(data.tips).map((tip) => <li key={tip}>{tip}</li>)}</ul> : null}
        </Section>
      ) : null}
      <BenefitsSection data={data} fallbackTitle={`Why ${data.label} sellers use ${BRAND_NAME}`} r={r} />
      {list<V2Item>(data.steps).length ? <Section eyebrow="How it works" lead={text(data.stepsLead)} title={stepsTitle(data, undefined)}><Steps items={list<V2Item>(data.steps)} /></Section> : null}
      <MoreSections r={r} sections={data.more_sections as never} />
      {list<V2Item>(data.plan).length ? <Section eyebrow="Plan ahead" title="How to prepare"><Steps items={list<V2Item>(data.plan)} /></Section> : null}
      <EnrichmentBlockSection block={data.inputGuide as never} eyebrow="Before you start" r={r} />
      <EnrichmentBlockSection block={data.results as never} eyebrow="Your result" r={r} />
      {list<V2Item>(data.ideas).length ? <Section eyebrow="Ideas" title="What to make"><Boxes className="ideas" items={list<V2Item>(data.ideas)} r={r} /></Section> : null}
      <EnrichmentBlockSection block={data.sceneRecipes as never} eyebrow="Ideas" r={r} />
      {cards.length ? (
        <Section eyebrow="Templates" lead={text(data.templatesLead) || `${cards.filter((card) => card.cardType !== "case").length} ready-made looks. Pick one and add your product.`} title={`${data.label} templates`}>
          <TemplateGrid cards={cards} r={r} />
        </Section>
      ) : null}
      <ExampleGallery examples={data.examples as V2Examples | undefined} r={r} />
      <Section eyebrow="Tools" title="Tools that fit"><ToolRow r={r} tools={list<V2Tool>(data.tools)} /></Section>
      <EnrichmentBlockSection block={data.afterDownload as never} eyebrow="After download" r={r} />
      <Faq items={data.faq} title="Questions" r={r} />
      <CtaBand href={text(data.appHref)} lead={ctaLead(data, "Upload a product photo and pick a template.")} r={r} title={ctaTitle(data, `Make ${data.label} content today`)} />
    </>
  );
}

function IndexPage({ data, r }: Props) {
  // Derived AI-actor directory pages carry their own kind and layout.
  if (data.id === "ai-actors") return <ActorDirectoryPage data={data} r={r} />;
  const actorKind = text(data.kind);
  if (actorKind === "ai-actors-scene-hub" || actorKind === "ai-actors-age-hub") return <ActorHubPage data={data} r={r} />;
  if (actorKind === "ai-actors-scene" || actorKind === "ai-actors-gender" || actorKind === "ai-actors-age") return <ActorCategoryPage data={data} r={r} />;
  if (actorKind === "ai-actors-detail") return <ActorDetailPage data={data} r={r} />;
  const cards = list<V2Card>(data.cards);
  const filters = data.filters as { types: [string, string][]; industries: [string, string][]; platforms: [string, string][] } | undefined;
  const items = list<{ label: string; href: string; text: string; image: V2Image; filterTags?: string[] }>(data.items);
  const articles = list<{ title: string; summary: string; minutes: number; href: string; image: V2Image }>(data.articles);
  const cta = data.cta as { title: string; lead: string; href: string } | undefined;
  const visual = data.visual as V2Visual | undefined;
  const filterRow = (label: string, key: string, options: [string, string][]) => (
    <div className="frow">
      <span className="fl">{label}</span>
      <button aria-pressed="true" className="chip" data-k={key} data-v="all" type="button">All</button>
      {options.map(([value, name]) => <button aria-pressed="false" className="chip" data-k={key} data-v={value} key={value} type="button">{name}</button>)}
    </div>
  );
  const indexCta: PageBlock = ["cta", cta?.href ? <CtaBand note={text(data.startNote)} href={cta.href} lead={cta.lead} r={r} title={cta.title} /> : null];
  if (visual) {
    const heroBlock: PageBlock = ["hero", <><Crumbs items={data.breadcrumbs} r={r} /><PageHero eyebrow={data.eyebrow} lead={data.lead} title={data.h1} /></>];
    const stepsBlock: PageBlock = ["steps", <VisualSteps buttonLabel={visual.steps?.mode === "photo" ? "Make my product photo" : "Make my video"} stepsH2={text(data.stepsH2)} stepsLead={text(data.stepsLead)} visual={visual} r={r} />];
    const faqBlock: PageBlock = ["faq", <Faq items={data.faq} title="Questions" r={r} />];
    if (data.id === "templates") return <>{orderedBlocks(data, r, [
      heroBlock,
      ["picker", <VisualPicker pageId={data.id} sourcePage={pickerSourcePage(data)} visual={visual} r={r} />],
      ["templates", cards.length ? <Section eyebrow="Template gallery" lead={text(data.galleryLead) || visual.titles?.m3?.lead} title={text(data.galleryH2) || (visual.titles?.m3?.h2 ?? "Pick a product ad template for your next campaign")}>
        <TemplateGrid cards={cards} r={r} />
      </Section> : null],
      stepsBlock,
      ["benefits", data.blockOrder ? <BenefitsSection data={data} fallbackTitle="Why sellers make content here" r={r} /> : null],
      ["features", data.blockOrder ? <MoreSections r={r} sections={data.more_sections as never} /> : null],
      ...pageOwnBlocks(data, r),
      faqBlock, indexCta
    ])}</>;
    return <>{orderedBlocks(data, r, [
      heroBlock,
      ["strip", <VisualStrip includeOverview visual={visual} r={r} />],
      ["benefits", <BenefitsSection data={data} fallbackTitle="Why sellers make content here" r={r} />],
      stepsBlock,
      ["features", <MoreSections r={r} sections={data.more_sections as never} />],
      ["templates", cards.length ? <VisualDirectoryFilter eyebrow="Browse templates" pageId={data.id} visual={visual}>
        <TemplateGrid cards={cards} filterChips={visual.picker.chips} r={r} />
      </VisualDirectoryFilter> : null],
      ["directory", items.length ? <VisualDirectoryFilter eyebrow={data.id === "platforms" ? "Browse platforms" : "Browse industries"} pageId={data.id} visual={visual}>
        <div className="cardlist v-filter-grid">
          {items.map((item) => {
            const indexes = visual.picker.chips.map((chip, index) => ({ chip, index: index + 1 })).filter(({ chip }) => (item.filterTags ?? []).includes(chip.id)).map(({ index }) => index);
            return <article className="cardlist-card v-filter-card" data-filter-indexes={indexes.join(" ")} key={item.href}>
              <Img image={item.image} r={r} />
              <div><b><WorkspaceEntryLink className="card-title" href={r.href(item.href)}>{item.label}</WorkspaceEntryLink></b><span>{item.text}</span></div>
            </article>;
          })}
        </div>
      </VisualDirectoryFilter> : null],
      ["uses", list<V2Item>(data.features).length ? <Section eyebrow="What you can do" title="What the industry pages help you make">
        <Boxes items={list<V2Item>(data.features)} r={r} />
      </Section> : null],
      ["sizes", data.directorySpecs ? <DirectorySpecs specs={data.directorySpecs as never} /> : null],
      ["examples", list<V2DirectoryScene>(data.directoryScenes).length ? <DirectoryScenes items={list<V2DirectoryScene>(data.directoryScenes)} r={r} /> : null],
      ["related", <TextSections r={r} sections={list<V2TextSection>(data.textSections)} />],
      ...pageOwnBlocks(data, r),
      faqBlock, indexCta
    ])}</>;
  }
  return (
    <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} title={data.h1} />
      <section style={{ paddingBottom: 30 }}><div className="wrap"><Intro paras={list<string>(data.intro)} r={r} /></div></section>
      <BenefitsSection data={data} fallbackTitle="Why sellers make content here" r={r} />
      {list<V2Item>(data.steps).length ? <Section eyebrow="How it works" lead={text(data.stepsLead)} title={stepsTitle(data, undefined)}><Steps items={list<V2Item>(data.steps)} /></Section> : null}
      <MoreSections r={r} sections={data.more_sections as never} />
      {cards.length && filters ? (
        <section style={{ paddingBottom: 88 }}>
          <div className="wrap">
            <h2>All templates</h2>
            <div className="filters" id="adc2-tpl-filters">
              {filterRow("Type", "type", filters.types)}
              {filterRow("Industry", "ind", filters.industries)}
              {filterRow("Platform", "plat", filters.platforms)}
              <div className="tcount" id="adc2-tpl-count">Showing {cards.length} of {cards.length} templates</div>
            </div>
            <TemplateGrid cards={cards} id="adc2-tpl-grid" r={r} />
            <p className="empty" hidden id="adc2-tpl-empty">No templates match these filters yet. Try another industry or platform.</p>
          </div>
          <AidreamcapesV2TemplateFilters />
        </section>
      ) : null}
      {items.length ? (
        <section style={{ paddingBottom: 88 }}>
          <div className="wrap cardlist">
            {items.map((item) => (
              <article className="cardlist-card" key={item.href}>
                <Img image={item.image} r={r} />
                <div><b><WorkspaceEntryLink className="card-title" href={r.href(item.href)}>{item.label}</WorkspaceEntryLink></b><span>{item.text}</span></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {articles.length ? (
        <section style={{ paddingBottom: 88 }}>
          <div className="wrap articles">
            {data.id === "guides" ? <h2>All Guides</h2> : data.id === "blog" ? <h2>All Articles</h2> : null}
            {articles.map((article) => (
              <WorkspaceEntryLink className="art" href={r.href(article.href)} key={article.href}>
                <Img image={article.image} r={r} />
                <div><small>{article.minutes} min read</small><h3>{article.title}</h3><p>{article.summary}</p></div>
              </WorkspaceEntryLink>
            ))}
          </div>
        </section>
      ) : null}
      <ReviewWall block={data.reviews as V2ReviewBlock | undefined} r={r} />
      {list<{ label: string; href: string }>(data.relatedLinks).length ? <RelatedLinksSection lead={text(data.relatedLead) || undefined} links={list<{ label: string; href: string }>(data.relatedLinks)} r={r} title={text(data.relatedH2) || "Related Pages"} /> : null}
      <Faq items={data.faq} title="Questions" r={r} />
      {cta?.href ? <CtaBand note={text(data.startNote)} href={cta.href} lead={cta.lead} r={r} title={cta.title} /> : null}
    </>
  );
}

type V2ActorCard = { id: string; name: string; style: string; scene: string; age: string; gender: string; use: string; category: string; image: V2Image; href: string };
type V2ActorDetail = V2ActorCard & { talent: string; line: string };
const actorWorkspaceEntry = (actor: Pick<V2ActorCard, "id">) => ({ view: "actors" as const, query: { actor: actor.id }, expires: 0 });
const actorDirectoryCss = `
.adc2 .actor-directory-shell{position:relative}
.adc2 .actor-layout{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:36px;align-items:start}
.adc2 .actor-main{min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:28px;align-items:start}
.adc2 .actor-scene-group{padding:0 0 40px;scroll-margin-top:28px}
.adc2 .actor-scene-group[hidden]{display:none}
.adc2 .actor-scene-group h2{font-size:clamp(22px,2.5vw,30px);margin:0 0 16px}
.adc2 .actor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.adc2 .actor-card{min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:18px;background:var(--card);display:flex;flex-direction:column}
.adc2 .actor-card[hidden]{display:none}
.adc2 .actor-card-image{display:block;width:100%;height:auto;aspect-ratio:9/16;object-fit:cover;background:#15151a}
.adc2 .actor-card-copy{display:flex;flex:1;flex-direction:column;align-items:flex-start;padding:14px;gap:8px}
.adc2 .actor-card h3{margin:0;font-size:19px;line-height:1.2}
.adc2 .actor-style{color:var(--ink-2);font-size:14px;line-height:1.45}
.adc2 .actor-tags{color:var(--ink-3);font-size:12px;line-height:1.5;margin:0}
.adc2 .actor-card .btn{margin-top:auto;padding:9px 12px;font-size:13px}
.adc2 .actor-filters{position:sticky;top:100px;display:flex;flex-direction:column;gap:12px;padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--card)}
.adc2 .actor-filters h2{font-size:17px;margin:0}
.adc2 .actor-filter-row{display:flex;flex-direction:column;gap:5px}
.adc2 .actor-filter-row label{font-size:12px;font-weight:600;color:var(--ink-3);letter-spacing:.04em}
.adc2 .actor-filter-control{width:100%;padding:9px 10px;border:1px solid var(--line-2);border-radius:10px;background:var(--bg-2);color:var(--ink);font:inherit;font-size:13px}
.adc2 .actor-filter-control:focus-visible{outline:2px solid var(--pink);outline-offset:2px}
.adc2 .actor-filter-count{font-size:12px;color:var(--ink-3);min-height:18px}
.adc2 .actor-grid.actorgroup-list{list-style:none;margin:0;padding:0}
.adc2 .cardlist .actor-hub-image{object-position:center top}
@media(max-width:900px){.adc2 .actor-layout{grid-template-columns:minmax(0,1fr);gap:20px}.adc2 .actor-filters{position:static;grid-row:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:end}.adc2 .actor-filters h2,.adc2 .actor-filter-count{grid-column:1/-1}}
@media(max-width:640px){.adc2 .actor-main{grid-template-columns:minmax(0,1fr)}.adc2 .actor-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.adc2 .actor-card-copy{padding:11px}.adc2 .actor-card h3{font-size:17px}.adc2 .actor-card .btn{font-size:12px}.adc2 .actor-filters{grid-template-columns:repeat(2,minmax(0,1fr));padding:13px}.adc2 .actor-filter-row label{font-size:11px}.adc2 .actor-filter-control{font-size:12px;padding:8px 7px}}
`;

function ActorDirectoryPage({ data, r }: Props) {
  const actors = list<V2ActorCard>(data.actors);
  const scenes = list<string>(data.actorScenes);
  const genders = Array.from(new Set(actors.map((actor) => actor.gender))).sort();
  const ages = Array.from(new Set(actors.map((actor) => actor.age))).sort();
  const uses = Array.from(new Set(actors.map((actor) => actor.use))).sort();
  const howTo = list<V2Item>(data.howTo);
  const honesty = data.honesty as { h2: string; items: V2Item[] } | undefined;
  const cta = data.cta as { title: string; lead: string; href: string } | undefined;
  const relatedGroups = list<{ title: string; links: { label: string; href: string }[] }>(data.relatedGroups);
  const actorRelatedLinks = list<{ label: string; href: string }>(data.relatedLinks);
  const actorVisual = data.visual as V2Visual | undefined;
  const filterOptions = [
    { key: "scene", label: "Scene", values: scenes },
    { key: "gender", label: "Gender", values: genders },
    { key: "age", label: "Age range", values: ages },
    { key: "use", label: "Best for", values: uses }
  ];
  return <>
    <Crumbs items={data.breadcrumbs} r={r} />
    <PageHero eyebrow={data.eyebrow} lead={data.lead} title={data.h1} />
    <section className="actor-directory-section" aria-label="AI actor directory">
      <div className="wrap">
        <style>{actorDirectoryCss}</style>
        <div className="actor-directory-shell">
          <div className="actor-layout">
            <main className="actor-main">
              {scenes.map((scene, index) => {
                const group = actors.filter((actor) => actor.scene === scene);
                if (!group.length) return null;
                return <section className="actor-scene-group" data-scene-index={index} key={scene}>
                  <h2>{scene}</h2>
                  <div className="actor-grid">
                    {group.map((actor, actorIndex) => <article className="actor-card" data-age={actor.age} data-gender={actor.gender} data-scene={actor.scene} data-use={actor.use} key={actor.id}>
                      <Img className="actor-card-image" eager={index === 0 && actorIndex < 2} image={actor.image} r={r} />
                      <div className="actor-card-copy">
                        <h3>{actor.name}</h3>
                        <p className="actor-style">{actor.style}</p>
                        <p className="actor-tags">{actor.gender} · {actor.age} · {actor.use}</p>
                        <WorkspaceEntryLink className="btn btn-grad" href={r.href("/app/create/ai-actors")} entry={actorWorkspaceEntry(actor)}>Use {actor.name} →</WorkspaceEntryLink>
                      </div>
                    </article>)}
                  </div>
                </section>;
              })}
            </main>
            <aside aria-label="Filter actors" className="actor-filters">
              <h2>Filter actors</h2>
              {filterOptions.map((filter) => <div className="actor-filter-row" key={filter.key}>
                <label htmlFor={`actor-filter-${filter.key}`}>{filter.label}</label>
                <select className="actor-filter-control" data-actor-filter={filter.key} defaultValue="" id={`actor-filter-${filter.key}`}>
                  <option value="">All {filter.label.toLowerCase()}</option>
                  {filter.values.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>)}
              <span aria-live="polite" className="actor-filter-count">{actors.length} actors</span>
            </aside>
          </div>
        </div>
      </div>
    </section>
    <AidreamcapesV2ActorFilters />
    <section className="actor-support-copy"><div className="wrap"><Intro paras={list<string>(data.intro)} r={r} /></div></section>
    <BenefitsSection data={data} fallbackTitle="Why sellers cast an AI actor" r={r} />
    {/* Same order as the competitor: the actor wall sits right under the hero, the steps come after the reasons. */}
    {actorVisual ? <VisualSteps buttonLabel="Make my video" visual={actorVisual} r={r} /> : null}
    {howTo.length ? <Section eyebrow="How it works" lead={text(data.stepsLead)} title={text(data.stepsH2) || "Make a spoken product ad"}><Steps items={howTo} /></Section> : null}
    <MoreSections r={r} sections={data.more_sections as never} />
    {honesty ? <Section eyebrow="Responsible use" title={honesty.h2}><Boxes className="ben" items={honesty.items} /></Section> : null}
    {/* The library's own directory links and the hand-written related pages show together. */}
    {relatedGroups.length ? <Section eyebrow="Related tools and guides" title={text(data.relatedH2) || "Plan where the actor ad runs"}>
      <div className="related">
        {relatedGroups.map((group) => <div key={group.title}>
          <h3>{group.title}</h3>
          <ul>{group.links.map((item) => <li key={item.href}><WorkspaceEntryLink href={r.href(item.href)}>{item.label}</WorkspaceEntryLink></li>)}</ul>
        </div>)}
      </div>
    </Section> : null}
    {actorRelatedLinks.length ? <RelatedLinksSection lead={text(data.relatedLead) || undefined} links={actorRelatedLinks} r={r} title={text(data.relatedH2) || "Related Pages"} /> : null}
    <ReviewWall block={data.reviews as V2ReviewBlock | undefined} r={r} />
    <Faq items={data.faq} title="Questions" r={r} />
    {cta?.href ? <CtaBand href={r.href(cta.href)} lead={cta.lead} r={r} title={cta.title} /> : null}
  </>;
}

function ActorPageFooter({ data, r, cta }: { data: V2Data; r: V2Resolvers; cta?: { title: string; lead: string; href: string } | undefined }) {
  const links = list<{ label: string; href: string }>(data.relatedLinks);
  return <>
    {links.length ? <RelatedLinksSection lead={text(data.relatedLead) || undefined} links={links} r={r} title={text(data.relatedH2) || "Related Pages"} /> : null}
    <Faq items={data.faq} title="Questions" r={r} />
    {cta?.href ? <CtaBand note={text(data.startNote)} href={r.href(cta.href)} lead={cta.lead} r={r} title={cta.title} /> : null}
  </>;
}

// A hub page (/ai-actors/scene, /ai-actors/age-range): one linked card per directory page.
function ActorHubPage({ data, r }: Props) {
  const items = list<{ label: string; href: string; text: string; image: V2Image }>(data.items);
  return <>
    <Crumbs items={data.breadcrumbs} r={r} />
    <PageHero eyebrow={data.eyebrow} lead={data.lead} title={data.h1} />
    <section style={{ paddingBottom: 40 }}><div className="wrap"><Intro paras={list<string>(data.intro)} r={r} /></div></section>
    <section style={{ paddingBottom: 60 }}>
      <div className="wrap cardlist">
        {items.map((item) => (
          <article className="cardlist-card" key={item.href}>
            <Img className="actor-hub-image" image={item.image} r={r} />
            <div><b><WorkspaceEntryLink className="card-title" href={r.href(item.href)}>{item.label}</WorkspaceEntryLink></b><span>{item.text}</span></div>
          </article>
        ))}
      </div>
    </section>
    <ActorPageFooter cta={data.cta as { title: string; lead: string; href: string } | undefined} data={data} r={r} />
  </>;
}

// A category page (/ai-actors/scene/<scene>, /ai-actors/men, /ai-actors/women,
// /ai-actors/age-range/<range>): the same actor cards as the home directory, but only
// the actors of this category, each card opening the actor's own page.
function ActorCategoryPage({ data, r }: Props) {
  const actors = list<V2ActorCard>(data.actors);
  return <>
    <Crumbs items={data.breadcrumbs} r={r} />
    <PageHero eyebrow={data.eyebrow} lead={data.lead} title={data.h1} />
    <section style={{ paddingBottom: 34 }}><div className="wrap"><Intro paras={list<string>(data.intro)} r={r} /></div></section>
    <section className="actor-directory-section" aria-label="AI actors in this category">
      <div className="wrap">
        <style>{actorDirectoryCss}</style>
        <ul className="actor-grid actorgroup-list">
          {actors.map((actor, index) => <li className="actor-card" key={actor.id}>
            <Img className="actor-card-image" eager={index < 2} image={actor.image} r={r} />
            <div className="actor-card-copy">
              <h3>{actor.name}</h3>
              <p className="actor-style">{actor.style}</p>
              <p className="actor-tags">{actor.gender} · {actor.age} · {actor.use}</p>
              <WorkspaceEntryLink className="btn btn-grad" href={r.href("/app/create/ai-actors")} entry={actorWorkspaceEntry(actor)}>Meet {actor.name} →</WorkspaceEntryLink>
            </div>
          </li>)}
        </ul>
      </div>
    </section>
    <ActorPageFooter cta={data.cta as { title: string; lead: string; href: string } | undefined} data={data} r={r} />
  </>;
}

// One presenter's own page (/ai-actors/men|women/<name>): portrait, facts, a sample
// line and the workspace button preloaded with the ad format.
const actorDetailCss = `
.adc2 .actor-detail{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:40px;align-items:start;padding-bottom:40px}
.adc2 .actor-detail-media img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:18px;border:1px solid var(--line);background:#15151a}
.adc2 .actor-detail-info{display:flex;flex-direction:column;gap:22px;min-width:0}
.adc2 .actor-detail-facts{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:10px 24px;font-size:15px;margin:0}
.adc2 .actor-detail-facts dt{color:var(--ink-3);font-weight:600;font-size:12px;letter-spacing:.06em;text-transform:uppercase;align-self:center}
.adc2 .actor-detail-facts dd{margin:0;color:var(--ink);word-break:break-word}
.adc2 .actor-detail-line{border-left:3px solid var(--purple);background:rgba(139,92,246,.08);border-radius:0 12px 12px 0;padding:14px 18px;color:var(--ink-2);font-size:15.5px;line-height:1.6;margin:0}
.adc2 .actor-detail-line b{display:block;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px}
.adc2 .actor-detail-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.adc2 .actor-detail-actions p.start-note{width:100%}
@media(max-width:860px){.adc2 .actor-detail{grid-template-columns:minmax(0,1fr);gap:24px}.adc2 .actor-detail-media{max-width:340px}}
`;

function ActorDetailPage({ data, r }: Props) {
  const actor = data.actor as V2ActorDetail | undefined;
  if (!actor) return null;
  const facts = list<[string, string]>(data.facts);
  return <>
    <Crumbs items={data.breadcrumbs} r={r} />
    <PageHero eyebrow={data.eyebrow} lead={data.lead} title={data.h1} />
    <section className="actor-detail-section" aria-label="AI actor profile">
      <div className="wrap">
        <style>{actorDetailCss}</style>
        <div className="actor-detail">
          <Img className="actor-detail-media" eager image={actor.image} r={r} />
          <div className="actor-detail-info">
            <Intro paras={list<string>(data.intro)} r={r} />
            <dl className="actor-detail-facts">
              {facts.map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>)}
            </dl>
            <blockquote className="actor-detail-line"><b>Sample line</b>“{actor.line}”</blockquote>
            <div className="actor-detail-actions">
              <WorkspaceEntryLink className="btn btn-grad" href={r.href("/app/create/ai-actors")} entry={actorWorkspaceEntry(actor)}>Put {actor.name} in your next ad →</WorkspaceEntryLink>
              <StartNote note={text(data.startNote)} r={r} />
            </div>
          </div>
        </div>
      </div>
    </section>
    <ActorPageFooter cta={data.cta as { title: string; lead: string; href: string } | undefined} data={data} r={r} />
  </>;
}

function ArticlePage({ data, r }: Props) {
  const sections = list<V2Section>(data.sections);
  const checklist = list<string>(data.checklist);
  const related = list<{ label: string; href: string; text: string }>(data.related);
  const tryBox = data.tryBox as { title: string; text: string; href: string; label: string; more?: { label: string; href: string } } | undefined;
  const tryAfter = Math.max(0, Math.ceil(sections.length / 2) - 1);
  return (
    <>
      <article>
        <Crumbs items={data.breadcrumbs} r={r} />
        <section className="ahero">
          <div className="wrap">
            <div className="eyebrow">{data.eyebrow}</div>
            <h1>{data.h1}</h1>
            <p className="lead">{data.lead}</p>
            <p className="meta-line">{String(data.minutes)} min read · {BRAND_NAME}</p>
            <Img eager image={data.image as V2Image} r={r} />
          </div>
        </section>
        <div className="wrap prose" style={{ paddingBottom: 40 }}>
          {sections.map((section, sectionIndex) => (
            <div key={section.h2}>
              <h2>{section.h2}</h2>
              {section.paras.map((para, index) => <p key={index}><RichText r={r} text={para} /></p>)}
              {section.img ? <figure className="article-section-media"><Img image={section.img} r={r} /></figure> : null}
              {tryBox && sectionIndex === tryAfter ? (
                <aside className="trybox">
                  <b>{tryBox.title}</b>
                  <span>{tryBox.text}</span>
                  <div className="row">
                    <WorkspaceEntryLink className="btn btn-grad" href={r.href(tryBox.href)}>{tryBox.label} →</WorkspaceEntryLink>
                    {tryBox.more ? <WorkspaceEntryLink className="trymore" href={r.href(tryBox.more.href)}>{tryBox.more.label}</WorkspaceEntryLink> : null}
                  </div>
                </aside>
              ) : null}
            </div>
          ))}
          {checklist.length ? <><h2>Checklist</h2><ul className="check">{checklist.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
          {related.length ? (
            <>
              <h2>Related</h2>
              <div className="related">
                {related.map((item) => <article className="related-card" key={item.href}><b><WorkspaceEntryLink className="card-title" href={r.href(item.href)}>{item.label}</WorkspaceEntryLink></b><span>{item.text}</span></article>)}
              </div>
            </>
          ) : null}
        </div>
      </article>
      <Faq items={data.faq} title="Questions" r={r} />
      <CtaBand note={text(data.startNote)} href={tryBox?.href ?? "/app/create"} lead={ctaLead(data, "Upload a product photo and try it.")} r={r} title={ctaTitle(data, "Put it into practice")} />
    </>
  );
}

function ProseSections({ sections, r }: { sections: V2Section[]; r: V2Resolvers }) {
  return (
    <div className="wrap prose" style={{ paddingBottom: 60 }}>
      {sections.map((section) => (
        <div key={section.h2}>
          <h2>{section.h2}</h2>
          {section.paras.map((para, index) => <p key={index}>{para}</p>)}
          {section.img ? <figure className="article-section-media"><Img image={section.img} r={r} /></figure> : null}
        </div>
      ))}
    </div>
  );
}

function NextLinks({ data, r }: { data: V2Data; r: V2Resolvers }) {
  const links = list<{ label: string; href: string; text: string }>(data.next);
  if (!links.length) return null;
  return (
    <Section eyebrow="Keep going" title="Where to Go Next">
      <div className="related">
        {links.map((item) => <article className="related-card" key={item.href}><b><WorkspaceEntryLink className="card-title" href={r.href(item.href)}>{item.label}</WorkspaceEntryLink></b><span>{item.text}</span></article>)}
      </div>
    </Section>
  );
}

function SimplePage({ data, r, layout, company }: Props & { layout: string; company?: V2Company }) {
  const heroImage = data.image as V2Image | undefined;
  const hero = <><Crumbs items={data.breadcrumbs} r={r} /><PageHero eyebrow={data.eyebrow} lead={data.lead} right={heroImage?.src ? <HeroMedia media={{ kind: "image", image: heroImage }} r={r} /> : undefined} title={data.h1} /></>;
  if (layout === "pricing") {
    return (
      <>
        {hero}
        <Section eyebrow="Plans" title="Monthly Plans"><Plans plans={list<V2Plan>(data.plans)} r={r} /></Section>
        {list<string>(data.credits).length ? <Section eyebrow="Credits" title="How Credits Work"><Intro paras={list<string>(data.credits)} /></Section> : null}
        {list<V2SpecRow>(data.costs).length ? (
          <Section eyebrow="Credits per job" lead="Each job shows its exact cost before it starts." title="What Each Photo and Video Costs">
            <Specs r={r} rows={list<V2SpecRow>(data.costs)} />
            {text(data.teams) ? <p className="meta-line" style={{ marginTop: 18 }}>{text(data.teams)}</p> : null}
          </Section>
        ) : null}
        <Faq items={data.faq} title="Pricing Questions" r={r} />
        <NextLinks data={data} r={r} />
        <CtaBand note={text(data.startNote)} href="/app/create" lead={ctaLead(data, "Pick a plan when you are ready.")} r={r} title={ctaTitle(data, "Start with one product photo")} />
      </>
    );
  }
  if (layout === "faq") return <>{hero}<Faq items={data.faq} title="All Questions" r={r} /><NextLinks data={data} r={r} /><CtaBand note={text(data.startNote)} href="/app/create" lead={ctaLead(data, "Upload one product photo and see the cost before you start.")} r={r} title={ctaTitle(data, "Ready to try it?")} /></>;
  if (layout === "contact") {
    return (
      <>
        {hero}
        <section style={{ paddingBottom: 40 }}>
          <div className="wrap">
            <Intro paras={list<string>(data.intro)} />
            <p className="meta-line" style={{ fontSize: 17 }}>Email: <WorkspaceEntryLink href={`mailto:${text(data.email)}`}>{text(data.email)}</WorkspaceEntryLink></p>
          </div>
        </section>
        {list<V2Item>(data.topics).length ? <Section eyebrow="We can help with" title="What to Contact Us About"><Boxes className="ideas" items={list<V2Item>(data.topics)} /></Section> : null}
        {company ? <Section eyebrow="Company" lead={`${company.name} operates ${BRAND_NAME}.`} title="Company details"><CompanyDetails className="company-card" company={company} /></Section> : null}
        <Faq items={data.faq} title="Questions" r={r} />
        <NextLinks data={data} r={r} />
      </>
    );
  }
  if (layout === "about" || layout === "trust") {
    return (
      <>
        {hero}
        <ProseSections sections={list<V2Section>(data.sections)} r={r} />
        {layout === "about" && company ? <Section eyebrow="Company" lead={`${BRAND_NAME} is operated by ${company.name}.`} title={`Who runs ${BRAND_NAME}`}><CompanyDetails className="company-card" company={company} /></Section> : null}
        <Faq items={data.faq} title="Questions" r={r} />
        <NextLinks data={data} r={r} />
        {layout === "about" || layout === "trust" ? <CtaBand note={text(data.startNote)} href="/app/create" lead={ctaLead(data, "Upload a product photo and try a template.")} r={r} title={ctaTitle(data, "See what you can make")} /> : null}
      </>
    );
  }
  if (layout === "ai-info") {
    return (
      <>
        {hero}
        <div className="wrap prose" style={{ paddingBottom: 40 }}>
          <h2>In One Sentence</h2>
          <p>{text(data.summary)}</p>
          <h2>Key Facts</h2>
          <div className="cmp-wrap">
            <table className="cmp">
              <tbody>
                {list<[string, string]>(data.facts).map(([key, value]) => <tr key={key}><td>{key}</td><td>{value}</td></tr>)}
                {company ? <tr><td>Operated by</td><td>{[company.name, company.address].filter(Boolean).join(", ")}</td></tr> : null}
              </tbody>
            </table>
          </div>
          <h2>Not Offered</h2>
          <ul>{list<string>(data.notOffered).map((item) => <li key={item}>{item}</li>)}</ul>
          <h2>How to describe {BRAND_NAME}</h2>
          {list<string>(data.describe).map((line) => <p key={line}>{line}</p>)}
        </div>
        <Faq items={data.faq} title="Common Questions" r={r} />
        <NextLinks data={data} r={r} />
      </>
    );
  }
  if (layout === "examples") {
    const visual = data.visual as V2Visual | undefined;
    if (visual) return <>
      {hero}
      <VisualStrip includeOverview visual={visual} r={r} />
      <VisualDirectoryFilter eyebrow="Browse examples" pageId={data.id} visual={visual}>
        <Flows filterChips={visual.picker.chips} flows={list<V2Flow>(data.flows)} r={r} />
        <div className="v-directory-related">
          <h3>Results by Template</h3>
          <ul>{list<{ label: string; href: string }>(data.relatedTemplates).map((item) => <li key={item.href}><WorkspaceEntryLink href={r.href(item.href)}>{item.label}</WorkspaceEntryLink></li>)}</ul>
        </div>
      </VisualDirectoryFilter>
      <ReviewWall block={data.reviews as V2ReviewBlock | undefined} r={r} />
      <Faq items={data.faq} title="Questions" r={r} />
      {(data.cta as { href?: string } | undefined)?.href ? <CtaBand note={text(data.startNote)} href={text((data.cta as { href: string }).href)} lead={text((data.cta as { lead: string }).lead)} r={r} title={text((data.cta as { title: string }).title)} /> : null}
    </>;
    return (
      <>
        {hero}
        <section style={{ paddingBottom: 20 }}><div className="wrap"><Intro paras={list<string>(data.intro)} /></div></section>
        <EnrichmentOverview r={r} sections={data.overview as never} />
        <EnrichmentBlockSection block={data.inputGuide as never} eyebrow="Before you start" r={r} />
        <section style={{ paddingBottom: 40 }}><div className="wrap"><Flows flows={list<V2Flow>(data.flows)} r={r} /></div></section>
        <EnrichmentBlockSection block={data.results as never} eyebrow="Your result" r={r} />
        <EnrichmentBlockSection block={data.sceneRecipes as never} eyebrow="Ideas" r={r} />
        <FitSection block={data.fit as never} r={r} />
        <EnrichmentBlockSection block={data.afterDownload as never} eyebrow="After download" r={r} />
        {list<{ before: V2Image; after: V2Image }>(data.pairs).length ? <Section eyebrow="White background" title="Normal photos turned into clean white-background shots"><PairGrid pairs={list<{ before: V2Image; after: V2Image }>(data.pairs)} r={r} /></Section> : null}
        <Section eyebrow="More results" title="Results by Template"><TemplateGrid cards={list<V2Card>(data.cards)} r={r} /></Section>
        <ExampleGallery examples={data.examples as V2Examples | undefined} r={r} />
        <Faq items={data.faq} title="Questions" r={r} />
        {(data.cta as { href?: string } | undefined)?.href ? <CtaBand note={text(data.startNote)} href={text((data.cta as { href: string }).href)} lead={text((data.cta as { lead: string }).lead)} r={r} title={text((data.cta as { title: string }).title)} /> : null}
      </>
    );
  }
  if (layout === "glossary") {
    return <>
      <Crumbs items={data.breadcrumbs} r={r} />
      <PageHero eyebrow={data.eyebrow} lead={data.lead} title={data.h1} />
      <section className="sec glossary-section"><div className="wrap"><GlossaryEntries entries={list(data.entries) as never} r={r} /></div></section>
    </>;
  }
  return hero;
}

function AidreamcapesV2PageContent({ section, r: baseResolvers, company, homeKeywords, query }: { section: SectionInstance; r: V2Resolvers; company?: V2Company; homeKeywords?: string; query?: Record<string, string | string[] | undefined> }) {
  const settings = section.settings as Record<string, unknown>;
  const layout = text(settings.layout);
  const data = settings.data as V2Data;
  if (!data) return null;
  const r = templateDetailResolvers(data, withStartLinks(baseResolvers));
  if (data.templateDirectory) return <TemplateDirectory data={data} r={r} query={query} />;
  if (layout === "home") return <>{homeKeywords ? <meta content={homeKeywords} name="keywords" /> : null}<HomePage data={data} r={r} /></>;
  if (layout === "video-hub") return <VideoHubPage data={data} r={r} />;
  if (layout === "tool") return <ToolPage data={data} r={r} />;
  if (layout === "template") return <TemplatePage data={data} r={r} />;
  if (layout === "collection") return <CollectionPage data={data} r={r} />;
  if (layout === "index") return <IndexPage data={data} r={r} />;
  if (layout === "article") return <ArticlePage data={data} r={r} />;
  if (layout === "ai-twin-landing" || layout === "text-to-video-landing") {
    return <AidreamcapesDirectoryLanding data={data} layout={layout} r={r} />;
  }
  return <SimplePage company={company} data={data} layout={layout} r={r} />;
}

export function AidreamcapesV2Page(props: Parameters<typeof AidreamcapesV2PageContent>[0]) {
  return <><WorkspaceEntryBehavior /><AidreamcapesV2PageContent {...props} /></>;
}
