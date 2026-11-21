import type { V2Resolvers } from "./types";
import { RichText } from "./parts";

/**
 * Engineering-notes blog article. The body follows the owner-provided source
 * page (kicker, gradient headline, byline, pipeline steps, numbered sections
 * with h3 subsections, callout, blockquote, job-lifecycle code block, FAQ and
 * an author card) while the site's own header and footer stay in place. All
 * styles are scoped to .bep so nothing leaks into the theme.
 */

type EngineeringSection = {
  num: string;
  h2: string;
  paras?: string[];
  subsections?: { h3: string; paras: string[] }[];
  callout?: string;
  code?: string;
  afterCode?: string[];
  blockquote?: string;
};

type EngineeringCta = { label: string; href: string; kind?: "primary" | "ghost" };

export type EngineeringData = {
  kicker: string;
  h1: string;
  h1Accent?: string;
  cover: { alt: string; src: string; width: number; height: number };
  byline: { initials: string; name: string; role: string; note: string };
  lead: string;
  pipeline: { num: string; title: string; text: string }[];
  sections: EngineeringSection[];
  faq: { title: string; items: { q: string; a: string }[] };
  author: { initials: string; name: string; role: string; paras: string[] };
  final?: { h2: string; lead: string; ctas: EngineeringCta[] };
};

export function BlogEngineeringPage({ data, r }: { data: EngineeringData; r: V2Resolvers }) {
  return (
    <div className="bep">
      <style dangerouslySetInnerHTML={{ __html: BEP_CSS }} />
      <article id="top">
        <div className="bep-kicker"><span className="bep-kicker-dot" />{data.kicker}</div>

        <h1>
          {data.h1}
          {data.h1Accent ? <> <span className="bep-grad">{data.h1Accent}</span></> : null}
        </h1>

        <div className="bep-byline">
          <div className="bep-avatar">{data.byline.initials}</div>
          <div>
            <div className="bep-who">{data.byline.name}</div>
            <div className="bep-role">{data.byline.role}</div>
          </div>
          <div className="bep-date">{data.byline.note}</div>
        </div>

        <figure className="bep-cover">
          <img
            alt={data.cover.alt}
            decoding="async"
            height={data.cover.height}
            loading="eager"
            src={r.asset(data.cover.src)}
            width={data.cover.width}
          />
        </figure>

        <p className="bep-lead"><RichText r={r} text={data.lead} /></p>

        <div className="bep-pipeline">
          {data.pipeline.map((step) => (
            <div className="bep-pipe-step" key={step.num}>
              <span className="bep-step-n">{step.num}</span>
              <div>
                <b>{step.title}</b>
                <span>{step.text}</span>
              </div>
            </div>
          ))}
        </div>

        {data.sections.map((section) => (
          <section key={section.num}>
            <h2><span className="bep-num">{section.num}</span>{section.h2}</h2>
            {(section.paras ?? []).map((para) => <p key={para.slice(0, 48)}><RichText r={r} text={para} /></p>)}
            {(section.subsections ?? []).map((sub) => (
              <div key={sub.h3}>
                <h3>{sub.h3}</h3>
                {sub.paras.map((para) => <p key={para.slice(0, 48)}><RichText r={r} text={para} /></p>)}
              </div>
            ))}
            {section.callout ? (
              <div className="bep-callout"><p><RichText r={r} text={section.callout} /></p></div>
            ) : null}
            {section.code ? <pre><code>{section.code}</code></pre> : null}
            {(section.afterCode ?? []).map((para) => <p key={para.slice(0, 48)}><RichText r={r} text={para} /></p>)}
            {section.blockquote ? <blockquote><p><RichText r={r} text={section.blockquote} /></p></blockquote> : null}
          </section>
        ))}

        <div className="bep-faq">
          <h2>{data.faq.title}</h2>
          {data.faq.items.map((item) => (
            <div className="bep-faq-item" key={item.q}>
              <h3>{item.q}</h3>
              <p><RichText r={r} text={item.a} /></p>
            </div>
          ))}
        </div>

        <div className="bep-author-card">
          <div className="bep-avatar bep-avatar-lg">{data.author.initials}</div>
          <div>
            <h4>{data.author.name}</h4>
            <div className="bep-author-role">{data.author.role}</div>
            {data.author.paras.map((para) => <p key={para.slice(0, 48)}><RichText r={r} text={para} /></p>)}
          </div>
        </div>
      </article>

      {data.final ? (
        <div className="bep-final">
          <h2>{data.final.h2}</h2>
          <p><RichText r={r} text={data.final.lead} /></p>
          <div className="bep-cta-row">
            {data.final.ctas.map((cta) => (
              <a className={cta.kind === "ghost" ? "bep-btn bep-btn-ghost" : "bep-btn bep-btn-primary"} href={r.href(cta.href)} key={cta.label}>
                {cta.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const BEP_CSS = `
.adc2 .bep{--bep-max:780px;--bep-line:rgba(255,255,255,.10);--bep-txt:#ecebf5;--bep-muted:#a2a2b8;--bep-accent:#7c5cff;--bep-accent2:#22d3c5;--bep-accent3:#ff5c8a;position:relative;color:var(--bep-txt);-webkit-font-smoothing:antialiased}
.adc2 .bep *,.adc2 .bep *::before,.adc2 .bep *::after{box-sizing:border-box}
.adc2 .bep article{max-width:var(--bep-max);margin:0 auto;padding:56px 24px 24px}
.adc2 .bep a{color:#b9a8ff;text-decoration:none}
.adc2 .bep a:hover{text-decoration:underline}
.adc2 .bep .bep-kicker{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9ff0e6;background:rgba(34,211,197,.10);border:1px solid rgba(34,211,197,.32);padding:6px 13px;border-radius:99px;margin-bottom:24px}
.adc2 .bep .bep-kicker-dot{width:7px;height:7px;border-radius:50%;background:var(--bep-accent2);box-shadow:0 0 0 4px rgba(34,211,197,.16)}
.adc2 .bep h1{font-size:clamp(30px,5vw,44px);line-height:1.12;letter-spacing:-.032em;font-weight:800;margin:0 0 22px;color:#fff}
.adc2 .bep .bep-grad{background:linear-gradient(100deg,#a58bff 0%,#ff7ba6 48%,#3fe0d0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.adc2 .bep .bep-byline{display:flex;align-items:center;gap:14px;padding:18px 0 26px;border-bottom:1px solid var(--bep-line);margin-bottom:30px}
.adc2 .bep .bep-avatar{width:50px;height:50px;border-radius:15px;background:linear-gradient(135deg,var(--bep-accent),var(--bep-accent3));display:grid;place-items:center;font-size:16px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 10px 28px rgba(124,92,255,.4)}
.adc2 .bep .bep-byline .bep-who{font-size:14.5px;font-weight:700;color:var(--bep-txt)}
.adc2 .bep .bep-byline .bep-role{font-size:12.5px;color:var(--bep-muted);letter-spacing:.03em}
.adc2 .bep .bep-byline .bep-date{margin-left:auto;font-size:12.5px;color:#7e7e96;white-space:nowrap}
@media (max-width:560px){.adc2 .bep .bep-byline{flex-wrap:wrap}.adc2 .bep .bep-byline .bep-date{margin-left:0;width:100%}}
.adc2 .bep .bep-cover{margin:0 0 34px;display:flex;justify-content:center}
.adc2 .bep .bep-cover img{width:min(360px,100%);height:auto;border-radius:16px;border:1px solid var(--bep-line);box-shadow:0 18px 50px rgba(0,0,0,.45)}
.adc2 .bep .bep-lead{font-size:19px;color:#cfcfe0;line-height:1.7;margin:0 0 34px}
.adc2 .bep .bep-lead strong{color:#fff}
.adc2 .bep p{margin:0 0 22px;color:#c9c9db;font-size:16.8px}
.adc2 .bep h2{font-size:clamp(22px,3.2vw,29px);line-height:1.22;letter-spacing:-.025em;font-weight:800;margin:56px 0 18px;color:#fff;display:flex;align-items:baseline;gap:12px}
.adc2 .bep h2 .bep-num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.62em;color:var(--bep-accent2);font-weight:800;letter-spacing:0;flex-shrink:0}
.adc2 .bep h3{font-size:18.5px;font-weight:750;letter-spacing:-.015em;margin:34px 0 12px;color:#fff}
.adc2 .bep strong{color:#fff}
.adc2 .bep code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;background:rgba(255,255,255,.07);border:1px solid var(--bep-line);padding:2px 6px;border-radius:6px;color:#d7d0ff}
.adc2 .bep pre{background:#0b0b13;border:1px solid var(--bep-line);border-radius:14px;padding:20px 22px;overflow-x:auto;margin:0 0 26px}
.adc2 .bep pre code{background:none;border:0;padding:0;font-size:13.5px;line-height:1.7;color:#c9c9e6}
.adc2 .bep blockquote{margin:30px 0;padding:22px 26px;border-left:3px solid var(--bep-accent);background:rgba(124,92,255,.08);border-radius:0 14px 14px 0;color:#cfcfe3;font-size:17px}
.adc2 .bep blockquote p:last-child{margin-bottom:0}
.adc2 .bep .bep-callout{margin:34px 0;padding:24px 26px;border:1px solid rgba(34,211,197,.28);background:rgba(34,211,197,.07);border-radius:16px}
.adc2 .bep .bep-callout p{margin:0;color:#cfefe9;font-size:16.3px}
.adc2 .bep .bep-pipeline{display:grid;gap:12px;margin:28px 0 36px}
.adc2 .bep .bep-pipe-step{display:flex;gap:16px;align-items:flex-start;background:rgba(255,255,255,.035);border:1px solid var(--bep-line);border-radius:14px;padding:18px 20px}
.adc2 .bep .bep-step-n{width:28px;height:28px;border-radius:9px;flex-shrink:0;background:rgba(124,92,255,.18);border:1px solid rgba(124,92,255,.35);display:grid;place-items:center;font-size:12.5px;font-weight:800;color:#c3b3ff;font-family:ui-monospace,Menlo,monospace}
.adc2 .bep .bep-pipe-step b{display:block;font-size:15px;color:#fff;margin-bottom:3px}
.adc2 .bep .bep-pipe-step span{font-size:14.2px;color:#b3b3c8;line-height:1.6}
.adc2 .bep .bep-faq{margin-top:56px}
.adc2 .bep .bep-faq h2{margin-bottom:22px}
.adc2 .bep .bep-faq-item{border:1px solid var(--bep-line);border-radius:14px;padding:20px 22px;margin-bottom:12px;background:rgba(255,255,255,.03)}
.adc2 .bep .bep-faq-item h3{margin:0 0 8px;font-size:16px;font-weight:750}
.adc2 .bep .bep-faq-item p{margin:0;font-size:15px;color:#bdbdd2}
.adc2 .bep .bep-author-card{margin:64px 0 0;padding:30px;border:1px solid rgba(124,92,255,.3);background:linear-gradient(140deg,rgba(38,30,68,.7),rgba(14,14,22,.9));border-radius:20px;display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:start}
@media (max-width:600px){.adc2 .bep .bep-author-card{grid-template-columns:1fr;padding:24px}}
.adc2 .bep .bep-avatar-lg{width:58px;height:58px;border-radius:17px;font-size:18px}
.adc2 .bep .bep-author-card h4{margin:0 0 4px;font-size:16.5px;font-weight:800;color:#fff}
.adc2 .bep .bep-author-role{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:#9d86ff;font-weight:700;margin-bottom:10px}
.adc2 .bep .bep-author-card p{margin:0;font-size:14.6px;color:#bdbdd2}
.adc2 .bep .bep-final{text-align:center;max-width:var(--bep-max);margin:0 auto;padding:26px 24px 96px}
.adc2 .bep .bep-final h2{justify-content:center;margin:0 0 18px}
.adc2 .bep .bep-final p{color:var(--bep-muted);max-width:600px;margin:0 auto 30px;font-size:16.5px}
.adc2 .bep .bep-cta-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:center}
.adc2 .bep .bep-btn{display:inline-flex;align-items:center;gap:9px;padding:14px 26px;border-radius:12px;font-weight:700;font-size:15.5px;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
.adc2 .bep a.bep-btn:hover{text-decoration:none;transform:translateY(-2px)}
.adc2 .bep .bep-btn-primary{background:linear-gradient(135deg,var(--bep-accent),#9b7bff);color:#fff;box-shadow:0 14px 38px rgba(124,92,255,.42)}
.adc2 .bep .bep-btn-primary:hover{box-shadow:0 20px 46px rgba(124,92,255,.55)}
.adc2 .bep .bep-btn-ghost{background:rgba(255,255,255,.05);border:1px solid var(--bep-line);color:var(--bep-txt)}
.adc2 .bep .bep-btn-ghost:hover{background:rgba(255,255,255,.09)}
`;
