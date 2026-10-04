import assert from 'node:assert/strict';
import createJiti from 'jiti';
import { linkGraph } from './lib/internal-link-graph.mjs';
const jiti = createJiti(import.meta.url, { alias:{'@':process.cwd()+'/src'} });
const { mydreamshootsVideoWatchPagesForState } = jiti('../src/lib/mydreamshoots-video-watch.ts');
const { contextualLinksFromValue } = jiti('../src/lib/contextual-links.ts');

// A closed cycle can have an inbound link at every node and still be orphaned
// from the homepage; verify both forward reachability and a path back home.
const row = (p, targets) => ({path:p,finalPath:p,canonicalPath:p,status:200,links:targets.map((path)=>({path}))});
const graph = linkGraph([row('/', ['/a']),row('/a',['/b']),row('/b',[]),row('/c',['/d']),row('/d',['/c'])]);
assert.deepEqual(graph.orphans,[]);
assert.deepEqual(graph.unreachable,['/c','/d']);
assert.deepEqual(graph.cannotReturnHome,['/a','/b','/c','/d']);
const repaired = linkGraph([row('/', ['/a','/c']),row('/a',['/b']),row('/b',['/']),row('/c',['/d']),row('/d',['/'])]);
assert.deepEqual(repaired.unreachable,[]);
assert.deepEqual(repaired.cannotReturnHome,[]);
const headerOnly = row('/', ['/a']); headerOnly.links[0].global=true;
assert.deepEqual(linkGraph([headerOnly,row('/a',['/'])],{bodyOnly:true}).unreachable,['/a']);

const site = {id:'site_dreamshoot',slug:'mydreamshoots',primaryDomain:'www.mydreamshoots.com'};
const media = '/assets/dreamshoot/source-contract-example.mp4';
const editorial = {videoUrl:media,title:'Portrait motion',description:'A portrait scene with subtle movement.',imageUrl:'/assets/dreamshoot/poster.jpg',createdAt:'2026-09-01',durationSeconds:8,sourcePath:'/ai-video-generation/cinematic-video',sourceLabel:'Explore cinematic video ideas',contextualLinks:[{href:'/best-ai-video',label:'Browse video examples'}]};
const source = {slug:'/best-ai-video',title:'Video examples',publishedJson:{videoWatchEntries:[editorial]}};
const theme = {siteId:site.id,status:'active',slug:'source-contract-example',name:'Portrait motion',description:editorial.description,imageUrl:editorial.imageUrl,galleryImages:[media],createdAt:editorial.createdAt,durationSeconds:8};
const [watch] = mydreamshootsVideoWatchPagesForState({videoThemes:[theme]},site,{pages:[source]});
assert.equal(watch.sourcePath,editorial.sourcePath,'Current editorial source must replace a fabricated theme URL');
assert.equal(watch.sourceLabel,editorial.sourceLabel);
assert.equal(watch.contextualLinks[0].href,'/best-ai-video');
assert.equal(watch.contentPath,media);
const workflowSource = {slug:'/workflow',title:'Workflow',publishedJson:{sections:{tutorial:{...editorial,contextualLinks:[{href:'/',label:'Generic workflow links'}]}}}};
const [watchWithDuplicateSource] = mydreamshootsVideoWatchPagesForState({videoThemes:[theme]},site,{pages:[source,workflowSource]});
assert.equal(watchWithDuplicateSource.contextualLinks[0].href,'/best-ai-video','Authored watch links must survive generic source-page discovery');
const incomplete = structuredClone(source); delete incomplete.publishedJson.videoWatchEntries[0].durationSeconds;
assert.equal(mydreamshootsVideoWatchPagesForState({videoThemes:[]},site,{pages:[incomplete]}).length,0,'Links must not make incomplete media indexable');
const frenchSite = {id:'site_aidreamcapes_xby',slug:'aidreamcapes-xby',primaryDomain:'aidreamcapes.eu'};
const french = {...editorial,videoUrl:'/assets/sites/site_aidreamcapes_eu/example.mp4',imageUrl:'/assets/sites/site_aidreamcapes_eu/poster.jpg'};
const [frenchWatch] = mydreamshootsVideoWatchPagesForState({videoThemes:[]},frenchSite,{pages:[{...source,publishedJson:{videoWatchEntries:[french]}}]});
assert.equal(frenchWatch.sourcePath,'/best-ai-video');
assert.equal(frenchWatch.sourceLabel,undefined);
assert.equal(frenchWatch.contextualLinks,undefined);
const accepted = contextualLinksFromValue([{href:'//other.example/a',label:'External'},{href:'javascript:alert(1)',label:'Invalid'},{href:'/same',label:'Self'},{href:'/best-ai-video',label:'Video examples'},{href:'/best-ai-video',label:'Duplicate'},{href:'/bad path',label:'Invalid'}],'/same');
assert.equal(accepted.length,1); assert.equal(accepted[0].href,'/best-ai-video');
console.log(JSON.stringify({ok:true,graphReachability:true,currentVideoSources:true,incompleteMediaRejected:true,otherStoreIsolation:true}));
