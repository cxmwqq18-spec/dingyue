#!/usr/bin/env node
// Targeted current-LivePage repair. Never reads historical content or writes production.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';
loadRuntimeEnv(); assertDatabaseTarget({ expectedTarget: 'local' });
const siteId='site_aidreamcapes', apply=process.argv.includes('--apply-local');
const db=new PrismaClient();
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x??null))).digest('hex');
const out='releases/aidreamcapes-template-relations-20261020';
const facets={
 '/industries/beauty-skincare':['tpl-beauty','tpl-jewel','tpl-ugc','tpl-pack'],
 '/industries/fashion-clothing':['tpl-tryon','tpl-outfit','tpl-color','tpl-sale','tpl-story'],
 '/industries/shoes':['tpl-color','tpl-angle','tpl-sale','tpl-film'],
 '/industries/jewelry-accessories':['tpl-jewel','tpl-angle','tpl-film','tpl-pack'],
 '/industries/electronics':['tpl-angle','tpl-howto','tpl-film','tpl-launch'],
 '/industries/health-wellness':['tpl-ugc','tpl-howto','tpl-story'],
 '/industries/food-drinks':['tpl-drink','tpl-pack','tpl-launch'],
 '/industries/home-living':['tpl-home','tpl-angle','tpl-pack','tpl-howto'],
 '/platforms/tiktok-ads':['tpl-beauty','tpl-outfit','tpl-drink','tpl-launch','tpl-bf','tpl-spark-ads-style-video'],
 '/platforms/instagram-ads':['tpl-beauty','tpl-outfit','tpl-story','tpl-ugc','tpl-sale','tpl-jewel'],
 '/platforms/facebook-ads':['tpl-launch','tpl-bf','tpl-sale','tpl-story','tpl-home'],
 '/platforms/youtube-shorts-ads':['tpl-howto','tpl-film','tpl-drink','tpl-home'],
 '/platforms/amazon-product-photos':['tpl-angle','tpl-color','tpl-pack'],
 '/platforms/shopify-product-photos':['tpl-angle','tpl-color','tpl-pack','tpl-tryon','tpl-jewel','tpl-ugc'],
 '/occasions/sale-discount':['tpl-sale','tpl-bf','tpl-launch','tpl-story'],
 '/occasions/black-friday':['tpl-bf','tpl-sale','tpl-story'],
 '/occasions/holidays':['tpl-story','tpl-sale','tpl-launch'],
};
const mainLinks=[{label:'All templates',href:'/templates'},{label:'Photo templates',href:'/templates/photo'},{label:'Video templates',href:'/templates/video'},{label:'By industry',href:'/industries'},{label:'By platform',href:'/platforms'}];
try {
 const report=await db.$transaction(async tx=>{
  const protectedHash=async()=>hash(await tx.livePage.findMany({where:{siteId:{not:siteId}},orderBy:{id:'asc'},select:{id:true,contentJson:true,updatedAt:true}}));
  const protectedBefore=await protectedHash();
  const rows=await tx.livePage.findMany({where:{siteId},orderBy:{slug:'asc'}});
  const base=rows.find(p=>p.slug==='/templates'); assert(base);
  const dataOf=p=>Object.entries(p.contentJson.sections??{}).find(([,s])=>s.type==='aidreamcapes_v2_page');
  const details=rows.flatMap(p=>{const e=dataOf(p);return e?.[1].settings.layout==='template'?[{p,key:e[0],data:e[1].settings.data}]:[]});
  assert.equal(details.length,18,'Review template inventory before extending this repair');
  const ids=new Map(details.map(x=>[x.data.id,x.p.slug]));
  for(const [path,values] of Object.entries(facets)){assert(rows.some(p=>p.slug===path),`Missing current category ${path}`);for(const id of values)assert(ids.has(id),`Missing template ${id}`);}
  const ops=[],updates=[];
  const prepare=p=>{const next=structuredClone(p.contentJson);const set=(path,value)=>{const keys=path.split('/').slice(1);let a=next;for(const k of keys.slice(0,-1))a=a[k];const key=keys.at(-1);if(hash(a[key])===hash(value))return;ops.push({id:p.id,slug:p.slug,field:'contentJson',path,baseHash:hash(a[key]),value});a[key]=value;};return {next,set};};
  for(const {p,key,data:d} of details){
   const {next,set}=prepare(p),root=`/sections/${key}/settings/data`,kind=p.slug.startsWith('/ai-image-generation/')?'photo':'video';
   const step=d.visual?.steps;assert(step?.prompt&&step.result?.src&&d.maker?.href,`Missing current preset ${p.slug}`);
   const card={image:step.result,label:d.label,prompt:step.prompt,href:d.maker.href,kind,chips:['example'],aspect:step.result.h/step.result.w>1.15?'9:16':step.result.w/step.result.h>1.15?'16:9':'1:1',duration:step.length??15};
   const definition={id:d.id,path:p.slug,name:d.label,kind,description:d.lead??'',card,industries:Object.keys(facets).filter(k=>k.startsWith('/industries/')&&facets[k].includes(d.id)),platforms:Object.keys(facets).filter(k=>k.startsWith('/platforms/')&&facets[k].includes(d.id)),occasions:Object.keys(facets).filter(k=>k.startsWith('/occasions/')&&facets[k].includes(d.id))};
   if(!d.workspaceCases) set(`${root}/workspaceCases`,d.visual.picker.cards);
   set(`${root}/templateDefinition`,definition);
   set(`${root}/visual/picker/cards`,[card]);
   set(`${root}/visual/picker/chips`,[{id:'example',label:d.label}]);
   set(`${root}/visual/picker/title`,d.label);
   set(`${root}/visual/steps/chips`,[d.label]);
   if(hash(next)!==hash(p.contentJson)){ if(next.contentContract) set("/contentContract/sourceRevision",`template-relations-${hash(next).slice(0,16)}`);updates.push({p,next});}
  }
  for(const p of rows.filter(p=>['/templates','/templates/photo','/templates/video'].includes(p.slug)||facets[p.slug])){
   const [key]=dataOf(p),{next,set}=prepare(p),paths=p.slug.startsWith('/templates')?details.filter(x=>p.slug==='/templates'||x.p.slug.startsWith(p.slug.endsWith('/photo')?'/ai-image-generation/':'/ai-video-generation/')).map(x=>x.p.slug):facets[p.slug].map(id=>ids.get(id));
   const d=p.contentJson.sections[key].settings.data;
   if(p.slug==='/templates/photo'||p.slug==='/templates/video') set(`/sections/${key}/settings/data/breadcrumbs`,[{label:"Home",href:"/"},{label:"Templates",href:"/templates"},{label:d.label,href:p.slug}]);
   if(d.visual?.picker?.cards?.length&&!d.workspaceCases) set(`/sections/${key}/settings/data/workspaceCases`,d.visual.picker.cards);
   if(d.visual?.picker) set(`/sections/${key}/settings/data/visual/picker/cards`,[]);
   set(`/sections/${key}/settings/data/templateDirectory`,{paths,links:mainLinks});
   set(`/sections/${key}/settings/data/cards`,[]);
   if(p.slug==='/templates/photo'||p.slug==='/templates/video') set(`/sections/${key}/settings/data/faq`,[]);
   const oldGraph=next.seo?.jsonLd?.['@graph']??[];
   const graph=oldGraph.filter(item=>!['HowTo','ItemList','FAQPage'].includes(item['@type']));
   if(!graph.some(item=>item['@type']==='CollectionPage')) graph.push({'@type':'CollectionPage',url:`https://www.aivideosugc.com${p.slug}`,name:d.h1,description:d.lead});
   graph.push({'@type':'ItemList',numberOfItems:paths.length,itemListElement:paths.map((path,index)=>({'@type':'ListItem',position:index+1,url:`https://www.aivideosugc.com${path}`,name:details.find(x=>x.p.slug===path).data.label}))});
   const faq=next.sections[key].settings.data.faq??[];
   if(faq.length)graph.push({'@type':'FAQPage',mainEntity:faq.map(item=>({'@type':'Question',name:item.q,acceptedAnswer:{'@type':'Answer',text:item.a}}))});
   if(next.seo) set('/seo/jsonLd',{'@context':'https://schema.org','@graph':graph});
   if(hash(next)!==hash(p.contentJson)){ if(next.contentContract) set("/contentContract/sourceRevision",`template-relations-${hash(next).slice(0,16)}`);updates.push({p,next});}
  }
  const inserts=[];
  for(const kind of ['photo','video']){
   const slug=`/templates/${kind}`;if(rows.some(p=>p.slug===slug))continue;
   const content=structuredClone(base.contentJson),[key]=dataOf(base),d=content.sections[key].settings.data;
   const label=kind==='photo'?'Photo Templates':'Video Templates';
   d.breadcrumbs=[{label:"Home",href:"/"},{label:"Templates",href:"/templates"},{label,href:slug}];
   d.id=`templates-${kind}`;d.h1=label;d.label=label;d.lead=kind==='photo'?'Explore product photo styles, compare examples, and choose a template for your product.':'Explore product video ideas, compare examples, and choose a template for your next video.';
   d.templateDirectory={paths:details.filter(x=>x.p.slug.startsWith(kind==='photo'?'/ai-image-generation/':'/ai-video-generation/')).map(x=>x.p.slug),links:mainLinks};
   d.cards=[];d.faq=[];d.visual.picker.cards=[];
   content.seo={...content.seo,title:`${label} | AIVideosUGC`,description:d.lead,twitterDescription:d.lead,canonical:`https://www.aivideosugc.com${slug}`,canonicalPath:slug,jsonLd:{'@context':'https://schema.org','@type':'CollectionPage',url:`https://www.aivideosugc.com${slug}`,name:label,description:d.lead}};
   inserts.push({id:`site_aidreamcapes_templates_${kind}`,siteId,slug,title:label,pageType:base.pageType,templateKey:base.templateKey,contentJson:content});
  }
  const manifest={siteId,apply,readAt:new Date().toISOString(),owner:'LivePage.contentJson',operations:ops,insertions:inserts,templateCount:details.length};
  await fs.mkdir(out,{recursive:true});await fs.writeFile(`${out}/${Date.now()}-${apply?'apply':'plan'}-manifest.json`,JSON.stringify(manifest,null,2));await fs.writeFile(`${out}/${apply?'apply':'plan'}-manifest.json`,JSON.stringify(manifest,null,2));
  if(apply){for(const {p,next} of updates){const result=await tx.livePage.updateMany({where:{siteId,id:p.id,updatedAt:p.updatedAt},data:{contentJson:next}});assert.equal(result.count,1,`Concurrent edit ${p.slug}`);}for(const p of inserts)await tx.livePage.create({data:p});}
  assert.equal(await protectedHash(),protectedBefore,'Other storefront data changed');
  return {siteId,applied:apply,pages:updates.length,newPages:inserts.length,fields:ops.length,templates:details.length,otherStoresUnchanged:true,historicalStateUsed:false};
 },{isolationLevel:'Serializable',timeout:60000});
 await fs.writeFile(`${out}/${apply?'applied':'plan'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.$disconnect();}
