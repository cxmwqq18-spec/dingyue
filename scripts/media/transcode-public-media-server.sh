#!/usr/bin/env bash
# Transcode aidreamcapes public-media videos in place on the server (runs ON the server).
# Target: /www/wwwroot/aidreamcapes.com/shared/sites/public-media/{video,actor}/*.mp4|mov|webm|m4v
# Re-encode to <=1280w H.264 CRF24 (+faststart) so template pages stop shipping 20-44MB files.
#
# Usage (from a workstation with the deploy SSH key):
#   DRYRUN=1 bash scripts/media/transcode-public-media-server.sh            # plan only (default)
#   EXECUTE=1 bash scripts/media/transcode-public-media-server.sh           # actually transcode
#
# Safety: nice/ionice + sequential + 2 ffmpeg threads, originals moved to a sibling
# backup dir on the same filesystem, per-file duration + decode verification before replace.
set -uo pipefail

BASE=/www/wwwroot/aidreamcapes.com/shared/sites/public-media
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$BASE/backup-pre-transcode-$STAMP"
FFMPEG=${FFMPEG:-/usr/local/bin/ffmpeg}
FFPROBE=${FFPROBE:-/usr/local/bin/ffprobe}
MAX_W=1280
SKIP_MAX_KBPS=3500   # already-small files (h264, <=1280w, <=3.5Mbps) are left untouched
EXECUTE=${EXECUTE:-0}

echo "== public-media transcode $( [ "$EXECUTE" = 1 ] && echo EXECUTE || echo DRYRUN ) =="
echo "backup dir: $BACKUP"

files=$(find "$BASE/video" "$BASE/actor" -maxdepth 1 -type f \( -name '*.mp4' -o -name '*.mov' -o -name '*.webm' -o -name '*.m4v' \) 2>/dev/null | sort)
total=$(echo "$files" | grep -c . || true)
echo "candidate files: $total"

plan_row() { printf "%-52s %8s -> %8s  %s\n" "$1" "$2" "$3" "$4"; }
plan_row FILE BEFORE AFTER NOTE
plan_row "----------------------------------------------------" "--------" "--------" "--------"

skip=0; done_n=0; fail=0; bytes_before=0; bytes_after=0; failed_list=""
probe() { "$FFPROBE" -v error -select_streams v:0 -show_entries "$1" -of default=noprint_wrappers=1:nokey=1 "$2" 2>/dev/null | head -1; }

for f in $files; do
  name=$(basename "$f")
  codec=$(probe stream=codec_name "$f")
  w=$(probe stream=width "$f")
  kbps=$(probe stream=bit_rate "$f" | awk '{print int($1/1000)}')
  dur=$(probe format=duration "$f")
  size=$(stat -c%s "$f" 2>/dev/null || echo 0)
  bytes_before=$((bytes_before + size))

  if [ "$codec" = "h264" ] && [ "${w:-9999}" -le "$MAX_W" ] && [ "${kbps:-99999}" -le "$SKIP_MAX_KBPS" ]; then
    plan_row "$name" "${size}" "-" "SKIP (already ${kbps}kbps ${w}w)"
    skip=$((skip+1)); continue
  fi

  if [ "$EXECUTE" != 1 ]; then
    plan_row "$name" "$size" "~$((size * 27 / 100))" "WOULD TRANSCODE (${codec} ${w}w ${kbps}kbps)"
    continue
  fi

  tmp=$(mktemp "${f%.?????}.transcode.XXXXXX.mp4")
  if ! nice -n 19 ionice -c3 "$FFMPEG" -y -v error -i "$f" \
      -vf "scale='min($MAX_W,iw)':-2" \
      -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p -threads 2 \
      -c:a aac -b:a 96k -movflags +faststart \
      "$tmp" 2>>"$BASE/transcode-$STAMP.log"; then
    plan_row "$name" "$size" "-" "FAIL (encode, see log)"
    rm -f "$tmp"; fail=$((fail+1)); failed_list="$failed_list $name"; continue
  fi

  new_dur=$(probe format=duration "$tmp")
  ok_dur=$(awk -v a="$dur" -v b="$new_dur" 'BEGIN{d=a-b; if(d<0)d=-d; print (d<0.35)?1:0}')
  if [ "$ok_dur" != "1" ]; then
    plan_row "$name" "$size" "-" "FAIL (duration drift ${dur}->${new_dur})"
    rm -f "$tmp"; fail=$((fail+1)); failed_list="$failed_list $name"; continue
  fi
  if ! "$FFMPEG" -v error -i "$tmp" -f null - >/dev/null 2>&1; then
    plan_row "$name" "$size" "-" "FAIL (decode check)"
    rm -f "$tmp"; fail=$((fail+1)); failed_list="$failed_list $name"; continue
  fi

  new_size=$(stat -c%s "$tmp")
  if [ "$new_size" -ge "$size" ]; then
    plan_row "$name" "$size" "-" "SKIP (transcode not smaller)"
    rm -f "$tmp"; skip=$((skip+1)); continue
  fi

  mkdir -p "$BACKUP"
  mv "$f" "$BACKUP/$name"
  mv "$tmp" "$f"
  chmod 644 "$f"   # mktemp creates 0600; nginx workers must be able to read it
  bytes_after=$((bytes_after + new_size))
  plan_row "$name" "$size" "$new_size" "OK ($(awk -v a=$size -v b=$new_size 'BEGIN{printf "%.0f%%", (1-b/a)*100}') saved)"
  done_n=$((done_n+1))
done

echo "== summary =="
if [ "$EXECUTE" = 1 ]; then
  echo "transcoded: $done_n  skipped: $skip  failed: $fail"
  echo "payload: $((bytes_before/1048576))MB -> $((bytes_after/1048576))MB (only replaced files counted after)"
  [ -n "$failed_list" ] && echo "failed:$failed_list"
  echo "originals in: $BACKUP  (delete after CF cache purge + verification)"
else
  echo "dry-run only. re-run with EXECUTE=1 to transcode."
fi
