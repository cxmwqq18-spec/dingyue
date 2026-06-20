import { GalleryVerticalEnd, Sparkles, UploadCloud, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { AlbumDeliveryPanel } from "@/components/admin/album-delivery-panel";
import { CustomerAdminPanel } from "@/components/admin/customer-admin-panel";
import { ModelTrainingPanel } from "@/components/admin/model-training-panel";
import { OpsCard, StatusPill } from "@/components/ui";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminCommandActions,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminQuickActions,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function CustomersPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug);
  const blockedCustomers = data.customers.filter((customer) => customer.status === "blocked").length;
  const pastDueCustomers = data.customers.filter((customer) => customer.status === "past_due").length;

  return (
    <AdminShell
      activeModuleCode="customers"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "查看客户前台", href: `/site/${data.site.slug}/app` }}
      breadcrumbs={[
        { label: "店铺管理", href: `/site/${data.site.slug}/admin` },
        { label: "顾客管理" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="customer system"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="每个站点独立客户体系，同邮箱跨站不共享；这里管理客户状态、余额、模型训练、私有相册和素材交付。"
      title="顾客管理"
      titleBadge={String(data.customers.length)}
      workspace={siteAdminWorkspace(data, "customer workspace")}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">customer boundary</p>
            <h2 className="mt-2 text-lg font-semibold">站点隔离检查</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "Customers", value: String(data.customers.length), tone: "good" },
                  { label: "Past due", value: String(pastDueCustomers), tone: pastDueCustomers ? "warn" : "good" },
                  { label: "Blocked", value: String(blockedCustomers), tone: blockedCustomers ? "bad" : "good" },
                  { label: "Private assets", value: String(data.inputAssets.length + data.generatedAssets.length), tone: "good" }
                ]}
              />
            </div>
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-clay">delivery</p>
            <h2 className="mt-2 text-lg font-semibold">相册交付状态</h2>
            <div className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-[12px] border border-zinc-200 bg-white">
              {data.albums.slice(0, 6).map((album) => (
                <div className="p-3 text-sm" key={album.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">{album.title}</p>
                    <StatusPill label={album.status} tone={data.statusTone(album.status)} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-500">{album.outputCount} outputs</p>
                </div>
              ))}
            </div>
          </OpsCard>
        </>
      }
    >
      <div className="grid gap-5">
        <ErpStatGrid
          items={[
            { label: "customers", value: String(data.customers.length), detail: `${pastDueCustomers} past due / ${blockedCustomers} blocked`, icon: Users, tone: blockedCustomers ? "bad" : pastDueCustomers ? "warn" : "good" },
            { label: "credits", value: String(data.availableCredits), detail: `${data.availableCredits} available / ${data.reservedCredits} reserved`, icon: UploadCloud, tone: data.reservedCredits ? "warn" : "good" },
            { label: "models", value: `${data.readyModels}/${data.customerModels.length}`, detail: "ready customer models", icon: Sparkles, tone: data.readyModels ? "good" : "warn" },
            { label: "albums", value: `${data.readyAlbums}/${data.albums.length}`, detail: `${data.generatedAssets.length} generated outputs`, icon: GalleryVerticalEnd, tone: data.readyAlbums ? "good" : "warn" }
          ]}
        />

        <ErpSection
          action={
            <ErpToolbarAction href={modulePath(data.site, "/admin/orders")} label="查看订阅与账本" />
          }
          description="这里处理本站顾客状态、余额和额度调整。邮箱相同的顾客在不同站点不会合并。"
          eyebrow="customer roster"
          title="会员运营列表"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="顾客总数" value={String(data.customers.length)} />
              <ErpToolbarField label="活跃模型" value={`${data.readyModels}/${data.customerModels.length}`} />
              <ErpToolbarField label="相册交付" value={`${data.readyAlbums}/${data.albums.length}`} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarAction href={modulePath(data.site, "/app")} label="客户工作台" />
            </div>
          </ErpToolbar>
          <div className="mt-5">
            <CustomerAdminPanel customers={data.customers} siteId={data.site.id} />
          </div>
        </ErpSection>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <ErpSection description="模型训练进度、素材要求和训练就绪状态按顾客单独管理。" eyebrow="model training" title="客户模型">
            <ModelTrainingPanel customers={data.customers} models={data.customerModels} siteId={data.site.id} />
          </ErpSection>
          <ErpSection description="相册和输出素材只属于当前站点和当前顾客，不允许跨站读取。" eyebrow="album delivery" title="相册交付">
            <AlbumDeliveryPanel albums={data.albums} assets={data.generatedAssets} customers={data.customers} packs={data.packs} siteId={data.site.id} />
          </ErpSection>
        </div>
      </div>
    </AdminShell>
  );
}
