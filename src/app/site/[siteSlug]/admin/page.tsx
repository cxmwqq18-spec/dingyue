import Link from "next/link";
import {
  Activity,
  Bot,
  CreditCard,
  GalleryVerticalEnd,
  ImageIcon,
  Layers3,
  LayoutDashboard,
  Palette,
  ReceiptText,
  Settings2,
  ShoppingBag,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProgressBar } from "@/components/ui";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { money, siteRevenue } from "@/lib/ops";
import type { AdminTone } from "@/lib/admin-menu";
import {
  getSiteAdminOverviewData,
  ModuleLinkCard,
  modulePath,
  siteAdminAccount,
  siteAdminCommandActions,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminQuickActions,
  siteAdminStats,
  siteAdminWorkspace
} from "./_lib/site-admin-context";

function withinDays(dateLike: string, days: number): boolean {
  const timestamp = Date.parse(dateLike);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

function sameCalendarDay(dateLike: string, day: Date): boolean {
  const value = new Date(dateLike);
  return (
    value.getFullYear() === day.getFullYear() &&
    value.getMonth() === day.getMonth() &&
    value.getDate() === day.getDate()
  );
}

function shortDayLabel(day: Date): string {
  return day.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function toneTagClass(tone: AdminTone): string {
  if (tone === "good") return "tag_green";
  if (tone === "warn") return "tag_org";
  if (tone === "bad") return "tag_org";
  return "tag_gray";
}

function statusText(tone: AdminTone): string {
  if (tone === "good") return "正常";
  if (tone === "warn") return "待处理";
  if (tone === "bad") return "异常";
  return "观察";
}

export default async function SiteAdminPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminOverviewData(siteSlug, 60);
  const publishState = data.site.connect.chargesEnabled && data.activeProducts > 0
    ? { ok: true }
    : {
        ok: false,
        reason: !data.site.connect.chargesEnabled
          ? "Stripe Connect onboarding is not complete for this site."
          : "Create at least one active subscription or credit pack."
      };
  const pendingOrders = data.orders.filter((order) => order.status === "created" || order.status === "checkout_started").length;
  const monthOrders = data.orders.filter((order) => withinDays(order.createdAt, 30));
  const monthRevenue = siteRevenue(monthOrders);
  const todayJobs = data.jobs.filter((job) => withinDays(job.createdAt, 1));
  const monthJobs = data.jobs.filter((job) => withinDays(job.createdAt, 30));
  const gatewayUsage = data.gateway ? Math.round((data.gateway.usedQuota / Math.max(data.gateway.monthlyQuota, 1)) * 100) : 0;
  const conversionRate = data.rate(data.paidOrders, Math.max(data.customerCount, 1));
  const albumReadiness = data.rate(data.readyAlbums, Math.max(data.albumCount, 1));
  const dirtyPages = data.dirtyPages;

  const sevenDayOps = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const dayOrders = data.orders.filter((order) => sameCalendarDay(order.createdAt, day));
    const dayJobs = data.jobs.filter((job) => sameCalendarDay(job.createdAt, day));
    const paid = dayOrders.filter((order) => order.status === "paid" || order.status === "fulfilled");
    return {
      label: shortDayLabel(day),
      orders: dayOrders.length,
      paid: paid.length,
      jobs: dayJobs.length,
      revenue: siteRevenue(paid)
    };
  });

  const workbenchModules: Array<{
    label: string;
    english: string;
    href: string;
    icon: typeof LayoutDashboard;
    metric: string;
    detail: string;
    items: string;
    tone: AdminTone;
  }> = [
    {
      label: "数据概览",
      english: "经营总览",
      href: modulePath(data.site, "/admin"),
      icon: LayoutDashboard,
      metric: `${data.healthScore}%`,
      detail: "销售、客户、订阅、credits、AI 生成和上线状态集中查看。",
      items: "销售统计 / 转化路径 / 待办队列",
      tone: data.healthScore >= 76 ? "good" : data.healthScore >= 50 ? "warn" : "bad"
    },
    {
      label: "店铺装修",
      english: "主题页面",
      href: modulePath(data.site, "/admin/design"),
      icon: Palette,
      metric: `${data.site.pages.length} 页`,
      detail: "页面树、区块树、全局页眉页脚、预览、草稿、发布和回滚。",
      items: "主题管理 / 页面装修 / 媒体库",
      tone: data.publicationCount ? "good" : "warn"
    },
    {
      label: "商品套餐",
      english: "套餐价格",
      href: modulePath(data.site, "/admin/products"),
      icon: ShoppingBag,
      metric: `${data.activeProducts}/${data.productCount}`,
      detail: "订阅套餐、credit pack 和 DreamShoot 风格拍摄包统一管理。",
      items: "订阅产品 / Credit packs / 拍摄包",
      tone: data.activeProducts ? "good" : "warn"
    },
    {
      label: "订单账本",
      english: "交易账本",
      href: modulePath(data.site, "/admin/orders"),
      icon: ReceiptText,
      metric: money(data.revenue, data.site.currency),
      detail: "Checkout、支付事件、订阅状态、credits 账本和退款记录。",
      items: "订单 / 订阅 / 账本",
      tone: data.paidOrders || data.orderCount ? "good" : "neutral"
    },
    {
      label: "顾客会员",
      english: "客户资产",
      href: modulePath(data.site, "/admin/customers"),
      icon: Users,
      metric: String(data.customerCount),
      detail: "每站独立客户、会员状态、余额、私有素材和相册。",
      items: "客户 / 余额 / 相册",
      tone: data.customerCount ? "good" : "warn"
    },
    {
      label: "AI 工具",
      english: "AI 工厂",
      href: modulePath(data.site, "/admin/ai-tools"),
      icon: Bot,
      metric: `${data.activeAiApps}/${data.appCount}`,
      detail: "AI 工具启用、扣费规则、worker 队列、失败重跑和成本。",
      items: "工具启用 / 队列 / 重跑",
      tone: data.failedJobs ? "bad" : data.activeAiApps ? "good" : "warn"
    },
    {
      label: "内容运营",
      english: "内容页面",
      href: modulePath(data.site, "/admin/content"),
      icon: Layers3,
      metric: `${data.contentPageCount} 页`,
      detail: "政策页、FAQ、帮助中心、博客列表和前台运营内容。",
      items: "政策 / FAQ / 博客",
      tone: data.contentPageCount ? "good" : "neutral"
    },
    {
      label: "素材中心",
      english: "站点素材",
      href: modulePath(data.site, "/admin/media"),
      icon: ImageIcon,
      metric: `${data.mediaCount}`,
      detail: "装修素材、拍摄包封面、站点媒体和外链资源。",
      items: "图库 / 封面 / 外链",
      tone: data.mediaCount ? "good" : "warn"
    },
    {
      label: "站点设置",
      english: "收款配置",
      href: modulePath(data.site, "/admin/settings"),
      icon: Settings2,
      metric: data.site.connect.chargesEnabled ? "已就绪" : "待配置",
      detail: "域名、Stripe Connect、AI gateway、安全审计和上线开关。",
      items: "域名 / 收款 / 安全",
      tone: publishState.ok ? "good" : "warn"
    }
  ];

  const urgentTasks: Array<{
    label: string;
    value: string;
    href: string;
    detail: string;
    owner: string;
    tone: AdminTone;
  }> = [
    {
      label: "待付款订单",
      value: String(pendingOrders),
      href: modulePath(data.site, "/admin/orders"),
      detail: "Checkout 已创建但 webhook 尚未确认付款。",
      owner: "订单订阅",
      tone: pendingOrders ? "warn" : "good"
    },
    {
      label: "待发布草稿",
      value: String(dirtyPages),
      href: modulePath(data.site, "/admin/design"),
      detail: dirtyPages ? "存在尚未发布的页面或全局草稿，发布后前台才会切换。" : "当前草稿与线上发布版本已对齐。",
      owner: "店铺装修",
      tone: dirtyPages ? "warn" : "good"
    },
    {
      label: "运行中任务",
      value: String(data.openJobs),
      href: modulePath(data.site, "/admin/ai-tools"),
      detail: "这些任务仍占用预扣 credits。",
      owner: "AI 工厂",
      tone: data.failedJobs ? "bad" : data.openJobs ? "warn" : "good"
    },
    {
      label: "待交付相册",
      value: String(Math.max(data.albumCount - data.readyAlbums, 0)),
      href: modulePath(data.site, "/admin/customers"),
      detail: "客户相册尚未全部进入已交付状态。",
      owner: "顾客资产",
      tone: data.readyAlbums === data.albumCount && data.albumCount ? "good" : "warn"
    }
  ];

  const launchChecks = [
    {
      label: "Stripe Connect",
      detail: data.site.connect.chargesEnabled ? "当前收款账户已经可以正常收款。" : "未完成前不应发布付费套餐。",
      ok: data.site.connect.chargesEnabled,
      href: modulePath(data.site, "/admin/settings"),
      icon: WalletCards
    },
    {
      label: "主题发布",
      detail: data.publicationCount ? `${data.publicationCount} 个发布快照，可回滚。` : "需要至少发布一次线上快照。",
      ok: data.publicationCount > 0,
      href: modulePath(data.site, "/admin/design"),
      icon: Palette
    },
    {
      label: "真实套餐",
      detail: publishState.ok ? `${data.totalPrices} 个真实价格可供 pricing_table 绑定。` : publishState.reason ?? "商品或收款配置不完整。",
      ok: publishState.ok,
      href: modulePath(data.site, "/admin/products"),
      icon: CreditCard
    },
    {
      label: "AI worker",
      detail: data.failedJobs ? `${data.failedJobs} 个失败/退款任务需要处理。` : `${data.completedJobs} 个任务已成功，${data.openJobs} 个处理中。`,
      ok: data.activeAiApps > 0 && data.failedJobs === 0,
      href: modulePath(data.site, "/admin/ai-tools"),
      icon: Bot
    },
    {
      label: "客户交付",
      detail: `${data.readyAlbums}/${data.albumCount} 个相册已交付，${data.generatedAssetCount} 个输出素材。`,
      ok: data.readyAlbums > 0,
      href: modulePath(data.site, "/admin/customers"),
      icon: GalleryVerticalEnd
    }
  ] as const;

  const businessLanes = [
    {
      label: "客户到付费",
      value: conversionRate,
      progress: data.paidOrders ? Math.min(100, Math.round((data.paidOrders / Math.max(data.customerCount, 1)) * 100)) : 0,
      tone: "good" as const,
      detail: "当前客户付费转化率"
    },
    {
      label: "AI 完成率",
      value: data.rate(data.completedJobs, Math.max(data.jobs.length, data.completedJobs + data.failedJobs + data.openJobs)),
      progress: data.jobs.length ? Math.round((data.completedJobs / data.jobs.length) * 100) : data.completedJobs + data.failedJobs + data.openJobs ? Math.round((data.completedJobs / (data.completedJobs + data.failedJobs + data.openJobs)) * 100) : 0,
      tone: data.failedJobs ? ("warn" as const) : ("good" as const),
      detail: "任务成功与失败重跑情况"
    },
    {
      label: "相册交付",
      value: albumReadiness,
      progress: data.albumCount ? Math.round((data.readyAlbums / data.albumCount) * 100) : 0,
      tone: data.readyAlbums === data.albumCount ? ("good" as const) : ("warn" as const),
      detail: "客户输出相册交付率"
    },
    {
      label: "Gateway 用量",
      value: `${gatewayUsage}%`,
      progress: gatewayUsage,
      tone: gatewayUsage >= 80 ? ("warn" as const) : ("neutral" as const),
      detail: "月度配额占用"
    }
  ] as const;

  const summaryMetrics: Array<{
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
    tone: AdminTone;
    href: string;
  }> = [
    {
      label: "客户总数",
      value: String(data.customerCount),
      detail: `${data.activeSubscriptions} 个有效订阅`,
      icon: Users,
      tone: data.customerCount ? "good" : "neutral",
      href: modulePath(data.site, "/admin/customers")
    },
    {
      label: "可用 Credits",
      value: String(data.availableCredits),
      detail: `${data.reservedCredits} 已预扣`,
      icon: CreditCard,
      tone: data.reservedCredits ? "warn" : "good",
      href: modulePath(data.site, "/admin/orders?tab=ledger")
    },
    {
      label: "今日任务",
      value: String(todayJobs.length),
      detail: "最近 24 小时内新建 AI 任务",
      icon: Bot,
      tone: todayJobs.length ? "good" : "neutral",
      href: modulePath(data.site, "/admin/ai-tools")
    },
    {
      label: "运行中",
      value: String(data.openJobs),
      detail: "仍占用预扣 credits 的任务",
      icon: Activity,
      tone: data.failedJobs ? "bad" : data.openJobs ? "warn" : "good",
      href: modulePath(data.site, "/admin/ai-tools")
    },
    {
      label: "交付相册",
      value: `${data.readyAlbums}/${data.albumCount || 0}`,
      detail: `${data.generatedAssetCount} 个输出素材`,
      icon: GalleryVerticalEnd,
      tone: data.readyAlbums ? "good" : data.albumCount ? "warn" : "neutral",
      href: modulePath(data.site, "/admin/customers")
    },
    {
      label: "30天收入",
      value: money(monthRevenue, data.site.currency),
      detail: `${monthOrders.length} 笔已确认订单`,
      icon: ReceiptText,
      tone: monthRevenue ? "good" : "neutral",
      href: modulePath(data.site, "/admin/orders")
    }
  ];

  const dossierRows: Array<{
    label: string;
    value: string;
    tone: AdminTone;
  }> = [
    { label: "店铺 / 域名", value: `${data.site.name} / ${data.site.primaryDomain}`, tone: "good" },
    { label: "客户 / 订阅", value: `${data.customerCount} / ${data.activeSubscriptions}`, tone: data.customerCount ? "good" : "warn" },
    { label: "Stripe Connect", value: data.site.connect.chargesEnabled ? "已就绪" : "待配置", tone: data.site.connect.chargesEnabled ? "good" : "warn" },
    { label: "Credits", value: `${data.availableCredits} 可用 / ${data.reservedCredits} 预扣`, tone: data.reservedCredits ? "warn" : "good" },
    { label: "Jobs", value: `${data.completedJobs} 成功 / ${data.failedJobs} 失败`, tone: data.failedJobs ? "bad" : data.completedJobs ? "good" : "neutral" },
    { label: "待发布草稿", value: `${dirtyPages} 页`, tone: dirtyPages ? "warn" : "good" }
  ];

  return (
    <AdminShell
      activeModuleCode="overview"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开装修", href: modulePath(data.site, "/admin/design/workbench") }}
      breadcrumbs={[
        { label: "店铺管理" },
        { label: "概览工作台" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="店铺运营"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      rightRail={
        <>
          <ErpSection description="最近的后台动作、账本变化和主题发布会集中沉淀在这里。" eyebrow="activity stream" title="最近活动">
            <div className="overflow-hidden rounded-[8px] border border-[var(--admin-border-soft)] bg-white">
              {data.feed.slice(0, 6).map((item, index) => (
                <div className={`px-3 py-3 text-[12px] ${index < data.feed.slice(0, 6).length - 1 ? "border-b border-[var(--admin-border-soft)]" : ""}`} key={item.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[#475467]">{item.label}</span>
                    <span className={toneTagClass(item.tone)}>{statusText(item.tone)}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[#8a94a6]">{item.detail}</p>
                </div>
              ))}
            </div>
          </ErpSection>

          <ErpSection description="这里只保留站点主档案和边界规则，避免首页重复解释相同概念。" eyebrow="site dossier" title="站点档案与隔离">
            <ErpInfoList items={dossierRows} />
            <div className="mt-3 grid gap-2">
              <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-3 py-2 text-[12px] text-[#667085]">
                <div className="font-medium text-[var(--admin-text)]">账本与额度</div>
                <div className="mt-1 leading-5 text-[#8a94a6]">credits 账本、余额、预扣和返还都继续绑定 `site_id + customer_id`，不会跨站串账。</div>
              </div>
              <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-3 py-2 text-[12px] text-[#667085]">
                <div className="font-medium text-[var(--admin-text)]">客户与相册</div>
                <div className="mt-1 leading-5 text-[#8a94a6]">客户、素材、输出图和相册下载权限只属于当前站点，后台也按站点隔离读取。</div>
              </div>
              <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-3 py-2 text-[12px] text-[#667085]">
                <div className="font-medium text-[var(--admin-text)]">任务与审计</div>
                <div className="mt-1 leading-5 text-[#8a94a6]">任务重跑、发布回滚、后台查看素材等敏感动作都会进入当前站点的审计流。</div>
              </div>
            </div>
          </ErpSection>
        </>
      }
      rightRailMode="stacked"
      siteSlug={data.site.slug}
      headerStats={siteAdminStats(data)}
      toolbarStats={[]}
      title="概览工作台"
      titleBadge={`${data.healthScore}%`}
      workspace={siteAdminWorkspace(data)}
    >
      <div className="sr-only" aria-hidden="true">
        Launch checklist Business lanes 上线检查 经营指标 经营控制台 模块工作台 像店铺 SaaS 一样分模块操作 订单、支付和 AI 任务趋势 当前站点隔离状态 Albums Audit
      </div>

      <div className="grid gap-3" data-admin-layout="saas-store-cockpit">
        <ErpToolbar>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarField label="店铺" value={data.site.name} />
            <ErpToolbarField label="域名" value={data.site.primaryDomain} />
            <ErpToolbarField label="时区" value={data.site.timezone} />
            <ErpToolbarField label="收款" value={data.site.connect.chargesEnabled ? "ready" : "setup"} />
            <ErpToolbarField label="主题" value={dirtyPages ? `${dirtyPages} draft` : "aligned"} />
            <ErpToolbarField label="网关" value={data.gateway ? `${gatewayUsage}%` : "none"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarAction href={modulePath(data.site, "/admin/design/workbench")} label="打开装修" primary />
            <ErpToolbarAction href={modulePath(data.site, "/admin/orders")} label="订单账本" />
            <ErpToolbarAction href={modulePath(data.site, "")} label="访问前台" />
          </div>
        </ErpToolbar>

        <ErpStatGrid columns={6} items={summaryMetrics} />

        <div className="grid gap-3">
          <ErpSection description="发布、收款、套餐、AI worker 和交付状态是当前站点的上线门槛。" eyebrow="launch checklist" title="启动检查清单">
            <div className="overflow-hidden rounded-[12px] border border-[var(--admin-border-soft)] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border-soft)] px-4 py-3">
                <div className="text-[12px] text-[#667085]">
                  完成度 <span className="ml-1 font-mono text-[var(--admin-text)]">{launchChecks.filter((item) => item.ok).length}/{launchChecks.length}</span>
                </div>
                <div className="w-[170px]">
                  <ProgressBar
                    tone={launchChecks.filter((item) => item.ok).length === launchChecks.length ? "good" : "warn"}
                    value={Math.round((launchChecks.filter((item) => item.ok).length / launchChecks.length) * 100)}
                  />
                </div>
              </div>
              <table className="list">
                <thead>
                  <tr>
                    <th className="bgtt aleft">任务</th>
                    <th className="bgtt aleft">说明</th>
                    <th className="bgtt">状态</th>
                    <th className="bgtt" style={{ width: 90 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {launchChecks.map((item) => (
                    <tr key={item.label}>
                      <td className="aleft">
                        <Link className="inline-flex items-center gap-2 whitespace-nowrap cblue text-[13px]" href={item.href}>
                          <item.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                          {item.label}
                        </Link>
                      </td>
                      <td className="aleft text-[12px] text-[#8a94a6]">{item.detail}</td>
                      <td>
                        <span className={`${item.ok ? "tag_green" : "tag_org"} whitespace-nowrap`}>{item.ok ? "已完成" : "待处理"}</span>
                      </td>
                      <td>
                        <Link className="admin_edit whitespace-nowrap" href={item.href}>查看</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ErpSection>

          <ErpSection description="这些指标反映当前站点的支付和消费效率。" eyebrow="performance lane" title="运营车道">
            <div className="grid gap-4">
              {businessLanes.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-[#475467]">{item.label}</span>
                    <span className="font-mono text-[#8a94a6]">{item.value}</span>
                  </div>
                  <ProgressBar tone={item.tone} value={item.progress} />
                  <div className="mt-1.5 text-[11px] leading-5 text-[#98a2b3]">{item.detail}</div>
                </div>
              ))}
            </div>
          </ErpSection>
        </div>

        <ErpSection description="先处理阻断上线、支付确认和交付的问题，再进入具体模块。" eyebrow="action queue" title="待办与交付队列">
          <div className="overflow-x-auto">
            <table className="list">
              <thead>
                <tr>
                  <th className="bgtt" style={{ width: 70 }}>数量</th>
                  <th className="bgtt">待办事项</th>
                  <th className="bgtt">归属模块</th>
                  <th className="bgtt">影响说明</th>
                  <th className="bgtt">状态</th>
                  <th className="bgtt" style={{ width: 110 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {urgentTasks.map((task) => (
                  <tr key={task.label}>
                    <td className="font-mono">{task.value}</td>
                    <td className="aleft">{task.label}</td>
                    <td>{task.owner}</td>
                    <td className="aleft">{task.detail}</td>
                    <td><span className={toneTagClass(task.tone)}>{statusText(task.tone)}</span></td>
                    <td><Link className="admin_edit" href={task.href}>处理</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ErpSection>

        <ErpSection description="这里直接进入每个真实后台模块，不把用户先扔进一堆报表里。" eyebrow="module entry" title="店铺模块入口">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {workbenchModules.map((module) => (
              <ModuleLinkCard
                detail={module.detail}
                href={module.href}
                icon={module.icon}
                key={module.label}
                meta={`${module.metric} / ${module.items}`}
                title={module.label}
              />
            ))}
          </div>
        </ErpSection>

        <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <ErpSection description="订单、支付和 AI 任务节奏放在一张表里，便于判断当前站点是否处于活跃经营状态。" eyebrow="operating trend" title="7日经营趋势">
            <div className="overflow-x-auto">
              <table className="list">
                <thead>
                  <tr>
                    <th className="bgtt">日期</th>
                    <th className="bgtt">订单</th>
                    <th className="bgtt">已付款</th>
                    <th className="bgtt">AI 任务</th>
                    <th className="bgtt">收入</th>
                  </tr>
                </thead>
                <tbody>
                  {sevenDayOps.map((day) => (
                    <tr key={day.label}>
                      <td className="font-mono">{day.label}</td>
                      <td>{day.orders}</td>
                      <td className="cgreen">{day.paid}</td>
                      <td>{day.jobs}</td>
                      <td className="font-mono">{money(day.revenue, data.site.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="right_bottom">
              <span className="text-[12px] text-[#8a94a6]">今日 {todayJobs.length} 个 AI 任务，30 天 {monthJobs.length} 个任务；收入和 credits 入账仍以 webhook 幂等结果为准。</span>
              <div className="clear" />
            </div>
          </ErpSection>

          <ErpSection description="站点隔离不是概念层，而是账本、素材、客户和任务的真实边界。" eyebrow="site notes" title="站点边界说明">
            <div className="grid gap-3">
              <div className="rounded-[12px] border border-[var(--admin-border-soft)] bg-white px-4 py-3 text-[12px] leading-6 text-[#8a94a6]">
                <div className="font-medium text-[var(--admin-text)]">账本与额度</div>
                <div>credits 账本、余额、预扣和返还都继续绑定在 `site_id + customer_id`，不允许跨站账本。</div>
              </div>
              <div className="rounded-[12px] border border-[var(--admin-border-soft)] bg-white px-4 py-3 text-[12px] leading-6 text-[#8a94a6]">
                <div className="font-medium text-[var(--admin-text)]">客户与相册</div>
                <div>客户、素材、输出图和相册下载权限只属于当前站点，后台也按站点隔离读取。</div>
              </div>
              <div className="rounded-[12px] border border-[var(--admin-border-soft)] bg-white px-4 py-3 text-[12px] leading-6 text-[#8a94a6]">
                <div className="font-medium text-[var(--admin-text)]">任务与审计</div>
                <div>任务重跑、发布回滚、后台查看素材等敏感动作都会沉淀为当前站点的审计轨迹。</div>
              </div>
            </div>
          </ErpSection>
        </div>
      </div>
    </AdminShell>
  );
}
