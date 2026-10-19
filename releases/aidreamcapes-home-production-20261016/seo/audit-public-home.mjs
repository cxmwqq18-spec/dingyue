import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const origin = 'https://www.aivideosugc.com';
const url = `${origin}/?qa=seo-d2e30400e`;
const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:10904' } });
const output = { capturedAt: new Date().toISOString(), target: url, deployedShaProvided: 'd2e30400e8d305ec6420cdd999d42e1f7aa8730b', cases: {} };
try {
  for (const javascript of [true, false]) {
    const name = javascript ? 'javascript' : 'no-javascript';
    const context = await browser.newContext({ javaScriptEnabled: javascript, viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', r => requests.push({ url: r.url(), method: r.method(), type: r.resourceType(), purpose: r.headers().purpose ?? r.headers()['sec-purpose'] ?? null }));
    page.on('pageerror', e => errors.push(e.message));
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await fs.writeFile(path.join(dir, `${name}-response.html`), await response.text());
    await fs.writeFile(path.join(dir, `${name}-dom.html`), await page.content());
    const result = await page.evaluate(() => {
      const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
      return {
        lang: document.documentElement.lang,
        title: document.title,
        metas: [...document.querySelectorAll('meta')].map(e => ({ name: e.name || e.getAttribute('property'), content: e.content })).filter(e => e.name),
        canonical: [...document.querySelectorAll('link[rel="canonical"]')].map(e => e.href),
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map(e => { try { return JSON.parse(e.textContent); } catch { return { parseError: true, raw: e.textContent }; } }),
        headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(e => ({ tag: e.tagName, text: e.textContent.trim(), visible: visible(e), id: e.id })),
        modules: [...document.querySelectorAll('[data-home-experience]')].map(e => ({ kind: e.dataset.homeExperience, visible: visible(e), text: e.innerText, fullText: e.textContent, hrefs: [...e.querySelectorAll('a')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href'), visible: visible(a) })) })),
        images: [...document.querySelectorAll('img')].map(e => ({ src: e.getAttribute('src'), alt: e.getAttribute('alt'), visible: visible(e), complete: e.complete, naturalWidth: e.naturalWidth })),
        details: [...document.querySelectorAll('details')].map(e => ({ summary: e.querySelector('summary')?.textContent.trim(), text: e.textContent.trim(), visible: visible(e) })),
        links: [...document.querySelectorAll('a')].map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href'), visible: visible(e), rel: e.rel })),
        tables: [...document.querySelectorAll('table')].map(e => e.innerText),
        bodyText: document.body.innerText,
        allText: document.body.textContent,
        chineseVisible: document.body.innerText.match(/[\u4e00-\u9fff]+/g) ?? [],
        disabledButtons: [...document.querySelectorAll('button:disabled')].map(e => e.textContent.trim()),
      };
    });
    await page.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(dir, `${name}-fold.png`) });
    for (const kind of ['hero','picker','steps','features','audience','reviews']) {
      await page.locator(`[data-home-experience="${kind}"]`).screenshot({ path: path.join(dir, `${name}-module-${kind}.png`) });
    }
    result.faqOpened = [];
    for (const detail of await page.locator('details').all()) {
      if (await detail.isVisible()) {
        await detail.locator('summary').click();
        result.faqOpened.push(await detail.innerText());
      }
    }
    result.status = response.status();
    result.url = page.url();
    result.responseHeaders = await response.allHeaders();
    result.requests = requests;
    result.publicDataRequests = requests.filter(r => ['fetch','xhr','eventsource'].includes(r.type) || r.purpose || /[?&]_rsc=/.test(r.url));
    result.pageErrors = errors;
    output.cases[name] = result;
    if (!javascript) {
      for (const p of ['/robots.txt','/sitemap.xml']) {
        const r = await context.request.get(`${origin}${p}`, { timeout: 60000 });
        const body = await r.text();
        await fs.writeFile(path.join(dir, p.slice(1)), body);
        output[p] = { status: r.status(), headers: r.headers(), body };
      }
      const paths = [...new Set(result.links.map(l => l.href).filter(h => h && h.startsWith('/') && !h.startsWith('//') && !/^\/(?:app|account|checkout|api|auth|login|register)(?:\/|\?|$)/.test(h)).map(h => h.split('#')[0]))].filter(Boolean);
      output.publicLinkReadback = [];
      for (const p of paths) {
        try { const r = await context.request.get(new URL(p, origin).href, { timeout: 45000 }); output.publicLinkReadback.push({ path: p, status: r.status(), url: r.url() }); }
        catch (e) { output.publicLinkReadback.push({ path: p, error: e.message }); }
      }
    }
    await fs.writeFile(path.join(dir, 'browser-readback.json'), JSON.stringify(output, null, 2));
    await context.close();
    console.log(JSON.stringify({ case: name, status: result.status, title: result.title, h1: result.headings.filter(h => h.tag === 'H1'), moduleCount: result.modules.length, publicDataRequests: result.publicDataRequests, errors: result.pageErrors }));
  }
} finally { await browser.close(); }
