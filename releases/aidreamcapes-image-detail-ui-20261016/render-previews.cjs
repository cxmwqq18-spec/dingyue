const {chromium}=require('playwright');
const path=require('path');
const fs=require('fs');
(async()=>{
const root=__dirname;
const browser=await chromium.launch({headless:true,executablePath:'/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',args:['--disable-gpu']});
const results=[];
for(const name of ['ecommerce-main-image','feed-ad-still']){
for(const [size,width,height] of [['desktop',1440,1000],['mobile',390,1000]]){
const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
await page.goto('file://'+path.join(root,name+'-preview.html'));
await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=700){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(90);}
await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(350);
results.push({page:name,size,...await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src'))}))});
await page.screenshot({path:path.join(root,name+'-'+size+'.png'),fullPage:true});
await page.screenshot({path:path.join(root,name+'-hero-'+size+'.png')});
await page.close();
}}
await browser.close();fs.writeFileSync(path.join(root,'layout-readback.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})();
