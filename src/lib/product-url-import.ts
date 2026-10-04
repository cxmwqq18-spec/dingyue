import "server-only";
import dns from "node:dns";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import type { IncomingMessage } from "node:http";
import { cleanProductUrl } from "@/lib/aidreamcapes-create-intent";

// Reads the main product photo and product name from a public product page
// (Aidreamcapes "URL to Video"). Only public HTTPS pages are fetched: every hop of
// every request is checked against private, loopback and reserved networks at
// connect time, redirects are re-validated, and sizes and times are capped.

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;
const MAX_IMAGE_CANDIDATES = 4;
const MIN_IMAGE_SIDE = 200;
const GOOD_IMAGE_SIDE = 800;
const SHOPIFY_IMAGE_WIDTH = 1600;
const OUTPUT_MAX_SIDE = 2000;
const USER_AGENT = "Mozilla/5.0 (compatible; AidreamcapesLinkPreview/1.0; +https://www.aivideosugc.com/ai-info)";
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp"];

export type ProductUrlImportErrorCode =
  | "product_url_invalid"
  | "product_url_blocked"
  | "product_url_fetch_failed"
  | "product_page_unsupported"
  | "product_image_not_found"
  | "product_image_unsupported";

export class ProductUrlImportError extends Error {
  constructor(public readonly code: ProductUrlImportErrorCode, public readonly status = 422) {
    super(code);
  }
}

export type ImportedProduct = {
  sourceUrl: string;
  title?: string;
  image: { bytes: Buffer; mimeType: "image/jpeg" | "image/png"; sourceUrl: string; width?: number; height?: number };
};

type SharpImage = {
  rotate: () => SharpImage;
  resize: (options: { width: number; height: number; fit: "inside"; withoutEnlargement: boolean }) => SharpImage;
  flatten: (options: { background: string }) => SharpImage;
  jpeg: (options: { quality: number; mozjpeg: boolean }) => SharpImage;
  metadata: () => Promise<{ width?: number; height?: number }>;
  toBuffer: () => Promise<Buffer>;
};
type SharpFactory = (input: Buffer, options?: { animated?: boolean; limitInputPixels?: number }) => SharpImage;

async function loadSharp(): Promise<SharpFactory | undefined> {
  try {
    const moduleName = "sharp";
    const mod = await import(/* webpackIgnore: true */ moduleName);
    return (mod.default ?? mod) as SharpFactory;
  } catch {
    return undefined;
  }
}

function ipv4FromMappedIpv6(address: string): string | undefined {
  const dotted = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1];
  const hex = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return undefined;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

/** True only for globally routable unicast addresses. */
export function isPublicIpAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b, c] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
    if (a === 192 && b === 88 && c === 99) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return a < 224;
  }
  if (!net.isIPv6(address)) return false;
  let canonical: string;
  try {
    canonical = new URL(`http://[${address}]`).hostname.slice(1, -1).toLowerCase();
  } catch {
    return false;
  }
  const mapped = ipv4FromMappedIpv6(canonical);
  if (mapped) return isPublicIpAddress(mapped);
  if (canonical.startsWith("::")) return false;
  if (/^f[c-f]/.test(canonical) || canonical.startsWith("ff")) return false;
  if (canonical.startsWith("2001:db8:") || canonical.startsWith("2001:0:") || canonical.startsWith("2002:") || canonical.startsWith("64:ff9b:") || canonical.startsWith("100::")) return false;
  return true;
}

/** Validates a customer-supplied product page link and returns it as an https URL. */
export function normalizeProductPageUrl(value: unknown): URL {
  const cleaned = cleanProductUrl(typeof value === "string" ? value : undefined);
  if (!cleaned) throw new ProductUrlImportError("product_url_invalid", 400);
  const url = new URL(cleaned);
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.username || url.password) throw new ProductUrlImportError("product_url_invalid", 400);
  if (url.port && url.port !== "443") throw new ProductUrlImportError("product_url_blocked", 400);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const literal = host.replace(/^\[|\]$/g, "");
  if (net.isIP(literal)) {
    if (!isPublicIpAddress(literal)) throw new ProductUrlImportError("product_url_blocked", 400);
  } else if (host === "localhost" || !host.includes(".") || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new ProductUrlImportError("product_url_blocked", 400);
  }
  return url;
}

// DNS lookup used for every outgoing connection: resolves the host and refuses the
// connection when any resolved address is not public, so a rebinding DNS answer
// cannot point a later hop at an internal service.
function publicOnlyLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
): void {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error, "");
    const list = Array.isArray(addresses) ? addresses : [];
    if (!list.length || list.some((entry) => !isPublicIpAddress(entry.address))) {
      const blocked = Object.assign(new Error("product_url_blocked"), { code: "EPRODUCTURLBLOCKED" }) as NodeJS.ErrnoException;
      return callback(blocked, "");
    }
    if (options.all) return callback(null, list);
    const first = options.family ? list.find((entry) => entry.family === options.family) ?? list[0] : list[0];
    return callback(null, first.address, first.family);
  });
}

type RawResponse = { status: number; location?: string; contentType: string; body?: Buffer };

function decodedStream(response: IncomingMessage): NodeJS.ReadableStream {
  const encoding = String(response.headers["content-encoding"] ?? "").trim().toLowerCase();
  if (encoding === "gzip" || encoding === "x-gzip") return response.pipe(zlib.createGunzip());
  if (encoding === "deflate") return response.pipe(zlib.createInflate());
  if (encoding === "br") return response.pipe(zlib.createBrotliDecompress());
  return response;
}

function requestOnce(url: URL, accept: string, maxBytes: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: Error | undefined, value?: RawResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (error) reject(error);
      else resolve(value!);
    };
    const request = https.request(url, {
      method: "GET",
      agent: false,
      lookup: publicOnlyLookup as unknown as net.LookupFunction,
      headers: {
        "user-agent": USER_AGENT,
        accept,
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
      const declared = Number(response.headers["content-length"] ?? "");
      if (Number.isFinite(declared) && declared > maxBytes) {
        response.destroy();
        return finish(new ProductUrlImportError(accept.startsWith("image/") ? "product_image_unsupported" : "product_page_unsupported"));
      }
      const chunks: Buffer[] = [];
      let total = 0;
      const stream = decodedStream(response);
      stream.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          response.destroy();
          finish(new ProductUrlImportError(accept.startsWith("image/") ? "product_image_unsupported" : "product_page_unsupported"));
          return;
        }
        chunks.push(chunk);
      });
      stream.on("end", () => finish(undefined, { status, contentType, body: Buffer.concat(chunks) }));
      stream.on("error", () => finish(new ProductUrlImportError("product_url_fetch_failed")));
    });
    const deadline = setTimeout(() => {
      request.destroy();
      finish(new ProductUrlImportError("product_url_fetch_failed"));
    }, REQUEST_TIMEOUT_MS);
    request.on("error", (error: NodeJS.ErrnoException) => {
      finish(new ProductUrlImportError(error.code === "EPRODUCTURLBLOCKED" ? "product_url_blocked" : "product_url_fetch_failed"));
    });
    request.end();
  });
}

async function fetchPublic(start: URL, accept: string, maxBytes: number): Promise<{ url: URL; contentType: string; body: Buffer }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await requestOnce(current, accept, maxBytes);
    if (response.location) {
      current = normalizeProductPageUrl(new URL(response.location, current).toString());
      continue;
    }
    if (!response.body) throw new ProductUrlImportError("product_url_fetch_failed");
    return { url: current, contentType: response.contentType, body: response.body };
  }
  throw new ProductUrlImportError("product_url_fetch_failed");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Math.min(Number(dec), 0x10ffff)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function tagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function cleanTitle(value: unknown): string | undefined {
  const text = typeof value === "string" ? decodeEntities(value).replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, 120) : undefined;
}

function imageUrlsFromJsonLdValue(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imageUrlsFromJsonLdValue);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [record.contentUrl, record.url].filter((item): item is string => typeof item === "string");
  }
  return [];
}

function productNodes(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(productNodes);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  const own = types.some((type) => type === "Product" || type === "ProductGroup") ? [record] : [];
  return [...own, ...productNodes(record["@graph"])];
}

// Shopify stores often reference small renditions (?width=300 or _300x300.jpg); the
// same CDN serves the full-size photo when the size hint is raised or removed.
function largerShopifyRendition(url: URL): URL {
  if (url.hostname !== "cdn.shopify.com" && !url.pathname.startsWith("/cdn/shop/")) return url;
  const next = new URL(url.toString());
  const width = Number(next.searchParams.get("width") ?? "");
  if (Number.isFinite(width) && width > 0 && width < SHOPIFY_IMAGE_WIDTH) next.searchParams.set("width", String(SHOPIFY_IMAGE_WIDTH));
  next.searchParams.delete("height");
  next.searchParams.delete("crop");
  next.pathname = next.pathname.replace(/_(?:\d+x\d*|\d*x\d+)(?:_crop_[a-z]+)?(?=(?:@\dx)?\.(?:jpe?g|png|webp)$)/i, "");
  return next;
}

/** Product name and image candidates from a product page, best first. */
export function productDetailsFromHtml(html: string, pageUrl: URL): { title?: string; imageUrls: URL[] } {
  const head = html.slice(0, MAX_HTML_BYTES);
  const metas = Array.from(head.matchAll(/<meta\b[^>]*>/gi), (match) => tagAttributes(match[0]));
  const meta = (...keys: string[]) => {
    for (const key of keys) {
      const found = metas.find((attributes) => [attributes.property, attributes.name, attributes.itemprop].some((name) => name?.toLowerCase() === key) && attributes.content);
      if (found) return found.content;
    }
    return undefined;
  };
  const products = Array.from(head.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi))
    .flatMap((match) => {
      try {
        return productNodes(JSON.parse(match[1].trim()));
      } catch {
        return [];
      }
    });
  const imageSrcLink = Array.from(head.matchAll(/<link\b[^>]*>/gi), (match) => tagAttributes(match[0]))
    .find((attributes) => attributes.rel?.toLowerCase() === "image_src" && attributes.href)?.href;
  const candidates = [
    ...products.flatMap((product) => imageUrlsFromJsonLdValue(product.image)),
    meta("og:image:secure_url"),
    meta("og:image"),
    meta("og:image:url"),
    meta("twitter:image"),
    meta("twitter:image:src"),
    imageSrcLink
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const imageUrls: URL[] = [];
  for (const candidate of candidates) {
    try {
      const url = largerShopifyRendition(normalizeProductPageUrl(new URL(candidate.trim(), pageUrl).toString()));
      if (!imageUrls.some((existing) => existing.toString() === url.toString())) imageUrls.push(url);
    } catch {
      // Skip links that are not public https images.
    }
  }
  const title = cleanTitle(products.map((product) => product.name).find((name) => typeof name === "string"))
    ?? cleanTitle(meta("og:title", "twitter:title"))
    ?? cleanTitle(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  return { title, imageUrls };
}

function sniffImageType(bytes: Buffer): "jpeg" | "png" | "webp" | "gif" | "avif" | undefined {
  if (bytes.length < 12) return undefined;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (bytes.toString("ascii", 0, 4) === "GIF8") return "gif";
  if (bytes.toString("ascii", 4, 8) === "ftyp" && /^(avif|avis|heic|heix|mif1)$/.test(bytes.toString("ascii", 8, 12))) return "avif";
  return undefined;
}

async function prepareProductImage(bytes: Buffer): Promise<{ bytes: Buffer; mimeType: "image/jpeg" | "image/png"; width?: number; height?: number }> {
  const type = sniffImageType(bytes);
  if (!type) throw new ProductUrlImportError("product_image_unsupported");
  const sharp = await loadSharp();
  if (!sharp) {
    if (type === "jpeg") return { bytes, mimeType: "image/jpeg" };
    if (type === "png") return { bytes, mimeType: "image/png" };
    throw new ProductUrlImportError("product_image_unsupported");
  }
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 60_000_000 }).metadata();
    if ((metadata.width ?? 0) < MIN_IMAGE_SIDE || (metadata.height ?? 0) < MIN_IMAGE_SIDE) throw new ProductUrlImportError("product_image_unsupported");
    const output = await sharp(bytes, { animated: false, limitInputPixels: 60_000_000 })
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    return { bytes: output, mimeType: "image/jpeg", width: metadata.width, height: metadata.height };
  } catch (error) {
    if (error instanceof ProductUrlImportError) throw error;
    throw new ProductUrlImportError("product_image_unsupported");
  }
}

/** Fetches a public product page and returns its main product photo (as JPEG) and product name. */
export async function importProductFromUrl(value: unknown): Promise<ImportedProduct> {
  const pageUrl = normalizeProductPageUrl(value);
  const page = await fetchPublic(pageUrl, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", MAX_HTML_BYTES);
  if (page.contentType && !/html|xml/.test(page.contentType)) throw new ProductUrlImportError("product_page_unsupported");
  const details = productDetailsFromHtml(page.body.toString("utf8"), page.url);
  if (!details.imageUrls.length) throw new ProductUrlImportError("product_image_not_found");
  // Keep the largest usable photo; stop early once one is big enough for a video frame.
  let best: ImportedProduct["image"] | undefined;
  let lastError: unknown;
  for (const imageUrl of details.imageUrls.slice(0, MAX_IMAGE_CANDIDATES)) {
    try {
      const image = await fetchPublic(imageUrl, "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8", MAX_IMAGE_BYTES);
      const prepared = await prepareProductImage(image.body);
      const shortSide = Math.min(prepared.width ?? 0, prepared.height ?? 0);
      if (!best || shortSide > Math.min(best.width ?? 0, best.height ?? 0)) best = { ...prepared, sourceUrl: image.url.toString() };
      if (prepared.width === undefined || shortSide >= GOOD_IMAGE_SIDE) break;
    } catch (error) {
      lastError = error;
    }
  }
  if (best) return { sourceUrl: page.url.toString(), ...(details.title ? { title: details.title } : {}), image: best };
  if (lastError instanceof ProductUrlImportError && lastError.code === "product_url_blocked") throw lastError;
  throw new ProductUrlImportError("product_image_not_found");
}
