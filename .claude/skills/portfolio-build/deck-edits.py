#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""장면 고치기 적용 스크립트 — /portfolio-edit·/portfolio-build가 실행합니다(수강생이 직접 실행하지 않아도 됩니다).

src/<폴더>/deck-edits.json(장면 고치기 파일: 고정한 장면 pin + 숨긴 장면 hide)을
data/projects/<폴더>.json의 발표 덱(deck)에 반영합니다. 형식과 규칙은 schema.md 「장면 고치기 파일」.
  - 빌드가 만든 장면 목록은 deck.base에 보관합니다 → 되돌리기·다시 적용해도 결과가 같습니다(멱등).
  - 글을 만들지 않습니다. 고친 장면의 원문 그대로(verbatim: true) 글 조각이 원문 그 절에 정말 있는지 검사만 합니다.
  - 원문 블록(그림·코드·표) 지문은 미리 대조해 [권장]으로 알리지만, 최종 판정은 미리보기 감사(visual-*)입니다.
  - data JSON은 deck 값만 바꿔 끼웁니다(나머지 글자·줄 끝·BOM은 그대로).
  - Python 3.8 이상, 표준 라이브러리만.

사용(레포 루트에서, Windows에서 python이 없으면 py):
  python .claude/skills/portfolio-build/deck-edits.py apply <폴더>… | --all     반영
  python .claude/skills/portfolio-build/deck-edits.py check <폴더>… | --all     반영하지 않고 결과만
  python .claude/skills/portfolio-build/deck-edits.py show <폴더> <장면>        장면 JSON(지금 · 빌드 원래)
  python .claude/skills/portfolio-build/deck-edits.py pin <폴더> <장면> [--as <새 key>]
                                    장면을 고치기 파일에 고정. --as = 나누기(원래 장면도 고정하고 복제본을 바로 뒤 새 장면으로, 두 항목은 한 묶음)
  python .claude/skills/portfolio-build/deck-edits.py add <폴더> <새 key> --after <장면>
                                    빈 새 장면(그 장면 바로 뒤, 같은 장). 필드는 직접 채움
  python .claude/skills/portfolio-build/deck-edits.py hide <폴더> <장면> [--into <남길 장면>]
                                    장면 숨기기. --into = 합치기(남길 장면도 고정, 두 항목은 한 묶음)
  python .claude/skills/portfolio-build/deck-edits.py undo <폴더> <장면> | --all
                                    고친 것 지우기(되돌리기). 나누기·합치기 묶음은 함께 지움
<장면>에는 key, d-<key>, #s=d-<key>, 나뉜 장면 주소(d-<key>-2·d-<key>-t1)를 모두 쓸 수 있습니다.
pin·add·hide·undo는 고치기 파일만 바꿉니다. 그다음 apply를 실행해야 data에 반영됩니다.
"""
import argparse
import copy
import hashlib
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[3]
EDITS = 'deck-edits.json'
VERSION = 1
KEY_RE = re.compile(r'^[a-z][a-z0-9-]{1,31}$')
LAYOUTS = ('overview', 'visual', 'code', 'full', 'screens', 'problem')
TABS = ('개요', '구조', '흐름', '구현', '선택', '문제 해결', '결과', '')
KINDS = ('mermaid', 'code', 'table', 'image')
SLIDE_FIELDS = ('key', 'chapter', 'layout', 'tab', 'title', 'lead', 'sectionPath', 'points', 'visuals')
KIND_KO = {'mermaid': '다이어그램', 'code': '코드', 'table': '표', 'image': '그림'}

for _s in (sys.stdout, sys.stderr):                                # Claude가 읽는 파이프는 UTF-8로(한글 깨짐 방지)
    if not _s.isatty():
        try:
            _s.reconfigure(encoding='utf-8')
        except (AttributeError, ValueError):
            pass


def key_ok(k):
    return isinstance(k, str) and bool(KEY_RE.match(k)) and not re.match(r'^s-\d+$', k)


def norm_title(t):                                                # PF.normTitle과 같음
    return re.sub(r'\s+', ' ', re.sub(r'[`*_~]', '', str(t or ''))).strip()


def norm_text(s):                                                 # /portfolio-build §4 verbatim 검사와 같은 정규화
    return re.sub(r'\s+', ' ', re.sub(r'[*_`]', '', str(s or ''))).strip()


def squash(s):                                                    # md-blocks.js squash
    return re.sub(r'\s+', ' ', str(s or '')).strip()


def norm_src(s):                                                  # md-blocks.js normSrc
    s = unquote(str(s or '').strip())
    return s[2:] if s.startswith('./') else s


# ── 기술 문서 md: 제목·절 범위·원문 블록(marked 12 + md-blocks.js와 같은 판정을 목표로 한 근사) ──
FENCE_OPEN = re.compile(r'^ {0,3}(`{3,}|~{3,})(.*)$')
ATX = re.compile(r'^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$')
SETEXT = re.compile(r'^ {0,3}(=+|-+)[ \t]*$')
CONTAINER = re.compile(r'^ {0,3}(>[ \t]?|(?:[-*+]|\d{1,9}[.)])(?:[ \t]+|$))')
BLOCK_TAGS = ('address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|'
              'fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|'
              'menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul')
HTML_RAW = re.compile(r'^ {0,3}<(script|pre|style|textarea)(\s|>|$)', re.I)
HTML_COMMENT = re.compile(r'^ {0,3}<!--')
HTML_BLOCK = re.compile(r'^ {0,3}</?(%s)(\s|/?>|$)' % BLOCK_TAGS, re.I)
HTML_TAG_LINE = re.compile(r'^ {0,3}(<[A-Za-z][A-Za-z0-9-]*(\s+[A-Za-z_:][\w.:-]*(\s*=\s*("[^"]*"|\'[^\']*\'|[^\s"\'=<>`]+))?)*\s*/?>'
                           r'|</[A-Za-z][A-Za-z0-9-]*\s*>)\s*$')
TABLE_DELIM = re.compile(r'^ {0,3}\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$')


def inline_text(raw):
    """md 인라인 → 화면 글자(textContent에 가깝게): 코드 내용 유지, HTML 태그·그림 제거, 링크는 글자, 이스케이프·엔티티 풀기"""
    codes = []

    def keep(m):
        c = m.group(2)
        if len(c) > 1 and c[0] == ' ' and c[-1] == ' ' and c.strip():
            c = c[1:-1]
        codes.append(c)
        return '\x00%d\x00' % (len(codes) - 1)
    t = re.sub(r'(`+)(.+?)\1(?!`)', keep, raw or '')
    t = re.sub(r'<!--.*?-->', '', t)
    t = re.sub(r'<((?:https?|mailto):[^>\s]+)>', r'\1', t)          # 자동 링크 → 주소 글자
    t = re.sub(r'</?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?/?>', '', t)   # 진짜 HTML 태그만
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', t)                      # 그림은 글자가 없음
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = re.sub(r'\\([!-/:-@\[-`{-~])', r'\1', t)
    t = re.sub(r'\x00(\d+)\x00', lambda m: codes[int(m.group(1))], t)
    return html.unescape(t).strip()


def unemph(t):                                                   # 굵게·기울임·취소선 기호(화면 글자에는 없음). 낱말 안 _는 그대로
    t = re.sub(r'(\*\*|__)(?=\S)(.+?)(?<=\S)\1', r'\2', t)
    t = re.sub(r'(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])', r'\1', t)
    t = re.sub(r'(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)', r'\1', t)
    return re.sub(r'~~(.+?)~~', r'\1', t)


def table_cells(line):
    t = line.strip().replace('\\|', '\x01')
    if t.startswith('|'):
        t = t[1:]
    if t.endswith('|'):
        t = t[:-1]
    return [squash(unemph(inline_text(c.replace('\x01', '|')))) for c in t.split('|')]


class Doc:
    def __init__(self, text):
        L = text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
        self.lines = L
        self.heads = []        # {level, text, line, raw, parents}
        self.blocks = []       # {kind, line, fp}  — mermaid·code(펜스), table(GFM 표)
        stack = []
        para = []              # 지금 단락의 줄 번호(setext 제목 후보)
        fence = None
        fstart, finfo, fbody = 0, '', []
        html_end = None        # None | 'blank' | 정규식

        def add_head(level, raw, start):
            node = {'level': level, 'text': inline_text(raw), 'line': start, 'raw': raw}
            if not node['text']:
                return
            while stack and stack[-1]['level'] >= level:
                stack.pop()
            node['parents'] = list(stack)
            self.heads.append(node)
            stack.append(node)

        def end_fence():
            kind = 'mermaid' if (finfo.split() or [''])[0].lower() == 'mermaid' else 'code'
            first = ''
            for x in fbody:
                y = x.strip()
                if y and not (kind == 'mermaid' and y.startswith('%%')):
                    first = y
                    break
            self.blocks.append({'kind': kind, 'line': fstart, 'fp': squash(first)[:60]})

        i, n = 0, len(L)
        while i < n:
            line = L[i]
            s = line.strip()
            if fence:
                m = re.match(r'^ {0,3}(`{3,}|~{3,})[ \t]*$', line)
                if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence):
                    end_fence()
                    fence = None
                else:
                    fbody.append(line)
                i += 1
                continue
            if html_end is not None:
                if (html_end == 'blank' and not s) or (html_end != 'blank' and html_end.search(line)):
                    html_end = None
                i += 1
                continue
            if not s:
                para = []
                i += 1
                continue
            m = FENCE_OPEN.match(line)
            if m and not (m.group(1)[0] == '`' and '`' in m.group(2)):
                fence, fstart, finfo, fbody = m.group(1), i, m.group(2).strip(), []
                para = []
                i += 1
                continue
            if HTML_COMMENT.match(line):
                if '-->' not in line[line.index('<!--') + 4:]:
                    html_end = re.compile('-->')
                para = []
                i += 1
                continue
            if HTML_RAW.match(line):
                if not re.search(r'</(script|pre|style|textarea)>', line, re.I):
                    html_end = re.compile(r'</(script|pre|style|textarea)>', re.I)
                para = []
                i += 1
                continue
            if HTML_BLOCK.match(line) or (HTML_TAG_LINE.match(line) and not para):
                html_end = 'blank'
                para = []
                i += 1
                continue
            if para and SETEXT.match(line):                       # 단락 바로 아래 === / --- → 단락 전체가 제목
                add_head(1 if s[0] == '=' else 2, ' '.join(L[k].strip() for k in para), para[0])
                para = []
                i += 1
                continue
            rest, contained = line, False                         # 목록·인용 안의 제목(- ## …, > ## …)
            while True:
                c = CONTAINER.match(rest)
                if not c or (c.group(1).strip() in '-*+' and re.match(r'^ {0,3}([-*+])( *\1){2,} *$', rest)):
                    break
                rest, contained = rest[c.end():], True
            a = ATX.match(rest)
            if a:
                add_head(len(a.group(1)), a.group(2) or '', i)
                para = []
                i += 1
                continue
            if '|' in line and i + 1 < n and TABLE_DELIM.match(L[i + 1]) and len(table_cells(line)) == len(table_cells(L[i + 1])):
                self.blocks.append({'kind': 'table', 'line': i, 'fp': '|'.join(table_cells(line))})
                i += 2
                while i < n and L[i].strip() and '|' in L[i]:
                    i += 1
                para = []
                continue
            if contained or line.startswith('    ') and not para:
                para = []                                         # 목록·인용·들여쓴 코드는 setext 제목의 단락이 아님
            else:
                para.append(i)
            i += 1
        if fence:
            end_fence()

    @staticmethod
    def _tier(t, want):
        if t == want:
            return 2
        return 1 if t and want and (t.startswith(want) or want.startswith(t)) else 0

    def find(self, path):
        lst = [norm_title(x) for x in (path if isinstance(path, list) else [path])]
        lst = [x for x in lst if x]
        if not lst:
            return []
        last, anc = lst[-1], lst[:-1]
        cands = [(h, self._tier(norm_title(h['text']), last)) for h in self.heads]
        cands = [(h, t) for h, t in cands if t]
        best = max([t for _, t in cands] or [0])
        out = []
        for h, t in cands:
            if t != best:
                continue
            i = 0
            for a in h['parents']:
                if i < len(anc) and self._tier(norm_title(a['text']), anc[i]):
                    i += 1
            if i == len(anc):
                out.append(h)
        return out

    def end_of(self, h):
        nxt = [x['line'] for x in self.heads if x['line'] > h['line']]
        return min(nxt) if nxt else len(self.lines)

    def range_text(self, h):
        return '\n'.join(self.lines[h['line']:self.end_of(h)])

    def blocks_in(self, h, kind):
        end = self.end_of(h)
        return [b for b in self.blocks if b['kind'] == kind and h['line'] < b['line'] < end]


# ── data JSON: deck 값만 바꿔 끼우기 ──
def top_value_span(raw, key):
    """JSON 객체 글자 raw에서 최상위 key의 값이 차지하는 [start, end) 위치. 없으면 None"""
    i, n, depth = 0, len(raw), 0
    want = json.dumps(key, ensure_ascii=False)
    while i < n:
        c = raw[i]
        if c == '"':
            j = i + 1
            while j < n and raw[j] != '"':
                j += 2 if raw[j] == '\\' else 1
            tok = raw[i:j + 1]
            k = j + 1
            if depth == 1:
                while k < n and raw[k] in ' \t\r\n':
                    k += 1
                if k < n and raw[k] == ':' and json.loads(tok) == json.loads(want):
                    k += 1
                    while k < n and raw[k] in ' \t\r\n':
                        k += 1
                    return k, value_end(raw, k)
            i = j + 1
            continue
        if c in '{[':
            depth += 1
        elif c in '}]':
            depth -= 1
        i += 1
    return None


def value_end(raw, i):
    n, depth = len(raw), 0
    while i < n:
        c = raw[i]
        if c == '"':
            j = i + 1
            while j < n and raw[j] != '"':
                j += 2 if raw[j] == '\\' else 1
            i = j + 1
            if depth == 0:
                return i
            continue
        if c in '{[':
            depth += 1
        elif c in '}]':
            depth -= 1
            if depth == 0:
                return i + 1
            if depth < 0:
                return i
        elif depth == 0 and c in ',':
            return i
        i += 1
    return n


def dump(v, ind=0, width=120):
    """짧은 객체·배열은 한 줄로(data 손글씨 모양에 가깝게), 긴 것은 두 칸 들여쓰기"""
    one = json.dumps(v, ensure_ascii=False)
    pad = '  ' * ind
    if not isinstance(v, (dict, list)) or not v or len(one) + len(pad) <= width:
        return one
    if isinstance(v, dict):
        items = ['%s  %s: %s' % (pad, json.dumps(k, ensure_ascii=False), dump(x, ind + 1, width)) for k, x in v.items()]
        return '{\n' + ',\n'.join(items) + '\n' + pad + '}'
    items = ['%s  %s' % (pad, dump(x, ind + 1, width)) for x in v]
    return '[\n' + ',\n'.join(items) + '\n' + pad + ']'


def digest(slides):
    return hashlib.sha1(json.dumps(slides, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()[:16]


def write_text(path, text, bom=False):                           # Path.write_text(newline=)는 3.10부터 → open으로
    with open(str(path), 'w', encoding='utf-8-sig' if bom else 'utf-8', newline='') as f:
        f.write(text)


# ── 보고 ──
class Report:
    def __init__(self, pid):
        self.pid, self.lines, self.review, self.errors = pid, [], [], 0

    def add(self, grade, msg):
        if grade == '필수':
            self.errors += 1
        self.lines.append('[%s] %s' % (grade, msg))

    def show(self):
        print('── %s ──' % self.pid)
        for l in self.lines:
            print('  ' + l)
        if self.review:
            print('  확인해 주세요(리포트 report.md의 「확인해 주세요」에 이 줄 그대로):')
            for r in self.review:
                print('    - ' + r)


# ── 장면 서명: 원문 블록 참조(절 · 종류 · 번호 · 지문/경로) ──
def vsig(v, slide_path):
    path = v.get('sectionPath') or slide_path or []
    last = norm_title(path[-1]) if path else ''
    k = v.get('kind')
    if k == 'image':
        return '%s|image|%s|%s' % (last, norm_src(v.get('src')), v.get('n') or 1)
    return '%s|%s|%s|%s' % (last, k, v.get('n') or 1, norm_text(v.get('fp'))[:60])


def sigs(slide):
    return sorted(vsig(v, slide.get('sectionPath')) for v in (slide.get('visuals') or []) if isinstance(v, dict))


def last_title(slide_or_path):
    p = slide_or_path.get('sectionPath') if isinstance(slide_or_path, dict) else slide_or_path
    return norm_title(p[-1]) if isinstance(p, list) and p and isinstance(p[-1], str) else ''


def anchor_of(slide):
    return {'key': slide.get('key'), 'sectionPath': slide.get('sectionPath') or [], 'sig': sigs(slide)}


def is_piece(x, allow_empty=False):
    return isinstance(x, dict) and isinstance(x.get('text'), str) and (allow_empty or x['text'].strip()) and isinstance(x.get('verbatim'), bool)


def is_path(x):
    return isinstance(x, list) and x and all(isinstance(t, str) and t.strip() for t in x)


def validate(p, chapters, doc):
    """고정 장면 하나 검사 → (문제 목록, 미리 알릴 것[권장], 글 조각 [(이름, 글)], 다른 절 참조 [글])"""
    errs, warns, pieces, cross = [], [], [], []
    k = p.get('key')
    if not key_ok(k):
        errs.append('key "%s"가 규칙(영문 소문자로 시작, 소문자·숫자·하이픈 2~32자, s-숫자 금지)에 맞지 않음' % k)
    if p.get('chapter') not in chapters:
        errs.append('장 "%s"가 덱에 없음(%s)' % (p.get('chapter'), ', '.join(str(c) for c in chapters)))
    lay = p.get('layout')
    if lay not in LAYOUTS:
        errs.append('layout "%s"는 %s 중 하나여야 함' % (lay, ' · '.join(LAYOUTS)))
    if p.get('tab', '') not in TABS:
        errs.append('tab "%s"는 %s 중 하나여야 함' % (p.get('tab'), ' · '.join(t or '""' for t in TABS)))
    if not is_piece(p.get('title')):
        errs.append('title은 {"text", "verbatim"} 글 조각이어야 함(빈 글 안 됨)')
    if p.get('lead') is not None and not is_piece(p.get('lead')):
        errs.append('lead는 글 조각 또는 null이어야 함')
    sp = p.get('sectionPath')
    if not is_path(sp):
        errs.append('sectionPath는 제목 글자 배열이어야 함')
        sp = []
    pts = p.get('points') if p.get('points') is not None else []
    if not isinstance(pts, list) or len(pts) > 4 or not all(isinstance(x, dict) and isinstance(x.get('label', ''), str)
                                                             and is_piece(x, allow_empty=bool(str(x.get('label', '')).strip())) for x in pts):
        errs.append('points는 글 조각(label·text·verbatim) 0~4개여야 함(text가 비면 label 필요)')
        pts = []
    vis = p.get('visuals') if p.get('visuals') is not None else []
    if not isinstance(vis, list) or len(vis) > 3:
        errs.append('visuals는 0~3개여야 함')
        vis = []
    for i, v in enumerate(vis):
        if not isinstance(v, dict) or v.get('kind') not in KINDS:
            errs.append('visuals[%d]의 kind는 %s 중 하나' % (i, ' · '.join(KINDS)))
            continue
        if v['kind'] == 'image':
            if not (isinstance(v.get('src'), str) and v['src'].strip()):
                errs.append('visuals[%d] 그림에 src가 없음' % i)
        else:
            if not (isinstance(v.get('fp'), str) and v['fp'].strip()):
                errs.append('visuals[%d] %s에 지문 fp가 없음' % (i, KIND_KO[v['kind']]))
        if 'n' in v and not (isinstance(v['n'], int) and not isinstance(v['n'], bool) and v['n'] >= 1):
            errs.append('visuals[%d]의 n은 1 이상의 정수' % i)
        if v['kind'] == 'code' and 'lines' in v:
            ln = v['lines']
            if not (isinstance(ln, list) and len(ln) == 2 and all(isinstance(x, int) for x in ln) and 1 <= ln[0] <= ln[1]):
                errs.append('visuals[%d]의 lines는 [시작, 끝](1부터)' % i)
        if v.get('caption') is not None and not is_piece(v.get('caption')):
            errs.append('visuals[%d]의 caption은 글 조각' % i)
        if v.get('sectionPath') is not None and not is_path(v['sectionPath']):
            errs.append('visuals[%d]의 sectionPath는 제목 글자 배열' % i)
    if lay in ('visual', 'code', 'full') and not vis:
        errs.append('layout "%s"에는 시각 자료가 1개 이상 있어야 함' % lay)
    if lay == 'screens' and not (2 <= len(vis) <= 3 and all(isinstance(v, dict) and v.get('kind') == 'image' for v in vis)):
        errs.append('layout "screens"에는 그림이 2~3개 있어야 함')
    if errs or doc is None:
        return errs, warns, pieces, cross

    def section(path, what):
        hs = doc.find(path)
        if len(hs) != 1:
            errs.append('%s의 절 "%s"가 원문에 %s(절 제목이 바뀌었으면 /portfolio-edit로 다시 고르세요)'
                        % (what, ' › '.join(path), '없음' if not hs else '%d곳' % len(hs)))
            return None
        return hs[0]

    def scope(hd):                                                 # 그 절 범위 + 위 제목들의 원문 줄(장면 제목이 상위 절 제목인 경우)
        return norm_text('\n'.join([a['raw'] for a in hd['parents']] + [doc.range_text(hd)])) if hd else None
    h = section(sp, 'sectionPath')
    body = scope(h)

    def piece(x, name, sc):
        if not x or not x.get('text', '').strip():
            return
        if x.get('verbatim'):
            if sc is not None and norm_text(x['text']) not in sc:
                errs.append('%s "%s"가 원문 그 절에 그대로 없음 → 원문 글자로 바꾸거나 verbatim: false' % (name, x['text'][:40]))
        else:
            pieces.append((name, x['text']))

    piece(p.get('title'), '제목', body)
    piece(p.get('lead'), '도입', body)
    for x in pts:
        piece(x, '요점(%s)' % x['label'] if x.get('label') else '요점', body)
    for i, v in enumerate(vis):
        own = v.get('sectionPath')
        vh = section(own, 'visuals[%d]' % i) if own else h
        if vh is None:
            continue
        if own and h and vh is not h:
            cross.append('다른 절의 %s: §%s' % (KIND_KO[v['kind']], own[-1]))
        piece(v.get('caption'), '그림 설명', scope(vh))
        kind, nth = v['kind'], v.get('n') or 1
        if kind == 'image':                                        # 그림은 그 절에 그 경로가 있는지만
            if norm_src(v['src']) not in unquote(doc.range_text(vh)).replace('](./', ']('):
                warns.append('visuals[%d] 그림 %s가 §%s에 없습니다(미리보기에 빨간 띠)' % (i, v['src'], vh['text']))
            continue
        bl = doc.blocks_in(vh, kind)
        if nth > len(bl):
            warns.append('visuals[%d]: §%s에 %s가 %d개뿐입니다(n=%d, 미리보기에 빨간 띠)' % (i, vh['text'], KIND_KO[kind], len(bl), nth))
            continue
        got, want = bl[nth - 1]['fp'], squash(v['fp'])
        if (got != want) if kind == 'table' else (got[:60] != want[:60]):
            warns.append('visuals[%d]: §%s의 %s %d번째 지문이 다릅니다 — 원문 "%s"(미리보기에 빨간 띠)' % (i, vh['text'], KIND_KO[kind], nth, got))
    return errs, warns, pieces, cross


def scene_count(chapters, slides, data):
    used = {s.get('chapter') for s in slides}
    retro = data.get('retro') or {}
    has_retro = any(retro.get(x) for x in ('achieved', 'regrets', 'plans'))
    return len(slides) + len([c for c in chapters if c in used]) + 3 + (1 if has_retro else 0)


def deck_scene_for(slides, section):                               # PF.deckSceneFor와 같은 규칙
    want = norm_title(section)
    if not want:
        return None
    for s in slides:
        if last_title(s) == want:
            return s
    for s in slides:
        if any(norm_title(t) == want for t in (s.get('sectionPath') or []) if isinstance(t, str)):
            return s
    return None


def apply_edits(data, edits, doc, rep):
    """data의 deck에 고치기를 반영한 새 slides와 base를 돌려줌. 고치기가 없으면 (base, base)"""
    deck = data['deck']
    cur = deck.get('slides') or []
    if deck.get('base') is not None and deck.get('applied') == digest(cur):
        base = deck['base']
    else:
        base = cur
    base = copy.deepcopy(base)
    if any(s.get('edited') for s in base):
        rep.add('권장', '빌드 결과에 고친 장면 표시(edited)가 남아 있습니다. /portfolio-build가 고친 장면을 빌드 결과로 옮겨 적은 것 같습니다(되돌리기가 원래 장면으로 돌아가지 않을 수 있음)')
        for s in base:
            s.pop('edited', None)
    if edits is None:
        return base, base
    chapters = [c.get('key') for c in deck.get('chapters') or []]
    titles = {c.get('key'): c.get('title') or c.get('key') for c in deck.get('chapters') or []}
    S = copy.deepcopy(base)
    ptitle = data.get('title') or ''

    def find_target(key, frm, path_hint):
        """빌드 장면 중 고칠 대상: 같은 key(같은 절일 때) → 없으면 닻(절 + 시각 자료 서명)이 정확히 1개"""
        hit = [s for s in S if s.get('key') == key and not s.get('edited')]
        want_last = last_title(frm.get('sectionPath')) if frm else last_title(path_hint)
        if hit:
            if not want_last or last_title(hit[0]) == want_last:
                return hit[0], 'key'
            return hit[0], 'conflict'
        if frm:
            c = [s for s in S if not s.get('edited') and last_title(s) == want_last and sigs(s) == sorted(frm.get('sig') or [])]
            if len(c) == 1:
                return c[0], 'anchor'
        return None, 'missing'

    def frm_of(x, what):
        f = x.get('from')
        if f is None:
            return None
        if not (isinstance(f, dict) and (f.get('sectionPath') is None or is_path(f.get('sectionPath')))
                and isinstance(f.get('sig', []), list)):
            rep.add('권장', '%s "%s"의 from(닻)이 망가졌습니다 → 닻 없이 key로만 찾습니다. /portfolio-edit로 그 장면을 되돌린 뒤 다시 고치세요' % (what, x.get('key')))
            return None
        return f

    def end_of_chapter(ch):
        same = [i for i, s in enumerate(S) if s.get('chapter') == ch]
        return same[-1] + 1 if same else len(S)

    hides = []
    for x in edits.get('hide') or []:
        if isinstance(x, str):
            hides.append({'key': x})
        elif isinstance(x, dict) and isinstance(x.get('key'), str):
            hides.append(x)
        else:
            rep.add('필수', 'hide 항목 %r은 장면 key(글자) 또는 {"key", "from"}이어야 합니다' % (x,))
    hidden_keys = {h['key'] for h in hides}
    removed = []
    for h in hides:
        t, how = find_target(h['key'], frm_of(h, '숨길 장면'), None)
        if t is None or how == 'conflict':
            rep.add('권장', '숨길 장면 "%s"를 덱에서 찾지 못했습니다(다시 빌드로 key나 절 제목이 바뀌었나요?) → /portfolio-edit로 다시 숨기거나 되돌리세요' % h['key'])
            continue
        S.remove(t)
        removed.append(t)
        if how == 'anchor':
            rep.add('참고', '숨길 장면 "%s"는 다시 빌드로 key가 "%s"로 바뀌어 같은 절·같은 그림으로 찾아 숨겼습니다' % (h['key'], t.get('key')))
    pins, seen, applied = edits.get('pin') or [], set(), []
    if not isinstance(pins, list):
        rep.add('필수', 'pin은 장면 배열이어야 합니다')
        pins = []
    for p in pins:
        if not isinstance(p, dict):
            rep.add('필수', 'pin 항목은 장면 객체여야 합니다')
            continue
        k = p.get('key')
        frm = frm_of(p, '고친 장면')
        t, how = find_target(k, frm, p.get('sectionPath'))
        if how == 'conflict':
            rep.add('권장', '고친 장면 "%s": 빌드 장면 "%s"는 지금 §%s를 다룹니다(원래 §%s). 기술 문서의 절 제목을 바꿨거나 빌드가 key를 다른 절에 썼습니다 → 고친 내용을 반영하지 않았습니다. /portfolio-edit로 다시 고치거나 되돌리세요'
                    % (k, k, (t.get('sectionPath') or [''])[-1], ((frm or {}).get('sectionPath') or p.get('sectionPath') or [''])[-1]))
            continue
        if t is None and frm:
            rep.add('권장', '고친 장면 "%s"가 원래 장면(§%s)을 잃었습니다(기술 문서의 절 제목을 바꾸거나 절을 없앴나요?) → 고친 내용을 반영하지 않았습니다. /portfolio-edit로 다시 고치거나 되돌리세요'
                    % (k, ' › '.join(frm.get('sectionPath') or [])))
            continue
        errs, warns, pieces, cross = validate(p, chapters, doc)
        if k in seen:
            errs.append('같은 key의 고친 장면이 둘 이상')
        if k in hidden_keys:
            errs.append('같은 장면을 고치고 숨겼습니다(숨김이 우선)')
        if errs:
            rep.add('필수', '고친 장면 "%s"를 반영하지 않았습니다: %s' % (k, '; '.join(errs)))
            continue
        seen.add(k)
        out = {f: copy.deepcopy(p[f]) for f in SLIDE_FIELDS if f in p}
        out.setdefault('tab', '')
        out.setdefault('lead', None)
        out.setdefault('points', [])
        out.setdefault('visuals', [])
        out['edited'] = True
        if t is not None:
            S[S.index(t)] = out
            if how == 'anchor':
                rep.add('참고', '고친 장면 "%s": 다시 빌드로 빌드 key가 "%s"로 바뀌어 같은 절·같은 그림으로 찾아 반영했습니다(주소는 d-%s 그대로)' % (k, t.get('key'), k))
            if out['chapter'] != t.get('chapter') and p.get('after') is None:   # 장을 옮겼으면 그 장 끝
                S.remove(out)
                S.insert(end_of_chapter(out['chapter']), out)
        else:
            S.insert(end_of_chapter(out['chapter']), out)
        if any(s is not out and s.get('key') == k for s in S):
            rep.add('필수', '고친 장면 "%s"의 key가 덱의 다른 장면과 겹칩니다 → 반영하지 않았습니다' % k)
            S.remove(out)
            continue
        if p.get('after') is not None:
            a = [s for s in S if s.get('key') == p['after'] and s is not out]
            if not a:
                rep.add('권장', '고친 장면 "%s"의 after "%s"가 덱에 없습니다(숨겼거나 없어진 장면) → 순서를 옮기지 않았습니다' % (k, p['after']))
            elif a[0].get('chapter') != out['chapter']:
                rep.add('권장', '고친 장면 "%s"의 after "%s"가 다른 장에 있습니다 → 순서를 옮기지 않았습니다(장을 바꾸려면 chapter)' % (k, p['after']))
            else:
                S.remove(out)
                S.insert(S.index(a[0]) + 1, out)
        for w in warns:
            rep.add('권장', '고친 장면 "%s" %s' % (k, w))
        applied.append(out)
        if pieces or cross:
            parts = ['%s "%s"' % (nm, tx) for nm, tx in pieces] + cross
            rep.review.append('[%s · 발표 덱 d-%s (§%s) · 고친 장면] %s' % (ptitle, k, (out.get('sectionPath') or [''])[-1], ' · '.join(parts)))
    # 중복 막기: 같은 절의 고친 장면이 그림을 모두 이미 보이는 빌드 장면은 뺌(합치기·나누기 뒤 다시 빌드해 장면이 다시 생긴 경우)
    shown = {}
    for s in applied:
        for v in s.get('visuals') or []:
            shown.setdefault(vsig(v, s.get('sectionPath')), set()).add(last_title(s))
    for s in list(S):
        if s.get('edited') or not s.get('visuals'):
            continue
        if all(last_title(s) in shown.get(vsig(v, s.get('sectionPath')), ()) for v in s['visuals']):
            S.remove(s)
            rep.add('참고', '빌드 장면 "%s"의 그림이 모두 고친 장면에 이미 있어 뺐습니다(겹침 방지)' % s.get('key'))
    # 장이 빈 경우 · 포트폴리오 문서 기능 소개의 [발표 덱에서 보기] 연결
    left = {s.get('chapter') for s in S}
    gone = [c for c in chapters if c in {s.get('chapter') for s in base} and c not in left]
    for c in gone:
        rep.add('참고', '장 "%s"에 장면이 남지 않아 그 장 표지와 목차 항목이 빠집니다' % titles.get(c, c))
    for hl in data.get('highlights') or []:
        sec = hl.get('section')
        b = deck_scene_for(base, sec) if sec else None
        if b and not deck_scene_for(S, sec):
            where = '그 장의 장 표지로' if b.get('chapter') in left else '장 표지도 사라져 발표 덱 표지로'
            rep.add('권장', '포트폴리오 문서 기능 "%s"의 [발표 덱에서 보기]가 연결된 장면이 빠졌습니다 → %s 이어집니다' % (hl.get('title', sec), where))
    if applied or removed:
        rep.add('참고', '고친 장면 %d개 · 숨긴 장면 %d개를 반영했습니다' % (len(applied), len(removed)))
    n0, n1 = scene_count(chapters, base, data), scene_count(chapters, S, data)
    if n1 > 30 and n1 > n0:
        rep.add('참고', '장면이 약 %d장이 됩니다(권장 15~30장, 고치기 전 약 %d장). 코드가 길면 더 늘 수 있습니다' % (n1, n0))
    return S, base


# ── 파일 ──
def load_json(path, what):
    try:
        return json.loads(path.read_bytes().decode('utf-8-sig')), None
    except (UnicodeDecodeError, ValueError) as e:
        if isinstance(e, json.JSONDecodeError):
            return None, '%s의 JSON 문법 오류: %d번째 줄 %d번째 칸 — %s' % (what, e.lineno, e.colno, e.msg)
        return None, '%s를 읽지 못함(UTF-8 아님?): %s' % (what, e)
    except OSError as e:
        return None, '%s를 읽지 못함: %s' % (what, e)


def paths(pid):
    return ROOT / 'data' / 'projects' / ('%s.json' % pid), ROOT / 'src' / pid / EDITS


def load_edits(pid, rep):
    ep = paths(pid)[1]
    if not ep.exists():
        return None, False
    e, err = load_json(ep, 'src/%s/%s' % (pid, EDITS))
    if err:
        rep.add('필수', err + ' → 고친 내용을 반영하지 않았습니다(발표 덱은 마지막으로 반영한 상태 그대로)')
        return None, True
    if not isinstance(e, dict) or e.get('schemaVersion') != VERSION:
        rep.add('필수', 'src/%s/%s의 schemaVersion이 %s가 아닙니다(%r) → 반영하지 않았습니다' % (pid, EDITS, VERSION, e.get('schemaVersion') if isinstance(e, dict) else e))
        return None, True
    if e.get('portfolio') not in (None, {}, []):
        rep.add('참고', 'portfolio(포트폴리오 문서 고치기)는 아직 지원하지 않아 무시했습니다')
    return e, False


def write_deck(dp, data, raw, bom):
    span = top_value_span(raw, 'deck')
    nl = '\r\n' if '\r\n' in raw else '\n'
    text = dump(data['deck'], 1).replace('\n', nl)
    new = raw[:span[0]] + text + raw[span[1]:] if span else json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if json.loads(new) != data:                                    # 끼워 넣은 결과가 의도와 다르면 쓰지 않음(예: 최상위 "deck" 키가 둘)
        raise ValueError('data JSON에 deck을 끼워 넣은 결과를 확인하지 못했습니다(최상위 "deck" 키가 둘 이상인가요?) → /portfolio-build로 data를 다시 만드세요')
    write_text(dp, new, bom)


def run_apply(pid, write):
    rep = Report(pid)
    try:
        _run_apply(pid, write, rep)
    except Exception as e:                                        # 예상 못 한 입력: 트레이스백 대신 사람 말로, data는 쓰기 전이라 그대로
        rep.add('필수', '스크립트가 처리하지 못했습니다(%s: %s) → data는 바꾸지 않았습니다. 고치기 파일을 /portfolio-edit로 되돌리거나 유지관리자에게 알려 주세요' % (type(e).__name__, e))
    return rep


def _run_apply(pid, write, rep):
    dp, ep = paths(pid)
    if not dp.exists():
        rep.add('필수', 'data/projects/%s.json이 없습니다 → 먼저 /portfolio-build' % pid)
        return
    rawb = dp.read_bytes()
    bom = rawb.startswith(b'\xef\xbb\xbf')
    raw = rawb.decode('utf-8-sig')                                 # 줄 끝(CRLF/LF)을 그대로 읽어 그대로 씀
    data = json.loads(raw)
    deck = data.get('deck')
    if not (isinstance(data.get('schemaVersion'), int) and data['schemaVersion'] >= 2 and isinstance(deck, dict) and deck.get('slides')):
        if ep.exists():
            rep.add('필수', '발표 덱 데이터(deck)가 없는 예전 데이터입니다 → 먼저 /portfolio-build를 실행해야 고친 장면을 반영할 수 있습니다')
        return
    edits, broken = load_edits(pid, rep)
    if broken:                                                     # 고치기 파일이 깨졌으면 data를 건드리지 않음(마지막 반영 상태 유지)
        return
    doc = None
    md = ROOT / 'src' / pid / (data.get('doc') or '')
    if data.get('doc') and md.is_file():
        doc = Doc(md.read_bytes().decode('utf-8-sig', errors='replace'))
    elif edits and (edits.get('pin') or edits.get('hide')):
        rep.add('필수', '기술 문서 src/%s/%s를 찾지 못해 고친 장면을 검사할 수 없습니다 → 반영하지 않았습니다(문서 이름을 바꿨다면 먼저 /portfolio-build)' % (pid, data.get('doc') or '?'))
        return
    slides, base = apply_edits(data, edits, doc, rep)
    new_deck = dict(deck)
    if slides == base:
        new_deck['slides'] = base
        new_deck.pop('base', None)
        new_deck.pop('applied', None)
    else:
        new_deck['slides'] = slides
        new_deck['base'] = base
        new_deck['applied'] = digest(slides)
    if new_deck == deck:
        if edits is not None:
            rep.add('참고', '바뀐 것 없음')
        return
    data['deck'] = new_deck
    if write:
        write_deck(dp, data, raw, bom)
        rep.add('참고', 'data/projects/%s.json의 발표 덱을 갱신했습니다' % pid)
    else:
        rep.add('참고', '(check) 반영하면 발표 덱이 바뀝니다')


def all_ids():
    return sorted(p.stem for p in (ROOT / 'data' / 'projects').glob('*.json'))


def current(pid):
    dp, ep = paths(pid)
    data = json.loads(dp.read_bytes().decode('utf-8-sig'))
    deck = data.get('deck') or {}
    cur = deck.get('slides') or []
    base = deck['base'] if deck.get('base') is not None and deck.get('applied') == digest(cur) else cur
    edits = {'schemaVersion': VERSION, 'pin': [], 'hide': []}
    if ep.exists():
        e, err = load_json(ep, 'src/%s/%s' % (pid, EDITS))
        if err:
            raise SystemExit(err + ' → 먼저 고치거나 지운 뒤 다시 실행하세요')
        if not isinstance(e, dict) or e.get('schemaVersion') != VERSION:
            raise SystemExit('src/%s/%s의 schemaVersion이 %s가 아닙니다' % (pid, EDITS, VERSION))
        edits = e
    edits.setdefault('pin', [])
    edits.setdefault('hide', [])
    if not isinstance(edits['pin'], list) or not isinstance(edits['hide'], list):
        raise SystemExit('src/%s/%s의 pin·hide가 배열이 아닙니다 → 먼저 고치거나 지운 뒤 다시 실행하세요' % (pid, EDITS))
    return data, cur, base, edits, ep


def save_edits(ep, edits):
    ep.parent.mkdir(parents=True, exist_ok=True)
    write_text(ep, dump(edits) + '\n')


def find(slides, key):
    return next((s for s in slides if isinstance(s, dict) and s.get('key') == key), None)


def hkey(h):
    return h if isinstance(h, str) else (h.get('key') if isinstance(h, dict) else None)


def norm_key(raw, known):
    """장면 인자 → key. #s=·s=·d- 접두를 떼고, 없으면 나뉜 장면 접미(-2·-t1)를 뗌"""
    k = re.sub(r'^(?:#?s=)?d-', '', raw.strip())
    if k in known:
        return k
    stem = re.sub(r'-(\d+|t\d+)$', '', k)
    if stem != k and stem in known:
        print('나뉜 장면 d-%s → 장면 d-%s로 봅니다' % (k, stem))
        return stem
    return k


def copy_slide(s):
    return {k: copy.deepcopy(v) for k, v in s.items() if k in SLIDE_FIELDS}


def main():
    ap = argparse.ArgumentParser(description='장면 고치기 적용(schema.md 「장면 고치기 파일」)')
    ap.add_argument('cmd', choices=['apply', 'check', 'show', 'pin', 'add', 'hide', 'undo'])
    ap.add_argument('args', nargs='*')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--as', dest='as_key')
    ap.add_argument('--after')
    ap.add_argument('--into')
    a = ap.parse_args()
    if a.cmd in ('apply', 'check'):
        ids = all_ids() if a.all else a.args
        if not ids:
            ap.error('폴더 이름 또는 --all')
        errors = 0
        for pid in ids:
            rep = run_apply(pid, a.cmd == 'apply')
            if rep.lines or rep.review:
                rep.show()
            errors += rep.errors
        print('필수 %d건' % errors if errors else '완료')
        return 1 if errors else 0
    if not a.args:
        ap.error('폴더 이름이 필요합니다')
    pid = a.args[0]
    if not paths(pid)[0].exists():
        print('data/projects/%s.json이 없습니다' % pid)
        return 1
    data, cur, base, edits, ep = current(pid)
    if not cur:
        print('발표 덱 데이터(deck)가 없습니다 → 먼저 /portfolio-build')
        return 1
    if a.cmd == 'undo' and a.all:
        n = len(edits['pin']) + len(edits['hide'])
        edits['pin'], edits['hide'] = [], []
        save_edits(ep, edits)
        print('고친 것 %d개를 모두 지웠습니다 → apply로 반영' % n)
        return 0
    if len(a.args) < 2:
        ap.error('장면이 필요합니다(주소 #s=d-<key>의 <key>)')
    known = {s.get('key') for s in cur + base if isinstance(s, dict)} | {x.get('key') for x in edits['pin'] if isinstance(x, dict)} | {hkey(h) for h in edits['hide']}
    key = norm_key(a.args[1], known) if a.cmd != 'add' else re.sub(r'^(?:#?s=)?d-', '', a.args[1].strip())
    pin_of = lambda k: next((x for x in edits['pin'] if isinstance(x, dict) and x.get('key') == k), None)
    if a.cmd == 'show':
        c, b = find(cur, key), find(base, key)
        if not c and not b:
            print('장면 "%s"가 없습니다. 장면 key: %s' % (key, ', '.join(str(s.get('key', '')) for s in cur)))
            return 1
        print(json.dumps({'scene': 'd-%s' % key, 'edited': bool(c and c.get('edited')), 'group': (pin_of(key) or {}).get('group'),
                          'now': c, 'build': b if b != c else '(지금과 같음)'}, ensure_ascii=False, indent=2))
        return 0
    if a.cmd == 'add':
        after = norm_key(a.after or '', known) if a.after else None
        ref = find(cur, after) if after else None
        if not ref:
            print('--after <장면>이 필요합니다(새 장면을 놓을 자리, 같은 장)')
            return 1
        if not key_ok(key) or key in known:
            print('새 key "%s"를 쓸 수 없습니다(규칙 위반 또는 이미 있음)' % key)
            return 1
        p = {'key': key, 'after': after, 'chapter': ref.get('chapter'), 'layout': 'overview', 'tab': '',
             'title': {'text': '', 'verbatim': True}, 'lead': None, 'sectionPath': [], 'points': [], 'visuals': []}
        edits['pin'].append(p)
        save_edits(ep, edits)
        print('src/%s/%s의 pin[%d]에 빈 새 장면 "%s"를 넣었습니다. sectionPath·title·visuals·points를 채운 뒤 apply로 반영:' % (pid, EDITS, len(edits['pin']) - 1, key))
        print(dump(p))
        return 0
    if a.cmd == 'pin':
        src = find(cur, key)
        if not src:
            print('장면 "%s"가 없습니다' % key)
            return 1
        if a.as_key:                                              # 나누기: 원래 장면도 고정(안 하면 겹침 막기가 원래 장면을 뺌) + 두 항목을 한 묶음으로
            nk = re.sub(r'^(?:#?s=)?d-', '', a.as_key.strip())
            if not key_ok(nk) or nk in known:
                print('새 key "%s"를 쓸 수 없습니다(규칙 위반이거나 덱·고치기 파일·숨김 목록에 이미 있음)' % nk)
                return 1
            o = pin_of(key)
            if o is None:
                o = copy_slide(src)
                b = find(base, key)
                if b:
                    o['from'] = anchor_of(b)
                edits['pin'].append(o)
                print('원래 장면 "%s"도 함께 고정했습니다(pin[%d])' % (key, len(edits['pin']) - 1))
            group = o.get('group') or 'split-%s' % nk
            o['group'] = group
            p = copy_slide(src)
            p['key'], p['after'], p['group'] = nk, key, group
        else:
            if pin_of(key) is not None:
                print('이미 고친 장면입니다 → src/%s/%s의 pin에서 바로 고치세요' % (pid, EDITS))
                return 0
            b = find(base, key)
            p = copy_slide(src)
            if b:
                p['from'] = anchor_of(b)
        edits['pin'].append(p)
        save_edits(ep, edits)
        print('src/%s/%s의 pin[%d]에 "%s"를 넣었습니다. 고친 뒤 apply로 반영:' % (pid, EDITS, len(edits['pin']) - 1, p['key']))
        print(dump(p))
        return 0
    if a.cmd == 'hide':
        group = None
        if a.into:                                                # 합치기: 남길 장면도 고정 + 한 묶음
            into = norm_key(a.into, known)
            if into == key:
                print('숨길 장면과 남길 장면이 같습니다')
                return 1
            keep = pin_of(into)
            if keep is None:
                src = find(cur, into)
                if not src:
                    print('남길 장면 "%s"가 없습니다' % into)
                    return 1
                keep = copy_slide(src)
                b = find(base, into)
                if b:
                    keep['from'] = anchor_of(b)
                edits['pin'].append(keep)
                print('남길 장면 "%s"를 고정했습니다(pin[%d]) → 그 pin에 숨길 장면의 그림·요점을 옮겨 넣으세요' % (into, len(edits['pin']) - 1))
            group = keep.get('group') or 'merge-%s' % into
            keep['group'] = group
        pin = pin_of(key)
        if pin is not None:
            edits['pin'].remove(pin)
            if not pin.get('from'):
                save_edits(ep, edits)
                print('더한 장면 "%s"를 지웠습니다 → apply로 반영' % key)
                return 0
        b = find(base, key)
        if not b and pin is None:
            print('장면 "%s"가 없습니다' % key)
            return 1
        if not any(hkey(h) == key for h in edits['hide']):
            h = {'key': key, 'from': anchor_of(b) if b else pin['from']}
            if group:
                h['group'] = group
            edits['hide'].append(h)
        save_edits(ep, edits)
        print('장면 "%s"를 숨김 목록에 넣었습니다 → apply로 반영' % key)
        return 0
    if a.cmd == 'undo':                                           # 그 장면 + 같은 묶음(나누기·합치기)의 항목을 함께
        mine = [x for x in edits['pin'] if isinstance(x, dict) and x.get('key') == key] + [h for h in edits['hide'] if hkey(h) == key]
        groups = {x.get('group') for x in mine if isinstance(x, dict) and x.get('group')}
        drop = lambda x: (isinstance(x, dict) and (x.get('key') == key or (x.get('group') in groups))) or x == key
        gone = [hkey(x) if not isinstance(x, dict) else x.get('key') for x in edits['pin'] + edits['hide'] if drop(x)]
        if not gone:
            print('장면 "%s"는 고친 것이 없습니다' % key)
            return 0
        edits['pin'] = [x for x in edits['pin'] if not drop(x)]
        edits['hide'] = [h for h in edits['hide'] if not drop(h)]
        save_edits(ep, edits)
        extra = sorted(set(gone) - {key})
        print('장면 "%s"의 고친 것을 지웠습니다%s → apply로 반영' % (key, '(같은 묶음: %s도 함께)' % ', '.join(extra) if extra else ''))
        return 0
    return 0


if __name__ == '__main__':
    sys.exit(main())
