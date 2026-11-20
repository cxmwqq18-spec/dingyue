import type { V2Resolvers } from "./types";
import { RichText } from "./parts";

/**
 * Landing-style blog article. The body follows the owner-provided source page
 * (hero with console mock, input cards, generator cards, presenter cards,
 * pricing, audience chips, founder note, final CTA) while the site's own
 * header and footer stay in place. All styles are scoped to .blp so nothing
 * leaks into the theme.
 */

type LandingCta = { label: string; href: string; kind?: "primary" | "ghost" };

type LandingSection = { id?: string } & (
  | { kind: "inputs"; kicker: string; h2: string; lead?: string; items: { num: string; icon: string; title: string; text: string }[] }
  | { kind: "generators"; kicker: string; h2: string; lead?: string; items: { icon: string; title: string; text: string }[] }
  | { kind: "presenters"; kicker: string; h2: string; lead?: string; items: { badge: string; badgeClass: "b1" | "b2" | "b3"; title: string; text: string }[]; note?: string }
  | {
      kind: "pricing";
      kicker: string;
      h2: string;
      lead?: string;
      plans: { name: string; price: string; per?: string; credits: string; features: string[]; cta: string; href: string; popular?: boolean }[];
      credits: { label: string; value: string; unit?: string }[];
      note: string;
      fineprint: string;
    }
  | { kind: "audience"; kicker: string; h2: string; lead?: string; chips: string[]; tiles: { icon: string; title: string; text: string }[] }
  | { kind: "closing"; h2: string; paras: string[] });

type LandingData = {
  eyebrow: string;
  h1: string;
  h1Accent?: string;
  h1Suffix?: string;
  lead: string;
  ctas: LandingCta[];
  fineprint: string[];
  console: { url: string; style: string; steps: string[]; cost: string; ready: string };
  sections: LandingSection[];
  founder: { name: string; initials: string; role: string; paras: string[] };
  final: { h2: string; lead: string; ctas: LandingCta[] };
};

function Cta({ cta, r }: { cta: LandingCta; r: V2Resolvers }) {
  const className = cta.kind === "ghost" ? "blp-btn blp-btn-ghost" : "blp-btn blp-btn-primary";
  return (
    <a className={className} href={r.href(cta.href)}>
      {cta.label}
    </a>
  );
}

function SectionBody({ section, r }: { section: LandingSection; r: V2Resolvers }) {
  const kicker = "kicker" in section ? section.kicker : "";
  const head = (
    <div className="blp-sec-head">
      {kicker ? <div className="blp-kicker">{kicker}</div> : null}
      <h2>{section.h2}</h2>
      {"lead" in section && section.lead ? <p>{section.lead}</p> : null}
    </div>
  );
  if (section.kind === "inputs") {
    return (
      <>
        {head}
        <div className="blp-grid blp-g3">
          {section.items.map((item) => (
            <article className="blp-card" key={item.title}>
              <span className="blp-num">{item.num}</span>
              <div className="blp-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </>
    );
  }
  if (section.kind === "generators") {
    return (
      <>
        {head}
        <div className="blp-grid blp-g2">
          {section.items.map((item) => (
            <article className="blp-card" key={item.title}>
              <div className="blp-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </>
    );
  }
  if (section.kind === "presenters") {
    return (
      <>
        {head}
        <div className="blp-grid blp-g3">
          {section.items.map((item) => (
            <article className="blp-card blp-actor-card" key={item.title}>
              <span className={`blp-badge ${item.badgeClass === "b1" ? "blp-b1" : item.badgeClass === "b2" ? "blp-b2" : "blp-b3"}`}>{item.badge}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        {section.note ? <div className="blp-note">{section.note}</div> : null}
      </>
    );
  }
  if (section.kind === "pricing") {
    return (
      <>
        {head}
        <div className="blp-price-grid">
          {section.plans.map((plan) => (
            <article className={`blp-plan${plan.popular ? " blp-pop" : ""}`} key={plan.name}>
              <div className="blp-plan-name">{plan.name}</div>
              <div className="blp-price">
                {plan.price}
                {plan.per ? <small>{plan.per}</small> : null}
              </div>
              <div className="blp-credits">{plan.credits}</div>
              <ul>
                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              <a className="blp-btn blp-btn-ghost" href={r.href(plan.href)}>{plan.cta}</a>
            </article>
          ))}
        </div>
        <div className="blp-credits-box">
          {section.credits.map((item) => (
            <div className="blp-credit-item" key={item.label}>
              <span>{item.label}</span>
              <b>{item.value}{item.unit ? <em>{item.unit}</em> : null}</b>
            </div>
          ))}
        </div>
        <div className="blp-note">{section.note}</div>
        <p className="blp-fineprint" style={{ marginTop: 18 }}>{section.fineprint}</p>
      </>
    );
  }
  if (section.kind === "audience") {
    return (
      <>
        {head}
        <div className="blp-chips">
          {section.chips.map((chip) => <span className="blp-chip" key={chip}>{chip}</span>)}
        </div>
        <div className="blp-grid blp-g3" style={{ marginTop: 26 }}>
          {section.tiles.map((tile) => (
            <article className="blp-card" key={tile.title}>
              <div className="blp-icon">{tile.icon}</div>
              <h3>{tile.title}</h3>
              <p>{tile.text}</p>
            </article>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      {head}
      {section.paras.map((para) => <p className="blp-prose" key={para}><RichText r={r} text={para} /></p>)}
    </>
  );
}

export function BlogLandingPage({ data, r }: { data: LandingData; r: V2Resolvers }) {
  return (
    <div className="blp">
      <style dangerouslySetInnerHTML={{ __html: BLP_CSS }} />
      <div aria-hidden="true" className="blp-glow" />
      <header className="blp-hero">
        <div className="blp-container">
          <div className="blp-hero-grid">
            <div>
              <span className="blp-eyebrow"><i className="blp-dot" />{data.eyebrow}</span>
              <h1>
                {data.h1}
                {data.h1Accent ? <> <span className="blp-grad">{data.h1Accent}</span></> : null}
                {data.h1Suffix ?? ""}
              </h1>
              <p className="blp-lead"><RichText r={r} text={data.lead} /></p>
              <div className="blp-cta-row">
                {data.ctas.map((cta) => <Cta cta={cta} key={cta.label} r={r} />)}
              </div>
              <div className="blp-fineprint">
                {data.fineprint.map((item) => <span key={item}><b className="blp-check">✓</b>{item}</span>)}
              </div>
            </div>
            <div className="blp-console">
              <div className="blp-console-top">
                <span>{data.console.style ? "New project" : "New project"}</span>
                <span className="blp-dots"><i /><i /><i /></span>
              </div>
              <div className="blp-field">
                <span className="blp-tag">URL</span>
                <span className="blp-url">{data.console.url}</span>
              </div>
              <div className="blp-field">
                <span className="blp-tag">STYLE</span>
                <span className="blp-url">{data.console.style}</span>
              </div>
              <button className="blp-gen" type="button">Generate video ad</button>
              <div className="blp-steps">
                {data.console.steps.map((step) => <div className="blp-step" key={step}><b>✓</b>{step}<span className="blp-bar" /></div>)}
              </div>
              <div className="blp-console-foot">
                <span>{data.console.cost}</span>
                <span className="blp-pill">{data.console.ready}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {data.sections.map((section) => (
        <section className="blp-sec" id={section.id} key={section.h2}>
          <div className="blp-container">
            <SectionBody r={r} section={section} />
          </div>
        </section>
      ))}

      <section className="blp-sec">
        <div className="blp-container">
          <div className="blp-founder">
            <div className="blp-avatar">{data.founder.initials}</div>
            <div>
              <h3>{data.founder.name}</h3>
              <div className="blp-role">{data.founder.role}</div>
              {data.founder.paras.map((para) => <p key={para}><RichText r={r} text={para} /></p>)}
            </div>
          </div>
        </div>
      </section>

      <section className="blp-final">
        <div className="blp-container">
          <h2>{data.final.h2}</h2>
          <p>{data.final.lead}</p>
          <div className="blp-cta-row" style={{ justifyContent: "center" }}>
            {data.final.ctas.map((cta) => <Cta cta={cta} key={cta.label} r={r} />)}
          </div>
        </div>
      </section>
    </div>
  );
}

const BLP_CSS = `
.adc2 .blp{--blp-bg:#07070c;--blp-card:#11111b;--blp-card-2:#15151f;--blp-line:rgba(255,255,255,.09);--blp-txt:#ecebf5;--blp-muted:#9b9bb0;--blp-accent:#7c5cff;--blp-accent-2:#22d3c5;--blp-accent-3:#ff5c8a;--blp-radius:18px;--blp-max:1120px;position:relative;color:var(--blp-txt);line-height:1.65;-webkit-font-smoothing:antialiased}
.adc2 .blp *,.adc2 .blp *::before,.adc2 .blp *::after{box-sizing:border-box}
.adc2 .blp a{color:inherit;text-decoration:none}
.adc2 .blp img{max-width:100%;display:block}
.adc2 .blp .blp-glow{position:absolute;inset:0;pointer-events:none;z-index:0;background:radial-gradient(720px 480px at 12% -8%,rgba(124,92,255,.28),transparent 65%),radial-gradient(640px 420px at 92% 4%,rgba(34,211,197,.16),transparent 62%),radial-gradient(760px 520px at 50% 108%,rgba(255,92,138,.13),transparent 68%)}
.adc2 .blp .blp-glow::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(ellipse at 50% 0%,#000 20%,transparent 78%);-webkit-mask-image:radial-gradient(ellipse at 50% 0%,#000 20%,transparent 78%)}
.adc2 .blp .blp-container{position:relative;z-index:1;width:100%;max-width:var(--blp-max);margin:0 auto;padding:0 24px}
.adc2 .blp .blp-hero{padding:86px 0 72px;position:relative}
.adc2 .blp .blp-hero-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:56px;align-items:center;position:relative;z-index:1}
@media (max-width:940px){.adc2 .blp .blp-hero-grid{grid-template-columns:1fr;gap:44px}.adc2 .blp .blp-hero{padding:56px 0 48px}}
.adc2 .blp .blp-eyebrow{display:inline-flex;align-items:center;gap:9px;padding:6px 14px 6px 8px;border:1px solid rgba(124,92,255,.38);background:rgba(124,92,255,.11);border-radius:999px;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#cfc3ff;margin-bottom:24px}
.adc2 .blp .blp-dot{width:7px;height:7px;border-radius:50%;background:var(--blp-accent-2);box-shadow:0 0 0 4px rgba(34,211,197,.18);animation:blp-pulse 2.2s infinite;display:inline-block}
@keyframes blp-pulse{0%,100%{box-shadow:0 0 0 4px rgba(34,211,197,.18)}50%{box-shadow:0 0 0 8px rgba(34,211,197,.04)}}
.adc2 .blp h1{font-size:clamp(34px,4.6vw,58px);line-height:1.06;letter-spacing:-.032em;font-weight:850;margin:0 0 22px;color:var(--blp-txt)}
.adc2 .blp .blp-grad{background:linear-gradient(100deg,#a58bff 0%,#ff7ba6 46%,#3fe0d0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.adc2 .blp .blp-lead{font-size:17.5px;color:#b6b6c9;max-width:560px;margin:0 0 32px}
.adc2 .blp .blp-cta-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:20px}
.adc2 .blp .blp-btn{display:inline-flex;align-items:center;gap:9px;padding:14px 26px;border-radius:12px;font-weight:750;font-size:15.5px;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
.adc2 .blp .blp-btn-primary{background:linear-gradient(135deg,var(--blp-accent),#9b7bff);color:#fff;box-shadow:0 14px 38px rgba(124,92,255,.42)}
.adc2 .blp .blp-btn-primary:hover{transform:translateY(-2px);box-shadow:0 20px 46px rgba(124,92,255,.55)}
.adc2 .blp .blp-btn-ghost{background:rgba(255,255,255,.05);border:1px solid var(--blp-line);color:var(--blp-txt)}
.adc2 .blp .blp-btn-ghost:hover{background:rgba(255,255,255,.09);transform:translateY(-2px)}
.adc2 .blp .blp-fineprint{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13.5px;color:var(--blp-muted)}
.adc2 .blp .blp-fineprint span{display:inline-flex;align-items:center;gap:7px}
.adc2 .blp .blp-check{color:var(--blp-accent-2);font-weight:900}
.adc2 .blp .blp-console{background:linear-gradient(180deg,rgba(23,23,35,.95),rgba(13,13,21,.95));border:1px solid var(--blp-line);border-radius:22px;padding:22px;box-shadow:0 34px 90px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.06);position:relative}
.adc2 .blp .blp-console::before{content:"";position:absolute;inset:-1px;border-radius:23px;padding:1px;background:linear-gradient(140deg,rgba(124,92,255,.65),transparent 40%,transparent 60%,rgba(34,211,197,.5));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.adc2 .blp .blp-console-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;font-size:12px;color:var(--blp-muted);letter-spacing:.08em;text-transform:uppercase;font-weight:700}
.adc2 .blp .blp-dots{display:flex;gap:6px}
.adc2 .blp .blp-dots i{width:9px;height:9px;border-radius:50%;background:#2c2c3c;display:block}
.adc2 .blp .blp-field{background:rgba(255,255,255,.04);border:1px solid var(--blp-line);border-radius:12px;padding:13px 15px;font-size:13.5px;color:#c9c9dc;display:flex;align-items:center;gap:10px;margin-bottom:12px;overflow:hidden}
.adc2 .blp .blp-field .blp-tag{font-size:10.5px;font-weight:800;letter-spacing:.07em;padding:3px 8px;border-radius:6px;background:rgba(124,92,255,.2);color:#c3b3ff;flex-shrink:0}
.adc2 .blp .blp-field .blp-url{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:#9d9db4}
.adc2 .blp .blp-gen{width:100%;margin:16px 0 18px;padding:13px;border-radius:11px;border:0;background:linear-gradient(135deg,var(--blp-accent),#9b7bff);color:#fff;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 12px 30px rgba(124,92,255,.36)}
.adc2 .blp .blp-steps{display:grid;gap:9px;margin-bottom:18px}
.adc2 .blp .blp-step{display:flex;align-items:center;gap:10px;font-size:13px;color:#bfbfd2}
.adc2 .blp .blp-step b{width:18px;height:18px;border-radius:50%;background:rgba(34,211,197,.14);color:var(--blp-accent-2);display:grid;place-items:center;font-size:11px;flex-shrink:0}
.adc2 .blp .blp-step .blp-bar{flex:1;height:3px;border-radius:99px;background:linear-gradient(90deg,var(--blp-accent-2),rgba(34,211,197,.15));margin-left:4px}
.adc2 .blp .blp-console-foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--blp-line);padding-top:14px;font-size:12px;color:var(--blp-muted)}
.adc2 .blp .blp-pill{padding:4px 10px;border-radius:99px;background:rgba(34,211,197,.13);color:#63e8da;font-weight:750;font-size:11.5px}
.adc2 .blp .blp-sec{padding:82px 0;position:relative}
.adc2 .blp .blp-sec-head{max-width:720px;margin-bottom:48px}
.adc2 .blp .blp-kicker{font-size:12.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9d86ff;margin-bottom:14px}
.adc2 .blp h2{font-size:clamp(26px,3.2vw,40px);line-height:1.14;letter-spacing:-.028em;font-weight:820;margin:0 0 16px;color:var(--blp-txt)}
.adc2 .blp .blp-sec-head p{color:var(--blp-muted);font-size:16px;margin:0}
.adc2 .blp .blp-grid{display:grid;gap:20px}
.adc2 .blp .blp-g3{grid-template-columns:repeat(3,1fr)}
.adc2 .blp .blp-g2{grid-template-columns:repeat(2,1fr)}
@media (max-width:900px){.adc2 .blp .blp-g3,.adc2 .blp .blp-g2{grid-template-columns:1fr}}
.adc2 .blp .blp-card{background:linear-gradient(180deg,rgba(22,22,33,.9),rgba(14,14,22,.9));border:1px solid var(--blp-line);border-radius:var(--blp-radius);padding:28px;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;position:relative;overflow:hidden}
.adc2 .blp .blp-card:hover{transform:translateY(-4px);border-color:rgba(124,92,255,.42);box-shadow:0 24px 60px rgba(0,0,0,.45)}
.adc2 .blp .blp-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:19px;margin-bottom:18px;background:rgba(124,92,255,.15);border:1px solid rgba(124,92,255,.3)}
.adc2 .blp .blp-card h3{font-size:17.5px;font-weight:780;margin:0 0 10px;letter-spacing:-.015em;color:var(--blp-txt)}
.adc2 .blp .blp-card p{color:var(--blp-muted);font-size:14.6px;margin:0}
.adc2 .blp .blp-num{position:absolute;top:20px;right:24px;font-size:12px;font-weight:800;color:#3a3a4d;font-family:ui-monospace,Menlo,monospace}
.adc2 .blp .blp-actor-card{display:flex;flex-direction:column}
.adc2 .blp .blp-badge{align-self:flex-start;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:5px 11px;border-radius:99px;margin-bottom:16px}
.adc2 .blp .blp-b1{background:rgba(124,92,255,.16);color:#c1aeff;border:1px solid rgba(124,92,255,.35)}
.adc2 .blp .blp-b2{background:rgba(255,92,138,.14);color:#ff9db7;border:1px solid rgba(255,92,138,.32)}
.adc2 .blp .blp-b3{background:rgba(34,211,197,.14);color:#6fe9dc;border:1px solid rgba(34,211,197,.32)}
.adc2 .blp .blp-note{margin-top:34px;border-left:3px solid var(--blp-accent);background:rgba(124,92,255,.07);border-radius:0 14px 14px 0;padding:20px 24px;color:#c2c2d6;font-size:15px}
.adc2 .blp .blp-price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch}
@media (max-width:900px){.adc2 .blp .blp-price-grid{grid-template-columns:1fr}}
.adc2 .blp .blp-plan{background:linear-gradient(180deg,rgba(22,22,33,.92),rgba(13,13,21,.92));border:1px solid var(--blp-line);border-radius:20px;padding:30px 26px;display:flex;flex-direction:column;position:relative}
.adc2 .blp .blp-plan.blp-pop{border-color:rgba(124,92,255,.55);background:linear-gradient(180deg,rgba(38,30,68,.95),rgba(15,13,26,.95));box-shadow:0 0 0 1px rgba(124,92,255,.18),0 26px 70px rgba(124,92,255,.18)}
.adc2 .blp .blp-plan.blp-pop::after{content:"MOST POPULAR";position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,var(--blp-accent),#a78bff);color:#fff;font-size:10.5px;font-weight:850;letter-spacing:.1em;padding:5px 14px;border-radius:99px;white-space:nowrap}
.adc2 .blp .blp-plan-name{font-size:14px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a8a8c0;margin-bottom:14px}
.adc2 .blp .blp-price{font-size:42px;font-weight:860;letter-spacing:-.04em;line-height:1;color:var(--blp-txt)}
.adc2 .blp .blp-price small{font-size:15px;font-weight:650;color:var(--blp-muted);letter-spacing:0}
.adc2 .blp .blp-credits{margin:14px 0 22px;font-size:14px;color:#b9b9cd;padding-bottom:22px;border-bottom:1px solid var(--blp-line)}
.adc2 .blp .blp-plan ul{list-style:none;padding:0;margin:0 0 26px;display:grid;gap:11px;font-size:14px;color:#b0b0c4}
.adc2 .blp .blp-plan ul li{display:flex;gap:9px;align-items:flex-start}
.adc2 .blp .blp-plan ul li::before{content:"✓";color:var(--blp-accent-2);font-weight:900;flex-shrink:0}
.adc2 .blp .blp-plan .blp-btn{width:100%;justify-content:center;margin-top:auto}
.adc2 .blp .blp-credits-box{margin-top:26px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media (max-width:760px){.adc2 .blp .blp-credits-box{grid-template-columns:1fr}}
.adc2 .blp .blp-credit-item{background:rgba(255,255,255,.035);border:1px solid var(--blp-line);border-radius:14px;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px}
.adc2 .blp .blp-credit-item span{font-size:14px;color:#b3b3c8}
.adc2 .blp .blp-credit-item b{font-size:19px;font-weight:850;letter-spacing:-.02em;color:#fff;white-space:nowrap}
.adc2 .blp .blp-credit-item b em{font-style:normal;font-size:12px;font-weight:700;color:var(--blp-muted);margin-left:3px}
.adc2 .blp .blp-chips{display:flex;flex-wrap:wrap;gap:11px;margin-top:8px}
.adc2 .blp .blp-chip{padding:10px 18px;border-radius:99px;background:rgba(255,255,255,.045);border:1px solid var(--blp-line);font-size:14px;font-weight:600;color:#c5c5d8;transition:.2s ease}
.adc2 .blp .blp-chip:hover{border-color:rgba(124,92,255,.5);color:#fff;background:rgba(124,92,255,.12)}
.adc2 .blp .blp-founder{background:linear-gradient(140deg,rgba(38,30,68,.75),rgba(14,14,22,.9));border:1px solid rgba(124,92,255,.28);border-radius:24px;padding:42px;display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:start}
@media (max-width:720px){.adc2 .blp .blp-founder{grid-template-columns:1fr;padding:30px}}
.adc2 .blp .blp-avatar{width:66px;height:66px;border-radius:20px;background:linear-gradient(135deg,var(--blp-accent),var(--blp-accent-3));display:grid;place-items:center;font-size:23px;font-weight:900;color:#fff;box-shadow:0 12px 34px rgba(124,92,255,.42)}
.adc2 .blp .blp-founder h3{margin:0 0 4px;font-size:19px;font-weight:820;color:var(--blp-txt)}
.adc2 .blp .blp-role{font-size:13px;color:#9d86ff;font-weight:750;letter-spacing:.05em;text-transform:uppercase;margin-bottom:16px}
.adc2 .blp .blp-founder p{color:#c0c0d4;font-size:15.5px;margin:0 0 14px}
.adc2 .blp .blp-final{text-align:center;padding:76px 0 96px}
.adc2 .blp .blp-final h2{margin-bottom:18px}
.adc2 .blp .blp-final p{color:var(--blp-muted);max-width:600px;margin:0 auto 34px;font-size:16.5px}
.adc2 .blp .blp-prose{color:#b6b6c9;font-size:16px;line-height:1.75;max-width:760px}
`;
