# GPT10 全链接深度审计

检查时间：2026-08-17T15:57:41.425Z（原始 UTC；报告解释以 Asia/Shanghai 审计日为准）
范围：9 个页面 DOM 中全部 1,179 个 `a[href]` 出现记录；73 个去除 fragment 后的 HTTP(S) 网络目标；72 个同页 fragment；1 个跨页 fragment；9 次同一 mailto。所有折叠菜单链接也纳入，因为用户展开菜单后可访问。

## 结论

- 73/73 个去重 HTTP(S) 目标在审计时返回 200；无 4xx/5xx、TLS 错误或超时。72/72 个目录锚点 ID 存在；mailto 语法有效。状态正常不代表链接语义正常。
- P0 语义错链：Magic Upscaler → Photo Enhancer、Nature → Travel、Outdoor Creator Scenes → Urban；均可达但实体不一致。
- P0 目的页问题：Profile Cards URL 的 Title/H1/主体仍是 Avatar；AI Video Generation 目标页的 H1 是 Paid AI photo tools。
- P1 全局结构：38 个 `/ai-image-generation/*` package 目标页全部无 H1；16 个站内 Footer 目标被加 `nofollow`。
- P1 登录路径：`/app/create#step-video` 在未登录时到 login，fragment 留在登录页但 `next` 仅为 `/app/create`；登录后的 video step 无法公开确认。
- P1 Trust：5 个社交锚文本声称 for myDreamshoots，落地品牌却是 BLYDEY/BLYDEYUS；About/Contact 没有解释两者关系。
- P0 事实口径：About 的 `100% money-back guarantee / If the shoot doesn't look like you, refund.` 比 Refund Policy 更绝对；后者要求 review，且补救可能是 refund、credit return 或 rerun。About 建议改为：`If a completed shoot does not resemble you, submit the affected job for review under our Refund Policy. Eligible requests may receive a refund, returned credits, or a rerun.`

## 全部网络目标

| # | 目标 | 出现页 / 区域 | 锚文本 | 次数 | HTTP / 最终结果 | 评估 |
|---:|---|---|---|---:|---|---|
| 1 | [/](https://www.mydreamshoots.com/) | 1-9 / header | myᕲreamshoots myDreamshoots myDreamshoots AI shoot packages, creator portraits, headshots, fan photos, and private albums | 9 | 200 direct | PASS：品牌首页锚文本可识别，200 直达。 |
| 2 | [/ai-image-generation/engagement-photo](https://www.mydreamshoots.com/ai-image-generation/engagement-photo) | 1-9 / header | Engagement Photo | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 3 | [/ai-image-generation/wedding-photo](https://www.mydreamshoots.com/ai-image-generation/wedding-photo) | 1-9 / header | Wedding Photo / Open Wedding Photo theme | 19 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 4 | [/ai-image-generation/valentines-photo](https://www.mydreamshoots.com/ai-image-generation/valentines-photo) | 1-9 / header | Valentines Photo / Open Valentines Photo theme | 19 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 5 | [/ai-image-generation/christmas-photo](https://www.mydreamshoots.com/ai-image-generation/christmas-photo) | 1-9 / header | Christmas Photo | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 6 | [/ai-image-generation/halloween-photo](https://www.mydreamshoots.com/ai-image-generation/halloween-photo) | 1-9 / header | Halloween Photo | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 7 | [/ai-image-generation/thanksgiving-photo](https://www.mydreamshoots.com/ai-image-generation/thanksgiving-photo) | 1-9 / header | Thanksgiving Photo | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 8 | [/ai-image-generation/hairstyle-generator](https://www.mydreamshoots.com/ai-image-generation/hairstyle-generator) | 1-9 / header | Hairstyle Generator | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 9 | [/ai-image-generation/virtual-try-on](https://www.mydreamshoots.com/ai-image-generation/virtual-try-on) | 1-9 / header | Virtual Try On / Open Virtual Try-On theme | 19 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 10 | [/ai-image-generation/motion-generator](https://www.mydreamshoots.com/ai-image-generation/motion-generator) | 1-9 / header | Motion Generator | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 11 | [/ai-image-generation/avatar](https://www.mydreamshoots.com/ai-image-generation/avatar) | 1-9 / header | Avatar | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 12 | [/ai-image-generation/headshot](https://www.mydreamshoots.com/ai-image-generation/headshot) | 1-9 / header+article | Headshot / Headshot Photo Package | 27 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 13 | [/ai-image-generation/gala-photo](https://www.mydreamshoots.com/ai-image-generation/gala-photo) | 1-9 / header | Gala Photo | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 14 | [/ai-image-generation/portrait-photo](https://www.mydreamshoots.com/ai-image-generation/portrait-photo) | 1-9 / header | Portrait Photo | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 15 | [/ai-image-generation/black-friday](https://www.mydreamshoots.com/ai-image-generation/black-friday) | 1-9 / header | Black Friday | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 16 | [/ai-image-generation/only-fans](https://www.mydreamshoots.com/ai-image-generation/only-fans) | 1-9 / header | Only Fans | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 17 | [/ai-image-generation/singles-awareness-day](https://www.mydreamshoots.com/ai-image-generation/singles-awareness-day) | 1-9 / header | Singles Awareness Day | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 18 | [/ai-image-generation/background-changer](https://www.mydreamshoots.com/ai-image-generation/background-changer) | 1-9 / header | Background Changer | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 19 | [/ai-image-generation/background-remover](https://www.mydreamshoots.com/ai-image-generation/background-remover) | 1-9 / header | Background Remover | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 20 | [/ai-image-generation/magic-eraser](https://www.mydreamshoots.com/ai-image-generation/magic-eraser) | 1-9 / header | Magic Eraser | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 21 | [/ai-image-generation/photo-enhancer](https://www.mydreamshoots.com/ai-image-generation/photo-enhancer) | 1-9 / header | Photo Enhancer / Open Magic Upscaler theme | 19 | 200 direct | P0：Header 的 Photo Enhancer 正确；URL 3 Hero 却写 Open Magic Upscaler，产品实体不一致。目标页无 H1。 |
| 22 | [/ai-image-generation/portrait-retouch](https://www.mydreamshoots.com/ai-image-generation/portrait-retouch) | 1-9 / header | Portrait Retouch | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 23 | [/ai-image-generation/unblur-image](https://www.mydreamshoots.com/ai-image-generation/unblur-image) | 1-9 / header | Unblur Image | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 24 | [/ai-image-generation/color-correction](https://www.mydreamshoots.com/ai-image-generation/color-correction) | 1-9 / header | Color Correction | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 25 | [/ai-image-generation/old-photo-restoration](https://www.mydreamshoots.com/ai-image-generation/old-photo-restoration) | 1-9 / header | Old Photo Restoration | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 26 | [/ai-image-generation/edit-by-prompt](https://www.mydreamshoots.com/ai-image-generation/edit-by-prompt) | 1-9 / header | Edit By Prompt | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 27 | [/ai-image-generation/cyberpunk](https://www.mydreamshoots.com/ai-image-generation/cyberpunk) | 1-9 / header | Cyberpunk / Open Cyberpunk theme | 19 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 28 | [/ai-image-generation/boudoir](https://www.mydreamshoots.com/ai-image-generation/boudoir) | 1-9 / header | Boudoir | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 29 | [/ai-image-generation/holiday](https://www.mydreamshoots.com/ai-image-generation/holiday) | 1-9 / header | Holiday | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 30 | [/ai-image-generation/cannes](https://www.mydreamshoots.com/ai-image-generation/cannes) | 1-9 / header | Cannes | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 31 | [/ai-image-generation/nightlife](https://www.mydreamshoots.com/ai-image-generation/nightlife) | 1-9 / header | Nightlife | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 32 | [/ai-image-generation/rich-lifestyle](https://www.mydreamshoots.com/ai-image-generation/rich-lifestyle) | 1-9 / header | Rich Lifestyle | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 33 | [/ai-image-generation/bikini](https://www.mydreamshoots.com/ai-image-generation/bikini) | 1-9 / header | Bikini | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 34 | [/ai-image-generation/swimsuit](https://www.mydreamshoots.com/ai-image-generation/swimsuit) | 1-9 / header | Swimsuit | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 35 | [/ai-image-generation/travel](https://www.mydreamshoots.com/ai-image-generation/travel) | 1-9 / header | Travel / Open Nature theme | 19 | 200 direct | P0：Header 的 Travel 正确；URL 4 Hero 写 Open Nature theme，未解释 Nature 是 Travel 方向。目标页无 H1。 |
| 36 | [/ai-image-generation/soccer](https://www.mydreamshoots.com/ai-image-generation/soccer) | 1-9 / header | Soccer / Open Soccer theme | 19 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 37 | [/ai-image-generation/urban](https://www.mydreamshoots.com/ai-image-generation/urban) | 1-9 / header | Urban / Open Outdoor Creator Scenes theme | 19 | 200 direct | P0：Header 的 Urban 正确；URL 5 Hero 写 Open Outdoor Creator Scenes theme，但目标只覆盖 Urban，未覆盖 Hero 的海岸/悬崖。目标页无 H1。 |
| 38 | [/ai-image-generation/street-style](https://www.mydreamshoots.com/ai-image-generation/street-style) | 1-9 / header | Street Style | 18 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 39 | [/ai-image-generation/mafia](https://www.mydreamshoots.com/ai-image-generation/mafia) | 1-9 / header | Mafia / Open Mafia theme | 19 | 200 direct | P1：锚文本与产品 Title 一致，200 直达；但目标页主内容从 H2 开始、无 H1（38 个 package 目标的共同问题）。 |
| 40 | [/ai-image-generation](https://www.mydreamshoots.com/ai-image-generation) | 1-9 / header+footer | View all packages / AI Image Generation | 27 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 41 | [/app/create](https://www.mydreamshoots.com/app/create) | 1-9 / header | Text to video / Image to Video / Workspace / Create my first photo set | 81 | 200 → https://www.mydreamshoots.com/login?next=%2Fapp%2Fcreate | P1：未登录会到 /login?next=/app/create（200、noindex）。Text to video / Image to Video 的 #step-video 留在登录页 fragment，next 参数未保留该步骤；登录后的落点无法从公开访问确认。 |
| 42 | [/best-packages](https://www.mydreamshoots.com/best-packages) | 1-9 / header+footer | Best Packages | 27 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 43 | [/workflow](https://www.mydreamshoots.com/workflow) | 1-9 / header+footer | How it works | 27 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 44 | [/blog](https://www.mydreamshoots.com/blog) | 1-9 / header+footer | Blog | 27 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 45 | [/pricing](https://www.mydreamshoots.com/pricing) | 1-9 / header+footer | Pricing | 27 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 46 | [/blog/cyberpunk-photo-package-guide](https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide) | 1 / article | When Cyberpunk is the right fit / What to prepare before choosing it / How to compare Cyberpunk with nearby choices / Credit and private gallery planning / Details to review before download / Mistakes to avoid / A planning pass before you spend credits / Cyberpunk FAQ | 8 | 200 direct | PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。 |
| 47 | [/blog/ai-video-add-ons-photo-package-guide](https://www.mydreamshoots.com/blog/ai-video-add-ons-photo-package-guide) | 1-9 / article | Open AI Video Add-ons theme | 9 | 200 direct | P1：200，但 9 个主题页全部使用同一 Open AI Video Add-ons theme；与大多数页面关系弱，且目标自身是同类模板文。应按主题选择相关文章。 |
| 48 | [/blog/anime-avatar-photo-package-guide](https://www.mydreamshoots.com/blog/anime-avatar-photo-package-guide) | 1-9 / article | Open Avatar theme | 9 | 200 direct | P1：200；URL 暗示 Anime Avatar，Title/H1 只写 Avatar，锚文本也过泛；与 Profile Cards 目标近重复。 |
| 49 | [/blog/profile-cards-photo-package-guide](https://www.mydreamshoots.com/blog/profile-cards-photo-package-guide) | 1-9 / article | Open Avatar theme | 9 | 200 direct | P0：200 但 Title/H1 均为 Avatar，正文仍是 Avatar 模板；锚文本 Open Avatar theme 不能描述 Profile Cards。应独立重写或 301 合并，不能保持两个 self-canonical 近重复页。 |
| 50 | [/ai-video-generation](https://www.mydreamshoots.com/ai-video-generation) | 1-9 / footer | AI Video Generation | 9 | 200 direct | P0：锚文本和 Title 是 AI Video Generation，但 H1 是 Paid AI photo tools for better source images，首屏实体/意图错误；页脚还加了内部 nofollow。 |
| 51 | [/about-us](https://www.mydreamshoots.com/about-us) | 1-9 / footer | About us | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 52 | [/contact-us](https://www.mydreamshoots.com/contact-us) | 1-9 / footer | Contact us | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 53 | [/creators-circle](https://www.mydreamshoots.com/creators-circle) | 1-9 / footer | Creators Circle | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 54 | [/refunds](https://www.mydreamshoots.com/refunds) | 1-9 / footer | Refund Policy | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 55 | [/privacy](https://www.mydreamshoots.com/privacy) | 1-9 / footer | Privacy Policy | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 56 | [/content](https://www.mydreamshoots.com/content) | 1-9 / footer | Content policy | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 57 | [/terms](https://www.mydreamshoots.com/terms) | 1-9 / footer | Terms of Service | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 58 | [/cookies](https://www.mydreamshoots.com/cookies) | 1-9 / footer | Cookie Policy | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 59 | [www.instagram.com/blydey_inc](https://www.instagram.com/blydey_inc) | 1-9 / footer | Instagram for myDreamshoots | 9 | 200 direct | P1：200，平台正确；目的品牌是 BLYDEY INC，不是 myDreamshoots。外链 nofollow/noopener/noreferrer 合理，但需公开解释品牌关系或更换账号。 |
| 60 | [www.facebook.com/blydeyinc](https://www.facebook.com/blydeyinc) | 1-9 / footer | Facebook for myDreamshoots | 9 | 200 direct | P1：200，平台正确；目的品牌是 Blydeyus INC，不是 myDreamshoots。需解释关系或更换账号。 |
| 61 | [www.threads.com/@blydey_inc](https://www.threads.com/@blydey_inc) | 1-9 / footer | Threads for myDreamshoots | 9 | 200 direct | P1：200，平台正确；目的品牌是 BLYDEY INC，不是 myDreamshoots。需解释关系或更换账号。 |
| 62 | [www.pinterest.com/Blydeyinc](https://www.pinterest.com/Blydeyinc) | 1-9 / footer | Pinterest for myDreamshoots | 9 | 200 → https://www.pinterest.com/Blydeyinc/ | P1：200，规范化补 /；目的品牌是 BLYDEYUS，不是 myDreamshoots。需解释关系或更换账号。 |
| 63 | [www.youtube.com/@blydey-inc](https://www.youtube.com/@blydey-inc) | 1-9 / footer | YouTube for myDreamshoots | 9 | 200 direct | P1：200；目的频道名 blydey 且当前公开页面显示无内容，不足以支持 YouTube for myDreamshoots。需解释关系、更新频道或移除。 |
| 64 | [/children-privacy](https://www.mydreamshoots.com/children-privacy) | 1-9 / footer | KIDS Act | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 65 | [/state-privacy](https://www.mydreamshoots.com/state-privacy) | 1-9 / footer | DPDPA | 9 | 200 direct | P1：200 且锚文本/目标基本一致；Footer 对站内正常导航使用 nofollow 不合理，应移除（外部社交链接可保留 nofollow）。 |
| 66 | [/blog/mafia-photo-package-guide](https://www.mydreamshoots.com/blog/mafia-photo-package-guide) | 2 / article | When Mafia is the right fit / What to prepare before choosing it / How to compare Mafia with nearby choices / Credit and private gallery planning / Details to review before download / Mistakes to avoid / A planning pass before you spend credits / Mafia FAQ | 8 | 200 direct | PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。 |
| 67 | [/blog/magic-upscaler-photo-package-guide](https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide) | 3 / article | When Magic Upscaler is the right fit / What to prepare before choosing it / How to compare Magic Upscaler with nearby choices / Credit and private gallery planning / Details to review before download / Mistakes to avoid / A planning pass before you spend credits / Magic Upscaler FAQ | 8 | 200 direct | PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。 |
| 68 | [/blog/nature-photo-package-guide](https://www.mydreamshoots.com/blog/nature-photo-package-guide) | 4 / article | When Nature is the right fit / What to prepare before choosing it / How to compare Nature with nearby choices / Credit and private gallery planning / Details to review before download / Mistakes to avoid / A planning pass before you spend credits / Nature FAQ | 8 | 200 direct | PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。 |
| 69 | [/blog/outdoor-creator-scenes-photo-package-guide](https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide) | 5 / article | When Outdoor Creator Scenes is the right fit / What to prepare before choosing it / How to compare Outdoor Creator Scenes with nearby choices / Credit and private gallery planning / Details to review before download / Mistakes to avoid / A planning pass before you spend credits / Outdoor Creator Scenes FAQ | 8 | 200 direct | PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。 |
| 70 | [/blog/valentine-photos-photo-package-guide](https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide) | 6 / article | When Valentines Photo is the right fit / What to prepare before choosing it / How to compare Valentines Photo with nearby choices / Credit and private gallery planning / Details to review before download / Mistakes to avoid / A planning pass before you spend credits / Valentines Photo FAQ | 8 | 200 direct | PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。 |
| 71 | [/blog/virtual-try-on-photo-package-guide](https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide) | 7 / article | When Virtual Try-On is the right fit / What to prepare before choosing it / How to compare Virtual Try-On with nearby choices / Credit and private gallery planning / Details to review before download / Mistakes to avoid / A planning pass before you spend credits / Virtual Try-On FAQ | 8 | 200 direct | PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。 |
| 72 | [/blog/wedding-portraits-photo-package-guide](https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide) | 8 / article | When Wedding Photo is the right fit / What to prepare before choosing it / How to compare Wedding Photo with nearby choices / Credit and private gallery planning / Details to review before download / Mistakes to avoid / A planning pass before you spend credits / Wedding Photo FAQ | 8 | 200 direct | PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。 |
| 73 | [/blog/world-cup-fan-photos-photo-package-guide](https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide) | 9 / article | When Soccer is the right fit / What to prepare before choosing it / How to compare Soccer with nearby choices / Credit and private gallery planning / Details to review before download / Mistakes to avoid / A planning pass before you spend credits / Soccer FAQ | 8 | 200 direct | PASS（链接层）：本页 8 个目录 fragment 均命中；内容质量问题见对应逐页审计。 |

## 72 个目录锚点

| # | 页 | 锚文本 | 精确目标 | ID 存在 |
|---:|---:|---|---|---|
| 1 | 1 | When Cyberpunk is the right fit | https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide#cyberpunk-photo-package-guide-fit | PASS |
| 2 | 1 | What to prepare before choosing it | https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide#cyberpunk-photo-package-guide-source | PASS |
| 3 | 1 | How to compare Cyberpunk with nearby choices | https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide#cyberpunk-photo-package-guide-compare | PASS |
| 4 | 1 | Credit and private gallery planning | https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide#cyberpunk-photo-package-guide-credits | PASS |
| 5 | 1 | Details to review before download | https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide#cyberpunk-photo-package-guide-review | PASS |
| 6 | 1 | Mistakes to avoid | https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide#cyberpunk-photo-package-guide-avoid | PASS |
| 7 | 1 | A planning pass before you spend credits | https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide#cyberpunk-photo-package-guide-planning-pass | PASS |
| 8 | 1 | Cyberpunk FAQ | https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide#cyberpunk-photo-package-guide-faq | PASS |
| 9 | 2 | When Mafia is the right fit | https://www.mydreamshoots.com/blog/mafia-photo-package-guide#mafia-photo-package-guide-fit | PASS |
| 10 | 2 | What to prepare before choosing it | https://www.mydreamshoots.com/blog/mafia-photo-package-guide#mafia-photo-package-guide-source | PASS |
| 11 | 2 | How to compare Mafia with nearby choices | https://www.mydreamshoots.com/blog/mafia-photo-package-guide#mafia-photo-package-guide-compare | PASS |
| 12 | 2 | Credit and private gallery planning | https://www.mydreamshoots.com/blog/mafia-photo-package-guide#mafia-photo-package-guide-credits | PASS |
| 13 | 2 | Details to review before download | https://www.mydreamshoots.com/blog/mafia-photo-package-guide#mafia-photo-package-guide-review | PASS |
| 14 | 2 | Mistakes to avoid | https://www.mydreamshoots.com/blog/mafia-photo-package-guide#mafia-photo-package-guide-avoid | PASS |
| 15 | 2 | A planning pass before you spend credits | https://www.mydreamshoots.com/blog/mafia-photo-package-guide#mafia-photo-package-guide-planning-pass | PASS |
| 16 | 2 | Mafia FAQ | https://www.mydreamshoots.com/blog/mafia-photo-package-guide#mafia-photo-package-guide-faq | PASS |
| 17 | 3 | When Magic Upscaler is the right fit | https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide#magic-upscaler-photo-package-guide-fit | PASS |
| 18 | 3 | What to prepare before choosing it | https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide#magic-upscaler-photo-package-guide-source | PASS |
| 19 | 3 | How to compare Magic Upscaler with nearby choices | https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide#magic-upscaler-photo-package-guide-compare | PASS |
| 20 | 3 | Credit and private gallery planning | https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide#magic-upscaler-photo-package-guide-credits | PASS |
| 21 | 3 | Details to review before download | https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide#magic-upscaler-photo-package-guide-review | PASS |
| 22 | 3 | Mistakes to avoid | https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide#magic-upscaler-photo-package-guide-avoid | PASS |
| 23 | 3 | A planning pass before you spend credits | https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide#magic-upscaler-photo-package-guide-planning-pass | PASS |
| 24 | 3 | Magic Upscaler FAQ | https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide#magic-upscaler-photo-package-guide-faq | PASS |
| 25 | 4 | When Nature is the right fit | https://www.mydreamshoots.com/blog/nature-photo-package-guide#nature-photo-package-guide-fit | PASS |
| 26 | 4 | What to prepare before choosing it | https://www.mydreamshoots.com/blog/nature-photo-package-guide#nature-photo-package-guide-source | PASS |
| 27 | 4 | How to compare Nature with nearby choices | https://www.mydreamshoots.com/blog/nature-photo-package-guide#nature-photo-package-guide-compare | PASS |
| 28 | 4 | Credit and private gallery planning | https://www.mydreamshoots.com/blog/nature-photo-package-guide#nature-photo-package-guide-credits | PASS |
| 29 | 4 | Details to review before download | https://www.mydreamshoots.com/blog/nature-photo-package-guide#nature-photo-package-guide-review | PASS |
| 30 | 4 | Mistakes to avoid | https://www.mydreamshoots.com/blog/nature-photo-package-guide#nature-photo-package-guide-avoid | PASS |
| 31 | 4 | A planning pass before you spend credits | https://www.mydreamshoots.com/blog/nature-photo-package-guide#nature-photo-package-guide-planning-pass | PASS |
| 32 | 4 | Nature FAQ | https://www.mydreamshoots.com/blog/nature-photo-package-guide#nature-photo-package-guide-faq | PASS |
| 33 | 5 | When Outdoor Creator Scenes is the right fit | https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide#outdoor-creator-scenes-photo-package-guide-fit | PASS |
| 34 | 5 | What to prepare before choosing it | https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide#outdoor-creator-scenes-photo-package-guide-source | PASS |
| 35 | 5 | How to compare Outdoor Creator Scenes with nearby choices | https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide#outdoor-creator-scenes-photo-package-guide-compare | PASS |
| 36 | 5 | Credit and private gallery planning | https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide#outdoor-creator-scenes-photo-package-guide-credits | PASS |
| 37 | 5 | Details to review before download | https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide#outdoor-creator-scenes-photo-package-guide-review | PASS |
| 38 | 5 | Mistakes to avoid | https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide#outdoor-creator-scenes-photo-package-guide-avoid | PASS |
| 39 | 5 | A planning pass before you spend credits | https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide#outdoor-creator-scenes-photo-package-guide-planning-pass | PASS |
| 40 | 5 | Outdoor Creator Scenes FAQ | https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide#outdoor-creator-scenes-photo-package-guide-faq | PASS |
| 41 | 6 | When Valentines Photo is the right fit | https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide#valentine-photos-photo-package-guide-fit | PASS |
| 42 | 6 | What to prepare before choosing it | https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide#valentine-photos-photo-package-guide-source | PASS |
| 43 | 6 | How to compare Valentines Photo with nearby choices | https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide#valentine-photos-photo-package-guide-compare | PASS |
| 44 | 6 | Credit and private gallery planning | https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide#valentine-photos-photo-package-guide-credits | PASS |
| 45 | 6 | Details to review before download | https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide#valentine-photos-photo-package-guide-review | PASS |
| 46 | 6 | Mistakes to avoid | https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide#valentine-photos-photo-package-guide-avoid | PASS |
| 47 | 6 | A planning pass before you spend credits | https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide#valentine-photos-photo-package-guide-planning-pass | PASS |
| 48 | 6 | Valentines Photo FAQ | https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide#valentine-photos-photo-package-guide-faq | PASS |
| 49 | 7 | When Virtual Try-On is the right fit | https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide#virtual-try-on-photo-package-guide-fit | PASS |
| 50 | 7 | What to prepare before choosing it | https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide#virtual-try-on-photo-package-guide-source | PASS |
| 51 | 7 | How to compare Virtual Try-On with nearby choices | https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide#virtual-try-on-photo-package-guide-compare | PASS |
| 52 | 7 | Credit and private gallery planning | https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide#virtual-try-on-photo-package-guide-credits | PASS |
| 53 | 7 | Details to review before download | https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide#virtual-try-on-photo-package-guide-review | PASS |
| 54 | 7 | Mistakes to avoid | https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide#virtual-try-on-photo-package-guide-avoid | PASS |
| 55 | 7 | A planning pass before you spend credits | https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide#virtual-try-on-photo-package-guide-planning-pass | PASS |
| 56 | 7 | Virtual Try-On FAQ | https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide#virtual-try-on-photo-package-guide-faq | PASS |
| 57 | 8 | When Wedding Photo is the right fit | https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide#wedding-portraits-photo-package-guide-fit | PASS |
| 58 | 8 | What to prepare before choosing it | https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide#wedding-portraits-photo-package-guide-source | PASS |
| 59 | 8 | How to compare Wedding Photo with nearby choices | https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide#wedding-portraits-photo-package-guide-compare | PASS |
| 60 | 8 | Credit and private gallery planning | https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide#wedding-portraits-photo-package-guide-credits | PASS |
| 61 | 8 | Details to review before download | https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide#wedding-portraits-photo-package-guide-review | PASS |
| 62 | 8 | Mistakes to avoid | https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide#wedding-portraits-photo-package-guide-avoid | PASS |
| 63 | 8 | A planning pass before you spend credits | https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide#wedding-portraits-photo-package-guide-planning-pass | PASS |
| 64 | 8 | Wedding Photo FAQ | https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide#wedding-portraits-photo-package-guide-faq | PASS |
| 65 | 9 | When Soccer is the right fit | https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide#world-cup-fan-photos-photo-package-guide-fit | PASS |
| 66 | 9 | What to prepare before choosing it | https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide#world-cup-fan-photos-photo-package-guide-source | PASS |
| 67 | 9 | How to compare Soccer with nearby choices | https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide#world-cup-fan-photos-photo-package-guide-compare | PASS |
| 68 | 9 | Credit and private gallery planning | https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide#world-cup-fan-photos-photo-package-guide-credits | PASS |
| 69 | 9 | Details to review before download | https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide#world-cup-fan-photos-photo-package-guide-review | PASS |
| 70 | 9 | Mistakes to avoid | https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide#world-cup-fan-photos-photo-package-guide-avoid | PASS |
| 71 | 9 | A planning pass before you spend credits | https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide#world-cup-fan-photos-photo-package-guide-planning-pass | PASS |
| 72 | 9 | Soccer FAQ | https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide#world-cup-fan-photos-photo-package-guide-faq | PASS |

## 其他协议与 fragment

- `mailto:support@mydreamshoots.com`：9 页各 1 次，语法有效；未发送测试邮件，因此邮箱投递能力无法从本次公开访问确认。
- `https://www.mydreamshoots.com/app/create#step-video`：9 页各有 Text to video 与 Image to Video，共 18 次。未登录最终为 `https://www.mydreamshoots.com/login?next=%2Fapp%2Fcreate#step-video`；`next` 丢失 step 信息。建议使用能被登录回跳完整保留的 query/route 状态，并以登录 E2E 测试验证。

## 链接层整改顺序

1. 先修 3 条 Hero 实体错链及 Profile Cards/AI Video 两个目的页错误。既要改锚文本，也要改实体、Title/H1、canonical/redirect 策略，不能只做表面文字替换。
2. 删除正常站内 Footer 导航的 `nofollow`；保留外部社交的 `nofollow noopener noreferrer`。
3. 给 38 个 package 目标页的可见主标题使用 H1，后续分区继续使用 H2/H3。不是追求‘恰好一个 H1’的机械规则，而是修复当前主标题从 H2 开始的语义层级。
4. 用每页真正相邻的产品/指南替换统一的 Headshot + AI Video Add-ons + 两条 Avatar 推荐；锚文本写目的页准确标题。
5. 披露真实运营主体与 BLYDEY/BLYDEYUS 社交账号的关系；若无关系或账号不再代表产品，则更换/移除链接。
6. 让 About、Refund、Privacy、Terms 的承诺从同一政策数据源/组件渲染；后台训练、删除、加密执行仍需内部证据与供应商核验，公开页面本身不能证明。
