import json,re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

OUT=Path(__file__).parent
URL='https://www.aivideosugc.com/?qa=mobile-hydration-d2e30400e'
EXE='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=EXE,proxy={'server':'http://127.0.0.1:10904'})
    for disable in [False,True]:
        context=browser.new_context(viewport={'width':375,'height':844},is_mobile=True,has_touch=True)
        page=context.new_page()
        run={'cloudflareEmailScriptBlocked':disable,'errors':[],'blocked':[],'scripts':[]}
        page.on('pageerror',lambda e:run['errors'].append({'message':str(e),'stack':e.stack}))
        page.on('request',lambda r:run['scripts'].append(r.url) if r.resource_type=='script' else None)
        def guard(route):
            r=route.request
            if r.method not in ['GET','HEAD'] or (disable and 'email-decode' in r.url):
                run['blocked'].append({'url':r.url,'method':r.method});route.abort('blockedbyclient')
            else:route.continue_()
        page.route('**/*',guard)
        res=page.goto(URL,wait_until='networkidle',timeout=90000)
        page.wait_for_function('''() => {const p=document.querySelector('.v2-pricing-periods button'),r=[...document.querySelectorAll('[data-hx-root]')];return p&&Object.keys(p).some(k=>k.startsWith('__reactProps$'))&&r.length===7&&r.every(e=>e.dataset.hxReady==='true')}''',timeout=30000)
        html=res.text()
        run['http']=res.status
        run['ssrCloudflareFragments']=re.findall(r'.{0,120}(?:data-cfemail|email-decode)[^<]{0,200}',html)
        run['decodedEmailNodes']=page.locator('[data-cfemail]').evaluate_all('(els)=>els.map(e=>({html:e.outerHTML,text:e.textContent}))')
        run['footerEmailAnchors']=page.locator('footer a[href^="mailto:"]').evaluate_all('(els)=>els.map(e=>({html:e.outerHTML,text:e.textContent}))')
        name='hydration-cf-email-blocked' if disable else 'hydration-cf-baseline'
        page.locator('footer').screenshot(path=str(OUT/(name+'.png')))
        results.append(run)
        (OUT/'hydration-diagnostic.json').write_text(json.dumps(results,indent=2))
        print(json.dumps({'blockedEmail':disable,'http':res.status,'errors':run['errors'],'ssrCF':run['ssrCloudflareFragments'],'footerEmail':run['footerEmailAnchors']}),flush=True)
        context.close()
    browser.close()
