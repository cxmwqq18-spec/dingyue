import "../../app/aidreamcapes-admin-surfaces.css";
import Link from "next/link";
import type { ReactNode } from "react";

export function AdminLoginScreen({
  brand,
  eyebrow,
  title,
  description,
  formDescription,
  links,
  stats,
  form,
  footer
}: {
  brand: string;
  eyebrow: string;
  title: string;
  description: string;
  formDescription?: string;
  links: Array<{ label: string; href: string }>;
  stats: Array<{ label: string; value: string; detail: string }>;
  form: ReactNode;
  footer?: ReactNode;
}) {
  const badge = brand.slice(0, 1).toUpperCase();
  const spotlightStats = stats.slice(0, 3);

  return (
    <main className="saas-login-page min-h-[100dvh] text-[#555]">
      <div className="saas-login-noise" aria-hidden="true" />
      <div className="saas-login-grid" aria-hidden="true" />
      <div className="saas-login-topbar hidden md:flex">
        <div>
          <span className="text-[15px] font-semibold text-white">{brand}</span>
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">{eyebrow}</span>
        </div>
        <div className="flex h-full items-center">
          {links.map((item) => (
            <Link className="saas-login-toplink" href={item.href} key={`${item.label}:${item.href}`}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="saas-login-shell">
        <section className="saas-login-aside">
          <div className="saas-login-badge-wrap">
            <div className="saas-login-badge">{badge}</div>
            <div className="saas-login-badge-text">
              <p>{eyebrow}</p>
              <span>{brand}</span>
            </div>
          </div>
          <div className="saas-login-copy">
            <p className="saas-login-eyebrow">Platform sign-in</p>
            <h1 className="saas-login-brand">{brand}</h1>
            <p className="saas-login-description">{description}</p>
          </div>
          <div className="saas-login-link-row hidden md:flex">
            {links.map((item) => (
              <Link className="saas-login-link-pill" href={item.href} key={`${item.label}:${item.href}`}>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="saas-login-stat-grid">
            {stats.map((item) => (
              <div className="saas-login-stat" key={item.label}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="loginmain">
          <div className="saas-login-panel-head">
            <div className="login-title">
              <p className="saas-login-panel-kicker">Admin access</p>
              <span>{title}</span>
              <p>{formDescription ?? "请输入账号和密码后进入当前工作区。"}</p>
            </div>
            <div className="saas-login-panel-badges">
              <span className="saas-login-panel-badge">租户隔离</span>
              <span className="saas-login-panel-badge">权限校验</span>
            </div>
          </div>
          <div className="saas-login-access-list">
            {spotlightStats.map((item) => (
              <div className="saas-login-access-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="login-con">
            {form}
            <div className="saas-login-mobile-links md:hidden">
              {links.map((item) => (
                <Link className="saas-login-link-pill" href={item.href} key={`${item.label}:${item.href}`}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="login-footnote">
        {footer ?? (
          <p className="mt-3 text-center text-[12px] text-white/45">
            登录后进入独立后台工作区，页面、商品、订单、顾客、订阅、AI 任务和发布记录都按当前站点隔离。
          </p>
        )}
      </div>
    </main>
  );
}
