import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AIDREAMCAPES_NAV_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname), 'Navigation checks require a loopback app.');
const siteId = 'site_aidreamcapes';
const customerId = 'navigation-fixture-customer';
const api = `/api/sites/${siteId}/aivideosugc`;
const reference = '/media/site_aidreamcapes/workspace/actors/library/indoor-2.webp';
const tasks = new Map();
const actors = JSON.parse(fs.readFileSync('src/lib/aidreamcapes-workspace/actors.json','utf8')).actors;
const unexpected = [], errors = [], fixtureHydrationRecoveries = [], calls = [], checks = [];
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'aidreamcapes-navigation-'));
const viewFromUrl = (url) => url.searchParams.get('view') ?? url.pathname.match(/\/app\/create\/([a-z-]+)$/)?.[1] ?? (url.pathname.endsWith('/app/create') ? 'home' : undefined);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const json = (route, value) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
const sourced = (value) => ({ value, sourceUrl: 'https://example.invalid/product', sourceLabel: 'Product page', confidence: 'high', confirmed: false });
try {
  await context.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      if (url.hostname === 'example.invalid' && url.pathname === '/mug.png') return route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(path.resolve('public/media/site_aidreamcapes/workspace/actors/library/indoor-2.webp')) });
      if (!['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) unexpected.push(`External ${url.hostname}`);
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (url.pathname.startsWith('/api/')) {
      const key = `${req.method()} ${url.pathname}`; calls.push(key);
      let body = {}; try { body = req.postDataJSON() ?? {}; } catch {}
      if (url.pathname === `${api}/actors`) return json(route, { actors });
      if (url.pathname === `${api}/clones`) return json(route, { productionReady: false, mockAvailable: true, analysisBeforeTask: true, voiceTwin: { available: false, state: 'mock_only' }, adReference: { available: false, state: 'mock_only' }, components: { database: { available: true } } });
      if (url.pathname === `${api}/clones/jobs`) return json(route, { jobs: [] });
      if (url.pathname === `${api}/clones/consents`) return json(route, { consents: [] });
      if (url.pathname === `${api}/clones/assets`) return json(route, { assets: [] });
      if (url.pathname === `${api}/tasks` && req.method() === 'GET') return json(route, { tasks: [...tasks.values()] });
      if (url.pathname === `${api}/tasks` && req.method() === 'POST') {
        const taskId = `navigation-task-${tasks.size + 1}`, now = new Date().toISOString();
        const task = { taskId, siteId, customerId, sceneId: body.sceneId, title: body.title, status: 'draft', input: body.input, revision: 1, createdAt: now, updatedAt: now, storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [] };
        tasks.set(taskId, task); return json(route, { task });
      }
      const taskMatch = url.pathname.match(new RegExp(`^${api}/tasks/([^/]+)$`));
      if (taskMatch && tasks.has(taskMatch[1])) {
        const task = tasks.get(taskMatch[1]);
        if (req.method() === 'PATCH') Object.assign(task, body, { revision: task.revision + 1 });
        return json(route, { task });
      }
      if (url.pathname === `${api}/balance`) return json(route, { customerBalance: { balance: 1000, reserved: 0 } });
      if (url.pathname === `${api}/music`) return json(route, { tracks: [], assets: [] });
      if (url.pathname === `${api}/teams`) return json(route, { teams: [] });
      if (url.pathname === `${api}/brands`) return json(route, { brands: [] });
      if (url.pathname === `${api}/teams/invites`) return json(route, { invites: [] });
      if (url.pathname === `${api}/developer-keys`) return json(route, { keys: [] });
      if (url.pathname === `${api}/webhooks`) return json(route, { subscriptions: [] });
      if (url.pathname === `${api}/images/quote`) {
        assert.equal(body.assetUrls.length > 0, true); assert.equal(['1:1', '9:16', '16:9'].includes(body.aspect), true);
        return json(route, { quote: { available: true, credits: 20, currency: 'credits', quoteToken: 'navigation-only' } });
      }
      if (url.pathname === `${api}/images` && req.method() === 'GET') return json(route, { jobs: [], assets: [{ id: 'saved-fixture', label: 'Saved image fixture', previewUrl: reference, downloadUrl: reference }] });
      if (url.pathname === `/api/sites/${siteId}/customers/${customerId}/assets` && req.method() === 'POST') return json(route, { asset: { id: 'uploaded-fixture', label: 'Product photo', previewUrl: reference } });
      if (url.pathname === `/api/sites/${siteId}/customers/${customerId}/assets/import-url`) return json(route, { asset: { id: 'import-fixture', label: 'Imported mug', previewUrl: reference }, product: { title: 'Imported mug' } });
      if (url.pathname === `${api}/tasks/product-brief`) return json(route, { ok: true, preview: { sourceUrl: 'https://example.invalid/product', fetchedPageUrl: 'https://example.invalid/product', draft: { title: sourced('Imported mug'), description: sourced('A ceramic mug'), detectedImages: [{ ...sourced('https://example.invalid/mug.png'), sourcePageUrl: 'https://example.invalid/product' }], possiblePrice: null, confirmed: false, reviewRequired: true } } });
      unexpected.push(key); return json(route, { error: 'unexpected_navigation_api' });
    }
    if (req.isNavigationRequest() && url.pathname.startsWith('/site/aidreamcapes/app')) {
      // This suite has a browser-only synthetic customer, not a server login.
      // Serve private fixed-view reloads through the guest create entry before
      // injecting that customer; real gallery documents are never rewritten.
      const fixedView = url.pathname.match(/^\/site\/aidreamcapes\/app\/create\/([a-z-]+)$/)?.[1];
      const fixtureUrl = new URL(url);
      if (fixedView && fixedView !== 'inspirations') {
        fixtureUrl.pathname = '/site/aidreamcapes/app/create';
        fixtureUrl.search = new URLSearchParams({ view: fixedView }).toString();
      }
      const response = await route.fetch({ url: fixtureUrl.href });
      assert.equal(response.status(), 200, `App document ${url.pathname} loads.`);
      let html = await response.text();
      if (url.pathname.endsWith('/inspirations')) return route.fulfill({ response });
      const seam = String.raw`\"customer\":\"$undefined\"`;
      assert(html.includes(seam), 'Browser-only customer seam is present; no real session is used.');
      html = html.replaceAll(seam, String.raw`\"customer\":{\"id\":\"navigation-fixture-customer\",\"name\":\"Navigation Fixture\",\"email\":\"navigation@example.invalid\"}`);
      html = html.replace(/<a class="([^"]*workspace_button[^"]*)" href="[^"]*\/login[^"]*">(?:<span>)?Log In(?:<\/span>)?<\/a>/, '<button class="$1">Log Out</button>');
      html = html.replace(/<h1>Good Evening<\/h1>/, '<h1>Hello, Navigation</h1>');
      const headers = { ...response.headers() }; for (const key of ['content-length', 'content-encoding', 'transfer-encoding']) delete headers[key];
      return route.fulfill({ status: 200, headers, body: html });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    if (error.message.startsWith('Hydration failed') && viewFromUrl(new URL(page.url())) === 'images' && error.message.includes('disabled={false}')) fixtureHydrationRecoveries.push('Expected synthetic customer / anonymous SSR difference on image reload.');
    else errors.push(error.stack || error.message);
  });
  const sidebar = () => page.getByRole('complementary', { name: 'Workspace navigation' });
  const menu = (name) => sidebar().getByRole('link', { name, exact: true });
  const plannedMenu = (name, view) => sidebar().getByRole('link', { name: new RegExp(`^${name}`) }).click().then(() => page.waitForURL((url) => viewFromUrl(url) === view));
  const go = async (name, view) => {
    if (await page.locator('[data-aidreamcapes-inspirations]').count()) {
      await page.getByRole('link', { name: 'Back to workspace', exact: true }).click();
      // This fixture rewrites anonymous SSR into a synthetic customer. Wait for
      // React to attach the navigation handler before clicking a raw SSR link.
      await page.waitForFunction(() => [...document.querySelectorAll('aside a')].some((link) =>
        Object.keys(link).some((key) => key.startsWith('__reactProps$') && typeof link[key]?.onClick === 'function')));
    }
    await menu(name).click();
    if (view === 'inspirations') {
      await page.waitForURL((url) => url.pathname.endsWith('/inspirations'));
      assert.equal(await sidebar().count(), 0, 'Examples have an independent browsing page.');
    } else {
      await page.waitForURL((url) => viewFromUrl(url) === view);
      assert.equal(await menu(name).getAttribute('aria-current'), 'page');
    }
  };
  await page.goto(`${baseUrl}/site/aidreamcapes/app/create?view=home`, { waitUntil: 'networkidle' });
  await menu('Text to Video').waitFor({timeout:15000}).catch(async (error) => { console.log('Fixture DOM:', await page.locator('body').innerText()); console.log('Fixture errors:', errors); console.log('Calls:',calls); console.log('Unexpected:',unexpected); throw error; });
  for (const label of ['Text to Video', 'AI Video', 'AI Image']) await page.getByRole('tab', { name: label, exact: true }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'AI Video Agent', exact: true }).count(), 0, 'The old homepage composer label is not visible.');
  for (const name of ['Text to Video', 'AI Video', 'AI Image', 'URL to Video', 'AI Avatar', 'All Tools', 'Library', 'Performance', 'Teams & Brands', 'Developer access']) assert.equal(await menu(name).count(), 1, `${name} is directly accessible.`);
  assert.equal(await menu('Batch Drafts').count(), 0, 'Batch Drafts is hidden from the sidebar.');
  checks.push('Creation modules use the current names and Batch Drafts is hidden from the sidebar.');
  await plannedMenu('AI Twin', 'twin');
  await page.getByRole('heading', { name: 'AI Twin', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Create a request', exact: true }).waitFor();
  await go('AI Avatar', 'actors');
  await page.getByRole('heading', { name: 'Create a video with an AI presenter', exact: true }).waitFor();
  await plannedMenu('Ad Clone', 'clone');
  await page.getByRole('heading', { name: /Start with a structure\.\s*Make it your own\./ }).waitFor();
  await page.getByRole('tab', { name: 'Upload an MP4', exact: true }).waitFor();
  await go('Teams & Brands', 'teams');
  await page.getByRole('heading', { name: 'Teams & brands', exact: true }).waitFor();
  await page.getByText('No teams yet', { exact: true }).waitFor();
  await go('Developer access', 'developer');
  await page.getByRole('heading', { name: 'Developer access', exact: true }).waitFor();
  await page.getByText('No API keys yet.', { exact: true }).waitFor();
  await go('Inspirations', 'inspirations');
  await page.getByRole('heading', { name: 'Inspirations.', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/site/aidreamcapes/app/create/inspirations', 'Inspirations opens its own page.');
  checks.push('AI Twin and Ad Clone open integrated forms; adjacent avatar and inspiration navigation remains available.');
  await go('Home', 'home');
  await page.getByRole('button', { name: 'See All', exact: true }).click();
  await page.getByRole('heading', { name: 'All Tools', exact: true }).waitFor();
  for (const [name, view] of [['AI Image', 'images'], ['URL to Video', 'product'], ['AI Avatar', 'actors'], ['AI Video', 'video'], ['Text to Video', 'agent']]) {
    await page.locator('main button').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
    assert.equal(await menu(name).getAttribute('aria-current'), 'page'); assert.equal(viewFromUrl(new URL(page.url())), view);
    if (view === 'agent') {
      await page.getByRole('heading', { name: 'Text to Video', exact: true }).waitFor();
      assert.match((await page.locator('main').innerText()).replace(/\s+/g, ' '), /editable video storyboard.*review each shot.*generate your video.*save it to your library/i);
    }
    await go('All Tools', 'tools');
  }
  assert.equal(await page.getByRole('heading', { name: 'Batch Drafts', exact: true }).count(), 0, 'Batch Drafts is absent from All Tools.');
  checks.push('All Tools cards and sidebar agree on every active destination; Batch Drafts is hidden.');
  await go('Home', 'home');
  const quicks = ['Product video ad for your store', 'TikTok ad for your brand', 'UGC testimonial for your product', 'Instagram Reel for your campaign', 'Cinematic product reveal', 'How-to product video'];
  for (const label of quicks) await page.getByRole('button', { name: label, exact: true }).waitFor();
  const homeUrl = page.url();
  for (const label of quicks) {
    const before = tasks.size;
    await page.getByRole('button', { name: label, exact: true }).click();
    assert.equal(page.url(), homeUrl, 'A quick label fills the form without changing pages.');
    assert((await page.getByRole('textbox', { name: 'Describe your video idea', exact: true }).inputValue()).includes(label), 'The selected quick label is written into the video brief.');
    assert.equal(tasks.size, before, 'Quick labels do not create or charge a job.');
  }
  checks.push('Every quick label fills the video brief in place without navigating or creating a task.');
  await go('AI Avatar', 'actors');
  await page.getByRole('heading', { name: 'Create a video with an AI presenter', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Choose presenter', exact: true }).click();
  await page.getByRole('dialog', { name: 'Choose a presenter' }).waitFor();
  await page.getByRole('button', { name: 'Use this presenter', exact: true }).first().click();
  await page.getByRole('heading', { name: actors[0].name, exact: true }).waitFor();
  checks.push('The AI Avatar module opens the presenter workflow and accepts a selected presenter.');
  await go('Home', 'home');

  await page.goto(`${baseUrl}/site/aidreamcapes/app/create?view=batch`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Batch Drafts', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Coming soon', exact: true }).isDisabled(), true, 'Batch Drafts remains unavailable and cannot be clicked.');
  assert.equal(await page.locator('main button').count(), 1, 'Batch Drafts has no active creation controls.');
  assert.equal(await menu('Batch Drafts').count(), 0, 'Batch Drafts is not available from the navigation.');
  checks.push('Direct Batch Drafts route displays an unavailable state with disabled action.');
  await go('Home', 'home');
  await page.getByRole('tab', { name: 'AI Image', exact: true }).click();
  await page.getByRole('textbox', { name: 'Describe your image idea' }).fill('A ceramic mug beside a window');
  await page.getByRole('combobox', { name: 'Image style' }).selectOption('lifestyle-photos');
  await page.getByRole('combobox', { name: 'Image aspect ratio' }).selectOption('16:9');
  await page.getByLabel('Upload image reference photo', { exact: true }).setInputFiles(path.resolve('public/media/site_aidreamcapes/workspace/actors/library/indoor-2.webp'));
  await page.getByRole('img', { name: 'Image reference 1', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Continue to image', exact: true }).click();
  await page.getByRole('heading', { name: 'AI Image', exact: true }).waitFor();
  assert.equal(await menu('AI Image').getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('main textarea').inputValue(), 'A ceramic mug beside a window');
  assert.equal(await page.getByRole('combobox', { name: 'Image style' }).inputValue(), 'lifestyle-photos');
  assert.equal(await page.getByRole('combobox', { name: 'Image aspect ratio' }).inputValue(), '16:9');
  await page.getByRole('img', { name: 'Image reference 1', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Saved image fixture' }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('main textarea').inputValue(), 'A ceramic mug beside a window');
  assert.equal(await page.getByRole('combobox', { name: 'Image style' }).inputValue(), 'lifestyle-photos');
  await page.getByRole('img', { name: 'Image reference 1', exact: true }).waitFor();
  checks.push('Home image prompt, style, ratio and reference survive module navigation and reload; saved images load.');
  await go('URL to Video', 'product');
  await page.getByRole('textbox', { name: 'Product page URL' }).fill('https://example.invalid/product');
  const importButton = page.getByRole('button', { name: /^(Import photo|Preview product page|Preview product)$/ });
  await importButton.click();
  await page.getByRole('img', { name: 'Imported mug', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirm product photo', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to video draft', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Continue to video draft' }).click();
  await page.getByRole('heading', { name: 'Product demo', exact: true }).waitFor();
  await page.getByRole('img', { name: 'Product photo 1', exact: true }).waitFor();
  checks.push('URL import is a real module and its imported product reaches the correct video setup.');
  await go('Inspirations', 'inspirations');
  await page.getByRole('heading', { name: 'Inspirations.', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/site/aidreamcapes/app/create/inspirations', 'Inspirations has a dedicated URL.');
  assert.equal(await sidebar().count(), 0, 'The creation workspace is not mounted around examples.');
  const inspirationCount = await page.locator('[data-inspiration-card]').count();
  checks.push(`Standalone inspiration library displays ${inspirationCount} examples from current LivePage rows and returns to creation.`);
  await page.screenshot({ path: path.join(artifacts, 'desktop-inspirations.png'), fullPage: true });
  await go('AI Image', 'images');
  await page.getByRole('img', { name: 'Image reference 1', exact: true }).evaluate((image) => image.decode());
  await page.getByRole('img', { name: 'Saved image fixture', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('img', { name: 'Saved image fixture', exact: true }).evaluate((image) => image.decode());
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.includes('Generate image') && !button.disabled));
  await page.evaluate(() => window.scrollTo({top:0}));
  await page.screenshot({ path: path.join(artifacts, 'desktop-images.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await menu('URL to Video').click();
  await page.getByRole('heading', { name: 'URL to Video', exact: true, level: 1 }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile module does not overflow.');
  await page.screenshot({ path: path.join(artifacts, 'mobile-product.png'), fullPage: true });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await menu('Teams & Brands').click();
  await page.getByRole('heading', { name: 'Teams & brands', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile team workspace does not overflow.');
  await page.screenshot({ path: path.join(artifacts, 'mobile-teams.png'), fullPage: true });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await menu('Developer access').click();
  await page.getByRole('heading', { name: 'Developer access', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile developer workspace does not overflow.');
  await page.screenshot({ path: path.join(artifacts, 'mobile-developer.png'), fullPage: true });
  checks.push('Mobile menu reaches all modules and the module form fits the viewport.');
  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guestPage = await guestContext.newPage();
  guestPage.on('pageerror', (error) => errors.push(error.message));
  await guestPage.goto(`${baseUrl}/site/aidreamcapes/app/create?view=images`, { waitUntil: 'networkidle' });
  await guestPage.getByRole('heading', { name: 'AI Image', exact: true }).waitFor();
  await guestContext.close();
  checks.push('Unmodified anonymous SSR image page hydrates without application errors.');
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
  assert.equal(calls.some((call) => /actions|dispatch|billing|ledger|POST .*aivideosugc\/images$/.test(call)), false, 'No generation, worker or billing API is called.');
  const report = { passed: true, baseUrl, checks, apiCalls: calls.length, actualGenerationCalls: 0, pageErrors: errors, fixtureHydrationRecoveries, unexpectedRequests: unexpected, artifacts };
  fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const currentPage = context.pages().at(-1);
  console.error('Navigation acceptance diagnostic:', JSON.stringify({ error: error instanceof Error ? error.message : 'failed', url: currentPage?.url(), body: currentPage ? (await currentPage.locator('body').innerText()).slice(0, 1800) : undefined, calls, errors, unexpected }));
  throw error;
} finally { await browser.close(); }
