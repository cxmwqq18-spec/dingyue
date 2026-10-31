#!/usr/bin/env node

// Wan3.0 提示词优化器冒烟：验证 system 前缀（skill 全文）、多模态消息、
// 校验器（参数一致性/台词保留/负面栏）与 repair 重试路径。纯离线，走 test hook。

import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

process.env.NODE_ENV = "test";

const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
const sourceRoot = path.join(process.cwd(), "src");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@": sourceRoot,
    "server-only": path.join(sourceRoot, "lib/storefront-context/types.ts"),
  },
});

const { optimizeWan30VideoPrompt } = jiti("../src/lib/wan30-video-prompt-optimizer.ts");
const { WAN30_PROMPT_SKILL_MD, WAN30_OPTIMIZER_SYSTEM_PREFIX } = jiti("../src/lib/wan30-prompt-skill.ts");
const { WAN30_VIDEO_TYPES } = jiti("../src/lib/wan30-video-prompt-types.ts");

const optimizerSource = fs.readFileSync(path.join(sourceRoot, "lib/wan30-video-prompt-optimizer.ts"), "utf8");
assert.match(optimizerSource, /generatePlatformText/);
assert.match(optimizerSource, /WAN30_OPTIMIZER_TIMEOUT_MS = 180_000/u, "优化器必须显式放宽 provider 超时");
assert.ok(WAN30_PROMPT_SKILL_MD.includes("七段"), "skill 资产必须包含七段结构原文");
assert.equal(WAN30_VIDEO_TYPES.length >= 5, true);

const PNG_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** 模拟一次正常优化响应（符合全部校验器），并捕获请求消息。 */
const captured = [];
function hookRespond(payloadBuilder) {
  return async (input) => {
    captured.push(input);
    return { text: JSON.stringify(payloadBuilder(input)), providerId: "hook", providerLabel: "Hook" };
  };
}

const baseInput = {
  sourcePrompt: '15秒 9:16 1080p，不锈钢电动咖啡奶泡器，厨房早晨场景，英文口播 "Make smooth, creamy foam for your morning latte."，结尾拿起产品对镜头展示',
  videoTypeId: "how_to_demo",
  durationSeconds: 15,
  aspectRatio: "9:16",
  resolution: "1080p",
  referenceImages: [PNG_DATA_URI]
};

function validPayloadFor(_input) {
  return {
    optimizedPrompt: [
      "真实商品摄影，材质遵从商品本身。",
      `15秒、9:16、1080P 电商展示视频，以商品收尾。`,
      `商品沿用图1的参考，不擅自补写未展示的文字和细节。`,
      "厨房早晨场景，柔和晨光，商品清晰对焦。",
      `镜头1[0-15秒]：呈现正文动作，机位稳定。`,
      `人声英文口播 "Make smooth, creamy foam for your morning latte."，音效自然。`,
      "避免商品外观、颜色、尺寸比例变化，避免画面文字乱码。"
    ].join("\n")
  };
}

// 1) 正常路径：system 含 skill 全文 + 固定前缀；user 为多模态 parts；校验通过。
const currentHook = hookRespond(() => validPayloadFor(baseInput));
(globalThis).__dingyuePlatformTextProviderTestHook = currentHook;
const result = await optimizeWan30VideoPrompt(baseInput);
assert.ok(result.optimizedPrompt.includes("Make smooth, creamy foam"));
assert.match(result.optimizerVersion, /^wan30-video-prompt-optimizer-v1:wan30-skill-/u);

const systemMessage = captured[0].messages[0];
assert.equal(systemMessage.role, "system");
assert.ok(systemMessage.content.startsWith(WAN30_OPTIMIZER_SYSTEM_PREFIX), "system 必须以固定前缀开头（缓存前缀）");
assert.ok(systemMessage.content.includes(WAN30_PROMPT_SKILL_MD), "system 必须包含 skill 全文");
const userMessage = captured[0].messages[1];
assert.ok(Array.isArray(userMessage.content), "带参考图时 user 必须是多模态 parts");
assert.equal(userMessage.content.filter((part) => part.type === "image_url").length, 1);
assert.ok(userMessage.content[0].text.includes('"videoTypeInstruction"'), "user payload 必须带视频类型指令");
assert.ok(userMessage.content[0].text.includes("How-to"), "user payload 必须带所选类型");

// 2) 无参考图：user 为纯文本，且正文不得提参考图。
captured.length = 0;
(globalThis).__dingyuePlatformTextProviderTestHook = hookRespond((input) => ({
  optimizedPrompt: validPayloadFor(input).optimizedPrompt.replace("商品沿用图1的参考，", "无参考素材，")
}));
const noRefResult = await optimizeWan30VideoPrompt({ ...baseInput, referenceImages: [] });
assert.equal(typeof noRefResult.optimizedPrompt, "string");
assert.equal(Array.isArray(captured[0].messages[1].content), false);

// 3) 校验失败 → repair 重试成功：第一次回错参数，第二次修正。
captured.length = 0;
let call = 0;
(globalThis).__dingyuePlatformTextProviderTestHook = async (input) => {
  captured.push(input);
  call += 1;
  if (call === 1) return { text: JSON.stringify({ optimizedPrompt: validPayloadFor(baseInput).optimizedPrompt.replace("15秒、9:16", "30秒、9:16") }) };
  return { text: JSON.stringify(validPayloadFor(baseInput)) };
};
const repaired = await optimizeWan30VideoPrompt(baseInput);
assert.equal(call, 2, "第一次被校验器拒绝后必须走 repair");
assert.ok(repaired.optimizedPrompt.includes("15秒"));

// 4) repair 也失败 → 抛错。
(globalThis).__dingyuePlatformTextProviderTestHook = hookRespond(() => ({
  optimizedPrompt: validPayloadFor(baseInput).optimizedPrompt.replace("9:16", "16:9")
}));
await assert.rejects(() => optimizeWan30VideoPrompt(baseInput), /setting_conflict|dialogue_missing/u);

// 5) 丢失台词必须被拦。
captured.length = 0;
(globalThis).__dingyuePlatformTextProviderTestHook = hookRespond(() => ({
  optimizedPrompt: validPayloadFor(baseInput).optimizedPrompt.replace('英文口播 "Make smooth, creamy foam for your morning latte."', "英文口播介绍产品")
}));
await assert.rejects(() => optimizeWan30VideoPrompt(baseInput), /dialogue_missing/u);

// 6) 缺负面栏必须被拦。
(globalThis).__dingyuePlatformTextProviderTestHook = hookRespond(() => ({
  optimizedPrompt: validPayloadFor(baseInput).optimizedPrompt.replace(/避免[^\n]*\n?/gu, "")
}));
await assert.rejects(() => optimizeWan30VideoPrompt(baseInput), /negative_missing/u);

delete (globalThis).__dingyuePlatformTextProviderTestHook;
console.log("smoke-wan30-video-prompt-optimization: all assertions passed");
