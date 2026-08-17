# Cloudflare Operations

This project uses a project-scoped Cloudflare API token for production DNS and edge-rule operations.

## Active Token

- Token preview: `cfut_2...7a25`
- Token id: `968310de8b7d8ea2a01da3119fd3b990`
- Verified at: `2026-08-13 11:50:33 Asia/Shanghai`
- Verification endpoint: `GET /client/v4/user/tokens/verify`
- Verification result: active
- Full token storage: local ignored env file only, `CLOUDFLARE_API_TOKEN` in `.env.local`

Do not paste the full token into tracked docs, command output, tickets, or final user-facing summaries.

## Account And Zones

- Cloudflare account id: `a252d25092a87b6b457f319c691c7ae8`
- `mydreamshoots.com`: zone id `7ef5975a18e8f29893a46450df47c6e3`
- `mydreamshoots.xyz`: zone id `3d2b8694986a1c8a0580443f0de9ae59`
- `aidreamcapes.com`: zone id `be6e5537f4601be730c525917641986f`
- `aidreamcapes.xyz`: zone id `5af341caded3f60457c022dec206f981`
- `aidreamshoots.eu`: zone id `9e3c82a5c7d3f17a94f16272843a31da`
- `aidreamcapes.eu`: zone id `4149bc32d6ce95d69442ee87db8726a3`

## Verified Capabilities

Read-only checks performed on `2026-08-13`:

- Token verify: `200`, active.
- Zone list: `200`, 14 zones visible.
- DNS records read: `200` for the project zones listed above.
- Rulesets read: `200` for the project zones listed above.
- Legacy WAF packages read: `403 Unauthorized to access requested resource`.

Ruleset write capability was also verified on `2026-08-13` for `mydreamshoots.com`. Before future DNS or ruleset writes, run a read-only probe first and state the exact zone, endpoint, and intended change.

## Active Cloudflare Rules

On `2026-08-13`, the following Cloudflare zone ruleset was applied to `mydreamshoots.com`:

- Ruleset id: `6f81971669394d7e8de8b3bc8de8632f`
- Phase: `http_config_settings`
- Rule ref: `mydreamshoots_assets_relax_cf_security`
- Expression: `starts_with(http.request.uri.path, "/assets/")`
- Action: `set_config`
- Action parameters: `bic=false`, `security_level=essentially_off`

This rule relaxes Cloudflare browser/security checks for public static assets. It does not contain secrets.

## Production Image Incident Note

On `2026-08-13`, mobile image requests on `www.mydreamshoots.com` initially appeared to be Cloudflare/edge challenge behavior for asset requests without the guard cookie. Further production probing showed the real source was the server-level Nginx Lua script `/www/server/nginx/html/waf.lua`, loaded globally by `/www/server/nginx/conf/proxy.conf`. That script set `k=YYMMDD` and randomly redirected mobile requests without the cookie to external `jqoss.vip` / `jqdonw.top` URLs.

Server remediation applied on `2026-08-13`:

- Backups created under `/www/server/nginx/html/waf.lua.bak-*`.
- Static asset prefixes were allowed through first.
- The third-party mobile redirect branch was then disabled for storefront traffic with an early return after the explicit spider block.
- `nginx -t` passed before reload.

Final verification:

- Local Nginx Android probe: homepage `10/10` returned `200 text/html`; asset `10/10` returned `200 image/png`; no `Location` or `Set-Cookie`.
- Public Cloudflare probe: iPhone and Android homepage plus image requests, `60/60` returned `200`; no redirects and no `Set-Cookie`.

Keep static assets excluded from future challenge or mobile-redirection logic:

- Host: `mydreamshoots.com` and `www.mydreamshoots.com`
- Path prefix: `/assets/`
- Also consider: `/_next/static/`, `/_next/image/`, browser icons, and common image extensions

Use `CLOUDFLARE_API_TOKEN` from `.env.local` for future Cloudflare work on this project.
