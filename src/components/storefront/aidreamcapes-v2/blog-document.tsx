import type { V2Image, V2Resolvers } from "./types";
import { Img, RichText } from "./parts";
import { BlogThemeToggle } from "./blog-theme-toggle";

/**
 * Document-style blog page. The body follows the owner-provided source pages
 * (a press release, a company knowledge base and the industry guides): a
 * plain editorial column with a cover hero, numbered sections, an optional
 * example player and an optional FAQ. The site header and footer stay in
 * place; only the article surface repaints between the Ink and Paper themes.
 */

type DocumentBlock =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "h4"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "facts"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "quote"; text: string }
  | { kind: "contact"; items: string[] }
  | { kind: "video"; src: string; poster: V2Image; alt?: string; href?: string; label?: string };

export type DocumentData = {
  variant: "press" | "knowledge";
  kicker?: string;
  h1: string;
  byline?: string;
  cover?: V2Image;
  lead?: string;
  sections: { h2: string; blocks: DocumentBlock[] }[];
  faq?: { question: string; answer: string }[];
  facts?: string[];
  contacts?: string[];
  footerNote?: string;
};

function readingMinutes(data: DocumentData): number {
  const text = [
    data.h1,
    data.lead ?? "",
    ...data.sections.flatMap((section) => [section.h2, ...section.blocks.flatMap((block) => {
      if ("text" in block) return [block.text];
      if ("items" in block) return block.items;
      if ("rows" in block) return block.rows.flat();
      return [];
    })]),
    ...(data.faq ?? []).flatMap((item) => [item.question, item.answer])
  ].join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 180));
}

function Block({ block, r }: { block: DocumentBlock; r: V2Resolvers }) {
  if (block.kind === "p") return <p><RichText r={r} text={block.text} /></p>;
  if (block.kind === "h3") return <h3>{block.text}</h3>;
  if (block.kind === "h4") return <h4>{block.text}</h4>;
  if (block.kind === "quote") return <blockquote><p><RichText r={r} text={block.text} /></p></blockquote>;
  if (block.kind === "list") {
    const items = block.items.map((item) => <li key={item}><RichText r={r} text={item} /></li>);
    return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
  }
  if (block.kind === "facts") {
    return (
      <div className="bdoc-facts">
        <ul>{block.items.map((item) => <li key={item}><RichText r={r} text={item} /></li>)}</ul>
      </div>
    );
  }
  if (block.kind === "table") {
    return (
      <div className="bdoc-table">
        <table>
          <thead><tr>{block.head.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.join("|")}>
                {row.map((cell, index) => <td key={`${index}:${cell}`}><RichText r={r} text={cell} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.kind === "contact") {
    return <div className="bdoc-contact">{block.items.map((item) => <p key={item}><RichText r={r} text={item} /></p>)}</div>;
  }
  return (
    <figure className="bdoc-video">
      <div className="bdoc-video-stage">
        <video
          aria-label={block.alt ?? "Example video"}
          controls
          height={block.poster.height}
          playsInline
          poster={r.asset(block.poster.src)}
          preload="metadata"
          width={block.poster.width}
        >
          <source src={r.asset(block.src)} type="video/mp4" />
        </video>
      </div>
      <figcaption>
        <span className="bdoc-video-label">Example from our library</span>
        {block.label ? <strong>{block.label}</strong> : null}
        {block.href ? <a href={r.href(block.href)}>Open the full example <span aria-hidden="true">→</span></a> : null}
      </figcaption>
    </figure>
  );
}

export function BlogDocumentPage({ data, r }: { data: DocumentData; r: V2Resolvers }) {
  const minutes = readingMinutes(data);
  return (
    <div className="bdoc" data-variant={data.variant}>
      <style dangerouslySetInnerHTML={{ __html: BDOC_CSS }} />
      <script
        dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('aivideosugc-blog-theme')==='paper'){document.documentElement.setAttribute('data-blog-theme','paper')}}catch(e){}" }}
      />
      <div className="bdoc-aurora" aria-hidden="true" />
      <div className="bdoc-shell">
        <header className="bdoc-hero">
          <div className="bdoc-hero-copy">
            {data.kicker ? <p className="bdoc-kicker"><i aria-hidden="true" />{data.kicker}</p> : null}
            <h1>{data.h1}</h1>
            {data.lead ? <p className="bdoc-lead"><RichText r={r} text={data.lead} /></p> : null}
            <div className="bdoc-meta">
              {data.byline ? <span>{data.byline}</span> : null}
              <span className="bdoc-dot" aria-hidden="true" />
              <span>{minutes} min read</span>
              <BlogThemeToggle />
            </div>
          </div>
          {data.cover ? (
            <figure className="bdoc-cover">
              <Img eager image={data.cover} r={r} />
            </figure>
          ) : null}
        </header>

        <article className="bdoc-body">
          {data.sections.map((section, index) => (
            <section key={section.h2} id={`section-${index + 1}`}>
              <h2><span className="bdoc-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{section.h2}</h2>
              {section.blocks.map((block, blockIndex) => (
                <Block block={block} key={`${section.h2}:${blockIndex}`} r={r} />
              ))}
            </section>
          ))}

          {data.faq?.length ? (
            <section className="bdoc-faq" id="faq">
              <h2><span className="bdoc-num" aria-hidden="true">{String(data.sections.length + 1).padStart(2, "0")}</span>Frequently Asked Questions</h2>
              <div className="bdoc-faq-list">
                {data.faq.map((item, index) => (
                  <details key={item.question} open={index === 0}>
                    <summary>
                      <span className="bdoc-qnum" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <span>{item.question}</span>
                      <i className="bdoc-plus" aria-hidden="true">+</i>
                    </summary>
                    <div className="bdoc-answer"><p><RichText r={r} text={item.answer} /></p></div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {data.facts?.length ? (
            <div className="bdoc-facts bdoc-facts-end">
              {data.facts.map((item) => <p key={item}><RichText r={r} text={item} /></p>)}
            </div>
          ) : null}

          {data.contacts?.length ? (
            <div className="bdoc-contact">
              {data.contacts.map((item) => <p key={item}><RichText r={r} text={item} /></p>)}
            </div>
          ) : null}

          {data.footerNote ? (
            <footer className="bdoc-footer"><p><RichText r={r} text={data.footerNote} /></p></footer>
          ) : null}
        </article>
      </div>
    </div>
  );
}

const BDOC_CSS = `
.adc2 .bdoc{
  --bdoc-bg:#07060b; --bdoc-bg2:#0b0a12; --bdoc-surface:#100e19; --bdoc-ink:#f5f2ec;
  --bdoc-ink2:#c9c4d8; --bdoc-muted:#8d879d; --bdoc-line:rgba(255,255,255,.10);
  --bdoc-line2:rgba(255,255,255,.20); --bdoc-accent:#a78bfa; --bdoc-accent2:#f472b6;
  --bdoc-chip:rgba(167,139,250,.13); --bdoc-shadow:0 30px 80px rgba(0,0,0,.5);
  position:relative;overflow:hidden;background:var(--bdoc-bg);color:var(--bdoc-ink);
  font-family:"Manrope","Helvetica Neue",Arial,sans-serif;font-size:16px;line-height:1.65;
  -webkit-font-smoothing:antialiased;padding:0 0 84px;
}
html[data-blog-theme="paper"] .adc2 .bdoc{
  --bdoc-bg:#f2ede4; --bdoc-bg2:#ece5d9; --bdoc-surface:#fbf8f1; --bdoc-ink:#171319;
  --bdoc-ink2:#4a4152; --bdoc-muted:#7a7181; --bdoc-line:rgba(23,19,25,.12);
  --bdoc-line2:rgba(23,19,25,.24); --bdoc-accent:#6d28d9; --bdoc-accent2:#c0266d;
  --bdoc-chip:rgba(109,40,217,.08); --bdoc-shadow:0 24px 60px rgba(52,38,28,.16);
}
.adc2 .bdoc *,.adc2 .bdoc *::before,.adc2 .bdoc *::after{box-sizing:border-box}
.adc2 .bdoc a{color:var(--bdoc-accent);text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--bdoc-accent) 45%,transparent)}
.adc2 .bdoc a:hover{border-bottom-color:var(--bdoc-accent)}
.adc2 .bdoc img{max-width:100%}
.adc2 .bdoc .bdoc-aurora{
  position:absolute;inset:-12% -8% auto;height:640px;pointer-events:none;
  background:
    radial-gradient(40% 55% at 16% 10%,color-mix(in srgb,var(--bdoc-accent) 26%,transparent),transparent 70%),
    radial-gradient(36% 46% at 86% 2%,color-mix(in srgb,var(--bdoc-accent2) 18%,transparent),transparent 72%);
  filter:blur(12px);opacity:.55;
}
.adc2 .bdoc .bdoc-aurora::after{
  content:"";position:absolute;inset:0;opacity:.22;
  background-image:linear-gradient(var(--bdoc-line) 1px,transparent 1px),linear-gradient(90deg,var(--bdoc-line) 1px,transparent 1px);
  background-size:64px 64px;mask-image:linear-gradient(to bottom,black,transparent 80%);
}
.adc2 .bdoc .bdoc-shell{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:34px 28px 0}

/* hero */
.adc2 .bdoc-hero{display:grid;grid-template-columns:minmax(0,1.06fr) minmax(300px,.8fr);gap:52px;align-items:center}
.adc2 .bdoc-hero-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
.adc2 .bdoc-kicker{
  display:inline-flex;align-items:center;gap:8px;margin:0 0 16px;padding:6px 12px;border-radius:999px;
  border:1px solid color-mix(in srgb,var(--bdoc-accent) 34%,transparent);background:var(--bdoc-chip);
  color:var(--bdoc-accent);font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
}
.adc2 .bdoc-kicker i{width:6px;height:6px;border-radius:50%;background:var(--bdoc-accent);display:block}
.adc2 .bdoc h1{
  margin:0 0 16px;font-family:"Fraunces",Georgia,"Times New Roman",serif;font-weight:600;
  font-size:clamp(2.2rem,4vw,3.7rem);line-height:1.05;letter-spacing:-.02em;color:var(--bdoc-ink);text-wrap:balance;
}
.adc2 .bdoc .bdoc-lead{margin:0 0 20px;color:var(--bdoc-ink2);font-size:clamp(1rem,1.35vw,1.12rem);line-height:1.7;max-width:58ch}
.adc2 .bdoc .bdoc-meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px;color:var(--bdoc-muted);font-size:12.5px;font-weight:600}
.adc2 .bdoc .bdoc-meta .bdoc-theme{margin-left:auto}
.adc2 .bdoc .bdoc-dot{width:4px;height:4px;border-radius:50%;background:var(--bdoc-line2);display:block}
.adc2 .bdoc-cover{
  margin:0;max-width:420px;justify-self:end;border-radius:26px;overflow:hidden;
  border:1px solid var(--bdoc-line2);background:var(--bdoc-surface);box-shadow:var(--bdoc-shadow);
  transform:rotate(.5deg);transition:transform .45s cubic-bezier(.2,.7,.2,1);
}
.adc2 .bdoc-cover:hover{transform:rotate(0) translateY(-4px)}
.adc2 .bdoc-cover img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;object-position:center top}

/* theme toggle */
.adc2 .bdoc-theme{
  display:inline-flex;align-items:center;gap:3px;padding:3px;border:1px solid var(--bdoc-line);
  border-radius:999px;background:var(--bdoc-surface);flex:none;
}
.adc2 .bdoc-theme-label{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--bdoc-muted);padding:0 7px 0 9px;font-weight:800}
.adc2 .bdoc-theme button{
  appearance:none;border:0;cursor:pointer;border-radius:999px;padding:6px 12px;
  font:700 10.5px/1 "Manrope","Helvetica Neue",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;
  background:transparent;color:var(--bdoc-muted);transition:background .2s ease,color .2s ease;
}
.adc2 .bdoc-theme button[aria-pressed="true"]{background:var(--bdoc-accent);color:var(--bdoc-bg)}

/* body */
.adc2 .bdoc .bdoc-body{max-width:760px;margin:52px auto 0;padding:0 2px}
.adc2 .bdoc .bdoc-body section{margin:0 0 44px;scroll-margin-top:100px}
.adc2 .bdoc h2{
  display:flex;gap:13px;align-items:baseline;margin:0 0 16px;
  font-family:"Fraunces",Georgia,"Times New Roman",serif;font-weight:600;
  font-size:clamp(1.55rem,2.5vw,2.1rem);line-height:1.12;letter-spacing:-.01em;color:var(--bdoc-ink);
}
.adc2 .bdoc .bdoc-num{
  flex:none;transform:translateY(-3px);padding:4px 9px;border-radius:999px;
  border:1px solid color-mix(in srgb,var(--bdoc-accent) 30%,transparent);background:var(--bdoc-chip);
  color:var(--bdoc-accent);font-family:"Manrope","Helvetica Neue",Arial,sans-serif;
  font-size:11px;font-weight:800;letter-spacing:.08em;
}
.adc2 .bdoc p{margin:0 0 18px;font-size:1.04rem;line-height:1.82;color:var(--bdoc-ink2)}
.adc2 .bdoc p strong,.adc2 .bdoc b{color:var(--bdoc-ink);font-weight:700}
.adc2 .bdoc[data-variant="press"] .bdoc-body section:first-of-type > p:first-of-type::first-letter{
  float:left;padding:6px 12px 0 0;color:var(--bdoc-accent);
  font-family:"Fraunces",Georgia,"Times New Roman",serif;font-size:3.3em;line-height:.8;
}
.adc2 .bdoc h3{margin:26px 0 8px;color:var(--bdoc-ink);font-size:1.12rem;font-weight:700;line-height:1.4}
.adc2 .bdoc h4{margin:20px 0 6px;color:var(--bdoc-ink);font-size:.98rem;font-weight:700}
.adc2 .bdoc ul,.adc2 .bdoc ol{margin:0 0 18px;padding-left:22px;color:var(--bdoc-ink2)}
.adc2 .bdoc li{margin-bottom:8px;line-height:1.7}
.adc2 .bdoc blockquote{margin:22px 0;padding:16px 20px;border-left:3px solid var(--bdoc-accent);background:var(--bdoc-surface);border-radius:0 14px 14px 0}
.adc2 .bdoc blockquote p:last-child{margin:0}

/* video */
.adc2 .bdoc .bdoc-video{
  margin:28px 0 34px;border:1px solid var(--bdoc-line2);border-radius:22px;overflow:hidden;
  background:var(--bdoc-surface);box-shadow:var(--bdoc-shadow);display:grid;grid-template-columns:210px minmax(0,1fr);
}
.adc2 .bdoc .bdoc-video-stage{background:#000;min-height:300px}
.adc2 .bdoc .bdoc-video video{display:block;width:100%;height:100%;object-fit:cover;aspect-ratio:9/16;background:#000}
.adc2 .bdoc .bdoc-video figcaption{display:flex;flex-direction:column;justify-content:center;gap:10px;padding:22px 24px}
.adc2 .bdoc .bdoc-video-label{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--bdoc-accent);font-weight:800}
.adc2 .bdoc .bdoc-video figcaption strong{font-size:1.05rem;color:var(--bdoc-ink);line-height:1.35}
.adc2 .bdoc .bdoc-video figcaption a{font-size:12.5px;font-weight:800;border-bottom:0;display:inline-flex;gap:6px;align-items:center;color:var(--bdoc-ink)}
.adc2 .bdoc .bdoc-video figcaption a:hover{color:var(--bdoc-accent)}

/* facts / tables / contact */
.adc2 .bdoc .bdoc-facts{margin:22px 0;padding:16px 18px;background:var(--bdoc-surface);border-left:3px solid var(--bdoc-accent);border-radius:0 14px 14px 0;font-size:.95rem}
.adc2 .bdoc .bdoc-facts p{margin:0 0 6px;line-height:1.7}
.adc2 .bdoc .bdoc-facts p:last-child{margin:0}
.adc2 .bdoc .bdoc-facts ul{margin:0;padding-left:20px}
.adc2 .bdoc .bdoc-facts li{margin-bottom:6px}
.adc2 .bdoc .bdoc-table{margin:14px 0 22px;width:100%;overflow-x:auto}
.adc2 .bdoc table{width:100%;min-width:520px;border-collapse:collapse;color:var(--bdoc-ink2);font-size:.94rem;line-height:1.6}
.adc2 .bdoc th,.adc2 .bdoc td{text-align:left;padding:9px 12px;border:1px solid var(--bdoc-line);vertical-align:top}
.adc2 .bdoc th{background:var(--bdoc-surface);color:var(--bdoc-ink);font-weight:700}
.adc2 .bdoc .bdoc-contact{margin:26px 0 0;padding-top:18px;border-top:1px solid var(--bdoc-line);font-size:.95rem}
.adc2 .bdoc .bdoc-contact p{margin:0 0 6px}
.adc2 .bdoc .bdoc-footer{margin-top:46px;padding-top:16px;border-top:1px solid var(--bdoc-line);color:var(--bdoc-muted);font-size:.84rem}
.adc2 .bdoc .bdoc-footer p{margin:0;color:var(--bdoc-muted)}

/* faq */
.adc2 .bdoc .bdoc-faq{margin-top:52px}
.adc2 .bdoc .bdoc-faq-list{display:grid;gap:10px}
.adc2 .bdoc .bdoc-faq details{border:1px solid var(--bdoc-line);border-radius:16px;background:var(--bdoc-surface);overflow:hidden;transition:border-color .2s ease}
.adc2 .bdoc .bdoc-faq details[open]{border-color:color-mix(in srgb,var(--bdoc-accent) 34%,transparent)}
.adc2 .bdoc .bdoc-faq summary{
  list-style:none;cursor:pointer;display:flex;align-items:center;gap:14px;
  padding:16px 18px;font-weight:700;font-size:14.5px;color:var(--bdoc-ink);
}
.adc2 .bdoc .bdoc-faq summary::-webkit-details-marker{display:none}
.adc2 .bdoc .bdoc-qnum{font-size:11px;font-weight:800;color:var(--bdoc-accent);min-width:22px;letter-spacing:.06em}
.adc2 .bdoc .bdoc-plus{
  margin-left:auto;flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;
  border:1px solid var(--bdoc-line2);color:var(--bdoc-ink2);font-style:normal;font-size:15px;transition:transform .25s ease,background .25s ease,color .25s ease;
}
.adc2 .bdoc .bdoc-faq details[open] .bdoc-plus{transform:rotate(45deg);background:var(--bdoc-accent);border-color:var(--bdoc-accent);color:var(--bdoc-bg)}
.adc2 .bdoc .bdoc-answer{padding:0 18px 18px 54px}
.adc2 .bdoc .bdoc-answer p{margin:0;font-size:14.5px;line-height:1.75}

@media (max-width:1020px){
  .adc2 .bdoc-hero{grid-template-columns:1fr;gap:30px}
  .adc2 .bdoc-cover{max-width:340px;justify-self:start;transform:none}
  .adc2 .bdoc .bdoc-video{grid-template-columns:1fr}
  .adc2 .bdoc .bdoc-video video{max-height:520px}
}
@media (max-width:640px){
  .adc2 .bdoc{padding-bottom:56px;font-size:15.5px}
  .adc2 .bdoc .bdoc-shell{padding:22px 16px 0}
  .adc2 .bdoc .bdoc-hero-top{gap:10px}
  .adc2 .bdoc .bdoc-theme-label{display:none}
  .adc2 .bdoc .bdoc-meta .bdoc-theme{margin-left:0}
  .adc2 .bdoc h1{font-size:1.95rem}
  .adc2 .bdoc .bdoc-body{margin-top:34px}
  .adc2 .bdoc h2{font-size:1.4rem}
  .adc2 .bdoc .bdoc-video video{max-height:none}
  .adc2 .bdoc .bdoc-answer{padding-left:18px}
  .adc2 .bdoc .bdoc-body section:first-of-type > p:first-of-type::first-letter{font-size:2.7em}
}
@media print{
  .adc2 .bdoc{background:#fff;color:#111}
  .adc2 .bdoc .bdoc-aurora,.adc2 .bdoc-theme{display:none}
}
`;
