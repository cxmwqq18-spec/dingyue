from pathlib import Path
from html import escape as e
import json
R=Path(__file__).parent
D=json.loads((R/'design-content.json').read_text())
css='''*{box-sizing:border-box}body{margin:0;background:#f5f5f8;color:#212131;font:15px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1180px;padding:48px 32px;margin:auto}h1{font-size:34px;line-height:1.3;letter-spacing:-1px}h2{font-size:24px;margin:0 0 16px}h3{font-size:18px;margin:18px 0 8px}p{margin:10px 0;color:#5a596b}a{color:#6c40de;text-underline-offset:4px}section{background:white;padding:30px;border:1px solid #e5e3eb;border-radius:16px;margin-top:24px}.tag{font-size:12px;letter-spacing:2px;color:#7651cf}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.grid>article{min-width:0}.shot{display:block;border:1px solid #e4e0ed;border-radius:10px;overflow:hidden;margin:16px 0}.shot img{width:100%;display:block}.links{display:flex;gap:16px;flex-wrap:wrap}.button{display:inline-block;background:#7047eb;color:white;padding:10px 16px;border-radius:8px;text-decoration:none}.note{background:#f4f0ff;padding:15px 18px;border-radius:10px}.table{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px;text-align:left}th,td{padding:13px 15px;border:1px solid #e9e6ef;vertical-align:top}th{background:#f8f6fd}code{font-size:12px;overflow-wrap:anywhere;background:#f4f1fa;padding:2px 5px}li{margin:8px 0}.muted{font-size:12px;color:#777}.path{word-break:break-all}details{border-top:1px solid #eee;padding:10px 0}summary{cursor:pointer;font-weight:600}@media(max-width:720px){main{padding:28px 16px}.grid{grid-template-columns:1fr}section{padding:20px}h1{font-size:28px}}'''
parts=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AIVideosUGC · AI 图片详情页 UI 评审</title><style>'+css+'</style><main><div class="tag">AIVIDEOSUGC · UI DESIGN · 2026.10.16</div><h1>AI 图片详情页 · 新版 UI 设计</h1><p>两套场景，共用一套设计语言：黑色品牌导航、白色内容区、紫色操作按钮、真实商品案例、居中的板块标题。</p><p class="note">本次交付为独立设计稿和交互预览。网站代码、线上内容及数据库均未更新。页面使用英文正式文案，中文说明集中在本评审页。</p><section><h2>01 / 先看设计图</h2><div class="grid">']
for k,d in D.items():
 n=d['file'];label=d['h1cn']
 parts.append(f'<article><h3>{e(label)}</h3><p class="muted">{e(d["path"])}</p><a class="shot" href="{n}-desktop.png"><img src="{n}-hero-desktop.png" alt="{e(label)}桌面端首屏设计"></a><div class="links"><a class="button" href="{n}-preview.html">打开可点击页面</a><a href="{n}-desktop.png">桌面完整长图</a><a href="{n}-mobile.png">手机完整长图</a></div></article>')
parts.append('</div><p>预览中的生成按钮会进入真实网站工作台；进入工作台本身不会自动生成或扣费。设计图中的比较、筛选、预览和问答可在本地预览操作。</p></section><section><h2>02 / 页面内容与阅读顺序</h2><div class="table"><table><tr><th>页面</th><th>面向用户的说明</th><th>页面结构</th></tr>')
parts.append('<tr><td>白底商品图</td><td>先看商品原图与白底效果，再选择白底方向和比例。解释商品展示用途，提醒核对细节，并展示使用步骤。</td><td>首屏与操作入口 → 案例 → 白底展示价值 → 三步制作 → 网店/产品目录/平台商品图 → FAQ → 相关工具 → 制作入口</td></tr><tr><td>社交广告图片</td><td>明确生成的是静态图片，以商品照片为参考选择展示场景。展示场景案例、图片比例，并说明广告标题与价格在下载后添加。</td><td>首屏与操作入口 → 场景筛选 → 使用场景价值 → 三步制作 → 图片比例 → FAQ → 相关工具 → 制作入口</td></tr></table></div></section><section><h2>03 / 核心文案 · 中英文对照</h2>')
for k,d in D.items():
 parts.append('<h3>'+e(d['h1cn'])+'</h3><div class="table"><table><tr><th>位置</th><th>英文页面文案</th><th>中文释义</th></tr>')
 for a,b,c in [('主标题',d['h1'].replace('<br>',' '),d['h1cn']),('首屏说明',d['lead'],d['leadcn']),('主按钮',d['button'],'制作我的商品图' if k=='ecommerce' else '制作我的广告图片')]:
  parts.append(f'<tr><td>{a}</td><td>{e(b)}</td><td>{e(c)}</td></tr>')
 parts.append('<tr><td>费用说明</td><td>See your credit cost in the workspace before generating.</td><td>生成前，在工作台查看本次任务所需积分。</td></tr></table></div>')
parts.append('</section><section><h2>04 / 交互、内链与外链定义</h2><div class="table"><table><tr><th>入口 / 操作</th><th>行为与目标</th><th>状态与边界</th></tr>')
rows=[
('Logo、面包屑','Logo 和 Home → /；Product Photos → /ai-image-generation；当前页面仅显示名称。','同标签页跳转，保留网站导航。'),
('顶部导航','Video、Photo、Templates、Resources 展开对应站内链接；Pricing → /pricing。','移动端折叠为菜单。菜单内容均为站内已有目录、指南或工具链接。'),
('Upload a product photo','进入 /app/create 图片工作台，携带当前页面的工具、比例与场景提示。','公开页不直接上传；进入工作台后选择文件。JPG、PNG、WebP 提示为已支持文件类型。'),
('首屏选择器','白底页：Pure white / White + shadow；广告页：Bright cafe / Home interior / Outdoor / Studio。比例：1:1、9:16、16:9。','改变选择同步更新通用制作入口，进入工作台后仍可调整；不发起生成。'),
('主按钮、顶部 Get started、吸顶制作按钮、底部 CTA','同标签页进入图片工作台，携带工具与当前首屏选择。','不直接调用生成 API，不在公开页扣费。'),
('原图 / 效果对比','白底页可拖动分割线；键盘左右键也能调整。','仅改变本地展示，不承诺生成结果与原图完全一致。'),
('Examples / How it works / Use cases 或 Formats / FAQs','滚动至本页对应区块。','桌面端吸顶；手机端横向滚动，不遮挡标题。'),
('场景筛选','All scenes / Product focus / Everyday use 筛选当前已渲染案例。','本地展示行为，无内容请求或数据库查询。'),
('案例图片与 Preview','打开大图弹窗，可查看前后案例；左右键切换、Escape 或关闭按钮退出。','关闭后焦点返回原按钮；弹窗中的使用按钮对应正在查看的案例。'),
('Use this style','白底页按案例带入 white-background 工具与具体提示。','用自己的商品上传制作，不将演示商品图当成用户素材。'),
('Use this scene','广告页携带当前案例 source + preset 进入工作台。','两项必须成对；最终落地使用当前关系数据中的案例 ID，禁止旧快照回填。'),
('比例展示与 Story 链接','展示 1:1、9:16、16:9 对应方向；Story Images → /ai-image-generation/story-ad-vertical。','不宣称自动发布到 Instagram / Facebook，也不把静态图称为 Reels 视频。'),
('FAQ','点击展开答案；支持键盘操作。费用回答引导 Pricing。','完整问题和答案随 HTML 输出，折叠不改变内容数据来源。'),
('相关工具','链接白底图、场景图、换背景、UGC 静态图及 Story 图等对应详情页。','同标签页；两张详情页互链。具体目标见下方链接清单。'),
('官方指南外链','白底页 → Google 商品图片规范；广告页 → Meta 图片广告指南。','新标签页，显示外链图标，rel=noopener noreferrer；Meta 可能要求登录。'),
('Log in、页脚','Log in → /login?next=目标工作台；页脚 → 图片目录、Pricing、Contact、Privacy、Terms。','登录完成返回当前任务入口。不得将本地预览地址作为 next。')]
for row in rows: parts.append('<tr>'+''.join('<td>'+e(s)+'</td>' for s in row)+'</tr>')
parts.append('</table></div><h3>工作台参数与登录流程</h3><p>白底页使用 <code>view=images&amp;tool_id=image_generator&amp;tool=white-background</code>；广告页使用 <code>view=images&amp;tool_id=image_generator&amp;tool=lifestyle-photos</code>。配合合法 <code>aspect</code> 和 URL 编码后的 <code>prompt</code>。不使用不受支持的 social-ad-photos 或 4:5 参数。</p><ol><li>访客直接看到完整图片工作台，可以了解设置与制作流程。</li><li>保存任务或开始生成时，按现有工作台登录要求引导登录；登录返回原工作台入口。</li><li>沿用现有访客草稿恢复机制：同一浏览器会话内有效期 30 分钟，使用 resumeDraft=1 恢复。工具选择和提示可以恢复，图片须通过登录账户的所有权校验；必要时提示重新上传。</li><li>生成前显示当前费用报价，用户确认后才提交。执行中显示任务状态；失败给出重试入口；成功后预览并下载。</li><li>不把访客文件、用户私有图片 URL 或账号信息拼入公开页面 URL；URL 只携带任务选项。</li></ol>')
for k,d in D.items():
 parts.append('<details><summary>'+e(d['h1cn'])+'：制作入口与案例链接</summary><p class="path"><a href="https://www.aivideosugc.com'+e(d['workspace'])+'">'+e('https://www.aivideosugc.com'+d['workspace'])+'</a></p><ul>')
 for item in d['gallery']: parts.append('<li><a class="path" href="https://www.aivideosugc.com'+e(item['href'])+'">'+e(item['title'])+'</a><br><code>'+e(item['href'])+'</code></li>')
 parts.append('</ul></details>')
parts.append('<h3>相关页面与外链清单</h3><ul>')
seen=set()
for d in D.values():
 for title,href,*_ in d['related']:
  if href in seen:continue
  seen.add(href);parts.append('<li><a href="https://www.aivideosugc.com'+href+'">'+e(title)+'</a> · <code>'+href+'</code></li>')
parts.append('<li><a target="_blank" rel="noopener noreferrer" href="https://support.google.com/merchants/answer/6324350?hl=en">Google 商品图片规范 ↗</a></li><li><a target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/business/ads-guide/image">Meta 图片广告指南 ↗</a></li></ul></section><section><h2>05 / SEO 与落地约束</h2><p>两个页面分别服务于白底商品图与社交广告图片需求，主标题直接说明工具与用途，正文解释输入、输出、步骤及费用查看位置。避免重复堆词、编造评价或承诺广告转化率。</p>')
for d in D.values():
 parts.append('<h3>'+e(d['h1cn'])+'</h3><p><b>Title：</b>'+e(d['title'])+'</p><p><b>Description：</b>'+e(d['description'])+'</p><p><b>Canonical：</b><code>https://www.aivideosugc.com'+d['path']+'</code></p>')
parts.append('<ul><li>每页只保留一个 H1，各板块用 H2，卡片用 H3；图片 Alt 描述实际商品与场景，正式页面不显示设计说明或 SEO 策略。</li><li>保持原有详情页 URL。导航与相关工具使用可抓取的标准链接；不产生带筛选参数的新索引页。</li><li>落地时，所有公开标题、正文、FAQ、案例、导航、元数据均从 site_aidreamcapes 的 LivePage.contentJson 读取并完整 SSR。页面浏览不通过客户端内容 API 补齐。</li><li>JavaScript 仅处理比较、筛选、弹窗、选项和菜单等展示行为。正文、案例及核心制作入口在禁用 JavaScript 时仍可阅读和访问。</li><li>首屏主图明确尺寸并优先加载，下面图片按需加载；保留真实品牌图标和当前商品案例。检查图片与商品细节，不承诺像素级保真。</li><li>如添加结构化数据，只使用当前真实可核实的页面信息，不编造评分、价格、Offer 或销量；FAQ 的可读内容不等于保证搜索结果出现富媒体展示。</li><li>独立评审稿设置 noindex；该设置仅用于预览，不能照搬到正式可索引详情页。</li><li>此次不调整 MyDreamShoots、共享模板或线上数据。正式实现需遵守仓库的 SSR、关系数据归属和增量发布规则。</li></ul></section><section><h2>06 / 手机端与设计参考</h2><p>桌面设计宽度 1440px，内容最大 1200px；手机设计宽度 390px。手机端首屏、图文板块和步骤纵向排列；案例双列；按钮保持清晰可点击，制作入口贯穿页面。</p><div class="links"><a href="ecommerce-main-image-mobile.png">白底页 · 手机长图</a><a href="feed-ad-still-mobile.png">广告页 · 手机长图</a></div><p>参考页面仅用于版式研究；正式站内不会增加竞品外链。</p><ul>')
for href,label in [('https://www.ugcvideo.ai/ai-product-ad-generator','UGCVideo · AI Product Ad Generator'),('https://www.ugcvideo.ai/instagram-ad-maker','UGCVideo · Instagram Ad Maker'),('https://www.ugcvideo.ai/ai-fashion-model-generator','UGCVideo · AI Fashion Model Generator'),('https://developers.google.com/search/docs/fundamentals/creating-helpful-content','Google · Creating helpful, reliable, people-first content')]:
 parts.append('<li><a target="_blank" rel="noopener noreferrer" href="'+href+'">'+label+' ↗</a></li>')
parts.append('</ul><p class="muted">设计图与 HTML 预览中的图片为网站现有案例；当前案例参数需在正式落地时从现行关系数据重新读取。视觉提案不代表生产功能已经上线。</p></section></main></html>')
(R/'review.html').write_text(''.join(parts))
print('Created review.html')
