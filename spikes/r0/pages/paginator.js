// R0 시험대 기술 문서 분할기 — 프로토타입 scratchpad\scene\paginator\site\paginator.js(ScenePager)를
// 01 §6 통합 설계에 맞춰 옮겼습니다.
//   바뀐 점: ① 감싸개(.scene-frame) 없이 형제 구조(.pf-scene). 장면은 측정 덱(.pf-measure 안)에서 만들고 호출자가 #deck으로 옮김
//            ② 본문 상자 590(§3-1), 여유 1px ③ force 결과 정의: 그래도 넘치면 보이는 잘림 띠(.pf-clipped) + 통계
//            ④ UI 문구(표 이어서·반복 머리행)는 data-pf-ui="cont" + aria-hidden(§6-1 원칙 2, §3-2)
//            ⑤ 개요(요약) 블록용 groupHeads·solo 경로 삭제(요약 장면은 project.js가 템플릿으로 그림)
const PFPaginator = (() => {
  let O, mdeck, scenes, stats;
  const K = { HEAD: 'heading', TEXT: 'text', CODE: 'code', TABLE: 'table', LIST: 'list', BOX: 'box', FIG: 'figure', DIAG: 'diagram', HR: 'hr', ATOM: 'atom' };

  function kindOf(el) {
    if (el.dataset.k) return el.dataset.k;
    const t = el.tagName;
    if (/^H[1-6]$/.test(t)) return K.HEAD;
    if (t === 'PRE') return K.CODE;
    if (t === 'TABLE') return K.TABLE;
    if (t === 'UL' || t === 'OL') return K.LIST;
    if (t === 'HR') return K.HR;
    if (el.classList.contains('mermaid')) return K.DIAG;
    if (t === 'P' && el.classList.contains('pf-fig')) return K.FIG;
    if (t === 'P') return K.TEXT;
    if (t === 'LI') return [...el.children].some(isBlockEl) ? K.BOX : K.TEXT;
    if (t === 'BLOCKQUOTE' || t === 'DIV' || t === 'SECTION' || t === 'ARTICLE' || t === 'DETAILS') return el.children.length ? K.BOX : K.ATOM;
    return K.ATOM;
  }
  const isBlockEl = (n) => n.nodeType === 1 && /^(P|PRE|UL|OL|TABLE|BLOCKQUOTE|DIV|H[1-6]|HR|FIGURE|DETAILS)$/.test(n.tagName);

  function newScene() {
    const el = O.makeScene();
    mdeck.appendChild(el);
    const s = { el, body: el.querySelector(':scope > .pf-body'), content: 0, end: null, warn: [] };
    scenes.push(s);
    return s;
  }

  let fitCalls = 0;
  function fits(s) {                                      // §6-3 fits(): scroll 넘침 없음 ∧ 마지막 자식.bottom ≤ 본문.bottom − slack
    fitCalls++;
    const b = s.body;
    if (b.scrollHeight > b.clientHeight || b.scrollWidth > b.clientWidth) return false;
    const last = b.lastElementChild;
    if (!last) return true;
    const br = b.getBoundingClientRect();
    return last.getBoundingClientRect().bottom <= br.bottom - (O ? O.slack : 1);
  }
  function fill(s) {
    const b = s.body, last = b.lastElementChild;
    if (!last) return 0;
    const br = b.getBoundingClientRect();
    return (last.getBoundingClientRect().bottom - br.top) / br.height;
  }
  const isFresh = (s) => s.content === 0;
  const stripIds = (el) => { el.removeAttribute('id'); el.querySelectorAll?.('[id]').forEach((n) => n.removeAttribute('id')); return el; };

  // ── 문단: 줄 단위(Range로 줄 시작, k ∈ [orphans, L − widows] 이분 탐색) ──
  function textNodes(el) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const out = []; let n; while ((n = w.nextNode())) out.push(n); return out; }
  function lineStarts(el) {
    el.normalize();
    const nodes = textNodes(el), r = document.createRange();
    const starts = []; let lastTop = -Infinity;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
    nodes.forEach((node, ni) => {
      const s = node.data;
      for (let i = 0; i < s.length; i++) {
        if (/\s/.test(s[i])) continue;
        r.setStart(node, i); r.setEnd(node, i + 1);
        const q = r.getClientRects()[0];
        if (!q) continue;
        if (q.top > lastTop + lh * 0.5) { starts.push([ni, i]); lastTop = q.top; }
      }
    });
    return starts;
  }
  function cutAt(el, pos) { const nodes = textNodes(el), r = document.createRange(); r.setStart(nodes[pos[0]], pos[1]); r.setEndAfter(el.lastChild); return r.extractContents(); }
  function splitText(el, s) {
    const starts = lineStarts(el), L = starts.length;
    if (L < O.orphans + O.widows) return null;            // 4줄 미만은 쪼개지 않음
    let lo = O.orphans, hi = L - O.widows, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const trial = el.cloneNode(true);
      cutAt(trial, starts[mid]);
      el.replaceWith(trial);
      const ok = fits(s);
      trial.replaceWith(el);
      if (ok) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (!best) return null;
    const frag = cutAt(el, starts[best]);
    const t = stripIds(el.cloneNode(false));
    t.appendChild(frag);
    t.classList.add('pf-tail');
    stats.splits.text++;
    return t;
  }

  // 하이라이트된 HTML을 줄 배열로(열린 span을 줄마다 닫고 다시 엶)
  function htmlLines(code) {
    const out = []; let cur = ''; const stack = [];
    const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const walk = (node) => node.childNodes.forEach((c) => {
      if (c.nodeType === 3) c.data.split('\n').forEach((t, i) => { if (i) { out.push(cur + '</span>'.repeat(stack.length)); cur = stack.join(''); } cur += esc(t); });
      else if (c.nodeType === 1) { const o = `<span class="${c.className}">`; stack.push(o); cur += o; walk(c); stack.pop(); cur += '</span>'; }
    });
    walk(code); out.push(cur);
    while (out.length > 1 && !out[out.length - 1].replace(/<[^>]+>/g, '')) out.pop();
    return out;
  }

  // ── 코드: 줄 단위(조각 최소 3줄, 뒷부분 최소 20%), "다음 장에 계속 ↓ / 이어서 ↑" ──
  function splitCode(pre, s, ctx) {
    const code = pre.querySelector('code');
    const lines = pre._lines || (pre._lines = htmlLines(code));
    const L = lines.length, m = O.codeMin, mt = Math.max(m, Math.ceil(L * 0.2));
    if (L < m + mt) return null;
    pre.classList.add('pf-more');
    let lo = m, hi = L - mt, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      code.innerHTML = lines.slice(0, mid).join('\n');
      if (fits(s)) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (!best || (ctx.ratioRule && best < O.keepRatio * L)) { code.innerHTML = lines.join('\n'); pre.classList.remove('pf-more'); return null; }
    code.innerHTML = lines.slice(0, best).join('\n');
    const t = stripIds(pre.cloneNode(true));
    t.classList.remove('pf-more'); t.classList.add('pf-tail');
    t._lines = lines.slice(best);
    t.querySelector('code').innerHTML = t._lines.join('\n');
    pre._lines = lines.slice(0, best);
    stats.splits.code++;
    return t;
  }

  // ── 표: 행 단위, 머리행 반복, "표 이어서". 끝에 1행만 남기지 않음(4행 이상). 이름 행 + 이미지 행은 함께 ──
  function splitTable(tb, s, ctx) {
    const body = tb.tBodies[0];
    if (!body) return null;
    const rows = [...body.rows], R = rows.length;
    if (R < 2) return null;
    let lo = 1, hi = R - 1, best = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; body.replaceChildren(...rows.slice(0, mid)); if (fits(s)) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    if (best && R >= 4 && R - best < 2) best = Math.max(0, R - 2);
    const hasImg = (r) => !!r.querySelector('img');
    while (best > 1 && !hasImg(rows[best - 1]) && rows[best] && hasImg(rows[best])) best--;
    if (best === 1 && !hasImg(rows[0]) && rows[1] && hasImg(rows[1])) best = 0;
    if (!best || (ctx.ratioRule && best < O.keepRatio * R)) { body.replaceChildren(...rows); return null; }
    body.replaceChildren(...rows.slice(0, best));
    const t = makeTableTail(tb, rows.slice(best));
    stats.splits.table++;
    return t;
  }
  function makeTableTail(tb, rows) {
    const t = stripIds(tb.cloneNode(false));
    const cap = document.createElement('caption'); cap.className = 'pf-cap'; cap.dataset.pfUi = 'cont'; cap.setAttribute('aria-hidden', 'true'); cap.textContent = '표 이어서';
    t.appendChild(cap);
    const cg = tb.querySelector(':scope > colgroup'); if (cg) t.appendChild(cg.cloneNode(true));
    if (tb.tHead && !tb.querySelector('tbody img')) { const th = tb.tHead.cloneNode(true); stripIds(th); th.dataset.pfUi = 'cont'; th.setAttribute('aria-hidden', 'true'); t.appendChild(th); }
    const tbd = document.createElement('tbody'); tbd.append(...rows); t.appendChild(tbd);
    t.classList.add('pf-tail');
    return t;
  }

  // ── 목록: 항목 단위, 넘치면 그 항목 안에서 재귀, ol start 보정, 끝 항목 1개만 넘기지 않음 ──
  function splitList(list, s, ctx) {
    const items = [...list.children], N = items.length;
    list.replaceChildren();
    let i = 0;
    for (; i < N; i++) { list.appendChild(items[i]); if (!fits(s)) break; }
    if (i >= N) return null;
    if (ctx.ratioRule && i < O.keepRatio * N) { list.replaceChildren(...items); return null; }
    const partial = splitInPlace(items[i], s, { fresh: false, ratioRule: false });
    if (!partial) items[i].remove();
    if (!partial && N >= 4 && N - i < 2 && i >= 3) { i = N - 2; list.replaceChildren(...items.slice(0, i)); }
    if (i === 0 && !partial) { list.replaceChildren(...items); return null; }
    const t = stripIds(list.cloneNode(false));
    if (list.tagName === 'OL') t.start = (list.start || 1) + i;
    if (partial) { partial.classList.add('pf-tail'); t.appendChild(partial); }
    t.append(...items.slice(partial ? i + 1 : i));
    t.classList.add('pf-tail-list');
    stats.splits.list++;
    return t;
  }

  // ── 상자(인용·HTML 묶음·혼합 항목): 자식을 하나씩, 넘치면 재귀. 상자 안 마지막 제목은 뒤로 ──
  function splitBox(el, s) {
    const kids = [...el.children];
    if (!kids.length) return null;
    el.replaceChildren();
    let i = 0;
    for (; i < kids.length; i++) { el.appendChild(kids[i]); if (!fits(s)) break; }
    if (i >= kids.length) return null;
    const partial = splitInPlace(kids[i], s, { fresh: false, ratioRule: false });
    if (!partial) kids[i].remove();
    let keep = i;
    while (!partial && keep > 0 && kindOf(kids[keep - 1]) === K.HEAD) { kids[keep - 1].remove(); keep--; }
    if (keep === 0 && !partial) { el.replaceChildren(...kids); return null; }
    const t = stripIds(el.cloneNode(false));
    t.classList.add('pf-tail');
    if (partial) t.appendChild(partial);
    t.append(...kids.slice(partial ? i + 1 : keep));
    stats.splits.box++;
    return t;
  }

  function splitInPlace(el, s, ctx) {
    switch (kindOf(el)) {
      case K.TEXT: return splitText(el, s);
      case K.CODE: return splitCode(el, s, ctx);
      case K.TABLE: return splitTable(el, s, ctx);
      case K.LIST: return splitList(el, s, ctx);
      case K.BOX: return splitBox(el, s, ctx);
      default: return null;
    }
  }

  // ── 그림·도식: 절대 쪼개지 않고 축소(§6-5) ──
  function media(b) { return b.matches('img, svg') ? b : b.querySelector('svg, img'); }
  function setScale(b, sc) {
    const m = media(b), n = b._nat;
    if (!m || !n) return;
    m.style.width = `${(n.w * sc).toFixed(2)}px`;
    m.style.height = `${(n.h * sc).toFixed(2)}px`;
    m.style.maxWidth = 'none';
    b._scale = sc;
  }
  function fitScale(b, s, minScale) {
    setScale(b, minScale);
    if (!fits(s)) return 0;
    let lo = Math.round(minScale * 100), hi = 100, best = lo;
    setScale(b, 1);
    if (fits(s)) return 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; setScale(b, mid / 100); if (fits(s)) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    setScale(b, best / 100);
    return best / 100;
  }
  function freshScale(b, headsH) {
    const n = b._nat, chrome = b._h - n.h;
    return Math.min(1, Math.max(0.01, (O.bodyH - headsH - chrome - O.slack) / n.h));
  }

  // ── force(§6-3): 빈 장면에도 최소 단위가 안 들어갈 때 ──
  function clipBand(s, b) {
    if (s.el.querySelector(':scope > .pf-clipped')) return;
    const c = document.createElement('div');
    c.className = 'pf-clipped'; c.dataset.pfUi = 'clip';
    c.textContent = `내용이 잘렸습니다 → 원문: ${O.clipUrl ? O.clipUrl(b) : ''}`;
    s.el.appendChild(c);
    stats.clipped.push({ kind: kindOf(b) });
  }
  function force(b, s) {
    const k = kindOf(b);
    s.body.appendChild(b);
    if (k === K.FIG || k === K.DIAG) {
      const sc = fitScale(b, s, 0.05);
      if (sc) { s.warn.push(`${k} 축소 ${sc}`); stats.forced.push({ kind: k, scale: sc, fits: true }); return null; }
    }
    if (k === K.TABLE && b.querySelector('img')) {
      const rows = [...b.tBodies[0].rows];
      b.tBodies[0].replaceChildren(rows[0]);
      const rest = rows.length > 1 ? makeTableTail(b, rows.slice(1)) : null;
      if (shrinkMedia(b, s)) { s.warn.push('표 행 이미지 축소'); stats.forced.push({ kind: 'table-img', fits: true }); if (rest) stats.splits.table++; return rest; }
      b.tBodies[0].replaceChildren(...rows);
    }
    if ((k === K.BOX || k === K.LIST) && b.children.length > 1) {
      const kids = [...b.children];
      b.replaceChildren(kids[0]);
      zoomFit(kids[0], s, k);
      const t = stripIds(b.cloneNode(false));
      t.classList.add('pf-tail');
      if (b.tagName === 'OL') t.start = (b.start || 1) + 1;
      t.append(...kids.slice(1));
      return t;
    }
    zoomFit(b, s, k);
    return null;
  }
  function zoomFit(b, s, k) {                             // zoom 0.3까지 이분 탐색 → 그래도 안 되면 잘림 띠
    const z0 = parseFloat(getComputedStyle(b).zoom) || 1;
    let lo = 30, hi = 100, best = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; b.style.zoom = z0 * mid / 100; if (fits(s)) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    b.style.zoom = z0 * (best || 30) / 100;
    const ok = fits(s);
    s.warn.push(`zoom x${(best || 30) / 100} (${k})`);
    stats.forced.push({ kind: k, zoom: (best || 30) / 100, fits: ok });
    if (!ok) clipBand(s, b);
  }
  function shrinkMedia(b, s) {
    b.classList.add('pf-shrink');
    let lo = 40, hi = Math.round(O.bodyH), best = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; b.style.setProperty('--pf-mh', `${mid}px`); if (fits(s)) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    if (!best) { b.classList.remove('pf-shrink'); return false; }
    b.style.setProperty('--pf-mh', `${best}px`);
    return true;
  }

  // ── 배치: 'all' | {rest} | 'none' ──
  function place(b, s, pendH) {
    const k = kindOf(b), fresh = isFresh(s);
    s.body.appendChild(b);
    if (k === K.FIG || k === K.DIAG) {
      setScale(b, 1);
      if (fits(s)) return 'all';
      const fs = freshScale(b, pendH);
      const legible = k === K.DIAG ? Math.min(1, O.minDiagFont / b._eff1) : O.imgMinScale;
      const min = fresh ? 0.05 : Math.min(1, Math.max(Math.min(legible, fs), fs * O.relScale));
      const sc = fitScale(b, s, Math.max(0.05, min));
      if (sc) { if (sc < 1) stats.scaled.push({ kind: k, scale: sc, eff: b._eff1 ? +(b._eff1 * sc).toFixed(2) : null }); return 'all'; }
      setScale(b, 1); b.remove();
      return 'none';
    }
    if (fits(s)) return 'all';
    if (k === K.HR) { b.remove(); b._dropped = true; return 'all'; }
    const wholeFitsFresh = b._h + pendH <= O.bodyH;
    if (k === K.BOX && !fresh && wholeFitsFresh && O.keepBoxes) { b.remove(); return 'none'; }
    if (k === K.ATOM) { b.remove(); return 'none'; }
    const rest = splitInPlace(b, s, { fresh, ratioRule: !fresh && wholeFitsFresh });
    if (rest) return { rest };
    b.remove();
    return 'none';
  }

  // paginate(q) — §6-3. blocks는 한 구간(H2 하나의 장)
  function paginate(blocks, opt) {
    O = opt; mdeck = opt.mdeck; scenes = []; fitCalls = 0;
    stats = { splits: { text: 0, code: 0, table: 0, list: 0, box: 0 }, scaled: [], forced: [], clipped: [], keepMoves: 0 };
    const t0 = performance.now();
    let cur = newScene();
    let pend = [];
    const pendH = () => pend.reduce((a, h) => a + h.getBoundingClientRect().height, 0);
    const open = (reason) => { cur.end = reason; cur = newScene(); };
    const q = blocks.slice();
    while (q.length) {
      const b = q.shift();
      const k = kindOf(b);
      if (b.dataset.breakBefore && cur.content) {        // 강제 나눔(H2): 끝에 남은 제목은 데려감
        const moved = pend; moved.forEach((h) => h.remove());
        open('break');
        moved.forEach((h) => cur.body.appendChild(h));
        pend = moved;
      }
      if (k === K.HEAD) {
        if (O.soft && /^H[3-4]$/.test(b.tagName) && cur.content && fill(cur) > O.soft) {   // 부드러운 나눔
          // 【R0 수정】 프로토타입은 pend = []로 바로 앞 제목(H2 등)을 장면 끝에 버려 두었음. 통합 설계의 "첫 H2 앞 도입부 붙이기"에서
          //   H2가 장면 가운데에 놓이면서 드러남(크래프팅 6장면 끝에 "1. 개요"만 남음) → 대기 중인 제목을 함께 데려감
          const moved = pend; moved.forEach((h) => h.remove());
          open('soft');
          moved.forEach((h) => cur.body.appendChild(h));
          pend = moved;
        }
        cur.body.appendChild(b);
        if (!fits(cur)) {
          b.remove();
          const moved = pend; moved.forEach((h) => h.remove());
          open('keep'); stats.keepMoves++;
          moved.forEach((h) => cur.body.appendChild(h));
          cur.body.appendChild(b);
        }
        pend.push(b);
        continue;
      }
      if (k === K.HR && isFresh(cur)) { b._dropped = true; continue; }
      const r = place(b, cur, pendH());
      if (r === 'all') { if (k !== K.HR) cur.content++; pend = []; continue; }
      if (r !== 'none') { cur.content++; pend = []; open('split'); q.unshift(r.rest); continue; }
      if (isFresh(cur)) {
        const rest = force(b, cur);
        cur.content++; pend = [];
        if (rest) { open('split'); q.unshift(rest); }
        continue;
      }
      const moved = pend; moved.forEach((h) => h.remove());
      open('keep'); stats.keepMoves++;
      moved.forEach((h) => cur.body.appendChild(h));
      pend = moved;
      q.unshift(b);
    }
    cur.end = 'end';
    scenes = scenes.filter((s) => { if (!s.body.children.length) { s.el.remove(); return false; } return true; });
    return { scenes, stats, ms: performance.now() - t0, fitCalls };
  }

  // 시험 분할용 복제(측정 속성 포함)
  function cloneBlock(el) {
    const c = el.cloneNode(true);
    ['_h', '_nat', '_eff1', '_vb', '_lines'].forEach((k) => { if (el[k] !== undefined) c[k] = Array.isArray(el[k]) ? el[k].slice() : el[k]; });
    return c;
  }
  return { paginate, cloneBlock, htmlLines, fill, fits, kindOf, setScale, K };
})();
