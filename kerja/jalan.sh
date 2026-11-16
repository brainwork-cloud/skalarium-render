#!/bin/bash
# Dipanggil workflow render: render semua job yang belum punya rilis render-<ID> (atau hanya $ID bila diisi),
# lalu unggah <ID>.mp4 sebagai aset rilis publik (diambil mesin-konten).
set -euo pipefail
cd "$(dirname "$0")/.."
shopt -s nullglob
for jf in jobs/*/job.json; do
  id=$(basename "$(dirname "$jf")")
  if [ -n "${ID:-}" ]; then [ "$id" = "$ID" ] || continue
  elif gh release view "render-$id" >/dev/null 2>&1; then echo "lewati $id (sudah dirender)"; continue; fi
  tpl=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['template'])" "$jf")
  mood=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('mood','misteri'))" "$jf")
  d=jobs/$id; out=out/$id; mkdir -p "$out"
  echo "== $id ($tpl, $mood)"
  start=$(date +%s)
  python3 kerja/align.py "$d"
  node kerja/render.js "$tpl" info - "$out" --job "/$d" | tail -n 1 > "$out/info.json"
  node kerja/render.js "$tpl" segs all "$out" --job "/$d"
  python3 kerja/mix.py "$out/info.json" "$d" "$mood" "$out/audio"
  n=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))['scenes']))" "$out/info.json")
  ls "$out"/seg_*.mp4 | grep -v tmp | sort > "$out/segs.txt"
  [ "$(wc -l < "$out/segs.txt")" -eq "$n" ] || { echo "segmen kurang untuk $id"; exit 1; }
  sed "s#^#file '$PWD/#; s#\$#'#" "$out/segs.txt" > "$out/list.txt"
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$out/list.txt" -c copy "$out/video.mp4"
  ffmpeg -y -loglevel error -i "$out/video.mp4" -i "$out/audio/mix.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$out/$id.mp4"
  dur=$(( $(date +%s) - start ))
  gh release delete "render-$id" -y --cleanup-tag >/dev/null 2>&1 || true
  gh release create "render-$id" "$out/$id.mp4" "$out/info.json" --title "$id" --notes "Template $tpl, render ${dur} detik di runner Actions (WORKERS=${WORKERS:-1})."
  echo "selesai $id dalam ${dur} detik"
done
