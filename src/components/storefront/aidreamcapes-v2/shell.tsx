import { CreditCard } from "lucide-react";
import { isValidElement, type ReactNode } from "react";
import type { AidreamcapesV2Navigation, ThemeNavLink, SectionInstance } from "@/lib/types";
import { AidreamcapesV2MenuBehavior } from "./behavior";
import type { V2Company } from "./company";
import { BRAND_ICON, BRAND_NAME, CompanyDetails, withStartLinks } from "./parts";
import { AIDREAMCAPES_V2_CARD_CSS, AIDREAMCAPES_V2_CSS, AIDREAMCAPES_V2_VISUAL_CSS, AIDREAMCAPES_V2_VISUAL_CSS_POLISH } from "./styles";
import type { V2Resolvers } from "./types";
import { copyLabel } from "./types";
import { homePresentationValue, type HomeExperienceData } from "./home-experience-types";
import { AidreamcapesSocialLinks, type AidreamcapesSocialLink } from "./social-links";
import socialStyles from "./social-links.module.css";
import articleStyles from "./footer-articles.module.css";
import type { AidreamcapesFooterArticle } from "./latest-articles";

const Chevron = () => (
  <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 12 12">
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
);

function MenuLink({ link, r }: { link: ThemeNavLink; r: V2Resolvers }) {
  if (link.image || link.description) {
    return (
      <a className="mi" href={r.href(link.href)}>
        {link.image ? <img alt="" decoding="async" height={46} loading="lazy" src={r.asset(link.image)} width={46} /> : null}
        <div>
          <b>{link.label}</b>
          {link.description ? <span>{link.description}</span> : null}
        </div>
      </a>
    );
  }
  return <a href={r.href(link.href)}>{link.label}</a>;
}

export function AidreamcapesV2Header({ navigation, r }: { navigation: AidreamcapesV2Navigation; r: V2Resolvers }) {
  return (
    <header className="site">
      <div className="wrap hbar">
        <a aria-label={copyLabel(r, "AIVideosUGC home")} className="logo" href={r.href("/")}>
          <img alt="" className="logo-mark" height={28} src={r.asset(BRAND_ICON)} width={28} />
          {BRAND_NAME}
        </a>
        <nav aria-label={copyLabel(r, "Main")} className="main" id="adc2-main-nav">
          {navigation.menus.map((menu) => {
            const rich = menu.groups.length === 1 && menu.groups[0].items.some((item) => item.description);
            return (
              <div className="nav-item" key={menu.label}>
                <button aria-expanded="false" className="nav-btn" type="button">
                  {menu.label}
                  <Chevron />
                </button>
                <div className={rich && menu.popular?.length ? "panel two" : "panel"}>
                  {rich ? (
                    <div>
                      <div className="ph">{menu.groups[0].label}</div>
                      <div className="mlist">
                        {menu.groups[0].items.map((item) => <MenuLink key={item.href} link={item} r={r} />)}
                      </div>
                    </div>
                  ) : (
                    menu.groups.map((group) => (
                      <div className="pcol tlist" key={group.label}>
                        <div className="ph">{group.label}</div>
                        {group.items.map((item) => <MenuLink key={item.href} link={item} r={r} />)}
                      </div>
                    ))
                  )}
                  {rich && menu.popular?.length ? (
                    <div className="pop">
                      <div className="ph">{copyLabel(r, "Popular templates")}</div>
                      <div className="popc">
                        {menu.popular.map((item) => (
                          <a href={r.href(item.href)} key={item.href}>
                            {item.image ? <img alt="" decoding="async" loading="lazy" src={r.asset(item.image)} /> : null}
                            {item.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {menu.hubLink || menu.footerLink ? (
                    <div className="pfoot">
                      {[menu.hubLink, menu.footerLink].map((link) => (link ? <a href={r.href(link.href)} key={link.href}>{link.label}</a> : null))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {navigation.links.map((link) => (
            <a className="nav-btn" href={r.href(link.href)} key={link.href}>{link.label}</a>
          ))}
        </nav>
        <div className="hright">
          <a className="login" href={r.href(navigation.actions.login.href)}>{navigation.actions.login.label}</a>
          <a className="btn btn-primary" href={withStartLinks(r).href(navigation.actions.getStarted.href)}>{navigation.actions.getStarted.label}</a>
          <button aria-controls="adc2-main-nav" aria-expanded="false" aria-label={copyLabel(r, "Open menu")} className="menu-toggle" id="adc2-menu-toggle" type="button">
            <svg fill="none" height="20" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 20 20" width="20">
              <path d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export function AidreamcapesV2Footer({ navigation, r, company, articles = [], articlesTitle }: { navigation: AidreamcapesV2Navigation; r: V2Resolvers; company?: V2Company; articles?: AidreamcapesFooterArticle[]; articlesTitle?: string }) {
  const footer = navigation.footer as typeof navigation.footer & { socialLinks?: AidreamcapesSocialLink[] };
  const footerCompany = company ? homePresentationValue(company, r.copy ?? {}) : undefined;
  return (
    <footer className="site">
      <div className="wrap">
        <div className="fgrid seo">
          <div>
            <a className="logo" href={r.href("/")}>
              <img alt="" className="logo-mark" height={28} loading="lazy" src={r.asset(BRAND_ICON)} width={28} />
              {BRAND_NAME}
            </a>
            <p style={{ marginTop: 12, maxWidth: 280 }}>{navigation.footer.tagline}</p>
            {footerCompany ? <CompanyDetails className="company-foot" company={footerCompany} labels={r.copy} /> : null}
            {articles.length ? (
              <section aria-labelledby="aidreamcapes-latest-articles-title" className={articleStyles.articles}>
                <h4 id="aidreamcapes-latest-articles-title">{articlesTitle || copyLabel(r, "Latest articles")}</h4>
                <ol className={articleStyles.list}>
                  {articles.map((article) => (
                    <li className={articleStyles.item} key={article.href}>
                      <a className={articleStyles.link} href={r.href(article.href)} title={article.title}>{article.title}</a>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
          {navigation.footer.groups.map((group) => (
            <div key={group.label}>
              <h4>{group.label}</h4>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}><a href={r.href(item.href)}>{item.label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={`fbottom ${socialStyles.bottom}`}>
          <span>{navigation.footer.copyright}</span>
          <div className={socialStyles.footerTools}>
            <AidreamcapesSocialLinks compact links={footer.socialLinks} />
            <span aria-label="Card payments" className={socialStyles.paymentCard} role="img"><CreditCard aria-hidden="true" size={25} strokeWidth={1.6} /></span>
          </div>
          <span>
            {navigation.footer.legal.map((item, index) => (
              <span key={item.href}>
                {index > 0 ? " · " : null}
                <a href={r.href(item.href)}>{item.label}</a>
              </span>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Full page chrome for Aidreamcapes.com v2: scoped styles, header, main content, footer. */
// `legacyPublicPage` keeps the existing Aidreamcapes page styles (scoped to
// main[data-aidreamcapes-public-page]) for pages that still render their own sections,
// such as login, search, cart and the album page.
export function AidreamcapesV2Shell({ navigation, r, children, mainId = "main-content", legacyPublicPage = false, company, articles = [], articlesTitle }: { navigation: AidreamcapesV2Navigation; r: V2Resolvers; children: ReactNode; mainId?: string; legacyPublicPage?: boolean; company?: V2Company; articles?: AidreamcapesFooterArticle[]; articlesTitle?: string }) {
  // The shell's page element already carries the current LivePage section. Use
  // its presentation labels only for this homepage, leaving other routes alone.
  const pageSection = isValidElement<{ section?: SectionInstance }>(children) ? children.props.section : undefined;
  const settings = pageSection?.settings as { layout?: string; data?: { homeExperience?: HomeExperienceData } } | undefined;
  const homeExperience = settings?.layout === "home" ? settings.data?.homeExperience : undefined;
  const homeCopy = homeExperience?.labels;
  if (homeCopy) {
    r = { ...r, copy: homeCopy };
    navigation = homePresentationValue(navigation, homeCopy);
  }
  return (
    <div className={`adc2${homeExperience?.language === "zh-CN" ? " adc-home-locale" : ""}`} lang={homeExperience?.language}>
      <style dangerouslySetInnerHTML={{ __html: AIDREAMCAPES_V2_CSS + AIDREAMCAPES_V2_CARD_CSS + AIDREAMCAPES_V2_VISUAL_CSS + AIDREAMCAPES_V2_VISUAL_CSS_POLISH }} />
      <AidreamcapesV2Header navigation={navigation} r={r} />
      <main
        className={legacyPublicPage ? "bg-[#06070b] text-white" : undefined}
        data-aidreamcapes-public-page={legacyPublicPage ? "true" : undefined}
        data-aidreamcapes-v2="true"
        data-theme-sections-root={legacyPublicPage ? "" : undefined}
        id={mainId}
      >
        {children}
      </main>
      <AidreamcapesV2Footer articles={articles} articlesTitle={articlesTitle} company={company} navigation={navigation} r={r} />
      <AidreamcapesV2MenuBehavior />
    </div>
  );
}
