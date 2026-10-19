import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT=Path(__file__).parent
EXE='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=EXE,proxy={'server':'http://127.0.0.1:10904'})
    page=browser.new_page(viewport={'width':768,'height':1024},is_mobile=True,has_touch=True)
    page.route('**/*',lambda route:route.continue_() if route.request.method in ['GET','HEAD'] else route.abort('blockedbyclient'))
    res=page.goto('https://www.aivideosugc.com/?qa=tablet-recheck-d2e30400e',wait_until='domcontentloaded',timeout=90000)
    try:page.wait_for_load_state('networkidle',timeout=20000)
    except Exception:pass
    page.wait_for_function('''() => [...document.querySelectorAll('[data-hx-root]')].filter(e=>e.dataset.hxReady==='true').length===7''',timeout=30000)
    grid=page.locator('.hx-scene-grid')
    grid.scroll_into_view_if_needed()
    result={'http':res.status,'width':768,'expectedColumns':3,'reason':'Mobile two-column breakpoint is max-width 700px. Tablet uses the original three-column grid.'}
    result.update(grid.evaluate('(e)=>({columns:getComputedStyle(e).gridTemplateColumns,viewport:innerWidth,document:document.documentElement.scrollWidth,visibleCards:[...e.children].filter(c=>!c.hidden).length})'))
    result['ok']=len(result['columns'].split())==3 and result['document']==768 and result['visibleCards']==6
    (OUT/'tablet-recheck.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result),flush=True)
    browser.close()
