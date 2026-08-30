import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const rail = readFileSync(path.join(root, "src/components/storefront/dreamshoot-showcase-rail.tsx"), "utf8");

assert.match(rail, /^"use client";/m, "showcase rail must run presentation animation on the client");
assert.match(rail, /useEffect/, "showcase rail must manage its animation lifecycle");
assert.match(rail, /requestAnimationFrame/, "showcase rail must advance scroll position automatically");
assert.match(rail, /reverse\s*=\s*false/, "showcase rail must support reverse direction");
assert.match(rail, /speed\s*=\s*\d+/, "showcase rail must use its configured speed");
assert.match(rail, /prefers-reduced-motion/, "showcase rail must respect reduced-motion preferences");
assert.match(rail, /data-auto-scroll/, "showcase rail must expose its runtime state");

console.log(JSON.stringify({ ok: true, rule: "showcase-rail-auto-scroll" }));
