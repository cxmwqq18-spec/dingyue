import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(__file__).parent
url=os.getenv('AIVIDEOS_ANTEST_URL','http://localhost:3002/site/aidreamcapes')
cases=[('.hx-path a',0,'#home-product-image-steps','Create Product Images in Three Steps'),('.hx-path a',1,'#home-experience-picker','Find a product video scene.'),('.hx-path a',2,'#home-experience-features','Explore the video storyboard.'),('.hx-path a',3,'#home-product-image-steps','Create Product Images in Three Steps'),('.hx-points a',0,'#home-seller-examples','From One Product Photo to a Scroll-Stopping Ad'),('.hx-points a',1,'#home-product-scenes','Choose a Scene for Your Product Video'),('.hx-points a',2,'#home-experience-steps-title','Explore AI presenters.'),('.hx-points a',3,'#home-ai-ugc','What Is AI UGC?')]
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 for width in [1440,390]:
  page=b.new_page(viewport={'width':width,'height':1000},user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36')
  assert page.goto(url,wait_until='networkidle',timeout=60000).status==200
  source=page.locator('#home-experience-hero')
  for selector,index,hash_,title in cases:
   link=source.locator(selector).nth(index);assert link.get_attribute('href')==hash_,(selector,index,link.get_attribute('href'))
   link.click();page.wait_for_timeout(350)
   assert page.evaluate('location.hash')==hash_
   target=page.locator(hash_);assert target.count()==1,(hash_,target.count())
   h2=target if target.evaluate('el=>el.tagName==="H2"') else target.locator('h2').first;actual=h2.inner_text()
   assert title.lower() in actual.lower(),(hash_,title,actual)
   position=h2.bounding_box();header=page.locator('header.site').bounding_box()
   header_bottom=(header['y']+header['height']) if header else 0
   assert position['y']>=header_bottom+4,(hash_,position,header_bottom)
   assert position['y']<450,(hash_,position)
   results.append({'width':width,'control':link.inner_text(),'href':hash_,'heading':actual,'headingY':round(position['y']),'headerBottom':round(header_bottom),'passed':True})
  page.close()
 b.close()
(OUT/('production-anchors.json' if url.startswith('https') else 'local-anchors.json')).write_text(json.dumps({'ok':True,'url':url,'cases':results},indent=2));print(json.dumps({'ok':True,'clicks':len(results),'url':url}))
