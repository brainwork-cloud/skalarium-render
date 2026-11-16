// Skalarium "TEBAK DULU #1 · SEMUA MANUSIA" — contoh gaya sinematik 3D (16 Nov 2026)
import { THREE, W, H, E, clamp, lerp, seg, win, seeded, n1, makeStage, camAt, applyCam, toScreen, std, canvasTex, shadowAll, particles, person, el, show, pop, makeSubs, timeline, boot } from '/lib/engine.js';

const bell = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CHECK = '<svg width="54" height="54" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#5be39a" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

boot(async (info) => {
  const T = timeline(info, { b1: 0.3, b2: 2.75, b3: 0.3, b4: 0.3, b5: 0.35, b6: 0.35, b7: 0.3 }, 0.25);
  const L = T.L;
  const END = +(L.b7.t1 + 1.4).toFixed(3);
  const S = makeStage({ bloom: 0.75, radius: 0.6, threshold: 1.0, fog: 0x02040a, fogDensity: 0.0 });
  const { scene, camera, fx } = S;
  const R = seeded(99);
  const cues = [];
  const cue = (t, k, v = 1) => cues.push({ t: +t.toFixed(3), k, v });

  const tCount = L.b2.t1 + 0.12;
  const tDive = L.b3.t0 - 0.12;
  const tTile = L.b4.t0 - 0.12;
  const tDrop = L.b4.w('empat');
  const tPull = L.b4.t1 - 0.25;
  const tMap = L.b5.w('sekitar') - 0.1;
  const tJkt = L.b6.w('tiga');
  const tAns = L.b6.w('Jawabannya');
  const tGlobe = L.b7.t0 - 0.12;
  const setAt = t => (t < tDive ? 'G' : t < tMap ? 'P' : t < tGlobe ? 'M' : 'G');

  // ================================================================ SET G: Bumi
  const G = new THREE.Group(); scene.add(G);
  const topo = await (await fetch('/node_modules/world-atlas/countries-50m.json')).json();
  const countries = window.topojson.feature(topo, topo.objects.countries).features;
  const earthTex = canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b2547'); gr.addColorStop(0.5, '#0e3561'); gr.addColorStop(1, '#0b2547');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const P = ([lon, lat]) => [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
    for (const f of countries) {
      const polys = f.geometry ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []) : [];
      const indo = f.id === '360';
      g.beginPath();
      for (const poly of polys) for (const ring of poly) {
        let prev = null;
        ring.forEach((pt, i) => { const [x, y] = P(pt); if (i === 0 || (prev && Math.abs(pt[0] - prev[0]) > 180)) g.moveTo(x, y); else g.lineTo(x, y); prev = pt; });
        g.closePath();
      }
      g.fillStyle = indo ? '#f2c14e' : '#2f8a6a'; g.fill('evenodd');
      g.strokeStyle = indo ? 'rgba(255,240,190,.9)' : 'rgba(150,230,190,.35)'; g.lineWidth = indo ? 1.6 : 0.8; g.stroke();
    }
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.035})`; g.beginPath(); g.arc(R() * w, R() * h, 1 + R() * 5, 0, 7); g.fill(); }
  });
  const globe = new THREE.Group(); G.add(globe);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 110), std(0xffffff, 0.75, 0, { map: earthTex }));
  globe.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(1.045, 96, 64), new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(0.35, 0.65, 1.0) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.6); gl_FragColor = vec4(c * f * 2.2, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  }));
  G.add(atm);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(-3, 2.2, 4); G.add(sun);
  G.add(new THREE.HemisphereLight(0x5a7fb8, 0x05070d, 0.35));
  const stars = particles(S, 1600, { soft: 2.2 }); G.add(stars.pts);
  for (let i = 0; i < 1600; i++) { const d = V(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(60 + R() * 40); const b = 0.4 + R() * 0.6; stars.set(i, d.x, d.y, d.z, 0.8 * b, 0.88 * b, 1.0 * b, 0.5 + R() * 0.5, 0.12 + R() * 0.22); }
  stars.done();
  const ll = (lat, lon, r = 1) => { const a = THREE.MathUtils.degToRad(lat), o = THREE.MathUtils.degToRad(lon); return V(r * Math.cos(a) * Math.cos(o), r * Math.sin(a), -r * Math.cos(a) * Math.sin(o)); };
  const JKT = ll(-6.2, 106.8);
  const marker = new THREE.Group(); globe.add(marker);
  marker.position.copy(JKT); marker.lookAt(JKT.clone().multiplyScalar(2));
  const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.0072, 0.0072), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.5, 1.0), side: THREE.DoubleSide })); mk.position.z = 0.001; marker.add(mk);
  const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.3, 0.6), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), ringM); ring1.position.z = 0.002; marker.add(ring1);
  const beamM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.9, 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 8, 1, true), beamM); beam.rotation.x = Math.PI / 2; beam.position.z = 0.25; marker.add(beam);
  const GLOBE_BASE = Math.atan2(-JKT.x, JKT.z);

  // ================================================================ SET P: dataran manusia (x = 500)
  const OP = 500, OT = 620;
  const P = new THREE.Group(); scene.add(P);
  const gridTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#212838'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(140,180,255,.28)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); });
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(900, 900); gridTex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std(0xffffff, 0.9, 0, { map: gridTex })); ground.rotation.x = -Math.PI / 2; ground.position.set(OP + 60, 0, 0); ground.receiveShadow = true; P.add(ground);
  const shirts = [0xe74c3c, 0xf5c542, 0x3498db, 0x2ecc71, 0xe67e22, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xd35400, 0x34495e, 0xff6f91, 0x5dade2];
  const crowdTex = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const n = 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (i + 0.5 + (R() - 0.5) * 0.3) * w / n, y = (j + 0.5 + (R() - 0.5) * 0.3) * h / n;
      g.fillStyle = '#' + shirts[Math.floor(R() * shirts.length)].toString(16).padStart(6, '0'); g.beginPath(); g.ellipse(x, y, 22, 16, R() * 3, 0, 7); g.fill();
      g.fillStyle = '#1a120c'; g.beginPath(); g.arc(x + (R() - 0.5) * 4, y + (R() - 0.5) * 4, 10, 0, 7); g.fill();
    }
  });
  crowdTex.wrapS = crowdTex.wrapT = THREE.RepeatWrapping;
  const crowdPlaneM = std(0xffffff, 0.9, 0, { map: crowdTex, transparent: true, opacity: 1, alphaTest: 0.02 });
  crowdTex.repeat.set(150, 150);
  const crowdPlane = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), crowdPlaneM); crowdPlane.rotation.x = -Math.PI / 2; crowdPlane.position.set(OP, 0.02, 0); P.add(crowdPlane);
  // orang massal: badan + kepala (instanced)
  const bodyG = new THREE.CapsuleGeometry(0.18, 0.88, 2, 7); bodyG.translate(0, 0.62, 0); bodyG.scale(1, 1, 0.7);
  const headG = new THREE.IcosahedronGeometry(0.115, 1); headG.translate(0, 1.38, 0);
  {
    const c = new Float32Array(headG.attributes.position.count * 3); const p = headG.attributes.position;
    for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 1.4 ? 1 : 0; c[i * 3] = top ? 0.18 : 1; c[i * 3 + 1] = top ? 0.13 : 1; c[i * 3 + 2] = top ? 0.1 : 1; }
    headG.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const crowdMesh = (cx, cz, half, maxR = 1e9) => {
    const pos = [];
    for (let i = -half; i < half; i++) for (let j = -half; j < half; j++) for (const [ox, oz] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const x = i + ox + (R() - 0.5) * 0.08, z = j + oz + (R() - 0.5) * 0.08;
      if (Math.hypot(x, z) < maxR) pos.push([x, z]);
    }
    const n = pos.length;
    const bm = new THREE.InstancedMesh(bodyG, std(0xffffff, 0.85), n), hm = new THREE.InstancedMesh(headG, std(0xffffff, 0.7, 0, { vertexColors: true }), n);
    const skins = [0xc68b59, 0xe0ac7a, 0xb07a4f, 0x8d5524, 0xf1c27d];
    const data = pos.map(([x, z], k) => ({ x, z, s: 0.92 + R() * 0.18, r: (R() - 0.5) * 1.2, d: Math.hypot(x, z) }));
    data.forEach((d, k) => { bm.setColorAt(k, new THREE.Color(shirts[Math.floor(R() * shirts.length)])); hm.setColorAt(k, new THREE.Color(skins[Math.floor(R() * skins.length)])); });
    bm.position.set(cx, 0, cz); hm.position.set(cx, 0, cz);
    P.add(bm, hm);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = V(1, 1, 1), pv = V(0, 0, 0), up = V(0, 1, 0);
    const place = (fn) => { data.forEach((d, k) => { const s = d.s * fn(d); q.setFromAxisAngle(up, d.r); m4.compose(pv.set(d.x, 0, d.z), q, sv.set(s, s, s)); bm.setMatrixAt(k, m4); hm.setMatrixAt(k, m4); }); bm.instanceMatrix.needsUpdate = true; hm.instanceMatrix.needsUpdate = true; bm.computeBoundingSphere(); hm.computeBoundingSphere(); };
    place(() => 1);
    return { bm, hm, data, place, set vis(v) { bm.visible = hm.visible = v; } };
  };
  const crowdA = crowdMesh(OP, 0, 13);
  const crowdB = crowdMesh(OT, 0, 11);
  // ubin 1 m² + 4 orang
  const tileG = new THREE.Group(); tileG.position.set(OT, 0, 0); P.add(tileG);
  const glowY = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 0.7) });
  for (const [w, d, x, z] of [[1.04, 0.035, 0, -0.5], [1.04, 0.035, 0, 0.5], [0.035, 1.04, -0.5, 0], [0.035, 1.04, 0.5, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), glowY); b.position.set(x, 0.012, z); tileG.add(b); }
  const tileFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: 0.16, depthWrite: false })); tileFill.rotation.x = -Math.PI / 2; tileFill.position.y = 0.006; tileG.add(tileFill);
  const four = [
    person({ h: 1.66, shirt: 0xe74c3c, pants: 0x2b3a55, skin: 0xc68b59 }),
    person({ h: 1.56, shirt: 0x3498db, pants: 0x3c3f58, skin: 0xe0ac7a, style: 'long', hair: 0x2a1a10 }),
    person({ h: 1.7, shirt: 0xf5c542, pants: 0x283246, skin: 0xb07a4f, cap: 0x1f6f4a }),
    person({ h: 1.6, shirt: 0x2ecc71, pants: 0x2d3a52, skin: 0x8d5524 }),
  ];
  const fourXZ = [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]];
  four.forEach((p, k) => { p.bs = p.g.scale.x; p.g.position.set(fourXZ[k][0], 0, fourXZ[k][1]); p.g.rotation.y = 0.35 + (R() - 0.5) * 0.3; p.arms.forEach((a, i) => { a.piv.rotation.z = (i ? 1 : -1) * 0.02; }); shadowAll(p.g, true, true); tileG.add(p.g); });
  const sunP = new THREE.DirectionalLight(0xffc89a, 2.4); sunP.position.set(OT - 6, 7, -9); sunP.target.position.set(OT, 0, 0); P.add(sunP, sunP.target);
  sunP.castShadow = true; sunP.shadow.mapSize.set(1024, 1024); Object.assign(sunP.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 }); sunP.shadow.bias = -0.0005; sunP.shadow.normalBias = 0.02;
  P.add(new THREE.HemisphereLight(0x8fb4ff, 0x3a2a22, 0.9));
  const fill = new THREE.DirectionalLight(0xbfd6ff, 1.7); fill.position.set(OT + 6, 5, 8); P.add(fill);
  // langit senja
  const skyM = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(0x10224a) }, mid: { value: new THREE.Color(0x6a4a7a) }, hor: { value: new THREE.Color(0xf3a06a) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top, mid, hor; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.12 ? mix(mid, top, smoothstep(0.12, 0.6, y)) : mix(hor, mid, smoothstep(-0.02, 0.12, y)); float s = pow(max(0.0, dot(vP, normalize(vec3(-0.45, 0.08, -0.89)))), 60.0); gl_FragColor = vec4(c + vec3(1.6,1.1,0.6) * s * 2.0, 1.0); }',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const skyP = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyM); skyP.position.set(OP + 60, 0, 0); P.add(skyP);

  // ================================================================ SET M: peta (1 satuan = 1 km, z = 5000)
  const OM = V(0, 0, 5000);
  const M = new THREE.Group(); M.position.copy(OM); scene.add(M);
  const mapTex = canvasTex(2048, 2048, (g, w, h) => {
    g.fillStyle = '#17241f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '60,110,80' : '20,30,26'},${0.15 + R() * 0.25})`; g.beginPath(); g.ellipse(R() * w, R() * h, 10 + R() * 60, 8 + R() * 40, R() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#0d2d4f'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h * 0.16); for (let x = w; x >= 0; x -= 32) g.lineTo(x, h * 0.16 + Math.sin(x * 0.01) * 30 + (R() - 0.5) * 18); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(110,170,255,.45)'; g.lineWidth = 4; for (let k = 0; k < 6; k++) { g.beginPath(); let x = R() * w, y = h * 0.17; g.moveTo(x, y); for (let s = 0; s < 40; s++) { x += (R() - 0.5) * 50; y += 40; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(255,220,170,.12)'; g.lineWidth = 3; for (let k = 0; k < 26; k++) { g.beginPath(); g.moveTo(R() * w, R() * h); g.lineTo(R() * w, R() * h); g.stroke(); }
  });
  const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: mapTex, color: new THREE.Color(0.85, 0.85, 0.85) })); mapPlane.rotation.x = -Math.PI / 2; M.add(mapPlane);
  const sqLine = (side, color) => { const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color }); const t = side * 0.012; for (const [w, d, x, z] of [[side + t, t, 0, -side / 2], [side + t, t, 0, side / 2], [t, side + t, -side / 2, 0], [t, side + t, side / 2, 0]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); b.rotation.x = -Math.PI / 2; b.position.set(x, 0.3, z); g.add(b); } return g; };
  const SQ = Math.sqrt(2075), JK = Math.sqrt(662);
  const crowdSq = new THREE.Group(); crowdSq.position.set(0, 0, -18); M.add(crowdSq);
  const csTex = crowdTex.clone(); csTex.needsUpdate = true; csTex.repeat.set(60, 60);
  const csFill = new THREE.Mesh(new THREE.PlaneGeometry(SQ, SQ), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.05, 0.6), map: csTex, transparent: true, opacity: 0 })); csFill.rotation.x = -Math.PI / 2; csFill.position.y = 0.2; crowdSq.add(csFill);
  crowdSq.add(sqLine(SQ, new THREE.Color(4, 3, 0.7)));
  const jkts = [-1, 0, 1].map(k => {
    const g = new THREE.Group(); g.position.set(k * (JK + 3), 0, 32); M.add(g);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(JK, JK), new THREE.MeshBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: 0.22 })); f.rotation.x = -Math.PI / 2; f.position.y = 0.2; g.add(f);
    g.add(sqLine(JK, new THREE.Color(0.6, 2.6, 4)));
    return g;
  });

  // ================================================================ overlay
  const dim = el('', 'dim');
  const topfade = el('', 'topfade');
  const pill = el('<span class="dot"></span>TEBAK DULU #1 · SEMUA MANUSIA', 'pill');
  const brand = el('<i></i>SKALARIUM', 'brand');
  const head1 = el('SEMUA MANUSIA<br><span class="hl">BERDIRI RAPAT</span><br>SELUAS APA?', 'head', { fontSize: '128px' });
  const head2 = el('TEBAK <span class="g">DULU!</span>', 'head c mid');
  const opts = [['A', 'SELUAS PULAU JAWA'], ['B', '3× LUAS JAKARTA'], ['C', 'SELUAS KALIMANTAN']].map(([b, s], i) => el(`<div class="b">${b}</div><span>${s}</span><span class="ck"></span>`, 'opt', { top: `${700 + i * 172}px` }));
  const ring = el(`<svg width="190" height="190"><circle cx="95" cy="95" r="80" fill="rgba(8,12,22,.88)" stroke="rgba(255,255,255,.14)" stroke-width="12"/><circle class="arc" cx="95" cy="95" r="80" fill="none" stroke="#F5C542" stroke-width="12" stroke-linecap="round" transform="rotate(-90 95 95)" stroke-dasharray="502.65" stroke-dashoffset="0"/></svg><div class="n">3</div>`, 'ring', { left: '415px', top: '1240px' });
  const arc = ring.querySelector('.arc'), ringN = ring.querySelector('.n');
  const counter = el('<span class="num">0</span><span class="u">MANUSIA DI BUMI · 2026</span>', 'count');
  const num = counter.querySelector('.num');
  const asum = el('<div class="k">ANGGAP SAJA</div><div class="v">1 m² = <span class="g">4 ORANG</span></div>', 'clue');
  const dimLab = (txt) => el(txt, 'tag', { borderColor: '#F5C542', background: 'rgba(30,24,8,.88)', color: '#fff' });
  const d1 = dimLab('1 m'), d2 = dimLab('1 m');
  const eq = el('8,3 miliar ÷ 4 = <span class="g">2,075 miliar m²</span>', 'eq', { top: '300px' });
  const big = el('± 2.100 km²<span class="u">CUKUP UNTUK SEMUA MANUSIA</span>', 'count', { top: '380px', fontSize: '150px' });
  const labSq = el('SEMUA MANUSIA', 'tag', { borderColor: '#F5C542', background: 'rgba(30,24,8,.9)' });
  const labJ = [0, 1, 2].map(() => el('JAKARTA', 'tag', { borderColor: '#5ad1ff', background: 'rgba(6,20,32,.9)', fontSize: '28px' }));
  const ans = el('JAWABAN: B', 'ans', { top: '300px' });
  const ansSub = el('≈ 3× luas Jakarta (662 km²)', 'eq', { top: '440px' });
  const lab3 = el('<div class="bx" style="bottom:120px">SEMUA MANUSIA MUAT DI SINI</div><div class="st" style="height:120px"></div><div class="dt"></div>', 'l3', { transformOrigin: '0 0' });
  const head9 = el('TEBAKAN<br><span class="g">BERIKUTNYA?</span>', 'head c');
  const follow = el('+ FOLLOW SKALARIUM', 'follow', { top: '1120px' });
  const subs = makeSubs(T.arr);
  const flash = el('', 'flash');

  // ================================================================ kamera
  const camG1 = [
    { t: 0, p: [0.15, -0.62, 5.7], l: [0, 0.22, 0], fov: 38 },
    { t: tDive - 0.6, p: [0.04, -0.5, 4.7], l: [0, 0.18, 0], fov: 38, e: E.sine },
    { t: tDive, p: [0.0, -0.12, 1.35], l: [0, -0.05, 0], fov: 36, e: E.i },
  ];
  const camG2 = [
    { t: tGlobe, p: [0.0, -0.1, 1.25], l: [0, -0.08, 0], fov: 34 },
    { t: tGlobe + 2.2, p: [0.1, -0.55, 4.7], l: [0, 0.2, 0], fov: 38, e: E.io },
    { t: END, p: [0.18, -0.6, 5.3], l: [0, 0.22, 0], fov: 38, e: E.sine },
  ];
  const camP1 = [
    { t: tDive, p: [OP - 9, 6.5, 15], l: [OP + 1, 0.6, -6], fov: 48 },
    { t: tTile, p: [OP - 2.5, 4.2, 5], l: [OP + 5, 0.4, -14], fov: 46, e: E.sine },
  ];
  const camP2 = [
    { t: tTile, p: [OT + 2.9, 3.3, 4.0], l: [OT, 0.75, 0], fov: 40 },
    { t: tPull, p: [OT + 2.2, 3.1, 3.3], l: [OT, 0.7, 0], fov: 40, e: E.sine },
  ];
  const pullCam = t => {
    const u = E.io(seg(t, tPull, tMap));
    const h = 3.1 * Math.pow(170 / 3.1, u);
    return { p: [OT + 2.2 * (1 - u) + h * 0.1, h, 3.3 * (1 - u) + h * 0.3], l: [OT, lerp(0.7, 0, u), 0], fov: 40, r: u * 0.12 };
  };
  const camM = [
    { t: tMap, p: [0, 330, 5000 - 19 + 30], l: [0, 0, 5000 - 19], fov: 40 },
    { t: tJkt - 0.2, p: [0, 270, 5000 - 19 + 28], l: [0, 0, 5000 - 19], fov: 40, e: E.o },
    { t: tJkt + 0.6, p: [0, 290, 5000 + 7.5 + 30], l: [0, 0, 5000 + 7.5], fov: 40, e: E.io },
    { t: tGlobe, p: [0, 280, 5000 + 7.5 + 29], l: [0, 0, 5000 + 7.5], fov: 40, e: E.sine },
  ];

  // ================================================================ cue
  cue(0, 'hit'); cue(0, 'music', 1);
  [L.b2.t0, L.b2.w('Tiga'), L.b2.w('Atau')].forEach(t => cue(t + 0.05, 'pop'));
  cue(tCount - 0.05, 'music', 0); [0, 1, 2].forEach(i => cue(tCount + i * 0.86, 'tick'));
  cue(tDive - 0.5, 'rise'); cue(tDive, 'whoosh'); cue(tDive, 'boom', 0.7); cue(tDive, 'music', 1); cue(L.b3.t0 + 0.2, 'roll');
  cue(tTile, 'whoosh'); [0, 1, 2, 3].forEach(k => cue(tDrop + k * 0.24 + 0.32, 'pop', 0.9)); cue(L.b4.t0 + 0.1, 'pop');
  cue(tPull, 'rise', 0.8); cue(tMap, 'whoosh'); cue(tMap + 0.05, 'boom', 0.6);
  [0, 1, 2].forEach(k => cue(tJkt + k * 0.2, 'pop')); cue(tAns, 'ding'); cue(tAns + 0.05, 'stamp', 0.6);
  cue(tGlobe, 'whoosh'); cue(tGlobe + 1.0, 'shimmer'); cue(L.b7.w('follow'), 'pop'); cue(L.b7.w('follow') + 0.05, 'ding');
  cue(END - 0.5, 'music', 0);

  function render(t) {
    const set = setAt(t);
    G.visible = set === 'G'; P.visible = set === 'P'; M.visible = set === 'M';
    let c;
    if (set === 'G') c = camAt(t < tMap ? camG1 : camG2, t, 0.004);
    else if (set === 'P') c = t < tTile ? camAt(camP1, t, 0.03) : t < tPull ? camAt(camP2, t, 0.01) : pullCam(t);
    else c = camAt(camM, t, 0.2);
    applyCam(camera, c);
    camera.near = set === 'M' ? 1 : set === 'P' ? 0.05 : 0.01; camera.far = set === 'M' ? 2000 : 1500; camera.updateProjectionMatrix();
    let zb = 0, fl = 0;
    for (const k of [tDive, tTile, tMap, tGlobe]) { zb = Math.max(zb, bell(t, k, 0.09)); fl = Math.max(fl, bell(t, k, 0.035) * 0.45); }
    zb = Math.max(zb, bell(t, tDive - 0.12, 0.12) * 0.8);
    fx.uniforms.uZoom.value = zb; fx.uniforms.uFlash.value = fl;
    fx.uniforms.uFade.value = seg(t, END - 0.35, END);
    if (set === 'G') { scene.fog.density = 0; scene.background.setHex(0x02040a); S.renderer.toneMappingExposure = 1.0; }
    if (set === 'P') { scene.fog.color.setHex(0x8a6a76); scene.fog.density = t < tPull ? 0.011 : 0.011 / (1 + 0.04 * camera.position.y); scene.background.setHex(0x3a3550); S.renderer.toneMappingExposure = 1.0; }
    if (set === 'M') { scene.fog.density = 0; scene.background.setHex(0x0a0f14); S.renderer.toneMappingExposure = 1.0; }

    if (set === 'G') {
      globe.rotation.y = GLOBE_BASE - 0.28 + t * 0.012 + (t >= tGlobe ? -0.02 : 0);
      globe.rotation.x = -0.1;
      const mOn = t >= tGlobe ? seg(t, tGlobe + 0.6, tGlobe + 1.0) : 0;
      const ph = ((t - tGlobe) % 1.4) / 1.4;
      ring1.scale.setScalar(0.004 + ph * 0.06); ringM.opacity = mOn * (1 - ph);
      beamM.opacity = mOn * 0.9; mk.visible = t >= tGlobe;
    }
    if (set === 'P') {
      crowdA.vis = t < tTile; crowdB.vis = t >= tPull;
      if (t >= tPull) { const rad = lerp(0.6, 15, E.o(seg(t, tPull + 0.05, tPull + 1.0))); crowdB.place(d => (d.d < 0.72 ? 0 : E.back(clamp((rad - d.d) / 1.2)))); }
      crowdPlane.visible = t < tTile || t >= tPull + 0.3;
      crowdPlaneM.opacity = t < tTile ? 1 : seg(t, tPull + 0.3, tPull + 0.9);
      crowdPlane.position.x = t < tTile ? OP : OT;
      four.forEach((p, k) => {
        const a = tDrop + k * 0.24, u = seg(t, a, a + 0.32);
        p.g.position.y = t < tTile ? 0 : (1 - E.o(u)) * 2.6 * (u < 1 ? 1 : 0);
        const sq = 1 - bell(t, a + 0.34, 0.05) * 0.12; p.g.scale.set(p.bs, p.bs * sq, p.bs);
        p.g.visible = t >= a;
        p.head.rotation.y = Math.sin(t * 1.3 + k) * 0.15;
      });
    }
    if (set === 'M') {
      const a = E.o5(seg(t, tMap + 0.05, tMap + 0.6));
      crowdSq.scale.setScalar(Math.max(0.001, a)); csFill.material.opacity = 0.85 * seg(t, tMap + 0.3, tMap + 0.8);
      jkts.forEach((g, k) => { const u = E.back(seg(t, tJkt + k * 0.2, tJkt + k * 0.2 + 0.35)); g.scale.setScalar(Math.max(0.001, u)); g.visible = t >= tJkt + k * 0.2; });
    }

    // ---------------------------------------------------------------- overlay
    show(pill, 1); show(brand, 1);
    show(head1, 1 - seg(t, L.b2.t0 - 0.1, L.b2.t0 + 0.1), `scale(${(1.06 - 0.06 * E.o5(seg(t, 0, 0.5))).toFixed(4)})`);
    show(dim, win(t, L.b2.t0 - 0.05, tDive - 0.1, 0.25) * 0.85);
    pop(head2, t, L.b2.t0, tDive - 0.12);
    const optT = [L.b2.t0, L.b2.w('Tiga'), L.b2.w('Atau')];
    opts.forEach((d, i) => {
      const i0 = E.o5(seg(t, optT[i], optT[i] + 0.35)), o = 1 - seg(t, tDive - 0.15, tDive);
      show(d, Math.min(i0, o), `translateX(${((1 - i0) * (i % 2 ? 120 : -120)).toFixed(1)}px)`);
    });
    {
      const k = t - tCount, n = Math.floor(k / 0.86); const on = k >= 0 && t < tDive - 0.1;
      ringN.textContent = String(3 - clamp(n, 0, 2)); arc.setAttribute('stroke-dashoffset', (502.65 * clamp((k % 0.86) / 0.86)).toFixed(1));
      show(ring, on ? 1 : 0, `scale(${(1 + bell(k % 0.86, 0.05, 0.08) * 0.12).toFixed(3)})`);
    }
    {
      const u = E.o(seg(t, L.b3.t0 + 0.15, L.b3.t0 + 2.0));
      num.textContent = fmt(8.3e9 * u);
      pop(counter, t, L.b3.t0, tTile - 0.12, { dy: -20 });
    }
    pop(asum, t, L.b4.t0 + 0.05, tPull - 0.05, { dy: -30 });
    for (const [d, p] of [[d1, V(OT, 0.02, -0.6)], [d2, V(OT - 0.62, 0.02, 0)]]) {
      const sp = toScreen(camera, p); d.style.left = `${sp.x}px`; d.style.top = `${sp.y}px`;
      pop(d, t, L.b4.t0 + 0.25, tPull, { base: 'translate(-50%, -50%)', s0: 0.6, dy: 0 });
    }
    pop(eq, t, tPull + 0.1, tMap + 1.6, { dy: -20 });
    pop(big, t, tMap + 0.35, tJkt - 0.15, { s0: 1.2, dy: 0 });
    {
      const sp = toScreen(camera, V(0, 0, 5000 - 18)); labSq.style.left = `${sp.x}px`; labSq.style.top = `${sp.y}px`;
      pop(labSq, t, tMap + 0.5, tGlobe - 0.1, { base: 'translate(-50%, -50%)', s0: 0.7, dy: 0 });
      labJ.forEach((d, k) => { const s2 = toScreen(camera, V(k === 0 ? -(JK + 3) : k === 1 ? 0 : JK + 3, 0, 5000 + 32)); d.style.left = `${s2.x}px`; d.style.top = `${s2.y}px`; pop(d, t, tJkt + k * 0.2 + 0.15, tGlobe - 0.1, { base: 'translate(-50%, -50%)', s0: 0.6, dy: 0 }); });
    }
    pop(ans, t, tAns, tGlobe - 0.1, { base: 'translateX(-50%)', s0: 1.4, dy: 0 });
    pop(ansSub, t, tAns + 0.2, tGlobe - 0.1, { dy: -10 });
    {
      const wp = V(0, 0, 0); mk.getWorldPosition(wp); const sp = toScreen(camera, wp);
      lab3.style.left = `${sp.x.toFixed(1)}px`; lab3.style.top = `${sp.y.toFixed(1)}px`;
      const i = E.o5(seg(t, tGlobe + 0.9, tGlobe + 1.25)), o = 1 - seg(t, L.b7.w('Tebakan') - 0.2, L.b7.w('Tebakan'));
      show(lab3, t >= tGlobe ? Math.min(i, o) : 0, `scale(${lerp(0.5, 1, i).toFixed(3)})`);
    }
    pop(head9, t, L.b7.w('Tebakan'), END + 1, { s0: 1.15, dy: 0 });
    pop(follow, t, L.b7.w('follow') - 0.05, END + 1, { base: 'translateX(-50%)', s0: 0.6, dy: 30 });
    show(topfade, Math.max(1 - seg(t, L.b2.t0 - 0.1, L.b2.t0 + 0.2), win(t, L.b3.t0, tGlobe, 0.2), seg(t, L.b7.w('Tebakan') - 0.2, L.b7.w('Tebakan'))) * 0.85);
    subs.update(t);
    if (t > tCount - 0.15 && t < tDive) show(subs.box, 0);
    show(flash, 0);
    S.draw(t);
  }

  const bounds = [0, L.b2.t0 + 1.5, tDive, tTile, tPull, tMap, tGlobe, END];
  const scenes = [];
  for (let i = 0; i < bounds.length - 1; i++) scenes.push({ a: bounds[i], b: bounds[i + 1] });
  return { duration: END, cues, scenes, render, marks: { lines: T.arr.map(x => [x.key, +x.t0.toFixed(3)]), END, tCount, tDive, tTile, tDrop, tPull, tMap, tJkt, tAns, tGlobe, beds: [] } };
});
