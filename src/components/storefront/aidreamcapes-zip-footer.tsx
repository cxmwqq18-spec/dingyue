import type { AidreamcapesZipNavigationGroup, SectionInstance } from "@/lib/types";

const textSetting = (section: SectionInstance | undefined, key: string) => {
  const value = section?.settings[key];
  return typeof value === "string" ? value : "";
};

export function AidreamcapesZipFooter({
  footer,
  groups,
  resolveHref,
}: {
  footer?: SectionInstance;
  groups: AidreamcapesZipNavigationGroup[];
  resolveHref: (href: string) => string;
}) {
  const title = textSetting(footer, "title");
  const homeHref = textSetting(footer, "homeHref");
  const tagline = textSetting(footer, "tagline");
  const copyright = textSetting(footer, "copyright");
  const xLabel = textSetting(footer, "xLabel");
  const linkedInLabel = textSetting(footer, "linkedInLabel");
  return (
    <footer className="aidreamcapes-zip-footer mt-12 border-t border-white/5 bg-[#050505] px-6 py-12 text-white">
      <div className="mx-auto mb-12 grid max-w-[1400px] grid-cols-2 gap-8 md:grid-cols-5">
        <div className="col-span-2">
          <a
            className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight"
            href={resolveHref(homeHref)}
          >
            <span>{title}</span>
          </a>
          <p className="max-w-xs text-sm text-gray-500">{tagline}</p>
        </div>
        {groups.map((group) => (
          <div key={group.label}>
            <h4 className="mb-4 text-sm font-semibold text-white">{group.label}</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              {group.items.map((item, itemIndex) => (
                <li key={`${group.label}-${item.label}-${item.href}-${itemIndex}`}>
                  <a className="transition-colors hover:text-white" href={resolveHref(item.href)}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-center text-sm text-gray-600 md:flex-row">
        <p>{copyright}</p>
        <div aria-label="Social links" className="flex gap-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10">
            {xLabel}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10">
            {linkedInLabel}
          </span>
        </div>
      </div>
    </footer>
  );
}
