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
  },
  "/policies/children-privacy": {
    title: "Children's Privacy Notice for MyDreamShoots AI Photo Uploads",
    description:
      "Read the MyDreamShoots children's privacy notice for COPPA-aware account access, minor image uploads, parent or guardian requests, and private AI photo handling.",
    keywords: [
      POLICY_KEYWORDS,
      "children privacy notice",
      "COPPA AI photo policy",
      "minor photo upload privacy",
      "parent deletion request"
    ].join(", "),
    canonicalPath: "/children-privacy",
    index: true,
    follow: true
  },
  "/children-privacy": {
    title: "Children's Privacy Notice for MyDreamShoots AI Photo Uploads",
    description:
      "Read the MyDreamShoots children's privacy notice for COPPA-aware account access, minor image uploads, parent or guardian requests, and private AI photo handling.",
    keywords: [
      POLICY_KEYWORDS,
      "children privacy notice",
      "COPPA AI photo policy",
      "minor photo upload privacy",
      "parent deletion request"
    ].join(", "),
    canonicalPath: "/children-privacy",
    index: true,
    follow: true
  },
  "/policies/state-privacy": {
    title: "State Privacy Rights for California, Delaware, and U.S. Customers",
    description:
      "Review MyDreamShoots state privacy rights information for California privacy requests, Delaware entity contact details, access, deletion, correction, opt-out choices, and proposed federal privacy legislation monitoring.",
    keywords: [
      POLICY_KEYWORDS,
      "California privacy rights",
      "CCPA privacy request",
      "state privacy law",
      "Delaware company privacy contact",
      "SECURE Data Act privacy monitoring",
      "GUARD Financial Data Act privacy monitoring"
    ].join(", "),
    canonicalPath: "/state-privacy",
    index: true,
    follow: true
  },
  "/state-privacy": {
    title: "State Privacy Rights for California, Delaware, and U.S. Customers",
    description:
      "Review MyDreamShoots state privacy rights information for California privacy requests, Delaware entity contact details, access, deletion, correction, opt-out choices, and proposed federal privacy legislation monitoring.",
    keywords: [
      POLICY_KEYWORDS,
      "California privacy rights",
      "CCPA privacy request",
      "state privacy law",
      "Delaware company privacy contact",
      "SECURE Data Act privacy monitoring",
      "GUARD Financial Data Act privacy monitoring"
    ].join(", "),
    canonicalPath: "/state-privacy",
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
  const protocol = host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return host ? `${protocol}://${host}${normalizedPath}` : normalizedPath;
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
  },
  "/children-privacy": {
    title: "Aidreamcapes Minor Source Photo Privacy",
    description:
      "Learn how Aidreamcapes reviews guardian requests, minor source-photo concerns, uploaded portraits, generated travel images, and private gallery removal questions.",
    keywords: [
      AIDREAMCAPES_POLICY_KEYWORDS,
      "minor source photo privacy",
      "guardian source photo request",
      "COPPA travel portrait review",
      "private gallery removal"
    ].join(", ")
  },
  "/state-privacy": {
    title: "Aidreamcapes U.S. Privacy Choices",
    description:
      "Use Aidreamcapes privacy choices for California and other U.S. requests involving account access, deletion, correction, private galleries, and Wyoming company contact details.",
    keywords: [
      AIDREAMCAPES_POLICY_KEYWORDS,
      "California data request",
      "CCPA privacy option",
      "Wyoming privacy contact",
      "private gallery deletion",
      "Aidreamcapes privacy choices"
    ].join(", ")
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
  "/policies/shipping": "/shipping",
  "/children-privacy": "/children-privacy",
  "/children-privacy-policy": "/children-privacy",
  "/childrens-privacy": "/children-privacy",
  "/policies/children-privacy": "/children-privacy",
  "/state-privacy": "/state-privacy",
  "/state-privacy-rights": "/state-privacy",
  "/california-privacy": "/state-privacy",
  "/ccpa": "/state-privacy",
  "/policies/state-privacy": "/state-privacy"
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

const SPANISH_XBY_POLICY_KEYWORDS = [
  "politica tienda IA",
  "privacidad fotos IA",
  "terminos generador IA",
  "creditos IA",
  "galeria privada",
  "fotos fuente"
].join(", ");

const SPANISH_XBY_POLICY_ALIASES: Record<string, string> = {
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
  "/policies/refund": "/refunds",
  "/policies/refunds": "/refunds",
  "/content": "/content",
  "/content-policy": "/content",
  "/policies/content": "/content",
  "/shipping": "/shipping",
  "/shipping-policy": "/shipping",
  "/delivery-policy": "/shipping",
  "/policies/shipping": "/shipping"
};

function spanishXbyBrand(site: { name?: string | null; branding?: { logoText?: string | null } }): string {
  return String(site.branding?.logoText || site.name || "Tienda IA").trim();
}

function isSpanishAidreamcapesXby(site: { id?: string | null; slug?: string | null; name?: string | null; primaryDomain?: string | null; branding?: { logoText?: string | null } }): boolean {
  return `${site.id ?? ""} ${site.slug ?? ""} ${site.name ?? ""} ${site.primaryDomain ?? ""} ${site.branding?.logoText ?? ""}`.toLowerCase().includes("aidreamcapes");
}

export function getSpanishXbyPolicySeo(
  site: { id?: string | null; slug?: string | null; name?: string | null; primaryDomain?: string | null; branding?: { logoText?: string | null } },
  path: string
): PolicySeoCopy | undefined {
  const canonicalPath = SPANISH_XBY_POLICY_ALIASES[normalizePolicyPath(path)];
  if (!canonicalPath) return undefined;

  const brand = spanishXbyBrand(site);
  const aidreamcapes = isSpanishAidreamcapesXby(site);
  const subject = aidreamcapes ? "retratos de viaje con IA" : "fotos y retratos con IA";
  const copies: Record<string, Omit<PolicySeoCopy, "canonicalPath" | "index" | "follow">> = {
    "/privacy": {
      title: `Politica de privacidad | ${brand}`,
      description: `Consulta como ${brand} gestiona cuentas, fotos subidas, pedidos, creditos, datos de pago, solicitudes de ${subject} y galerias privadas.`,
      keywords: SPANISH_XBY_POLICY_KEYWORDS
    },
    "/terms": {
      title: `Terminos de servicio | ${brand}`,
      description: `Revisa los terminos de cuenta, creditos, subidas, pago, generacion, galerias privadas, reembolsos y uso aceptable de ${brand}.`,
      keywords: SPANISH_XBY_POLICY_KEYWORDS
    },
    "/cookies": {
      title: `Politica de cookies | ${brand}`,
      description: `Consulta como ${brand} usa cookies y almacenamiento local para sesiones, pago, seguridad, preferencias, creditos y analitica operativa.`,
      keywords: SPANISH_XBY_POLICY_KEYWORDS
    },
    "/refunds": {
      title: `Revision de creditos y reembolsos | ${brand}`,
      description: `Consulta como ${brand} revisa creditos sin usar, pedidos fallidos, cambios de plan, incidencias de facturacion, reruns y solicitudes elegibles.`,
      keywords: SPANISH_XBY_POLICY_KEYWORDS
    },
    "/content": {
      title: `Politica de contenido | ${brand}`,
      description: `Revisa las reglas de ${brand} sobre fotos fuente, consentimiento, identidad, contenido permitido, moderacion y uso responsable de resultados generados.`,
      keywords: SPANISH_XBY_POLICY_KEYWORDS
    },
    "/shipping": {
      title: `Entrega digital | ${brand}`,
      description: `Revisa como ${brand} entrega creditos, imagenes generadas, descargas y galerias privadas de forma digital, sin envio fisico ni tracking postal.`,
      keywords: SPANISH_XBY_POLICY_KEYWORDS
    }
  };
  const copy = copies[canonicalPath];
  if (!copy) return undefined;
  return {
    ...copy,
    canonicalPath,
    index: true,
    follow: true
  };
}
