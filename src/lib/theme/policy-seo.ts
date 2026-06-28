export interface PolicySeoCopy {
  title: string;
  description: string;
  keywords: string;
  canonicalPath: string;
  index: boolean;
  follow: boolean;
}

const POLICY_KEYWORDS = [
  "MydreamShoots policy",
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
      "Read how MydreamShoots protects account data, uploaded source photos, generated AI portraits, credit activity, checkout records, cookies, and private album access on www.mydreamshoots.com.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/privacy",
    index: true,
    follow: true
  },
  "/privacy": {
    title: "Privacy Policy for AI Photo Uploads, Credits, and Private Albums",
    description:
      "Read how MydreamShoots protects account data, uploaded source photos, generated AI portraits, credit activity, checkout records, cookies, and private album access on www.mydreamshoots.com.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/privacy",
    index: true,
    follow: true
  },
  "/privacy-policy": {
    title: "Privacy Policy for AI Photo Uploads, Credits, and Private Albums",
    description:
      "Read how MydreamShoots protects account data, uploaded source photos, generated AI portraits, credit activity, checkout records, cookies, and private album access on www.mydreamshoots.com.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/privacy",
    index: true,
    follow: true
  },
  "/policies/terms": {
    title: "Terms of Service for MydreamShoots AI Photo Packages",
    description:
      "Review the MydreamShoots terms for customer accounts, AI photo credits, subscriptions, Stripe checkout, upload rights, generated portraits, failed jobs, refunds, and private gallery access.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/terms",
    index: true,
    follow: true
  },
  "/terms": {
    title: "Terms of Service for MydreamShoots AI Photo Packages",
    description:
      "Review the MydreamShoots terms for customer accounts, AI photo credits, subscriptions, Stripe checkout, upload rights, generated portraits, failed jobs, refunds, and private gallery access.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/terms",
    index: true,
    follow: true
  },
  "/terms-of-service": {
    title: "Terms of Service for MydreamShoots AI Photo Packages",
    description:
      "Review the MydreamShoots terms for customer accounts, AI photo credits, subscriptions, Stripe checkout, upload rights, generated portraits, failed jobs, refunds, and private gallery access.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/terms",
    index: true,
    follow: true
  },
  "/policies/cookies": {
    title: "Cookie Policy for MydreamShoots Sign-In, Checkout, and Albums",
    description:
      "Learn how MydreamShoots uses essential cookies, local storage, security checks, checkout continuity, preference memory, analytics, and provider tools for its AI photo service.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/cookies",
    index: true,
    follow: true
  },
  "/cookies": {
    title: "Cookie Policy for MydreamShoots Sign-In, Checkout, and Albums",
    description:
      "Learn how MydreamShoots uses essential cookies, local storage, security checks, checkout continuity, preference memory, analytics, and provider tools for its AI photo service.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/cookies",
    index: true,
    follow: true
  },
  "/cookie-policy": {
    title: "Cookie Policy for MydreamShoots Sign-In, Checkout, and Albums",
    description:
      "Learn how MydreamShoots uses essential cookies, local storage, security checks, checkout continuity, preference memory, analytics, and provider tools for its AI photo service.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/cookies",
    index: true,
    follow: true
  },
  "/policies/refunds": {
    title: "Refund Policy for MydreamShoots Credits, Plans, and Failed Jobs",
    description:
      "Review how MydreamShoots handles refund eligibility, unused AI photo credits, subscription cancellations, technical failures, reruns, billing reversals, and account credit history.",
    keywords: [
      POLICY_KEYWORDS,
      "MydreamShoots refund policy",
      "AI photo credit refund",
      "subscription credit refund",
      "failed AI job refund"
    ].join(", "),
    canonicalPath: "/refunds",
    index: true,
    follow: true
  },
  "/refunds": {
    title: "Refund Policy for MydreamShoots Credits, Plans, and Failed Jobs",
    description:
      "Review how MydreamShoots handles refund eligibility, unused AI photo credits, subscription cancellations, technical failures, reruns, billing reversals, and account credit history.",
    keywords: [
      POLICY_KEYWORDS,
      "MydreamShoots refund policy",
      "AI photo credit refund",
      "subscription credit refund",
      "failed AI job refund"
    ].join(", "),
    canonicalPath: "/refunds",
    index: true,
    follow: true
  },
  "/refund-policy": {
    title: "Refund Policy for MydreamShoots Credits, Plans, and Failed Jobs",
    description:
      "Review how MydreamShoots handles refund eligibility, unused AI photo credits, subscription cancellations, technical failures, reruns, billing reversals, and account credit history.",
    keywords: [
      POLICY_KEYWORDS,
      "MydreamShoots refund policy",
      "AI photo credit refund",
      "subscription credit refund",
      "failed AI job refund"
    ].join(", "),
    canonicalPath: "/refunds",
    index: true,
    follow: true
  },
  "/policies/content": {
    title: "Content Policy for MydreamShoots Uploads and AI Photo Outputs",
    description:
      "Read the MydreamShoots content policy for permitted source photos, upload rights, identity consent, private AI albums, moderation review, blocked requests, and responsible output use.",
    keywords: [
      POLICY_KEYWORDS,
      "MydreamShoots content policy",
      "AI photo upload rules",
      "AI portrait consent",
      "private AI output policy"
    ].join(", "),
    canonicalPath: "/content",
    index: true,
    follow: true
  },
  "/content": {
    title: "Content Policy for MydreamShoots Uploads and AI Photo Outputs",
    description:
      "Read the MydreamShoots content policy for permitted source photos, upload rights, identity consent, private AI albums, moderation review, blocked requests, and responsible output use.",
    keywords: [
      POLICY_KEYWORDS,
      "MydreamShoots content policy",
      "AI photo upload rules",
      "AI portrait consent",
      "private AI output policy"
    ].join(", "),
    canonicalPath: "/content",
    index: true,
    follow: true
  },
  "/content-policy": {
    title: "Content Policy for MydreamShoots Uploads and AI Photo Outputs",
    description:
      "Read the MydreamShoots content policy for permitted source photos, upload rights, identity consent, private AI albums, moderation review, blocked requests, and responsible output use.",
    keywords: [
      POLICY_KEYWORDS,
      "MydreamShoots content policy",
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

export function getMydreamshootsPolicySeo(path: string): PolicySeoCopy | undefined {
  return MYDREAMSHOOTS_POLICY_SEO_BY_PATH[normalizePolicyPath(path)];
}
