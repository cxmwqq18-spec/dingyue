import { buildSiteV2 } from './scripts/lib/aidreamcapes-site-v2-content.mjs';

const base = 'https://www.aivideosugc.com';
const absolute = (value) => typeof value === 'string' && value.startsWith('/') ? `${base}${value}` : value;
const imageFields = new Set(['image', 'images', 'thumbnail', 'thumbnailUrl', 'contentUrl', 'logo', 'primaryImageOfPage']);
function collectImageFields(value, path = '$', out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageFields(item, `${path}[${index}]`, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const isImageField = imageFields.has(key) || /image|thumbnail/i.test(key);
    if (isImageField && typeof child === 'string') out.push({ path: childPath, value: absolute(child) });
    else if (isImageField && Array.isArray(child)) {
      for (const [index, item] of child.entries()) if (typeof item === 'string') out.push({ path: `${childPath}[${index}]`, value: absolute(item) });
    } else if (isImageField && child && typeof child === 'object' && typeof child.url === 'string') out.push({ path: `${childPath}.url`, value: absolute(child.url) });
    collectImageFields(child, childPath, out);
  }
  return out;
}
function unique(items) {
  return [...new Map(items.map((item) => [`${item.path}|${item.value}`, item])).values()];
}
function baseName(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/^https?:\/\/[^/]+/, '').replace(/--\d+(?=\.[^.]+$)/, '').replace(/\/og(?=\.[^.]+$)/, '');
}
const build = buildSiteV2();
const rows = build.pages.map((page) => {
  const data = page.contentJson.sections.v2_main.settings.data;
  const visual = data.visual;
  const result = visual?.steps?.result;
  const source = visual?.steps?.source;
  const og = absolute(page.contentJson.seo.ogImage);
  const twitter = og; // storefront-metadata emits twitter:image from the page ogImage value.
  const jsonLdFields = unique(collectImageFields(page.contentJson.seo.jsonLd));
  const resultAddress = result?.src ? absolute(result.src) : null;
  const resultBase = baseName(resultAddress);
  const matchingJsonLd = jsonLdFields.filter((field) => baseName(field.value) === resultBase || field.value === og);
  const expectedShareName = result ? `/assets/sites/site_aidreamcapes/site-v2/gen/t33-${page.id}-og.webp` : null;
  const usesResultShare = result ? og.replace(/^https?:\/\/[^/]+/, '') === expectedShareName : true;
  return {
    id: page.id,
    route: page.slug,
    h1: data.h1,
    hasVisual: Boolean(visual),
    hasVisualStepsResult: Boolean(result),
    ogImage: og,
    twitterImage: twitter,
    jsonLdImages: jsonLdFields,
    visualSteps: result ? { source: absolute(source.src), result: resultAddress } : null,
    consistent: result ? (usesResultShare && twitter === og && matchingJsonLd.some((field) => field.value === og)) : true,
  };
});
const resultPages = rows.filter((row) => row.hasVisualStepsResult);
const consistent = resultPages.filter((row) => row.consistent).length;
console.log(`# t33 OG and structured-image audit\n\n- Pages audited: ${rows.length}\n- Pages with visual.steps.result: ${resultPages.length}\n- Consistent result/share image pages: ${consistent}/${resultPages.length}\n- A page is consistent when OG and Twitter point to the result image family and JSON-LD contains that image family.\n\n## Pages with visual steps\n\n| Page | Route | OG image | Twitter image | Source | Result | Consistent | JSON-LD image fields |
|---|---|---|---|---|---|---|---|`);
for (const row of resultPages) {
  const jsonLd = row.jsonLdImages.map((field) => `${field.path}: ${field.value}`).join('<br>') || '(none)';
  console.log(`| ${row.id} | ${row.route} | ${row.ogImage} | ${row.twitterImage} | ${row.visualSteps.source} | ${row.visualSteps.result} | ${row.consistent ? 'yes' : 'no'} | ${jsonLd} |`);
}
console.log('\n## Pages without visual steps\n');
console.log('| Page | Route | OG image | Twitter image | JSON-LD image fields |');
console.log('|---|---|---|---|---|');
for (const row of rows.filter((row) => !row.hasVisualStepsResult)) {
  console.log(`| ${row.id} | ${row.route} | ${row.ogImage} | ${row.twitterImage} | ${row.jsonLdImages.map((field) => `${field.path}: ${field.value}`).join('<br>') || '(none)'} |`);
}
