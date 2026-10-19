import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(__file__).parent
BASE='http://localhost:3002/site/aidreamcapes'
report={'target':'local','url':BASE}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[];data=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:data.append(r.url) if r.resource_type in ['xhr','fetch','eventsource'] and '/_next/static/webpack/' not in r.url else None)
 assert page.goto(BASE,wait_until='networkidle',timeout=60000).status==200
 assert page.locator('#home-product-image-steps .eyebrow').inner_text().lower()=='image to video'
 assert page.locator('#home-campaign-workflow .hx-tag').inner_text().lower()=='how it works'
 text=page.locator('.adc-tools-card-text h3 a')
 twin=page.locator('.adc-tools-card-twin h3>a').first
 assert text.get_attribute('href')==BASE.replace('http://localhost:3002','')+'/text-to-video'
 assert twin.get_attribute('href').endswith('/ai-twin')
 twinPreview=page.locator('.adc-tools-twin-enlarge')
 assert twinPreview.evaluate('el=>el.tagName')=='A' and twinPreview.get_attribute('href').endswith('/ai-twin')
 assert page.locator('.adc-tools-card-twin h3 small a').get_attribute('href').endswith('/ai-twin')
 more=page.locator('#home-product-scenes .v-picker-action>a')
 assert more.inner_text()=='Browse all templates →'
 assert more.get_attribute('href').endswith('/templates')
 actors=page.locator('#home-experience-steps .hx-action')
 assert actors.get_attribute('href').endswith('/ai-actors')
 assert actors.inner_text()=='Explore AI presenters →'
 video=page.locator('#adc2-main-nav .nav-item').filter(has=page.get_by_role('button',name='Video',exact=True))
 for name,path in [('AI Twin','/ai-twin'),('Text to Video','/text-to-video')]:
  assert video.locator(f'a[href$="{path}"]').count()==1,name
 page.get_by_role('button',name='Video',exact=True).click()
 assert video.locator('a[href$="/ai-twin"]').is_visible()
 assert video.locator('a[href$="/text-to-video"]').is_visible()
 video.locator('.panel').screenshot(path=str(OUT/'visual-qa/menu-1440.png'))
 page.keyboard.press('Escape')
 report['links']={'threeStepEyebrow':'Image to Video','tools':['/text-to-video','/ai-twin'],'newMenuEntries':2,'templateMore':'/templates','presenter':'/ai-actors'}
 for width in [1440,1100,768,390,360]:
  page.set_viewport_size({'width':width,'height':1000})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 report['responsiveWidths']=[1440,1100,768,390,360]
 report['errors']=errors;report['publicDataRequests']=data
 assert errors==[] and data==[],(errors,data)
 page.set_viewport_size({'width':1440,'height':1000})
 more.click();page.wait_for_load_state('networkidle')
 assert page.url==BASE+'/templates',page.url
 assert page.locator('h1').count()==1
 report['templatesClick']={'finalUrl':page.url,'heading':page.locator('h1').inner_text()}
 page.goto(BASE,wait_until='networkidle')
 page.locator('#home-experience-steps .hx-action').click();page.wait_for_load_state('networkidle')
 assert page.url==BASE+'/ai-video-generation/ai-actors',page.url
 report['actorsClick']={'finalUrl':page.url,'heading':page.locator('h1').inner_text()}
 for path in ['/text-to-video','/ai-twin']:
  result=page.request.get(BASE+path)
  assert result.status==404,(path,result.status)
 report['newPages']='Design-only: no public route implementation; requested local links reserved'
 nojs=b.new_context(java_script_enabled=False)
 s=nojs.new_page();assert s.goto(BASE,wait_until='networkidle').status==200
 assert s.locator('head meta[name=keywords]').count()==1
 assert s.locator('.v1-trust svg').count()==6
 assert s.locator('.adc-thematic-link').count()==6
 assert s.locator('header.site .logo').inner_text()=='AIVIDEOSUGC'
 assert s.locator('footer.site .logo').inner_text()=='AIVIDEOSUGC'
 report['noJavaScript']='keywords, logo, six trust icons, six related-tool links and new navigation in SSR HTML'
 b.close()
report['ok']=True
(OUT/'refinements-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
