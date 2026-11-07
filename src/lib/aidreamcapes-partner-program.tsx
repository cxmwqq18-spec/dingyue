import Link from "next/link";
import { ArrowRight, Captions, Check, Clapperboard, FileText, Handshake, Image as ImageIcon, LineChart, Link as LinkIcon, Repeat, Send, Type, UserRound, Video, Wrench } from "lucide-react";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";
import { loadAidreamcapesChrome } from "@/lib/aidreamcapes-workspace/media-detail.server";
import { aidreamcapesV2Company } from "@/components/storefront/aidreamcapes-v2/company";
import { AidreamcapesV2Footer } from "@/components/storefront/aidreamcapes-v2/shell";
import { aidreamcapesV2ThemeCssHref } from "@/components/storefront/aidreamcapes-v2/styles";
import type { AidreamcapesV2Navigation } from "@/lib/types";
import { notFound } from "next/navigation";

/** The public partner-program page: the storefront-coherent landing page whose
 * application form feeds the admin 推广合作伙伴 queue (site-scoped). The form
 * posts as plain multipart so the no-JS flow works: the API answers with a 303
 * back to this page carrying ?partner=success. */

export async function AidreamcapesPartnerProgramPage({ success }: { success: boolean }) {
  const chrome = await loadAidreamcapesChrome();
  if (!chrome) notFound();
  const r = { asset: (value: string) => value, href: (value: string) => value, copy: {} } as const;
  const company = aidreamcapesV2Company(chrome.identity);
  return (
    <div className="prp">
      <link rel="stylesheet" href={aidreamcapesV2ThemeCssHref()} precedence="high" />
      <style>{PRP_CSS}</style>
      <header className="prp-header">
        <div className="prp-wrap prp-header-in">
          <Link className="prp-logo" href="/">
            <Clapperboard aria-hidden="true" />
            <span>AIVideosUGC<small>PARTNER PROGRAM</small></span>
          </Link>
          <Link className="prp-toplink" href="/">Back to aivideosugc.com</Link>
        </div>
      </header>

      <div className="prp-glow">
        <section className="prp-wrap prp-hero">
          <span className="prp-eyebrow"><Handshake aria-hidden="true" />Partner Program</span>
          <h1>Get paid every time your audience hits <span className="prp-grad-text">generate</span>.</h1>
          <p className="prp-hero-sub">Share AIVideosUGC with creators, brands and agencies — you earn <b>30% recurring commission</b> on every subscription your referrals open, for their first 12 months. We handle onboarding, support and the AI pipeline.</p>
          <div className="prp-cta">
            <a className="prp-btn-primary" href="#apply"><Send aria-hidden="true" />Apply in 3 minutes</a>
            <a className="prp-btn-ghost" href="#faq"><FileText aria-hidden="true" />Read the terms</a>
          </div>
          <p className="prp-metaline">30% recurring share &nbsp;·&nbsp; 90-day cookie &nbsp;·&nbsp; monthly payouts &nbsp;·&nbsp; $50 minimum &nbsp;·&nbsp; reviewed within 48h</p>
        </section>

        <section className="prp-wrap">
          <div className="prp-sec-head">
            <span className="prp-kicker">Why partners stick around</span>
            <h2>Built for people whose audience already asks &ldquo;how did you make this?&rdquo;</h2>
            <p className="prp-sec-lead">AIVideosUGC turns product photos and links into UGC-style video ads. Your referrals get a tool they keep using — and you keep earning while they do.</p>
          </div>
          <div className="prp-cards">
            <article className="prp-card"><Repeat aria-hidden="true" /><h3>Recurring, not one-off</h3><p>Every renewal your referrals pay earns you commission again, for their first 12 months. One good tutorial can pay out for a year.</p></article>
            <article className="prp-card"><Wrench aria-hidden="true" /><h3>We handle the hard part</h3><p>Onboarding, render pipeline, support tickets and billing all stay on our side. Your only job is the recommendation.</p></article>
            <article className="prp-card"><LineChart aria-hidden="true" /><h3>Transparent dashboard</h3><p>Clicks, signups, conversions and payouts in one place — with a unique channel link per campaign you run.</p></article>
          </div>
        </section>

        <section className="prp-wrap">
          <div className="prp-sec-head">
            <span className="prp-kicker">How it works</span>
            <h2>From application to first payout in four steps</h2>
          </div>
          <div className="prp-steps">
            <div className="prp-step"><em>01</em><h3>Apply</h3><p>Tell us who you reach and where you publish. We review every application manually within 48 hours.</p></div>
            <div className="prp-step"><em>02</em><h3>Get your channel</h3><p>Approved partners receive a tracking link, a dashboard and a Pro demo workspace for content creation.</p></div>
            <div className="prp-step"><em>03</em><h3>Publish</h3><p>Tutorials, comparisons, behind-the-scenes — any format that shows what the tool does. Use our swipe copy or your own.</p></div>
            <div className="prp-step"><em>04</em><h3>Get paid</h3><p>Commissions settle monthly. Payouts go out on the 5th via Stripe or PayPal once you pass $50.</p></div>
          </div>
        </section>

        <section className="prp-wrap">
          <div className="prp-kit">
            <div>
              <span className="prp-kicker">Partner kit</span>
              <h2>You never promote empty-handed</h2>
              <p className="prp-sec-lead">Approved partners get everything that makes the first post easy — and the first commission fast.</p>
            </div>
            <ul>
              <li><Check aria-hidden="true" />Unique channel links per campaign and per product</li>
              <li><Check aria-hidden="true" />Swipe copy in English, Spanish and Chinese</li>
              <li><Check aria-hidden="true" />Licensed demo clips and before/after stills</li>
              <li><Check aria-hidden="true" />A free Pro workspace to produce your own demos</li>
              <li><Check aria-hidden="true" />Real-time click and conversion dashboard</li>
              <li><Check aria-hidden="true" />Direct line to the partnership team</li>
              <li><Check aria-hidden="true" />One link covers Text to Video, AI Video, AI Image, URL to Video, AI Actors and Subtitle Studio</li>
            </ul>
          </div>
        </section>

        <section className="prp-wrap" id="faq">
          <div className="prp-faq-grid">
            <div className="prp-sec-head">
              <span className="prp-kicker">FAQ</span>
              <h2>The questions we get before approval</h2>
              <p className="prp-sec-lead">Anything else — the application form has a message field, and a human reads every one.</p>
            </div>
            <div>
              <details open><summary>Who gets approved?</summary><p>Creators, agencies and community owners whose audience makes or markets video content: e-commerce sellers, TikTok/Reels educators, dropshipping communities, marketing newsletters and agencies. There is no minimum follower count — we care about fit and activity.</p></details>
              <details><summary>How and when do I get paid?</summary><p>Commissions settle monthly on the 5th for the previous calendar month, via Stripe or PayPal once your balance passes $50. The dashboard shows every conversion and its status.</p></details>
              <details><summary>How is my referral attributed?</summary><p>Your channel link sets a 90-day cookie. Any subscription opened within that window is attributed to you, including renewals for the first 12 months.</p></details>
              <details><summary>Can I run paid ads?</summary><p>Yes — paid, email and organic are all welcome. We only ask that you do not bid on our brand keywords or run misleading creatives; the terms spell out the details.</p></details>
              <details><summary>What happens after I submit the form?</summary><p>The application lands in our partnership queue. You will get an email within 48 hours — approved partners receive their dashboard invite, channel link and creative kit in the same email.</p></details>
            </div>
          </div>
        </section>

        <section className="prp-wrap" id="apply">
          <div className="prp-form-shell">
            <div className="prp-sec-head">
              <span className="prp-kicker">Apply</span>
              <h2>Tell us about your audience</h2>
              <p className="prp-sec-lead">Three minutes now, an answer within 48 hours. Approved partners get their links and creative kit in the approval email.</p>
            </div>
            {success ? (
              <div className="prp-form prp-success" role="status">
                <span className="prp-success-icon"><Check aria-hidden="true" /></span>
                <h3>Application received</h3>
                <p>Your application is in the partnership queue as <b>pending review</b>. A human reads every application — expect an answer within 48 hours at the email you provided.</p>
                <p className="prp-hint">Approved partners receive their dashboard invite, channel link and creative kit in the approval email.</p>
                <Link className="prp-btn-ghost" href="/">Back to aivideosugc.com</Link>
              </div>
            ) : (
              <form className="prp-form" action="/api/sites/site_aidreamcapes/partner-applications" method="post">
                <input type="text" name="website_url" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
                <div className="prp-form-grid">
                  <div className="prp-field"><label>Name <em>*</em></label><input name="name" placeholder="Your name" required /></div>
                  <div className="prp-field"><label>Email <em>*</em></label><input name="email" type="email" placeholder="you@channel.com" required /></div>
                  <div className="prp-field"><label>Company / brand</label><input name="company" placeholder="Optional" /></div>
                  <div className="prp-field"><label>Main channel link <em>*</em></label><input name="socialLinks" placeholder="tiktok.com/@you · youtube.com/@you" required /></div>
                  <div className="prp-field prp-full"><label>Who is your audience? <em>*</em></label><input name="audience" placeholder="e.g. 45k Shopify dropshippers, mostly US, 25–40" required /></div>
                  <div className="prp-field"><label>Publishing cadence</label><select name="cadence" defaultValue="Weekly"><option>2+ posts / week</option><option>Weekly</option><option>Bi-weekly</option><option>Monthly</option></select></div>
                  <div className="prp-field"><label>Where did you hear about us?</label><select name="source" defaultValue="Other"><option>X / Twitter</option><option>YouTube</option><option>TikTok</option><option>Newsletter</option><option>A friend / colleague</option><option>Other</option></select></div>
                  <div className="prp-field prp-full"><label>Campaign ideas</label><textarea name="campaignIdeas" placeholder="What would you publish first? Tutorials, comparisons, niche use cases…" /></div>
                  <div className="prp-field prp-full"><label>Anything else?</label><textarea name="message" style={{ minHeight: 72 }} placeholder="Questions, links to past partnerships, anything useful." /></div>
                </div>
                <button className="prp-btn-primary" type="submit"><Send aria-hidden="true" />Submit application</button>
                <p className="prp-hint">By submitting you agree to the partner terms. We review manually — no auto-approvals, no spam. Submitted applications land in our partnership queue and show as &ldquo;pending review&rdquo;.</p>
              </form>
            )}
          </div>
        </section>

        <div className="adc2">
          <AidreamcapesV2Footer articles={chrome.articles} articlesTitle={chrome.articlesTitle} company={company} navigation={chrome.navigation as AidreamcapesV2Navigation} r={r} />
        </div>
        <footer className="prp-wrap prp-footer">
          <span>© 2026 AIVideosUGC — AI UGC video ads from one product photo.</span>
          <span><Link href="/">aivideosugc.com</Link> · <Link href="/pricing">Pricing</Link> · <Link href="/#apply">Apply</Link></span>
        </footer>
      </div>
    </div>
  );
}

const PRP_CSS = `
.prp { --prp-ink: #f5f5f7; --prp-ink-2: #b8b8c2; --prp-ink-3: #8a8a96; --prp-line: rgba(255,255,255,.10); --prp-line-2: rgba(255,255,255,.18);
  --prp-card: #121214; --prp-grad: linear-gradient(90deg,#8b5cf6,#ec4899 55%,#3b82f6); --prp-mono: var(--font-mono, "IBM Plex Mono", ui-monospace, monospace);
  background: #050505; color: var(--prp-ink); font-family: inherit; line-height: 1.6; }
.prp *, .prp *::before, .prp *::after { box-sizing: border-box; }
.prp .prp-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
.prp a { color: inherit; text-decoration: none; }
.prp .prp-grad-text { background: var(--prp-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.prp .prp-glow { position: relative; overflow: hidden; }
.prp .prp-glow::before { content: ""; position: absolute; inset: -40% -20% auto; height: 620px; pointer-events: none;
  background: radial-gradient(46% 55% at 18% 20%, rgba(139,92,246,.20), transparent 70%), radial-gradient(40% 52% at 78% 12%, rgba(236,72,153,.14), transparent 70%), radial-gradient(45% 55% at 52% 78%, rgba(59,130,246,.12), transparent 70%); }
.prp .prp-header { position: sticky; top: 0; z-index: 20; background: rgba(5,5,5,.82); backdrop-filter: blur(14px); border-bottom: 1px solid var(--prp-line); }
.prp .prp-header-in { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.prp .prp-logo { display: flex; align-items: center; gap: 10px; font-weight: 600; letter-spacing: .02em; font-size: 15px; }
.prp .prp-logo svg { width: 18px; height: 18px; color: #ec4899; }
.prp .prp-logo small { display: block; font-size: 10px; letter-spacing: .22em; color: var(--prp-ink-3); font-weight: 500; }
.prp .prp-toplink { font-size: 13px; color: var(--prp-ink-2); border: 1px solid var(--prp-line); border-radius: 999px; padding: 7px 14px; transition: border-color .2s, color .2s; }
.prp .prp-toplink:hover { border-color: var(--prp-line-2); color: var(--prp-ink); }
.prp .prp-hero { padding: 64px 0 88px; border-top: 0; position: relative; }
.prp .prp-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: #c4b5fd; border: 1px solid rgba(139,92,246,.35); background: rgba(139,92,246,.10); border-radius: 999px; padding: 7px 14px; }
.prp .prp-eyebrow svg { width: 12px; height: 12px; }
.prp h1 { margin: 26px 0 0; font-size: clamp(38px, 5.4vw, 62px); line-height: 1.04; font-weight: 600; letter-spacing: -.03em; }
.prp .prp-hero-grid { display: grid; grid-template-columns: minmax(0,1.15fr) minmax(0,.85fr); gap: 56px; align-items: end; }
.prp .prp-hero-sub { margin: 22px 0 0; font-size: 17px; line-height: 1.75; color: var(--prp-ink-2); max-width: 640px; }
.prp .prp-hero-sub b { color: var(--prp-ink); font-weight: 600; }
.prp .prp-cta { display: flex; gap: 14px; margin-top: 34px; flex-wrap: wrap; }
.prp .prp-metaline { margin: 30px 0 0; font-family: var(--prp-mono); font-size: 12.5px; letter-spacing: .02em; color: var(--prp-ink-3); }
.prp .prp-btn-primary { display: inline-flex; align-items: center; gap: 8px; background: var(--prp-grad); color: #fff; font-weight: 600; font-size: 14px; border: 0; border-radius: 999px; padding: 15px 28px; cursor: pointer; transition: transform .2s, box-shadow .2s; box-shadow: 0 14px 40px -16px rgba(139,92,246,.65); }
.prp .prp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 48px -16px rgba(236,72,153,.6); }
.prp .prp-btn-ghost { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--prp-line-2); color: var(--prp-ink); font-weight: 500; font-size: 14px; border-radius: 999px; padding: 15px 26px; cursor: pointer; background: transparent; transition: border-color .2s, background .2s; }
.prp .prp-btn-ghost:hover { border-color: rgba(255,255,255,.34); background: rgba(255,255,255,.04); }
.prp .prp-btn-primary svg, .prp .prp-btn-ghost svg { width: 15px; height: 15px; }
.prp .prp-hero-panel { border: 1px solid var(--prp-line); border-radius: 22px; background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.015)); padding: 26px; position: relative; }
.prp .prp-hero-panel::before { content: ""; position: absolute; inset: 0; border-radius: 22px; background: radial-gradient(60% 60% at 80% 0%, rgba(139,92,246,.14), transparent); pointer-events: none; }
.prp .prp-panel-label { font-family: var(--prp-mono); font-size: 11px; letter-spacing: .18em; color: var(--prp-ink-3); text-transform: uppercase; }
.prp .prp-big-number { font-family: var(--prp-mono); font-size: 64px; font-weight: 500; line-height: 1; letter-spacing: -.02em; margin: 14px 0 6px; }
.prp .prp-panel-note { font-size: 13px; color: var(--prp-ink-3); margin: 0; }
.prp .prp-panel-rows { margin-top: 22px; border-top: 1px solid var(--prp-line); }
.prp .prp-panel-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--prp-line); font-size: 13.5px; }
.prp .prp-panel-row:last-child { border-bottom: 0; }
.prp .prp-panel-row span { color: var(--prp-ink-2); }
.prp .prp-panel-row b { font-family: var(--prp-mono); font-weight: 500; }
.prp .prp-ticker { margin-top: 56px; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); border: 1px solid var(--prp-line); border-radius: 18px; overflow: hidden; background: rgba(255,255,255,.02); }
.prp .prp-ticker > div { padding: 22px 24px; border-right: 1px solid var(--prp-line); }
.prp .prp-ticker > div:last-child { border-right: 0; }
.prp .prp-ticker b { display: block; font-family: var(--prp-mono); font-size: 26px; font-weight: 500; letter-spacing: -.01em; }
.prp .prp-ticker span { font-size: 12.5px; color: var(--prp-ink-3); }
.prp section { padding: 88px 0; border-top: 1px solid var(--prp-line); }
.prp .prp-sec-head { max-width: 640px; }
.prp .prp-kicker { font-family: var(--prp-mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #d8b4fe; }
.prp h2 { margin: 12px 0 0; font-size: clamp(26px, 3.2vw, 38px); font-weight: 600; letter-spacing: -.02em; line-height: 1.15; }
.prp .prp-sec-lead { color: var(--prp-ink-2); margin: 14px 0 0; font-size: 15.5px; }
.prp .prp-cards { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; margin-top: 36px; }
.prp .prp-card { border: 1px solid var(--prp-line); border-radius: 18px; background: var(--prp-card); padding: 26px; transition: border-color .25s, transform .25s; }
.prp .prp-card:hover { border-color: rgba(139,92,246,.45); transform: translateY(-3px); }
.prp .prp-card svg { width: 20px; height: 20px; color: #d8b4fe; }
.prp .prp-card h3 { margin: 16px 0 8px; font-size: 16.5px; font-weight: 600; }
.prp .prp-card p { margin: 0; font-size: 14px; color: var(--prp-ink-2); }
.prp .prp-steps { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 40px; margin-top: 40px; }
.prp .prp-step { padding: 0; }

.prp .prp-step em { font-family: var(--prp-mono); font-style: normal; font-size: 12px; color: #f0abfc; }
.prp .prp-step h3 { margin: 12px 0 8px; font-size: 15.5px; font-weight: 600; }
.prp .prp-step p { margin: 0; font-size: 13.5px; color: var(--prp-ink-2); }
.prp .prp-products { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; margin-top: 36px; }
.prp .prp-product { display: flex; gap: 14px; align-items: flex-start; border: 1px solid var(--prp-line); border-radius: 16px; padding: 18px; background: rgba(255,255,255,.02); transition: border-color .2s; }
.prp .prp-product:hover { border-color: rgba(236,72,153,.4); }
.prp .prp-product svg { width: 18px; height: 18px; color: #f9a8d4; flex-shrink: 0; margin-top: 2px; }
.prp .prp-product b { display: block; font-size: 14.5px; font-weight: 600; }
.prp .prp-product span { font-size: 12.5px; color: var(--prp-ink-3); }
.prp .prp-kit { display: grid; grid-template-columns: minmax(0,.9fr) minmax(0,1.1fr); gap: 48px; align-items: center; border: 1px solid var(--prp-line); border-radius: 22px; background: linear-gradient(120deg, rgba(139,92,246,.08), rgba(59,130,246,.05) 60%, rgba(236,72,153,.07)); padding: 44px; }
.prp .prp-kit ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 22px; }
.prp .prp-kit li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; color: var(--prp-ink-2); }
.prp .prp-kit li svg { width: 15px; height: 15px; color: #a7f3d0; flex-shrink: 0; margin-top: 3px; }
.prp details { border: 1px solid var(--prp-line); border-radius: 14px; background: var(--prp-card); margin-bottom: 12px; overflow: hidden; }
.prp summary { cursor: pointer; list-style: none; padding: 18px 22px; font-weight: 600; font-size: 15px; display: flex; justify-content: space-between; align-items: center; }
.prp summary::-webkit-details-marker { display: none; }
.prp summary::after { content: "+"; font-family: var(--prp-mono); color: var(--prp-ink-3); font-size: 18px; transition: transform .2s; }
.prp details[open] summary::after { transform: rotate(45deg); color: #d8b4fe; }
.prp details p { margin: 0; padding: 0 22px 20px; color: var(--prp-ink-2); font-size: 14px; }
.prp .prp-faq-grid { display: grid; grid-template-columns: minmax(0,.8fr) minmax(0,1.2fr); gap: 48px; align-items: start; }
.prp .prp-form-shell { display: grid; grid-template-columns: minmax(0,.8fr) minmax(0,1.2fr); gap: 48px; align-items: start; }
.prp .prp-form { border: 1px solid var(--prp-line-2); border-radius: 22px; background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.015)); padding: 32px; position: relative; }
.prp .prp-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.prp .prp-field { display: grid; gap: 7px; }
.prp .prp-field.prp-full { grid-column: 1 / -1; }
.prp .prp-field label { font-size: 12.5px; font-weight: 600; color: var(--prp-ink-2); }
.prp .prp-field label em { color: #f0abfc; font-style: normal; }
.prp .prp-field input, .prp .prp-field select, .prp .prp-field textarea { width: 100%; background: rgba(0,0,0,.28); border: 1px solid var(--prp-line); border-radius: 12px; padding: 12px 14px; color: var(--prp-ink); font: inherit; font-size: 14px; outline: none; transition: border-color .2s; }
.prp .prp-field textarea { min-height: 96px; resize: vertical; }
.prp .prp-field input:focus, .prp .prp-field select:focus, .prp .prp-field textarea:focus { border-color: rgba(139,92,246,.6); }
.prp .prp-field input::placeholder, .prp .prp-field textarea::placeholder { color: rgba(255,255,255,.28); }
.prp .prp-hint { font-size: 12px; color: var(--prp-ink-3); margin: 14px 0 0; }
.prp .prp-form .prp-btn-primary { width: 100%; justify-content: center; margin-top: 20px; }
.prp .prp-success { text-align: left; }
.prp .prp-success h3 { margin: 16px 0 8px; font-size: 20px; font-weight: 600; }
.prp .prp-success p { margin: 0 0 10px; font-size: 14px; color: var(--prp-ink-2); }
.prp .prp-success-icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: rgba(52,211,153,.14); border: 1px solid rgba(52,211,153,.4); }
.prp .prp-success-icon svg { width: 24px; height: 24px; color: #34d399; }
.prp .prp-success .prp-btn-ghost { margin-top: 10px; }
.prp .prp-footer { border-top: 1px solid var(--prp-line); padding: 28px 0 40px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-size: 13px; color: var(--prp-ink-3); }
.prp .prp-footer a { color: var(--prp-ink-2); }
.prp .prp-footer a:hover { color: var(--prp-ink); }
.prp .prp-load { opacity: 0; transform: translateY(14px); animation: prp-in .7s cubic-bezier(.2,.7,.3,1) forwards; }
.prp .prp-d1 { animation-delay: .05s; } .prp .prp-d2 { animation-delay: .15s; } .prp .prp-d3 { animation-delay: .25s; } .prp .prp-d4 { animation-delay: .35s; }
@keyframes prp-in { to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .prp .prp-load { animation: none; opacity: 1; transform: none; } }
@media (max-width: 980px) {
  .prp .prp-hero-grid, .prp .prp-cards, .prp .prp-products, .prp .prp-kit, .prp .prp-faq-grid, .prp .prp-form-shell { grid-template-columns: 1fr; }
  .prp .prp-steps { grid-template-columns: 1fr 1fr; gap: 32px; }
  
  .prp .prp-ticker { grid-template-columns: 1fr 1fr; }
  .prp .prp-ticker > div:nth-child(2) { border-right: 0; }
  .prp .prp-ticker > div:nth-child(-n+2) { border-bottom: 1px solid var(--prp-line); }
}
@media (max-width: 620px) {
  .prp .prp-hero { padding: 56px 0 40px; }
  .prp .prp-steps { grid-template-columns: 1fr; }
  
  .prp .prp-step:last-child { border-bottom: 0; }
  .prp .prp-ticker { grid-template-columns: 1fr; }
  .prp .prp-ticker > div { border-right: 0; border-bottom: 1px solid var(--prp-line); }
  .prp .prp-form-grid { grid-template-columns: 1fr; }
  .prp .prp-kit { padding: 26px; }
}
`;

/** Route entry for /partners on the aidreamcapes storefront. */
export async function renderAidreamcapesPartnerProgramPage({ success }: { success: boolean }) {
  return <AidreamcapesPartnerProgramPage success={success} />;
}
