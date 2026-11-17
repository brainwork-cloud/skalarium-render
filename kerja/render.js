// Render template animasi ke video (Playwright + Chromium headless + ffmpeg).
//   node kerja/render.js <template> info    - <dir>  --job /jobs/<ID>   -> JSON durasi, adegan, cue, tanda waktu (stdout)
//   node kerja/render.js <template> preview <t1,t2,...> <dir> --job ...   -> JPEG per waktu
//   node kerja/render.js <template> segs    <all|i,j> <dir> --job ...     -> <dir>/seg_XX.mp4 per adegan
//   node kerja/render.js <template> cover   <t|-> <dir> --job ...         -> <dir>/cover.jpg (tanpa subtitle)
// Env: WORKERS = jumlah browser paralel (default 1), FORCE=1 = render ulang segmen yang sudah ada.
// Server statis bawaan melayani akar repo, jadi tidak perlu proses server terpisah.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const jobI = argv.indexOf('--job');
const JOB = jobI >= 0 ? argv[jobI + 1] : '';
const [tpl, mode, arg, outDir] = argv.filter((a, i) => i !== jobI && i !== jobI + 1);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg' };
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'];

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const p = path.normalize(path.join(ROOT, decodeURIComponent(q.url.split('?')[0])));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/tpl/index.html?tpl=${encodeURIComponent(tpl)}&job=${encodeURIComponent(JOB)}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 300000 });
  return page;
}
const shot = async (page, t) => { await page.evaluate(t => window.renderAt(t), t); return page.screenshot({ type: 'jpeg', quality: 92, timeout: 300000 }); };

async function renderSeg(page, meta, i) {
  const sc = meta.scenes[i];
  const f0 = Math.round(sc.a * 30), f1 = i === meta.scenes.length - 1 ? Math.round(meta.duration * 30) : Math.round(sc.b * 30);
  const fin = path.join(outDir, `seg_${String(i).padStart(2, '0')}.mp4`), tmp = fin.replace('.mp4', '.tmp.mp4');
  if (fs.existsSync(fin) && !process.env.FORCE) { console.log('lewati (sudah ada)', fin); return; }
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-r', '30', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => ff.on('close', r));
  const st = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = await shot(page, f / 30);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 90 === 0) console.log(`seg ${i} frame ${f - f0}/${f1 - f0} ${((f - f0) / ((Date.now() - st) / 1000 + 1e-9)).toFixed(2)} fps`);
  }
  ff.stdin.end();
  if (await done !== 0) throw new Error(`ffmpeg gagal di segmen ${i}`);
  fs.renameSync(tmp, fin);
  console.log('ok', fin, f1 - f0, 'frame', ((Date.now() - st) / 1000).toFixed(0), 'dtk');
}

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const b0 = await chromium.launch({ args: ARGS });
  const p0 = await openPage(b0, port);
  const meta = await p0.evaluate(() => ({ duration: window.DURATION, scenes: window.SCENES, cues: window.CUES, marks: window.MARKS }));
  if (mode === 'info') {
    console.log(JSON.stringify(meta));
  } else if (mode === 'preview') {
    fs.mkdirSync(outDir, { recursive: true });
    for (const s of arg.split(',')) { const t = parseFloat(s); fs.writeFileSync(path.join(outDir, `t_${t.toFixed(2)}.jpg`), await shot(p0, t)); console.log('frame', t); }
  } else if (mode === 'cover') {
    // sampul tanpa subtitle: <dir>/cover.jpg pada detik <arg> ('-' = MARKS.cover dari template, bawaan 1,2)
    fs.mkdirSync(outDir, { recursive: true });
    await p0.addStyleTag({ content: '.subs { visibility: hidden !important; }' });
    const t = arg && arg !== '-' ? parseFloat(arg) : (meta.marks && meta.marks.cover) || 1.2;
    fs.writeFileSync(path.join(outDir, 'cover.jpg'), await shot(p0, t));
    console.log('sampul', t);
  } else if (mode === 'segs') {
    fs.mkdirSync(outDir, { recursive: true });
    const idx = arg === 'all' ? meta.scenes.map((_, i) => i) : arg.split(',').map(Number);
    const len = i => (i === meta.scenes.length - 1 ? meta.duration : meta.scenes[i].b) - meta.scenes[i].a;
    const queue = idx.sort((x, y) => len(y) - len(x));
    const n = Math.max(1, Math.min(+process.env.WORKERS || 1, queue.length));
    const worker = async (k) => {
      const b = k === 0 ? b0 : await chromium.launch({ args: ARGS });
      const page = k === 0 ? p0 : await openPage(b, port);
      while (queue.length) await renderSeg(page, meta, queue.shift());
      if (k !== 0) await b.close();
    };
    await Promise.all(Array.from({ length: n }, (_, k) => worker(k)));
  }
  await b0.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
