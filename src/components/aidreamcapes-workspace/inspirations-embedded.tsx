"use client";

// Inspiration gallery rendered inside the workspace content area. It reuses the
// same card data and interactions as the public standalone inspiration page
// but follows the workspace's light theme and never leaves the workspace shell.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clapperboard, Image as ImageIcon, Loader2, Search, Sparkles, X } from "lucide-react";
import styles from "./inspirations-embedded.module.css";

import type { InspirationExample } from "@/lib/aidreamcapes-inspirations-types";

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
          <a className={styles.create} href={card.createHref}>
            {card.kind === "video" ? "Create a video like this" : "Create an image like this"} <ArrowUpRight size={17} />
          </a>
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

export function EmbeddedInspirations({ cards, loading = false }: { cards: EmbeddedInspiration[]; loading?: boolean }) {
  const [kind, setKind] = useState<Kind>("all");
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [query, setQuery] = useState("");
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

  if (loading) {
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
        <div className={styles.total}><strong>{cards.length}</strong><span>ideas to explore</span></div>
      </div>

      <div className={styles.toolbar}>
        <h2>{mediaFilters.find((item) => item.value === kind)?.label}<span>{selectedCards.length}</span></h2>
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
        <p aria-live="polite" className={styles.resultCount}>{visibleCards.length} {visibleCards.length === 1 ? "example" : "examples"}</p>
      </div>

      {visibleCards.length ? (
        <div className={styles.grid}>
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
          {cards.length ? <Search aria-hidden="true" size={28} /> : <ImageIcon aria-hidden="true" size={28} />}
          <h2>{cards.length ? "No matching examples" : "Examples are unavailable"}</h2>
          <p>{cards.length ? "Try another search or explore a different category." : "Please check back soon for video and photo ideas."}</p>
          {cards.length ? <button onClick={() => { setKind("all"); setCategory(ALL_CATEGORY); setQuery(""); }} type="button">Clear filters</button> : null}
        </div>
      )}

      {activeCard ? <CardModal card={activeCard} position={activeIndex} total={visibleCards.length} onClose={() => setActiveCardId(null)} onPrevious={() => setActiveCardId(visibleCards[activeIndex - 1]?.id ?? activeCard.id)} onNext={() => setActiveCardId(visibleCards[activeIndex + 1]?.id ?? activeCard.id)} /> : null}
    </>
  );
}
