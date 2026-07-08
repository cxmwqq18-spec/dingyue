# 店铺上线检查清单

适用店铺：

- AIdreamcapes
- MyDreamShoots

## 1. TDK 检查

上线前需要确认两个店铺的 `title`、`description`、`keywords` 已维护成功，并且线上页面源代码中展示的内容与下方一致。

### AIdreamcapes

- [ ] `title` 正确：
  `AIdreamcapes – the most advanced AI photo generator  maker`
- [ ] `description` 正确：
  `Transform your favorite moments into professional-grade photos and stunning memories with AIdreamcapes. Choose any setting, outfit, or vibe – all from home.`
- [ ] `keywords` 正确：
  `Dream Photos,Dream Photoshoot,Wedding Photoshoot,Wedding Photos,AI Photos,AI Photoshoot,Couple Photos`

### MyDreamShoots

- [ ] `title` 正确：
  `Professional AI Photo Generator Online - MyDreamShoots`
- [ ] `description` 正确：
  `Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator  maker. No studio, no outfits, just magic.`
- [ ] `keywords` 正确：
  `Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot`

检查方式：

1. 打开店铺首页。
2. 查看页面源代码。
3. 搜索 `<title>`、`name="description"`、`name="keywords"`。
4. 对照本清单逐项确认。

## 2. Title 位置检查

上线前需要确认 `<title>` 位于 `<head>` 内，并且位置靠前。

- [ ] 页面源代码中存在 `<head>`。
- [ ] `<title>` 出现在 `<head>` 之后。
- [ ] `<title>` 位于主要资源加载标签之前，例如大量 `preload`、`script`、`stylesheet` 之前。
- [ ] `description`、`keywords`、canonical、OG/Twitter 等 SEO 标签也在 `<head>` 内。

建议检查方式：

1. 打开页面源代码。
2. 从顶部开始查看 `<head>`。
3. 确认 `<title>` 紧跟在基础 head 元素后方，不能被渲染到 `<body>` 中。

## 3. 图片和艺术字 Alt 检查

上线前需要确认店铺图片、Logo、艺术字、图标型品牌内容具备可访问名称。

- [ ] 首页 Logo 图片有 `alt`，或父级链接有明确 `aria-label` / `title`。
- [ ] 艺术字品牌展示不影响可访问名称，例如视觉上显示 `myᕲreamshoots` 时，辅助信息仍能表达 `MyDreamShoots`。
- [ ] 主要内容图片有描述性 `alt`。
- [ ] 纯装饰图片可以使用空 `alt=""`，但不能影响关键信息理解。
- [ ] 生成图、套餐图、工具图等用户需要理解的图片，`alt` 不应为空。

### 店铺标题艺术字记录

上线前 Header / Footer 的视觉品牌标题必须与已批准艺术字一致，同时 `aria-label`、`alt`、`title`、SEO、JSON-LD 等可访问或结构化名称继续使用普通品牌名。

- MyDreamShoots：视觉展示 `myᕲreamshoots`；可访问 / SEO 名称使用 `MyDreamShoots`。
- AIdreamcapes：视觉展示 `ልiጋreamርapes`；可访问 / SEO 名称使用 `Aidreamcapes`。

建议检查重点：

- Header Logo
- Footer Logo
- Hero 区主视觉图片
- 套餐/工具卡片图片
- 生成结果图片
- 艺术字品牌元素

## 4. 店铺语言检查

上线前需要确认两个店铺的客户可见内容没有出现不应该出现的其他语言。

- [ ] AIdreamcapes 前台客户可见页面内容为英文。
- [ ] MyDreamShoots 前台客户可见页面内容为英文。
- [ ] Header、Footer、按钮、表单、弹窗、错误提示均无中文或其他非预期语言。
- [ ] 套餐页、工具页、价格页、FAQ、登录页、工作区页面均无其他语言混入。
- [ ] SEO 文案、OG 文案、结构化数据中的可见品牌描述无其他语言混入。

建议检查页面：

- 首页
- Pricing
- FAQ / Help
- Login / Register / Reset Password
- Account
- App Workspace
- Packages / Collections
- Tools
- Package detail pages
- Tool detail pages
- Footer policy pages

## 上线前确认记录

| 检查项 | AIdreamcapes | MyDreamShoots | 备注 |
| --- | --- | --- | --- |
| TDK 已正确维护 | [ ] | [ ] |  |
| `<title>` 位于 `<head>` 靠前位置 | [ ] | [ ] |  |
| 图片和艺术字有可访问名称 / alt | [ ] | [ ] |  |
| 前台无其他语言混入 | [ ] | [ ] |  |
| 主要页面已抽查 | [ ] | [ ] |  |
