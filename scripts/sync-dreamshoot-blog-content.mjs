import fs from "fs";
import path from "path";
import crypto from "crypto";

const statePath = path.join(process.cwd(), "data/platform-state.json");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function section(type, settings, blocks = []) {
  return { type, settings, blocks };
}

function html(strings, ...values) {
  return strings.reduce((result, part, index) => `${result}${part}${values[index] ?? ""}`, "").replace(/\n\s+/g, "");
}

function readableList(items) {
  const values = items.map((item) => item.trim()).filter(Boolean);
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function searchFriendlySeoTitle(label, brand, category = "private galleries") {
  const compactLabel = String(label ?? "").trim();
  const candidates = category === "video themes"
    ? [
      `${compactLabel} video theme guide for ${brand}`,
      `${compactLabel} motion theme guide | ${brand}`,
      `${compactLabel} video guide | ${brand}`
    ]
    : [
      `${compactLabel} guide for ${brand} private galleries`,
      `${compactLabel} private gallery guide | ${brand}`,
      `${compactLabel} planning guide | ${brand}`,
      `${compactLabel} guide | ${brand}`
    ];
  const exactFit = candidates.find((title) => title.length >= 45 && title.length <= 70);
  if (exactFit) return exactFit;

  const shortFit = candidates.find((title) => title.length < 45);
  if (shortFit) {
    const padded = `${shortFit} for AI photo planning`;
    if (padded.length <= 70) return padded;
  }

  const suffix = ` guide | ${brand}`;
  const maxLabelLength = Math.max(12, 70 - suffix.length);
  const truncatedLabel = compactLabel.slice(0, maxLabelLength).replace(/\s+\S*$/, "").trim() || compactLabel.slice(0, maxLabelLength);
  return `${truncatedLabel}${suffix}`;
}

function makeCategoryArticle(input) {
  const label = input.label;
  const lowerLabel = label.toLowerCase();
  const brand = input.brand;
  const isAidreamcapes = brand === "Aidreamcapes";
  const kind = input.kind;
  const isTool = kind === "tool";
  const isVideoTheme = kind === "video-theme";
  const articleKind = isTool ? "tool category" : isVideoTheme ? "video theme category" : "package category";
  const pluralKind = isTool ? "tools" : isVideoTheme ? "video themes" : "packages";
  const directoryHref = isTool || isVideoTheme ? "/tools" : "/collections";
  const directoryLabel = isTool || isVideoTheme ? "Tools" : "Photo Packages";
  const sourceTerm = input.sourceTerm ?? (isVideoTheme ? "source frames" : isAidreamcapes ? "source portraits" : "source photos");
  const setTerm = isVideoTheme ? "video clip" : isAidreamcapes ? "album" : "photo set";
  const brandNiche = isAidreamcapes ? "fan and holiday" : "AI photo";
  const examples = input.examples.length ? input.examples : [label];
  const examplesText = readableList(examples);
  const anchorPrefix = input.blogSlug.replace(/^\/blog\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const summary = input.summary ?? `Use this ${brand} guide to decide when ${label} fits, which ${sourceTerm} or references help, what to compare before spending credits, and how to review finished images privately.`;
  const seoTitle = input.seoTitle ?? searchFriendlySeoTitle(label, brand, isVideoTheme ? "video themes" : "private galleries");
  const seoDescription = input.seoDescription ?? `Plan ${label} in ${brand}: choose ${sourceTerm}, compare fit, review credit cost, and check the private gallery before downloads.`;
  const faqIntro = input.faqIntro ?? `${label} questions usually come down to source quality, scope, credit planning, and whether the finished images match the intended use.`;
  const targetHref = input.targetHref ?? directoryHref;
  const targetLabel = input.targetLabel ?? (isTool ? `Open ${label} tool` : isVideoTheme ? `Open ${label} video themes` : `Open ${label} package`);
  const openingLead = isAidreamcapes
    ? `The ${label} ${articleKind} gives ${brand} customers one clear private album direction to compare before credits are spent.`
    : `The ${label} ${articleKind} helps ${brand} customers choose a clear package direction before they spend credits.`;
  const fitLead = isAidreamcapes
    ? `Use ${label} when ${examplesText} are the clearest match for the next ${setTerm}.`
    : `Use ${label} when ${examplesText} are the nearest match for the next ${setTerm}.`;
  const secondLead = isAidreamcapes
    ? `The strongest ${lowerLabel} requests keep one occasion, one scene, and one review goal in the same lane. A customer who wants a private fan or holiday album should not judge the set by the standards of a work profile or a broader editorial brief.`
    : `The strongest ${lowerLabel} requests keep the brief and the result aligned. A customer who needs a calm work portrait should not judge the same set by the standards of a dramatic scene package.`;
  const sourceLead = isAidreamcapes
    ? `${input.sourceFocus} Start with approved source portraits and one album cue that matters most to the gallery. Treat the ${sourceTerm} as identity evidence first. Style references, outfit notes, fan details, holiday cues, or movement ideas should support the request after the person is already clear.`
    : `${input.sourceFocus} Start with sharp source photos and one style cue that matters most to the package. Treat the ${sourceTerm} as identity evidence first. Style references, outfit notes, fan details, holiday cues, or movement ideas should support the request after the person is already clear.`;
  const compareLead = isAidreamcapes
    ? `Compare ${lowerLabel} against neighboring ${pluralKind} by the private outcome it supports, not by the strongest cover image. The table below turns the category into a practical choice before credit cost is confirmed.`
    : `Compare ${lowerLabel} against neighboring ${pluralKind} by the job it solves, not by which cover image looks strongest. The table below turns the category into a practical choice before credit cost is confirmed.`;
  const creditsLead = isAidreamcapes
    ? `Before the job starts, review the visible credit cost and the permission boundary. If you only need to test ${lowerLabel}, a smaller request can teach you what works. If the final use is already clear, a broader album may be easier to judge because it gives more crops and expressions to compare.`
    : `Before the job starts, review the visible credit cost and ask whether the category is carrying the right amount of work. If you only need to test ${lowerLabel}, a smaller request can teach you what works. If the final use is already clear, a broader gallery may be easier to judge because it gives more crops and expressions to compare.`;
  const reviewLead = isAidreamcapes
    ? `${input.reviewFocus} Also check whether the gallery still feels original, private, and easy to explain to someone who was not part of the request.`
    : `${input.reviewFocus} Also check small visual details that often decide whether a result is ready for a profile, card, post, or archive: face consistency, hand and hair edges, clothing lines, background distractions, and whether the image still reads well at the crop size where you will use it.`;
  const moodLead = `${input.elementStory} This is where ${label} becomes more than a menu label. The visible mood should explain why the category was chosen, while the private gallery keeps the customer in control of what stays personal and what becomes a downloaded favorite.`;
  const avoidLead = isAidreamcapes
    ? `${input.avoid} The fastest way to weaken ${lowerLabel} results is to overload the request with unrelated goals. Keep one occasion, one mood, and one review standard at a time, then run a second request when the next direction is different enough to need its own review.`
    : `${input.avoid} The fastest way to weaken ${lowerLabel} results is to overload the request with unrelated goals. Do not ask one job to be a professional portrait, a themed album, a restoration pass, and a motion concept at the same time. Keep the category honest, then run a second request when the next direction is different enough to need its own review.`;
  const planningHeading = isAidreamcapes ? "A planning pass before credits" : "A planning pass before you spend credits";
  const planningIntro = isAidreamcapes && targetHref && targetHref !== directoryHref
    ? `Open <a href="${targetHref}">${label}</a> for the focused theme page, or browse <a href="${directoryHref}">${directoryLabel}</a> to compare it with nearby choices. The best choice is the one that makes the review criteria obvious before the first image is generated.`
    : `For broader browsing, open <a href="${directoryHref}">${directoryLabel}</a> and compare ${label} with the categories around it. The best choice is the one that makes the review criteria obvious before the first image is generated.`;
  const planningBullets = isAidreamcapes
    ? [
      "Name the exact private album use for the finished images.",
      `Choose the clearest ${sourceTerm} before adding style references.`,
      `Match the request to ${examplesText}, not every nearby category.`,
      "Review credit cost and permission boundaries before generation starts.",
      "Use the private gallery to compare results before downloading favorites."
    ]
    : [
      "Name the exact use for the finished images.",
      `Choose the clearest ${sourceTerm} before adding style references.`,
      `Match the request to ${examplesText}, not every nearby category.`,
      "Review credit cost before generation starts.",
      "Use the private gallery to compare results before downloading favorites."
    ];
  const closingLead = isAidreamcapes
    ? `${label} works best when it is treated as a focused private album choice. Prepare the right inputs, review the cost, and let the private gallery show what should happen next.`
    : `${label} works best when it is treated as a focused planning choice. Prepare the right inputs, review the cost, and let the private gallery show what should happen next.`;

  return {
    id: `${input.sitePrefix}_blog_${kind}_${anchorPrefix.replace(/-/g, "_")}`,
    slug: input.blogSlug,
    pageTitle: input.pageTitle ?? `${label} guide`,
    title: input.title ?? `${label}: how to plan this ${brand} ${isTool ? "tool workflow" : isVideoTheme ? "video theme workflow" : "photo package category"}`,
    summary,
    author: `${brand} editorial team`,
    publishedAt: "2026-07-28",
    updatedAt: "2026-07-28",
    readMinutes: input.readMinutes ?? "6",
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt ?? `${brand} ${label} ${articleKind} cover`,
    tags: input.tags ?? `${label}|${isTool ? "Tools" : isVideoTheme ? "Video themes" : "Photo packages"}|Credits|Private gallery`,
    primaryCta: input.primaryCta ?? (isTool || isVideoTheme ? "Open Tools" : "Browse packages"),
    primaryHref: directoryHref,
    secondaryCta: input.secondaryCta ?? "View pricing",
    secondaryHref: "/pricing",
    targetLabel,
    targetHref,
    seoTitle,
    seoDescription,
    seoKeywords: input.seoKeywords ?? `${label} guide, ${brand} ${pluralKind}, ${brandNiche} planning, ${sourceTerm}, private gallery credits`,
    body: html`
      <p>${openingLead}</p>
      <h2 id="${anchorPrefix}-fit">${isAidreamcapes ? `Where ${label} fits` : `When ${label} is the right fit`}</h2>
      <p>${fitLead} If the goal is still vague, start by naming the final use: profile update, creator album, keepsake, announcement, social draft, or a short motion test.</p>
      <p>${secondLead}</p>
      <h2 id="${anchorPrefix}-source">${isAidreamcapes ? "What to upload first" : "What to prepare before choosing it"}</h2>
      <p>${sourceLead}</p>
      <p>For a first pass, keep the input set smaller and cleaner than a social camera roll. Use current images, avoid heavy filters, and separate unrelated goals into different private jobs. ${brand} can follow a focused brief more reliably than a folder that asks for several looks at once.</p>
      <h2 id="${anchorPrefix}-compare">${isAidreamcapes ? `How ${label} compares` : `How to compare ${label} with nearby choices`}</h2>
      <p>${compareLead}</p>
      <table><thead><tr><th>Decision point</th><th>Use ${label} when</th><th>Review after generation</th></tr></thead><tbody><tr><td>Final use</td><td>${input.bestFor}</td><td>${input.reviewFocus}</td></tr><tr><td>${sourceTerm}</td><td>${input.sourceFocus}</td><td>Check whether the clearest input details carried through the best images.</td></tr><tr><td>Category examples</td><td>${examplesText}</td><td>Keep the outputs that match the chosen example instead of mixing several directions.</td></tr><tr><td>Credit plan</td><td>Use a focused first pass when the style is new.</td><td>Decide whether the next request should repeat, expand, or change direction.</td></tr></tbody></table>
      <h2 id="${anchorPrefix}-credits">${isAidreamcapes ? "Credit and permission planning" : "Credit and private gallery planning"}</h2>
      <p>${creditsLead}</p>
      <p>Finished outputs belong in the signed-in private gallery first. Use that space to compare identity, crop, expression, background detail, and whether the ${articleKind} actually delivered the mood you selected. Download favorites only after separating public-use images from experiments.</p>
      <h2 id="${anchorPrefix}-review">${isAidreamcapes ? "What to review privately" : "Details to review before download"}</h2>
      <p>${reviewLead}</p>
      <p>${moodLead}</p>
      <h2 id="${anchorPrefix}-avoid">${isAidreamcapes ? "What to avoid" : "Mistakes to avoid"}</h2>
      <p>${avoidLead}</p>
      <h2 id="${anchorPrefix}-planning-pass">${planningHeading}</h2>
      <ul>${planningBullets.map((item) => `<li>${item}</li>`).join("")}</ul>
      <p>${planningIntro}</p>
      <h2 id="${anchorPrefix}-faq">${label} FAQ</h2>
      <p>${faqIntro}</p>
      <h3 id="${anchorPrefix}-first-request">Is ${label} good for a first request?</h3>
      <p>Yes, if the intended use is clear and the ${sourceTerm} are current, sharp, and permission-safe. If you are testing a dramatic change, start narrower so the first private gallery can show whether the direction deserves a larger credit spend.</p>
      <h3 id="${anchorPrefix}-source-count">How many ${sourceTerm} should I prepare?</h3>
      <p>Use enough images to show identity, angle, and expression without adding confusion. A small set of clear portraits usually beats a large group of old, filtered, or mixed-purpose images.</p>
      <h3 id="${anchorPrefix}-next-category">When should I choose another category instead?</h3>
      <p>Choose another category when the review criteria change. If ${label} is being judged by a different use case, style world, or motion need, split the work into a separate private job so credits support a clearer outcome.</p>
      <p>${closingLead}</p>
    `
  };
}

const mydreamshootsThemeArticles = [
  {
    label: "Creator",
    blogSlug: "/blog/creator-photo-package-guide",
    description: "Creator portraits, profile cards, product-style scenes, social cards, and private personal-brand albums.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-01.webp?v=20260715b",
    targetHref: "/collections/creator",
    examples: ["creator portraits", "profile cards", "product-style scenes", "social cards"],
    bestFor: "Use Creator when the finished images need to support a personal brand, creator profile, campaign draft, or social-facing album.",
    sourceFocus: "Prepare clear face photos plus one or two frames that show posture, shoulders, and the kind of outfit tone you want the creator set to follow.",
    reviewFocus: "Review crop variety, face consistency, personal-brand tone, and whether the images can work as headers, avatars, or social posts.",
    elementStory: "Creator images depend on recognizable personality cues: expression, gesture, color, and crop shape.",
    avoid: "Avoid mixing product lifestyle shots with unrelated portrait goals unless the request is explicitly about creator-commerce imagery."
  },
  {
    label: "Avatar",
    blogSlug: "/blog/avatar-photo-package-guide",
    description: "Stylized avatar, anime-inspired profile, and character-concept packages for playful private galleries.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/anime-avatar/anime-avatar-01.webp?v=20260715b",
    targetHref: "/collections/avatar",
    examples: ["anime avatars", "stylized profile icons", "character concepts", "playful social crops"],
    bestFor: "Use Avatar when the image can be more stylized than a normal portrait while still staying recognizable as the person.",
    sourceFocus: "Use sharp, recent portraits without heavy filters so the stylized result has a stable identity base before character details are added.",
    reviewFocus: "Review whether the avatar crop is readable, the style is intentional, and the face still feels connected to the source person.",
    elementStory: "Avatar sets lean on graphic shape, color mood, and expressive framing more than everyday realism.",
    avoid: "Avoid using avatar packages for official IDs, impersonation, or any use where a playful visual could be mistaken for a verified document."
  },
  {
    label: "Wedding",
    blogSlug: "/blog/wedding-photo-package-guide",
    description: "Wedding portraits, couple albums, save-the-date concepts, and announcement-ready visuals.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/wedding-portraits/wedding-portraits-01.webp?v=20260715b",
    targetHref: "/collections/wedding",
    examples: ["wedding portraits", "save-the-date concepts", "couple albums", "announcement visuals"],
    bestFor: "Use Wedding when the finished images need a romantic, announcement-ready, or keepsake mood for a couple or ceremony-inspired album.",
    sourceFocus: "Prepare clear portraits for each person and include simple notes about formal tone, outfit direction, and whether the set should feel quiet or celebratory.",
    reviewFocus: "Review both identities, shared expression, clothing lines, hand detail, and whether the mood feels suitable for a card or private keepsake.",
    elementStory: "Wedding images often work through soft light, paired posture, formal clothing cues, and a sense of occasion.",
    avoid: "Avoid mixing wedding, engagement, holiday card, and unrelated fashion goals in one request unless you want a broad test gallery."
  },
  {
    label: "Cultural",
    blogSlug: "/blog/cultural-wedding-photo-guide",
    description: "Indian and Desi Wedding-inspired portraits with respectful styling and private gallery delivery.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/desi-wedding/desi-wedding-01.webp?v=20260715b",
    targetHref: "/collections/cultural",
    examples: ["Indian wedding looks", "Desi wedding portraits", "formal celebration images", "private cultural keepsakes"],
    bestFor: "Use Cultural when the customer wants a celebration-inspired portrait direction with clear styling notes and careful private review.",
    sourceFocus: "Prepare current portraits and write respectful styling notes around outfit tone, color, formality, and album use without inventing personal traditions.",
    reviewFocus: "Review identity, styling fit, jewelry or fabric edges, hand detail, and whether the result feels respectful enough for the intended private use.",
    elementStory: "Color, formality, fabric shape, and ceremonial posture can carry emotional weight when the brief stays grounded in visible styling.",
    avoid: "Avoid claiming religious meaning, family history, or cultural details that were not supplied by the customer."
  },
  {
    label: "Couple",
    blogSlug: "/blog/couple-photo-package-guide",
    description: "Keepsake couple portraits, engagement concepts, Valentine visuals, and festive relationship keepsakes.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/engagement/engagement-01.webp?v=20260715b",
    targetHref: "/collections/couple",
    examples: ["couple portraits", "engagement concepts", "Valentine visuals", "relationship keepsakes"],
    bestFor: "Use Couple when the finished set should read as a shared portrait, private keepsake, or relationship announcement.",
    sourceFocus: "Use permission-safe photos for both people, ideally with clear faces and at least one frame that shows how they look together.",
    reviewFocus: "Review both identities, shared eye line, gesture, spacing, crop balance, and whether the image feels warm without becoming overly staged.",
    elementStory: "Couple images depend on spacing, matching light, paired expression, and small posture cues that make two people feel connected.",
    avoid: "Avoid uploading a second person's image without consent or asking one request to cover several unrelated relationship occasions."
  },
  {
    label: "Creative",
    blogSlug: "/blog/creative-photo-package-guide",
    description: "Cinematic worlds, noir portraits, cyberpunk scenes, gala looks, nature images, and editorial private albums.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/cyberpunk/cyberpunk-01.webp?v=20260715b",
    targetHref: "/collections/creative",
    examples: ["cyberpunk scenes", "noir portraits", "gala looks", "nature images"],
    bestFor: "Use Creative when the gallery can carry stronger mood, scene design, and dramatic styling than a work profile or simple social crop.",
    sourceFocus: "Start with stable identity photos, then add one clear story world such as neon city, formal night, outdoor portrait, or noir character mood.",
    reviewFocus: "Review whether the scene supports the person, whether the style is consistent, and whether artifacts appear around hair, hands, clothing, or background edges.",
    elementStory: "Creative sets are built from visible atmosphere: light, color contrast, wardrobe shape, scene texture, and cinematic framing.",
    avoid: "Avoid asking one request to combine several story worlds, because the private gallery becomes harder to judge."
  },
  {
    label: "Beauty",
    blogSlug: "/blog/beauty-style-photo-guide",
    description: "Hairstyle previews, try-on directions, soft glam portraits, and private style-planning galleries.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/hairstyle/hairstyle-01.webp?v=20260715b",
    targetHref: "/collections/beauty",
    examples: ["hairstyle previews", "virtual try-on looks", "soft glam portraits", "style-planning galleries"],
    bestFor: "Use Beauty when the customer wants to compare style direction, hair mood, makeup tone, or outfit framing in a private gallery.",
    sourceFocus: "Use current portraits with visible hairline, face shape, and natural lighting so style changes have a clear person to follow.",
    reviewFocus: "Review face consistency, hair edges, color tone, outfit lines, and whether the result is useful as a visual preview rather than a fit promise.",
    elementStory: "Beauty images often turn on texture, shine, silhouette, and color balance rather than a complex scene.",
    avoid: "Avoid medical, skin-care, or exact-fit claims; keep the article focused on visual planning and private review."
  },
  {
    label: "Sports",
    blogSlug: "/blog/sports-fan-photo-guide",
    description: "Personal fan portraits, match-day posters, profile avatars, and stadium-inspired images.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-01.webp?v=20260715b",
    targetHref: "/collections/sports",
    examples: ["fan portraits", "match-day posters", "profile avatars", "stadium-inspired images"],
    bestFor: "Use Sports when the finished images should feel like personal fan content, match-day profile material, or a private themed keepsake.",
    sourceFocus: "Use a clear portrait and describe fan mood, colors, crop need, and personal use without relying on official logos or player likenesses.",
    reviewFocus: "Review face consistency, poster crop, background energy, and whether the final image stays suitable for personal fan use.",
    elementStory: "Sports fan images work through color, stadium scale, match-day expression, and poster-style composition.",
    avoid: "Avoid official logos, player likenesses, or claims of affiliation unless the customer has the rights to use them."
  },
  {
    label: "Video",
    blogSlug: "/blog/video-photo-package-guide",
    description: "Motion-ready image frames and short-video add-on directions for private albums.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-01.webp?v=20260715b",
    targetHref: "/collections/video",
    examples: ["motion-ready frames", "image-to-video concepts", "profile clips", "album story videos"],
    bestFor: "Use Video when a finished image should become a short motion concept, profile clip, fan poster motion, or private album add-on.",
    sourceFocus: "Choose the clearest finished image or frame sequence, then define one movement idea such as slow camera drift, soft reveal, or profile clip pacing.",
    reviewFocus: "Review motion crop, face stability, hand and hair movement, background artifacts, and whether the clip still suits the original image use.",
    elementStory: "Video categories add time and pacing to a still image, so gesture, crop, and background rhythm matter.",
    avoid: "Avoid using a video request to solve source-photo problems that should be fixed before the frame is animated."
  },
  {
    label: "Utility",
    blogSlug: "/blog/utility-image-prep-guide",
    description: "Upscaling and image-prep packages for cleaner private gallery downloads.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/magic-upscaler/magic-upscaler-01.webp?v=20260715b",
    targetHref: "/collections/utility",
    examples: ["magic upscaling", "image prep", "cleaner downloads", "gallery finishing"],
    bestFor: "Use Utility when the main job is preparing, enlarging, or cleaning an image rather than changing the whole portrait style.",
    sourceFocus: "Start with the best available image and decide whether the goal is clarity, crop readiness, or download quality before spending credits.",
    reviewFocus: "Review edges, texture, face clarity, compression marks, and whether the final file is suitable for the place it will be used.",
    elementStory: "Utility work is quiet, but it protects the finished image by keeping detail, crop, and file quality readable.",
    avoid: "Avoid expecting a utility pass to invent missing identity detail from a weak source photo."
  },
  {
    label: "Headshots",
    blogSlug: "/blog/headshot-photo-package-guide",
    description: "Professional headshots for LinkedIn, resumes, teams, founders, and polished work profiles.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/professional-headshots/professional-headshots-01.webp?v=20260715b",
    targetHref: "/collections/headshots",
    examples: ["LinkedIn portraits", "resume photos", "founder profiles", "team-ready headshots"],
    bestFor: "Use Headshots when the finished images need to feel clear, restrained, current, and appropriate for work-facing profiles.",
    sourceFocus: "Use recent face-forward portraits with neutral lighting, readable hair and shoulders, and clothing that does not distract from the person.",
    reviewFocus: "Review expression, eye line, background restraint, crop, clothing edges, and whether the image feels professional at avatar size.",
    elementStory: "A good headshot is built from restraint: clean light, calm posture, simple background, and a readable expression.",
    avoid: "Avoid using headshot outputs for passports, official IDs, impersonation, or representing someone without permission."
  },
  {
    label: "Seasonal",
    blogSlug: "/blog/seasonal-photo-package-guide",
    description: "Holiday portraits, Christmas cards, festive social visuals, and private seasonal albums.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-01.webp?v=20260715b",
    targetHref: "/collections/seasonal",
    examples: ["holiday portraits", "Christmas cards", "festive social visuals", "seasonal private albums"],
    bestFor: "Use Seasonal when the finished set should carry a holiday, greeting-card, or festive keepsake mood.",
    sourceFocus: "Use clear portraits and name the season, card crop, warmth level, and whether the result is for one person, a couple, or a small group.",
    reviewFocus: "Review expression, seasonal props, card framing, hand detail, and whether the image feels personal rather than generic decoration.",
    elementStory: "Seasonal images use color, warmth, lights, clothing, and card-like framing to signal occasion.",
    avoid: "Avoid mixing several holidays or celebration types in one request unless the goal is a broad private test."
  }
].map((item) => makeCategoryArticle({
  sitePrefix: "site_dreamshoot",
  brand: "MyDreamShoots",
  kind: "theme",
  ...item
}));

const aidreamcapesThemeArticles = [
  {
    label: "Fan-Scene Albums",
    blogSlug: "/blog/private-fan-scene-album-photo-package-guide",
    description: "Private fan-scene album categories for original supporter moments, meetup-style portraits, photo walls, and keepsake cards.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/fan-scene-albums.webp?v=20260731assetfix1",
    targetHref: "/collections/fan-scene-albums",
    examples: ["private fan-scene albums", "backstage meetup portraits", "supporter photo walls", "fan keepsake card sets"],
    bestFor: "Use Fan-Scene Albums when the finished gallery should feel like an original supporter moment without copying real celebrities or official marks.",
    sourceFocus: "Prepare approved portraits, name the fan-scene mood, and note any people, logos, teams, events, or protected materials that must stay out.",
    reviewFocus: "Review identity, scene originality, permission boundaries, expression, and whether the private album feels celebratory without implying affiliation.",
    elementStory: "Fan-scene albums rely on spotlight mood, supporter color, private-event atmosphere, and careful boundaries around recognizable public material.",
    avoid: "Avoid asking for real celebrity recreation, official team branding, protected event marks, or photos you do not have permission to use."
  },
  {
    label: "Game-Day Group Portraits",
    blogSlug: "/blog/game-day-group-portraits-photo-package-guide",
    description: "Game-day group photo categories for arena-inspired portraits, stadium night sets, and watch party albums.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/game-day-group-photos.webp?v=20260731assetfix1",
    targetHref: "/collections/game-day-group-photos",
    examples: ["game-day group portraits", "stadium night fan sets", "watch party albums"],
    bestFor: "Use Game-Day Group Portraits when the gallery needs supporter energy, group composition, and arena-like atmosphere without official branding.",
    sourceFocus: "Use clear approved portraits for each person and describe colors, celebration level, crop needs, and any team or event marks to avoid.",
    reviewFocus: "Review each face, group spacing, hand detail, background energy, and whether the result stays identity-safe and brand-safe.",
    elementStory: "Game-day portraits work through crowd energy, light flare, poster crop, group gesture, and color hints that do not depend on logos.",
    avoid: "Avoid official logos, real athlete likenesses, protected event names, or a crowded prompt that makes group identity hard to review."
  },
  {
    label: "Premiere-Inspired Portrait Sets",
    blogSlug: "/blog/premiere-flash-portraits-photo-package-guide",
    description: "Premiere-inspired categories for flash portraits, VIP arrivals, and award-night private albums.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/premiere-style-portraits.webp?v=20260731assetfix1",
    targetHref: "/collections/premiere-style-portraits",
    examples: ["premiere flash portraits", "VIP arrival photo sets", "award night keepsake albums"],
    bestFor: "Use Premiere-Inspired Portrait Sets when the private gallery should feel polished, formal, and event-ready without copying public figures.",
    sourceFocus: "Prepare clear portraits plus outfit and formality notes, then keep the brief focused on original arrival energy and camera-flash mood.",
    reviewFocus: "Review face consistency, formal styling, flash balance, background restraint, and whether the gallery avoids celebrity or brand confusion.",
    elementStory: "Premiere-style images use flash, dark venue contrast, formal posture, and arrival framing to create a private VIP mood.",
    avoid: "Avoid requesting a real public figure, protected red-carpet branding, official event marks, or a look that implies endorsement."
  },
  {
    label: "Christmas Holiday Albums",
    blogSlug: "/blog/christmas-group-album-photo-package-guide",
    description: "Christmas holiday album categories for group cards, cozy portraits, and winter fan greeting albums.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/christmas-holiday-albums.webp?v=20260731assetfix1",
    targetHref: "/collections/christmas-holiday-albums",
    examples: ["Christmas group albums", "cozy card portrait sets", "winter fan greeting albums"],
    bestFor: "Use Christmas Holiday Albums when the finished gallery should feel warm, greeting-card ready, and private enough for family or fan keepsakes.",
    sourceFocus: "Use approved portraits and note card crop, warmth level, group size, winter details, and any protected decorations or characters to avoid.",
    reviewFocus: "Review each face, card framing, seasonal props, hand detail, and whether the image feels personal rather than generic holiday decor.",
    elementStory: "Christmas holiday albums depend on warm light, card composition, winter texture, small gestures, and safe seasonal styling.",
    avoid: "Avoid protected characters, branded decorations, unapproved group photos, or mixing too many holiday scenes into one request."
  },
  {
    label: "Thanksgiving Keepsake Sets",
    blogSlug: "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
    description: "Thanksgiving keepsake categories for table scenes, gratitude portraits, and Friendsgiving memory sets.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/thanksgiving-memory-sets.webp?v=20260731assetfix1",
    targetHref: "/collections/thanksgiving-memory-sets",
    examples: ["Thanksgiving table keepsakes", "gratitude group portraits", "Friendsgiving memory sets"],
    bestFor: "Use Thanksgiving Keepsake Sets when the private album should feel warm, grateful, group-friendly, and suitable for seasonal sharing.",
    sourceFocus: "Prepare approved portraits and describe table light, group size, card use, outfit tone, and any family details that should stay private.",
    reviewFocus: "Review group identity, expression, table or room details, crop warmth, and whether the gallery respects private context.",
    elementStory: "Thanksgiving sets are carried by table light, shared posture, warm color, subtle seasonal detail, and private-album restraint.",
    avoid: "Avoid inventing family relationships, using unapproved group photos, or overloading the request with several holidays at once."
  },
  {
    label: "Halloween Party Portraits",
    blogSlug: "/blog/halloween-party-portrait-set-photo-package-guide",
    description: "Halloween party portrait categories for costume-friendly albums, party scenes, and cast-style private galleries.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/halloween-party-portraits.webp?v=20260731assetfix1",
    targetHref: "/collections/halloween-party-portraits",
    examples: ["Halloween party portrait sets", "costume cast photo albums", "spooky fan card portraits"],
    bestFor: "Use Halloween Party Portraits when the gallery can be playful, moody, and costume-friendly while staying original and permission-safe.",
    sourceFocus: "Use clear approved portraits, name the costume mood in general terms, and avoid protected characters, masks, or branded costume details.",
    reviewFocus: "Review face visibility, costume originality, party lighting, hand detail, and whether the mood stays fun without becoming a trademark copy.",
    elementStory: "Halloween portraits use color, shadow, costume shape, group energy, and original party atmosphere to carry the theme.",
    avoid: "Avoid protected characters, branded costumes, gore-heavy prompts, or anything that hides identity so much the private gallery is hard to review."
  },
  {
    label: "Seasonal Celebration Photos",
    blogSlug: "/blog/seasonal-celebration-photo-set-photo-package-guide",
    description: "Seasonal celebration categories for birthdays, New Year countdowns, family occasions, and rotating private albums.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/seasonal-celebration-photos.webp?v=20260731assetfix1",
    targetHref: "/collections/seasonal-celebration-photos",
    examples: ["birthday fan moment sets", "New Year countdown albums", "family occasion portraits"],
    bestFor: "Use Seasonal Celebration Photos when the event is specific but does not fit only Christmas, Thanksgiving, Halloween, or game-day categories.",
    sourceFocus: "Prepare approved portraits, name the occasion, choose the card or album use, and keep fan or family references permission-safe.",
    reviewFocus: "Review event clarity, expression, crop, source-photo identity, and whether the finished images match the intended private use.",
    elementStory: "Seasonal celebration images work through occasion cues: countdown light, birthday warmth, family-card framing, and private keepsake polish.",
    avoid: "Avoid vague celebration prompts, protected brand references, or mixing unrelated occasions that need separate review criteria."
  }
].map((item) => makeCategoryArticle({
  sitePrefix: "site_aidreamcapes",
  brand: "Aidreamcapes",
  kind: "theme",
  ...item
}));

const sourceState = JSON.parse(fs.readFileSync(statePath, "utf8"));

function slugifySegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function activeItems(state, key, siteId) {
  return (state[key] ?? []).filter((item) => item.siteId === siteId && item.status === "active");
}

const blogCoverageExclusions = {
  site_dreamshoot: {
    creativeCategorySlugs: new Set(["travel-scene-pack"]),
    videoCategorySlugs: new Set(["travel-story"])
  }
};

function isExcludedBlogCoverage(siteId, kind, slug) {
  const exclusions = blogCoverageExclusions[siteId];
  if (!exclusions) return false;
  if (kind === "creative-category") return exclusions.creativeCategorySlugs.has(slug);
  if (kind === "video-category") return exclusions.videoCategorySlugs.has(slug);
  return false;
}

function articleSlugs(articles) {
  return new Set(articles.map((article) => article.slug));
}

function compactList(items, fallback) {
  const values = Array.from(new Set(items.map((item) => String(item ?? "").trim()).filter(Boolean)));
  return values.length ? values.slice(0, 4) : [fallback];
}

function defaultSiteImage(brand) {
  return brand === "Aidreamcapes"
    ? "/assets/sites/site_aidreamcapes/fan-holiday-theme/showcase/fan-scene-albums.webp"
    : "/assets/dreamshoot/generated/20260622-homepage-unique/hero-package-wall.webp";
}

const mydreamshootsBlogSafeImageOverrides = new Map([
  ["holiday", "/assets/dreamshoot/generated/homepage-showcase/images/holiday.webp?v=20260803blogsafe1"],
  ["magic-upscaler", "/assets/dreamshoot/generated/20260622-pack-fill/magic-upscaler-pack.webp?v=20260803blogsafe1"]
]);

function publicAssetExists(imageUrl) {
  const pathname = imagePathnameForUrl(imageUrl);
  if (!pathname.startsWith("/assets/")) return false;
  return fs.existsSync(path.join(process.cwd(), "public", decodeURIComponent(pathname).replace(/^\/+/, "")));
}

function mydreamshootsBlogGalleryImage(slug) {
  const imageUrl = `/assets/dreamshoot/generated/pack-galleries/${slug}/${slug}-01.webp?v=20260715b`;
  return publicAssetExists(imageUrl) ? imageUrl : "";
}

function blogSafeImageUrlForPack({ brand, slug, pack, category, parent }) {
  if (brand !== "MyDreamShoots") {
    return pack.imageUrl || category?.imageUrl || parent?.imageUrl || defaultSiteImage(brand);
  }
  const override = mydreamshootsBlogSafeImageOverrides.get(slug);
  if (override && publicAssetExists(override)) return override;
  const galleryImage = mydreamshootsBlogGalleryImage(slug);
  if (galleryImage) return galleryImage;
  return category?.imageUrl || pack.imageUrl || parent?.imageUrl || defaultSiteImage(brand);
}

function makeCreativeCategoryArticle(state, siteId, brand, category, parent, packs) {
  const label = category.label || category.slug;
  const parentLabel = parent?.label || "the main catalog";
  const examples = compactList([
    ...packs.map((pack) => pack.name || pack.category),
    label,
    parentLabel
  ], label);
  const routeNoun = brand === "Aidreamcapes" ? "private album" : "private gallery";
  return makeCategoryArticle({
    sitePrefix: siteId,
    brand,
    kind: "theme",
    label,
    blogSlug: `/blog/${slugifySegment(category.slug || label)}-photo-package-guide`,
    description: category.description || `${label} sits under ${parentLabel} and gives shoppers a narrower ${routeNoun} direction to compare before spending credits.`,
    imageUrl: category.imageUrl || packs.find((pack) => pack.imageUrl)?.imageUrl || parent?.imageUrl || defaultSiteImage(brand),
    imageAlt: `${brand} ${label} package category cover`,
    targetLabel: `Open ${label} package`,
    targetHref: `/collections/${slugifySegment(category.slug || label)}`,
    examples,
    bestFor: `Use ${label} when ${parentLabel} is the right broad direction but the next ${routeNoun} needs a more specific mood, format, or use case.`,
    sourceFocus: brand === "Aidreamcapes"
      ? `Prepare clear source portraits, then add one album cue that matches ${label}: light, scene texture, season, outfit tone, or album format.`
      : `Prepare clear source photos, then add one style cue that matches ${label}: expression, outfit tone, background mood, crop need, or final use.`,
    reviewFocus: `Review whether the finished images match ${label} instead of drifting back into a generic ${parentLabel} result.`,
    elementStory: `${label} should have visible cues that explain the category choice: color, posture, crop, scene texture, styling, or movement readiness.`,
    avoid: `Avoid treating ${label} as interchangeable with every nearby ${parentLabel} option; a narrower category should make the review criteria clearer.`,
    seoTitle: searchFriendlySeoTitle(label, brand),
    seoDescription: `Plan ${label} in ${brand}: choose inputs, compare nearby packages, review credit cost, and check the private gallery before downloads.`,
    seoKeywords: `${label}, ${brand} ${parentLabel}, AI photo package guide, private gallery planning, credit review`
  });
}

function numericSortValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function dateSortValue(value) {
  const timestamp = new Date(value ?? "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function packCategoryContext(pack, categoriesById) {
  const category = pack.categoryRecord ?? categoriesById.get(pack.categoryId);
  const parent = category?.parent ?? (category?.parentId ? categoriesById.get(category.parentId) : undefined);
  return { category, parent };
}

function buildCreativePackCoverageArticles(state, siteId, brand) {
  const categories = activeItems(state, "creativePackCategories", siteId);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const packs = activeItems(state, "creativePacks", siteId);
  return packs
    .slice()
    .sort((left, right) => {
      const leftContext = packCategoryContext(left, categoriesById);
      const rightContext = packCategoryContext(right, categoriesById);
      return numericSortValue(leftContext.parent?.sortOrder) - numericSortValue(rightContext.parent?.sortOrder) ||
        numericSortValue(leftContext.category?.sortOrder) - numericSortValue(rightContext.category?.sortOrder) ||
        dateSortValue(left.createdAt) - dateSortValue(right.createdAt) ||
        String(left.name ?? "").localeCompare(String(right.name ?? ""));
    })
    .map((pack) => {
      const { category, parent } = packCategoryContext(pack, categoriesById);
      const label = pack.name || category?.label || pack.category || "Photo package";
      const slug = slugifySegment(label);
      const categoryLabel = category?.label || pack.category || label;
      const parentLabel = parent?.label || categoryLabel || "fan and holiday albums";
      const examples = compactList([label, categoryLabel, parentLabel], label);
      const targetHref = `/collections/${slug}`;
      return makeCategoryArticle({
        sitePrefix: siteId,
        brand,
        kind: "theme",
        label,
        blogSlug: `/blog/${slug}-photo-package-guide`,
        description: pack.description || pack.headline || `${label} gives shoppers a focused ${parentLabel} direction to compare before starting a private album.`,
        imageUrl: blogSafeImageUrlForPack({ brand, slug, pack, category, parent }),
        imageAlt: `${brand} ${label} theme cover`,
        targetLabel: `Open ${label} theme`,
        targetHref,
        examples,
        bestFor: `Use ${label} when ${parentLabel} is the right broad direction and the private album needs the specific look, scene, or keepsake format described by ${categoryLabel}.`,
        sourceFocus: `Prepare clear approved source portraits, then add one cue that belongs to ${label}: light, scene texture, outfit tone, occasion, group size, or card-ready crop.`,
        reviewFocus: `Review whether the finished images look like ${label} instead of drifting into a generic ${parentLabel} album.`,
        elementStory: `${label} should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy, or private keepsake mood.`,
        avoid: `Avoid asking ${label} to cover several unrelated fan, game-day, premiere, or holiday scenes at once; the narrower theme should make review easier.`,
        seoTitle: searchFriendlySeoTitle(label, brand),
        seoDescription: `Plan ${label} in ${brand}: choose approved portraits, compare fit, review credit cost, and open the private gallery before downloads.`,
        seoKeywords: `${label}, ${brand} ${categoryLabel}, ${parentLabel}, private album guide, credit review`
      });
    });
}

function buildCreativeCategoryCoverageArticles(state, siteId, brand, existingArticles) {
  const existing = articleSlugs(existingArticles);
  const existingTargets = new Set(existingArticles.map((article) => article.targetHref).filter(Boolean));
  const categories = activeItems(state, "creativePackCategories", siteId);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const packs = activeItems(state, "creativePacks", siteId);
  return categories
    .filter((category) => !isExcludedBlogCoverage(siteId, "creative-category", category.slug))
    .filter((category) => !category.parentId)
    .map((category) => {
      const parent = category.parentId ? byId.get(category.parentId) : undefined;
      const categoryPacks = packs.filter((pack) => pack.categoryId === category.id || pack.category === category.slug);
      return makeCreativeCategoryArticle(state, siteId, brand, category, parent, categoryPacks);
    })
    .filter((article) => !existing.has(article.slug) && !existingTargets.has(article.targetHref));
}

function buildCoverageArticles(state, siteId, brand, existingArticles) {
  const articles = [
    ...buildCreativeCategoryCoverageArticles(state, siteId, brand, existingArticles)
  ];
  const seen = new Set(existingArticles.map((article) => article.slug));
  return articles.filter((article) => {
    if (seen.has(article.slug)) return false;
    seen.add(article.slug);
    return true;
  });
}

function imagePathnameForUrl(imageUrl) {
  return new URL(String(imageUrl ?? ""), "https://local.invalid").pathname;
}

function normalizedImageUrlForUniqueness(imageUrl) {
  return decodeURIComponent(imagePathnameForUrl(imageUrl)).replace(/\/+/g, "/").toLowerCase();
}

function imageFilePathForUrl(imageUrl) {
  return path.join(process.cwd(), "public", decodeURIComponent(imagePathnameForUrl(imageUrl)).replace(/^\/+/, ""));
}

function imageShaForUrl(imageUrl) {
  const filePath = imageFilePathForUrl(imageUrl);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Blog cover image is missing from public assets: ${imageUrl}`);
  }
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function assertUniqueArticleCovers(config) {
  const seenUrls = new Map();
  const seenShas = new Map();
  for (const article of config.articles) {
    if (!article.imageUrl) {
      throw new Error(`${config.slug}${article.slug} is missing imageUrl`);
    }
    const normalizedUrl = normalizedImageUrlForUniqueness(article.imageUrl);
    const previousUrlArticle = seenUrls.get(normalizedUrl);
    if (previousUrlArticle) {
      throw new Error(`${config.slug} blog cover URL reused by ${previousUrlArticle} and ${article.slug}: ${normalizedUrl}`);
    }
    seenUrls.set(normalizedUrl, article.slug);

    const imageSha = imageShaForUrl(article.imageUrl);
    const previousShaArticle = seenShas.get(imageSha);
    if (previousShaArticle) {
      throw new Error(`${config.slug} blog cover file reused by ${previousShaArticle} and ${article.slug}: ${normalizedUrl}`);
    }
    seenShas.set(imageSha, article.slug);
  }
}

const siteConfigs = [
  {
    slug: "mydreamshoots",
    siteId: "site_dreamshoot",
    brand: "MyDreamShoots",
    coverageMode: "creative-packs",
    blogTitle: "Guides",
    footerLabel: "Blog",
    guideType: "AI photo guide",
    homeIntroTitle: "AI photo guides for better source photos, credits, and private albums.",
    homeIntroBody:
      "Use these MyDreamShoots guides to choose source photos, compare package fit, understand credits, and review finished images inside a private gallery.",
    homeListTitle: "AI photo guides",
    homeListBody:
      "Practical guidance for source-photo preparation, package planning, visible credits, private gallery delivery, and stronger AI portrait results.",
    relatedTitle: "Related guides",
    relatedBody:
      "Read more about source photos, package selection, credit planning, private albums, and delivery review before starting another AI photo set.",
    homeSeo: {
      title: "MyDreamShoots Guides for AI photo packages and private albums",
      description:
        "Read MyDreamShoots guides for source photos, AI photo package planning, visible credits, private galleries, downloads, and delivery review.",
      keywords:
        "AI photo guides, source photo tips, AI photo packages, private AI gallery, MyDreamShoots credits"
    },
    articles: [
      {
        id: "site_dreamshoot_blog_detail",
        slug: "/blog/preparing-source-photos",
        pageTitle: "Preparing source photos",
        title: "How to prepare source photos for cleaner AI photo packages",
        summary:
          "A practical guide to choosing the selfies, angles, lighting, wardrobe variety, and permission checks that help MyDreamShoots produce cleaner private photo sets.",
        author: "MyDreamShoots editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "7",
        imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-before-upload.webp",
        imageAlt: "Private source photo upload workspace for MyDreamShoots",
        tags: "Source photos|AI portraits|Photo packages|Private albums",
        primaryCta: "Create my first photo set",
        primaryHref: "/login",
        secondaryCta: "Compare packages",
        secondaryHref: "/collections",
        seoTitle: "How to prepare source photos for better AI photo packages",
        seoDescription:
          "Learn how to choose selfies, lighting, angles, wardrobe variety, and permission-safe uploads before starting MyDreamShoots AI photo packages.",
        seoKeywords:
          "source photos for AI portraits, AI photo package tips, selfie upload guide, private AI photo gallery",
        body: html`
          <p>Better AI photo results usually start with calmer inputs. MyDreamShoots can follow a package direction more reliably when the source photos show the person clearly, from a few natural angles, without filters that hide face shape, hairline, skin tone, or expression.</p>
          <h2 id="what-the-generator-needs">What the generator needs from you</h2>
          <p>Use source photos that show the same person in simple lighting. A good set includes one close portrait, one half-body frame, one relaxed expression, and one different angle. The goal is not a perfect studio shoot. The goal is enough consistent information for the private request to understand identity before it builds a new scene.</p>
          <h2 id="choose-clear-inputs">Choose clear inputs before stylish ones</h2>
          <p>Start with sharp, recent images where the face is visible and the background is not competing for attention. Avoid heavy beauty filters, extreme crops, sunglasses, busy group photos, and pictures where the face is partly covered. A stylish photo can be useful later, but a clear photo should lead the set.</p>
          <h2 id="add-range-without-confusion">Add range without confusing the brief</h2>
          <p>Variation helps when it stays organized. Include different expressions, lighting, and camera distances, but avoid mixing many hairstyles, costume changes, or old photos from different life stages in the same request. If you want a new hairstyle, fantasy scene, fan poster, or business headshot, let the package brief carry the change instead of forcing every source image to show a different version of you.</p>
          <h2 id="match-the-package-outcome">Match photos to the package outcome</h2>
          <p>Professional headshot packages benefit from clean face detail and neutral clothing. Creator portraits can use more personality, gestures, and outfit notes. Fan posters and cinematic worlds can handle stronger mood references, but still need a stable identity base. When in doubt, choose the photos that make the person easiest to recognize.</p>
          <h2 id="keep-permissions-simple">Keep privacy and permissions simple</h2>
          <p>Only upload photos you own or have permission to use. If the package involves another person, make sure they expect their image to be used in a private AI photo workflow. Finished results stay tied to the signed-in MyDreamShoots account, where you can review, download, and decide what belongs outside the private gallery.</p>
          <h2 id="source-photo-checklist">Source-photo checklist</h2>
          <table><thead><tr><th>Check</th><th>Why it matters</th></tr></thead><tbody><tr><td>Recent, sharp portraits</td><td>Helps the result preserve identity and current details.</td></tr><tr><td>Natural expressions</td><td>Gives packages more usable options for professional, social, or cinematic scenes.</td></tr><tr><td>Simple lighting</td><td>Reduces shadows and color shifts before generation begins.</td></tr><tr><td>Permission-safe uploads</td><td>Keeps private albums and account records easier to manage.</td></tr></tbody></table>
          <h2 id="mistakes-that-lower-result-quality">Mistakes that lower result quality</h2>
          <p>The weakest source sets usually have the same pattern: one very polished selfie, one filtered social post, and several photos where the face is small or turned away. That combination asks the system to guess too much. It may still produce attractive images, but the person can drift between outputs because the identity evidence is uneven.</p>
          <p>Another common issue is mixing different life stages in one upload. A current photo, an older casual photo, and a heavily edited formal image can all be meaningful to the customer, but they are not equally useful for generation. If your goal is a photo package that looks like you now, make the current images the base set.</p>
          <h2 id="how-many-photos-to-upload">How many photos should you upload?</h2>
          <p>More photos are not automatically better. A smaller group of clear, consistent portraits usually beats a large folder of mixed screenshots. For a first MyDreamShoots set, think in terms of coverage: front-facing, slight side angle, different expression, and one frame that shows hair and shoulders clearly. If a photo repeats the same angle and lighting as another, keep the sharper one.</p>
          <h2 id="source-photo-faq">Source photo FAQ</h2>
          <h3 id="can-i-use-phone-selfies">Can I use phone selfies?</h3>
          <p>Yes. Phone selfies can work well when they are sharp, recent, and naturally lit. The main thing to avoid is a selfie that has been softened by filters or compressed through multiple apps before upload.</p>
          <h3 id="should-i-upload-professional-photos">Should I upload professional photos?</h3>
          <p>Professional portraits can help if they still look like the person and do not rely on extreme retouching. A clean studio photo is useful for headshots, while relaxed everyday photos often help lifestyle and creator packages feel more natural.</p>
          <h3 id="what-if-i-want-a-different-style">What if I want a different hairstyle or outfit?</h3>
          <p>Use source photos for identity and use the package choice or style notes for transformation. If every source photo shows a different hairstyle, the request has less stable information to follow.</p>
          <p>Once the source set is ready, compare the package direction and visible credit cost before generation. That small pause is often what turns a random upload into a cleaner finished gallery.</p>
        `
      },
      {
        id: "site_dreamshoot_blog_choose_packages",
        slug: "/blog/choosing-ai-photo-packages",
        pageTitle: "Choosing AI photo packages",
        title: "How to choose the right AI photo package before spending credits",
        summary:
          "Use the final use case, source-photo needs, style risk, output count, and visible credit cost to decide which MyDreamShoots package belongs in your next private set.",
        author: "MyDreamShoots editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "6",
        imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-package-wall.webp",
        imageAlt: "MyDreamShoots package wall with AI portrait styles",
        tags: "Photo packages|Credits|Portrait planning|Private workflow",
        primaryCta: "Compare packages",
        primaryHref: "/collections",
        secondaryCta: "View pricing",
        secondaryHref: "/pricing",
        targetLabel: "Browse photo packages",
        targetHref: "/collections",
        seoTitle: "How to choose AI photo packages before spending credits",
        seoDescription:
          "Compare MyDreamShoots AI photo packages by final use, source-photo fit, style risk, output needs, private delivery, and visible credit cost.",
        seoKeywords:
          "AI photo packages, choose AI portraits, photo package credits, MyDreamShoots package guide",
        body: html`
          <p>Choosing a package is easier when you start with the job the images need to do. A headshot, a creator profile, a fan poster, and a cinematic portrait can all use the same account credits, but they ask different things from your source photos and your review process.</p>
          <h2 id="start-with-final-use">Start with the final use</h2>
          <p>Pick the package that matches where the finished images will live. LinkedIn-style portraits need clarity and restraint. Social profile sets can use stronger expression and crop variety. Holiday cards, fan posters, and cinematic scenes can carry more atmosphere because the final image is meant to feel themed.</p>
          <h2 id="compare-source-photo-needs">Compare source-photo needs</h2>
          <p>If you only have a few clean selfies, start with a package that does not depend on complex poses or dramatic costumes. If you have several clear angles, you can choose a more expressive package because the workflow has more identity context to work from.</p>
          <h2 id="check-credit-cost">Check the credit cost before generation</h2>
          <p>MyDreamShoots shows the credit cost before a private job starts. Use that moment to decide whether you want a focused set now or a broader gallery later. If you are testing a new look, a smaller package can help you learn what works before spending more credits on a larger album.</p>
          <h2 id="decide-how-much-style-risk">Decide how much style risk you want</h2>
          <p>Cleaner professional packages usually carry less visual risk because the scene is restrained. Fantasy, sports, event, and cinematic packages can be more dramatic, which also means you should review outputs carefully before using them publicly. Choose the package that matches your comfort with transformation.</p>
          <h2 id="decide-where-the-photos-will-be-used">Decide where the photos will be used</h2>
          <p>A package feels easier to judge when you name the final use for the finished images. A resume portrait needs a calmer crop and a face-forward expression. A creator profile can accept more gesture, color, and crop variety. A fan poster or holiday scene can be judged by mood, but it still needs enough identity consistency that friends recognize the person without reading the caption.</p>
          <p>Write the intended use in plain language before choosing the package. "Three profile options for LinkedIn" leads to a different choice than "a private album of cinematic portraits for a birthday surprise." That short sentence helps you avoid buying a style because it looks exciting while missing the use case that actually matters.</p>
          <h2 id="quick-comparison">Quick comparison</h2>
          <table><thead><tr><th>Package goal</th><th>Best source-photo match</th><th>Review focus</th></tr></thead><tbody><tr><td>Professional headshots</td><td>Clear face detail, neutral clothing, low visual clutter.</td><td>Identity, crop, expression, and background restraint.</td></tr><tr><td>Creator portraits</td><td>Several expressions, some outfit variety, natural body posture.</td><td>Personality, usable crops, and social profile fit.</td></tr><tr><td>Themed albums</td><td>Stable identity photos plus one clear mood direction.</td><td>Scene consistency, costume fit, and artifact checks.</td></tr><tr><td>Small test set</td><td>Your sharpest two or three current portraits.</td><td>Whether the direction is worth a larger credit spend.</td></tr></tbody></table>
          <h2 id="use-related-guides">Use related guides as planning tools</h2>
          <p>Before starting, read source-photo guidance and private gallery notes. Then open <a href="/collections">packages</a> and compare the package description, credit cost, and intended output. That creates a simple decision path: purpose first, source-photo fit second, credits third.</p>
          <h2 id="package-choice-framework">A simple package-choice framework</h2>
          <ul><li><strong>Need one polished identity look?</strong> Choose headshots or profile portraits.</li><li><strong>Need expressive social content?</strong> Choose creator, lifestyle, beauty, or themed album sets.</li><li><strong>Need a specific event mood?</strong> Choose holiday, sports, wedding, fan, or cinematic packages.</li><li><strong>Need to test first?</strong> Start smaller, review privately, then spend more credits when the direction is clear.</li></ul>
          <h2 id="package-planning-faq">Package planning FAQ</h2>
          <h3 id="should-i-start-with-the-cheapest-package">Should I start with the smallest package?</h3>
          <p>Start small when you are testing a new look, a new source-photo set, or a dramatic style. Choose a larger package when the intended use is clear and you already know the source photos represent you well.</p>
          <h3 id="how-do-i-avoid-wasting-credits">How do I avoid wasting credits?</h3>
          <p>Check three things before generation: whether the package matches the final use, whether the source photos are clear enough, and whether the visible credit cost feels right for the number of images you expect to review.</p>
          <h3 id="can-one-package-cover-every-style">Can one package cover every style?</h3>
          <p>Usually no. A focused package creates a cleaner gallery. If you want professional headshots and cinematic posters, treat them as separate requests so each set has a clear visual job.</p>
          <p>The best package is not always the biggest one. It is the one that fits your source photos, your intended use, and the amount of review you want before downloading favorites.</p>
        `
      },
      {
        id: "site_dreamshoot_blog_gallery_credits",
        slug: "/blog/private-gallery-and-credits-guide",
        pageTitle: "Private gallery and credits guide",
        title: "Private galleries, credits, and downloads: what to check after generation",
        summary:
          "Understand how MyDreamShoots customers review finished images, track credit use, compare outputs, and keep private albums organized after generation.",
        author: "MyDreamShoots editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "6",
        imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-private-album-workspace.webp",
        imageAlt: "MyDreamShoots private gallery workspace for reviewing generated images",
        tags: "Private gallery|Credits|Downloads|Account workflow",
        primaryCta: "Open my studio",
        primaryHref: "/login",
        secondaryCta: "View pricing",
        secondaryHref: "/pricing",
        targetLabel: "View pricing",
        targetHref: "/pricing",
        seoTitle: "MyDreamShoots private gallery, credits, and download guide",
        seoDescription:
          "Learn how MyDreamShoots private galleries, credit history, generation review, downloads, and account-scoped albums work after AI photo delivery.",
        seoKeywords:
          "private AI gallery, MyDreamShoots credits, AI photo downloads, generated photo review",
        body: html`
          <p>Generation is only one part of the customer workflow. After a private job finishes, the gallery helps you compare images, download favorites, and understand how credits moved through the request.</p>
          <h2 id="where-finished-images-land">Where finished images land</h2>
          <p>Finished MyDreamShoots images return to the signed-in account that started the job. Keeping outputs account-scoped makes it easier to review a set later, revisit downloads, and separate personal albums from public sharing choices.</p>
          <h2 id="how-credit-history-stays-readable">How credit history stays readable</h2>
          <p>Credits are designed to be visible before generation begins. A request may reserve credits while it runs, settle them after successful delivery, or release them when a failed request cannot complete. Reviewing account history helps you connect a finished album to the package that created it.</p>
          <p>That record is also useful when several people in the same household are comparing different looks. The gallery title, package choice, and credit movement give each set a simple paper trail, so a test run does not get confused with a polished request you meant to download later.</p>
          <h2 id="review-before-sharing">Review before sharing</h2>
          <p>Look at face consistency, hand detail, background artifacts, crop quality, and whether the scene matches the package promise. Some images may be better for profile use, while others work better as private keepsakes or social drafts.</p>
          <p>For public-facing downloads, also test the image at the size where it will actually appear. A portrait that looks strong in the gallery may reveal edge artifacts once cropped into a small avatar, while a quieter frame can work better for a resume, booking profile, or team page because the face stays readable.</p>
          <h2 id="organize-downloads">Organize downloads by purpose</h2>
          <p>Download favorites into folders that match their use: profile, professional, holiday, creator, event, or archive. This small habit helps you avoid mixing experimental images with polished images you plan to use publicly.</p>
          <h2 id="when-to-run-another-set">When to run another set</h2>
          <p>Start another request when the first gallery shows a clear direction to improve. If expressions are strong but lighting feels off, adjust package mood or source-photo notes. If identity is inconsistent, improve the source photo set before spending more credits.</p>
          <h2 id="turn-gallery-review-into-feedback">Turn gallery review into feedback</h2>
          <p>A useful gallery review is specific. Instead of deciding that a set is simply good or bad, note what worked: the best lighting, the strongest expression, the most believable crop, and the package mood that felt closest to the goal. Then note what should change before another request. Maybe the next set needs clearer source photos, fewer dramatic costume cues, or a tighter brief around professional use.</p>
          <p>This record does not need a formal spreadsheet. A few notes beside the downloaded favorites are enough. The point is to make the next credit spend more informed than the last one, especially when you are testing a new visual direction.</p>
          <h2 id="what-to-check-before-downloading">What to check before downloading favorites</h2>
          <table><thead><tr><th>Review point</th><th>What to look for</th><th>What to do next</th></tr></thead><tbody><tr><td>Identity</td><td>The face should feel consistent across the best images.</td><td>If it drifts, improve source-photo clarity before another run.</td></tr><tr><td>Hands and edges</td><td>Check fingers, hair edges, glasses, jewelry, and clothing lines.</td><td>Use cleaner crops publicly and keep experiments private.</td></tr><tr><td>Scene promise</td><td>The image should match the package mood you selected.</td><td>If the mood is close but not exact, refine the next brief.</td></tr><tr><td>Download use</td><td>Profile crops need different checks than keepsake images.</td><td>Save separate folders for profile, social, archive, and tests.</td></tr></tbody></table>
          <h2 id="private-gallery-checklist">Private gallery checklist</h2>
          <ul><li>Confirm the finished set belongs to the right account.</li><li>Review identity, crop, and background quality before downloading.</li><li>Check credit movement in account history.</li><li>Save public-use favorites separately from experiments.</li><li>Use what you learned before choosing the next package.</li></ul>
          <h2 id="private-gallery-faq">Private gallery FAQ</h2>
          <h3 id="are-finished-images-public">Are finished images public by default?</h3>
          <p>No. The article flow is built around account-scoped review. You decide which downloads are suitable for public profiles, social posts, or private keepsakes.</p>
          <h3 id="why-does-credit-history-matter">Why does credit history matter?</h3>
          <p>Credit history helps connect a finished album to the package and generation request that produced it. That is useful when comparing tests, planning a second pass, or reviewing billing questions.</p>
          <h3 id="what-should-i-do-with-imperfect-results">What should I do with imperfect results?</h3>
          <p>Do not treat every output as a final image. Use imperfect frames as feedback: they can show whether the next request needs clearer source photos, a calmer package, or a more specific style note.</p>
          <p>A private gallery is most useful when it becomes a review space, not just a download folder. Treat each set as feedback for the next one.</p>
        `
      },
      ...mydreamshootsThemeArticles
    ]
  },
  {
    slug: "aidreamcapes",
    siteId: "site_aidreamcapes",
    brand: "Aidreamcapes",
    coverageMode: "creative-packs",
    blogTitle: "Field Notes",
    footerLabel: "Blog",
    guideType: "Fan and holiday guide",
    homeIntroTitle: "Fan and holiday field notes for better private albums.",
    homeIntroBody:
      "Use Aidreamcapes Field Notes to plan source portraits, fan-scene references, holiday album briefs, visible credits, and private gallery review.",
    homeListTitle: "Aidreamcapes fan and holiday guides",
    homeListBody:
      "Field Notes for source portraits, fan-scene moods, holiday references, credit planning, private delivery, and more intentional AI private albums.",
    relatedTitle: "More field notes",
    relatedBody:
      "Continue with guides on source portraits, fan-scene references, holiday planning, credit planning, and private album review.",
    homeSeo: {
      title: "Aidreamcapes Field Notes for private fan and holiday albums",
      description:
        "Read Aidreamcapes Field Notes for source portraits, fan-scene references, holiday album briefs, visible credits, and private gallery delivery.",
      keywords:
        "fan-scene references, holiday album planning, private gallery credits, Aidreamcapes",
      ogImage: "/assets/sites/site_aidreamcapes/fan-holiday-theme/showcase/fan-scene-albums.webp"
    },
    articles: [
      {
        id: "site_aidreamcapes_blog_detail",
        slug: "/blog/approved-source-photo-planning",
        pageTitle: "Approved source photo planning",
        title: "How to plan approved source photos for private fan and holiday albums",
        summary:
          "Choose clear portraits, note permission boundaries, and keep fan-scene or holiday references focused so Aidreamcapes can build cleaner private albums.",
        author: "Aidreamcapes editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "7",
        imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/showcase/fan-scene-albums.webp",
        imageAlt: "Aidreamcapes fan-scene album cover",
        tags: "Source portraits|Fan scenes|Holiday planning|Private albums",
        primaryCta: "Start a fan set",
        primaryHref: "/login",
        secondaryCta: "Browse albums",
        secondaryHref: "/collections",
        seoTitle: "How to plan approved source photos for Aidreamcapes private albums",
        seoDescription:
          "Learn how to choose source photos, note permission boundaries, and keep fan-scene or holiday references focused for Aidreamcapes private albums.",
        seoKeywords:
          "approved source photos, fan-scene album planning, private holiday albums, Aidreamcapes",
        body: html`
          <p>Strong Aidreamcapes results begin before the album is generated. The private workflow needs clear portraits first, then fan-scene or holiday cues that support the gallery direction without overwhelming it.</p>
          <h2 id="start-with-identity-clarity">Start with identity clarity</h2>
          <p>Choose recent portraits where the face is sharp, naturally lit, and easy to recognize. Avoid heavy filters, sunglasses, harsh shadows, and group photos when the request needs consistent solo albums.</p>
          <p>For paired or family-style albums, keep the same rule for every person in the set. One clear portrait for each subject is better than a folder where one person appears in crisp light and another is only visible in distant group shots.</p>
          <h2 id="add-context-intentionally">Add context intentionally</h2>
          <p>A cozy table set may need warm light, linen textures, and relaxed posture notes. A fan-scene album can use poster color, supporter energy, backstage cues, or watch-party references. A holiday set benefits from season, gesture, and card-ready framing.</p>
          <p>Helpful context can also include what should stay out of the scene. If the album should feel like a quiet private keepsake, say that instead of leaving room for crowded backgrounds or overdone styling. Boundaries keep the result believable and make the finished gallery easier to review.</p>
          <h2 id="match-wardrobe-to-the-theme">Match wardrobe notes to the theme</h2>
          <p>Wardrobe does not need to be complicated. Light neutrals can work for holiday cards. Structured jackets can fit fan-scene portraits. Soft layers support family keepsakes or event albums. Use wardrobe notes to make the gallery believable, not to rewrite every detail of the person.</p>
          <h2 id="keep-the-request-focused">Keep the request focused</h2>
          <p>One clear theme usually works better than five mixed ideas in the same job. If you want both a fan-scene album and a holiday album, run them as separate package choices so each private gallery has a coherent mood.</p>
          <h2 id="choose-photos-for-the-theme">Choose photos for the theme, not just the face</h2>
          <p>An album needs identity, but it also needs enough body and wardrobe context to feel believable in a themed scene. A close crop can help with face detail, while a half-body source image helps the request understand posture, shoulders, and how clothing should sit in the album.</p>
          <p>If the theme involves movement, such as a watch-party frame or a card-ready pose, include one relaxed standing shot. If the theme is more polished, such as a table keepsake or a quiet studio-style set, a calmer portrait with clean lighting may be enough.</p>
          <h2 id="balance-real-person-and-theme">Balance the real person and the theme</h2>
          <p>The best Aidreamcapes requests do not let the theme swallow the person. A dramatic backdrop, party corner, or holiday prop should support the portrait rather than turn the subject into a background detail. When choosing source photos, keep one image where the face is unmistakable and one image that shows posture or wardrobe. When writing notes, describe the visible scene instead of asking for a vague fantasy.</p>
          <p>This balance is especially useful for shared albums or profile refreshes. The image should feel like a believable themed portrait of the person, not an anonymous stock scene with a face added later.</p>
          <h2 id="review-outputs-privately">Review outputs privately before sharing</h2>
          <p>Finished albums return to the Aidreamcapes account gallery. Compare identity, lighting, crop, and theme consistency before downloading favorites for profiles, cards, social posts, or personal keepsakes.</p>
          <h2 id="source-planning-checklist">Source planning checklist</h2>
          <ul><li>Use clear recent portraits before expressive references.</li><li>Pick one theme for the first request.</li><li>Add outfit notes that support the album.</li><li>Check the visible credit cost before generation.</li><li>Review the private gallery before sharing images elsewhere.</li></ul>
          <h2 id="source-photo-faq">Source photo FAQ</h2>
          <h3 id="do-i-need-real-reference-photos">Do I need real reference photos?</h3>
          <p>No. The source photos should mainly identify the person. Fan-scene references and album choice can describe the mood. Real reference photos can help as references only when you own them and they support the scene clearly.</p>
          <h3 id="should-i-include-full-body-photos">Should I include full-body photos?</h3>
          <p>A full-body photo is useful for albums with walking, greeting, or group scenes, but it should still be clear and current. If the face becomes too small, pair it with a sharper portrait.</p>
          <h3 id="what-if-my-photos-have-different-outfits">What if my photos have different outfits?</h3>
          <p>Some variety is fine, but avoid making wardrobe the main signal. Use outfit notes to guide the album look, then let the clearest current portraits carry identity.</p>
          <p>Source planning does not need a professional shoot. It needs clear portraits and an album brief that knows what kind of private gallery you want.</p>
        `
      },
      {
        id: "site_aidreamcapes_blog_fan_scene_references",
        slug: "/blog/permission-safe-fan-scene-reference-planning",
        pageTitle: "Permission-safe fan-scene references",
        title: "How to choose permission-safe fan-scene references for private albums",
        summary:
          "A guide to choosing original mood references, holiday cues, and safe boundaries that keep Aidreamcapes requests focused and private.",
        author: "Aidreamcapes editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "6",
        imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/posters/permission-safe-story-clip.webp?v=20260731assetfix1",
        imageAlt: "Aidreamcapes fan-scene reference cover",
        tags: "Fan-scene references|Holiday cues|Private albums|Permission-safe planning",
        primaryCta: "Plan a fan scene",
        primaryHref: "/collections",
        secondaryCta: "View pricing",
        secondaryHref: "/pricing",
        targetLabel: "Fan and holiday albums",
        targetHref: "/collections",
        seoTitle: "How to choose permission-safe fan-scene references for Aidreamcapes",
        seoDescription:
          "Choose better fan-scene references, holiday cues, and private album notes so Aidreamcapes can keep each request focused, original, and private.",
        seoKeywords:
          "permission-safe references, fan-scene mood boards, holiday cues, Aidreamcapes",
        body: html`
          <p>Fan-scene references work best when they behave like a compass. They should point Aidreamcapes toward light, texture, season, and album mood without asking one private job to become every idea at once.</p>
          <h2 id="choose-one-primary-scene">Choose one primary scene</h2>
          <p>Start by naming the main feeling of the album: supporter energy, holiday warmth, quiet card set, table keepsake, backstage moment, or a small celebration. A precise mood helps every generated image feel like part of the same gallery.</p>
          <p>The primary mood should be specific enough that you could reject a wrong image quickly. If the brief says "quiet table morning," a loud party frame is clearly off-scene. If the brief only says "fan vibe," almost anything can pass, which makes the final gallery harder to judge.</p>
          <h2 id="use-observable-reference-details">Use observable reference details</h2>
          <p>Useful references describe what the viewer can see: warm lamp light, table settings, backstage color, cardigan layers, card-friendly spacing, soft party glow, or golden-hour warmth. Avoid vague instructions that sound good but do not tell the scene what to show.</p>
          <p>Good reference notes often combine one texture, one light direction, and one wardrobe signal. For example, a warm table surface, late-afternoon side light, and relaxed neutral layers give the album a practical direction without forcing every frame to copy the same background.</p>
          <h2 id="limit-the-number-of-references">Limit the number of references</h2>
          <p>Two or three focused references are usually easier to follow than a large mixed board. If one reference is for lighting, one for scene texture, and one for wardrobe tone, the package has a cleaner brief.</p>
          <h2 id="separate-conflicting-scenes">Separate conflicting scenes</h2>
          <p>A watch-party set and a formal holiday album can both be beautiful, but they should not fight inside the same generation request. Split them into separate private albums so credits support a clear outcome.</p>
          <h2 id="turn-references-into-a-short-brief">Turn references into a short brief</h2>
          <p>A strong brief can be one sentence: "Warm fan-scene portraits with relaxed styling, soft evening light, and a private keepsake mood." That gives the workflow a scene, visual texture, and wardrobe direction.</p>
          <h2 id="reference-quality-check">Reference quality check</h2>
          <table><thead><tr><th>Reference type</th><th>Useful detail</th></tr></thead><tbody><tr><td>Light</td><td>Golden hour, soft overcast, warm table light, bright celebration glow.</td></tr><tr><td>Scene texture</td><td>Card stock, backdrop rail, table setting, market color, party space.</td></tr><tr><td>Wardrobe tone</td><td>Neutral layers, card-friendly linen, structured jacket, soft party shell.</td></tr><tr><td>Album use</td><td>Profile, keepsake, card crop, family set, creator story.</td></tr></tbody></table>
          <h2 id="bad-references-to-leave-out">Bad references to leave out</h2>
          <p>Leave out references that conflict with the scene. A holiday card, fan-scene wall, party backdrop, and family table can all be attractive, but together they create a confused request. Also avoid references where the subject is hidden, the lighting is too stylized to read, or the main value is a celebrity pose rather than observable scene details.</p>
          <p>When a reference is mostly about mood, translate it into visible words. Instead of "make it cinematic," name the thing that creates the mood: warm light, soft shadow, quiet backdrop, table color, glow from a window, or a clean frame edge.</p>
          <h2 id="make-references-work-together">Make references work together</h2>
          <p>Think of each reference as having a job. One image can define light, another can define scene texture, and a third can suggest wardrobe tone. If two references are doing the same job, keep the clearer one. If a reference introduces a new season, color palette, or camera mood, ask whether it helps the album or simply adds noise.</p>
          <p>A focused reference board often feels quieter than a social media moodboard. That is a strength. Aidreamcapes can follow a small set of visible cues more easily than a collage of beautiful but conflicting ideas.</p>
          <h2 id="reference-faq">Reference FAQ</h2>
          <h3 id="can-i-use-a-moodboard">Can I use a moodboard?</h3>
          <p>Yes, but keep it small. Two or three references with different jobs are stronger than a large board where every image competes for attention.</p>
          <h3 id="should-references-show-people">Should references show people?</h3>
          <p>They can, but they do not have to. A scene, color palette, lighting condition, or table texture can be more useful than another person's pose, especially when your own source portraits already carry identity.</p>
          <h3 id="how-specific-should-the-brief-be">How specific should the brief be?</h3>
          <p>Specific enough to guide the album, but short enough to stay readable. One scene, one lighting direction, one wardrobe tone, and one intended use are usually enough for a first request.</p>
          <p>Good references make the final gallery feel planned. They give the album a visual language before the first image is generated.</p>
        `
      },
      {
        id: "site_aidreamcapes_blog_private_album_credit",
        slug: "/blog/private-album-credit-planning-guide",
        pageTitle: "Private album credit planning",
        title: "How to plan private album credits for Aidreamcapes",
        summary:
          "Plan output count, review time, visible credit cost, and how much iteration you want before starting a fan or holiday album.",
        author: "Aidreamcapes editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "6",
        imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/showcase/thanksgiving-memory-sets.webp",
        imageAlt: "Aidreamcapes private album credit cover",
        tags: "Private albums|Credits|Fan scenes|Holiday planning",
        primaryCta: "Plan credits",
        primaryHref: "/login",
        secondaryCta: "Browse albums",
        secondaryHref: "/collections",
        seoTitle: "Aidreamcapes private album credits and planning guide",
        seoDescription:
          "Plan Aidreamcapes album credits by output count, visible cost, private gallery review, and whether the next request is a fan scene or holiday set.",
        seoKeywords:
          "private album credits, fan-scene planning, holiday album pricing, Aidreamcapes",
        body: html`
          <p>A private album is more than a single portrait. It is a small visual story, so the best credit plan starts with scope: how many scenes you need, how experimental the theme is, and how much review you want before sharing favorites.</p>
          <h2 id="define-the-album-scope">Define the album scope</h2>
          <p>Decide whether you need one polished profile set, a wider fan-scene story, or a keepsake album with multiple crops. A focused profile refresh may need fewer outputs than a theme album that covers arrival, greeting, pose, close-up, and card-ready frames.</p>
          <p>Scope also affects how you review the results. A profile refresh can be judged by one or two strong hero images. A theme album needs continuity: similar light, believable wardrobe, and enough variety that the gallery feels like a short story rather than repeated versions of the same frame.</p>
          <h2 id="review-credit-cost-before-starting">Review credit cost before starting</h2>
          <p>Aidreamcapes shows credit cost before a private generation request begins. Use that step to decide whether the album should be a first test, a full theme set, or a follow-up after improving source portraits and references.</p>
          <h2 id="budget-for-iteration">Budget for iteration</h2>
          <p>Theme mood can be sensitive to lighting, wardrobe, and scene details. If you are testing a new look, leave room for a second pass. The first gallery can teach you which source photos, outfit notes, or reference details to refine.</p>
          <h2 id="keep-private-review-in-the-plan">Keep private review in the plan</h2>
          <p>Finished images return to the account gallery, where you can compare consistency before downloading. Review time matters because some frames may become profile images, while others belong in a private keepsake album.</p>
          <h2 id="avoid-spending-credits-on-mixed-albums">Avoid spending credits on mixed albums</h2>
          <p>The easiest way to waste a private album is to ask for several moods at once. A fan-scene morning, holiday table, spotlight portrait, and party night can all belong in the larger imagination, but they compete when one request needs a coherent gallery. Pick the theme that best fits the source photos and save the other ideas for later.</p>
          <p>This does not make the album less creative. It makes the review clearer. When the theme is focused, you can judge whether identity, lighting, clothing, and scene texture improved together instead of trying to untangle too many changes at once.</p>
          <h2 id="match-album-size-to-use">Match album size to the use</h2>
          <table><thead><tr><th>Album use</th><th>Credit planning approach</th><th>Private review focus</th></tr></thead><tbody><tr><td>Profile refresh</td><td>Choose a tighter set with one theme.</td><td>Face consistency, crop, and clean background detail.</td></tr><tr><td>Theme story</td><td>Plan for several scenes in the same visual language.</td><td>Whether the album feels connected from image to image.</td></tr><tr><td>Gift or keepsake</td><td>Leave room for a second pass if the mood is personal.</td><td>Expression, warmth, and whether the image feels believable.</td></tr><tr><td>Creator content</td><td>Budget for crop variety and a few stronger scene options.</td><td>Which images can work as headers, posts, or thumbnails.</td></tr></tbody></table>
          <h2 id="choose-the-next-album">Choose the next album from what worked</h2>
          <p>If holiday light fits the subject well, build a second album around warm cards, table scenes, or winter keepsakes. If fan-scene texture works better, try supporter walls, backstage moments, or watch-party sets. Let the first private gallery guide the next credit spend.</p>
          <h2 id="credit-planning-checklist">Credit planning checklist</h2>
          <ul><li>Name the album mood before choosing the package.</li><li>Match source-photo quality to the ambition of the album.</li><li>Check credit cost before generation starts.</li><li>Save room for a second pass when testing a new look.</li><li>Use the private gallery to decide what to download and what to improve.</li></ul>
          <h2 id="album-credit-faq">Album credit FAQ</h2>
          <h3 id="should-i-run-one-large-album-first">Should I run one large album first?</h3>
          <p>Run a larger album when the direction is already clear. If you are testing a new look, a focused first pass can show whether the source photos and references are working before you spend more credits.</p>
          <h3 id="what-counts-as-a-good-first-pass">What counts as a good first pass?</h3>
          <p>A good first pass does not need every image to be final. It should show stable identity, a believable mood, and enough usable frames to decide whether the next request should expand, repeat, or change direction.</p>
          <h3 id="how-should-i-compare-two-ideas">How should I compare two ideas?</h3>
          <p>Compare one variable at a time. If both source photos and album mood change between requests, it becomes harder to know what improved the gallery.</p>
          <p>Credits are easiest to manage when each request has a clear purpose. Plan the album, review the cost, then let the private gallery show you what the next set should become.</p>
        `
      },
      ...aidreamcapesThemeArticles
    ]
  }
];

for (const config of siteConfigs) {
  config.articles = config.coverageMode === "creative-packs"
    ? buildCreativePackCoverageArticles(sourceState, config.siteId, config.brand)
    : [
        ...config.articles,
        ...buildCoverageArticles(sourceState, config.siteId, config.brand, config.articles)
      ];
  assertUniqueArticleCovers(config);
}

function toTemplate(pageJson) {
  const sections = {};
  for (const [id, value] of Object.entries(pageJson.sections ?? {})) {
    sections[id] = {
      type: value.type,
      version: "1",
      card_name: value.type,
      settings: clone(value.settings ?? {}),
      blocks: clone(value.blocks ?? [])
    };
  }
  return {
    content_for_page: clone(pageJson.sectionsOrder ?? []),
    sections
  };
}

function ensureFooter(settings, label) {
  settings.navigation ??= { headerLinks: [], footerLinks: [] };
  settings.navigation.footerLinks ??= [];
  const navLinks = settings.navigation.footerLinks;
  const existingNav = navLinks.find((link) => link.href === "/blog");
  if (existingNav) {
    existingNav.label = label;
    existingNav.group = "company";
  } else {
    navLinks.push({ label, href: "/blog", group: "company" });
  }
  settings.navigation.footerLinks = navLinks.filter((link, index, links) => links.findIndex((item) => item.href === link.href) === index);

  settings.globalSections ??= {};
  settings.globalSections.footer ??= { type: "footer", settings: {}, blocks: [] };
  settings.globalSections.footer.blocks ??= [];
  const blocks = settings.globalSections.footer.blocks;
  const existingBlock = blocks.find((block) => block.settings?.href === "/blog");
  if (existingBlock) {
    existingBlock.type = "menu_link";
    existingBlock.settings = { ...(existingBlock.settings ?? {}), label, href: "/blog", group: "company" };
  } else {
    blocks.push({
      id: `global_footer_blog_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "guides"}`,
      type: "menu_link",
      settings: { label, href: "/blog", group: "company" }
    });
  }
  settings.globalSections.footer.blocks = blocks.filter((block, index, allBlocks) => {
    const href = block.settings?.href;
    if (href !== "/blog") return true;
    return allBlocks.findIndex((item) => item.settings?.href === href) === index;
  });
}

function insertOrMoveLink(links, link, beforeHrefs = []) {
  const normalizedHref = link.href;
  const existingIndex = links.findIndex((item) => item.href === normalizedHref);
  const nextLinks = existingIndex >= 0 ? links.filter((_, index) => index !== existingIndex) : [...links];
  const insertIndex = nextLinks.findIndex((item) => beforeHrefs.includes(item.href));
  nextLinks.splice(insertIndex >= 0 ? insertIndex : nextLinks.length, 0, existingIndex >= 0 ? { ...links[existingIndex], ...link } : link);
  return nextLinks.filter((item, index, allItems) => allItems.findIndex((candidate) => candidate.href === item.href) === index);
}

function ensureHeader(settings) {
  const blogLink = { label: "Blog", href: "/blog" };
  settings.navigation ??= { headerLinks: [], footerLinks: [] };
  settings.navigation.headerLinks ??= [];
  settings.navigation.headerLinks = insertOrMoveLink(settings.navigation.headerLinks, blogLink, ["/pricing", "/faq"]);

  settings.globalSections ??= {};
  settings.globalSections.header ??= { type: "header", settings: {}, blocks: [] };
  settings.globalSections.header.blocks ??= [];
  const blocks = settings.globalSections.header.blocks;
  const blogBlock = {
    id: "global_header_blog",
    type: "menu_link",
    settings: { label: "Blog", href: "/blog" }
  };
  const existingIndex = blocks.findIndex((block) => block.type === "menu_link" && block.settings?.href === "/blog");
  const nextBlocks = existingIndex >= 0 ? blocks.filter((_, index) => index !== existingIndex) : [...blocks];
  const insertIndex = nextBlocks.findIndex((block) => block.type === "menu_link" && ["/pricing", "/faq"].includes(block.settings?.href));
  nextBlocks.splice(insertIndex >= 0 ? insertIndex : nextBlocks.length, 0, existingIndex >= 0 ? { ...blocks[existingIndex], settings: { ...(blocks[existingIndex].settings ?? {}), label: "Blog", href: "/blog" } } : blogBlock);
  settings.globalSections.header.blocks = nextBlocks.filter((block, index, allBlocks) => {
    const href = block.settings?.href;
    if (href !== "/blog") return true;
    return allBlocks.findIndex((item) => item.settings?.href === href) === index;
  });
}

function ensureSeoPages(settings, site) {
  settings.seo ??= {
    siteTitle: site.name,
    siteDescription: site.branding?.description ?? "",
    titleTemplate: `%s | ${site.name}`,
    robots: { index: true, follow: true },
    pages: {}
  };
  const previousPages = settings.seo.pages ?? {};
  const nextPages = {};
  for (const page of site.pages.filter((item) => item.slug !== "/blog" && !item.slug.startsWith("/blog/"))) {
    if (previousPages[page.id]) nextPages[page.id] = previousPages[page.id];
  }
  for (const page of site.pages.filter((item) => item.slug === "/blog" || item.slug.startsWith("/blog/"))) {
    const pageSeo = page.publishedJson.seo ?? {};
    nextPages[page.id] = {
      title: pageSeo.title ?? page.title,
      description: pageSeo.description ?? "",
      keywords: pageSeo.keywords ?? "",
      ogImage: pageSeo.ogImage ?? "",
      canonicalPath: pageSeo.canonicalPath ?? page.slug,
      index: pageSeo.robots?.index ?? true,
      follow: pageSeo.robots?.follow ?? true
    };
  }
  settings.seo.pages = nextPages;
}

function makeBlogHomeJson(config, existingPage) {
  const existing = existingPage?.publishedJson ?? {};
  const sections = clone(existing.sections ?? {});
  sections.blog_intro_1 = section("rich_text", {
    eyebrow: config.blogTitle,
    title: config.homeIntroTitle,
    body: config.homeIntroBody,
    headingLevel: "h1"
  });
  sections.blog_list_1 = section("blog_list", {
    title: config.homeListTitle,
    headingLevel: "h2",
    body: config.homeListBody,
    guideType: config.guideType
  });
  const sectionsOrder = ["blog_intro_1", "blog_list_1", "packages_strip_1", "conversion_1"].filter((id) => sections[id]);
  return {
    pageType: "blog",
    version: existing.version ?? 1,
    sectionsOrder,
    sections,
    seo: {
      title: config.homeSeo.title,
      description: config.homeSeo.description,
      keywords: config.homeSeo.keywords,
      ogImage: config.homeSeo.ogImage ?? config.articles[0]?.imageUrl ?? "",
      canonicalPath: "/blog",
      robots: { index: true, follow: true }
    }
  };
}

function makeArticleJson(config, article, existingPage, sourceArticlePage) {
  const sourceJson = existingPage?.publishedJson ?? sourceArticlePage?.publishedJson ?? {};
  const sections = clone(sourceJson.sections ?? {});
  const targetHref = article.targetHref ?? article.secondaryHref ?? article.primaryHref ?? "/collections";
  const targetLabel = article.targetLabel ?? article.secondaryCta ?? article.primaryCta ?? "Open related page";
  sections.blog_detail_1 = section("blog_article", {
    eyebrow: article.slug === config.articles[0].slug ? config.guideType : "Guide",
    title: article.title,
    headingLevel: "h1",
    summary: article.summary,
    author: article.author,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    readMinutes: article.readMinutes,
    imageUrl: article.imageUrl,
    imageAlt: article.imageAlt,
    tags: article.tags,
    primaryCta: article.primaryCta,
    primaryHref: article.primaryHref,
    secondaryCta: article.secondaryCta,
    secondaryHref: article.secondaryHref,
    targetLabel,
    targetHref,
    body: article.body
  });
  for (const sectionId of ["packages_1", "packages_strip_1", "blog_list_1", "conversion_1"]) {
    delete sections[sectionId];
  }
  const sectionsOrder = ["blog_detail_1"];
  return {
    pageType: "article",
    version: sourceJson.version ?? 1,
    sectionsOrder,
    sections,
    seo: {
      title: article.seoTitle,
      description: article.seoDescription,
      keywords: article.seoKeywords,
      canonicalPath: article.slug,
      ogImage: article.imageUrl,
      robots: { index: true, follow: true }
    }
  };
}

function upsertPage(site, page) {
  const index = site.pages.findIndex((item) => item.slug === page.slug);
  if (index >= 0) {
    site.pages[index] = { ...site.pages[index], ...page };
    return;
  }
  const lastBlogIndex = site.pages.reduce((lastIndex, item, itemIndex) => item.slug === "/blog" || item.slug.startsWith("/blog/") ? itemIndex : lastIndex, -1);
  site.pages.splice(lastBlogIndex >= 0 ? lastBlogIndex + 1 : site.pages.length, 0, page);
}

function syncPublicationSnapshots(state, site) {
  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== site.id) continue;
    publication.snapshot ??= {};
    publication.snapshot.pages = site.pages.map((page) => ({
      id: page.id,
      slug: page.slug,
      publishedJson: clone(page.publishedJson)
    }));
    publication.snapshot.themeSettings = clone(site.themeSettings.publishedJson);
    if (publication.snapshot.saasTheme?.templates) {
      const blogHome = site.pages.find((page) => page.slug === "/blog");
      const firstArticle = site.pages.find((page) => page.slug.startsWith("/blog/"));
      if (blogHome) publication.snapshot.saasTheme.templates.blog = toTemplate(blogHome.publishedJson);
      if (firstArticle) publication.snapshot.saasTheme.templates["blog-detail"] = toTemplate(firstArticle.publishedJson);
    }
  }
}

function syncSiteThemes(state, site) {
  const blogHome = site.pages.find((page) => page.slug === "/blog");
  const firstArticle = site.pages.find((page) => page.slug.startsWith("/blog/"));
  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== site.id) continue;
    const usePublished = theme.status === "active";
    theme.settings ??= {};
    theme.settings.settings_data ??= {};
    theme.settings.settings_data.current = clone(usePublished ? site.themeSettings.publishedJson : site.themeSettings.draftJson);
    if (!theme.templates) continue;
    if (blogHome) theme.templates.blog = toTemplate(usePublished ? blogHome.publishedJson : blogHome.draftJson);
    if (firstArticle) theme.templates["blog-detail"] = toTemplate(usePublished ? firstArticle.publishedJson : firstArticle.draftJson);
  }
}

function removeStaleBlogArticles(site, expectedArticleSlugs) {
  site.pages = site.pages.filter((page) => {
    if (!page.slug.startsWith("/blog/")) return true;
    return expectedArticleSlugs.has(page.slug);
  });
}

function readConstStringArray(source, constName) {
  const match = source.match(new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`missing_${constName}`);
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (item) => item[1]);
}

function formatConstStringArray(constName, values) {
  return `const ${constName} = [\n${values.map((value) => `  ${JSON.stringify(value)}`).join(",\n")}\n];`;
}

function replaceConstStringArray(source, constName, values) {
  return source.replace(
    new RegExp(`const ${constName} = \\[[\\s\\S]*?\\];`),
    formatConstStringArray(constName, values)
  );
}

function fallbackPathsForSite(site, existingPaths) {
  const blogPaths = site.pages
    .filter((page) => page.slug === "/blog" || page.slug.startsWith("/blog/"))
    .map((page) => page.slug);
  const next = [
    ...existingPaths.filter((item) => !item.startsWith("/blog")),
    ...blogPaths
  ];
  return Array.from(new Set(next));
}

function syncSeoFallbacks(state) {
  const seoIndexingPath = path.join(process.cwd(), "src/lib/seo-indexing.ts");
  const source = fs.readFileSync(seoIndexingPath, "utf8");
  const dreamshootSite = state.sites.find((site) => site.id === "site_dreamshoot" || site.slug === "mydreamshoots");
  const aidreamcapesSite = state.sites.find((site) => site.id === "site_aidreamcapes" || site.slug === "aidreamcapes");
  if (!dreamshootSite || !aidreamcapesSite) return { updated: false };

  const dreamshootFallback = fallbackPathsForSite(
    dreamshootSite,
    readConstStringArray(source, "FALLBACK_INDEXABLE_PATHS")
  );
  const aidreamcapesFallback = fallbackPathsForSite(
    aidreamcapesSite,
    readConstStringArray(source, "AIDREAMCAPES_FALLBACK_INDEXABLE_PATHS")
  );
  const next = replaceConstStringArray(
    replaceConstStringArray(source, "FALLBACK_INDEXABLE_PATHS", dreamshootFallback),
    "AIDREAMCAPES_FALLBACK_INDEXABLE_PATHS",
    aidreamcapesFallback
  );
  if (next !== source) fs.writeFileSync(seoIndexingPath, next);
  return {
    updated: next !== source,
    mydreamshoots: dreamshootFallback.length,
    aidreamcapes: aidreamcapesFallback.length
  };
}

function syncSite(state, config) {
  const site = state.sites.find((item) => item.id === config.siteId || item.slug === config.slug);
  if (!site) throw new Error(`Missing site ${config.slug}`);
  if (!String(site.primaryDomain ?? "").includes(".com")) return;

  site.themeSettings ??= {};
  site.themeSettings.draftJson ??= {};
  site.themeSettings.publishedJson ??= {};
    ensureHeader(site.themeSettings.draftJson);
    ensureHeader(site.themeSettings.publishedJson);
    ensureFooter(site.themeSettings.draftJson, config.footerLabel);
    ensureFooter(site.themeSettings.publishedJson, config.footerLabel);

  const existingBlogHome = site.pages.find((page) => page.slug === "/blog");
  const blogHomeJson = makeBlogHomeJson(config, existingBlogHome);
  upsertPage(site, {
    id: existingBlogHome?.id ?? `${site.id}_blog`,
    siteId: site.id,
    pageType: "blog",
    templateKey: "blog",
    slug: "/blog",
    title: config.blogTitle,
    draftJson: clone(blogHomeJson),
    publishedJson: clone(blogHomeJson)
  });

  const sourceArticlePage = site.pages.find((page) => page.slug.startsWith("/blog/"));
  for (const article of config.articles) {
    const existingPage = site.pages.find((page) => page.slug === article.slug);
    const articleJson = makeArticleJson(config, article, existingPage, sourceArticlePage);
    upsertPage(site, {
      id: existingPage?.id ?? article.id,
      siteId: site.id,
      pageType: "article",
      templateKey: "blog-detail",
      slug: article.slug,
      title: article.pageTitle,
      draftJson: clone(articleJson),
      publishedJson: clone(articleJson)
    });
  }

  removeStaleBlogArticles(site, new Set(config.articles.map((article) => article.slug)));
  ensureSeoPages(site.themeSettings.draftJson, site);
  ensureSeoPages(site.themeSettings.publishedJson, site);
  syncSiteThemes(state, site);
  syncPublicationSnapshots(state, site);
}

const state = sourceState;
for (const config of siteConfigs) syncSite(state, config);
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
const seoFallbacks = syncSeoFallbacks(state);

console.log(JSON.stringify({
  ok: true,
  updatedSites: siteConfigs.map((config) => config.slug),
  articlesPerSite: Object.fromEntries(siteConfigs.map((config) => [config.slug, config.articles.length])),
  seoFallbacks
}, null, 2));
