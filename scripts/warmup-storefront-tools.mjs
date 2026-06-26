const defaultBaseUrl = "http://localhost:3002";
const baseUrl = (process.env.STOREFRONT_WARMUP_BASE_URL || process.argv[2] || defaultBaseUrl).replace(/\/+$/, "");
const siteSlug = process.env.STOREFRONT_WARMUP_SITE_SLUG || process.argv[3] || "mydreamshoots";
const timeoutMs = Number(process.env.STOREFRONT_WARMUP_TIMEOUT_MS ?? 20000);

const paths = [
  `/site/${siteSlug}`,
  `/site/${siteSlug}/tools`,
  `/site/${siteSlug}/tools/background-changer`,
  `/site/${siteSlug}/tools/background-remover`,
  `/site/${siteSlug}/tools/magic-eraser`,
  `/site/${siteSlug}/tools/photo-enhancer`
];

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "storefront-tools-warmup/1.0"
      },
      signal: controller.signal
    });
    await response.arrayBuffer();
    return {
      ms: Math.round(performance.now() - startedAt),
      status: response.status
    };
  } finally {
    clearTimeout(timer);
  }
}

let failed = false;
for (const path of paths) {
  const url = `${baseUrl}${path}`;
  try {
    const result = await fetchWithTimeout(url);
    console.log(`${path} ${result.status} ${result.ms}ms`);
    if (result.status >= 400) failed = true;
  } catch (error) {
    failed = true;
    console.error(`${path} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) process.exit(1);
