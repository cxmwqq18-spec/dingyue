// Rules that decide which near addresses point at a public page.
//
// The generator writes the table and the release gate checks it, so both use
// the same rules. A near address is one step away from a public page: a
// different case, a plural instead of a singular, or a missing suffix.

export const NEAR_SLUG_NAMESPACES = [
  "/platforms/",
  "/templates/",
  "/industries/",
  "/occasions/",
  "/blog/",
  "/guides/"
];

// A suffix family keeps a near address inside the same family of names, so a
// plural picture page never answers for a video page.
export const SUFFIX_FAMILIES = [
  { suffixes: ["-ads"] },
  { suffixes: ["-photos", "-photo"] },
  { suffixes: ["-videos", "-video"] },
  { suffixes: ["-images", "-image"] }
];

export function caseVariants(path) {
  const variants = new Set();
  const lower = path.toLowerCase();
  if (lower !== path) variants.add(lower);
  const title = path
    .split("/")
    .map((segment) => (segment ? segment[0].toUpperCase() + segment.slice(1).toLowerCase() : segment))
    .join("/");
  if (title !== path) variants.add(title);
  const upper = path.toUpperCase();
  if (upper !== path) variants.add(upper);
  return [...variants];
}

export function lastSegmentVariants(last) {
  const variants = new Set();
  const family = SUFFIX_FAMILIES.find((entry) => entry.suffixes.some((suffix) => last.endsWith(suffix)));
  if (family) {
    const suffix = family.suffixes.find((value) => last.endsWith(value));
    const base = last.slice(0, last.length - suffix.length);
    variants.add(base);
    for (const value of family.suffixes) variants.add(`${base}${value}`);
    return [...variants];
  }
  // Only a single word can be read as the plural of another word.
  if (!last.includes("-")) {
    if (last.endsWith("s") && last.length > 3) variants.add(last.slice(0, -1));
    else if (!last.endsWith("s")) variants.add(`${last}s`);
  }
  return [...variants];
}

export function nearSlugCandidates(path) {
  const candidates = new Map();
  for (const variant of caseVariants(path)) candidates.set(variant, "case");
  if (NEAR_SLUG_NAMESPACES.some((namespace) => path.startsWith(namespace))) {
    const segments = path.split("/");
    const last = segments[segments.length - 1];
    for (const variant of lastSegmentVariants(last)) {
      segments[segments.length - 1] = variant;
      candidates.set(segments.join("/"), "segment");
    }
  }
  return [...candidates.keys()].filter((candidate) => candidate !== path);
}
