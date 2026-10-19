import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
url=os.environ.get('WORKFLOW_CHECK_URL','http://localhost:3002/site/aidreamcapes')
report=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 page=b.new_page(user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36')
 assert page.goto(url,wait_until='networkidle',timeout=60000).status==200
 card=page.locator('.adc-workflow-card').first
 for width in [1566,1100,768,390,360]:
  page.set_viewport_size({'width':width,'height':1000})
  card.scroll_into_view_if_needed()
  note=page.locator('.adc-workflow-product-note')
  box=note.bounding_box();img=note.locator('img').bounding_box();text=note.locator('span').bounding_box()
  assert round(img['width'])==36 and round(img['height'])==48,img
  assert text['x']>=img['x']+img['width'],text
  assert text['x']+text['width']<=box['x']+box['width']+1,(box,text)
  assert card.evaluate('el=>el.scrollWidth<=el.clientWidth+1')
  report.append({'viewport':width,'thumbnail':img,'descriptionVisible':True})
  if width in [1566,390]:card.screenshot(path=str(Path(__file__).parent/f'thumbnail-{width}.png'))
 b.close()
Path(__file__).with_suffix('.json').write_text(json.dumps({'url':url,'checks':report},indent=2))
print(json.dumps({'ok':True,'url':url,'viewports':len(report)}))
