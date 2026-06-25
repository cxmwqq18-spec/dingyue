"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, CreditCard, FileText, PackageCheck, Palette, ShoppingBag } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { CreativePackEditor } from "@/components/admin/creative-pack-editor";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { PricingEditor } from "@/components/admin/pricing-editor";
import { OpsCard, StatusPill } from "@/components/ui";
import { money } from "@/lib/ops";
import type { CreativePack, Product, SiteAiApp } from "@/lib/types";

type ProductsPagePayload = {
  currency: string;
  products: Product[];
  packs: CreativePack[];
  siteAiApps: SiteAiApp[];
  publishState: { ok: boolean; reason?: string };
  error?: string;
};

type ProductsPageClientProps = {
  siteId: string;
  siteSlug: string;
};

function ProductsPageSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5" key={index}>
            <div className="h-3 w-24 animate-pulse rounded bg-[#e8edf5]" />
            <div className="mt-8 h-9 w-20 animate-pulse rounded bg-[#e8edf5]" />
            <div className="mt-4 h-3 w-36 animate-pulse rounded bg-[#eef2f7]" />
          </div>
        ))}
      </div>
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
        <div className="h-5 w-36 animate-pulse rounded bg-[#e8edf5]" />
        <div className="mt-5 h-24 w-full animate-pulse rounded bg-[#eef2f7]" />
      </div>
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
        <div className="h-5 w-36 animate-pulse rounded bg-[#e8edf5]" />
        <div className="mt-5 h-40 w-full animate-pulse rounded bg-[#eef2f7]" />
      </div>
    </div>
  );
}

function modulePath(siteSlug: string, path: string) {
  return `/site/${siteSlug}${path}`;
}

export function ProductsPageClient({ siteId, siteSlug }: ProductsPageClientProps) {
  const [payload, setPayload] = useState<ProductsPagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadProductsPage() {
      try {
        setError(null);
        const response = await fetchAdminJson<ProductsPagePayload>(`/api/sites/${siteId}/admin/products-page`, { init: { signal: controller.signal } });
        const result = response.data;
        if (!active) return;
        if (!response.ok) {
          setError(result.error ?? "商品套餐数据加载失败。");
          return;
        }
        setPayload(result);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : "商品套餐数据加载失败。");
      }
    }
    void loadProductsPage();
    return () => {
      active = false;
      controller.abort();
    };
  }, [siteId]);

  const maintenanceModules = [
    {
      title: "价格套餐",
      href: "#pricing-center",
      icon: CreditCard,
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      detail: "维护前台价格卡、结账金额、到账积分和主推套餐。"
    },
    {
      title: "拍摄包入口",
      href: "#creative-packs",
      icon: Palette,
      tone: "border-violet-200 bg-violet-50 text-violet-700",
      detail: "维护前台 AI 工具入口、消耗积分、输出数量和上下架状态。"
    }
  ];

  const derived = useMemo(() => {
    const products = payload?.products ?? [];
    const packs = payload?.packs ?? [];
    const subscriptionProducts = products.filter((product) => product.type === "subscription");
    const creditPacks = products.filter((product) => product.type === "credit_pack");
    const lowestPrice = products.flatMap((product) => product.prices).sort((left, right) => left.amountCents - right.amountCents)[0];
    return {
      activePacks: packs.filter((pack) => pack.status === "active").length,
      activeProducts: products.filter((product) => product.status === "active").length,
      creditPacks,
      lowestPrice,
      subscriptionProducts,
      totalPrices: products.reduce((sum, product) => sum + product.prices.length, 0)
    };
  }, [payload]);

  if (error) {
    return (
      <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!payload) {
    return <ProductsPageSkeleton />;
  }

  return (
    <div className="grid gap-5">
      <ErpStatGrid
        items={[
          { label: "收款商品", value: `${derived.activeProducts}/${payload.products.length}`, detail: `${derived.totalPrices} 个真实价格`, icon: ShoppingBag, tone: derived.activeProducts ? "good" : "warn" },
          { label: "订阅套餐", value: String(derived.subscriptionProducts.length), detail: "按月收费的收款商品", icon: CreditCard, tone: derived.subscriptionProducts.length ? "good" : "neutral" },
          { label: "Credit 包", value: String(derived.creditPacks.length), detail: "一次性充值积分包", icon: PackageCheck, tone: derived.creditPacks.length ? "good" : "neutral" },
          { label: "AI 拍摄主题", value: `${derived.activePacks}/${payload.packs.length}`, detail: derived.lowestPrice ? `由 Credits 消耗，入口价 ${money(derived.lowestPrice.amountCents, derived.lowestPrice.currency)}` : "未配置价格", icon: Boxes, tone: derived.activePacks ? "good" : "warn" }
        ]}
      />

      <ErpSection
        action={<ErpToolbarAction href={modulePath(siteSlug, "/pricing")} label="打开定价页" primary />}
        description="先确认自己要维护哪个模块，再进入对应区域。页面下方每块都有具体操作说明，避免在长表单里误改数据。"
        eyebrow="操作手册"
        title="本页维护什么"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {maintenanceModules.map((module) => {
            const Icon = module.icon;
            return (
              <a className="rounded-[12px] border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200" href={module.href} key={module.href}>
                <div className="flex items-start gap-3">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border ${module.tone}`}>
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-semibold text-slate-900">{module.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{module.detail}</p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        <div className="mt-4 rounded-[12px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600">
              <FileText className="h-4.5 w-4.5" strokeWidth={1.8} />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold text-slate-900">推荐维护顺序</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                1. 先维护价格套餐，确认金额、周期和到账 Credits。 2. 再维护拍摄包入口，确认工具绑定和每次消耗。
                3. 拍摄包列表内会直接展示前台入口检查口径，保存后打开前台核对即可。
              </p>
            </div>
          </div>
        </div>
      </ErpSection>

      <div className="scroll-mt-24" id="pricing-center">
        <ErpSection
          action={<ErpToolbarAction href={modulePath(siteSlug, "/pricing")} label="打开定价页" primary />}
          description={`这里维护的是 ${payload.products.length} 个收款商品，不是下方 ${payload.packs.length} 个 AI 拍摄主题。订阅、Credit 包、金额、周期、额度和主推标记会影响结账页和充值到账数据。`}
          eyebrow="价格套餐"
          title="价格套餐"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="收款订阅商品" value={String(derived.subscriptionProducts.length)} />
              <ErpToolbarField label="收款 Credit 包" value={String(derived.creditPacks.length)} />
              <ErpToolbarField label="真实价格" value={String(derived.totalPrices)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarAction href={modulePath(siteSlug, "/admin/design")} label="装修定价区块" />
            </div>
          </ErpToolbar>
          <div className="mt-5">
            <PricingEditor products={payload.products} siteId={siteId} />
          </div>
        </ErpSection>
      </div>

      <div className="scroll-mt-24" id="creative-packs">
        <ErpSection
          action={<ErpToolbarAction href={modulePath(siteSlug, "/admin/design")} label="前台装修" />}
          description="这里维护的是 AI 拍摄主题入口，数量可以多于收款商品。客户购买上方套餐获得 Credits，再使用这些主题消耗 Credits。"
          eyebrow="拍摄包入口"
          title="拍摄包入口"
        >
          <div className="mb-4 rounded-[12px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            操作提示：拍摄主题不是收款商品。上方 {payload.products.length} 个商品负责收款和充值，下方 {payload.packs.length} 个主题负责前台可选的生成入口、每次消耗和前台绑定检查。
          </div>
          <CreativePackEditor packs={payload.packs} siteAiApps={payload.siteAiApps} siteId={siteId} />
        </ErpSection>
      </div>
    </div>
  );
}
