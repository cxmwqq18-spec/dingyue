#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {PrismaClient} from '@prisma/client';
import {loadRuntimeEnv} from './load-runtime-env.mjs';
import {assertDatabaseTarget} from './lib/database-target.mjs';
import {aidreamcapesHomeSixStepFields} from './lib/aidreamcapes-home-six-step-content.mjs';
loadRuntimeEnv();assertDatabaseTarget({expectedTarget:'local'});
const args=process.argv.slice(2),applying=args.includes('--apply-local');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(v===undefined?'<undefined>':JSON.stringify(stable(v))).digest('hex');
const siteId='site_aidreamcapes',id='site_aidreamcapes_home',db=new PrismaClient();
try {
 const report=await db.$transaction(async tx=>{
  const protectedRows=()=>tx.livePage.findMany({where:{siteId:'site_dreamshoot'},orderBy:{id:'asc'},select:{id:true,contentJson:true}});
  const protectedBefore=hash(await protectedRows());
  const row=await tx.livePage.findFirstOrThrow({where:{siteId,id,slug:'/'}}),next=structuredClone(row.contentJson),operations=[];
  const fields=aidreamcapesHomeSixStepFields(row.contentJson);
  for(const {path,value} of fields){const keys=path.split('/').slice(1);let cursor=next;for(const key of keys.slice(0,-1))cursor=cursor[key]??={};const previousValue=cursor[keys.at(-1)];if(hash(previousValue)===hash(value))continue;operations.push({entityType:'live_page',id,field:'contentJson',path,baseHash:hash(previousValue),...(previousValue===undefined?{}:{previousValue}),value});cursor[keys.at(-1)]=value;}
  assert.deepEqual(next.mediaManifest,row.contentJson.mediaManifest);assert.deepEqual(next.sections.v2_main.settings.data.visual,row.contentJson.sections.v2_main.settings.data.visual);assert(!/[\u3400-\u9fff]/u.test(JSON.stringify(next)));
  if(applying&&operations.length){const result=await tx.livePage.updateMany({where:{siteId,id,updatedAt:row.updatedAt},data:{contentJson:next}});assert.equal(result.count,1);assert.equal(hash((await tx.livePage.findFirstOrThrow({where:{siteId,id}})).contentJson),hash(next));}
  const protectedAfter=hash(await protectedRows());assert.equal(protectedBefore,protectedAfter);
  const relations=await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
  const derived={relation:relations[0]?.relation,record:relations[0]?.relation?await tx.sitePublishedState.findUnique({where:{siteId},select:{revision:true,contentHash:true}}):null};
  return {ok:true,target:'local',siteId,id,owner:'LivePage.contentJson',applying,operations,revisionBefore:hash(row.contentJson),revisionAfter:hash(next),sourceRevision:next.contentContract.sourceRevision,protectedBefore,protectedAfter,derivedState:derived,historicalStateActivated:false};
 },{isolationLevel:'Serializable',timeout:60000});
 const out='releases/aidreamcapes-home-six-step-20261017';await fs.mkdir(out,{recursive:true});await fs.writeFile(`${out}/local-${applying?'apply':'plan'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,operations:report.operations.map(op=>op.path)},null,2));
} finally {await db.$disconnect()}
