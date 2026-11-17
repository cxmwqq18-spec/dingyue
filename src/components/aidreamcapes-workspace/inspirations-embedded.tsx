"use client";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";

// Inspiration gallery rendered inside the workspace content area. It shows the
// same relational detail cards that own the public media detail pages: real
// result media, the real generation prompt, and numbered pagination instead of
// infinite scroll. The light theme matches the workspace shell.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clapperboard, Image as ImageIcon, Loader2, Search, Sparkles, X } from "lucide-react";
import styles from "./inspirations-embedded.module.css";

import { INSPIRATIONS_PAGE_SIZE, type InspirationExample, type InspirationPage } from "@/lib/aidreamcapes-inspirations-types";

export type EmbeddedInspiration = InspirationExample;

type Kind = "all" | "video" | "photo";
const ALL_CATEGORY = "All";
const mediaFilters = [
  { value: "all", label: "All examples", icon: Sparkles },
  { value: "video", label: "Video ideas", icon: Clapperboard },
  { value: "photo", label: "Photo ideas", icon: ImageIcon },
] as const;

/** Pager window: three first pages, three last pages, neighbours of the current page. */
function pagerWindow(current: number, total: number): Array<number | "gap"> {
  const wanted = new Set<number>([1, 2, 3, total - 2, total - 1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const entries: Array<number | "gap"> = [];
  let previous = 0;
  for (const page of pages) {
    if (previous && page - previous > 1) entries.push("gap");
    entries.push(page);
    previous = page;
  }
  return entries;
}

function PromptCopyButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    const panel = document.querySelector<HTMLElement>("[data-inspiration-prompt]");
    const text = panel?.querySelector("[data-inspiration-prompt-text]")?.textContent?.trim() ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } catch { copied = false; }
      document.body.removeChild(field);
      setState(copied ? "copied" : "failed");
    }
    setTimeout(() => setState("idle"), 2200);
  };
  return (
    <button className={styles.promptCopy} onClick={copy} type="button">
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy prompt"}
    </button>
  );
}

function InspirationPager({ page, totalPages, disabled, onPage }: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onPage: (target: number) => void;
}) {
  const [jump, setJump] = useState(String(page));
  useEffect(() => { setJump(String(page)); }, [page]);
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Inspiration pages" className={styles.pager}>
      <button aria-label="Previous page" className={styles.pageNav} disabled={disabled || page <= 1} onClick={() => onPage(page - 1)} type="button"><ChevronLeft size={15} /></button>
      {pagerWindow(page, totalPages).map((entry, index) => entry === "gap"
        ? <span aria-hidden="true" className={styles.pageGap} key={`gap-${index}`}>…</span>
        : entry === page
          ? <span aria-current="page" className={`${styles.pageNum} ${styles.pageCurrent}`} key={`page-${entry}`}>{entry}</span>
          : <button className={styles.pageNum} key={`page-${entry}`} onClick={() => onPage(entry)} type="button">{entry}</button>)}
      <button aria-label="Next page" className={styles.pageNav} disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)} type="button"><ChevronRight size={15} /></button>
      <form className={styles.pageJump} onSubmit={(event) => {
        event.preventDefault();
        const target = Math.round(Number(jump));
        if (Number.isFinite(target) && target >= 1 && target <= totalPages) onPage(target);
      }}>
        <input aria-label={`Go to page, 1 to ${totalPages}`} inputMode="numeric" max={totalPages} min={1} onChange={(event) => setJump(event.target.value)} type="number" value={jump} />
        <button disabled={disabled} type="submit">Go</button>
      </form>
    </nav>
  );
}

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
          {card.video ? (
            /* The example's complete rendered result, scrubable with the
               native controls. The lightweight preview clip stays reserved
               for the card hover excerpt. */
            <video
              aria-label={card.label}
              autoPlay
              controls
              loop
              muted
              playsInline
              poster={card.video.poster?.src}
              preload="metadata"
              src={card.video.src}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img alt={card.imageAlt} src={card.imageSrc} />
          )}
        </div>
        <div className={styles.detailBody}>
          <button aria-label="Close example" className={styles.close} onClick={onClose} ref={closeRef} type="button"><X size={18} /></button>
          <span className={styles.eyebrow}>{card.kind === "video" ? "Video idea" : "Photo idea"}</span>
          <h2 id={titleId}>{card.label}</h2>
          <p>{card.description}</p>
          {card.prompt ? (
            <div className={styles.promptPanel} data-inspiration-prompt="true">
              <div className={styles.promptHead}>
                <h3>Prompt</h3>
                <PromptCopyButton />
              </div>
              <p className={styles.promptText} data-inspiration-prompt-text="true">{card.prompt}</p>
            </div>
          ) : null}
          <dl className={styles.detailMeta}>
            <div><dt>Collection</dt><dd>{card.pageTitle}</dd></div>
            {card.category !== ALL_CATEGORY ? <div><dt>Category</dt><dd>{card.category}</dd></div> : null}
            {card.duration ? <div><dt>Length</dt><dd>{card.duration} seconds</dd></div> : null}
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

/** One gallery card. Visible cards play their lightweight 10-second preview
 * clip by default (muted, looping, paused when scrolled away); full-video
 * cards without a preview clip stay hover-to-play. Moving the pointer away
 * pauses and rewinds the preview so it never looks like it is still playing. */
function InspirationCardItem({ card, onOpen }: { card: EmbeddedInspiration; onOpen: () => void }) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const hasPreviewClip = Boolean(card.video?.previewSrc);
  const start = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => setPlaying(false));
  };
  const stop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };
  // Preview clips are short, muted and pause offscreen, so autoplaying every
  // visible card stays cheap. Reduced-motion users keep hover-to-play.
  useEffect(() => {
    const element = cardRef.current;
    const video = videoRef.current;
    if (!hasPreviewClip || !element || !video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start();
        else stop();
      }
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [hasPreviewClip]);
  return (
    <button
      ref={cardRef}
      aria-label={`Open ${card.label} example`}
      className={styles.card}
      data-inspiration-card={card.id}
      onBlur={stop}
      onClick={onOpen}
      onFocus={start}
      onMouseEnter={start}
      onMouseLeave={stop}
      type="button"
    >
      <span className={styles.cardImage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={card.imageAlt} decoding="async" loading="lazy" src={card.imageSrc} />
        {card.video ? (
          <video
            aria-hidden="true"
            className={playing ? `${styles.cardVideo} ${styles.cardVideoPlaying}` : styles.cardVideo}
            data-inspiration-preview={card.id}
            loop={hasPreviewClip}
            muted
            onEnded={(event) => {
              event.currentTarget.currentTime = 0;
              if (hasPreviewClip) void event.currentTarget.play().catch(() => setPlaying(false));
              else setPlaying(false);
            }}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            playsInline
            poster={card.video.poster?.src ?? card.imageSrc}
            preload="metadata"
            ref={videoRef}
            src={card.video.previewSrc ?? card.video.src}
          />
        ) : null}
        <span className={styles.cardKind}>{card.kind === "video" ? <><Clapperboard size={11} /> Video idea</> : <><ImageIcon size={11} /> Photo idea</>}</span>
        <span aria-hidden="true" className={styles.cardOpen}><ArrowUpRight size={16} /></span>
      </span>
      <span className={styles.cardInfo}><span>{card.label}</span><small>{card.category === ALL_CATEGORY ? card.pageTitle : card.category}</small></span>
    </button>
  );
}

export function EmbeddedInspirations({ initialPage, endpoint, basePath }: { initialPage?: InspirationPage; endpoint: string; basePath: string }) {
  const [kind, setKind] = useState<Kind>("all");
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [page, setPage] = useState<InspirationPage | undefined>(initialPage);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(!initialPage);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const gridTop = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const filterKey = `${kind}\n${category}\n${search}`;
  const lastFilter = useRef(filterKey);
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (lastFilter.current !== filterKey) { lastFilter.current = filterKey; setPageNumber(1); }
  }, [filterKey]);
  const load = useCallback(async (targetPage: number) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const requestGeneration = ++generation.current;
    setLoading(true); setError("");
    const params = new URLSearchParams({ offset: String((targetPage - 1) * INSPIRATIONS_PAGE_SIZE), kind, category, q: search, basePath });
    try {
      const response = await fetch(`${endpoint}?${params}`, { signal: abort.signal, credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Couldn't load inspirations. Please try again.");
      const next = await response.json() as InspirationPage;
      if (generation.current !== requestGeneration) return;
      setPage(next);
    } catch (cause) {
      if (!abort.signal.aborted && generation.current === requestGeneration) setError(cause instanceof Error ? cause.message : "Couldn't load inspirations.");
    } finally {
      if (generation.current === requestGeneration) { setLoading(false); }
    }
  }, [endpoint, kind, category, search, basePath]);
  useEffect(() => {
    if (pageNumber === 1 && initialPage && kind === "all" && category === ALL_CATEGORY && !search && !retry) {
      controller.current?.abort(); generation.current++;
      setPage(initialPage); setLoading(false); setError("");
      return;
    }
    void load(pageNumber);
    return () => { controller.current?.abort(); generation.current++; };
  }, [filterKey, pageNumber, load, retry, initialPage, kind, category, search]);

  const total = page?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / INSPIRATIONS_PAGE_SIZE));
  const goToPage = useCallback((target: number) => {
    const next = Math.min(Math.max(1, Math.round(target)), totalPages);
    if (next === pageNumber) return;
    setActiveCardId(null);
    gridTop.current?.scrollIntoView({ block: "start" });
    setPageNumber(next);
  }, [pageNumber, totalPages]);
  const cards = page?.cards ?? [];
  const counts = page?.counts ?? { all: 0, video: 0, photo: 0 };
  const categories = page?.categories ?? [ALL_CATEGORY];
  const activeIndex = activeCardId ? cards.findIndex((card) => card.id === activeCardId) : -1;
  const activeCard = cards[activeIndex];

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

      <div ref={gridTop} className={styles.toolbar}>
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
        <p aria-live="polite" className={styles.resultCount}>{total} {total === 1 ? "example" : "examples"}</p>
      </div>

      {cards.length ? (
        <div aria-busy={loading} className={styles.grid}>
          {cards.map((card) => <InspirationCardItem card={card} key={card.id} onOpen={() => setActiveCardId(card.id)} />)}
        </div>
      ) : (
        <div className={styles.empty}>
          {counts.all ? <Search aria-hidden="true" size={28} /> : <ImageIcon aria-hidden="true" size={28} />}
          <h2>{counts.all ? "No matching examples" : "Examples are unavailable"}</h2>
          <p>{counts.all ? "Try another search or explore a different category." : "Please check back soon for video and photo ideas."}</p>
          {counts.all ? <button onClick={() => { setKind("all"); setCategory(ALL_CATEGORY); setQuery(""); }} type="button">Clear filters</button> : null}
        </div>
      )}

      <div aria-live="polite" className={styles.pagination}>
        {loading ? <span className={styles.paginationStatus}><Loader2 className={styles.spin} size={15} /> Loading examples…</span> : null}
        {error ? <><p role="alert">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></> : null}
      </div>
      <InspirationPager disabled={loading} onPage={goToPage} page={pageNumber} totalPages={totalPages} />

      {activeCard ? <CardModal card={activeCard} position={activeIndex} total={cards.length} onClose={() => setActiveCardId(null)} onPrevious={() => setActiveCardId(cards[activeIndex - 1]?.id ?? activeCard.id)} onNext={() => setActiveCardId(cards[activeIndex + 1]?.id ?? activeCard.id)} /> : null}
    </>
  );
}
