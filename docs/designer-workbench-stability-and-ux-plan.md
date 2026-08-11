# 店铺装修异常修复与工作台可用性升级记录

## 背景

装修器此前同时使用新版 Tailwind 布局和旧 XFCart CSS 类名。旧规则固定了顶部按钮、右侧面板和 Tab 的宽高，造成按钮文案遮挡、点击区域错位、右侧属性面板过窄。

后台异常还存在两个用户侧问题：

- 数据库 schema 缺少 `CreativePack.galleryImageAlts` 时，服务端直接抛 Prisma 错误。
- 页面异常没有稳定的错误兜底，用户只能看到 Next.js 红屏或泛化的 `network error`。

## 根因与修复

### 数据库字段

`CreativePack.galleryImageAlts` 已加入 Prisma schema，并通过：

```sql
ALTER TABLE "CreativePack" ADD COLUMN IF NOT EXISTS "galleryImageAlts" JSONB;
```

正式 migration 补齐。部署环境应执行 `npx prisma migrate deploy`，不要只依赖本地 `db push`。

### 工作台布局

- 顶部改成独立的命令栏，分为查看、编辑、发布、退出。
- 装修器导航压缩为常用入口，主题库和前台入口移入命令栏。
- 右侧面板改为可用宽度，结构树和属性编辑改成上下工作区。
- 新组件使用 `designer-*` 命名空间，不再复用旧 `.header_a5ed`、`.wrapper_right`、`.tools_tab` 等布局类。
- 移动端隐藏中间预览，右侧面板改为全宽编辑工作区。

### 重复交互

- 移除 `DesignerModeTabs` 的原生 click 监听，只保留 React `onClick`。
- 教程按钮只保留单一点击入口。
- 保存、回滚和发布流程增加忙碌锁，重复点击不会重复提交完整操作批次。

### iframe 预览

有 `data-theme-sections-root` 就代表预览容器已准备好，即使页面主体模块数量为 0，也不能判定为失败。自动恢复最多执行一次，之后交给用户手动重试，避免循环刷新和 aborted request。

## 发布数据边界

- 保存草稿：写入 `ThemePage.draftJson`、`ThemeSettings.draftJson`，不会上线。
- 发布整站快照：把当前页面、隐藏草稿页和全局设置一起写入线上快照。
- 代码部署：更新 renderer 和交互逻辑，不自动覆盖数据库已发布文案。
- 409：页面草稿版本、全局设置版本或线上版本变化时拒绝静默覆盖。

## 自动化验收

运行：

```bash
npm run typecheck
npm run lint
npm run smoke:designer-workbench-agent
```

测试智能体会：

1. 克隆 `site_dreamshoot` 到 `designer-smoke-*` 沙盒。
2. 登录沙盒后台。
3. 检查后台首页和装修器是否出现 pageerror、console error、network error、4xx/5xx。
4. 检查桌面与移动端布局、按钮文案、右侧面板宽度。
5. 重复点击 Tab、教程和保存按钮，确认没有重复 mutation。
6. 打开发布确认，确认范围、隐藏草稿和线上版本展示完整。
7. 成功后删除沙盒；失败时保留 slug 供排查。

报告目录：

```text
output/designer-workbench-agent/report.md
output/designer-workbench-agent/report.json
output/designer-workbench-agent/*.png
```

## 验收标准

- 后台和装修器异常显示可操作错误页，不显示 Next.js 红色错误层。
- 顶部按钮在 1366px、1600px 桌面宽度下不遮挡、不裁切。
- 右侧属性面板宽度至少 420px，字段文本可读。
- 三个工作台 Tab 单次点击只发生一次状态切换。
- 空页面明确告诉运营去全局页头、页脚、导航或 SEO 修改。
- 草稿、线上快照和代码部署边界在页面提示和教程中保持一致。
