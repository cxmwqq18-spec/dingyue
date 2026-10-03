import { contextualLinksFromValue } from "@/lib/contextual-links";

export function ContextualLinks({ links, currentPath, resolveHref = (href) => href }: {
  links: unknown;
  currentPath?: string;
  resolveHref?: (href: string) => string;
}) {
  const entries = contextualLinksFromValue(links, currentPath);
  if (!entries.length) return null;
  return (
    <aside aria-label="Related ideas and guides" data-contextual-links="" className="px-5 py-10">
      <div className="mx-auto max-w-[var(--site-content-width,1080px)] space-y-4 border-t border-current/15 pt-6 text-sm leading-7">
        {entries.map((entry) => (
          <p key={entry.href}>
            {entry.before ? `${entry.before} ` : null}
            <a className="font-semibold underline decoration-current/40 underline-offset-4 hover:decoration-current" href={resolveHref(entry.href)}>{entry.label}</a>
            {entry.after ? ` ${entry.after}` : null}
          </p>
        ))}
      </div>
    </aside>
  );
}
