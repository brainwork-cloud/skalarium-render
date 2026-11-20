// Skalarium "TEBAK DULU" gaya 2.5D (20 Nov 2026): job.json SAMA dengan tpl/tebak-dulu.js (lihat skema di sana),
// tetapi tanpa WebGL: lapisan DOM + CSS 3D (perspektif, parallax, ikon benda 3D) dan satu kanvas 2D untuk globe.
// Tujuan: render ±5-10x lebih cepat dari versi 3D, benda yang dibahas (subjek.png / ikon_N.png) tetap tampil di tiap adegan.
// Alur dan waktu identik dengan versi 3D: hook -> opsi + hitung mundur -> langkah -> perbandingan -> jawaban -> penutup.
import { W, H, E, clamp, lerp, seg, win, seeded, el, show, pop, makeSubs, timeline, boot } from '/lib/engine.js';

const bell = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
const CHECK = '<svg width="54" height="54" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#5be39a" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mark = s => esc(s).replace(/\*(.+?)\*/g, '<span class="g">$1</span>');
const markLine = s => { const m = /^\*(.+)\*$/.exec(String(s).trim()); return m ? `<span class="hl">${esc(m[1])}</span>` : mark(s); };
const KATA = {
  id: { tebak: 'TEBAK <span class="g">DULU!</span>', jawab: 'JAWABAN', anggap: 'ANGGAP SAJA', fakta: 'FAKTA', follow: '+ FOLLOW SKALARIUM', berikut: ['TEBAKAN', '*BERIKUTNYA?*'], ribu: '.', des: ',' },
  en: { tebak: 'GUESS <span class="g">FIRST!</span>', jawab: 'ANSWER', anggap: 'ASSUME', fakta: 'FACT', follow: '+ FOLLOW SKALARIUM', berikut: ['NEXT', '*QUESTION?*'], ribu: ',', des: '.' },
};
const HURUF = ['A', 'B', 'C', 'D'];
const COL = { emas: '#f5c542', biru: '#5ad1ff', hijau: '#5be39a', merah: '#ff5d5d', ungu: '#a78bfa', putih: '#e8eefc' };
const PALET = [COL.biru, COL.ungu, COL.merah, COL.hijau, COL.putih];
const f1 = x => x.toFixed(1), f3 = x => x.toFixed(3);
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(clamp(v * k, 0, 255))); return `rgb(${c.join(',')})`; };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

const CSS = `
#gl { display: none; }
#w25 { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; overflow: hidden; }
#w25 div, #w25 img, #w25 canvas { position: absolute; }
.L { left: 0; top: 0; width: 1080px; height: 1920px; }
.bk { border-radius: 50%; }
.dust { width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle, rgba(255,240,200,.95), rgba(255,240,200,0) 70%); }
.ped { left: 240px; width: 600px; height: 150px; border-radius: 50%; background: radial-gradient(ellipse at 50% 35%, #2a3150, #10131f 60%, #07080d); box-shadow: 0 0 0 4px rgba(245,197,66,.85), 0 0 60px rgba(245,197,66,.45), 0 40px 80px rgba(0,0,0,.7); }
.ped2 { left: 200px; width: 680px; height: 120px; border-radius: 50%; background: radial-gradient(ellipse, rgba(0,0,0,.65), rgba(0,0,0,0) 70%); }
.cone { left: 140px; width: 800px; height: 1300px; clip-path: polygon(41% 0, 59% 0, 100% 100%, 0 100%); background: linear-gradient(rgba(255,238,200,.22), rgba(255,238,200,.04) 75%, rgba(255,238,200,0)); }
.sub { filter: drop-shadow(0 30px 40px rgba(0,0,0,.55)) drop-shadow(0 0 40px rgba(245,197,66,.25)); }
.qm { font-family: 'Anton', sans-serif; font-size: 560px; line-height: 1; width: 600px; left: 240px; text-align: center; background: linear-gradient(180deg, #fff3c4, #f5c542 45%, #a8781a); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 30px 40px rgba(0,0,0,.6)); }
.halo { border-radius: 50%; background: radial-gradient(circle, rgba(245,197,66,.42), rgba(245,197,66,.12) 40%, rgba(245,197,66,0) 70%); }
.rays { border-radius: 50%; background: repeating-conic-gradient(rgba(255,226,140,.20) 0 6deg, rgba(255,226,140,0) 6deg 18deg); -webkit-mask: radial-gradient(circle, #000 10%, transparent 70%); mask: radial-gradient(circle, #000 10%, transparent 70%); }
.plane { left: -160px; top: 300px; width: 1400px; height: 1400px; transform-style: preserve-3d; }
.floor { left: 0; top: 0; width: 1400px; height: 1400px; border-radius: 40px; background-color: #0b1120; background-image: linear-gradient(rgba(90,209,255,.30) 2px, transparent 2px), linear-gradient(90deg, rgba(90,209,255,.30) 2px, transparent 2px); background-size: 116px 116px; background-position: 0 0; -webkit-mask: radial-gradient(circle at 50% 50%, #000 38%, transparent 70%); mask: radial-gradient(circle at 50% 50%, #000 38%, transparent 70%); }
.cell { left: 0; top: 0; width: 0; height: 0; transform-style: preserve-3d; }
.cell .sh { left: -40px; top: -16px; width: 80px; height: 32px; border-radius: 50%; background: radial-gradient(ellipse, rgba(0,0,0,.6), rgba(0,0,0,0) 70%); }
.cell .ic { left: -46px; top: -88px; width: 92px; height: 92px; transform-origin: 50% 100%; }
.cell .tl { left: -40px; top: -86px; width: 80px; height: 80px; border-radius: 16px; transform-origin: 50% 100%; box-shadow: inset 0 -10px 0 rgba(0,0,0,.25), inset 0 6px 0 rgba(255,255,255,.35), 0 8px 18px rgba(0,0,0,.45); }
.uframe { left: -80px; top: -80px; width: 160px; height: 160px; border: 6px solid #f5c542; border-radius: 18px; box-shadow: 0 0 30px rgba(245,197,66,.8), inset 0 0 30px rgba(245,197,66,.5); }
.bar { border-radius: 14px 14px 4px 4px; transform-origin: 50% 100%; }
.bar i { position: absolute; left: 100%; top: 10px; width: 26px; height: 100%; transform: skewY(-35deg); transform-origin: 0 0; border-radius: 0 8px 0 0; }
.bar b { position: absolute; left: 10px; top: 8px; width: calc(100% - 20px); height: 12px; border-radius: 8px; background: rgba(255,255,255,.35); }
.sq { box-sizing: border-box; border-radius: 10px; transform-origin: 50% 100%; }
.ball { border-radius: 50%; transform-origin: 50% 100%; }
.baseline { left: 70px; width: 900px; height: 4px; border-radius: 2px; background: linear-gradient(90deg, rgba(90,209,255,0), rgba(90,209,255,.7), rgba(90,209,255,0)); }
.vig { left: 0; top: 0; width: 1080px; height: 1920px; background: radial-gradient(ellipse 75% 60% at 50% 52%, rgba(0,0,0,0) 55%, rgba(0,0,0,.6)); }
.grain { left: -64px; top: -64px; width: 1208px; height: 2048px; opacity: .06; }
.fl { left: 0; top: 0; width: 1080px; height: 1920px; background: #fff; }
.fade { left: 0; top: 0; width: 1080px; height: 1920px; background: #000; }
`;

boot(async (info, D) => {
  const lang = D.bahasa === 'en' ? 'en' : 'id';
  const K = KATA[lang];
  const fmt = (n, dec = 0) => {
    const s = Math.abs(n).toFixed(dec).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, K.ribu);
    return (n < 0 ? '-' : '') + s.join(K.des);
  };
  const keys = info.map(x => x.key);
  const kOps = D.opsi_baris && keys.includes(D.opsi_baris) ? D.opsi_baris : keys[1];
  const pen = D.penutup || {};
  const kOut = pen.baris && keys.includes(pen.baris) ? pen.baris : keys[keys.length - 1];
  const gaps = Object.fromEntries(keys.map(k => [k, 0.32]));
  gaps[kOps] = 2.75;
  const T = timeline(info, gaps, 0.25);
  const L = T.L;
  const END = +(L[kOut].t1 + 1.4).toFixed(3);

  const steps = (D.langkah || []).filter(s => L[s.baris]).map(s => ({ ...s, t: L[s.baris].t0 })).sort((a, b) => a.t - b.t);
  const BD = D.banding && L[D.banding.baris] && (D.banding.item || []).length ? D.banding : null;
  const JW = D.jawaban || {};
  const kAns = JW.baris && L[JW.baris] ? JW.baris : BD ? BD.baris : keys[Math.max(2, keys.length - 2)];
  const benar = clamp(Math.round(D.benar ?? 0), 0, 2);
  const opsi = (D.opsi || []).slice(0, 3);
  while (opsi.length < 3) opsi.push('...');

  // ---------------------------------------------------------------- waktu kunci (sama dengan versi 3D)
  const LO = L[kOps];
  const optT = (() => {
    const ws = LO.words || [];
    const clean = w => w.w.replace(/[^\p{L}\p{N}]/gu, '');
    const idx = HURUF.slice(0, 3).map(h => ws.findIndex(w => clean(w) === h));
    if (idx.every(i => i >= 0) && idx[0] < idx[1] && idx[1] < idx[2]) return idx.map(i => LO.t0 + ws[i].a);
    const st = [0]; ws.forEach((w, j) => { if (/[.?!]$/.test(w.w) && j < ws.length - 1) st.push(j + 1); });
    if (st.length === 3) return st.map(j => LO.t0 + ws[j].a);
    return [0, 1, 2].map(i => LO.t0 + (LO.dur * i) / 3);
  })();
  const tCount = LO.t1 + 0.12;
  const firstD = steps.length ? steps[0].t : BD ? L[BD.baris].t0 : L[kAns].t0;
  const tDive = firstD - 0.12;
  const tCmp = BD ? L[BD.baris].t0 - 0.12 : null;
  let tAns = JW.kata ? L[kAns].w(JW.kata) : L[kAns].t0 + 0.2;
  if (tCmp !== null && BD.baris === kAns) tAns = Math.max(tAns, tCmp + 1.4);
  const tOut = L[kOut].t0 - 0.12;
  const tNext = pen.kata ? L[kOut].w(pen.kata) : L[kOut].t0 + 0.1;
  const tFollow = Math.max(tNext + 0.4, L[kOut].w(pen.kata_follow || 'follow') - 0.05);
  const setAt = t => (t < tDive || t >= tOut ? 'A' : tCmp !== null && t >= tCmp ? 'C' : 'D');
  const hitungS = steps.find(s => s.jenis === 'hitung');
  const anggapS = steps.find(s => s.jenis === 'anggap');
  const rumusS = steps.find(s => s.jenis === 'rumus');

  const R = seeded(4242);
  const cues = [];
  const cue = (t, k, v = 1) => { if (t >= 0 && t < END) cues.push({ t: +t.toFixed(3), k, v }); };

  // ---------------------------------------------------------------- dunia 2.5D (di bawah overlay teks)
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const wrap = document.getElementById('wrap');
  const world = document.createElement('div'); world.id = 'w25'; wrap.insertBefore(world, document.getElementById('ov'));
  const mk = (parent, cls = '', style = {}, html = '') => { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, style); if (html) d.innerHTML = html; parent.appendChild(d); return d; };
  const JOBDIR = (new URLSearchParams(location.search).get('job') || '.').replace(/\/$/, '');
  const imgs = [];
  const ikonSrc = f => (f && /^[\w.-]+\.png$/i.test(String(f)) ? `${JOBDIR}/${f}` : null);
  const okSrc = async src => { if (!src) return null; try { const r = await fetch(src, { method: 'HEAD' }); return r.ok ? src : null; } catch (e) { return null; } };
  const subjekSrc = await okSrc(ikonSrc(D.subjek));
  const itemSrc = await Promise.all(((D.banding && D.banding.item) || []).map(it => okSrc(ikonSrc(it.ikon))));
  const img = (parent, src, cls, style = {}) => { const i = document.createElement('img'); i.src = src; i.className = cls; Object.assign(i.style, style); parent.appendChild(i); imgs.push(i); return i; };

  const bg = mk(world, 'L');
  // lapisan jauh: titik grid + bokeh (parallax)
  const far = mk(world, 'L', { left: '-120px', top: '-120px', width: '1320px', height: '2160px', backgroundImage: 'radial-gradient(rgba(150,190,255,.16) 2px, transparent 2.5px)', backgroundSize: '54px 54px' });
  const bokeh = Array.from({ length: 16 }, (_, i) => {
    const s = 90 + R() * 260, hue = R() < 0.35 ? '245,197,66' : R() < 0.5 ? '167,139,250' : '90,209,255';
    return { d: mk(world, 'bk', { width: `${s}px`, height: `${s}px`, background: `radial-gradient(circle, rgba(${hue},${(0.10 + R() * 0.12).toFixed(2)}), rgba(${hue},0) 70%)` }), x: R() * 1080, y: R() * 1920, s, k: 0.3 + R() * 0.9, ph: R() * 6.28 };
  });

  // ================= SET A: panggung (atau globe) + benda utama
  const A = mk(world, 'L');
  const latar = D.latar === 'panggung' ? 'panggung' : 'bumi';
  let globe = null;
  const SA = { cx: 540, cy: 1010 };
  const cone = mk(A, 'cone', { top: '-160px' });
  const halo = mk(A, 'halo', { left: '90px', top: `${SA.cy - 450}px`, width: '900px', height: '900px' });
  const rays = mk(A, 'rays', { left: '-60px', top: `${SA.cy - 600}px`, width: '1200px', height: '1200px' });
  let ped = null, ped2 = null, hero = null;
  const dust = [];
  if (latar === 'bumi') {
    cone.style.display = 'none';
    const topo = await (await fetch('/node_modules/world-atlas/countries-110m.json')).json();
    const feats = window.topojson.feature(topo, topo.objects.countries).features;
    const sorot = String((D.bumi && D.bumi.sorot) ?? (lang === 'id' ? '360' : ''));
    const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 1000; cv.className = ''; Object.assign(cv.style, { left: '40px', top: `${SA.cy - 500}px`, width: '1000px', height: '1000px' }); A.appendChild(cv);
    const polys = feats.map(f => ({ hi: sorot && f.id === sorot, p: f.geometry ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []) : [] }));
    globe = { cv, g: cv.getContext('2d'), polys, lat0: D.bumi?.lat ?? -2.5, lon0: D.bumi?.lon ?? 118, mark: D.bumi && D.bumi.lat !== undefined };
  } else {
    ped2 = mk(A, 'ped2', { top: `${SA.cy + 250}px` });
    ped = mk(A, 'ped', { top: `${SA.cy + 170}px` });
    hero = subjekSrc ? img(A, subjekSrc, 'sub', { left: '300px', top: `${SA.cy - 300}px`, width: '480px', height: '480px' })
      : mk(A, 'qm', { top: `${SA.cy - 380}px` }, '?');
    for (let i = 0; i < 46; i++) dust.push({ d: mk(A, 'dust'), x: 300 + R() * 480, y0: R(), sp: 0.04 + R() * 0.07, s: 0.5 + R() * 1.6, k: R() });
  }

  // ================= SET D: lantai miring berisi benda (ladang hitung)
  const Dset = mk(world, 'L', { perspective: '1700px', perspectiveOrigin: '540px 760px' });
  const plane = mk(Dset, 'plane');
  mk(plane, 'floor');
  const NC = subjekSrc ? 9 : 11, SP = subjekSrc ? 112 : 96;
  const cells = [];
  for (let i = 0; i < NC; i++) for (let j = 0; j < NC; j++) {
    const x = (i - (NC - 1) / 2) * SP, y = (j - (NC - 1) / 2) * SP;
    cells.push({ x, y, d: Math.hypot(x, y) / SP + R() * 0.8, big: R() < 0.12, gold: R() < 0.08 });
  }
  cells.sort((a, b) => a.d - b.d);
  cells.forEach((c, k) => {
    c.k = k / cells.length;
    c.el = mk(plane, 'cell');
    mk(c.el, 'sh');
    if (subjekSrc) c.ic = img(c.el, subjekSrc, 'ic');
    else { const col = c.gold ? COL.emas : R() < 0.5 ? COL.biru : '#cfe6ff'; c.ic = mk(c.el, 'tl', { background: `linear-gradient(160deg, ${shade(col, 1.15)}, ${shade(col, 0.7)})` }); }
  });
  const unit = mk(plane, 'cell');
  const uframe = mk(unit, 'uframe');
  const unitIc = subjekSrc ? img(unit, subjekSrc, 'ic', { left: '-95px', top: '-190px', width: '190px', height: '190px' }) : mk(unit, 'tl', { left: '-62px', top: '-130px', width: '124px', height: '124px', background: 'linear-gradient(160deg,#ffe58a,#c8901c)' });
  const blockC = mk(plane, 'cell');
  const blockRays = mk(blockC, 'rays', { left: '-450px', top: '-450px', width: '900px', height: '900px' });
  const blockIc = subjekSrc ? img(blockC, subjekSrc, 'ic sub', { left: '-230px', top: '-460px', width: '460px', height: '460px' }) : mk(blockC, 'tl', { left: '-170px', top: '-340px', width: '340px', height: '340px', borderRadius: '40px', background: 'linear-gradient(160deg,#ffe58a,#c8901c)' });

  // ================= SET C: perbandingan 2D (batang / kotak / bola), pita y 720-1265 seperti versi 3D
  const Cset = mk(world, 'L');
  const items = [];
  const BASE = 1285, TOP = 720, X0 = 110, X1 = 920;
  if (BD) {
    const jenis = ['kotak', 'batang', 'bola'].includes(BD.jenis) ? BD.jenis : 'batang';
    const vmax = Math.max(...BD.item.map(x => Math.max(1e-9, +x.nilai || 0)));
    let pi = 0;
    const list = [];
    BD.item.forEach((it, idx) => {
      const col = it.utama ? COL.emas : COL[it.warna] ?? PALET[pi++ % PALET.length];
      const n = clamp(Math.round(it.ulang || 1), 1, 6);
      const src = itemSrc[idx] || (it.utama ? subjekSrc : null);
      for (let r = 0; r < n; r++) list.push({ it, idx, col, src, first: r === 0, v: Math.max(1e-9, +it.nilai || 0) / vmax });
    });
    mk(Cset, 'baseline', { top: `${BASE}px` });
    const gapX = 34, avail = X1 - X0;
    if (jenis === 'batang') {
      const w = Math.min(170, (avail - gapX * (list.length - 1)) / list.length - 26);
      const icS = Math.min(150, w * 1.05);
      const hMax = BASE - TOP - icS - 40;
      let x = X0 + (avail - (list.length * (w + 26) + gapX * (list.length - 1))) / 2;
      list.forEach((o, k) => {
        const h = Math.max(10, o.v * hMax);
        const bar = mk(Cset, 'bar', { left: `${f1(x)}px`, top: `${f1(BASE - h)}px`, width: `${f1(w)}px`, height: `${f1(h)}px`, background: `linear-gradient(90deg, ${shade(o.col, 1.1)}, ${shade(o.col, 0.78)})`, boxShadow: `0 0 40px ${rgba(o.col, 0.35)}` });
        bar.innerHTML = `<i style="background:linear-gradient(${shade(o.col, 0.55)}, ${shade(o.col, 0.4)})"></i><b></b>`;
        const ic = o.src ? img(Cset, o.src, 'sub', { left: `${f1(x + w / 2 - icS / 2)}px`, top: `${f1(BASE - h - icS + 6)}px`, width: `${f1(icS)}px`, height: `${f1(icS)}px` }) : null;
        items.push({ ...o, k, el: bar, ic, cx: x + w / 2, topY: BASE - h - (ic ? icS : 0) - 10, kind: 'bar' });
        x += w + 26 + gapX;
      });
    } else {
      const sz = list.map(o => (jenis === 'kotak' ? Math.sqrt(o.v) : Math.cbrt(o.v)));
      const sum = sz.reduce((a, b) => a + b, 0);
      const scale = Math.min((avail - gapX * (list.length - 1)) / sum, (BASE - TOP - 90) / Math.max(...sz));
      let x = X0 + (avail - (sum * scale + gapX * (list.length - 1))) / 2;
      list.forEach((o, k) => {
        const s = Math.max(14, sz[k] * scale);
        let node;
        if (jenis === 'kotak') node = mk(Cset, 'sq', { left: `${f1(x)}px`, top: `${f1(BASE - s)}px`, width: `${f1(s)}px`, height: `${f1(s)}px`, border: `5px solid ${o.col}`, background: rgba(o.col, o.it.utama ? 0.32 : 0.16), boxShadow: `0 0 36px ${rgba(o.col, 0.45)}, inset 0 0 40px ${rgba(o.col, 0.25)}` });
        else {
          mk(Cset, 'ped2', { left: `${f1(x - s * 0.1)}px`, top: `${f1(BASE - s * 0.1)}px`, width: `${f1(s * 1.2)}px`, height: `${f1(s * 0.22)}px` });
          node = mk(Cset, 'ball', { left: `${f1(x)}px`, top: `${f1(BASE - s)}px`, width: `${f1(s)}px`, height: `${f1(s)}px`, background: `radial-gradient(circle at 35% 30%, ${shade(o.col, 1.35)}, ${o.col} 35%, ${shade(o.col, 0.45)} 85%)`, boxShadow: `0 0 50px ${rgba(o.col, 0.35)}` });
        }
        const icS = clamp(s * 0.55, 70, 160);
        const ic = o.src ? img(Cset, o.src, 'sub', { left: `${f1(x + s / 2 - icS / 2)}px`, top: `${f1(s > icS * 1.3 ? BASE - s / 2 - icS / 2 : BASE - s - icS)}px`, width: `${f1(icS)}px`, height: `${f1(icS)}px` }) : null;
        const topY = s > icS * 1.3 || !ic ? BASE - s - 10 : BASE - s - icS - 10;
        items.push({ ...o, k, el: node, ic, cx: x + s / 2, topY, kind: jenis });
        x += s + gapX;
      });
    }
  }

  // efek layar penuh
  const vig = mk(world, 'vig');
  const gc = document.createElement('canvas'); gc.width = 302; gc.height = 512;
  { const g = gc.getContext('2d'), id = g.createImageData(302, 512); for (let i = 0; i < id.data.length; i += 4) { const v = Math.floor(R() * 255); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); }
  const grain = mk(world, 'grain', { backgroundImage: `url(${gc.toDataURL()})`, backgroundSize: '302px 512px', mixBlendMode: 'overlay' });
  const flash = mk(world, 'fl');
  const fade = mk(world, 'fade');
  await Promise.all(imgs.map(i => i.decode().catch(() => { i.style.display = 'none'; })));

  // ================================================================ overlay teks (sama dengan versi 3D)
  const dim = el('', 'dim');
  const topfade = el('', 'topfade');
  const pill = el(`<span class="dot"></span>${esc(D.seri || 'TEBAK DULU')}`, 'pill');
  const brand = el('<i></i>SKALARIUM', 'brand');
  const hookLines = Array.isArray(D.hook) ? D.hook : String(D.hook || '').split('|');
  const hookLen = Math.max(...hookLines.map(s => String(s).replace(/\*/g, '').length), 8);
  const head1 = el(hookLines.map(markLine).join('<br>'), 'head', { fontSize: `${Math.round(clamp(1500 / hookLen, 92, 140))}px` });
  const head2 = el(K.tebak, 'head c mid');
  const optLen = Math.max(...opsi.map(s => String(s).length));
  const opts = opsi.map((s, i) => el(`<div class="b">${HURUF[i]}</div><span>${mark(s)}</span><span class="ck"></span>`, 'opt', { top: `${700 + i * 172}px`, fontSize: `${optLen > 22 ? 40 : 50}px` }));
  const ring = el(`<svg width="190" height="190"><circle cx="95" cy="95" r="80" fill="rgba(8,12,22,.88)" stroke="rgba(255,255,255,.14)" stroke-width="12"/><circle class="arc" cx="95" cy="95" r="80" fill="none" stroke="#F5C542" stroke-width="12" stroke-linecap="round" transform="rotate(-90 95 95)" stroke-dasharray="502.65" stroke-dashoffset="0"/></svg><div class="n">3</div>`, 'ring', { left: '445px', top: '1240px' });
  const arc = ring.querySelector('.arc'), ringN = ring.querySelector('.n');
  const stepEls = steps.map(s => {
    if (s.jenis === 'hitung') { const d = el(`<span class="num">0</span><span class="u">${esc(s.satuan || '')}</span>`, 'count'); d.num = d.querySelector('.num'); return d; }
    if (s.jenis === 'anggap') return el(`<div class="k">${esc(s.label || K.anggap)}</div><div class="v">${mark(s.teks)}</div>`, 'clue');
    if (s.jenis === 'rumus') { const d = el(mark(s.teks), 'eq', { top: '300px' }); d.big = s.hasil ? el(`${mark(s.hasil)}${s.sub ? `<span class="u">${esc(s.sub)}</span>` : ''}`, 'count', { top: '390px', fontSize: `${s.hasil.length > 12 ? 120 : 150}px` }) : null; return d; }
    return el(`<div class="k">${esc(s.label || K.fakta)}</div><div class="v">${mark(s.teks)}</div>`, 'tip');
  });
  const tags = items.filter(o => o.first).map((o, j) => {
    const val = o.it.teks || '';
    const d = el(`${esc(o.it.label || '')}${val ? ` <b style="color:${o.col};margin:0 0 0 6px">${esc(val)}</b>` : ''}`, 'tag', { borderColor: o.col, background: 'rgba(8,12,22,.9)', fontSize: o.it.utama ? '34px' : '28px' });
    d.style.left = `${f1(clamp(o.cx, 200, 860))}px`; d.style.top = `${f1(Math.max(TOP - 40, o.topY - 30 - (j % 2) * 56))}px`;
    return { o, d };
  });
  const ans = el(`${K.jawab}: ${HURUF[benar]}`, 'ans', { top: '300px' });
  const winOpt = el(`<div class="b">${HURUF[benar]}</div><span>${mark(opsi[benar])}</span><span class="ck">${CHECK}</span>`, 'opt win', { top: '440px', fontSize: `${optLen > 22 ? 40 : 50}px` });
  const ansSub = JW.sub ? el(mark(JW.sub), 'eq', { top: '620px' }) : null;
  let lab3 = null;
  if (globe && globe.mark && D.bumi.label) lab3 = el(`<div class="bx" style="bottom:120px">${esc(D.bumi.label)}</div><div class="st" style="height:120px"></div><div class="dt"></div>`, 'l3', { transformOrigin: '0 0' });
  const head9 = el((pen.teks || K.berikut).map(markLine).join('<br>'), 'head c');
  const follow = el(esc(pen.follow || K.follow), 'follow', { top: '1120px' });
  const subs = makeSubs(T.arr);

  // ================================================================ cue (sama dengan versi 3D)
  cue(0, 'hit'); cue(0, 'music', 1);
  optT.forEach(t => cue(t + 0.05, 'pop'));
  cue(tCount - 0.05, 'music', 0); [0, 1, 2].forEach(i => cue(tCount + i * 0.86, 'tick'));
  cue(tDive - 0.5, 'rise'); cue(tDive, 'whoosh'); cue(tDive, 'boom', 0.7); cue(tDive, 'music', 1);
  steps.forEach((s, i) => { if (i) cue(s.t - 0.1, 'swish', 0.7); cue(s.t + 0.05, s.jenis === 'hitung' ? 'roll' : 'pop', 0.9); if (s.jenis === 'rumus' && s.hasil) cue(s.t + 1.0, 'thud', 0.8); });
  if (anggapS) cue(anggapS.t + 0.35, 'thud', 0.7);
  if (tCmp !== null) { cue(tCmp, 'whoosh'); cue(tCmp + 0.05, 'boom', 0.55); items.forEach((o, k) => cue(tCmp + 0.2 + k * 0.22, 'pop', 0.8)); }
  cue(tAns, 'ding'); cue(tAns + 0.05, 'stamp', 0.6);
  cue(tOut, 'whoosh'); cue(tOut + 1.0, 'shimmer'); cue(tFollow, 'pop'); cue(tFollow + 0.05, 'ding');
  cue(END - 0.5, 'music', 0);

  // ---------------------------------------------------------------- globe ortografis (kanvas 2D)
  const D2R = Math.PI / 180;
  function drawGlobe(t) {
    const { g, polys } = globe, r = 440, c = 500;
    const lon0 = globe.lon0 + 14 - t * 0.7 + (t >= tOut ? 6 : 0), lat0 = clamp(globe.lat0, -50, 50) * 0.7;
    const sl = Math.sin(lat0 * D2R), cl = Math.cos(lat0 * D2R);
    const P = (lon, lat) => {
      const l = (lon - lon0) * D2R, p = lat * D2R, cp = Math.cos(p);
      const x = cp * Math.sin(l), y = cl * Math.sin(p) - sl * cp * Math.cos(l), z = sl * Math.sin(p) + cl * cp * Math.cos(l);
      return [c + x * r, c - y * r, z];
    };
    g.clearRect(0, 0, 1000, 1000);
    const atm = g.createRadialGradient(c, c, r * 0.9, c, c, r * 1.16); atm.addColorStop(0, 'rgba(90,170,255,.55)'); atm.addColorStop(1, 'rgba(90,170,255,0)');
    g.fillStyle = atm; g.beginPath(); g.arc(c, c, r * 1.16, 0, 7); g.fill();
    const oc = g.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r); oc.addColorStop(0, '#1b5a9a'); oc.addColorStop(1, '#07203f');
    g.fillStyle = oc; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(c, c, r, 0, 7); g.clip();
    for (const f of polys) {
      g.beginPath(); let any = false;
      for (const poly of f.p) for (const ring of poly) {
        let open = false;
        for (const [lon, lat] of ring) {
          const [x, y, z] = P(lon, lat);
          if (z < 0) { open = false; continue; }
          any = true;
          if (!open) { g.moveTo(x, y); open = true; } else g.lineTo(x, y);
        }
        g.closePath();
      }
      if (!any) continue;
      g.fillStyle = f.hi ? '#f2c14e' : '#2f8a6a'; g.fill('evenodd');
      g.strokeStyle = f.hi ? 'rgba(255,240,190,.95)' : 'rgba(150,230,190,.35)'; g.lineWidth = f.hi ? 2.2 : 1; g.stroke();
    }
    const sh = g.createRadialGradient(c - r * 0.45, c - r * 0.5, r * 0.2, c, c, r * 1.02); sh.addColorStop(0, 'rgba(255,255,255,.10)'); sh.addColorStop(0.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,10,.55)');
    g.fillStyle = sh; g.fillRect(0, 0, 1000, 1000);
    g.restore();
    let mp = null;
    if (globe.mark) {
      const [x, y, z] = P(globe.lon0, globe.lat0);
      if (z > 0) {
        mp = { x: x + 40, y: y + SA.cy - 500 };
        const on = t >= tOut ? seg(t, tOut + 0.6, tOut + 1.0) : 0, ph = ((t - tOut) % 1.4) / 1.4;
        if (on > 0) {
          g.strokeStyle = `rgba(245,197,66,${f3(on * (1 - ph))})`; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 10 + ph * 70, 0, 7); g.stroke();
          g.fillStyle = `rgba(255,240,176,${f3(on)})`; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
        }
      }
    }
    return mp;
  }

  // ================================================================ render per frame
  function render(t) {
    const set = setAt(t);
    show(A, set === 'A' ? 1 : 0); show(Dset, set === 'D' ? 1 : 0); show(Cset, set === 'C' ? 1 : 0);
    // latar per set
    bg.style.background = set === 'D' ? 'radial-gradient(ellipse 90% 70% at 50% 45%, #13203a, #060a14 70%)'
      : set === 'C' ? 'radial-gradient(ellipse 90% 70% at 50% 60%, #14222a, #070c12 72%)'
        : latar === 'bumi' ? 'radial-gradient(ellipse 80% 60% at 50% 52%, #0a1630, #02040a 70%)' : 'radial-gradient(ellipse 80% 55% at 50% 50%, #1d1440, #05060f 72%)';
    // parallax: kamera virtual bergerak pelan; lapisan jauh bergeser paling sedikit
    const camX = Math.sin(t * 0.21) * 24, camY = Math.sin(t * 0.17 + 1) * 18;
    far.style.transform = `translate(${f1(camX * 0.3)}px, ${f1(camY * 0.3 - (t * 6) % 54)}px)`;
    for (const b of bokeh) {
      const y = ((b.y - t * 22 * b.k) % 2100 + 2100) % 2100 - 180;
      b.d.style.transform = `translate(${f1(b.x + Math.sin(t * 0.4 + b.ph) * 30 + camX * b.k - b.s / 2)}px, ${f1(y + camY * b.k - b.s / 2)}px)`;
    }
    // transisi potong: kilat + zoom
    let zb = 0, fl = 0;
    const cuts = [tDive, tOut]; if (tCmp !== null) cuts.push(tCmp);
    for (const k of cuts) { zb = Math.max(zb, bell(t, k, 0.09)); fl = Math.max(fl, bell(t, k, 0.035) * 0.45); }
    zb = Math.max(zb, bell(t, tDive - 0.12, 0.12) * 0.8);
    show(flash, fl);
    show(fade, seg(t, END - 0.35, END));
    { const fr = Math.round(t * 30), h = v => { const x = Math.sin(fr * 12.9898 + v * 78.233) * 43758.5453; return x - Math.floor(x); }; grain.style.transform = `translate(${Math.floor(h(1) * 64)}px, ${Math.floor(h(2) * 64)}px)`; }
    show(vig, 1);

    if (set === 'A') {
      const push = t < tOut ? 1 + 0.06 * E.sine(seg(t, 0, tDive)) + 0.5 * E.i(seg(t, tDive - 0.5, tDive)) : 1.25 - 0.25 * E.o(seg(t, tOut, tOut + 2.2));
      A.style.transform = `translate(${f1(camX * 0.6)}px, ${f1(camY * 0.6)}px) scale(${f3(push + zb * 0.15)})`;
      A.style.transformOrigin = `540px ${SA.cy}px`;
      show(halo, 0.85 + Math.sin(t * 2.1) * 0.15, `scale(${f3(1 + Math.sin(t * 1.3) * 0.04)})`);
      show(rays, latar === 'bumi' ? 0 : 0.55, `rotate(${f1(t * 6)}deg)`);
      if (globe) {
        const mp = drawGlobe(t);
        if (lab3) {
          const on = mp && t >= tOut;
          if (on) { lab3.style.left = `${f1(mp.x)}px`; lab3.style.top = `${f1(mp.y)}px`; }
          const i = E.o5(seg(t, tOut + 0.9, tOut + 1.25)), o = 1 - seg(t, tNext - 0.2, tNext);
          show(lab3, on ? Math.min(i, o) : 0, `scale(${f3(lerp(0.5, 1, i))})`);
        }
      } else {
        const bob = Math.sin(t * 1.3) * 16;
        const tilt = Math.sin(t * 0.7) * 14;
        hero.style.transform = `perspective(1400px) translateY(${f1(bob)}px) rotateY(${f1(tilt)}deg) scale(${f3(1 + Math.sin(t * 0.9) * 0.03)})`;
        show(cone, 0.9 + Math.sin(t * 2.1) * 0.1);
        for (const p of dust) {
          const y = SA.cy + 220 - ((p.y0 + t * p.sp) % 1) * 1100;
          const a = Math.sin(((p.y0 + t * p.sp) % 1) * Math.PI) * (0.3 + 0.6 * p.k);
          show(p.d, a, `translate(${f1(p.x + Math.sin(t * 0.8 + p.k * 9) * 30)}px, ${f1(y)}px) scale(${f3(p.s)})`);
        }
      }
    } else if (lab3) show(lab3, 0);

    if (set === 'D') {
      const fill = hitungS ? E.o(seg(t, hitungS.t + 0.1, hitungS.t + 2.2)) : E.o(seg(t, tDive, tDive + 1.2));
      const col = rumusS ? E.io(seg(t, rumusS.t + 0.1, rumusS.t + 1.3)) : 0;
      const sinkEnd = (rumusS ? rumusS.t : tCmp ?? tOut) - 0.2;
      const sink = anggapS ? win(t, anggapS.t, sinkEnd, 0.5) : 0;
      // kamera: [skala, kemiringan X, putaran Z awal, geser Y] per jenis langkah
      const target = s => (!s ? [0.78, 62, -18, 40] : s.jenis === 'anggap' ? [1.25, 54, -8, -170] : s.jenis === 'rumus' ? [0.85, 50, -12, 80] : s.jenis === 'hitung' ? [0.78, 62, -18, 40] : [0.84, 60, -14, 20]);
      let cur = target(null), prev = cur;
      for (const s of steps) {
        if (t < s.t - 0.12) break;
        const tg = target(s), u = E.io(seg(t, s.t - 0.12, s.t + 0.9));
        cur = prev.map((v, i) => lerp(v, tg[i], u)); prev = tg;
      }
      const enter = 1 - E.o(seg(t, tDive, tDive + 0.9));
      const [sc, rx, rz0, ty] = cur;
      const rz = rz0 + (t - tDive) * 3.2;
      plane.style.transform = `translateY(${f1(ty + enter * 260)}px) rotateX(${f1(rx + enter * 12)}deg) rotateZ(${f1(rz)}deg) scale3d(${f3(sc * (1 - enter * 0.25) + zb * 0.12)}, ${f3(sc * (1 - enter * 0.25) + zb * 0.12)}, ${f3(sc * (1 - enter * 0.25) + zb * 0.12)})`;
      const uprt = `rotateZ(${f1(-rz)}deg) rotateX(${f1(-(rx + enter * 12))}deg)`;
      for (const c of cells) {
        const ap = clamp((fill - c.k) * 9);
        const s = Math.max(0.0001, E.back(ap) * (1 - col) * (1 - sink * 0.45) * (c.big ? 1.25 : 1));
        const x = lerp(c.x, 0, col * col) + 700, y = lerp(c.y, 0, col * col) + 700;
        const lift = (1 - E.o(ap)) * 120 + col * 90 + Math.sin(t * 1.6 + c.d * 2) * 4;
        c.el.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0)`;
        c.el.style.visibility = s < 0.01 ? 'hidden' : 'visible';
        c.ic.style.transform = `${uprt} translateY(${f1(-lift)}px) scale(${f3(s)})`;
        c.el.firstChild.style.opacity = f3(clamp(s) * (1 - sink * 0.5));
        c.ic.style.filter = sink > 0.01 ? `brightness(${f3(1 - sink * 0.45)})` : '';
      }
      // satuan "anggap saja" di depan
      const uIn = anggapS ? E.back(seg(t, anggapS.t + 0.2, anggapS.t + 0.65)) : 0;
      const uOut = anggapS ? 1 - seg(t, sinkEnd - 0.1, sinkEnd + 0.4) : 0;
      const us = Math.max(0.0001, Math.min(uIn, uOut));
      unit.style.visibility = us > 0.001 ? 'visible' : 'hidden';
      unit.style.transform = `translate3d(700px, ${f1(700 + 380)}px, 0)`;
      uframe.style.transform = `scale(${f3(us * (1.1 + 0.06 * Math.sin(t * 4)))}) rotate(45deg)`;
      unitIc.style.transform = `${uprt} translateY(${f1(-30 * us + Math.sin(t * 2) * 6)}px) scale(${f3(us)})`;
      // hasil rumus: benda besar + sinar
      const bs = rumusS ? E.back(seg(t, rumusS.t + 0.9, rumusS.t + 1.5)) : 0;
      blockC.style.visibility = bs > 0.001 ? 'visible' : 'hidden';
      blockC.style.transform = 'translate3d(700px, 700px, 0)';
      blockRays.style.transform = `${uprt} translateY(-230px) rotate(${f1(t * 20)}deg) scale(${f3(Math.max(0.0001, bs))})`;
      blockIc.style.transform = `${uprt} translateY(${f1(Math.sin(t * 1.2) * 10)}px) scale(${f3(Math.max(0.0001, bs))})`;
    }

    if (set === 'C') {
      const u0 = E.sine(seg(t, tCmp, tOut));
      const enter = 1 - E.o5(seg(t, tCmp, tCmp + 1.1));
      Cset.style.transformOrigin = '540px 1265px';
      Cset.style.transform = `translate(${f1(camX * 0.4 - 20 + 40 * u0)}px, ${f1(enter * 120)}px) scale(${f3(1.04 - 0.04 * u0 + enter * 0.2 + zb * 0.1)}) rotate(${f3(enter * 2.5)}deg)`;
      items.forEach(o => {
        const a = tCmp + 0.2 + o.k * 0.22, u = E.back(seg(t, a, a + 0.45));
        const g = bell(t, tAns + 0.1, 0.25) * (o.it.utama ? 1 : 0);
        o.el.style.visibility = t >= a ? 'visible' : 'hidden';
        o.el.style.transform = o.kind === 'bar' ? `scaleY(${f3(Math.max(0.0001, u))})` : `scale(${f3(Math.max(0.0001, u))})`;
        o.el.style.filter = g > 0.01 ? `brightness(${f3(1 + g * 0.8)})` : '';
        if (o.ic) {
          const ui = E.back(seg(t, a + 0.25, a + 0.6));
          show(o.ic, t >= a + 0.25 ? 1 : 0, `translateY(${f1(Math.sin(t * 1.5 + o.k) * 6)}px) scale(${f3(Math.max(0.0001, ui))})`);
        }
      });
    }

    // ---------------------------------------------------------------- overlay
    show(pill, 1); show(brand, 1);
    show(head1, 1 - seg(t, LO.t0 - 0.1, LO.t0 + 0.1), `scale(${f3(1.06 - 0.06 * E.o5(seg(t, 0, 0.5)))})`);
    show(dim, win(t, LO.t0 - 0.05, tDive - 0.1, 0.25) * 0.85);
    pop(head2, t, LO.t0, tDive - 0.12);
    opts.forEach((d, i) => {
      const i0 = E.o5(seg(t, optT[i], optT[i] + 0.35)), o = 1 - seg(t, tDive - 0.15, tDive);
      show(d, Math.min(i0, o), `translateX(${f1((1 - i0) * (i % 2 ? 120 : -120))}px)`);
    });
    {
      const k = t - tCount, n = Math.floor(k / 0.86), on = k >= 0 && t < tDive - 0.1;
      ringN.textContent = String(3 - clamp(n, 0, 2)); arc.setAttribute('stroke-dashoffset', f1(502.65 * clamp((k % 0.86) / 0.86)));
      show(ring, on ? 1 : 0, `scale(${f3(1 + bell(k % 0.86, 0.05, 0.08) * 0.12)})`);
    }
    const stopAt = i => (i + 1 < steps.length ? steps[i + 1].t - 0.12 : tCmp ?? tAns - 0.1);
    steps.forEach((s, i) => {
      const d = stepEls[i], end = Math.min(stopAt(i), tOut - 0.1);
      if (s.jenis === 'hitung') {
        const u = E.o(seg(t, s.t + 0.15, s.t + 2.0));
        d.num.textContent = fmt((+s.nilai || 0) * u, s.desimal || 0);
        pop(d, t, s.t, end, { dy: -20 });
      } else if (s.jenis === 'rumus') {
        pop(d, t, s.t + 0.1, end, { dy: -20 });
        if (d.big) pop(d.big, t, s.t + 1.0, end, { s0: 1.2, dy: 0 });
      } else pop(d, t, s.t + 0.05, end, { dy: -30 });
    });
    tags.forEach(({ o, d }) => {
      const a = tCmp + 0.45 + o.k * 0.22;
      if (set === 'C') pop(d, t, a, tOut - 0.1, { base: 'translate(-50%, -50%)', s0: 0.6, dy: 0 }); else show(d, 0);
    });
    pop(ans, t, tAns, tOut - 0.1, { base: 'translateX(-50%)', s0: 1.4, dy: 0 });
    pop(winOpt, t, tAns + 0.18, tOut - 0.1, { dy: 30 });
    if (ansSub) pop(ansSub, t, tAns + 0.4, tOut - 0.1, { dy: -10 });
    pop(head9, t, tNext, END + 1, { s0: 1.15, dy: 0 });
    pop(follow, t, tFollow, END + 1, { base: 'translateX(-50%)', s0: 0.6, dy: 30 });
    show(topfade, Math.max(1 - seg(t, LO.t0 - 0.1, LO.t0 + 0.2), win(t, tDive + 0.05, tOut, 0.2), seg(t, tNext - 0.2, tNext)) * 0.85);
    subs.update(t);
    if (t > tCount - 0.15 && t < tDive) show(subs.box, 0);
  }

  const raw = [0, LO.t0 + 1.5, tDive, ...steps.map(s => s.t - 0.12), tCmp, tAns - 0.2, tOut, END].filter(x => x !== null && x >= 0 && x <= END).sort((a, b) => a - b);
  const bounds = [];
  for (const b of raw) if (!bounds.length || b - bounds[bounds.length - 1] >= 0.6) bounds.push(+b.toFixed(3));
  if (END - bounds[bounds.length - 1] < 0.6) bounds[bounds.length - 1] = END; else bounds.push(END);
  const scenes = [];
  for (let i = 0; i < bounds.length - 1; i++) scenes.push({ a: bounds[i], b: bounds[i + 1] });
  return { duration: END, cues, scenes, render, marks: { lines: T.arr.map(x => [x.key, +x.t0.toFixed(3)]), END, tCount, tDive, tCmp, tAns, tOut, beds: [] } };
});
