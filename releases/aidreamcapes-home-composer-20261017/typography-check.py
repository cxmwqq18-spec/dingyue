import json,pathlib
from playwright.sync_api import sync_playwright
out=pathlib.Path('releases/aidreamcapes-home-composer-20261017');result=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
 for width in [1440,768,390,375]:
  page=browser.new_page(viewport={'width':width,'height':1000})
  page.goto('http://localhost:3002/site/aidreamcapes',wait_until='networkidle',timeout=90000)
  data=page.evaluate('''() => {
   const root=document.querySelector('.home-v4'),ref=getComputedStyle(root.querySelector('.hx-tag')).fontFamily;
   const targets=[...root.querySelectorAll('.hx-feature h2 em,.v-card-number')].map(e=>({text:e.textContent,family:getComputedStyle(e).fontFamily,style:getComputedStyle(e).fontStyle}));
   const serif=[...root.querySelectorAll('*')].filter(e=>e.children.length===0&&e.textContent.trim()).filter(e=> /Georgia|Baskerville|Palatino|Iowan|Times New Roman/.test(getComputedStyle(e).fontFamily)).map(e=>({text:e.textContent.slice(0,80),family:getComputedStyle(e).fontFamily}));
   return {ref,targets,serif,overflow:document.documentElement.scrollWidth>innerWidth+1};
  }''')
  data.update(width=width,ok=bool(data['targets']) and all(t['family']==data['ref'] and t['style']=='normal' for t in data['targets']) and not data['serif'] and not data['overflow']);result.append(data)
  page.locator('#home-experience-hero').scroll_into_view_if_needed();page.screenshot(path=str(out/f'{width}-sans-serif-hero.png'))
  if width in [1440,390]:
   page.locator('#home-experience-picker').scroll_into_view_if_needed();page.screenshot(path=str(out/f'{width}-sans-serif-scenes.png'))
  page.close();print(width,data['ok'],data['ref'],len(data['targets']),flush=True)
 browser.close()
(out/'typography-check.json').write_text(json.dumps({'ok':all(r['ok'] for r in result),'cases':result},indent=2))
assert all(r['ok'] for r in result)
