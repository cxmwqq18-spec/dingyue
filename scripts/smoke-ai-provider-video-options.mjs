import assert from "node:assert/strict";
import {
  AI_PROVIDER_REFERENCE_LIMIT_MAX,
  isValidAiProviderReferenceLimit,
  isValidAiProviderVideoAspectRatio,
  isValidAiProviderVideoDuration,
  isValidAiProviderVideoResolution,
  normalizeAiProviderReferenceLimit,
  normalizeAiProviderVideoAspectRatios,
  normalizeAiProviderVideoDurations,
  normalizeAiProviderVideoResolutions
} from "../src/lib/ai-provider-video-options.ts";

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

check("后台可选时长 5/30 秒必须通过校验", () => {
  assert.deepEqual(normalizeAiProviderVideoDurations([5, 6, 10, 15, 30]), [5, 6, 10, 15, 30]);
  for (const duration of [5, 6, 10, 15, 30]) assert.equal(isValidAiProviderVideoDuration(duration), true);
});

check("时长归一化去重排序并丢弃非法值", () => {
  assert.deepEqual(normalizeAiProviderVideoDurations([15, 5, 15, 0, -1, 1.5, "10", 999]), [5, 10, 15]);
});

check("时长全部非法时回落到默认值", () => {
  assert.deepEqual(normalizeAiProviderVideoDurations([0, -3, "abc"]), [6, 10, 15]);
  assert.equal(isValidAiProviderVideoDuration(0), false);
  assert.equal(isValidAiProviderVideoDuration(121), false);
});

check("画幅接受常见宽高比，拒绝非宽高格式", () => {
  assert.deepEqual(normalizeAiProviderVideoAspectRatios(["9:16", "4:3", "21:9"]), ["9:16", "4:3", "21:9"]);
  assert.equal(isValidAiProviderVideoAspectRatio("16:9"), true);
  assert.equal(isValidAiProviderVideoAspectRatio("16x9"), false);
  assert.equal(isValidAiProviderVideoAspectRatio(""), false);
  assert.deepEqual(normalizeAiProviderVideoAspectRatios(["bad"]), ["9:16", "1:1", "16:9"]);
});

check("分辨率只接受 p 档位并统一小写", () => {
  assert.deepEqual(normalizeAiProviderVideoResolutions(["1080P", "720p", "720p"]), ["1080p", "720p"]);
  assert.equal(isValidAiProviderVideoResolution("1080p"), true);
  assert.equal(isValidAiProviderVideoResolution("1080"), false);
  assert.deepEqual(normalizeAiProviderVideoResolutions(["4k"]), ["480p", "720p", "1080p"]);
});

check("参考素材上限允许 0 且不超过平台上限", () => {
  assert.equal(normalizeAiProviderReferenceLimit(0, 1), 0);
  assert.equal(normalizeAiProviderReferenceLimit(AI_PROVIDER_REFERENCE_LIMIT_MAX, 1), AI_PROVIDER_REFERENCE_LIMIT_MAX);
  assert.equal(normalizeAiProviderReferenceLimit(AI_PROVIDER_REFERENCE_LIMIT_MAX + 1, 1), 1);
  assert.equal(normalizeAiProviderReferenceLimit(undefined, 2), 2);
  assert.equal(isValidAiProviderReferenceLimit(0), true);
  assert.equal(isValidAiProviderReferenceLimit(1.5), false);
});

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failures: failed }, null, 1));
  process.exit(1);
}
console.log(`PASS: ${results.length} video capability option checks (durations, aspects, resolutions, reference limits)`);
