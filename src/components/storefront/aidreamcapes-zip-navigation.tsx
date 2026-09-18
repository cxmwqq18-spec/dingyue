import { ClickMegaMenu } from "@/components/storefront/click-mega-menu";
import type {
  AidreamcapesZipNavigation,
  AidreamcapesZipNavigationGroup,
} from "@/lib/types";

export type AidreamcapesNavItem = { label: string; href: string };
export type AidreamcapesNavGroup = AidreamcapesZipNavigationGroup;

type AidreamcapesZipNavigationProps = {
  mobileLabel?: string;
  navigation?: AidreamcapesZipNavigation;
  resolveHref: (href: string) => string;
};

const desktopLinkClass =
  "inline-flex h-full shrink-0 items-center gap-1 whitespace-nowrap py-0 text-sm font-medium text-gray-300 transition-colors hover:text-white";

const panelClass =
  "fixed left-1/2 z-[180] max-h-[calc(100dvh-6.5rem)] w-full max-w-[1400px] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0a0a0a] p-10 text-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl";

function ZipMenuPanel({
  groups,
  collection,
  resolveHref,
}: {
  groups: AidreamcapesNavGroup[];
  collection?: AidreamcapesNavItem;
  resolveHref: (href: string) => string;
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-4 md:gap-12">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#8b5cf6]">
            {group.label}
          </h2>
          <div className="grid gap-3.5 text-sm text-gray-400">
            {group.items.map((item, itemIndex) => (
              <a
                className="block transition-colors hover:text-white"
                href={resolveHref(item.href)}
                key={`${group.label}-${item.label}-${item.href}-${itemIndex}`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </section>
      ))}
      {collection ? (
        <a
          className="self-end text-sm font-medium text-[#8b5cf6] transition-colors hover:text-[#ec4899] md:col-span-4"
          href={resolveHref(collection.href)}
        >
          {collection.label}
        </a>
      ) : null}
    </div>
  );
}

function MobileGroup({
  group,
  resolveHref,
}: {
  group: AidreamcapesNavGroup;
  resolveHref: (href: string) => string;
}) {
  return (
    <details className="rounded-[16px] border border-white/10 bg-white/[0.035] open:bg-white/[0.055]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-white/82 [&::-webkit-details-marker]:hidden">
        {group.label}
      </summary>
      <div className="grid gap-1 px-2 pb-2">
        {group.items.map((item, itemIndex) => (
          <a
            className="rounded-[12px] px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            href={resolveHref(item.href)}
            key={`${group.label}-${item.label}-${item.href}-${itemIndex}`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </details>
  );
}

export function AidreamcapesZipDesktopNavigation({
  navigation,
  resolveHref,
}: AidreamcapesZipNavigationProps) {
  if (!navigation) return null;
  return (
    <nav
      aria-label="Primary navigation"
      className="order-2 hidden min-w-0 flex-1 items-center justify-center gap-8 text-sm font-medium text-gray-300 lg:flex"
    >
      <ClickMegaMenu
        buttonClassName={desktopLinkClass}
        label={navigation.video.label}
        panelClassName={panelClass}
      >
        <ZipMenuPanel
          groups={navigation.video.groups}
          collection={navigation.video.collection}
          resolveHref={resolveHref}
        />
      </ClickMegaMenu>
      <ClickMegaMenu
        buttonClassName={desktopLinkClass}
        label={navigation.image.label}
        panelClassName={panelClass}
      >
        <ZipMenuPanel
          groups={navigation.image.groups}
          collection={navigation.image.collection}
          resolveHref={resolveHref}
        />
      </ClickMegaMenu>
      <ClickMegaMenu
        buttonClassName={desktopLinkClass}
        label={navigation.marketing.label}
        panelClassName={panelClass}
      >
        <ZipMenuPanel
          groups={navigation.marketing.groups}
          collection={navigation.marketing.collection}
          resolveHref={resolveHref}
        />
      </ClickMegaMenu>
      <a className={desktopLinkClass} href={resolveHref(navigation.actions.pricing.href)}>
        {navigation.actions.pricing.label}
      </a>
      <a className={desktopLinkClass} href={resolveHref(navigation.actions.login.href)}>
        {navigation.actions.login.label}
      </a>
    </nav>
  );
}

export function AidreamcapesZipMobileNavigation({
  mobileLabel,
  navigation,
  resolveHref,
}: AidreamcapesZipNavigationProps) {
  if (!navigation) return null;
  const groups = [
    ...navigation.video.groups,
    ...navigation.image.groups,
    ...navigation.marketing.groups,
  ];
  return (
    <details className="group relative z-[70] order-2 shrink-0 lg:hidden" data-storefront-mobile-menu>
      <summary
        aria-label="Open navigation"
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border border-white/14 text-white transition hover:bg-white/[0.08] [&::-webkit-details-marker]:hidden"
        title={mobileLabel}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ≡
        </span>
      </summary>
      <nav className="absolute right-0 top-[calc(100%+12px)] z-[86] hidden max-h-[calc(100dvh-7rem)] w-[min(22rem,calc(100vw-2rem))] gap-2 overflow-y-auto rounded-[24px] border border-white/14 bg-[#101114]/[0.99] p-3 text-white shadow-[0_34px_88px_-52px_rgba(0,0,0,0.85)] backdrop-blur group-open:grid">
        {groups.map((group, groupIndex) => (
          <MobileGroup
            group={group}
            key={`${group.label}-${groupIndex}`}
            resolveHref={resolveHref}
          />
        ))}
        <a
          className="rounded-[16px] px-4 py-3 text-sm font-semibold text-white/76 transition hover:bg-white/[0.08] hover:text-white"
          href={resolveHref(navigation.actions.pricing.href)}
        >
          {navigation.actions.pricing.label}
        </a>
        <a
          className="rounded-[16px] px-4 py-3 text-sm font-semibold text-white/76 transition hover:bg-white/[0.08] hover:text-white"
          href={resolveHref(navigation.actions.login.href)}
        >
          {navigation.actions.login.label}
        </a>
        <a
          className="rounded-[16px] bg-white px-4 py-3 text-center text-sm font-semibold text-[#101114] transition hover:bg-white/90"
          href={resolveHref(navigation.actions.getStarted.href)}
        >
          {navigation.actions.getStarted.label}
        </a>
      </nav>
    </details>
  );
}

export function aidreamcapesZipFooterItems(
  groups: AidreamcapesNavGroup[],
  resolveHref: (href: string) => string,
) {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      href: resolveHref(item.href),
      group: group.label.toLowerCase(),
    })),
  );
}
