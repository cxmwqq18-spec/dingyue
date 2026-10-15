import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { chromium } from 'playwright';

// Bundle the actual component into a browser fixture. No app server, database,
// environment files, providers, billing, external requests, or listening ports.
const require = createRequire(import.meta.url);
const webpack = require('next/dist/compiled/webpack/webpack'); webpack.init();
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'aidreamcapes-ad-clone-'));
const root = path.resolve('src/components/aidreamcapes-workspace');
const css = fs.readFileSync(path.join(root, 'ad-clone-workbench.module.css'), 'utf8');
const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => [m[1], m[1]]));
fs.writeFileSync(path.join(folder, 'styles.js'), `module.exports=${JSON.stringify(classes)}`);
for (const file of ['ad-clone-workbench.tsx', 'ad-clone-client.ts']) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  fs.writeFileSync(path.join(folder, file.replace(/\.tsx?$/, '.js')), code.replace('./ad-clone-workbench.module.css', './styles.js').replace('@/lib/client-csrf', './csrf.js'));
}
fs.writeFileSync(path.join(folder, 'csrf.js'), ts.transpileModule(fs.readFileSync('src/lib/client-csrf.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
fs.writeFileSync(path.join(folder, 'entry.js'), `const React=require('react'); const {createRoot}=require('react-dom/client'); const {AdCloneWorkbench}=require('./ad-clone-workbench'); createRoot(document.getElementById('app')).render(React.createElement(AdCloneWorkbench,{siteId:'site_aidreamcapes',customerId:window.guest?undefined:'fixture-customer',csrfToken:'fixture-csrf',loginHref:'/login',onOpenTask:id=>window.opened=id}));`);
await new Promise((resolve, reject) => webpack.webpack({ mode:'production', target:'web', entry:path.join(folder,'entry.js'), output:{path:folder,filename:'bundle.js'}, resolve:{modules:[path.resolve('node_modules')]}, optimization:{minimize:false} }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({all:false, errors:true}))) : resolve()));
const bundle = fs.readFileSync(path.join(folder,'bundle.js'),'utf8');
const prefix='/api/sites/site_aidreamcapes/aivideosugc';
const asset={id:'source-fixture', label:'My launch ad', mimeType:'video/mp4'};
const segments=[{role:'hook',start:0,end:3,visual:'Example opening'},{role:'body',start:3,end:8,visual:'Example middle'},{role:'cta',start:8,end:10,visual:'Example close'}];
let storageMissing=false; let savedSegments=segments; let jobs=[]; let failJobs=false; let failAttach=false; const calls=[]; const unexpected=[]; const errors=[];
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1180,height:950}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*', async route=>{
    const req=route.request(); const url=new URL(req.url());
    if(url.pathname==='/fixture') return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#f4f5f8;font-family:Arial,sans-serif}button,input,textarea,select{font:inherit}${css}</style><div id="app"></div><script>window.guest=${url.searchParams.has('guest')};</script><script>${bundle.replaceAll('</script','<\\/script')}</script>`});
    if(!url.pathname.startsWith(prefix)){unexpected.push(req.url());return route.abort();}
    const suffix=url.pathname.slice(prefix.length); const method=req.method();
    let body; if(req.headers()['content-type']?.includes('application/json')) body=req.postDataJSON();
    calls.push({suffix,method,body,headers:req.headers()});
    const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(method!=='GET') assert.equal(req.headers()['x-csrf-token'],'fixture-csrf');
    if(suffix==='/clones') return reply({adReference:{available:false,state:'mock_only'},components:{database:{available:!storageMissing}},mockAvailable:!storageMissing,analysisBeforeTask:!storageMissing});
    if(suffix==='/clones/assets'&&method==='GET') return reply({assets:[asset],limits:{videoBytes:100*1024*1024}});
    if(suffix==='/clones/assets'&&method==='POST') {assert.match(req.postData(),/name="workflow"/);return reply({asset:{...asset,id:'uploaded-fixture',label:'Uploaded ad'}});}
    if(suffix==='/clones/jobs') return failJobs?reply({error:'workspace_database_unavailable'},503):reply({jobs});
    if(suffix==='/clones/consents') {assert.equal(body.taskId,undefined);assert.equal(body.rightsConfirmed,true);return reply({consent:{id:'consent-fixture',revision:1}});}
    if(suffix==='/clones/ad-references/queue') { const job={id:`job-${jobs.length}`,workflow:'ad_reference',sourceAssetId:asset.id,status:'queued',revision:1,consentId:'consent-fixture',consentRevision:1};jobs.unshift(job);return reply({job},202); }
    if(suffix==='/tasks/draft-fixture'&&method==='GET') return reply({task:{taskId:'draft-fixture',revision:2,productBrief:{sourceUrl:'https://my-product.fixture/cup',title:{value:'My ceramic cup'},description:{value:'Holds 300 ml'}},sourceAnalysis:{analysisRevision:1,synthetic:true,segments:savedSegments}}});
    if(suffix==='/tasks'&&method==='POST') {assert.equal(body.productBrief.title.value,'My ceramic cup');assert.equal(body.productBrief.description.value,'Holds 300 ml');assert.equal(body.productBrief.selectionConfirmed,true);assert.equal(JSON.stringify(body).includes('Example'),false);return reply({task:{taskId:'draft-fixture',revision:1}},201);}
    const match=suffix.match(/^\/clones\/jobs\/([^/]+)(?:\/(.*))?$/);
    if(match){let job=jobs.find(j=>j.id===match[1]);const action=match[2];assert.ok(job);if(method==='GET')return reply({job});assert.equal(req.headers()['if-match'],String(job.revision));
      if(action==='run-mock'){job={...job,status:'mock_complete',revision:job.revision+1,result:{sourceAssetId:job.sourceAssetId,capabilityState:'mock_only',productionReady:false,mediaRead:false,analysis:{revision:1,synthetic:true,segments}}};}
      else if(action==='cancel'){job={...job,status:'cancelled',revision:job.revision+1};}
      else if(action==='retry'){job={...job,id:'job-retry-fixture',status:'queued',revision:1};jobs.unshift(job);return reply({job});}
      else if(action==='attach-draft'){if(failAttach){failAttach=false;return reply({error:'fixture_failed'},500);}assert.equal(body.segments[0].visual,'Open with my product');assert.equal(body.analysisRevision,1);savedSegments=body.segments;job={...job,attachedTaskId:'draft-fixture',revision:job.revision+1};jobs=jobs.map(j=>j.id===job.id?job:j);return reply({task:{taskId:'draft-fixture',revision:2},job,sourceAnalysis:{synthetic:true,segments:body.segments}});}
      else if(method==='DELETE'){jobs=jobs.filter(j=>j.id!==job.id);return reply({job:{...job,status:'deleted'}});}
      else {unexpected.push(suffix);return route.abort();}
      jobs=jobs.map(j=>j.id===job.id?job:j);return reply({job});
    }
    unexpected.push(suffix); return route.abort();
  });
  await page.goto('https://ad-clone.fixture/fixture?guest');
  await page.getByRole('link',{name:'Sign in to continue'}).waitFor();
  assert.equal(calls.length,0,'guests make no private requests');
  await page.goto('https://ad-clone.fixture/fixture');
  await page.getByText('No saved analyses yet',{exact:true}).waitFor();
  storageMissing=true;await page.getByRole('button',{name:'Reload',exact:true}).click();
  await page.getByText('Saved analyses need storage setup. Try again later.').waitFor();
  assert.equal(await page.getByLabel('Upload reference MP4').isDisabled(),true);
  storageMissing=false;await page.getByRole('button',{name:'Reload',exact:true}).click();
  await page.getByRole('tab',{name:'Video link (unavailable)',exact:true}).click();
  await page.getByText(/does not fetch or parse video URLs/).waitFor();
  await page.getByText(/product page URL in step 03 is a separate field/).waitFor();
  await page.getByRole('tab',{name:'Upload an MP4',exact:true}).click();
  await page.getByLabel('Upload reference MP4').setInputFiles({name:'reference.mp4',mimeType:'video/mp4',buffer:Buffer.from('fixture MP4 bytes; endpoint fully mocked')});
  await page.getByText('Video uploaded. Confirm your permission before queuing.').waitFor();
  await page.getByLabel('Or select a saved video').selectOption(asset.id);
  const queue=page.getByRole('button',{name:'Queue simulated analysis',exact:true});assert.equal(await queue.isDisabled(),true);
  await page.getByLabel('I own this video').check();await queue.click();
  await page.getByRole('button',{name:'Run simulation',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancel analysis',exact:true}).click();
  await page.getByRole('button',{name:'Retry analysis',exact:true}).click();
  await page.getByRole('button',{name:'Run simulation',exact:true}).click();
  await page.getByText(/Example timeline — no video was read/).waitFor();
  await page.getByLabel('Hook direction').fill('Open with my product');
  await page.getByLabel('End (seconds)').first().fill('0');
  assert.equal(await page.getByRole('button',{name:'Save structure to product draft'}).isDisabled(),true);
  await page.getByLabel('End (seconds)').first().fill('2.5');
  await page.getByLabel('Your product page URL (HTTPS)').fill('https://my-product.fixture/cup');
  await page.getByLabel('Product name',{exact:true}).fill('My ceramic cup');
  await page.getByLabel('Confirmed product facts',{exact:true}).fill('Holds 300 ml');
  await page.getByLabel('I have reviewed these product facts').check();
  failAttach=true;await page.getByRole('button',{name:'Save structure to product draft'}).click();
  await page.getByRole('button',{name:'Retry draft association'}).waitFor();
  await page.getByRole('button',{name:'Retry draft association'}).click();
  await page.getByText(/Draft saved with your confirmed product facts/).waitFor();
  assert.equal(calls.filter(c=>c.suffix==='/tasks').length,1,'retry reuses created draft');
  await page.getByRole('button',{name:'Open product draft',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.opened),'draft-fixture');
  await page.screenshot({path:path.join(folder,'desktop.png'),fullPage:true});
  await page.reload();await page.getByRole('button',{name:/My launch ad/}).filter({hasText:'Simulation complete'}).click();
  await page.getByText(/Example timeline — no video was read/).waitFor();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile fits');
  await page.screenshot({path:path.join(folder,'mobile.png'),fullPage:true});
  failJobs=true;await page.getByRole('button',{name:'Reload',exact:true}).click();
  await page.getByRole('alert').filter({hasText:/storage is being prepared/}).waitFor();
  failJobs=false;await page.getByRole('button',{name:'Reload',exact:true}).click();
  await page.getByRole('button',{name:'Delete saved analysis',exact:true}).click();
  await page.getByRole('button',{name:/My launch ad/}).filter({hasText:'Cancelled'}).click();
  await page.getByRole('button',{name:'Delete saved analysis',exact:true}).click();
  await page.getByText('No saved analyses yet',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log(`PASS AdCloneWorkbench actual interactive component: guest, empty, MP4 upload/select, consent, queue, cancel/retry, explicit simulation, edited timing/structure, confirmed facts, attach failure/retry without duplicate draft, owner-job reload/delete, database error, mobile. No real network/model/billing/DB calls. Screenshots: ${folder}`);
} finally {await browser.close();}
