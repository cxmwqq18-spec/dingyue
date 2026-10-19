import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
URL = 'http://localhost:3002/site/aidreamcapes'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
report = {}
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors, data_requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: data_requests.append(request.url) if request.resource_type in ['xhr', 'fetch', 'eventsource'] and '/api/' in request.url else None)
    assert page.goto(URL, wait_until='networkidle', timeout=30000).status == 200
    root = page.locator('[data-home-brand-tools]')
    page.wait_for_selector('[data-tools-ready="true"]')
    assert root.locator('article').count() == 6
    widths = {card.get_attribute('data-tool-kind'): card.bounding_box()['width'] for card in root.locator('article').all()}
    assert widths['url'] < widths['text'] and widths['video'] > widths['image'] and widths['avatar'] > widths['twin']
    report['desktop_card_widths'] = widths

    headings = page.locator('h2').all_text_contents()
    expected = ['Explore the video storyboard.', 'From One Product Photo', 'Built for Teams That Ship Fast', 'Plans for Your Next Campaign', 'Product Content: A Creator Shoot', 'Why Sellers Trust AIVideosUGC', 'Related Tools for the Next Ad']
    positions = [next(i for i, heading in enumerate(headings) if phrase in heading) for phrase in expected]
    assert positions == sorted(positions) and len(set(positions)) == 7, (headings, positions)
    assert positions == list(range(positions[0], positions[0] + 7)), (headings, positions)
    report['requested_module_order'] = [headings[i] for i in positions]

    root.locator('[data-tools-import]').click()
    assert root.locator('[data-imported]').get_attribute('data-imported') == 'true'
    assert root.locator('[data-tools-import-after]').is_visible()
    image_button = root.locator('.adc-tools-import-images [data-tools-open]').first
    image_button.click()
    assert root.locator('#adc-tools-media-dialog').evaluate('(el) => el.open')
    page.keyboard.press('Escape')
    assert not root.locator('#adc-tools-media-dialog').evaluate('(el) => el.open')
    assert image_button.evaluate('(el) => document.activeElement === el')
    report['url_import_and_image_modal'] = 'passed'

    idea = 'Show my product clearly, then introduce one useful detail.'
    root.locator('#adc-tools-prompt').fill(idea)
    assert root.locator('[data-tools-count]').inner_text() == str(len(idea))
    root.locator('[data-tools-mode="video"]').click()
    root.locator('select[name="aspect"]').select_option('1:1')
    root.locator('select[name="duration"]').select_option('10')
    root.locator('[data-tools-brief]').click()
    assert root.locator('[data-tools-brief-output]').inner_text() == idea
    params = parse_qs(urlparse(root.locator('[data-tools-continue]').get_attribute('href')).query)
    assert params['prompt'] == [idea] and params['view'] == ['video'] and params['aspect'] == ['1:1'] and params['duration'] == ['10']
    assert page.url == URL
    page.keyboard.press('Escape')
    root.locator('[data-tools-mode="images"]').click()
    assert root.locator('[data-tools-duration]').is_hidden()
    root.locator('[data-tools-brief]').click()
    image_params = parse_qs(urlparse(root.locator('[data-tools-continue]').get_attribute('href')).query)
    assert image_params['tool_id'] == ['image_generator'] and 'duration' not in image_params
    page.keyboard.press('Escape')
    root.locator('[data-tools-mode="home"]').click()
    report['editable_brief_and_workspace_handoff'] = 'passed'

    root.locator('.adc-tools-shots [data-tools-shot="presenter"]').click()
    assert root.locator('[data-tools-shot-label]').inner_text().startswith('Shot 02')
    root.locator('[data-tools-play-story]').click()
    page.wait_for_timeout(1750)
    assert root.locator('.adc-tools-shots [data-tools-shot="details"]').get_attribute('aria-pressed') == 'true'
    root.locator('[data-tools-play-story]').click()
    assert root.locator('[data-tools-play-story]').get_attribute('aria-pressed') == 'false'
    root.locator('[data-tools-active-shot]').click()
    assert root.locator('[data-tools-media="shot-details"]').is_visible()
    page.keyboard.press('Escape')
    motion = root.locator('.adc-tools-card-image [data-tools-motion]')
    motion.click()
    assert root.locator('.adc-tools-result-frame').get_attribute('data-motion-playing') is not None
    motion.click()
    report['storyboard_and_motion_controls'] = 'passed'

    root.locator('[data-tools-actor="home"]').click()
    script = 'Take a closer look at the bottle and dropper.'
    root.locator('#adc-tools-script').fill(script)
    root.locator('[data-tools-presenter-preview]').click()
    assert root.locator('[data-tools-media="actor-home"]').is_visible()
    assert root.locator('[data-tools-script-output]').inner_text() == script
    page.keyboard.press('Escape')
    root.locator('[data-tools-compare]').evaluate("el => { el.value = '78'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
    assert root.locator('.adc-tools-compare').evaluate("el => el.style.getPropertyValue('--compare')") == '78%'
    report['presenter_and_twin_controls'] = 'passed'

    for card in root.locator('article').all():
        card.scroll_into_view_if_needed()
        page.wait_for_timeout(100)
    page.wait_for_timeout(400)
    page.wait_for_function("[...document.querySelectorAll('[data-home-brand-tools] article img')].filter(el => el.checkVisibility()).every(el => el.complete && el.naturalWidth > 0)", timeout=10000)
    page.add_style_tag(content='header.site { visibility: hidden !important; }')
    root.screenshot(path=str(OUT / 'desktop-tools.png'), animations='disabled')
    report['responsive'] = []
    for width in [768, 390, 360]:
        page.set_viewport_size({'width': width, 'height': 900})
        metrics = root.evaluate('(el) => ({width: Math.round(el.getBoundingClientRect().width), scrollWidth: el.scrollWidth})')
        assert metrics['scrollWidth'] <= metrics['width'] + 1, (width, metrics)
        overflowing = root.locator('article').evaluate_all('(els) => els.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.dataset.toolKind)')
        assert not overflowing, (width, overflowing)
        report['responsive'].append({'viewport': width, **metrics})
        if width == 390:
            root.screenshot(path=str(OUT / 'mobile-tools.png'), animations='disabled')
    page.emulate_media(reduced_motion='reduce')
    root.locator('.adc-tools-card-image [data-tools-motion]').click()
    assert root.locator('.adc-tools-result-frame img').evaluate('el => getComputedStyle(el).animationName') == 'none'
    report['reduced_motion'] = 'passed'
    assert not errors, errors
    assert not data_requests, data_requests
    report['page_errors'] = errors
    report['public_api_data_requests'] = data_requests
    nojs = browser.new_page(java_script_enabled=False)
    assert nojs.goto(URL, wait_until='networkidle', timeout=30000).status == 200
    assert nojs.locator('[data-home-brand-tools] article h3').count() == 6
    assert nojs.locator('#home-campaign-workflow summary').count() == 6
    report['no_javascript_ssr'] = 'passed'
    report['seo_title'] = nojs.title()
    report['seo_description'] = nojs.locator('meta[name="description"]').get_attribute('content')
    browser.close()
report['ok'] = True
(OUT / 'browser-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
