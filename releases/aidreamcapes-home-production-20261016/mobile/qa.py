import json,re,time,traceback,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

OUT=Path(__file__).parent
URL='https://www.aivideosugc.com/?qa=mobile-d2e30400e'
EXE='/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
REPORT={'url':URL,'commit':'d2e30400e8d305ec6420cdd999d42e1f7aa8730b','translationScope':'Structural simulation of Chrome nested font DOM replacement after React hydration and seven data-hx-ready roots. Original text retained; not the native Chrome translation service.','checks':[],'observations':[],'pageErrors':[],'serverErrors':[],'publicDataRequests':[],'auxiliaryRequests':[],'blockedRequests':[],'requestFailures':[],'screenshots':[],'runs':[]}
STATE={'width':None,'action':'initial','public':True,'translated':False}
if os.environ.get('QA_RESUME'):
    REPORT=json.loads((OUT/'mobile-qa.json').read_text())
    (OUT/'mobile-initial-run.json').write_text(json.dumps(REPORT,indent=2,ensure_ascii=False))
    if REPORT.get('fatal'):
        REPORT.setdefault('infrastructureNotes',[]).append({'reason':'768px navigation networkidle timeout; responsive controls were not reached. Retrying using DOMContentLoaded plus explicit hydration readiness after bounded networkidle wait.','original':REPORT.pop('fatal')})

def flush():
    REPORT['passed']=sum(x['ok'] for x in REPORT['checks'])
    REPORT['failed']=sum(not x['ok'] for x in REPORT['checks'])
    (OUT/'mobile-qa.json').write_text(json.dumps(REPORT,indent=2,ensure_ascii=False))

def check(label,ok,facts=None):
    item={**STATE,'label':label,'ok':bool(ok)}
    if facts is not None:item['facts']=facts
    REPORT['checks'].append(item)
    if not ok: print('FAIL',label,json.dumps(facts,ensure_ascii=False),flush=True)
    return ok

def shot(page,name,locator=None):
    path=OUT/(str(STATE['width'])+'-'+('translated-' if STATE['translated'] else '')+name+'.png')
    if locator: locator.screenshot(path=str(path),timeout=20000,style='header.site {visibility:hidden!important}')
    else: page.screenshot(path=str(path),full_page=False)
    REPORT['screenshots'].append(str(path.relative_to(OUT)))
    return path.name

def watch(page):
    page.on('pageerror',lambda e:REPORT['pageErrors'].append({**STATE,'message':str(e)}))
    page.on('response',lambda r:REPORT['serverErrors'].append({**STATE,'url':r.url,'status':r.status}) if r.status>=500 else None)
    page.on('requestfailed',lambda r:REPORT['requestFailures'].append({**STATE,'url':r.url,'type':r.resource_type,'error':r.failure}))
    def request(req):
        u=urlparse(req.url)
        if not STATE['public']:return
        if req.resource_type in ('fetch','xhr','eventsource') or '_rsc' in u.query or req.headers.get('rsc'):
            item={**STATE,'url':req.url,'type':req.resource_type,'method':req.method}
            if u.hostname=='www.aivideosugc.com' and not u.path.startswith('/cdn-cgi/'):
                REPORT['publicDataRequests'].append(item)
            else:REPORT['auxiliaryRequests'].append(item)
    page.on('request',request)
    def guard(route):
        req=route.request;u=urlparse(req.url)
        supplier=bool(re.search(r'(^|\.)(openai\.com|anthropic\.com|fal\.ai|replicate\.com|runwayml\.com|heygen\.com|elevenlabs\.io|stripe\.com|paypal\.com)$',u.hostname or '',re.I))
        unsafe='/api/' in u.path and bool(re.search('quote|reserve|generat|billing|checkout|supplier|provider',u.path,re.I))
        if req.method not in ('GET','HEAD') or supplier or unsafe:
            REPORT['blockedRequests'].append({**STATE,'url':req.url,'method':req.method,'supplier':supplier,'unsafeApi':unsafe})
            route.abort('blockedbyclient')
        else:route.continue_()
    page.route('**/*',guard)

def ready(page):
    page.wait_for_function('''() => {const pricing=document.querySelector('.v2-pricing-periods button'),roots=[...document.querySelectorAll('[data-hx-root]')]; return pricing&&Object.keys(pricing).some(k=>k.startsWith('__reactProps$'))&&roots.length===7&&roots.every(r=>r.dataset.hxReady==='true')}''',timeout=30000)
    check('pricing hydrated and seven local controllers ready',True)

TRANSLATE='''() => {const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode()){const n=w.currentNode;if(n.textContent.trim()&&!n.parentElement.closest('script,style,textarea,option,input,svg,font,[translate="no"]'))nodes.push(n)}for(const n of nodes){const a=document.createElement('font'),b=document.createElement('font');a.style.verticalAlign=b.style.verticalAlign='inherit';b.textContent=n.textContent;a.appendChild(b);n.parentNode.replaceChild(a,n)}return {replaced:nodes.length,nested:document.querySelectorAll('font font').length}}'''

def layout(page,label):
    facts=page.evaluate('''() => ({width:innerWidth,document:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main h1,main h2,main h3,[data-hx-root] button,[data-hx-root] a,.v2-pricing-card')].filter(e=>e.getClientRects().length).map(e=>({tag:e.tagName,text:e.textContent.trim().slice(0,90),l:e.getBoundingClientRect().left,r:e.getBoundingClientRect().right})).filter(e=>e.l < -1 || e.r > innerWidth+1)})''')
    check(label+' horizontal overflow',facts['document']<=facts['width']+1 and not facts['overflow'],facts)
    return facts

def pricing(page):
    root=page.locator('#pricing')
    for period,amounts,credits in [('Monthly',['$24.50','$35','$63'],['200 credits / month','300 credits / month','600 credits / month']),('Yearly',['$147','$210','$378'],['2,400 credits / year','3,600 credits / year','7,200 credits / year']),('Monthly',['$24.50','$35','$63'],['200 credits / month','300 credits / month','600 credits / month'])]:
        STATE['action']='pricing '+period
        root.get_by_role('button',name=period,exact=True).click()
        page.wait_for_timeout(100)
        a=root.locator('.v2-pricing-amount strong').all_text_contents()
        c=root.locator('.v2-pricing-credits').all_text_contents()
        check(period+' price amounts',a==amounts,a)
        check(period+' included credits',c==credits,c)
        pressed=root.get_by_role('button',name=period,exact=True).get_attribute('aria-pressed')
        check(period+' selected feedback',pressed=='true',pressed)
        ctas=root.locator('.v2-pricing-cta').evaluate_all('(els)=>els.map(e=>({text:e.textContent,disabled:e.disabled,href:e.getAttribute("href"),aria:e.getAttribute("aria-disabled")}))')
        check(period+' checkout remains unavailable',len(ctas)==3 and all(c['disabled'] or c['aria']=='true' for c in ctas),ctas)
        if period=='Yearly':shot(page,'pricing-yearly',root)
    shot(page,'pricing-monthly',root)
    layout(page,'pricing')

def menus(page):
    STATE['action']='mobile menu keyboard'
    page.evaluate('scrollTo(0,0)')
    toggle=page.locator('#adc2-menu-toggle');nav=page.locator('#adc2-main-nav')
    toggle.focus();toggle.press('Enter')
    check('menu Enter opens',toggle.get_attribute('aria-expanded')=='true' and nav.is_visible())
    shot(page,'menu-open')
    for i,btn in enumerate(nav.locator('button.nav-btn').all()):
        btn.focus();btn.press('Enter')
        check('menu '+str(i)+' keyboard submenu opens',btn.get_attribute('aria-expanded')=='true')
        panel=btn.locator('..').locator('.panel')
        check('menu '+str(i)+' panel fits viewport',panel.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1}'))
        if i==0:shot(page,'menu-video')
        page.keyboard.press('Escape')
        check('menu '+str(i)+' Escape closes submenu',btn.get_attribute('aria-expanded')=='false')
    page.keyboard.press('Escape')
    if toggle.get_attribute('aria-expanded')=='true':
        evidence=shot(page,'menu-after-escape')
        REPORT['observations'].append({**STATE,'severity':'P2','title':'Escape closes submenus but leaves top-level mobile navigation open','steps':['Focus Open menu and press Enter','Press Escape'],'actual':'aria-expanded remains true and main navigation stays visible; pressing menu toggle closes it.','evidence':evidence})
    toggle.focus();toggle.press('Space')
    check('menu Space closes',toggle.get_attribute('aria-expanded')=='false' and not nav.is_visible())
    toggle.click();toggle.click()
    check('menu touch/click opens and closes',toggle.get_attribute('aria-expanded')=='false' and not nav.is_visible())

def reveal(root,control,page):
    ancestors=control.evaluate('''n=>{const out=[];for(let e=n.parentElement;e&&!e.hasAttribute('data-hx-root');e=e.parentElement)if(e.hidden&&e.hasAttribute('data-hx-panel-group'))out.unshift({group:e.dataset.hxPanelGroup,value:e.dataset.hxPanelValue});return out}''')
    for a in ancestors:
        group=re.sub('Cta$','',a['group'])
        trigger=root.locator('[data-hx-select-group='+json.dumps(group)+'][data-hx-select-value='+json.dumps(a['value'])+']').first
        if trigger.count():
            trigger.click()
            if page.locator('dialog[open]').count():page.keyboard.press('Escape')
    if not control.is_visible():
        allbtn=root.locator('[data-hx-filter="all"]').first
        if allbtn.count():allbtn.click()

def dialog_check(page,control,meta,name):
    dialog=page.locator('dialog[id='+json.dumps(meta['dialog'].lstrip('#'))+']')
    dialog.wait_for(state='visible',timeout=5000)
    facts=dialog.evaluate('''e=>({title:e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' '),focus:e.contains(document.activeElement),w:e.clientWidth,scroll:e.scrollWidth,rect:{l:e.getBoundingClientRect().left,r:e.getBoundingClientRect().right},images:[...e.querySelectorAll('img')].map(i=>({natural:i.naturalWidth,w:i.clientWidth,h:i.clientHeight,fit:getComputedStyle(i).objectFit}))})''')
    check(name+' named modal and focus',bool(facts['title'].strip()) and facts['focus'],facts)
    check(name+' modal fits viewport',facts['scroll']<=facts['w']+1 and facts['rect']['l']>=-1 and facts['rect']['r']<=STATE['width']+1,facts)
    page.keyboard.press('Escape');dialog.wait_for(state='hidden')
    check(name+' Escape returns focus',control.evaluate('(e)=>e===document.activeElement'))
    control.click();dialog.wait_for(state='visible')
    dialog.locator('[data-hx-close]').first.click();dialog.wait_for(state='hidden')
    check(name+' Close button works',True)

def local_controls(page,all_controls=True):
    for root in page.locator('[data-hx-root]').all():
        name=root.get_attribute('data-home-experience') or root.get_attribute('data-hx-root')
        controls=root.locator('[data-home-local]:not([data-hx-close])').all()
        tested=0
        for index,control in enumerate(controls):
            meta=control.evaluate('''e=>({key:e.dataset.homeLocal,tag:e.tagName,group:e.dataset.hxSelectGroup,value:e.dataset.hxSelectValue,filter:e.dataset.hxFilter,dialog:e.dataset.hxDialog,href:e.getAttribute('href')})''')
            if not all_controls and index>2:continue
            STATE['action']=name+'/'+meta['key']
            label=name+'/'+meta['key']
            try:
                reveal(root,control,page)
                if not control.is_visible():
                    check(label+' revealed',False);continue
                before_url=page.url
                before=control.evaluate('(e)=>e.tagName==="SUMMARY"?e.closest("details").open:null')
                if index%5==0:
                    control.scroll_into_view_if_needed();control.focus();control.press('Enter')
                else:control.click()
                if meta.get('dialog'):dialog_check(page,control,meta,label)
                if meta.get('group'):
                    group,value=meta['group'],meta['value']
                    selected=root.locator('[data-hx-select-group='+json.dumps(group)+']').evaluate_all('(els)=>els.map(e=>({v:e.dataset.hxSelectValue,p:e.getAttribute("aria-pressed")}))')
                    check(label+' selection feedback',all(x['p']==str(x['v']==value).lower() for x in selected),selected)
                    panels=root.locator('[data-hx-panel-group='+json.dumps(group)+']').evaluate_all('(els)=>els.map(e=>({v:e.dataset.hxPanelValue,h:e.hidden}))')
                    check(label+' selected panel',all(x['h']==(x['v']!=value) for x in panels),panels)
                    if group in ['scene','presenter']:
                        selected_img=root.locator('[data-hx-panel-group='+json.dumps(group)+'][data-hx-panel-value='+json.dumps(value)+'] img').first.get_attribute('src')
                        check(label+' selected image matches',selected_img==control.locator('img').first.get_attribute('src'))
                if meta.get('filter'):
                    f=meta['filter'];cards=root.locator('[data-hx-filter-tags]').evaluate_all('(els)=>els.map(e=>({tags:e.dataset.hxFilterTags.split(/\\s+/),h:e.hidden}))')
                    check(label+' true filtering',all(x['h']==(f!='all' and f not in x['tags']) for x in cards),cards)
                    check(label+' selected filter',control.get_attribute('aria-pressed')=='true')
                if meta['tag']=='SUMMARY':check(label+' details toggle',control.evaluate('(e)=>e.closest("details").open')!=before)
                before=urlparse(before_url);after=urlparse(page.url)
                check(label+' stays local',before.scheme==after.scheme and before.netloc==after.netloc and before.path==after.path and before.query==after.query)
                tested+=1
            except Exception as e:
                check(label+' interaction',False,str(e));shot(page,'failure-'+name+'-'+str(index))
        if root.locator('[data-hx-filter="all"]').count():root.locator('[data-hx-filter="all"]').click()
        if name=='picker':
            grid=root.locator('.hx-scene-grid').evaluate('(e)=>({columns:getComputedStyle(e).gridTemplateColumns,count:[...e.children].filter(c=>!c.hidden).length})')
            check('scene grid responsive columns',len(grid['columns'].split())==(2 if STATE['width']<=700 else 3),grid)
            footer=root.locator('.hx-selector-footer:not([hidden])')
            check('one selected scene footer',footer.count()==1)
        root.scroll_into_view_if_needed()
        for im in root.locator('img').all():
            if im.is_visible():
                try:im.evaluate('(e)=>e.decode().catch(()=>{})',timeout=10000)
                except Exception:pass
        shot(page,'module-'+name,root)
        if name in ['hero','picker','audience','reviews']:
            ctrl=root.locator('[data-hx-dialog]:visible').first
            if ctrl.count():
                ctrl.click();dlg=page.locator('dialog[open]');dlg.wait_for(state='visible')
                for im in dlg.locator('img').all():
                    try:im.evaluate('(e)=>e.decode().catch(()=>{})',timeout=10000)
                    except Exception:pass
                shot(page,'dialog-'+name,dlg)
                page.keyboard.press('Escape')
        layout(page,'after '+name)
        print(str(STATE['width'])+' '+name+': '+str(tested)+' controls tested',flush=True);flush()

def faqs(page):
    for i,summary in enumerate(page.locator('details:not(.hx-voice-details) > summary').all()):
        STATE['action']='FAQ '+str(i)
        before=summary.evaluate('(e)=>e.parentElement.open')
        summary.click()
        check('FAQ '+str(i)+' toggles',summary.evaluate('(e)=>e.parentElement.open')!=before)
        if not before:check('FAQ '+str(i)+' answer readable',bool(summary.locator('..').inner_text().strip()))
        summary.click()
    shot(page,'faq',page.locator('details:not(.hx-voice-details)').first.locator('..'))

EXPECTED=[['Facebook','https://www.facebook.com/AiVideosUGC/'],['Instagram','https://www.instagram.com/aivideosugc/'],['Pinterest','https://www.pinterest.com/AiVideosUGC/'],['X','https://x.com/AiVideosUGC'],['YouTube','https://www.youtube.com/@AiVideosUGC'],['TikTok','https://www.tiktok.com/@aivideosugc'],['Reddit','https://www.reddit.com/user/AiVideosUGC/'],['WhatsApp','https://whatsapp.com/channel/0029VbEAEkJKbYMG01djdZ36'],['Discord','https://discord.gg/F52827j3Nm']]
def socials(page):
    links=page.locator('[data-social-links] a').evaluate_all('(els)=>els.map(e=>({text:e.textContent.trim(),href:e.getAttribute("href"),target:e.target,rel:e.rel,svg:e.querySelectorAll("svg").length}))')
    check('nine social hrefs exact',[[x['text'],x['href']] for x in links]==EXPECTED,links)
    check('social logos and safe targets',len(links)==9 and all(x['svg']==1 and x['target']=='_blank' and set(x['rel'].split())=={'noopener','noreferrer'} for x in links))
    shot(page,'footer',page.locator('footer'))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=EXE,proxy={'server':'http://127.0.0.1:10904'})
    try:
        for width in [int(x) for x in os.environ.get('QA_WIDTHS','390,375,768').split(',')]:
            STATE.update(width=width,action='load',public=True,translated=False)
            context=browser.new_context(viewport={'width':width,'height':844 if width<768 else 1024},is_mobile=True,has_touch=True,device_scale_factor=1)
            page=context.new_page();watch(page)
            response=page.goto(URL,wait_until='domcontentloaded',timeout=90000)
            try:page.wait_for_load_state('networkidle',timeout=20000)
            except Exception as e:REPORT.setdefault('infrastructureNotes',[]).append({**STATE,'networkidle':str(e),'readiness':'explicit React hydration and seven controller readiness checked next'})
            check('home HTTP 200',response.status==200,response.status);ready(page)
            REPORT['runs'].append({'width':width,'response':response.status,'initialLayout':layout(page,'initial')})
            shot(page,'home')
            menus(page);pricing(page)
            if width==390:
                STATE['action']='translation structure simulation'
                facts=page.evaluate(TRANSLATE);STATE['translated']=True
                REPORT['runs'][-1]['translation']=facts;check('nested font translation injected',facts['nested']>100,facts)
                menus(page);pricing(page)
            local_controls(page,all_controls=width!=768)
            faqs(page);socials(page)
            layout(page,'complete')
            context.close();flush()
        STATE.update(width=375,translated=False,action='no-JS SSR')
        context=browser.new_context(viewport={'width':375,'height':844},java_script_enabled=False,is_mobile=True,has_touch=True)
        page=context.new_page();watch(page)
        r=page.goto(URL,wait_until='domcontentloaded',timeout=90000)
        check('no-JS HTTP 200',r.status==200)
        check('no-JS single H1',page.locator('h1').count()==1)
        check('no-JS seven complete local modules',page.locator('[data-hx-root]').count()==7)
        check('no-JS all 38 original scene cards',page.locator('.v-picker-grid .v-pick-card').count()==38)
        check('no-JS monthly pricing HTML',page.locator('.v2-pricing-amount strong').all_text_contents()==['$24.50','$35','$63'])
        check('no-JS footer socials complete',page.locator('[data-social-links] a').count()==9)
        layout(page,'no-JS');shot(page,'no-js-home')
        context.close()
    except Exception as e:
        REPORT['fatal']=traceback.format_exc();print(REPORT['fatal'],flush=True)
    finally:
        browser.close();flush()
        print(json.dumps({'passed':REPORT['passed'],'failed':REPORT['failed'],'fatal':REPORT.get('fatal'),'pageErrors':len(REPORT['pageErrors']),'publicDataRequests':REPORT['publicDataRequests'],'serverErrors':REPORT['serverErrors'],'observations':REPORT['observations']},ensure_ascii=False),flush=True)
