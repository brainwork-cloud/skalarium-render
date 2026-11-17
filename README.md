# skalarium-render

Renderer video 3D sinematik untuk Skalarium: three.js di Chromium headless (SwiftShader), Playwright, ffmpeg.
Jalan di GitHub Actions repo publik ini (menit gratis) supaya tidak memakai kuota repo privat `mesin-konten`.
Repo ini tidak menyimpan kunci API atau token apa pun.

## Alur
1. `mesin-konten` menulis naskah, suara (Gemini TTS), dan data adegan, lalu mengirim job ke `jobs/<ID>/` (token `RENDER_TOKEN`, hanya bisa menulis ke repo ini).
2. Workflow `render` (`.github/workflows/render.yml`) merender job yang belum punya rilis `render-<ID>`: waktu kata (`kerja/align.py`), frame per adegan (`kerja/render.js`, beberapa browser paralel), musik + efek suara + narasi (`kerja/mix.py`), lalu `<ID>.mp4` 1080x1920 30 fps diunggah sebagai aset rilis `render-<ID>`.
3. `mesin-konten` mengambil `<ID>.mp4` dari rilis publik itu untuk QC dan posting.

## Isi job (`jobs/<ID>/`)
- `job.json`: `{"id": "...", "template": "<nama file di tpl/ tanpa .js>", "mood": "misteri|ceria", ...data template}`
- `info.json`: daftar baris narasi `[{"key": "e1", "teks": "...", "dur": 4.34, "sr": 22050}, ...]`
- `<key>.wav`: suara tiap baris narasi

## Template
- `tpl/tebak-dulu.js`: template generik **TEBAK DULU** yang diisi data agen (17 Nov 2026). Alur: hook, 3 opsi + hitung mundur 3-2-1,
  langkah (`hitung` angka berjalan + kubus satuan, `anggap` kartu asumsi + kubus emas, `rumus` persamaan + hasil besar, `fakta` kartu),
  perbandingan 3D (`kotak` luas, `batang` jumlah, `bola` volume), jawaban, penutup + ajakan follow.
  Latar `bumi` (globe, negara disorot, penanda lat/lon) atau `panggung` (tanda tanya emas di podium). Bahasa `id` atau `en`.
  Contoh lengkap: `jobs/UJI-TD-1/job.json` (bumi + kotak) dan `jobs/UJI-TD-2/job.json` (panggung + batang); skema di kepala file template.
  Aturan teks: `*kata*` = sorot emas; baris hook yang seluruhnya `*...*` = blok kuning; opsi maks 24 huruf; hook 3 baris pendek.
  Baris narasi: baris 1 = hook, baris 2 = opsi (sebut "A, ... B, ... Atau C, ..." supaya opsi muncul tepat saat diucapkan).
- `tpl/contoh-es.js`: contoh KASUS #1 "Es yang Menyusut" (adegan khusus, dipakai untuk uji).
- `tpl/contoh-bumi.js`: contoh TEBAK DULU #1 "Semua Manusia" (adegan khusus, dipakai untuk uji).
- Template generik KASUS menyusul.

## Ukuran video
Segmen di-encode libx264 CRF 20 (sejak 17 Nov 2026; sebelumnya CRF 16 = ±130 MB per 43 detik).

## Jalankan lokal
```
npm ci && npx playwright install chromium
python3 kerja/align.py jobs/UJI-ES-1
WORKERS=2 node kerja/render.js contoh-es segs all out/UJI-ES-1 --job /jobs/UJI-ES-1
```
