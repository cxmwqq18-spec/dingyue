#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/storefront/customer-video-workspace.tsx", import.meta.url), "utf8");

assert.match(source, /const \[retryingSrc, setRetryingSrc\] = useState\(""\)/);
assert.match(source, /const \[failedSrc, setFailedSrc\] = useState\(""\)/);
assert.match(source, /media_retry=1/);
assert.match(source, /if \(retryingSrc\) \{[\s\S]*?setFailedSrc\(normalizedSrc\)/);
assert.match(source, /useEffect\(\(\) => \{[\s\S]*?setRetryingSrc\(""\);[\s\S]*?setFailedSrc\(""\);[\s\S]*?\}, \[normalizedSrc\]\)/);
assert.match(source, /function isVideoMediaSource\(src: string\): boolean/);
assert.match(source, /function preferredThemeMediaSource\(media:/);
assert.match(source, /<video[\s\S]*?poster=\{normalizedPosterSrc \|\| undefined\}/);
assert.match(source, /shouldShowFallback && isVideoMediaSource\(normalizedSrc\)[\s\S]*?src=\{normalizedPosterSrc\}/);
assert.match(source, /\.galleryImages\?\.find\([\s\S]*?isVideoMediaSource/);
assert.match(source, /\{\.\.\.preferredThemeMediaSource\(example\)\}/);
assert.match(source, /DreamshootShowcasePreview className="contents"/);
assert.match(source, /data-dreamshoot-showcase-preview=\{preview \? "video" : undefined\}/);
assert.match(source, /data-dreamshoot-showcase-preview=\{preview \? "image" : undefined\}/);
assert.match(source, /event\.target\.closest\("\[data-dreamshoot-showcase-preview\]"\)/);

const previewSource = fs.readFileSync(new URL("../src/components/storefront/dreamshoot-showcase-preview-client.tsx", import.meta.url), "utf8");
assert.match(previewSource, /target\.closest<HTMLElement>\("\[data-dreamshoot-showcase-preview\]\[data-dreamshoot-preview-src\]"\)/);
assert.match(previewSource, /preview\.kind === "video" \? <video/);
assert.match(previewSource, /z-\[160\]/);

console.log(JSON.stringify({ ok: true, check: "video-theme-media-retry" }, null, 2));
