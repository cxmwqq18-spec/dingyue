# occ-sale-discount — competitor mirror

主竞品：Photoroom Instagram Sales Post（`raw2/comp2-c3a254fa3f9f.html`；结构数据 `photoroom_templates_instagramposts_salep.json`）

|顺序|类型|竞品原文|字符数|
|---:|---|---|---:|
|1|H1|Instagram Sales Post — 链接：Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template|235|
|2|H2|Explore our free tools — See all tools — Mastering Instagram Sales Posts；Start selling at first sight；Explore our apps — 链接：Pricing；Log in；Contact sales；Start creating；Templates；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template；Open template|387|

## 我们的处理

|竞品区块（原文标题）|我们对应区块|处理|
|---|---|---|
|H1 首屏|首屏＋maker|照写结果式结构，换成产品事实|
|功能／价值块|benefits|照写结果和场景，不写竞品没有的功能|
|流程|visual.steps|保留三步，第二步只留一句场景描述|
|图片／案例|visual.strip＋examples|保留真实产品案例图|
|FAQ|faq|保留 6 条卖家问题，答案写真实情况|

## 舍弃的区块

删除旧的长篇操作指南、场景配方、上传／成品／下载后说明和自造场景筛选；`visual.uses`、`visual.input`、`visual.outputs` 设为空数组，`visual.after` 设为 null，依赖主控组件守卫。

## 场景对照

|竞品场景名|我们的卡（图 ref）|图对不对得上|
|---|---|---|
|主竞品无本页场景筛选|—|不适用；待补场景：无|

## 交回检查

- overlap.py：对照 HTML `raw2/comp2-c3a254fa3f9f.html`，本页 PASS。
- 生成视频暂缓；未新增图片。
