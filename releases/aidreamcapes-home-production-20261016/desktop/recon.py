import sys, json, re
from pathlib import Path
BASE=Path(__file__).resolve().parent
sys.path.insert(0,str(BASE/'.pydeps'))
from playwright.sync_api import sync_playwright
URL='https://www.aivideosugc.com/?qa=desktop-d2e30400e'
EXE='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=EXE,proxy={'server':'http://127.0.0.1:10904'})
    page=b.new_page(viewport={'width':1440,'height':1000})
    def guard(route):
        r=route.request
        if r.method not in ['GET','HEAD'] or re.search(r'/api/.*(?:quote|reserve|generat|billing|checkout|supplier|provider)',r.url,re.I): route.abort('blockedbyclient')
        else: route.continue_()
    page.route('**/*',guard)
    page.goto(URL,wait_until='networkidle',timeout=90000)
    page.wait_for_function('''() => {const roots=[...document.querySelectorAll('[data-hx-root]')];return roots.length===7 && roots.every(r=>r.dataset.hxReady==='true')}''',timeout=30000)
    facts=page.evaluate('''() => ({url:location.href,title:document.title,h1:[...document.querySelectorAll('h1')].map(e=>e.innerText),sceneCards:document.querySelectorAll('.v-picker-grid .v-pick-card').length,roots:[...document.querySelectorAll('[data-hx-root]')].map(r=>({name:r.dataset.homeExperience||r.dataset.hxRoot,text:r.innerText,html:r.outerHTML, controls:[...r.querySelectorAll('[data-home-local]')].map(e=>({tag:e.tagName,text:e.innerText,attrs:Object.fromEntries([...e.attributes].map(a=>[a.name,a.value]))})),ctas:[...r.querySelectorAll('[data-home-cta]')].map(e=>({text:e.innerText,href:e.getAttribute('href')}))})),links:[...document.querySelectorAll('header a')].map(e=>({text:e.innerText,href:e.getAttribute('href')}))})''')
    (BASE/'recon.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2))
    page.screenshot(path=str(BASE/'initial-desktop.png'),full_page=True)
    print(json.dumps({k:v for k,v in facts.items() if k!='roots'},ensure_ascii=False))
    print(json.dumps([{'name':r['name'],'controls':len(r['controls']),'ctas':r['ctas']} for r in facts['roots']],ensure_ascii=False))
    b.close()
