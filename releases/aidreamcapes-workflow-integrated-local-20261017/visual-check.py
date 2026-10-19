from playwright.sync_api import sync_playwright
from pathlib import Path
import json
OUT=Path(__file__).parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 page=b.new_page(viewport={'width':1566,'height':1100})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 r=page.goto('http://localhost:3002/site/aidreamcapes',wait_until='networkidle',timeout=60000)
 print('status',r.status)
 root=page.locator('#home-campaign-workflow')
 root.scroll_into_view_if_needed()
 page.wait_for_timeout(500)
 page.add_style_tag(content='header.site {visibility:hidden!important}')
 root.screenshot(path=str(OUT/'desktop-workflow.png'))
 print(json.dumps({'errors':errors,'cards':root.locator('.adc-workflow-card').count(),'h2':root.locator('h2').evaluate('(el)=>({text:el.textContent,font:getComputedStyle(el).fontSize})'),'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')},indent=2))
 b.close()
