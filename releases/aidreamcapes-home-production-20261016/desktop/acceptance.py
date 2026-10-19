import sys, json, re, time, traceback
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urljoin
BASE=Path(__file__).resolve().parent
sys.path.insert(0,str(BASE/'.pydeps'))
from playwright.sync_api import sync_playwright
URL='https://www.aivideosugc.com/?qa=desktop-d2e30400e'
EXE='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
R={'target':URL,'commit':'d2e30400e8d305ec6420cdd999d42e1f7aa8730b','viewport':{'width':1440,'height':1000},'scope':'Real production desktop browser; six added modules and original visualSteps. 38 legacy presets are intentional workspace links. Read-only guest handoffs; no upload, save, generation or payment.','checks':[],'localControls':[],'ctaHandoffs':[],'pageErrors':[],'serverErrors':[],'requestFailures':[],'publicDataRequests':[],'blockedRequests':[],'unexpectedWorkspaceRequests':[],'screenshots':[],'issues':[]}
R['navigationWaitObservations']=[]
S={'phase':'initial','action':'initial'}
def save():
    R['passedCheckCount']=sum(x['pass'] for x in R['checks'])
    R['failedCheckCount']=sum(not x['pass'] for x in R['checks'])
    R['ok']=R['failedCheckCount']==0 and not R['issues']
    (BASE/'desktop-acceptance.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
def check(name,condition,details=None):
    R['checks'].append({'name':name,'pass':bool(condition),'details':details})
def rootname(root): return root.get_attribute('data-home-experience') or root.get_attribute('data-hx-root')
def rootfor(page,name): return page.locator('[data-hx-root="visualSteps"]') if name=='visualSteps' else page.locator('[data-hx-root][data-home-experience='+json.dumps(name)+']')
def snap(root):
    return root.evaluate('''r=>({selected:[...r.querySelectorAll('[data-hx-select-group][aria-pressed="true"]')].map(e=>({group:e.dataset.hxSelectGroup,value:e.dataset.hxSelectValue})),filters:[...r.querySelectorAll('[data-hx-filter][aria-pressed="true"]')].map(e=>e.dataset.hxFilter),panels:[...r.querySelectorAll('[data-hx-panel-group]')].filter(e=>!e.hidden).map(e=>({group:e.dataset.hxPanelGroup,value:e.dataset.hxPanelValue})),images:[...r.querySelectorAll('img')].filter(e=>!e.closest('dialog')&&e.getClientRects().length).map(e=>({src:e.currentSrc||e.src,position:getComputedStyle(e).objectPosition,transform:getComputedStyle(e).transform})),text:r.innerText,ctas:[...r.querySelectorAll('a[data-home-cta]')].filter(e=>e.getClientRects().length).map(e=>({href:e.getAttribute('href'),text:e.innerText,index:[...r.querySelectorAll('a[data-home-cta]')].indexOf(e)}))})''')
def ready(page):
    page.wait_for_function('''()=>{const r=[...document.querySelectorAll('[data-hx-root]')];return r.length===7&&r.every(e=>e.dataset.hxReady==='true')}''',timeout=30000)
def reveal(root,control):
    ancestors=control.evaluate('''e=>{const a=[];for(let p=e.parentElement;p&&!p.hasAttribute('data-hx-root');p=p.parentElement)if(p.hidden&&p.hasAttribute('data-hx-panel-group'))a.unshift({group:p.dataset.hxPanelGroup,value:p.dataset.hxPanelValue});return a}''')
    for a in ancestors:
        group=re.sub('Cta$','',a['group'])
        t=root.locator('[data-hx-select-group='+json.dumps(group)+'][data-hx-select-value='+json.dumps(a['value'])+']').first
        if t.count():
            t.click()
            if root.page.locator('dialog[open]').count(): root.page.keyboard.press('Escape')
    if not control.is_visible():
        allb=root.locator('[data-hx-filter="all"]').first
        if allb.count(): allb.click()
def screenshot(page_or_root,name):
    path=BASE/(name+'.png')
    page_or_root.screenshot(path=str(path),animations='disabled',timeout=30000)
    R['screenshots'].append(str(path))
def setup(browser,nojs=False):
    page=browser.new_page(viewport=R['viewport'],java_script_enabled=not nojs)
    page.on('pageerror',lambda e:R['pageErrors'].append({**S,'message':str(e)}))
    page.on('response',lambda r:R['serverErrors'].append({**S,'url':r.url,'status':r.status}) if r.status>=500 else None)
    page.on('requestfailed',lambda r:R['requestFailures'].append({**S,'url':r.url,'type':r.resource_type,'failure':r.failure}))
    def request(r):
        u=urlparse(r.url)
        if S['phase']=='local' and urlparse(page.url).path=='/':
            if r.resource_type in ['fetch','xhr','eventsource'] or '_rsc' in parse_qs(u.query) or r.headers.get('rsc') or (u.path.startswith('/api/') and r.resource_type!='image'):
                classification='platform' if '/cdn-cgi/' in u.path or re.search(r'analytics|cloudflareinsights|google-analytics',u.netloc) else 'potential-public-data'
                R['publicDataRequests'].append({**S,'url':r.url,'type':r.resource_type,'classification':classification})
            if re.search(r'^/(?:site/aidreamcapes/)?app(?:/|$)',u.path): R['unexpectedWorkspaceRequests'].append({**S,'url':r.url,'type':r.resource_type})
    page.on('request',request)
    def guard(route):
        r=route.request;u=urlparse(r.url)
        supplier=re.search(r'(^|\.)(openai\.com|anthropic\.com|fal\.ai|replicate\.com|runwayml\.com|heygen\.com|elevenlabs\.io|stripe\.com|paypal\.com)$',u.netloc,re.I)
        unsafe=re.search(r'/api/.*(?:quote|reserve|generat|billing|checkout|supplier|provider)',u.path,re.I)
        if r.method not in ['GET','HEAD'] or supplier or unsafe:
            R['blockedRequests'].append({**S,'url':r.url,'method':r.method,'reason':'supplier' if supplier else 'unsafe-api' if unsafe else 'non-GET'})
            route.abort('blockedbyclient')
        else: route.continue_()
    page.route('**/*',guard)
    return page
def inventory(page):
    return page.evaluate('''()=>({title:document.title,h1:[...document.querySelectorAll('h1')].map(e=>e.innerText),legacyScenes:document.querySelectorAll('.v-picker-grid .v-pick-card').length,roots:[...document.querySelectorAll('[data-hx-root]')].map(r=>({name:r.dataset.homeExperience||r.dataset.hxRoot,ready:r.dataset.hxReady,heading:r.querySelector('h2')?.innerText,local:r.querySelectorAll('[data-home-local]:not([data-hx-close])').length,nonCtaLinks:[...r.querySelectorAll('a[href]')].filter(a=>!a.hasAttribute('data-home-cta')&&!a.getAttribute('href').startsWith('#')).map(a=>a.outerHTML),imageLinks:[...r.querySelectorAll('img')].filter(i=>!i.closest('dialog')&&i.closest('a[href]')).map(i=>i.alt)})),layout:{viewport:innerWidth,document:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},visibleHan:document.body.innerText.split('\\n').filter(t=>/[\\u3400-\\u9fff]/.test(t)),internalCopy:document.body.innerText.split('\\n').filter(t=>/SEO strategy|search intent|generation prompt|editing notes|annotation requirement|LivePage|snapshot|relational|SSR-only|data-hx/i.test(t))})''')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=EXE,proxy={'server':'http://127.0.0.1:10904'})
    try:
        S.update(phase='ssr',action='no JavaScript response')
        ssr=setup(browser,True)
        res=ssr.goto(URL,wait_until='domcontentloaded',timeout=90000)
        R['ssr']=inventory(ssr)
        check('No-JavaScript HTTP 200',res.status==200,res.status)
        check('No-JavaScript complete homepage copy',len(R['ssr']['h1'])==1 and len(R['ssr']['roots'])==7 and R['ssr']['legacyScenes']==38,R['ssr'])
        ssr.close()
        page=setup(browser)
        S.update(phase='local',action='initial desktop load')
        res=page.goto(URL,wait_until='domcontentloaded',timeout=90000)
        try: page.wait_for_load_state('networkidle',timeout=15000)
        except Exception as e: R['navigationWaitObservations'].append({'phase':'initial','message':str(e),'interpretation':'Network idle did not settle; wait on explicit seven-controller readiness instead. Not alone a product failure.'})
        ready(page)
        R['inventory']=inventory(page)
        check('Production homepage HTTP 200',res.status==200,res.status)
        check('All seven controllers ready',len(R['inventory']['roots'])==7 and all(r['ready']=='true' for r in R['inventory']['roots']))
        check('Only explicit creation CTAs navigate in seven modules',all(not r['nonCtaLinks'] and not r['imageLinks'] for r in R['inventory']['roots']),R['inventory']['roots'])
        check('Desktop homepage has no horizontal overflow',R['inventory']['layout']['document']<=1441,R['inventory']['layout'])
        check('Public visible copy uses English and no internal instructions',not R['inventory']['visibleHan'] and not R['inventory']['internalCopy'],{'han':R['inventory']['visibleHan'],'internal':R['inventory']['internalCopy']})
        screenshot(page,'desktop-fold')
        cases={}
        for root in page.locator('[data-hx-root]').all():
            name=rootname(root)
            controls=root.locator('[data-home-local]:not([data-hx-close])').all()
            def collect():
                current=snap(root)
                for c in current['ctas']:
                    cases[name+':'+c['href']]={'root':name,**c,'selected':current['selected'],'filters':current['filters']}
            collect()
            for index,control in enumerate(controls):
                meta=control.evaluate('''e=>({key:e.dataset.homeLocal,tag:e.tagName,group:e.dataset.hxSelectGroup,value:e.dataset.hxSelectValue,filter:e.dataset.hxFilter,dialog:e.dataset.hxDialog,href:e.getAttribute('href'),ctaHref:e.dataset.hxCtaHref})''')
                label=f'{name}/{meta["key"]}/{index}'
                S['action']=label
                try:
                    reveal(root,control)
                    if not control.is_visible(): raise Exception('Control cannot be revealed')
                    before=snap(root);before_url=page.url;before_req=len(R['unexpectedWorkspaceRequests'])
                    details_before=control.evaluate('e=>e.tagName==="SUMMARY"?e.closest("details").open:null')
                    keyboard=index%5==0
                    if keyboard:
                        control.scroll_into_view_if_needed();control.focus();control.press('Enter')
                    else: control.click()
                    if meta.get('dialog'):
                        dialog=page.locator('dialog[id='+json.dumps(meta['dialog'].lstrip('#'))+']')
                        dialog.wait_for(state='visible',timeout=5000)
                        facts=dialog.evaluate('''e=>({name:e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim(),focusedInside:e.contains(document.activeElement)})''')
                        check(label+' preview has name and focus',bool(facts['name']) and facts['focusedInside'],facts)
                        if not any(('dialog-'+name+'.png') in f for f in R['screenshots']): screenshot(dialog,'dialog-'+name)
                        page.keyboard.press('Escape');dialog.wait_for(state='hidden',timeout=3000)
                        check(label+' Escape closes and returns focus',control.evaluate('e=>document.activeElement===e'))
                        control.click();dialog.wait_for(state='visible',timeout=3000)
                        close=dialog.locator('[data-hx-close]').first
                        if close.count(): close.click();dialog.wait_for(state='hidden',timeout=3000)
                        else: page.keyboard.press('Escape')
                        check(label+' visible close control closes preview',not dialog.is_visible())
                    if meta.get('group'):
                        group=meta['group'];value=meta['value']
                        buttons=root.locator('[data-hx-select-group='+json.dumps(group)+']').evaluate_all('es=>es.map(e=>({value:e.dataset.hxSelectValue,pressed:e.getAttribute("aria-pressed")}))')
                        check(label+' selected state is exclusive',all(e['pressed']==str(e['value']==value).lower() for e in buttons),buttons)
                        panels=root.locator('[data-hx-panel-group='+json.dumps(group)+']').evaluate_all('es=>es.map(e=>({value:e.dataset.hxPanelValue,hidden:e.hidden}))')
                        check(label+' corresponding panel visible',all(e['hidden']==(e['value']!=value) for e in panels),panels)
                        if group in ['presenter','scene']:
                            main=root.locator('[data-hx-panel-group='+json.dumps(group)+'][data-hx-panel-value='+json.dumps(value)+'] img').first
                            thumb=control.locator('img').first
                            if main.count() and thumb.count(): check(label+' selected image matches thumbnail',main.get_attribute('src')==thumb.get_attribute('src'))
                    if meta.get('filter'):
                        filt=meta['filter'];cards=root.locator('[data-hx-filter-tags]').evaluate_all('es=>es.map(e=>({tags:(e.dataset.hxFilterTags||"").split(/\\s+/),hidden:e.hidden}))')
                        check(label+' category actually filters visible cards',all(e['hidden']==(filt!='all' and filt not in e['tags']) for e in cards),cards)
                        check(label+' category shows selected state',control.get_attribute('aria-pressed')=='true')
                    after=snap(root)
                    if meta['tag']=='SUMMARY': check(label+' details toggles locally',control.evaluate('e=>e.closest("details").open')!=details_before)
                    if meta.get('href','') and meta['href'].startswith('#'): check(label+' scrolls to requested section',urlparse(page.url).fragment==meta['href'][1:])
                    if meta.get('ctaHref'): check(label+' selected style passes its prompt/aspect to CTA',any(c['href']==meta['ctaHref'] for c in after['ctas']))
                    if meta.get('group') and not any(x['group']==meta['group'] and x['value']==meta['value'] for x in before['selected']):
                        visible_before={k:v for k,v in before.items() if k not in ['selected','filters']};visible_after={k:v for k,v in after.items() if k not in ['selected','filters']}
                        check(label+' changes visible content or CTA',visible_after!=visible_before)
                    old=urlparse(before_url);new=urlparse(page.url)
                    check(label+' remains on homepage',(old.scheme,old.netloc,old.path,old.query)==(new.scheme,new.netloc,new.path,new.query))
                    check(label+' does not request workspace',len(R['unexpectedWorkspaceRequests'])==before_req)
                    R['localControls'].append({'root':name,'index':index,**meta,'keyboard':keyboard,'before':before,'after':after})
                    collect()
                except Exception as e:
                    check(label+' completes',False,str(e))
                    if page.locator('dialog[open]').count(): page.keyboard.press('Escape')
                save()
            for img in root.locator('img').all():
                if img.is_visible():
                    img.scroll_into_view_if_needed()
                    try: img.evaluate('e=>e.decode().catch(()=>{})',timeout=10000)
                    except: pass
            screenshot(root,'module-'+name)
            print(json.dumps({'module':name,'controls':len(controls),'failed':R['failedCheckCount']},ensure_ascii=False),flush=True)
            save()
        R['ctaCases']=list(cases.values())
        print(json.dumps({'ctaCases':len(cases)}),flush=True)
        for n,item in enumerate(cases.values()):
            label=f'CTA {item["root"]}/{n}'
            S.update(phase='local',action='restore '+label)
            try:
                page.goto(URL,wait_until='domcontentloaded',timeout=90000);ready(page)
                root=rootfor(page,item['root'])
                for selected in item['selected']:
                    button=root.locator('[data-hx-select-group='+json.dumps(selected['group'])+'][data-hx-select-value='+json.dumps(selected['value'])+']').first
                    reveal(root,button)
                    if button.is_visible() and button.get_attribute('aria-pressed')!='true':
                        button.click()
                        if page.locator('dialog[open]').count(): page.keyboard.press('Escape')
                for filt in item['filters']: root.locator('[data-hx-filter='+json.dumps(filt)+']').first.click()
                cta=root.locator('a[data-home-cta]').nth(item['index']);reveal(root,cta)
                if cta.get_attribute('href')!=item['href']:
                    # An explicit click on the selected style can intentionally replace its default example CTA.
                    for c in root.locator('[data-hx-cta-href]').all():
                        if c.get_attribute('data-hx-cta-href')==item['href']:
                            c.click();break
                check(label+' retains selected destination',cta.get_attribute('href')==item['href'],{'expected':item['href'],'actual':cta.get_attribute('href')})
                S.update(phase='guest',action=label)
                cta.click();page.wait_for_url('**/app/create**',timeout=30000);page.wait_for_load_state('domcontentloaded')
                expected=parse_qs(urlparse(item['href']).query);prompt=expected.get('prompt',[''])[0]
                if prompt:
                    page.wait_for_function('v=>[...document.querySelectorAll("textarea")].some(e=>e.value===v)',arg=prompt,timeout=15000)
                else: page.wait_for_timeout(1200)
                result=page.evaluate('''()=>({url:location.href,active:document.querySelector('aside a[aria-current="page"]')?.getAttribute('href'),textareas:[...document.querySelectorAll('textarea')].map(e=>e.value),inputs:[...document.querySelectorAll('input:not([type="file"])')].map(e=>({type:e.type,value:e.value})),selects:[...document.querySelectorAll('select')].map(e=>({value:e.value,options:[...e.options].map(o=>({value:o.value,text:o.text,selected:o.selected}))})),buttons:[...document.querySelectorAll('button[aria-pressed="true"],button[aria-selected="true"]')].map(e=>e.innerText),layout:{width:innerWidth,document:document.documentElement.scrollWidth},bodyText:document.body.innerText})''')
                check(label+' reaches guest workspace',urlparse(result['url']).path=='/app/create',result['url'])
                actual=parse_qs(urlparse(result['url']).query)
                for key in ['prompt','scene','preset','aspect','duration','tool','tool_id','view']:
                    if key in expected: check(label+' preserves '+key,actual.get(key)==expected[key],{'expected':expected[key],'actual':actual.get(key)})
                if prompt: check(label+' exact selected brief is populated',prompt in result['textareas'])
                if 'preset' in expected: check(label+' preset content is populated',any(len(t)>20 for t in result['textareas']))
                if 'view' in expected and 'preset' not in expected and result.get('active'):
                    check(label+' opens selected workspace tab',parse_qs(urlparse(result['active']).query).get('view')==expected['view'],result['active'])
                if 'aspect' in expected:
                    aspect=expected['aspect'][0]
                    # The selected ratio is visible either in the native select or current control text.
                    ratio_selected=any(s['value']==aspect or any(o['selected'] and aspect in o['text'] for o in s['options']) for s in result['selects']) or aspect in result['bodyText'] or aspect in result['buttons']
                    check(label+' selected aspect is visible in workspace',ratio_selected,{'aspect':aspect,'selects':result['selects'],'buttons':result['buttons']})
                check(label+' desktop workspace has no horizontal overflow',result['layout']['document']<=1441,result['layout'])
                if item['root'] not in [c.get('screenshotRoot') for c in R['ctaHandoffs']]:
                    screenshot(page,'workspace-'+item['root']);result['screenshotRoot']=item['root']
                logos=page.locator('aside a[href="/"], header a[href="/"], a[aria-label*="home" i][href="/"]')
                if not logos.count(): logos=page.locator('a[href="/"]').filter(has=page.locator('img')).first
                if logos.count():
                    S.update(phase='return',action=label+' logo home')
                    logos.first.click();page.wait_for_url('https://www.aivideosugc.com/',timeout=15000)
                    check(label+' workspace top-left logo returns home',urlparse(page.url).path=='/')
                else: check(label+' workspace logo exists',False,'No homepage logo link found')
                R['ctaHandoffs'].append({'root':item['root'],'expectedHref':item['href'],'result':result,'screenshotRoot':result.get('screenshotRoot')})
            except Exception as e:
                check(label+' completes',False,str(e))
                R['ctaHandoffs'].append({'root':item['root'],'expectedHref':item['href'],'error':str(e),'url':page.url})
            print(json.dumps({'cta':n+1,'total':len(cases),'root':item['root'],'failed':sum(not x['pass'] for x in R['checks'])}),flush=True)
            save()
        S.update(phase='local',action='final image load inspection')
        page.goto(URL,wait_until='domcontentloaded',timeout=90000);ready(page)
        for root in page.locator('[data-hx-root]').all():
            root.scroll_into_view_if_needed()
            for img in root.locator('img').all():
                if img.is_visible():
                    try: img.evaluate('e=>e.decode().catch(()=>{})',timeout=10000)
                    except: pass
        R['finalImages']=page.locator('[data-hx-root] img').evaluate_all('es=>es.filter(e=>!e.closest("dialog")&&e.getClientRects().length).map(e=>({src:e.currentSrc||e.src,alt:e.alt,complete:e.complete,width:e.naturalWidth,height:e.naturalHeight}))')
        check('All visible scoped images load',all(i['complete'] and i['width']>0 for i in R['finalImages']),[i for i in R['finalImages'] if not i['complete'] or not i['width']])
        check('No browser page errors',not R['pageErrors'],R['pageErrors'])
        check('No HTTP 5xx responses',not R['serverErrors'],R['serverErrors'])
        check('No public content fetch/XHR/prefetch requests',not [r for r in R['publicDataRequests'] if r['classification']=='potential-public-data'],R['publicDataRequests'])
        check('Local module actions never request workspace',not R['unexpectedWorkspaceRequests'],R['unexpectedWorkspaceRequests'])
        R['completedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    except Exception as e:
        R['fatal']=traceback.format_exc();check('Acceptance run completes',False,str(e))
    finally:
        browser.close();save()
        print(json.dumps({'ok':R['ok'],'passed':R['passedCheckCount'],'failed':R['failedCheckCount'],'localControls':len(R['localControls']),'ctaHandoffs':len(R['ctaHandoffs']),'failures':[c for c in R['checks'] if not c['pass']],'report':str(BASE/'desktop-acceptance.json')},ensure_ascii=False),flush=True)
