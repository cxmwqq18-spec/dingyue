"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { AidreamcapesProjectedImage as AidreamcapesResponsiveImage } from "./aidreamcapes-projected-image.client";

export type AidreamcapesBlogCard = {
  id: string;
  href: string;
  title: string;
  summary: string;
  imageUrl: string;
  imageAlt: string;
  author: string;
  publishedAt: string;
  readMinutes: string;
  tags: string[];
};

export function AidreamcapesBlogFilter({ cards }: { cards: AidreamcapesBlogCard[] }) {
  const [activeFilter, setActiveFilter] = useState("all");
  const filters = ["all", ...Array.from(new Set(cards.flatMap((card) => card.tags.map((tag) => tag.toLowerCase()))))].slice(0, 5);
  const visibleCards = useMemo(() => activeFilter === "all"
    ? cards
    : cards.filter((card) => card.tags.some((tag) => tag.toLowerCase() === activeFilter)), [activeFilter, cards]);

  return (
    <>
      <div className="ac-filter-bar" role="group" aria-label="Filter Field Notes">
        {filters.map((filter) => (
          <button
            className="ac-filter-button"
            data-active={activeFilter === filter ? "true" : "false"}
            key={filter}
            onClick={() => setActiveFilter(filter)}
            type="button"
          >
            {filter === "all" ? "All notes" : filter}
          </button>
        ))}
      </div>
      <div className="ac-article-grid">
        {visibleCards.map((card) => (
          <a className="ac-article-card" href={card.href} key={card.id}>
            <div className="ac-article-image">
              {card.imageUrl ? <AidreamcapesResponsiveImage alt={card.imageAlt || card.title} decoding="async" fetchPriority="low" loading="lazy" sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw" src={card.imageUrl} /> : null}
              {card.tags[0] ? <span className="ac-article-tag">{card.tags[0]}</span> : null}
            </div>
            <div className="ac-article-body">
              <div className="ac-article-meta">
                {card.author ? <span>{card.author}</span> : null}
                {card.publishedAt ? <span>/ {card.publishedAt}</span> : null}
                {card.readMinutes ? <span>/ {card.readMinutes} min read</span> : null}
              </div>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <span className="ac-card-link">Read the guide <ArrowUpRight size={14} strokeWidth={1.8} /></span>
            </div>
          </a>
        ))}
      </div>
      {!visibleCards.length ? <p className="ac-empty">No notes match this filter yet.</p> : null}
    </>
  );
}
