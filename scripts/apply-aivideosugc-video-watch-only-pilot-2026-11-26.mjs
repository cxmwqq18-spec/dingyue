#!/usr/bin/env node
// Ten-video canonical pilot: mark selected video cards as watch-only. The
// renderer omits contentUrl and the sitemap omits content_loc for these cards;
// watch/embedUrl/player_loc remain. Reversible by deleting canonicalMode.
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
const CONFIRM="aivideosugc-video-watch-only-pilot-2026-11-26";
const MANIFEST=new URL("./manifests/aivideosugc-video-watch-only-pilot-2026-11-26.json",import.meta.url);
const PILOT=["indoor-entryway-greeting","notes-app-chaos-to-calm","mint-shower-speaker-bathroom-concert","green-notebook-desk-ritual","sunset-lamp-room-glow-before-after","black-speaker-balcony-soundtest","cable-organizer-desk-before-after","home-table-explanation","headphone-creator-review","pink-serum-dropper-routine"];
const siteId=assertAllowedSite("site_aidreamcapes");
const target=argumentValue("--target")||process.env.DATABASE_TARGET||"local";
const apply=hasArgument("--apply");
const confirmed=hasArgument(`--confirm=${CONFIRM}`);
assertDatabaseTarget({expectedTarget:target,requireProductionConfirmation:apply,productionConfirmed:confirmed});
if(apply&&target==="production")assert(confirmed,`Production update requires --confirm=${CONFIRM}`);
const stable=v=>v instanceof Date?JSON.stringify(v.toISOString()):v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?`[${v.map(stable).join(",")}]`:`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
const hash=v=>crypto.createHash("sha256").update(stable(v)).digest("hex");
function find(node,slug){if(!node||typeof node!=="object")return;if(Array.isArray(node)){for(const x of node){const h=find(x,slug);if(h)return h}return}if(node.publicSlug===slug&&node.video?.src)return node;for(const x of Object.values(node)){const h=find(x,slug);if(h)return h}}
const db=new PrismaClient();
try{
 const rows=await db.livePage.findMany({where:{siteId},select:{id:true,slug:true,contentJson:true,updatedAt:true}});
 const plans=new Map(); const matches=[];
 for(const slug of PILOT){
  const owners=rows.filter(r=>Boolean(find(r.contentJson,slug)));
  assert.equal(owners.length,1,`${slug}: expected one owner, found ${owners.length}`);
  const owner=owners[0]; const card=find(owner.contentJson,slug); assert(card?.video?.src,`${slug}: video card missing`);
  if(!plans.has(owner.id))plans.set(owner.id,{owner,next:structuredClone(owner.contentJson),items:[]});
  const plan=plans.get(owner.id); const nextCard=find(plan.next,slug); assert(nextCard?.video?.src,`${slug}: clone missing`);
  nextCard.video.canonicalMode="watch-only"; plan.items.push({slug,owner:owner.slug}); matches.push({slug,owner:owner.slug});
 }
 const updates=[...plans.values()].map(p=>({...p,baseHash:hash(p.owner.contentJson),nextHash:hash(p.next)}));
 const report={ok:true,mode:apply?"applied":"plan",target,siteId,confirm:CONFIRM,pilot:matches,updates:updates.map(u=>({owner:u.owner.slug,baseHash:u.baseHash,nextHash:u.nextHash,items:u.items}))};
 if(apply){
  for(const u of updates){const r=await db.livePage.updateMany({where:{id:u.owner.id,siteId,slug:u.owner.slug,updatedAt:u.owner.updatedAt},data:{contentJson:u.next}});assert.equal(r.count,1,`Row changed: ${u.owner.slug}`)}
  const back=await db.livePage.findMany({where:{id:{in:updates.map(u=>u.owner.id)}},select:{slug:true,contentJson:true}});
  for(const u of updates){const row=back.find(x=>x.slug===u.owner.slug);assert.equal(hash(row?.contentJson),u.nextHash,`Readback mismatch: ${u.owner.slug}`)}
  report.applied=true;
 }
 fs.mkdirSync(new URL("./manifests/",import.meta.url),{recursive:true}); fs.writeFileSync(MANIFEST,`${JSON.stringify(report,null,2)}\n`);
 console.log(JSON.stringify({...report,manifest:MANIFEST.pathname},null,2));
}finally{await db.$disconnect()}
