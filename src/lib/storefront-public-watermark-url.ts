export const STOREFRONT_PUBLIC_WATERMARK_CACHE_VERSION = "20260803watermark30sync1";

const storefrontPublicMediaPattern = /\.(?:avif|jpe?g|png|svg|webp|m4v|mov|mp4|webm)$/i;

export function withStorefrontPublicWatermarkUrl(value: string | undefined): string {
  if (!value) return "";
  const cleanValue = value.trim();
  let pathname = "";
  let prefix = "";
  let hash = "";
  let params = new URLSearchParams();

  if (cleanValue.startsWith("/assets/")) {
    const hashStart = cleanValue.indexOf("#");
    const withoutHash = hashStart >= 0 ? cleanValue.slice(0, hashStart) : cleanValue;
    hash = hashStart >= 0 ? cleanValue.slice(hashStart) : "";
    const queryStart = withoutHash.indexOf("?");
    pathname = queryStart >= 0 ? withoutHash.slice(0, queryStart) : withoutHash;
    params = new URLSearchParams(queryStart >= 0 ? withoutHash.slice(queryStart + 1) : "");
  } else if (/^https?:\/\//i.test(cleanValue)) {
    try {
      const url = new URL(cleanValue);
      if (!url.pathname.startsWith("/assets/")) return value;
      pathname = url.pathname;
      prefix = `${url.protocol}//${url.host}`;
      params = url.searchParams;
      hash = url.hash;
    } catch {
      return value;
    }
  } else {
    return value;
  }

  if (pathname.includes("/brand/") || !storefrontPublicMediaPattern.test(pathname)) return value;
  params.set("wm", STOREFRONT_PUBLIC_WATERMARK_CACHE_VERSION);
  return `${prefix}${pathname}?${params.toString()}${hash}`;
}
