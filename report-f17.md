# f17 交回

## 交回

本轮接续并保留此前 f17 改动，完成 `ind-home-living` 与 `ind-jewelry-accessories` 两页的具体正文、FAQ、相关公开页内链和场景卡补充；未新增页面区块，未生成视频。按主控最新 D 节，图片与内链不硬凑：每个 picker chip 均达到至少 3 张，剩余图片/内链差额在各页记分卡说明。

### 生成并登记的图片

| 页面 | ref | 用途与画面 | 尺寸 | 英文 alt | public/media-new SHA（原图） |
|---|---|---|---|---|---|
| ind-home-living | `n:guide:f17-home-vacuum-demo` | before/after：成年手用无线吸尘器清理深色沙发碎屑 | 1024×1024；640/1280 | Adult hand using a compact cordless vacuum to clear crumbs from a charcoal sofa. | `f89ad1c30926a4144db9cb1037dc73732fd2815ab01378c58019d64c44b3c56b` |
| ind-home-living | `n:guide:f17-home-pet-roller-review` | creator：短发成年黑人男性用滚毛器清理沙发，保留干净条带 | 1024×1024；640/1280 | Adult Black man using a plain pet-hair roller on a charcoal sofa with a clean strip visible. | `5e1d4bd82dfbe442ffd0495d224a3f5ce9783d4e1f8a778b6fb0529776faebce` |
| ind-home-living | `n:guide:f17-home-output-fern-planter` | H1：手触碰同款蕨类盆栽，16:9 成品帧 | 1536×864；640×360/1280×720 | Adult hand touching a fern in the same muted sage planter on a styled wooden shelf. | `33bb68556a00288b48a6c8b6814e41d493bf6a1202a811f54f28411f084f5e2f` |
| ind-jewelry-accessories | `n:guide:f17-jewelry-wrist-cuff-tryon` | worn：无脸手腕佩戴素银色手镯，避免与页面女性同脸 | 1024×1024；640/1280 | Adult wrist wearing a plain brushed silver cuff over a charcoal knit sleeve. | `12d682e517488b079ce0f166dffbc4cefc1f36f9454ab4d16f9b995f6476cd4a` |
| ind-jewelry-accessories | `n:guide:f17-jewelry-output-watch-caseback` | J2/o1：成年手持与 input[1] 同款棕色表带、银色表壳背面手表 | 1024×1024；640/1280 | Adult hand holding the same matte analog watch to show its brushed caseback on a walnut desk. | `a00b4535e995fd49c57a80540ad911f6085e0bc94610fcd488c6b156c0ec50f4` |

五组图片的 public 与 `/Users/cxm/orca/workspaces/aivideosugc-work/media-new` 三档变体逐一核对 SHA 相同；图片未进 git。

### 第九节记分卡：ind-home-living

页面 `ind-home-living`  摘要：AI home product videos／家居卖家想展示清洁、收纳和摆放后的真实房间效果／本页给场景选择、三步案例、视频格式与投放用途。

案例链 S=R=提示词   **PASS**（`/tmp/f17-case-1.jpg`；逐格看图，S=R、g=b、o0/o1 产品分别对应输入组、after 为同页产品）
上传示范 g=b         **PASS**（pillow 与 planter 两组各自同款，bad 只改变模糊/裁切）
成品 o_i=g_i         **PASS**（o0 为 ivory/sage pillow；o1 已替换为 input[1] 同款 sage planter/fern）
场景/主题/真实投放   **PASS**（cleaning、pet-care、room styling、storage；每张 picker 图与标题/提示词一致）
脸≤2 产品≤2 无大牌   **PASS**（最新主控规则同脸≤2；新增男性 creator，未见品牌标志或大牌外形）
文案数字一致无套话   **PASS**（新增 3 ideas、2 FAQ 均是具体动作/容量/镜头做法）
SEO（第六节 1–8）    **PASS**（页面专属 title/H1/首段、FAQ JSON-LD、canonical/indexable 保持；新增链接均为 canonical 公开页）
对标（第七节）       区块：竞品有我有 场景卡/三步/示例/FAQ/相关链接；竞品有我缺 评价墙、客户 logo、真实统计（无真实数据，不加）；我有竞品无 无。数量：picker 8→13（目标 chip 逻辑优先），FAQ 4→6，独有字数 348→约 562（目标 460）；内链 65→约 70（目标 101，差额原因：只保留相关 canonical 公开页，本站可链页不足）；图片 57→62（目标 68，差额原因：竞品图片计数含图标/logo/界面截图，按 D 节不生成填充图）。
机械（val/基线/aspect/中文/非本人页/R） **PASS（目标页 validator 0；复用基线 0；aspect 0；`git diff --check` 通过；仅改 Aidreamcapes 文件；R 未写）**

### 第九节记分卡：ind-jewelry-accessories

页面 `ind-jewelry-accessories`  摘要：AI jewelry and accessory photos／珠宝卖家想让顾客看清佩戴比例、扣件和材质／本页给微距、佩戴、礼盒和日常携带场景。

案例链 S=R=提示词   **PASS**（`/tmp/f17-case-1.jpg`；逐格看图，S=R、g=b、o0/o1 产品分别对应输入组、after 为同页产品）
上传示范 g=b         **PASS**（ring setting 与 watch/caseback 两组各自同款，bad 只改变模糊/裁切）
成品 o_i=g_i         **PASS**（o0 为 solitaire ring；o1 J2 已换为 input[1] 同款棕色表带银色表壳背面手表）
场景/主题/真实投放   **PASS**（worn、close、gift、daily 四个 chip；每张 picker 图与标题/提示词一致）
脸≤2 产品≤2 无大牌   **PASS**（最新主控规则同脸≤2；strip sunglasses 与 daily tote 至多两次同脸，其余为无脸手/侧脸/静物；无品牌标志）
文案数字一致无套话   **PASS**（新增 3 ideas、2 FAQ，包含扣件、尺寸参照、画幅和礼盒动作）
SEO（第六节 1–8）    **PASS**（页面专属 title/H1/首段、FAQ JSON-LD、canonical/indexable 保持；新增链接均为 canonical 公开页）
对标（第七节）       区块：竞品有我有 微距/佩戴/礼盒/三步/示例/FAQ/相关链接；竞品有我缺 评价墙、客户 logo、真实统计（无真实数据，不加）；我有竞品无 无。数量：picker 8→12（四 chip 各 3），FAQ 4→6，独有字数 373→约 580（目标 460）；内链 65→约 70（目标 101，差额原因：只保留相关 canonical 公开页，本站可链页不足）；图片 56→60（目标 68，差额原因：竞品图片计数含图标/logo/界面截图，按 D 节不生成填充图）。
机械（val/基线/aspect/中文/非本人页/R） **PASS（目标页 validator 0；复用基线 0；aspect 0；`git diff --check` 通过；仅改 Aidreamcapes 文件；R 未写）**

### 校验与提交

- `nice -n 10 node /Users/cxm/orca/workspaces/aivideosugc-work/tools-main/rel/val.mjs /Users/cxm/orca/workspaces/aivideosugc-work/f17 /tmp/f17-val.json`：目标两页无错误；全局仅有既有 `ind-beauty-skincare`、`ind-fashion-clothing` 缺少 f4 图片的 2 条错误，未越界修改。
- `node dumpvis.mjs ind-home-living ind-jewelry-accessories` + `python3 aspect.py /tmp/vis-f17.json --all`：`问题 0 条`。
- `casecheck.sh ... ind-home-living ind-jewelry-accessories`：2 页 1 张拼图；已用 `view_image` 逐格看 `/tmp/f17-case-1.jpg`。
- `git diff --check`：通过；提交后 worktree clean。
- 页面提交：`b530f6e76 fix(f17): enrich home living industry page`、`a4c780ff0 fix(f17): enrich jewelry accessories industry page`。
