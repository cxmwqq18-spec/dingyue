export function CustomerRoutePrefetch({ paths }: { paths: string[] }) {
  void paths;
  // Public pages are complete SSR documents. Deliberately render no client
  // prefetcher: prefetching is still a browser request for page data.
  return null;
}
