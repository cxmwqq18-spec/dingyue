from pathlib import Path
from html import escape as esc
from urllib.parse import urlencode
import json
R=Path(__file__).resolve().parent
OLD=R.parent/'aidreamcapes-image-detail-ui-20261016'
BASE=json.loads((OLD/'design-content.json').read_text())
ORIGIN='https://www.aivideosugc.com'
def workspace(tool,prompt):return '/app/create?'+urlencode(dict(view='images',tool_id='image_generator',tool=tool,aspect='1:1',prompt=prompt))
D={
'ecommerce':dict(
 file='ecommerce-main-image',path='/ai-image-generation/ecommerce-main-image',name='White Background Photos',cn='白底商品图',eyebrow='WHITE PHOTOS READY TO LIST',
 title='Put a Product Photo<br>on a White Background',
 lead='Put any product photo on white in a few minutes. You get the plain white look a marketplace wants on the main image. One photo at a time in the app, or the whole folder through the API.',
 button='Make a white background photo',source='white-source.webp',result='white-result.webp',source_alt='Brown leather wallet on a warm marble tabletop.',result_alt='The same brown leather wallet on a clean white background.',
 overview='What a Plain White Field<br>Does for the Listing',overview_lead='A white field makes the product easier to see. It clears distractions and brings out color and texture.',
 features=[
 ('PRODUCT DETAILS','Color and Texture<br>Stay Easy to See','Shoppers can read the shape and the weave in the search result. The busy table is gone, so the product is what the card shows.','white-tote.webp','The same woven straw tote on a linen table and on white.'),
 ('FROM YOUR PHOTO','A Catalog Look<br>From a Phone Photo','A shot taken in a real room can still look like a catalog photo. The whole item stays in frame, and a short shadow keeps it from looking pasted on.','white-clothing.webp','An olive bomber and yellow polo shown on a chair and against white.'),
 ('ONE CATALOG LOOK','The Same White<br>on Every Item','Buyers paging the shop see one white, even when the next photo was shot under a warmer bulb. The grid matches.','white-shoes.webp','A beige block-heel pump in a room and a matching group of pumps on white.'),
 ('MORE WAYS TO USE IT','A Clean Base<br>for the Next Crop','One saved white file covers more than one placement. The store grid gets a square crop, and the email gets a tighter crop of the same item.','white-sofa.webp','Coral sofa shown in a living room, on white and in a second room.')],
 steps_title='How to Make a White Background<br>in 3 Steps',steps_lead='Upload the photo you already took, choose white, and download your image.',
 steps=[('Upload Your Product Photo','Upload a product image where the whole item sits inside the frame. Start from that photo instead of another shoot.'),('Choose a White Background','Choose white and a crop for your listing. Review the credit cost before generating.'),('Download and Post','Check the product details against your original photo, then download the file for your listing.')],
 cases_title='How Shops Use a White Main Image',cases_lead='Each shop takes a photo they already shot and downloads a file with the room gone.',
 cases=[('LEATHER-GOODS SELLER','Clear the Desk off the Wallet','They shot the wallet beside the keys and download a file with the table gone. That file is the main image on the listing.','white-seller-wallet.webp'),('CATALOG SELLER','Give the Folder One White','They run a folder of product photos onto the same white field. The grid matches, and nobody opens each file by hand.','white-seller-catalog.webp'),('TABLEWARE SELLER','Set the Bowl on White','They take the stoneware bowl off the wood table and onto white. The listing main image is that file.','white-seller-bowl.webp')],
 faq_title='Answers on White Background Photos',closing='Make the Main Image Plain White',closing_lead='Upload one product photo and download a white listing file. See the credit cost before you start.',
),
'feed':dict(
 file='feed-ad-still',path='/ai-image-generation/feed-ad-still',name='Social Ad Photos',cn='社交广告图片',eyebrow='SOCIAL POSTS FROM ONE PHOTO',
 title='Turn Your Products Into<br>Social Posts That Sell',
 lead='Make social media posts that earn a second look. Clear visuals, ready in minutes from a photo on your phone, with no studio and no shoot.',
 button='Create a social ad image',source='feed-source.webp',result='feed-result.webp',source_alt='Matte sage-green bottle on a pale studio surface.',result_alt='The same sage-green insulated bottle on a warm wood cafe counter.',
 overview='Instagram Photos<br>and Other Ad Spots',overview_lead='The product stays clear, and you still have room for the line you add later.',
 features=[
 ('EVERYDAY CONTEXT','Show a<br>Morning Routine','Place a plain bottle in a work bag so the ad shows a commute, not the product alone.','feed-context.webp','An adult hand places a sage bottle into a canvas tote on an entryway bench.'),
 ('PRODUCT IN USE','Make the<br>Carry Obvious','A sidewalk moment shows how the bag is used. Keep the product large enough to recognize when the photo is small.','feed-tote.webp','An adult carries a cream canvas tote on a quiet sidewalk.'),
 ('SPACE FOR YOUR MESSAGE','Leave a Calm Area<br>for the Offer','A desk scene keeps the product easy to see and leaves a calm spot for your offer. Add the price after download.','feed-mug.webp','Cream mug beside a laptop on a warm oak desk.'),
 ('A NEW SETTING','Show It<br>in a Second Place','Put the same bottle on a gym bench, or move it to a holiday table when the next post is seasonal.','feed-gym.webp','A matte teal bottle placed on a gym bench beside a towel.')],
 steps_title='How to Make Social Media Posts<br>in 3 Simple Steps',steps_lead='Bring a photo you already have. Leave with a square you can post.',
 steps=[('Upload Your Product Photo','Upload a clear photo of the product you want to show. Use it as the reference for your image.'),('Pick a Scene','Pick a scene or describe a setting, with room for the line you add later. Review the credit cost before generating.'),('Finish and Download','Check the generated result, download the square, add your offer, and post it.')],
 cases_title='How Stores Make a Square Post',cases_lead='Each seller turns one product photo into a square and skips the studio booking.',
 cases=[('SHOE SELLER','Hiking Shoe Square for the Feed','They turn a packing-table photo of the charcoal hiking shoe into a square post. They publish it while the offer is still the one they planned, with no studio booking.','feed-shoe.webp'),('TOTE SELLER','Cream Tote in a Square','They place the cream canvas tote in a square with room for a line they type later. The product stays the tote they uploaded.','feed-tote.webp'),('ONE-PRODUCT SHOP','Two Mug Squares Before You Pay','They try the cream mug in two quiet scenes, then keep the square that shows the mug clearly. They do not hire a photographer the night before.','feed-mug.webp')],
 faq_title='Social Media Post Answers',closing='Make the Next Social Post',closing_lead='Upload one product photo and pick a scene. See the credit cost before you start.',
)}
for kind,d in D.items():
 d['workspace']=workspace(BASE[kind]['tool'],BASE[kind]['prompt'])
 d['seo']=dict(title=BASE[kind]['title'],description=BASE[kind]['description'],canonical=ORIGIN+d['path'])
 d['faq']=BASE[kind]['faq']+([('What should the starting photo show?','Start with a clear photo of the full product. Keep important edges, labels and visible details inside the frame.'),('Where can I find other product photo tools?','Explore Lifestyle Photos and Change Background to prepare the other images your listing needs.')] if kind=='ecommerce' else [('Can one product photo make several social posts?','Try different scenes or prompts using your own product photo. Check the quoted credit cost before generating each new version.'),('Where can I use a square social ad image?','You can prepare a square for social feeds or a product campaign. Check the destination’s current image and advertising requirements before publishing.')])
 d['related']=BASE[kind]['related']
 d['cases'][2]=tuple(d['cases'][2])
 # Keep cases as illustrative scenarios, not fabricated customer testimonials.
 if kind=='feed':
  c=list(d['cases'][2]);c[1]='Cream Mug in a Quiet Scene';c[2]='They try the cream mug in quiet scenes and choose a square that shows the product clearly, with room for an offer added after download.';d['cases'][2]=tuple(c)

SVG={'arrow':'<path d="M4 12h16m-6-6 6 6-6 6"/>','down':'<path d="m6 9 6 6 6-6"/>','check':'<path d="m5 12 4 4L19 6"/>','upload':'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>','image':'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 5 5 3-3 4 4"/>','download':'<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>','plus':'<path d="M12 5v14M5 12h14"/>'}
def icon(n):return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+SVG[n]+'</svg>'
def img(file,alt,cls=''):return f'<img class="{cls}" src="assets/{file}" alt="{esc(alt)}" decoding="async">'
def button(d,label=None,cls='',href=None):return '<a class="button '+cls+'" href="'+esc(ORIGIN+(href or d['workspace']))+'">'+esc(label or d['button'])+icon('arrow')+'</a>'
def brand():return '<a class="brand" href="'+ORIGIN+'">'+img('brand-icon.png','AIVideosUGC logo')+'<span>AIVideosUGC</span></a>'
def header(d):
 nav=[('Video',[('AI Video Tools','/ai-video-generation'),('Image to Video','/ai-video-generation/image-to-video')]),('Photo',[('Product Photos','/ai-image-generation'),('White Background Photos',D['ecommerce']['path']),('Social Ad Photos',D['feed']['path'])]),('Templates',[('Photo Examples','/ai-image-generation'),('Video Examples','/ai-video-generation')]),('Resources',[('Guides','/guides'),('FAQ','/faq'),('Contact','/contact-us')])]
 menus=''.join('<details><summary>'+name+icon('down')+'</summary><div class="dropdown">'+''.join('<a href="'+ORIGIN+href+'">'+title+'</a>' for title,href in items)+'</div></details>' for name,items in nav)
 return '<header><div class="nav wrap">'+brand()+'<nav class="navlinks" aria-label="Main navigation">'+menus+'<a href="'+ORIGIN+'/pricing">Pricing</a></nav><div class="navright"><a class="login" href="'+ORIGIN+'/login?'+urlencode({'next':d['workspace']})+'">Log in</a>'+button(d,'Get started','small')+'</div><details class="mobile-menu"><summary aria-label="Open navigation">☰</summary><div class="dropdown"><a href="'+ORIGIN+'/ai-image-generation">Product Photos</a><a href="'+ORIGIN+'/ai-video-generation">AI Video Tools</a><a href="'+ORIGIN+'/pricing">Pricing</a></div></details></div></header>'
def sectionhead(tag,title,body=''):
 return '<div class="section-head"><p class="eyebrow">'+tag+'</p><h2>'+title+'</h2>'+('<p class="lead">'+body+'</p>' if body else '')+'</div>'
def hero(d):
 collage='<div class="hero-art"><div class="orbit o1"></div><div class="orbit o2"></div><figure class="result-card">'+img(d['result'],d['result_alt'])+'<figcaption>'+icon('check')+'Your result</figcaption></figure><figure class="source-card">'+img(d['source'],d['source_alt'])+'<figcaption>Original photo</figcaption></figure><div class="flow-arrow">'+icon('arrow')+'</div><span class="art-tag">'+icon('image')+('White background' if d['file']=='ecommerce-main-image' else 'A new scene')+'</span><span class="spark s1">✦</span><span class="spark s2">✧</span></div>'
 return '<div class="hero-shell"><div class="wrap"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="'+ORIGIN+'/">Home</a><span>›</span><a href="'+ORIGIN+'/ai-image-generation">Product Photos</a><span>›</span><span>'+d['name']+'</span></nav><section class="hero"><div class="hero-copy"><p class="eyebrow">'+d['eyebrow']+'</p><h1>'+d['title']+'</h1><p class="hero-lead">'+d['lead']+'</p><div class="hero-actions">'+button(d)+'<a class="text-link" href="#examples">See examples ↓</a></div><p class="cost">'+icon('check')+'See the credit cost before you start</p></div>'+collage+'</section></div></div>'
def features(d):
 rows=[]
 for i,(tag,title,body,file,alt) in enumerate(d['features']):
  art='<figure class="feature-art">'+img(file,alt)+'</figure>'
  copy='<div class="feature-copy"><p class="eyebrow">'+tag+'</p><h3>'+title+'</h3><p>'+body+'</p>'+button(d)+'</div>'
  rows.append('<article class="feature '+('reverse' if i%2 else '')+'">'+art+copy+'</article>')
 return '<section class="features wrap">'+sectionhead('WHY USE IT',d['overview'],d['overview_lead'])+''.join(rows)+'</section>'
def steps(d):
 rows=[]
 for i,(title,body) in enumerate(d['steps']):
  if i==0:art='<div class="step-upload">'+icon('upload')+'<span>Your product photo</span><small>JPG · PNG · WebP</small></div>'
  elif i==1:art='<div class="step-settings"><span>'+('Background' if d['file']=='ecommerce-main-image' else 'Scene')+'<b>'+('Pure white' if d['file']=='ecommerce-main-image' else 'Front hall')+icon('down')+'</b></span><span>Size <b>Square · 1:1'+icon('down')+'</b></span></div>'
  else:art='<div class="step-download">'+img(d['result'],d['result_alt'])+'<span>'+icon('download')+'</span></div>'
  rows.append('<article class="step"><div class="step-art">'+art+'</div><div class="step-body"><span class="step-num">0'+str(i+1)+'</span><h3>'+title+'</h3><p>'+body+'</p></div></article>')
 return '<section class="steps-section" id="how-it-works"><div class="wrap">'+sectionhead('HOW IT WORKS',d['steps_title'],d['steps_lead'])+'<div class="steps">'+''.join(rows)+'</div><div class="center-action">'+button(d)+'</div></div></section>'
def cases(d):
 items=''.join('<article class="case">'+img(file,title+' — illustrative product scenario.')+'<div class="case-copy"><p class="eyebrow">'+tag+'</p><h3>'+title+'</h3><p>'+body+'</p></div></article>' for tag,title,body,file in d['cases'])
 return '<section class="cases-section wrap" id="examples">'+sectionhead('SELLER EXAMPLES',d['cases_title'],d['cases_lead'])+'<div class="cases">'+items+'</div><div class="center-action">'+button(d)+'</div></section>'
def faq(d):
 rows=''.join('<details '+('open' if i==0 else '')+'><summary><span>'+str(i+1)+'. '+q+'</span>'+icon('plus')+'</summary><p>'+esc(a)+'</p></details>' for i,(q,a) in enumerate(d['faq']))
 return '<section class="faq-section wrap">'+sectionhead('FAQ',d['faq_title'])+'<div class="faq">'+rows+'</div></section>'
def related(d):
 links=''.join('<a class="related" href="'+ORIGIN+path+'">'+img(file,title)+'<span>'+title+icon('arrow')+'</span></a>' for title,path,file,_ in d['related'])
 return '<section class="related-section wrap">'+sectionhead('RELATED TOOLS','More Tools for Product Visuals')+'<div class="related-grid">'+links+'</div></section>'
def footer(d):
 groups=[('Product Photos',[('White Background Photos',D['ecommerce']['path']),('Social Ad Photos',D['feed']['path']),('Lifestyle Photos','/ai-image-generation/lifestyle-scene'),('Change Background','/ai-image-generation/background-remove-replace')]),('Video Tools',[('AI Video Tools','/ai-video-generation'),('Image to Video','/ai-video-generation/image-to-video')]),('Resources',[('Pricing','/pricing'),('Guides','/guides'),('FAQs','/faq'),('Contact','/contact-us')]),('Company',[('Privacy Policy','/privacy'),('Terms of Service','/terms')])]
 cols=''.join('<div><h3>'+name+'</h3>'+''.join('<a href="'+ORIGIN+path+'">'+title+'</a>' for title,path in rows)+'</div>' for name,rows in groups)
 return '<footer><div class="wrap"><div class="footer-grid"><div class="footer-brand">'+brand()+'<p>Product photos and videos,<br>from the photo you already have.</p></div>'+cols+'</div><div class="footer-bottom"><span>© 2026 AIVideosUGC</span><span>Product photos · AI video tools</span></div></div></footer>'
def page(d):
 close='<section class="closing"><div class="wrap"><p class="eyebrow">START WITH YOUR PRODUCT</p><h2>'+d['closing']+'</h2><p>'+d['closing_lead']+'</p>'+button(d)+'</div></section>'
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+esc(d['seo']['title'])+'</title><meta name="description" content="'+esc(d['seo']['description'])+'"><link rel="stylesheet" href="assets/fonts.css"><link rel="stylesheet" href="design.css"></head><body>'+header(d)+'<main>'+hero(d)+features(d)+steps(d)+cases(d)+faq(d)+related(d)+close+'</main>'+footer(d)+'</body></html>'
for d in D.values():(R/(d['file']+'-preview.html')).write_text(page(d))
(R/'page-data.json').write_text(json.dumps(D,ensure_ascii=False,indent=2))
print('Built two pages using one shared dark design template.')
