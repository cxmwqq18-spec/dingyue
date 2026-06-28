"use client";

import { siteAdminModules, type SiteAdminModuleCode } from "@/lib/admin-menu";
import { useAdminNavigationSnapshot } from "./admin-navigation-feedback";

type PendingRouteMeta = {
  code: SiteAdminModuleCode;
  eyebrow: string;
  title: string;
  subtitle: string;
};

const routeMeta: Record<SiteAdminModuleCode, PendingRouteMeta> = {
  overview: {
    code: "overview",
    eyebrow: "店铺运营",
    title: "概览工作台",
    subtitle: "正在进入站点总览，加载健康度、订单、AI 队列和发布状态。"
  },
  design: {
    code: "design",
    eyebrow: "店铺装修",
    title: "店铺装修",
    subtitle: "正在进入页面、主题、素材和发布工作区。"
  },
  content: {
    code: "content",
    eyebrow: "内容运营",
    title: "内容运营",
    subtitle: "正在加载政策页、帮助中心、FAQ 和营销内容模块。"
  },
  products: {
    code: "products",
    eyebrow: "store commerce",
    title: "商品中心",
    subtitle: "正在加载订阅产品、credit pack、AI 拍摄包和前台价格入口。"
  },
  orders: {
    code: "orders",
    eyebrow: "订单与订阅",
    title: "订单与订阅",
    subtitle: "正在进入订单、订阅、额度账本和支付事件工作台。"
  },
  customers: {
    code: "customers",
    eyebrow: "顾客体系",
    title: "顾客管理",
    subtitle: "正在加载客户状态、余额、模型训练、私有相册和素材交付。"
  },
  partners: {
    code: "partners",
    eyebrow: "推广合作",
    title: "推广合作者",
    subtitle: "正在加载推广合作者申请、渠道资料、审核状态和备注记录。"
  },
  ai: {
    code: "ai",
    eyebrow: "AI 工厂运营",
    title: "AI 工具",
    subtitle: "正在进入工具启用、扣费规则、worker 路由和任务队列。"
  },
  email: {
    code: "email",
    eyebrow: "site email",
    title: "邮件管理",
    subtitle: "正在加载本站 Resend 配置、发件域名、验证码测试和 DNS 检测。"
  },
  settings: {
    code: "settings",
    eyebrow: "billing and settings",
    title: "设置收款",
    subtitle: "正在进入域名、Stripe Connect、管理员、审计和站点基础资料。"
  }
};

function siteAdminCodeFromHref(href?: string): SiteAdminModuleCode | undefined {
  if (!href) return undefined;
  const url = new URL(href, "http://admin.local");
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  const matchesAdminPath = (segment: string) => pathname.endsWith(segment) || pathname.includes(`${segment}/`);
  if (matchesAdminPath("/admin/products")) return "products";
  if (matchesAdminPath("/admin/orders")) return "orders";
  if (matchesAdminPath("/admin/customers")) return "customers";
  if (matchesAdminPath("/admin/partners")) return "partners";
  if (matchesAdminPath("/admin/ai-tools")) return "ai";
  if (matchesAdminPath("/admin/content")) return "content";
  if (matchesAdminPath("/admin/email")) return "email";
  if (matchesAdminPath("/admin/settings")) return "settings";
  if (matchesAdminPath("/admin/design") || matchesAdminPath("/admin/themes") || matchesAdminPath("/admin/media")) return "design";
  if (pathname.endsWith("/admin")) return "overview";
  return undefined;
}

export function AdminRoutePendingPreview() {
  const { href, pending } = useAdminNavigationSnapshot();
  if (!pending) return null;
  const code = siteAdminCodeFromHref(href);
  if (!code) return null;
  const meta = routeMeta[code];
  const targetModule = siteAdminModules.find((item) => item.code === code);
  const Icon = targetModule?.icon;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 px-0"
      data-admin-route-pending-preview={code}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="overflow-hidden rounded-[8px] border border-[#d9e4ff] bg-[rgba(255,255,255,0.94)] shadow-[0_18px_44px_-36px_rgba(15,23,42,0.42)] backdrop-blur">
        <div className="h-[2px] w-full overflow-hidden bg-[#eef4ff]">
          <div className="h-full w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite] bg-[#2f6fed]" />
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon ? (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[#d9e4ff] bg-[#eef4ff] text-[#2f6fed]">
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#98a2b3]">{meta.eyebrow}</p>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <strong className="shrink-0 text-[14px] font-semibold leading-5 text-[var(--admin-text)]">正在进入 {meta.title}</strong>
                <span className="hidden truncate text-[12px] text-[#667085] md:inline">{meta.subtitle}</span>
              </div>
            </div>
          </div>
          <span className="hidden h-[28px] shrink-0 items-center rounded-full border border-[#d9e4ff] bg-[#f5f8ff] px-3 text-[12px] font-medium text-[#2f6fed] sm:inline-flex">
            模块切换中
          </span>
        </div>
      </div>
    </div>
  );
}
