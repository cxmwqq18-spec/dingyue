import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const browser = await chromium.launch({headless:true,proxy:{server:'http://127.0.0.1:10904'}});
const out = {capturedAt:new Date().toISOString(),method:'Live same-origin HTML response transformation in isolated browser only; no origin/CDN/data/code mutation',cases:[]};
try {
 for(const mode of ['original','restore-email-only']) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let rewriteCounts=null;
  if(mode==='restore-email-only') await page.route('https://www.aivideosugc.com/**',async route=>{
   if(route.request().resourceType()!=='document') return route.continue();
   const response=await route.fetch();
   let html=await response.text();
   const counts={footer:0,plainEmail:0};
   html=html.replace(/<a href="\/cdn-cgi\/l\/email-protection#[^"]*"><span class="__cf_email__" data-cfemail="[^"]*">\[email&#160;protected\]<\/span><\/a>/g,()=>{counts.footer++;return '<a href="mailto:support@aivideosugc.com">support@aivideosugc.com</a>';});
   html=html.replace(/<a href="\/cdn-cgi\/l\/email-protection" class="__cf_email__" data-cfemail="[^"]*">\[email&#160;protected\]<\/a>/g,()=>{counts.plainEmail++;return 'support@aivideosugc.com';});
   rewriteCounts=counts;
   await fs.writeFile(path.join(dir,'hydration-restored-email-response.html'),html);
   await route.fulfill({response,body:html});
  });
  const response=await page.goto(`https://www.aivideosugc.com/?qa=seo-hydration-${mode}-d2e30400e`,{waitUntil:'networkidle',timeout:90000});
  const item={mode,status:response.status(),rewriteCounts,errors,dom:await page.evaluate(()=>({cfProtected:document.querySelectorAll('.__cf_email__').length,footerEmail:document.querySelector('address a[href^="mailto:"]')?.outerHTML,trust:[...document.querySelectorAll('h3')].find(e=>e.textContent==='Email Support When a Job Sticks')?.parentElement?.outerHTML}))};
  out.cases.push(item);console.log(JSON.stringify(item));
  await fs.writeFile(path.join(dir,'hydration-cf-control.json'),JSON.stringify(out,null,2));
  await context.close();
 }
} finally{await browser.close();}
