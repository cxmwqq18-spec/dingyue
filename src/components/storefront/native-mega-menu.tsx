import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function NativeMegaMenu({
  blockAttrs,
  buttonClassName,
  children,
  label,
  panelClassName
}: {
  blockAttrs?: Record<string, string | number | boolean | undefined>;
  buttonClassName: string;
  children: ReactNode;
  disablePrefetch?: boolean;
  label: string;
  panelClassName: string;
  prefetchPaths?: string[];
}) {
  return (
    <details
      className="group relative"
      data-native-mega-menu="true"
      {...blockAttrs}
    >
      <summary className={`${buttonClassName} list-none [&::-webkit-details-marker]:hidden`}>
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" strokeWidth={2} />
      </summary>
      <div className={panelClassName}>{children}</div>
    </details>
  );
}
