import {
  Bot,
  Building2,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  Palette,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminTone = "good" | "warn" | "bad" | "neutral";

export type SiteAdminModuleCode =
  | "overview"
  | "design"
  | "products"
  | "orders"
  | "customers"
  | "ai"
  | "content"
  | "settings";

export type PlatformAdminModuleCode =
  | "platform_overview"
  | "sites"
  | "billing"
  | "gateway"
  | "audit";

export type AdminModuleCode = SiteAdminModuleCode | PlatformAdminModuleCode;

export type AdminModuleDefinition = {
  label: string;
  code: AdminModuleCode;
  icon: LucideIcon;
  href: string;
  metric: string;
  tone: AdminTone;
  description: string;
  aiExtension?: string;
  keywords: string[];
  items: string[];
};

export type AdminModuleLink = {
  code: AdminModuleCode;
  href: string;
};

export const siteAdminModules: AdminModuleDefinition[] = [
  {
    label: "概览工作台",
    code: "overview",
    icon: LayoutDashboard,
    href: "/admin",
    metric: "总览",
    tone: "good",
    description: "站点健康、收入、AI 队列、发布状态和待处理事项集中看。",
    aiExtension: "对应 SaaS 后台首页，不把业务入口散成一堆卡片。",
    keywords: ["overview", "analytics", "dashboard", "activity", "audit", "总览", "数据"],
    items: ["经营看板", "待办任务", "站点健康", "最新动态"]
  },
  {
    label: "店铺装修",
    code: "design",
    icon: Palette,
    href: "/admin/design",
    metric: "主题",
    tone: "good",
    description: "页面模板、section 树、全局页眉页脚、预览、保存、发布和回滚。",
    aiExtension: "内置 AI 订阅 section，按店铺装修前台而不是手写页面。",
    keywords: ["design", "theme", "designer", "media", "seo", "装修", "主题", "页面"],
    items: ["页面装修", "主题库", "素材库", "导航菜单", "SEO 设置"]
  },
  {
    label: "商品套餐",
    code: "products",
    icon: ShoppingBag,
    href: "/admin/products",
    metric: "套餐",
    tone: "neutral",
    description: "订阅产品、credit pack、AI 拍摄包和真实价格绑定。",
    aiExtension: "pricing_table 只能读取这里的真实套餐，避免前台价格乱写。",
    keywords: ["products", "product", "pack", "pricing", "商品", "套餐", "prices"],
    items: ["订阅套餐", "Credit 包", "AI 拍摄包", "价格状态"]
  },
  {
    label: "订单订阅",
    code: "orders",
    icon: ReceiptText,
    href: "/admin/orders",
    metric: "账本",
    tone: "warn",
    description: "Checkout、订阅、订单、退款、Stripe 事件和 credits 入账。",
    aiExtension: "Webhook 到账后才发放 credits，重放必须幂等。",
    keywords: ["orders", "order", "checkout", "billing", "payment", "交易", "订单", "订阅"],
    items: ["订单管理", "订阅状态", "支付事件", "退款记录"]
  },
  {
    label: "顾客资产",
    code: "customers",
    icon: Users,
    href: "/admin/customers",
    metric: "客户",
    tone: "good",
    description: "本站客户、会员状态、余额、私有素材、相册和模型资产。",
    aiExtension: "同邮箱跨站隔离，素材和相册不能串站串人。",
    keywords: ["customers", "customer", "member", "crm", "顾客", "会员", "客户"],
    items: ["顾客中心", "余额账本", "私有素材", "生成相册"]
  },
  {
    label: "AI 工厂",
    code: "ai",
    icon: Bot,
    href: "/admin/ai-tools",
    metric: "任务",
    tone: "good",
    description: "AI 工具启用、扣费规则、worker 队列、失败补偿和人工重跑。",
    aiExtension: "N8N 只作为 worker，不接支付、不决定额度、不写账本。",
    keywords: ["ai", "worker", "model", "album", "AI", "工厂", "相册"],
    items: ["AI 工具", "扣费规则", "任务队列", "失败重跑"]
  },
  {
    label: "内容运营",
    code: "content",
    icon: FileText,
    href: "/admin/content",
    metric: "内容",
    tone: "neutral",
    description: "政策页、FAQ、帮助中心、博客列表和转化内容模块。",
    aiExtension: "内容页也走主题模板和发布快照，不做零散静态页。",
    keywords: ["content", "marketing", "growth", "blog", "policy", "营销", "内容"],
    items: ["政策页面", "FAQ", "帮助中心", "博客列表"]
  },
  {
    label: "设置收款",
    code: "settings",
    icon: Settings2,
    href: "/admin/settings",
    metric: "设置",
    tone: "warn",
    description: "域名、Stripe Connect、站点 SEO、权限、安全审计和基础配置。",
    aiExtension: "发布付费套餐前必须完成 Connect onboarding。",
    keywords: ["settings", "stripe", "connect", "credit", "domain", "security", "设置", "收款"],
    items: ["域名设置", "Stripe Connect", "SEO 元信息", "权限审计"]
  }
];

export const siteAdminModuleLinks: AdminModuleLink[] = siteAdminModules.map((module) => ({
  code: module.code,
  href: module.href
}));

export const platformAdminModules: AdminModuleDefinition[] = [
  {
    label: "平台总览",
    code: "platform_overview",
    icon: Gauge,
    href: "#overview",
    metric: "总控",
    tone: "good",
    description: "跨站点看经营状态、上线准备、收入、订阅、AI 队列和风险信号。",
    aiExtension: "这是平台管理员视角，不进入任何单站客户数据编辑。",
    keywords: ["platform", "overview", "control", "总览", "平台", "health"],
    items: ["经营总览", "上线姿态", "跨站指标", "最近动态"]
  },
  {
    label: "站点工厂",
    code: "sites",
    icon: Building2,
    href: "#sites",
    metric: "店铺",
    tone: "good",
    description: "创建站点、复制主题、绑定域名、进入单站后台和检查站点健康。",
    aiExtension: "每站独立用户、主题、套餐、AI 工具和素材边界。",
    keywords: ["sites", "tenant", "domains", "站点", "店铺", "域名"],
    items: ["创建站点", "站点列表", "域名绑定", "进入后台"]
  },
  {
    label: "收款订阅",
    code: "billing",
    icon: CreditCard,
    href: "#billing",
    metric: "收款",
    tone: "warn",
    description: "跨站检查 Stripe Connect、订阅套餐、订单入账、credits 发放和 webhook 风险。",
    aiExtension: "平台只监管和抽佣，各站通过 connected account 独立收款。",
    keywords: ["billing", "connect", "stripe", "payment", "收款", "订阅"],
    items: ["Connect 状态", "套餐检查", "订单入账", "Webhook 幂等"]
  },
  {
    label: "AI 网关",
    code: "gateway",
    icon: Bot,
    href: "#gateway",
    metric: "网关",
    tone: "good",
    description: "管理 AI provider、账号池、worker 路由、失败率、耗时和成本。",
    aiExtension: "N8N 只做第一版执行器，平台后端负责额度和任务状态机。",
    keywords: ["gateway", "worker", "provider", "AI", "网关", "模型"],
    items: ["工具目录", "账号池", "路由策略", "成本跟踪"]
  },
  {
    label: "审计风控",
    code: "audit",
    icon: ShieldCheck,
    href: "#audit",
    metric: "审计",
    tone: "neutral",
    description: "查看跨站操作日志、敏感查看、支付事件、worker 回调和人工重跑记录。",
    aiExtension: "平台管理员跨站查看必须留下审计线索。",
    keywords: ["audit", "risk", "logs", "security", "审计", "风控"],
    items: ["操作日志", "敏感查看", "支付事件", "人工重跑"]
  }
];

export function getSiteAdminModule(code?: string): AdminModuleDefinition {
  return siteAdminModules.find((module) => module.code === code) ?? siteAdminModules[0];
}
