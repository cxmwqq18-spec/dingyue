import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseTarget } from '../lib/database-target.mjs';
import { loadCloneAcceptanceEnv } from './clone-http-fixture.mjs';

await loadCloneAcceptanceEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
assert(!process.env.CUSTOMER_ASSET_WRITE_BASE_URL && !process.env.CUSTOMER_ASSET_SHARED_BASE_URL, 'Remote storage forbidden');
const origin = 'http://127.0.0.1:3002', siteId = 'site_aidreamcapes';
const prefix = `/api/sites/${siteId}/aivideosugc`, clone = `${prefix}/clones`;
const customerId = `synthetic-clone-browser-${randomUUID()}`, sessionId = randomBytes(32).toString('hex');
const nonce = randomBytes(24).toString('base64url');
const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'dev-csrf-secret-change-me';
const token = `${nonce}.${createHmac('sha256', secret).update(`customer:${siteId}:${sessionId}:${nonce}`).digest('base64url')}`;
const cookie = `customer_session_${siteId}=${sessionId}; customer_csrf_${siteId}=${token}`;
const db = new PrismaClient({ errorFormat: 'minimal', log: [] });
const scope = { siteId, customerId };
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'synthetic-clone-browser-fixtures-'));
const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), 'aidreamcapes-clone-browser-evidence-'));
const storageRoot = path.resolve(process.env.CUSTOMER_ASSET_STORAGE_ROOT || 'data/customer-assets');
const execute = promisify(execFile);
let result = { result: 'FAIL', artifacts, cleanup: false }, failure;
async function request(route, { body, form, revision, status = 200 } = {}) {
  const method = body || form || revision ? 'POST' : 'GET';
  const allowed = method === 'POST' && [
    `${clone}/assets`, `${prefix}/actors`, `${clone}/consents`, `${clone}/voice-twins/queue`, `${clone}/ad-references/queue`, `/api/sites/${siteId}/customers/${customerId}/assets`,
  ].includes(route) || method === 'POST' && new RegExp(`^${clone}/jobs/[a-zA-Z0-9_-]+/(run-mock|bind-actor)$`).test(route);
  assert(allowed, 'HTTP fixture route outside explicit no-generation allowlist');
  const response = await fetch(`${origin}${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(60_000), headers: { cookie, 'x-csrf-token': token, ...(body ? { 'content-type': 'application/json' } : {}), ...(revision ? { 'if-match': String(revision) } : {}) }, body: form || (body ? JSON.stringify(body) : undefined) });
  const value = await response.json();
  assert.equal(response.status, status, `${route}: HTTP ${response.status}, code=${value.error || 'none'}`);
  return value;
}
async function upload(filename, workflow) {
  const form = new FormData(); form.set('file', new Blob([await fs.readFile(path.join(temp, filename))]), filename); form.set('workflow', workflow);
  return (await request(`${clone}/assets`, { form, status: 201 })).asset;
}
const python = String.raw`
import json,sys,re,os
from playwright.sync_api import sync_playwright
fixture=json.load(sys.stdin)
errors=[]; responses=[]; blocked=[]; fonts=[]; failed=[]; consoles=[]; calls=[]; api_status=[]; observed_jobs=set(); observed_actors=set(); created_teams=[]; created_brands=[]; created_facts=[]; screenshots=[]; checks=0
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=fixture['chromium'])
 context=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1)
 context.add_cookies([{'name':'customer_session_site_aidreamcapes','value':fixture['sessionId'],'url':fixture['origin'],'httpOnly':True,'sameSite':'Lax'}, {'name':'customer_csrf_site_aidreamcapes','value':fixture['token'],'url':fixture['origin'],'sameSite':'Lax'}])
 def guard(route):
  req=route.request
  if req.url.startswith('https://fonts.googleapis.com/'):
   fonts.append(req.url.split('?')[0]);route.fulfill(status=200,content_type='text/css',body='/* External fonts disabled during offline acceptance. */');return
  if req.url.startswith(fixture['origin']+'/__nextjs_original-stack-frames') and req.method=='POST':
   calls.append('/__nextjs_original-stack-frames (local dev diagnostic)');route.continue_();return
  if req.url==fixture['origin']+'/api/sites/site_aidreamcapes/aivideosugc/analytics/events' and req.method=='POST':
   calls.append('/analytics/events (synthetic report import)');route.continue_();return
  teams_base=fixture['origin']+'/api/sites/site_aidreamcapes/aivideosugc'
  if req.url.startswith(teams_base) and req.method in ('POST','PATCH'):
   path=req.url.split('?')[0].replace(teams_base,'')
   if path=='/teams' and req.method=='POST' or re.fullmatch(r'/teams/[A-Za-z0-9_-]+',path) and req.method=='PATCH' or path=='/brands' and req.method=='POST' or re.fullmatch(r'/brands/[A-Za-z0-9_-]+/facts',path) and req.method=='POST' or re.fullmatch(r'/brands/[A-Za-z0-9_-]+/facts/[A-Za-z0-9_-]+',path) and req.method=='PATCH':
    calls.append(path+' (synthetic team/brand fixture)');route.continue_();return
  if not req.url.startswith(fixture['origin']+'/') or req.method!='GET' or re.search(r'/(quote|reserve|generate|billing|actions)(/|\?|$)',req.url):
   blocked.append({'method':req.method,'path':req.url.split('?')[0].replace(fixture['origin'],'')})
   route.abort(); return
  calls.append(req.url.split('?')[0].replace(fixture['origin'],''));route.continue_()
 context.route('**/*',guard)
 page=context.new_page()
 page.on('pageerror',lambda e:errors.append({'message':str(e),'stack':e.stack}))
 page.on('requestfailed',lambda r:failed.append({'path':r.url.split('?')[0].replace(fixture['origin'],''),'failure':r.failure}))
 page.on('console',lambda m:consoles.append(m.text) if m.type=='error' else None)
 def response(response):
  if response.status>=500:responses.append({'path':response.url.split('?')[0].replace(fixture['origin'],''),'status':response.status})
  if '/aivideosugc/teams' in response.url or '/aivideosugc/brands' in response.url:
   event={'method':response.request.method,'path':response.url.split('?')[0].replace(fixture['origin'],''),'status':response.status}
   try:
    payload=response.json()
    if isinstance(payload,dict) and isinstance(payload.get('error'),str):event['errorCode']=payload['error']
   except Exception:pass
   api_status.append(event)
  if '/aivideosugc/clones/jobs' in response.url and response.status==200:
   try:
    value=response.json()
    for job in value.get('jobs',[]):
     assert job['siteId']=='site_aidreamcapes' and job['customerId']==fixture['customerId'],'Job owner mismatch'
     observed_jobs.add(job['id'])
   except Exception as e:errors.append('Job response validation: '+str(e))
  if '/aivideosugc/actors' in response.url and response.status==200:
   try:
    for actor in response.json().get('actors',[]):observed_actors.add(actor['actorId'])
   except Exception as e:errors.append('Actor response validation: '+str(e))
  if '/aivideosugc/teams' in response.url and response.status==201:
   try:
    value=response.json();created_teams.append(value['team']['id'])
   except Exception as e:errors.append('Created team response validation: '+str(e))
  if '/aivideosugc/brands' in response.url and response.status==201:
   try:
    value=response.json()
    if '/facts' in response.url:created_facts.append(value['fact']['id'])
    else:created_brands.append(value['brand']['id'])
   except Exception as e:errors.append('Created brand/fact response validation: '+str(e))
 page.on('response',response)
 try:
  for width,label in [(1440,'desktop'),(390,'mobile')]:
   page.set_viewport_size({'width':width,'height':1100 if width==1440 else 844})
   for view in (fixture.get('views') or ['home','images','product','actors','twin','clone','analytics','teams']):
    app_path='/site/aidreamcapes/app/create?view='
    url=fixture['origin']+app_path+view
    page.goto(url,wait_until='networkidle',timeout=120000)
    if view=='home':
     page.get_by_role('region',name='Create your next project').wait_for(timeout=60000)
     prompt=page.get_by_role('textbox',name='Describe your video idea')
     before=page.url
     page.get_by_role('button',name='TikTok ad for your brand',exact=True).click()
     assert 'TikTok ad for your brand' in prompt.input_value(),'Quick prompt should fill the composer'
     assert page.url==before,'Quick prompt should not navigate'
     assert page.get_by_role('button',name='Create draft copies',exact=True).count()==0,'Batch draft shortcut stays hidden while unavailable'
     page.goto(fixture['origin']+'/site/aidreamcapes/app/create?view=batch',wait_until='networkidle',timeout=120000)
     page.get_by_role('heading',name='Batch Drafts',exact=True).wait_for(timeout=60000)
     assert page.get_by_role('button',name='Coming soon',exact=True).is_disabled(),'Direct Batch Drafts route is disabled'
     assert page.locator('main button').count()==1,'Unavailable Batch Drafts has no active creation controls'
     checks+=4
    elif view=='images':
     page.get_by_role('heading',name='AI Image',exact=True).wait_for(timeout=60000)
     page.get_by_role('textbox',name='Describe your image idea').wait_for()
     page.get_by_role('combobox',name='Image style',exact=True).wait_for()
     page.get_by_role('combobox',name='Image aspect ratio',exact=True).wait_for()
     checks+=4
    elif view=='product':
     page.get_by_role('heading',name='URL to Video',exact=True).wait_for(timeout=60000)
     page.get_by_role('heading',name='Import from a product page',exact=True).wait_for()
     page.get_by_label('Product page URL',exact=True).wait_for()
     page.get_by_text('not video links or ad references').wait_for()
     checks+=4
    elif view=='actors':
     page.get_by_role('heading',name='Create a video with an AI presenter',exact=True).wait_for(timeout=60000)
     page.get_by_role('button',name='Choose presenter',exact=True).click()
     dialog=page.get_by_role('dialog',name='Choose a presenter')
     dialog.wait_for(timeout=10000)
     page.get_by_role('button',name='Close dialog').click()
     checks+=2
    elif view=='analytics':
     page.get_by_role('heading',name='Ad performance',exact=True).wait_for(timeout=60000)
     if width==1440:
      page.get_by_role('heading',name='Your imported results will appear here',exact=True).wait_for()
      page.get_by_role('tab',name='One row',exact=True).click()
      for field,value in [('Account reference','synthetic-report'),('Report row ID','synthetic-report-row'),('Creative ID','synthetic-report-creative'),('Creative name','SYNTHETIC browser ad'),('Report date',fixture['today']),('Report currency','USD'),('Spend','12.00'),('Impressions','1000'),('Clicks','50'),('Conversions','3')]:
       page.get_by_label(field,exact=True).fill(value)
      page.get_by_role('button',name='Import this row',exact=True).click()
      checks+=3
     page.get_by_role('heading',name='SYNTHETIC browser ad',exact=True).wait_for(timeout=30000)
     page.reload(wait_until='networkidle',timeout=120000)
     page.get_by_role('heading',name='SYNTHETIC browser ad',exact=True).wait_for(timeout=30000)
     assert page.get_by_text('USD 12.00',exact=True).count()>0,'Imported spend must reload'
     assert page.get_by_text('USD 4.00',exact=True).count()>0,'CPA must equal spend divided by conversions'
     checks+=5
    elif view=='teams':
     page.get_by_role('heading',name='Teams & brands',exact=True).wait_for(timeout=60000)
     page.get_by_role('heading',name='Your teams',exact=True).wait_for()
     if width==1440:
      page.get_by_label('New team name',exact=True).fill('SYNTHETIC browser team')
      page.get_by_role('button',name='Create team',exact=True).click()
      page.get_by_label('Team name',exact=True).wait_for(timeout=30000)
      page.get_by_label('Team name',exact=True).fill('SYNTHETIC browser team renamed')
      page.get_by_role('button',name='Save team',exact=True).click()
      page.get_by_text('Team details saved.',exact=True).wait_for(timeout=30000)
      page.get_by_role('button',name='Brands & facts',exact=True).click()
      page.get_by_role('heading',name='Brand profile',exact=True).wait_for()
      page.get_by_label('New brand name',exact=True).fill('SYNTHETIC browser brand')
      page.get_by_label('New brand website',exact=True).fill('https://synthetic.example')
      page.get_by_label('New brand description',exact=True).fill('Synthetic browser acceptance profile.')
      page.get_by_role('button',name='Create brand',exact=True).click()
      page.get_by_label('New fact key',exact=True).wait_for(timeout=30000)
      page.get_by_label('New fact key',exact=True).fill('materials')
      page.get_by_label('New fact value',exact=True).fill('Synthetic cotton canvas')
      page.get_by_label('New fact source',exact=True).fill('https://synthetic.example/materials')
      page.get_by_label('New fact source label',exact=True).fill('Synthetic materials page')
      page.get_by_role('button',name='Add unconfirmed fact',exact=True).click()
      page.get_by_text('Synthetic cotton canvas',exact=True).wait_for(timeout=30000)
      page.once('dialog',lambda dialog:dialog.accept())
      page.get_by_role('button',name='Confirm this fact',exact=True).click()
      page.get_by_text('Confirmed',exact=True).wait_for(timeout=30000)
      page.reload(wait_until='networkidle',timeout=120000)
      page.get_by_role('button',name='Brands & facts',exact=True).click()
      page.get_by_text('Synthetic cotton canvas',exact=True).wait_for(timeout=30000)
      page.get_by_text('Confirmed',exact=True).wait_for()
      assert page.get_by_role('link',name='Synthetic materials page',exact=True).get_attribute('href')=='https://synthetic.example/materials','Fact source stays linked to the product fact'
      assert len(created_teams)==1 and len(created_brands)==1 and len(created_facts)==1,'Created team, brand, and fact IDs must be returned for exact cleanup'
      checks+=10
     else:
      page.get_by_role('button',name='Brands & facts',exact=True).click()
      page.get_by_role('heading',name='Brand profile',exact=True).wait_for()
      page.get_by_text('Synthetic cotton canvas',exact=True).wait_for(timeout=30000)
      page.get_by_text('Confirmed',exact=True).wait_for()
      checks+=3
    elif view=='twin':
     page.get_by_role('heading',name='AI Twin',exact=True).wait_for(timeout=60000)
     page.get_by_role('heading',name=fixture['actorName'],exact=True).wait_for(timeout=20000)
     page.get_by_role('heading',name='My saved requests',exact=True).wait_for()
    elif view=='clone':
     page.locator('h1').filter(has_text='Start with a structure.').wait_for(timeout=60000)
     page.get_by_role('heading',name='Saved analyses',exact=True).wait_for()
     page.get_by_role('button').filter(has_text=fixture['videoLabel']).wait_for(timeout=60000)
    if view in ['twin','clone']:
     checks+=3
     page.reload(wait_until='networkidle',timeout=120000)
     if view=='twin':page.get_by_role('heading',name=fixture['actorName'],exact=True).wait_for(timeout=20000)
     else:page.get_by_role('button').filter(has_text=fixture['videoLabel']).wait_for(timeout=60000)
     checks+=1
    overflow=page.evaluate('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})')
    assert overflow['scroll']<=overflow['client']+1, f'{view}/{label} horizontal overflow: {overflow}'
    checks+=1
    image=os.path.join(fixture['artifacts'],f'{view}-{label}.png');page.screenshot(path=image,full_page=True);screenshots.append(image)
  actor_reloaded=fixture['actorId'] in observed_actors
  jobs_reloaded=set(fixture['jobIds']).issubset(observed_jobs)
  if fixture.get('views') is None or 'twin' in fixture['views']:assert actor_reloaded,'Owned actor not reloaded through integrated API'
  if fixture.get('views') is None or 'clone' in fixture['views']:assert jobs_reloaded,'Owned voice/ad jobs not reloaded through integrated API'
  assert not errors,'Page errors: '+json.dumps(errors)
  assert not responses,'HTTP 5xx: '+json.dumps(responses)
  unsafe=[r for r in blocked if not r['path'].startswith('https://fonts.googleapis.com/')]
  assert not unsafe,'Unexpected non-read/external requests blocked: '+json.dumps(unsafe)
  checks+=5
  print(json.dumps({'result':'PASS','checks':checks,'pageErrors':len(errors),'http5xx':len(responses),'blockedRequests':len(blocked),'externalFontsStubbed':len(fonts),'localApiRequests':len(calls),'ownedJobsReloaded':len(set(fixture['jobIds'])&observed_jobs),'ownedActorReloaded':actor_reloaded,'createdTeamIds':created_teams,'createdBrandIds':created_brands,'createdFactIds':created_facts,'screenshots':screenshots}))
 except Exception as e:
  try:page.screenshot(path=os.path.join(fixture['artifacts'],'failure.png'),full_page=True)
  except:pass
  print(json.dumps({'result':'FAIL','error':str(e),'pageErrors':errors,'http5xx':responses,'apiStatus':api_status,'visibleAlerts':page.get_by_role('alert').all_inner_texts() if page else [],'pageText':page.locator('main').inner_text()[:3000] if page else '', 'failedRequests':failed,'consoleErrors':consoles,'blockedRequests':blocked,'createdTeamIds':created_teams,'createdBrandIds':created_brands,'createdFactIds':created_facts,'screenshots':screenshots}))
  sys.exitcode=1
 finally:
  browser.close()
 if getattr(sys,'exitcode',0):sys.exit(1)
`;
try {
  await db.customer.create({ data: { id: customerId, siteId, email: `${customerId}@example.invalid`, passwordHash: null, name: 'SYNTHETIC integrated browser fixture', status: 'active' } });
  await db.customerSession.create({ data: { id: sessionId, siteId, customerId, expiresAt: new Date(Date.now() + 900_000) } });
  await execute('ffmpeg', ['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=2','-ac','1','-ar','16000',path.join(temp,'synthetic-browser.wav')]);
  await execute('ffmpeg', ['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=160x160:r=10:d=2','-an','-c:v','libx264','-pix_fmt','yuv420p',path.join(temp,'synthetic-browser.mp4')]);
  await execute('ffmpeg', ['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=green:s=128x128','-frames:v','1',path.join(temp,'synthetic-browser.png')]);
  const audio=await upload('synthetic-browser.wav','voice_twin'),video=await upload('synthetic-browser.mp4','ad_reference');
  const form=new FormData();form.set('file',new Blob([await fs.readFile(path.join(temp,'synthetic-browser.png'))],{type:'image/png'}),'synthetic-browser.png');form.set('label','SYNTHETIC browser portrait');
  const image=(await request(`/api/sites/${siteId}/customers/${customerId}/assets`,{form})).asset;
  const actorName='SYNTHETIC browser presenter';
  const actor=(await request(`${prefix}/actors`,{body:{name:actorName,gender:'female',ageRange:'25-30',languages:['en'],imageUrl:image.previewUrl,refAudio:audio.previewUrl},status:201})).actor;
  const jobs=[];
  for(const workflow of ['voice_twin','ad_reference']) {
    const consent=(await request(`${clone}/consents`,{body:{workflow,scope:workflow,rightsConfirmed:true,...(workflow==='voice_twin'?{actorId:actor.actorId}:{sourceAssetId:video.id})},status:201})).consent;
    const job=(await request(`${clone}/${workflow==='voice_twin'?'voice-twins':'ad-references'}/queue`,{body:{consentId:consent.id,consentRevision:consent.revision,idempotencyKey:randomUUID()},status:202})).job;
    const ready=(await request(`${clone}/jobs/${job.id}/run-mock`,{revision:job.revision})).job;jobs.push(ready.id);
    if(workflow==='voice_twin')await request(`${clone}/jobs/${job.id}/bind-actor`,{revision:ready.revision,body:{mockMode:true,actorId:actor.actorId}});
  }
  const views=process.env.AIDREAMCAPES_SMOKE_VIEWS?.split(',').map((view)=>view.trim()).filter(Boolean);
  const payload={origin,sessionId,token,customerId,today:new Date().toISOString().slice(0,10),actorName,actorId:actor.actorId,videoLabel:video.label,jobIds:jobs,artifacts,views,chromium:'/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'};
  const browserResult=await new Promise((resolve,reject)=>{
    const child=spawn('/tmp/aidreamcapes-dom-browser-venv/bin/python',['-c',python],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
    child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
    child.on('error',reject);child.on('close',code=>{try {const value=JSON.parse(stdout.trim().split('\n').at(-1));resolve({...value,exitCode:code});}catch{reject(new Error(`Browser runner failed (${code}); diagnostic bytes=${stderr.length}`));}});
    child.stdin.end(JSON.stringify(payload));
  });
  result={...browserResult,artifacts,cleanup:false};
  if(browserResult.result!=='PASS')throw new Error(browserResult.error||'Browser acceptance failed');
} catch(error) {failure=error instanceof Error?error.message:'Browser acceptance failed';console.error(`FAIL integrated clone browser: ${failure}`);}
finally {
  try {
    const creditLedger=await db.creditLedger.count({where:scope}),generationJobs=await db.generationJob.count({where:scope});
    assert.equal(creditLedger,0);assert.equal(generationJobs,0);
    const syntheticTeams=await db.$queryRaw`SELECT "id" FROM "AidreamcapesTeam" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId}`;
    for(const {id:teamId} of syntheticTeams){
      await db.$executeRaw`DELETE FROM "AidreamcapesBrandFactVersion" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "brandProfileId" IN (SELECT "id" FROM "AidreamcapesBrandProfile" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId})`;
      await db.$executeRaw`DELETE FROM "AidreamcapesBrandFact" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "brandProfileId" IN (SELECT "id" FROM "AidreamcapesBrandProfile" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId})`;
      await db.$executeRaw`DELETE FROM "AidreamcapesBrandProfile" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId}`;
      await db.$executeRaw`DELETE FROM "AidreamcapesTeamInvite" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId}`;
      await db.$executeRaw`DELETE FROM "AidreamcapesTeamMember" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId}`;
      await db.$executeRaw`DELETE FROM "AidreamcapesTeam" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "id"=${teamId}`;
    }
    await db.$executeRaw`DELETE FROM "AidreamcapesCloneJob" WHERE "siteId"=${siteId} AND "customerId"=${customerId}`;
    await db.$executeRaw`DELETE FROM "AidreamcapesCloneConsent" WHERE "siteId"=${siteId} AND "customerId"=${customerId}`;
    await db.$executeRaw`DELETE FROM "AidreamcapesCreativeMetric" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "createdByCustomerId"=${customerId}`;
    await db.$executeRaw`DELETE FROM "AidreamcapesVideoTask" WHERE "siteId"=${siteId} AND "customerId"=${customerId}`;
    await db.$executeRaw`DELETE FROM "AidreamcapesWorkspaceActor" WHERE "siteId"=${siteId} AND "customerId"=${customerId}`;
    await db.assetUpload.deleteMany({where:scope});
    await db.customerSession.deleteMany({where:{...scope,id:sessionId}});
    await db.customer.deleteMany({where:{siteId,id:customerId,name:'SYNTHETIC integrated browser fixture',email:`${customerId}@example.invalid`}});
    const folder=path.join(storageRoot,'sites',siteId,'customers',customerId);await fs.rm(folder,{recursive:true,force:true});
    assert.equal(await db.customer.count({where:{siteId,id:customerId}}),0);
    assert.equal(await db.assetUpload.count({where:scope}),0);assert.equal(await db.customerSession.count({where:scope}),0);
    const remaining=await db.$queryRaw`SELECT (SELECT count(*) FROM "AidreamcapesCloneJob" WHERE "siteId"=${siteId} AND "customerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesCloneConsent" WHERE "siteId"=${siteId} AND "customerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesVideoTask" WHERE "siteId"=${siteId} AND "customerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesWorkspaceActor" WHERE "siteId"=${siteId} AND "customerId"=${customerId}) AS count`;
    assert.equal(Number(remaining[0].count),0);
    const metricRows=await db.$queryRaw`SELECT count(*) AS count FROM "AidreamcapesCreativeMetric" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId}`;
    assert.equal(Number(metricRows[0].count),0);
    const workspaceRows=await db.$queryRaw`SELECT (SELECT count(*) FROM "AidreamcapesTeam" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesTeamMember" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesTeamInvite" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesBrandProfile" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesBrandFact" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesBrandFactVersion" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId}) AS count`;
    assert.equal(Number(workspaceRows[0].count),0);
    result={...result,cleanup:true,creditLedger,generationJobs};
  }catch{failure||='Scoped fixture cleanup failed';console.error('FAIL scoped fixture cleanup');}
  await fs.rm(temp,{recursive:true,force:true});await db.$disconnect();
}
result.result=failure?'FAIL':'PASS';
await fs.writeFile(path.join(artifacts,'summary.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
if(failure)process.exitCode=1;
