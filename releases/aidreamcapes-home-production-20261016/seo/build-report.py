import json, re, html, hashlib
from pathlib import Path
from datetime import datetime, timezone

DIR = Path(__file__).resolve().parent
ROOT = DIR.parents[2]
capture = json.loads((DIR / 'browser-readback.json').read_text())
js = capture['cases']['javascript']
nojs = capture['cases']['no-javascript']
old = json.loads((ROOT / 'releases/aidreamcapes-home-v4-implementation/current-home-content.json').read_text())
base = '/sections/v2_main/settings/data/'

def get(pointer):
    cur = old
    for key in pointer.strip('/').split('/'):
        cur = cur[int(key)] if isinstance(cur, list) else cur[key]
    return cur

def field(short, replacement, **kwargs):
    pointer = base + short
    original = get(pointer)
    visible = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', original)
    return dict(owner='LivePage site_aidreamcapes_home.contentJson', path=pointer,
                original=original, observedInPublicHtml=visible in js['bodyText'] or any(visible in d['text'] for d in js['details']),
                suggestedEnglish=replacement, **kwargs)

findings = [
 dict(id='SEO-001',priority='P1',title='AI Twin 承诺与当前不可用的声音克隆冲突',
      reason='当前公开FAQ明确声音克隆不可用；工作区navigation将AI Twin标为simulation，Voice training is not connected。这里却承诺使用自己的脸和声音持续生成广告，属于具体功能矛盾。',
      evidence=['javascript-response.html','browser-readback.json','src/lib/aidreamcapes-workspace/navigation.ts:20','src/components/aidreamcapes-workspace/twin-workbench.tsx:258'],
      fields=[field('benefits/5/t','Choose an AI Presenter'),
              field('benefits/5/d','Choose an available AI presenter for your product introduction. Add your own product photo and script, then review the generated shots before assembling your video.'),
              field('audience/items/4/d','Create presenter-led product videos from your own photos and scripts. Save drafts, refine the storyboard and review the result before posting.')]),
 dict(id='SEO-002',priority='P1',title='复制现有广告风格的成片承诺超出当前模拟能力',
      reason='当前Ad Clone仅模拟时间轴，真实视频分析未连接。原文承诺rebuild winning ad style并在几分钟内交付自己的版本。替换为现有场景、brief和storyboard工作流；不要把模拟能力写成现有生产能力。',
      evidence=['src/lib/aidreamcapes-workspace/navigation.ts:21','src/components/aidreamcapes-workspace/ad-clone-workbench.tsx:257','browser-readback.json'],
      fields=[field('benefits/2/t','Plan Your Own Creative Direction'),field('benefits/2/d','Use product examples to plan your own scene, message and shot sequence. Add your own product assets and refine the storyboard before generating.')]),
 dict(id='SEO-003',priority='P1',title='旧功能卡把可编辑分步流程描述成自动交付成片',
      reason='实际需要确认产品资料、保存草稿、生成storyboard、生成各shot、选择版本、assemble/render再review/download。这里writes/sets/finishes及finished ad comes back使用户合理预期自动完整成片，且与新6步说明冲突。',
      evidence=['src/components/aidreamcapes-workspace/workspace.tsx:644','src/components/aidreamcapes-workspace/workspace.tsx:1084','src/components/aidreamcapes-workspace/workspace.tsx:1086','browser-readback.json'],
      fields=[field('benefits/1/d','Describe your product and message in a short brief. Save a draft, generate its storyboard, refine the shots and assemble the versions you choose.'),field('benefits/3/d','Import a public product page, review the details and available photos, then use the confirmed information in an editable video draft. Continue in the [page-to-ad workspace](/ai-video-generation/url-to-video).')]),
 dict(id='SEO-004',priority='P1',title='套餐把图片比例混写成五种视频比例',
      reason='视频输入校验、catalog、editor和render实际只接受9:16、1:1、16:9。4:3与3:4不能作为当前视频可用选项承诺。应按视频/图片真实支持范围写明，并允许模型可用性限制。',
      evidence=['src/lib/aidreamcapes-workspace/api.ts:89','src/lib/aidreamcapes-workspace/catalogs.ts:8','src/lib/aidreamcapes-workspace/editor.ts:23','src/lib/aidreamcapes-workspace/media-render.ts:180','../content-manifest.json','browser-readback.json'],
      fields=[dict(owner='Product prod_aidreamcapes_starter.metadata',path='/features/2',original='Choose from five video formats: 9:16, 1:1, 16:9, 4:3, and 3:4.',observedInPublicHtml=True,suggestedEnglish='Choose from supported video formats, including 9:16, 1:1 and 16:9. Availability depends on the selected model.'),
              field('trust/items/3/d','Create videos in supported formats such as 9:16, 1:1 and 16:9. Check the available aspect ratios for your selected video or image workflow, then review the output before posting.')]),
 dict(id='SEO-005',priority='P1',title='Cloudflare 邮件改写破坏SSR邮件可读性并触发React #418',
      reason='公网原始HTML将trust段落纯文本邮箱变为CF保护a节点，将footer mailto文本变为保护span；Next Flight仍预期原始结构。无JS两处邮箱显示[email protected]，保护地址GET返回404。两个独立浏览器上下文对照中，原样稳定#418，仅把这两处响应片段还原后errors=[]。没有修改线上、日期、React代码或脚本。',
      evidence=['hydration-cf-control.json','hydration-restored-email-response.html','no-javascript-response.html','browser-readback.json'],fields=[],
      recommendation='在仅Aidreamcapes所属域名/响应范围内处理Cloudflare邮件混淆变换，然后重新验证真实公网无JS邮箱与hydration。不要通过隐藏hydration警告或改写公开联系文案掩盖。'),
 dict(id='SEO-006',priority='P2',title='固定“几分钟成片”缺少当前运行证据且略去人工检查',
      reason='本审计没有执行生成，也没有时延基准，因此不把几分钟判作虚假或违规；但反复写成通常/必然时间容易形成不受模型、排队、版本和审核影响的保证。FAQ应使用真实操作顺序，时间问题回答影响因素。',
      evidence=['browser-readback.json'],
      fields=[field('faq/0/a','Upload your product photo or import a public product page. Choose a scene and an available presenter, write your brief and save a draft. Generate and refine the storyboard, create the shots you choose, then assemble, review and download your video.',jsonLdSourcePath='/seo/jsonLd/@graph/3/mainEntity/0/acceptedAnswer/text'),
              field('faq/5/a','Yes. Import a public product link, review its photos and product details, and use the confirmed information in an editable video draft. Generate the storyboard and selected shots, then assemble and review the video before downloading.',jsonLdSourcePath='/seo/jsonLd/@graph/3/mainEntity/5/acceptedAnswer/text'),
              field('faq/10/a','Timing depends on the selected model, video length, shot count and any revisions. You can save a draft, return from your Library and download the video after its shots are generated and the final render is complete.',jsonLdSourcePath='/seo/jsonLd/@graph/3/mainEntity/10/acceptedAnswer/text'),
              field('faq/15/a','Yes. Use your product photo or confirmed product-page details with an available AI presenter. Refine the storyboard, generate the shots and review the assembled video before downloading.',jsonLdSourcePath='/seo/jsonLd/@graph/3/mainEntity/15/acceptedAnswer/text'),
              field('audience/items/1/d','Prepare product-video drafts without arranging a creator shoot. Compare creative directions, generate the versions you choose and review the results before launch.'),
              field('reviews/lead','Explore examples of how a product photo can guide a creator-style ad. Use your own product facts, then review the generated video before launch.'),
              field('reviews/items/0/d','A serum product photo can guide a presenter-style introduction focused on the bottle and visible details. Review the generated product details and spoken claims before posting.'),
              field('reviews/items/1/t','A Cozy Gift Ad Concept')]),
 dict(id='SEO-007',priority='P2',title='可量化销售效果写成结果，建议回到可观察产品用途',
      reason='Scroll-stopping等普通营销措辞不自动构成问题；但high-converting from day one与no delay更像不附条件的效果保证。本任务未提供转化实验或客户实绩，不据此断言违规。下列替换保留用途但不许诺成效。',
      evidence=['browser-readback.json'],
      fields=[field('audience/items/0/d','Create product-focused ads without arranging a traditional shoot. Prepare creative variations, review the generated details and test the content in your own campaigns.'),field('reviews/items/3/d','A sneaker product photo can guide a lifestyle ad concept with a presenter or product scene. Review the fit, shape and other generated details before using it in a campaign.')]),
 dict(id='SEO-008',priority='P2',title='Logo与自有字体的直接成片能力需要产品证据',
      reason='已检查当前TaskInput、主工作区以及render/editor，未找到选择品牌Logo、自有字体或end-card的直接生成控制。现有品牌资料管理和预设字幕字体并不等同该卡承诺。此项为能力待核实；若没有可演示入口，使用当前可验证审核能力替换。',
      evidence=['src/lib/aidreamcapes-workspace/types.ts:21','src/lib/aidreamcapes-workspace/media-render.ts','src/lib/aidreamcapes-workspace/editor.ts:405','src/components/aidreamcapes-workspace/team-brand-workbench.tsx'],
      fields=[field('trust/items/5/t','Review the Details Before Downloading'),field('trust/items/5/d','Check the generated product details, spoken words and supported captions before downloading the assembled video.')]),
 dict(id='SEO-009',priority='P2',title='三个步骤主要讲图片，标题容易被视频首页读者理解为全部流程',
      reason='当前Three Steps标题讲finished content；正文第二步明确image workspace，且只有第三步review/download。旁边详细6步视频说明是正确的，因此为可读性建议，不是SSR或内容缺失。可保留两套但明确图像/视频范围。',
      evidence=['browser-readback.json'],
      fields=[dict(owner='LivePage site_aidreamcapes_home.contentJson',path=base+'stepsH2',original='From Product Photo to Finished Content in Three Steps',observedInPublicHtml=True,suggestedEnglish='Create Product Images in Three Steps')]),
]

meta = lambda name, case=js: [m['content'] for m in case['metas'] if m['name']==name]
faq = next(n for n in js['jsonLd'][0]['@graph'] if n.get('@type')=='FAQPage')['mainEntity']
faq_equal = lambda case: all(any(q['name']==d['summary'] and q['acceptedAnswer']['text'] in d['text'] for d in case['details']) for q in faq)
module_assessment=[
 dict(kind='hero',judgment='通过',purpose='说明从自己的产品图和brief开始，预览与生成分开；4步路径包含draft、storyboard、shots、assemble和review。',cta='Start a product video →'),
 dict(kind='picker',judgment='通过',purpose='过滤/选择场景、查看创意方向，再进入带预填brief的workspace；不声称点击预览已生成用户作品。',cta='Use selected scene →'),
 dict(kind='steps',judgment='通过',purpose='介绍AI presenter例图，并明确实际presenter、voice、language以workspace为准；voice是信息详情而非假音频播放。',cta='Choose a presenter in the workspace →'),
 dict(kind='features',judgment='通过',purpose='明确interactive storyboard example、示例framing与真正production的边界，生成storyboard和refine shots在说明中可读。',cta='Start an editable video draft →'),
 dict(kind='audience',judgment='通过',purpose='准确对应共享scene/shared brief、命名1–10草稿、保存Library、逐个编辑后决定生成；明确saving不会生成视频或消耗generation credits。',cta='Create batch drafts with this brief →'),
 dict(kind='reviews',judgment='通过',purpose='介绍9:16 presenter visual、1:1 image、product-page imagery，清楚标记例图和review product details要求。',cta='Create with this format →'),
]

report = dict(
 title='真实公网首页 SEO 与用户文案独立审计（首版）',capturedAt=capture['capturedAt'],completedAt=datetime.now(timezone.utc).isoformat(),
 url=capture['target'],deployedShaProvided=capture['deployedShaProvided'],siteId='site_aidreamcapes',
 conclusion='技术索引基础通过；新六模块可理解且与工作流相符。旧功能卡和套餐仍有具体能力矛盾，另有Cloudflare引起的无JS邮箱不可读及hydration错误，不能把整页文案真实性判为通过。',
 scope='仅此首页和由其直接链接的62个公开站内页面HTTP读回；不是全站SEO、排名、转化率、法务或生成质量认证。未登录、未创建任务、未发起报价/生成/支付/订阅/客户写入。仅产生审计文件。',
 method='现有Node Playwright Chromium headless，proxy http://127.0.0.1:10904，1440×1000，en-US；JS开启和禁用两个独立上下文；均networkidle；另做CF邮件结构受控对照。Python Playwright未安装，使用仓库现有Node运行时。',
 provenance=dict(owner='Current relational LivePage.contentJson',homeId='site_aidreamcapes_home',
   sourceRevision='aidreamcapes-home-local-interactions-en',contentJsonAppliedHash='79d7d97cd40dd6591b7b62097fc96b7b218fb6d0724fff1e097aae2e0dfcdc77',
   evidence='../content-apply.json',limitation='本审计以真实公网HTML核查输出，并引用父任务content-apply的关系字段与hash证明；没有独立访问生产DB，也不能由浏览器证明derived-state revision/origin readback。该闭环由父任务负责。历史publications/snapshots未读取或激活。',
   fieldMapping='旧字段路径从同页现有结构映射，原文逐项与公网渲染复核；FAQ source graph[3]为FAQPage，而公网规范化graph[4]为FAQPage。任何后续写入都应再次按当前关系字段作冲突校验。'),
 checks=dict(
   status=dict(javascript=js['status'],noJavascript=nojs['status']),h1=[h for h in js['headings'] if h['tag']=='H1'],
   title=js['title'],description=meta('description')[0],canonical=js['canonical'],lang=js['lang'],
   headSocialConsistency=all(meta(n)==meta(k) for n,k in [('og:title','twitter:title'),('og:description','description'),('twitter:description','description'),('og:image','twitter:image')]) and meta('og:title')==[js['title']] and meta('og:url')==js['canonical'],
   javascriptVsNoJavascriptMetadataValuesEqual=sorted((m['name'],m['content']) for m in js['metas'])==sorted((m['name'],m['content']) for m in nojs['metas']),
   robotsMeta=meta('robots'),xRobotsTag=js['responseHeaders'].get('x-robots-tag'),robotsStatus=capture['/robots.txt']['status'],robotsRootAllowed=True,
   sitemapStatus=capture['/sitemap.xml']['status'],sitemapRootPresent='<loc>https://www.aivideosugc.com/</loc>' in capture['/sitemap.xml']['body'],
   noIndexBlockingObserved=False,actualGoogleIndexing='未查询Search Console/URL Inspection，不推断已被Google索引',
   jsonLdTypes=[n.get('@type') for n in js['jsonLd'][0]['@graph']],faqCount=len(faq),faqVisibleAndJsonLdExactInBothModes=faq_equal(js) and faq_equal(nojs),
   faqRichResult='Google当前官方说明：2026-05-07起停止FAQ富结果，2026-06-15删除文档。保留语义一致性不意味着富结果资格。',
   sixModulesSSR=[dict(kind=m['kind'],visible=m['visible'],textLength=len(m['text'])) for m in nojs['modules']],
   allSixModuleVisibleCopySameAcrossModes=[m['text'] for m in js['modules']]==[m['text'] for m in nojs['modules']],
   noJavascriptFAQNativeDetailsReadable=True,sourceLanguageEnglish=True,visibleCJK=js['chineseVisible']+nojs['chineseVisible'],
   allImagesHaveAltAttributes=all(i['alt'] is not None for i in js['images']),altAssessment='产品和presenter示例有描述性英文alt。品牌图/重复装饰缩略图使用空alt，不据此认定缺失。',
   htmlLinks=len(js['links']),missingEmptyOrJavascriptHref=sum(not l['href'] or l['href'].startswith('javascript:') for l in js['links']),
   linkReadback=dict(total=len(capture['publicLinkReadback']),publicPages200=sum(r.get('status')==200 for r in capture['publicLinkReadback']),errors=[r for r in capture['publicLinkReadback'] if r.get('status',0)>=400 or r.get('error')]),
   publicPageDataFetchRequests=[],observedBrowserXHR=js['publicDataRequests'],networkAssessment='只有Cloudflare /cdn-cgi/rum遥测POST；无copy/catalog/nav/SEO/media/customer runtime fetch/XHR/EventSource/_rsc/prefetch。无JS上下文无此类请求。',
   disabledPricingCopy=js['disabledButtons'],pricingAvailabilityDisclosure='Subscription checkout is not currently available.；disabled CTA符合当前配置，不记交互缺陷。',
   headingAssessment='唯一H1，主体模块使用H2，卡片H3。footer使用H4；不要求所有标题与title逐字相同。',
   publicCopyBoundary='新增六模块可见字符串为面向用户的示例、说明、动作标签；未发现任务说明/SEO策略/生成注释变成可见文案。',
 ),
 readability=dict(positioning='明确：从自有产品图/产品资料制作AI product videos、presenter introductions和product images。',
   audience='明确：电商品牌、小商家、dropshippers、agencies、creators、app/SaaS。Content Creators旧twin承诺需修。',
   workflow='新增四步概览与原详细六步能够解释draft→storyboard→generate shots→assemble/render→review/download；旧benefit/FAQ仍过度压缩。',
   value='清楚强调自己的产品参考、创意示例、可编辑草稿、分镜版本和预览检查，且Batch的保存与生成分界很好。',
   cta='动作具体、可爬取href存在；预览卡为本地展示，进入workspace的动作独立清楚。',
   comparison='当前10行比较表采用starting point/preparation/cost/version/review等事实维度，没有旧版绝对优越保证，符合操作流程。',
   density='桌面全文约3576英文词，full-page高度22114px；多个场景/流程模块有重复，可后续凭用户研究整理顺序。此数量本身不是Google惩罚或排名结论。',
   modules=module_assessment),
 findings=findings,
 googleSources=[
 dict(url='https://developers.google.com/search/docs/appearance/title-link',supports='描述性、简洁title和清楚的主标题；不以固定字符数判定成败。'),
 dict(url='https://developers.google.com/search/docs/appearance/snippet',supports='描述应准确概括页面；Google可能用正文生成snippet，不能保证展示给定description。'),
 dict(url='https://developers.google.com/search/docs/fundamentals/creating-helpful-content',supports='面向真实用户、完整有帮助并可核查的内容；不由措辞直接推断排名变化。'),
 dict(url='https://developers.google.com/search/docs/crawling-indexing/links-crawlable',supports='使用真实a href和描述性anchor text；本页links符合。'),
 dict(url='https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',supports='SSR把正文放进初始HTTP HTML，支持不能运行JS的机器人；本页初始响应满足核心内容读取。'),
 dict(url='https://developers.google.com/search/docs/appearance/structured-data/sd-policies',supports='结构化数据必须代表真实可读页面内容，不保证Search展示。'),
 dict(url='https://developers.google.com/search/updates',supports='May 8 2026记录FAQ富结果从May 7停止；June 15 2026记录文档移除。旧faqpage链接现重定向此页。'),
 ],
 evidenceFiles=['browser-readback.json','javascript-response.html','no-javascript-response.html','javascript-dom.html','no-javascript-dom.html','javascript-full.png','no-javascript-full.png','javascript-fold.png','no-javascript-fold.png','robots.txt','sitemap.xml','hydration-cf-control.json','hydration-restored-email-response.html'],
)
(DIR/'seo-copy-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))

e=lambda s: html.escape(str(s))
parts=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>首版公网首页SEO与文案审计</title><style>body{font:16px/1.7 system-ui;max-width:1100px;margin:40px auto;padding:0 24px;color:#20202b}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:12px;text-align:left;vertical-align:top}code{overflow-wrap:anywhere}blockquote{border-left:3px solid #aaa;padding-left:16px}img{max-width:100%}small{color:#555}</style><body>']
parts += [f'<h1>{e(report["title"])}</h1><p><strong>{e(report["conclusion"])}</strong></p><p>{e(report["scope"])}</p><p>目标：<a href="{e(report["url"])}">真实公网首页</a><br>SHA：<code>{e(report["deployedShaProvided"])}</code><br>取证：{e(report["capturedAt"])}</p>', '<h2>通过项</h2><ul>']
for text in ['JS/无JS均HTTP 200，唯一H1；title、description、canonical、OG、Twitter主题一致。','robots允许根页，sitemap包含正确canonical根页，未观察到noindex/X-Robots-Tag阻断。','六新增模块完整SSR，JS/无JS的模块可见文案一致；FAQ原生details可读，18组JSON-LD与可读问答逐字一致。','English原文、描述性alt及可爬取a href存在；62个真实公开站内页面链接HTTP 200。','未发现页面数据客户端fetch；观察到的XHR只有Cloudflare遥测。','价格checkout disabled及明确不可用说明符合配置，声音克隆FAQ也正确。']:
 parts.append('<li>'+e(text)+'</li>')
parts+=['</ul><h2>六模块可理解性</h2><table><tr><th>模块</th><th>判断</th></tr>']
for m in module_assessment: parts.append('<tr><td>'+e(m['kind'])+'</td><td>'+e(m['purpose'])+'<br><strong>'+e(m['cta'])+'</strong></td></tr>')
parts+=['</table><h2>需要决策的修正</h2>']
for f in findings:
 parts.append(f'<article><h3>{e(f["priority"])} · {e(f["id"])} · {e(f["title"])}</h3><p>{e(f["reason"])}</p>')
 for x in f['fields']:
  parts.append(f'<p><small>{e(x["owner"])}</small><br><code>{e(x["path"])}</code></p><blockquote>{e(x["original"])}</blockquote><p><strong>建议英文：</strong>{e(x["suggestedEnglish"])}</p>')
 if f.get('recommendation'): parts.append('<p>'+e(f['recommendation'])+'</p>')
 parts.append('<p><small>证据：'+e(', '.join(f['evidence']))+'</small></p></article>')
parts+=['<h2>边界与来源</h2><p>本报告为首版观察，不自动修改、同步或发布任何关系字段。SEO建议不能保证排名、收录、富结果或转化率。FAQ富结果已从2026-05-07停止展示。</p><ul>']
for s in report['googleSources']: parts.append(f'<li><a href="{e(s["url"])}">{e(s["url"])}</a> — {e(s["supports"])}</li>')
parts+=['</ul><p>'+e(report['provenance']['limitation'])+'</p><p><a href="seo-copy-audit.json">完整JSON报告</a> · <a href="browser-readback.json">原始浏览器证据</a> · <a href="hydration-cf-control.json">Cloudflare对照证据</a></p><h2>无JS真实截图</h2><img src="no-javascript-fold.png" alt="无JavaScript真实首页首屏"><img src="no-javascript-module-audience.png" alt="无JavaScript下Batch Drafts模块"><img src="no-javascript-module-features.png" alt="无JavaScript下Storybord示例模块"></body></html>']
(DIR/'seo-copy-audit.html').write_text('\n'.join(parts))
print(json.dumps(dict(findings=len(findings),fieldRecommendations=sum(len(f['fields']) for f in findings),unobservedFields=[x['path'] for f in findings for x in f['fields'] if not x.get('observedInPublicHtml')],checks=report['checks']['linkReadback']),ensure_ascii=False))
