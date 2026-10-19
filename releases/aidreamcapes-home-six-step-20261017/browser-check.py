import json,pathlib,sys,urllib.parse
from playwright.sync_api import sync_playwright
production='--production' in sys.argv
out=pathlib.Path('releases/aidreamcapes-home-six-step-20261017')
checks=[];errors=[];requests=[];pending=[]
def check(name,result,detail=None):
 checks.append({'name':name,'pass':bool(result),'detail':detail})
 if not result: print('FAIL',name,detail,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',**({'proxy':{'server':'socks5://127.0.0.1:10905'}} if production else {}))
 for width,js in [(1440,True),(1024,True),(768,True),(390,True),(320,True),(390,False)]:
  ctx=b.new_context(viewport={'width':width,'height':1000},java_script_enabled=js);page=ctx.new_page();phase={'public':True};page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda route:route.abort() if route.request.method not in ['GET','HEAD'] else route.continue_())
  page.on('request',lambda req: requests.append(req.url) if phase['public'] and req.resource_type in ['fetch','xhr','eventsource'] and '/_next/' not in req.url and '/cdn-cgi/' not in req.url and 'cloudflareinsights.com' not in req.url else None)
  url='https://www.aivideosugc.com/' if production else 'http://localhost:3002/site/aidreamcapes'
  page.goto(url,wait_until='networkidle',timeout=120000)
  if js:page.wait_for_selector('[data-hx-ready=true]')
  label=f'{width}-'+('js' if js else 'nojs');root=page.locator('.hx-campaign');cards=root.locator('.hx-process-card')
  check(label+' six visual steps',cards.count()==6)
  check(label+' six matching benefit summaries',root.locator('[data-process-benefit]').count()==6)
  check(label+' all step introductions visible',cards.locator('p:visible').count()==6)
  check(label+' complete SSR without accordion',root.locator('details').count()==0)
  check(label+' six other home modules',page.locator('[data-home-experience]').count()==6)
  check(label+' one H1',page.locator('h1').count()==1)
  check(label+' title exact',page.title()=='AI UGC Video and Image Ads Generator | AivideosUGC',page.title())
  check(label+' description exact',page.locator('meta[name=description]').get_attribute('content')=='Turn product URL, image, or prompt into authentic, high-converting UGC video ads in minutes with Ai video agent and Ai actors ,ready-to-use video templates.',page.locator('meta[name=description]').get_attribute('content'))
  if page.locator('meta[name=keywords]').count():
   check(label+' keywords exact',page.locator('meta[name=keywords]').get_attribute('content')=='AI UGC ads,AI UGC video ads,AI UGC image ads,AI UGC ad Generator,AI Generated UGC ads,AI Actors ads')
  else:pending.append(label+' keywords HTML output awaits shared-layer approval')
  check(label+' no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'))
  clipped=root.evaluate("e=>[...e.querySelectorAll('h3,p,.hx-process-detail')].filter(x=>x.getBoundingClientRect().width&&x.scrollWidth>x.clientWidth+1).map(x=>x.textContent)")
  check(label+' no clipped copy',not clipped,clipped)
  root.locator('img').evaluate_all("imgs=>imgs.forEach(i=>i.loading='eager')")
  page.wait_for_function("[...document.querySelectorAll('.hx-process-card img')].every(i=>i.complete&&i.naturalWidth>0)")
  check(label+' all materials load',cards.locator('img').count()>=6)
  before=page.url
  if js:
   for i in range(6):
    button=cards.nth(i).locator('button');button.click();dialog=root.locator('dialog[open]')
    check(label+f' step {i+1} preview local',dialog.count()==1 and page.url==before)
    check(label+f' step {i+1} matching preview',dialog.locator('h3').inner_text()==cards.nth(i).locator('h3').inner_text().removeprefix(str(i+1).zfill(2)).strip())
    page.keyboard.press('Escape');check(label+f' step {i+1} focus restored',button.evaluate('e=>e===document.activeElement'))
  check(label+' explicit workspace CTA',root.locator('[data-home-cta=primary]').get_attribute('href').find('/app/create?view=batch')>=0)
  root.scroll_into_view_if_needed();page.locator('header.site').evaluate("e=>e.style.visibility='hidden'");root.screenshot(path=str(out/f'{"production" if production else "local"}-{label}.png'))
  if js and width==390:
   phase['public']=False;cta=root.locator('[data-home-cta=primary]');query=urllib.parse.parse_qs(urllib.parse.urlparse(cta.get_attribute('href')).query);cta.click();page.wait_for_url('**/app/create?**',timeout=60000);page.wait_for_selector('textarea:visible',timeout=30000);check(label+' real workspace brief handoff',page.locator('textarea:visible').first.input_value()==query['prompt'][0])
  ctx.close()
 b.close()
check('no page errors',not errors,errors);check('no public runtime data requests',not requests,requests)
report={'ok':all(c['pass'] for c in checks),'checks':checks,'errors':errors,'dataRequests':requests,'pending':pending,'fullyComplete':not pending and all(c['pass'] for c in checks)}
(out/f'{"production" if production else "local"}-browser.json').write_text(json.dumps(report,indent=2));print(json.dumps({'ok':report['ok'],'passed':sum(c['pass'] for c in checks),'total':len(checks)}));sys.exit(0 if report['ok'] else 1)
