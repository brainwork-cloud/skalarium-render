// Skalarium "KASUS #1 · ES YANG MENYUSUT" — contoh gaya sinematik 3D (16 Nov 2026)
import { THREE, W, H, E, clamp, lerp, seg, win, seeded, n1, makeStage, camAt, applyCam, toScreen, std, canvasTex, shadowAll, particles, person, el, show, pop, makeSubs, timeline, boot } from '/lib/engine.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const bell = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CHECK = '<svg width="34" height="34" viewBox="0 0 24 24" style="vertical-align:-6px;margin-right:6px"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#5be39a" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW = '<svg width="58" height="40" viewBox="0 0 58 40"><path d="M4 20h42M34 8l12 12-12 12" fill="none" stroke="#5ad1ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FFWD = '<svg width="30" height="22" viewBox="0 0 30 22" style="vertical-align:-2px;margin-right:10px"><path d="M2 2l12 9-12 9zM15 2l12 9-12 9z" fill="#fff"/></svg>';

boot(async (info) => {
  const T = timeline(info, { e1: 0.3, e2: 0.35, e3: 0.3, e4: 0.3, e5: 2.75, e6: 0.3, e7: 0.35, e8: 0.3, e9: 0.3 }, 0.25);
  const L = T.L;
  const END = +(L.e9.t1 + 1.45).toFixed(3);
  const S = makeStage({ bloom: 0.7, radius: 0.55, threshold: 1.0, fog: 0x070a14, fogDensity: 0.05 });
  const { scene, camera, fx } = S;
  const R = seeded(7);
  const cues = [];
  const cue = (t, k, v = 1) => cues.push({ t: +t.toFixed(3), k, v });

  // ---------------------------------------------------------------- waktu
  const tSnap = L.e1.w('padahal') - 0.05;
  const tOpen = L.e2.t0 + 0.32;
  const tLine = L.e2.w('Semua') - 0.1;
  const tB = L.e3.t0 - 0.12;
  const tFan = L.e4.w('kipas');
  const tQ = L.e5.t0 - 0.12;
  const tCount = L.e5.t1 + 0.12;
  const tRev = L.e6.t0;
  const tGhost = L.e6.t0 + 0.55;
  const tMacro = L.e6.w('Es') - 0.1;
  const tX = L.e7.t0 - 0.12;
  const tFrost = L.e7.w('membekukannya') - 0.1;
  const iBat = L.e7.words.findIndex(w => w.w.startsWith('batumu'));
  const tLapse = L.e7.t0 + L.e7.words[iBat].a - 0.5;
  const tLid = L.e8.t0 + 0.3;
  const tA2 = L.e9.t0 - 0.12;
  const tClose = L.e9.t0 + 0.3;
  const cutsFx = [tLine, tB, tQ, tGhost, tMacro, tX, tA2];
  const setAt = t => (t < tLine ? 'A' : t < tB ? 'C' : t < tGhost ? 'B' : t < tMacro ? 'C' : t < tA2 ? 'B' : 'A');

  const box = (w, h, d, m, x, y, z, parent, shadow = true) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o;
  };
  const rbox = (w, h, d, r, m, x, y, z, parent) => {
    const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };
  const glowTex = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const glowPlane = (w, h, color, op) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));

  // ================================================================ SET A: kamar kos (asal)
  const A = new THREE.Group(); scene.add(A);
  const tileTex = canvasTex(1024, 1024, (g, w, h) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = `hsl(38, 10%, ${78 + R() * 7}%)`; g.fillRect(i * s, j * s, s, s);
      for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(90,82,70,${0.03 + R() * 0.06})`; g.fillRect(i * s + R() * s, j * s + R() * s, 2 + R() * 3, 2 + R() * 3); }
    }
    g.strokeStyle = 'rgba(64,60,56,.95)'; g.lineWidth = 7;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(2.5, 2.5);
  const floorA = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), std(0xffffff, 0.28, 0, { map: tileTex, envMap: S.env, envMapIntensity: 0.08 }));
  floorA.rotation.x = -Math.PI / 2; floorA.position.set(0, 0, -0.2); floorA.receiveShadow = true; A.add(floorA);
  const wallTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#c6cdd6'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.015 + R() * 0.03})`; g.fillRect(R() * w, R() * h, 2, 2); } });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(3, 3);
  const wallM = std(0xffffff, 0.93, 0, { map: wallTex });
  box(3.84, 2.8, 0.12, wallM, 0, 1.4, -2.26, A);
  box(0.12, 2.8, 4.2, wallM, 1.86, 1.4, -0.2, A);
  const lw = (z0, z1, y0, y1) => box(0.12, y1 - y0, z1 - z0, wallM, -1.86, (y0 + y1) / 2, (z0 + z1) / 2, A);
  lw(-2.32, -1.75, 0, 2.8); lw(-0.65, 1.9, 0, 2.8); lw(-1.75, -0.65, 0, 1.0); lw(-1.75, -0.65, 2.15, 2.8);
  box(3.84, 0.1, 4.2, wallM, 0, 2.85, -0.2, A);
  const skirt = std(0x3c4048, 0.55);
  box(3.6, 0.08, 0.015, skirt, 0, 0.04, -2.193, A, false); box(0.015, 0.08, 3.9, skirt, 1.793, 0.04, -0.2, A, false);
  // jendela + teralis + gorden
  const frameM = std(0x4a3426, 0.6), barM = std(0x1b1d22, 0.4, 0.6);
  box(0.09, 0.06, 1.16, frameM, -1.8, 1.0, -1.2, A); box(0.09, 0.06, 1.16, frameM, -1.8, 2.15, -1.2, A);
  box(0.09, 1.2, 0.06, frameM, -1.8, 1.575, -1.75, A); box(0.09, 1.2, 0.06, frameM, -1.8, 1.575, -0.65, A);
  box(0.06, 1.15, 0.045, frameM, -1.8, 1.575, -1.2, A);
  for (let z = -1.66; z <= -0.7; z += 0.118) box(0.022, 1.15, 0.022, barM, -1.74, 1.575, z, A);
  box(0.022, 0.022, 1.1, barM, -1.74, 1.33, -1.2, A); box(0.022, 0.022, 1.1, barM, -1.74, 1.82, -1.2, A);
  const cg = new THREE.PlaneGeometry(0.5, 1.75, 16, 1); const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 28) * 0.03);
  cg.computeVertexNormals();
  const curtain = new THREE.Mesh(cg, std(0x6b2f3a, 0.95, 0, { side: THREE.DoubleSide }));
  curtain.rotation.y = Math.PI / 2; curtain.position.set(-1.72, 1.55, -0.42); curtain.castShadow = curtain.receiveShadow = true; A.add(curtain);
  box(0.03, 0.03, 1.9, barM, -1.74, 2.35, -1.05, A);
  // langit malam di luar jendela
  const skyTex = canvasTex(1024, 768, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060b1c'); gr.addColorStop(0.7, '#13234a'); gr.addColorStop(1, '#203a6a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.7})`; g.fillRect(R() * w, R() * h * 0.6, 1.5 + R() * 1.5, 1.5 + R() * 1.5); }
    for (let i = 0; i < 14; i++) {
      const bw = 50 + R() * 110, bh = 90 + R() * 260, bx = R() * w; g.fillStyle = '#05070f'; g.fillRect(bx, h - bh, bw, bh);
      for (let k = 0; k < 10; k++) if (R() < 0.45) { g.fillStyle = R() < 0.5 ? 'rgba(255,190,110,.85)' : 'rgba(170,200,255,.6)'; g.fillRect(bx + 6 + R() * (bw - 16), h - bh + 10 + R() * (bh - 20), 7, 9); }
    }
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(7, 5.2), new THREE.MeshBasicMaterial({ map: skyTex, fog: false, color: new THREE.Color(1.15, 1.15, 1.25) }));
  sky.rotation.y = Math.PI / 2; sky.position.set(-3.6, 1.7, -1.1); A.add(sky);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6.2, 7), fog: false }));
  moonDisc.rotation.y = Math.PI / 2; moonDisc.position.set(-3.55, 2.62, -1.45); A.add(moonDisc);
  const moonHalo = glowPlane(1.6, 1.6, 0x9fbfff, 0.5); moonHalo.rotation.y = Math.PI / 2; moonHalo.position.set(-3.5, 2.62, -1.45); A.add(moonHalo);
  // cahaya bulan
  const moonP = V(-5.6, 3.75, -1.25);
  const moon = new THREE.SpotLight(0xa9c6ff, 3.3, 0, 0.32, 0.4, 0);
  moon.position.copy(moonP); moon.target.position.set(0.7, 0.7, -1.55); A.add(moon, moon.target);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0003; moon.shadow.normalBias = 0.02; moon.shadow.camera.near = 2; moon.shadow.camera.far = 12;
  A.add(new THREE.HemisphereLight(0x3a5078, 0x140f0b, 0.5));
  // berkas cahaya (volumetrik palsu)
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uO: { value: 0.13 }, uC: { value: new THREE.Color(0.62, 0.75, 1.0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT, uO; uniform vec3 uC;
      void main(){ float a = pow(sin(3.14159 * vUv.x), 1.3) * pow(1.0 - vUv.y, 1.4) * smoothstep(0.0, 0.06, vUv.y);
        a *= 0.7 + 0.3 * sin(vUv.x * 43.0 + vUv.y * 4.0 + uT * 0.6) * sin(vUv.x * 13.0 - uT * 0.3);
        gl_FragColor = vec4(uC * a * uO, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  {
    const C4 = [V(-1.8, 1.03, -1.72), V(-1.8, 1.03, -0.68), V(-1.8, 2.12, -0.68), V(-1.8, 2.12, -1.72)];
    const far = C4.map(c => c.clone().add(c.clone().sub(moonP).normalize().multiplyScalar(3.6)));
    const quads = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];
    const pos = [], uv = [], idx = [];
    quads.forEach(([a, b], q) => {
      const base = q * 4;
      pos.push(...C4[a].toArray(), ...C4[b].toArray(), ...far[b].toArray(), ...far[a].toArray());
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx);
    const shaft = new THREE.Mesh(sg, shaftMat); shaft.renderOrder = 5; A.add(shaft);
  }
  const dust = particles(S, 220, { soft: 1.4 }); A.add(dust.pts);
  const dustSeed = Array.from({ length: 220 }, () => ({ u: R(), v: R(), k: 0.15 + R() * 3.2, ph: R() * 6.28, s: 0.006 + R() * 0.012 }));
  // kasur, bantal, selimut
  rbox(0.95, 0.2, 1.95, 0.05, std(0x4b5868, 0.95), -1.28, 0.1, -1.1, A);
  rbox(0.55, 0.11, 0.32, 0.05, std(0xd9d2c3, 0.9), -1.28, 0.255, -1.86, A);
  {
    const bg = new THREE.PlaneGeometry(0.99, 1.26, 26, 30); bg.rotateX(-Math.PI / 2);
    const pa = bg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); const edge = Math.max(0, Math.abs(x) - 0.41) / 0.085; pa.setY(i, 0.04 + 0.028 * Math.sin(x * 9 + z * 4) * Math.cos(z * 7) + 0.02 * n1(x * 6 + z * 3, 2) - edge * edge * 0.13); }
    bg.computeVertexNormals();
    const bl = new THREE.Mesh(bg, std(0x7d4a5e, 0.95, 0, { side: THREE.DoubleSide })); bl.position.set(-1.28, 0.19, -0.75); bl.castShadow = bl.receiveShadow = true; A.add(bl);
  }
  // poster + kalender + jam dinding
  const posterTex = canvasTex(400, 560, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1d2a52'); gr.addColorStop(1, '#5a2350'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(w * 0.62, h * 0.36, 92, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '400 64px Anton'; g.fillText('KEEP', 36, h - 120); g.fillText('GOING', 36, h - 50);
  });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.58), std(0xffffff, 0.7, 0, { map: posterTex })); poster.position.set(-1.12, 1.62, -2.196); poster.receiveShadow = true; A.add(poster);
  const calTex = canvasTex(300, 420, (g, w, h) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, 90);
    g.fillStyle = '#fff'; g.font = '400 54px Anton'; g.textAlign = 'center'; g.fillText('NOV 2026', w / 2, 68);
    g.fillStyle = '#333'; g.font = '600 26px Poppins';
    for (let d = 1; d <= 30; d++) { const c = (d + 6) % 7, r = Math.floor((d + 6) / 7); g.fillStyle = d === 16 ? '#c0392b' : '#333'; g.fillText(String(d), 26 + c * 41, 140 + r * 52); }
  });
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), std(0xffffff, 0.8, 0, { map: calTex })); cal.position.set(1.42, 1.5, -2.196); cal.receiveShadow = true; A.add(cal);
  const clk = new THREE.Group(); clk.position.set(-0.32, 2.12, -2.19); A.add(clk);
  clk.add(new THREE.Mesh(new THREE.CircleGeometry(0.15, 40), std(0xf1eee6, 0.6)));
  clk.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 8, 40), std(0x22252b, 0.4, 0.3)));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const tk = new THREE.Mesh(new THREE.BoxGeometry(0.008, i % 3 ? 0.014 : 0.026, 0.004), std(0x15161a, 0.5)); tk.position.set(Math.sin(a) * 0.125, Math.cos(a) * 0.125, 0.004); tk.rotation.z = -a; clk.add(tk); }
  const hand = (len, w, ang, col = 0x111216) => { const g = new THREE.BoxGeometry(w, len, 0.005); g.translate(0, len / 2 - 0.018, 0); const h = new THREE.Mesh(g, std(col, 0.5)); h.position.z = 0.008; h.rotation.z = -ang; clk.add(h); return h; };
  hand(0.085, 0.014, (2 + 13 / 60) / 12 * Math.PI * 2); hand(0.12, 0.009, 13 / 60 * Math.PI * 2);
  const secH = hand(0.128, 0.004, 0, 0xc0392b);
  // meja lipat + HP menyala + gelas
  const tableM = std(0x6e4b33, 0.6);
  rbox(0.72, 0.03, 0.46, 0.012, tableM, 0.95, 0.3, 0.55, A);
  for (const [x, z] of [[0.66, 0.38], [1.24, 0.38], [0.66, 0.72], [1.24, 0.72]]) box(0.03, 0.29, 0.03, tableM, x, 0.145, z, A);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.095, 20), std(0xe9e3d6, 0.5)); mug.position.set(1.12, 0.363, 0.48); mug.castShadow = true; A.add(mug);
  box(0.16, 0.03, 0.22, std(0x7a3434, 0.8), 0.78, 0.33, 0.62, A);
  box(0.075, 0.008, 0.155, std(0x0c0d10, 0.3, 0.4), 0.98, 0.32, 0.6, A);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.142), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.8, 1.7) })); scr.rotation.x = -Math.PI / 2; scr.position.set(0.98, 0.3248, 0.6); A.add(scr);
  const phoneL = new THREE.PointLight(0x7fa8ff, 0.12, 1.4, 2); phoneL.position.set(0.98, 0.45, 0.6); A.add(phoneL);
  // pintu kamar + cahaya lorong dari celah bawah
  box(0.05, 2.02, 0.86, std(0x6b4a33, 0.6), 1.775, 1.02, 0.95, A);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), std(0xc9b27a, 0.3, 0.8)); knob.position.set(1.73, 1.0, 0.6); A.add(knob);
  const gap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.6, 1.1) })); gap.position.set(1.792, 0.006, 0.95); A.add(gap);
  const pool = glowPlane(1.3, 1.1, 0xffa050, 0.38); pool.rotation.x = -Math.PI / 2; pool.position.set(1.4, 0.004, 0.95); A.add(pool);
  const hallL = new THREE.PointLight(0xffa860, 0.5, 2.4, 2); hallL.position.set(1.62, 0.08, 0.95); A.add(hallL);
  // kulkas 2 pintu
  const FX = 0.72, FZ = -1.9, fW = 0.58;
  const fr = new THREE.Group(); fr.position.set(FX, 0, FZ); A.add(fr);
  const white = std(0xd3d7dd, 0.44, 0.05, { envMap: S.env, envMapIntensity: 0.18 });
  const gray = std(0x9aa3ad, 0.45, 0.4);
  for (const [x, z] of [[-0.24, 0.2], [0.24, 0.2], [-0.24, -0.24], [0.24, -0.24]]) box(0.05, 0.04, 0.05, gray, x, 0.02, z, fr);
  rbox(fW, 0.94, 0.56, 0.025, white, 0, 0.51, -0.02, fr);
  const y0 = 0.992, sH = 0.48;
  box(fW, 0.035, 0.56, white, 0, y0 + sH - 0.0175, -0.02, fr); box(fW, 0.035, 0.56, white, 0, y0 + 0.0175, -0.02, fr);
  box(0.035, sH, 0.56, white, -fW / 2 + 0.0175, y0 + sH / 2, -0.02, fr); box(0.035, sH, 0.56, white, fW / 2 - 0.0175, y0 + sH / 2, -0.02, fr);
  box(fW, sH, 0.035, white, 0, y0 + sH / 2, -0.2825, fr);
  const linerA = std(0xd9e8f6, 0.4, 0, { emissive: 0x6f9fd0, emissiveIntensity: 0 });
  box(fW - 0.075, sH - 0.075, 0.01, linerA, 0, y0 + sH / 2, -0.26, fr, false);
  // isi freezer kecil: cetakan es + bunga es tipis
  box(0.3, 0.03, 0.15, std(0xf0f4f8, 0.4), -0.04, y0 + 0.05, 0.02, fr);
  const iceMs = std(0xcfe9ff, 0.15, 0, { transparent: true, opacity: 0.85, emissive: 0x335f8a, emissiveIntensity: 0.25, envMap: S.env, envMapIntensity: 0.3 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) rbox(0.05, 0.04, 0.05, 0.01, iceMs, -0.15 + i * 0.075, y0 + 0.085, -0.02 + j * 0.07, fr);
  const doorPiv = new THREE.Group(); doorPiv.position.set(fW / 2, y0 + sH / 2, 0.26); fr.add(doorPiv);
  rbox(fW, sH - 0.01, 0.045, 0.02, white, -fW / 2, 0, 0.0225, doorPiv);
  box(fW - 0.07, sH - 0.08, 0.012, std(0x8a929c, 0.7), -fW / 2, 0, -0.004, doorPiv);
  box(0.022, 0.16, 0.03, gray, -fW + 0.05, -0.1, 0.06, doorPiv);
  rbox(fW, 0.93, 0.045, 0.02, white, 0, 0.505, 0.2825, fr);
  box(0.022, 0.22, 0.03, gray, -fW / 2 + 0.05, 0.84, 0.32, fr);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 4, 1) })); led.position.set(fW / 2 - 0.05, 0.93, 0.307); fr.add(led);
  for (const [x, y, c] of [[-0.12, 0.7, 0xe74c3c], [0.08, 0.62, 0xf5c542], [0.16, 0.76, 0x3498db]]) { const mg = box(0.05, 0.05, 0.012, std(c, 0.5), x, y, 0.31, fr); mg.rotation.z = (x * 7) % 0.4; }
  box(0.13, 0.09, 0.09, std(0xc4572e, 0.7), -0.15, y0 + sH + 0.045, -0.05, fr);
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 16), std(0x6aa36f, 0.3, 0, { transparent: true, opacity: 0.85 })); jar.position.set(0.12, y0 + sH + 0.06, 0.0); jar.castShadow = true; fr.add(jar);
  const fzLight = new THREE.PointLight(0xcfe6ff, 0, 1.6, 2); fzLight.position.set(0, y0 + sH - 0.09, 0.05); fr.add(fzLight);
  const fzGlow = glowPlane(1.2, 0.9, 0x9fd0ff, 0); fzGlow.position.set(0, y0 + sH / 2, 0.3); fr.add(fzGlow);
  const mist = particles(S, 260, { soft: 1.2 }); A.add(mist.pts);
  const mistSeed = Array.from({ length: 260 }, (_, i) => ({ b: i / 260 * 2.4, x: (R() - 0.5) * 0.46, vx: (R() - 0.5) * 0.12, vz: 0.12 + R() * 0.22, s: 0.08 + R() * 0.12, ph: R() * 6.28 }));

  // ================================================================ SET C: barisan tersangka (x = 40)
  const OC = 40;
  const C = new THREE.Group(); C.position.x = OC; scene.add(C);
  const floorC = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), std(0x272b33, 0.82)); floorC.rotation.x = -Math.PI / 2; floorC.receiveShadow = true; C.add(floorC);
  const chart = canvasTex(2048, 1024, (g, w, h) => {
    g.fillStyle = '#3b424f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.05})`; g.fillRect(R() * w, R() * h, 3, 3); }
    const ppm = 256;
    for (let cm = 0; cm <= 240; cm += 10) {
      const y = h - cm / 100 * ppm, major = cm % 50 === 0;
      g.fillStyle = major ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)'; g.fillRect(0, y - (major ? 3 : 1.5), w, major ? 6 : 3);
      if (major && cm >= 100) { g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '700 46px Poppins'; g.textAlign = 'right'; g.fillText(String(cm), 1520, y - 12); }
    }
  });
  const wallC = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), std(0xffffff, 0.9, 0, { map: chart })); wallC.position.set(0, 2, -1.25); wallC.receiveShadow = true; C.add(wallC);
  const keyC = new THREE.SpotLight(0xffe0bd, 3.6, 0, 0.5, 0.6, 0); keyC.position.set(0.4, 3.7, 2.9); keyC.target.position.set(0.3, 0.9, -0.8); C.add(keyC, keyC.target);
  keyC.castShadow = true; keyC.shadow.mapSize.set(1024, 1024); keyC.shadow.bias = -0.0004; keyC.shadow.normalBias = 0.02;
  const rimC1 = new THREE.PointLight(0x6b95ff, 2.2, 5, 2); rimC1.position.set(-1.6, 2.3, -0.95); const rimC2 = new THREE.PointLight(0x6b95ff, 2.2, 5, 2); rimC2.position.set(2.3, 2.3, -0.95); C.add(rimC1, rimC2);
  C.add(new THREE.HemisphereLight(0x405070, 0x100d0b, 0.45));
  const placard = (name, sub, bg = '#f6f4ee', fg = '#121318') => canvasTex(512, 300, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 12; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg; g.textAlign = 'center'; g.font = '400 128px Anton'; g.fillText(name, w / 2, 170); g.font = '700 40px Poppins'; g.fillText(sub, w / 2, 240);
  });
  const sus = [
    person({ h: 1.74, shirt: 0xe07a3f, pants: 0x2d3a52, skin: 0xc68b59, hair: 0x15100c }),
    person({ h: 1.58, shirt: 0x37a99b, pants: 0x3c3f58, skin: 0xe0ac7a, hair: 0x231710, style: 'long' }),
    person({ h: 1.68, shirt: 0xd8b13c, pants: 0x283246, skin: 0xb07a4f, hair: 0x0f0c0a, cap: 0x2c4f8a }),
  ];
  const susX = [-0.72, 0, 0.72];
  sus.forEach((s, i) => {
    s.g.position.set(susX[i], 0, -0.62); shadowAll(s.g); C.add(s.g);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.235), std(0xffffff, 0.75, 0, { map: placard(['DIMAS', 'RARA', 'BAYU'][i], `KAMAR ${i + 1}`) }));
    pl.position.set(0, 1.07, 0.33); pl.rotation.x = -0.08; pl.castShadow = true; s.body.add(pl);
    s.arms.forEach((a, k) => { a.piv.rotation.x = -0.28; a.fore.rotation.x = -1.3; a.piv.rotation.z = (k ? 1 : -1) * 0.06; });
  });
  // hantu uap = SUBLIMASI
  const GX = 1.46;
  const gsrc = person({ h: 1.66, eyes: false });
  gsrc.g.position.set(GX, 0, -0.62); gsrc.arms.forEach((a, k) => { a.piv.rotation.z = (k ? 1 : -1) * 0.18; }); gsrc.g.updateMatrixWorld(true);
  const NG = 1500, gTarget = [], gStart = [], gPh = [];
  {
    const meshes = []; gsrc.g.traverse(o => { if (o.isMesh) meshes.push(o); });
    const area = m => { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; const p = g.attributes.position; let s = 0; const a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0); for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); s += b.sub(a).cross(c.sub(a)).length() / 2; } const sc = V(); m.getWorldScale(sc); return s * sc.x * sc.y; };
    const ar = meshes.map(area); const tot = ar.reduce((x, y) => x + y, 0);
    const tmp = V(0, 0, 0);
    meshes.forEach((m, mi) => {
      const smp = new MeshSurfaceSampler(m).build(); const k = Math.round(NG * ar[mi] / tot);
      for (let i = 0; i < k && gTarget.length < NG; i++) { smp.sample(tmp); gTarget.push(tmp.clone().applyMatrix4(m.matrixWorld)); }
    });
    while (gTarget.length < NG) gTarget.push(gTarget[Math.floor(R() * gTarget.length)].clone());
    for (const p of gTarget) { const d = V(R() - 0.5, R() - 0.2, R() - 0.5).normalize().multiplyScalar(0.5 + R() * 1.1); gStart.push(p.clone().add(d)); gPh.push(R()); }
  }
  const ghost = particles(S, NG, { soft: 1.25 }); C.add(ghost.pts);
  const gPl = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.27), new THREE.MeshBasicMaterial({ map: placard('SUBLIMASI', 'BUKAN PENGHUNI', '#d9f1ff', '#0b2a44'), transparent: true, opacity: 0, color: new THREE.Color(1.2, 1.2, 1.2) }));
  gPl.position.set(GX, 1.04, -0.3); C.add(gPl);
  const ghostL = new THREE.PointLight(0x7fd0ff, 0, 2.5, 2); ghostL.position.set(GX, 1.2, -0.2); C.add(ghostL);

  // ================================================================ SET B: bagian dalam freezer (makro, x = 80)
  const OB = 80;
  const B = new THREE.Group(); B.position.x = OB; scene.add(B);
  const ribTex = canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 16; i++) { const y = i * 32; const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, '#9fb1c4'); gr.addColorStop(0.5, '#7a8ea4'); gr.addColorStop(1, '#9fb1c4'); g.fillStyle = gr; g.fillRect(0, y, w, 32); }
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + R() * 0.6})`; g.beginPath(); g.arc(R() * w, R() * h, 0.6 + R() * 1.8, 0, 7); g.fill(); }
  });
  ribTex.wrapS = ribTex.wrapT = THREE.RepeatWrapping; ribTex.repeat.set(3, 3);
  const linerM = std(0x8a9cb2, 0.5, 0, { envMap: S.env, envMapIntensity: 0.15 });
  const floorB = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), std(0xffffff, 0.45, 0, { map: ribTex, envMap: S.env, envMapIntensity: 0.12 })); floorB.rotation.x = -Math.PI / 2; floorB.receiveShadow = true; B.add(floorB);
  const ceilB = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), linerM); ceilB.rotation.x = Math.PI / 2; ceilB.position.y = 2.4; B.add(ceilB);
  for (const sx of [-1, 1]) { const wl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), std(0xd9e3ee, 0.5, 0, { map: ribTex, envMap: S.env, envMapIntensity: 0.12 })); wl.rotation.y = -sx * Math.PI / 2; wl.position.set(sx * 1.6, 1.2, 0); wl.receiveShadow = true; B.add(wl); }
  // bingkai depan (gasket)
  const gasketM = std(0x5b6470, 0.7);
  box(3.4, 0.1, 0.12, gasketM, 0, 2.45, 1.32, B); box(3.4, 0.1, 0.12, gasketM, 0, -0.05, 1.32, B); box(0.1, 2.5, 0.12, gasketM, -1.65, 1.2, 1.32, B); box(0.1, 2.5, 0.12, gasketM, 1.65, 1.2, 1.32, B);
  // panel belakang (lubang kipas + ventilasi bawah), bisa jadi tembus pandang (x-ray)
  const FAN = V(0.75, 1.85, -1.45);
  const panelAlpha = canvasTex(640, 480, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    const px = x => (x + 1.6) / 3.2 * w, py = y => (2.4 - y) / 2.4 * h;
    g.fillStyle = '#000'; g.beginPath(); g.arc(px(FAN.x), py(FAN.y), 0.4 / 3.2 * w, 0, 7); g.fill();
    for (let i = 0; i < 9; i++) { const x = -1.0 + i * 0.16; g.fillRect(px(x), py(0.36), 0.09 / 3.2 * w, 0.2 / 2.4 * h); }
  }, false);
  const panelM = std(0x9fb0c3, 0.5, 0, { alphaMap: panelAlpha, transparent: true, opacity: 1, envMap: S.env, envMapIntensity: 0.25, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), panelM); panel.position.set(0, 1.2, -1.3); panel.receiveShadow = true; B.add(panel);
  const panelEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(3.2, 2.4)), new THREE.LineBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0 })); panelEdge.position.copy(panel.position); B.add(panelEdge);
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 4, 6), transparent: true, opacity: 0, fog: false })); scan.position.set(0, 2.4, -1.28); B.add(scan);
  const backB = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), std(0x3a4350, 0.6, 0.3)); backB.position.set(0, 1.2, -1.95); B.add(backB);
  // kipas
  const fan = new THREE.Group(); fan.position.copy(FAN); B.add(fan);
  const fanM = std(0x7f8996, 0.4, 0.5);
  const housing = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.045, 10, 48), fanM); housing.position.z = 0.13; fan.add(housing);
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.3, 40, 1, true), std(0x46505c, 0.6, 0.3, { side: THREE.DoubleSide })); shroud.rotation.x = Math.PI / 2; shroud.position.z = -0.02; fan.add(shroud);
  const rotor = new THREE.Group(); fan.add(rotor);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.09, 24), std(0x2d333b, 0.5, 0.4)); hub.rotation.x = Math.PI / 2; rotor.add(hub);
  for (let k = 0; k < 5; k++) { const h = new THREE.Group(); h.rotation.z = k / 5 * Math.PI * 2; rotor.add(h); const bl = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.012), std(0x9ba7b5, 0.35, 0.3)); bl.position.y = 0.21; bl.rotation.y = 0.5; h.add(bl); }
  const grilleM = std(0xc9d3dd, 0.35, 0.6);
  for (const r of [0.13, 0.26, 0.38]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.009, 6, 48), grilleM); ring.position.set(FAN.x, FAN.y, -1.29); B.add(ring); }
  for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.8, 0.012), grilleM); sp.position.set(FAN.x, FAN.y, -1.29); sp.rotation.z = k / 8 * Math.PI; B.add(sp); }
  const fanGlow = new THREE.PointLight(0x62c6ff, 0.6, 2.6, 2); fanGlow.position.set(FAN.x, FAN.y, -1.15); B.add(fanGlow);
  // pipa pendingin (evaporator) + sirip
  const coilPts = [];
  {
    const xa = -1.2, xb = 0.25, ys = [0.6, 0.86, 1.12, 1.38, 1.64], z = -1.62, r = 0.13;
    ys.forEach((y, i) => {
      const l2r = i % 2 === 0, s0 = l2r ? xa : xb, s1 = l2r ? xb : xa;
      for (let k = 0; k <= 6; k++) coilPts.push(V(lerp(s0, s1, k / 6), y, z));
      if (i < ys.length - 1) { const cx = s1, cy = y + r, dir = l2r ? 1 : -1; for (let k = 1; k < 8; k++) { const a = -Math.PI / 2 + k / 8 * Math.PI; coilPts.push(V(cx + dir * Math.cos(a) * r, cy + Math.sin(a) * r, z)); } }
    });
  }
  const coilCurve = new THREE.CatmullRomCurve3(coilPts, false, 'centripetal');
  const alu = std(0xc7d0da, 0.3, 0.85, { envMap: S.env, envMapIntensity: 0.9 });
  const coil = new THREE.Mesh(new THREE.TubeGeometry(coilCurve, 420, 0.034, 10), std(0xc98a5a, 0.35, 0.8, { envMap: S.env, envMapIntensity: 0.8 })); coil.castShadow = true; B.add(coil);
  for (let k = 0; k < 30; k++) box(0.006, 1.24, 0.17, alu, -1.15 + k * 0.047, 1.12, -1.62, B, false);
  // bunga es tumbuh di pipa
  const NF = 760;
  const frostM = std(0xf6fbff, 0.25, 0, { emissive: 0xbfe2ff, emissiveIntensity: 1.25, flatShading: true });
  const frost = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), frostM, NF); frost.frustumCulled = false; B.add(frost);
  const frostSeed = Array.from({ length: NF }, (_, i) => {
    let p;
    if (i < NF * 0.65) { const u = R(); const c = coilCurve.getPointAt(u); const a = R() * Math.PI * 2; p = V(c.x, c.y + Math.sin(a) * 0.04, c.z + Math.cos(a) * 0.04); }
    else { const k = Math.floor(R() * 30); p = V(-1.15 + k * 0.047 + (R() < 0.5 ? -0.006 : 0.006), 0.52 + R() * 1.2, -1.62 + (R() - 0.5) * 0.16); }
    return { p, s: 0.011 + R() * 0.022, d: R() * 2.6, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6)) };
  });
  const behindL = new THREE.PointLight(0x9ccaff, 0, 3.2, 2); behindL.position.set(-0.45, 1.15, -1.3); B.add(behindL);
  // cetakan es + es batu
  const tray = new THREE.Group(); tray.position.set(0, 0, 0.35); tray.rotation.y = Math.PI / 2; B.add(tray);
  const trayToB = (x, y, z) => V(z, y, 0.35 - x);
  const trayM = std(0x2a74d0, 0.3, 0, { transparent: true, opacity: 0.95, envMap: S.env, envMapIntensity: 0.45 });
  box(1.5, 0.04, 0.9, trayM, 0, 0.02, 0, tray);
  box(1.5, 0.24, 0.035, trayM, 0, 0.14, 0.4325, tray); box(1.5, 0.24, 0.035, trayM, 0, 0.14, -0.4325, tray);
  box(0.035, 0.24, 0.9, trayM, 0.7325, 0.14, 0, tray); box(0.035, 0.24, 0.9, trayM, -0.7325, 0.14, 0, tray);
  box(0.025, 0.2, 0.83, trayM, -0.2385, 0.12, 0, tray); box(0.025, 0.2, 0.83, trayM, 0.2385, 0.12, 0, tray); box(1.43, 0.2, 0.025, trayM, 0, 0.12, 0, tray);
  const iceM = new THREE.MeshStandardMaterial({ color: 0xa9cdec, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.62, envMap: S.env, envMapIntensity: 0.35, emissive: 0x2d6aa0, emissiveIntensity: 0.25 });
  const coreM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.38, emissive: 0xcfe6ff, emissiveIntensity: 0.25 });
  const cubes = [];
  const cellX = [-0.477, 0, 0.477], cellZ = [-0.2075, 0.2075];
  cellZ.forEach(cz => cellX.forEach(cx => {
    const g = new THREE.Group(); g.position.set(cx, 0.04, cz); tray.add(g);
    const core = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.15, 0.2, 2, 0.05), coreM); core.position.y = 0.15; core.renderOrder = 1; g.add(core);
    const cube = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.3, 0.34, 4, 0.065), iceM); cube.position.y = 0.15; cube.renderOrder = 2; cube.castShadow = true; g.add(cube);
    g.rotation.y = (R() - 0.5) * 0.25;
    cubes.push(g);
  }));
  // tutup wadah (tips)
  const lid = new THREE.Group(); tray.add(lid);
  const lidM = new THREE.MeshStandardMaterial({ color: 0xd9eeff, roughness: 0.06, transparent: true, opacity: 0.2, envMap: S.env, envMapIntensity: 1.3, depthWrite: false, side: THREE.DoubleSide });
  box(1.58, 0.03, 0.98, lidM, 0, 0.66, 0, lid, false);
  box(1.58, 0.62, 0.02, lidM, 0, 0.34, 0.49, lid, false); box(1.58, 0.62, 0.02, lidM, 0, 0.34, -0.49, lid, false);
  box(0.02, 0.62, 0.98, lidM, 0.79, 0.34, 0, lid, false); box(0.02, 0.62, 0.98, lidM, -0.79, 0.34, 0, lid, false);
  const lidEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.6, 0.64, 1.0)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); lidEdge.position.y = 0.35; lid.add(lidEdge);
  const clip = std(0x2f9e6e, 0.5); box(0.18, 0.08, 0.05, clip, 0, 0.6, 0.51, lid); box(0.18, 0.08, 0.05, clip, 0, 0.6, -0.51, lid);
  // lampu freezer
  const keyB = new THREE.SpotLight(0xeef6ff, 1.45, 0, 0.8, 0.65, 0); keyB.position.set(0, 2.32, 1.0); keyB.target.position.set(0, 0, -0.5); B.add(keyB, keyB.target);
  keyB.castShadow = true; keyB.shadow.mapSize.set(1024, 1024); keyB.shadow.bias = -0.0004; keyB.shadow.normalBias = 0.02; keyB.shadow.camera.near = 0.3; keyB.shadow.camera.far = 6;
  B.add(new THREE.HemisphereLight(0x9fc0e8, 0x1c2430, 0.3));
  const rimB = new THREE.SpotLight(0x8fd6ff, 1.8, 0, 0.7, 0.7, 0); rimB.position.set(0.2, 2.2, -1.1); rimB.target.position.set(0, 0.2, 0.4); B.add(rimB, rimB.target);
  const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.14), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.5, 6.2) })); fixture.position.set(0, 2.385, 1.0); B.add(fixture);
  // partikel: aliran udara (loop) + uap dari es
  const loop = new THREE.CatmullRomCurve3([V(0.75, 1.9, -1.15), V(0.6, 2.05, -0.3), V(0.3, 1.95, 0.7), V(-0.2, 1.3, 1.05), V(-0.35, 0.62, 0.8), V(-0.25, 0.48, -0.2), V(-0.35, 0.3, -1.1), V(-0.4, 0.25, -1.5), V(-0.55, 0.9, -1.72), V(-0.2, 1.5, -1.7), V(0.5, 1.85, -1.62)], true, 'catmullrom', 0.5);
  const NA = 230, TR = 3;
  const air = particles(S, NA * TR, { soft: 1.3 }); B.add(air.pts);
  const airSeed = Array.from({ length: NA }, () => ({ u: R(), o: V((R() - 0.5) * 0.45, (R() - 0.5) * 0.3, (R() - 0.5) * 0.45), sp: 0.075 + R() * 0.04 }));
  const NV = 300;
  const vap = particles(S, NV, { soft: 1.1 }); B.add(vap.pts);
  const vapSeed = Array.from({ length: NV }, (_, i) => ({ c: i % 6, b: R() * 2.6, x: (R() - 0.5) * 0.3, z: (R() - 0.5) * 0.26, ph: R() * 6.28, s: 0.03 + R() * 0.05 }));

  // ================================================================ overlay
  const dim = el('', 'dim');
  const topfade = el('', 'topfade');
  const pill = el('<span class="dot"></span>KASUS #1 · ES YANG MENYUSUT', 'pill');
  const brand = el('<i></i>SKALARIUM', 'brand');
  const head1 = el('ES BATUMU<br><span class="hl">MENYUSUT</span><br>SENDIRI?', 'head');
  const ttl = el('<div class="k">KASUS #1</div><div class="v">ES YANG<br><span class="g">MENYUSUT</span></div>', 'ttl');
  const head2 = el('SEMUA PUNYA <span class="g">ALIBI</span>', 'head c mid');
  const tags = ['MUDIK', 'ANTI ES', 'SHIFT MALAM'].map(s => el(`${CHECK}${s}`, 'tag'));
  const clue1 = el('<div class="k">PETUNJUK #1</div><div class="v">ESNYA NGGAK PERNAH <span class="g">JADI AIR</span></div>', 'clue');
  const clue2 = el('<div class="k">PETUNJUK #2</div><div class="v">FREEZER <span class="g">NO FROST</span> + KIPAS NONSTOP</div>', 'clue');
  const head5 = el('SIAPA <span class="g">PELAKUNYA?</span>', 'head c mid');
  const opts = [['A', 'DICURI TEMAN KOS'], ['B', 'MENCAIR DIAM-DIAM'], ['C', 'MENGUAP LANGSUNG']].map(([b, s], i) => el(`<div class="b">${b}</div><span>${s}</span><span class="ck"></span>`, 'opt', { top: `${700 + i * 172}px` }));
  const ring = el(`<svg width="190" height="190"><circle cx="95" cy="95" r="80" fill="rgba(8,12,22,.88)" stroke="rgba(255,255,255,.14)" stroke-width="12"/><circle class="arc" cx="95" cy="95" r="80" fill="none" stroke="#F5C542" stroke-width="12" stroke-linecap="round" transform="rotate(-90 95 95)" stroke-dasharray="502.65" stroke-dashoffset="0"/></svg><div class="n">3</div>`, 'ring', { left: '415px', top: '1240px' });
  const arc = ring.querySelector('.arc'), ringN = ring.querySelector('.n');
  const stamp = el('<div class="stamp">PELAKU</div><div class="suspect"><div class="n">SUBLIMASI</div><div class="s">es → langsung jadi uap</div></div>', 'stampwrap', { top: '290px' });
  const phase = el(`<div class="ph g">PADAT</div><div class="arr">${ARROW}</div><div class="ph x">CAIR<i class="strike"></i></div><div class="arr">${ARROW}</div><div class="ph g">UAP</div>`, 'phase');
  const strike = phase.querySelector('.strike');
  const lab3 = (text, cyan = false, stem = 96) => el(`<div class="bx${cyan ? ' c' : ''}" style="bottom:${stem}px">${text}</div><div class="st${cyan ? ' c' : ''}" style="height:${stem}px"></div><div class="dt${cyan ? ' c' : ''}"></div>`, 'l3', { transformOrigin: '0 0' });
  const labs = {
    kipas: { d: lab3('KIPAS', false, 70), p: V(OB + FAN.x - 0.4, FAN.y - 0.02, FAN.z + 0.2) },
    kipas7: { d: lab3('KIPAS'), p: V(OB + FAN.x, FAN.y + 0.05, FAN.z + 0.2) },
    uap: { d: lab3('UAP AIR', true, 120), p: V(OB - 0.1, 0.72, 0.4) },
    pipa: { d: lab3('PIPA PENDINGIN', true, 150), p: V(OB - 0.55, 1.38, -1.58) },
    bunga: { d: lab3('BUNGA ES', false, 80), p: V(OB - 0.95, 0.86, -1.55) },
    kering: { d: lab3('UDARA KERING', true, 110), p: V(OB + 0.45, 1.25, 0.75) },
  };
  const badge = el(`${FFWD}TIMELAPSE`, 'badge', { left: '60px', top: '300px' });
  const tip = el('<div class="k">TIPS</div><div class="v">SIMPAN DI <span class="g">WADAH TERTUTUP</span></div>', 'tip');
  const head9 = el('KASUS #2<br><span class="g">LEBIH ANEH</span>', 'head c');
  const follow = el('+ FOLLOW SKALARIUM', 'follow');
  const subs = makeSubs(T.arr);
  const flash = el('', 'flash');

  // ================================================================ kamera
  const add = (o, v) => [v[0] + o, v[1], v[2]];
  const camA1 = [
    { t: 0, p: [-0.38, 1.62, 2.6], l: [0.42, 1.0, -1.9], fov: 50, r: 0.03 },
    { t: tSnap, p: [-0.1, 1.45, 1.15], l: [0.6, 1.05, -1.9], fov: 46, r: 0.025, e: E.sine },
    { t: tSnap + 0.4, p: [0.04, 1.02, -0.22], l: [0.7, 1.26, -1.9], fov: 42, r: -0.05, e: E.o5 },
    { t: tOpen, p: [0.12, 1.08, -0.28], l: [0.72, 1.25, -1.9], fov: 41, r: -0.04, e: E.sine },
    { t: tOpen + 0.9, p: [0.2, 1.42, 0.12], l: [0.74, 1.12, -1.9], fov: 41, e: E.io },
    { t: tLine, p: [0.16, 1.44, 0.2], l: [0.74, 1.12, -1.9], fov: 41.5, e: E.sine },
  ];
  const camA2 = [
    { t: tA2, p: [0.38, 1.36, -0.12], l: [0.72, 1.2, -1.9], fov: 37 },
    { t: tA2 + 1.3, p: [0.0, 1.45, 0.45], l: [0.62, 1.02, -1.9], fov: 44, e: E.io },
    { t: END, p: [-0.42, 1.66, 2.7], l: [0.45, 1.0, -1.9], fov: 50, e: E.sine },
  ];
  const camC1 = [
    { t: tLine, p: add(OC, [-0.42, 1.38, 3.5]), l: add(OC, [-0.12, 1.3, -0.6]), fov: 55 },
    { t: tB, p: add(OC, [0.24, 1.34, 3.2]), l: add(OC, [0.14, 1.28, -0.6]), fov: 54, e: E.sine },
  ];
  const camC2 = [
    { t: tGhost, p: add(OC, [0.6, 1.38, 3.2]), l: add(OC, [0.95, 1.28, -0.6]), fov: 51 },
    { t: tMacro, p: add(OC, [0.88, 1.34, 2.75]), l: add(OC, [1.1, 1.26, -0.6]), fov: 49, e: E.sine },
  ];
  const camB1 = [
    { t: tB, p: add(OB, [-0.35, 1.3, 2.15]), l: add(OB, [0.0, 0.08, 0.3]), fov: 46 },
    { t: L.e4.t0 - 0.15, p: add(OB, [0.15, 1.18, 1.95]), l: add(OB, [0.04, 0.1, 0.28]), fov: 44, e: E.sine },
    { t: tFan + 0.1, p: add(OB, [0.2, 1.35, 2.0]), l: add(OB, [0.72, 1.86, -1.45]), fov: 40, e: E.io },
    { t: tQ, p: add(OB, [0.45, 1.5, 1.6]), l: add(OB, [0.75, 1.88, -1.45]), fov: 38, e: E.sine },
  ];
  const camB2 = [
    { t: tQ, p: add(OB, [-1.05, 1.28, 2.65]), l: add(OB, [0, 0.42, -0.2]), fov: 46 },
    { t: tGhost, p: add(OB, [0.62, 1.2, 2.55]), l: add(OB, [0, 0.42, -0.2]), fov: 44, e: E.sine },
  ];
  const camB3 = [
    { t: tMacro, p: add(OB, [0.66, 0.4, 1.78]), l: add(OB, [0.2, 0.46, 0.6]), fov: 36 },
    { t: tX, p: add(OB, [0.52, 0.38, 1.55]), l: add(OB, [0.2, 0.48, 0.6]), fov: 34, e: E.sine },
  ];
  const camB4 = [
    { t: tX, p: add(OB, [-0.35, 1.55, 3.45]), l: add(OB, [-0.12, 1.02, -0.9]), fov: 50 },
    { t: L.e7.w('Udaranya'), p: add(OB, [0.12, 1.36, 3.05]), l: add(OB, [0.0, 0.92, -0.8]), fov: 48, e: E.sine },
    { t: L.e7.t1, p: add(OB, [0.3, 1.35, 2.3]), l: add(OB, [0.0, 0.2, 0.3]), fov: 46, e: E.io },
    { t: tLid + 0.9, p: add(OB, [0.2, 1.42, 2.4]), l: add(OB, [0, 0.3, 0.3]), fov: 46, e: E.sine },
    { t: tA2, p: add(OB, [0.12, 1.45, 2.3]), l: add(OB, [0, 0.3, 0.3]), fov: 46, e: E.sine },
  ];
  const camFor = t => {
    if (t < tLine) return camA1; if (t < tB) return camC1; if (t < tQ) return camB1; if (t < tGhost) return camB2;
    if (t < tMacro) return camC2; if (t < tX) return camB3; if (t < tA2) return camB4; return camA2;
  };
  const tStamp = tGhost + 0.22;

  // ================================================================ cue suara
  cue(0, 'hit'); cue(0, 'music', 1);
  cue(tSnap, 'whoosh'); cue(tSnap + 0.35, 'boom');
  cue(L.e2.t0, 'hit'); cue(tOpen, 'door'); cue(tOpen + 0.1, 'hiss');
  cue(tLine, 'whoosh'); [0, 1, 2].forEach(i => cue(tLine + 0.55 + i * 0.42, 'pop'));
  cue(tB, 'whoosh'); cue(L.e3.t0 + 0.05, 'pop'); cue(L.e4.t0 + 0.05, 'pop'); cue(tFan, 'fan', 1);
  cue(tQ, 'whoosh'); [0, 1, 2].forEach(i => cue(L.e5.t0 + 0.25 + i * 0.22, 'pop')); cue(tCount - 0.05, 'music', 0);
  [0, 1, 2].forEach(i => cue(tCount + i * 0.86, 'tick'));
  cue(tRev, 'ding'); cue(tRev, 'music', 1); cue(tGhost, 'whoosh'); cue(tGhost + 0.02, 'shimmer'); cue(tStamp, 'stamp');
  cue(tMacro, 'whoosh'); [0, 1, 2].forEach(i => cue(tMacro + 0.15 + i * 0.18, 'pop')); cue(tMacro + 0.95, 'swish');
  cue(tX, 'whoosh'); cue(tX + 0.35, 'scan');
  cue(tFrost, 'crystal'); cue(tLapse, 'lapse');
  cue(L.e8.t0, 'pop'); cue(tLid + 0.48, 'click');
  cue(tA2, 'whoosh'); cue(tClose + 0.32, 'thud'); cue(L.e9.w('Follow'), 'pop'); cue(L.e9.w('Follow') + 0.05, 'ding');
  cue(END - 0.5, 'music', 0);

  const qs = new THREE.Quaternion(), ms = new THREE.Matrix4(), vs = V(0, 0, 0), ss = V(0, 0, 0);
  const iceScale = t => lerp(0.9, 0.84, seg(t, tB, tMacro)) - 0.22 * E.sine(seg(t, tLapse, tLapse + 2.2));

  function render(t) {
    const set = setAt(t);
    A.visible = set === 'A'; B.visible = set === 'B'; C.visible = set === 'C';
    // kamera + transisi
    let c = camAt(camFor(t), t, set === 'B' ? 0.006 : 0.012);
    const kick = bell(t, tStamp + 0.04, 0.09) * 0.03;
    c.p[0] += Math.sin(t * 91) * kick; c.p[1] += Math.cos(t * 77) * kick;
    applyCam(camera, c);
    let zb = 0, fl = 0;
    for (const k of cutsFx) { zb = Math.max(zb, bell(t, k, 0.085)); fl = Math.max(fl, bell(t, k, 0.035) * 0.45); }
    zb = Math.max(zb, bell(t, tSnap + 0.18, 0.12) * 0.9);
    fl = Math.max(fl, bell(t, tStamp + 0.02, 0.05) * 0.35);
    fx.uniforms.uZoom.value = zb; fx.uniforms.uFlash.value = fl;
    fx.uniforms.uFade.value = seg(t, END - 0.35, END);
    // kabut & latar per set
    if (set === 'A') { scene.fog.color.setHex(0x070a14); scene.fog.density = 0.05; scene.background.setHex(0x05070d); S.renderer.toneMappingExposure = 1.05; }
    if (set === 'C') { scene.fog.color.setHex(0x080a10); scene.fog.density = 0.045; scene.background.setHex(0x05060a); S.renderer.toneMappingExposure = 1.0; }
    S.bloomPass.threshold = set === 'B' ? 1.25 : 1.0;
    if (set === 'B') { scene.fog.color.setHex(0x0f1d30); scene.fog.density = 0.055; scene.background.setHex(0x0a1422); S.renderer.toneMappingExposure = 1.0; }
    S.bloomPass.threshold = set === 'B' ? 1.25 : 1.0;

    if (set === 'A') {
      shaftMat.uniforms.uT.value = t;
      secH.rotation.z = -((t * 6) % 60) / 60 * Math.PI * 2 - 0.4;
      const open = E.back(seg(t, tOpen, tOpen + 0.75)) * (1 - E.o(seg(t, tClose, tClose + 0.38)));
      const ang = (t < tA2 ? E.back(seg(t, tOpen, tOpen + 0.75)) : 1 - E.i(seg(t, tClose, tClose + 0.36))) * 1.72;
      doorPiv.rotation.y = t < tOpen ? 0 : ang;
      const lit = t < tA2 ? seg(t, tOpen + 0.05, tOpen + 0.4) : 1 - seg(t, tClose + 0.25, tClose + 0.36);
      fzLight.intensity = 0.22 * lit; linerA.emissiveIntensity = 0.35 * lit; fzGlow.material.opacity = 0.16 * lit;
      // debu di berkas cahaya
      dustSeed.forEach((d, i) => {
        const z = lerp(-1.72, -0.68, d.u), y = lerp(1.03, 2.12, d.v);
        const c0 = V(-1.8, y, z); const dir = c0.clone().sub(moonP).normalize();
        const p = c0.add(dir.multiplyScalar(d.k));
        p.x += n1(t * 0.15 + i, 1) * 0.08; p.y += n1(t * 0.12 + i * 1.7, 2) * 0.06 + Math.sin(t * 0.3 + d.ph) * 0.02; p.z += n1(t * 0.1 + i * 2.3, 3) * 0.08;
        const tw = 0.45 + 0.55 * Math.max(0, Math.sin(t * 1.3 + d.ph));
        dust.set(i, p.x, p.y, p.z, 0.75, 0.85, 1.0, 0.55 * tw * (1 - d.k / 3.6), d.s);
      });
      dust.done();
      // kabut dingin turun dari freezer
      mistSeed.forEach((m, i) => {
        const life = 2.4; const since = t - tOpen - 0.1;
        let a = 0, x = 0, y = 0, z = 0, s = 0;
        if (since > m.b) {
          const age = (since - m.b) % life; const born = t - age;
          if (born < tClose + 0.1 || t < tA2) {
            const fall = Math.min(age * 0.22 + age * age * 0.12, 1.0);
            y = y0 + 0.06 - fall; const floorHit = Math.max(0, -(y - 0.04));
            y = Math.max(0.04, y);
            x = FX + m.x + m.vx * age * (1 + floorHit * 4) + Math.sin(age * 2 + m.ph) * 0.03;
            z = FZ + 0.32 + m.vz * age * (1 + floorHit * 3);
            s = m.s * (0.6 + age * 0.9);
            a = 0.16 * Math.min(1, age / 0.3) * (1 - age / life) * (t < tA2 ? lit : 1 - seg(t, tClose + 0.3, tClose + 1.6));
          }
        }
        mist.set(i, x, y, z, 0.78, 0.9, 1.0, a, s);
      });
      mist.done();
    }

    if (set === 'C') {
      const vis = t >= tGhost;
      sus.forEach((s, i) => {
        s.body.scale.y = 1 + Math.sin(t * 2.2 + i * 1.3) * 0.006;
        const nod = bell(t, tLine + 0.62 + i * 0.42, 0.12) * 0.18;
        s.head.rotation.x = nod;
        s.head.rotation.y = vis ? E.o(seg(t, tStamp - 0.05, tStamp + 0.35)) * (0.75 - i * 0.12) : Math.sin(t * 0.7 + i) * 0.08;
      });
      gPl.material.opacity = vis ? E.o(seg(t, tGhost + 0.25, tGhost + 0.6)) : 0;
      gPl.position.y = 1.04 + Math.sin(t * 2.4) * 0.015;
      ghostL.intensity = vis ? 0.9 * seg(t, tGhost, tGhost + 0.4) : 0;
      for (let i = 0; i < NG; i++) {
        if (!vis) { ghost.set(i, 0, -50, 0, 0, 0, 0, 0, 0); continue; }
        const k = E.o(seg(t, tGhost - 0.15 + gPh[i] * 0.15, tGhost + 0.38 + gPh[i] * 0.2));
        const tg = gTarget[i], st = gStart[i];
        const rise = ((t * 0.18 + gPh[i]) % 1) * 0.05;
        const x = lerp(st.x, tg.x, k) + Math.sin(t * 2.1 + i) * 0.006 * k;
        const y = lerp(st.y, tg.y, k) + rise * k;
        const z = lerp(st.z, tg.z, k) + Math.cos(t * 1.7 + i * 0.7) * 0.006 * k;
        const fl2 = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.3);
        ghost.set(i, x, y, z, 0.55, 0.84, 1.0, (0.26 + 0.16 * fl2) * seg(t, tGhost - 0.15, tGhost + 0.2), 0.018 + gPh[i] * 0.016);
      }
      ghost.done();
    }

    if (set === 'B') {
      rotor.rotation.z = -t * Math.PI * 2 * 2.1;
      const xr = seg(t, tX + 0.3, tX + 1.1);
      panelM.opacity = 1 - 0.86 * xr; panelM.depthWrite = xr < 0.5;
      panelEdge.material.opacity = 0.7 * xr * (t >= tX ? 1 : 0);
      scan.material.opacity = t >= tX ? bell(t, tX + 0.7, 0.35) : 0; scan.position.y = lerp(2.4, 0.0, seg(t, tX + 0.3, tX + 1.1));
      behindL.intensity = t >= tX ? 1.4 * xr : 0;
      // bunga es
      for (let i = 0; i < NF; i++) {
        const f = frostSeed[i];
        const g = t >= tX ? E.o(seg(t, tFrost + f.d * 0.9, tFrost + f.d * 0.9 + 0.7)) : 0;
        const s = f.s * (0.08 + g) * (t >= tX ? 1 : 0.0001);
        ms.compose(f.p, f.q, ss.set(s, s * 1.4, s)); frost.setMatrixAt(i, ms);
      }
      frost.instanceMatrix.needsUpdate = true;
      // es menyusut
      const sc = iceScale(t);
      cubes.forEach(g => g.scale.setScalar(sc));
      // tutup wadah turun
      const ld = t < L.e8.t0 ? 1 : 1 - E.back(seg(t, tLid, tLid + 0.5));
      lid.position.y = ld * 2.6; lid.visible = ld < 0.999;
      const closed = t >= tLid + 0.45;
      // aliran udara
      const airOn = t < tQ ? lerp(0.25, 1, seg(t, tFan - 0.2, tFan + 0.4)) : t < tMacro ? 0.75 : t < tX ? 0.12 : 1;
      airSeed.forEach((a, i) => {
        for (let k = 0; k < TR; k++) {
          const u = (((a.u + t * a.sp - k * 0.008) % 1) + 1) % 1;
          const p = loop.getPointAt(u);
          const behind = p.z < -1.3;
          const al = airOn * (k === 0 ? 0.5 : k === 1 ? 0.3 : 0.15) * (behind ? 0.6 * xr + 0.05 : 1);
          air.set(i * TR + k, p.x + a.o.x, p.y + a.o.y, p.z + a.o.z, 0.45, 0.82, 1.0, al, 0.035 - k * 0.008);
        }
      });
      air.done();
      // uap: makro = naik lurus; x-ray = ikut aliran ke ventilasi lalu ke pipa
      const toVent = t >= tX;
      vapSeed.forEach((v, i) => {
        const cube = cubes[v.c]; const life = toVent ? 2.6 : 1.8;
        const age = ((t + v.b) % life); const born = t - age;
        let a = 0, x = 0, y = 0, z = 0, s = v.s;
        const top = 0.04 + 0.3 * sc;
        const wb = trayToB(cube.position.x + v.x * sc, 0, cube.position.z + v.z * sc); const bx = wb.x, bz = wb.z;
        const macroVis = t >= tMacro && t < tX;
        if ((macroVis || toVent || (t >= tB && t < tMacro)) && !(closed && born > tLid + 0.4)) {
          if (!toVent) {
            x = bx + Math.sin(age * 2.2 + v.ph) * 0.03 * age; y = top + age * 0.17; z = bz + Math.cos(age * 1.7 + v.ph) * 0.02 * age;
            a = (macroVis ? (v.c === 3 ? 0.4 : 0.02) : 0.04) * Math.min(1, age / 0.35) * (1 - age / life); s = v.s * (0.45 + age * 0.7) * (macroVis ? 0.55 : 0.8);
          } else {
            const k = age / life;
            const p0 = V(bx, top + 0.02, bz), p1 = V(bx * 0.6, top + 0.45, bz - 0.2), p2 = V(-0.3, 0.35, -1.0), p3 = V(-0.4, 0.3, -1.55);
            const b = new THREE.CubicBezierCurve3(p0, p1, p2, p3).getPoint(k);
            x = b.x; y = b.y; z = b.z; a = 0.3 * Math.min(1, k / 0.12) * (1 - Math.max(0, k - 0.75) / 0.25); s = v.s * (0.7 + k * 0.6);
          }
        }
        vap.set(i, x, y, z, 0.92, 0.96, 1.0, a, s);
      });
      vap.done();
    }

    // ---------------------------------------------------------------- overlay
    show(pill, 1); show(brand, 1);
    const hookOut = L.e2.t0 - 0.08;
    show(head1, 1 - seg(t, hookOut, hookOut + 0.16), `translateY(${(-E.i(seg(t, hookOut, hookOut + 0.16)) * 40).toFixed(1)}px) scale(${(1.06 - 0.06 * E.o5(seg(t, 0, 0.5))).toFixed(4)})`);
    pop(ttl, t, L.e2.t0, tLine - 0.12, { s0: 1.25, dy: 0 });
    pop(head2, t, tLine + 0.1, tB - 0.12);
    tags.forEach((d, i) => {
      const sp = toScreen(camera, V(OC + susX[i], [1.74, 1.58, 1.68][i] + 0.28, -0.62));
      d.style.left = `${sp.x}px`; d.style.top = `${sp.y}px`;
      pop(d, t, tLine + 0.55 + i * 0.42, tB - 0.1, { base: 'translate(-50%, -100%)', s0: 0.6, dy: 20 });
    });
    pop(clue1, t, L.e3.t0, L.e4.t0 - 0.1, { dy: -30 });
    pop(clue2, t, L.e4.t0, tQ - 0.05, { dy: -30 });
    show(dim, win(t, tQ, tGhost - 0.1, 0.25) * 0.9);
    pop(head5, t, L.e5.t0 + 0.05, tGhost - 0.1);
    opts.forEach((d, i) => {
      const reveal = t >= tRev;
      d.classList.toggle('win', reveal && i === 2);
      d.querySelector('.ck').innerHTML = reveal && i === 2 ? CHECK.replace('34', '54').replace('34', '54') : '';
      const fadeOther = reveal && i !== 2 ? 0.28 : 1;
      const i0 = E.o5(seg(t, L.e5.t0 + 0.25 + i * 0.22, L.e5.t0 + 0.6 + i * 0.22)), o = 1 - seg(t, tGhost - 0.1, tGhost + 0.05);
      const pulse = i === 2 ? 1 + bell(t, tRev + 0.12, 0.12) * 0.06 : 1;
      show(d, Math.min(i0, o) * fadeOther, `translateX(${((1 - i0) * (i % 2 ? 120 : -120)).toFixed(1)}px) scale(${pulse.toFixed(4)})`);
    });
    {
      const k = t - tCount, n = Math.floor(k / 0.86);
      const on = k >= 0 && t < tRev - 0.02;
      ringN.textContent = String(3 - clamp(n, 0, 2));
      arc.setAttribute('stroke-dashoffset', (502.65 * clamp((k % 0.86) / 0.86)).toFixed(1));
      const pz = 1 + bell(k % 0.86, 0.05, 0.08) * 0.12;
      show(ring, on ? Math.min(1, seg(t, tCount - 0.1, tCount + 0.1)) : 0, `scale(${pz.toFixed(3)})`);
    }
    {
      const a = tStamp, i = E.o5(seg(t, a, a + 0.18)), o = 1 - seg(t, tMacro - 0.12, tMacro);
      show(stamp, Math.min(i, o), `scale(${lerp(2.2, 1, i).toFixed(4)}) rotate(${lerp(-14, -4, i).toFixed(2)}deg)`);
    }
    pop(phase, t, tMacro + 0.12, tX - 0.1, { dy: -20 });
    strike.style.transform = `scaleX(${E.o(seg(t, tMacro + 0.95, tMacro + 1.15)).toFixed(3)})`;
    const labWin = { kipas: [tFan, tQ - 0.1], kipas7: [L.e7.t0 + 0.1, L.e7.w('pipa') + 0.6], uap: [L.e7.w('uap'), L.e7.w('bunga') + 0.3], pipa: [L.e7.w('pipa'), L.e7.w('Udaranya') + 0.2], bunga: [L.e7.w('bunga'), L.e7.w('Udaranya') + 0.6], kering: [L.e7.w('Udaranya'), tLapse - 0.1] };
    for (const [k, o] of Object.entries(labs)) {
      const [a, b] = labWin[k];
      if (t < a - 0.1 || t > b + 0.3 || set !== 'B') { show(o.d, 0); continue; }
      const sp = toScreen(camera, o.p);
      o.d.style.left = `${sp.x.toFixed(1)}px`; o.d.style.top = `${sp.y.toFixed(1)}px`;
      const i = E.o5(seg(t, a, a + 0.3)), ou = 1 - seg(t, b, b + 0.25);
      show(o.d, Math.min(i, ou), `scale(${lerp(0.5, 1, i).toFixed(3)})`);
    }
    pop(badge, t, tLapse, L.e8.t0 - 0.1, { dy: -20 });
    pop(tip, t, L.e8.t0, tA2 - 0.08, { dy: -30 });
    pop(head9, t, L.e9.t0 + 0.1, END + 1, { s0: 1.15, dy: 0 });
    pop(follow, t, L.e9.w('Follow') - 0.05, END + 1, { base: 'translateX(-50%)', s0: 0.6, dy: 30 });
    if (t > L.e9.w('Follow') + 0.4) follow.style.transform = `translateX(-50%) scale(${(1 + Math.sin((t - L.e9.w('Follow')) * 6) * 0.03).toFixed(4)})`;
    show(topfade, Math.max(seg(t, 0, 0.01) * (1 - seg(t, tLine - 0.2, tLine)), win(t, L.e3.t0, tQ - 0.05), win(t, tMacro, tX, 0.2), win(t, L.e8.t0, tA2), seg(t, L.e9.t0, L.e9.t0 + 0.3)) * 0.9);
    subs.update(t);
    if (t > tCount - 0.15 && t < tRev) show(subs.box, 0);
    show(flash, bell(t, tStamp + 0.02, 0.04) * 0.25);
    S.draw(t);
  }

  // segmen render (batas = potongan adegan)
  const bounds = [0, tLine, tB, tQ, tGhost, tMacro, tX, tA2, END];
  const scenes = [];
  for (let i = 0; i < bounds.length - 1; i++) scenes.push({ a: bounds[i], b: bounds[i + 1] });
  return { duration: END, cues, scenes, render, marks: { lines: T.arr.map(x => [x.key, +x.t0.toFixed(3)]), END, beds: [[tFan, tGhost, 0.05], [tX, tA2, 0.05], [0, tLine, 0.022], [tA2, END, 0.022]], tSnap, tOpen, tLine, tB, tFan, tQ, tCount, tRev, tGhost, tMacro, tX, tFrost, tLapse, tLid, tA2, tClose } };
});
