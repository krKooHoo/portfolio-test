# a4-pdf.py — A4용 PDF 요약. 사용: python -I a4-pdf.py a.pdf [b.pdf ...]
# 한 줄에 PDF 하나씩 JSON: pages, sizes, notice(1쪽에 게이트 안내 문구가 있는가), blank(빈 쪽 수),
#   imgs(쪽마다 그려진 그림 수 합), imgPages(그림이 하나라도 있는 쪽 수), text0(1쪽 글자 앞부분)
import sys, json
import pymupdf as fitz

sys.stdout.reconfigure(encoding='utf-8')
NOTICE = '아직 페이지를 그리는 중입니다'
for f in sys.argv[1:]:
    try:
        doc = fitz.open(f)
    except Exception as e:
        print(json.dumps({'file': f, 'error': str(e)}, ensure_ascii=False)); continue
    sizes, blank, imgs, img_pages, notice_pages = {}, 0, 0, 0, 0
    for page in doc:
        k = f'{page.rect.width:g}x{page.rect.height:g}'
        sizes[k] = sizes.get(k, 0) + 1
        txt = page.get_text().strip()
        n = len(page.get_image_info())
        imgs += n
        img_pages += 1 if n else 0
        if NOTICE in txt: notice_pages += 1
        if not txt and not n and not page.get_drawings(): blank += 1
    t0 = doc[0].get_text().strip().replace('\n', ' ')[:90] if len(doc) else ''
    print(json.dumps({'file': f.replace('\\', '/').split('/')[-1], 'pages': len(doc), 'sizes': sizes, 'notice': notice_pages > 0 and len(doc) == 1,
                      'noticePages': notice_pages, 'blank': blank, 'imgs': imgs, 'imgPages': img_pages, 'text0': t0}, ensure_ascii=False))
