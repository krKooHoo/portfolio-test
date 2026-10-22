# 덱 스파이크용 — R0 spikes/r0/harness/contact-sheet.py 복사본에 6번째 인자(축소 배율, 기본 0.25)를 더함.
# contact-sheet.py — PDF 쪽들을 한 장의 PNG로 모아 눈으로 훑어보기(PyMuPDF만 사용, Pillow 불필요)
# 사용: python -I contact-sheet.py <in.pdf> <out.png> [열 수=4] [시작 쪽=1] [최대 쪽=16] [배율=0.25]
import sys
import pymupdf as fitz

src, dst = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
start = int(sys.argv[4]) - 1 if len(sys.argv) > 4 else 0
limit = int(sys.argv[5]) if len(sys.argv) > 5 else 16
d = fitz.open(src)
idx = list(range(start, min(len(d), start + limit)))
s, gap = (float(sys.argv[6]) if len(sys.argv) > 6 else 0.25), 10
w, h = d[0].rect.width * s, d[0].rect.height * s
rows = (len(idx) + cols - 1) // cols
sheet = fitz.open()
pg = sheet.new_page(width=cols * (w + gap) + gap, height=rows * (h + gap + 12) + gap)
for n, i in enumerate(idx):
    x, y = gap + (n % cols) * (w + gap), gap + (n // cols) * (h + gap + 12)
    r = fitz.Rect(x, y + 12, x + w, y + 12 + h)
    pg.show_pdf_page(r, d, i)
    pg.draw_rect(r, color=(0.55, 0.55, 0.6), width=0.5)
    pg.insert_text((x, y + 9), f'p.{i + 1}', fontsize=8, color=(0.3, 0.3, 0.35))
pg.get_pixmap(dpi=150).save(dst)
print(dst, len(idx))
