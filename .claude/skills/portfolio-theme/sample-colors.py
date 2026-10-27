# -*- coding: utf-8 -*-
"""스크린샷에서 색 값 읽기 — /portfolio-theme가 눈대중 대신 실제 픽셀로 #RRGGBB를 고르게 합니다.

  python .claude/skills/portfolio-theme/sample-colors.py shot.png                 # 많이 쓰인 색 상위 12개(면적 %)
  python .claude/skills/portfolio-theme/sample-colors.py shot.png --top 20
  python .claude/skills/portfolio-theme/sample-colors.py shot.png --at 80,300 400,512   # 그 자리의 색(x,y 픽셀)

- PNG는 추가 설치 없이 읽습니다. 다른 형식(JPG 등)은 Pillow가 있을 때만 읽습니다.
- 상위 색은 바탕·카드·선처럼 넓은 면을 고를 때, --at은 글자·버튼·모서리처럼 좁은 곳을 고를 때 씁니다
  (글자는 가장자리가 흐려져 있으니 획의 가운데를 찍고, 두세 곳 중 가장 진한 값을 씀).
"""
import struct, sys, zlib
from collections import Counter

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def read_png(path):
    data = open(path, 'rb').read()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('PNG가 아닙니다')
    pos, idat, plte = 8, b'', None
    while pos < len(data):
        n, typ = struct.unpack('>I4s', data[pos:pos + 8]); body = data[pos + 8:pos + 8 + n]; pos += 12 + n
        if typ == b'IHDR': w, h, depth, ctype, _, _, inter = struct.unpack('>IIBBBBB', body)
        elif typ == b'PLTE': plte = body
        elif typ == b'IDAT': idat += body
        elif typ == b'IEND': break
    if depth != 8 or inter:
        raise ValueError('8비트·비월(interlace) 없는 PNG만 읽습니다 — 다른 도구로 PNG로 다시 저장해 주세요')
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    raw, stride, prev, rows = zlib.decompress(idat), w * ch, bytearray(w * ch), []
    for y in range(h):
        f = raw[y * (stride + 1)]; line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - ch] if i >= ch else 0; b = prev[i]; c = prev[i - ch] if i >= ch else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line); prev = line
    def px(x, y):
        r = rows[y]; i = x * ch
        if ctype == 3: k = r[i]; return tuple(plte[k * 3:k * 3 + 3])
        if ctype in (0, 4): return (r[i],) * 3
        return tuple(r[i:i + 3])
    return w, h, px

def read_any(path):
    try:
        from PIL import Image
        im = Image.open(path).convert('RGB'); w, h = im.size; load = im.load()
        return w, h, lambda x, y: load[x, y]
    except ImportError:
        return read_png(path)

def hexc(c): return '#%02X%02X%02X' % c

def main(argv):
    if not argv: print(__doc__); return 2
    path, top, at = argv[0], 12, []
    i = 1
    while i < len(argv):
        if argv[i] == '--top': top = int(argv[i + 1]); i += 2
        elif argv[i] == '--at':
            i += 1
            while i < len(argv) and not argv[i].startswith('--'): at.append(tuple(map(int, argv[i].split(',')))); i += 1
        else: i += 1
    w, h, px = read_any(path)
    print(f'{path}: {w}×{h}')
    if at:
        for x, y in at:
            print(f'  ({x},{y}) {hexc(px(min(x, w - 1), min(y, h - 1)))}')
        return 0
    step = max(1, int((w * h / 400_000) ** .5))                  # 큰 그림은 격자로 건너뛰며 셈
    cnt = Counter(px(x, y) for y in range(0, h, step) for x in range(0, w, step))
    total = sum(cnt.values())
    print(f'많이 쓰인 색(면적 %, {step}px 간격으로 셈):')
    for c, n in cnt.most_common(top):
        print(f'  {hexc(c)}  {n * 100 / total:5.1f}%')
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
