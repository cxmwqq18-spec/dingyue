export interface PolicySeoCopy {
  title: string;
  description: string;
  keywords: string;
  canonicalPath: string;
  index: boolean;
  follow: boolean;
}

const POLICY_KEYWORDS = [
  "MyDreamShoots policy",
  "AI photo privacy",
  "AI portrait terms",
  "photo upload privacy",
  "private AI albums",
  "AI photo credits"
].join(", ");

export const MYDREAMSHOOTS_POLICY_SEO_BY_PATH: Record<string, PolicySeoCopy> = {
  "/policies/privacy": {
    title: "Privacy Policy for AI Photo Uploads, Credits, and Private Albums",
    description:
      "Read how MyDreamShoots protects account data, uploaded source photos, generated AI portraits, credit activity, checkout records, cookies, and private album access on www.mydreamshoots.com.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/privacy",
    index: true,
    follow: true
  },
  "/privacy": {
    title: "Privacy Policy for AI Photo Uploads, Credits, and Private Albums",
    description:
      "Read how MyDreamShoots protects account data, uploaded source photos, generated AI portraits, credit activity, checkout records, cookies, and private album access on www.mydreamshoots.com.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/privacy",
    index: true,
    follow: true
  },
  "/privacy-policy": {
    title: "Privacy Policy for AI Photo Uploads, Credits, and Private Albums",
    description:
      "Read how MyDreamShoots protects account data, uploaded source photos, generated AI portraits, credit activity, checkout records, cookies, and private album access on www.mydreamshoots.com.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/privacy",
    index: true,
    follow: true
  },
  "/policies/terms": {
    title: "Terms of Service for MyDreamShoots AI Photo Packages",
    description:
      "Review the MyDreamShoots terms for customer accounts, AI photo credits, subscriptions, Stripe checkout, upload rights, generated portraits, failed jobs, refunds, and private gallery access.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/terms",
    index: true,
    follow: true
  },
  "/terms": {
    title: "Terms of Service for MyDreamShoots AI Photo Packages",
    description:
      "Review the MyDreamShoots terms for customer accounts, AI photo credits, subscriptions, Stripe checkout, upload rights, generated portraits, failed jobs, refunds, and private gallery access.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/terms",
    index: true,
    follow: true
  },
  "/terms-of-service": {
    title: "Terms of Service for MyDreamShoots AI Photo Packages",
    description:
      "Review the MyDreamShoots terms for customer accounts, AI photo credits, subscriptions, Stripe checkout, upload rights, generated portraits, failed jobs, refunds, and private gallery access.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/terms",
    index: true,
    follow: true
  },
  "/policies/cookies": {
    title: "Cookie Policy for MyDreamShoots Sign-In, Checkout, and Albums",
    description:
      "Learn how MyDreamShoots uses essential cookies, local storage, security checks, checkout continuity, preference memory, analytics, and provider tools for its AI photo service.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/cookies",
    index: true,
    follow: true
  },
  "/cookies": {
    title: "Cookie Policy for MyDreamShoots Sign-In, Checkout, and Albums",
    description:
      "Learn how MyDreamShoots uses essential cookies, local storage, security checks, checkout continuity, preference memory, analytics, and provider tools for its AI photo service.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/cookies",
    index: true,
    follow: true
  },
  "/cookie-policy": {
    title: "Cookie Policy for MyDreamShoots Sign-In, Checkout, and Albums",
    description:
      "Learn how MyDreamShoots uses essential cookies, local storage, security checks, checkout continuity, preference memory, analytics, and provider tools for its AI photo service.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/cookies",
    index: true,
    follow: true
  },
  "/policies/refunds": {
    title: "Refund Policy for MyDreamShoots Credits, Plans, and Failed Jobs",
    description:
      "Review how MyDreamShoots handles refund eligibility, unused AI photo credits, subscription cancellations, technical failures, reruns, billing reversals, and account credit history.",
    keywords: [
      POLICY_KEYWORDS,
      "MyDreamShoots refund policy",
      "AI photo credit refund",
      "subscription credit refund",
      "failed AI job refund"
    ].join(", "),
    canonicalPath: "/refunds",
    index: true,
    follow: true
  },
  "/refunds": {
    title: "Refund Policy for MyDreamShoots Credits, Plans, and Failed Jobs",
    description:
      "Review how MyDreamShoots handles refund eligibility, unused AI photo credits, subscription cancellations, technical failures, reruns, billing reversals, and account credit history.",
    keywords: [
      POLICY_KEYWORDS,
      "MyDreamShoots refund policy",
      "AI photo credit refund",
      "subscription credit refund",
      "failed AI job refund"
    ].join(", "),
    canonicalPath: "/refunds",
    index: true,
    follow: true
  },
  "/refund-policy": {
    title: "Refund Policy for MyDreamShoots Credits, Plans, and Failed Jobs",
    description:
      "Review how MyDreamShoots handles refund eligibility, unused AI photo credits, subscription cancellations, technical failures, reruns, billing reversals, and account credit history.",
    keywords: [
      POLICY_KEYWORDS,
      "MyDreamShoots refund policy",
      "AI photo credit refund",
      "subscription credit refund",
      "failed AI job refund"
    ].join(", "),
    canonicalPath: "/refunds",
    index: true,
    follow: true
  },
  "/policies/content": {
    title: "Content Policy for MyDreamShoots Uploads and AI Photo Outputs",
    description:
      "Read the MyDreamShoots content policy for permitted source photos, upload rights, identity consent, private AI albums, moderation review, blocked requests, and responsible output use.",
    keywords: [
      POLICY_KEYWORDS,
      "MyDreamShoots content policy",
      "AI photo upload rules",
      "AI portrait consent",
      "private AI output policy"
    ].join(", "),
    canonicalPath: "/content",
    index: true,
    follow: true
  },
  "/content": {
    title: "Content Policy for MyDreamShoots Uploads and AI Photo Outputs",
    description:
      "Read the MyDreamShoots content policy for permitted source photos, upload rights, identity consent, private AI albums, moderation review, blocked requests, and responsible output use.",
    keywords: [
      POLICY_KEYWORDS,
      "MyDreamShoots content policy",
      "AI photo upload rules",
      "AI portrait consent",
      "private AI output policy"
    ].join(", "),
    canonicalPath: "/content",
    index: true,
    follow: true
  },
  "/content-policy": {
    title: "Content Policy for MyDreamShoots Uploads and AI Photo Outputs",
    description:
      "Read the MyDreamShoots content policy for permitted source photos, upload rights, identity consent, private AI albums, moderation review, blocked requests, and responsible output use.",
    keywords: [
      POLICY_KEYWORDS,
      "MyDreamShoots content policy",
      "AI photo upload rules",
      "AI portrait consent",
      "private AI output policy"
    ].join(", "),
    canonicalPath: "/content",
    index: true,
    follow: true
  },
  "/policies/shipping": {
    title: "Shipping and Digital Delivery Policy for AI Photo Orders",
    description:
      "Review how AI photo packages, credits, generated images, and private galleries are delivered digitally without physical shipping, carrier tracking, customs fees, or mailed products.",
    keywords: [
      POLICY_KEYWORDS,
      "digital delivery policy",
      "AI photo delivery",
      "no physical shipping",
      "private gallery delivery"
    ].join(", "),
    canonicalPath: "/shipping",
    index: true,
    follow: true
  },
  "/shipping": {
    title: "Shipping and Digital Delivery Policy for AI Photo Orders",
    description:
      "Review how AI photo packages, credits, generated images, and private galleries are delivered digitally without physical shipping, carrier tracking, customs fees, or mailed products.",
    keywords: [
      POLICY_KEYWORDS,
      "digital delivery policy",
      "AI photo delivery",
      "no physical shipping",
      "private gallery delivery"
    ].join(", "),
    canonicalPath: "/shipping",
    index: true,
    follow: true
  },
  "/shipping-policy": {
    title: "Shipping and Digital Delivery Policy for AI Photo Orders",
    description:
      "Review how AI photo packages, credits, generated images, and private galleries are delivered digitally without physical shipping, carrier tracking, customs fees, or mailed products.",
    keywords: [
      POLICY_KEYWORDS,
      "digital delivery policy",
      "AI photo delivery",
      "no physical shipping",
      "private gallery delivery"
    ].join(", "),
    canonicalPath: "/shipping",
    index: true,
    follow: true
  },
  "/delivery-policy": {
    title: "Shipping and Digital Delivery Policy for AI Photo Orders",
    description:
      "Review how AI photo packages, credits, generated images, and private galleries are delivered digitally without physical shipping, carrier tracking, customs fees, or mailed products.",
    keywords: [
      POLICY_KEYWORDS,
      "digital delivery policy",
      "AI photo delivery",
      "no physical shipping",
      "private gallery delivery"
    ].join(", "),
    canonicalPath: "/shipping",
    index: true,
    follow: true
  }
};

export function normalizePolicyPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

export function policyCanonicalUrlForSite(site: { primaryDomain?: string | null }, canonicalPath: string): string {
  const normalizedPath = normalizePolicyPath(canonicalPath);
  const host = String(site.primaryDomain ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .replace(/\/+$/, "");
  return host ? `https://${host}${normalizedPath}` : normalizedPath;
}

export function getMydreamshootsPolicySeo(path: string): PolicySeoCopy | undefined {
  return MYDREAMSHOOTS_POLICY_SEO_BY_PATH[normalizePolicyPath(path)];
}

const AIDREAMCAPES_POLICY_KEYWORDS = [
  "Aidreamcapes policy",
  "AI starlight portrait privacy",
  "private gallery delivery",
  "source photo consent",
  "digital portrait credits",
  "celestial package terms"
].join(", ");

const AIDREAMCAPES_POLICY_SEO_BY_CANONICAL: Record<string, Omit<PolicySeoCopy, "canonicalPath" | "index" | "follow">> = {
  "/privacy": {
    title: "Aidreamcapes Privacy Promise for Source Photos and Private Galleries",
    description:
      "Read how Aidreamcapes handles account access, private source photos, starlight portrait requests, credit records, downloads, support messages, and deletion requests.",
    keywords: AIDREAMCAPES_POLICY_KEYWORDS
  },
  "/terms": {
    title: "Aidreamcapes Studio Terms for Credits, Uploads, and Generated Portraits",
    description:
      "Review Aidreamcapes terms for customer accounts, source photo rights, celestial package credits, AI generation limits, private gallery delivery, and acceptable use.",
    keywords: AIDREAMCAPES_POLICY_KEYWORDS
  },
  "/cookies": {
    title: "Aidreamcapes Cookie Notice for Sign-In, Checkout, and Studio Preferences",
    description:
      "Learn how Aidreamcapes uses essential cookies and local storage for secure sign-in, cart continuity, credit visibility, private albums, and site reliability.",
    keywords: AIDREAMCAPES_POLICY_KEYWORDS
  },
  "/refunds": {
    title: "Aidreamcapes Credit Review and Refund Policy",
    description:
      "See how Aidreamcapes reviews unused credits, failed starlight generation jobs, subscription changes, reruns, billing issues, and eligible refund requests.",
    keywords: AIDREAMCAPES_POLICY_KEYWORDS
  },
  "/content": {
    title: "Aidreamcapes Creative Safety Policy for Uploads and Portrait Requests",
    description:
      "Understand Aidreamcapes rules for source photo permission, identity consent, disallowed requests, moderation, AI artifacts, and responsible generated-image use.",
    keywords: AIDREAMCAPES_POLICY_KEYWORDS
  },
  "/shipping": {
    title: "Aidreamcapes Digital Delivery Policy for Private AI Portrait Galleries",
    description:
      "Review how Aidreamcapes delivers credits, generated portraits, downloads, and private galleries digitally without physical shipping, tracking numbers, or customs fees.",
    keywords: AIDREAMCAPES_POLICY_KEYWORDS
  }
};

const AIDREAMCAPES_POLICY_ALIASES: Record<string, string> = {
  "/privacy": "/privacy",
  "/privacy-policy": "/privacy",
  "/policies/privacy": "/privacy",
  "/terms": "/terms",
  "/terms-of-service": "/terms",
  "/policies/terms": "/terms",
  "/cookies": "/cookies",
  "/cookie-policy": "/cookies",
  "/policies/cookies": "/cookies",
  "/refunds": "/refunds",
  "/refund-policy": "/refunds",
  "/policies/refunds": "/refunds",
  "/content": "/content",
  "/content-policy": "/content",
  "/policies/content": "/content",
  "/shipping": "/shipping",
  "/shipping-policy": "/shipping",
  "/delivery-policy": "/shipping",
  "/policies/shipping": "/shipping"
};

export function getAidreamcapesPolicySeo(path: string): PolicySeoCopy | undefined {
  const canonicalPath = AIDREAMCAPES_POLICY_ALIASES[normalizePolicyPath(path)];
  const copy = canonicalPath ? AIDREAMCAPES_POLICY_SEO_BY_CANONICAL[canonicalPath] : undefined;
  if (!copy) return undefined;
  return {
    ...copy,
    canonicalPath,
    index: true,
    follow: true
  };
}
