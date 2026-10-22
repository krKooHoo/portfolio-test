# pdf-compare.py — 두 PDF가 같은지 봅니다(덱 보기 인쇄 ↔ 스크롤 보기 인쇄, 배경 끔 ↔ 켬).
# 사용: python -I pdf-compare.py a.pdf b.pdf [--visual]
# 출력(JSON 한 줄): pagesA, pagesB, textSame(쪽마다 글자가 같은 쪽 수), textDiff(다른 쪽 번호 앞 10개),
#   --visual이면 쪽마다 0.25배로 그린 그림의 평균 화소 차이(0~255): visualMax, visualMean, visualOver1(차이 > 1인 쪽 번호 앞 10개)
import sys, json
import pymupdf as fitz

sys.stdout.reconfigure(encoding='utf-8')
args = sys.argv[1:]
visual = '--visual' in args
a_path, b_path = [x for x in args if not x.startswith('--')][:2]
a, b = fitz.open(a_path), fitz.open(b_path)
out = {'a': a_path.replace('\\', '/').split('/')[-1], 'b': b_path.replace('\\', '/').split('/')[-1], 'pagesA': len(a), 'pagesB': len(b)}
n = min(len(a), len(b))
norm = lambda s: ''.join(s.split())
same, diff = 0, []
for i in range(n):
    if norm(a[i].get_text()) == norm(b[i].get_text()):
        same += 1
    else:
        diff.append(i + 1)
out['textSame'] = same
out['textDiff'] = diff[:10]
if visual:
    m = fitz.Matrix(0.25, 0.25)
    vals = []
    for i in range(n):
        pa, pb = a[i].get_pixmap(matrix=m, alpha=False), b[i].get_pixmap(matrix=m, alpha=False)
        if (pa.width, pa.height) != (pb.width, pb.height):
            vals.append(255.0); continue
        sa, sb = pa.samples, pb.samples
        tot = 0
        for j in range(0, len(sa), 7):               # 7바이트 간격 표본(속도)
            tot += abs(sa[j] - sb[j])
        vals.append(tot / (len(sa) / 7))
    out['visualMax'] = round(max(vals), 3) if vals else 0
    out['visualMean'] = round(sum(vals) / len(vals), 3) if vals else 0
    out['visualOver1'] = [i + 1 for i, v in enumerate(vals) if v > 1][:10]
print(json.dumps(out, ensure_ascii=False))
