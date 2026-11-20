#!/bin/bash
# Dipanggil workflow render. Mode:
#   jalan.sh                 render berurutan di satu runner: semua job yang belum punya rilis render-<ID> (atau hanya $ID, boleh beberapa dipisah koma)
#   jalan.sh daftar          cetak JSON {"ids":[...],"potong":[{"id","k","n"}...]} untuk matrix render paralel (20 Nov 2026)
#   jalan.sh potong ID k n   siapkan narasi + render potongan milik shard k dari n ke out/ID/
#   jalan.sh gabung ID       render potongan yang hilang, gabung, campur audio, sampul, unggah rilis render-ID
# Hasil: <ID>.mp4 (+ <ID>_cover.jpg, info.json) sebagai aset rilis publik (diambil mesin-konten).
set -euo pipefail
cd "$(dirname "$0")/.."
shopt -s nullglob

tpl_of() { python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['template'])" "jobs/$1/job.json"; }
mood_of() { python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('mood','misteri'))" "jobs/$1/job.json"; }
# jumlah shard per template: 3D berat (±0,13-0,37 frame/dtk per browser); 2.5D di runner Actions ternyata
# ±1 frame/dtk per shard (20 Nov: 2 shard = 15-25 menit), jadi 6 shard. Repo publik: menit gratis, maks 20 job serentak.
shard_of() { case "$(tpl_of "$1")" in tebak-25d) echo "${SHARD_25D:-6}" ;; *) echo "${SHARD_3D:-8}" ;; esac; }

perlu() {  # daftar ID yang perlu dirender
  for jf in jobs/*/job.json; do
    id=$(basename "$(dirname "$jf")")
    if [ -n "${ID:-}" ]; then case ",${ID// /}," in *",$id,"*) echo "$id" ;; esac
    elif ! gh release view "render-$id" >/dev/null 2>&1; then echo "$id"; fi
  done
}

siapkan() {  # narasi dari mesin-konten dikirim sebagai MP3 (repo tetap kecil); align/mix butuh WAV
  local d=jobs/$1
  for m in "$d"/*.mp3; do w="${m%.mp3}.wav"; [ -f "$w" ] || ffmpeg -y -loglevel error -i "$m" -ac 1 "$w"; done
  python3 kerja/align.py "$d"
}

selesaikan() {  # $1=ID, $2=detik mulai; potongan seg_*.mp4 sudah ada di out/ID
  local id=$1 start=$2 tpl mood d out n
  tpl=$(tpl_of "$id"); mood=$(mood_of "$id"); d=jobs/$id; out=out/$id
  node kerja/render.js "$tpl" info - "$out" --job "/$d" | tail -n 1 > "$out/info.json"
  python3 kerja/mix.py "$out/info.json" "$d" "$mood" "$out/audio"
  n=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))['scenes']))" "$out/info.json")
  ls "$out"/seg_*.mp4 | grep -v tmp | sort > "$out/segs.txt"
  # tiap adegan harus ada (satu berkas utuh atau beberapa potongan) dan jumlah frame harus cocok dengan durasi
  local have; have=$(sed 's#.*/seg_\([0-9]*\).*#\1#' "$out/segs.txt" | sort -u | wc -l)
  [ "$have" -eq "$n" ] || { echo "adegan kurang untuk $id ($have dari $n)"; exit 1; }
  python3 - "$out" <<'PY'
import json, sys, subprocess
out = sys.argv[1]
meta = json.load(open(f"{out}/info.json"))
want = round(meta["duration"] * 30)
files = [l.strip() for l in open(f"{out}/segs.txt") if l.strip()]
got = 0
for f in files:
    r = subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", f], capture_output=True, text=True)
    got += int(r.stdout.strip() or 0)
if abs(got - want) > 2:
    sys.exit(f"jumlah frame {got} tidak cocok dengan durasi ({want})")
print("frame cocok", got)
PY
  sed "s#^#file '$PWD/#; s#\$#'#" "$out/segs.txt" > "$out/list.txt"
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$out/list.txt" -c copy "$out/video.mp4"
  ffmpeg -y -loglevel error -i "$out/video.mp4" -i "$out/audio/mix.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$out/$id.mp4"
  # sampul tanpa subtitle (frame hook) untuk unggahan; gagal sampul tidak menahan video
  local cover=()
  if node kerja/render.js "$tpl" cover - "$out" --job "/$d" >/dev/null && [ -s "$out/cover.jpg" ]; then
    cp "$out/cover.jpg" "$out/${id}_cover.jpg"; cover=("$out/${id}_cover.jpg")
  fi
  local dur=$(( $(date +%s) - start ))
  gh release delete "render-$id" -y --cleanup-tag >/dev/null 2>&1 || true
  gh release create "render-$id" "$out/$id.mp4" "$out/info.json" "${cover[@]}" --title "$id" --notes "Template $tpl, ${MODE_NOTE:-render ${dur} detik di runner Actions (WORKERS=${WORKERS:-1})}."
  echo "selesai $id dalam ${dur} detik"
}

case "${1:-}" in
  daftar)
    ids=(); pot=()
    for id in $(perlu); do
      n=$(shard_of "$id"); ids+=("\"$id\"")
      for ((k = 0; k < n; k++)); do pot+=("{\"id\":\"$id\",\"k\":$k,\"n\":$n}"); done
    done
    (IFS=,; echo "{\"ids\":[${ids[*]:-}],\"potong\":[${pot[*]:-}]}")
    ;;
  potong)
    id=$2; k=$3; n=$4
    siapkan "$id"
    node kerja/render.js "$(tpl_of "$id")" potong "$k/$n" "out/$id" --job "/jobs/$id"
    ;;
  gabung)
    id=$2
    siapkan "$id"
    mkdir -p "out/$id"
    # potongan yang hilang (shard gagal) dirender di sini; yang sudah ada dilewati
    WORKERS="${WORKERS:-3}" node kerja/render.js "$(tpl_of "$id")" potong 0/1 "out/$id" --job "/jobs/$id" | grep -v '^lewati' || true
    MODE_NOTE="render paralel di beberapa runner Actions" selesaikan "$id" "$(date +%s)"
    ;;
  "")
    for id in $(perlu); do
      tpl=$(tpl_of "$id")
      echo "== $id ($tpl, $(mood_of "$id"))"
      start=$(date +%s)
      siapkan "$id"
      mkdir -p "out/$id"
      node kerja/render.js "$tpl" segs all "out/$id" --job "/jobs/$id"
      selesaikan "$id" "$start"
    done
    ;;
  *) echo "mode tidak dikenal: $1"; exit 2 ;;
esac
