"use client";

import type { GlobalSettingsNodeDefinition } from "@/components/designer/designer-types";
import { sectionSchemas } from "@/lib/section-schema";
import type {
  SectionBlockInstance,
  SectionType,
  ThemeBlockSchema,
  ThemeFieldSchema,
  ThemePage,
  ThemeSectionSchema,
  ThemeSettingValue
} from "@/lib/types";

export const saasPresetCategoryOrder = ["商品", "素材", "导航", "营销", "基础"];

function labelFor(type: SectionType): string {
  return sectionSchemas[type]?.label ?? type.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

export function labelForSchema(type: SectionType, _schemas: Record<string, ThemeSectionSchema>): string {
  const localized: Partial<Record<SectionType, string>> = {
    hero: "首屏横幅",
    brand_logo_strip: "品牌背书",
    metric_strip: "数据指标条",
    email_start_panel: "邮箱起步面板",
    sample_strip: "样片横滑",
    story_mosaic: "故事拼图",
    video_feature: "视频展示",
    mobile_video_showcase: "移动端视频展示",
    occasion_showcase: "场景展示",
    destination_showcase: "目的地展示",
    example_gallery: "灵感案例墙",
    luxury_highlight: "黑金卖点区",
    ai_feature_launcher: "功能启动器",
    trust_signal_bar: "信任标签",
    final_cta: "收尾转化",
    photo_package_wall: "拍摄包墙",
    dreamshoot_feature_tabs: "功能标签",
    dreamshoot_package_taxonomy: "拍摄包分类",
    dreamshoot_tool_collection: "免费工具目录",
    studio_steps: "生成步骤",
    pricing_table: "价格套餐",
    conversion_panel: "转化横幅",
    login_method_panel: "登录方式",
    shoot_pack_marquee: "拍摄包横滑",
    testimonial_wall: "客户评价",
    faq: "常见问题",
    feature_grid: "功能网格",
    ai_tool_grid: "AI 工具列表",
    ai_tool_entry: "AI 工具入口",
    upload_panel: "上传面板",
    generation_form: "生成表单",
    job_progress: "任务进度",
    album_gallery: "相册展示",
    search_results: "搜索结果",
    cart_summary: "购物车摘要",
    job_detail: "任务详情",
    not_found: "404 内容",
    policy_content: "政策内容",
    blog_list: "博客列表",
    rich_text: "富文本",
    media_banner: "媒体横幅",
    before_after_gallery: "前后对比",
    header: "页眉",
    footer: "页脚"
  };
  return localized[type] ?? labelFor(type);
}

export function categoryLabel(category?: string): string {
  const value = category ?? "基础";
  const labels: Record<string, string> = {
    Storefront: "店铺前台",
    Hero: "首屏",
    Product: "商品",
    Marketing: "营销",
    Content: "内容",
    Social: "社交",
    AI: "AI 业务",
    "AI business": "AI 业务",
    Commerce: "商品",
    Global: "全局",
    基础: "基础",
    商品: "商品",
    素材: "素材",
    导航: "导航",
    营销: "营销"
  };
  return labels[value] ?? value;
}

export function moduleGroupLabel(group?: string): string {
  if (!group) return "基础";
  const labels: Record<string, string> = {
    "首页转化": "首页",
    "AI business": "AI 业务",
    Commerce: "商品",
    Content: "内容",
    Global: "全局",
    Storefront: "店铺前台",
    Product: "商品",
    Marketing: "营销",
    Social: "社交"
  };
  return labels[group] ?? categoryLabel(group);
}

export function blockSchemaDisplayLabel(schema: ThemeBlockSchema): string {
  const byType: Record<string, string> = {
    cta: "按钮",
    stat: "指标",
    card: "卡片",
    faq_item: "问答",
    testimonial: "评价",
    before_after: "前后对比",
    menu_link: "导航链接",
    logo: "品牌 Logo",
    feature_tab: "功能标签",
    login_method: "登录方式",
    story_card: "故事图片",
    destination: "目的地",
    example: "案例",
    occasion: "场景卡片",
    feature: "功能点",
    package: "拍摄包",
    sample: "样片"
  };
  return byType[schema.type] ?? schema.label;
}

export function fieldDisplayLabel(field: Pick<ThemeFieldSchema, "id" | "label">): string {
  const byId: Record<string, string> = {
    eyebrow: "眉标题",
    headline: "主标题",
    subheadline: "副标题",
    mediaAssetId: "首屏素材",
    imageUrl: "主图",
    secondaryImageUrl: "次图",
    tertiaryImageUrl: "第三图",
    bulletList: "卖点列表",
    highlightWord: "强调词",
    heroBadge: "角标文案",
    authRibbon: "飘带文案",
    authPrimaryLabel: "主按钮文案",
    authEmailPlaceholder: "邮箱占位",
    authButtonLabel: "邮箱按钮文案",
    imageBadge: "图片角标",
    imageCaption: "图片标题",
    socialProofLabel: "悬浮提示",
    anchor: "锚点",
    style: "样式",
    tone: "色调",
    source: "数据来源",
    speed: "动效",
    showStats: "显示首屏指标",
    showTopBorder: "显示上分隔线",
    showBottomBorder: "显示下分隔线",
    showCheckoutNote: "显示交付说明",
    cardBadgeLabel: "卡片角标",
    footerBody: "底部说明",
    footerCtaLabel: "底部按钮",
    footerCtaHref: "底部按钮链接",
    leadImageUrl: "主视觉图",
    leadKicker: "主卡小标题",
    leadTitle: "主卡标题",
    leadSideKicker: "侧卡小标题",
    leadSideBody: "侧卡说明",
    tabs: "分类标签",
    defaultTab: "默认标签",
    location: "地点",
    tag: "标签",
    quote: "评价内容",
    role: "身份",
    rating: "评分",
    avatarUrl: "头像",
    resultImageUrl: "结果图",
    plansMetricLabel: "套餐指标标题",
    plansMetricDetail: "套餐指标说明",
    deliveryMetricLabel: "交付指标标题",
    deliveryMetricDetail: "交付指标说明",
    creditsMetricLabel: "额度指标标题",
    creditsMetricDetail: "额度指标说明",
    featuredProductId: "推荐套餐商品",
    featuredBadgeLabel: "推荐角标",
    standardBadgeLabel: "普通角标",
    planSubtitle: "套餐副标题",
    subscriptionBody: "订阅说明",
    bestForLabel: "适合人群标题",
    bestForBody: "适合人群说明",
    deliveryCardLabel: "交付卡标题",
    deliveryCardBody: "交付卡说明",
    checkoutLabel: "结账按钮",
    previewCheckoutLabel: "预览按钮",
    productType: "商品筛选",
    aiAppSlug: "AI 工具",
    placeholder: "占位文案",
    buttonLabel: "按钮文案",
    actionHref: "动作链接",
    layout: "布局",
    label: "文案",
    href: "链接",
    title: "标题",
    subtitle: "副标题",
    description: "描述",
    emptyTitle: "空状态标题",
    emptyBody: "空状态说明",
    meta: "说明",
    helper: "辅助说明",
    kind: "类型",
    value: "数值",
    question: "问题",
    answer: "答案",
    beforeLabel: "前图标题",
    afterLabel: "后图标题",
    beforeImage: "前图",
    afterImage: "后图",
    name: "名称",
    badge: "徽标",
    group: "分组",
    ctaLabel: "按钮文案",
    ctaHref: "按钮链接",
    primaryCta: "主按钮",
    secondaryCta: "次按钮",
    tagline: "品牌短句",
    productHeading: "产品栏目标题",
    companyHeading: "公司栏目标题",
    supportHeading: "支持栏目标题",
    socialHeading: "社媒栏目标题",
    instagramUrl: "Instagram 链接",
    facebookUrl: "Facebook 链接",
    threadsUrl: "Threads 链接",
    pinterestUrl: "Pinterest 链接",
    youtubeUrl: "YouTube 链接",
    backgroundImage: "背景图"
  };
  const byLabel: Record<string, string> = {
    Eyebrow: "眉标题",
    Headline: "主标题",
    Subheadline: "副标题",
    "Hero media asset": "首屏素材",
    "Primary image URL": "主图",
    "Secondary image URL": "次图",
    "Tertiary image URL": "第三图",
    "Feature bullets": "卖点列表",
    "Highlighted word": "强调词",
    "Hero badge": "角标文案",
    "Auth ribbon": "飘带文案",
    "Auth primary label": "主按钮文案",
    "Auth email placeholder": "邮箱占位",
    "Auth button label": "邮箱按钮文案",
    "Floating proof label": "悬浮提示",
    Layout: "布局",
    "Content source": "数据来源",
    "Product filter": "商品筛选",
    "Background image": "背景图",
    "Lead image": "主视觉图",
    "CTA label": "按钮文案",
    "CTA link": "按钮链接"
  };
  return byId[field.id] ?? byLabel[field.label] ?? field.label;
}

export function optionDisplayLabel(label: string): string {
  const labels: Record<string, string> = {
    "Editorial collage": "编辑拼贴",
    "Split image": "分栏图文",
    "Minimal copy": "极简文案",
    "Immersive dark hero": "沉浸暗色首屏",
    "Studio commerce": "影楼商业首屏",
    Light: "浅色",
    Warm: "暖色",
    Dark: "深色",
    "Dark canvas": "深色画布",
    "Light canvas": "浅色画布",
    "Slow drift": "缓慢横滑",
    Still: "静止",
    "Active creative packs": "启用的拍摄包",
    "Manual blocks": "手动子块",
    "All active products": "全部启用商品",
    Subscriptions: "订阅套餐",
    "Credit packs": "额度包",
    "Editorial wall": "编辑墙",
    "Compact grid": "紧凑网格",
    "Horizontal shelf": "横向货架",
    Asymmetric: "错位布局",
    Steps: "步骤布局",
    Masonry: "瀑布布局",
    Bento: "Bento",
    List: "列表",
    "Split preview": "分栏预览",
    "Button rail": "按钮横栏",
    Primary: "主按钮",
    Secondary: "次按钮",
    Ghost: "透明按钮",
    Google: "Google",
    Email: "邮箱",
    Apple: "Apple",
    "No options available": "暂无可选项",
    "Header menu (12 site pages)": "页眉菜单",
    "Footer menu": "页脚菜单",
    "AI tools menu": "AI 工具菜单",
    "Default blog": "默认博客",
    "Help center": "帮助中心",
    "Policies": "政策页"
  };
  return labels[label] ?? label;
}

export function schemaMetaLine(schema: ThemeSectionSchema): string {
  return [
    categoryLabel(schema.saasPresetCategory || schema.category)
  ].filter(Boolean).join(" / ");
}

export function schemaBlockCount(schema: ThemeSectionSchema): string {
  const schemaBlocks = schema.blocks?.length ?? 0;
  const presetBlocks = schema.presets?.[0]?.blocks?.length ?? 0;
  return `${schemaBlocks} 种子块 / ${presetBlocks} 个预设`;
}

export function templateDisplayName(templateName: string): string {
  const key = templateName.replace(/\.liquid$/, "");
  const labels: Record<string, string> = {
    index: "首页模板",
    product: "工具详情模板",
    collection: "专辑列表模板",
    "package-detail": "专辑详情模板",
    page: "内容页模板",
    login: "登录页模板",
    "app-home": "客户工作台模板",
    "job-progress": "任务进度模板",
    "job-detail": "任务详情模板",
    album: "相册页模板",
    "account-billing": "账户订阅模板",
    privacy: "隐私政策模板",
    refunds: "退款政策模板",
    content: "内容政策模板",
    help: "帮助中心模板",
    blog: "博客列表模板",
    "blog-detail": "博客详情模板",
    search: "搜索页模板",
    cart: "购物车模板",
    "404": "404 模板"
  };
  return labels[key] ?? `${key} 模板`;
}

export function pageTypeLabel(page: ThemePage): string {
  const labels: Record<string, string> = {
    home: "首页",
    pricing: "定价页",
    ai_tool: "AI 工具页",
    privacy: "隐私政策",
    refunds: "退款政策",
    content: "内容政策",
    help: "帮助中心",
    blog: "博客",
    collection: "专辑页",
    package_detail: "专辑详情页",
    login: "登录页",
    workspace: "客户工作台",
    job_progress: "任务进度页",
    job_detail: "任务详情页",
    album: "相册页",
    account: "账户订阅页",
    policy: "政策页",
    article: "文章页",
    search: "搜索页",
    cart: "购物车",
    "404": "404"
  };
  return labels[page.pageType] ?? page.pageType;
}

export function pageOptionLabel(page: ThemePage): string {
  return `${pageTypeLabel(page)} - ${page.slug || "/"} - ${page.title}`;
}

export function blockDisplayLabel(schema: ThemeBlockSchema | undefined, block: SectionBlockInstance, index: number): string {
  const byType: Record<string, string> = {
    cta: "按钮",
    stat: "指标",
    logo: "品牌 Logo",
    story_card: "故事图片",
    feature: "功能点",
    package: "拍摄包",
    sample: "样片",
    occasion: "场景卡片",
    login_method: "登录方式",
    feature_tab: "功能标签",
    price: "价格项",
    testimonial: "客户评价",
    faq_item: "问答",
    menu_link: "导航链接",
    destination: "目的地",
    example: "案例",
    before_after: "前后图"
  };
  const readableValue = (value: ThemeSettingValue | undefined): string => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const candidate = record.title ?? record.label ?? record.name ?? record.id ?? record.url;
      return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : "";
    }
    return "";
  };
  const settings = block.settings ?? {};
  const specific =
    readableValue(settings.label) ||
    readableValue(settings.title) ||
    readableValue(settings.name) ||
    readableValue(settings.question) ||
    readableValue(settings.value) ||
    readableValue(settings.location) ||
    readableValue(settings.meta);
  const schemaLabel = schema ? blockSchemaDisplayLabel(schema) : "";
  const fallback = block.type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const label = byType[block.type] ?? schemaLabel ?? fallback;
  return specific ? `${label} · ${specific}` : `${label} ${index + 1}`;
}

export const globalNodeBlueprints: GlobalSettingsNodeDefinition[] = [
  {
    id: "branding",
    label: "品牌",
    description: "店铺品牌基线、首页补充文案和默认展示素材。",
    badges: ["brand"],
    fieldIds: ["general_layout_width", "general_layout_spacing", "additional_text", "additional_image_pc", "additional_image_mobile"]
  },
  {
    id: "colors",
    label: "颜色",
    description: "整站主色、文字色、按钮色与价格色。",
    badges: ["palette"],
    fieldIds: [
      "skin_bg",
      "skin_title_color",
      "skin_text_color",
      "skin_price_color",
      "skin_compare_at_price_color",
      "skin_primary_btn_bg_color",
      "skin_primary_btn_text_color",
      "skin_primary_btn_border_color",
      "skin_secondary_btn_bg_color",
      "skin_secondary_btn_text_color",
      "product_reviews_star_color"
    ],
    localFields: [
      { id: "theme_background", label: "画布底色", kind: "color", themeKey: "background" },
      { id: "theme_foreground", label: "正文主色", kind: "color", themeKey: "foreground" },
      { id: "theme_accent", label: "强调色", kind: "color", themeKey: "accent" },
      { id: "theme_muted", label: "弱化色", kind: "color", themeKey: "muted" }
    ]
  },
  {
    id: "typography",
    label: "字体",
    description: "标题、正文和商品价格的默认字体体系。",
    badges: ["font"],
    fieldIds: [
      "skin_title_font_family",
      "skin_text_font_family",
      "skin_product_header_font_family",
      "skin_title_font_size",
      "skin_product_header_font_size",
      "skin_price_font_size",
      "skin_compare_at_price_font_size"
    ],
    localFields: [
      { id: "theme_display_font", label: "显示字体", kind: "font", themeKey: "display" },
      { id: "theme_body_font", label: "正文字体", kind: "font", themeKey: "body" }
    ]
  },
  {
    id: "buttons",
    label: "按钮",
    description: "主按钮、次按钮与购买按钮默认样式。",
    badges: ["cta"],
    fieldIds: [
      "skin_primary_btn_bg_color",
      "skin_primary_btn_text_color",
      "skin_primary_btn_border_color",
      "skin_secondary_btn_bg_color",
      "skin_secondary_btn_text_color",
      "skin_btn_font_family"
    ]
  },
  {
    id: "navigation",
    label: "导航",
    description: "页眉与页脚菜单数据源，供全局导航模块调用。",
    badges: ["menu"],
    localFields: [
      { id: "header_links", label: "页眉导航", kind: "links", themeKey: "headerLinks", hint: "每行一个链接：名称|/path 或 名称|#anchor", minHeightClassName: "min-h-28" },
      { id: "footer_links", label: "页脚导航", kind: "links", themeKey: "footerLinks" }
    ]
  },
  {
    id: "header",
    kind: "globalSection",
    globalType: "header",
    label: "页眉",
    description: "页眉模块结构、Logo、导航入口和账号入口。",
    badges: ["global"]
  },
  {
    id: "footer",
    kind: "globalSection",
    globalType: "footer",
    label: "页脚",
    description: "页脚模块结构、政策链接和版权信息。",
    badges: ["global"]
  },
  {
    id: "seo",
    label: "SEO 默认项",
    description: "站点标题模板、默认描述、分享图和 robots 默认值。",
    badges: ["meta"],
    localFields: [
      { id: "seo_site_title", label: "站点标题", kind: "seo_text", themeKey: "siteTitle" },
      { id: "seo_title_template", label: "标题模板", kind: "seo_text", themeKey: "titleTemplate", hint: "使用 %s 作为页面标题占位，例如 %s | Lumen" },
      { id: "seo_site_description", label: "默认描述", kind: "seo_textarea", themeKey: "siteDescription", minHeightClassName: "min-h-28" },
      { id: "seo_default_og_image", label: "默认分享图", kind: "seo_text", themeKey: "defaultOgImage", hint: "可填 media id、/assets 路径或绝对 URL" },
      { id: "seo_index", label: "默认允许索引", kind: "seo_checkbox", themeKey: "index" },
      { id: "seo_follow", label: "默认允许跟踪", kind: "seo_checkbox", themeKey: "follow" }
    ]
  },
  {
    id: "links",
    label: "社媒/链接",
    description: "社媒主页链接、分享图以及站点控件圆角等收口项。",
    badges: ["social", "surface"],
    fieldIds: ["instagram_url", "facebook_url", "threads_url", "twitter_url", "pinterest_url", "youtube_url", "homepage_social_image"],
    localFields: [
      { id: "theme_section_radius", label: "卡片圆角", kind: "range", themeKey: "section", min: 0, max: 40 },
      { id: "theme_control_radius", label: "控件圆角", kind: "range", themeKey: "control", min: 0, max: 24 }
    ]
  }
];
