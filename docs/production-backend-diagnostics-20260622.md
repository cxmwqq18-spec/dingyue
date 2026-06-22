# Production Backend Diagnostics - 2026-06-22

## Scope

This note covers `mydreamshoots.service` for the `/opt/dingyue/releases/20260622024452` release on port `3010`.

Do not paste server passwords, API tokens, Cloudflare tokens, or database passwords into this document or command output.

## Why production is still using JSON persistence

The application only switches to the Prisma/Postgres bridge when the runtime process environment has:

```bash
PERSISTENCE_BACKEND=postgres
```

Otherwise it falls back to `data/platform-state.json`. The relevant code paths are:

- `src/lib/platform-state-store.ts`: `usePostgresPlatformState()`
- `src/lib/server-store.ts`: `readPlatformState()` and `writePlatformState()`

So if the live process shows `PERSISTENCE_BACKEND=json` or has no `PERSISTENCE_BACKEND`, this is a service configuration issue rather than an app routing issue. The low-risk correction is:

1. Confirm the current JSON state is valid.
2. Push the Prisma schema.
3. Dry-run import the JSON state into Postgres.
4. Apply the import.
5. Add `PERSISTENCE_BACKEND=postgres` and `DATABASE_URL=...` to the systemd environment or env file used by `mydreamshoots.service`.
6. `systemctl daemon-reload && systemctl restart mydreamshoots.service`.
7. Verify `/proc/<MainPID>/environ` and API probes.

Recommended server commands:

```bash
cd /www/wwwroot/mydreamshoots.com/app
npm run ops:prod-diagnose > /tmp/mydreamshoots-prod-diagnose-before.json

DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run prisma:push
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-state -- --source data/platform-state.json --dry-run
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-state -- --source data/platform-state.json
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run smoke:postgres-state
```

Systemd should then expose masked evidence like:

```text
PERSISTENCE_BACKEND=postgres
DATABASE_URL=pos***lic
PORT=3010
```

## API latency smoke

The latency smoke is read-only and does not reset state.

Against the app port on the server:

```bash
SMOKE_BASE_URL=http://127.0.0.1:3010 SMOKE_HOST=www.mydreamshoots.xyz SMOKE_REPEAT=3 npm run smoke:api-latency
```

Against Nginx origin HTTPS on the server:

```bash
SMOKE_BASE_URL=https://127.0.0.1 SMOKE_HOST=www.mydreamshoots.xyz SMOKE_REPEAT=3 npm run smoke:api-latency
```

Against Cloudflare from a workstation:

```bash
SMOKE_BASE_URL=https://www.mydreamshoots.xyz SMOKE_REPEAT=3 npm run smoke:api-latency
```

The script reports `slowTargets` using `SMOKE_SLOW_MS`, default `1000`.

## Curl TLS reset evidence

Observed from this workstation on 2026-06-22:

```text
curl -Iv https://www.mydreamshoots.xyz/platform/login
TCP 443 connected to Cloudflare IPs 172.67.200.78 / 104.21.52.144.
TLS ClientHello was sent.
Connection reset by peer before any HTTP response.
```

`node fetch` and `openssl s_client` from the same machine also failed with `ECONNRESET` / `write:errno=54`.

This places the failure before HTTP and before the Next.js application. Because a browser can access the same URL, compare these paths before changing application code:

1. Workstation curl to Cloudflare.
2. Workstation browser to Cloudflare.
3. Server curl to local app: `curl -I -H 'Host: www.mydreamshoots.xyz' http://127.0.0.1:3010/platform/login`.
4. Server curl to local Nginx TLS: `curl -k -I -H 'Host: www.mydreamshoots.xyz' https://127.0.0.1/platform/login`.
5. Server curl to Cloudflare public hostname.

If only workstation CLI clients reset while browser and server-side origin probes pass, likely causes are local network/security filtering, Cloudflare edge behavior for specific TLS fingerprints, or an IP reputation/WAF rule. If server-to-Cloudflare also resets, check Cloudflare zone SSL/TLS mode, WAF/firewall events, DNS records, and whether the origin certificate/vhost for `mydreamshoots.xyz` is healthy.

## New scripts

- `npm run ops:prod-diagnose`: server-side read-only evidence bundle for systemd env, process env, Nginx, origin probes, and Cloudflare TLS probes. Secrets are masked.
- `npm run smoke:api-latency`: read-only API/page latency sampler with sorted slow targets.
