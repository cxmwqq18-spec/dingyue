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
    canonicalPath: "/policies/privacy",
    index: true,
    follow: true
  },
  "/privacy-policy": {
    title: "Privacy Policy for AI Photo Uploads, Credits, and Private Albums",
    description:
      "Read how MydreamShoots protects account data, uploaded source photos, generated AI portraits, credit activity, checkout records, cookies, and private album access on www.mydreamshoots.com.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/policies/privacy",
    index: true,
    follow: true
  },
  "/policies/terms": {
    title: "Terms of Service for MydreamShoots AI Photo Packages",
    description:
      "Review the MydreamShoots terms for customer accounts, AI photo credits, subscriptions, Stripe checkout, upload rights, generated portraits, failed jobs, refunds, and private gallery access.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/policies/terms",
    index: true,
    follow: true
  },
  "/terms-of-service": {
    title: "Terms of Service for MydreamShoots AI Photo Packages",
    description:
      "Review the MydreamShoots terms for customer accounts, AI photo credits, subscriptions, Stripe checkout, upload rights, generated portraits, failed jobs, refunds, and private gallery access.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/policies/terms",
    index: true,
    follow: true
  },
  "/policies/cookies": {
    title: "Cookie Policy for MydreamShoots Sign-In, Checkout, and Albums",
    description:
      "Learn how MydreamShoots uses essential cookies, local storage, security checks, checkout continuity, preference memory, analytics, and provider tools for its AI photo service.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/policies/cookies",
    index: true,
    follow: true
  },
  "/cookie-policy": {
    title: "Cookie Policy for MydreamShoots Sign-In, Checkout, and Albums",
    description:
      "Learn how MydreamShoots uses essential cookies, local storage, security checks, checkout continuity, preference memory, analytics, and provider tools for its AI photo service.",
    keywords: POLICY_KEYWORDS,
    canonicalPath: "/policies/cookies",
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
