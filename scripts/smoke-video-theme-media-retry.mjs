#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/storefront/customer-video-workspace.tsx", import.meta.url), "utf8");

assert.match(source, /const \[retryingSrc, setRetryingSrc\] = useState\(""\)/);
assert.match(source, /const \[failedSrc, setFailedSrc\] = useState\(""\)/);
assert.match(source, /media_retry=1/);
assert.match(source, /if \(retryingSrc\) \{[\s\S]*?setFailedSrc\(normalizedSrc\)/);
assert.match(source, /useEffect\(\(\) => \{[\s\S]*?setRetryingSrc\(""\);[\s\S]*?setFailedSrc\(""\);[\s\S]*?\}, \[normalizedSrc\]\)/);

console.log(JSON.stringify({ ok: true, check: "video-theme-media-retry" }, null, 2));
