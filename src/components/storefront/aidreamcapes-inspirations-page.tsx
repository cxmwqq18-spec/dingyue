"use client";
import { WorkspaceEntryBehavior } from "@/components/aidreamcapes-workspace/entry-behavior";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Clapperboard, Grid2X2, Image as ImageIcon, Search, Sparkles, X } from "lucide-react";
import type { InspirationExample } from "@/lib/aidreamcapes-inspirations-types";
import styles from "./aidreamcapes-inspirations-page.module.css";

// The server supplies current LivePage examples. Filters and the detail dialog
// operate on that HTML/data without fetching storefront or customer runtime.
type InspirationKind = "all" | "video" | "photo";

const ALL_CATEGORY = "All";
const mediaFilters = [
  { value: "all", label: "All examples", icon: Grid2X2 },
  { value: "video", label: "Video ideas", icon: Clapperboard },
  { value: "photo", label: "Photo ideas", icon: ImageIcon },
] as const;

function CardModal({ card, position, total, onClose, onPrevious, onNext }: {
  card: InspirationExample;
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
        if (event.key === "Tab") {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)"));
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        if (event.key === "ArrowLeft" && position > 0) { event.preventDefault(); onPrevious(); }
        if (event.key === "ArrowRight" && position < total - 1) { event.preventDefault(); onNext(); }
      }}
    >
      <div className={styles.detail}>
        <button aria-label="Close example" className={styles.close} onClick={onClose} ref={closeRef} type="button"><X size={20} /></button>
        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={card.imageAlt} src={card.imageSrc} />
        </div>
        <div className={styles.detailBody}>
          <span className={styles.eyebrow}>{card.kind === "video" ? "Video idea" : "Photo idea"}</span>
          <h2 id={titleId}>{card.label}</h2>
          <p>{card.description}</p>
          <dl className={styles.detailMeta}>
            <div><dt>Collection</dt><dd>{card.pageTitle}</dd></div>
            {card.category !== ALL_CATEGORY ? <div><dt>Category</dt><dd>{card.category}</dd></div> : null}
          </dl>
          <WorkspaceEntryLink className={styles.create} href={card.workspaceHref} entry={card.entry}>
            <span>{card.kind === "video" ? "Create a video like this" : "Create an image like this"}</span><ArrowUpRight size={18} />
          </WorkspaceEntryLink>
          <div className={styles.detailNavigation}>
            <span aria-live="polite">{position + 1} / {total}</span>
            <div>
              <button aria-label="Previous example" disabled={position === 0} onClick={onPrevious} type="button"><ChevronLeft size={18} /></button>
              <button aria-label="Next example" disabled={position === total - 1} onClick={onNext} type="button"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function AidreamcapesInspirationsPage({ cards, basePath = "", initialKind = "all", initialCategory = ALL_CATEGORY, initialQuery = "" }: {
  cards: InspirationExample[];
  basePath?: string;
  initialKind?: InspirationKind;
  initialCategory?: string;
  initialQuery?: string;
}) {
  const [kind, setKind] = useState<InspirationKind>(initialKind);
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const counts = useMemo(() => ({
    all: cards.length,
    video: cards.filter((card) => card.kind === "video").length,
    photo: cards.filter((card) => card.kind === "photo").length,
  }), [cards]);
  const selectedCards = useMemo(() => kind === "all" ? cards : cards.filter((card) => card.kind === kind), [cards, kind]);
  const categories = useMemo(() => [ALL_CATEGORY, ...Array.from(new Set(selectedCards.map((card) => card.category)))
    .filter((value) => value !== ALL_CATEGORY).sort((a, b) => a.localeCompare(b))], [selectedCards]);
  const visibleCards = useMemo(() => {
    const search = query.trim().toLowerCase();
    return selectedCards.filter((card) => (category === ALL_CATEGORY || card.category === category)
      && (!search || `${card.label} ${card.imageAlt} ${card.pageTitle} ${card.category}`.toLowerCase().includes(search)));
  }, [selectedCards, category, query]);
  const activeIndex = activeCardId ? visibleCards.findIndex((card) => card.id === activeCardId) : -1;
  const activeCard = visibleCards[activeIndex];

  function updateFilters(nextKind: InspirationKind, nextCategory: string, nextQuery: string) {
    setKind(nextKind);
    setCategory(nextCategory);
    setQuery(nextQuery);
    setActiveCardId(null);
    const url = new URL(window.location.href);
    for (const [key, value] of [["kind", nextKind === "all" ? "" : nextKind], ["category", nextCategory === ALL_CATEGORY ? "" : nextCategory], ["q", nextQuery]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <div className={styles.page} data-aidreamcapes-inspirations="true"><WorkspaceEntryBehavior />
      <header className={styles.header}>
        <a aria-label="AIVideosUGC home" className={styles.brand} href={basePath || "/"}>
          <span aria-hidden="true" className={styles.brandMark}><Sparkles size={18} /></span>AIVideosUGC
        </a>
        <span className={styles.headerLabel}>Inspiration library</span>
        <a className={styles.back} href={`${basePath}/app/create`}><ArrowLeft size={15} /><span>Back to workspace</span></a>
      </header>

      <div className={styles.layout}>
        <aside aria-label="Browse examples" className={styles.sidebar}>
          <p className={styles.eyebrow}>Browse</p>
          <div aria-label="Example type" className={styles.mediaFilters} role="group">
            {mediaFilters.map(({ value, label, icon: Icon }) => <button aria-pressed={kind === value} className={kind === value ? styles.selected : undefined} key={value} onClick={() => updateFilters(value, ALL_CATEGORY, query)} type="button">
              <Icon aria-hidden="true" size={17} /><span>{label}</span><b>{counts[value]}</b>
            </button>)}
          </div>
          <div className={styles.sidebarNote}><Sparkles aria-hidden="true" size={20} /><p>A little inspiration.<br />Your own creation.</p><span>Choose an example, then make it yours with your product and idea.</span></div>
        </aside>

        <main className={styles.main}>
          <div className={styles.heading}>
            <div><p className={styles.eyebrow}>Explore. Imagine. Create.</p><h1>Inspirations<span>.</span></h1><p className={styles.intro}>Discover a look for your next product video or photo.</p></div>
            <div className={styles.total}><strong>{cards.length}</strong><span>ideas to explore</span></div>
          </div>
          <section aria-label="Inspiration gallery">
            <div className={styles.toolbar}>
              <h2>{mediaFilters.find((item) => item.value === kind)?.label}<span>{selectedCards.length}</span></h2>
              <label className={styles.search}><Search aria-hidden="true" size={17} /><span className="sr-only">Search inspirations</span>
                <input maxLength={180} onChange={(event) => updateFilters(kind, category, event.target.value)} placeholder="Search examples" type="search" value={query} />
                {query ? <button aria-label="Clear search" onClick={() => updateFilters(kind, category, "")} type="button"><X size={16} /></button> : null}
              </label>
            </div>
            <div className={styles.filterRow}>
              <div aria-label="Category filters" className={styles.categories} role="group">{categories.map((value) => <button aria-pressed={category === value} key={value} onClick={() => updateFilters(kind, value, query)} type="button">{value === ALL_CATEGORY ? "All categories" : value}</button>)}</div>
              <p aria-live="polite" className={styles.resultCount}>{visibleCards.length} {visibleCards.length === 1 ? "example" : "examples"}</p>
            </div>

            {visibleCards.length ? <div className={styles.grid}>
              {visibleCards.map((card) => <button aria-label={`Open ${card.label} example`} className={styles.card} data-inspiration-card={card.id} key={card.id} onClick={() => setActiveCardId(card.id)} type="button">
                <span className={styles.cardImage}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={card.imageAlt} decoding="async" loading="lazy" src={card.imageSrc} />
                  <span className={styles.cardKind}>{card.kind === "video" ? <Clapperboard size={12} /> : <ImageIcon size={12} />}{card.kind === "video" ? "Video idea" : "Photo idea"}</span>
                  <span aria-hidden="true" className={styles.cardOpen}><ArrowUpRight size={19} /></span>
                </span>
                <span className={styles.cardInfo}><span>{card.label}</span><small>{card.category === ALL_CATEGORY ? card.pageTitle : card.category}</small></span>
              </button>)}
            </div> : <div className={styles.empty}>
              {cards.length ? <Search aria-hidden="true" size={28} /> : <ImageIcon aria-hidden="true" size={28} />}
              <h2>{cards.length ? "No matching examples" : "Examples are unavailable"}</h2>
              <p>{cards.length ? "Try another search or explore a different category." : "Please check back soon for video and photo ideas."}</p>
              {cards.length ? <button onClick={() => updateFilters("all", ALL_CATEGORY, "")} type="button">Clear filters <ArrowRight size={15} /></button> : null}
            </div>}
          </section>
        </main>
      </div>

      {activeCard ? <CardModal card={activeCard} position={activeIndex} total={visibleCards.length} onClose={() => setActiveCardId(null)} onPrevious={() => setActiveCardId(visibleCards[activeIndex - 1]?.id ?? activeCard.id)} onNext={() => setActiveCardId(visibleCards[activeIndex + 1]?.id ?? activeCard.id)} /> : null}
    </div>
  );
}
