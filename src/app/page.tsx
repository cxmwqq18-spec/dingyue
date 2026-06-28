import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, Boxes, Brush, CreditCard, Database, Globe2, LayoutDashboard, ShieldCheck, Workflow } from "lucide-react";
import {
  readStorefrontAccessSummaryFromDatabase,
  readStorefrontPlatformStateFromDatabase,
  readStorefrontPlatformStateFromLegacyJson,
  readStorefrontPublicRuntimeStateByHostFromDatabase,
  readStorefrontSiteByHostFromDatabase
} from "@/lib/storefront-state";
import { Metric, Panel, Shell, StatusPill, TopBar } from "@/components/ui";
import { AccessRoutePrefetcher } from "@/components/platform/access-route-prefetcher";
import { cleanHost, getSiteByHostCandidatesFromState, isPlatformHost } from "@/lib/domain-routing";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { getPage } from "@/lib/data";
import type { PlatformState, Site } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noindexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  if (!shouldResolveHostSite(hostCandidates)) return {};
  const hostSite = await getHostSiteWithFallback(hostCandidates);
  if (!hostSite) return noindexMetadata;
  return metadataForSingleThemePage(hostSite, getPage(hostSite, "/"));
}

function shouldResolveHostSite(hosts: Array<string | null>): boolean {
  return hosts.some((host) => {
    const value = cleanHost(host);
    return Boolean(value && !isPlatformHost(value) && !isLocalDevelopmentHost(value));
  });
}

function isLocalDevelopmentHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
}

async function getHostSiteWithFallback(hosts: Array<string | null>): Promise<Site | undefined> {
  if (!shouldResolveHostSite(hosts)) return undefined;
  try {
    for (const host of hosts) {
      const site = await readStorefrontSiteByHostFromDatabase(host);
      if (site) return site;
    }
  } catch {
    // Fall through to the full state reader for local or migrating databases.
  }
  const platformState = await readStorefrontPlatformStateFromDatabase();
  return getSiteByHostCandidatesFromState(platformState, hosts);
}

async function getHostRuntimeStateWithFallback(hosts: Array<string | null>): Promise<PlatformState | undefined> {
  if (!shouldResolveHostSite(hosts)) return undefined;
  try {
    for (const host of hosts) {
      const state = await readStorefrontPublicRuntimeStateByHostFromDatabase(host);
      if (state) return state;
    }
  } catch {
    // Fall through to the full state reader for local or migrating databases.
  }
  const platformState = await readStorefrontPlatformStateFromDatabase();
  const site = getSiteByHostCandidatesFromState(platformState, hosts);
  return site ? platformState : undefined;
}

async function getAccessSummaryWithFallback() {
  try {
    return await readStorefrontAccessSummaryFromDatabase();
  } catch {
    const platformState = await readStorefrontPlatformStateFromLegacyJson();
    return {
      sites: platformState.sites.slice(0, 4).map((site) => ({
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        primaryDomain: site.primaryDomain,
        branding: site.branding,
        adminEmail: platformState.siteAdmins.find((admin) => admin.siteId === site.id)?.email,
        customerEmail: platformState.customers.find((customer) => customer.siteId === site.id)?.email
      })),
      totalSites: platformState.sites.length,
      activeSites: platformState.sites.filter((site) => site.status === "active").length,
      runningJobs: platformState.jobs.filter((job) => job.status === "running").length,
      platformAdmin: platformState.platformAdmins[0]
    };
  }
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (isPlatformHost(host)) redirect("/platform");
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const hostRuntimeState = await getHostRuntimeStateWithFallback(hostCandidates);
  const hostSite = hostRuntimeState ? getSiteByHostCandidatesFromState(hostRuntimeState, hostCandidates) ?? hostRuntimeState.sites[0] : undefined;
  if (hostSite && hostRuntimeState) {
    const query = searchParams ? await searchParams : {};
    return renderStorefrontPage({ site: hostSite, slug: "/", query, routeMode: "host", state: hostRuntimeState });
  }
  if (process.env.NODE_ENV === "production" && shouldResolveHostSite(hostCandidates)) notFound();
  const accessSummary = await getAccessSummaryWithFallback();
  const totalSites = accessSummary.totalSites;
  const activeSites = accessSummary.activeSites;
  const runningJobs = accessSummary.runningJobs;
  const primarySite = accessSummary.sites[0];
  const listedSites = accessSummary.sites;
  const platformRoutes = listedSites.flatMap((site) => [
    { label: `${site.branding.logoText} 前台`, href: `/site/${site.slug}` },
    { label: `${site.branding.logoText} 后台`, href: `/site/${site.slug}/admin` }
  ]);
  const platformAdmin = accessSummary.platformAdmin;
  const accessEntries = [
    {
      label: "平台总后台",
      href: "/platform/login",
      role: "platform admin",
      account: platformAdmin ? `${platformAdmin.email} / platform123` : "platform@local.test / platform123",
      detail: "Cross-site control plane for tenants, domains, Connect state, gateway policy and global operations."
    },
    ...listedSites.flatMap((site) => [
      {
        label: `${site.branding.logoText} 前台`,
        href: `/site/${site.slug}`,
        role: "customer storefront",
        account: `${site.customerEmail ?? "seed customer"} / mara123`,
        detail: "Site-scoped storefront with independent pages, pricing, content, and navigation."
      },
      {
        label: `${site.branding.logoText} 后台`,
        href: `/site/${site.slug}/admin/login`,
        role: "site admin",
        account: `${site.adminEmail ?? `owner@${site.slug}.localhost`} / ${site.slug}123`,
        detail: "Theme designer, products, customers, subscriptions, media, and content for this site only."
      }
    ])
  ];
  const accessPrefetchPaths = Array.from(new Set([
    "/platform",
    "/platform/login",
    ...platformRoutes.map((route) => route.href),
    ...accessEntries.map((entry) => entry.href),
    ...listedSites.map((site) => `/site/${site.slug}/admin/design`)
  ]));

  return (
    <Shell>
      <AccessRoutePrefetcher paths={accessPrefetchPaths} />
      <TopBar
        brand="DreamOps"
        links={[
          { label: "平台后台", href: "/platform" },
          ...platformRoutes.slice(0, 4)
        ]}
        action={{ label: "进入平台", href: "/platform" }}
      />
      <section className="grid-paper px-5 py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 xl:grid-cols-[1.02fr_0.98fr] xl:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-clay">platform access</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-none tracking-tight text-balance md:text-6xl">
              多站点 AI 订阅平台总入口
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-650">
              这里统一进入平台总后台、站点后台和客户前台。每个站点保持独立客户体系、独立主题、独立套餐、独立素材和独立发布快照，不在一个入口里混用权限。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white" href="/platform">
                打开平台后台
              </Link>
              <Link className="rounded-full border border-black/15 px-5 py-3 text-sm font-medium" href={`/site/${primarySite?.slug ?? "lumen"}/admin`}>
                打开站点后台
              </Link>
              <Link className="rounded-full border border-black/15 px-5 py-3 text-sm font-medium" href={`/site/${primarySite?.slug ?? "lumen"}`}>
                打开客户前台
              </Link>
            </div>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {[
                "每个站点独立保存客户、商品、主题、素材、订单和发布版本。",
                "平台管理员、站点管理员、客户会员三套登录入口完全分开。",
                "设计器仍然走草稿、预览、发布、回滚链路，不会直接影响线上。",
                "主题系统已经不止一套测试主题，可以按站点导入、复制、启用和切换。"
              ].map((item) => (
                <div className="flex items-start gap-3 text-sm leading-6 text-zinc-700" key={item}>
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-moss" strokeWidth={1.8} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <Panel className="overflow-hidden p-0">
            <div className="grid gap-0">
              <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
                <div>
                  <p className="text-sm text-zinc-500">System access</p>
                  <h2 className="mt-1 text-2xl font-semibold">当前可直接使用的入口</h2>
                </div>
                <StatusPill label="可访问" tone="good" />
              </div>
              <div className="grid gap-0 divide-y divide-black/10">
                {accessEntries.map((item) => (
                  <Link className="group grid gap-3 px-6 py-5 transition hover:bg-zinc-50 md:grid-cols-[0.9fr_1.1fr_auto] md:items-center" href={item.href} key={item.label}>
                    <div>
                      <p className="font-medium text-zinc-900">{item.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{item.role}</p>
                    </div>
                    <div>
                      <p className="font-mono text-xs text-zinc-600">{item.account}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800">
                      进入
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" strokeWidth={1.8} />
                    </span>
                  </Link>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-black/10 px-6 py-5">
                <Metric label="站点总数" value={String(totalSites)} detail={`${activeSites} 个运营 / ${Math.max(totalSites - activeSites, 0)} 个草稿`} />
                <Metric label="运行任务" value={String(runningJobs)} detail="队列状态已接入后台" />
                <Metric label="主题模块" value="18+" detail="设计器内置积木" />
                <Metric label="收款模式" value="Connect" detail="站点独立收款" />
              </div>
            </div>
          </Panel>
        </div>
      </section>
      <section className="px-5 pb-6">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Panel className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay">route map</p>
                <h2 className="mt-2 text-2xl font-semibold">各入口职责</h2>
              </div>
              <LayoutDashboard className="h-5 w-5 text-zinc-400" strokeWidth={1.8} />
            </div>
            <div className="mt-5 grid gap-3">
              {[
                { route: "/", note: "系统总入口，用于引导进入平台后台、站点后台和客户前台。" },
                { route: `/site/${primarySite?.slug ?? "lumen"}`, note: "客户前台站点，展示主题页面、套餐、工具入口和注册登录。" },
                { route: `/site/${primarySite?.slug ?? "lumen"}/login`, note: "当前站点客户登录入口，只进入本站会员工作台。" },
                { route: `/site/${primarySite?.slug ?? "lumen"}/admin`, note: "当前站点后台，管理装修、商品、顾客、订单、内容和设置。" },
                { route: "/platform", note: "平台总后台，跨站管理店铺、域名、主题基线和网关策略。" }
              ].map((item) => (
                <div className="rounded-[16px] border border-black/10 bg-white p-4" key={item.route}>
                  <p className="font-mono text-xs text-zinc-700">{item.route}</p>
                  <p className="mt-1 text-sm text-zinc-600">{item.note}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay">multi-site registry</p>
                <h2 className="mt-2 text-2xl font-semibold">已存在站点</h2>
              </div>
              <StatusPill label={`${totalSites} 个站点`} tone="good" />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              这里读取的是当前持久化平台状态，不是静态展示数据。每个站点都具备独立后台、独立客户体系、独立前台页面和独立主题内容。
            </p>
            <div className="mt-5 grid gap-3">
              {listedSites.map((site) => (
                <div className="rounded-[18px] border border-black/10 bg-white p-4 shadow-[0_18px_48px_-44px_rgba(24,24,27,0.45)]" key={site.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{site.name}</p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">{site.primaryDomain}</p>
                    </div>
                    <StatusPill label={site.status} tone={site.status === "active" ? "good" : "warn"} />
                  </div>
                  <div className="mt-3 grid gap-1 text-xs leading-5 text-zinc-500">
                    <p>{`后台账号: ${site.adminEmail ?? `owner@${site.slug}.localhost`} / ${site.slug}123`}</p>
                    <p>{`客户账号: ${site.customerEmail ?? "mara@northpier.studio"} / mara123`}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { label: "前台", href: `/site/${site.slug}` },
                      { label: "后台", href: `/site/${site.slug}/admin/login` },
                      { label: "设计器", href: `/site/${site.slug}/admin/design` }
                    ].map((item) => (
                      <Link className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#fbfbfa] px-3 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50" href={item.href} key={`${site.id}:${item.label}`}>
                        <span>{item.label}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.8} />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
      <section className="px-5 pb-20">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[1fr_1.4fr_0.9fr]">
          {[
            { icon: Globe2, label: "站点隔离", text: "客户、订单、相册、素材、账本和主题发布全部带 site_id，不跨站混读。" },
            { icon: Brush, label: "主题设计器", text: "页面草稿使用 section JSON 保存，发布后由 snapshot 驱动前台。" },
            { icon: CreditCard, label: "收款边界", text: "每站点独立 Stripe Connect，平台保留总控和抽佣能力。" },
            { icon: Workflow, label: "工作流边界", text: "AI worker 可以接 N8N，但用户、支付和额度主数据仍在平台后端。" },
            { icon: Database, label: "账本体系", text: "credits 通过 grant、reserve、consume、release、adjustment 流转。" },
            { icon: Boxes, label: "多主题能力", text: "站点支持多主题导入、复制、应用到草稿和切换线上启用版本。" }
          ].map((item) => (
            <Panel className="p-6" key={item.label}>
              <item.icon className="h-5 w-5 text-clay" strokeWidth={1.8} />
              <h3 className="mt-5 text-xl font-semibold">{item.label}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.text}</p>
              <ArrowUpRight className="mt-5 h-4 w-4 text-zinc-400" strokeWidth={1.8} />
            </Panel>
          ))}
        </div>
      </section>
    </Shell>
  );
}
