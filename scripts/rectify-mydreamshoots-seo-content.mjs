import fs from "node:fs";
import path from "node:path";

const statePath = path.resolve(process.cwd(), "data/platform-state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

const replacements = new Map([
  ["ʍʏƉʀɛǟʍֆhoots", "MyDreamShoots"],
  ["4.9/5 from creators using private photo packs", "Private uploads and clear credit costs"],
  ["5-star reviews", "Use cases"],
  ["Show finished outcomes first: sports posters, clean headshots, cinematic portraits, style previews, and seasonal albums.", "See examples of what your selfies can become: headshots, fan posters, creator portraits, style previews, and seasonal albums."],
  ["The strongest proof is simple: ordinary input photos, believable output sets, clear credits, and no studio booking.", "Compare ordinary phone photos with finished private results before choosing a package."],
  ["Realistic customer stories for AI photo package buyers", "Example use cases"],
  ["Answer pricing, privacy, uploads, and plan questions before customers spend credits.", "Answers to pricing, privacy, uploads, credits, refunds, and photo quality."],
  ["AI photo packages that feel like a real shoot", "Studio-quality AI photos from the selfies on your phone."],
  ["Upload selfies, build a private model, then buy photo packages with monthly credits.", "Upload your photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation."],
  ["Private photo packages for creators, job seekers, sports fans, and social buyers", "Private photo sets for work profiles, fan posts, creator pages, and personal albums."],
  ["Customer stories from AI photo package buyers.", "Ways people use MyDreamShoots."],
  ["Loved by creators, job seekers, and solo buyers", "Ways people use MyDreamShoots"],
  ["Transform everyday selfies into themed photo packages, headshots, World Cup fan photos, cyberpunk portraits, gala scenes, AI motion ideas, and virtual try-on previews from one subscription.", "Upload your selfies, choose a style, review the credit cost, and download a private photo set."],
  ["AI photo packages, personal models, paid tools, credits, and private gallery delivery", "Private AI photo sets with visible credit costs and gallery delivery"],
  ["Trusted funnel signals for creators, job seekers, sports fans, and social buyers", "Private uploads · Credit cost shown upfront · Download your favorites"],
  ["After customers see results and packages, explain upload safety, credit usage, generation status, and album delivery.", "Upload clear photos, review the credit cost, generate private results, then download the photos you want to keep."],
  ["Upload selfies and create your own private AI model.|Themed photo packages from headshots to football fan photos.|Gala, cyberpunk, lifestyle, beauty, and profile packs.|Magic upscaler, AI video concepts, and style preview flows.", "Upload clear photos you own or have permission to use.|Choose headshots, fan posters, creator portraits, beauty previews, and themed albums.|Review the credit cost before generation starts.|Download finished results from your private gallery."],
  ["Upload selfies and create your own private AI model.", "Upload clear photos you own or have permission to use."],
  ["Themed photo packages from headshots to football fan photos.", "Choose headshots, fan posters, creator portraits, beauty previews, and themed albums."],
  ["Replace a plain selfie background before ordering a full photo package.", "Replace a plain selfie background for cleaner personal images. Do not use edits for misleading claims or fake evidence."],
  ["Cut out product or portrait backgrounds for cleaner source images.", "Cut out product or portrait backgrounds for cleaner source images you own or have permission to edit."],
  ["Remove small distractions from portraits, cards, and generated scenes.", "Remove small distractions from portraits, cards, and generated scenes without creating misleading before-and-after claims."],
  ["Seasonal packs rotate around tournaments, holidays, and high-intent photo moments.", "Seasonal packs rotate around tournaments, holidays, and personal fan-photo moments."],
  ["40 photos", "Private gallery"],
  ["24 photos", "Private gallery"],
  ["20 photos", "Private gallery"],
  ["200-600", "Credits"],
  ["monthly credits", "shown before generation"],
  ["Upload, model, package, download.", "Upload, choose, review credits, generate."],
  ["A short customer journey: source photos, private model, credit-backed package, finished gallery.", "Use photos you own or have permission to use. Choose a package, review the credit cost, generate private results, and download favorites."],
  ["Upload your photos", "Upload clear photos"],
  ["Use clean selfies or source portraits from your phone. The first model looks best with 8-12 photos per person.", "Use recent photos where the face or subject is visible. Only upload photos you own or have permission to use."],
  ["Build your private model", "Review the credit cost"],
  ["The platform creates a private identity model before advanced packs run.", "The request shows the credit cost before generation starts so you know what the package will reserve."],
  ["Pick themed outcomes like World Cup fan photos, gala, lifestyle, cyberpunk, beauty, creator, or headshots.", "Pick the outcome you want, such as headshots, fan posters, creator portraits, beauty previews, or themed albums."],
  ["Get your final gallery", "Download from your gallery"],
  ["Finished sets land in a private album where customers can review and download results.", "Finished sets land in your private gallery where you can review, approve, and download results."],
  ["Show the transformation before checkout.", "Compare source photos with finished results."],
  ["Normal source portrait, private model, themed output, and gallery-ready delivery.", "Review the source photo, selected package direction, and finished private output before choosing another run."],
  ["Studio tools preview. Credits generate.", "Credits are reviewed before generation."],
  ["Paid plans include private model creation, package generation, credit history, and gallery delivery from one account.", "Plans and credit packs support private package generation, credit history, and gallery delivery from one account. You can review the cost before each request starts."],
  ["Start with studio tools", "Prepare better source photos"],
  ["Background edits, previews, upscaling, and try-on flows help prepare stronger source images before checkout.", "Background edits, previews, upscaling, and try-on flows can help prepare clearer inputs before a full package."],
  ["Train a private identity model", "Use a private identity flow"],
  ["Advanced packages need a customer model so results can stay consistent across headshots, gala, lifestyle, and style sets.", "Premium packages can use a private identity workflow so results stay more consistent across different scenes."],
  ["Spend credits only when generating", "Review credits first"],
  ["Credits are visible before a request starts and remain tied to subscription or one-time pack purchases.", "Credits are visible before a request starts. Successful generations consume the reserved credits, and failed requests can return them according to status."],
  ["Finished outputs return to the signed-in customer's album instead of being delivered through a generic download page.", "Finished outputs return to the signed-in customer's gallery for review and download."],
  ["Choose Starter, Pro, or Premium. Credits stay visible before every package run.", "Choose Starter, Pro, or Premium. Each package shows its credit cost before generation; failed requests can return reserved credits according to request status."],
  ["Yes. MyDreamShoots tools, private model creation, and premium packs require paid credits because they consume dedicated generation capacity.", "Some lightweight tools can be free. Private model creation and premium photo packages require credits because they use dedicated generation capacity."],
  ["Unused credits can be reviewed for refund eligibility within 30 days. Credits that have already been spent on successful generations are not refundable.", "Refund eligibility follows the site policy and checkout terms. Credits already spent on successful generations are not refundable, while failed requests can return reserved credits according to request status."],
  ["The account can keep access to previous albums and any credit rules configured for the site. New package requests can be blocked if the subscription is not active.", "Access to previous albums follows the account and gallery policy. New package requests may require an active plan or enough available credits."],
  ["Monthly credits for photo packs, AI video, and virtual try-on.", "Credits for private AI photo packages."],
  ["Choose a plan based on how often you need AI headshots, creator portraits, fan photos, image cleanup, video previews, and private gallery delivery.", "Choose a plan based on how often you need AI headshots, creator portraits, fan photos, image cleanup, video previews, and private gallery delivery. Each package shows the credit cost before generation starts; failed requests can return reserved credits according to request status."],
  ["MyDreamShoots, AI photo packages, AI portraits, personal AI model, private photo gallery, AI photo subscription", ""]
]);

const useCaseCards = {
  "Ava Mercer": {
    quote: "Create a private set of professional headshots for LinkedIn, resumes, founder bios, and company profiles.",
    name: "LinkedIn refresh",
    role: "Work profiles",
    location: "Professional headshots",
    rating: ""
  },
  "Lucas Bennett": {
    quote: "Turn your selfies into tournament-style fan posters and profile avatars for personal social posts.",
    name: "Match-day fan posts",
    role: "Fan posts",
    location: "Sports portraits",
    rating: ""
  },
  "Mia Collins": {
    quote: "Generate fresh portraits for newsletters, landing pages, thumbnails, and social profiles.",
    name: "Creator profile update",
    role: "Creator pages",
    location: "Profile portraits",
    rating: ""
  },
  "Noah Reed": {
    quote: "Try hairstyle, outfit, or themed portrait directions before downloading your favorites.",
    name: "Private style preview",
    role: "Style previews",
    location: "Beauty and try-on",
    rating: ""
  },
  "Elena Fischer": {
    quote: "Create themed portraits for a personal page while keeping uploads and results private to the account.",
    name: "Themed portrait set",
    role: "Private albums",
    location: "Creative portraits",
    rating: ""
  },
  "Ryan Cole": {
    quote: "Use quick previews first, then choose a full photo package after reviewing the credit cost.",
    name: "Package preview",
    role: "Credit planning",
    location: "Photo set workflow",
    rating: ""
  }
};

function isMydreamshootsSite(site) {
  return site?.id === "site_dreamshoot" || site?.slug === "mydreamshoots" || site?.primaryDomain === "www.mydreamshoots.com";
}

function rewriteString(value) {
  let next = value;
  for (const [from, to] of replacements) {
    next = next.replaceAll(from, to);
  }
  return next;
}

function walk(value) {
  if (typeof value === "string") return rewriteString(value);
  if (Array.isArray(value)) return value.map(walk);
  if (!value || typeof value !== "object") return value;

  if (value.summaryMeta === "Realistic customer stories for AI photo package buyers" || value.summaryMeta === "Example use cases") {
    value.title = "Ways people use MyDreamShoots.";
    value.subtitle = "Choose the kind of private photo set you need before uploading source photos or spending credits.";
    value.summaryTitle = "Ways people use MyDreamShoots";
    value.summaryBody = "Compare ordinary phone photos with finished private results before choosing a package.";
    value.summaryRating = "";
    value.summaryMeta = "Example use cases";
  }

  if (typeof value.name === "string" && useCaseCards[value.name]) {
    Object.assign(value, useCaseCards[value.name]);
  }

  for (const key of Object.keys(value)) {
    value[key] = walk(value[key]);
  }
  return value;
}

let changedSites = 0;
const beforeState = JSON.stringify(state);

for (const site of state.sites ?? []) {
  if (!isMydreamshootsSite(site)) continue;
  walk(site);
  const before = JSON.stringify(site);
  if (site.themeSettings?.publishedJson?.globalSections?.footer?.settings) {
    site.themeSettings.publishedJson.globalSections.footer.settings.title = "MyDreamShoots";
    site.themeSettings.publishedJson.globalSections.footer.settings.tagline = "Private AI photo sets with visible credit costs and gallery delivery";
    site.themeSettings.publishedJson.globalSections.footer.settings.body = "Upload your selfies, choose a style, review the credit cost, and download a private photo set.";
  }
  if (JSON.stringify(site) !== before) changedSites += 1;
}

for (const theme of state.siteThemes ?? []) {
  if (theme.siteId !== "site_dreamshoot") continue;
  walk(theme);
}

for (const publication of state.themePublications ?? []) {
  if (publication.siteId !== "site_dreamshoot") continue;
  walk(publication);
}

for (const pack of state.creativePacks ?? []) {
  if (pack.siteId !== "site_dreamshoot") continue;
  walk(pack);
}

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Rectified MyDreamShoots SEO/content fields for ${changedSites} site record(s).`);
console.log(beforeState === JSON.stringify(state) ? "No additional snapshot replacements were needed." : "Updated published and snapshot content records.");
