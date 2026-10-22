# Aidreamcapes 维护页（Nginx 503）

日期：2026-10-22
范围：`https://www.aivideosugc.com`（仅 Aidreamcapes）
目标：在发布重启的几秒窗口内，给用户一个可读的“正在维护”页面，同时保持正确的 SEO 语义。

## 1. 结论

可以，而且应该放在 **Nginx 层**，不要放在 Next.js 页面里。

原因：

- 发布脚本最后一步是 `systemctl restart aidreamcapes.service`。在这几秒内 Next.js 进程不在，应用层页面无法响应。
- Nginx 始终在；它可以把上游连接失败（502/504）转换成 **503 + Retry-After** 的静态维护页。
- 维护页独立于 release 目录，部署切换时不会被删掉，也不查数据库、不依赖登录态。

行为：

| 场景 | 状态 | 用户看到 |
|---|---|---|
| 正常访问 | 200 | 正常页面 |
| 发布重启、上游连接失败 | 503 | 维护页 |
| 上游超时（504） | 503 | 维护页 |
| 应用自己返回 503（如 API） | 503 | 原响应，不被替换 |

SEO 语义：

- **503 Service Unavailable + `Retry-After: 120`** 是临时维护的正确信号；搜索引擎会保留 URL 并稍后重试。
- **不要**用 200 或 302 返回维护页。
- **不要**在维护期间给 `robots.txt` 加 `Disallow`；这可能在恢复后继续生效。
- `Cache-Control: no-store` 防止浏览器/CDN 缓存维护页。
- HTML 内保留 `<meta name="robots" content="noindex,nofollow">` 作为兜底；但主要信号是 503。

## 2. 仓库文件

| 文件 | 用途 |
|---|---|
| `ops/deploy/aivideosugc-maintenance.html` | 自包含维护页，无外部图片/字体/JS，内联 CSS |
| `ops/deploy/aivideosugc-maintenance.nginx.conf` | Nginx server 级 include：`error_page` + 内部 `/__maintenance` location |

维护页文案只面向用户，不包含部署、数据库、SEO 策略等内部信息。

## 3. 上线步骤（约 5 分钟，不需要停站）

以下命令在本地仓库根目录执行。生产 SSH 参数按现有发布脚本。

### 3.1 上传文件

```bash
ssh -p 11765 -i ~/.ssh/ai_project_198_200_50_8_ed25519 root@204.77.130.125 \
  'mkdir -p /www/wwwroot/aidreamcapes.com/maintenance'

scp -P 11765 -i ~/.ssh/ai_project_198_200_50_8_ed25519 \
  ops/deploy/aivideosugc-maintenance.html \
  root@204.77.130.125:/www/wwwroot/aidreamcapes.com/maintenance/maintenance.html

scp -P 11765 -i ~/.ssh/ai_project_198_200_50_8_ed25519 \
  ops/deploy/aivideosugc-maintenance.nginx.conf \
  root@204.77.130.125:/www/server/nginx/conf/aivideosugc-maintenance.conf
```

> 不要把 snippet 放到 `/www/server/panel/vhost/nginx/`。BT 面板会自动 include 该目录下所有 `*.conf`（http 级），而 `location` 不能出现在 http 级，`nginx -t` 会报 `"location" directive is not allowed here`。snippet 放在 `/www/server/nginx/conf/`，再由站点的 server 块显式 include。

### 3.2 在 Nginx 主配置中加一行 include

编辑 `/www/server/panel/vhost/nginx/aivideosugc.com.conf`。

只加在 **`server_name www.aivideosugc.com`** 的 443 server 块里，不要加到 apex（`server_name aivideosugc.com`）的 301 块里。用 `location /_protected-customer-assets/` 作为唯一锚点，插在它前面：

```nginx
    include /www/server/nginx/conf/aivideosugc-maintenance.conf;

    location /_protected-customer-assets/ {
        internal;
        alias /www/wwwroot/mydreamshoots.com/shared/customer-assets/;
        sendfile on;
    }
```

> 该文件里有两个 `ssl_prefer_server_ciphers on;`（apex 和 www），不要用那一行做锚点，容易加错块。

### 3.3 校验并 reload

```bash
ssh -p 11765 -i ~/.ssh/ai_project_198_200_50_8_ed25519 root@204.77.130.125 \
  'cp /www/server/panel/vhost/nginx/aivideosugc.com.conf /www/server/panel/vhost/nginx/aivideosugc.com.conf.bak-$(date +%F-%H%M) && nginx -t && systemctl reload nginx'
```

预期：`nginx: configuration file ... test is successful`。

确认 include 已被加载：

```bash
ssh -p 11765 -i ~/.ssh/ai_project_198_200_50_8_ed25519 root@204.77.130.125 \
  'nginx -T | grep -n "aivideosugc-maintenance\|__maintenance"'
```

### 3.4 正常状态验证

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://www.aivideosugc.com/
```

预期 `200`。维护页配置不应影响正常请求。

## 4. 维护窗口内验证

发布脚本重启服务时，立即执行：

```bash
curl -sS -D- -o /tmp/ac-maintenance.html https://www.aivideosugc.com/ | sed -n '1,20p'
grep -o "We're making a few updates" /tmp/ac-maintenance.html
```

预期：

```
HTTP/2 503
retry-after: 120
cache-control: no-store, max-age=0
content-type: text/html; charset=utf-8
```

并确认 CF 没有缓存：

```bash
curl -sS -D- -o /dev/null https://www.aivideosugc.com/ \
  | grep -i 'cf-cache-status\|cache-control\|retry-after'
```

预期 `cf-cache-status: DYNAMIC`（或 `BYPASS`），不是 `HIT`。

服务恢复后再验证：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://www.aivideosugc.com/
```

预期 `200`。

## 5. 可选：手动维护开关（默认不启用）

如果需要在应用仍运行时做计划维护（例如不兼容的数据库变更），可以加一个文件开关：

1. 新建 `/www/server/nginx/conf/aivideosugc-maintenance-location.conf`：

```nginx
if (-f /www/wwwroot/aidreamcapes.com/maintenance/ENABLED) {
    return 503;
}
```

2. 在主配置的 `location / {` 内、`proxy_pass` 之前加：

```nginx
    include /www/server/nginx/conf/aivideosugc-maintenance-location.conf;
```

3. `nginx -t && systemctl reload nginx`。

启用/关闭：

```bash
# 启用
touch /www/wwwroot/aidreamcapes.com/maintenance/ENABLED

# 关闭（维护结束后必须执行）
rm -f /www/wwwroot/aidreamcapes.com/maintenance/ENABLED
```

风险：忘记删除 `ENABLED` 会让站点一直 503。建议：

- 只在实际维护窗口使用；
- 维护清单里把 `rm -f .../ENABLED` 作为必做项；
- 可选加一个每 5 分钟清理超过 30 分钟开关的 cron，但会增加一个运维部件。

默认安装**不包含**这个开关；发布重启由 `error_page 502/504` 自动覆盖，不需要手动开启。

## 6. 与发布脚本的关系

当前 `scripts/deploy-aidreamcapes-release.mjs` 的流程是：

1. 构建新 release；
2. 在随机端口启动 candidate，跑 smoke；
3. 执行数据库迁移；
4. 切换 `current` 符号链接；
5. `systemctl restart aidreamcapes.service`；
6. 健康检查与 origin smoke。

窗口只在第 5 步到第 6 步之间（通常几秒）。Nginx 的 `error_page 502 504` 自动覆盖。

发布脚本已加 preflight：在切换 release、重启服务之前，先检查

- `/www/wwwroot/aidreamcapes.com/maintenance/maintenance.html` 存在且非空；
- 运行中的 Nginx 配置包含 `location = /__maintenance`；
- 运行中的 Nginx 配置包含 `error_page 502 503 504 =503 /__maintenance`。

任一项不满足，脚本会在停服务前直接失败，避免出现默认 Nginx 502 页。若 preflight 失败，先按本文第 3 节安装维护页，不要绕过检查。

维护页放在 `/www/wwwroot/aidreamcapes.com/maintenance/`，不在 release 目录，所以每次部署都会保留。如果以后希望页面随仓库自动更新，可以在发布脚本远程命令里加一行复制；当前不需要。

## 7. 回滚

```bash
ssh -p 11765 -i ~/.ssh/ai_project_198_200_50_8_ed25519 root@204.77.130.125 \
  'rm -f /www/wwwroot/aidreamcapes.com/maintenance/ENABLED && \
   cp /www/server/panel/vhost/nginx/aivideosugc.com.conf.bak-<时间戳> /www/server/panel/vhost/nginx/aivideosugc.com.conf && \
   nginx -t && systemctl reload nginx'
```

或者只删除 include 行，保留维护页文件（文件本身不影响正常流量）。

回滚后验证：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://www.aivideosugc.com/
```

## 8. 验收清单

- [ ] 维护页 HTML 已上传到 `/www/wwwroot/aidreamcapes.com/maintenance/maintenance.html`。
- [ ] include 只加在 `server_name www.aivideosugc.com` 的 443 块。
- [ ] `nginx -t` 通过，`systemctl reload nginx` 成功。
- [ ] 正常请求仍 200。
- [ ] 发布重启窗口内返回 503，带 `Retry-After: 120`、`Cache-Control: no-store`，正文为维护页。
- [ ] Cloudflare 的 `cf-cache-status` 不是 `HIT`。
- [ ] 服务恢复后 200，页面内容正常。
- [ ] 未修改 MyDreamShoots 的 Nginx 配置、数据或资产。
- [ ] 如需手动开关，维护结束后 `ENABLED` 已删除。

## 9. 实测记录（2026-10-22）

在生产上做了一次受控验证：

1. `systemctl stop aidreamcapes.service`；
2. `curl https://www.aivideosugc.com/`；
3. `systemctl start aidreamcapes.service`；
4. 轮询到首页恢复 `200`。

结果：

- `HTTP/1.1 503 Service Unavailable`
- `retry-after: 120`
- `cache-control: no-store, max-age=0`
- `cf-cache-status: DYNAMIC`
- 正文 4749 bytes，包含 `We're making a few updates`
- 恢复后首页 `200`

## 10. 后续选项

如果希望发布完全零停机，下一步是把发布脚本改成蓝绿切换：candidate 在随机端口通过 smoke 后，把 Nginx upstream 切到 candidate，再停旧进程。当前脚本已经会启动 candidate 并跑 smoke，具备改造基础；维护页是这一改造完成前更稳妥的兜底。
