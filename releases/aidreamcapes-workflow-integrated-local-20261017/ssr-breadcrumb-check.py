from html.parser import HTMLParser
from urllib.request import Request,urlopen
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
import json,re
OUT=Path(__file__).parent
manifest=json.loads((OUT/'final-field-manifest.json').read_text())
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.nav=0;self.labels=[];self.jsonld=[];self.script=False;self.current=''
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='nav' and 'crumbs' in a.get('class','').split():self.nav=1
  elif self.nav and tag=='nav':self.nav+=1
  if tag=='script' and a.get('type')=='application/ld+json':self.script=True;self.current=''
 def handle_endtag(self,tag):
  if tag=='nav' and self.nav:self.nav-=1
  if tag=='script' and self.script:
   self.jsonld.append(json.loads(self.current));self.script=False
 def handle_data(self,text):
  if self.nav and text.strip() and text.strip()!='›':self.labels.append(text.strip())
  if self.script:self.current+=text

def check(item):
 path=item['slug'];req=Request('http://localhost:3002/site/aidreamcapes'+path,headers={'User-Agent':'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36'})
 with urlopen(req,timeout=90) as r:status=r.status;html=r.read().decode()
 p=Parser();p.feed(html)
 expected=[c['label'] for c in item['crumbs']]
 assert p.labels==expected,(path,p.labels,expected)
 def find(x):
  if isinstance(x,list):return sum([find(v) for v in x],[])
  if isinstance(x,dict):
   if x.get('@type')=='BreadcrumbList':return [x]
   return sum([find(v) for v in x.values() if isinstance(v,(dict,list))],[])
  return []
 schemas=find(p.jsonld);assert schemas,path
 for schema in schemas:
  result=[{'label':v['name'],'href':urlparse(v['item']).path} for v in schema['itemListElement']]
  assert result==item['crumbs'],(path,result,item['crumbs'])
 return {'slug':path,'status':status,'labels':p.labels,'schemaMatches':True}
results=[]
for item in manifest['breadcrumbs']:
 results.append(check(item))
 (OUT/'ssr-progress.json').write_text(json.dumps({'checked':len(results),'last':item['slug']}))
 if len(results)%15==0:print('checked',len(results),flush=True)
report={'ok':True,'pages':len(results),'results':results,'publicDataSource':'Local public SSR HTML and emitted JSON-LD; no browser JavaScript'}
(OUT/'ssr-breadcrumb-check.json').write_text(json.dumps(report,indent=2));print(json.dumps({'ok':True,'pages':len(results)}))
