"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import type { InspirationCard } from "@/lib/aidreamcapes-inspirations-types";
import { inspirationCreateHref } from "@/lib/aidreamcapes-inspirations-types";

// Aidreamcapes inspiration library. Card data is server-rendered from LivePage
// tool pages; this component only handles tab/category/modal presentation and
// never fetches page data in the browser.

type InspirationsTab = "video" | "photo";

const ALL_CATEGORY = "All";

function PublicTopBar() {
  return (
    <header className="insp-top">
      <Link className="insp-brand" href="/">AIVideosUGC</Link>
      <Link className="insp-login" href="/login">Log In</Link>
    </header>
  );
}

function PublicSideNav() {
  return (
    <nav aria-label="Workspace menu" className="insp-side">
      <Link href="/app/create">Home</Link>
      <Link className="is-active" href="/app/inspirations">Inspirations</Link>
    </nav>
  );
}

function CardModal({ card, basePath, embedded, onClose }: { card: InspirationCard; basePath: string; embedded: boolean; onClose: () => void }) {
  return (
    <div aria-modal="true" className="insp-modal-backdrop" onClick={onClose} role="dialog">
      <div className="insp-modal" onClick={(event) => event.stopPropagation()}>
        <button aria-label="Close" className="insp-modal-close" onClick={onClose} type="button">
          <X strokeWidth={1.8} />
        </button>
        <div className="insp-modal-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={card.imageAlt} src={card.imageSrc} />
        </div>
        <div className="insp-modal-body">
          <h2>{card.label}</h2>
          <p>{card.description}</p>
          <Link className="insp-recreate" style={embedded ? { gap: 8 } : undefined} aria-label={embedded ? (card.kind === "video" ? "Create a video like this" : "Create an image like this") : undefined} href={inspirationCreateHref(card, embedded ? basePath : "")}>
            {embedded ? <><span>{card.kind === "video" ? "Create a video like this" : "Create an image like this"}</span><ArrowRight size={16} aria-hidden="true" /></> : "Recreate"}
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
  const [activeCardRef, setActiveCardRef] = useState<string | null>(null);

  const videoCards = useMemo(() => cards.filter((card) => card.kind === "video"), [cards]);
  const photoCards = useMemo(() => cards.filter((card) => card.kind === "photo"), [cards]);

  const categoriesForTab = useMemo(() => {
    const source = tab === "video" ? videoCards : photoCards;
    return [ALL_CATEGORY, ...Array.from(new Set(source.map((card) => card.category))).filter((value) => value !== ALL_CATEGORY).sort()];
  }, [tab, videoCards, photoCards]);

  const visibleCards = useMemo(() => {
    const source = tab === "video" ? videoCards : photoCards;
    const normalizedQuery = query.trim().toLowerCase();
    return source.filter((card) => {
      if (category !== ALL_CATEGORY && card.category !== category) return false;
      if (normalizedQuery && !`${card.label} ${card.imageAlt}`.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    });
  }, [tab, videoCards, photoCards, category, query]);

  const activeCard = activeCardRef ? cards.find((card) => card.ref === activeCardRef) : undefined;

  useEffect(() => {
    if (!activeCardRef) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveCardRef(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeCardRef]);

  function switchTab(next: InspirationsTab) {
    setTab(next);
    setCategory(ALL_CATEGORY);
    setActiveCardRef(null);
  }

  const content = <main className="insp-main" style={embedded ? { padding: 0 } : undefined}>
          {embedded ? (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, letterSpacing: "-0.04em", lineHeight: 1.2 }}>Explore video and photo ideas</h1>
            <p style={{ color: "#77736d", fontSize: 14, marginTop: 8 }}>Choose an example, then add your own product photos to start creating.</p>
            <p style={{ color: "#8a867f", fontSize: 12, marginTop: 8 }}><span>{videoCards.length}</span><span> video ideas · </span><span>{photoCards.length}</span><span> photo ideas</span></p>
          </div>
          ) : null}
          <div className="insp-tabs" role="tablist">
            <button aria-selected={tab === "video"} className={tab === "video" ? "is-active" : ""} onClick={() => switchTab("video")} role="tab" type="button">Video</button>
            <button aria-selected={tab === "photo"} className={tab === "photo" ? "is-active" : ""} onClick={() => switchTab("photo")} role="tab" type="button">Photo</button>
          </div>
          <div className="insp-tools">
            <label className="insp-search">
              <span className="sr-only">Search inspirations</span>
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Search" type="search" value={query} />
            </label>
          </div>
          <div className="insp-categories" role="group" aria-label="Category filters">
            {categoriesForTab.map((value) => (
              <button className={category === value ? "is-active" : ""} key={value} onClick={() => setCategory(value)} type="button">{value}</button>
            ))}
          </div>
          {visibleCards.length ? (
            <div className="insp-grid">
              {visibleCards.map((card) => (
                <button className="insp-card" key={card.ref} onClick={() => setActiveCardRef(card.ref)} type="button">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={card.imageAlt} loading="lazy" src={card.imageSrc} />
                  <span>{card.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="insp-empty">No inspirations match this filter.</p>
          )}

  </main>;
  const modal = activeCard ? <CardModal card={activeCard} basePath={basePath} embedded={embedded} onClose={() => setActiveCardRef(null)} /> : null;
  if (embedded) return <section className="insp-page" style={{ minHeight: 0, background: "transparent" }}>{content}{modal}</section>;
  return <div className="insp-page"><PublicTopBar /><div className="insp-layout"><PublicSideNav />{content}</div>{modal}</div>;
}
