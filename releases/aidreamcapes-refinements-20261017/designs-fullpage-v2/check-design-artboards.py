from pathlib import Path
import hashlib,json
import struct
from playwright.sync_api import sync_playwright
OUT=Path(__file__).parent.resolve()
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 for name in ['ai-twin','text-to-video']:
  image=OUT/f'{name}-fullpage-hires.png'
  source=OUT/f'{name}-artboard.html'
  assert image.exists() and source.exists(),name
  width,height=struct.unpack('>II', image.read_bytes()[16:24])
  assert width>=1440 and height>=8000,(name,width,height)
  page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page.goto(source.as_uri(),wait_until='networkidle')
  page.wait_for_function('()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
  assert page.locator('h1').count()==1,(name,'single H1')
  headings=page.locator('h2').all_text_contents()
  assert len(headings)>=10,(name,len(headings))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(name,'horizontal overflow')
  for suffix,scroll in [('top',0),('middle',max(0,height//2-500)),('bottom',max(0,height-1000))]:
   page.evaluate('(y)=>window.scrollTo(0,y)',scroll)
   page.screenshot(path=str(OUT/f'{name}-detail-{suffix}.png'))
  results.append({'name':name,'width':width,'height':height,'mainSections':len(headings),'headings':headings,'allImagesLoaded':True,'horizontalOverflow':False})
  page.close()
 browser.close()
before=json.loads((OUT/'runtime-source-before.json').read_text())
changed=[f for f,h in before.items() if hashlib.sha256(Path(f).read_bytes()).hexdigest()!=h]
assert not changed,changed
report={'ok':True,'artboards':results,'runtimeSourceFilesUnchanged':len(before),'websitePagesImplemented':False,'databaseWrites':False,'productionDeployment':False}
(OUT/'hires-design-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
