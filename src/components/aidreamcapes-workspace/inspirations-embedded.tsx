"use client";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";

// Inspiration gallery rendered inside the workspace content area. It reuses the
// same card data and interactions as the public standalone inspiration page
// but follows the workspace's light theme and never leaves the workspace shell.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clapperboard, Image as ImageIcon, Loader2, Search, Sparkles, X } from "lucide-react";
import styles from "./inspirations-embedded.module.css";

import type { InspirationExample, InspirationPage } from "@/lib/aidreamcapes-inspirations-types";

export type EmbeddedInspiration = InspirationExample;

type Kind = "all" | "video" | "photo";
const ALL_CATEGORY = "All";
const mediaFilters = [
  { value: "all", label: "All examples", icon: Sparkles },
  { value: "video", label: "Video ideas", icon: Clapperboard },
  { value: "photo", label: "Photo ideas", icon: ImageIcon },
] as const;

function CardModal({ card, position, total, onClose, onPrevious, onNext }: {
  card: EmbeddedInspiration;
  position: number;
  total: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={styles.dialog}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)"));
        const first = controls[0];
        const last = controls.at(-1);
        if (event.key === "Tab") {
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        if (event.key === "ArrowLeft" && position > 0) { event.preventDefault(); onPrevious(); }
        if (event.key === "ArrowRight" && position < total - 1) { event.preventDefault(); onNext(); }
      }}
    >
      <div className={styles.detail}>
        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={card.imageAlt} src={card.imageSrc} />
        </div>
        <div className={styles.detailBody}>
          <button aria-label="Close example" className={styles.close} onClick={onClose} ref={closeRef} type="button"><X size={18} /></button>
          <span className={styles.eyebrow}>{card.kind === "video" ? "Video idea" : "Photo idea"}</span>
          <h2 id={titleId}>{card.label}</h2>
          <p>{card.description}</p>
          <dl className={styles.detailMeta}>
            <div><dt>Collection</dt><dd>{card.pageTitle}</dd></div>
            {card.category !== ALL_CATEGORY ? <div><dt>Category</dt><dd>{card.category}</dd></div> : null}
          </dl>
          <WorkspaceEntryLink className={styles.create} href={card.workspaceHref} entry={card.entry}>
            {card.kind === "video" ? "Create a video like this" : "Create an image like this"} <ArrowUpRight size={17} />
          </WorkspaceEntryLink>
          <div className={styles.detailNavigation}>
            <span aria-live="polite">{position + 1} / {total}</span>
            <div>
              <button aria-label="Previous example" disabled={position === 0} onClick={onPrevious} type="button"><ChevronLeft size={17} /></button>
              <button aria-label="Next example" disabled={position === total - 1} onClick={onNext} type="button"><ChevronRight size={17} /></button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function EmbeddedInspirations({ initialPage, endpoint, basePath }: { initialPage?: InspirationPage; endpoint: string; basePath: string }) {
  const [kind, setKind] = useState<Kind>("all");
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [page, setPage] = useState<InspirationPage | undefined>(initialPage);
  const [loading, setLoading] = useState(!initialPage);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const filterKey = `${kind}\n${category}\n${search}`;
  const loadedFilter = useRef(initialPage ? filterKey : "");
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const load = useCallback(async (offset: number, replace: boolean) => {
    if (pending.current && !replace) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const requestGeneration = ++generation.current;
    pending.current = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ offset: String(offset), kind, category, q: search, basePath });
    try {
      const response = await fetch(`${endpoint}?${params}`, { signal: abort.signal, credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Couldn't load inspirations. Please try again.");
      const next = await response.json() as InspirationPage;
      if (generation.current !== requestGeneration) return;
      loadedFilter.current = `${kind}\n${category}\n${search}`;
      setPage(previous => ({ ...next, cards: replace ? next.cards : [...(previous?.cards ?? []), ...next.cards.filter(card => !previous?.cards.some(existing => existing.id === card.id))] }));
    } catch (cause) {
      if (!abort.signal.aborted && generation.current === requestGeneration) setError(cause instanceof Error ? cause.message : "Couldn't load inspirations.");
    } finally {
      if (generation.current === requestGeneration) { pending.current = false; setLoading(false); }
    }
  }, [endpoint, kind, category, search, basePath]);
  useEffect(() => {
    if (initialPage && kind === "all" && category === ALL_CATEGORY && !search && !retry) {
      controller.current?.abort(); generation.current++; pending.current = false;
      loadedFilter.current = filterKey;
      setPage(initialPage); setLoading(false); setError("");
      return;
    }
    setActiveCardId(null);
    void load(0, true);
    return () => { controller.current?.abort(); generation.current++; pending.current = false; };
  }, [filterKey, load, retry, initialPage, kind, category, search]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || loading || error || page?.nextOffset == null) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void load(page.nextOffset!, false);
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [load, loading, error, page]);
  const cards = page?.cards ?? [];
  const visibleCards = cards;
  const counts = page?.counts ?? { all: 0, video: 0, photo: 0 };
  const categories = page?.categories ?? [ALL_CATEGORY];
  const activeIndex = activeCardId ? visibleCards.findIndex((card) => card.id === activeCardId) : -1;
  const activeCard = visibleCards[activeIndex];

  if (loading && !page) {
    return <div className={styles.loading}><Loader2 className={styles.spin} size={22} /><span>Loading inspirations…</span></div>;
  }

  return (
    <>
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Explore. Imagine. Create.</p>
          <h1 className={styles.title}>Inspirations</h1>
          <p className={styles.intro}>Discover a look for your next product video or photo.</p>
        </div>
        <div className={styles.total}><strong>{counts.all}</strong><span>ideas to explore</span></div>
      </div>

      <div className={styles.toolbar}>
        <h2>{mediaFilters.find((item) => item.value === kind)?.label}<span>{page?.total ?? 0}</span></h2>
        <div className={styles.kindFilters} role="group" aria-label="Example type">
          {mediaFilters.map(({ value, label, icon: Icon }) => (
            <button aria-pressed={kind === value} className={styles.kind} key={value} onClick={() => { setKind(value); setCategory(ALL_CATEGORY); setActiveCardId(null); }} type="button">
              <Icon aria-hidden="true" size={15} /><span>{label}</span><b>{counts[value]}</b>
            </button>
          ))}
        </div>
        <label className={styles.search}><Search aria-hidden="true" size={16} /><span className="sr-only">Search inspirations</span>
          <input maxLength={180} onChange={(event) => { setQuery(event.target.value); setActiveCardId(null); }} placeholder="Search examples" type="search" value={query} />
          {query ? <button aria-label="Clear search" className={styles.searchClear} onClick={() => setQuery("")} type="button"><X size={15} /></button> : null}
        </label>
      </div>

      <div className={styles.filterRow}>
        <div aria-label="Category filters" className={styles.categories} role="group">
          {categories.map((value) => <button aria-pressed={category === value} className={styles.category} key={value} onClick={() => { setCategory(value); setActiveCardId(null); }} type="button">{value === ALL_CATEGORY ? "All categories" : value}</button>)}
        </div>
        <p aria-live="polite" className={styles.resultCount}>{page?.total ?? 0} {page?.total === 1 ? "example" : "examples"}</p>
      </div>

      {visibleCards.length ? (
        <div className={styles.grid} aria-busy={loading}>
          {visibleCards.map((card) => (
            <button aria-label={`Open ${card.label} example`} className={styles.card} data-inspiration-card={card.id} key={card.id} onClick={() => setActiveCardId(card.id)} type="button">
              <span className={styles.cardImage}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={card.imageAlt} decoding="async" loading="lazy" src={card.imageSrc} />
                <span className={styles.cardKind}>{card.kind === "video" ? <><Clapperboard size={11} /> Video idea</> : <><ImageIcon size={11} /> Photo idea</>}</span>
                <span aria-hidden="true" className={styles.cardOpen}><ArrowUpRight size={16} /></span>
              </span>
              <span className={styles.cardInfo}><span>{card.label}</span><small>{card.category === ALL_CATEGORY ? card.pageTitle : card.category}</small></span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          {counts.all ? <Search aria-hidden="true" size={28} /> : <ImageIcon aria-hidden="true" size={28} />}
          <h2>{counts.all ? "No matching examples" : "Examples are unavailable"}</h2>
          <p>{counts.all ? "Try another search or explore a different category." : "Please check back soon for video and photo ideas."}</p>
          {counts.all ? <button onClick={() => { setKind("all"); setCategory(ALL_CATEGORY); setQuery(""); }} type="button">Clear filters</button> : null}
        </div>
      )}

      <div ref={sentinel} className={styles.pagination} aria-live="polite">
        {loading ? <span>Loading more examples…</span> : null}
        {error ? <><p role="alert">{error}</p><button type="button" onClick={() => page && loadedFilter.current === filterKey ? void load(page.nextOffset ?? 0, false) : setRetry(value => value + 1)}>Try again</button></> : null}
        {!loading && !error && page?.nextOffset != null ? <button type="button" onClick={() => void load(page.nextOffset!, false)}>Load more examples</button> : null}
      </div>

      {activeCard ? <CardModal card={activeCard} position={activeIndex} total={visibleCards.length} onClose={() => setActiveCardId(null)} onPrevious={() => setActiveCardId(visibleCards[activeIndex - 1]?.id ?? activeCard.id)} onNext={() => setActiveCardId(visibleCards[activeIndex + 1]?.id ?? activeCard.id)} /> : null}
    </>
  );
}
