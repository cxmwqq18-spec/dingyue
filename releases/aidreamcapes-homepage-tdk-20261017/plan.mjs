import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import './scripts/load-runtime-env.mjs';
import {PrismaClient} from '@prisma/client';
import {load} from 'cheerio';
const siteId='site_aidreamcapes';
const pageId='site_aidreamcapes_home';
const dir='/www/wwwroot/aidreamcapes.com/ops/homepage-tdk-20261017';
const lock=JSON.parse(fs.readFileSync('/tmp/aivideosugc-homepage-tdk-20261017-approved.json','utf8'));
assert.equal(lock.site.id,siteId);assert.equal(lock.page.id,pageId);
const stable=v=>v===undefined?'undefined':v===null||typeof v!=='object'?JSON.stringify(v):v instanceof Date?JSON.stringify(v.toISOString()):Array.isArray(v)?`[${v.map(stable).join(',')}]`:`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
const hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
const get=(v,p)=>p.split('/').slice(1).reduce((a,k)=>a?.[k],v);
const remove=(v,p)=>{const keys=p.split('/').slice(1);const parent=keys.slice(0,-1).reduce((a,k)=>a[k],v);delete parent[keys.at(-1)]};
async function htmlRead(url,host){const res=await fetch(url,{headers:{'x-forwarded-host':host,'x-forwarded-proto':'https'},signal:AbortSignal.timeout(45000)});assert.equal(res.status,200,url);const html=await res.text();const $=load(html);const result={status:res.status,title:$('title').text(),description:$('meta[name=description]').attr('content'),keywords:$('meta[name=keywords]').attr('content'),canonical:$('link[rel=canonical]').attr('href'),visibleHash:hash($('body').clone().find('script,style').remove().end().text().replace(/\s+/g,' ').trim())};return result}
const db=new PrismaClient();
try{
 const site=await db.site.findFirst({where:{id:siteId},select:{id:true,slug:true,primaryDomain:true}});assert.equal(site.primaryDomain,'www.aivideosugc.com');
 const row=await db.livePage.findFirst({where:{siteId,id:pageId}});assert(row);assert.equal(row.slug,'/');
 const index=row.contentJson.seo.jsonLd['@graph'].findIndex(n=>n['@type']==='WebPage'&&n['@id']==='https://www.aivideosugc.com/#webpage');assert(index>=0);
 const pairs=[['/seo/title',lock.seo.title],['/seo/keywords',lock.seo.keywords],['/seo/description',lock.seo.description],['/seo/twitterDescription',lock.seo.description],[`/seo/jsonLd/@graph/${index}/name`,lock.seo.title],[`/seo/jsonLd/@graph/${index}/description`,lock.seo.description]];
 const operations=pairs.filter(([p,v])=>get(row.contentJson,p)!==v).map(([fieldPath,value])=>({entityType:'live_page',entityKey:pageId,field:'contentJson',fieldPath,operation:'upsert',baseHash:hash(get(row.contentJson,fieldPath)),previousValue:get(row.contentJson,fieldPath),value}));
 const codeCommit=fs.readFileSync('.deployed-commit','utf8').trim();assert.match(codeCommit,/^[a-f0-9]{40}$/);
 const manifest={formatVersion:2,releaseId:'aivideosugc-homepage-tdk-20261017',codeCommit,target:'production',sourceTarget:'local',sourceSiteId:siteId,siteId,createdAt:new Date().toISOString(),operations,deletions:[]};
 const unchanged=structuredClone(row.contentJson);for(const [p] of pairs) remove(unchanged,p);
 const otherPages=await db.livePage.findMany({where:{siteId,id:{not:pageId}},orderBy:{id:'asc'}});
 const mydreamshoots=await db.livePage.findMany({where:{siteId:'site_dreamshoot'},orderBy:{id:'asc'}});
 const derived=await db.sitePublishedState.findUnique({where:{siteId},select:{siteId:true,revision:true,contentHash:true,publishedAt:true}});
 const origin=await htmlRead('http://127.0.0.1:3013/','www.aivideosugc.com');
 const otherOrigin=await htmlRead('http://127.0.0.1:3010/','www.mydreamshoots.com');
 const before={site,pageId,updatedAt:row.updatedAt,codeCommit,derivedState:derived,contentHash:hash(row.contentJson),outsideTdkHash:hash(unchanged),otherPagesHash:hash(otherPages),mydreamshootsPagesHash:hash(mydreamshoots),tdkPaths:pairs.map(([p])=>p),origin,otherOrigin};
 fs.mkdirSync(dir,{recursive:true});fs.copyFileSync('/tmp/aivideosugc-homepage-tdk-20261017-approved.json',`${dir}/approved.json`);fs.writeFileSync(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(`${dir}/before.json`,JSON.stringify(before,null,2)+'\n');
 console.log(JSON.stringify({manifest,before,remoteRecordDirectory:dir},null,2));
}finally{await db.$disconnect()}
