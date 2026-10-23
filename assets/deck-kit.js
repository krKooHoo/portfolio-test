// ════════════════════════════════════════════════════════════════════════════
// 덱 키트 JS (assets/deck-kit.js) — 덱 페이지(index.html·project.html)의 <head>에서 동기 로드, 가장 먼저
//   출처: spikes/deck/kit/deck-kit.js(블록 A는 spikes/r0/kit/scene-kit.js 그대로)
//   주석의 설계 근거(docs/design/…의 portfolio-structure·deck-vs-scroll·01 §, R0, 결정 F·Q·# 번호)와 원본 시안(spikes/…)은 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.
//   블록 A: docs/design/01 §8-2 준비 게이트(R0 【시험대 1~5】 포함)
//   블록 B: 덱 키트 — 덱 보기(기본)·한 번에 보기, 배율 k = min(vw/1280, (vh−HUD)/720), HUD 띠, 키보드·휠·터치·가장자리 클릭,
//           주소(#s=<장면 id> · #n · #s-n), 개요 격자, 포커스·aria-live, 세로 화면 안내, [PDF로 저장], 감사(audit·outside-deck)
//   deck-vs-scroll §3 알려진 결함 중 요약 덱에 해당하는 것을 고침:
//     휠·트랙패드 넘기기 기본 켬(몸짓 하나 = 한 장) · 데스크톱 장면 클릭 넘기기 없앰(HUD·가장자리·터치만) · 세로 스와이프 + 회전 안내 ·
//     보기 선택이 페이지를 넘어 유지 · 공유 주소는 장면 id(#s=hl-2) · HUD 번호 "NN / NN" · 한 번에 보기의 링크 첫 클릭 삼켜짐
// 시험 훅(쿼리): ?pf-timeout=<ms> · ?pf-k=<수> · ?pf-audit=1 · ?view=deck|scroll · ?wheel=0
// ════════════════════════════════════════════════════════════════════════════

// ── 블록 A: 준비 게이트 ─────────────────────────────────────────────────────
//   "no" = 그리는 중(인쇄하면 안내 한 쪽) | "yes" = 인쇄 가능
//   "timeout" = 20초가 지났는데 아직 그리는 중(인쇄하면 여전히 안내 한 쪽, HUD 경고 + [그래도 인쇄]. 끝나면 "yes"로 회복)
(() => {
  const root = document.documentElement, jobs = [];
  let gen = 0, t, mounted, isMounted = false;
  root.dataset.pfReady = 'no';
  const EAGER = matchMedia('(pointer: fine)').matches &&               // 데스크톱 기기면 창 크기와 상관없이 미리 받음(§7-7)
                !(navigator.connection && navigator.connection.saveData);
  const tick = () => new Promise((r) => setTimeout(r, 0));          // rAF 금지: 가려진 창에서 멈춤(실측)
  const loaded = (i) => i.complete ? null : new Promise((r) => {     // decode() 금지: 가려진 창에서 안 끝남(실측)
    i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); });
  async function settle() {
    const my = ++gen;
    if (root.dataset.pfReady === 'yes') root.dataset.pfReady = 'no';  // timeout 표시는 끝날 때까지 유지
    for (let n = -1; n !== jobs.length;) { n = jobs.length; await Promise.allSettled(jobs); }  // 도중 등록분까지(mount 대기 포함)
    if (EAGER) document.querySelectorAll('img[loading="lazy"]').forEach((i) => { if (!i.closest('.pf-ov')) i.loading = 'eager'; });
    await Promise.all([...document.querySelectorAll('img:not([loading="lazy"])')].map(loaded));
    if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
    await tick();
    if (my === gen) root.dataset.pfReady = 'yes';                       // timeout 뒤에 끝나도 반드시 회복
  }
  const schedule = () => { clearTimeout(t); t = setTimeout(settle, 0); };
  jobs.push(new Promise((r) => { mounted = r; }));                      // mount()가 불릴 때까지 게이트를 닫아 둠
  addEventListener('load', schedule);
  addEventListener('beforeprint', () => {                               // 폰·데이터 절약(lazy 유지)에서 인쇄할 때
    if (root.hasAttribute('data-pf-print-anyway')) return;              // [그래도 인쇄]는 지금 상태 그대로
    const pending = [...document.images].filter((i) => !i.complete && !i.closest('.pf-ov'));
    if (pending.length) { if (root.dataset.pfReady === 'yes') root.dataset.pfReady = 'no';   // 이번 인쇄는 안내 한 쪽(timeout은 그대로)
      document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
      schedule(); }                                                     // 다음 인쇄를 위해 받기 시작
  });
  addEventListener('afterprint', () => { delete root.dataset.pfPrintAnyway; });
  const TIMEOUT = +(new URLSearchParams(location.search).get('pf-timeout') || 20000);
  setTimeout(() => { if (root.dataset.pfReady === 'no') root.dataset.pfReady = 'timeout'; }, TIMEOUT);
  window.PFScene = Object.assign(window.PFScene || {}, {
    track(p) { jobs.push(Promise.resolve(p).catch((e) => console.warn('[pf-scene] 작업 실패:', e))); schedule(); return p; },
    _mounted() { isMounted = true; mounted(); schedule(); },
    printAnyway() { if (isMounted) root.dataset.pfPrintAnyway = ''; print(); },   // mount 전이면 그릴 덱이 없으므로 안내 쪽 그대로
  });
  Object.defineProperty(window.PFScene, 'ready', { get() { return root.dataset.pfReady; }, configurable: true });
  window.PFScene._eager = EAGER;
})();

// ── 블록 B: 덱 키트 ─────────────────────────────────────────────────────────
(() => {
  const W = 1280, H = 720, GAP = 16, KMAX = 1.5, HUD_H = 44;
  const root = document.documentElement;
  const Q = new URLSearchParams(location.search);
  const PF = window.PFScene;
  const T = (PF._t = { mount: null, ready: null, timeout: null, firstYes: null });
  let deck = null, scenes = [], cur = 0, hud = null, opts = {}, scope = 'all', K = 1, io = null, mountedOnce = false, ov = null, ovBuilt = false, hint = null, hintClosed = false;
  // 보기 선택 기억: 같은 <id>.github.io 출처를 여러 레포가 나눠 쓰므로 키에 레포 경로를 넣음(portfolio-structure §3-4 조건 6)
  const VIEW_KEY = `pf-view:${location.pathname.replace(/[^/]*$/, '')}`;
  const storedView = (() => { try { return localStorage.getItem(VIEW_KEY); } catch { return null; } })();
  let view = Q.get('view') === 'scroll' ? 'scroll' : Q.get('view') === 'deck' ? 'deck' : storedView === 'scroll' ? 'scroll' : 'deck';
  const WHEEL = Q.get('wheel') !== '0';                       // 휠·트랙패드 넘기기 기본 켬
  root.dataset.view = view;                                   // CSS가 mount 전부터 보기를 알도록(head에서 동기 실행)
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPrint = () => matchMedia('print').matches;
  const pad2 = (n) => String(n).padStart(2, '0');

  // ── 준비 상태 관찰 ──
  const readyWaiters = [];
  const onReadyChange = () => {
    const r = root.dataset.pfReady;
    if (r === 'yes') { T.ready = performance.now(); if (T.firstYes == null) T.firstYes = T.ready; readyWaiters.splice(0).forEach((f) => f()); }
    if (r === 'timeout' && T.timeout == null) T.timeout = performance.now();
    hudSync();
    if (Q.get('pf-audit') === '1' && (r === 'yes' || r === 'timeout')) setTimeout(writeAudit, 0);
  };
  new MutationObserver(onReadyChange).observe(root, { attributes: true, attributeFilter: ['data-pf-ready'] });
  const whenReady = () => (root.dataset.pfReady === 'yes' ? Promise.resolve() : new Promise((r) => readyWaiters.push(r)));

  // ── 배율 ── 덱 보기: k = min(vw/1280, (vh − HUD)/720), 상한 없음 / 한 번에 보기: 간격·HUD 몫을 빼고 상한 1.5
  function fit() {
    const vw = root.clientWidth, vh = innerHeight;
    let k = view === 'deck' ? Math.min(vw / W, (vh - HUD_H) / H) : Math.min(vw / W, (vh - HUD_H - 2 * GAP) / H, KMAX);
    if (Q.has('pf-k')) k = +Q.get('pf-k');
    K = k = Math.max(k, 0.05);
    root.style.setProperty('--pf-k', String(k));
    root.style.setProperty('--pf-x', `${Math.max(0, (vw - W * k) / 2)}px`);
    root.style.setProperty('--pf-y', `${Math.max(0, (vh - HUD_H - H * k) / 2)}px`);
    if (ov?.open) ovScale();
    rotateHint();
  }

  // ── 장면 수집·번호·이름 ──
  const textNoUi = (e) => (e ? [...e.childNodes].filter((n) => !(n.nodeType === 1 && n.matches('[data-pf-ui]'))).map((n) => n.textContent).join('') : '');
  const titleOf = (s) => (s.dataset.title || textNoUi(s.querySelector('.pf-title, .pf-body h1, .pf-body h2, .pf-body h3'))).replace(/\s+/g, ' ').trim();
  const isAutoId = (id) => /^s-\d+$/.test(id || '');
  function collect() {
    scenes = [...deck.children].filter((e) => e.classList.contains('pf-scene'));
    const N = scenes.length;
    scenes.forEach((s, i) => {
      if (!s.id || isAutoId(s.id)) s.id = `s-${i + 1}`;      // 렌더러가 붙인 안정 id(cover·hl-1 …)는 그대로, 없으면 번호 id
      s.tabIndex = -1;
      s.setAttribute('role', 'group');
      s.setAttribute('aria-roledescription', '슬라이드');
      const t = titleOf(s);
      s.removeAttribute('aria-labelledby');
      s.setAttribute('aria-label', `${i + 1} / ${N}${s.dataset.sec ? ' · ' + s.dataset.sec : ''}${t && t !== s.dataset.sec ? ' · ' + t : ''}`);
      s.querySelectorAll('.pf-foot .pf-n-screen').forEach((e) => { e.textContent = `${i + 1} / ${N}`; });
    });
    renumberPrint();
  }

  // ── 인쇄 범위 + 인쇄 번호·장 번호 참조 다시 계산 ──
  const printed = () => scenes.filter((s) => !s.classList.contains('pf-skip'));
  function refUrl(id) {                                       // 인쇄 집합 밖 대상: 주소 글자
    let u = `${location.host}${location.pathname}${location.search}#s=${id}`;
    try { u = decodeURIComponent(u); } catch { /* 그대로 */ }
    return u.replace(/[?&](pf-[\w-]+|view|wheel)(=[^&#]*)?/g, '').replace(/\?(?=#|$)/, '').replace(/\.html&/, '.html?');
  }
  function renumberPrint() {
    const P = printed(), M = P.length;
    P.forEach((s, j) => s.querySelectorAll('.pf-foot .pf-n-print').forEach((e) => { e.textContent = `${j + 1} / ${M}`; }));
    scenes.filter((s) => s.classList.contains('pf-skip')).forEach((s) => s.querySelectorAll('.pf-foot .pf-n-print').forEach((e) => { e.textContent = ''; }));
    (deck || document).querySelectorAll('[data-pf-ref]').forEach((a) => {
      const t = document.getElementById(a.dataset.pfRef);
      const sc = t ? (t.classList.contains('pf-scene') ? t : t.closest('.pf-scene')) : null;
      const si = scenes.indexOf(sc), pj = P.indexOf(sc);
      const scr = a.querySelector('.pf-n-screen'), prn = a.querySelector('.pf-n-print');
      if (scr) scr.textContent = si >= 0 ? `p.${si + 1}` : '';
      if (prn) prn.textContent = pj >= 0 ? `p.${pj + 1}` : refUrl(a.dataset.pfRef);
    });
    hudSync();
  }
  function setScope(mode) {
    scope = mode === 'summary' ? 'summary' : 'all';
    scenes.forEach((s) => s.classList.toggle('pf-skip', scope === 'summary' && s.dataset.pfPart === 'doc'));
    renumberPrint();
  }

  // ── 주소(hash): #s=<장면 id>(공유 주소, 기본) · #<장면 id>(장면 안 링크·PDF 안 목적지) · #n(장 번호) · #s-n(A1 호환) ──
  function hashTarget(raw) {                                  // → 장면 번호(0부터) 또는 null
    let h = String(raw || '').replace(/^#/, '');
    try { h = decodeURIComponent(h); } catch { /* 그대로 */ }
    if (!h || !scenes.length) return null;
    if (/^-?\d+$/.test(h)) return Math.max(0, Math.min(scenes.length - 1, +h - 1));   // #0·#-3 → 1장, #99 → 마지막
    const id = h.startsWith('s=') ? h.slice(2) : h;
    const el = id && document.getElementById(id);
    const s = el && (el.classList.contains('pf-scene') ? el : el.closest('.pf-scene'));
    const j = s ? scenes.indexOf(s) : -1;
    if (j >= 0) return j;
    const m = /^s-(\d+)$/.exec(id);
    if (m) return Math.max(0, Math.min(scenes.length - 1, +m[1] - 1));
    return null;
  }
  const hashOf = (i) => { const s = scenes[i]; return s && !isAutoId(s.id) ? `#s=${encodeURIComponent(s.id)}` : `#${i + 1}`; };
  function setHash(i, push) {
    const h = hashOf(i);
    if (location.hash === h) return;
    const url = `${location.pathname}${location.search}${h}`;
    try { push ? history.pushState(null, '', url) : history.replaceState(history.state, '', url); } catch { /* file:// 등 */ }
  }
  function onHash() {                                         // 주소창에서 바꾸거나 뒤로·앞으로
    const j = hashTarget(location.hash);
    if (j == null) { setHash(cur, false); return; }           // 알 수 없는 hash → 지금 장면 주소로 바로잡음(주소 = 화면)
    go(j, { push: false });
  }
  function onAnchor(e) {                                      // 장면 안·목차의 #링크: 장면 이동 + 기록(같은 탭)
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || a.classList.contains('pf-skiplink')) return;
    if (!deck?.contains(a)) return;
    const j = hashTarget(a.getAttribute('href'));
    if (j == null) return;
    e.preventDefault();
    go(j, { push: true, focus: true });
  }

  // ── 이동 ──
  function sceneTop(s) {                                      // 한 번에 보기: scroll-padding 영역 가운데(안 들어가면 화면 가운데)
    const r = s.getBoundingClientRect(), vh = innerHeight, cs = getComputedStyle(root);
    const pt = parseFloat(cs.scrollPaddingTop) || 0, pb = parseFloat(cs.scrollPaddingBottom) || 0, avail = vh - pt - pb;
    const off = r.height <= avail ? pt + (avail - r.height) / 2 : Math.max(0, (vh - r.height) / 2);
    return scrollY + r.top - off;
  }
  const scrollToScene = (s, behavior = 'auto') => { if (s) scrollTo({ top: sceneTop(s), behavior }); };
  function paint() {                                          // 덱 보기: 지금 장면만 보이고(visibility), 나머지는 inert
    scenes.forEach((s, j) => {
      const on = view !== 'deck' || j === cur;
      s.classList.toggle('pf-cur', j === cur);
      if (s.inert === on) s.inert = !on;
    });
  }
  function go(i, { focus = 'auto', push = false, announce = true } = {}) {
    if (!scenes.length) return;
    i = Math.max(0, Math.min(scenes.length - 1, i));
    const prev = cur, s = scenes[i], ae = document.activeElement;
    const focusWasInDeck = !!(ae && deck.contains(ae)), focusOnBody = !ae || ae === document.body;
    cur = i;
    if (view === 'deck') {
      paint();
      if (prev !== i && !reduced()) { s.classList.remove('pf-enter'); void s.offsetWidth; s.classList.add('pf-enter'); }
    } else {
      scrollToScene(s, reduced() ? 'auto' : 'smooth');
    }
    setHash(i, push);
    hudSync();
    const moveFocus = focus === true || (focus === 'auto' && (focusWasInDeck || focusOnBody));
    if (moveFocus) s.focus({ preventScroll: true });
    else if (announce) say(i);
  }
  const editable = (t) => t.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  function scrollableX(t) { for (let n = t; n && n !== document.body; n = n.parentElement) { if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true; } return false; }
  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || editable(e.target) || document.querySelector('dialog[open]')) return;
    const k = e.key;
    if (k === 'Escape' && helpOpen()) { e.preventDefault(); return toggleHelp(false); }
    if (k === 'o' || k === 'O') { e.preventDefault(); return openOverview(); }
    if (k === 'f' || k === 'F') { e.preventDefault(); return toggleFull(); }
    if (k === 'Home') { e.preventDefault(); return go(0); }
    if (k === 'End') { e.preventDefault(); return go(scenes.length - 1); }
    let d = 0;
    if (k === 'PageDown' || (k === ' ' && !e.shiftKey)) d = 1;
    else if (k === 'PageUp' || (k === ' ' && e.shiftKey)) d = -1;
    else if ((k === 'ArrowRight' || k === 'ArrowLeft') && !scrollableX(e.target)) d = k === 'ArrowRight' ? 1 : -1;
    else if (view === 'deck' && (k === 'ArrowDown' || k === 'ArrowUp')) d = k === 'ArrowDown' ? 1 : -1;   // 한 번에 보기의 ↑↓는 브라우저 기본 스크롤
    if (!d) return;
    if (k === ' ' && e.target.closest?.('button, a, summary')) return;
    e.preventDefault(); go(cur + d);
  }
  // 포인터(마우스·터치)로 생긴 포커스는 장면을 옮기지 않음 → 한 번에 보기에서 링크 첫 클릭이 스크롤에 삼켜지던 결함 수정(deck-vs-scroll §3)
  let lastPointer = -1e9, lastPointerType = 'mouse';
  const onPointerDown = (e) => { lastPointer = performance.now(); lastPointerType = e.pointerType || 'mouse'; };
  function onFocus(e) {
    const s = e.target.closest?.('.pf-deck > .pf-scene'); if (!s) return;
    const i = scenes.indexOf(s);
    if (view === 'deck') { if (i >= 0 && i !== cur) go(i, { focus: false, announce: false }); return; }
    if (e.target === s) return;
    if (performance.now() - lastPointer < 800) {
      if (i >= 0 && i !== cur) { cur = i; setHash(cur, false); hudSync(); }
      return;
    }
    const r = s.getBoundingClientRect();
    if (r.top < -1 || r.bottom > innerHeight - HUD_H + 1) scrollToScene(s);
  }
  // 덱 보기에서 어떤 경로로든(앵커·찾기·포커스) 덱·장면 상자가 스크롤되면 되돌림
  function guardScroll(e) {
    if (view !== 'deck') return;
    const t = e.target;
    if (t === document || t === document.documentElement || t === document.body) { if (scrollX || scrollY) scrollTo(0, 0); return; }
    if (t.nodeType === 1 && deck && (t === deck || deck.contains(t)) && (t.scrollTop || t.scrollLeft)) { t.scrollTop = 0; t.scrollLeft = 0; }
  }

  // 덱 보기 클릭: 데스크톱(마우스)에서는 장면을 눌러도 넘기지 않음(글자 고르기·더블클릭 보호).
  //   넘기는 길 = HUD ‹ ›, 키보드, 휠, 레터박스(장면 바깥 가장자리) 클릭, 터치(탭 구역: 왼쪽 30% 이전 · 나머지 다음, 스와이프)
  let swallowClickUntil = 0, tch = null, lastTouch = null;
  const CONTROL = 'a, button, input, select, textarea, summary, label, video, audio, [contenteditable], [data-pf-noclick]';
  // 휴대폰 터치 보정: 손가락이 실제로 닿은 점이 링크·버튼 밖인데 브라우저가 가장 가까운 링크로 옮긴 탭(배율이 작은 목차 장면 등)이면 true.
  //   이때는 링크를 열지 않고 장면 탭(넘기기)으로 처리. 링크 위를 정확히 누른 탭, 손가락으로 확대한 상태, 키보드·스크립트 클릭(detail 0)은 그대로
  function retargetedTap(e, ctl, sc) {
    const t = lastTouch;
    if (!t || e.detail === 0 || lastPointerType !== 'touch' || performance.now() - t.time > 1500 || !sc.contains(ctl) || (window.visualViewport?.scale || 1) > 1.01) return false;
    return !(t.hit && (ctl.contains(t.hit) || t.hit.closest?.(CONTROL)));
  }
  function onDeckClick(e) {
    if (view !== 'deck' || e.button !== 0 || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (Date.now() < swallowClickUntil) return;
    const sc = scenes[cur]; if (!sc) return;
    const ctl = e.target.closest(CONTROL);
    let x = e.clientX;
    if (ctl) {
      if (!retargetedTap(e, ctl, sc)) return;
      e.preventDefault(); x = lastTouch.x;
    }
    const r = sc.getBoundingClientRect();
    if (e.target === deck) { go(cur + (e.clientX < (r.left + r.right) / 2 ? -1 : 1)); return; }   // 가장자리(레터박스)
    if (!sc.contains(e.target) || lastPointerType !== 'touch') return;
    if ((window.visualViewport?.scale || 1) > 1.01) return;   // 손가락으로 확대한 상태면 화면 이동에 맡김
    const sel = getSelection(); if (sel && !sel.isCollapsed && String(sel).trim()) return;
    go(cur + (x < r.left + r.width * 0.3 ? -1 : 1));
  }
  function onTouchStart(e) {
    if (e.touches.length === 1) { const p = e.touches[0]; lastTouch = { x: p.clientX, y: p.clientY, time: performance.now(), hit: document.elementFromPoint(p.clientX, p.clientY) }; } else lastTouch = null;
    if (view !== 'deck' || e.touches.length !== 1) { tch = null; return; }
    const t = e.touches[0]; tch = { x: t.clientX, y: t.clientY, t: Date.now() };
  }
  function onTouchEnd(e) {
    if (!tch || view !== 'deck') return;
    const t = e.changedTouches[0], dx = t.clientX - tch.x, dy = t.clientY - tch.y, dt = Date.now() - tch.t; tch = null;
    if ((window.visualViewport?.scale || 1) > 1.01 || dt >= 900) return;   // 확대 중이면 스와이프로 넘기지 않음(Q2: 확대 허용)
    const ax = Math.abs(dx), ay = Math.abs(dy);
    let d = 0;
    if (ax >= 50 && ax > 1.5 * ay) d = dx < 0 ? 1 : -1;                    // 가로: 왼쪽으로 밀면 다음
    else if (ay >= 60 && ay > 1.5 * ax) d = dy < 0 ? 1 : -1;               // 세로(폰 세로 화면): 위로 밀면 다음
    if (d) { swallowClickUntil = Date.now() + 450; go(cur + d); }
  }
  // 휠·트랙패드: 몸짓(200ms 이상 쉬면 끝) 하나에 한 장. 관성 스크롤도 한 몸짓으로 침. Ctrl+휠(확대)은 건드리지 않음
  let wAcc = 0, wLast = -1e9, wStepped = false;
  function onWheel(e) {
    if (!WHEEL || view !== 'deck' || e.ctrlKey || document.querySelector('dialog[open]') || e.target.closest?.('.pf-hud')) return;
    const now = performance.now();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    if (now - wLast > 200) { wAcc = 0; wStepped = false; }
    wLast = now;
    if (wStepped) return;
    wAcc += d;
    if (Math.abs(wAcc) >= 60) { wStepped = true; go(cur + (wAcc > 0 ? 1 : -1), { focus: false }); }
  }

  // 한 번에 보기: IO는 보이는 장면 집합만, 지금 장면은 실시간 상자로 고름(지금 장면이 여전히 가장 많이 보이면 유지)
  const visible = new Set();
  let holdPick = view === 'scroll';
  function pickCurrent() {
    if (view !== 'scroll' || holdPick) return;
    const vh = innerHeight - HUD_H, frac = (s) => { const r = s.getBoundingClientRect(); return { v: Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / (r.height || 1), d: Math.abs((r.top + r.bottom) / 2 - vh / 2) }; };
    let best = -1, bv = -1, bd = Infinity;
    visible.forEach((s) => { const i = scenes.indexOf(s); if (i < 0) return; const { v, d } = frac(s); if (v > bv + 1e-3 || (Math.abs(v - bv) <= 1e-3 && d < bd)) { best = i; bv = v; bd = d; } });
    if (best < 0 || best === cur) return;
    if (scenes[cur] && frac(scenes[cur]).v >= bv - 1e-3) return;
    cur = best; setHash(cur, false); hudSync();
  }
  let pickT = 0;
  const schedulePick = () => { if (view === 'scroll' && !pickT) pickT = setTimeout(() => { pickT = 0; pickCurrent(); }, 50); };
  function observe() {
    io?.disconnect(); visible.clear();
    if (view !== 'scroll') return;
    io = new IntersectionObserver((ents) => { ents.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))); pickCurrent(); },
      { threshold: [0, 0.25, 0.5, 0.75, 1] });
    scenes.forEach((s) => io.observe(s));
  }

  // ── 보기 전환(같은 DOM). 선택은 이 브라우저에 기억(레포 경로별) ──
  function setView(v, { remember = true } = {}) {
    v = v === 'scroll' ? 'scroll' : 'deck';
    if (remember) { try { localStorage.setItem(VIEW_KEY, v); } catch { /* 저장소 없음 */ } }
    if (v === view) return;
    view = v; root.dataset.view = v; holdPick = false;
    try { const u = new URL(location.href); u.searchParams.delete('view'); u.hash = hashOf(cur); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch { /* */ }
    fit(); paint(); observe();
    if (v === 'scroll') scrollToScene(scenes[cur]); else scrollTo(0, 0);
    hudSync();
    say(cur, v === 'deck' ? '슬라이드 보기로 바꿨습니다.' : '한 번에 보기로 바꿨습니다.');
  }
  function toggleFull() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen?.(); } catch { /* 지원 안 함 */ }
  }

  // ── 세로 화면 안내: 돌렸을 때 장면이 1.2배 이상 커지면 띄움(덱 보기만). 닫으면 이 탭에서는 다시 띄우지 않음 ──
  const HINT_KEY = 'pf-rotate-closed';
  try { hintClosed = sessionStorage.getItem(HINT_KEY) === '1'; } catch { /* */ }
  function buildHint() {
    hint = document.createElement('div');
    hint.className = 'pf-rotate pf-screen-only'; hint.dataset.pfUi = 'rotate'; hint.hidden = true;
    hint.setAttribute('role', 'note');
    hint.innerHTML = `<span class="tx">가로로 돌리면 더 크게 보입니다.${opts.hint ? ' ' + opts.hint : ''}</span><button type="button" aria-label="안내 닫기">✕</button>`;
    hint.querySelector('button').addEventListener('click', () => { hintClosed = true; hint.hidden = true; try { sessionStorage.setItem(HINT_KEY, '1'); } catch { /* */ } });
    deck.before(hint);
  }
  function rotateHint() {
    if (!hint) return;
    const vw = root.clientWidth, vh = innerHeight;
    const kNow = Math.min(vw / W, (vh - HUD_H) / H), kRot = Math.min(vh / W, (vw - HUD_H) / H);
    hint.hidden = !(view === 'deck' && vh > vw && kRot > kNow * 1.2 && !hintClosed);
  }

  // ── HUD(아래 44px 띠: 이전·다음, "03 / 12", 섹션명, 진행 막대, 새 탭 안내, 개요, PDF로 저장 + ?, 보기 전환) ──
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  let live = null;
  function say(i, pre = '') {
    if (!live) return;
    const s = scenes[i]; if (!s) return;
    const t = titleOf(s);
    live.textContent = `${pre ? pre + ' ' : ''}슬라이드 ${i + 1} / ${scenes.length}${s.dataset.sec ? ', ' + s.dataset.sec : ''}${t && t !== s.dataset.sec ? ', ' + t : ''}`;
  }
  const HELP = `<p><b>PDF로 저장하기 — Windows PC의 Chrome·Edge에서 저장하세요</b></p>
    <ol><li><b>배포된 주소</b>(github.io)에서 화면이 다 나타난 뒤 <b>[PDF로 저장]</b>을 누릅니다(Ctrl+P도 됩니다).</li>
    <li><b>대상</b>에서 <b>"PDF로 저장"</b>을 고릅니다. "Microsoft Print to PDF"·프린터가 골라져 있으면 A4로 바뀌고 날짜·주소가 찍힙니다.</li>
    <li><b>여백</b>은 <b>기본</b> 그대로 둡니다. Edge는 <b>시트당 페이지 수</b>도 1 그대로 둡니다. 용지 크기·배율 항목이 보이지 않는 것이 정상입니다.</li>
    <li>미리보기의 쪽 수가 버튼에 적힌 쪽 수와 같으면 저장합니다.</li></ol>
    <p>Mac, 휴대폰·태블릿, Safari·Firefox는 지원 범위 밖입니다.</p>
    ${isLocal ? '<p class="warn">지금은 미리보기(로컬 서버)입니다. 여기서 저장한 PDF의 링크는 이 컴퓨터 주소를 가리키므로, 제출용은 배포된 주소에서 저장하세요.</p>' : ''}`;
  const helpOpen = () => !!hud && !hud.querySelector('.pf-hud-help').hidden;
  function toggleHelp(on) {
    if (!hud) return;
    const box = hud.querySelector('.pf-hud-help'), b = hud.querySelector('[data-a=help]');
    on = on ?? box.hidden;
    box.hidden = !on; b.setAttribute('aria-expanded', String(on));
  }
  function buildHud() {
    const skip = document.createElement('a');
    skip.className = 'pf-skiplink pf-screen-only'; skip.href = '#deck'; skip.textContent = '본문으로 건너뛰기';
    skip.addEventListener('click', (e) => { e.preventDefault(); const s = scenes[cur]; if (!s) return; if (view === 'scroll') scrollToScene(s); s.focus({ preventScroll: true }); });
    hud = document.createElement('nav');
    hud.className = 'pf-hud pf-screen-only'; hud.setAttribute('aria-label', '슬라이드 조작'); hud.dataset.pfUi = 'hud';
    const hasDoc = scenes.some((s) => s.dataset.pfPart === 'doc');
    hud.innerHTML = `<button type="button" data-a="prev" aria-label="이전 슬라이드" title="이전 (←)">‹</button>
      <button type="button" data-a="next" aria-label="다음 슬라이드" title="다음 (→, Space, 휠)">›</button>
      <span class="pf-hud-count" aria-hidden="true"></span>
      <span class="pf-hud-sec" aria-hidden="true"></span>
      <span class="pf-hud-prog" aria-hidden="true"><span></span></span>
      <span class="pf-hud-note">링크는 새 탭에서 열립니다</span>
      <button type="button" data-a="overview" aria-haspopup="dialog" title="모든 슬라이드 보기 (O)"><span aria-hidden="true">▦</span> <span class="l">개요</span></button>
      ${opts.scope && hasDoc ? '<button type="button" data-a="scope" aria-pressed="false" title="PDF에서 부록 빼기"><span class="l">요약만</span><span class="s">요약</span></button>' : ''}
      <button type="button" data-a="print" class="pf-print"><span class="l">PDF로 저장</span><span class="s">PDF</span><small></small></button>
      <button type="button" data-a="help" aria-expanded="false" aria-controls="pf-hud-help" aria-label="PDF 저장 안내" title="PDF 저장 안내">?</button>
      <button type="button" data-a="view"><span class="l"></span><span class="s"></span></button>
      <button type="button" data-a="anyway" hidden>그래도 인쇄</button>
      ${isLocal ? '<span class="pf-hud-badge" hidden title="미리보기에서만 보이는 장면 배치 점검 결과(찾은 항목 수). 배포된 페이지·PDF에는 나오지 않습니다. 슬라이드에 &quot;내용이 잘렸습니다&quot; 띠가 있으면 src/의 그 부분을 줄이고 /portfolio-build를 다시 실행하세요."></span>' : ''}
      <span class="pf-hud-msg" role="status" aria-live="polite"></span>
      <div class="pf-hud-help" id="pf-hud-help" hidden>${HELP}</div>
      <span class="pf-sr" aria-live="polite" aria-atomic="true"></span>`;
    live = hud.querySelector('.pf-sr');
    hud.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
      const a = b.dataset.a;
      if (a === 'prev') go(cur - 1, { focus: false }); else if (a === 'next') go(cur + 1, { focus: false });
      else if (a === 'overview') openOverview();
      else if (a === 'scope') setScope(scope === 'summary' ? 'all' : 'summary');
      else if (a === 'print') print();
      else if (a === 'help') toggleHelp();
      else if (a === 'view') setView(view === 'deck' ? 'scroll' : 'deck');
      else if (a === 'anyway') PF.printAnyway();
    });
    deck.before(skip, hud);                                   // DOM 순서: 건너뛰기 → HUD → 덱
  }
  let msg = '';
  function hudSync() {
    if (!hud) return;
    const N = scenes.length, s = scenes[cur];
    hud.querySelector('.pf-hud-count').textContent = `${pad2(cur + 1)} / ${pad2(N)}`;
    hud.querySelector('.pf-hud-sec').textContent = s?.dataset.sec || '';
    hud.querySelector('.pf-hud-prog > span').style.width = `${N ? ((cur + 1) / N) * 100 : 0}%`;
    hud.querySelector('[data-a=prev]').setAttribute('aria-disabled', String(cur <= 0));
    hud.querySelector('[data-a=next]').setAttribute('aria-disabled', String(cur >= N - 1));
    const vb = hud.querySelector('[data-a=view]');
    vb.querySelector('.l').textContent = view === 'deck' ? '한 번에 보기' : '슬라이드로 보기';
    vb.querySelector('.s').textContent = view === 'deck' ? '전체' : '슬라이드';
    vb.title = view === 'deck' ? '모든 슬라이드를 세로로 이어서 보기(찾기 Ctrl+F가 모든 장에 닿음)' : '한 번에 한 장씩 보기';
    const sc = hud.querySelector('[data-a=scope]');
    if (sc) sc.setAttribute('aria-pressed', String(scope === 'summary'));
    hud.querySelector('.pf-print small').textContent = `${printed().length}쪽`;
    const r = root.dataset.pfReady;
    hud.querySelector('[data-a=anyway]').hidden = r !== 'timeout';
    const imgs = deck ? [...deck.querySelectorAll('img')] : [];
    hud.querySelector('.pf-hud-msg').textContent = r === 'timeout' ? `아직 다 그리지 못했습니다(이미지 ${imgs.filter((i) => i.complete).length}/${imgs.length})` : msg;
  }
  function badge() {
    const b = hud?.querySelector('.pf-hud-badge'); if (!b) return;
    const n = audit().length; b.textContent = String(n); b.hidden = n === 0;
    b.setAttribute('aria-label', `미리보기 배치 점검 ${n}건`);
  }

  // ── 개요(모든 슬라이드 격자, dialog) ──
  function ovScale() {
    const t = ov.querySelector('.pf-ov-thumb'); if (!t) return;
    ov.style.setProperty('--ov-k', String(t.clientWidth / W));
  }
  function buildOverview() {
    ov = document.createElement('dialog');
    ov.className = 'pf-ov'; ov.setAttribute('aria-labelledby', 'pf-ov-h'); ov.dataset.pfUi = 'overview';
    ov.innerHTML = `<div class="pf-ov-head"><h2 id="pf-ov-h">슬라이드 개요 <small></small></h2><p class="pf-ov-hint">화살표로 고르고 Enter · 닫기 Esc</p><button type="button" class="pf-ov-close" aria-label="개요 닫기">✕</button></div><div class="pf-ov-grid"></div>`;
    ov.querySelector('.pf-ov-close').addEventListener('click', () => ov.close());
    ov.addEventListener('click', (e) => {
      if (e.target === ov) { ov.close(); return; }
      const b = e.target.closest('.pf-ov-item'); if (!b) return;
      ov.close(); go(+b.dataset.i, { push: true, focus: true });
    });
    ov.addEventListener('keydown', ovKey);
    ov.addEventListener('close', () => { ovReturn?.focus?.({ preventScroll: true }); });
    document.body.appendChild(ov);
  }
  function fillOverview() {
    const grid = ov.querySelector('.pf-ov-grid');
    const frag = document.createDocumentFragment();
    let last = null;
    scenes.forEach((s, i) => {
      const sec = s.dataset.sec || '';
      const group = s.dataset.group || sec.split(' · ')[0];
      if (group !== last) { const h = document.createElement('p'); h.className = 'pf-ov-sec'; h.textContent = group; frag.appendChild(h); last = group; }
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pf-ov-item'; b.dataset.i = String(i);
      const t = titleOf(s);
      b.setAttribute('aria-label', `${i + 1}. ${sec}${t && t !== sec ? ' — ' + t : ''}`);
      const c = s.cloneNode(true);                            // 축소 미리보기(같은 DOM 복제). id는 지움
      c.removeAttribute('id'); c.removeAttribute('tabindex'); c.removeAttribute('role'); c.removeAttribute('aria-label'); c.removeAttribute('aria-roledescription');
      c.inert = true; c.setAttribute('aria-hidden', 'true');
      c.classList.remove('pf-cur', 'pf-enter', 'pf-skip'); c.classList.add('pf-thumb-scene');
      c.querySelectorAll('[id]').forEach((e) => { if (!e.closest('svg')) e.removeAttribute('id'); });
      c.querySelectorAll('[data-pf-ref]').forEach((e) => e.removeAttribute('data-pf-ref'));
      c.querySelectorAll('img').forEach((im) => { im.loading = 'lazy'; });
      const th = document.createElement('span'); th.className = 'pf-ov-thumb'; th.appendChild(c);
      const cap = document.createElement('span'); cap.className = 'pf-ov-cap'; cap.innerHTML = `<b>${pad2(i + 1)}</b><span></span>`;
      cap.querySelector('span').textContent = t || sec;
      b.append(th, cap);
      frag.appendChild(b);
    });
    grid.replaceChildren(frag);
    ov.querySelector('h2 small').textContent = `${scenes.length}장`;
    ovBuilt = true;
  }
  let ovReturn = null;
  function openOverview() {
    if (!deck || !scenes.length) return;
    toggleHelp(false);
    if (!ov) buildOverview();
    if (!ovBuilt) fillOverview();
    if (ov.open) return;
    ovReturn = document.activeElement && document.activeElement !== document.body ? document.activeElement : hud?.querySelector('[data-a=overview]');
    ov.querySelectorAll('.pf-ov-item').forEach((b) => b.setAttribute('aria-current', String(+b.dataset.i === cur)));
    ov.showModal();
    ovScale();
    const b = ov.querySelector(`.pf-ov-item[data-i="${cur}"]`);
    if (b) { b.focus({ preventScroll: true }); b.scrollIntoView({ block: 'center' }); }
  }
  function ovKey(e) {
    const items = [...ov.querySelectorAll('.pf-ov-item')];
    const i = items.indexOf(document.activeElement); if (i < 0) return;
    const r = items[i].getBoundingClientRect(), cx = r.left + r.width / 2;
    let t = null;
    if (e.key === 'ArrowRight') t = items[i + 1];
    else if (e.key === 'ArrowLeft') t = items[i - 1];
    else if (e.key === 'Home') t = items[0];
    else if (e.key === 'End') t = items[items.length - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const down = e.key === 'ArrowDown';
      const rows = items.map((b) => ({ b, r: b.getBoundingClientRect() })).filter(({ r: q }) => (down ? q.top > r.top + 4 : q.top < r.top - 4));
      if (rows.length) {
        const rowTop = down ? Math.min(...rows.map((x) => x.r.top)) : Math.max(...rows.map((x) => x.r.top));
        t = rows.filter((x) => Math.abs(x.r.top - rowTop) < 4).sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx))[0]?.b;
      }
    } else return;
    e.preventDefault();
    if (t) { t.focus({ preventScroll: true }); t.scrollIntoView({ block: 'nearest' }); }
  }
  const closeOverview = () => { if (ov?.open) ov.close(); };

  // ── [PDF로 저장]: 준비 게이트 yes를 기다린 뒤 print(). mount 전에 불려도 예외 없이 기다림 ──
  async function print() {
    toggleHelp(false);
    const lazy = [...document.querySelectorAll('img[loading="lazy"]')].filter((i) => !i.complete && !i.closest('.pf-ov'));
    if (lazy.length) {
      lazy.forEach((i) => { i.loading = 'eager'; });
      PF.track(Promise.all(lazy.map((i) => new Promise((r) => { if (i.complete) r(); else { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); } }))));
    }
    if (root.dataset.pfReady !== 'yes') {
      const imgs = [...(deck || document).querySelectorAll('img')];
      const tickMsg = () => {                                          // 그림을 다 받았는데 다른 일(글꼴·다시 채우기)로 기다리는 중이면 "준비 중"
        const n = imgs.filter((i) => i.complete).length;
        msg = n < imgs.length ? `이미지 ${n}/${imgs.length} 불러오는 중` : '인쇄 준비 중…'; hudSync();
      };
      tickMsg(); const iv = setInterval(tickMsg, 300);
      await whenReady(); clearInterval(iv); msg = ''; hudSync();
    }
    closeOverview();
    window.print();
  }

  // ── 감사(장면 단위 + 덱 밖). 배율과 무관하게 동작(허용오차 0.5 논리 px × 배율) — R0·spikes/deck 그대로 ──
  const desc = (e) => `<${e.tagName.toLowerCase()}${e.getAttribute('class') ? '.' + String(e.getAttribute('class')).trim().split(/\s+/)[0] : ''}>`;
  function sceneIssues(s, { layoutOnly = false } = {}) {
    const out = [];
    const add = (type, detail) => out.push({ type, detail });
    if (s.offsetWidth !== W || s.offsetHeight !== H) add('box', `장면 상자 ${s.offsetWidth}×${s.offsetHeight}`);
    const cs = getComputedStyle(s);
    if (!/hidden|clip/.test(cs.overflowX + cs.overflowY)) add('overflow-visible', '장면 overflow가 visible');
    if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1) add('scene-scroll', `장면 넘침 ${s.scrollWidth}×${s.scrollHeight}`);
    const sr = s.getBoundingClientRect();
    const k = sr.width / W || 1, tol = 0.5 * k;
    const body = s.querySelector(':scope > .pf-body');
    const offStage = view === 'deck' && !isPrint() && s.parentElement === deck && !s.classList.contains('pf-cur');
    const br = body ? body.getBoundingClientRect() : sr;
    if (body && (body.scrollHeight > body.clientHeight || body.scrollWidth > body.clientWidth))
      add('body-scroll', `본문 넘침 ${body.scrollWidth}×${body.scrollHeight} > ${body.clientWidth}×${body.clientHeight}`);
    const head = s.querySelector(':scope > .pf-head');
    if (head && body) { const hb = head.getBoundingClientRect().bottom; if (hb > br.top + tol) add('head-overlap', `머리(제목)가 본문과 겹침 ${((hb - br.top) / k).toFixed(1)}px`); }
    const clipAnc = (e, stop) => { for (let a = e.parentElement; a && a !== stop; a = a.parentElement) { const c = getComputedStyle(a); if (c.overflowX !== 'visible' || c.overflowY !== 'visible') return true; } return false; };
    s.querySelectorAll('*').forEach((e) => {
      if (e.closest('[data-pf-bleed], [data-pf-allow-clip], .pf-sr-only')) return;   // .pf-sr-only: 화면 낭독기 전용 글자(일부러 1px로 자름)
      const tag = e.tagName.toLowerCase();
      if (e.closest('svg') && tag !== 'svg') return;
      const ecs = getComputedStyle(e);
      if (ecs.display === 'none') return;
      if (ecs.position === 'fixed' || ecs.position === 'sticky') add('position', `${desc(e)} position:${ecs.position}`);
      if (e !== body && /auto|scroll|hidden|clip/.test(ecs.overflowX + ecs.overflowY) && !/^(img|svg|video|canvas)$/.test(tag) &&
          (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1))
        add('inner-scroll', `${desc(e)} 안쪽 넘침 ${e.scrollWidth}×${e.scrollHeight} > ${e.clientWidth}×${e.clientHeight}`);
      if (!layoutOnly && /url\(/.test(ecs.backgroundImage)) add('bg-image', `${desc(e)} CSS background-image`);
      const r = e.getBoundingClientRect();
      if (r.width || r.height) {
        const inBody = body && body.contains(e);
        if (!clipAnc(e, inBody ? body : s)) {
          const b = inBody ? br : sr;
          const over = Math.max(b.left - r.left, b.top - r.top, r.right - b.right, r.bottom - b.bottom);
          if (over > tol) add('outside', `${desc(e)} ${inBody ? '본문' : '장면'} 상자 밖 ${(over / k).toFixed(1)}px`);
        }
      }
      if (!layoutOnly && !e.closest('[data-pf-allow-hidden]')) {
        const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) || tag === 'img';
        if (hasText && ((ecs.visibility === 'hidden' && !offStage) || parseFloat(ecs.opacity) < 0.05)) add('hidden', `${desc(e)} ${ecs.visibility === 'hidden' ? 'visibility:hidden' : 'opacity ' + ecs.opacity}`);
      }
    });
    if (!layoutOnly) {
      s.querySelectorAll('img').forEach((i) => {
        if (!i.complete) add(i.loading === 'lazy' ? 'img-lazy' : 'img-pending', i.getAttribute('src'));
        else if (!i.naturalWidth) add('img-broken', i.getAttribute('src'));
      });
      s.querySelectorAll('.pf-clipped').forEach((c) => add('clipped', c.textContent.trim().slice(0, 80)));
    }
    return out;
  }
  // 【R0 결정 #14】 화면 매체 감사 "덱 밖에 보이는 요소"(outside-deck). 인쇄 CSS가 덱 밖·덱 안 비장면 요소를 PDF에서 빼므로, 화면에 보이는 그런 내용을 대신 알림
  const OD_TAGS = /^(script|style|link|meta|template|noscript|head|title|base)$/i;
  const OD_EXEMPT = '[data-pf-ui], .pf-screen-only, .pf-hud, .pf-skiplink, #pf-audit, .pf-measure, dialog.lightbox, .pf-lightbox';
  const OD_REPLACED = /^(img|svg|canvas|video|iframe|object|embed|input|textarea|select|button|progress|meter|hr|picture|audio|math)$/i;
  const OD_GATE = '아직 페이지를 그리는 중입니다';
  const descFull = (e) => { if (!e || e.nodeType !== 1) return '#text'; const c = String(e.getAttribute('class') || '').trim(); return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${c ? '.' + c.split(/\s+/).slice(0, 3).join('.') : ''}`; };
  const textOf = (n) => String(n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const alphaOf = (c) => { if (!c || c === 'transparent') return 0; let m = c.match(/\/\s*([\d.]+)(%?)\s*\)$/); if (m) return m[2] ? +m[1] / 100 : +m[1];
    m = c.match(/^rgba\(([^)]+)\)$/); return m ? parseFloat(m[1].split(',')[3]) : 1; };
  function odExempt(e) {
    if (OD_TAGS.test(e.tagName) || e.closest(OD_EXEMPT)) return true;
    if (e.tagName === 'DIALOG' && !e.open) return true;
    if (e.hasAttribute('popover')) { try { if (!e.matches(':popover-open')) return true; } catch { return true; } }
    return false;
  }
  const odVis = (e) => (e.checkVisibility ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : e.getClientRects().length > 0);
  const odRects = (list) => [...list].filter((r) => r.width > 0.5 && r.height > 0.5 && r.right + scrollX > 0 && r.bottom + scrollY > 0);
  function odClipped(e, cs) {
    if (/^(absolute|fixed)$/.test(cs.position) && /rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)/.test(cs.clip)) return true;
    if (/^inset\(\s*50%/.test(cs.clipPath) || /^circle\(\s*0(px)?\s/.test(cs.clipPath)) return true;
    if (cs.overflowX !== 'visible' && cs.overflowY !== 'visible') { const r = e.getBoundingClientRect(); if (r.width <= 1 && r.height <= 1) return true; }
    return false;
  }
  function odPaints(e, cs) {
    if (OD_REPLACED.test(e.tagName)) return e.tagName.toLowerCase();
    if (cs.backgroundImage !== 'none') return '배경 그림';
    if (alphaOf(cs.backgroundColor) > 0) return '배경색';
    for (const s of ['Top', 'Right', 'Bottom', 'Left'])
      if (parseFloat(cs[`border${s}Width`]) > 0 && !/none|hidden/.test(cs[`border${s}Style`]) && alphaOf(cs[`border${s}Color`]) > 0) return '테두리';
    if (cs.boxShadow !== 'none') return '그림자';
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && alphaOf(cs.outlineColor) > 0) return '외곽선';
    return '';
  }
  function odPseudo(e) {
    for (const p of ['::before', '::after']) {
      const c = getComputedStyle(e, p), ct = c.content;
      if (!ct || ct === 'none' || ct === 'normal' || ct === '""' || ct === "''" || ct.includes(OD_GATE)) continue;
      if (c.display === 'none' || c.visibility !== 'visible' || parseFloat(c.opacity) === 0) continue;
      if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true })) continue;
      return { el: e, why: p, text: ct.replace(/^["']|["']$/g, '').slice(0, 40) };
    }
    return null;
  }
  function odText(t) {
    const s = t.data.replace(/\s+/g, ' ').trim(); if (!s) return null;
    const p = t.parentElement; if (!p || odExempt(p) || !odVis(p)) return null;
    const rg = document.createRange(); rg.selectNodeContents(t);
    return odRects(rg.getClientRects()).length ? { el: p, why: '글자', text: s.slice(0, 40) } : null;
  }
  function odFind(n) {
    if (n.nodeType === 3) return odText(n);
    if (n.nodeType !== 1 || odExempt(n)) return null;
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || parseFloat(cs.opacity) === 0 || odClipped(n, cs)) return null;
    if (cs.display !== 'contents' && odVis(n) && odRects(n.getClientRects()).length) { const why = odPaints(n, cs); if (why) return { el: n, why, text: textOf(n) }; }
    if (OD_REPLACED.test(n.tagName)) return null;
    for (const c of n.childNodes) { const r = odFind(c); if (r) return r; }
    return odPseudo(n);
  }
  function outsideDeck() {
    const out = [];
    if (!deck || !deck.isConnected) return out;
    const wraps = new Set();
    deck.querySelectorAll('.pf-scene').forEach((s) => { const ch = [];
      for (let a = s.parentElement; a && a !== deck; a = a.parentElement) { if (a.classList.contains('pf-scene')) return; ch.push(a); }
      ch.forEach((a) => wraps.add(a)); });
    const isWrap = (e) => wraps.has(e);
    const conts = [];
    for (let a = deck.parentElement; a; a = a.parentElement) conts.push(a);
    conts.push(deck, ...wraps);
    const where = (n) => { if (deck.contains(n)) return '덱 안'; return (deck.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_PRECEDING) ? '덱 앞' : '덱 뒤'; };
    for (const c of conts) {
      const inDeck = c === deck || deck.contains(c);
      for (const n of c.childNodes) {
        if (n.nodeType === 1 && (n === deck || n.contains(deck))) continue;
        if (inDeck && n.nodeType === 1 && (n.classList.contains('pf-scene') || isWrap(n))) continue;
        const hit = odFind(n);
        if (!hit) continue;
        const el = n.nodeType === 1 ? descFull(n) : `#text(${descFull(c)} 바로 아래)`;
        const sub = hit.el !== n ? ` → ${descFull(hit.el)}` : '';
        out.push({ scene: null, type: 'outside-deck', el, text: textOf(n) || hit.text, why: hit.why, pos: where(n),
                   detail: `<${el}> ${where(n)}에 보임(${hit.why}${sub}) "${textOf(n) || hit.text}"` });
      }
      if (c === document.documentElement) continue;
      const ps = odPseudo(c);
      if (ps) out.push({ scene: null, type: 'outside-deck', el: `${descFull(c)}${ps.why}`, text: ps.text, why: ps.why, pos: inDeck ? '덱 안' : '덱 조상',
                         detail: `<${descFull(c)}>${ps.why} 생성 글자가 보임 "${ps.text}"` });
    }
    return out;
  }
  function audit() {
    const out = [];
    if (!deck) return [{ scene: null, type: 'no-deck', detail: 'mount 전' }];
    [...deck.children].forEach((e) => { if (!e.classList.contains('pf-scene')) out.push({ scene: null, type: 'foreign', detail: `${desc(e)} 장면 사이 이물질` }); });
    scenes.forEach((s, i) => { if (isPrint() && s.classList.contains('pf-skip')) return; sceneIssues(s).forEach((x) => out.push({ scene: i + 1, ...x })); });
    document.querySelectorAll('dialog[open]').forEach((d) => out.push({ scene: null, type: 'dialog', detail: `${desc(d)} 열린 dialog` }));
    if (!isPrint()) out.push(...outsideDeck());               // 화면 매체에서만
    return out;
  }
  function report() {
    const a = audit();
    return { ready: root.dataset.pfReady, scenes: scenes.length, printScenes: printed().length, scope, view, cur: cur + 1, wheel: WHEEL,
             ids: scenes.map((s) => s.id), audit: a, clipped: a.filter((x) => x.type === 'clipped').length,
             outsideDeck: a.filter((x) => x.type === 'outside-deck').length,
             media: isPrint() ? 'print' : 'screen', timing: { ...T }, eager: PF._eager, k: K, info: PF.info || null };
  }
  function writeAudit() {
    let pre = document.getElementById('pf-audit');
    if (!pre) { pre = document.createElement('pre'); pre.id = 'pf-audit'; pre.hidden = true; document.body.appendChild(pre); }
    const bytes = new TextEncoder().encode(JSON.stringify(report()));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    pre.textContent = btoa(bin);
  }

  // ── mount: 데이터 렌더 후 한 번. 다시 그린 뒤에는 refresh() ──
  function onResize() { fit(); if (view === 'scroll') scrollToScene(scenes[cur]); }
  function mount(o = {}) {
    opts = Object.assign({ deck: '#deck', hud: true, scope: false, hint: '' }, o);
    deck = typeof opts.deck === 'string' ? document.querySelector(opts.deck) : opts.deck;
    deck.setAttribute('aria-roledescription', '슬라이드 덱');
    if (!deck.hasAttribute('aria-label')) deck.setAttribute('aria-label', document.title);
    document.querySelectorAll('[data-pf-loading]').forEach((e) => e.remove());
    collect();
    if (opts.hud && !hud) buildHud();
    if (!hint) buildHint();
    const j = location.hash ? hashTarget(location.hash) : null;   // 처음 열 때 #s=…·#n(없거나 모르면 1장)
    cur = j ?? 0;
    fit(); paint(); observe();
    setHash(cur, false);
    if (!mountedOnce) {
      mountedOnce = true;
      T.mount = performance.now();
      addEventListener('resize', onResize);
      document.addEventListener('fullscreenchange', onResize);
      addEventListener('keydown', onKey);
      addEventListener('hashchange', onHash);
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('focusin', onFocus);
      document.addEventListener('click', onAnchor);
      document.addEventListener('scroll', guardScroll, true);
      addEventListener('scroll', schedulePick, { passive: true });
      deck.addEventListener('click', onDeckClick);
      deck.addEventListener('touchstart', onTouchStart, { passive: true });
      deck.addEventListener('touchend', onTouchEnd, { passive: true });
      addEventListener('wheel', onWheel, { passive: true });
      if (view === 'scroll') scrollToScene(scenes[cur]);
      whenReady().then(() => { if (view === 'scroll') scrollToScene(scenes[cur]); holdPick = false; if (isLocal) badge(); });
      PF._mounted();
    }
    hudSync();
    return PF;
  }
  function refresh() {
    const keep = scenes[cur]?.id;
    collect(); setScope(scope);
    const j = keep ? scenes.findIndex((s) => s.id === keep) : -1;
    if (j >= 0) cur = j; else cur = Math.min(cur, scenes.length - 1);
    paint(); observe(); ovBuilt = false; hudSync(); setHash(cur, false);
    if (isLocal && root.dataset.pfReady === 'yes') badge();
  }

  Object.assign(PF, { mount, refresh, whenReady, go, print, setScope, setView, openOverview, closeOverview, audit, sceneIssues, report, refUrl, fit, hashTarget });
  Object.defineProperty(PF, 'k', { get() { return K; }, configurable: true });
  Object.defineProperty(PF, 'count', { get() { return scenes.length; }, configurable: true });
  Object.defineProperty(PF, 'scope', { get() { return scope; }, configurable: true });
  Object.defineProperty(PF, 'view', { get() { return view; }, configurable: true });
  Object.defineProperty(PF, 'cur', { get() { return cur; }, configurable: true });
  Object.defineProperty(PF, 'wheel', { get() { return WHEEL; }, configurable: true });
})();
