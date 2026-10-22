# a2-pdf-sig.py — A2: PDF 쪽마다 "배치 서명"을 만들어 배율 k·DPR·브라우저 사이에서 인쇄 결과가 같은지 비교합니다.
# 서명 = 쪽 크기 + 글자 조각(장면 표식 PFK* 제외)의 (x0, y0) 0.25pt 반올림·글자 + 이미지 상자(0.5pt 반올림).
# 사용: python -I a2-pdf-sig.py a.pdf [b.pdf ...]  → 한 줄에 PDF 하나씩 JSON {file, pages, sizes, per[], sig}
import sys, json, re, hashlib
import pymupdf as fitz

sys.stdout.reconfigure(encoding='utf-8')
MARK = re.compile(r'^PFK\d+[TB]$')
q = lambda v, s: round(v / s) * s

for f in sys.argv[1:]:
    try:
        doc = fitz.open(f)
    except Exception as e:
        print(json.dumps({'file': f, 'error': str(e)}, ensure_ascii=False)); continue
    per, sizes = [], {}
    flags = fitz.TEXTFLAGS_DICT & ~fitz.TEXT_MEDIABOX_CLIP
    for page in doc:
        pr = page.rect
        key = f'{pr.width:g}x{pr.height:g}'
        sizes[key] = sizes.get(key, 0) + 1
        parts = [key]
        for b in page.get_text('dict', flags=flags)['blocks']:
            for l in b.get('lines', []):
                for s in l['spans']:
                    t = s['text'].strip()
                    if t and not MARK.match(t):
                        x0, y0 = s['bbox'][0], s['bbox'][1]
                        parts.append(f'T{q(x0, .25):.2f},{q(y0, .25):.2f},{t}')
        for im in page.get_image_info():
            bb = im['bbox']
            parts.append('I' + ','.join(f'{q(v, .5):.1f}' for v in bb))
        per.append(hashlib.sha1('\n'.join(parts).encode('utf-8')).hexdigest()[:10])
    sig = hashlib.sha1('|'.join(per).encode()).hexdigest()[:12]
    print(json.dumps({'file': f, 'pages': len(doc), 'sizes': sizes, 'per': per, 'sig': sig}, ensure_ascii=False))
