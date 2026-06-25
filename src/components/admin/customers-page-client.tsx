"use client";

import { useEffect, useMemo, useState } from "react";
import { GalleryVerticalEnd, Sparkles, UploadCloud, Users } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { AlbumDeliveryPanel } from "@/components/admin/album-delivery-panel";
import { CustomerAdminPanel } from "@/components/admin/customer-admin-panel";
import { CustomerAssetReviewPanel } from "@/components/admin/customer-asset-review-panel";
import { ErpSection, ErpStatGrid } from "@/components/admin/erp-primitives";
import { ModelTrainingPanel } from "@/components/admin/model-training-panel";
import type { Album, AssetUpload, CreativePack, CustomerModel, PublicCustomer, SiteAdmin } from "@/lib/types";

type CustomersPagePayload = {
  customers: PublicCustomer[];
  customerModels: CustomerModel[];
  albums: Album[];
  packs: CreativePack[];
  customerAssets: AssetUpload[];
  siteAdmins: SiteAdmin[];
  signupCreditGrant: number;
  error?: string;
};

type CustomersPageClientProps = {
  siteId: string;
  initialCustomerCount: number;
  initialAvailableCredits: number;
  initialReservedCredits: number;
  initialReadyModels: number;
  initialModelCount: number;
  initialReadyAlbums: number;
  initialAlbumCount: number;
  initialGeneratedAssetCount: number;
  initialSignupCreditGrant: number;
};

function CustomersDetailsSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true">
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
        <div className="h-5 w-36 animate-pulse rounded bg-[#e8edf5]" />
        <div className="mt-5 grid gap-3">
          <div className="h-12 w-full animate-pulse rounded bg-[#eef2f7]" />
          <div className="h-12 w-full animate-pulse rounded bg-[#eef2f7]" />
          <div className="h-12 w-2/3 animate-pulse rounded bg-[#eef2f7]" />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
          <div className="h-5 w-28 animate-pulse rounded bg-[#e8edf5]" />
          <div className="mt-5 h-40 w-full animate-pulse rounded bg-[#eef2f7]" />
        </div>
        <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
          <div className="h-5 w-28 animate-pulse rounded bg-[#e8edf5]" />
          <div className="mt-5 h-40 w-full animate-pulse rounded bg-[#eef2f7]" />
        </div>
      </div>
    </div>
  );
}

export function CustomersPageClient({
  siteId,
  initialCustomerCount,
  initialAvailableCredits,
  initialReservedCredits,
  initialReadyModels,
  initialModelCount,
  initialReadyAlbums,
  initialAlbumCount,
  initialGeneratedAssetCount,
  initialSignupCreditGrant
}: CustomersPageClientProps) {
  const [payload, setPayload] = useState<CustomersPagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadCustomersPage() {
      try {
        setError(null);
        const response = await fetchAdminJson<CustomersPagePayload>(`/api/sites/${siteId}/admin/customers-page`, { init: { signal: controller.signal } });
        const result = response.data;
        if (!active) return;
        if (!response.ok) {
          setError(result.error ?? "顾客数据加载失败。");
          return;
        }
        setPayload(result);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : "顾客数据加载失败。");
      }
    }
    void loadCustomersPage();
    return () => {
      active = false;
      controller.abort();
    };
  }, [siteId]);

  const derived = useMemo(() => {
    const customers = payload?.customers ?? [];
    const customerModels = payload?.customerModels ?? [];
    const albums = payload?.albums ?? [];
    const customerAssets = payload?.customerAssets ?? [];
    return {
      blockedCustomers: customers.filter((customer) => customer.status === "blocked").length,
      customerCount: payload ? customers.length : initialCustomerCount,
      generatedAssets: customerAssets.filter((asset) => asset.role === "output"),
      inputAssets: customerAssets.filter((asset) => asset.role === "input"),
      readyAlbums: payload ? albums.filter((album) => album.status === "ready").length : initialReadyAlbums,
      readyModels: payload ? customerModels.filter((model) => model.status === "ready").length : initialReadyModels,
      pastDueCustomers: customers.filter((customer) => customer.status === "past_due").length
    };
  }, [initialCustomerCount, initialReadyAlbums, initialReadyModels, payload]);

  return (
    <div className="grid gap-5">
      <ErpStatGrid
        items={[
          { label: "顾客", value: String(derived.customerCount), detail: `${derived.pastDueCustomers} 个逾期 / ${derived.blockedCustomers} 个封禁`, icon: Users, tone: derived.blockedCustomers ? "bad" : derived.pastDueCustomers ? "warn" : "good" },
          { label: "额度", value: String(initialAvailableCredits), detail: `${initialAvailableCredits} 可用 / ${initialReservedCredits} 预扣`, icon: UploadCloud, tone: initialReservedCredits ? "warn" : "good" },
          { label: "模型", value: `${derived.readyModels}/${payload?.customerModels.length || initialModelCount}`, detail: "已就绪客户模型", icon: Sparkles, tone: derived.readyModels ? "good" : "warn" },
          { label: "相册", value: `${derived.readyAlbums}/${payload?.albums.length || initialAlbumCount}`, detail: `${derived.generatedAssets.length || initialGeneratedAssetCount} 个生成输出`, icon: GalleryVerticalEnd, tone: derived.readyAlbums ? "good" : "warn" }
        ]}
      />

      {error ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !payload ? (
        <CustomersDetailsSkeleton />
      ) : (
        <>
      <ErpSection
        description="这里处理本站顾客状态、余额和额度调整。邮箱相同的顾客在不同站点不会合并。"
        eyebrow="会员列表"
        title="会员运营列表"
      >
        <div className="mt-5">
          <CustomerAdminPanel
            customers={payload.customers}
            signupCreditGrant={payload.signupCreditGrant ?? initialSignupCreditGrant}
            siteAdmins={payload.siteAdmins}
            siteId={siteId}
          />
        </div>
      </ErpSection>

      <div className="grid gap-5">
        <ErpSection description="模型训练进度、素材要求和训练就绪状态按顾客单独管理。" eyebrow="模型训练" title="客户模型">
          <ModelTrainingPanel customers={payload.customers} models={payload.customerModels} siteId={siteId} />
        </ErpSection>
        <ErpSection description="相册和输出素材只属于当前站点和当前顾客，不允许跨站读取。" eyebrow="相册交付" title="相册交付">
          <AlbumDeliveryPanel albums={payload.albums} assets={derived.generatedAssets} customers={payload.customers} packs={payload.packs} siteId={siteId} />
        </ErpSection>
      </div>

      <ErpSection
        description="源图、训练图和输出图按当前站点筛选展示，便于验收客户私有素材边界和审核状态。"
        eyebrow="客户素材"
        title="客户素材表格"
      >
        <CustomerAssetReviewPanel
          assets={payload.customerAssets}
          customers={payload.customers}
          models={payload.customerModels}
          siteId={siteId}
        />
      </ErpSection>
        </>
      )}
    </div>
  );
}
