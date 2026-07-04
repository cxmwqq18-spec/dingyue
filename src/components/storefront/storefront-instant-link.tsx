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

const hoverPrefetchPathPrefixes = [
  "/collections",
  "/help",
  "/pricing",
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

function storefrontPublicPathname(targetUrl: URL) {
  return targetUrl.pathname.replace(/^\/site\/[^/]+/, "") || "/";
}

function canHoverPrefetch(targetUrl: URL) {
  if (process.env.NEXT_PUBLIC_STOREFRONT_HOVER_PREFETCH_ALL === "1") return true;
  const publicPathname = storefrontPublicPathname(targetUrl);
  if (publicPathname === "/account" || publicPathname.startsWith("/account/")) return false;
  if (publicPathname === "/app" || publicPathname.startsWith("/app/")) return false;
  if (publicPathname === "/album" || publicPathname.startsWith("/album/")) return false;
  if (publicPathname === "/checkout" || publicPathname.startsWith("/checkout/")) return false;
  if (publicPathname === "/cart" || publicPathname.startsWith("/cart/")) return false;
  return hoverPrefetchPathPrefixes.some((prefix) => publicPathname === prefix || publicPathname.startsWith(`${prefix}/`));
}

function canFocusPrefetch(targetUrl: URL) {
  const publicPathname = storefrontPublicPathname(targetUrl);
  return publicPathname === "/help" || publicPathname.startsWith("/help/") || publicPathname === "/pricing";
}

function isInstantFilterAnchor(event: MouseEvent<HTMLAnchorElement> | FocusEvent<HTMLAnchorElement> | PointerEvent<HTMLAnchorElement>) {
  return event.currentTarget.dataset.storefrontInstantFilter === "true";
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
    if (!canHoverPrefetch(targetUrl)) return;
    if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;
    const nextHref = hrefFromUrl(targetUrl);
    if (prefetchedHrefs.has(nextHref)) return;
    prefetchedHrefs.add(nextHref);
    router.prefetch(nextHref);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (isInstantFilterAnchor(event)) return;
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
    if (isInstantFilterAnchor(event)) return;
    const targetUrl = internalStorefrontHref(href, target);
    if (!event.defaultPrevented && targetUrl && canFocusPrefetch(targetUrl)) prefetchTarget();
  }

  function handlePointerEnter(event: PointerEvent<HTMLAnchorElement>) {
    onPointerEnter?.(event);
    if (isInstantFilterAnchor(event)) return;
    if (event.defaultPrevented || event.pointerType === "touch") return;
    if (hoverPrefetchTimer.current) clearTimeout(hoverPrefetchTimer.current);
    hoverPrefetchTimer.current = setTimeout(prefetchTarget, 180);
  }

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    onPointerDown?.(event);
    if (isInstantFilterAnchor(event)) return;
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
