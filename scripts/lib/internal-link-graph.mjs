export function linkGraph(rows, { bodyOnly = false } = {}) {
  const nodes = new Map(rows.filter((r) => r.status === 200 && !r.noindex && r.path === r.finalPath && r.canonicalPath === r.path).map((r) => [r.path, r]));
  const outgoing = new Map([...nodes.keys()].map((p) => [p, new Set()]));
  const incoming = new Map([...nodes.keys()].map((p) => [p, new Set()]));
  for (const [path, row] of nodes) for (const link of row.links) {
    if (link.path === path || link.nofollow || (bodyOnly && link.global) || !nodes.has(link.path)) continue;
    outgoing.get(path).add(link.path);
    incoming.get(link.path).add(path);
  }
  function walk(edges) {
    const depth = new Map(nodes.has('/') ? [['/', 0]] : []);
    const queue = [...depth.keys()];
    for (let i = 0; i < queue.length; i++) for (const next of edges.get(queue[i]) || []) {
      if (depth.has(next)) continue;
      depth.set(next, depth.get(queue[i]) + 1);
      queue.push(next);
    }
    return depth;
  }
  const depth = walk(outgoing), returnDepth = walk(incoming);
  return {
    orphans: [...nodes.keys()].filter((p) => p !== '/' && !incoming.get(p).size),
    unreachable: [...nodes.keys()].filter((p) => !depth.has(p)),
    cannotReturnHome: [...nodes.keys()].filter((p) => !returnDepth.has(p)),
    maxDepth: Math.max(0, ...depth.values()),
    pages: [...nodes.keys()].map((path) => ({ path, inbound: incoming.get(path).size, outbound: outgoing.get(path).size, depth: depth.get(path) ?? null }))
  };
}
