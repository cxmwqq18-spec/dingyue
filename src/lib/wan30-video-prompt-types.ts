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
  /** 该类型的专属优化策略：注入优化器 user message，指导七段结构的镜头编排、
   * 口播风格与负面约束侧重。与 instruction 互补——instruction 说明"做什么"，
   * strategy 说明"怎么编排"。 */
  strategy: string;
};

export const WAN30_VIDEO_TYPES: readonly Wan30VideoType[] = [
  {
    id: "general",
    label: "General product video",
    instruction: "General shoppable product video: clear product proof, a buyer-relevant demonstration, and a clean final product view.",
    strategy: "结构上按「产品出场→核心功能演示→细节特写→干净收尾」四拍编排；口播为中性可信的介绍语气，每镜头一句短事实；负面约束侧重：外观/配色漂移、标签文字变形、手持抖动过强。"
  },
  {
    id: "product_ad",
    label: "Product ad",
    instruction: "Store product ad: brand-consistent look, one core selling point, a strong opening hook, and a clean call-to-action ending.",
    strategy: "结构上按「强钩子(0-3秒)→单一卖点演示→信任特写→行动号召收尾」编排，全片只讲一个核心卖点；口播为广告腔但克制，最后一句必须是明确的行动号召；负面约束侧重：品牌标识错误、多卖点堆砌、结尾画面不稳定。"
  },
  {
    id: "tiktok_ad",
    label: "TikTok ad",
    instruction: "TikTok short ad: hook in the first second, fast pacing, native vertical-phone feel, punchy short spoken lines.",
    strategy: "结构上第一秒必须出现冲突或悬念钩子，镜头切换每 2-3 秒一次，全片竖屏手持原生感；口播为短促口语句（每句不超过 12 字），可用一个网络化表达；负面约束侧重：画幅横竖错误、节奏拖沓、口播书面化、出现平台外水印。"
  },
  {
    id: "ugc_review",
    label: "UGC review",
    instruction: "UGC review style: authentic handheld phone footage, natural casual speech, a real-use demonstration, no studio polish.",
    strategy: "结构上按「开箱或拿出→真实使用过程→主观评价→自然收尾」编排，镜头允许轻微手持晃动和生活化背景；口播为第一人称真诚分享语气，允许一处小瑕疵式表达（如“说实话一开始我怀疑…”）；负面约束侧重：过度布光、影棚感、表演痕迹过重。"
  },
  {
    id: "social_reels",
    label: "Social Reels",
    instruction: "Social media Reels: lifestyle context, trend-aware visual rhythm, and shareable pacing for the target platform.",
    strategy: "结构上按「生活方式场景切入→产品自然融入→可分享的memorable瞬间→品牌轻收尾」编排；口播轻量、可有一句可复述的金句；负面约束侧重：场景与产品无关联、节奏与音乐脱节、出现竞品标识。"
  },
  {
    id: "cinematic_launch",
    label: "Cinematic launch",
    instruction: "Cinematic product launch: premium lighting, slow confident camera moves, and a high-end brand finish.",
    strategy: "结构上按「暗场引入→缓慢移轨展现产品轮廓→光线揭示材质细节→品牌定版画面」编排，镜头运动缓慢自信、少于三次切换；口播极简或无口播，仅一句品牌宣言；负面约束侧重：快切、廉价光线、材质反色、多余文字元素。"
  },
  {
    id: "how_to_demo",
    label: "How-to demo",
    instruction: "How-to product demo: step-by-step usage proof, accurate product handling, and a clear call to action at the end.",
    strategy: "结构上按「步骤1→步骤2→步骤3→完成态展示+行动号召」编排，每个步骤一个镜头且动作完整可跟随，步骤间用硬切；口播为清晰的指令句（每步以动词开头）；负面约束侧重：手部动作与步骤不匹配、步骤跳序、产品状态前后不一致。"
  }
];

export const WAN30_VIDEO_TYPE_IDS: readonly Wan30VideoTypeId[] = WAN30_VIDEO_TYPES.map((type) => type.id);

export function isWan30VideoTypeId(value: unknown): value is Wan30VideoTypeId {
  return typeof value === "string" && WAN30_VIDEO_TYPE_IDS.includes(value as Wan30VideoTypeId);
}

export function wan30VideoType(id: Wan30VideoTypeId): Wan30VideoType {
  return WAN30_VIDEO_TYPES.find((type) => type.id === id) ?? WAN30_VIDEO_TYPES[0];
}
