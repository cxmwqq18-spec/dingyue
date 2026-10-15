import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

// Real local media tools; all storage/database/network dependencies are fixtures.
const require = createRequire(import.meta.url);
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aidreamcapes-clone-media-qa-'));
const writes = [], deletes = [];
let failCreate = false;
class WorkspaceError extends Error { constructor(code,status=400) { super(code); this.code=code; this.status=status; } }
const assets = {
  createAssetUploadRelational: async (params) => { if(failCreate) throw new Error('synthetic storage failure'); return {asset:{...params,id:'synthetic-asset'}}; },
  toThemeRuntimeAssetRelational: (asset) => ({previewUrl:`/api/sites/${asset.siteId}/customers/${asset.customerId}/assets/${asset.id}/download?preview=1`}),
  getCustomerAssetsRelational: async () => ({assets:[]}),
};
const storage = { customerAssetStorageKey: ({siteId,customerId,fileName}) => `sites/${siteId}/customers/${customerId}/assets/${fileName}`,
  writeCustomerAssetFileShared: async (value) => writes.push(value), deleteCustomerAssetFileShared: async (key) => deletes.push(key) };
const load = async (file, resolver) => {
  const module={exports:{}};
  const code=ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(resolver,module,module.exports);
  return module.exports;
};
try {
  const media = await load('src/lib/aidreamcapes-workspace/clone-media.ts', (id) => {
    if(id==='server-only')return {};
    if(id==='./types')return {WorkspaceError,AIVIDEOSUGC_SITE_ID:'site_aidreamcapes'};
    if(id==='./catalogs')return {assertWorkspaceSite:(site)=>assert.equal(site,'site_aidreamcapes')};
    if(id.includes('/stores/asset-store'))return assets;
    if(id.includes('/customer-asset-storage'))return storage;
    return require(id);
  });
  const wav=path.join(directory,'source.wav'),video=path.join(directory,'source.mp4'),silent=path.join(directory,'silent.mp4');
  execFileSync('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-c:a','pcm_s16le',wav]);
  execFileSync('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=320x240:r=12:d=2','-f','lavfi','-i','sine=frequency=330:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',video]);
  execFileSync('ffmpeg',['-nostdin','-v','error','-i',video,'-c:v','copy','-an',silent]);
  const voiceBytes=await fs.readFile(wav),videoBytes=await fs.readFile(video);
  const voice=await media.inspectCloneMedia(voiceBytes,'voice_twin'); assert.equal(voice.mimeType,'audio/wav');assert.equal(voice.hasAudio,true);
  const prepared=await media.prepareCloneReferenceMedia(videoBytes,'ad_reference');
  assert.equal(prepared.frames.length,3);assert.equal(prepared.transcript,null);assert.equal(prepared.modelRequests,0);
  assert.equal(prepared.audioWav.subarray(0,4).toString(),'RIFF');assert.ok(prepared.frames.every(item=>item.jpeg[0]===255 && item.jpeg[1]===216));
  const noAudio=await media.prepareCloneReferenceMedia(await fs.readFile(silent),'ad_reference');assert.equal(noAudio.audioWav,undefined);assert.equal(noAudio.frames.length,3);
  await assert.rejects(()=>media.inspectCloneMedia(Buffer.from('#EXTM3U\nfile:///etc/passwd'),'ad_reference'),error=>error.code==='clone_media_invalid');
  await assert.rejects(()=>media.inspectCloneMedia(videoBytes,'voice_twin'),error=>error.code==='clone_audio_source_required');
  await assert.rejects(()=>media.inspectCloneMedia(Buffer.alloc(0),'ad_reference'),error=>error.status===413);
  const created=await media.uploadCloneSourceAsset('site_aidreamcapes','synthetic-owner','ad_reference',videoBytes,'../../reference.txt');
  assert.equal(created.asset.mimeType,'video/mp4');assert.equal(created.asset.label,'reference.txt');assert.ok(writes[0].bytes.equals(videoBytes),'original MP4 bytes preserved');assert.match(writes[0].storageKey,/^sites\/site_aidreamcapes\/customers\/synthetic-owner\/assets\/clone-[a-f0-9-]+\.mp4$/);
  failCreate=true;await assert.rejects(()=>media.uploadCloneSourceAsset('site_aidreamcapes','synthetic-owner','voice_twin',voiceBytes,'voice.wav'));
  assert.equal(deletes.length,1,'orphan file cleaned on relational failure');

  let loggedIn=false, parses=0;
  const routes=await load('src/app/api/sites/[siteId]/aivideosugc/clones/assets/route.ts',(id)=>{
    if(id.endsWith('/auth'))return {workspaceAuth:async()=> loggedIn? {ok:true,current:{customer:{id:'synthetic-owner'}}}:{ok:false,response:Response.json({error:'customer_login_required'},{status:401})}};
    if(id.endsWith('/api'))return {workspaceResponse:(data,status=200)=>Response.json(data,{status}),workspaceFailure:error=>Response.json({error:error.code??error.message},{status:error.status??500})};
    if(id.endsWith('/clone-media'))return {...media,uploadCloneSourceAsset:async(...args)=>{parses++;return {asset:{id:'synthetic-asset'},owner:args[1]};}};
    if(id.endsWith('/types'))return {WorkspaceError};
    throw new Error(`Unexpected route dependency ${id}`);
  });
  const context={params:Promise.resolve({siteId:'site_aidreamcapes'})};
  let response=await routes.POST(new Request('http://fixture.invalid',{method:'POST',body:'bad'}),context);assert.equal(response.status,401);assert.equal(parses,0);
  loggedIn=true;const form=new FormData();form.set('workflow','ad_reference');form.set('file',new File([videoBytes],'source.mp4',{type:'video/mp4'}));
  response=await routes.POST(new Request('http://fixture.invalid',{method:'POST',body:form}),context);assert.equal(response.status,201);assert.equal((await response.json()).owner,'synthetic-owner');
  response=await routes.POST(new Request('http://fixture.invalid',{method:'POST',headers:{'content-length':String(media.CLONE_MEDIA_LIMITS.videoBytes+100000)},body:'bad'}),context);assert.equal(response.status,413);
  console.log('PASS real ffprobe/FFmpeg: audio/video validation, bounded frames/audio extraction, silent video, hostile playlist rejection, preserved bytes, cleanup, auth-before-body, owner binding, upload limit. No real DB/provider requests.');
} finally { await fs.rm(directory,{recursive:true,force:true}); }
