import json,pathlib,re,urllib.parse
from playwright.sync_api import sync_playwright
out=pathlib.Path('releases/aidreamcapes-home-campaign-20261017/production');out.mkdir(exist_ok=True);report={'checks':[],'errors':[],'dataRequests':[]}
ref=json.loads(pathlib.Path('/tmp/aidreamcapes-campaign-production-fresh.json').read_text())['contentJson']['sections']['v2_main']['settings']['data']
expectedURL='Turn product URL into AI video for ads, social media and product demonstrations.upload photos and choose your creative direction create product video without arranging a shoot.'
expectedImage='Create AI videos from a single product photo. Add a description to guide the scene and movement, then generate product for ads, social posts and launches without a camera crew.'
expectedAI='Create product videos with AI presenters and generated. Choose a scene, refine your brief, compare shot versions and assemble a video for your product page or social channels.'
def check(name,passed,detail=None):
 report['checks'].append({'name':name,'pass':bool(passed),'detail':detail})
 if not passed:print('FAIL',name,detail,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',proxy={'server':'http://127.0.0.1:10904'})
 for width,js in [(1440,True),(390,True),(390,False)]:
  context=b.new_context(viewport={'width':width,'height':1000 if width>700 else 844},java_script_enabled=js,locale='en-US');page=context.new_page();phase={'public':True};errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def guard(route):
   req=route.request
   if req.method not in ['GET','HEAD']:return route.abort()
   route.continue_()
  page.route('**/*',guard)
  page.on('request',lambda req:report['dataRequests'].append(req.url) if phase['public'] and req.resource_type in ['fetch','xhr','eventsource'] and '/_next/' not in req.url and '/cdn-cgi/' not in req.url and 'cloudflareinsights.com' not in req.url else None)
  page.goto('https://www.aivideosugc.com/',wait_until='domcontentloaded',timeout=120000)
  try:page.wait_for_load_state('networkidle',timeout=15000)
  except Exception:pass
  if js:page.wait_for_selector('[data-hx-ready=true]')
  label=str(width)+('-js' if js else '-nojs');campaign=page.locator('.hx-campaign')
  check(label+' six benefits',campaign.locator('[data-relocated-benefits] article').count()==6)
  check(label+' six workflow steps',campaign.locator('[data-relocated-workflow] li').count()==6)
  for item in ref['benefits']:
   check(label+' benefit moved once '+item['t'],page.get_by_role('heading',name=item['t'],exact=True).count()==1)
   target=campaign.locator('[data-relocated-benefits] article').filter(has=page.get_by_role('heading',name=item['t'],exact=True))
   plain=re.sub(r'\[([^\]]+)\]\([^)]+\)',r'\1',item['d']);check(label+' benefit copy '+item['t'],target.locator('p').inner_text()==plain)
  for item in ref['more_sections'][0]['items']:
   target=campaign.locator('[data-relocated-workflow] li').filter(has=page.get_by_role('heading',name=re.compile(re.escape(item['t'])+'$')))
   check(label+' workflow copy '+item['t'],target.count()==1 and target.locator('p').text_content()==item['d'])
   check(label+' no duplicate workflow heading '+item['t'],page.get_by_role('heading',name=re.compile(re.escape(item['t'])+'$')).count()==1)
  check(label+' original standalone benefits section removed',page.get_by_role('heading',name=ref['benefitsH2'],exact=True).count()==1 and campaign.get_by_role('heading',name=ref['benefitsH2'],exact=True).count()==1)
  check(label+' original standalone workflow removed',page.get_by_role('heading',name=ref['more_sections'][0]['h2'],exact=True).count()==1)
  check(label+' three original image previews retained',campaign.locator('.hx-campaign-examples .hx-draft').count()==3 and campaign.locator('.hx-campaign-examples img').count()==3)
  check(label+' preview filters and dialogs retained',campaign.locator('.hx-library-filter button').count()==3 and campaign.locator('dialog').count()==3)
  cards=page.locator('.ideas.v-numbered-cards>div');check(label+' exact URL to Video',cards.nth(0).locator('p').inner_text()==expectedURL);check(label+' exact Image to Video',cards.nth(1).locator('p').inner_text()==expectedImage);check(label+' exact AI Video',cards.nth(3).locator('p').inner_text()==expectedAI)
  check(label+' six other homepage modules retained',page.locator('[data-home-experience]').count()==6)
  check(label+' single H1',page.locator('h1').count()==1)
  check(label+' English copy',not page.evaluate('/[\u3400-\u9fff]/.test(document.querySelector("main").textContent)'))
  check(label+' no page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  layout=campaign.evaluate('''root=>{const l=root.querySelector('.hx-campaign-summary').getBoundingClientRect(),r=root.querySelector('.hx-campaign-workflow').getBoundingClientRect();const clipped=[...root.querySelectorAll('article,li,h3,p')].filter(e=>e.getBoundingClientRect().width>0&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent);return {left:{x:l.x,y:l.y,width:l.width,height:l.height},right:{x:r.x,y:r.y,width:r.width,height:r.height},clipped}}''')
  check(label+' columns and responsive stack',layout['right']['x']>layout['left']['x']+layout['left']['width'] if width>1240 else layout['right']['y']>=layout['left']['y']+layout['left']['height'],layout)
  check(label+' no clipped card text',not layout['clipped'],layout['clipped'])
  campaign.locator('.hx-campaign-examples img').evaluate_all("imgs=>imgs.forEach(i=>i.loading='eager')");page.wait_for_function("[...document.querySelectorAll('.hx-campaign-examples img')].every(i=>i.complete&&i.naturalWidth>0)",timeout=30000)
  campaign.scroll_into_view_if_needed();page.locator('header.site').evaluate("e=>e.style.visibility='hidden'");campaign.screenshot(path=str(out/f'{label}-campaign.png'))
  page.locator('.ideas.v-numbered-cards').scroll_into_view_if_needed();page.screenshot(path=str(out/f'{label}-formats.png'))
  page.locator('header.site').evaluate("e=>e.style.visibility=''")
  check(label+' benefit links preserved',campaign.locator('[data-relocated-benefits] a').count()==3)
  initial=page.url
  steps=campaign.locator('[data-relocated-workflow] details');check(label+' six native workflow disclosures',steps.count()==6)
  for i in range(6):
   step=steps.nth(i)
   if step.get_attribute('open') is None:step.locator('summary').click()
   check(label+' step '+str(i+1)+' opens locally',step.locator('p').is_visible() and page.url==initial)
   check(label+' step '+str(i+1)+' complete visible copy',step.locator('p').inner_text()==ref['more_sections'][0]['items'][i]['d'])
   check(label+' only one step expanded',campaign.locator('[data-relocated-workflow] details[open]').count()==1)
  steps.nth(0).locator('summary').click()
  if js:
   initial=page.url
   for key in ['draftDetails','draftPresenter','draftLaunch']:
    campaign.locator('[data-hx-select-value='+key+']').click();dialog=campaign.locator('dialog[open]');check(label+' '+key+' opens preview locally',dialog.count()==1 and page.url==initial);check(label+' '+key+' selected',campaign.locator('[data-hx-select-value='+key+']').get_attribute('aria-pressed')=='true');page.keyboard.press('Escape');check(label+' '+key+' Escape closes dialog',campaign.locator('dialog[open]').count()==0)
   campaign.locator('[data-hx-filter=presenter]').click();check(label+' presenter filter stays local',campaign.locator('.hx-campaign-examples .hx-draft:visible').count()==1 and page.url==initial)
   campaign.locator('[data-hx-filter=product]').click();check(label+' product filter stays local',campaign.locator('.hx-campaign-examples .hx-draft:visible').count()==2 and page.url==initial)
   campaign.locator('[data-hx-filter=all]').click();check(label+' all original images restored',campaign.locator('.hx-campaign-examples .hx-draft:visible').count()==3)
  grid=campaign.locator('[data-relocated-benefits]').evaluate("e=>getComputedStyle(e).gridTemplateColumns");check(label+' benefit copy uses responsive columns',len(grid.split())==(2 if width>600 else 1),grid)
  alignment=campaign.locator('[data-relocated-benefits]').evaluate("e=>{let a=[...e.querySelectorAll('article')];return a.map(x=>({h:x.querySelector('h3').getBoundingClientRect().y,p:x.querySelector('p').getBoundingClientRect().y}))}");check(label+' paired paragraph baselines align',all(abs(alignment[i]['p']-alignment[i+1]['p'])<=1 for i in [0,2,4]) if width>600 else True,alignment)
  cta=campaign.get_by_role('link',name='Create batch drafts →',exact=True);query=urllib.parse.parse_qs(urllib.parse.urlparse(cta.get_attribute('href')).query);check(label+' batch CTA keeps destination',query.get('view')==['batch'] and bool(query.get('prompt')))
  if width==390 and js:
   phase['public']=False;cta.click();page.wait_for_url('**/app/create?**',timeout=60000);page.wait_for_selector('textarea:visible',timeout=30000);check('batch actual workspace handoff',page.locator('textarea:visible').first.input_value()==query['prompt'][0]);report['handoff']=page.url
  check(label+' no browser errors',not errors,errors);report['errors']+=errors;context.close();print(label+' done',flush=True)
 b.close()
check('no public content fetch',not report['dataRequests'],report['dataRequests']);report['ok']=all(c['pass'] for c in report['checks']);(out/'browser-check.json').write_text(json.dumps(report,indent=2));print(json.dumps({'ok':report['ok'],'checks':len(report['checks']),'failed':[c['name'] for c in report['checks'] if not c['pass']]}));raise SystemExit(0 if report['ok'] else 1)
