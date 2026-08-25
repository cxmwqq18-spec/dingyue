import type { ComponentProps, MouseEvent, ReactNode } from "react";

export type StorefrontInstantLinkProps = Omit<ComponentProps<"a">, "href" | "onClick" | "children"> & {
  children: ReactNode;
  href: string;
  /** Compatibility-only prop; native anchors never prefetch through JS. */
  prefetch?: boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function StorefrontLinkPrefetchProvider({ children, disabled }: { children: ReactNode; disabled: boolean }) {
  void disabled;
  return children;
}

export function StorefrontInstantLink({
  children,
  href,
  onClick,
  prefetch: _prefetch,
  target,
  ...props
}: StorefrontInstantLinkProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      target={target}
      {...props}
    >
      {children}
    </a>
  );
}
