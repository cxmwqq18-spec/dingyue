import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { PublishedSaveTheDateGroup } from "@/lib/save-the-date-publication";

export function SaveTheDateDirectory({ groups, createHref = "/app/create", spanish = false }: { groups: PublishedSaveTheDateGroup[]; createHref?: string; spanish?: boolean }) {
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items
        .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
    }))
    .filter((group) => group.items.length)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
  const totalItems = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className="relative overflow-hidden bg-[#05070E] px-5 py-16 text-white md:py-20" data-save-the-date-directory>
      <div className="absolute inset-0 opacity-38 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.72)_1px,transparent_1px)] [background-size:86px_86px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,14,0.78)_0%,rgba(5,7,14,0.98)_100%),linear-gradient(90deg,rgba(22,220,240,0.18)_0%,rgba(236,75,221,0.16)_100%)]" />
      <div className="relative mx-auto max-w-[var(--site-content-width)]">
        <div className="border-b border-white/10 pb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8defff]">{spanish ? "Galería de Guardar la fecha" : "myDreamshoots Save the Date gallery"}</p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.35rem,5vw,4.35rem)] font-semibold leading-[0.98] text-balance [font-family:var(--site-title-font)]">{spanish ? "Explora todos los temas para guardar la fecha" : "Browse every Save the Date theme"}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/68">{spanish ? "Explora ideas románticas para compromisos, propuestas, invitaciones y aniversarios antes de abrir una historia concreta." : "Explore romantic announcement directions for Valentine moments, engagements, proposals, and confirmed wedding dates before opening a focused story page."}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/48">
            <span>{visibleGroups.length} {spanish ? (visibleGroups.length === 1 ? "categoría" : "categorías") : (visibleGroups.length === 1 ? "category" : "categories")}</span>
            <span aria-hidden="true">·</span>
            <span>{totalItems} {spanish ? (totalItems === 1 ? "tema" : "temas") : (totalItems === 1 ? "theme" : "themes")}</span>
          </div>
        </div>

        <div className="mt-12 grid gap-14">
          {visibleGroups.map((group) => (
            <section key={group.slug} data-save-the-date-category={group.slug}>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8defff]">{spanish ? "Categoría del tema" : "Theme category"}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{group.label}</h2>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/42">{group.items.length} {spanish ? (group.items.length === 1 ? "tema" : "temas") : (group.items.length === 1 ? "theme" : "themes")}</span>
              </div>
              <div className="mt-6 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item, index) => {
                  const imageUrl = item.imageUrl.trim();
                  const imageAlt = item.imageAlt.trim();
                  return (
                    <Link
                      className="group relative flex min-h-[360px] flex-col overflow-hidden rounded-[8px] border border-white/12 bg-[#090B12] shadow-[0_28px_84px_-66px_rgba(0,0,0,0.92)] transition duration-300 hover:-translate-y-1 hover:border-[#8defff]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8defff]/80"
                      data-save-the-date-card={item.slug}
                      href={item.href}
                      key={item.slug}
                      prefetch={false}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-[#111827]">
                        <img alt={imageAlt} className="block h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" decoding="async" loading={index === 0 ? "eager" : "lazy"} src={imageUrl} />
                        <span className="absolute left-3 top-3 rounded-full border border-white/16 bg-black/44 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/82 backdrop-blur">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="flex flex-1 flex-col border-t border-white/10 p-5">
                        <h3 className="text-xl font-semibold leading-tight text-white">{item.label}</h3>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/64">{item.description}</p>
                        <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-[#ddd7ff] transition group-hover:text-white">{spanish ? "Abrir tema" : "Open theme"} <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" strokeWidth={1.9} /></span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {!visibleGroups.length ? (
          <p className="mt-12 rounded-[8px] border border-white/12 bg-white/[0.05] p-5 text-sm text-white/64">{spanish ? "Los temas para guardar la fecha se están preparando." : "Save the Date themes are being prepared."}</p>
        ) : null}

        <div className="mt-14 border-t border-white/10 pt-8">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#ff9b57] transition hover:text-[#ffa45d]" href={createHref} prefetch={false}>{spanish ? "Crea tu historia para guardar la fecha" : "Create your Save the Date story"} <ArrowRight className="h-4 w-4" strokeWidth={1.9} /></Link>
        </div>
      </div>
    </section>
  );
}
