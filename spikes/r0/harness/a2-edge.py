# a2-edge.py — a2-edge.js의 스크린샷에서 장면 배경(#F7F7F5)과 덱 배경(#E4E5E8)의 경계를 찾음(CSS px로 환산)
# 사용: python -I a2-edge.py shot.png dpr x yy aBottom bTop aLeft
#  세로선 x에서 aBottom 근처: 장면 → 덱으로 바뀌는 행, bTop 근처: 덱 → 장면으로 바뀌는 행. 가로선 yy에서 aLeft 근처: 덱 → 장면 열
#  경계 픽셀이 섞인 색(반투명 경계)이면 섞인 비율로 소수 위치를 추정. 그림자(box-shadow)가 덱 쪽을 어둡게 하므로 "장면색에 가까운 정도"로 판정
import sys, json
import pymupdf as fitz

f, dpr, x, yy, ab, bt, al = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6]), float(sys.argv[7])
pm = fitz.Pixmap(f)
SC, DK = (0xF7, 0xF7, 0xF5), (0xE4, 0xE5, 0xE8)

def px(X, Y):
    X, Y = int(X), int(Y)
    if X < 0 or Y < 0 or X >= pm.width or Y >= pm.height:
        return None
    return pm.pixel(X, Y)[:3]

def t(c):  # 0 = 덱(또는 그림자), 1 = 장면 배경. 초록 채널 기준(그림자는 어둡게만 하므로 덱 쪽은 0 이하로 잘림)
    return max(0.0, min(1.0, (c[1] - DK[1]) / (SC[1] - DK[1])))

def edge_v(y_css, rng=4):  # 세로 방향: y_css 근처 행들의 t 값 → 경계 위치(CSS px)
    X = int(x * dpr)
    rows = []
    for Y in range(int((y_css - rng) * dpr), int((y_css + rng) * dpr) + 1):
        c = px(X, Y)
        if c: rows.append((Y, round(t(c), 3), c))
    return rows

def edge_h(x_css, rng=4):
    Y = int(yy * dpr)
    cols = []
    for X in range(int((x_css - rng) * dpr), int((x_css + rng) * dpr) + 1):
        c = px(X, Y)
        if c: cols.append((X, round(t(c), 3), c))
    return cols

def locate(seq, falling):
    # 장면 쪽 픽셀 수(=t 합)로 경계 위치 추정: falling이면 장면 → 덱 방향
    if not seq: return None
    start = seq[0][0]
    total = sum(v for _, v, _ in seq)
    if falling:
        return round((start + total) / dpr, 3)          # 장면이 위쪽/왼쪽에서 total 픽셀만큼 차지
    return round((seq[-1][0] + 1 - total) / dpr, 3)      # 장면이 아래쪽/오른쪽에서 total 픽셀만큼 차지

b = edge_v(ab); tp = edge_v(bt); l = edge_h(al)
print(json.dumps({"aBottom": locate(b, True), "bTop": locate(tp, False), "bLeft": locate(l, False),
                  'rowsBottom': [(r[0], r[1]) for r in b], 'rowsTop': [(r[0], r[1]) for r in tp]}))
