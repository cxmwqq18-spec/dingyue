# AIVideosUGC 工作台模块隔离与控件整改（2026-10-21）

## 背景

用户在生产工作台（www.aivideosugc.com/app/create/*）反馈了 4 个界面问题，外加 1 条产品口径：

1. 在“人工智能图像”模块里，仍然显示着刚才在“人工智能视频”模块选的**视频模版**（截图：模版条目标题为“帆布手提袋产品详情”、徽标为“视频模版”、还带“视频场景 产品特写”）。
2. “选择产品模版”弹窗里同时出现照片模版和视频模版（全部 / 视频 / 照片 + 所有类别 / 照片模版 / 视频模版），两个模块共用同一批模版内容。
3. 模型、比例、时长等下拉框是系统原生 `select`，弹层样式不可控、观感差。
4. 产品口径：视频只支持 **15 秒和 30 秒** 两档。

公共侧的入口链路（案例卡 → 工作台 URL → 案例参数）已单独审计，见《AIVideosUGC 公共案例卡 → 工作台入口链路审计（2026-10-21）》，结论为通过。

## 改动清单

改动全部落在 Aidreamcapes 工作台私有代码内（`src/components/aidreamcapes-workspace/`、`src/lib/aidreamcapes-workspace/`），没有触碰 MyDreamShoots，也没有写入任何站点内容。

### 1. 模版按模块隔离（问题 1）

- `workspace.tsx`：把单一的 `activePreset` 状态改为**按模版种类分别保存**的 `presets: { photo?, video? }`；当前模块决定可见模版：
  - 图像模块（`/app/create/ai-image-generation`、首页的 “AI Image” 标签）只看 `photo` 模版；
  - 视频模块（首页 / 人工智能视频 / 文生视频）只看 `video` 模版。
- 模版条（`data-testid="workspace-template"`）只在模版种类与模块一致时渲染，因此视频模版不会再出现在图像模块里；两个模块各自保留自己的模版，来回切换互不污染。
- “移除模版”按钮只清除当前模版所属种类的模版，不影响另一个模块。

### 2. 模版库按模块收敛（问题 2）

- 模版弹窗去掉了跨模版的“全部 / 视频 / 照片”切换，改成显示当前模块的模版范围（“照片模版” / “视频模版”）。
- 列表只渲染当前模块种类的模版；分类筛选也只列当前模块的分类；切模块时若旧分类不适用会自动复位。
- 交接参数里带 `kind` 的入口（例如 `/app/create/templates?kind=photo`）改为直接打开对应模块，而不是在同一个弹窗里混排两种模版。

### 3. 下拉框重做（问题 3）

- 新增 `src/components/aidreamcapes-workspace/workspace-select.tsx` + `workspace-select.module.css`：自绘下拉（触发按钮 + portal 菜单），保留原生控件的键盘与读屏契约：
  - `role="combobox"` + `role="listbox"` / `role="option"`、`aria-expanded`、`aria-activedescendant`、`aria-selected`；
  - 键盘：`Enter/Space` 打开、`↑/↓` 移动、`Home/End` 跳到首尾、`Esc` 关闭、字母快速定位；点击外部或滚动/缩放自动关闭或重新定位；
  - 菜单使用 `position: fixed` 并向上/向下自动翻转，保证始终在视口内（不会被 composer 的圆角裁剪）；
  - 主题变量从触发按钮实时复制到 portal 根节点，深色模式保持一致。
- 替换范围：composer 的 5 个控件（模型 / 比例 / 时长、风格 / 比例）、模版条的“视频场景”、以及草稿编辑器“视频设置”里的模型 / 时长 / 比例 / 风格 / 语言。演员表单与分镜层的原生 `select` 本次未改（见待办）。
- 触发按钮带 `data-value`，自动化用例可以直接断言当前值。

### 4. 时长只有 15s / 30s（问题 4）

- `catalogs.ts` 新增 `WORKSPACE_VIDEO_DURATIONS = [15, 30]`：这是工作台**对外售卖**的两档时长；`WORKSPACE_DURATIONS` 保留为合法值集合（历史草稿仍可读）。
- `capabilities.ts`：
  - 模型能力里的时长改为“该模型能服务的工作台档位”——模型只要能产出 15 秒分镜，就同时服务 15 秒和 30 秒两档（30 秒 = 两段 15 秒分镜）；
  - `workspaceOutputOptions()` 只输出这两个档位。
- `handoff.ts` 的时长白名单收敛为 15 / 30；`provider.ts` 的档位与积分映射同步为 15 秒 = 60 积分、30 秒 = 120 积分。
- 结果：生产模型能力原本是 6/10/15 秒，现在对外只呈现 **15 秒 / 30 秒**两档；只能产出 6/10 秒的模型不再出现在可选时长里（它无法满足 15 秒分镜）。

## 验证

| 检查 | 结果 |
|---|---|
| `tsc --project tsconfig.typecheck.json --noEmit` | 通过 |
| `eslint`（改动文件） | 0 error（仅存量 `no-img-element` 警告） |
| `smoke-capabilities.mjs` | 通过（已按新时长契约更新断言） |
| `smoke-home-composer.mjs` | 通过（已改为加载新的下拉组件并断言 `combobox` 角色） |
| `smoke-dom-translation.mjs` | 通过（改用“点击 + 选择选项”驱动新的下拉） |
| `smoke-navigation.mjs`（本地 3015 dev server） | 通过：12 项导航/创作模块检查，含新下拉的风格与比例选择 |
| `smoke-workspace-modules-browser.mjs`（新增） | 通过：模块隔离、模版库范围、15/30 两档、无原生 `select` |
| `audit-workspace-entry-transfer.mjs`（本地 3015） | 通过：278 张卡，0 失败 |
| `audit-workspace-entry-transfer.mjs`（生产） | 通过：278 张卡，0 失败 |

新增的 `scripts/aidreamcapes-workspace/smoke-workspace-modules-browser.mjs` 用 webpack 挂载真实工作台组件（fixture 数据、无 DB / 无 provider），逐条断言：

1. 视频模块的模版库只出现视频模版，选中后模版条显示 “Video template”；
2. 切到图像模块时视频模版条**不出现**，模版库只出现照片模版，选中后显示 “Image template”；
3. 切回视频模块仍显示自己那份视频模版（两模块互不污染）；
4. 时长下拉只有 `15s`、`30s` 两个选项；
5. composer 内不再渲染任何原生 `select`。

## 待办（本次未做，需要单独确认）

1. **公共文案与新时长口径不一致**：门店页面与 FAQ 仍写 “6, 10, 15, or 30 seconds”（`scripts/data/aidreamcapes-site-v2/content/*.json` 等）。这属于公共内容，需要按字段级 compare-and-set manifest 修改，本次未动。
2. **剩余原生下拉**：演员创建表单（性别 / 年龄）、分镜参考图选择、创作者设置里的模型 / 画幅 / 时长仍是原生 `select`。
3. **30 秒档位的真实生成链路**：工作台按“两段 15 秒分镜”实现；上游 provider 若能直接产出 30 秒单片，可在平台 provider 配置里补齐后由能力映射自动识别。

## 部署记录

见本文末尾的《部署与生产验收》一节（部署后补写）。
