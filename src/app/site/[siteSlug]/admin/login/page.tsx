import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminLoginScreen } from "@/components/auth/admin-login-screen";
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import { authMessageForCode } from "@/lib/auth-messages";
import { getSiteAdminBySessionFromState, readPlatformState } from "@/lib/server-store";
import { siteAdminSessionCookie } from "@/lib/session";

export default async function SiteAdminLoginPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  const sessionId = (await cookies()).get(siteAdminSessionCookie(site.id))?.value;
  if (getSiteAdminBySessionFromState(state, site.id, sessionId)) redirect(`/site/${site.slug}/admin`);
  const defaultEmail = state.siteAdmins.find((admin) => admin.siteId === site.id)?.email ?? `owner@${site.slug}.localhost`;
  const errorCode = (await searchParams)?.error;

  return (
    <AdminLoginScreen
      brand={site.branding.logoText}
      description="登录后进入当前站点独立后台。客户、套餐、收款、素材、设计器、发布记录和 AI 任务都只在这个站点范围内生效。"
      eyebrow="站点后台入口"
      formDescription="登录后只进入当前站点的管理后台，不跨店铺读取客户、订单、素材和账本数据。"
      form={
        <PasswordLoginForm
          authScope="site_admin"
          defaultEmail={defaultEmail}
          defaultPassword={`${site.slug}123`}
          demoLabel={`${defaultEmail} / ${site.slug}123`}
          emailLabel="登录账号"
          endpoint={`/api/sites/${site.id}/admin/auth/login`}
          fallbackAction={`/site/${site.slug}/admin/login/submit`}
          initialMessage={authMessageForCode("site_admin", errorCode)}
          passwordLabel="登录密码"
          redirectTo={`/site/${site.slug}/admin`}
          submitLabel="进入站点后台"
          variant="erp"
        />
      }
      links={[
        { label: "查看前台", href: `/site/${site.slug}` },
        { label: "客户登录", href: `/site/${site.slug}/login` },
        { label: "平台后台", href: "/platform/login" }
      ]}
      stats={[
        { label: "站点域名", value: site.primaryDomain, detail: "当前登录只作用于这个站点的后台数据。" },
        { label: "页面与主题", value: `${site.pages.length} 个页面`, detail: "设计器、页面树、导航、SEO、发布都在本站管理。" },
        { label: "支付与套餐", value: `${site.connect.chargesEnabled ? "已就绪" : "待配置"}`, detail: "Stripe Connect、订阅套餐、credits 都按站点隔离。" },
        { label: "AI 工作流", value: "站点隔离", detail: "任务、相册、素材和顾客体系都不跨站共享。" }
      ]}
      title="站点后台登录"
    />
  );
}
