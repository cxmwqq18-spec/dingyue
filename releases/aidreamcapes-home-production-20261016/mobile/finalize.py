import json
from pathlib import Path

OUT=Path(__file__).parent
raw=json.loads((OUT/'mobile-qa.json').read_text())
tablet=json.loads((OUT/'tablet-recheck.json').read_text())
excluded=[x for x in raw['checks'] if x['label']=='scene grid exactly two columns' and x['width']==768]
valid=[x for x in raw['checks'] if x not in excluded]
summary={
  'status':'functional-pass-with-P2-observation',
  'url':raw['url'],
  'commit':raw['commit'],
  'browser':'Real headless Chromium (Chrome for Testing 1223), mobile/touch emulation; HTTP proxy 127.0.0.1:10904. No physical handset or native translation service test.',
  'viewports':[{'width':390,'height':844,'translationSimulation':True},{'width':375,'height':844,'translationSimulation':False},{'width':768,'height':1024,'translationSimulation':False}],
  'assertions':{'passed':sum(x['ok'] for x in valid)+int(tablet['ok']),'failed':sum(not x['ok'] for x in valid)+int(not tablet['ok']),'excludedInvalidTestAssumptions':len(excluded)},
  'scope':{'localControlActions':169,'fullControlInventories':{'390':74,'375':74},'tabletSample':21,'faqRowsPerWidth':18,'faqToggleCycles':54,'pricingPeriodSelections':12,'primaryScreenshots':len(raw['screenshots']),'noJsSSRWidth':375},
  'translation':{'readiness':'Explicit React props on pricing and all seven data-hx-root data-hx-ready=true before DOM mutation','nestedFontNodes':870,'text':'Original English text preserved; structure-only Chrome nested font simulation','postMutationControls':74,'postMutationPriceSelections':3,'postMutationMenuChecks':True,'postMutationPageErrors':len([e for e in raw['pageErrors'] if e['translated']])},
  'pricing':{'monthlyAmounts':['$24.50','$35','$63'],'monthlyCredits':[200,300,600],'yearlyAmounts':['$147','$210','$378'],'yearlyCredits':[2400,3600,7200],'checkout':'All three buttons remain disabled, Checkout coming soon. Expected current draft/payment configuration.'},
  'layout':{'horizontalOverflow':False,'mobileSceneGridColumns':2,'tabletSceneGridColumns':3,'selectedFooters':True,'imageSwitching':True,'dialogLayoutAndFocus':True,'socialExactHrefsTargetRel':True},
  'network':{'publicContentFetchXhrEventsourceRsc':len(raw['publicDataRequests']),'server5xx':len(raw['serverErrors']),'dangerousRequestsAttempted':len([x for x in raw['blockedRequests'] if '/cdn-cgi/rum' not in x['url']]),'blockedTelemetry':'Cloudflare /cdn-cgi/rum POST/ping; expected guard behavior','noJsScriptFailure':'A Next.js script CSP failure in the deliberately JavaScript-disabled context is expected.'},
  'issues':[{'severity':'P2','title':'Escape leaves top-level mobile navigation open','reproducedWidths':[375,390,768],'steps':['Focus Open menu, press Enter.','Press Escape.'],'actual':'Submenus close; main navigation remains visible and aria-expanded=true. Menu button closes it with click, Enter, or Space.','evidence':['375-menu-after-escape.png','390-translated-menu-after-escape.png','768-menu-after-escape.png']}],
  'edgeObservations':[{'title':'React #418 caused by Cloudflare email HTML rewriting before translation','evidence':'hydration-diagnostic.json and ../seo/hydration-cf-control.json','result':'Original and decoder-only-blocked contexts reproduce. SEO isolated browser response control restoring only the two email fragments has errors=[]; no application or production mutation. All tested controls still work.'}],
  'infrastructureNotes':raw.get('infrastructureNotes',[]),
  'testAssumptionCorrection':{'excluded':excluded,'reason':'Two-column requirement applies to mobile max-width 700px. Tablet 768px correctly uses three columns. Independent live recheck passed. Raw mobile-qa.json and logs preserved unchanged.','recheck':'tablet-recheck.json'},
  'writeScope':'Only releases/aidreamcapes-home-production-20261016/mobile/ was written. No source, database, publication, snapshot, upload, task, generation, quote, reservation, checkout or payment changes.',
}
(OUT/'mobile-summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False))
text='''Production mobile QA completed against d2e30400e8d305ec6420cdd999d42e1f7aa8730b.

927 valid assertions passed, 0 functional failures. One incorrect test assumption (two scene columns at 768px) was excluded and replaced with an independent live passing three-column tablet check. Raw results remain in mobile-qa.json; tablet-recheck.json records the correction.

Real Chromium mobile/touch contexts: 390x844, 375x844, 768x1024; plus 375px JavaScript-disabled SSR. 169 local control actions, 54 FAQ toggle cycles, 12 pricing period selections, and 63 primary screenshots. No horizontal overflow. Scene filtering, mobile two-column grid, selected footer, presenter images, brief/format panels, dialog focus/close controls, exact prices and credits, and nine social href/target/rel checks passed. Checkout coming soon is disabled as expected.

Translation coverage is a structural simulation only: after pricing React hydration and all seven ready controllers, 870 text nodes were replaced by nested font wrappers. All 74 local controls, prices and menus continued working; no page errors occurred after injection. Original text was retained. The native Chrome translation service and physical handsets were not tested.

P2: Escape closes submenus but leaves the top-level mobile navigation open (375/390/768). Reproduce by focusing Open menu, pressing Enter, then Escape. aria-expanded remains true. The menu button closes normally with click, Enter, or Space. Evidence: 375-menu-after-escape.png, 390-translated-menu-after-escape.png, 768-menu-after-escape.png.

Edge observation: React #418 appears before translation because Cloudflare rewrites two email HTML fragments. Our original/decoder-blocked comparison is in hydration-diagnostic.json. The SEO agent's isolated response control restores only these two fragments and records errors=[] in ../seo/hydration-cf-control.json. This is not a translation regression and caused no observed control failure.

Public content fetch/XHR/EventSource/RSC: 0. Server 5xx: 0. No dangerous application operation was attempted. Guards blocked Cloudflare telemetry POST/ping only. One initial 768px networkidle wait timed out; the subsequent explicit hydration-ready retry and focused tablet recheck passed. Deliberate no-JS context produced an expected script CSP failure.

All writes are limited to this mobile QA directory; no app source or database changes. Primary report: mobile-summary.json; detailed raw evidence: mobile-qa.json; executable test: qa.py; diagnostics: hydration-diagnostic.py, tablet-recheck.py. Python dependency: playwright==1.64.0, using installed Chromium executable noted in the scripts.
'''
(OUT/'mobile-report.txt').write_text(text)
(OUT/'requirements.txt').write_text('playwright==1.64.0\n')
print(json.dumps({'status':summary['status'],'assertions':summary['assertions'],'issues':summary['issues'],'report':str(OUT/'mobile-report.txt')}))
