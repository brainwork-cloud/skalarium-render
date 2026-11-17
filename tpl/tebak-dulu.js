// Skalarium "TEBAK DULU" generik (17 Nov 2026): satu template 3D yang diisi job.json dari agen mesin-konten.
// Alur: hook -> 3 opsi + hitung mundur -> langkah (hitung / anggap / rumus / fakta) -> perbandingan -> jawaban -> penutup.
// Data job.json (semua teks dari agen; *kata* = sorot emas, baris hook yang seluruhnya *...* = blok kuning):
// { "template":"tebak-dulu", "bahasa":"id"|"en", "seri":"TEBAK DULU #2 · ...", "latar":"bumi"|"panggung",
//   "bumi":{"lat":-6.2,"lon":106.8,"sorot":"360","label":"..."}, "hook":["...","*...*","..."],
//   "opsi":["...","...","..."], "benar":1,
//   "langkah":[{"baris":"b3","jenis":"hitung","nilai":8300000000,"satuan":"...","desimal":0},
//              {"baris":"b4","jenis":"anggap","label":"ANGGAP SAJA","teks":"1 m² = *4 ORANG*"},
//              {"baris":"b5","jenis":"rumus","teks":"... = *...*","hasil":"± 2.100 km²","sub":"..."},
//              {"baris":"b5","jenis":"fakta","label":"FAKTA","teks":"..."}],
//   "banding":{"baris":"b6","jenis":"kotak"|"batang"|"bola","item":[{"label":"...","nilai":2075,"teks":"2.075 km²","utama":true},
//              {"label":"JAKARTA","nilai":662,"ulang":3}]},
//   "jawaban":{"baris":"b6","kata":"Jawabannya","sub":"..."},
//   "penutup":{"baris":"b7","kata":"Tebakan","teks":["TEBAKAN","*BERIKUTNYA?*"],"kata_follow":"follow"} }
// Baris narasi (info.json): baris pertama = hook, baris kedua = opsi (kecuali "opsi_baris" diisi).
import { THREE, W, H, E, clamp, lerp, seg, win, seeded, makeStage, camAt, applyCam, toScreen, std, canvasTex, shadowAll, particles, el, show, pop, makeSubs, timeline, boot } from '/lib/engine.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const bell = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CHECK = '<svg width="54" height="54" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#5be39a" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mark = s => esc(s).replace(/\*(.+?)\*/g, '<span class="g">$1</span>');
const markLine = s => { const m = /^\*(.+)\*$/.exec(String(s).trim()); return m ? `<span class="hl">${esc(m[1])}</span>` : mark(s); };
const KATA = {
  id: { tebak: 'TEBAK <span class="g">DULU!</span>', jawab: 'JAWABAN', anggap: 'ANGGAP SAJA', fakta: 'FAKTA', follow: '+ FOLLOW SKALARIUM', berikut: ['TEBAKAN', '*BERIKUTNYA?*'], ribu: '.', des: ',' },
  en: { tebak: 'GUESS <span class="g">FIRST!</span>', jawab: 'ANSWER', anggap: 'ASSUME', fakta: 'FACT', follow: '+ FOLLOW SKALARIUM', berikut: ['NEXT', '*QUESTION?*'], ribu: ',', des: '.' },
};
const HURUF = ['A', 'B', 'C', 'D'];
const COL = { emas: 0xf5c542, biru: 0x5ad1ff, hijau: 0x5be39a, merah: 0xff5d5d, ungu: 0xa78bfa, putih: 0xe8eefc };
const PALET = [COL.biru, COL.ungu, COL.merah, COL.hijau, COL.putih];
const hdr = (hex, k) => { const c = new THREE.Color(hex); return new THREE.Color(c.r * k, c.g * k, c.b * k); };
const css = hex => '#' + new THREE.Color(hex).getHexString();

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
  gaps[kOps] = 2.75;                                    // hitung mundur 3-2-1 sesudah opsi
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

  // ---------------------------------------------------------------- waktu kunci
  const LO = L[kOps];
  const optT = (() => {
    const ws = LO.words || [];
    const clean = w => w.w.replace(/[^\p{L}\p{N}]/gu, '');
    const idx = HURUF.slice(0, 3).map((h, i) => ws.findIndex((w, j) => clean(w) === h));
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
  const stepAt = t => { let s = null; for (const x of steps) if (t >= x.t - 0.12) s = x; return s; };

  const S = makeStage({ bloom: 0.75, radius: 0.6, threshold: 1.0, fog: 0x02040a, fogDensity: 0.0 });
  const { scene, camera, fx } = S;
  const R = seeded(4242);
  const cues = [];
  const cue = (t, k, v = 1) => { if (t >= 0 && t < END) cues.push({ t: +t.toFixed(3), k, v }); };
  const font = await new FontLoader().loadAsync('/node_modules/three/examples/fonts/helvetiker_bold.typeface.json');
  const glyph = (txt, size, depth) => {
    const g = new TextGeometry(txt, { font, size, depth, curveSegments: 10, bevelEnabled: true, bevelThickness: size * 0.04, bevelSize: size * 0.025, bevelSegments: 4 });
    g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2);
    return g;
  };
  const stars = (group, n, r0, r1) => {
    const p = particles(S, n, { soft: 2.2 }); group.add(p.pts);
    for (let i = 0; i < n; i++) { const d = V(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(r0 + R() * (r1 - r0)); const b = 0.4 + R() * 0.6; p.set(i, d.x, d.y, d.z, 0.8 * b, 0.88 * b, 1.0 * b, 0.5 + R() * 0.5, 0.12 + R() * 0.22); }
    p.done(); return p;
  };

  // ================================================================ SET A: latar pembuka & penutup
  const A = new THREE.Group(); scene.add(A);
  const latar = D.latar === 'panggung' ? 'panggung' : 'bumi';
  let globe = null, markerG = null, ringM = null, beamM = null, GLOBE_BASE = 0, qMark = null, cone = null, dust = null;
  if (latar === 'bumi') {
    const topo = await (await fetch('/node_modules/world-atlas/countries-50m.json')).json();
    const countries = window.topojson.feature(topo, topo.objects.countries).features;
    const sorot = String((D.bumi && D.bumi.sorot) ?? (lang === 'id' ? '360' : ''));
    const earthTex = canvasTex(2048, 1024, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b2547'); gr.addColorStop(0.5, '#0e3561'); gr.addColorStop(1, '#0b2547');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const P = ([lon, lat]) => [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
      for (const f of countries) {
        const polys = f.geometry ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []) : [];
        const hi = sorot && f.id === sorot;
        g.beginPath();
        for (const poly of polys) for (const ring of poly) {
          let prev = null;
          ring.forEach((pt, i) => { const [x, y] = P(pt); if (i === 0 || (prev && Math.abs(pt[0] - prev[0]) > 180)) g.moveTo(x, y); else g.lineTo(x, y); prev = pt; });
          g.closePath();
        }
        g.fillStyle = hi ? '#f2c14e' : '#2f8a6a'; g.fill('evenodd');
        g.strokeStyle = hi ? 'rgba(255,240,190,.9)' : 'rgba(150,230,190,.35)'; g.lineWidth = hi ? 1.6 : 0.8; g.stroke();
      }
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.035})`; g.beginPath(); g.arc(R() * w, R() * h, 1 + R() * 5, 0, 7); g.fill(); }
    });
    globe = new THREE.Group(); A.add(globe);
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 160, 110), std(0xffffff, 0.75, 0, { map: earthTex })));
    A.add(new THREE.Mesh(new THREE.SphereGeometry(1.045, 96, 64), new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(0.35, 0.65, 1.0) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.6); gl_FragColor = vec4(c * f * 2.2, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(-3, 2.2, 4); A.add(sun);
    A.add(new THREE.HemisphereLight(0x5a7fb8, 0x05070d, 0.35));
    stars(A, 1600, 60, 100);
    const ll = (lat, lon, r = 1) => { const a = THREE.MathUtils.degToRad(lat), o = THREE.MathUtils.degToRad(lon); return V(r * Math.cos(a) * Math.cos(o), r * Math.sin(a), -r * Math.cos(a) * Math.sin(o)); };
    const PT = ll(D.bumi?.lat ?? -2.5, D.bumi?.lon ?? 118);
    GLOBE_BASE = Math.atan2(-PT.x, PT.z);
    if (D.bumi && D.bumi.lat !== undefined) {
      markerG = new THREE.Group(); globe.add(markerG);
      markerG.position.copy(PT); markerG.lookAt(PT.clone().multiplyScalar(2));
      const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.0072, 0.0072), new THREE.MeshBasicMaterial({ color: hdr(0xfff0b0, 5), side: THREE.DoubleSide })); mk.position.z = 0.001; markerG.add(mk);
      ringM = new THREE.MeshBasicMaterial({ color: hdr(0xf5c542, 3), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
      const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), ringM); ring1.position.z = 0.002; ring1.name = 'ring'; markerG.add(ring1);
      beamM = new THREE.MeshBasicMaterial({ color: hdr(0xf5c542, 2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 8, 1, true), beamM); beam.rotation.x = Math.PI / 2; beam.position.z = 0.25; markerG.add(beam);
    }
  } else {
    // panggung: lantai mengilap, tanda tanya emas di atas podium, sorot lampu + debu melayang
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 96), std(0x06070c, 0.42, 0.55, { envMap: S.env, envMapIntensity: 0.25 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; A.add(floor);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
      uniforms: { a: { value: new THREE.Color(0x03040a) }, b: { value: new THREE.Color(0x140c2c) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 a, b; varying vec3 vP; void main(){ float y = smoothstep(-0.05, 0.5, vP.y); float h = pow(max(0.0, 1.0 - abs(vP.y - 0.06) * 3.0), 3.0); gl_FragColor = vec4(mix(b, a, y) + vec3(0.18, 0.1, 0.35) * h * 0.25, 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false,
    })); A.add(sky);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.32, 64), std(0x141826, 0.38, 0.7, { envMap: S.env, envMapIntensity: 0.5 }));
    ped.position.y = 0.16; ped.castShadow = ped.receiveShadow = true; A.add(ped);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.018, 8, 96), new THREE.MeshBasicMaterial({ color: hdr(0xf5c542, 3.2) })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.33; A.add(rim);
    qMark = new THREE.Mesh(glyph('?', 1.5, 0.42), std(0xf5c542, 0.22, 0.95, { envMap: S.env, envMapIntensity: 1.2, emissive: new THREE.Color(0x2a1c00) }));
    qMark.position.y = 1.55; qMark.castShadow = true; A.add(qMark);
    const spot = new THREE.SpotLight(0xfff0d8, 22, 24, 0.36, 0.55, 1.6); spot.position.set(0, 9, 1.5); spot.target.position.set(0, 1.2, 0);
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; A.add(spot, spot.target);
    const rimL = new THREE.DirectionalLight(0x9fb4ff, 1.3); rimL.position.set(-5, 3, -4); A.add(rimL);
    const rimR = new THREE.DirectionalLight(0xff9a5a, 1.6); rimR.position.set(5, 2.5, -3); A.add(rimR);
    A.add(new THREE.HemisphereLight(0x3a4a7a, 0x05060a, 0.35));
    cone = new THREE.Mesh(new THREE.ConeGeometry(2.3, 9, 48, 1, true), new THREE.ShaderMaterial({
      uniforms: { o: { value: 0.06 } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float o; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 1.6); float h = smoothstep(4.5, -4.5, vY); gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * f * h * o, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    }));
    cone.position.set(0, 4.5, 0.7); cone.rotation.x = -0.15; A.add(cone);
    dust = particles(S, 500, { soft: 2.4 }); A.add(dust.pts);
    dust.seed = Array.from({ length: 500 }, () => [R() * 6.28, R() * 2.6, R() * 8.5, R()]);
    stars(A, 500, 40, 55);
  }

  // ================================================================ SET D: data (x = 500): lantai grid + kubus satuan
  const OD = 500;
  const Dg = new THREE.Group(); Dg.position.set(OD, 0, 0); scene.add(Dg);
  const gridTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#0b1120'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(90,209,255,.32)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); });
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(160, 160); gridTex.anisotropy = 8;
  const floorD = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), std(0xffffff, 0.85, 0.1, { map: gridTex })); floorD.rotation.x = -Math.PI / 2; floorD.receiveShadow = true; Dg.add(floorD);
  const NC = 40, NN = NC * NC, SP = 0.62;
  const cubeG = new RoundedBoxGeometry(0.46, 0.46, 0.46, 2, 0.07);
  const cubes = new THREE.InstancedMesh(cubeG, std(0xffffff, 0.38, 0.35, { envMap: S.env, envMapIntensity: 0.35 }), NN);
  const cd = [];
  for (let i = 0; i < NC; i++) for (let j = 0; j < NC; j++) {
    const x = (i - NC / 2 + 0.5) * SP, z = (j - NC / 2 + 0.5) * SP;
    cd.push({ x, z, d: Math.hypot(x, z) + R() * 0.8, h: 0.23 + (R() < 0.12 ? R() * 0.5 : 0), gold: R() < 0.08 });
  }
  cd.sort((a, b) => a.d - b.d);
  cd.forEach((c, k) => { c.k = k / NN; cubes.setColorAt(k, new THREE.Color(c.gold ? 0xf5c542 : R() < 0.5 ? 0x5ad1ff : 0xcfe6ff)); });
  cubes.castShadow = true; cubes.receiveShadow = true; Dg.add(cubes);
  const unit = new THREE.Mesh(new RoundedBoxGeometry(1.0, 1.0, 1.0, 3, 0.1), std(0xf5c542, 0.3, 0.8, { envMap: S.env, envMapIntensity: 0.9, emissive: new THREE.Color(0x6a4a00) }));
  unit.castShadow = true; Dg.add(unit);
  const unitFrame = new THREE.Mesh(new THREE.RingGeometry(0.86, 0.92, 4, 1), new THREE.MeshBasicMaterial({ color: hdr(0xf5c542, 3.5), side: THREE.DoubleSide, transparent: true }));
  unitFrame.rotation.set(-Math.PI / 2, 0, Math.PI / 4); Dg.add(unitFrame);
  const block = new THREE.Mesh(new RoundedBoxGeometry(3.4, 3.4, 3.4, 4, 0.25), std(0xf5c542, 0.22, 0.85, { envMap: S.env, envMapIntensity: 1.1, emissive: new THREE.Color(0x4a3200) }));
  block.castShadow = true; Dg.add(block);
  const keyD = new THREE.DirectionalLight(0xfff1dc, 2.2); keyD.position.set(-8, 14, 9); keyD.target.position.set(0, 0, 0); Dg.add(keyD, keyD.target);
  keyD.castShadow = true; keyD.shadow.mapSize.set(1024, 1024); Object.assign(keyD.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 }); keyD.shadow.bias = -0.0005; keyD.shadow.normalBias = 0.02;
  const rimD = new THREE.DirectionalLight(0x5ad1ff, 1.6); rimD.position.set(10, 6, -10); Dg.add(rimD);
  Dg.add(new THREE.HemisphereLight(0x6a8ac8, 0x0a0c14, 0.6));
  const motes = particles(S, 380, { soft: 2.2 }); Dg.add(motes.pts);
  const moteSeed = Array.from({ length: 380 }, () => [(R() - 0.5) * 30, R() * 7, (R() - 0.5) * 30, R()]);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = V(1, 1, 1), p4 = V(0, 0, 0);
  const hitungS = steps.find(s => s.jenis === 'hitung');
  const anggapS = steps.find(s => s.jenis === 'anggap');
  const rumusS = steps.find(s => s.jenis === 'rumus');

  // ================================================================ SET C: perbandingan (z = 5000)
  // Kamera dicari numerik supaya semua benda perbandingan muat di pita layar yang bebas teks: di bawah kartu
  // jawaban (sampai ~y 690) dan di atas subtitle (mulai ~y 1290), menjauhi tombol TikTok di kanan.
  // Dicocokkan pada keyframe terdekat (0,97) supaya tidak pernah meluber saat kamera mendekat.
  const PITA_C = [100, 720, 960, 1265];
  function fitCamC(pts, dirA, dirB, box) {
    const cam = new THREE.PerspectiveCamera(40, W / H, 0.03, 4000);
    const tgt = new THREE.Vector3(); pts.forEach(p => tgt.add(p)); tgt.multiplyScalar(1 / pts.length);
    let d = 3 * pts.reduce((m, p) => Math.max(m, p.distanceTo(tgt)), 1);
    const bw = box[2] - box[0], bh = box[3] - box[1], bx = (box[0] + box[2]) / 2, by = (box[1] + box[3]) / 2;
    const up = new THREE.Vector3(), right = new THREE.Vector3();
    for (let it = 0; it < 60; it++) {
      cam.position.copy(tgt).addScaledVector(dirB, d * 0.97); cam.lookAt(tgt); cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { const s = toScreen(cam, p); x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); }
      const wpp = (2 * d * 0.97 * Math.tan(THREE.MathUtils.degToRad(20))) / H;
      up.set(0, 1, 0).applyQuaternion(cam.quaternion); right.set(1, 0, 0).applyQuaternion(cam.quaternion);
      tgt.addScaledVector(right, ((x0 + x1) / 2 - bx) * wpp).addScaledVector(up, -((y0 + y1) / 2 - by) * wpp);
      d *= Math.pow(Math.max((x1 - x0) / bw, (y1 - y0) / bh), 0.85);
    }
    const key = (dir, k) => ({ p: [tgt.x + dir.x * d * k, tgt.y + dir.y * d * k, tgt.z + dir.z * d * k], l: [tgt.x, tgt.y, tgt.z], fov: 40 });
    return [key(dirA, 1.06), key(dirB, 0.97)];
  }
  const OC = V(0, 0, 5000);
  const C = new THREE.Group(); C.position.copy(OC); scene.add(C);
  const items = [];
  let camC = null;
  if (BD) {
    const jenis = ['kotak', 'batang', 'bola'].includes(BD.jenis) ? BD.jenis : 'kotak';
    const vmax = Math.max(...BD.item.map(x => Math.max(1e-9, +x.nilai || 0)));
    let pi = 0;
    const list = [];
    BD.item.forEach((it, idx) => {
      const col = it.utama ? COL.emas : COL[it.warna] ?? PALET[pi++ % PALET.length];
      const n = clamp(Math.round(it.ulang || 1), 1, 6);
      for (let r = 0; r < n; r++) list.push({ it, idx, col, first: r === 0, v: Math.max(1e-9, +it.nilai || 0) / vmax });
    });
    const floorTex = canvasTex(1024, 1024, (g, w, h) => {
      g.fillStyle = '#0d1418'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '60,110,90' : '20,30,40'},${0.12 + R() * 0.2})`; g.beginPath(); g.ellipse(R() * w, R() * h, 6 + R() * 40, 5 + R() * 26, R() * 3, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(120,170,255,.10)'; g.lineWidth = 2; for (let k = 0; k <= 16; k++) { g.beginPath(); g.moveTo(k * w / 16, 0); g.lineTo(k * w / 16, h); g.stroke(); g.beginPath(); g.moveTo(0, k * h / 16); g.lineTo(w, k * h / 16); g.stroke(); }
    });
    if (jenis === 'kotak') {
      // satu baris per item (ulangan berjejer), baris ditumpuk ke belakang: pas untuk layar tegak
      const side = o => Math.sqrt(o.v) * 30;
      const rows = BD.item.map((it, idx) => list.filter(o => o.idx === idx));
      const smax = Math.max(...list.map(side));
      const gap = smax * 0.06 + 1.2;
      const rowW = rows.map(r => r.reduce((a, o) => a + side(o), 0) + gap * (r.length - 1));
      const rowD = rows.map(r => Math.max(...r.map(side)));
      const totW = Math.max(...rowW), totD = rowD.reduce((a, b) => a + b, 0) + gap * 1.6 * (rows.length - 1);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(totW * 4 + 200, totD * 4 + 200), new THREE.MeshBasicMaterial({ map: floorTex, color: new THREE.Color(0.8, 0.8, 0.8) }));
      fl.rotation.x = -Math.PI / 2; C.add(fl);
      let z = -totD / 2, k = 0;
      rows.forEach((r, ri) => {
        let x = -rowW[ri] / 2;
        const zc = z + rowD[ri] / 2; z += rowD[ri] + gap * 1.6;
        r.forEach(o => {
          const s = side(o), g = new THREE.Group(); g.position.set(x + s / 2, 0, zc); x += s + gap; C.add(g);
          const f = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: o.col, transparent: true, opacity: 0 })); f.rotation.x = -Math.PI / 2; f.position.y = 0.05; g.add(f);
          const em = new THREE.MeshBasicMaterial({ color: hdr(o.col, 3.6) }); const tt = Math.max(0.12, s * 0.014);
          for (const [w, d, px, pz] of [[s + tt, tt, 0, -s / 2], [s + tt, tt, 0, s / 2], [tt, s + tt, -s / 2, 0], [tt, s + tt, s / 2, 0]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, d), em); b.rotation.x = -Math.PI / 2; b.position.set(px, 0.08, pz); g.add(b); }
          items.push({ ...o, g, fill: f, top: V(0, 0.1, 0), size: s, k: k++ });
        });
      });
      // kamera dari atas (66 derajat); label kotak ada di dalam kotak, jadi seluruh pita bebas teks dipakai
      const el2 = THREE.MathUtils.degToRad(66), dir = V(0, Math.sin(el2), Math.cos(el2));
      const pts = [];
      items.forEach(o => { for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) pts.push(V(o.g.position.x + sx * o.size, 0.1, o.g.position.z + sz * o.size)); });
      camC = fitCamC(pts, dir, dir, PITA_C);
    } else {
      const sizes = list.map(o => (jenis === 'batang' ? 1.5 : Math.cbrt(o.v) * 2.2 * 2));
      const gap = jenis === 'batang' ? 0.9 : 0.7;
      const total = sizes.reduce((a, b) => a + b, 0) + gap * (list.length - 1);
      let x = -total / 2;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std(0x0b1018, 0.35, 0.55, { envMap: S.env, envMapIntensity: 0.3 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; C.add(fl);
      const ring = new THREE.Mesh(new THREE.RingGeometry(total * 0.62, total * 0.62 + 0.06, 128), new THREE.MeshBasicMaterial({ color: hdr(COL.biru, 1.6), transparent: true, opacity: 0.5 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; C.add(ring);
      let hmax = 0;
      list.forEach((o, k) => {
        const s = sizes[k], g = new THREE.Group(); g.position.set(x + s / 2, 0, 0); x += s + gap; C.add(g);
        const mat = std(o.col, jenis === 'batang' ? 0.55 : 0.35, jenis === 'batang' ? 0.2 : 0.45, { envMap: S.env, envMapIntensity: jenis === 'batang' ? 0.25 : 0.5, emissive: new THREE.Color(o.col).multiplyScalar(0.05) });
        let mesh, top;
        if (jenis === 'batang') {
          const hgt = Math.max(0.12, o.v * 5);
          const geo = new RoundedBoxGeometry(s, hgt, s, 3, Math.min(0.12, hgt / 3)); geo.translate(0, hgt / 2, 0);
          mesh = new THREE.Mesh(geo, mat); top = V(0, hgt + 0.15, 0); hmax = Math.max(hmax, hgt);
        } else {
          const r = s / 2; mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), mat); mesh.position.y = r; top = V(0, 2 * r + 0.15, 0); hmax = Math.max(hmax, 2 * r);
        }
        shadowAll(mesh, true, true); g.add(mesh);
        items.push({ ...o, g, mesh, top, size: s, k });
      });
      const sp = new THREE.SpotLight(0xfff0dc, 34, 60, 0.6, 0.6, 1.4); sp.position.set(-total * 0.4, hmax + 10, 10); sp.target.position.set(0, hmax / 3, 0);
      sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); C.add(sp, sp.target);
      C.add(new THREE.HemisphereLight(0x7f9fd8, 0x0a0c12, 0.7));
      const rl = new THREE.DirectionalLight(0x5ad1ff, 1.8); rl.position.set(total, 6, -8); C.add(rl);
      // kamera hampir sejajar lantai, sedikit menyapu dari kiri ke kanan; label melayang di atas puncak,
      // jadi batas atas pita dikurangi tinggi label (maks. 34 + 52 px + setengah tinggi label)
      const pts = [];
      items.forEach(o => {
        const hx = o.size / 2, top = o.top.y - 0.15;
        for (const sx of [-hx, hx]) for (const y of [0, top]) for (const sz of [-hx, hx]) pts.push(V(o.g.position.x + sx, y, sz));
      });
      camC = fitCamC(pts, V(-0.07, 0.06, 1).normalize(), V(0.06, 0.05, 1).normalize(), [PITA_C[0], PITA_C[1] + 110, PITA_C[2], PITA_C[3]]);
    }
  }

  // ================================================================ overlay
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
  const tags = items.filter(o => o.first).map(o => {
    const val = o.it.teks || '';
    return { o, d: el(`${esc(o.it.label || '')}${val ? ` <b style="color:${css(o.col)};margin:0 0 0 6px">${esc(val)}</b>` : ''}`, 'tag', { borderColor: css(o.col), background: 'rgba(8,12,22,.9)', fontSize: o.it.utama ? '34px' : '28px' }) };
  });
  const ans = el(`${K.jawab}: ${HURUF[benar]}`, 'ans', { top: '300px' });
  const winOpt = el(`<div class="b">${HURUF[benar]}</div><span>${mark(opsi[benar])}</span><span class="ck">${CHECK}</span>`, 'opt win', { top: '440px', fontSize: `${optLen > 22 ? 40 : 50}px` });
  const ansSub = JW.sub ? el(mark(JW.sub), 'eq', { top: '620px' }) : null;
  let lab3 = null;
  if (markerG && D.bumi.label) lab3 = el(`<div class="bx" style="bottom:120px">${esc(D.bumi.label)}</div><div class="st" style="height:120px"></div><div class="dt"></div>`, 'l3', { transformOrigin: '0 0' });
  const head9 = el((pen.teks || K.berikut).map(markLine).join('<br>'), 'head c');
  const follow = el(esc(pen.follow || K.follow), 'follow', { top: '1120px' });
  const subs = makeSubs(T.arr);

  // ================================================================ kamera
  let camA1, camA2;
  if (latar === 'bumi') {
    camA1 = [{ t: 0, p: [0.15, -0.62, 5.7], l: [0, 0.22, 0], fov: 38 }, { t: tDive - 0.6, p: [0.04, -0.5, 4.7], l: [0, 0.18, 0], fov: 38, e: E.sine }, { t: tDive, p: [0.0, -0.12, 1.35], l: [0, -0.05, 0], fov: 36, e: E.i }];
    camA2 = [{ t: tOut, p: [0.0, -0.1, 1.25], l: [0, -0.08, 0], fov: 34 }, { t: tOut + 2.2, p: [0.1, -0.55, 4.7], l: [0, 0.2, 0], fov: 38, e: E.io }, { t: END, p: [0.18, -0.6, 5.3], l: [0, 0.22, 0], fov: 38, e: E.sine }];
  } else {
    camA1 = [{ t: 0, p: [-0.6, 2.1, 9.6], l: [0, 1.65, 0], fov: 38 }, { t: tDive - 0.6, p: [0.2, 1.9, 7.2], l: [0, 1.6, 0], fov: 38, e: E.sine }, { t: tDive, p: [0.0, 1.6, 2.1], l: [0, 1.55, 0], fov: 34, e: E.i }];
    camA2 = [{ t: tOut, p: [0.0, 1.62, 2.4], l: [0, 1.55, 0], fov: 34 }, { t: tOut + 2.2, p: [0.5, 2.0, 7.4], l: [0, 1.6, 0], fov: 38, e: E.io }, { t: END, p: [0.8, 2.15, 8.3], l: [0, 1.62, 0], fov: 38, e: E.sine }];
  }
  // set D: orbit dengan target jarak/tinggi per jenis langkah
  // [jarak orbit, tinggi kamera, fokus ke kubus satuan (0..1), tinggi titik pandang]
  const target = s => (!s ? [15, 8.5, 0, 0.4] : s.jenis === 'anggap' ? [6.2, 3.0, 1, 0.55] : s.jenis === 'rumus' ? [16, 9.5, 0, 3.6] : s.jenis === 'hitung' ? [14, 8, 0, 0.4] : [13, 7, 0, 0.6]);
  const camD = t => {
    let cur = target(null), prev = cur;
    for (const s of steps) {
      if (t < s.t - 0.12) break;
      const tg = target(s), u = E.io(seg(t, s.t - 0.12, s.t + 0.9));
      cur = prev.map((v, i) => lerp(v, tg[i], u)); prev = tg;
    }
    const [r, hh, focus, ly] = cur;
    const ang = -0.5 + (t - tDive) * 0.09;
    const enter = 1 - E.o(seg(t, tDive, tDive + 0.9));
    const rr = r * (1 + enter * 0.35), h2 = hh + enter * 4;
    const fz0 = lerp(0, 5.2, focus);
    return { p: [OD + Math.sin(ang) * rr, h2, fz0 + Math.cos(ang) * rr], l: [OD, ly, fz0], fov: 40, r: 0 };
  };
  const camCAt = t => {
    if (!camC) return { p: [0, 50, 5000 + 20], l: [0, 0, 5000], fov: 40, r: 0 };
    const u = E.sine(seg(t, tCmp, tOut));
    const enter = 1 - E.o5(seg(t, tCmp, tCmp + 1.1));
    const a = camC[0], b = camC[1];
    const p = a.p.map((v, i) => lerp(v, b.p[i], u) * (1 + enter * 0.25)), l = a.l.map((v, i) => lerp(v, b.l[i], u));
    return { p: [p[0] + OC.x, p[1], p[2] + OC.z], l: [l[0] + OC.x, l[1], l[2] + OC.z], fov: 40, r: enter * 0.05 };
  };

  // ================================================================ cue (efek suara + musik)
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

  // ================================================================ render per frame
  function render(t) {
    const set = setAt(t);
    A.visible = set === 'A'; Dg.visible = set === 'D'; C.visible = set === 'C';
    let c;
    if (set === 'A') c = camAt(t < tOut ? camA1 : camA2, t, latar === 'bumi' ? 0.004 : 0.012);
    else if (set === 'D') c = camD(t);
    else c = camCAt(t);
    applyCam(camera, c);
    if (set === 'C') { camera.near = 0.5; camera.far = 4000; } else if (set === 'D') { camera.near = 0.05; camera.far = 600; } else { camera.near = 0.01; camera.far = 300; }
    camera.updateProjectionMatrix();
    let zb = 0, fl = 0;
    const cuts = [tDive, tOut]; if (tCmp !== null) cuts.push(tCmp);
    for (const k of cuts) { zb = Math.max(zb, bell(t, k, 0.09)); fl = Math.max(fl, bell(t, k, 0.035) * 0.45); }
    zb = Math.max(zb, bell(t, tDive - 0.12, 0.12) * 0.8);
    fx.uniforms.uZoom.value = zb; fx.uniforms.uFlash.value = fl;
    fx.uniforms.uFade.value = seg(t, END - 0.35, END);
    if (set === 'A') { scene.fog.density = latar === 'panggung' ? 0.02 : 0; scene.fog.color.setHex(0x05060f); scene.background.setHex(latar === 'panggung' ? 0x05060f : 0x02040a); }
    if (set === 'D') { scene.fog.color.setHex(0x060a14); scene.fog.density = 0.028; scene.background.setHex(0x060a14); }
    if (set === 'C') { scene.fog.density = 0; scene.background.setHex(0x0a0f14); }

    if (set === 'A') {
      if (globe) {
        globe.rotation.y = GLOBE_BASE - 0.28 + t * 0.012 + (t >= tOut ? -0.02 : 0);
        globe.rotation.x = -0.1;
        if (markerG) {
          const on = t >= tOut ? seg(t, tOut + 0.6, tOut + 1.0) : 0, ph = ((t - tOut) % 1.4) / 1.4;
          markerG.getObjectByName('ring').scale.setScalar(0.004 + ph * 0.06); ringM.opacity = on * (1 - ph); beamM.opacity = on * 0.9; markerG.visible = t >= tOut;
        }
      }
      if (qMark) {
        qMark.rotation.y = Math.sin(t * 0.7) * 0.55; qMark.position.y = 1.55 + Math.sin(t * 1.3) * 0.05;
        cone.material.uniforms.o.value = 0.055 + Math.sin(t * 2.1) * 0.008;
        for (let i = 0; i < dust.n; i++) { const [a, h0, r0, k] = dust.seed[i]; const r = 0.4 + r0 * 0.35; const y = (h0 + t * (0.05 + k * 0.08)) % 6.5; dust.set(i, Math.cos(a + t * 0.05) * r, 0.3 + y, 0.7 + Math.sin(a + t * 0.05) * r * 0.6, 1, 0.92, 0.75, 0.25 + 0.35 * k, 0.015 + k * 0.02); }
        dust.done();
      }
    }
    if (set === 'D') {
      const fill = hitungS ? E.o(seg(t, hitungS.t + 0.1, hitungS.t + 2.2)) : E.o(seg(t, tDive, tDive + 1.2));
      const col = rumusS ? E.io(seg(t, rumusS.t + 0.1, rumusS.t + 1.3)) : 0;
      const sink = anggapS ? 0.35 * win(t, anggapS.t, (rumusS ? rumusS.t : tCmp ?? tOut) - 0.2, 0.5) : 0;
      for (let k = 0; k < NN; k++) {
        const c0 = cd[k];
        const ap = clamp((fill - c0.k) * 9);
        let s = E.back(ap) * (1 - col) * (1 - sink * 0.5);
        const x = lerp(c0.x, 0, col * col), z = lerp(c0.z, 0, col * col);
        const y = c0.h + (1 - E.o(ap)) * 1.2 + col * 1.4;
        q4.setFromAxisAngle(V(0, 1, 0), c0.d * 0.3 + col * 3);
        m4.compose(p4.set(x, y, z), q4, s4.set(Math.max(s, 1e-4), Math.max(s, 1e-4), Math.max(s, 1e-4)));
        cubes.setMatrixAt(k, m4);
      }
      cubes.instanceMatrix.needsUpdate = true;
      const uIn = anggapS ? E.back(seg(t, anggapS.t + 0.2, anggapS.t + 0.65)) : 0;
      const uOut = anggapS ? 1 - seg(t, (rumusS ? rumusS.t : tCmp ?? tOut) - 0.3, (rumusS ? rumusS.t : tCmp ?? tOut) + 0.2) : 0;
      const us = Math.max(1e-4, Math.min(uIn, uOut));
      unit.visible = us > 0.001; unitFrame.visible = unit.visible;
      unit.scale.setScalar(us); unit.position.set(0, 0.5 * us + 0.02, 5.2); unit.rotation.y = 0.6 + t * 0.4;
      unitFrame.position.set(0, 0.03, 5.2); unitFrame.scale.setScalar(1.15 + 0.1 * Math.sin(t * 4)); unitFrame.material.opacity = us;
      const bs = rumusS ? E.back(seg(t, rumusS.t + 0.9, rumusS.t + 1.5)) : 0;
      block.visible = bs > 0.001; block.scale.setScalar(Math.max(1e-4, bs)); block.position.set(0, 1.7 * bs + 0.05, 0); block.rotation.y = t * 0.25;
      for (let i = 0; i < motes.n; i++) { const [x, h0, z, k] = moteSeed[i]; const y = (h0 + t * (0.08 + k * 0.1)) % 7; motes.set(i, x + Math.sin(t * 0.3 + k * 9) * 0.4, y, z, 0.55, 0.85, 1, 0.18 + 0.3 * k, 0.03 + k * 0.03); }
      motes.done();
    }
    if (set === 'C') {
      items.forEach(o => {
        const a = tCmp + 0.2 + o.k * 0.22, u = E.back(seg(t, a, a + 0.45));
        o.g.scale.setScalar(Math.max(1e-4, u)); o.g.visible = t >= a;
        if (o.fill) o.fill.material.opacity = (o.it.utama ? 0.55 : 0.25) * seg(t, a + 0.2, a + 0.7);
        if (o.mesh && o.it.utama) o.mesh.material.emissiveIntensity = 1 + bell(t, tAns + 0.1, 0.25) * 4;
      });
    }

    // ---------------------------------------------------------------- overlay
    show(pill, 1); show(brand, 1);
    show(head1, 1 - seg(t, LO.t0 - 0.1, LO.t0 + 0.1), `scale(${(1.06 - 0.06 * E.o5(seg(t, 0, 0.5))).toFixed(4)})`);
    show(dim, win(t, LO.t0 - 0.05, tDive - 0.1, 0.25) * 0.85);
    pop(head2, t, LO.t0, tDive - 0.12);
    opts.forEach((d, i) => {
      const i0 = E.o5(seg(t, optT[i], optT[i] + 0.35)), o = 1 - seg(t, tDive - 0.15, tDive);
      show(d, Math.min(i0, o), `translateX(${((1 - i0) * (i % 2 ? 120 : -120)).toFixed(1)}px)`);
    });
    {
      const k = t - tCount, n = Math.floor(k / 0.86), on = k >= 0 && t < tDive - 0.1;
      ringN.textContent = String(3 - clamp(n, 0, 2)); arc.setAttribute('stroke-dashoffset', (502.65 * clamp((k % 0.86) / 0.86)).toFixed(1));
      show(ring, on ? 1 : 0, `scale(${(1 + bell(k % 0.86, 0.05, 0.08) * 0.12).toFixed(3)})`);
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
      const wp = o.top.clone(); o.g.localToWorld(wp); const sp = toScreen(camera, wp);
      d.style.left = `${sp.x.toFixed(1)}px`; d.style.top = `${(sp.y - (o.fill ? 0 : 34 + (o.k % 2) * 52)).toFixed(1)}px`;
      const a = tCmp + 0.45 + o.k * 0.22;
      pop(d, t, a, tOut - 0.1, { base: 'translate(-50%, -50%)', s0: 0.6, dy: 0 });
    });
    pop(ans, t, tAns, tOut - 0.1, { base: 'translateX(-50%)', s0: 1.4, dy: 0 });
    pop(winOpt, t, tAns + 0.18, tOut - 0.1, { dy: 30 });
    if (ansSub) pop(ansSub, t, tAns + 0.4, tOut - 0.1, { dy: -10 });
    if (lab3) {
      const wp = V(0, 0, 0); markerG.getWorldPosition(wp); const sp = toScreen(camera, wp);
      lab3.style.left = `${sp.x.toFixed(1)}px`; lab3.style.top = `${sp.y.toFixed(1)}px`;
      const i = E.o5(seg(t, tOut + 0.9, tOut + 1.25)), o = 1 - seg(t, tNext - 0.2, tNext);
      show(lab3, t >= tOut ? Math.min(i, o) : 0, `scale(${lerp(0.5, 1, i).toFixed(3)})`);
    }
    pop(head9, t, tNext, END + 1, { s0: 1.15, dy: 0 });
    pop(follow, t, tFollow, END + 1, { base: 'translateX(-50%)', s0: 0.6, dy: 30 });
    show(topfade, Math.max(1 - seg(t, LO.t0 - 0.1, LO.t0 + 0.2), win(t, tDive + 0.05, tOut, 0.2), seg(t, tNext - 0.2, tNext)) * 0.85);
    subs.update(t);
    if (t > tCount - 0.15 && t < tDive) show(subs.box, 0);
    S.draw(t);
  }

  const raw = [0, LO.t0 + 1.5, tDive, ...steps.map(s => s.t - 0.12), tCmp, tAns - 0.2, tOut, END].filter(x => x !== null && x >= 0 && x <= END).sort((a, b) => a - b);
  const bounds = [];
  for (const b of raw) if (!bounds.length || b - bounds[bounds.length - 1] >= 0.6) bounds.push(+b.toFixed(3));
  if (END - bounds[bounds.length - 1] < 0.6) bounds[bounds.length - 1] = END; else bounds.push(END);
  const scenes = [];
  for (let i = 0; i < bounds.length - 1; i++) scenes.push({ a: bounds[i], b: bounds[i + 1] });
  return { duration: END, cues, scenes, render, marks: { lines: T.arr.map(x => [x.key, +x.t0.toFixed(3)]), END, tCount, tDive, tCmp, tAns, tOut, beds: [] } };
});
