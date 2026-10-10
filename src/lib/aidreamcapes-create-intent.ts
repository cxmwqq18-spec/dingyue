// Aidreamcapes.com v2 storefront links open the workspace with a template already set up, e.g.
//   /app/create?tool=ugc-ad-video&template=ugc-ad&size=9:16&length=15&prompt=...#step-video
//   /app/create?tool=url-to-video&size=9:16&length=15&url=https://store.example/products/mug
//   /app/create?tool_id=image_generator&tool=lifestyle-scene&prompt=...
// Only values the workspace offers are accepted; anything else is ignored, so a link
// can never select an option a customer could not pick by hand.
export const AIDREAMCAPES_CREATE_INTENT_SITE_ID = "site_aidreamcapes";

const VIDEO_SIZES = ["9:16", "1:1", "16:9", "4:3", "3:4"] as const;
const VIDEO_LENGTHS = [6, 10, 15] as const;
const MAX_PROMPT_LENGTH = 600;
const MAX_PRODUCT_URL_LENGTH = 2048;
const TOOL_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;

export type AidreamcapesCreateIntentVideoSize = (typeof VIDEO_SIZES)[number];

export type AidreamcapesCreateIntent =
  | {
      kind: "video";
      key: string;
      tool: string;
      size?: AidreamcapesCreateIntentVideoSize;
      length?: (typeof VIDEO_LENGTHS)[number];
      prompt?: string;
      productUrl?: string;
    }
  | { kind: "photo"; key: string; tool?: string; prompt?: string };

type SearchParamsLike = { get(name: string): string | null };

function cleanPrompt(value: string | null): string | undefined {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, MAX_PROMPT_LENGTH) : undefined;
}

function cleanTool(value: string | null): string | undefined {
  const tool = (value ?? "").trim().toLowerCase();
  return TOOL_SLUG_RE.test(tool) ? tool : undefined;
}

/** A product page link as typed by a customer: adds https:// when missing, accepts http(s) only. */
export function cleanProductUrl(value: string | null | undefined): string | undefined {
  const raw = (value ?? "").trim();
  if (!raw || raw.length > MAX_PRODUCT_URL_LENGTH) return undefined;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (!url.hostname.includes(".")) return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

export function aidreamcapesCreateIntentFromSearchParams(params: SearchParamsLike): AidreamcapesCreateIntent | undefined {
  const prompt = cleanPrompt(params.get("prompt"));
  if (params.get("tool_id") === "image_generator") {
    const tool = cleanTool(params.get("tool"));
    return { kind: "photo", key: `photo:${tool ?? ""}:${prompt ?? ""}`, ...(tool ? { tool } : {}), ...(prompt ? { prompt } : {}) };
  }
  const tool = cleanTool(params.get("tool"));
  if (!tool) return undefined;
  const size = VIDEO_SIZES.find((candidate) => candidate === params.get("size"));
  const length = VIDEO_LENGTHS.find((candidate) => String(candidate) === params.get("length"));
  const productUrl = tool === "url-to-video" ? cleanProductUrl(params.get("url")) : undefined;
  return {
    kind: "video",
    key: `video:${tool}:${size ?? ""}:${length ?? ""}:${prompt ?? ""}:${productUrl ?? ""}`,
    tool,
    ...(size ? { size } : {}),
    ...(length ? { length } : {}),
    ...(prompt ? { prompt } : {}),
    ...(productUrl ? { productUrl } : {})
  };
}
