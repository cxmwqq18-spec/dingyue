#!/usr/bin/env bash
#
# Aidreamcapes liveness watchdog.
#
# The storefront, the workspace and the local AI worker share one Node.js
# process. When that process wedges (for example on 2026-11-16 a video create
# call froze the event loop while systemd kept reporting the unit as "active")
# every public route stops answering and Cloudflare returns 524 until someone
# restarts the service by hand. `Restart=always` cannot see this failure mode
# because the process never exits.
#
# This probe runs outside the service:
#   * probe the private health endpoint once per systemd timer tick;
#   * treat "no HTTP answer / wrong answer" as an event-loop wedge;
#   * never restart for an acknowledged 503 (database or revision probe failure)
#     or a 404 (token misconfigured), because those are not process wedges;
#   * after two consecutive failures ask Node for a diagnostic report (SIGUSR2),
#     then restart, so the next outage leaves a stack behind;
#   * rate limit itself so a broken release cannot thrash the box.
#
set -u

UNIT="${WATCHDOG_UNIT:-aidreamcapes.service}"
PROBE_URL="${WATCHDOG_PROBE_URL:-http://127.0.0.1:3013/api/aidreamcapes/health}"
STATE_DIR="${WATCHDOG_STATE_DIR:-/var/lib/aidreamcapes-watchdog}"
THRESHOLD="${WATCHDOG_THRESHOLD:-2}"
PROBE_TIMEOUT="${WATCHDOG_PROBE_TIMEOUT_SECONDS:-5}"
RESTART_COOLDOWN="${WATCHDOG_RESTART_COOLDOWN_SECONDS:-180}"
WINDOW_SECONDS="${WATCHDOG_WINDOW_SECONDS:-900}"
MAX_RESTARTS_IN_WINDOW="${WATCHDOG_MAX_RESTARTS_IN_WINDOW:-3}"
REPORT_GRACE_SECONDS="${WATCHDOG_REPORT_GRACE_SECONDS:-5}"
BOOT_GRACE_SECONDS="${WATCHDOG_BOOT_GRACE_SECONDS:-0}"

FAIL_FILE="$STATE_DIR/consecutive_failures"
RESTARTS_FILE="$STATE_DIR/restarts"
LAST_RESTART_FILE="$STATE_DIR/last_restart"

mkdir -p "$STATE_DIR" || exit 1
BODY_FILE="$(mktemp)" || exit 1
trap 'rm -f "$BODY_FILE"' EXIT

log() { logger -t aidreamcapes-watchdog -- "$*" 2>/dev/null || printf '%s\n' "$*"; }

TOKEN="${AIDREAMCAPES_HEALTH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  log "CRITICAL: AIDREAMCAPES_HEALTH_TOKEN is not configured; refusing to act on an unauthorized probe"
  exit 1
fi

probe() {
  PROBE_CODE="$(curl -sS -m "$PROBE_TIMEOUT" -o "$BODY_FILE" -w '%{http_code}' \
    -H "x-aidreamcapes-health-token: $TOKEN" "$PROBE_URL" 2>/dev/null)"
  PROBE_RC=$?
  return 0
}

wait_for_boot() {
  local grace="$BOOT_GRACE_SECONDS"
  [ "$grace" -gt 0 ] || return 0
  local waited=0
  while [ "$waited" -lt "$grace" ]; do
    sleep 5
    waited=$((waited + 5))
    probe
    if [ "${PROBE_CODE:-000}" = "200" ] && grep -q '"ok":true' "$BODY_FILE" 2>/dev/null; then
      return 0
    fi
  done
  return 0
}

wait_for_boot

probe
code="${PROBE_CODE:-000}"
rc="${PROBE_RC:-1}"

if [ "$rc" -eq 0 ] && [ "$code" = "200" ] && grep -q '"ok":true' "$BODY_FILE" 2>/dev/null; then
  printf '0\n' > "$FAIL_FILE"
  exit 0
fi

if [ "$code" = "404" ]; then
  log "health probe returned 404: the token no longer matches the running release; not restarting"
  printf '0\n' > "$FAIL_FILE"
  exit 1
fi

if [ "$code" = "503" ]; then
  # The endpoint answered, so the event loop is alive; a 503 means the database
  # or the revision probe failed. A restart would not repair that, and would
  # add a second failure to the outage.
  log "health probe returned 503 (database/revision not ready); event loop is responsive, not restarting"
  printf '0\n' > "$FAIL_FILE"
  exit 0
fi

failures=$(( $(cat "$FAIL_FILE" 2>/dev/null || printf '0') + 1 ))
printf '%s\n' "$failures" > "$FAIL_FILE"
log "probe failed (http=${code} rc=${rc}): consecutive failure ${failures}/${THRESHOLD}"

if [ "$failures" -lt "$THRESHOLD" ]; then
  exit 0
fi

now="$(date +%s)"
cutoff=$(( now - WINDOW_SECONDS ))

recent_restarts=0
if [ -f "$RESTARTS_FILE" ]; then
  awk -v cutoff="$cutoff" '$1 + 0 >= cutoff' "$RESTARTS_FILE" > "$RESTARTS_FILE.tmp" 2>/dev/null || true
  mv "$RESTARTS_FILE.tmp" "$RESTARTS_FILE" 2>/dev/null
  recent_restarts="$(wc -l < "$RESTARTS_FILE" | tr -d ' ')"
fi

if [ "${recent_restarts:-0}" -ge "$MAX_RESTARTS_IN_WINDOW" ]; then
  log "CRITICAL: ${recent_restarts} automatic restarts in the last ${WINDOW_SECONDS}s; the service is not recovering. Holding off and requiring manual investigation."
  exit 2
fi

last_restart="$(cat "$LAST_RESTART_FILE" 2>/dev/null || printf '0')"
if [ $(( now - last_restart )) -lt "$RESTART_COOLDOWN" ]; then
  log "restart cooldown active ($(( now - last_restart ))s < ${RESTART_COOLDOWN}s); waiting for the next probe"
  exit 0
fi

if systemctl is-active --quiet "$UNIT"; then
  log "unit is still marked active but the probe is wedged; requesting a Node diagnostic report with SIGUSR2"
  systemctl kill -s SIGUSR2 "$UNIT" >/dev/null 2>&1 || log "SIGUSR2 delivery failed; continuing to restart"
  sleep "$REPORT_GRACE_SECONDS"
fi

log "restarting $UNIT after ${failures} consecutive probe failures"
if ! systemctl restart "$UNIT"; then
  log "CRITICAL: systemctl restart $UNIT failed"
  exit 1
fi

printf '%s\n' "$now" > "$LAST_RESTART_FILE"
printf '%s\n' "$now" >> "$RESTARTS_FILE"
printf '0\n' > "$FAIL_FILE"

# Confirm recovery once, so the journal records whether the restart worked.
sleep 20
BOOT_GRACE_SECONDS=0
probe
if [ "${PROBE_CODE:-000}" = "200" ] && grep -q '"ok":true' "$BODY_FILE" 2>/dev/null; then
  log "recovered: the health probe answers again after the restart"
  exit 0
fi

log "CRITICAL: service restarted but the health probe still fails (http=${PROBE_CODE:-000}); manual investigation required"
exit 1
