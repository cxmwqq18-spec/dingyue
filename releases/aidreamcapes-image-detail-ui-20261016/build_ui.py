from pathlib import Path
from html import escape
from urllib.parse import urlencode
import json

ROOT = Path(__file__).resolve().parent
ORIGIN = 'https://www.aivideosugc.com'

def live(path):
    return ORIGIN + path

def workspace(tool, prompt, aspect='1:1'):
    return '/app/create?' + urlencode(dict(view='images', tool_id='image_generator', tool=tool, aspect=aspect, prompt=prompt))

def image(file, alt, cls=''):
    return f'<img class="{cls}" src="assets/{file}" alt="{escape(alt)}" decoding="async">'

ICONS = {
    'arrow': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    'upload': '<path d="M12 16V4m-5 5 5-5 5 5M5 15v5h14v-5"/>',
    'expand': '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    'check': '<path d="m5 12 4 4L19 6"/>',
    'external': '<path d="M14 4h6v6m0-6L10 14M9 4H4v16h16v-5"/>',
    'down': '<path d="m6 9 6 6 6-6"/>',
    'shop': '<path d="M4 9h16l-2-5H6L4 9Zm1 0v11h14V9M9 20v-7h6v7"/>',
    'grid': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    'bag': '<path d="M5 7h14l2 14H3L5 7Zm3 0V5a4 4 0 0 1 8 0v2"/>',
}

def icon(name, cls=''):
    return '<svg class="icon ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>'

def cta(label, href, cls='primary', extra=''):
    return f'<a class="button {cls}" href="{escape(live(href))}" {extra}>{escape(label)}{icon("arrow")}</a>'

DATA = {
    'ecommerce': {
        'file': 'ecommerce-main-image',
        'path': '/ai-image-generation/ecommerce-main-image',
        'title': 'AI White Background Product Photo Generator | AIVideosUGC',
        'description': 'Create white-background product photos from your own images. Choose a crop, compare the result with your source, and download an image for your online store.',
        'breadcrumb': 'White Background Photos',
        'eyebrow': 'WHITE BACKGROUND PRODUCT PHOTOS',
        'h1': 'AI White Background<br>Product Photo Generator',
        'h1cn': 'AI 白底商品图生成器',
        'lead': 'Turn your product photo into a clean white-background image for your online store. Choose a crop, review the details, and download your result.',
        'leadcn': '将商品照片转换为适合网店展示的白底商品图。选择画面比例，核对商品细节，再下载选定结果。',
        'button': 'Create my product photo',
        'tool': 'white-background',
        'prompt': 'Create a clean white-background product photo from my reference. Show the full item with clear edges, natural proportions and a soft grounding shadow.',
        'gallery_title': 'A clearer first look at your product.',
        'gallery_lead': 'Explore clean backgrounds and framing for your next listing.',
        'gallery': [
            {'title': 'Clean white', 'desc': 'Give the full product a simple, uncluttered backdrop.', 'image': 'white-result.webp', 'alt': 'Brown leather wallet isolated on a white background with a subtle shadow.', 'category': 'focus', 'prompt': 'Place my full product on a plain pure-white background with clear edges and natural proportions.'},
            {'title': 'Soft shadow', 'desc': 'Add a grounded look while keeping the product in focus.', 'image': 'white-mug.webp', 'alt': 'Ivory ceramic travel mug with a fitted lid and handle on a clean white background.', 'category': 'focus', 'prompt': 'Place my product on white with a light natural contact shadow. Keep its color and visible details recognizable.'},
            {'title': 'Catalog direction', 'desc': 'Use a clean visual approach across your product range.', 'image': 'white-tote.webp', 'alt': 'Woven straw tote shown in its original setting and on a clean white background.', 'category': 'use', 'prompt': 'Create a clean catalog product photo on pure white. Keep the full item in frame with even margins.'},
        ],
        'feature_title': 'Keep attention on<br>the product.',
        'feature_body': 'Replace a distracting setting with a simple white background. Give shoppers a clear view of the shape, color and materials before they explore the rest of your listing.',
        'checks': ['A clean backdrop', 'Room around the full product', 'A consistent catalog direction'],
        'feature_note': 'Review labels, edges and proportions against your original photo.',
        'feature_image': 'white-tote.webp',
        'feature_alt': 'Comparison of a woven straw tote in a natural setting and against a white background.',
        'step_title': 'From product photo to listing image.',
        'steps': [('Upload your photo', 'Start with a clear photo that shows the whole product.'), ('Choose white and your crop', 'Select a white background and a format for your listing.'), ('Review and download', 'Compare the result with your source, then download your image.')],
        'source': 'white-source.webp', 'result': 'white-result.webp',
        'faq': [
            ('Can I use my own product photo?', 'Yes. Upload a clear photo of the product you want to show. Review the generated result before using it in a listing.'),
            ('Will product details stay exactly the same?', 'AI can change small details. Compare logos, labels, colors, edges and proportions with your original photo before using the result.'),
            ('How much does an image cost?', 'The image workspace shows the current credit quote for your selected settings before you generate. Visit Pricing to compare available plans.'),
            ('Can I use the result in a marketplace listing?', 'Check the destination’s current image rules before uploading. Background, framing and permitted image content can vary between marketplaces.')
        ],
        'faq_title': 'Questions about AI product photos',
        'related_title': 'Complete your product image set.',
        'related': [('Lifestyle Photos', '/ai-image-generation/lifestyle-scene', 'feed-result.webp', 'Show your product in an everyday setting.'), ('Change Background', '/ai-image-generation/background-remove-replace', 'feed-mug.webp', 'Explore a different backdrop for your product.'), ('Social Ad Images', '/ai-image-generation/feed-ad-still', 'feed-tote.webp', 'Create a still image for your next campaign.')],
        'closing': 'Give your next listing<br>a clearer first look.',
        'closing_lead': 'Start with the product photo you already have.',
    },
    'feed': {
        'file': 'feed-ad-still',
        'path': '/ai-image-generation/feed-ad-still',
        'title': 'AI Social Media Ad Image Generator | AIVideosUGC',
        'description': 'Create social media ad images from your product photos. Explore scenes for Instagram and Facebook feed creatives, review your result, and download your image.',
        'breadcrumb': 'Social Ad Images',
        'eyebrow': 'PRODUCT PHOTOS FOR SOCIAL FEEDS',
        'h1': 'AI Social Media<br>Ad Image Generator',
        'h1cn': 'AI 社交媒体广告图片生成器',
        'lead': 'Turn your product photo into a scene for your next Instagram or Facebook feed ad. Choose a setting, explore a visual direction, and review your image before publishing.',
        'leadcn': '将商品照片放入适合 Instagram 或 Facebook 信息流广告的展示场景。选择环境、比较创意方向，并在发布前检查图片效果。',
        'button': 'Create my ad image',
        'tool': 'lifestyle-photos',
        'prompt': 'Create a square social ad image using my product photo as a visual reference. Place the product on a warm cafe counter in soft daylight, with clear space for a headline I will add after download.',
        'gallery_title': 'Find a setting for your next campaign.',
        'gallery_lead': 'Compare visual directions, then start with a scene that fits your product.',
        'gallery': [
            {'title': 'Studio focus', 'desc': 'A clean, distraction-free setting.', 'image': 'feed-studio.webp', 'alt': 'Charcoal hiking shoe on a pale studio background with a soft shadow.', 'category': 'focus', 'preset': 'p_b1ecffca09d5b6ae443432f0'},
            {'title': 'Everyday setting', 'desc': 'Show your product in a familiar space.', 'image': 'feed-entryway.webp', 'alt': 'Sage-green bottle on an oak entryway bench as a hand reaches to pick it up.', 'category': 'use', 'preset': 'p_94fa87ea1c0befb6fb218da0'},
            {'title': 'On the move', 'desc': 'A visual direction for everyday carry.', 'image': 'feed-tote.webp', 'alt': 'Cream canvas tote carried by an adult along a quiet sidewalk.', 'category': 'use', 'preset': 'p_744dc950953c583c64399a1e'},
            {'title': 'Desk essentials', 'desc': 'A simple scene for work and home.', 'image': 'feed-mug.webp', 'alt': 'Cream ceramic mug beside a closed laptop on an oak desk.', 'category': 'use', 'preset': 'p_0dd3fd41b596ea95cb1faeeb'},
        ],
        'feature_title': 'Show where your<br>product belongs.',
        'feature_body': 'Give customers a visual context for your product, from an everyday routine to a seasonal campaign. Describe the setting and use your photo as the visual reference.',
        'checks': ['Start with your own product', 'Explore different settings', 'Leave space for your message'],
        'feature_note': 'Add final headlines and prices in your editor after download.',
        'feature_image': 'feed-result.webp',
        'feature_alt': 'Sage-green insulated bottle in soft daylight on a warm wood cafe counter.',
        'step_title': 'Create a social ad image in three steps.',
        'steps': [('Upload your product', 'Start with a clear photo of the item you want to show.'), ('Choose or describe a scene', 'Pick a visual direction and describe the setting you have in mind.'), ('Review and download', 'Check product details, download the image, and finish your ad copy.')],
        'source': 'feed-source.webp', 'result': 'feed-result.webp',
        'faq': [
            ('Is this a still image or a video?', 'This tool creates still images. For moving product creatives, explore our AI Video tools.'),
            ('Can I use my own product photo?', 'Yes. Start with your own clear JPG, PNG or WebP image. Your photo guides the product’s appearance in the generated scene.'),
            ('Can I add a headline or an offer?', 'Describe the space you need for a headline when preparing your image. Add final text, prices and promotional details in your editor after download.'),
            ('How much does an image cost?', 'The workspace shows the current credit quote for your selected settings before you generate. Visit Pricing to compare available plans.')
        ],
        'faq_title': 'Questions about AI ad images',
        'related_title': 'Keep building your campaign.',
        'related': [('White Background Photos', '/ai-image-generation/ecommerce-main-image', 'white-mug.webp', 'Create a clean image for a product listing.'), ('UGC Still Ads', '/ai-image-generation/ugc-still-ad', 'feed-context.webp', 'Explore product images with everyday context.'), ('Story Images', '/ai-image-generation/story-ad-vertical', 'feed-outdoor.webp', 'Find a vertical direction for Story placements.')],
        'closing': 'Turn your next product photo<br>into an ad idea.',
        'closing_lead': 'Choose a scene and start in the image workspace.',
    }
}

CSS = '''
:root{--ink:#171727;--muted:#696979;--violet:#7047eb;--violet-dark:#5530c5;--soft:#f7f5fe;--line:#e8e7ee;--radius:20px;--content:1200px}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:96px}body{margin:0;background:#fff;color:var(--ink);font-family:"Helvetica Neue",Arial,sans-serif;font-size:16px;-webkit-font-smoothing:antialiased}h1,h2,h3,p,figure{margin:0}h1,h2,h3{letter-spacing:-.045em}a{color:inherit;text-decoration:none}button,select,input{font:inherit}button,a,select,input{ -webkit-tap-highlight-color:transparent}a:focus-visible,button:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #ac91fa;outline-offset:5px}button{cursor:pointer}.wrap{max-width:var(--content);margin:auto;width:calc(100% - 112px)}.icon{width:19px;height:19px;display:inline-block;vertical-align:middle;flex-shrink:0}img{display:block;max-width:100%}.button{display:inline-flex;align-items:center;justify-content:center;gap:16px;min-height:50px;border-radius:10px;padding:13px 21px;font-size:14px;font-weight:700;border:1px solid transparent;transition:background .18s,transform .18s}.button:hover{transform:translateY(-1px)}.primary{color:white;background:var(--violet)}.primary:hover{background:var(--violet-dark)}.light{background:white;color:#251347}.quiet{background:white;border-color:var(--line)}.text-link{color:var(--violet);display:inline-flex;align-items:center;gap:7px;font-size:14px;font-weight:650}.text-link:hover{text-decoration:underline;text-underline-offset:4px}.eyebrow{font-size:11px;letter-spacing:.12em;line-height:1.5;font-weight:700;color:#777584;text-transform:uppercase}.section{padding:88px 0}.section-head{text-align:center;max-width:850px;margin:0 auto 35px}.section-head .eyebrow{margin-bottom:13px}.section-head h2{font-size:38px;font-weight:700;line-height:1.2}.section-head>p:last-child:not(.eyebrow){color:var(--muted);line-height:1.7;margin:14px auto 0;max-width:640px;font-size:16px}.soft{background:var(--soft)}.header{height:76px;background:#09090c;color:white;position:relative;z-index:20}.nav{height:100%;display:flex;align-items:center;gap:36px}.brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:-.05em;font-size:23px;white-space:nowrap}.brand img{width:33px;height:33px}.nav-main{display:flex;gap:27px;align-items:center;font-size:13px;font-weight:600;color:#d2d0da;margin-left:20px}.nav-main>a:hover,.nav-main summary:hover{color:white}.nav-main details{position:relative}.nav-main summary{list-style:none;display:flex;align-items:center;gap:5px;cursor:pointer}.nav-main summary::-webkit-details-marker{display:none}.nav-main summary .icon{width:13px;height:13px}.dropdown{position:absolute;top:34px;left:-16px;background:white;color:var(--ink);padding:8px;width:240px;border-radius:12px;border:1px solid var(--line);box-shadow:0 15px 40px #1717271a}.dropdown a{display:block;padding:11px;border-radius:8px;font-size:13px}.dropdown a:hover{background:var(--soft);color:var(--violet)}.nav-actions{margin-left:auto;display:flex;gap:24px;align-items:center;font-size:13px}.nav-actions>.button{min-height:40px;padding:9px 18px;border-radius:9px;font-size:12px;gap:7px}.mobile-menu{display:none}.breadcrumb{font-size:11px;color:#827f90;display:flex;gap:9px;align-items:center;padding:29px 0 25px}.breadcrumb a:hover{color:var(--violet)}.breadcrumb .icon{width:10px;height:10px;transform:rotate(-90deg)}.hero{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;padding:15px 0 62px}.hero h1{font-size:51px;font-weight:700;line-height:1.085;margin-top:16px;letter-spacing:-.055em}.hero-lead{font-size:15px;color:var(--muted);line-height:1.75;margin:20px 0 24px;max-width:520px}.starter{border:1px solid var(--line);border-radius:16px;background:#fff;padding:21px;box-shadow:0 9px 28px #21144004}.starter-title{display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:13px}.starter-title>span{font-size:9px;font-weight:650;letter-spacing:.07em;color:#837b96;text-transform:uppercase}.upload-entry{display:flex;gap:14px;align-items:center;padding:18px 16px;border:1px dashed #d9d3e8;border-radius:10px;background:#fcfbfe;transition:background .15s}.upload-entry:hover{background:#f5f1ff}.upload-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:10px;background:#f0ebff;color:var(--violet)}.upload-entry strong{display:block;font-size:12px;letter-spacing:-.01em}.upload-entry small{display:block;color:#8b8697;font-size:10px;margin-top:5px;line-height:1.5}.options{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:15px 0}.options label{display:flex;gap:8px;align-items:center;font-size:10px;color:#77717e}.options select{min-width:0;width:100%;border:1px solid var(--line);border-radius:7px;padding:8px;color:var(--ink);background:white;font-size:10px}.starter .button{width:100%;font-size:12px;min-height:45px}.micro{font-size:10px;color:#8a8495;text-align:center;margin-top:11px;line-height:1.5}.hero-examples{margin-top:19px;font-size:12px}.hero-visual{min-width:0}.compare{height:552px;position:relative;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:white;--split:48%}.compare>.result,.compare>.original{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.compare>.original{clip-path:inset(0 calc(100% - var(--split)) 0 0)}.compare-divider{position:absolute;top:0;bottom:0;left:var(--split);width:2px;background:white;pointer-events:none;box-shadow:0 0 10px #17172711}.compare-handle{position:absolute;top:49%;left:calc(var(--split) - 22px);width:44px;height:44px;border-radius:50%;background:white;box-shadow:0 3px 16px #17172722;display:grid;place-items:center;pointer-events:none;font-size:20px;letter-spacing:-4px;padding-right:4px}.compare input{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:ew-resize}.compare:focus-within{outline:3px solid #b69cfa;outline-offset:4px}.photo-label{position:absolute;top:19px;left:17px;padding:7px 10px;background:#252429bb;color:white;font-size:10px;border-radius:20px;backdrop-filter:blur(6px);font-weight:650;pointer-events:none}.photo-label.right{left:auto;right:17px;background:#f2f1f6ee;color:#41404e}.compare-tip{position:absolute;bottom:17px;right:18px;border:1px solid var(--line);border-radius:8px;background:#fffefb;padding:8px 11px;font-size:10px;font-weight:650;pointer-events:none}.visual-note{font-size:10px;line-height:1.5;color:#928a9e;text-align:center;margin-top:12px}.feed-visual{height:552px;position:relative;padding:14px 63px 34px 34px}.feed-main{height:100%;width:100%;object-fit:cover;border-radius:22px}.feed-visual>.photo-label{top:30px;left:47px}.source-inset{position:absolute;bottom:0;left:0;width:161px;background:white;padding:7px;border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 30px #17172712}.source-inset img{aspect-ratio:1;width:100%;object-fit:cover;border-radius:9px}.source-inset figcaption{font-size:10px;font-weight:650;padding:7px 3px 2px;color:#747080}.feed-mini{position:absolute;right:0;top:58px;width:83px;display:grid;gap:12px}.feed-mini img{aspect-ratio:1;object-fit:cover;border-radius:11px;border:4px solid white;box-shadow:0 4px 14px #1717270a}.feed-arrow{position:absolute;left:149px;bottom:154px;color:var(--violet);background:white;padding:8px;border-radius:50%;box-shadow:0 2px 12px #1717270b}.feed-arrow .icon{transform:rotate(-34deg);width:25px;height:25px}.section-nav{background:#fbfaff;border-block:1px solid #eeebf7;position:sticky;top:0;z-index:15}.section-nav>.wrap{display:flex;align-items:center;justify-content:space-between;min-height:65px;gap:20px}.anchor-links{display:flex;gap:29px;white-space:nowrap;font-size:12px;font-weight:650}.anchor-links a:hover{color:var(--violet)}.section-nav .button{min-height:38px;font-size:11px;padding:9px 16px}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.gallery.four{grid-template-columns:repeat(4,1fr);gap:17px}.example{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:white;transition:box-shadow .2s,transform .2s}.example:hover{transform:translateY(-3px);box-shadow:0 10px 28px #35255c0b}.example[hidden]{display:none}.example-photo{width:100%;border:0;padding:0;background:#f6f5f4;display:block;position:relative;cursor:zoom-in}.example-photo>img{width:100%;aspect-ratio:1.13;object-fit:cover;transition:transform .3s}.four .example-photo>img{aspect-ratio:1}.example-photo .expand{position:absolute;bottom:12px;right:12px;border-radius:8px;background:#fffffff2;padding:7px;color:#5d566d;opacity:0;transition:opacity .2s}.example:hover .expand{opacity:1}.example-body{padding:17px 17px 15px}.example h3{font-size:17px;line-height:1.3;font-weight:700;letter-spacing:-.025em}.example p{font-size:11px;line-height:1.6;color:#817a8b;margin-top:7px;min-height:35px}.example-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px}.preview{padding:7px 10px;color:#736b80;border:1px solid var(--line);border-radius:6px;background:white;font-size:10px}.example-actions a{font-size:10px;font-weight:700;color:var(--violet);display:flex;gap:4px;align-items:center}.example-actions a .icon{width:12px;height:12px}.filters{display:flex;justify-content:center;gap:8px;margin:-8px 0 25px}.filters button{border:1px solid var(--line);border-radius:20px;background:white;color:#7b7288;font-size:11px;padding:8px 14px}.filters button[aria-pressed="true"]{background:var(--violet);color:white;border-color:var(--violet)}.feature{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:78px}.feature-image{border-radius:21px;overflow:hidden;border:1px solid #e6e0f0;background:#f4f0e9;position:relative}.feature-image img{width:100%;aspect-ratio:1.2;object-fit:cover}.feature-image .photo-label{top:auto;bottom:16px}.feature .eyebrow{color:var(--violet);margin-bottom:16px}.feature h2{font-size:43px;line-height:1.16;font-weight:700}.feature-body{font-size:15px;line-height:1.8;color:#777080;margin-top:21px}.checks{display:grid;gap:14px;padding:0;margin:25px 0;list-style:none}.checks li{display:flex;align-items:center;gap:11px;font-size:13px;color:#5d566c}.check{border-radius:6px;background:#ebe4ff;color:var(--violet);height:23px;width:23px;display:grid;place-items:center}.check .icon{width:14px;height:14px}.feature-note{font-size:10px;line-height:1.65;color:#9a91a5;max-width:440px}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:31px}.step-top{display:flex;align-items:center;gap:12px;margin-bottom:17px;min-height:40px}.step-num{height:34px;width:34px;display:grid;place-items:center;background:#eee8ff;border-radius:50%;color:var(--violet);font-size:12px;font-weight:700}.step-top h3{font-size:15px;font-weight:700;letter-spacing:-.02em}.step-art{height:200px;background:#faf9fc;border-radius:16px;overflow:hidden;border:1px solid var(--line);position:relative}.step-art>img{width:100%;height:100%;object-fit:cover}.step>p{font-size:12px;color:#8a8094;line-height:1.7;margin-top:14px}.setting-demo{height:100%;display:flex;flex-direction:column;justify-content:center;gap:18px;padding:29px;background:#fbfaff}.setting-demo>div{display:flex;align-items:center;justify-content:space-between;gap:15px;font-size:12px;color:#7b7287}.setting-demo b{background:white;padding:10px 12px;border:1px solid var(--line);border-radius:7px;font-size:11px;font-weight:600;min-width:125px;display:flex;justify-content:space-between;gap:16px;color:var(--ink)}.setting-demo .icon{width:12px;height:12px}.section-action{text-align:center;margin-top:31px}.step-img-chip{position:absolute;bottom:13px;left:14px;background:#fffffff0;border:1px solid var(--line);border-radius:8px;padding:7px 11px;font-size:10px;font-weight:650}.use-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.use{padding:23px;border:1px solid var(--line);border-radius:13px;display:flex;gap:16px;align-items:flex-start}.use-symbol{width:42px;height:42px;background:#f1edff;color:var(--violet);display:grid;place-items:center;border-radius:10px;flex-shrink:0}.use h3{font-size:16px;letter-spacing:-.025em}.use p{font-size:12px;color:#8a8197;line-height:1.7;margin-top:7px}.official-link{margin-top:25px;text-align:center}.official-link a{font-size:12px}.formats{display:grid;grid-template-columns:repeat(3,1fr);gap:34px;align-items:end;max-width:1000px;margin:auto}.format{text-align:center}.format-preview{height:215px;display:flex;align-items:flex-end;justify-content:center}.format-preview img{border-radius:13px;object-fit:cover;box-shadow:0 3px 18px #25144008}.format.square img{width:195px;height:195px}.format.portrait img{width:117px;height:208px}.format.wide img{width:266px;height:150px}.format h3{font-size:15px;letter-spacing:-.02em;margin-top:20px}.format p{font-size:11px;color:#8a8093;line-height:1.6;margin:8px auto 0;max-width:220px}.format-links{display:flex;justify-content:center;gap:28px;margin-top:30px}.format-links a{font-size:12px}.faq-wrap{max-width:950px;margin:auto}.faq{border:1px solid var(--line);border-radius:15px;overflow:hidden}.faq details{padding:0 24px;border-bottom:1px solid var(--line)}.faq details:last-child{border:0}.faq summary{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:21px 0;cursor:pointer;font-size:14px;font-weight:650;list-style:none}.faq summary::-webkit-details-marker{display:none}.faq summary .icon{width:16px;height:16px;color:#8f84a0}.faq details[open] summary{color:var(--violet);padding-bottom:11px}.faq details[open] summary .icon{transform:rotate(180deg)}.faq details>p{font-size:13px;line-height:1.8;color:#8a8195;max-width:760px;padding:0 28px 21px 0}.faq details>p a{color:var(--violet);text-decoration:underline}.related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.related{display:flex;align-items:center;gap:17px;padding:12px;border:1px solid var(--line);border-radius:14px;transition:background .2s}.related:hover{background:#faf8ff;border-color:#d6c9f8}.related img{width:98px;height:98px;object-fit:cover;border-radius:10px}.related h3{font-size:14px;letter-spacing:-.02em;display:flex;gap:8px;align-items:center}.related h3 .icon{width:14px;height:14px;color:var(--violet)}.related p{font-size:11px;color:#92889f;line-height:1.65;margin-top:7px;max-width:200px}.closing{padding:0 0 58px}.closing-panel{background:#2d1d56;border-radius:21px;padding:43px 46px;display:flex;justify-content:space-between;align-items:center;gap:25px;color:white;position:relative;overflow:hidden}.closing-panel:after{content:"";position:absolute;top:-145px;right:-20px;width:430px;height:430px;border-radius:50%;border:1px solid #ffffff0d;pointer-events:none}.closing-panel h2{font-size:31px;line-height:1.2;letter-spacing:-.035em}.closing-panel p{font-size:13px;color:#d5cbe8;line-height:1.7;margin-top:13px}.closing-panel .button{position:relative;z-index:1;white-space:nowrap;font-size:12px}.footer{background:#09090c;color:#ded9e6;padding:30px 0}.footer-main{display:flex;align-items:center;justify-content:space-between;gap:24px}.footer .brand{font-size:19px}.footer .brand img{width:28px;height:28px}.footer-links{display:flex;gap:22px;font-size:11px;color:#a59aad}.footer small{font-size:10px;color:#6f6678;display:block;text-align:right}.dialog{border:1px solid #e8e0f0;border-radius:18px;padding:20px;width:min(90vw,950px);box-shadow:0 25px 90px #0003;color:var(--ink)}.dialog::backdrop{background:#0e091dc9;backdrop-filter:blur(6px)}.dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.dialog-head h2{font-size:21px}.dialog-close{border:1px solid var(--line);background:white;height:35px;width:35px;border-radius:8px;font-size:21px}.dialog-image{width:100%;max-height:65vh;object-fit:contain;background:#f7f6f9;border-radius:12px}.dialog-actions{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:16px}.dialog-actions>div{display:flex;gap:9px}.dialog-actions button{height:37px;min-width:37px;border:1px solid var(--line);border-radius:8px;background:white}.dialog-note{font-size:10px;color:#9c91a6;margin-top:10px}.related-section{padding-top:15px}.uses-section{padding-top:0}.bottom-links{padding:18px 0 0;border-top:1px solid #ffffff12;margin-top:23px;display:flex;justify-content:space-between;gap:15px;font-size:10px;color:#8b8095}.bottom-links a{margin-left:14px}
@media(min-width:1440px){.hero{gap:68px}.hero h1{font-size:55px}.hero-lead{font-size:16px}}
@media(max-width:1050px){.wrap{width:calc(100% - 64px)}.nav-main{gap:17px;margin-left:0}.nav{gap:24px}.hero{gap:32px}.hero h1{font-size:43px}.compare,.feed-visual{height:510px}.feature{gap:40px}.feature h2{font-size:37px}.gallery.four{gap:12px}.example-body{padding:12px}.example h3{font-size:15px}.example-actions{gap:5px}.example-actions a{font-size:9px}.related img{width:70px;height:80px}.related-grid{gap:10px}.related{gap:11px}.related h3{font-size:12px}.related p{font-size:10px}.nav-actions{gap:16px}}
@media(max-width:760px){.wrap{width:calc(100% - 40px)}.header{height:66px}.brand{font-size:20px}.brand img{width:29px;height:29px}.nav{gap:12px}.nav-main,.nav-actions>a:first-child{display:none}.nav-actions{margin-left:auto}.nav-actions>.button{font-size:10px;min-height:35px;padding:8px 12px}.mobile-menu{display:block}.mobile-menu>summary{font-size:22px;list-style:none;cursor:pointer}.mobile-menu .dropdown{left:auto;right:20px;top:56px;width:230px}.breadcrumb{padding:22px 0 12px;font-size:9px;gap:6px;flex-wrap:wrap}.hero{display:flex;flex-direction:column;gap:32px;padding-top:15px;padding-bottom:35px;align-items:stretch}.hero h1{font-size:39px;line-height:1.1;letter-spacing:-.05em;margin-top:14px}.hero .eyebrow{font-size:9px;letter-spacing:.1em}.hero-lead{font-size:13px;line-height:1.8;margin:17px 0 20px}.starter{padding:16px;border-radius:13px}.starter-title{font-size:12px}.upload-entry{padding:14px 12px}.upload-icon{width:38px;height:38px}.upload-entry small{font-size:9px}.options{gap:10px}.options label{font-size:9px;gap:5px}.options select{font-size:9px;padding:8px 4px}.micro{font-size:9px}.hero-examples{font-size:11px;margin-top:15px}.compare{height:350px;border-radius:17px}.photo-label{font-size:8px;padding:6px 8px;top:13px;left:11px}.photo-label.right{right:11px}.compare-tip{font-size:8px;bottom:13px;right:12px}.compare-handle{width:35px;height:35px;left:calc(var(--split) - 17px);font-size:17px}.visual-note{font-size:9px;margin-top:8px}.feed-visual{height:385px;padding:0 43px 24px 18px}.feed-main{border-radius:17px}.source-inset{width:113px;padding:5px}.source-inset figcaption{font-size:9px}.feed-visual>.photo-label{top:14px;left:29px}.feed-mini{width:61px;top:36px;gap:9px}.feed-mini img{border-width:3px;border-radius:9px}.feed-arrow{left:109px;bottom:115px;padding:6px}.feed-arrow .icon{width:20px;height:20px}.section-nav>.wrap{min-height:57px;width:100%;padding:0 20px;overflow-x:auto}.anchor-links{gap:22px;font-size:10px}.section-nav .button{display:none}.section{padding:49px 0}.section-head{margin-bottom:26px}.section-head .eyebrow{font-size:9px;margin-bottom:10px}.section-head h2{font-size:27px;line-height:1.2;letter-spacing:-.045em}.section-head>p:last-child:not(.eyebrow){font-size:12px;line-height:1.8;margin-top:11px}.gallery,.gallery.four{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gallery:not(.four) .example:last-child{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;align-items:center}.gallery:not(.four) .example:last-child .example-photo>img{aspect-ratio:1.1}.example-body{padding:12px}.example h3{font-size:13px}.example p{font-size:9px;min-height:40px;line-height:1.6}.example-actions{flex-wrap:wrap;gap:8px;margin-top:9px}.example-actions a{font-size:9px}.example-actions .preview{font-size:9px;padding:5px 7px}.example .expand{display:none}.filters{gap:6px;margin-top:-6px;margin-bottom:20px}.filters button{font-size:9px;padding:7px 10px}.feature{grid-template-columns:1fr;gap:27px}.feature h2{font-size:32px}.feature .eyebrow{font-size:9px;margin-bottom:12px}.feature-body{font-size:13px;line-height:1.8;margin-top:16px}.feature-image img{aspect-ratio:1.2}.feature-note{font-size:10px}.checks{gap:12px;margin:20px 0}.checks li{font-size:12px}.feed-feature .feature-copy{order:2}.feed-feature .feature-image{order:1}.steps{grid-template-columns:1fr;gap:28px}.step-top{margin-bottom:12px}.step-top h3{font-size:14px}.step-art{height:210px}.step>p{font-size:11px;line-height:1.8;margin-top:11px}.section-action{margin-top:26px}.section-action .button{font-size:12px;min-height:46px;width:100%}.uses-section{padding-top:0}.use-grid{grid-template-columns:1fr;gap:11px}.use{padding:20px}.use h3{font-size:14px}.use p{font-size:11px}.official-link{margin-top:21px}.official-link a{font-size:10px}.formats{gap:14px;align-items:end}.format-preview{height:120px}.format.square img{width:94px;height:94px}.format.portrait img{width:63px;height:113px}.format.wide img{width:100px;height:65px}.format h3{font-size:10px;line-height:1.6;margin-top:15px}.format p{font-size:9px;line-height:1.65;margin-top:7px}.format-links{flex-direction:column;align-items:center;gap:13px;margin-top:25px}.format-links a{font-size:11px}.faq details{padding:0 15px}.faq summary{font-size:12px;padding:18px 0;line-height:1.7}.faq summary .icon{width:13px;height:13px;flex-shrink:0}.faq details>p{font-size:11px;padding:0 0 19px;line-height:1.85}.related-section{padding-top:0}.related-grid{grid-template-columns:1fr;gap:12px}.related{padding:11px;gap:17px}.related img{width:78px;height:78px}.related h3{font-size:13px}.related p{font-size:10px;max-width:none}.closing{padding-bottom:30px}.closing-panel{padding:28px 23px;display:block;border-radius:16px}.closing-panel h2{font-size:26px}.closing-panel p{font-size:12px;line-height:1.8;margin-top:13px}.closing-panel .button{margin-top:22px;width:100%;min-height:46px}.footer{padding:27px 0}.footer-main{align-items:flex-start;gap:22px;flex-wrap:wrap}.footer .brand{font-size:19px}.footer-links{display:flex;flex-wrap:wrap;gap:14px 21px;font-size:10px}.footer small{text-align:left;font-size:9px}.bottom-links{font-size:9px;line-height:1.8;gap:12px;flex-wrap:wrap}.bottom-links a{margin-left:0;margin-right:13px}.dialog{width:94vw;padding:14px}.dialog-head h2{font-size:18px}.dialog-actions .button{font-size:10px;min-height:40px;padding:8px 11px;gap:8px}.dialog-note{font-size:9px}.dialog-image{max-height:60vh}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
'''


CSS += """
@media(max-width:700px){
.hero-lead{font-size:14px}.upload-entry small,.micro{font-size:11px}
.options label{font-size:11px}.options select{font-size:11px;min-height:40px}
.nav-actions>.button{min-height:44px}.mobile-menu summary{min-width:44px;min-height:44px;display:grid;place-items:center}
.anchor-links a{display:flex;align-items:center;min-height:44px;font-size:11px}
.filters button{min-height:44px;font-size:11px}
.example p{font-size:11px;min-height:52px}.example h3{font-size:14px}
.example-actions .preview{font-size:11px;min-height:44px;padding:7px 9px}
.example-actions a{font-size:11px;min-height:44px;display:inline-flex;align-items:center}
.format p{font-size:11px}.format h3{font-size:12px}.format-links a{min-height:44px}
.dialog-close,.dialog-actions button{min-width:44px;min-height:44px}
}
"""

JS = '''
const payload=JSON.parse(document.getElementById('design-data').textContent);
const origin='https://www.aivideosugc.com';
const form=document.querySelector('.starter');
function updateEntry(){
 const url=new URL(payload.workspace,origin);
 url.searchParams.set('aspect',form.querySelector('[name=aspect]').value);
 const direction=form.querySelector('[name=direction]');
 if(payload.kind==='feed')url.searchParams.set('prompt','Create a product image for a social feed using my uploaded photo as a reference. Setting: '+direction.value+'. Keep the product clear, with space for a headline I will add after download.');
 else url.searchParams.set('prompt',direction.value==='shadow'?'Create a pure-white product photo from my reference with a light natural contact shadow. Show the full item with clear edges and natural proportions.':'Create a pure-white product photo from my reference. Show the full item with clear edges and natural proportions.');
 document.querySelectorAll('[data-workspace-entry]').forEach(a=>a.href=url.href);
}
form.addEventListener('change',updateEntry);
document.querySelectorAll('.compare').forEach(box=>box.querySelector('input').addEventListener('input',e=>box.style.setProperty('--split',e.target.value+'%')));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 document.querySelectorAll('.example').forEach(card=>card.hidden=button.dataset.filter!=='all'&&card.dataset.category!==button.dataset.filter);
}));
const dialog=document.querySelector('dialog');let current=0;let opener;
function show(index){current=(index+payload.gallery.length)%payload.gallery.length;const item=payload.gallery[current];dialog.querySelector('h2').textContent=item.title;const img=dialog.querySelector('.dialog-image');img.src='assets/'+item.image;img.alt=item.alt;const use=dialog.querySelector('[data-dialog-use]');use.href=origin+item.href;use.childNodes[0].textContent=payload.kind==='feed'?'Use this scene ':'Use this style ';}
document.querySelectorAll('[data-preview]').forEach(button=>button.addEventListener('click',()=>{opener=button;show(Number(button.dataset.preview));dialog.showModal();}));
dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.querySelector('[data-previous]').addEventListener('click',()=>show(current-1));
dialog.querySelector('[data-next]').addEventListener('click',()=>show(current+1));
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(current+1);if(e.key==='ArrowLeft')show(current-1);});
dialog.addEventListener('close',()=>opener?.focus());
'''

def heading(eyebrow, title, lead=''):
    return f'<div class="section-head"><p class="eyebrow">{eyebrow}</p><h2>{title}</h2>' + (f'<p>{lead}</p>' if lead else '') + '</div>'

def header(data):
    nav = [('Video', [('AI Video Tools', '/ai-video-generation'), ('Image to Video', '/ai-video-generation/image-to-video')]), ('Photo', [('All Product Photos', '/ai-image-generation'), ('White Background Photos', DATA['ecommerce']['path']), ('Social Ad Images', DATA['feed']['path'])]), ('Templates', [('Product Photo Examples', '/ai-image-generation'), ('Video Examples', '/ai-video-generation')]), ('Resources', [('How-to Guides', '/guides'), ('Frequently Asked Questions', '/faq'), ('Contact', '/contact-us')])]
    menus=''.join('<details><summary>'+label+icon('down')+'</summary><div class="dropdown">'+''.join(f'<a href="{live(href)}">{title}</a>' for title,href in rows)+'</div></details>' for label,rows in nav)
    mobile=''.join(f'<a href="{live(h)}">{t}</a>' for t,h in [('Product Photos','/ai-image-generation'),('White Background Photos',DATA['ecommerce']['path']),('Social Ad Images',DATA['feed']['path']),('AI Video Tools','/ai-video-generation'),('Pricing','/pricing'),('Contact','/contact-us')])
    brand=f'<a class="brand" href="{ORIGIN}/">{image("brand-icon.png", "AIVideosUGC logo")}<span>AIVideosUGC</span></a>'
    return f'<header class="header"><div class="wrap nav">{brand}<nav class="nav-main" aria-label="Main navigation">{menus}<a href="{live("/pricing")}">Pricing</a></nav><div class="nav-actions"><a href="{escape(live("/login?"+urlencode({"next":data["workspace"]})))}">Log in</a>{cta("Get started",data["workspace"],extra="data-workspace-entry")}</div><details class="mobile-menu"><summary aria-label="Open navigation">☰</summary><nav class="dropdown">{mobile}</nav></details></div></header>'

def hero(data,kind):
    directions = [('shadow', 'White + shadow'), ('white', 'Pure white')] if kind=='ecommerce' else [('Bright cafe','Bright cafe'),('Home interior','Home interior'),('Outdoor','Outdoor'),('Studio','Studio')]
    opts=''.join(f'<option value="{v}">{t}</option>' for v,t in directions)
    form=f'<div class="starter"><div class="starter-title">Start with your product photo<span>Image tool</span></div><a class="upload-entry" href="{escape(live(data["workspace"]))}" data-workspace-entry><span class="upload-icon">{icon("upload")}</span><span><strong>Upload a product photo</strong><small>Continue in the image workspace · JPG, PNG or WebP</small></span></a><div class="options"><label>{"Background" if kind=="ecommerce" else "Scene"}<select name="direction" aria-label="Image direction">{opts}</select></label><label>Format<select name="aspect" aria-label="Image format"><option value="1:1">Square · 1:1</option><option value="9:16">Portrait · 9:16</option><option value="16:9">Wide · 16:9</option></select></label></div>{cta(data["button"],data["workspace"],extra="data-workspace-entry")}<p class="micro">See your credit cost in the workspace before generating.</p></div>'
    if kind=='ecommerce':
        visual=f'<div class="hero-visual"><div class="compare" style="--split:48%">{image("white-result.webp","AI image example: a brown leather wallet on a clean white background.","result")}{image("white-source.webp","Original photo: a brown leather wallet on a warm marble tabletop.","original")}<span class="photo-label">Original photo</span><span class="photo-label right">AI image example</span><span class="compare-divider"></span><span class="compare-handle">‹ ›</span><span class="compare-tip">Drag to compare</span><input type="range" value="48" min="0" max="100" aria-label="Reveal original product photo or AI image example"></div><p class="visual-note">Compare the product details before you use your result.</p></div>'
    else:
        visual=f'<div class="hero-visual"><div class="feed-visual">{image("feed-result.webp","AI image example: a sage-green insulated bottle on a sunlit cafe counter.","feed-main")}<span class="photo-label">AI scene example</span><figure class="source-inset">{image("feed-source.webp","Original sage-green bottle on a plain studio surface.")}<figcaption>Your photo</figcaption></figure><span class="feed-arrow">{icon("arrow")}</span><div class="feed-mini">{image("feed-entryway.webp","Bottle in an everyday entryway setting.")}{image("feed-result.webp","Bottle on a cafe counter.")}{image("feed-outdoor.webp","Hiking shoe on an outdoor city curb.")}</div></div><p class="visual-note">Use your photo as the reference. Review the generated details.</p></div>'
    label='See examples' if kind=='ecommerce' else 'Explore scenes'
    return f'<div class="wrap"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="{ORIGIN}/">Home</a>{icon("down")}<a href="{live("/ai-image-generation")}">Product Photos</a>{icon("down")}<span>{data["breadcrumb"]}</span></nav><section class="hero"><div><p class="eyebrow">{data["eyebrow"]}</p><h1>{data["h1"]}</h1><p class="hero-lead">{data["lead"]}</p>{form}<a class="text-link hero-examples" href="#examples">{label} ↓</a></div>{visual}</section></div>'

def gallery(data,kind):
    cards=[]
    for index,item in enumerate(data['gallery']):
        href = '/app/create?' + urlencode(dict(source=data['path'],preset=item['preset'])) if item.get('preset') else workspace(data['tool'],item['prompt'])
        item['href']=href
        cards.append(f'<article class="example" data-category="{item["category"]}"><button class="example-photo" data-preview="{index}" aria-label="Preview {item["title"]}">{image(item["image"],item["alt"])}<span class="expand">{icon("expand")}</span></button><div class="example-body"><h3>{item["title"]}</h3><p>{item["desc"]}</p><div class="example-actions"><button class="preview" data-preview="{index}">Preview</button><a href="{escape(live(href))}">Use this {"scene" if kind=="feed" else "style"}{icon("external")}</a></div></div></article>')
    filters='<div class="filters" role="group" aria-label="Scene examples"><button data-filter="all" aria-pressed="true">All scenes</button><button data-filter="focus" aria-pressed="false">Product focus</button><button data-filter="use" aria-pressed="false">Everyday use</button></div>' if kind=='feed' else ''
    return '<section class="section" id="examples"><div class="wrap">'+heading('EXAMPLES',data['gallery_title'],data['gallery_lead'])+filters+f'<div class="gallery {"four" if kind=="feed" else ""}">'+''.join(cards)+'</div></div></section>'

def feature(data,kind):
    photo=f'<figure class="feature-image">{image(data["feature_image"],data["feature_alt"])}<figcaption class="photo-label">AI image example</figcaption></figure>'
    checks=''.join('<li><span class="check">'+icon('check')+'</span>'+t+'</li>' for t in data['checks'])
    copy=f'<div class="feature-copy"><p class="eyebrow">{ "PRODUCT FIRST" if kind=="ecommerce" else "A SETTING THAT FITS"}</p><h2>{data["feature_title"]}</h2><p class="feature-body">{data["feature_body"]}</p><ul class="checks">{checks}</ul><p class="feature-note">{data["feature_note"]}</p></div>'
    return f'<section class="section soft {"feed-feature" if kind=="feed" else ""}"><div class="wrap feature">'+(photo+copy if kind=='ecommerce' else copy+photo)+'</div></section>'

def steps(data,kind):
    result=[]
    for i,(title,body) in enumerate(data['steps']):
        if i==0: art=image(data['source'],'Product reference photo for the image workspace.')+'<span class="step-img-chip">Your product photo</span>'
        elif i==2: art=image(data['result'],'Example generated product image to review before download.')+'<span class="step-img-chip">Preview your result</span>'
        else: art=f'<div class="setting-demo"><div>{"Background" if kind=="ecommerce" else "Scene"}<b>{"White + shadow" if kind=="ecommerce" else "Bright cafe"}{icon("down")}</b></div><div>Format<b>Square · 1:1{icon("down")}</b></div><div>Next step<b>Review credit cost</b></div></div>'
        result.append(f'<article class="step"><div class="step-top"><span class="step-num">0{i+1}</span><h3>{title}</h3></div><div class="step-art">{art}</div><p>{body}</p></article>')
    return '<section class="section" id="how-it-works"><div class="wrap">'+heading('HOW IT WORKS',data['step_title'])+'<div class="steps">'+''.join(result)+'</div><div class="section-action">'+cta(data['button'],data['workspace'],extra='data-workspace-entry')+'</div></div></section>'

def use_cases(data,kind):
    if kind=='ecommerce':
        use=[('shop','Online stores','Create a clear product image for the listing you are preparing.'),('grid','Product catalogs','Build a consistent visual direction across your product range.'),('bag','Marketplace listings','Prepare an image, then check your destination’s current rules.')]
        cards=''.join('<article class="use"><span class="use-symbol">'+icon(symbol)+f'</span><div><h3>{title}</h3><p>{body}</p></div></article>' for symbol,title,body in use)
        return '<section class="section uses-section" id="use-cases"><div class="wrap">'+heading('USE CASES','Made for the places you sell.')+'<div class="use-grid">'+cards+'</div><div class="official-link"><a class="text-link" href="https://support.google.com/merchants/answer/6324350?hl=en" target="_blank" rel="noopener noreferrer">Read Google product image guidance'+icon('external')+'</a></div></div></section>'
    formats=[('square','Square feed · 1:1','A square option for Instagram and Facebook feed creatives.','1:1'),('portrait','Story image · 9:16','A vertical image for Story placements.','9:16'),('wide','Wide creative · 16:9','A landscape option for your campaign.','16:9')]
    cards=''.join(f'<article class="format {style}"><a class="format-preview" href="{escape(live(workspace(data["tool"],data["prompt"],aspect)))}" aria-label="Create a {title}">'+image('feed-result.webp','Sage-green bottle shown in a '+aspect+' image crop.')+f'</a><h3>{title}</h3><p>{desc}</p></article>' for style,title,desc,aspect in formats)
    return '<section class="section soft" id="formats"><div class="wrap">'+heading('IMAGE FORMATS','A visual for the placement you choose.','Choose a format in the workspace and check the placement’s current requirements before publishing.')+'<div class="formats">'+cards+'</div><div class="format-links"><a class="text-link" href="'+live('/ai-image-generation/story-ad-vertical')+'">Explore Story Images'+icon('arrow')+'</a><a class="text-link" href="https://www.facebook.com/business/ads-guide/image" target="_blank" rel="noopener noreferrer">Meta image ad guidance'+icon('external')+'</a></div></div></section>'

def faq(data,kind):
    rows=[]
    for i,(q,a) in enumerate(data['faq']):
        if 'AI Video tools' in a:a=a.replace('AI Video tools','<a href="'+live('/ai-video-generation')+'">AI Video tools</a>')
        if 'Pricing' in a:a=a.replace('Pricing','<a href="'+live('/pricing')+'">Pricing</a>')
        rows.append(f'<details {"open" if i==0 else ""}><summary>{q}{icon("down")}</summary><p>{a}</p></details>')
    return '<section class="section" id="faqs"><div class="wrap faq-wrap">'+heading('FAQ',data['faq_title'])+'<div class="faq">'+''.join(rows)+'</div></div></section>'

def related(data):
    cards=''.join(f'<a class="related" href="{live(path)}">'+image(file,title+' example.')+f'<div><h3>{title}{icon("arrow")}</h3><p>{body}</p></div></a>' for title,path,file,body in data['related'])
    return '<section class="section related-section"><div class="wrap">'+heading('RELATED TOOLS',data['related_title'])+'<div class="related-grid">'+cards+'</div></div></section>'

def footer(data):
    links=''.join(f'<a href="{live(path)}">{title}</a>' for title,path in [('Product Photos','/ai-image-generation'),('Pricing','/pricing'),('Contact','/contact-us'),('Privacy','/privacy'),('Terms','/terms')])
    return '<footer class="footer"><div class="wrap"><div class="footer-main"><a class="brand" href="'+ORIGIN+'/">'+image('brand-icon.png','AIVideosUGC logo')+'<span>AIVideosUGC</span></a><nav class="footer-links" aria-label="Footer">'+links+'</nav><small>© 2026 AIVideosUGC</small></div><div class="bottom-links"><span>Product photos and video ideas, in one workspace.</span><div><a href="'+live('/ai-image-generation')+'">Explore photo tools</a><a href="'+live('/ai-video-generation')+'">Explore video tools</a></div></div></div></footer>'

def page(data,kind):
    data['workspace']=workspace(data['tool'],data['prompt'])
    anchor_last='Use cases' if kind=='ecommerce' else 'Formats'
    anchor_last_id='use-cases' if kind=='ecommerce' else 'formats'
    nav=f'<nav class="section-nav" aria-label="On this page"><div class="wrap"><div class="anchor-links"><a href="#examples">Examples</a><a href="#how-it-works">How it works</a><a href="#{anchor_last_id}">{anchor_last}</a><a href="#faqs">FAQs</a></div>'+cta('Create a photo' if kind=='ecommerce' else 'Create an ad image',data['workspace'],extra='data-workspace-entry')+'</div></nav>'
    body=header(data)+'<main>'+hero(data,kind)+nav+gallery(data,kind)+feature(data,kind)+steps(data,kind)+use_cases(data,kind)+faq(data,kind)+related(data)
    body+='<section class="closing"><div class="wrap"><div class="closing-panel"><div><h2>'+data['closing']+'</h2><p>'+data['closing_lead']+'</p></div>'+cta(data['button'],data['workspace'],'light',extra='data-workspace-entry')+'</div></div></section></main>'+footer(data)
    body+='<dialog class="dialog" aria-labelledby="preview-title"><div class="dialog-head"><h2 id="preview-title">Image preview</h2><button class="dialog-close" aria-label="Close image preview">×</button></div>'+image(data['gallery'][0]['image'],data['gallery'][0]['alt'],'dialog-image')+'<div class="dialog-actions"><div><button data-previous aria-label="Previous example">←</button><button data-next aria-label="Next example">→</button></div><a class="button primary" data-dialog-use href="'+escape(live(data['workspace']))+'">Use this style '+icon('arrow')+'</a></div><p class="dialog-note">Example image. Add your own product photo in the workspace.</p></dialog>'
    public_payload={'kind':kind,'workspace':data['workspace'],'gallery':data['gallery']}
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+escape(data['title'])+'</title><meta name="description" content="'+escape(data['description'])+'"><link rel="stylesheet" href="ui.css"></head><body>'+body+'<script id="design-data" type="application/json">'+json.dumps(public_payload).replace('</','<\\/')+'</script><script src="ui.js"></script></body></html>'

ROOT.joinpath('ui.css').write_text(CSS,encoding='utf8')
ROOT.joinpath('ui.js').write_text(JS,encoding='utf8')
for kind,data in DATA.items():
    ROOT.joinpath(data['file']+'-preview.html').write_text(page(data,kind),encoding='utf8')
ROOT.joinpath('design-content.json').write_text(json.dumps(DATA,ensure_ascii=False,indent=2),encoding='utf8')
print('Created two isolated HTML design previews, CSS, interaction JS, and design copy data.')
