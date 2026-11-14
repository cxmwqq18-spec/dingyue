import Link from "next/link";
import { ArrowRight, Check, FileText, Send } from "lucide-react";
import type { AidreamcapesV2Navigation } from "@/lib/types";
import { notFound } from "next/navigation";
import { AidreamcapesV2Shell } from "@/components/storefront/aidreamcapes-v2/shell";
import { aidreamcapesV2Company } from "@/components/storefront/aidreamcapes-v2/company";
import { aidreamcapesV2ThemeCssHref } from "@/components/storefront/aidreamcapes-v2/styles";
import { loadAidreamcapesChrome } from "@/lib/aidreamcapes-workspace/media-detail.server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";

/** The public partner-program page: standard storefront chrome, creators-circle
 * content flow (audience fit -> how it works -> apply -> free credits -> quality
 * bar -> FAQ), a partner application form and a logged-in free-credit form that
 * post straight into the admin queues. The no-JS flow works: each API answers
 * the multipart post with a 303 back to this page carrying ?partner=success or
 * ?credits=applied. */

const AUDIENCE_FIT = [
  { title: "Short-form creators", body: "TikTok, Reels and Shorts educators whose feed is product ads — your viewers already ask which tool made them." },
  { title: "Newsletter & community owners", body: "E-commerce and dropshipping lists that recommend tools once a week and want a link their readers can actually use." },
  { title: "Agencies & freelancers", body: "Teams that deliver video ads for clients can resell the workflow they already run." },
  { title: "Performance partners", body: "Media buyers running paid traffic can point at a product-first tool with a free entry workflow." }
];

const STEPS = [
  { n: "01", title: "Apply", body: "Tell us who you reach and where you publish. Every application is reviewed by a person within 48 hours." },
  { n: "02", title: "Get your channel", body: "Approved partners receive a tracking link, a dashboard and a Pro demo workspace for producing demos." },
  { n: "03", title: "Publish", body: "Tutorials, comparisons, behind-the-scenes — any format that shows what the tool does. Swipe copy included." },
  { n: "04", title: "Grow with us", body: "Tell us what your audience responds to and we keep the campaign briefs, creative kit and partner support coming as you publish." }
];

const QUALITY_BAR = [
  { title: "Clear audience fit", body: "Your readers or viewers make and market video content — the recommendation lands on an existing need." },
  { title: "Helpful creative framing", body: "You explain tools honestly: what they do, who they serve, what they cost. No fake claims." },
  { title: "Privacy and disclosure", body: "You disclose the partnership and respect your audience's data — the baseline for staying in the program." },
  { title: "A testable plan", body: "You can name the first piece of content you would publish and where it would go live." }
];

const FOLLOWER_TIERS = [
  { value: "under_5k", label: "Under 5K" },
  { value: "5k_25k", label: "5K – 25K" },
  { value: "25k_100k", label: "25K – 100K" },
  { value: "100k_plus", label: "100K+" }
];

const CREDIT_PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X / Twitter" }
];

export async function AidreamcapesPartnerProgramPage({ success, creditsApplied, duplicate, limited }: { success: boolean; creditsApplied?: boolean; duplicate?: boolean; limited?: boolean }) {
  const [chrome, customer] = await Promise.all([
    loadAidreamcapesChrome(),
    getCurrentCustomerForSite(AIVIDEOSUGC_SITE_ID)
  ]);
  if (!chrome) notFound();
  // Repeat visitors who already have a live application see its status instead
  // of the form — resubmitting would only bounce off the dedup guard.
  const existingApplication = customer
    ? await prisma.creditApplication.findFirst({
        where: { siteId: AIVIDEOSUGC_SITE_ID, customerId: customer.customer.id, status: { in: ["pending", "approved"] } },
        orderBy: { createdAt: "desc" },
        select: { status: true, grantCredits: true }
      })
    : null;
  const headerAccount = customer ? { href: "/account", label: "My account" } : undefined;
  const headerCustomer = customer
    ? { balance: customer.customer.balance, email: customer.customer.email, name: customer.customer.name, profile: customer.customer.profile }
    : undefined;
  const company = aidreamcapesV2Company(chrome.identity);

  return (
    <AidreamcapesV2Shell
      articles={chrome.articles}
      articlesTitle={chrome.articlesTitle}
      company={company}
      headerAccount={headerAccount}
      headerCustomer={headerCustomer}
      navigation={chrome.navigation as AidreamcapesV2Navigation}
      r={{ asset: (value: string) => value, href: (value: string) => value, copy: {} }}
      siteId={AIVIDEOSUGC_SITE_ID}
    >
      <link rel="stylesheet" href={aidreamcapesV2ThemeCssHref()} precedence="high" />
      <style>{PRP_CSS}</style>
      <div className="prp">

        <section className="prp-hero">
          <span className="prp-eyebrow">Partner Program</span>
          <h1>Grow with AI video ads your audience can <span className="prp-grad-text">actually try</span>.</h1>
          <p className="prp-hero-sub">Share AIVideosUGC with the creators, sellers and agencies you already talk to. Approved partners get a dedicated channel, a Pro demo workspace and a dashboard — we run onboarding, support and the render pipeline.</p>
          <div className="prp-cta">
            <a className="prp-btn-primary" href="#apply"><Send aria-hidden="true" />Apply in 3 minutes</a>
            <a className="prp-btn-ghost" href="#how"><FileText aria-hidden="true" />How it works</a>
          </div>
          <p className="prp-metaline">Free to join &middot; Pro demo workspace &middot; Creative kit included &middot; Dedicated dashboard &middot; Reviewed within 48h</p>
        </section>

        <section className="prp-sec">
          <span className="prp-kicker">Who this is for</span>
          <h2>Built for creators who explain products, style and transformation.</h2>
          <div className="prp-grid4">
            {AUDIENCE_FIT.map((fit) => (
              <article className="prp-tile" key={fit.title}>
                <h3>{fit.title}</h3>
                <p>{fit.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="prp-sec" id="how">
          <span className="prp-kicker">How it works</span>
          <h2>A simple path from application to live campaign.</h2>
          <div className="prp-grid4">
            {STEPS.map((step) => (
              <article className="prp-tile" key={step.n}>
                <em>{step.n}</em>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="prp-sec prp-apply" id="apply">
          <div className="prp-apply-grid">
            <div className="prp-sec-head">
              <span className="prp-kicker">Partner application</span>
              <h2>Apply for a reserved promotion channel.</h2>
              <p className="prp-sec-lead">Three minutes now, an answer within 48 hours. Approved partners get their channel link, dashboard invite and creative kit in the approval email.</p>
            </div>
            {success ? (
              <div className="prp-form prp-success" role="status">
                <h3>Application received</h3>
                <p>Your application is in the partnership queue as <b>pending review</b>. A human reads every application — expect an answer within 48 hours at the email you provided.</p>
                <p className="prp-hint">Approved partners receive their dashboard invite, channel link and creative kit in the approval email.</p>
                <Link className="prp-btn-ghost" href="/">Back to aivideosugc.com</Link>
              </div>
            ) : duplicate ? (
              <div className="prp-form prp-success" role="status">
                <h3>You already have an application in the queue</h3>
                <p>We found a <b>pending application for this email</b> — a human reads every one, usually within 48 hours, so there is no need to submit again.</p>
                <p className="prp-hint">Submitted with the wrong details? Reply to our confirmation email and we will update the application for you.</p>
                <Link className="prp-btn-ghost" href="/">Back to aivideosugc.com</Link>
              </div>
            ) : limited ? (
              <div className="prp-form prp-success" role="status">
                <h3>Too many applications from your network</h3>
                <p>We have already received several applications from your connection today. Please try again tomorrow &mdash; or if you are an agency submitting for multiple creators, email us and we will help.</p>
                <Link className="prp-btn-ghost" href="/">Back to aivideosugc.com</Link>
              </div>
            ) : (
              <form className="prp-form" action="/api/sites/site_aidreamcapes/partner-applications" method="post">
                <input type="text" name="website_url" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
                <div className="prp-form-grid">
                  <div className="prp-field"><label>Name <em>*</em></label><input name="name" placeholder="Your name" required /></div>
                  <div className="prp-field"><label>Email <em>*</em></label><input name="email" type="email" placeholder="you@channel.com" required /></div>
                  <div className="prp-field"><label>Company / brand</label><input name="company" placeholder="Optional" /></div>
                  <div className="prp-field"><label>Main channel link <em>*</em></label><input name="socialLinks" placeholder="tiktok.com/@you &middot; youtube.com/@you" required /></div>
                  <div className="prp-field prp-full"><label>Who is your audience? <em>*</em></label><input name="audience" placeholder="e.g. 45k Shopify dropshippers, mostly US, 25&ndash;40" required /></div>
                  <div className="prp-field"><label>Publishing cadence</label><select name="cadence" defaultValue="Weekly"><option>2+ posts / week</option><option>Weekly</option><option>Bi-weekly</option><option>Monthly</option></select></div>
                  <div className="prp-field"><label>Where did you hear about us?</label><select name="source" defaultValue="Other"><option>X / Twitter</option><option>YouTube</option><option>TikTok</option><option>Newsletter</option><option>A friend / colleague</option><option>Other</option></select></div>
                  <div className="prp-field prp-full"><label>Campaign ideas</label><textarea name="campaignIdeas" placeholder="What would you publish first? Tutorials, comparisons, niche use cases&hellip;" /></div>
                  <div className="prp-field prp-full"><label>Anything else?</label><textarea name="message" style={{ minHeight: 72 }} placeholder="Questions, links to past partnerships, anything useful." /></div>
                </div>
                <button className="prp-btn-primary" type="submit"><Send aria-hidden="true" />Submit application</button>
                <p className="prp-hint">By submitting you agree to the partner terms. We review manually &mdash; no auto-approvals, no spam.</p>
              </form>
            )}
          </div>
        </section>

        <section className="prp-sec prp-apply" id="free-credits">
          <div className="prp-apply-grid">
            <div className="prp-sec-head">
              <span className="prp-kicker">Free credits for creators</span>
              <h2>Get free credits for your next video.</h2>
              <p className="prp-sec-lead">Post a video with <b>#AivideosUGC</b>, submit it below, and once we approve it your account gets 20 free credits &mdash; enough for a full 15s video. Bigger audiences can earn up to 60.</p>
              <p className="prp-sec-lead">A real person reviews every application &mdash; you&rsquo;ll get an email either way.</p>
              <p className="prp-metaline">One grant per creator &middot; 20&ndash;60 credits &middot; Reviewed by hand &middot; Credits never expire</p>
            </div>
            {creditsApplied ? (
              <div className="prp-form prp-success" role="status">
                <h3>Application received</h3>
                <p>Your free-credit application is in the queue as <b>pending review</b>. A real person reads every application &mdash; you&rsquo;ll get an email either way, usually within 48 hours.</p>
                <p className="prp-hint">Approved credits land on your account balance automatically.</p>
                <Link className="prp-btn-ghost" href="/">Back to aivideosugc.com</Link>
              </div>
            ) : existingApplication ? (
              <div className="prp-form prp-success" role="status">
                {existingApplication.status === "pending" ? (
                  <>
                    <h3>Your application is in the queue</h3>
                    <p>It&rsquo;s <b>pending review</b> &mdash; a real person reads every application, usually within 48 hours. You&rsquo;ll get an email either way.</p>
                    <p className="prp-hint">Approved credits land on your account balance automatically. One application per creator is enough.</p>
                  </>
                ) : (
                  <>
                    <h3>You&rsquo;re in — credits granted 🎉</h3>
                    <p>Your application was <b>approved</b> and {existingApplication.grantCredits ?? 20} credits landed on your account. Post your next video with <b>#AivideosUGC</b> to keep the momentum.</p>
                    <p className="prp-hint">Spend them from the workspace composer — every job shows its exact cost first.</p>
                  </>
                )}
                <Link className="prp-btn-ghost" href="/">Back to aivideosugc.com</Link>
              </div>
            ) : customer ? (
              <form className="prp-form" action={`/api/sites/${AIVIDEOSUGC_SITE_ID}/credit-applications`} method="post">
                <input type="text" name="website_url" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
                <div className="prp-form-grid">
                  <div className="prp-field"><label>Main platform <em>*</em></label><select name="platform" defaultValue="tiktok">{CREDIT_PLATFORMS.map((platform) => <option key={platform.value} value={platform.value}>{platform.label}</option>)}</select></div>
                  <div className="prp-field"><label>Profile link <em>*</em></label><input name="profileUrl" type="url" placeholder="https://tiktok.com/@you" required /></div>
                  <div className="prp-field prp-full"><label>Follower count <em>*</em></label>
                    <div className="prp-radio-row-wrap">
                      {FOLLOWER_TIERS.map((tier, index) => (
                        <label className="prp-radio-row" key={tier.value}>
                          <input type="radio" name="followerTier" value={tier.value} defaultChecked={index === 0} />
                          {tier.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="prp-field prp-full"><label>Posts with #AivideosUGC <em>*</em></label>
                    <input name="evidencePosts" type="url" placeholder="Post link 1 — must include #AivideosUGC" required />
                    <input name="evidencePosts" type="url" placeholder="Post link 2 (optional)" />
                    <input name="evidencePosts" type="url" placeholder="Post link 3 (optional)" />
                  </div>
                  <div className="prp-field prp-full"><label>Who is your audience?</label><input name="audience" placeholder="e.g. 45k Shopify dropshippers, mostly US, 25&ndash;40" /></div>
                  <div className="prp-field prp-full"><label>Anything else?</label><textarea name="message" style={{ minHeight: 72 }} placeholder="Campaign angle, niche, anything useful." /></div>
                </div>
                <button className="prp-btn-primary" type="submit"><Send aria-hidden="true" />Submit application</button>
                <p className="prp-hint">Applying as {customer.customer.email}. One grant per creator; posts are checked manually &mdash; no auto-approvals.</p>
              </form>
            ) : (
              <div className="prp-form prp-success">
                <h3>Log in to apply</h3>
                <p>Free credits go straight onto your creator account, so we review applications from logged-in accounts only.</p>
                <p className="prp-hint">No account yet? Registration takes about a minute and includes free starter credits.</p>
                <a className="prp-btn-primary" href={`/login?next=${encodeURIComponent("/partners")}`}><Send aria-hidden="true" />Log in to apply</a>
              </div>
            )}
          </div>
        </section>

        <section className="prp-sec">
          <span className="prp-kicker">Before you submit</span>
          <h2>What we look for in partner channels.</h2>
          <div className="prp-grid4">
            {QUALITY_BAR.map((item) => (
              <article className="prp-tile" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="prp-sec" id="faq">
          <span className="prp-kicker">FAQ</span>
          <h2>The questions we get before approval.</h2>
          <div className="prp-faq">
            <details open><summary>Who gets approved?</summary><p>Creators, agencies and community owners whose audience makes or markets video content: e-commerce sellers, TikTok/Reels educators, dropshipping communities, marketing newsletters and agencies. There is no minimum follower count &mdash; we care about fit and activity.</p></details>
            <details><summary>What do approved partners receive?</summary><p>The approval email includes your tracking link, dashboard invite and creative kit. The partner terms &mdash; shared with you before anything goes live &mdash; cover how referrals are recognized. The dashboard shows every referral and its status.</p></details>
            <details><summary>How is my referral attributed?</summary><p>Your channel link sets a 90-day cookie. Any subscription opened within that window is attributed to you.</p></details>
            <details><summary>Can I run paid ads?</summary><p>Yes &mdash; paid, email and organic are all welcome. We only ask that you do not bid on our brand keywords or run misleading creatives; the terms spell out the details.</p></details>
            <details><summary>What happens after I submit the form?</summary><p>The application lands in our partnership queue. You will get an email within 48 hours &mdash; approved partners receive their dashboard invite, channel link and creative kit in the same email.</p></details>
          </div>
        </section>

      </div>
    </AidreamcapesV2Shell>
  );
}

const PRP_CSS = `
.prp { --prp-ink: #f5f5f7; --prp-ink-2: #b8b8c2; --prp-ink-3: #8a8a96; --prp-line: rgba(255,255,255,.10); --prp-line-2: rgba(255,255,255,.18);
  --prp-grad: linear-gradient(90deg,#8b5cf6,#ec4899 55%,#3b82f6); --prp-mono: var(--font-mono, "IBM Plex Mono", ui-monospace, monospace);
  font-family: inherit; line-height: 1.6; padding-bottom: 40px; }
.prp *, .prp *::before, .prp *::after { box-sizing: border-box; }
.prp section { max-width: 1180px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }
.prp a { color: inherit; text-decoration: none; }
.prp .prp-grad-text { background: var(--prp-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.prp .prp-hero { padding-top: 56px; padding-bottom: 24px; max-width: 1180px; }
.prp .prp-eyebrow { display: inline-flex; align-items: center; font-size: 12px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--prp-ink-3); }
.prp h1 { margin: 18px 0 0; font-size: clamp(34px, 4.6vw, 56px); line-height: 1.06; font-weight: 600; letter-spacing: -.028em; }
.prp .prp-hero-sub { margin: 24px 0 0; font-size: 17px; line-height: 1.75; color: var(--prp-ink-2); max-width: 660px; }
.prp .prp-hero-sub b { color: var(--prp-ink); font-weight: 600; }
.prp .prp-cta { display: flex; gap: 14px; margin-top: 32px; flex-wrap: wrap; }
.prp .prp-btn-primary { display: inline-flex; align-items: center; gap: 8px; background: var(--prp-grad); color: #fff; font-weight: 600; font-size: 14px; border: 0; border-radius: 999px; padding: 14px 26px; cursor: pointer; transition: transform .2s, box-shadow .2s; box-shadow: 0 14px 40px -16px rgba(139,92,246,.65); }
.prp .prp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 48px -16px rgba(236,72,153,.6); }
.prp .prp-btn-ghost { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--prp-line-2); color: var(--prp-ink); font-weight: 500; font-size: 14px; border-radius: 999px; padding: 14px 24px; cursor: pointer; background: transparent; transition: border-color .2s; }
.prp .prp-btn-ghost:hover { border-color: rgba(255,255,255,.34); }
.prp .prp-btn-primary svg, .prp .prp-btn-ghost svg { width: 15px; height: 15px; }
.prp .prp-metaline { margin: 28px 0 0; font-family: var(--prp-mono); font-size: 12.5px; letter-spacing: .02em; color: var(--prp-ink-3); }
.prp section.prp-sec { padding-top: 72px; padding-bottom: 72px; border-top: 1px solid var(--prp-line); }
.prp .prp-apply { border-top: 0; }
.prp .prp-kicker { font-family: var(--prp-mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #d8b4fe; }
.prp h2 { margin: 12px 0 0; font-size: clamp(25px, 3vw, 36px); font-weight: 600; letter-spacing: -.02em; line-height: 1.18; }
.prp .prp-sec-lead { color: var(--prp-ink-2); margin: 14px 0 0; font-size: 15.5px; max-width: 560px; }
.prp .prp-grid4 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; margin-top: 36px; }
.prp .prp-tile { border: 1px solid var(--prp-line); border-radius: 16px; background: rgba(255,255,255,.025); padding: 22px 24px; transition: border-color .2s; }
.prp .prp-tile:hover { border-color: rgba(139,92,246,.4); }
.prp .prp-tile em { font-family: var(--prp-mono); font-style: normal; font-size: 12px; color: #f0abfc; }
.prp .prp-tile h3 { margin: 10px 0 8px; font-size: 15.5px; font-weight: 600; }
.prp .prp-tile p { margin: 0; font-size: 13.5px; color: var(--prp-ink-2); }
.prp .prp-apply-grid { display: grid; grid-template-columns: minmax(0,.8fr) minmax(0,1.2fr); gap: 48px; align-items: start; border: 1px solid var(--prp-line); border-radius: 22px; background: linear-gradient(180deg, rgba(139,92,246,.07), rgba(59,130,246,.04) 70%); padding: 44px; }
.prp .prp-form { border: 1px solid var(--prp-line-2); border-radius: 18px; background: rgba(0,0,0,.3); padding: 28px; }
.prp .prp-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.prp .prp-field { display: grid; gap: 7px; }
.prp .prp-field.prp-full { grid-column: 1 / -1; }
.prp .prp-field label { font-size: 12.5px; font-weight: 600; color: var(--prp-ink-2); }
.prp .prp-field label em { color: #f0abfc; font-style: normal; }
.prp .prp-field input, .prp .prp-field select, .prp .prp-field textarea { width: 100%; background: rgba(0,0,0,.3); border: 1px solid var(--prp-line); border-radius: 12px; padding: 12px 14px; color: var(--prp-ink); font: inherit; font-size: 14px; outline: none; transition: border-color .2s; }
.prp .prp-field textarea { min-height: 88px; resize: vertical; }
.prp .prp-field input:focus, .prp .prp-field select:focus, .prp .prp-field textarea:focus { border-color: rgba(139,92,246,.6); }
.prp .prp-field input::placeholder, .prp .prp-field textarea::placeholder { color: rgba(255,255,255,.28); }
.prp .prp-radio-row-wrap { display: flex; flex-wrap: wrap; gap: 10px 18px; padding-top: 2px; }
.prp .prp-radio-row { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; color: var(--prp-ink-2); cursor: pointer; }
.prp .prp-radio-row input { width: 15px; height: 15px; accent-color: #a855f7; cursor: pointer; }
.prp .prp-hint { font-size: 12px; color: var(--prp-ink-3); margin: 14px 0 0; }
.prp .prp-form .prp-btn-primary { width: 100%; justify-content: center; margin-top: 20px; }
.prp .prp-success h3 { margin: 0 0 10px; font-size: 20px; font-weight: 600; }
.prp .prp-success p { margin: 0 0 10px; font-size: 14px; color: var(--prp-ink-2); }
.prp .prp-success .prp-btn-ghost { margin-top: 10px; }
.prp .prp-faq { margin-top: 36px; }
.prp details { border: 1px solid var(--prp-line); border-radius: 14px; background: rgba(255,255,255,.025); margin-bottom: 12px; overflow: hidden; }
.prp summary { cursor: pointer; list-style: none; padding: 18px 22px; font-weight: 600; font-size: 15px; display: flex; justify-content: space-between; align-items: center; }
.prp summary::-webkit-details-marker { display: none; }
.prp summary::after { content: "+"; font-family: var(--prp-mono); color: var(--prp-ink-3); font-size: 18px; transition: transform .2s; }
.prp details[open] summary::after { transform: rotate(45deg); color: #d8b4fe; }
.prp details p { margin: 0; padding: 0 22px 20px; color: var(--prp-ink-2); font-size: 14px; }
@media (max-width: 880px) {
  .prp .prp-grid4 { grid-template-columns: 1fr; }
  .prp .prp-apply-grid { grid-template-columns: 1fr; padding: 26px; gap: 28px; }
  .prp .prp-form-grid { grid-template-columns: 1fr; }
  .prp section.prp-sec { padding-top: 56px; padding-bottom: 56px; }
  .prp .prp-hero { padding-top: 40px; }
}
`;

/** Route entry for /partners on the aidreamcapes storefront (both catch-alls). */
export async function renderAidreamcapesPartnerProgramPage({ success, creditsApplied, duplicate, limited }: { success: boolean; creditsApplied?: boolean; duplicate?: boolean; limited?: boolean }) {
  return <AidreamcapesPartnerProgramPage success={success} creditsApplied={creditsApplied} duplicate={duplicate} limited={limited} />;
}
