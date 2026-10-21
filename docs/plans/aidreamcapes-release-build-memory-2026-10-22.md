# Aidreamcapes 发布构建内存方案

日期：2026-10-22
适用：`scripts/deploy-aidreamcapes-release.mjs`（`www.aivideosugc.com` 发布）

## 1 问题

2026-10-21 的生产发布在服务器端构建阶段失败：

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
[32734:0x77ef6c0] 960733 ms: Mark-Compact (reduce) 12130.8 (12335.9) -> 12130.4 (12336.6) MB
```

发布在切流前中止，线上仍是旧版本 `4fb509bfb`，无流量影响。

## 2 测量结果

| 测量 | 数值 | 方式 |
|---|---|---|
| 本地生产构建整棵进程树峰值 RSS | **5.4GB**（编译 52s，全流程约 5min） | `scripts/build-production.mjs`，2 个构建进程采样 |
| 服务器构建默认堆上限 | 12GB（`AIDREAMCAPES_BUILD_HEAP_MB=12288`） | 发布脚本默认值 |
| 服务器可用内存（发布时） | 总 15.9GB，已用约 6GB，可用约 9GB，另有 5 个线上店铺服务常驻 | `free -m` |
| 服务器 8GB 堆构建 | **成功**：3.4min 编译完成，lint 与类型检查通过，`.next-build` 正常产出 | `AIDREAMCAPES_BUILD_HEAP_MB=8192` |

结论：这份代码的构建真实需求约 5.5GB 内存，**并不需要 12GB 堆**。

## 3 根因

堆上限（12GB）大于主机实际能给出的内存（约 9GB 可用，还要与 5 个线上店铺服务共享）时，
V8 不会更积极地回收，而是因为分配延迟（页缺失、swap 抖动）不断把老生代撑大，
最终撞到自己的堆上限而中止——即使真实存活集只有约 5.5GB。

也就是：**堆上限设得越大，越容易失败**。这与运行时服务的结论相反
（运行时下调 `--max-old-space-size` 只会让 OOM 更早发生，见
`docs/plans/aidreamcapes-production-ssr-memory-stability-2026-10-21.md`），
因为运行时的失败模式是“存活集真的太大”，而构建期的失败模式是“内存压力下堆膨胀”。

另外，构建期间并行跑媒体审计/压测会明显加重 swap 压力。2026-10-21 那次失败时
服务器上正跑着 5 个媒体只读审计进程。

## 4 采取的措施

1. 发布脚本默认堆上限由 `12288` 改为 `8192`（`AIDREAMCAPES_BUILD_HEAP_MB` 仍可覆盖）。
   注释写明原因，避免以后有人按直觉再调大。
2. 服务器端构建路径已验证可用：8GB 堆下构建约 3.4 分钟编译、约 9 分钟完成全流程。
3. 保留 `--prebuilt-build` 作为备用路径：主机忙、磁盘慢或需要并行发布时，
   在有 ≥16GB 内存的机器上按生产环境变量构建，再把产物传给发布脚本。
   候选实例仍会先跑完整 SSR 冒烟再切流。

## 5 操作要求

- 服务器端构建时不要并行跑媒体审计、并发压测或 sitemap 全量抓取。
- 构建前确认 `free -m` 的 `available` 至少 6GB；不足时改用 `--prebuilt-build`。
- 不要再把 `AIDREAMCAPES_BUILD_HEAP_MB` 调大到 12GB 以上；那是本次故障的直接原因。
- 迁移后的生产数据库中 `SiteContentRevision` 与 `LivePage` 不受影响，本次只改发布脚本。

## 6 可选的后续优化（未实施）

- `next build` 内部的 lint 与类型检查与 `npm run typecheck` / ESLint 重复，
  可在发布脚本里先跑一次类型检查，再用 `typescript.ignoreBuildErrors`、
  `eslint.ignoreDuringBuilds` 跳过构建内重复检查，可再省 1–2GB 与数分钟。
  这会改变失败时机，需与发布门禁一起设计后再做。
- 服务器上有 46 个历史 release 目录与若干长驻进程，可做一次清理，
  减少磁盘与内存压力。
