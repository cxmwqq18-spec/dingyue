#!/usr/bin/env node
// Current production public fields -> local Aidreamcapes, with an explicit CAS
// manifest. Never connects to production, generates content, or reads snapshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';
const arg = key => process.argv.find(a => a.startsWith(`${key}=`))?.slice(key.length + 1);
assertDatabaseTarget({expectedTarget:'local'});
const siteId = 'site_aidreamcapes';
const apply = process.argv.includes('--apply');
const stable = v => v === undefined ? '<undefined>' : JSON.stringify(v, (_, x) => x && !Array.isArray(x) && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k,x[k]])) : x);
const hash = v => crypto.createHash('sha256').update(stable(v)).digest('hex');
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const esc = s => s.replaceAll('~','~0').replaceAll('/','~1');
const parts = p => p.slice(1).split('/').map(k => k.replaceAll('~1','/').replaceAll('~0','~'));
const get = (root,p) => parts(p).reduce((v,k) => v?.[k],root);
const put = (root,p,value) => {const keys=parts(p);let parent=root;for(const key of keys.slice(0,-1)){assert(parent && Object.hasOwn(parent,key),`Parent changed: ${p}`);parent=parent[key]} parent[keys.at(-1)]=structuredClone(value)};
const fields = {page:['pageType','templateKey','title','contentJson'],media:['label','mimeType','usageType','sourceType','previewUrl','originUrl','altText','notes']};
const identity = (a,b) => {
 for(const field of ['id','ref','@id','key','label','name','slug']) {
  if(!a.every(x=>obj(x)&&typeof x[field]==='string')||!b.every(x=>obj(x)&&typeof x[field]==='string'))continue;
  const aa=a.map(x=>x[field]),bb=b.map(x=>x[field]);
  if(new Set(aa).size===a.length && new Set(bb).size===b.length && aa.every(x=>bb.includes(x)))return field;
 }
};
const db = new PrismaClient();
try {
 if(!apply){
  const source=JSON.parse(fs.readFileSync(arg('--source'),'utf8'));
  assert.equal(source.format,'current-relational-public-fields');assert.equal(source.siteId,siteId);
  assert(Date.now()-Date.parse(source.readAt)<600000,'Current source read is too old; reread production');
  const pages=await db.livePage.findMany({where:{siteId},orderBy:{slug:'asc'}});
  const media=await db.mediaAsset.findMany({where:{siteId,usageType:{in:['theme','package','sample']}},orderBy:{storageKey:'asc'}});
  const manifest={format:'current-live-fields-to-local-v1',siteId,sourceReadAt:source.readAt,sourceFingerprint:source.fingerprint,createdAt:new Date().toISOString(),historicalStateActivated:false,operations:[],creates:[],preserved:[],localOnlyPages:pages.filter(p=>!source.pages.some(s=>s.slug===p.slug)).map(p=>p.slug)};
  for(const [kind,rows,local,key] of [['page',source.pages,pages,'slug'],['media',source.media,media,'storageKey']]){
   for(const src of rows){
    assert.equal(src.siteId,siteId);
    if(kind==='media')assert(['theme','package','sample'].includes(src.usageType));
    const target=local.find(r=>r[key]===src[key]);
    if(!target){manifest.creates.push({kind,id:src.id,key:src[key],fields:Object.fromEntries([...(kind==='page'?['slug']:['storageKey']),...fields[kind]].map(f=>[f,src[f]]))});continue}
    const newer=Date.parse(target.updatedAt)>Date.parse(src.updatedAt);
    const add=(path,value)=>manifest.operations.push({kind,id:target.id,key:target[key],targetUpdatedAt:target.updatedAt,path,expectedHash:hash(get(target,path)),value});
    const diff=(before,after,path)=>{
     if(hash(before)===hash(after))return;
     if(newer && /\/(?:[^/]*[Hh]ref|publicSlug|sceneSlug)$/.test(path) && before !== undefined){manifest.preserved.push({kind,key:target[key],path,reason:'newer-local-routing-field'});return}
     if(obj(before)&&obj(after)){
      for(const [k,v] of Object.entries(after)){assert(!['__proto__','prototype','constructor'].includes(k));diff(before[k],v,`${path}/${esc(k)}`)}return;
     }
     if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){
      const field=identity(before,after);
      if(field){for(let i=0;i<before.length;i++)diff(before[i],after.find(v=>v[field]===before[i][field]),`${path}/${i}`);return}
     }
     if(newer && Array.isArray(before) && /"(?:href|publicSlug|sceneSlug)"/.test(JSON.stringify(before))){manifest.preserved.push({kind,key:target[key],path,reason:'newer-local-routing-array-without-stable-alignment'});return}
     add(path,after);
    };
    for(const field of fields[kind])diff(target[field],src[field],`/${field}`);
   }
  }
  fs.writeFileSync(arg('--manifest'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({mode:'plan',operations:manifest.operations.length,changedPages:new Set(manifest.operations.filter(o=>o.kind==='page').map(o=>o.id)).size,creates:manifest.creates.map(c=>({kind:c.kind,key:c.key})),preserved:manifest.preserved.length,localOnlyPages:manifest.localOnlyPages}));
 }else{
  const m=JSON.parse(fs.readFileSync(arg('--manifest'),'utf8'));
  assert.equal(m.format,'current-live-fields-to-local-v1');assert.equal(m.siteId,siteId);assert.equal(m.historicalStateActivated,false);
  assert(Date.now()-Date.parse(m.sourceReadAt)<900000,'Manifest source is stale; reread current production');
  const check=JSON.parse(fs.readFileSync(arg('--verified-source'),'utf8'));
  assert.equal(check.fingerprint,m.sourceFingerprint,'Production changed since planning; replan');
  assert(Date.now()-Date.parse(check.readAt)<120000,'Source verification is stale');
  for(const o of m.operations){assert(fields[o.kind]?.includes(parts(o.path)[0]));assert(!parts(o.path).some(k=>['__proto__','prototype','constructor'].includes(k)))}
  const report=await db.$transaction(async tx=>{
   const protectedHash=async()=>{
    const tables=await tx.$queryRaw`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='siteId' AND table_name NOT IN ('LivePage','MediaAsset','SitePublishedState') ORDER BY table_name`;
    const hashes={};
    for(const {table_name:name} of tables){assert(/^[A-Za-z0-9_]+$/.test(name));const [r]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS n, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)),'')) AS hash FROM "${name}" t WHERE "siteId" IN ('site_dreamshoot','site_aidreamcapes')`);hashes[name]=r}
    for(const name of ['Site','Customer','CustomerSession','Subscription','Order','PaymentEvent','CreditBalance','CreditLedger','GenerationJob','CustomerModel','AssetUpload','Album','AidreamcapesVideoTask']) {
     if(hashes[name])continue;
     const [exists]=await tx.$queryRaw`SELECT to_regclass(${`public."${name}"`})::text AS name`;
     if(!exists.name)continue;
     const [r]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS n, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)),'')) AS hash FROM "${name}" t`);hashes[name]=r;
    }
    for(const name of ['LivePage','MediaAsset']){const[r]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS n, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)),'')) AS hash FROM "${name}" t WHERE "siteId"='site_dreamshoot'`);hashes[`mydreamshoots.${name}`]=r}
    return hashes;
   };
   const before=await protectedHash();const conflicts=[];let applied=0,createdPages=0,createdMedia=0;const revisions=[];
   for(const id of [...new Set(m.operations.map(o=>`${o.kind}:${o.id}`))]){
    const ops=m.operations.filter(o=>`${o.kind}:${o.id}`===id),first=ops[0];const model=first.kind==='page'?tx.livePage:tx.mediaAsset;
    const row=await model.findFirst({where:{siteId,id:first.id}});assert(row,'Target row disappeared');
    if(row.updatedAt.toISOString()!==first.targetUpdatedAt){conflicts.push({id,key:first.key,reason:'local-row-changed-after-plan'});continue}
    const next=structuredClone(row);
    for(const op of ops){assert.equal(hash(get(row,op.path)),op.expectedHash,'Local field changed');put(next,op.path,op.value)}
    const data=Object.fromEntries([...new Set(ops.map(o=>parts(o.path)[0]))].map(k=>[k,next[k]]));
    const r=await model.updateMany({where:{siteId,id:row.id,updatedAt:row.updatedAt},data});assert.equal(r.count,1);applied+=ops.length;revisions.push({kind:first.kind,key:first.key,beforeHash:hash(row),fields:Object.keys(data)});
   }
   for(const c of m.creates){
    assert(fields[c.kind]);const model=c.kind==='page'?tx.livePage:tx.mediaAsset;
    assert(!await model.findUnique({where:{id:c.id}}),'New row ID already exists');
    assert.equal(c.kind==='page'?c.fields.slug:c.fields.storageKey,c.key);
    if(c.kind==='media')assert(['theme','package','sample'].includes(c.fields.usageType));
    const allowed=new Set([...(c.kind==='page'?['slug']:['storageKey']),...fields[c.kind]]);assert(Object.keys(c.fields).every(k=>allowed.has(k)));
    await model.create({data:{id:c.id,siteId,...c.fields}});if(c.kind==='page')createdPages++;else createdMedia++;
   }
   const after=await protectedHash();assert.deepEqual(after,before,'Protected local business or MyDreamShoots data changed');
   const home=await tx.livePage.findUniqueOrThrow({where:{siteId_slug:{siteId,slug:'/'}}});
   const [derivedTable]=await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS name`;
   const derived=derivedTable.name ? await tx.sitePublishedState.findUnique({where:{siteId},select:{revision:true,contentHash:true}}) : null;
   return {ok:true,siteId,target:'local',applied,createdPages,createdMedia,conflicts,preserved:m.preserved,localOnlyPages:m.localOnlyPages,sourceFingerprint:m.sourceFingerprint,owner:'LivePage.contentJson',derivedCacheConsumed:false,derivedState:derived,historicalStateActivated:false,protectedBefore:before,protectedAfter:after,homeHash:hash(home.contentJson),revisions};
  },{isolationLevel:'Serializable',timeout:180000});
  fs.writeFileSync(arg('--report'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,applied:report.applied,createdPages:report.createdPages,createdMedia:report.createdMedia,conflicts:report.conflicts,preserved:report.preserved.length,derivedCacheConsumed:false}));
 }
}finally{await db.$disconnect()}
