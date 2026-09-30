import { AtSign, Facebook, Instagram, Pin, Youtube, type LucideIcon } from "lucide-react";
import type { AidreamcapesZipNavigationGroup, SectionInstance } from "@/lib/types";

const textSetting = (section: SectionInstance | undefined, key: string) => {
  const value = section?.settings[key];
  return typeof value === "string" ? value : "";
};

export type AidreamcapesZipCompanyProfile = {
  legalName?: string;
  website?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
};

export type AidreamcapesZipSocialKey =
  | "instagram"
  | "facebook"
  | "threads"
  | "pinterest"
  | "youtube"
  | "x"
  | "tiktok";

export type AidreamcapesZipSocialLink = {
  key: AidreamcapesZipSocialKey;
  label: string;
  href?: string;
};

export type AidreamcapesZipPaymentMethod = {
  key: string;
  label: string;
};

const defaultSocialLinks: AidreamcapesZipSocialLink[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "threads", label: "Threads" },
  { key: "pinterest", label: "Pinterest" },
  { key: "youtube", label: "YouTube" },
  { key: "x", label: "X" },
  { key: "tiktok", label: "TikTok" },
];

const socialIconByKey: Partial<Record<AidreamcapesZipSocialKey, LucideIcon>> = {
  instagram: Instagram,
  facebook: Facebook,
  threads: AtSign,
  pinterest: Pin,
  youtube: Youtube,
};

function SocialGlyph({ platform }: { platform: AidreamcapesZipSocialKey }) {
  if (platform === "x") {
    return (
      <svg aria-hidden="true" className="h-4 w-4 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25h6.826l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
      </svg>
    );
  }

  if (platform === "tiktok") {
    return (
      <svg aria-hidden="true" className="h-4 w-4 fill-current" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94a7.84 7.84 0 0 1-6.2 3.38 7.68 7.68 0 0 1-4.3-1.09 7.84 7.84 0 0 1-3.78-5.92c-.01-.3-.02-.6-.01-.9a7.84 7.84 0 0 1 8.62-7.78c.02 1.48-.04 2.96-.04 4.44a3.47 3.47 0 0 0-4.43 2.15 4.01 4.01 0 0 0-.14 1.62c.35 2.4 3.26 3.54 5.25 2.08.65-.48 1.08-1.22 1.1-2.03.02-3.95.01-7.9.02-11.86h4.34Z" />
      </svg>
    );
  }

  const Icon = socialIconByKey[platform];
  return Icon ? <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /> : null;
}

function footerNavigationColumns(groups: AidreamcapesZipNavigationGroup[]) {
  const visibleGroups = groups.map((group) => group.label === "Resources"
    ? {
        ...group,
        items: group.items.filter((item) => item.label !== "Prompt Guide" && item.href !== "/prompt-guide"),
      }
    : group);
  const resourcesIndex = visibleGroups.findIndex((group) => group.label === "Resources");
  const companyIndex = visibleGroups.findIndex((group) => group.label === "Company");

  if (resourcesIndex < 0 || companyIndex < 0) return visibleGroups.map((group) => [group]);

  const firstMergedIndex = Math.min(resourcesIndex, companyIndex);
  const secondMergedIndex = Math.max(resourcesIndex, companyIndex);
  const mergedGroups = firstMergedIndex === resourcesIndex
    ? [visibleGroups[resourcesIndex], visibleGroups[companyIndex]]
    : [visibleGroups[companyIndex], visibleGroups[resourcesIndex]];
  return visibleGroups.flatMap((group, index) => {
    if (index === firstMergedIndex) return [mergedGroups];
    if (index === secondMergedIndex) return [];
    return [[group]];
  });
}

function FooterNavigationGroup({ group, heading }: { group: AidreamcapesZipNavigationGroup; heading?: string }) {
  return (
    <section>
      <h2 className="text-[13px] font-semibold text-white">{heading ?? group.label}</h2>
      <ul className="mt-3 grid gap-2 text-[13px] leading-5 text-white/55">
        {group.items.map((item, itemIndex) => (
          <li key={`${group.label}-${item.label}-${item.href}-${itemIndex}`}>
            <a className="transition-colors hover:text-white" href={item.href}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AidreamcapesZipFooter({
  footer,
  groups,
  resolveHref,
  brandTitle,
  brandLogoUrl,
  company,
  socialLinks = [],
  paymentMethods = [],
  showPaymentIcons = false,
}: {
  footer?: SectionInstance;
  groups: AidreamcapesZipNavigationGroup[];
  resolveHref: (href: string) => string;
  brandTitle?: string;
  brandLogoUrl?: string;
  company?: AidreamcapesZipCompanyProfile;
  socialLinks?: AidreamcapesZipSocialLink[];
  paymentMethods?: AidreamcapesZipPaymentMethod[];
  showPaymentIcons?: boolean;
}) {
  const title = textSetting(footer, "title") || brandTitle || "";
  const homeHref = textSetting(footer, "homeHref") || "/";
  const tagline = textSetting(footer, "tagline");
  const copyright = textSetting(footer, "copyright");
  const socialHeading = textSetting(footer, "socialHeading");
  const socialBody = textSetting(footer, "socialBody");
  const bottomLine = textSetting(footer, "bottomLine") || "Credits, AI video and photo projects, private albums, and checkout stay inside your account.";
  const configuredSocialLinks = new Map(socialLinks.map((link) => [link.key, link]));
  const visibleSocialLinks = defaultSocialLinks.map((link) => ({
    ...link,
    ...configuredSocialLinks.get(link.key),
  })).filter((link) => Boolean(link.href));
  const hasVisibleCompanyDetails = Boolean(company?.legalName || company?.address || company?.email || company?.taxId);
  const navigationColumns = footerNavigationColumns(groups);
  const legalLinks = [
    { label: "Children's Privacy", href: "/children-privacy" },
    { label: "State Privacy", href: "/state-privacy" },
  ];

  return (
    <footer
      className="aidreamcapes-zip-footer mt-8 bg-[#050505] px-5 py-8 text-white sm:px-8 lg:py-10"
      data-shell="shared"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-8 lg:grid-cols-[1.28fr_0.72fr_0.95fr_0.72fr_0.9fr] lg:gap-7">
          <section className="min-w-0">
            <a
              className="inline-flex items-center gap-3 text-2xl font-bold tracking-[-0.04em] text-white transition-colors hover:text-white/80"
              href={resolveHref(homeHref)}
            >
              {brandLogoUrl ? <img alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain" height="36" src={brandLogoUrl} width="36" /> : null}
              {title}
            </a>
            {tagline ? <p className="mt-2 max-w-sm text-[13px] leading-5 text-white/55">{tagline}</p> : null}

            {hasVisibleCompanyDetails ? (
              <address className="mt-4 not-italic">
                <dl className="grid gap-1.5 text-[13px]">
                  {company?.legalName ? <div className="flex items-baseline gap-x-3"><dt className="w-16 shrink-0 text-xs text-white/40">Company</dt><dd className="font-medium text-white/85">{company.legalName}</dd></div> : null}
                  {company?.address ? <div className="flex items-start gap-x-3"><dt className="w-16 shrink-0 pt-0.5 text-xs text-white/40">Address</dt><dd className="min-w-0 max-w-xs flex-1 leading-5 text-white/70">{company.address}</dd></div> : null}
                  {company?.taxId ? <div className="flex items-baseline gap-x-3"><dt className="w-16 shrink-0 text-xs text-white/40">Tax ID</dt><dd className="text-white/70">{company.taxId}</dd></div> : null}
                  {company?.email ? <div className="flex items-baseline gap-x-3"><dt className="w-16 shrink-0 text-xs text-white/40">Email</dt><dd className="min-w-0"><a className="break-all text-white/70 transition-colors hover:text-white" href={`mailto:${company.email}`}>{company.email}</a></dd></div> : null}
                </dl>
              </address>
            ) : null}
          </section>

          {navigationColumns.map((column, columnIndex) => (
            column.length === 1 ? (
              <FooterNavigationGroup key={`${column[0].label}-${columnIndex}`} group={{
                ...column[0],
                items: column[0].items.map((item) => ({ ...item, href: resolveHref(item.href) })),
              }} />
            ) : (
              <FooterNavigationGroup
                group={{
                  label: "Resources & Company",
                  items: column.flatMap((group) => group.items).map((item) => ({ ...item, href: resolveHref(item.href) })),
                }}
                heading="Resources & Company"
                key={`merged-navigation-${columnIndex}`}
              />
            )
          ))}

          <section className="flex flex-col">
            <div className="max-w-[250px]">
              {socialHeading ? <h2 className="text-sm font-semibold text-white">{socialHeading}</h2> : null}
              {socialBody ? <p className="mt-2 text-[13px] leading-5 text-white/55">{socialBody}</p> : null}
            </div>
            <div aria-label="Social links" className="mt-4 flex flex-wrap items-center gap-2">
              {visibleSocialLinks.map((link) => {
                const content = <SocialGlyph platform={link.key} />;
                return <a aria-label={`${link.label} for Aidreamcapes`} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/70 transition hover:border-white/25 hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80" data-social-platform={link.key} href={link.href} key={link.key} rel="nofollow noopener noreferrer" target="_blank" title={link.label}>{content}</a>;
              })}
            </div>
          </section>

        </div>

        <div className="mt-5 text-[13px] text-white/45">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                {copyright ? <p className="shrink-0">{copyright}</p> : null}
                {legalLinks.map((link) => (
                  <a className="transition-colors hover:text-white" href={resolveHref(link.href)} key={link.href}>{link.label}</a>
                ))}
                {company?.email ? <a className="transition-colors hover:text-white" href={`mailto:${company.email}`}>Contact us</a> : null}
                {company?.email && company?.taxId ? <span aria-hidden="true" className="text-white/20">•</span> : null}
                {company?.taxId ? <span>Tax ID {company.taxId}</span> : null}
              </div>
              <p className="mt-1 max-w-[44rem] text-[11px] leading-4 text-white/35">{bottomLine}</p>
            </div>

          {showPaymentIcons && paymentMethods.length ? (
            <div aria-label="Accepted payment methods" className="flex flex-wrap items-center gap-1.5 lg:justify-end">
              {paymentMethods.map((method) => (
                <span
                  aria-label={method.label}
                  className="inline-flex h-7 min-w-12 items-center justify-center rounded-[4px] border border-white/10 bg-white px-2.5 text-[10px] font-bold tracking-[0.01em] text-[#111318] shadow-[0_8px_22px_-18px_rgba(255,255,255,0.7)]"
                  data-payment-method={method.key}
                  key={method.key}
                  title={method.label}
                >
                  {method.key === "visa" ? (
                    <span className="italic tracking-[-0.06em]">VISA</span>
                  ) : method.key === "mastercard" ? (
                    <span aria-hidden="true" className="relative inline-flex h-4 w-7 items-center justify-center">
                      <span className="absolute left-0 h-4 w-4 rounded-full bg-[#eb001b]" />
                      <span className="absolute right-0 h-4 w-4 rounded-full bg-[#f79e1b] mix-blend-multiply" />
                    </span>
                  ) : method.key === "amex" ? (
                    <span className="whitespace-nowrap text-[9px] font-extrabold tracking-[-0.02em] text-[#1476b8]">AMEX</span>
                  ) : method.key === "us-debit" ? (
                    <span className="whitespace-nowrap text-[9px]">US DEBIT</span>
                  ) : method.key === "paypal" ? (
                    <span className="whitespace-nowrap">PayPal</span>
                  ) : method.key === "apple-pay" ? (
                    <span className="whitespace-nowrap normal-case">Apple Pay</span>
                  ) : method.key === "google-pay" ? (
                    <span className="whitespace-nowrap normal-case">
                      <span className="text-[#4285f4]">G</span> Pay
                    </span>
                  ) : (
                    <span className="whitespace-nowrap">{method.label}</span>
                  )}
                </span>
              ))}
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
