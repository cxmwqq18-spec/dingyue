#!/usr/bin/env bash
# Transcode the git-tracked storefront videos under public/ai-video-generation locally,
# then the result is committed and shipped by the normal prebuilt deploy.
#
# Usage:
#   bash scripts/media/transcode-local-public-videos.sh          # dry-run plan (default)
#   EXECUTE=1 bash scripts/media/transcode-local-public-videos.sh
#
# Originals are copied to ../aivideosugc-video-backups/<stamp>/ before replacement.
set -uo pipefail

REPO=$(cd "$(dirname "$0")/../.." && pwd)
SRC="$REPO/public/ai-video-generation"
BACKUP_ROOT=$(cd "$REPO/.." && pwd)/aivideosugc-video-backups
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$BACKUP_ROOT/$STAMP"
FFMPEG=${FFMPEG:-ffmpeg}
FFPROBE=${FFPROBE:-ffprobe}
MAX_W=1280
SKIP_MAX_KBPS=3500
EXECUTE=${EXECUTE:-0}

echo "== local public/ai-video-generation transcode $( [ "$EXECUTE" = 1 ] && echo EXECUTE || echo DRYRUN ) =="

files=$(find "$SRC" -maxdepth 1 -type f \( -name '*.mp4' -o -name '*.mov' -o -name '*.webm' -o -name '*.m4v' \) | sort)
total=$(echo "$files" | grep -c . || true)
echo "candidate files: $total"
plan_row() { printf "%-52s %8s -> %8s  %s\n" "$1" "$2" "$3" "$4"; }
plan_row FILE BEFORE AFTER NOTE
plan_row "----------------------------------------------------" "--------" "--------" "--------"

probe() { "$FFPROBE" -v error -select_streams v:0 -show_entries "$1" -of default=noprint_wrappers=1:nokey=1 "$2" 2>/dev/null | head -1; }
skip=0; done_n=0; fail=0; bytes_before=0; bytes_after=0; failed_list=""

for f in $files; do
  name=$(basename "$f")
  codec=$(probe stream=codec_name "$f")
  w=$(probe stream=width "$f")
  kbps=$(probe stream=bit_rate "$f" | awk '{print int($1/1000)}')
  dur=$(probe format=duration "$f")
  size=$(stat -f%z "$f" 2>/dev/null || echo 0)
  bytes_before=$((bytes_before + size))

  if [ "$codec" = "h264" ] && [ "${w:-9999}" -le "$MAX_W" ] && [ "${kbps:-99999}" -le "$SKIP_MAX_KBPS" ]; then
    plan_row "$name" "$size" "-" "SKIP (already ${kbps}kbps ${w}w)"
    skip=$((skip+1)); continue
  fi

  if [ "$EXECUTE" != 1 ]; then
    plan_row "$name" "$size" "~$((size * 27 / 100))" "WOULD TRANSCODE (${codec} ${w}w ${kbps}kbps)"
    continue
  fi

  mkdir -p "$BACKUP"
  cp "$f" "$BACKUP/$name"
  tmp=$(mktemp "${f%.?????}.transcode.XXXXXX.mp4")
  if ! "$FFMPEG" -y -v error -i "$f" \
      -vf "scale='min($MAX_W,iw)':-2" \
      -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p \
      -c:a aac -b:a 96k -movflags +faststart \
      "$tmp" 2>>"$BACKUP/transcode-$STAMP.log"; then
    plan_row "$name" "$size" "-" "FAIL (encode)"
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

  new_size=$(stat -f%z "$tmp")
  if [ "$new_size" -ge "$size" ]; then
    plan_row "$name" "$size" "-" "SKIP (transcode not smaller)"
    rm -f "$tmp"; skip=$((skip+1)); continue
  fi

  mv "$tmp" "$f"
  chmod 644 "$f"   # mktemp creates 0600; keep mirror perms consistent
  bytes_after=$((bytes_after + new_size))
  plan_row "$name" "$size" "$new_size" "OK ($(awk -v a=$size -v b=$new_size 'BEGIN{printf "%.0f%%", (1-b/a)*100}') saved)"
  done_n=$((done_n+1))
done

echo "== summary =="
if [ "$EXECUTE" = 1 ]; then
  echo "transcoded: $done_n  skipped: $skip  failed: $fail"
  echo "payload: $((bytes_before/1048576))MB -> $((bytes_after/1048576))MB"
  [ -n "$failed_list" ] && echo "failed:$failed_list"
  echo "originals backed up in: $BACKUP"
else
  echo "dry-run only. re-run with EXECUTE=1 to transcode."
fi
