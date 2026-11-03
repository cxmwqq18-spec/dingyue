import { AIDREAMCAPES_V2_CARD_CSS, AIDREAMCAPES_V2_CSS, AIDREAMCAPES_V2_FRESH_CSS, AIDREAMCAPES_V2_HOME_CSS, AIDREAMCAPES_V2_VISUAL_CSS, AIDREAMCAPES_V2_VISUAL_CSS_POLISH, aidreamcapesV2ThemeCssEtag } from "@/components/storefront/aidreamcapes-v2/styles";

export const dynamic = "force-static";

const css = AIDREAMCAPES_V2_CSS
  + AIDREAMCAPES_V2_CARD_CSS
  + AIDREAMCAPES_V2_HOME_CSS
  + AIDREAMCAPES_V2_VISUAL_CSS
  + AIDREAMCAPES_V2_VISUAL_CSS_POLISH
  + AIDREAMCAPES_V2_FRESH_CSS;

/** The Aidreamcapes v2 theme ships as one static stylesheet instead of inline
 * <style> payloads: server-rendered inline styles inside client boundaries get
 * serialized into the RSC flight payload as well as the markup, which cost the
 * hub page ~135KB of duplicated bytes per document. The URL carries the
 * content hash, so the immutable cache busts itself whenever the theme
 * changes. */
export async function GET() {
  return new Response(css, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "text/css; charset=utf-8",
      etag: aidreamcapesV2ThemeCssEtag()
    }
  });
}
