import { text, type V2Resolvers } from "./types";

type V2PromoStripCard = { key: string; badge: string; title: string; body: string; cta: string; href: string };
type V2PromoStrip = { enabled: boolean; stats: string; cards: V2PromoStripCard[] };

// Homepage offer band under the hero area. Fully data-driven: without an
// enabled promoStrip with at least one usable card it renders nothing at all.
export function AidreamcapesV2PromoStrip({ promo, r }: { promo: unknown; r: V2Resolvers }) {
  const strip = promo as V2PromoStrip | undefined;
  if (!strip?.enabled) return null;
  const cards = Array.isArray(strip.cards)
    ? strip.cards.filter((card) => card && text(card.title) && text(card.href))
    : [];
  const stats = text(strip.stats);
  if (!cards.length) return null;
  return (
    <section className="apromo" aria-label="Current offers">
      <div className="wrap">
        <div className="apromo-grid">
          {cards.map((card) => (
            <article className="apromo-card" key={text(card.key) || text(card.href)}>
              {text(card.badge) ? <span className="apromo-badge">{card.badge}</span> : null}
              <b className="apromo-title">{card.title}</b>
              {text(card.body) ? <p className="apromo-body">{card.body}</p> : null}
              {text(card.cta) ? <a className="apromo-cta" href={r.href(card.href)}>{card.cta} →</a> : null}
            </article>
          ))}
        </div>
        {stats ? <p className="apromo-stats">{stats}</p> : null}
      </div>
    </section>
  );
}
