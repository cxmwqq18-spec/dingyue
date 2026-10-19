import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
expected=json.loads(Path('docs/content-locks/aivideosugc-homepage-tdk-approved.json').read_text())['seo']
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 page=b.new_page(java_script_enabled=False)
 assert page.goto('http://localhost:3002/site/aidreamcapes',wait_until='networkidle',timeout=60000).status==200
 assert page.locator('head meta[name=keywords]').count()==1
 assert page.locator('head meta[name=keywords]').get_attribute('content')==expected['keywords']
 assert page.title()==expected['title']
 assert page.locator('head meta[name=description]').get_attribute('content')==expected['description']
 report={'ok':True,'target':'local','keywordsInHead':True,'noJavaScript':True,'approvedTdkMatches':True,'owner':'LivePage.contentJson.seo'}
 (ROOT/'keywords-check.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report))
 b.close()
