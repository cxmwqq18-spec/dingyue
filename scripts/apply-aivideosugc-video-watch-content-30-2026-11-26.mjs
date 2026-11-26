#!/usr/bin/env node
// Thirty-video watch-page content pass. Each selected card gets a unique
// summary from its own line/label plus owner-specific Best for and recreate
// steps. No transcript or chapter timestamps are invented.
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
const CONFIRM="aivideosugc-video-watch-content-30-2026-11-26";
const MANIFEST=new URL("./manifests/aivideosugc-video-watch-content-30-2026-11-26.json",import.meta.url);
const SLUGS=["mint-shower-speaker-bathroom-concert","sunset-lamp-room-glow-before-after","indoor-entryway-greeting","close-shot-of-a-silver-ring","folding-bike-commute","drink-pour","launch-promo","quiet-unboxing-makeup-tools","umbrella-opens-for-coverage","brand-film","how-to-product-video","beauty-routine-video","black-friday-video","outfit-reel","home-organizing","tiktok-spark-ad-video","canvas-tote-product-detail","mint-speaker-tile-steam-session","green-notebook-desk-ritual","black-speaker-balcony-soundtest","cable-organizer-desk-before-after","notes-app-chaos-to-calm","cable-organizer-white-setup","indoor-home-corner-chat","home-sofa-welcome","home-table-explanation","outdoor-park-greeting","outdoor-walkway-update","living-room-sofa-check-in","living-room-lounge-introduction"];
const siteId=assertAllowedSite("site_aidreamcapes");
const target=argumentValue("--target")||process.env.DATABASE_TARGET||"local";
const apply=hasArgument("--apply"); const confirmed=hasArgument(`--confirm=${CONFIRM}`);
assertDatabaseTarget({expectedTarget:target,requireProductionConfirmation:apply,productionConfirmed:confirmed});
if(apply&&target==="production")assert(confirmed,`Production update requires --confirm=${CONFIRM}`);
const stable=v=>v instanceof Date?JSON.stringify(v.toISOString()):v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?`[${v.map(stable).join(",")}]`:`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
const hash=v=>crypto.createHash("sha256").update(stable(v)).digest("hex");
function find(node,slug){if(!node||typeof node!=="object")return;if(Array.isArray(node)){for(const x of node){const h=find(x,slug);if(h)return h}return}if(node.publicSlug===slug&&node.video?.src)return node;for(const x of Object.values(node)){const h=find(x,slug);if(h)return h}}
function bestFor(owner){if(owner.includes("before-after"))return["Transformation ads","Problem-solution hooks","Retargeting"];if(owner.includes("spokesperson"))return["Creator-style talking ads","Trust and explainers","UGC reviews"];if(owner.includes("food-video"))return["Food and beverage ads","Appetite appeal","Reels and TikTok"];if(owner.includes("beauty-routine"))return["Beauty and skincare ads","Routine content","Instagram Reels"];if(owner.includes("fashion-try-on"))return["Apparel try-on ads","Outfit inspiration","TikTok Shop"];if(owner.includes("home-organization"))return["Home and living ads","Organization transformations","Pinterest and Reels"];if(owner.includes("product-video"))return["Product demos","Feature walkthroughs","Ecommerce PDPs"];if(owner.includes("video-ads"))return["Paid social ads","Hook testing","Meta and TikTok"];if(owner.includes("promo-video"))return["Launch promotions","Seasonal offers","Short-form ads"];if(owner.includes("black-friday"))return["Black Friday campaigns","Discount creatives","Paid social"];if(owner.includes("cinematic"))return["Brand films","Premium product stories","YouTube and web"];if(owner.includes("how-to-video"))return["How-to content","Product education","YouTube Shorts"];if(owner.includes("spark-ads"))return["Spark Ads","Creator-style placements","TikTok"];if(owner.includes("image-to-video"))return["Product demo clips","Lifestyle motion","TikTok and Reels"];if(owner.includes("colorway"))return["Jewelry and accessories","Close-up product detail","Retargeting"];return["Short-form ads","Product demos","Social feeds"]}
function steps(owner){if(owner.includes("before-after"))return["Upload the before and after product state.","Describe the transformation and the hook.","Generate variants and compare retention."];if(owner.includes("spokesperson"))return["Choose a presenter and voice.","Add the product photo or product URL.","Write the script, review the cut, and export."];if(owner.includes("food-video"))return["Upload a high-resolution food photo.","Describe the pour, bite, or texture moment.","Review the clip and export for Reels or TikTok."];if(owner.includes("image-to-video"))return["Upload a clear product photo.","Describe the scene and the single motion.","Review the storyboard and export."];if(owner.includes("product-video"))return["Start with a product URL or product photo.","Choose the feature to demonstrate.","Generate, review, and export the cut."];if(owner.includes("colorway"))return["Upload a high-resolution product close-up.","Describe the angle and lighting.","Review the still or motion variant and export."];return["Start with a product URL, photo, or prompt.","Choose the format and length.","Review the storyboard and export."]}
const db=new PrismaClient();
try{
 const rows=await db.livePage.findMany({where:{siteId},select:{id:true,slug:true,contentJson:true,updatedAt:true}});
 const plans=new Map(); const matches=[];
 for(const slug of SLUGS){
  const owners=rows.filter(r=>Boolean(find(r.contentJson,slug))); assert.equal(owners.length,1,`${slug}: expected one owner, found ${owners.length}`);
  const owner=owners[0]; const card=find(owner.contentJson,slug); assert(card?.video?.src,`${slug}: video card missing`);
  if(!plans.has(owner.id))plans.set(owner.id,{owner,next:structuredClone(owner.contentJson),items:[]});
  const plan=plans.get(owner.id); const next=find(plan.next,slug); assert(next?.video?.src,`${slug}: clone missing`);
  const label=String(card.label||slug); const line=String(card.line||"").trim(); const duration=Number(card.duration)||0; const aspect=String(card.aspect||"");
  const summary=line || `${label} is a ${duration ? `${duration}-second ` : ""}${aspect ? `${aspect} ` : ""}example from the ${owner.slug.replace("/ai-video-generation/","").replace(/-/g," ")} workflow.`;
  next.video.watchContent={summary,bestFor:bestFor(owner.slug),steps:steps(owner.slug)};
  plan.items.push({slug,owner:owner.slug}); matches.push({slug,owner:owner.slug,summary});
 }
 const updates=[...plans.values()].map(p=>({...p,baseHash:hash(p.owner.contentJson),nextHash:hash(p.next)}));
 const report={ok:true,mode:apply?"applied":"plan",target,siteId,confirm:CONFIRM,items:matches,updates:updates.map(u=>({owner:u.owner.slug,baseHash:u.baseHash,nextHash:u.nextHash,count:u.items.length}))};
 if(apply){
  for(const u of updates){const r=await db.livePage.updateMany({where:{id:u.owner.id,siteId,slug:u.owner.slug,updatedAt:u.owner.updatedAt},data:{contentJson:u.next}});assert.equal(r.count,1,`Row changed: ${u.owner.slug}`)}
  const back=await db.livePage.findMany({where:{id:{in:updates.map(u=>u.owner.id)}},select:{slug:true,contentJson:true}});
  for(const u of updates){const row=back.find(x=>x.slug===u.owner.slug);assert.equal(hash(row?.contentJson),u.nextHash,`Readback mismatch: ${u.owner.slug}`)}
  report.applied=true;
 }
 fs.mkdirSync(new URL("./manifests/",import.meta.url),{recursive:true}); fs.writeFileSync(MANIFEST,`${JSON.stringify(report,null,2)}\n`);
 console.log(JSON.stringify({...report,manifest:MANIFEST.pathname},null,2));
}finally{await db.$disconnect()}
