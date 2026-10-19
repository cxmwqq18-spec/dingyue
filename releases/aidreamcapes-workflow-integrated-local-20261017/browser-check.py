import json
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
OUT=Path(__file__).parent
URL='http://localhost:3002/site/aidreamcapes'
report={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 page=browser.new_page(viewport={'width':1566,'height':1100})
 errors=[]; data=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:data.append(r.url) if r.resource_type in ['xhr','fetch','eventsource'] and '/_next/static/webpack/' not in r.url else None)
 assert page.goto(URL,wait_until='networkidle',timeout=60000).status==200
 root=page.locator('#home-campaign-workflow')
 page.wait_for_selector('#home-campaign-workflow[data-hx-ready="true"]')
 assert root.locator('.adc-workflow-card').count()==6
 assert root.locator('.hx-campaign-steps,.hx-library-filter').count()==0
 assert root.locator('.adc-workflow-card>p').count()==6
 for card in root.locator('.adc-workflow-card').all():
  card.scroll_into_view_if_needed()
 page.wait_for_function("[...document.querySelectorAll('.adc-workflow-grid img')].every(el=>el.complete&&el.naturalWidth>0)")
 assert not root.locator('img').evaluate_all('(els)=>els.filter(e=>e.checkVisibility()).some(e=>e.naturalWidth===0)')
 bxs=[c.bounding_box() for c in root.locator('.adc-workflow-card').all()]
 assert len(set(round(b['y']) for b in bxs))==2
 assert len(set(round(b['width']) for b in bxs))==1
 assert root.locator('.adc-workflow-clips').evaluate('(el)=>[...el.querySelectorAll("img")].every(img=>img.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+1)')
 report['desktop']='six aligned image-and-description cards; no duplicate accordion; loaded images; no clip overflow'
 control=root.locator('.adc-workflow-product-photo');control.click()
 assert page.locator('#adc-workflow-shot-0').evaluate('el=>el.open')
 page.keyboard.press('Escape')
 assert control.evaluate('el=>document.activeElement===el')
 people=root.locator('[data-hx-select-group="workflow-presenter"]')
 people.nth(1).click();assert people.nth(1).get_attribute('aria-pressed')=='true'
 assert people.nth(0).get_attribute('aria-pressed')=='false'
 versions=root.locator('[data-hx-select-group="workflow-version"]')
 versions.nth(1).click();assert versions.nth(1).get_attribute('aria-pressed')=='true'
 idea='Introduce my product with clear details and a calm tone.'
 root.locator('textarea').fill(idea)
 root.locator('select[name="aspect"]').select_option('1:1')
 root.locator('select[name="duration"]').select_option('10')
 values=root.locator('form.adc-workflow-brief').evaluate('el=>Object.fromEntries(new FormData(el))')
 assert values=={'view':'home','prompt':idea,'aspect':'1:1','duration':'10'},values
 import_link=root.locator('.adc-workflow-product-actions>a').nth(1).get_attribute('href')
 assert parse_qs(urlparse(import_link).query)['view']==['product']
 report['brief_and_handoff']={'edited_values':values,'url_import_link':import_link}
 root.locator('.adc-workflow-phone').click()
 dialog=page.locator('#adc-workflow-sequence')
 assert dialog.evaluate('el=>el.open')
 dialog.locator('[data-workflow-play]').click()
 page.wait_for_timeout(1950)
 assert dialog.locator('[data-workflow-frame]').nth(1).is_visible()
 page.keyboard.press('Escape')
 assert dialog.locator('[data-workflow-play]').get_attribute('aria-pressed')=='false'
 report['interactions']='image dialog, Escape/focus restoration, presenter/version selection, editable brief, timed sequence and close cleanup passed'
 headings=page.locator('h2').all_text_contents()
 phrases=['Explore the video storyboard.','From One Product Photo','Built for Teams That Ship Fast','Plans for Your Next Campaign','Product Content: A Creator Shoot','Why Sellers Trust AIVideosUGC','Related Tools for the Next Ad']
 positions=[next(i for i,h in enumerate(headings) if phrase in h) for phrase in phrases]
 assert positions==list(range(positions[0],positions[0]+7)),positions
 report['preserved_order']=[headings[i] for i in positions]
 assert page.locator('a[href="mailto:support@aivideosugc.com"]').count()>=2
 assert 'A billing question or a stuck export' not in page.locator('main').inner_text()
 assert 'Pick From 53 AI Actors' not in page.locator('main').inner_text()
 report['trust']='updated six public copy fields and clickable support email'
 page.add_style_tag(content='header.site {visibility:hidden!important}')
 root.screenshot(path=str(OUT/'desktop-workflow.png'))
 for w in [1100,768,390,360]:
  page.set_viewport_size({'width':w,'height':900})
  root.scroll_into_view_if_needed();page.wait_for_timeout(100)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),w
  for card in root.locator('.adc-workflow-card').all():
   assert card.evaluate('el=>el.scrollWidth<=el.clientWidth+1'),w
  if w==390:root.screenshot(path=str(OUT/'mobile-workflow.png'))
 report['responsive']='1100, 768, 390 and 360 px; no horizontal overflow'
 for slug,expected in [('/ai-video-generation/image-to-video',['Home','AI Video Generation','Image to Video']),('/ai-image-generation/professional-headshot',['Home','AI Image Generation','Professional Headshot']),('/platforms/tiktok-ads',['Home','Platforms','TikTok Ads'])]:
  assert page.goto(URL+slug,wait_until='networkidle',timeout=60000).status==200
  labels=page.locator('nav.crumbs').inner_text().replace('›','').splitlines();text=page.locator('nav.crumbs').inner_text()
  assert all(label in text for label in expected),text
  assert page.locator('nav.crumbs a').nth(1).get_attribute('href').endswith(slug.rsplit('/',1)[0])
 report['browser_breadcrumbs']='video, image and platform detail pages passed'
 nojs=browser.new_context(java_script_enabled=False,viewport={'width':1440,'height':1000})
 s=nojs.new_page();assert s.goto(URL,wait_until='networkidle',timeout=60000).status==200
 assert s.locator('.adc-workflow-card').count()==6
 assert s.locator('.adc-workflow-card>p').count()==6
 assert s.locator('[data-home-brand-tools] article').count()==6
 report['no_javascript']='six complete workflow cards and six tools present in SSR HTML'
 report['errors']=errors;report['browser_data_requests']=data
 assert errors==[] and data==[],(errors,data)
 (OUT/'browser-check.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))
 browser.close()
