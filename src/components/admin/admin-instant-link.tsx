"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

type AdminInstantLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & {
  children: ReactNode;
  href: LinkProps["href"];
  navigationMode?: "soft" | "document";
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onIntent?: () => void;
  prefetch?: LinkProps["prefetch"];
  replace?: LinkProps["replace"];
  scroll?: LinkProps["scroll"];
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function adminHrefFromUrl(targetUrl: URL): string {
  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

function dispatchAdminNavigationStart(href: string) {
  window.dispatchEvent(new CustomEvent("admin:navigation-start", { detail: { href } }));
}

export function AdminInstantLink({
  children,
  href,
  navigationMode: _navigationMode,
  onClick,
  onFocus,
  onIntent,
  onMouseEnter,
  prefetch = true,
  replace,
  scroll,
  target,
  ...props
}: AdminInstantLinkProps) {
  const router = useRouter();

  function handleIntent() {
    onIntent?.();
    if (prefetch !== false && typeof href === "string" && !href.startsWith("#")) {
      router.prefetch(href);
    }
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || isModifiedClick(event) || (target && target !== "_self")) return;
    if (typeof href !== "string") return;
    if (href.startsWith("#")) return;

    const targetUrl = new URL(href, window.location.href);
    if (targetUrl.origin !== window.location.origin) return;
    if (!targetUrl.pathname.includes("/admin") && targetUrl.pathname !== "/platform") return;
    if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;

    dispatchAdminNavigationStart(adminHrefFromUrl(targetUrl));
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      onFocus={(event) => {
        onFocus?.(event);
        handleIntent();
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        handleIntent();
      }}
      prefetch={prefetch}
      replace={replace}
      scroll={scroll}
      target={target}
      {...props}
    >
      {children}
    </Link>
  );
}
