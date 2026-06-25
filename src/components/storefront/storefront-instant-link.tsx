"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentProps, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";

export type StorefrontInstantLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick" | "children"> & {
  children: ReactNode;
  href: LinkProps["href"];
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void;
  onPointerEnter?: (event: PointerEvent<HTMLAnchorElement>) => void;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function hrefFromUrl(targetUrl: URL) {
  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

function internalStorefrontHref(href: LinkProps["href"], target?: string) {
  if (typeof href !== "string" || href.startsWith("#") || (target && target !== "_self")) return null;
  const targetUrl = new URL(href, window.location.href);
  if (targetUrl.origin !== window.location.origin) return null;
  if (!targetUrl.pathname.startsWith("/site/")) return null;
  return targetUrl;
}

export function StorefrontInstantLink({
  children,
  href,
  onClick,
  onFocus,
  onPointerEnter,
  target,
  ...props
}: StorefrontInstantLinkProps) {
  const router = useRouter();

  function prefetchTarget() {
    const targetUrl = internalStorefrontHref(href, target);
    if (!targetUrl) return;
    if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;
    router.prefetch(hrefFromUrl(targetUrl));
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || isModifiedClick(event) || (target && target !== "_self")) return;

    const targetUrl = internalStorefrontHref(href, target);
    if (!targetUrl) return;
    if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;

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
    if (!event.defaultPrevented) prefetchTarget();
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      onFocus={handleFocus}
      onPointerEnter={handlePointerEnter}
      target={target}
      {...props}
    >
      {children}
    </Link>
  );
}
