# verify_pdf.py — verify.js가 만든 A4 PDF(①②③)를 PyMuPDF로 점검합니다(쪽 수·빈 쪽·코드/표/도식/그림 쪼개짐·숨겨야 할 UI 글자).
# 사용: python -I spikes/doc-layout/harness/verify_pdf.py spikes/doc-layout/out/verify
import sys, json, re, bisect
import pymupdf

OUT = sys.argv[1]
MM = 72 / 25.4
TOP, BOTTOM_M = 16 * MM, 18 * MM          # @page margin: 16mm 15mm 18mm
squash = lambda s: re.sub(r'\s+', '', s or '')
UI = ['(새 탭)', '본문으로 건너뛰기', '링크는 새 탭에서', '요약 덱의 이 장면', '크게 보기', '다이어그램 원문', '좁게 읽기', '한눈에',
      '지금 읽는 절', '맨 위로', '요약 덱은 PC에서', '↗', '이 프로젝트', '원문 마크다운']
CODE_BG = (0xF6 / 255, 0xF8 / 255, 0xFA / 255)


def close(c, ref, tol=0.012):
    return c is not None and len(c) >= 3 and all(abs(a - b) <= tol for a, b in zip(c, ref))


def analyse(L):
    pdf = pymupdf.open(f'{OUT}/print-L{L}.pdf')
    dom = json.load(open(f'{OUT}/print-L{L}-dom.json', encoding='utf-8'))
    pages, texts, starts = [], [], []
    acc = 0
    for i, pg in enumerate(pdf):
        H, W = pg.rect.height, pg.rect.width
        bottom = H - BOTTOM_M
        t = pg.get_text('text')
        q = squash(t)
        starts.append(acc); acc += len(q); texts.append(q)
        imgs = pg.get_image_info(xrefs=True)
        drw = pg.get_drawings()
        content = [d for d in drw if not (d['rect'].width >= W - 2 and d['rect'].height >= H - 2)]
        cross = [d for d in content if d['rect'].y0 < TOP - 1.5 or d['rect'].y1 > bottom + 1.5]
        img_cross = [im for im in imgs if im['bbox'][1] < TOP - 1.5 or im['bbox'][3] > bottom + 1.5]
        code_bg = [d['rect'] for d in content if d.get('fill') is not None and close(d.get('fill'), CODE_BG)]
        # 쪽 맨 아래에 남은 제목(굵고 큰 글자가 마지막 줄)
        lines = []
        for b in pg.get_text('dict')['blocks']:
            for ln in b.get('lines', []):
                sp = [s for s in ln['spans'] if s['text'].strip()]
                if sp: lines.append((ln['bbox'][1], ln['bbox'][3], max(s['size'] for s in sp), any(s['flags'] & 16 for s in sp), ''.join(s['text'] for s in sp).strip()))
        lines.sort()
        last = lines[-1] if lines else None
        orphan_head = bool(last and last[2] >= 12.5 and last[3] and last[1] > bottom - 60)
        pages.append({'page': i + 1, 'w_mm': round(W / MM, 1), 'h_mm': round(H / MM, 1), 'chars': len(q), 'images': len(imgs), 'drawings': len(content),
                      'blank': len(q) == 0 and not imgs and len(content) == 0,
                      'cross': [(round(d['rect'].y0, 1), round(d['rect'].y1, 1)) for d in cross][:5], 'img_cross': [[round(v, 1) for v in im['bbox']] for im in img_cross],
                      'img_xrefs': [im['xref'] for im in imgs],
                      'code_bg_touch_bottom': [round(r.y1, 1) for r in code_bg if r.y1 >= bottom - 2],
                      'code_bg_touch_top': [round(r.y0, 1) for r in code_bg if r.y0 <= TOP + 2],
                      'orphan_heading': last[4][:40] if orphan_head else None,
                      'fill_ratio': round((max((l[1] for l in lines), default=TOP) - TOP) / (bottom - TOP), 2),
                      'first': t.strip().split('\n')[0][:50] if t.strip() else ''})
    full = ''.join(texts)
    page_of = lambda pos: bisect.bisect_right(starts, pos)      # 1-based page

    def locate(items, label):
        cur, res = 0, []
        for k, raw in enumerate(items):
            key = squash(raw)
            if not key: continue
            pos = full.find(key, cur)
            how = 'full'
            if pos < 0:
                a, b = key[:40], key[-40:]
                pa = full.find(a, cur)
                pb = full.find(b, pa if pa >= 0 else cur)
                if pa < 0 or pb < 0:
                    res.append({'i': k + 1, 'found': False, 'head': raw.strip()[:50]}); continue
                p1, p2, how = page_of(pa), page_of(pb + len(b) - 1), 'ends'
                cur = pb + len(b)
            else:
                p1, p2 = page_of(pos), page_of(pos + len(key) - 1)
                cur = pos + len(key)
            res.append({'i': k + 1, 'found': True, 'p1': p1, 'p2': p2, 'split': p1 != p2, 'how': how, 'chars': len(key), 'head': raw.strip()[:40]})
        return res

    code = locate(dom['code'], 'code')
    tables = locate(dom['tables'], 'table')
    # 도식: 문서 전체에서 한 번만 나오는 라벨이 어느 쪽에 있는지
    mmd = []
    for k, labels in enumerate(dom['mermaid']):
        pgs, used = set(), 0
        for lab in labels:
            key = squash(lab)
            if len(key) < 3: continue
            if full.count(key) == 1:
                pgs.add(page_of(full.find(key))); used += 1
        mmd.append({'i': k + 1, 'labels': len(labels), 'uniqueUsed': used, 'pages': sorted(pgs), 'split': len(pgs) > 1})
    xref_pages = {}
    for p in pages:
        for x in set(p['img_xrefs']): xref_pages.setdefault(x, []).append(p['page'])
    multi = {x: v for x, v in xref_pages.items() if len(v) > 1}
    ui = {u: sum(t.count(squash(u)) for t in texts) for u in UI}
    uris = [l.get('uri') for pg in pdf for l in pg.get_links() if l.get('uri')]
    return {
        'pages': len(pages), 'sizes': sorted({(p['w_mm'], p['h_mm']) for p in pages}), 'blank': [p['page'] for p in pages if p['blank']],
        'lowFill': [(p['page'], p['fill_ratio']) for p in pages if p['fill_ratio'] < 0.5],
        'code': {'n': len(code), 'found': sum(c['found'] for c in code), 'split': [c for c in code if c.get('split')], 'notFound': [c for c in code if not c['found']]},
        'tables': {'n': len(tables), 'found': sum(c['found'] for c in tables), 'split': [c for c in tables if c.get('split')], 'notFound': [c for c in tables if not c['found']]},
        'mermaid': {'n': len(mmd), 'split': [m for m in mmd if m['split']], 'noUnique': [m['i'] for m in mmd if not m['pages']], 'pages': [m['pages'] for m in mmd]},
        'images': {'domN': len(dom['imgs']), 'pdfPlacements': sum(len(p['img_xrefs']) for p in pages), 'xrefOnManyPages': multi,
                   'bboxOutsideContent': [(p['page'], p['img_cross']) for p in pages if p['img_cross']]},
        'drawingsOutsideContent': [(p['page'], p['cross']) for p in pages if p['cross']],
        'codeBgTouchBottom': [(p['page'], p['code_bg_touch_bottom']) for p in pages if p['code_bg_touch_bottom']],
        'orphanHeadings': [(p['page'], p['orphan_heading']) for p in pages if p['orphan_heading']],
        'uiText': {k: v for k, v in ui.items() if v},
        'uris': uris, 'firstLine': pages[0]['first'],
        'perPage': [{k: p[k] for k in ('page', 'chars', 'images', 'drawings', 'fill_ratio', 'first')} for p in pages],
    }


def sheet(L, cols=8):
    src = pymupdf.open(f'{OUT}/print-L{L}.pdf')
    n = len(src)
    rows = (n + cols - 1) // cols
    tw, th, gap = 150, 212, 8
    doc = pymupdf.open()
    page = doc.new_page(width=cols * (tw + gap) + gap, height=rows * (th + gap + 12) + gap + 20)
    page.insert_text((gap, 16), f'print-L{L}.pdf  {n} pages (A4)', fontsize=11)
    for i in range(n):
        r, c = divmod(i, cols)
        x, y = gap + c * (tw + gap), 24 + r * (th + gap + 12)
        rect = pymupdf.Rect(x, y, x + tw, y + th)
        page.draw_rect(rect, color=(0.6, 0.6, 0.6), width=0.5)
        page.show_pdf_page(rect, src, i)
        page.insert_text((x, y + th + 10), str(i + 1), fontsize=8)
    page.get_pixmap(dpi=144).save(f'{OUT}/print-L{L}-sheet.png')


res = {}
for L in ['1', '2', '3']:
    try:
        res[f'L{L}'] = analyse(L)
        sheet(L)
    except FileNotFoundError as e:
        res[f'L{L}'] = {'error': str(e)}
json.dump(res, open(f'{OUT}/pdf-check.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, r in res.items():
    if 'error' in r: print(k, r['error']); continue
    print(k, 'pages', r['pages'], r['sizes'], 'blank', r['blank'], 'code', r['code']['found'], '/', r['code']['n'], 'split', [(c['i'], c['p1'], c['p2']) for c in r['code']['split']],
          'tables split', [(c['i'], c['p1'], c['p2']) for c in r['tables']['split']], 'tbl notfound', len(r['tables']['notFound']),
          'mmd split', [(m['i'], m['pages']) for m in r['mermaid']['split']], 'mmd noUnique', r['mermaid']['noUnique'],
          'img', r['images'], 'drawOut', r['drawingsOutsideContent'][:4], 'codeBgBottom', r['codeBgTouchBottom'], 'orphan', r['orphanHeadings'], 'ui', r['uiText'], 'first', r['firstLine'])
