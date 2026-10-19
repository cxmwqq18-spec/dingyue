"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clapperboard, Home, Image as ImageIcon, Search, Sparkles, X } from "lucide-react";
import type { InspirationCard } from "@/lib/aidreamcapes-inspirations-types";
import { inspirationCreateHref } from "@/lib/aidreamcapes-inspirations-types";

// Card data is server-rendered from the current Aidreamcapes LivePage rows.
// This component handles presentation only and never fetches public data.

type InspirationsTab = "video" | "photo";

const ALL_CATEGORY = "All";

function PublicTopBar() {
  return (
    <header className="insp-top">
      <Link className="insp-brand" href="/" aria-label="AIVideosUGC home">
        <span aria-hidden="true" className="insp-brand-mark">A</span>
        <span>AIVideosUGC</span>
      </Link>
      <Link className="insp-login" href="/login">Log in <ArrowUpRight aria-hidden="true" size={15} /></Link>
    </header>
  );
}

function PublicSideNav() {
  return (
    <nav aria-label="Workspace menu" className="insp-side">
      <span className="insp-side-label">Workspace</span>
      <Link href="/app/create"><Home aria-hidden="true" size={17} /> Home</Link>
      <Link className="is-active" href="/app/create?view=inspirations"><Sparkles aria-hidden="true" size={17} /> Inspirations</Link>
    </nav>
  );
}

function CardModal({ card, basePath, embedded, onClose }: { card: InspirationCard; basePath: string; embedded: boolean; onClose: () => void }) {
  return (
    <div aria-modal="true" aria-labelledby="insp-modal-title" className="insp-modal-backdrop" onClick={onClose} role="dialog">
      <div className="insp-modal" onClick={(event) => event.stopPropagation()}>
        <button aria-label="Close example" className="insp-modal-close" onClick={onClose} type="button">
          <X strokeWidth={1.8} />
        </button>
        <div className="insp-modal-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={card.imageAlt} src={card.imageSrc} />
        </div>
        <div className="insp-modal-body">
          <span className="insp-modal-kicker">{card.kind === "video" ? "VIDEO EXAMPLE" : "PHOTO EXAMPLE"}</span>
          <h2 id="insp-modal-title">{card.label}</h2>
          <p>{card.description}</p>
          <span className="insp-modal-tool">From {card.pageTitle}</span>
          <Link className="insp-recreate" aria-label={embedded ? (card.kind === "video" ? "Create a video like this" : "Create an image like this") : undefined} href={inspirationCreateHref(card, embedded ? basePath : "")}>
            <span>{embedded ? (card.kind === "video" ? "Create a video like this" : "Create an image like this") : "Recreate this idea"}</span>
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AidreamcapesInspirationsPage({ cards, basePath = "", embedded = false }: { cards: InspirationCard[]; basePath?: string; embedded?: boolean }) {
  const [tab, setTab] = useState<InspirationsTab>("video");
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [query, setQuery] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const videoCards = useMemo(() => cards.filter((card) => card.kind === "video"), [cards]);
  const photoCards = useMemo(() => cards.filter((card) => card.kind === "photo"), [cards]);
  const selectedCards = tab === "video" ? videoCards : photoCards;

  const categoriesForTab = useMemo(() => {
    const values = Array.from(new Set(selectedCards.map((card) => card.category)))
      .filter((value) => value !== ALL_CATEGORY)
      .sort((left, right) => left.localeCompare(right));
    return [ALL_CATEGORY, ...values];
  }, [selectedCards]);

  const visibleCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return selectedCards.filter((card) => {
      if (category !== ALL_CATEGORY && card.category !== category) return false;
      if (normalizedQuery && !`${card.label} ${card.imageAlt} ${card.pageTitle} ${card.category} ${card.prompt}`.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    });
  }, [selectedCards, category, query]);

  const activeCard = activeCardId ? cards.find((card) => card.id === activeCardId) : undefined;

  useEffect(() => {
    if (!activeCardId) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveCardId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [activeCardId]);

  function switchTab(next: InspirationsTab) {
    setTab(next);
    setCategory(ALL_CATEGORY);
    setActiveCardId(null);
  }

  const content = (
    <main className={`insp-main${embedded ? " is-embedded" : ""}`}>
      <div className="insp-heading-row">
        <div className="insp-intro">
          <p className="insp-eyebrow"><span aria-hidden="true" /> Creative library</p>
          <h1>Find a direction for your next ad</h1>
          <p className="insp-intro-copy">Explore product video and photo examples from our creative workflows. Open an idea to review it, then start a version for your own product.</p>
        </div>
        <aside aria-label="Example totals" className="insp-totals">
          <span className="insp-totals-label">Browse the library</span>
          <div><strong>{cards.length}</strong><span> examples</span></div>
          <p><span>{videoCards.length} videos</span><i aria-hidden="true" /><span>{photoCards.length} photos</span></p>
        </aside>
      </div>

      <section aria-label="Browse inspirations" className="insp-browser">
        <div className="insp-browser-top">
          <div aria-label="Inspiration type" className="insp-tabs" role="tablist">
            <button aria-controls="inspiration-results" aria-selected={tab === "video"} className={tab === "video" ? "is-active" : ""} id="insp-video-tab" onClick={() => switchTab("video")} role="tab" type="button">
              <Clapperboard aria-hidden="true" size={16} /><span>Video</span><b>{videoCards.length}</b>
            </button>
            <button aria-controls="inspiration-results" aria-selected={tab === "photo"} className={tab === "photo" ? "is-active" : ""} id="insp-photo-tab" onClick={() => switchTab("photo")} role="tab" type="button">
              <ImageIcon aria-hidden="true" size={16} /><span>Photo</span><b>{photoCards.length}</b>
            </button>
          </div>
          <label className="insp-search">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Search inspirations</span>
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search scenes, products, or tools" type="search" value={query} />
            {query ? <button aria-label="Clear search" onClick={() => setQuery("")} type="button"><X size={15} /></button> : null}
          </label>
        </div>

        <div className="insp-filter-row">
          <div aria-label="Category filters" className="insp-categories" role="group">
            {categoriesForTab.map((value) => (
              <button aria-pressed={category === value} className={category === value ? "is-active" : ""} key={value} onClick={() => setCategory(value)} type="button">{value}</button>
            ))}
          </div>
          <p aria-live="polite" className="insp-result-count">Showing <strong>{visibleCards.length}</strong> of {selectedCards.length}</p>
        </div>

        {cards.length === 0 ? (
          <div className="insp-empty insp-empty-library">
            <span className="insp-empty-icon"><Sparkles aria-hidden="true" size={20} /></span>
            <h2>Inspiration examples are unavailable</h2>
            <p>Please check back soon to browse video and photo ideas.</p>
          </div>
        ) : visibleCards.length ? (
          <div aria-labelledby={tab === "video" ? "insp-video-tab" : "insp-photo-tab"} className="insp-grid" id="inspiration-results" role="tabpanel" tabIndex={0}>
            {visibleCards.map((card) => (
              <button aria-label={`Open ${card.label} example`} className="insp-card" key={card.id} onClick={() => setActiveCardId(card.id)} type="button">
                <span className="insp-card-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={card.imageAlt} loading="lazy" src={card.imageSrc} />
                  <span className="insp-card-kind">{card.kind === "video" ? "VIDEO" : "PHOTO"}</span>
                  <span aria-hidden="true" className="insp-card-open"><ArrowUpRight size={17} /></span>
                </span>
                <span className="insp-card-info">
                  <span className="insp-card-label">{card.label}</span>
                  <span className="insp-card-meta"><span>{card.category === ALL_CATEGORY ? card.pageTitle : card.category}</span><ArrowRight aria-hidden="true" size={14} /></span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="insp-empty">
            <span className="insp-empty-icon"><Search aria-hidden="true" size={19} /></span>
            <h2>No matching ideas</h2>
            <p>Try another search or choose a different category.</p>
            <button className="insp-clear-filters" onClick={() => { setQuery(""); setCategory(ALL_CATEGORY); }} type="button">Clear filters</button>
          </div>
        )}
      </section>
    </main>
  );

  const modal = activeCard ? <CardModal card={activeCard} basePath={basePath} embedded={embedded} onClose={() => setActiveCardId(null)} /> : null;
  if (embedded) return <section className="insp-page is-embedded">{content}{modal}</section>;
  return <div className="insp-page"><PublicTopBar /><div className="insp-layout"><PublicSideNav />{content}</div>{modal}</div>;
}
