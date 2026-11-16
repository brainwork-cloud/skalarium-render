# Perkiraan waktu per kata dari WAV narasi: batas frasa (tanda baca) ditempel ke jeda hening terdekat,
# kata di dalam frasa dibagi proporsional panjang huruf. Masukan <dir>/info.json + <key>.wav, hasil <dir>/vo.json (info + "words").
import json, re, sys, wave
import numpy as np

def load(p):
    with wave.open(p) as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return x, sr

def pauses(x, sr, hop=0.01, min_len=0.06):
    n = int(sr * hop); fr = len(x) // n
    rms = np.sqrt(np.mean(x[:fr * n].reshape(fr, n) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9); thr = max(db.max() - 38, -50)
    sil = db < thr; out = []; i = 0
    while i < fr:
        if sil[i]:
            j = i
            while j < fr and sil[j]: j += 1
            if i > 3 and j < fr - 3 and (j - i) * hop >= min_len: out.append(((i + j) / 2 * hop, (j - i) * hop))
            i = j
        else: i += 1
    return out

def wlen(w): return len(re.sub(r'[^\w]', '', w)) + 1.2

d = sys.argv[1]
info = json.load(open(f'{d}/info.json'))
for L in info:
    x, sr = load(f"{d}/{L['key']}.wav"); dur = len(x) / sr
    words = L['teks'].split()
    # frasa
    phr, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r'[.,:;?!]$', w): phr.append(cur); cur = []
    if cur: phr.append(cur)
    tot = sum(wlen(w) for w in words) + 2.5 * (len(phr) - 1)
    ps = pauses(x, sr)
    # batas perkiraan lalu tempel ke jeda terdekat
    bounds, acc = [0.0], 0.0
    for p in phr[:-1]:
        acc += sum(wlen(w) for w in p) + 1.25
        est = acc / tot * dur; acc += 1.25
        best = min(ps, key=lambda q: abs(q[0] - est)) if ps else None
        if best and abs(best[0] - est) < 0.45: bounds.append(best[0]); ps = [q for q in ps if q is not best]
        else: bounds.append(est)
    bounds.append(dur)
    out = []
    for k, p in enumerate(phr):
        a, b = bounds[k], bounds[k + 1]
        pad_a = 0.03 if k == 0 else 0.06; pad_b = 0.0 if k == len(phr) - 1 else 0.06
        a2, b2 = a + pad_a, max(a + pad_a + 0.1, b - pad_b)
        s = sum(wlen(w) for w in p); t = a2
        for w in p:
            e = t + wlen(w) / s * (b2 - a2); out.append({'w': w, 'a': round(t, 3), 'b': round(e, 3)}); t = e
    L['words'] = out
    print(L['key'], round(dur, 2), 'jeda:', len(pauses(x, sr)), 'frasa:', len(phr), [round(b, 2) for b in bounds])
json.dump(info, open(f'{d}/vo.json', 'w'), indent=1, ensure_ascii=False)
