import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

OUT=Path(__file__).parent
URL='https://www.aivideosugc.com/?qa=mobile-d2e30400e'
EXE='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=EXE,proxy={'server':'http://127.0.0.1:10904'})
    page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    def guard(route):
        req=route.request
        path=urlparse(req.url).path
        if req.method not in ('GET','HEAD') or ('/api/' in path and any(x in path.lower() for x in ['quote','reserve','generat','billing','checkout','supplier','provider'])):
            route.abort('blockedbyclient')
        else: route.continue_()
    page.route('**/*',guard)
    response=page.goto(URL,wait_until='networkidle',timeout=90000)
    page.wait_for_function('''() => {const pricing=document.querySelector('.v2-pricing-periods button'),roots=[...document.querySelectorAll('[data-hx-root]')]; return pricing&&Object.keys(pricing).some(k=>k.startsWith('__reactProps$'))&&roots.length===7&&roots.every(r=>r.dataset.hxReady==='true')}''',timeout=30000)
    facts=page.evaluate('''() => ({status:document.readyState,width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.title,header:document.querySelector('header.site')?.outerHTML,roots:[...document.querySelectorAll('[data-hx-root]')].map(r=>({name:r.dataset.homeExperience||r.dataset.hxRoot,heading:r.querySelector('h2')?.textContent,controls:[...r.querySelectorAll('[data-home-local]:not([data-hx-close])')].map((b,i)=>({i,tag:b.tagName,text:b.textContent.trim(),key:b.dataset.homeLocal,group:b.dataset.hxSelectGroup,value:b.dataset.hxSelectValue,filter:b.dataset.hxFilter,dialog:b.dataset.hxDialog,visible:!!b.getClientRects().length}))})),pricing:document.querySelector('.v2-pricing')?.outerHTML,faqs:[...document.querySelectorAll('details')].map(d=>({class:d.className,text:d.querySelector('summary')?.textContent})),social:[...document.querySelectorAll('[data-social-links] a')].map(a=>({text:a.textContent,href:a.getAttribute('href'),target:a.target,rel:a.rel}))})''')
    facts['http']=response.status
    (OUT/'recon.json').write_text(json.dumps(facts,indent=2))
    page.screenshot(path=str(OUT/'initial-390.png'),full_page=False)
    print(json.dumps({'http':response.status,'title':facts['title'],'width':facts['width'],'scroll':facts['scroll'],'roots':[(r['name'],len(r['controls'])) for r in facts['roots']]}))
    browser.close()
