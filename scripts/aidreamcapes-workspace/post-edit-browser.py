"""Local synthetic fixture only; credentials arrive over stdin and are never reported."""
import json
import os
import re
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

fixture = json.load(sys.stdin)
assert fixture['origin'] == 'http://localhost:3002'
assert fixture['siteId'] == 'site_aidreamcapes'
assert re.fullmatch(r'[A-Za-z0-9_-]{1,180}', fixture['taskId'])
prefix = '/api/sites/site_aidreamcapes/aivideosugc/tasks/' + fixture['taskId']
errors, server_errors, blocked, patches, screenshots = [], [], [], [], []
checks = 0
result = {'result': 'FAIL'}

def safe_error(error):
    value = str(error)
    for key in ['sessionId', 'token']:
        value = value.replace(fixture[key], '[redacted]')
    return value[:1400]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=fixture['chromium'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, service_workers='block')
    context.add_cookies([
        {'name': 'customer_session_site_aidreamcapes', 'value': fixture['sessionId'], 'url': fixture['origin'], 'httpOnly': True, 'sameSite': 'Lax'},
        {'name': 'customer_csrf_site_aidreamcapes', 'value': fixture['token'], 'url': fixture['origin'], 'sameSite': 'Lax'},
    ])

    def guard(route):
        request = route.request
        path = urlparse(request.url).path
        if request.url.startswith(('https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')):
            route.fulfill(status=200, content_type='text/css', body='/* offline acceptance */')
            return
        local = request.url.startswith(fixture['origin'] + '/')
        diagnostic = path == '/__nextjs_original-stack-frames' and request.method == 'POST'
        edit = path in [prefix + '/captions', prefix + '/edit'] and request.method == 'PATCH'
        forbidden = re.search(r'/(quote|reserve|generate|billing|actions)(/|$)', path)
        if not local or forbidden or not (request.method == 'GET' or diagnostic or edit):
            blocked.append({'method': request.method, 'path': path})
            route.abort()
            return
        if edit:
            patches.append(path.rsplit('/', 1)[-1])
        route.continue_()

    context.route('**/*', guard)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(safe_error(error)))
    page.on('response', lambda response: server_errors.append({'path': urlparse(response.url).path, 'status': response.status}) if response.status >= 500 else None)
    try:
        url = fixture['origin'] + '/site/aidreamcapes/app/create?view=agent&step=delivery&task=' + fixture['taskId']
        page.goto(url, wait_until='networkidle', timeout=120000)
        editor = page.get_by_role('region', name='Video editor', exact=True)
        editor.get_by_role('heading', name='Fine-tune your video', exact=True).wait_for(timeout=60000)
        caption = editor.get_by_label('Caption 1 text', exact=True)
        caption.wait_for()
        caption.fill('BROWSER synthetic corrected caption.')
        with page.expect_response(lambda response: urlparse(response.url).path == prefix + '/captions' and response.request.method == 'PATCH') as pending:
            editor.get_by_role('button', name='Save captions', exact=True).click()
        saved = pending.value
        assert saved.status == 200 and saved.json()['edited'] is True
        checks += 3
        editor.get_by_label('On-screen text', exact=True).fill('SYNTHETIC browser overlay')
        editor.get_by_label('Call to action', exact=True).fill('Browser reviewed')
        with page.expect_response(lambda response: urlparse(response.url).path == prefix + '/edit' and response.request.method == 'PATCH', timeout=120000) as pending:
            editor.get_by_role('button', name='Render new version', exact=True).click()
        rendered = pending.value
        assert rendered.status == 200
        render_id = rendered.json()['renderId']
        checks += 2
        page.wait_for_function("""() => {
          const button = [...document.querySelectorAll('button')].find(item => item.textContent === 'Render new version');
          return button && !button.disabled;
        }""", timeout=30000)
        state = page.evaluate("async url => (await fetch(url, {credentials:'same-origin'})).json()", prefix)['task']
        assert state['video']['renderId'] == render_id
        assert len(state['videoHistory']) >= 3
        assert state['video']['editSettings']['overlay']['cta'] == 'Browser reviewed'
        checks += 3
        files = page.evaluate("""async prefix => {
          const video = await fetch(prefix + '/output?kind=video', {credentials:'same-origin'});
          const videoBytes = (await video.arrayBuffer()).byteLength;
          const captions = await fetch(prefix + '/output?kind=subtitles', {credentials:'same-origin'});
          return {videoStatus: video.status, videoType: video.headers.get('content-type'), videoBytes,
            captionStatus: captions.status, captions: await captions.text()};
        }""", prefix)
        assert files['videoStatus'] == 200 and files['videoType'].startswith('video/mp4') and files['videoBytes'] > 1000
        assert files['captionStatus'] == 200 and 'BROWSER synthetic corrected caption.' in files['captions']
        checks += 2
        for width, label in [(1440, 'desktop'), (390, 'mobile')]:
            page.set_viewport_size({'width': width, 'height': 1100 if width == 1440 else 844})
            page.reload(wait_until='networkidle', timeout=120000)
            caption = page.get_by_role('region', name='Video editor').get_by_label('Caption 1 text', exact=True)
            caption.wait_for(timeout=60000)
            assert caption.input_value() == 'BROWSER synthetic corrected caption.'
            page.get_by_role('region', name='Video editor').get_by_label('Call to action', exact=True).wait_for()
            assert page.get_by_role('region', name='Video editor').get_by_label('Call to action', exact=True).input_value() == 'Browser reviewed'
            assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')
            filename = os.path.join(fixture['artifacts'], 'post-edit-' + label + '.png')
            page.screenshot(path=filename, full_page=True)
            screenshots.append(filename)
            checks += 3
        assert not errors, 'Page error during integrated editing'
        assert not server_errors, 'Unexpected HTTP 5xx during integrated editing'
        assert not blocked, 'Unexpected request blocked by no-generation allowlist'
        assert patches == ['captions', 'edit']
        checks += 4
        result = {'result': 'PASS', 'checks': checks, 'pageErrors': 0, 'http5xx': 0, 'blockedRequests': 0,
                  'captionSaves': 1, 'localRenders': 1, 'sourceHistoryPreserved': True, 'screenshots': screenshots}
    except Exception as error:
        result = {'result': 'FAIL', 'error': safe_error(error), 'checks': checks, 'pageErrors': errors,
                  'http5xx': server_errors, 'blockedRequests': blocked, 'screenshots': screenshots}
        try:
            page.screenshot(path=os.path.join(fixture['artifacts'], 'post-edit-failure.png'), full_page=True)
        except Exception:
            pass
    finally:
        browser.close()
print(json.dumps(result))
sys.exit(0 if result['result'] == 'PASS' else 1)
