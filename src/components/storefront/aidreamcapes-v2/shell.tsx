import type { ReactNode } from "react";
import type { AidreamcapesV2Navigation, ThemeNavLink } from "@/lib/types";
import { AidreamcapesV2MenuBehavior } from "./behavior";
import { AIDREAMCAPES_V2_CSS } from "./styles";
import type { V2Resolvers } from "./types";

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
        <a aria-label="Aidreamcapes home" className="logo" href={r.href("/")}>
          <i aria-hidden="true" />
          Aidreamcapes
        </a>
        <nav aria-label="Main" className="main" id="adc2-main-nav">
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
                      <div className="ph">Popular templates</div>
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
                  {menu.footerLink ? <a className="pfoot" href={r.href(menu.footerLink.href)}>{menu.footerLink.label}</a> : null}
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
          <a className="btn btn-primary" href={r.href(navigation.actions.getStarted.href)}>{navigation.actions.getStarted.label}</a>
          <button aria-controls="adc2-main-nav" aria-expanded="false" aria-label="Open menu" className="menu-toggle" id="adc2-menu-toggle" type="button">
            <svg fill="none" height="20" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 20 20" width="20">
              <path d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export function AidreamcapesV2Footer({ navigation, r }: { navigation: AidreamcapesV2Navigation; r: V2Resolvers }) {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="fgrid seo">
          <div>
            <a className="logo" href={r.href("/")}>
              <i aria-hidden="true" />
              Aidreamcapes
            </a>
            <p style={{ marginTop: 12, maxWidth: 280 }}>{navigation.footer.tagline}</p>
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
        <div className="fbottom">
          <span>{navigation.footer.copyright}</span>
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
export function AidreamcapesV2Shell({ navigation, r, children, mainId = "main-content", legacyPublicPage = false }: { navigation: AidreamcapesV2Navigation; r: V2Resolvers; children: ReactNode; mainId?: string; legacyPublicPage?: boolean }) {
  return (
    <div className="adc2">
      <style dangerouslySetInnerHTML={{ __html: AIDREAMCAPES_V2_CSS }} />
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
      <AidreamcapesV2Footer navigation={navigation} r={r} />
      <AidreamcapesV2MenuBehavior />
    </div>
  );
}
