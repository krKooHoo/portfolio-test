# -*- coding: utf-8 -*-
"""theme/theme.css 점검 — /portfolio-theme가 쓴 테마가 규칙(rules.md §3·§4)을 지키는지 봅니다.

  python .claude/skills/portfolio-theme/check-theme.py theme/theme.css      (Windows에서 python이 없으면 py)

- 파일에는 @import(영문 글꼴)와 :root 손잡이(--t-*)만 있어야 합니다.
- 글자·선의 바탕 대비, 값 형식, 글꼴 주소(jsdelivr @fontsource, 버전 고정, 허용 목록)를 확인합니다.
- 문제가 있으면 [고칠 것]으로 알리고 종료 코드 1. [참고]는 통과지만 살펴볼 것.
- 손잡이가 하나도 없으면(기본 테마) 그대로 통과합니다.
"""
import io, re, sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# 영문 라벨 글꼴 허용 목록: 글꼴 이름 → @fontsource 패키지(700·800 굵기가 있는 것만). Montserrat는 페이지가 이미 싣으므로 @import 없음
FONTS = {
    'Montserrat': None, 'Poppins': 'poppins', 'Outfit': 'outfit', 'Inter': 'inter', 'Manrope': 'manrope',
    'Plus Jakarta Sans': 'plus-jakarta-sans', 'Sora': 'sora', 'Archivo': 'archivo', 'Barlow Condensed': 'barlow-condensed',
    'Playfair Display': 'playfair-display', 'Nunito': 'nunito', 'JetBrains Mono': 'jetbrains-mono', 'Pretendard': None,
}
COLOR_KEYS = ['bg', 'surface', 'ink', 'body', 'muted', 'line', 'line-2']
OPTIONAL_COLORS = ['accent', 'accent-2', 'accent-3', 'faint', 'code-bg', 'diagram']
KNOWN = set(COLOR_KEYS + OPTIONAL_COLORS + ['scheme', 'radius', 'pill', 'shadow', 'display', 'grad', 'badge', 'glow', 'mark'])
DEFAULT = {'bg': '#0A0A0D', 'surface': '#131318', 'ink': '#F4F4F6', 'body': '#BDBDC7', 'muted': '#9A9AA6', 'line': '#24242C', 'line-2': '#3D3D48'}

def rgb(h): return [int(h[i:i + 2], 16) for i in (1, 3, 5)]
def lum(c):
    f = lambda v: (v / 255) / 12.92 if v / 255 <= 0.03928 else ((v / 255 + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
def contrast(a, b):
    x, y = lum(rgb(a)), lum(rgb(b))
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)
def mixhex(a, b, t):   # a를 (1-t), b를 t 비율로(CSS color-mix(in srgb, a (1-t), b)와 같음)
    A, B = rgb(a), rgb(b)
    return '#' + ''.join(f'{round(A[i] + (B[i] - A[i]) * t):02X}' for i in range(3))

def main(path):
    try:
        raw = io.open(path, encoding='utf-8').read()
    except OSError as e:
        print(f'[고칠 것] 파일을 읽지 못했습니다: {e}'); return 1
    src = re.sub(r'/\*.*?\*/', '', raw, flags=re.S)
    errs, notes = [], []

    imports = re.findall(r'@import\s+url\(\s*["\']?([^"\')]+)["\']?\s*\)\s*;', src)
    rest = re.sub(r'@import\s+url\([^)]*\)\s*;', '', src)
    roots = re.findall(r':root\s*\{([^{}]*)\}', rest)
    leftover = re.sub(r':root\s*\{[^{}]*\}', '', rest).strip()
    if leftover:
        errs.append(f'손잡이(:root의 --t-*)와 @import 말고 다른 규칙이 있습니다: "{leftover[:80]}…" — 페이지 구조를 바꾸는 규칙은 테마에 넣지 않습니다(발표 덱 배치 점검이 깨질 수 있음)')
    if len(roots) > 1:
        errs.append(':root 블록은 하나만 둡니다')
    body = roots[0] if roots else ''
    if re.search(r'url\(', body):
        errs.append('손잡이 값에 url(…)을 쓰지 않습니다(그림 파일·외부 주소 금지)')

    T = {}
    for k, v in re.findall(r'--t-([a-z0-9-]+)\s*:\s*([^;]+);', body):
        T[k] = v.strip()
    other = [k for k in re.findall(r'(--[a-z0-9-]+)\s*:', body) if not k.startswith('--t-')]
    if other:
        errs.append(f'--t-로 시작하지 않는 변수는 쓰지 않습니다: {", ".join(other)}')
    for k in T:
        if k not in KNOWN:
            errs.append(f'모르는 손잡이 --t-{k} (rules.md §1 표에 있는 것만)')

    if not T and not imports:
        print('손잡이가 없습니다 — 기본 테마(어두운 바탕)를 씁니다. 통과'); return 0

    # 형식
    for k in COLOR_KEYS:
        if k not in T: errs.append(f'--t-{k}가 없습니다(필수 색 손잡이: {", ".join("--t-" + c for c in COLOR_KEYS)})')
    for k in COLOR_KEYS + OPTIONAL_COLORS:
        if k in T and not re.fullmatch(r'#[0-9A-Fa-f]{6}', T[k]):
            errs.append(f'--t-{k}: {T[k]} → #RRGGBB 꼴로 씁니다(강조색 계산이 이 꼴만 읽음)')
    C = {k: T.get(k, DEFAULT.get(k)) for k in COLOR_KEYS}
    ok_hex = all(C[k] and re.fullmatch(r'#[0-9A-Fa-f]{6}', C[k]) for k in COLOR_KEYS)

    if 'scheme' in T and T['scheme'] not in ('dark', 'light'):
        errs.append(f'--t-scheme: {T["scheme"]} → dark 또는 light')
    for k, lo, hi in (('radius', 0, 32), ('pill', 0, 999)):
        if k in T:
            m = re.fullmatch(r'(\d+(?:\.\d+)?)px|0', T[k])
            if not m: errs.append(f'--t-{k}: {T[k]} → px 값(예: 20px)')
            elif not (lo <= float(m.group(1) or 0) <= hi): errs.append(f'--t-{k}: {T[k]} → {lo}~{hi}px')
    for k in ('glow', 'mark'):
        if k in T:
            try:
                if not 0 <= float(T[k]) <= 1: raise ValueError
            except ValueError:
                errs.append(f'--t-{k}: {T[k]} → 0~1 사이 숫자')
    if 'shadow' in T and not re.fullmatch(r'(rgb|rgba|hsl|hsla)\([^()]*\)|#[0-9A-Fa-f]{6,8}|transparent', T['shadow']):
        errs.append(f'--t-shadow: {T["shadow"]} → 색 하나(예: rgb(0 0 0 / .8))')
    for k in ('grad', 'badge'):
        if k in T and not re.fullmatch(r'(linear|radial)-gradient\(.*\)|var\(--accent[a-z0-9-]*\)', T[k]):
            errs.append(f'--t-{k}: 그러데이션(linear-gradient(…)) 또는 var(--accent-fill) 같은 강조색 토큰만')

    # 글꼴
    disp = T.get('display', "'Montserrat'").split(',')[0].strip().strip('\'"')
    if disp not in FONTS:
        errs.append(f'--t-display: {disp} → 허용 목록의 글꼴만({", ".join(FONTS)}) — rules.md §2-8')
    pkg = FONTS.get(disp)
    for u in imports:
        m = re.fullmatch(r'https://cdn\.jsdelivr\.net/npm/@fontsource/([a-z0-9-]+)@(\d+\.\d+\.\d+)/latin-(700|800)\.css', u)
        if not m: errs.append(f'@import 주소: {u} → https://cdn.jsdelivr.net/npm/@fontsource/<글꼴>@<버전>/latin-700.css 꼴만(버전 고정)')
        elif m.group(1) != pkg: errs.append(f'@import {m.group(1)}가 --t-display({disp})와 다릅니다')
    if pkg:
        got = {re.search(r'latin-(\d+)', u).group(1) for u in imports if f'/{pkg}@' in u}
        if got != {'700', '800'}: errs.append(f'{disp}: latin-700.css·latin-800.css 두 줄을 @import 합니다(지금: {", ".join(sorted(got)) or "없음"})')
    elif imports and disp in FONTS:
        errs.append(f'{disp}는 페이지가 이미 싣습니다 — @import를 지웁니다')

    # 대비
    rows = []
    def need(fg, bg, lo, label, hard=True):
        if not ok_hex: return
        r = contrast(C[fg] if fg in C else fg, C[bg] if bg in C else bg)
        fine = r >= lo
        rows.append(f'  {"✓" if fine else ("✗" if hard else "△")} {label:<26} {r:5.2f} : 1  (기준 {lo})')
        if not fine: (errs if hard else notes).append(f'{label} 대비 {r:.2f} < {lo}')
    if ok_hex:
        need('ink', 'bg', 12, '제목 글자 / 바탕'); need('ink', 'surface', 10, '제목 글자 / 카드')
        need('body', 'bg', 7, '본문 글자 / 바탕'); need('body', 'surface', 7, '본문 글자 / 카드')
        need('muted', 'bg', 4.5, '보조 글자 / 바탕'); need('muted', 'surface', 4.5, '보조 글자 / 카드')
        faint = T.get('faint') or mixhex(C['muted'], C['bg'], 0.15)
        C['faint'] = faint; need('faint', 'bg', 3, '흐린 글자 / 바탕', hard=False)
        need('line', 'bg', 1.15, '구분선 / 바탕', hard=False); need('line-2', 'bg', 1.5, '알약 테두리 / 바탕', hard=False)
        need('surface', 'bg', 1.04, '카드 / 바탕(구분)', hard=False)
        chip = mixhex(C['bg'], C['ink'], 0.22); C['chip'] = chip; need('ink', 'chip', 4.5, '라벨 칩 글자 / 칩')
        dark = contrast(C['bg'], '#FFFFFF') >= contrast(C['bg'], '#000000')
        sch = T.get('scheme', 'dark')
        if sch != ('dark' if dark else 'light'):
            errs.append(f'--t-scheme: {sch} — 바탕 {C["bg"]}은 {"어두우므로 dark" if dark else "밝으므로 light"}')
        if 'code-bg' in T and re.fullmatch(r'#[0-9A-Fa-f]{6}', T['code-bg']):
            r = contrast(T['code-bg'], '#E6E8F5')
            rows.append(f'  {"✓" if r >= 7 else "✗"} {"코드 글자 / 코드 판":<26} {r:5.2f} : 1  (기준 7, 코드 판은 늘 어둡게)')
            if r < 7: errs.append('--t-code-bg는 어두운 색(코드 강조색 github-dark가 어두운 판 기준)')
        if 'diagram' in T and re.fullmatch(r'#[0-9A-Fa-f]{6}', T['diagram']):
            r = contrast(T['diagram'], '#333333')
            rows.append(f'  {"✓" if r >= 7 else "✗"} {"다이어그램 글자 / 판":<26} {r:5.2f} : 1  (기준 7, 다이어그램 판은 늘 밝게)')
            if r < 7: errs.append('--t-diagram은 밝은 색(학생 문서의 mermaid 테마가 밝은 판 기준)')
        elif not dark:
            notes.append('밝은 바탕인데 --t-diagram이 없습니다 — 다이어그램 판이 기본 회청색(#F4F5FA)입니다. 카드 색과 같게 두면 바탕과 어울립니다(rules.md §2-10)')
        if 'accent' in T and not ('accent-2' in T and 'accent-3' in T) and T.get('grad', '').count('accent-2') == 0:
            notes.append('강조가 한 색(라벨 단색)인데 --t-accent-2·-3이 없습니다 — 지우면 짝 색이 선 끝·진행 막대에 보입니다. 강조색과 같은 값으로(rules.md §2-6)')
        if not dark and 'shadow' not in T:
            notes.append('밝은 바탕인데 --t-shadow가 없습니다 — 기본(rgb(0 0 0 / .8))은 밝은 바탕에서 너무 진합니다. rgb(20 22 30 / .16) 정도')

    print(f'테마 점검: {path}')
    if rows:
        print('대비(바탕 기준, ✓ 통과 · ✗ 고칠 것 · △ 참고)'); print('\n'.join(rows))
    for e in errs: print(f'[고칠 것] {e}')
    for n in notes: print(f'[참고] {n}')
    print('통과' if not errs else f'고칠 것 {len(errs)}개')
    return 1 if errs else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'theme/theme.css'))
