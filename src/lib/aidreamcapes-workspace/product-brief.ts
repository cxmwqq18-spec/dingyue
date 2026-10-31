import "server-only";
import dns from "node:dns";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import type { IncomingMessage } from "node:http";
import {
  isPublicIpAddress,
  normalizeProductPageUrl,
  ProductUrlImportError,
  productDetailsFromHtml
} from "@/lib/product-url-import";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 4;
const MAX_IMAGES = 8;
const USER_AGENT = "Mozilla/5.0 (compatible; AidreamcapesProductBriefPreview/1.0)";

export type BriefConfidence = "high" | "medium" | "low";

export type SourcedBriefValue<T> = {
  value: T;
  sourceUrl: string;
  sourceLabel: string;
  confidence: BriefConfidence;
  confirmed: false;
};

export type ProductBriefDraft = {
  title: SourcedBriefValue<string> | null;
  description: SourcedBriefValue<string> | null;
  detectedImages: Array<SourcedBriefValue<string> & { sourcePageUrl: string }>;
  possiblePrice: SourcedBriefValue<{ amount: string; currency?: string }> | null;
  /** Variant axes the page declares (sizes, colors, materials) with their
   * offer prices — everything the prompt optimizer can use as product facts. */
  variants: SourcedBriefValue<{ label: string; price?: string; currency?: string }[]> | null;
  confirmed: false;
  reviewRequired: true;
};

export type ProductBriefPreview = {
  sourceUrl: string;
  fetchedPageUrl: string;
  draft: ProductBriefDraft;
};

type RawHtmlResponse = { status: number; location?: string; contentType: string; body?: Buffer };
type MetaEntry = { property?: string; name?: string; itemprop?: string; content?: string };
type ImageSource = { value: string; label: string; confidence: BriefConfidence };

function isSafePublicAddress(address: string): boolean {
  if (!isPublicIpAddress(address)) return false;
  if (net.isIPv4(address)) {
    const [a, b, c] = address.split(".").map(Number);
    // Block additional special-purpose IPv4 space not rejected by the shared
    // importer check. Fetches should reach globally routed public hosts only.
    if ((a === 192 && b === 0) || (a === 192 && b === 31 && c === 196) ||
        (a === 192 && b === 52 && c === 193) || (a === 192 && b === 175 && c === 48)) return false;
    return true;
  }

  if (!net.isIPv6(address)) return false;
  let canonical: string;
  try {
    canonical = new URL(`http://[${address}]`).hostname.slice(1, -1).toLowerCase();
  } catch {
    return false;
  }
  const mapped = canonical.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isSafePublicAddress(mapped[1]);
  const mappedHex = canonical.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return isSafePublicAddress([high >> 8, high & 255, low >> 8, low & 255].join("."));
  }

  const firstHextet = Number.parseInt(canonical.split(":", 1)[0] || "0", 16);
  if (firstHextet < 0x2000 || firstHextet > 0x3fff) return false;
  if (canonical.startsWith("2001:db8:") || canonical.startsWith("2001:0:") ||
      canonical.startsWith("2002:") || canonical.startsWith("3fff:")) return false;
  const secondHextet = Number.parseInt(canonical.split(":")[1] || "0", 16);
  if (canonical.startsWith("2001:") && secondHextet <= 0x01ff) return false;
  return true;
}

function normalizeSafeHttpsUrl(value: unknown): URL {
  const url = normalizeProductPageUrl(value);
  if (url.protocol !== "https:") throw new ProductUrlImportError("product_url_blocked", 400);
  const literal = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (net.isIP(literal) && !isSafePublicAddress(literal)) {
    throw new ProductUrlImportError("product_url_blocked", 400);
  }
  return url;
}

function publicOnlyLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
): void {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error, "");
    if (!addresses.length || addresses.some(({ address }) => !isSafePublicAddress(address))) {
      const blocked = Object.assign(new Error("product_url_blocked"), { code: "EPRODUCTURLBLOCKED" }) as NodeJS.ErrnoException;
      return callback(blocked, "");
    }
    if (options.all) return callback(null, addresses);
    const address = options.family ? addresses.find((entry) => entry.family === options.family) ?? addresses[0] : addresses[0];
    return callback(null, address.address, address.family);
  });
}

function decodedStream(response: IncomingMessage): NodeJS.ReadableStream {
  const encoding = String(response.headers["content-encoding"] ?? "").trim().toLowerCase();
  if (encoding === "gzip" || encoding === "x-gzip") return response.pipe(zlib.createGunzip());
  if (encoding === "deflate") return response.pipe(zlib.createInflate());
  if (encoding === "br") return response.pipe(zlib.createBrotliDecompress());
  return response;
}

function requestHtmlOnce(url: URL, deadline: number): Promise<RawHtmlResponse> {
  return new Promise((resolve, reject) => {
    const timeoutMs = Math.max(1, deadline - Date.now());
    let settled = false;
    const finish = (error?: Error, value?: RawHtmlResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value!);
    };

    const request = https.request(url, {
      method: "GET",
      agent: false,
      lookup: publicOnlyLookup as unknown as net.LookupFunction,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml;q=0.9",
        "accept-language": "en-US,en;q=0.8",
        "accept-encoding": "gzip, deflate, br"
      }
    }, (response) => {
      const status = response.statusCode ?? 0;
      const contentType = String(response.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        return finish(undefined, { status, location: String(response.headers.location), contentType });
      }
      if (status < 200 || status >= 300) {
        response.resume();
        return finish(undefined, { status, contentType });
      }
      const encoding = String(response.headers["content-encoding"] ?? "").trim().toLowerCase();
      if (encoding && !["identity", "gzip", "x-gzip", "deflate", "br"].includes(encoding)) {
        response.resume();
        return finish(new ProductUrlImportError("product_page_unsupported"));
      }
      const declared = Number(response.headers["content-length"] ?? "");
      if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) {
        response.destroy();
        return finish(new ProductUrlImportError("product_page_unsupported"));
      }

      const chunks: Buffer[] = [];
      let total = 0;
      const stream = decodedStream(response);
      stream.on("data", (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += bytes.length;
        if (total > MAX_HTML_BYTES) {
          response.destroy();
          return finish(new ProductUrlImportError("product_page_unsupported"));
        }
        chunks.push(bytes);
      });
      stream.on("end", () => finish(undefined, { status, contentType, body: Buffer.concat(chunks) }));
      stream.on("error", () => finish(new ProductUrlImportError("product_url_fetch_failed")));
    });
    const timer = setTimeout(() => {
      request.destroy();
      finish(new ProductUrlImportError("product_url_fetch_failed"));
    }, timeoutMs);
    request.on("error", (error: NodeJS.ErrnoException) => {
      finish(new ProductUrlImportError(error.code === "EPRODUCTURLBLOCKED" ? "product_url_blocked" : "product_url_fetch_failed"));
    });
    request.end();
  });
}

async function fetchPublicHtml(start: URL): Promise<{ url: URL; html: string }> {
  let current = start;
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (Date.now() >= deadline) throw new ProductUrlImportError("product_url_fetch_failed");
    const response = await requestHtmlOnce(current, deadline);
    if (response.location) {
      if (hop === MAX_REDIRECTS) throw new ProductUrlImportError("product_url_fetch_failed");
      try {
        current = normalizeSafeHttpsUrl(new URL(response.location, current).toString());
      } catch (error) {
        if (error instanceof ProductUrlImportError) throw error;
        throw new ProductUrlImportError("product_url_blocked", 400);
      }
      continue;
    }
    if (!response.body) throw new ProductUrlImportError("product_url_fetch_failed");
    if (response.contentType && !/^(text\/html|application\/xhtml\+xml)$/.test(response.contentType)) {
      throw new ProductUrlImportError("product_page_unsupported");
    }
    return { url: current, html: response.body.toString("utf8") };
  }
  throw new ProductUrlImportError("product_url_fetch_failed");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_match, decimal: string) => {
      const code = Number(decimal);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function tagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function collectMetas(html: string): MetaEntry[] {
  return Array.from(html.matchAll(/<meta\b[^>]*>/gi), (match) => tagAttributes(match[0]));
}

function metaValue(metas: MetaEntry[], key: string): string | undefined {
  const found = metas.find((meta) => [meta.property, meta.name, meta.itemprop].some((name) => name?.toLowerCase() === key) && meta.content);
  return found?.content;
}

function productNodes(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(productNodes);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  const isProduct = types.some((type) => typeof type === "string" && ["Product", "ProductGroup"].includes(type.split(/[\/#]/).pop() || ""));
  return [...(isProduct ? [record] : []), ...productNodes(record["@graph"]), ...productNodes(record.mainEntity)];
}

function productJsonLd(html: string): Array<Record<string, unknown>> {
  const products: Array<Record<string, unknown>> = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      products.push(...productNodes(JSON.parse(match[1].trim())));
    } catch {
      // Static JSON-LD only. Invalid JSON is ignored and never executed.
    }
  }
  return products;
}

function imageValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imageValues);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record.contentUrl, record.url].filter((item): item is string => typeof item === "string");
}

function sourced<T>(value: T, sourceUrl: string, sourceLabel: string, confidence: BriefConfidence): SourcedBriefValue<T> {
  return { value, sourceUrl, sourceLabel, confidence, confirmed: false };
}

function normalizeImageCandidate(value: string, pageUrl: URL): URL | undefined {
  try {
    return normalizeSafeHttpsUrl(new URL(value.trim(), pageUrl).toString());
  } catch {
    return undefined;
  }
}

function jsonLdPrice(products: Array<Record<string, unknown>>): { amount: string; currency?: string } | undefined {
  for (const product of products) {
    const rawOffers = Array.isArray(product.offers) ? product.offers : [product.offers];
    for (const rawOffer of rawOffers) {
      if (!rawOffer || typeof rawOffer !== "object") continue;
      const offer = rawOffer as Record<string, unknown>;
      const amount = explicitAmount(offer.price);
      if (!amount) continue;
      const currency = typeof offer.priceCurrency === "string" && /^[A-Z]{3}$/.test(offer.priceCurrency.trim())
        ? offer.priceCurrency.trim()
        : undefined;
      return { amount, ...(currency ? { currency } : {}) };
    }
  }
  return undefined;
}

function explicitAmount(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const amount = String(value).trim();
  return /^(?:0|[1-9]\d{0,8})(?:\.\d{1,4})?$/.test(amount) ? amount : undefined;
}

/** Variant entries from JSON-LD: Product.hasVariant[].offers plus Offer lists.
 * Each entry keeps a readable label (size / color / sku name) and its price
 * when the page declares one. */
function jsonLdVariants(products: Array<Record<string, unknown>>): { label: string; price?: string; currency?: string }[] {
  const variants: { label: string; price?: string; currency?: string }[] = [];
  const seen = new Set<string>();
  const offerLabel = (offer: Record<string, unknown>): string =>
    [offer.name, offer.sku, offer.size, offer.color]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80)
      .join(" · ").trim();
  const pushOffer = (offer: Record<string, unknown>, extraLabel?: string) => {
    const label = [extraLabel, offerLabel(offer)].filter(Boolean).join(" · ");
    const price = explicitAmount(offer.price) ?? explicitAmount(offer.lowPrice);
    if (!label && !price) return;
    const key = `${label}|${price ?? ""}`;
    if (seen.has(key) || variants.length >= 24) return;
    seen.add(key);
    const currency = typeof offer.priceCurrency === "string" && /^[A-Z]{3}$/.test(offer.priceCurrency.trim()) ? offer.priceCurrency.trim() : undefined;
    variants.push({ ...(label ? { label } : {}), ...(price ? { price, ...(currency ? { currency } : {}) } : {}) } as { label: string; price?: string; currency?: string });
  };
  const offerNodes = (value: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(value)) return value.flatMap(offerNodes);
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    return [record, ...offerNodes(record.offers), ...offerNodes(record.hasVariant), ...offerNodes(record.additionalProperty)];
  };
  for (const product of products) {
    for (const raw of offerNodes(product.offers)) pushOffer(raw);
    for (const raw of offerNodes(product.hasVariant)) {
      const nested = offerNodes(raw.offers);
      if (nested.length) nested.forEach((offer) => pushOffer(offer, offerLabel(raw)));
      else pushOffer(raw, offerLabel(raw));
    }
  }
  return variants;
}

function metaPrice(metas: MetaEntry[]): { amount: string; currency?: string; sourceLabel: string } | undefined {
  const explicitSources = [
    { key: "product:price:amount", currencyKeys: ["product:price:currency"], label: "Meta product:price:amount" },
    { key: "og:price:amount", currencyKeys: ["og:price:currency"], label: "Open Graph og:price:amount" },
    { key: "price", currencyKeys: ["pricecurrency"], label: "Microdata itemprop=price" }
  ];
  for (const source of explicitSources) {
    const amount = explicitAmount(metaValue(metas, source.key));
    if (!amount) continue;
    const rawCurrency = source.currencyKeys.map((key) => metaValue(metas, key)).find(Boolean)?.trim();
    const currency = rawCurrency && /^[A-Z]{3}$/i.test(rawCurrency) ? rawCurrency.toUpperCase() : undefined;
    return { amount, ...(currency ? { currency } : {}), sourceLabel: source.label };
  }
  return undefined;
}

/** Parse a supplied HTML fixture without performing any network request. */
export function parseProductBriefHtml(html: string, pageUrlInput: string | URL): ProductBriefDraft {
  const pageUrl = normalizeSafeHttpsUrl(pageUrlInput.toString());
  const head = html.slice(0, MAX_HTML_BYTES);
  const metas = collectMetas(head);
  const products = productJsonLd(head);
  const pageSourceUrl = pageUrl.toString();

  const jsonLdTitle = products.map((product) => cleanText(product.name, 180)).find(Boolean);
  const ogTitle = cleanText(metaValue(metas, "og:title"), 180);
  const twitterTitle = cleanText(metaValue(metas, "twitter:title"), 180);
  const htmlTitle = cleanText(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1], 180);
  const title = jsonLdTitle
    ? sourced(jsonLdTitle, pageSourceUrl, "JSON-LD Product.name", "high")
    : ogTitle
      ? sourced(ogTitle, pageSourceUrl, "Open Graph og:title", "medium")
      : twitterTitle
        ? sourced(twitterTitle, pageSourceUrl, "Twitter card twitter:title", "medium")
        : htmlTitle
          ? sourced(htmlTitle, pageSourceUrl, "HTML title", "low")
          : null;

  const jsonLdDescription = products.map((product) => cleanText(product.description, 600)).find(Boolean);
  const ogDescription = cleanText(metaValue(metas, "og:description"), 600);
  const metaDescription = cleanText(metaValue(metas, "description"), 600);
  const description = jsonLdDescription
    ? sourced(jsonLdDescription, pageSourceUrl, "JSON-LD Product.description", "high")
    : ogDescription
      ? sourced(ogDescription, pageSourceUrl, "Open Graph og:description", "medium")
      : metaDescription
        ? sourced(metaDescription, pageSourceUrl, "Meta description", "low")
        : null;

  const imageSources: ImageSource[] = products.flatMap((product) => imageValues(product.image).map((value) => ({
    value, label: "JSON-LD Product.image", confidence: "high" as const
  })));
  const metaImageKeys: Array<{ key: string; label: string }> = [
    { key: "og:image:secure_url", label: "Open Graph og:image:secure_url" },
    { key: "og:image", label: "Open Graph og:image" },
    { key: "og:image:url", label: "Open Graph og:image:url" },
    { key: "twitter:image", label: "Twitter card twitter:image" },
    { key: "twitter:image:src", label: "Twitter card twitter:image:src" }
  ];
  for (const source of metaImageKeys) {
    const value = metaValue(metas, source.key);
    if (value) imageSources.push({ value, label: source.label, confidence: "medium" });
  }
  const imageSrcLink = Array.from(head.matchAll(/<link\b[^>]*>/gi), (match) => tagAttributes(match[0]))
    .find((attributes) => attributes.rel?.toLowerCase() === "image_src" && attributes.href)?.href;
  if (imageSrcLink) imageSources.push({ value: imageSrcLink, label: "HTML link rel=image_src", confidence: "low" });

  // Reuse the shared importer parser for its supported image URL normalization
  // and platform-specific rendition handling, without fetching image bytes.
  const parsedDetails = productDetailsFromHtml(head, pageUrl);
  const detectedImages: Array<SourcedBriefValue<string> & { sourcePageUrl: string }> = [];
  const seenImages = new Set<string>();
  for (const imageUrl of parsedDetails.imageUrls) {
    const value = imageUrl.toString();
    if (seenImages.has(value)) continue;
    seenImages.add(value);
    const matchingSource = imageSources.find((source) => normalizeImageCandidate(source.value, pageUrl)?.toString() === value);
    detectedImages.push({
      ...sourced(value, value, matchingSource?.label ?? "Product page image metadata", matchingSource?.confidence ?? "low"),
      sourcePageUrl: pageSourceUrl
    });
    if (detectedImages.length >= MAX_IMAGES) break;
  }

  const structuredPrice = jsonLdPrice(products);
  const explicitMetaPrice = metaPrice(metas);
  const possiblePrice = structuredPrice
    ? sourced(structuredPrice, pageSourceUrl, "JSON-LD Offer.price", "high")
    : explicitMetaPrice
      ? sourced({ amount: explicitMetaPrice.amount, ...(explicitMetaPrice.currency ? { currency: explicitMetaPrice.currency } : {}) }, pageSourceUrl, explicitMetaPrice.sourceLabel, "medium")
      : null;
  const detectedVariants = jsonLdVariants(products);

  return {
    title, description, detectedImages, possiblePrice,
    variants: detectedVariants.length ? sourced(detectedVariants, pageSourceUrl, "JSON-LD offers/hasVariant", "high") : null,
    confirmed: false, reviewRequired: true
  };
}

/** Fetches a public HTTPS page and returns a review-only, sourced product brief. */
export async function previewProductBrief(value: unknown): Promise<ProductBriefPreview> {
  const start = normalizeSafeHttpsUrl(value);
  const { url, html } = await fetchPublicHtml(start);
  return {
    sourceUrl: start.toString(),
    fetchedPageUrl: url.toString(),
    draft: parseProductBriefHtml(html, url)
  };
}
