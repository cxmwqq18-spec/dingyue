import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import './scripts/load-runtime-env.mjs';
import {PrismaClient} from '@prisma/client';
import {load} from 'cheerio';
const dir='/www/wwwroot/aidreamcapes.com/ops/homepage-tdk-20261017';
const lock=JSON.parse(fs.readFileSync(`${dir}/approved.json`,'utf8'));
const before=JSON.parse(fs.readFileSync(`${dir}/before.json`,'utf8'));
const siteId='site_aidreamcapes';const pageId='site_aidreamcapes_home';
const stable=v=>v===undefined?'undefined':v===null||typeof v!=='object'?JSON.stringify(v):v instanceof Date?JSON.stringify(v.toISOString()):Array.isArray(v)?`[${v.map(stable).join(',')}]`:`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
const hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
const remove=(v,p)=>{const keys=p.split('/').slice(1);const parent=keys.slice(0,-1).reduce((a,k)=>a[k],v);delete parent[keys.at(-1)]};
async function read(url,host){
 const res=await fetch(url,{headers:{'x-forwarded-host':host,'x-forwarded-proto':'https'},signal:AbortSignal.timeout(45000)});assert.equal(res.status,200,url);
 const html=await res.text();const $=load(html);
 const graphs=$('head script[type="application/ld+json"]').toArray().flatMap(n=>{const json=JSON.parse($(n).text());return json['@graph']||[json]});
 return {url,status:res.status,title:$('title').text(),description:$('head meta[name=description]').attr('content'),keywords:$('head meta[name=keywords]').attr('content')??null,canonical:$('link[rel=canonical]').attr('href'),ogTitle:$('meta[property="og:title"]').attr('content'),ogDescription:$('meta[property="og:description"]').attr('content'),twitterTitle:$('meta[name="twitter:title"]').attr('content'),twitterDescription:$('meta[name="twitter:description"]').attr('content'),titleCount:$('title').length,descriptionCount:$('head meta[name=description]').length,keywordsCount:$('head meta[name=keywords]').length,webpage:graphs.find(n=>n['@id']==='https://www.aivideosugc.com/#webpage'),visibleHash:hash($('body').clone().find('script,style').remove().end().text().replace(/\s+/g,' ').trim())};
}
const db=new PrismaClient();
try{
 const row=await db.livePage.findFirst({where:{siteId,id:pageId}});assert(row);assert.equal(row.slug,'/');
 for(const k of ['title','description','keywords'])assert.equal(row.contentJson.seo[k],lock.seo[k]);
 const webpage=row.contentJson.seo.jsonLd['@graph'].find(n=>n['@id']==='https://www.aivideosugc.com/#webpage');assert.equal(webpage.name,lock.seo.title);assert.equal(webpage.description,lock.seo.description);assert.equal(row.contentJson.seo.twitterDescription,lock.seo.description);
 const unchanged=structuredClone(row.contentJson);for(const p of before.tdkPaths)remove(unchanged,p);assert.equal(hash(unchanged),before.outsideTdkHash);
 const otherPages=await db.livePage.findMany({where:{siteId,id:{not:pageId}},orderBy:{id:'asc'}});assert.equal(hash(otherPages),before.otherPagesHash);
 const mydreamshoots=await db.livePage.findMany({where:{siteId:'site_dreamshoot'},orderBy:{id:'asc'}});assert.equal(hash(mydreamshoots),before.mydreamshootsPagesHash);
 const derived=await db.sitePublishedState.findUnique({where:{siteId},select:{siteId:true,revision:true,contentHash:true,publishedAt:true}});
 const origin=await read('http://127.0.0.1:3013/','www.aivideosugc.com');
 const publicReadback=await read('https://www.aivideosugc.com/','www.aivideosugc.com');
 for(const result of [origin,publicReadback]){
  assert.equal(result.title,lock.seo.title);assert.equal(result.description,lock.seo.description);assert.equal(result.canonical,'https://www.aivideosugc.com/');assert.equal(result.ogTitle,lock.seo.title);assert.equal(result.ogDescription,lock.seo.description);assert.equal(result.twitterTitle,lock.seo.title);assert.equal(result.twitterDescription,lock.seo.description);assert.equal(result.titleCount,1);assert.equal(result.descriptionCount,1);assert.equal(result.webpage.name,lock.seo.title);assert.equal(result.webpage.description,lock.seo.description);assert.equal(result.visibleHash,before.origin.visibleHash);
 }
 const otherOrigin=await read('http://127.0.0.1:3010/','www.mydreamshoots.com');
 for(const k of ['title','description','canonical','visibleHash'])assert.equal(otherOrigin[k],before.otherOrigin[k]);
 const report={status:publicReadback.keywords===lock.seo.keywords?'complete':'data-applied-awaiting-keywords-renderer-approval',verifiedAt:new Date().toISOString(),siteId,pageId,sourceOfTruth:'LivePage.contentJson.seo',codeCommit:fs.readFileSync('.deployed-commit','utf8').trim(),sourceUpdatedAt:row.updatedAt,contentHash:hash(row.contentJson),derivedState:derived,tdk:lock.seo,outsideTdkFieldsUnchanged:true,otherAidreamcapesPagesUnchanged:true,mydreamshootsRelationalPagesUnchanged:true,mydreamshootsHomepageUnchanged:true,origin,publicReadback,keywordsStoredExactly:true,keywordsHtmlPresent:publicReadback.keywords!==null,historicalStateActivated:false};
 fs.writeFileSync(`${dir}/verification.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await db.$disconnect()}
