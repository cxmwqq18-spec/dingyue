#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {PrismaClient} from '@prisma/client';
import {loadRuntimeEnv} from './load-runtime-env.mjs';
import {assertDatabaseTarget} from './lib/database-target.mjs';
import {aidreamcapesHomeComposerFields} from './lib/aidreamcapes-home-composer-content.mjs';
loadRuntimeEnv();assertDatabaseTarget({expectedTarget:'local'});
const applying=process.argv.includes('--apply-local'),siteId='site_aidreamcapes',id='site_aidreamcapes_home';
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(v===undefined?'<undefined>':JSON.stringify(stable(v))).digest('hex');
const db=new PrismaClient();try{const report=await db.$transaction(async tx=>{
 const protectedRows=()=>tx.livePage.findMany({where:{siteId:'site_dreamshoot'},orderBy:{id:'asc'},select:{id:true,contentJson:true}});
 const protectedBefore=hash(await protectedRows());const row=await tx.livePage.findFirst({where:{siteId,id,slug:'/'}});assert(row);
 const next=structuredClone(row.contentJson),operations=[];
 for(const {path,value} of aidreamcapesHomeComposerFields(row.contentJson)){const keys=path.split('/').slice(1);let cursor=next;for(const key of keys.slice(0,-1))cursor=cursor[key]??={};const previousValue=cursor[keys.at(-1)];if(hash(previousValue)===hash(value))continue;operations.push({entityType:'live_page',id,field:'contentJson',path,baseHash:hash(previousValue),...(previousValue!==undefined?{previousValue}:{}),value});cursor[keys.at(-1)]=value;}
 assert(!/[\u3400-\u9fff]/u.test(JSON.stringify(next)),'Public copy remains English');assert.deepEqual(next.mediaManifest,row.contentJson.mediaManifest);assert.deepEqual(next.sections.v2_main.settings.data.visual.picker.cards,row.contentJson.sections.v2_main.settings.data.visual.picker.cards);
 if(applying&&operations.length){const changed=await tx.livePage.updateMany({where:{siteId,id,updatedAt:row.updatedAt},data:{contentJson:next}});assert.equal(changed.count,1);const readback=await tx.livePage.findFirst({where:{siteId,id}});assert.equal(hash(readback.contentJson),hash(next));}
 assert.equal(hash(await protectedRows()),protectedBefore);
 const derived=await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
 return{ok:true,target:'local',siteId,id,owner:'LivePage.contentJson',applying,operations,revisionBefore:hash(row.contentJson),revisionAfter:hash(next),protectedUnchanged:true,derivedState:{...derived[0],historicalStateActivated:false}};
 },{isolationLevel:'Serializable',timeout:60000});await fs.mkdir('releases/aidreamcapes-home-composer-20261017',{recursive:true});await fs.writeFile('releases/aidreamcapes-home-composer-20261017/local-'+(applying?'apply':'plan')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,operations:report.operations.map(o=>o.path)},null,2));}finally{await db.$disconnect();}
