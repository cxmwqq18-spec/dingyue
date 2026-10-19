import json, pathlib, urllib.parse, re
from playwright.sync_api import sync_playwright
out=pathlib.Path('releases/aidreamcapes-home-composer-20261017'); report={'checks':[],'errors':[],'handoffs':[],'screenshots':[],'public_data_requests':[]}
def check(name,condition,detail=None):
 report['checks'].append({'name':name,'pass':bool(condition),'detail':detail})
 if not condition: print('FAIL',name,detail,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path="/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")
 for width in [1440,768,390,375]:
  context=browser.new_context(viewport={'width':width,'height':1000 if width>700 else 844})
  page=context.new_page(); page.on('pageerror',lambda e:report['errors'].append(str(e)))
  phase={'public':True}
  def route_guard(route):
   req=route.request
   if req.method not in ['GET','HEAD'] or '/api/' in req.url and any(s in req.url for s in ['generat','quote','reserve','checkout']): return route.abort()
   route.continue_()
  page.route('**/*',route_guard)
  def request_event(req):
   if phase['public'] and req.resource_type in ['fetch','xhr','eventsource'] and '/_next/' not in req.url and '__nextjs' not in req.url:
    report['public_data_requests'].append(req.url)
  page.on('request',request_event)
  page.goto('http://localhost:3002/site/aidreamcapes',wait_until='networkidle',timeout=90000)
  page.wait_for_selector('[data-home-composer][data-demo-ready=true]')
  form=page.locator('[data-home-composer]')
  check(f'{width} only first intro retained','Start with a product link, a photo or a written idea.' not in page.locator('main').inner_text())
  check(f'{width} four English formats',page.locator('.ideas h3').all_text_contents()[:4]==['01URL to Video','02Image to Video','03Text to Video','04AI Video'] or all(t in page.locator('main').inner_text() for t in ['URL to Video','Image to Video','Text to Video','AI Video']))
  check(f'{width} six scene steps',page.locator('.hx-six-steps>div').count()==6)
  check(f'{width} six workflow cards',page.get_by_role('heading',name=re.compile('Generate shots and assemble your video')).count()>=1)
  check(f'{width} no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  check(f'{width} dark editor',form.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(17, 17, 20)')
  form.scroll_into_view_if_needed();page.screenshot(path=str(out/f'{width}-composer.png'));report['screenshots'].append(f'{width}-composer.png')
  page.locator('[data-home-experience=picker] img').evaluate_all("es=>es.forEach(e=>e.loading='eager')");page.wait_for_function("[...document.querySelectorAll('[data-home-experience=picker] img')].every(e=>e.complete&&e.naturalWidth>0)");page.locator('[data-home-experience=picker]').screenshot(path=str(out/f'{width}-scene-six-steps.png'))
  footer=page.locator('footer.site');footer.scroll_into_view_if_needed();page.screenshot(path=str(out/f'{width}-footer.png'))
  socials=page.locator('[data-social-links]')
  check(f'{width} nine footer icons',socials.locator('a').count()==9)
  check(f'{width} same footer row container',socials.evaluate('(e)=>e.parentElement.classList.contains("fbottom")'))
  bounds=socials.bounding_box();check(f'{width} centered footer icons',abs(bounds['x']+bounds['width']/2-width/2)<2, bounds)
  if width==1440:
   rows=page.locator('.fbottom').evaluate('(e)=>[...e.children].map(x=>({top:x.getBoundingClientRect().top,bottom:x.getBoundingClientRect().bottom}))')
   check('desktop all footer items on one row',max(x['top'] for x in rows)<min(x['bottom'] for x in rows),rows)
  if width in [1440,390]:
   for mode in ['home','video','images']:
    phase['public']=True;form.scroll_into_view_if_needed()
    form.locator('[data-demo-tab='+mode+']').click()
    check(f'{width} {mode} mode stays homepage',page.url=='http://localhost:3002/site/aidreamcapes')
    form.locator('textarea').fill('Show my travel mug by a sunny kitchen window.')
    check(f'{width} live character count',form.locator('[data-demo-count]').inner_text()==str(len('Show my travel mug by a sunny kitchen window.')))
    form.locator('.adc-demo-product summary').click();form.locator('[data-demo-product]').fill('Navy insulated mug, 500 ml');page.keyboard.press('Escape')
    form.locator('select[name=aspect]').select_option('16:9')
    if mode!='images':
     form.locator('select[name=duration]').select_option('10');form.locator('select[name=scene]').select_option('process_demo')
    check(f'{width} {mode} duration visibility',form.locator('[data-demo-duration]').is_visible()==(mode!='images'))
    form.locator('.adc-demo-model summary').click();check(f'{width} model explanation',form.locator('.adc-demo-model[open]').count()==1);page.keyboard.press('Escape')
    phase['public']=False
    form.get_by_role('button',name='Continue in workspace',exact=True).click();page.wait_for_url('**/app/create?**',timeout=60000);page.wait_for_load_state('networkidle',timeout=60000)
    query=urllib.parse.parse_qs(urllib.parse.urlparse(page.url).query)
    check(f'{width} {mode} real destination',urllib.parse.urlparse(page.url).path=='/site/aidreamcapes/app/create')
    check(f'{width} {mode} view preserved',query.get('view')==[mode],query)
    check(f'{width} {mode} prompt and product preserved',[x.replace('\r\n','\n') for x in query.get('prompt',[])]==['Show my travel mug by a sunny kitchen window.\n\nNavy insulated mug, 500 ml'],query)
    check(f'{width} {mode} aspect preserved',query.get('aspect')==['16:9'])
    if mode!='images':check(f'{width} {mode} duration preserved',query.get('duration')==['10'])
    else:check(f'{width} image tool preserved',query.get('tool_id')==['image_generator'] and query.get('tool')==['custom'] and 'duration' not in query)
    prompt=page.get_by_role('textbox').filter(visible=True) if False else page.locator('textarea:visible').first
    check(f'{width} {mode} workspace text filled', 'Show my travel mug' in prompt.input_value() and '500 ml' in prompt.input_value(),prompt.input_value())
    report['handoffs'].append({'width':width,'mode':mode,'url':page.url() if callable(page.url) else page.url})
    page.goto('http://localhost:3002/site/aidreamcapes',wait_until='networkidle',timeout=90000);page.wait_for_selector('[data-demo-ready=true]');form=page.locator('[data-home-composer]');phase['public']=True
  context.close();print(f'{width}: completed',flush=True)
 context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});page=context.new_page();page.goto('http://localhost:3002/site/aidreamcapes',wait_until='networkidle',timeout=90000)
 check('no-JS full form SSR',page.locator('[data-home-composer] textarea').count()==1 and page.locator('[data-demo-tab]').count()==3)
 check('no-JS six steps SSR',page.locator('.hx-six-steps>div').count()==6)
 check('no-JS native GET form',page.locator('[data-home-composer]').get_attribute('method')=='get')
 browser.close()
check('no runtime errors',len(report['errors'])==0,report['errors']);check('no public data requests',len(report['public_data_requests'])==0,report['public_data_requests'])
report['ok']=all(x['pass'] for x in report['checks']);(out/'browser-acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'ok':report['ok'],'checks':len(report['checks']),'failures':[c for c in report['checks'] if not c['pass']]},ensure_ascii=False));raise SystemExit(0 if report['ok'] else 1)
