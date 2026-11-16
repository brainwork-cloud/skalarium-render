# Audio: narasi + musik sintetis + efek suara dari cue animasi -> mix.wav (48 kHz stereo, -14 LUFS)
# python3 -I kerja/mix.py <info.json dari render.js> <vo_dir> <mood: misteri|ceria> <out_dir>
import json, sys, wave, subprocess, os
import numpy as np
from scipy.signal import butter, lfilter, resample_poly, fftconvolve

SR = 48000
rng = np.random.default_rng(11)
meta = json.load(open(sys.argv[1])); vo = sys.argv[2]; mood = sys.argv[3]; out = sys.argv[4]
os.makedirs(out, exist_ok=True)
DUR = meta['duration']; N = int(DUR * SR) + SR
marks = meta['marks']; cues = meta['cues']

def rd(p):
    with wave.open(p) as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    from math import gcd
    g = gcd(SR, sr)
    return resample_poly(x, SR // g, sr // g).astype(np.float32) if sr != SR else x
def ts(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): b, a = butter(o, min(f, SR / 2 - 100) / (SR / 2)); return lfilter(b, a, x)
def hp(x, f, o=2): b, a = butter(o, f / (SR / 2), 'high'); return lfilter(b, a, x)
def bp(x, lo, hi, o=2): b, a = butter(o, [lo / (SR / 2), hi / (SR / 2)], 'band'); return lfilter(b, a, x)
def mf(m): return 440 * 2 ** ((m - 69) / 12)
def put(buf, x, t, g=1.0):
    i = int(t * SR)
    if i >= len(buf): return
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), len(buf) - i); buf[i:i + n] += x[:n] * g
def ir(dec=1.2, damp=5000):
    t = ts(dec); x = rng.standard_normal(len(t)) * np.exp(-t / (dec / 6.5)); x = lp(x, damp); return x / np.sqrt(np.sum(x ** 2))
REV = ir(1.6, 4500)
def verb(x, wet=0.25): y = fftconvolve(x, REV)[:len(x)]; return x * (1 - wet) + y * wet * 2.2

# ---------------------------------------------------------------- narasi
voice = np.zeros(N, np.float32)
for key, t0 in marks['lines']:
    x = rd(f'{vo}/{key}.wav'); put(voice, x, t0, 1.0)

# ---------------------------------------------------------------- musik
def saw(f, t): return 2 * ((f * t) % 1.0) - 1
def pad_note(m, d, g=1.0):
    t = ts(d); s = sum(saw(mf(m) * k, t + rng.random()) for k in (0.997, 1.0, 1.0035)) / 3
    e = np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.7); return lp(s, 1100) * np.clip(e, 0, 1) * g
def pluck(m, d=0.6, bright=0.35, dec=0.22):
    t = ts(d); f = mf(m); x = np.sin(2 * np.pi * f * t) * np.exp(-t / dec) + bright * np.sin(4 * np.pi * f * t) * np.exp(-t / (dec * 0.35)) + 0.12 * np.sin(6 * np.pi * f * t) * np.exp(-t / (dec * 0.2))
    return x * np.minimum(1, t / 0.004)
def kick(g=1.0):
    t = ts(0.45); f = 50 + 90 * np.exp(-t / 0.045); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / 0.16) + 0.25 * rng.standard_normal(len(t)) * np.exp(-t / 0.006)) * g
def hat(g=1.0, d=0.05):
    t = ts(d); return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t / (d / 4)) * g
def clap(g=1.0):
    t = ts(0.25); n = bp(rng.standard_normal(len(t)), 900, 2600); e = np.exp(-t / 0.06) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * t) > 0)); return n * e * g
def sub(m, d, g=1.0):
    t = ts(d); f = mf(m); x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t); e = np.minimum(1, t / 0.01) * np.exp(-t / (d * 0.7)); return lp(x * e, 400) * g

musL = np.zeros(N, np.float32); musR = np.zeros(N, np.float32)
if mood == 'misteri':
    bpm = 92; beat = 60 / bpm; bar = 4 * beat
    prog = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]]
    nb = int(DUR / bar) + 2
    arp_pat = [0, 1, 2, 1, 2, 3, 2, 1]
    for b in range(nb):
        ch = prog[(b // 2) % 4]; t0 = b * bar
        if b % 2 == 0:
            for m in ch + [ch[0] + 12]: p = pad_note(m, 2 * bar + 0.6, 0.05); put(musL, p, t0); put(musR, p, t0 + 0.012)
        for q in range(4): put(musL, sub(ch[0] - 12, beat * 0.9, 0.16), t0 + q * beat); put(musR, sub(ch[0] - 12, beat * 0.9, 0.16), t0 + q * beat)
        put(musL, kick(0.35), t0); put(musR, kick(0.35), t0); put(musL, kick(0.22), t0 + 2.5 * beat); put(musR, kick(0.22), t0 + 2.5 * beat)
        for q in range(8): h = hat(0.05 if q % 2 else 0.08); put(musL, h, t0 + q * beat / 2); put(musR, h, t0 + q * beat / 2 + 0.004)
        if b >= 2:
            tones = ch + [ch[0] + 12]
            for q in range(8):
                m = tones[arp_pat[q]] + 24; x = pluck(m, 0.7, 0.4, 0.2) * 0.07; tt = t0 + q * beat / 2
                put(musL, x, tt); put(musR, x * 0.55, tt + beat * 0.75); put(musL, x * 0.3, tt + beat * 1.5)
else:
    bpm = 112; beat = 60 / bpm; bar = 4 * beat
    prog = [[53, 57, 60], [48, 52, 55], [50, 53, 57], [46, 50, 53]]
    nb = int(DUR / bar) + 2
    arp_pat = [0, 2, 1, 3, 2, 1, 3, 2]
    for b in range(nb):
        ch = prog[b % 4]; t0 = b * bar
        for m in ch: p = pad_note(m + 12, bar + 0.5, 0.03); put(musL, p, t0); put(musR, p, t0 + 0.01)
        for q in range(4):
            put(musL, kick(0.3), t0 + q * beat); put(musR, kick(0.3), t0 + q * beat)
            put(musL, sub(ch[0] - 12, beat * 0.45, 0.14), t0 + q * beat + beat / 2); put(musR, sub(ch[0] - 12, beat * 0.45, 0.14), t0 + q * beat + beat / 2)
        for q in (1, 3): c = clap(0.12); put(musL, c, t0 + q * beat); put(musR, c, t0 + q * beat + 0.006)
        for q in range(16): h = hat(0.035 if q % 2 else 0.05, 0.035); put(musL if q % 2 else musR, h, t0 + q * beat / 4)
        tones = ch + [ch[0] + 12]
        for q in range(8):
            m = tones[arp_pat[q]] + 24; x = pluck(m, 0.5, 0.6, 0.12) * 0.075; tt = t0 + q * beat / 2
            put(musL, x, tt); put(musR, x * 0.5, tt + beat * 0.75)
musL = verb(musL, 0.22); musR = verb(musR, 0.22)
# gerbang musik dari cue (diam saat hitung mundur)
gate = np.ones(N, np.float32); state = 1; last = 0.0
ev = sorted([(c['t'], c['v']) for c in cues if c['k'] == 'music'])
tt = np.arange(N) / SR
g = np.zeros(N, np.float32)
on_t = [t for t, v in ev if v == 1]; off_t = [t for t, v in ev if v == 0]
for i in range(N // 480 + 1):
    t = i * 480 / SR
    lo = max([x for x in on_t if x <= t], default=-1); lf = max([x for x in off_t if x <= t], default=-1)
    val = 1.0 if lo > lf else 0.0
    g[i * 480:(i + 1) * 480] = val
g = lp(g, 6, 1).astype(np.float32)
musL *= g; musR *= g

# ---------------------------------------------------------------- efek suara
def whoosh(d=0.42, lo=300, hi=3000, g=0.5):
    t = ts(d); x = rng.standard_normal(len(t)); fc = lo + (hi - lo) * np.sin(np.pi * t / d) ** 2
    y = np.zeros_like(x); st = 0.0
    out = np.zeros_like(x)
    for i0 in range(0, len(x), 256):
        f = fc[i0]; b, a = butter(2, [max(80, f * 0.6) / (SR / 2), min(SR / 2 - 200, f * 1.6) / (SR / 2)], 'band'); out[i0:i0 + 256] = lfilter(b, a, x[i0:i0 + 256])
    return out * np.sin(np.pi * t / d) ** 1.5 * g
def boom(g=0.9):
    t = ts(1.6); f = 38 + 70 * np.exp(-t / 0.08); ph = 2 * np.pi * np.cumsum(f) / SR
    return verb(np.tanh(1.6 * np.sin(ph) * np.exp(-t / 0.5)) * g + lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.05) * 0.4 * g, 0.3)
def hit(g=0.7):
    a = boom(g) * 0.8; b = verb(pluck(38, 1.2, 0.8, 0.4) * 0.3 * g, 0.4); out = np.zeros(max(len(a), len(b))); out[:len(a)] += a; out[:len(b)] += b; return out
def popf(g=0.35):
    t = ts(0.09); f = 520 + 600 * (t / 0.09); ph = 2 * np.pi * np.cumsum(f) / SR; return np.sin(ph) * np.exp(-t / 0.025) * g
def tick(g=0.5):
    t = ts(0.08); return (np.sin(2 * np.pi * 1850 * t) + 0.5 * np.sin(2 * np.pi * 2730 * t)) * np.exp(-t / 0.012) * g
def ding(g=0.4):
    t = ts(1.6); f = 1046.5
    return verb(sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / d) for k, a, d in [(1, 1, 0.9), (2.0, 0.4, 0.5), (2.76, 0.3, 0.35), (5.4, 0.12, 0.15)]) * g * np.minimum(1, t / 0.003), 0.35)
def shimmer(g=0.25):
    t = ts(1.3); x = sum(np.sin(2 * np.pi * (2000 + 3000 * rng.random()) * t + rng.random() * 6) * np.exp(-((t - 0.2 - 0.8 * rng.random()) / 0.12) ** 2) for _ in range(28))
    return verb(x * g / 6, 0.5)
def stamp(g=0.9):
    t = ts(0.7); f = 70 + 90 * np.exp(-t / 0.03); ph = 2 * np.pi * np.cumsum(f) / SR
    return verb(np.tanh(2.2 * np.sin(ph) * np.exp(-t / 0.18)) * g * 0.8 + bp(rng.standard_normal(len(t)), 200, 3000) * np.exp(-t / 0.03) * 0.6 * g, 0.25)
def door(g=0.6):
    t = ts(0.5); thunk = lp(rng.standard_normal(len(t)), 500) * np.exp(-t / 0.04) * 1.4
    seal = bp(rng.standard_normal(len(t)), 300, 1500) * np.exp(-((t - 0.06) / 0.02) ** 2) * 0.8
    return (thunk + seal) * g
def hiss(g=0.18, d=1.6):
    t = ts(d); return hp(rng.standard_normal(len(t)), 2500) * np.minimum(1, t / 0.05) * np.exp(-t / (d / 3)) * g
def swish(g=0.35): return whoosh(0.22, 1500, 6000, g)
def scan(g=0.16):
    t = ts(0.9); f = 300 + 1700 * t / 0.9; ph = 2 * np.pi * np.cumsum(f) / SR
    return verb(np.sin(ph) * (0.6 + 0.4 * np.sin(2 * np.pi * 24 * t)) * np.sin(np.pi * t / 0.9) * g, 0.3)
def crystal(g=0.22):
    out = np.zeros(int(2.0 * SR))
    for _ in range(26):
        t0 = rng.random() * 1.7; f = 2500 + 4000 * rng.random(); t = ts(0.25)
        put(out, np.sin(2 * np.pi * f * t) * np.exp(-t / 0.05) * (0.4 + 0.6 * rng.random()), t0)
    return verb(out * g, 0.45)
def lapse(g=0.35):
    out = np.zeros(int(2.4 * SR)); k = 0; t0 = 0
    while t0 < 2.2: put(out, tick(0.6) * (0.5 + 0.5 * t0 / 2.2), t0); t0 += max(0.045, 0.16 - 0.05 * t0); k += 1
    return out * g
def click(g=0.5):
    t = ts(0.05); x = bp(rng.standard_normal(len(t)), 1800, 5000) * np.exp(-t / 0.004)
    y = np.zeros(int(0.2 * SR)); put(y, x, 0); put(y, x * 0.8, 0.022); put(y, lp(rng.standard_normal(len(t)), 600) * np.exp(-t / 0.01) * 0.7, 0.024); return y * g
def thud(g=0.7):
    t = ts(0.6); f = 55 + 60 * np.exp(-t / 0.04); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / 0.15) + lp(rng.standard_normal(len(t)), 700) * np.exp(-t / 0.03) * 0.6) * g
def roll(g=0.25, d=1.4):
    out = np.zeros(int((d + 0.2) * SR)); t0 = 0
    while t0 < d: put(out, tick(0.5) * 0.7, t0); t0 += 0.05 + 0.06 * (t0 / d) ** 2
    return out * g
def rise(g=0.25, d=1.2):
    t = ts(d); x = rng.standard_normal(len(t)); y = np.zeros_like(x)
    for i0 in range(0, len(x), 512):
        f = 300 + 5000 * (i0 / len(x)) ** 2; b, a = butter(2, [f * 0.7 / (SR / 2), min(SR / 2 - 200, f * 1.4) / (SR / 2)], 'band'); y[i0:i0 + 512] = lfilter(b, a, x[i0:i0 + 512])
    return y * (t / d) ** 2 * g
FX = {'whoosh': whoosh, 'boom': boom, 'hit': hit, 'pop': popf, 'tick': tick, 'ding': ding, 'shimmer': shimmer, 'stamp': stamp, 'door': door, 'hiss': hiss, 'swish': swish, 'scan': scan, 'crystal': crystal, 'lapse': lapse, 'click': click, 'thud': thud, 'roll': roll, 'rise': rise}
sfx = np.zeros(N, np.float32)
for c in cues:
    if c['k'] in FX: put(sfx, FX[c['k']]() * c.get('v', 1), c['t'])
# latar: dengung kipas & kulkas, detak jantung saat hitung mundur
def hum(d, f0=100, g=0.04):
    t = ts(d); return (lp(rng.standard_normal(len(t)), 260) * 0.8 + 0.3 * np.sin(2 * np.pi * f0 * t) + 0.15 * np.sin(2 * np.pi * f0 * 2 * t)) * g
for a, b, gg in marks.get('beds', []):
    x = hum(b - a, 120 if gg > 0.03 else 50, gg * 0.5); fade = np.minimum(1, np.minimum(ts(b - a) / 0.3, (b - a - ts(b - a)) / 0.3)); put(sfx, x * fade, a)
if 'tCount' in marks:
    for k in range(3):
        put(sfx, sub(31, 0.25, 0.5), marks['tCount'] + k * 0.86 + 0.35); put(sfx, sub(31, 0.25, 0.35), marks['tCount'] + k * 0.86 + 0.55)
    put(sfx, rise(0.2, 2.5), marks['tCount'])

def wr(p, x):
    x = np.clip(x, -1, 1); a = (x * 32767).astype(np.int16)
    with wave.open(p, 'w') as w:
        w.setnchannels(1 if a.ndim == 1 else a.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes())
L = int(DUR * SR)
wr(f'{out}/voice.wav', voice[:L] * 0.95)
wr(f'{out}/music.wav', np.stack([musL[:L], musR[:L]], 1) * 0.9)
wr(f'{out}/sfx.wav', sfx[:L] * (0.7 / max(1e-6, np.abs(sfx[:L]).max())))
fc = ("[0:a]highpass=f=75,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3500:t=q:w=1.2:g=3,acompressor=threshold=-22dB:ratio=3:attack=4:release=60:makeup=4,aformat=channel_layouts=stereo,asplit=2[v][vsc];"
      "[1:a][vsc]sidechaincompress=threshold=0.025:ratio=8:attack=12:release=380[m];"
      "[2:a]aformat=channel_layouts=stereo[s];"
      "[v][m][s]amix=inputs=3:weights=1 0.45 0.6:normalize=0,alimiter=limit=0.9:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=11[a]")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{out}/voice.wav', '-i', f'{out}/music.wav', '-i', f'{out}/sfx.wav', '-filter_complex', fc, '-map', '[a]', '-ar', '48000', '-ac', '2', f'{out}/mix.wav'], check=True)
print('mix ok', DUR)
