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
import type { JobStatus } from "@/lib/types";

const customersPageRequestTimeoutMs = 12_000;

type CustomerAssetJob = {
  id: string;
  customerId: string;
  status: JobStatus;
  sourceAssetIds: string[];
  outputStorageKeys: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type CustomersPagePayload = {
  customers?: PublicCustomer[];
  customerModels?: CustomerModel[];
  albums?: Album[];
  packs?: CreativePack[];
  customerAssets?: AssetUpload[];
  customerAssetJobs?: CustomerAssetJob[];
  siteAdmins?: SiteAdmin[];
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

function LoadingSection({ title }: { title: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5" aria-busy="true">
      <div className="h-5 w-32 animate-pulse rounded bg-[#e8edf5]" />
      <div className="mt-2 text-[12px] text-[#98a2b3]">{title}加载中...</div>
      <div className="mt-5 grid gap-3">
        <div className="h-12 w-full animate-pulse rounded bg-[#eef2f7]" />
        <div className="h-12 w-5/6 animate-pulse rounded bg-[#eef2f7]" />
      </div>
    </div>
  );
}

function mergePayload(current: CustomersPagePayload | null, next: CustomersPagePayload): CustomersPagePayload {
  return {
    signupCreditGrant: current?.signupCreditGrant ?? next.signupCreditGrant ?? 0,
    customers: next.customers ?? current?.customers,
    customerModels: next.customerModels ?? current?.customerModels,
    albums: next.albums ?? current?.albums,
    packs: next.packs ?? current?.packs,
    customerAssets: next.customerAssets ?? current?.customerAssets,
    customerAssetJobs: next.customerAssetJobs ?? current?.customerAssetJobs,
    siteAdmins: next.siteAdmins ?? current?.siteAdmins
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
    || error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("aborted"));
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
    const controllers = new Set<AbortController>();
    function nextController() {
      const controller = new AbortController();
      controllers.add(controller);
      return controller;
    }
    async function loadDetail(detail: "customers" | "models" | "delivery" | "assets") {
      const controller = nextController();
      try {
        const response = await fetchAdminJson<CustomersPagePayload>(`/api/sites/${siteId}/admin/customers-page?detail=${detail}`, {
          timeoutMs: customersPageRequestTimeoutMs,
          init: { signal: controller.signal }
        });
        const result = response.data;
        if (!response.ok) throw new Error(result.error ?? "顾客数据加载失败。");
        if (active && !controller.signal.aborted) setPayload((current) => mergePayload(current, result));
      } finally {
        controllers.delete(controller);
      }
    }

    async function loadCustomersPage() {
      try {
        setError(null);
        await loadDetail("customers");
        window.setTimeout(() => {
          if (!active) return;
          void (async () => {
            const results = await Promise.allSettled([
              loadDetail("models"),
              loadDetail("delivery"),
              loadDetail("assets")
            ]);
            const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
            if (failed) throw failed.reason;
          })().catch((error) => {
            if (!active || isAbortError(error)) return;
            setError(error instanceof Error ? error.message : "顾客明细加载失败。");
          });
        }, 0);
      } catch (error) {
        if (!active || isAbortError(error)) return;
        setError(error instanceof Error ? error.message : "顾客数据加载失败。");
      }
    }
    void loadCustomersPage();
    return () => {
      active = false;
      for (const controller of controllers) controller.abort();
      controllers.clear();
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
          { label: "模型", value: `${derived.readyModels}/${payload?.customerModels?.length || initialModelCount}`, detail: "已就绪客户模型", icon: Sparkles, tone: derived.readyModels ? "good" : "warn" },
          { label: "相册", value: `${derived.readyAlbums}/${payload?.albums?.length || initialAlbumCount}`, detail: `${derived.generatedAssets.length || initialGeneratedAssetCount} 个生成输出`, icon: GalleryVerticalEnd, tone: derived.readyAlbums ? "good" : "warn" }
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
            customers={payload.customers ?? []}
            signupCreditGrant={payload.signupCreditGrant ?? initialSignupCreditGrant}
            siteAdmins={payload.siteAdmins ?? []}
            siteId={siteId}
          />
        </div>
      </ErpSection>

      <div className="grid gap-5">
        <ErpSection description="模型训练进度、素材要求和训练就绪状态按顾客单独管理。" eyebrow="模型训练" title="客户模型">
          {payload.customerModels ? (
            <ModelTrainingPanel customers={payload.customers ?? []} models={payload.customerModels} siteId={siteId} />
          ) : (
            <LoadingSection title="客户模型" />
          )}
        </ErpSection>
        <ErpSection description="相册和输出素材只属于当前站点和当前顾客，不允许跨站读取。" eyebrow="相册交付" title="相册交付">
          {payload.albums && payload.packs && payload.customerAssets ? (
            <AlbumDeliveryPanel albums={payload.albums} assets={derived.generatedAssets} customers={payload.customers ?? []} packs={payload.packs} siteId={siteId} />
          ) : (
            <LoadingSection title="相册交付" />
          )}
        </ErpSection>
      </div>

      <ErpSection
        description="源图、训练图和输出图按当前站点筛选展示，便于验收客户私有素材边界和审核状态。"
        eyebrow="客户素材"
        title="客户素材表格"
      >
        {payload.customerAssets && payload.customerModels && payload.customerAssetJobs ? (
          <CustomerAssetReviewPanel
            assets={payload.customerAssets}
            assetJobs={payload.customerAssetJobs ?? []}
            customers={payload.customers ?? []}
            models={payload.customerModels}
            siteId={siteId}
          />
        ) : (
          <LoadingSection title="客户素材" />
        )}
      </ErpSection>
        </>
      )}
    </div>
  );
}
