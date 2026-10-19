import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const p='releases/aidreamcapes-ui-production-20261017/';
const expected=JSON.parse(fs.readFileSync('docs/content-locks/aivideosugc-homepage-tdk-approved.json')).seo;
const media=JSON.parse(fs.readFileSync(p+'production-media-before.json'));
const sha='02f856db13a92b9fb7e74f359489ef04530549d5';
const code=`import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {load} from 'cheerio';
const expected=${JSON.stringify(expected)};const media=${JSON.stringify(media)};const sha=${JSON.stringify(sha)};
assert.equal(fs.readFileSync('.deployed-commit','utf8').trim(),sha);
assert.equal(fs.realpathSync('/www/wwwroot/aidreamcapes.com/current'),process.cwd());
const r=await fetch('http://127.0.0.1:3013/',{headers:{'X-Forwarded-Host':'www.aivideosugc.com','X-Forwarded-Proto':'https'}});assert.equal(r.status,200);const $=load(await r.text());
assert.equal($('title').text(),expected.title);for(const name of ['description','keywords'])assert.equal($('meta[name="'+name+'"]').attr('content'),expected[name]);
assert.equal($('link[rel=canonical]').attr('href'),'https://www.aivideosugc.com/');
assert.equal($('#home-campaign-workflow .adc-workflow-card').length,6);assert.equal($('[data-home-brand-tools] article').length,6);
assert($('main').text().includes('Help With Accounts, Billing and Exports'));assert(!$('main').text().includes('Email Support When a Job Sticks'));
const contracts={};for(const [name,file] of [['candidate','.candidate-contract.json'],['origin','.origin-contract.json']]){contracts[name]=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(contracts[name].ok,true);}
const services=execFileSync('systemctl',['show','aidreamcapes.service','mydreamshoots.service','aidreamcapes-eu.service','aidreamshoots.service','-p','MainPID','-p','WorkingDirectory'],{encoding:'utf8'});
for(const value of ['MainPID=30872','MainPID=3234','MainPID=31406','/www/wwwroot/mydreamshoots.com/releases/d869ca42dd09f5e84c58135e5df7956751cb40f5','/www/wwwroot/aidreamcapes.eu/releases/8d3d90937c254c859f1792cfd023fb43dacac8fe-aidreamcapes-eu','/www/wwwroot/aidreamshoots.eu/releases/ec84f47010372d421c25e2863693517d68a8cf4f-aidreamshoots-eu'])assert(services.includes(value),value);
for(const asset of media){const file='public'+asset.src;assert(fs.existsSync(file));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),asset.hash);}
console.log(JSON.stringify({ok:true,url:'https://www.aivideosugc.com/',deployedCommit:sha,owner:'LivePage.contentJson',currentRelease:process.cwd(),homepageMetadata:expected,supportTitle:'Help With Accounts, Billing and Exports',workflowCards:6,tools:6,unchangedMedia:media.length,protectedServicesUnchanged:true,contracts},null,2));`;
const cmd=`set -e; BASE=$(systemctl show aidreamcapes.service -p WorkingDirectory | sed -n 's/^WorkingDirectory=//p'); cd "$BASE"; node --input-type=module -`;
const result=execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=15','ai-project-server',cmd],{input:code,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
const report=JSON.parse(result);fs.writeFileSync(p+'final-origin-release.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,sha:report.deployedCommit,protectedServicesUnchanged:report.protectedServicesUnchanged,unchangedMedia:report.unchangedMedia}));
