/**
 * 视频工作台「视频类型」选择器与 wan30 提示词优化器共用的工作类型定义。
 * 只放纯数据与纯函数，前后端都能导入。
 */
export type Wan30VideoTypeId =
  | "general"
  | "product_ad"
  | "tiktok_ad"
  | "ugc_review"
  | "social_reels"
  | "cinematic_launch"
  | "how_to_demo";

export type Wan30VideoType = {
  id: Wan30VideoTypeId;
  label: string;
  /** 追加到优化请求 user message 的创作指令（英文，与工作台其他文案一致，由浏览器翻译）。 */
  instruction: string;
};

export const WAN30_VIDEO_TYPES: readonly Wan30VideoType[] = [
  {
    id: "general",
    label: "General product video",
    instruction: "General shoppable product video: clear product proof, a buyer-relevant demonstration, and a clean final product view."
  },
  {
    id: "product_ad",
    label: "Product ad",
    instruction: "Store product ad: brand-consistent look, one core selling point, a strong opening hook, and a clean call-to-action ending."
  },
  {
    id: "tiktok_ad",
    label: "TikTok ad",
    instruction: "TikTok short ad: hook in the first second, fast pacing, native vertical-phone feel, punchy short spoken lines."
  },
  {
    id: "ugc_review",
    label: "UGC review",
    instruction: "UGC review style: authentic handheld phone footage, natural casual speech, a real-use demonstration, no studio polish."
  },
  {
    id: "social_reels",
    label: "Social Reels",
    instruction: "Social media Reels: lifestyle context, trend-aware visual rhythm, and shareable pacing for the target platform."
  },
  {
    id: "cinematic_launch",
    label: "Cinematic launch",
    instruction: "Cinematic product launch: premium lighting, slow confident camera moves, and a high-end brand finish."
  },
  {
    id: "how_to_demo",
    label: "How-to demo",
    instruction: "How-to product demo: step-by-step usage proof, accurate product handling, and a clear call to action at the end."
  }
];

export const WAN30_VIDEO_TYPE_IDS: readonly Wan30VideoTypeId[] = WAN30_VIDEO_TYPES.map((type) => type.id);

export function isWan30VideoTypeId(value: unknown): value is Wan30VideoTypeId {
  return typeof value === "string" && WAN30_VIDEO_TYPE_IDS.includes(value as Wan30VideoTypeId);
}

export function wan30VideoType(id: Wan30VideoTypeId): Wan30VideoType {
  return WAN30_VIDEO_TYPES.find((type) => type.id === id) ?? WAN30_VIDEO_TYPES[0];
}
