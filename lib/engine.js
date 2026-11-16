// Mesin animasi Skalarium gaya sinematik (uji 16 Nov 2026).
// Render deterministik: window.renderAt(t) menggambar satu frame pada detik t (tanpa requestAnimationFrame),
// jadi frame mana pun bisa digambar dalam urutan apa pun (dipakai render per adegan).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const W = 1080, H = 1920, FPS = 30;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
export const E = {
  io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  o: t => 1 - Math.pow(1 - t, 3),
  o5: t => 1 - Math.pow(1 - t, 5),
  i: t => t * t * t,
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  back: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  el: t => (t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3.2) + 1),
  lin: t => t,
};
// fade in a..a+d, fade out b..b+d
export const win = (t, a, b, d = 0.3) => Math.min(seg(t, a, a + d), 1 - seg(t, b, b + d));
export function seeded(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export const rnd = seeded(1234567);
// noise 1D halus deterministik
export function n1(x, s = 0) { const i = Math.floor(x), f = x - i; const h = k => { const v = Math.sin((k + s * 57.13) * 127.1) * 43758.5453; return v - Math.floor(v); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1; }

const PostFX = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.55 }, uGrain: { value: 0.04 },
    uLift: { value: new THREE.Vector3(0.0, 0.008, 0.025) }, uFade: { value: 0 }, uFlash: { value: 0 },
    uFlashCol: { value: new THREE.Vector3(1, 1, 1) }, uZoom: { value: 0 }, uCA: { value: 0.012 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uFade, uFlash, uZoom, uCA; uniform vec3 uLift, uFlashCol; varying vec2 vUv;
  float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){
    vec2 d = vUv - 0.5; vec3 c;
    if (uZoom > 0.002) {
      vec3 acc = vec3(0.0); float ws = 0.0;
      for (int i = 0; i < 12; i++) { float k = float(i) / 11.0; vec2 p = 0.5 + d * (1.0 - uZoom * 0.22 * k); float w = 1.0 - k * 0.6; acc += texture2D(tDiffuse, p).rgb * w; ws += w; }
      c = acc / ws;
    } else {
      vec2 off = d * dot(d, d) * uCA;
      c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
    }
    vec2 dv = d; dv.x *= 0.62; float r = length(dv) * 1.55;
    c *= mix(1.0 - uVig, 1.0, smoothstep(1.0, 0.25, r));
    c += uLift * (1.0 - c);
    c += (rand(floor(vUv * vec2(540.0, 960.0)) + fract(uTime * 7.31)) - 0.5) * uGrain;
    c = mix(c, uFlashCol, uFlash);
    c *= (1.0 - uFade);
    gl_FragColor = vec4(c, 1.0);
  }`,
};

export function makeStage({ bloom = 0.8, radius = 0.5, threshold = 0.8, exposure = 1.0, fog = 0x05070d, fogDensity = 0.035, scale = 0.75, samples = 4 } = {}) {
  const canvas = document.getElementById('gl');
  const w = Math.round(W * scale), h = Math.round(H * scale);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(fog);
  scene.fog = new THREE.FogExp2(fog, fogDensity);
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.03, 400);
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), bloom, radius, threshold);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  const fx = new ShaderPass(PostFX);
  composer.addPass(fx);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const pmats = [];
  return {
    renderer, scene, camera, composer, bloomPass, fx, env, w, h, pmats,
    draw(t) {
      const k = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      for (const m of pmats) m.uniforms.uScale.value = k;
      fx.uniforms.uTime.value = t;
      composer.render();
    },
  };
}

// kamera: kunci {t, p:[x,y,z], l:[x,y,z], fov, r(roll), e(easing)}; interpolasi + goyang halus ala kamera tangan
export function camAt(keys, t, shake = 0.01) {
  let a = keys[0], b = keys[keys.length - 1];
  if (t <= keys[0].t) b = a;
  else if (t >= b.t) a = b;
  else for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
  const u = b === a ? 0 : (b.e || E.io)(seg(t, a.t, b.t));
  const p = a.p.map((v, i) => lerp(v, b.p[i], u));
  const l = a.l.map((v, i) => lerp(v, b.l[i], u));
  const fov = lerp(a.fov || 40, b.fov || 40, u);
  const r = lerp(a.r || 0, b.r || 0, u);
  p[0] += n1(t * 0.55, 1) * shake; p[1] += n1(t * 0.6, 2) * shake * 0.8; p[2] += n1(t * 0.5, 3) * shake * 0.5;
  l[0] += n1(t * 0.45, 4) * shake * 0.6; l[1] += n1(t * 0.5, 5) * shake * 0.5;
  return { p, l, fov, r };
}
export function applyCam(camera, c) {
  camera.position.set(...c.p);
  camera.fov = c.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(...c.l);
  if (c.r) camera.rotateZ(c.r);
  camera.updateMatrixWorld();
}
const _v = new THREE.Vector3();
export function toScreen(camera, p) {
  _v.copy(p).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H, ok: _v.z < 1 && _v.z > -1 };
}

// ---------------------------------------------------------------- bahan & tekstur
export function std(color, rough = 0.7, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function shadowAll(obj, cast = true, recv = true) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = recv; } });
  return obj;
}

// partikel lembut (ukuran dalam satuan dunia). Atribut: position(3) pcol(4) psize(1)
export function particles(stage, n, { additive = true, soft = 1.6 } = {}) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('pcol', new THREE.BufferAttribute(col, 4));
  g.setAttribute('psize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1000 } },
    vertexShader: `attribute vec4 pcol; attribute float psize; varying vec4 vC; uniform float uScale;
      void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(psize * uScale / max(-mv.z, 0.05), 0.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(clamp(1.0 - r, 0.0, 1.0), ${soft.toFixed(2)}); if (vC.a * a < 0.002) discard; gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  stage.pmats.push(m);
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return {
    pts, pos, col, size, n,
    set(i, x, y, z, r, gg, b, a, s) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; col[i * 4] = r; col[i * 4 + 1] = gg; col[i * 4 + 2] = b; col[i * 4 + 3] = a; size[i] = s; },
    done() { g.attributes.position.needsUpdate = true; g.attributes.pcol.needsUpdate = true; g.attributes.psize.needsUpdate = true; },
  };
}

// orang low-poly (tinggi h meter). Kembali: group + bagian untuk animasi
export function person({ h = 1.7, shirt = 0xd9534f, pants = 0x2b3a55, skin = 0xd9a066, hair = 0x16110e, style = 'short', cap = null, eyes = true } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const flat = { flatShading: true };
  const mS = std(shirt, 0.85, 0, flat), mP = std(pants, 0.9, 0, flat), mK = std(skin, 0.65, 0, flat), mH = std(hair, 0.85, 0, flat);
  const mShoe = std(0x15161a, 0.6);
  const legG = new THREE.CylinderGeometry(0.078, 0.066, 0.8, 7);
  for (const sx of [-0.088, 0.088]) {
    const l = new THREE.Mesh(legG, mP); l.position.set(sx, 0.44, 0); body.add(l);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.07, 0.24), mShoe); s.position.set(sx, 0.035, 0.035); body.add(s);
  }
  const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.15, 0.16, 8), mP); hip.position.y = 0.84; hip.scale.z = 0.7; body.add(hip);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.32, 3, 8), mS);
  torso.position.y = 1.1; torso.scale.set(1, 1, 0.68); body.add(torso);
  const arms = [];
  for (const sd of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sd * 0.215, 1.36, 0); body.add(piv);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.26, 2, 6), mS); up.position.y = -0.15; piv.add(up);
    const fore = new THREE.Group(); fore.position.y = -0.31; piv.add(fore);
    const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.24, 2, 6), mK); lo.position.y = -0.14; fore.add(lo);
    piv.rotation.z = sd * 0.1;
    arms.push({ piv, fore });
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6), mK); neck.position.y = 1.47; body.add(neck);
  const head = new THREE.Group(); head.position.y = 1.58; body.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.128, 1), mK); skull.scale.set(0.95, 1.08, 1); head.add(skull);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.138, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), mH);
  hairM.position.set(0, 0.02, -0.012); hairM.rotation.x = -0.18; hairM.scale.set(1, 1.05, 1.05); head.add(hairM);
  if (style === 'long') {
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.22, 2, 8), mH); back.position.set(0, -0.12, -0.07); back.scale.set(1.05, 1, 0.55); head.add(back);
  }
  if (cap) {
    const mc = std(cap, 0.7, 0, flat);
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), mc); c1.position.y = 0.03; head.add(c1);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 10, 1, false, -Math.PI / 2, Math.PI), mc);
    brim.position.set(0, 0.035, 0.1); brim.scale.z = 1.2; head.add(brim);
  }
  if (eyes) {
    const me = new THREE.MeshBasicMaterial({ color: 0x0b0b0e });
    for (const sx of [-0.045, 0.045]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), me); e.position.set(sx, 0.005, 0.118); head.add(e); }
  }
  g.scale.setScalar(h / 1.72);
  return { g, body, head, arms, torso };
}

// ---------------------------------------------------------------- overlay (DOM, digambar ulang per frame)
const ov = () => document.getElementById('ov');
export function el(html, cls = '', style = {}) {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  Object.assign(d.style, { position: 'absolute', opacity: 0 }, style);
  ov().appendChild(d);
  return d;
}
export function show(d, o, tf = '') {
  const v = Math.max(0, Math.min(1, o));
  d.style.opacity = v.toFixed(3);
  d.style.transform = tf;
  d.style.visibility = v <= 0.001 ? 'hidden' : 'visible';
}
// muncul: geser naik + skala; keluar: memudar
export function pop(d, t, a, b, { dy = 40, s0 = 0.92, din = 0.32, dout = 0.22, base = '' } = {}) {
  const i = E.o5(seg(t, a, a + din)), o = 1 - seg(t, b, b + dout);
  show(d, Math.min(i, o), `${base} translateY(${((1 - i) * dy - (1 - o) * 20).toFixed(1)}px) scale(${lerp(s0, 1, i).toFixed(4)})`);
}

// subtitle bawah memakai waktu per kata dari align.py; kata yang sedang diucapkan disorot
export function makeSubs(lines, { maxW = 5 } = {}) {
  const box = el('', 'subs');
  const chunks = [];
  for (const L of lines) {
    let cur = [];
    const flush = () => { if (cur.length) chunks.push({ s: cur[0].a, e: cur[cur.length - 1].b, ws: cur }); cur = []; };
    for (const w of L.words) {
      cur.push({ w: w.w, a: L.t0 + w.a, b: L.t0 + w.b });
      if (cur.length >= maxW || /[.?!:]$/.test(w.w)) flush();
    }
    flush();
  }
  for (let i = 0; i < chunks.length - 1; i++) chunks[i].e2 = Math.min(chunks[i + 1].s - 0.02, chunks[i].e + 0.5);
  chunks[chunks.length - 1].e2 = chunks[chunks.length - 1].e + 0.5;
  let last = -1;
  return {
    chunks, box,
    update(t) {
      const ci = chunks.findIndex(c => t >= c.s - 0.06 && t < c.e2);
      if (ci < 0) { show(box, 0); last = -1; return; }
      const c = chunks[ci];
      box.innerHTML = c.ws.map(x => `<span class="${t >= x.a - 0.02 && t < x.b + 0.02 ? 'on' : ''}">${x.w}</span>`).join(' ');
      const i = E.o5(seg(t, c.s - 0.06, c.s + 0.1));
      const o = 1 - seg(t, c.e2 - 0.08, c.e2);
      show(box, Math.min(i, o), `translate(-50%, ${((1 - i) * 14).toFixed(1)}px) scale(${lerp(0.94, 1, i).toFixed(3)})`);
      last = ci;
    },
  };
}

// timeline narasi: info [{key,teks,dur,words}], jeda per baris (detik sesudah baris)
export function timeline(info, gaps, start = 0.3) {
  let t = start;
  const L = {}, arr = [];
  for (const x of info) {
    const o = { ...x, t0: t, t1: t + x.dur };
    // waktu kata ke-i (atau kata pertama yang cocok dengan teks)
    o.w = q => { const ws = o.words; const i = typeof q === 'number' ? q : ws.findIndex(w => w.w.toLowerCase().replace(/[^\w-]/g, '').startsWith(q.toLowerCase())); return o.t0 + (ws[Math.max(0, i)] || ws[0]).a; };
    L[x.key] = o;
    arr.push(o);
    t += x.dur + (gaps[x.key] ?? 0.3);
  }
  return { L, arr, end: t };
}

export async function boot(build) {
  await Promise.all(['400 60px Anton', '500 40px Poppins', '600 40px Poppins', '700 40px Poppins', '800 40px Poppins'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  const q = new URLSearchParams(location.search);
  const base = (q.get('job') || '.').replace(/\/$/, '');
  const info = await (await fetch(`${base}/vo.json`)).json();
  let data = {};
  try { data = await (await fetch(`${base}/job.json`)).json(); } catch (e) { data = {}; }
  const api = await build(info, data);
  window.DURATION = api.duration;
  window.CUES = api.cues;
  window.SCENES = api.scenes;
  window.MARKS = api.marks || {};
  window.renderAt = (t) => { api.render(t); };
  api.render(0);
  window.READY = true;
}
