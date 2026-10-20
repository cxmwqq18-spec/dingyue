#!/usr/bin/env node
// Audit evidence is read only. Output contains explicit field inverses, never
// an importable page/publication snapshot. New directory rows are not targeted.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";
const args=process.argv.slice(2),value=k=>args.find(a=>a.startsWith(`${k}=`))?.slice(k.length+1);
const audit=JSON.parse(fs.readFileSync(value("--audit"),"utf8"));
assert.equal(audit.siteId,"site_aidreamcapes"); assert.equal(audit.auditOnly,true);
const require=createRequire(import.meta.url),cache=new Map();
function module(name){if(cache.has(name))return cache.get(name).exports;const m={exports:{}};cache.set(name,m);const source=fs.readFileSync(`src/lib/aidreamcapes-workspace/${name}.ts`,"utf8");const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function("require","module","exports",code)(id=>id.startsWith("./")?module(id.slice(2)):require(id),m,m.exports);return m.exports;}
const routes=module("static-routes");
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const hash=v=>crypto.createHash("sha256").update(v===undefined?"<undefined>":JSON.stringify(stable(v))).digest("hex");
function normalize(v){
  if(Array.isArray(v))return v.map(normalize);
  if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,normalize(x)]));
  if(typeof v!=="string"||!v.startsWith("/"))return v;
  const u=new URL(v,"https://www.aivideosugc.com");
  if(u.hostname!=="www.aivideosugc.com")return v;
  if(u.pathname==="/templates"&&["photo","video"].includes(u.searchParams.get("type")))return `/templates/${u.searchParams.get("type")}${u.hash}`;
  if(u.pathname!=="/app/create")return v;
  return (routes.legacyCreateHrefToStatic(u.pathname+u.search)||u.pathname+u.search)+u.hash;
}
const equal=(a,b)=>hash(normalize(a))===hash(normalize(b));
const object=v=>v&&typeof v==="object"&&!Array.isArray(v);
const esc=k=>String(k).replaceAll("~","~0").replaceAll("/","~1");
const conflicts=[],excluded=[];let context;
function inverse(before,generated,current,path){
  if(equal(before,generated))return current;
  if(path==="/contentContract"){excluded.push(path);return current;}
  if(object(before)&&object(generated)&&object(current)){
    const next=structuredClone(current);
    for(const key of new Set([...Object.keys(before),...Object.keys(generated)])){
      const v=inverse(before[key],generated[key],current[key],`${path}/${esc(key)}`);
      if(v===undefined)delete next[key];else next[key]=v;
    }
    return next;
  }
  if(Array.isArray(before)&&Array.isArray(generated)&&Array.isArray(current)&&before.length===generated.length&&before.length===current.length){
    const key=["@id","id","@type","publicSlug","slug"].find(k=>before.every((v,i)=>object(v)&&v[k]!==undefined&&v[k]===generated[i]?.[k]&&v[k]===current[i]?.[k])&&new Set(before.map(v=>v[k])).size===before.length);
    if(key)return current.map((v,i)=>inverse(before[i],generated[i],v,`${path}/${i}`));
  }
  if(equal(current,generated))return before===undefined?undefined:normalize(before);
  if(equal(current,before))return current;
  conflicts.push({slug:context,path,beforeHash:hash(before),generatedHash:hash(generated),currentHash:hash(current)});
  return current;
}
function nav(before,generated,current){
  const alias=m=>({...m,label:m.label==="Photo"?"Image":m.label==="Examples"?"Templates":m.label});
  const old=(before?.menus||[]).map(alias),bad=(generated?.menus||[]).map(alias);
  const result=structuredClone(current||{});const menus=(current?.menus||[]).map(alias);
  result.menus=menus.map(m=>{
    const a=old.find(x=>x.label===m.label),b=bad.find(x=>x.label===m.label);
    return a&&b?inverse(a,b,m,`/navigation/${m.label}`):m;
  });
  // Keep the new AI Actors directory menu and its current position.
  // Bring back user-created menu entries removed by the bulk overwrite.
  for(const m of old)if(!bad.some(b=>b.label===m.label)&&!result.menus.some(c=>c.label===m.label))result.menus.push(normalize(m));
  return result;
}
const operations=[];let owner;
function diff(current,next,path=""){
  if(hash(current)===hash(next))return;
  if(object(current)&&object(next)){
    for(const k of new Set([...Object.keys(current),...Object.keys(next)]))diff(current[k],next[k],`${path}/${esc(k)}`);
    return;
  }
  assert(path&&path!=="/");
  operations.push({...owner,path,action:next===undefined?"delete":"set",expectedHash:hash(current),...(next===undefined?{}:{value:next})});
}
const generated=new Map(audit.generated.map(p=>[p.slug,p])),current=new Map(audit.current.map(p=>[p.slug,p]));
const seen=new Set();
for(const before of audit.before){
  if(seen.has(before.id))continue;seen.add(before.id);
  const bad=generated.get(before.slug),row=current.get(before.slug);
  if(!bad||!row)continue;
  assert.equal(before.id,row.id);
  context=row.slug;
  let next=inverse(before.contentJson,bad.contentJson,row.contentJson,"");
  if(before.contentJson.siteNavigation&&row.contentJson.siteNavigation)next.siteNavigation=nav(before.contentJson.siteNavigation,bad.contentJson.siteNavigation,row.contentJson.siteNavigation);
  owner={entity:"live_page",id:row.id,slug:row.slug,field:"contentJson"};diff(row.contentJson,next);
}
const beforeNav=audit.beforeSettings.draftJson?.aidreamcapesV2Navigation;
const currentNav=audit.currentSettings.draftJson?.aidreamcapesV2Navigation;
context="navigation";const desiredNav=nav(beforeNav,audit.generatedNavigation,currentNav);
if(hash(desiredNav.menus)!==hash(currentNav.menus))operations.push({entity:"navigation",id:audit.siteId,path:"/aidreamcapesV2Navigation/menus",action:"set",expectedHash:hash(currentNav.menus),value:desiredNav.menus});
const manifest={siteId:audit.siteId,mode:"field-level-inverse",runtimeCommit:value("--runtime-commit"),historicalStateActivation:false,source:"Audit-only comparison of the 12:23 bulk overwrite with current relational fields",createdPages:0,deletedPages:0,operations};
fs.writeFileSync(value("--out"),JSON.stringify(manifest,null,2));
fs.writeFileSync(value("--out")+".review.json",JSON.stringify({operations:operations.length,pages:new Set(operations.filter(o=>o.entity==="live_page").map(o=>o.id)).size,homeOperations:operations.filter(o=>o.slug==="/").map(o=>o.path),conflicts,excluded,retainedNewPages:audit.generated.filter(r=>!audit.before.some(b=>b.slug===r.slug)&&audit.current.some(c=>c.slug===r.slug)).length},null,2));
console.log(JSON.stringify({operations:operations.length,pages:new Set(operations.filter(o=>o.entity==="live_page").map(o=>o.id)).size,conflicts:conflicts.length}));
