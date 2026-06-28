"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { type ComponentProps, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";

export type StorefrontInstantLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick" | "children"> & {
  children: ReactNode;
  href: LinkProps["href"];
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLAnchorElement>) => void;
  onPointerEnter?: (event: PointerEvent<HTMLAnchorElement>) => void;
};

function hrefFromUrl(targetUrl: URL) {
  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

const prefetchedHrefs = new Set<string>();
const storefrontPublicPathPrefixes = [
  "/account",
  "/album",
  "/app",
  "/cart",
  "/checkout",
  "/collections",
  "/contact-us",
  "/content",
  "/cookies",
  "/help",
  "/login",
  "/privacy",
  "/policies",
  "/pricing",
  "/refunds",
  "/shipping",
  "/terms",
  "/tools"
];

function internalStorefrontHref(href: LinkProps["href"], target?: string) {
  if (typeof href !== "string" || href.startsWith("#") || (target && target !== "_self")) return null;
  const targetUrl = new URL(href, window.location.href);
  if (targetUrl.origin !== window.location.origin) return null;
  const isPathMode = targetUrl.pathname.startsWith("/site/");
  const isHostMode = storefrontPublicPathPrefixes.some((prefix) => targetUrl.pathname === prefix || targetUrl.pathname.startsWith(`${prefix}/`));
  if (!isPathMode && !isHostMode) return null;
  return targetUrl;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

export function StorefrontInstantLink({
  children,
  href,
  onClick,
  onFocus,
  onPointerDown,
  onPointerEnter,
  prefetch,
  target,
  ...props
}: StorefrontInstantLinkProps) {
  const router = useRouter();
  const hoverPrefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldUseLinkPrefetch = prefetch ?? process.env.NEXT_PUBLIC_STOREFRONT_LINK_PREFETCH === "1";

  function prefetchTarget() {
    if (process.env.NEXT_PUBLIC_STOREFRONT_HOVER_PREFETCH === "0") return;
    const targetUrl = internalStorefrontHref(href, target);
    if (!targetUrl) return;
    if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;
    const nextHref = hrefFromUrl(targetUrl);
    if (prefetchedHrefs.has(nextHref)) return;
    prefetchedHrefs.add(nextHref);
    router.prefetch(nextHref);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || isModifiedClick(event)) return;
    const targetUrl = internalStorefrontHref(href, target);
    if (!targetUrl) return;
    event.preventDefault();
    const nextHref = hrefFromUrl(targetUrl);
    window.dispatchEvent(new CustomEvent("storefront:navigation-start", { detail: { href: nextHref } }));
    router.push(nextHref);
  }

  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    onFocus?.(event);
    if (!event.defaultPrevented) prefetchTarget();
  }

  function handlePointerEnter(event: PointerEvent<HTMLAnchorElement>) {
    onPointerEnter?.(event);
    if (event.defaultPrevented || event.pointerType === "touch") return;
    if (hoverPrefetchTimer.current) clearTimeout(hoverPrefetchTimer.current);
    hoverPrefetchTimer.current = setTimeout(prefetchTarget, 80);
  }

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    onPointerDown?.(event);
    if (!event.defaultPrevented) prefetchTarget();
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      onFocus={handleFocus}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      prefetch={shouldUseLinkPrefetch}
      target={target}
      {...props}
    >
      {children}
    </Link>
  );
}
