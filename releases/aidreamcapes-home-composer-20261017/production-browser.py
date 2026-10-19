import json,pathlib,time,urllib.parse
from playwright.sync_api import sync_playwright
out=pathlib.Path('releases/aidreamcapes-home-composer-20261017');r={'checks':[],'errors':[],'dataRequests':[],'handoffs':[],'cases':[]}
def check(name,passed,detail=None):
 r['checks'].append({'name':name,'pass':bool(passed),'detail':detail})
 if not passed: print('FAIL',name,detail,flush=True)
def flush(): (out/'production-browser.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',proxy={'server':'http://127.0.0.1:10904'})
 for width,js in [(1440,True),(390,True),(390,False)]:
  context=b.new_context(viewport={'width':width,'height':1000 if width>700 else 844},java_script_enabled=js,locale='en-US');page=context.new_page();phase={'public':True};errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def request(req):
   if phase['public'] and req.resource_type in ['xhr','fetch','eventsource'] and '/cdn-cgi/' not in req.url and 'cloudflareinsights.com' not in req.url and '/_next/static/' not in req.url:r['dataRequests'].append(req.url)
  page.on('request',request)
  def guard(route):
   req=route.request
   if req.method not in ['GET','HEAD'] or '/api/' in req.url and any(x in req.url for x in ['quote','reserve','checkout','generat']):return route.abort()
   route.continue_()
  page.route('**/*',guard)
  label=f'{width}-'+('js' if js else 'nojs');page.goto('https://www.aivideosugc.com/',wait_until='domcontentloaded',timeout=120000)
  try:page.wait_for_load_state('networkidle',timeout=15000)
  except Exception:pass
  if js:page.wait_for_selector('[data-home-composer][data-demo-ready=true]',timeout=45000)
  check(label+' SSR composer',page.locator('[data-home-composer]').count()==1)
  check(label+' single H1',page.locator('h1').count()==1)
  check(label+' six added modules retained',page.locator('[data-home-experience]').count()==6)
  check(label+' four format headings',page.locator('.ideas.v-numbered-cards h3').all_text_contents()[:4]==['01URL to Video','02Image to Video','03Text to Video','04AI Video'],page.locator('.ideas.v-numbered-cards h3').all_text_contents()[:4])
  check(label+' six picker steps',page.locator('.hx-six-steps>div').count()==6)
  check(label+' no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  fonts=page.locator('.home-v4').evaluate("""root=>{const ref=getComputedStyle(root.querySelector('.hx-tag')).fontFamily;const targets=[...root.querySelectorAll('.hx-feature h2 em,.v-card-number')].map(e=>({family:getComputedStyle(e).fontFamily,style:getComputedStyle(e).fontStyle}));return {ref,targets}}""")
  check(label+' homepage sans serif matches label',len(fonts['targets'])>=16 and all(t['family']==fonts['ref'] and t['style']=='normal' for t in fonts['targets']),fonts)

  check(label+' nine footer icons',page.locator('[data-social-links] a').count()==9)
  check(label+' footer copyright and social same container',page.locator('[data-social-links]').evaluate('(e)=>e.parentElement.classList.contains("fbottom")'))
  check(label+' old red-box paragraphs removed','Start with a product link, a photo or a written idea.' not in page.locator('main').inner_text())
  check(label+' English source',not page.evaluate('/[\u3400-\u9fff]/.test(document.querySelector("main").textContent)'))
  page.locator('[data-home-composer]').scroll_into_view_if_needed();page.screenshot(path=str(out/f'production-{label}-composer.png'));page.locator('footer.site').scroll_into_view_if_needed();page.screenshot(path=str(out/f'production-{label}-footer.png'))
  if width==390 and js:
   form=page.locator('[data-home-composer]');form.locator('.adc-demo-model summary').click();bounds=form.locator('.adc-demo-model .adc-demo-popover').bounding_box();check('public mobile help inside viewport',bounds['x']>=0 and bounds['x']+bounds['width']<=390,bounds);page.keyboard.press('Escape')
   for mode in ['home','video','images']:
    form=page.locator('[data-home-composer]');form.locator('[data-demo-tab='+mode+']').click();form.locator('textarea').fill('Show my navy travel mug in a bright kitchen.');form.locator('select[name=aspect]').select_option('16:9')
    if mode!='images':form.locator('select[name=duration]').select_option('10');form.locator('select[name=scene]').select_option('process_demo')
    phase['public']=False;form.get_by_role('button',name='Continue in workspace',exact=True).click();page.wait_for_url('**/app/create?**',timeout=90000);page.wait_for_selector('textarea:visible',timeout=45000);query=urllib.parse.parse_qs(urllib.parse.urlparse(page.url).query)
    check('public '+mode+' correct view',query.get('view')==[mode],query);check('public '+mode+' aspect retained',query.get('aspect')==['16:9']);check('public '+mode+' real workspace prompt','Show my navy travel mug in a bright kitchen.'==page.locator('textarea:visible').first.input_value());check('public '+mode+' proper duration',query.get('duration')==(['10'] if mode!='images' else None))
    r['handoffs'].append({'mode':mode,'url':page.url});flush();page.goto('https://www.aivideosugc.com/',wait_until='domcontentloaded',timeout=120000);page.wait_for_selector('[data-demo-ready=true]',timeout=45000);phase['public']=True
  check(label+' no runtime errors',not errors,errors);r['errors']+=errors;r['cases'].append(label);flush();context.close();print(label+' complete',flush=True)
 b.close()
check('no public data requests',not r['dataRequests'],r['dataRequests']);r['ok']=all(c['pass'] for c in r['checks']);flush();print(json.dumps({'ok':r['ok'],'checks':len(r['checks']),'failures':[c for c in r['checks'] if not c['pass']]}));raise SystemExit(0 if r['ok'] else 1)
