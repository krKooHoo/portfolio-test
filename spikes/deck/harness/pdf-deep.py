# pdf-deep.py — R0 시험대 PDF 깊은 검사(01 §11-2 T2·T3 + §1-4 ②). 프로토타입 print-recipe\harness\pdf-deep.py를 넓힘.
# 사용: python -I pdf-deep.py <쪽W_pt> <쪽H_pt> [--markers|--no-markers] [--footer|--no-footer] a.pdf [b.pdf ...]
# 한 줄에 PDF 하나씩 JSON:
#   pages, sizes(쪽 크기별 개수), badSize, blank(글자·이미지·도형 모두 없음), noContent(표식 말고 글자·이미지 없음),
#   outside(쪽 밖으로 나간 글자 = 잘린 내용 신호), headerFooter(브라우저 머리글·바닥글로 보이는 글자: 날짜·URL·"1/12"·문서 제목),
#   markers(장면 표식 PFK{i}T/B가 i쪽에만 있는지), footer(바닥글 인쇄 번호 "j / M" = PDF 쪽 번호), issues(위 문제를 사람이 읽는 문장으로)
import sys, json, re
import pymupdf as fitz

sys.stdout.reconfigure(encoding='utf-8')   # -I는 PYTHONIOENCODING을 무시하므로 직접 UTF-8로

args = [a for a in sys.argv[1:]]
W, H = float(args[0]), float(args[1])
opts = {a for a in args[2:] if a.startswith('--')}
files = [a for a in args[2:] if not a.startswith('--')]
want_markers = '--markers' in opts or '--no-markers' not in opts
want_footer = '--footer' in opts

MARK = re.compile(r'^PFK\d+[TB]$')
URL = re.compile(r'(https?://|file:/|localhost|127\.0\.0\.1|\.html\b)', re.I)
DATE = re.compile(r'(\d{4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}|\d{1,2}/\d{1,2}/\d{2,4}|(오전|오후|AM|PM)\s*\d{1,2}:\d{2}|\d{1,2}:\d{2}\s*(AM|PM))', re.I)
COUNTER = re.compile(r'^\d+/\d+$')                 # 브라우저 바닥글 "1/12"(공백 없음). 우리 바닥글은 "1 / 12"
OURNUM = re.compile(r'^(\d+) / (\d+)$')
BAND = 28.0                                        # 위·아래 띠(pt): 머리글·바닥글이 찍히는 자리

for f in files:
    out = {'file': f}
    try:
        doc = fitz.open(f)
    except Exception as e:
        print(json.dumps({'file': f, 'error': str(e)}, ensure_ascii=False)); continue
    title = (doc.metadata or {}).get('title') or ''
    issues, sizes, bad_size, blank, nocontent, outside, hf, mk, foot = [], {}, [], [], [], [], [], [], []
    flags = fitz.TEXTFLAGS_DICT & ~fitz.TEXT_MEDIABOX_CLIP
    n = len(doc)
    for i, page in enumerate(doc, start=1):
        pr = page.rect
        key = f'{pr.width:g}x{pr.height:g}'
        sizes[key] = sizes.get(key, 0) + 1
        if abs(pr.width - W) > 0.01 or abs(pr.height - H) > 0.01:
            bad_size.append(i)
        spans = []
        for b in page.get_text('dict', flags=flags)['blocks']:
            for l in b.get('lines', []):
                for s in l['spans']:
                    t = s['text'].strip()
                    if t:
                        spans.append((fitz.Rect(s['bbox']), t, s['size']))
        real = [(r, t, sz) for r, t, sz in spans if not MARK.match(t)]
        imgs = page.get_images()
        draws = page.get_drawings()
        if not real and not imgs and not draws:
            blank.append(i)
        if not real and not imgs:
            nocontent.append(i)
        out_sp = [t for r, t, sz in real if not (r in pr + (-0.5, -0.5, 0.5, 0.5))]
        if out_sp:
            outside.append({'page': i, 'n': len(out_sp), 'sample': out_sp[:3]})
        for r, t, sz in real:
            in_band = r.y1 <= pr.y0 + BAND or r.y0 >= pr.y1 - BAND
            if in_band and (URL.search(t) or DATE.search(t) or COUNTER.match(t) or (title and t == title)):
                hf.append({'page': i, 'text': t[:80], 'size': round(sz, 1)})
        if want_markers:
            marks = {t for _, t, _ in spans if MARK.match(t)}
            mine = {f'PFK{i}T', f'PFK{i}B'}
            if not mine.issubset(marks):
                mk.append(f'{i}쪽: 장면 {i}의 위/아래 표식이 함께 있지 않음 {sorted(marks)[:4]}')
            others = sorted(marks - mine)
            if others:
                mk.append(f'{i}쪽: 다른 장면 표식 {others[:4]}')
        if want_footer:
            nums = [OURNUM.match(t) for r, t, sz in real if r.y0 >= pr.y1 - 40 and OURNUM.match(t)]
            got = [f'{m.group(1)} / {m.group(2)}' for m in nums]
            if f'{i} / {n}' not in got:
                foot.append(f'{i}쪽: 바닥글 인쇄 번호 {got or "없음"} ≠ "{i} / {n}"')
    if bad_size: issues.append(f'쪽 크기 ≠ {W:g}x{H:g}pt: {len(bad_size)}쪽 (예: {bad_size[:5]})')
    if blank: issues.append(f'빈 쪽 {len(blank)}개: {blank[:10]}')
    if nocontent: issues.append(f'글자·이미지 없는 쪽 {len(nocontent)}개: {nocontent[:10]}')
    if outside: issues.append(f'쪽 밖으로 나간 글자가 있는 쪽 {len(outside)}개: {outside[:2]}')
    if hf: issues.append(f'머리글·바닥글로 보이는 글자 {len(hf)}개: {hf[:3]}')
    issues += mk[:5] + ([f'… 표식 문제 외 {len(mk) - 5}건'] if len(mk) > 5 else [])
    issues += foot[:5] + ([f'… 번호 문제 외 {len(foot) - 5}건'] if len(foot) > 5 else [])
    out.update({'pages': n, 'sizes': sizes, 'badSize': len(bad_size), 'blank': len(blank), 'noContent': len(nocontent),
                'outside': sum(o['n'] for o in outside), 'headerFooter': len(hf), 'headerFooterSample': hf[:3],
                'markerIssues': len(mk), 'footerIssues': len(foot), 'title': title, 'issues': issues})
    print(json.dumps(out, ensure_ascii=False))
