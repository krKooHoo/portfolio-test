# verify_sheet.py — verify.js의 1880px(스크린샷 폭) 캡처를 한 장으로 묶습니다(PyMuPDF만).
# 사용: python -I spikes/doc-layout/harness/verify_sheet.py
import json, os
import pymupdf as fitz

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'out', 'verify'))
FONT, FONTB = 'C:/Windows/Fonts/malgun.ttf', 'C:/Windows/Fonts/malgunbd.ttf'
M = json.load(open(os.path.join(OUT, 'measure.json'), encoding='utf-8'))['data']['1-action-platformer']['1880']
VARS = [('A0', 'A0 지금'), ('L1', '① 가운데 · 최대 1840'), ('L2', '② 왼쪽 · 최대 2240'), ('L3', '③ 넓은 글줄 48rem')]
POS = [('a', '문서 맨 위'), ('b', '코드 (3.4)'), ('c', '도식 (2.1)'), ('e', '문단만 (4.7)')]
INK, MUTED = (0.09, 0.09, 0.11), (0.42, 0.44, 0.48)
scale, w0, h0 = 0.4, 1880, 1000
cw, ch = round(w0 * scale), round(h0 * scale)
lab, gap, top, head = 120, 12, 60, 64
doc = fitz.open()
pg = doc.new_page(width=lab + 4 * (cw + gap) + gap, height=top + head + 4 * (ch + gap) + gap)
pg.draw_rect(pg.rect, color=None, fill=(1, 1, 1))
t = lambda x, y, s, size=11, b=False, c=INK: pg.insert_text((x, y), s, fontsize=size, fontname='mgb' if b else 'mg', fontfile=FONTB if b else FONT, color=c)
t(gap, 30, '검증 캡처 · 1880×1000 (빨간 선 스크린샷 폭) · Switch Strike · 헤드리스 Chrome 155, DPR 1', 18, True)
t(gap, 50, '수치(CSS px): 바깥 = 화면 가장자리↔목차 / 레일·본문↔스크롤바(15px 제외), 문단 옆 = 본문 칸 안 문단 왼쪽·오른쪽 빈칸', 10.5, c=MUTED)
for j, (k, name) in enumerate(VARS):
    m = M[k]
    x = lab + gap + j * (cw + gap)
    t(x, top + 18, name, 14, True)
    t(x, top + 36, f"바깥 {m['outerL']}·{m['outerR']} | 본문 칸 {m['col']} | 글줄 {m['para']['wMin']} (한 줄 약 {m['para']['charsMedian']}자)", 9.5, c=MUTED)
    t(x, top + 52, f"문단 옆 {m['para']['leftGap']}·{m['para']['rightGap']} | 코드 영역 {m['code']['areaMax']} · 스크롤 {m['code']['over']}/{m['code']['n']} | 도식 <0.8배 {m['mmd']['below08']}/{m['mmd']['n']} | 레일 {m['rail'] or '없음'}", 9.5, c=MUTED)
for i, (pk, pl) in enumerate(POS):
    y = top + head + gap + i * (ch + gap)
    t(gap, y + 18, f'({pk}) {pl}', 12, True)
    for j, (k, _) in enumerate(VARS):
        x = lab + gap + j * (cw + gap)
        r = fitz.Rect(x, y, x + cw, y + ch)
        pg.insert_image(r, filename=os.path.join(OUT, 'shots', '1880', f'{k}-{pk}.png'))
        pg.draw_rect(r, color=(0.8, 0.81, 0.84), width=0.6)
pg.get_pixmap(dpi=144).save(os.path.join(OUT, 'sheet-1880.png'))
print('ok', os.path.join(OUT, 'sheet-1880.png'))
