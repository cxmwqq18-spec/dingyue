"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { canPrefetchAdminRoute } from "@/components/admin/admin-route-prefetch-policy";

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
  navigationMode = "soft",
  onClick,
  onFocus,
  onIntent,
  onMouseEnter,
  prefetch = false,
  replace,
  scroll,
  target,
  ...props
}: AdminInstantLinkProps) {
  const router = useRouter();
  const resolvedPrefetch =
    prefetch !== false && typeof href === "string" && !canPrefetchAdminRoute(href) ? false : prefetch;

  function handleIntent() {
    onIntent?.();
    if (resolvedPrefetch !== false && typeof href === "string" && canPrefetchAdminRoute(href)) {
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
    if (navigationMode === "document") {
      event.preventDefault();
      window.location.assign(targetUrl.href);
    }
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
      prefetch={resolvedPrefetch}
      replace={replace}
      scroll={scroll}
      target={target}
      {...props}
    >
      {children}
    </Link>
  );
}
