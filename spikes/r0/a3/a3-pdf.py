# a3-pdf.py — A3 PDF 분석기(PyMuPDF + numpy, Pillow 불필요)
# 사용: python -I a3-pdf.py jobs.json  → 한 줄에 작업 하나씩 JSON(stdout)
# jobs.json = [{ file, w, h,                      # 기대 쪽 크기(pt). null이면 크기 검사 안 함
#                n,                               # 기대 쪽 수(표식 순서 검사에도 씀). null이면 순서 검사 안 함
#                labels: true|false,              # 쪽 i에 S{i}-TOP·S{i}-BOT만 있어야 하는지
#                probes: [{page, x, y, rgb, tol, name}],   # x·y는 pt. 쪽 래스터(1px = 1pt)에서 3×3 평균색
#                required: [{page, text}],        # page 0 = 아무 쪽. 공백을 지우고 포함 여부
#                forbidden: [text],               # 어느 쪽에도 없어야 함(공백 지우고)
#                colors: [{text, rgb}],           # 글자 조각(span) 색이 기대값(채널당 ±3)인지
#                compare: other.pdf,              # 같은 쪽끼리 래스터(0.5배) 차이
#                footer: true|false }]            # 바닥 띠에서 "j / M" = PDF 쪽 번호인지
import sys, json, re
import pymupdf as fitz
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

LBL = re.compile(r'^S(\d+)-(TOP|BOT)$')
URL = re.compile(r'(https?://|file:/|\.html\b)', re.I)
DATE = re.compile(r'(\d{4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}|\d{1,2}/\d{1,2}/\d{2,4}|(오전|오후|AM|PM)\s*\d{1,2}:\d{2}|\d{1,2}:\d{2}\s*(AM|PM))', re.I)
COUNTER = re.compile(r'^\d+/\d+$')
OURNUM = re.compile(r'^(\d+) / (\d+)$')
BAND = 28.0
FLAGS = fitz.TEXTFLAGS_DICT & ~fitz.TEXT_MEDIABOX_CLIP
WS = re.compile(r'\s+')


def spans_of(page):
    out = []
    for b in page.get_text('dict', flags=FLAGS)['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                t = s['text'].strip()
                if t:
                    out.append((fitz.Rect(s['bbox']), t, s['size'], s['color']))
    return out


def raster(page, scale):
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False, colorspace=fitz.csRGB)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]


def rgb_of(c):
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255]


def analyze(job):
    f = job['file']
    try:
        doc = fitz.open(f)
    except Exception as e:
        return {'file': f, 'error': str(e)}
    n = len(doc)
    W, H, N = job.get('w'), job.get('h'), job.get('n')
    title = (doc.metadata or {}).get('title') or ''
    res = {'file': f, 'pages': n, 'sizes': {}, 'badSize': [], 'blank': [], 'outside': [], 'hf': [], 'seq': [], 'images': [],
           'probes': [], 'required': [], 'forbidden': [], 'colors': [], 'footer': [], 'diff': None}
    texts, spans_all, rasters = [], [], {}
    for i, page in enumerate(doc, start=1):
        pr = page.rect
        key = f'{pr.width:g}x{pr.height:g}'
        res['sizes'][key] = res['sizes'].get(key, 0) + 1
        if W is not None and (abs(pr.width - W) > 0.01 or abs(pr.height - H) > 0.01):
            res['badSize'].append(i)
        sp = spans_of(page)
        spans_all.append(sp)
        texts.append(WS.sub('', ''.join(t for _, t, _, _ in sp)))
        imgs = page.get_image_info()
        res['images'].append(len(imgs))
        if not sp and not imgs:
            res['blank'].append(i)
        out_sp = [t for r, t, _, _ in sp if not (r in pr + (-0.5, -0.5, 0.5, 0.5))]
        if out_sp:
            res['outside'].append({'page': i, 'n': len(out_sp), 'sample': out_sp[:3]})
        for r, t, sz, _ in sp:
            in_band = r.y1 <= pr.y0 + BAND or r.y0 >= pr.y1 - BAND
            if in_band and (URL.search(t) or DATE.search(t) or COUNTER.match(t) or (title and t == title)):
                res['hf'].append({'page': i, 'text': t[:80]})
        if job.get('labels', True) and N:
            labs = [LBL.match(t) for _, t, _, _ in sp]
            labs = [(int(m.group(1)), m.group(2)) for m in labs if m]
            mine = {(k, p) for k, p in labs if k == i}
            others = sorted({f'S{k}-{p}' for k, p in labs if k != i})
            if mine != {(i, 'TOP'), (i, 'BOT')} or others:
                res['seq'].append({'page': i, 'mine': sorted(f'S{k}-{p}' for k, p in mine), 'others': others[:4]})
        if job.get('footer'):
            anywhere = job.get('footer') == 'any'          # preferCSSPageSize:false면 장면이 축소돼 쪽 바닥에 붙지 않음
            got = [f'{m.group(1)} / {m.group(2)}' for m in (OURNUM.match(t) for r, t, _, _ in sp if anywhere or r.y0 >= pr.y1 - 40) if m]
            if f'{i} / {n}' not in got:
                res['footer'].append({'page': i, 'got': got[:3], 'want': f'{i} / {n}'})
    if N is not None and N != n:
        res['seq'].insert(0, {'pages': n, 'want': N})
    for p in job.get('probes', []):
        i = p['page']
        if i < 1 or i > n:
            res['probes'].append({**p, 'got': None, 'ok': False})
            continue
        if i not in rasters:
            rasters[i] = raster(doc[i - 1], 1.0)
        a = rasters[i]
        x, y = int(round(p['x'])), int(round(p['y']))
        rr = p.get('r', 1)                                   # 반경(px). mode 'median'이면 창 안 중앙값(글자 픽셀에 강함)
        x0, x1 = max(0, x - rr), min(a.shape[1], x + rr + 1)
        y0, y1 = max(0, y - rr), min(a.shape[0], y + rr + 1)
        win = a[y0:y1, x0:x1].reshape(-1, 3)
        if win.size == 0:
            res['probes'].append({'name': p.get('name', ''), 'page': i, 'x': p['x'], 'y': p['y'], 'want': p['rgb'], 'got': None, 'ok': False})
            continue
        got = (np.median(win, axis=0) if p.get('mode') == 'median' else win.mean(axis=0)).round().astype(int).tolist()
        ok = all(abs(g - e) <= p.get('tol', 6) for g, e in zip(got, p['rgb']))
        res['probes'].append({'name': p.get('name', ''), 'page': i, 'x': p['x'], 'y': p['y'], 'want': p['rgb'], 'got': got, 'ok': ok})
    for r in job.get('required', []):
        want = WS.sub('', r['text'])
        pg = r.get('page', 0)
        hit = [k + 1 for k, t in enumerate(texts) if want in t]
        ok = (pg in hit) if pg else bool(hit)
        res['required'].append({'page': pg, 'text': r['text'][:80], 'ok': ok, 'foundOn': hit[:5]})
    for t in job.get('forbidden', []):
        want = WS.sub('', t)
        hit = [k + 1 for k, x in enumerate(texts) if want in x]
        if hit:
            res['forbidden'].append({'text': t, 'foundOn': hit[:5]})
    for c in job.get('colors', []):
        got = sorted({tuple(rgb_of(col)) for sp in spans_all for _, t, _, col in sp if c['text'] in t})
        ok = bool(got) and all(all(abs(g - e) <= 3 for g, e in zip(gc, c['rgb'])) for gc in got)
        res['colors'].append({'text': c['text'], 'want': c['rgb'], 'got': [list(g) for g in got][:4], 'ok': ok})
    if job.get('compare'):
        try:
            d2 = fitz.open(job['compare'])
            worst, frac = 0, 0.0
            for k in range(min(n, len(d2))):
                a, b = raster(doc[k], 0.5).astype(np.int16), raster(d2[k], 0.5).astype(np.int16)
                if a.shape != b.shape:
                    worst, frac = 255, 1.0
                    break
                dd = np.abs(a - b).max(axis=2)
                worst = max(worst, int(dd.max()))
                frac = max(frac, float((dd > 8).mean()))
            res['diff'] = {'pages': [n, len(d2)], 'max': worst, 'fracOver8': round(frac, 5)}
        except Exception as e:
            res['diff'] = {'error': str(e)}
    res['text'] = [t[:400] for t in texts] if job.get('keepText') else None
    return res


if __name__ == '__main__':
    jobs = json.load(open(sys.argv[1], encoding='utf-8'))
    for j in jobs:
        print(json.dumps(analyze(j), ensure_ascii=False))
