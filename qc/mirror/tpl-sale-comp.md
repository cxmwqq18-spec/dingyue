# tpl-sale — competitor mirror

主竞品：Tagshop templates gallery（`raw/comp-b99b6d032753.html`；结构数据 `ts-templates.json`）

|顺序|类型|竞品原文|字符数|
|---:|---|---|---:|
|1|H1|See It. Recreate It. Launch It. — Find a style you love and recreate it with your own product. No prompts required – just select a template, add your product, and generate content in minutes. — 链接：Try Now；Book Demo|214|
|2|H2|Brands are Switching to AI Video Ads — The video you created for us truly exceeded our expectations - it's fantastic!；Seamless AI UGC video and image generation tool；Best image to Product holding video generator for me；Avatar looks realistic. Helpful to generate high-quality ai ugc videos.；Multi-lingual features in the tool are pretty amazing.；Time Saving and Affordable Tool；AI influencer becomes easy to create with Tagshop AI；We have successfully reduced our shooting time after using Tagshop AI.；For us, Tagshop AI is the fastest way to create high-converting ugc video ads；UGC style video ads become easy through the AI video agent workflow. — 链接：G2；Trustpilot|667|
|3|H2|Frequently Asked Questions — The video you created for us truly exceeded our expectations - it's fantastic!；Seamless AI UGC video and image generation tool；Best image to Product holding video generator for me；Avatar looks realistic. Helpful to generate high-quality ai ugc videos.；Multi-lingual features in the tool are pretty amazing.；Time Saving and Affordable Tool；AI influencer becomes easy to create with Tagshop AI；We have successfully reduced our shooting time after using Tagshop AI.；For us, Tagshop AI is the fastest way to create high-converting ugc video ads；UGC style video ads become easy through the AI video agent workflow. — 链接：Try Now；Book Demo；G2；Trustpilot；Create Your First Video|699|

## 我们的处理

|竞品区块（原文标题）|我们对应区块|处理|
|---|---|---|
|See It. Recreate It. Launch It.|首屏＋maker|照写结构，保留本页产品事实|
|Brands are Switching to AI Video Ads|strip／examples|保留产品案例图；不编客户评价|
|Frequently Asked Questions|FAQ|保留卖家问题，答案写 AIVideosUGC 真实能力|
|模板画廊筛选|visual.picker|本页无可对齐竞品卡图，清空并列待补场景|
|三步|visual.steps|保留并改为三句简洁公开文案|

## 舍弃的区块

删除旧的长篇操作指南、场景配方、上传／成品／下载后说明和自造场景筛选；`visual.uses`、`visual.input`、`visual.outputs` 设为空数组，`visual.after` 设为 null，依赖主控组件守卫。

## 场景对照

|竞品场景名|我们的卡（图 ref）|图对不对得上|
|---|---|---|
|Tagshop 19 类筛选（All、Indoor、Home、Outdoor、Living Room、Studio、Office、Garden、Gym、Cafe、Kitchen、Podcast、Fitness、Beach、Car、Hospital、Balcony、Pet、Shop）|—|本页现有图片未逐一对齐，已清空 picker；待补以上竞品场景|

## 交回检查

- overlap.py：对照 HTML `raw/comp-b99b6d032753.html`，本页 PASS。
- 生成视频暂缓；未新增图片。
