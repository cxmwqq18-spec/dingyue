import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {loadRuntimeEnv} from '../../scripts/load-runtime-env.mjs';
import {assertDatabaseTarget} from '../../scripts/lib/database-target.mjs';
import {aidreamcapesBreadcrumbs} from '../../scripts/lib/aidreamcapes-breadcrumb-taxonomy.mjs';
loadRuntimeEnv();assertDatabaseTarget({expectedTarget:'local'});
const p=new PrismaClient();const dir=new URL('./',import.meta.url);
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x??null))).digest('hex');
const before=JSON.parse(await fs.readFile(new URL('current-audit.json',dir)));
const operations=[];
function diff(a,b,path,id){if(hash(a)===hash(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],`${path}/${k.replaceAll('~','~0').replaceAll('/','~1')}`,id);return}operations.push({entityType:'live_page',id,field:'contentJson',path,baseHash:hash(a),previousValue:a??null,value:b??null})}
try{
 const rows=await p.livePage.findMany({where:{siteId:'site_aidreamcapes'},select:{id:true,slug:true,contentJson:true,updatedAt:true}});
 const breadcrumbs=[];
 for(const r of rows){const old=before.find(x=>x.id===r.id);assert(old);diff(old.contentJson,r.contentJson,'',r.id);const d=r.contentJson.sections?.v2_main?.settings?.data;if(!d?.breadcrumbs?.length)continue;assert.deepEqual(d.breadcrumbs,aidreamcapesBreadcrumbs(r.slug,d.breadcrumbs));const graph=r.contentJson.seo.jsonLd?.['@graph']??[];const schema=graph.find(n=>n['@type']==='BreadcrumbList');assert(schema, r.slug);assert.deepEqual(schema.itemListElement.map(i=>({href:new URL(i.item).pathname,label:i.name})),d.breadcrumbs,r.slug);breadcrumbs.push({slug:r.slug,crumbs:d.breadcrumbs});}
 const home=rows.find(r=>r.slug==='/');assert.deepEqual(home.contentJson.seo,before.find(r=>r.slug==='/').contentJson.seo);
 const lock=JSON.parse(await fs.readFile('docs/content-locks/aivideosugc-homepage-tdk-approved.json','utf8'));console.log('tdk lock keys',Object.keys(lock));
 const protectedHash=hash(await p.livePage.findMany({where:{siteId:{not:'site_aidreamcapes'}},orderBy:{id:'asc'},select:{id:true,contentJson:true}}));assert.equal(protectedHash,'e4837ab6af10f64648964f42b1d733b2fb28855d9cc0bef81432e7bf16e3f7bd');
 const [derived]=await p.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
 const report={ok:true,target:'local',siteId:'site_aidreamcapes',owner:'LivePage.contentJson',homeRevision:hash(home.contentJson),homeUpdatedAt:home.updatedAt,derivedState:derived,homepageSeoUnchanged:true,protectedOtherSitesHash:protectedHash,breadcrumbs,changedPages:new Set(operations.map(o=>o.id)).size,operations,historicalStateActivated:false};
 await fs.writeFile(new URL('final-field-manifest.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,checkedBreadcrumbPages:breadcrumbs.length,changedPages:report.changedPages,operations:operations.length,homeRevision:report.homeRevision,otherSitesUnchanged:true}));
}finally{await p.$disconnect()}
