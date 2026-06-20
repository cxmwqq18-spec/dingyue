import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginScreen } from "@/components/auth/admin-login-screen";
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import { authMessageForCode } from "@/lib/auth-messages";
import { getPlatformAdminBySessionFromState, readPlatformState } from "@/lib/server-store";
import { platformSessionCookie } from "@/lib/session";

export default async function PlatformLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const state = readPlatformState();
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  if (getPlatformAdminBySessionFromState(state, sessionId)) redirect("/platform");
  const quickSites = state.sites.slice(0, 3);
  const errorCode = (await searchParams)?.error;

  return (
    <AdminLoginScreen
      brand="DreamOps"
      description="平台后台负责跨站点运营。这里统一管理站点创建、域名、收款就绪状态、AI 网关、审计日志和跨站运营信号。"
      eyebrow="平台总控"
      formDescription="使用平台管理员账号进入跨站点店铺管理、收款检查、AI 网关和审计控制台。"
      form={
        <PasswordLoginForm
          authScope="platform"
          defaultEmail="platform@local.test"
          defaultPassword="platform123"
          demoLabel="platform@local.test / platform123"
          emailLabel="登录账号"
          endpoint="/api/platform/auth/login"
          fallbackAction="/platform/login/submit"
          initialMessage={authMessageForCode("platform", errorCode)}
          passwordLabel="登录密码"
          redirectTo="/platform"
          submitLabel="进入平台后台"
          variant="erp"
        />
      }
      links={[
        { label: "首页", href: "/" },
        ...quickSites.flatMap((site) => [
          { label: `${site.branding.logoText} 前台`, href: `/site/${site.slug}` },
          { label: `${site.branding.logoText} 后台`, href: `/platform/login` }
        ]).slice(0, 4)
      ]}
      stats={[
        { label: "站点总控", value: `${state.sites.length} 个店铺`, detail: "查看多站点健康、启用状态和后台入口。" },
        { label: "平台账号", value: "超级管理员", detail: "跨站点操作、审计、网关和收款就绪态都在这里查看。" },
        { label: "AI 路由", value: `${state.aiGatewayGroups.length} 个分组`, detail: "统一管控 provider、额度、失败率和调用策略。" },
        { label: "多租户边界", value: "平台隔离", detail: "平台总后台可观察全局，单站后台只处理本站业务。" }
      ]}
      title="平台后台登录"
    />
  );
}
