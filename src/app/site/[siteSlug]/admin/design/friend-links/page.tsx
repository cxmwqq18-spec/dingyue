import { AdminShell } from "@/components/admin/admin-shell";
import { DesignWorkspaceTabs } from "@/components/admin/design-workspace-tabs";
import { FriendLinksPageClient } from "@/components/admin/friend-links-page-client";
import { getSiteThemePublicationCountRelational } from "@/lib/stores/theme-store";
import { listFooterPartnerBadgesRelational } from "@/lib/stores/footer-partner-badges-store";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../../_lib/site-admin-context";

export default async function DesignFriendLinksPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: ["themeSettings"], summary: false });
  const publicationCount = await getSiteThemePublicationCountRelational(data.site.id);
  const draftSettings = data.site.themeSettings.draftJson;
  const badges = await listFooterPartnerBadgesRelational(data.site.id);
  const seoReady = Boolean(draftSettings.seo?.siteTitle && draftSettings.seo?.siteDescription);

  return (
    <AdminShell
      activeModuleCode="design"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开前台", href: modulePath(data.site, "") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "店铺装修", href: modulePath(data.site, "/admin/design") },
        { label: "友链徽章" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="footer partner badges"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="维护页脚底部的友链徽章（合作伙伴图标）。保存写入站点关系数据，前台下一次请求立即生效，无需发布或部署。"
      title="友链徽章"
      titleBadge={String(badges.length)}
      workspace={siteAdminWorkspace(data, "design workspace")}
    >
      <div className="grid gap-4">
        <DesignWorkspaceTabs
          activePath="/admin/design/friend-links"
          mediaCount={data.mediaCount}
          pageCount={data.site.pages.length}
          publicationCount={publicationCount}
          seoReady={seoReady}
          siteSlug={data.site.slug}
        />
        <FriendLinksPageClient
          initialBadges={badges}
          liveHref={modulePath(data.site, "")}
          siteId={data.site.id}
        />
      </div>
    </AdminShell>
  );
}
