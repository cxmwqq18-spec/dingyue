import assert from "node:assert/strict";
import { resolveAiProviderPrice, readAiProviderPriceMatrix } from "../src/lib/ai-provider-pricing.ts";

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

check("未启用模型级计价时返回 null（不得当成 0 分）", () => {
  const breakdown = resolveAiProviderPrice({ priceEnabled: false, priceCredits: 24, capabilityType: "video" });
  assert.equal(breakdown.credits, null);
  assert.equal(breakdown.baseCredits, 24);
});

check("启用后无维度命中时使用基础积分", () => {
  const breakdown = resolveAiProviderPrice({ priceEnabled: true, priceCredits: 24, capabilityType: "video", durationSeconds: 10 });
  assert.equal(breakdown.unitCredits, 24);
  assert.equal(breakdown.appliedDimension, "base");
  assert.equal(breakdown.credits, 24);
});

check("视频时长价覆盖基础价", () => {
  const breakdown = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 24, priceVideoDurations: { "6": 24, "10": 40, "15": 60 },
    capabilityType: "video", durationSeconds: 15
  });
  assert.equal(breakdown.unitCredits, 60);
  assert.equal(breakdown.appliedDimension, "duration");
});

check("视频分辨率价覆盖时长价（更具体维度优先）", () => {
  const breakdown = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 24,
    priceVideoDurations: { "15": 60 },
    priceVideoResolutions: { "1080p": 90 },
    capabilityType: "video", durationSeconds: 15, resolution: "1080p"
  });
  assert.equal(breakdown.unitCredits, 90);
  assert.equal(breakdown.appliedDimension, "resolution");
});

check("图片画质价与分辨率价依次覆盖", () => {
  const quality = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 20, priceImageQualities: { high: 40 },
    capabilityType: "image", quality: "high"
  });
  assert.equal(quality.unitCredits, 40);
  assert.equal(quality.appliedDimension, "quality");

  const resolution = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 20,
    priceImageQualities: { high: 40 },
    priceImageResolutions: { "4K": 96 },
    capabilityType: "image", quality: "high", resolution: "4K"
  });
  assert.equal(resolution.unitCredits, 96);
  assert.equal(resolution.appliedDimension, "image_resolution");
});

check("图片输入按张加价", () => {
  const breakdown = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 24, priceImageInput: 5,
    capabilityType: "image", imageInputCount: 3
  });
  assert.equal(breakdown.inputSurcharge, 15);
  assert.equal(breakdown.unitCredits, 39);
});

check("视频输入按条加价并叠加按秒加价", () => {
  const breakdown = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 30, priceVideoInput: 4, priceVideoInputPerSecond: 1,
    capabilityType: "video", videoInputCount: 2, videoInputSeconds: 10
  });
  assert.equal(breakdown.inputSurcharge, 4 * 2 + 1 * 10);
  assert.equal(breakdown.unitCredits, 30 + 18);
});

check("音频输入按条与按秒分别加价", () => {
  const breakdown = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 10, priceAudioInput: 2, priceAudioInputPerSecond: 1,
    capabilityType: "audio", audioInputCount: 3, audioInputSeconds: 7
  });
  assert.equal(breakdown.inputSurcharge, 2 * 3 + 1 * 7);
  assert.equal(breakdown.unitCredits, 10 + 13);
});

check("输出份数参与总价", () => {
  const breakdown = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 24, capabilityType: "video", durationSeconds: 6, outputCount: 3
  });
  assert.equal(breakdown.unitCredits, 24);
  assert.equal(breakdown.credits, 72);
});

check("负值归零", () => {
  const breakdown = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: -10, priceImageInput: -5,
    capabilityType: "image", imageInputCount: 2
  });
  assert.equal(breakdown.unitCredits, 0);
  assert.equal(breakdown.credits, 0);
});

check("价格矩阵忽略非法项", () => {
  const matrix = readAiProviderPriceMatrix({ "6": 24, "10": "abc", "15": -3, "": 5, "20": 30 });
  assert.deepEqual(matrix, { "6": 24, "20": 30 });
});

check("时长键位支持数字与字符串等价", () => {
  const byNumber = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 24, priceVideoDurations: { "6": 24, "10": 40 },
    capabilityType: "video", durationSeconds: 10
  });
  const byString = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 24, priceVideoDurations: { "6": 24, "10": 40 },
    capabilityType: "video", durationSeconds: "10"
  });
  assert.equal(byNumber.unitCredits, 40);
  assert.equal(byString.unitCredits, 40);
});

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, results }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, passed: results.length, results }, null, 2));
