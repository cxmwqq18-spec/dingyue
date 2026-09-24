import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { PublishedSaveTheDateGroup } from "@/lib/save-the-date-publication";

export function SaveTheDateDirectory({ groups, createHref = "/app/create", french = false, spanish = false }: { groups: PublishedSaveTheDateGroup[]; createHref?: string; french?: boolean; spanish?: boolean }) {
  const localizeFrenchDatePhrase = (value: string) => value.replace(/\bSave the Date\b/gi, "annonce de date");
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      label: french ? localizeFrenchDatePhrase(group.label) : group.label,
      items: group.items
        .map((item) => french ? { ...item, label: localizeFrenchDatePhrase(item.label), description: localizeFrenchDatePhrase(item.description) } : item)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
    }))
    .filter((group) => group.items.length)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
  const totalItems = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);
  const copy = french
    ? {
        eyebrow: "Galerie d’annonces de date",
        title: "Explorez tous les thèmes d’annonces de date",
        intro: "Comparez des directions romantiques pour annoncer une date, préparer une invitation, raconter une demande en mariage ou partager un souvenir de couple avant d’ouvrir une page dédiée.",
        category: "Catégorie",
        categorySingular: "catégorie",
        categoryPlural: "catégories",
        themeSingular: "thème",
        themePlural: "thèmes",
        openTheme: "Ouvrir le thème",
        empty: "Les thèmes d’annonces de date sont en cours de préparation.",
        create: "Créer votre histoire d’annonce de date"
      }
    : spanish
      ? {
          eyebrow: "Galería de Guardar la fecha",
          title: "Explora todos los temas para guardar la fecha",
          intro: "Explora ideas románticas para compromisos, propuestas, invitaciones y aniversarios antes de abrir una historia concreta.",
          category: "Categoría del tema",
          categorySingular: "categoría",
          categoryPlural: "categorías",
          themeSingular: "tema",
          themePlural: "temas",
          openTheme: "Abrir tema",
          empty: "Los temas para guardar la fecha se están preparando.",
          create: "Crea tu historia para guardar la fecha"
        }
      : {
          eyebrow: "Save the Date gallery",
          title: "Browse every Save the Date theme",
          intro: "Explore romantic announcement directions for Valentine moments, engagements, proposals, and confirmed wedding dates before opening a focused story page.",
          category: "Theme category",
          categorySingular: "category",
          categoryPlural: "categories",
          themeSingular: "theme",
          themePlural: "themes",
          openTheme: "Open theme",
          empty: "Save the Date themes are being prepared.",
          create: "Create your Save the Date story"
        };

  return (
    <section className="relative overflow-hidden bg-[#05070E] px-5 py-16 text-white md:py-20" data-save-the-date-directory>
      <div className="absolute inset-0 opacity-38 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.72)_1px,transparent_1px)] [background-size:86px_86px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,14,0.78)_0%,rgba(5,7,14,0.98)_100%),linear-gradient(90deg,rgba(22,220,240,0.18)_0%,rgba(236,75,221,0.16)_100%)]" />
      <div className="relative mx-auto max-w-[var(--site-content-width)]">
        <div className="border-b border-white/10 pb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8defff]">{copy.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.35rem,5vw,4.35rem)] font-semibold leading-[0.98] text-balance [font-family:var(--site-title-font)]">{copy.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/68">{copy.intro}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/48">
            <span>{visibleGroups.length} {visibleGroups.length === 1 ? copy.categorySingular : copy.categoryPlural}</span>
            <span aria-hidden="true">·</span>
            <span>{totalItems} {totalItems === 1 ? copy.themeSingular : copy.themePlural}</span>
          </div>
        </div>

        <div className="mt-12 grid gap-14">
          {visibleGroups.map((group) => (
            <section key={group.slug} data-save-the-date-category={group.slug}>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8defff]">{copy.category}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{group.label}</h2>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/42">{group.items.length} {group.items.length === 1 ? copy.themeSingular : copy.themePlural}</span>
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
                      <div className={french ? "relative overflow-hidden bg-[#111827]" : "relative aspect-[4/3] overflow-hidden bg-[#111827]"}>
                        <img alt={imageAlt} className={french ? "block h-auto w-full object-center transition duration-500 group-hover:scale-[1.015]" : "block h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"} decoding="async" loading={index === 0 ? "eager" : "lazy"} src={imageUrl} />
                        <span className="absolute left-3 top-3 rounded-full border border-white/16 bg-black/44 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/82 backdrop-blur">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="flex flex-1 flex-col border-t border-white/10 p-5">
                        <h3 className="text-xl font-semibold leading-tight text-white">{item.label}</h3>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/64">{item.description}</p>
                        <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-[#ddd7ff] transition group-hover:text-white">{copy.openTheme} <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" strokeWidth={1.9} /></span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {!visibleGroups.length ? (
          <p className="mt-12 rounded-[8px] border border-white/12 bg-white/[0.05] p-5 text-sm text-white/64">{copy.empty}</p>
        ) : null}

        <div className="mt-14 border-t border-white/10 pt-8">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#ff9b57] transition hover:text-[#ffa45d]" href={createHref} prefetch={false}>{copy.create} <ArrowRight className="h-4 w-4" strokeWidth={1.9} /></Link>
        </div>
      </div>
    </section>
  );
}
