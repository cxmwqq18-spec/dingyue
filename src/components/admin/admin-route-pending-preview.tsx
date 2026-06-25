"use client";

import { siteAdminModules, type SiteAdminModuleCode } from "@/lib/admin-menu";
import { useAdminNavigationSnapshot } from "./admin-navigation-feedback";

type PendingRouteMeta = {
  code: SiteAdminModuleCode;
  eyebrow: string;
  title: string;
  subtitle: string;
  statLabels: string[];
  panelLayout: "overview" | "table" | "split" | "content";
};

const routeMeta: Record<SiteAdminModuleCode, PendingRouteMeta> = {
  overview: {
    code: "overview",
    eyebrow: "店铺运营",
    title: "概览工作台",
    subtitle: "正在进入站点总览，加载健康度、订单、AI 队列和发布状态。",
    statLabels: ["健康度", "收入", "顾客", "任务"],
    panelLayout: "overview"
  },
  design: {
    code: "design",
    eyebrow: "店铺装修",
    title: "店铺装修",
    subtitle: "正在进入页面、主题、素材和发布工作区。",
    statLabels: ["页面", "主题", "素材", "发布"],
    panelLayout: "split"
  },
  content: {
    code: "content",
    eyebrow: "内容运营",
    title: "内容运营",
    subtitle: "正在加载政策页、帮助中心、FAQ 和营销内容模块。",
    statLabels: ["内容页", "政策页", "帮助页", "发布快照"],
    panelLayout: "content"
  },
  products: {
    code: "products",
    eyebrow: "store commerce",
    title: "商品中心",
    subtitle: "正在加载订阅产品、credit pack、AI 拍摄包和前台价格入口。",
    statLabels: ["商品", "价格", "拍摄包", "发布"],
    panelLayout: "split"
  },
  orders: {
    code: "orders",
    eyebrow: "订单与订阅",
    title: "订单与订阅",
    subtitle: "正在进入订单、订阅、额度账本和支付事件工作台。",
    statLabels: ["收入", "订单", "订阅", "额度"],
    panelLayout: "overview"
  },
  customers: {
    code: "customers",
    eyebrow: "顾客体系",
    title: "顾客管理",
    subtitle: "正在加载客户状态、余额、模型训练、私有相册和素材交付。",
    statLabels: ["顾客", "额度", "模型", "相册"],
    panelLayout: "table"
  },
  ai: {
    code: "ai",
    eyebrow: "AI 工厂运营",
    title: "AI 工具",
    subtitle: "正在进入工具启用、扣费规则、worker 路由和任务队列。",
    statLabels: ["工具", "任务", "预扣", "重跑"],
    panelLayout: "overview"
  },
  email: {
    code: "email",
    eyebrow: "site email",
    title: "邮件管理",
    subtitle: "正在加载本站 Resend 配置、发件域名、验证码测试和 DNS 检测。",
    statLabels: ["API Key", "From", "域名", "测试"],
    panelLayout: "split"
  },
  settings: {
    code: "settings",
    eyebrow: "billing and settings",
    title: "设置收款",
    subtitle: "正在进入域名、Stripe Connect、管理员、审计和站点基础资料。",
    statLabels: ["域名", "收款", "管理员", "审计"],
    panelLayout: "content"
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
  if (matchesAdminPath("/admin/ai-tools")) return "ai";
  if (matchesAdminPath("/admin/content")) return "content";
  if (matchesAdminPath("/admin/email")) return "email";
  if (matchesAdminPath("/admin/settings")) return "settings";
  if (matchesAdminPath("/admin/design") || matchesAdminPath("/admin/themes") || matchesAdminPath("/admin/media")) return "design";
  if (pathname.endsWith("/admin")) return "overview";
  return undefined;
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#e8edf5] ${className}`} />;
}

function PendingStatGrid({ labels }: { labels: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {labels.map((label) => (
        <div className="min-h-[112px] rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5" key={label}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-[#8a94a6]">{label}</span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#2ac76d]" />
          </div>
          <SkeletonBar className="mt-7 h-8 w-20" />
          <SkeletonBar className="mt-4 h-3 w-32 bg-[#eef2f7]" />
        </div>
      ))}
    </div>
  );
}

function PendingPanels({ layout }: { layout: PendingRouteMeta["panelLayout"] }) {
  if (layout === "table") {
    return (
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
        <SkeletonBar className="h-5 w-36" />
        <div className="mt-5 grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="grid min-h-[56px] grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto] items-center gap-4 rounded-[8px] border border-[var(--admin-border-soft)] px-4" key={index}>
              <SkeletonBar className="h-4 bg-[#eef2f7]" />
              <SkeletonBar className="h-4 bg-[#eef2f7]" />
              <SkeletonBar className="h-8 w-20 bg-[#eef2f7]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layout === "split") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5" key={index}>
            <SkeletonBar className="h-5 w-36" />
            <SkeletonBar className="mt-5 h-40 w-full bg-[#eef2f7]" />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "content") {
    return (
      <>
        <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
          <SkeletonBar className="h-5 w-40" />
          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            <SkeletonBar className="h-36 bg-[#eef2f7]" />
            <SkeletonBar className="h-36 bg-[#eef2f7]" />
          </div>
        </div>
        <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
          <SkeletonBar className="h-5 w-32" />
          <SkeletonBar className="mt-5 h-44 w-full bg-[#eef2f7]" />
        </div>
      </>
    );
  }

  return (
    <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
      <SkeletonBar className="h-5 w-40" />
      <SkeletonBar className="mt-5 h-44 w-full bg-[#eef2f7]" />
    </div>
  );
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
    <div className="absolute inset-0 z-20 rounded-[8px] bg-[rgba(248,250,253,0.98)] p-0" data-admin-route-pending-preview={code} aria-live="polite" aria-busy="true">
      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#98a2b3]">{meta.eyebrow}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[28px] font-semibold leading-[32px] tracking-[-0.03em] text-[var(--admin-text)]">{meta.title}</h1>
            {Icon ? (
              <span className="inline-flex h-[24px] items-center rounded-[6px] border border-[#d9e4ff] bg-[#eef4ff] px-2 text-[#2f6fed]">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
            ) : null}
          </div>
        </div>
        <span className="inline-flex h-[30px] shrink-0 items-center rounded-[8px] border border-[#d9e4ff] bg-[#eef4ff] px-3 text-[12px] font-medium text-[#2f6fed]">
          正在进入
        </span>
      </div>
      <div className="now">
        <span>店铺管理</span>
        <span className="sel">
          {meta.title}
          <i />
        </span>
        <div className="clear" />
      </div>
      <div className="right_main">
        <div className="tixing">{meta.subtitle}</div>
        <div className="grid gap-5">
          <PendingStatGrid labels={meta.statLabels} />
          <PendingPanels layout={meta.panelLayout} />
        </div>
      </div>
    </div>
  );
}
