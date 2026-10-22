# sheets.py — 캡처 PNG를 모아 보기 PNG로 묶고(PyMuPDF만, Pillow 불필요), ② 인쇄 PDF를 점검합니다.
# 사용: python -I spikes/doc-layout/harness/sheets.py
#   out/sheets/<화면>.png    : 행 = 위치 (a)~(e), 열 = A0 ① ② ③
#   out/sheets/overview.png  : 1920·2560, 위치 (a)(b)만, 4열 (휴대폰으로 보내기용)
#   out/sheets/print-layout2.png + out/print-check.json : ② A4 PDF 쪽 모아 보기와 점검 값
import json
import os
import sys
import pymupdf as fitz

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'out'))
SHOTS = os.path.join(OUT, 'shots')
SHEETS = os.path.join(OUT, 'sheets')
os.makedirs(SHEETS, exist_ok=True)
FONT = 'C:/Windows/Fonts/malgun.ttf'
FONTB = 'C:/Windows/Fonts/malgunbd.ttf'

M = json.load(open(os.path.join(OUT, 'measure.json'), encoding='utf-8'))
POS = M['positions']
VARS = [('A0', 'A0 지금 (배포 렌더러)'), ('L1', '① 가운데 · 최대 1840'), ('L2', '② 왼쪽 · 최대 2240 (임시 추천)'), ('L3', '③ 넓은 글줄 48rem')]
VPS = [('1366x768', 0.5), ('1920x1080', 0.4), ('2560x1440', 0.3), ('375x812', 0.8)]
INK, MUTED, LINE, ACC = (0.09, 0.09, 0.11), (0.42, 0.44, 0.48), (0.80, 0.81, 0.84), (0.18, 0.43, 0.92)


def text(pg, x, y, s, size=12, bold=False, color=INK):
    pg.insert_text((x, y), s, fontsize=size, fontname='mgb' if bold else 'mg', fontfile=FONTB if bold else FONT, color=color)


def box(pg, rect, s, size=12, bold=False, color=INK):
    pg.insert_textbox(rect, s, fontsize=size, fontname='mgb' if bold else 'mg', fontfile=FONTB if bold else FONT, color=color)


def summary(vp, key):
    m = M['viewports'][vp][key]['measure']
    return (f"바깥 빈칸 {m['outerLeft']}·{m['outerRight']} | 본문 칸 {m['col']} | 글줄 {m['para']}\n"
            f"코드 최대 {m['codeMax']} · 가로 스크롤 코드 {m['preScroll']} | 축소된 도식 {m['mmdScaled']} (최소 {m['mmdMinScale']}배)")


def sheet(vp, scale):
    w0, h0 = (int(v) for v in vp.split('x'))
    cw, ch = round(w0 * scale), round(h0 * scale)
    lab, gap, top, head = 170, 14, 64, 74
    W = lab + len(VARS) * (cw + gap) + gap
    H = top + head + len(POS) * (ch + gap) + gap
    doc = fitz.open()
    pg = doc.new_page(width=W, height=H)
    pg.draw_rect(pg.rect, color=None, fill=(1, 1, 1))
    text(pg, gap, 34, f'상세 기술문서 레이아웃 시안 · {vp.replace("x", "×")} (DPR 1{", 터치 에뮬레이션" if vp == "375x812" else ""}) · Switch Strike (1-action-platformer)', 20, True)
    text(pg, gap, 54, '수치는 이 문서 하나(코드 21 · 도식 9 · 그림 17)를 헤드리스 Chrome에서 잰 값(CSS px). 바깥 빈칸 = 화면 가장자리 → 목차 왼쪽 / 레일(없으면 본문) 오른쪽 → 스크롤바', 11.5, color=MUTED)
    for j, (key, name) in enumerate(VARS):
        x = lab + gap + j * (cw + gap)
        text(pg, x, top + 20, name, 15 if scale >= 0.4 else 13, True, ACC if key == 'L2' else INK)
        box(pg, fitz.Rect(x, top + 28, x + cw, top + head), summary(vp, key), 10.5 if scale >= 0.4 else 8.5, color=MUTED)
    for i, p in enumerate(POS):
        y = top + head + gap + i * (ch + gap)
        box(pg, fitz.Rect(gap, y, lab, y + 30), f"({p['key']}) {p['label']}", 14, True)
        box(pg, fitz.Rect(gap, y + 30, lab - 4, y + ch), p['heading'] or ('A0: #pf-doc로 스크롤\n시안: 페이지 맨 위'), 11, color=MUTED)
        for j, (key, _) in enumerate(VARS):
            x = lab + gap + j * (cw + gap)
            r = fitz.Rect(x, y, x + cw, y + ch)
            f = os.path.join(SHOTS, vp, f'{key}-{p["key"]}.png')
            if os.path.exists(f):
                pg.insert_image(r, filename=f, keep_proportion=True)
            pg.draw_rect(r, color=LINE, width=1)
    dst = os.path.join(SHEETS, f'{vp}.png')
    pg.get_pixmap(dpi=72).save(dst)
    return dst, W, H


def overview():
    cw = 500
    lab, gap, top, head = 150, 12, 70, 40
    rows = [(vp, p) for vp in ('1920x1080', '2560x1440') for p in POS[:2]]
    ch = round(cw * 9 / 16)
    W = lab + 4 * (cw + gap) + gap
    H = top + head + len(rows) * (ch + gap) + gap + 26
    doc = fitz.open()
    pg = doc.new_page(width=W, height=H)
    pg.draw_rect(pg.rect, color=None, fill=(1, 1, 1))
    text(pg, gap, 34, '상세 기술문서 시안 한눈에 — 1920·2560, (a) 문서 맨 위 · (b) 코드 절(3.4)', 22, True)
    text(pg, gap, 58, '열: A0 지금 / ① 가운데(최대 1840) / ② 왼쪽·코드 끝까지(최대 2240, 임시 추천) / ③ 넓은 글줄 48rem', 13, color=MUTED)
    for j, (key, name) in enumerate(VARS):
        x = lab + gap + j * (cw + gap)
        text(pg, x, top + 26, name, 16, True, ACC if key == 'L2' else INK)
    for i, (vp, p) in enumerate(rows):
        y = top + head + gap + i * (ch + gap)
        box(pg, fitz.Rect(gap, y, lab, y + 60), f"{vp.split('x')[0]}\n({p['key']}) {p['label']}", 16, True)
        for j, (key, _) in enumerate(VARS):
            x = lab + gap + j * (cw + gap)
            r = fitz.Rect(x, y, x + cw, y + ch)
            pg.insert_image(r, filename=os.path.join(SHOTS, vp, f'{key}-{p["key"]}.png'), keep_proportion=True)
            pg.draw_rect(r, color=LINE, width=1)
            m = M['viewports'][vp][key]['measure']
            if p['key'] == 'a':
                lbl = f"바깥 {m['outerLeft']} · 본문 칸 {m['col']}"
                pg.draw_rect(fitz.Rect(x + 6, y + ch - 30, x + 210, y + ch - 6), color=None, fill=(1, 1, 1), fill_opacity=0.9)
                text(pg, x + 12, y + ch - 12, lbl, 13, True)
            else:
                lbl = f"가로 스크롤 코드 {m['preScroll']}"
                pg.draw_rect(fitz.Rect(x + 6, y + ch - 30, x + 210, y + ch - 6), color=None, fill=(1, 1, 1), fill_opacity=0.9)
                text(pg, x + 12, y + ch - 12, lbl, 13, True)
    text(pg, gap, H - 14, '수치: CSS px, 헤드리스 Chrome 실측. 바깥 = 한쪽 빈 여백, 가로 스크롤 코드 = 이 문서의 코드 21개 중 가로 스크롤이 생기는 수', 12, color=MUTED)
    dst = os.path.join(SHEETS, 'overview.png')
    pg.get_pixmap(dpi=72).save(dst)
    return dst, W, H


def print_check():
    pdf = os.path.join(OUT, 'print-layout2.pdf')
    if not os.path.exists(pdf):
        return None
    d = fitz.open(pdf)
    pages = []
    for i, p in enumerate(d):
        t = p.get_text().strip()
        imgs = len(p.get_images())
        draws = len(p.get_drawings())
        pages.append({'page': i + 1, 'w_mm': round(p.rect.width / 72 * 25.4, 1), 'h_mm': round(p.rect.height / 72 * 25.4, 1),
                      'chars': len(t), 'images': imgs, 'drawings': draws, 'first': t[:40].replace('\n', ' ')})
    blank = [x['page'] for x in pages if x['chars'] == 0 and x['images'] == 0 and x['drawings'] == 0]
    links = []
    for p in d:
        for l in p.get_links():
            if l.get('uri'):
                links.append(l['uri'])
    hidden_ui = [w for w in ('본문으로 건너뛰기', '요약 덱의 이 장면', '링크는 새 탭에서 열립니다', '(새 탭)', '크게 보기', '다이어그램 원문')
                 if any(w in p.get_text() for p in d)]
    res = {'pages': len(d), 'blank_pages': blank, 'hidden_ui_text_found': hidden_ui,
           'uris': len(links), 'localhost_uris': sum(1 for u in links if '127.0.0.1' in u or 'localhost' in u), 'per_page': pages}
    json.dump(res, open(os.path.join(OUT, 'print-check.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 쪽 모아 보기
    s, cols, g = 0.32, 8, 10
    w, h = d[0].rect.width * s, d[0].rect.height * s
    rows = (len(d) + cols - 1) // cols
    sh = fitz.open()
    pg = sh.new_page(width=cols * (w + g) + g, height=rows * (h + g + 16) + g + 30)
    pg.draw_rect(pg.rect, color=None, fill=(0.93, 0.94, 0.95))
    text(pg, g, 22, f'② A4 인쇄 PDF (printToPDF, preferCSSPageSize) — {len(d)}쪽', 14, True)
    for i in range(len(d)):
        x, y = g + (i % cols) * (w + g), 30 + g + (i // cols) * (h + g + 16)
        r = fitz.Rect(x, y + 14, x + w, y + 14 + h)
        pg.show_pdf_page(r, d, i)
        pg.draw_rect(r, color=(0.6, 0.6, 0.65), width=0.5)
        text(pg, x, y + 10, f'p.{i + 1}', 9, color=MUTED)
    pg.get_pixmap(dpi=110).save(os.path.join(SHEETS, 'print-layout2.png'))
    return {k: v for k, v in res.items() if k != 'per_page'}


if __name__ == '__main__':
    for vp, sc in VPS:
        if vp in M['viewports']:
            print(*sheet(vp, sc))
    print(*overview())
    print(json.dumps(print_check(), ensure_ascii=False))
