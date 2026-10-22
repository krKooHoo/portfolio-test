// ════════════════════════════════════════════════════════════════════════════
// R0 시험대 장면 키트 JS (spikes/r0/kit/scene-kit.js) — <head>에서 동기 로드, 가장 먼저
//   블록 A: 01 §8-2 준비 게이트 원문. 바꾼 곳은 【시험대】 주석 5곳뿐입니다(【시험대 4·5】는 A4가 고침).
//   블록 B: 키트 본체 — §7-2 fit(단일 모드), §7-1 transform(형제 + 여백 보정은 CSS), §9-3 API
//           (mount·whenReady·go·print·setScope·audit·renderMermaid), §8-4 인쇄 범위·번호 다시 계산,
//           §7-3 HUD 최소판, §7-4 키보드·딥 링크·포커스, ?pf-audit=1.
//           【R0 결정 #14】 audit()에 화면 매체 감사 "outside-deck"(덱 밖에 보이는 요소) 추가, report().outsideDeck = 그 수.
// 시험 훅(쿼리): ?pf-timeout=<ms> 게이트 timeout(기본 20000) · ?pf-k=<수> 배율 고정 · ?pf-scale=zoom|hybrid(A2용)
//               ?pf-scope=summary 처음부터 "요약만" · ?pf-audit=1 감사 JSON(base64)을 <pre id="pf-audit">에
// ════════════════════════════════════════════════════════════════════════════

// ── 블록 A: 01 §8-2 원문 ───────────────────────────────────────────────────
// 로드 즉시 data-pf-ready="no". 비동기 작업은 PFScene.track(promise)로 등록합니다.
//   "no" = 그리는 중(인쇄하면 안내 한 쪽) | "yes" = 인쇄 가능
//   "timeout" = 20초가 지났는데 아직 그리는 중(인쇄하면 여전히 안내 한 쪽, HUD 경고 + [그래도 인쇄]. 끝나면 "yes"로 회복. 하네스는 실패)
(() => {
  const root = document.documentElement, jobs = [];
  let gen = 0, t, mounted, isMounted = false;                          // 【시험대 5】 isMounted
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
    if (EAGER) document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    await Promise.all([...document.querySelectorAll('img:not([loading="lazy"])')].map(loaded));
    if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
    await tick();
    if (my === gen) root.dataset.pfReady = 'yes';                       // timeout 뒤에 끝나도 반드시 회복
  }
  const schedule = () => { clearTimeout(t); t = setTimeout(settle, 0); };
  // mount()가 한 번 불릴 때까지 게이트를 닫아 둠: fetch만 track하고 React commit·mount 전에 "yes"가 되는 경쟁을 막음
  jobs.push(new Promise((r) => { mounted = r; }));
  addEventListener('load', schedule);
  addEventListener('beforeprint', () => {                               // 폰·데이터 절약(lazy 유지)에서 인쇄할 때
    if (root.hasAttribute('data-pf-print-anyway')) return;              // 【시험대 4】 [그래도 인쇄]는 지금 상태 그대로(A4 발견)
    const pending = [...document.images].filter((i) => !i.complete);    // 아직 안 받은 lazy 이미지 포함
    if (pending.length) { if (root.dataset.pfReady === 'yes') root.dataset.pfReady = 'no';   // 이번 인쇄는 안내 한 쪽. 【시험대 4】 timeout은 그대로 둠
      document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
      schedule(); }                                                     // 다음 인쇄를 위해 받기 시작
  });
  // 【시험대 4】 A4 발견: 원문은 pending이 있으면 무조건 'no'로 바꿔 ① timeout을 'no'로 끌어내려 HUD 경고·[그래도 인쇄]가 사라지고
  //   ② [그래도 인쇄]의 인쇄도 'no' 규칙(예외 없음)에 걸려 안내 한 쪽이 됐음(느린 이미지 = timeout의 대표 경우라 항상 재현).
  //   그래서 print-anyway면 건너뛰고, 'yes'일 때만 'no'로 내림. timeout에서는 인쇄 CSS가 이미 덱을 숨기므로 안내 한 쪽은 그대로임
  addEventListener('afterprint', () => { delete root.dataset.pfPrintAnyway; });
  // 【시험대 1】 20000 → ?pf-timeout=<ms>(T7·A4 시험을 빨리 돌리기 위한 훅). 기본값은 원문과 같은 20000
  const TIMEOUT = +(new URLSearchParams(location.search).get('pf-timeout') || 20000);
  setTimeout(() => { if (root.dataset.pfReady === 'no') root.dataset.pfReady = 'timeout'; }, TIMEOUT);
  // 【시험대 2】 원문은 Object.assign(…, { get ready() {…} })이었음. Object.assign은 getter를 "실행한 값"('no')을 복사하므로
  //   PFScene.ready가 영원히 'no'로 고정되는 버그 → defineProperty로 getter를 그대로 붙임(R0 발견, README·보고서 참고)
  window.PFScene = Object.assign(window.PFScene || {}, {
    track(p) { jobs.push(Promise.resolve(p).catch((e) => console.warn('[pf-scene] 작업 실패:', e))); schedule(); return p; },
    _mounted() { isMounted = true; mounted(); schedule(); },            // mount() 안에서 한 번 호출
    printAnyway() { if (isMounted) root.dataset.pfPrintAnyway = ''; print(); },   // HUD [그래도 인쇄]. 【시험대 5】 mount 전이면 그릴 덱이 없으므로 안내 쪽 그대로(A4: 빈 쪽 1장이 나왔음)
  });
  Object.defineProperty(window.PFScene, 'ready', { get() { return root.dataset.pfReady; }, configurable: true });
  // 【시험대 3】 진단용: 게이트가 EAGER로 판단했는지(헤드리스의 pointer 판정 확인용)
  window.PFScene._eager = EAGER;
})();

// ── 블록 B: 키트 본체 ──────────────────────────────────────────────────────
(() => {
  const W = 1280, H = 720, GAP = 16, KMAX = 1.5;
  const root = document.documentElement;
  const Q = new URLSearchParams(location.search);
  const PF = window.PFScene;
  const T = (PF._t = { mount: null, ready: null, timeout: null, firstYes: null });
  let deck = null, scenes = [], cur = 0, first = true, hud = null, opts = {}, scope = 'all', K = 1, io = null, mountedOnce = false;
  const presenting = false;                                   // 발표 모드는 R1.5(§7-5). 시험대에는 없음

  // ── 준비 상태 관찰(whenReady·HUD·타이밍·?pf-audit=1) ──
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

  // ── 배율(§7-2 원문 + 시험 훅) ──
  function fit() {
    const vw = root.clientWidth, vh = innerHeight, gap = presenting ? 0 : GAP;
    let k = Math.min(vw / W, (vh - 2 * gap) / H);             // 하한 없음
    if (!presenting) k = Math.min(k, KMAX);                   // 일반 보기 상한 1.5
    if (Q.has('pf-k')) k = +Q.get('pf-k');                    // 【시험 훅】 배율 고정(T14·A2)
    K = k;
    root.style.setProperty('--pf-k', String(k));
    const sm = Q.get('pf-scale');                             // 【A2 실험 훅】 zoom 혼합. 기본은 transform
    root.classList.toggle('pf-scale-zoom', sm === 'zoom' || (sm === 'hybrid' && k >= 1.1));
    placeHud();
    if (!first) realign(); first = false;                     // 처음 한 번은 다시 맞추지 않음(딥 링크 보호)
  }
  function realign() { const s = scenes[cur]; if (s) s.scrollIntoView({ block: 'center' }); }

  // ── 장면 수집·번호(§3-2, §9-3 mount) ──
  function collect() {
    scenes = [...deck.children].filter((e) => e.classList.contains('pf-scene'));
    const N = scenes.length;
    scenes.forEach((s, i) => {
      s.id = `s-${i + 1}`;
      s.tabIndex = -1;
      if (!s.hasAttribute('aria-label')) {
        const h = s.querySelector('.pf-crumb, .pf-title, h1, h2, h3');
        if (h) { if (!h.id) h.id = `${s.id}-t`; s.setAttribute('aria-labelledby', h.id); }
        else s.setAttribute('aria-label', `장면 ${i + 1}`);
      }
      s.querySelectorAll('.pf-foot .pf-n-screen').forEach((e) => { e.textContent = `${i + 1} / ${N}`; });
    });
    renumberPrint();
  }

  // ── 인쇄 범위(§8-4) + 인쇄 번호·교차 참조 다시 계산(§6-6). 분할을 다시 하지 않으므로 게이트를 닫지 않음 ──
  const printed = () => scenes.filter((s) => !s.classList.contains('pf-skip'));
  function refUrl(id) {                                       // 인쇄 집합 밖 대상: 배포 주소의 URL 글자(§6-6)
    let u = `${location.host}${location.pathname}${location.search}#${id}`;
    try { u = decodeURIComponent(u); } catch { /* 그대로 */ }
    return u.replace(/[?&]pf-[\w-]+(=[^&#]*)?/g, '').replace(/\?(?=#|$)/, '').replace(/\.html&/, '.html?');
  }
  function renumberPrint() {
    const P = printed(), M = P.length;
    P.forEach((s, j) => s.querySelectorAll('.pf-foot .pf-n-print').forEach((e) => { e.textContent = `${j + 1} / ${M}`; }));
    scenes.filter((s) => s.classList.contains('pf-skip')).forEach((s) => s.querySelectorAll('.pf-foot .pf-n-print').forEach((e) => { e.textContent = ''; }));
    document.querySelectorAll('[data-pf-ref]').forEach((a) => {
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

  // ── 이동(§7-4) ──
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function go(i, { focus = true } = {}) {
    if (!scenes.length) return;
    i = Math.max(0, Math.min(scenes.length - 1, i));
    const s = scenes[i];
    s.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    cur = i; hudSync();
    if (focus) s.focus({ preventScroll: true });
    history.replaceState(history.state, '', `#${s.id}`);
  }
  function goHash() {
    const id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    const el = document.getElementById(id); if (!el) return;
    const s = el.classList.contains('pf-scene') ? el : el.closest('.pf-scene');
    if (s && deck.contains(s)) { s.scrollIntoView({ block: 'center' }); cur = scenes.indexOf(s); hudSync(); }
  }
  const editable = (t) => t.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  function scrollableX(t) { for (let n = t; n && n !== document.body; n = n.parentElement) { if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true; } return false; }
  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || editable(e.target) || document.querySelector('dialog[open]')) return;
    let d = 0;
    if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) d = 1;
    else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) d = -1;
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !scrollableX(e.target)) d = e.key === 'ArrowRight' ? 1 : -1;
    else if (e.key === 'Home') { e.preventDefault(); return go(0); }
    else if (e.key === 'End') { e.preventDefault(); return go(scenes.length - 1); }
    if (!d) return;                                           // ↑↓는 브라우저 기본
    if (e.key === ' ' && e.target.closest?.('button, a, summary')) return;
    e.preventDefault(); go(cur + d);
  }
  function onFocus(e) {
    const s = e.target.closest?.('.pf-deck > .pf-scene'); if (!s || e.target === s) return;
    const r = s.getBoundingClientRect();
    if (r.top < -1 || r.bottom > innerHeight + 1) s.scrollIntoView({ block: 'center' });
  }
  function observe() {
    io?.disconnect();
    const ratio = new Map();
    io = new IntersectionObserver((ents) => {
      ents.forEach((e) => ratio.set(e.target, e.intersectionRatio));
      let best = cur, br = -1;
      scenes.forEach((s, i) => { const r = ratio.get(s) ?? 0; if (r > br) { br = r; best = i; } });
      if (best !== cur) { cur = best; hudSync(); }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    scenes.forEach((s) => io.observe(s));
  }

  // ── HUD(§7-3 최소판: 이전·n/N·다음, [PDF로 저장](준비 대기), "요약만", timeout 때 [그래도 인쇄], localhost 감사 배지) ──
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  function buildHud() {
    const skip = document.createElement('a');
    skip.className = 'pf-skiplink pf-screen-only'; skip.href = '#s-1'; skip.textContent = '본문으로 건너뛰기';
    skip.addEventListener('click', (e) => { e.preventDefault(); go(0); });
    hud = document.createElement('nav');
    hud.className = 'pf-hud pf-screen-only'; hud.setAttribute('aria-label', '장면 조작');
    const hasDoc = scenes.some((s) => s.dataset.pfPart === 'doc');
    hud.innerHTML = `<button type="button" data-a="prev" aria-label="이전 장면">▲</button>
      <span class="pf-hud-count" aria-hidden="true"></span>
      <button type="button" data-a="next" aria-label="다음 장면">▼</button>
      ${opts.scope && hasDoc ? '<button type="button" data-a="scope" aria-pressed="false" title="인쇄 범위: 기술 문서 부록 빼기">요약만</button>' : ''}
      <button type="button" data-a="print" class="pf-hud-print">PDF로 저장<small></small></button>
      <span class="pf-hud-msg" role="status" aria-live="polite"></span>
      <button type="button" data-a="anyway" hidden>그래도 인쇄</button>
      ${isLocal ? '<span class="pf-hud-badge" hidden title="PFScene.audit() 문제 수(localhost에서만 표시)"></span>' : ''}`;
    hud.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'prev') go(cur - 1); else if (a === 'next') go(cur + 1);
      else if (a === 'scope') setScope(scope === 'summary' ? 'all' : 'summary');
      else if (a === 'print') print();
      else if (a === 'anyway') PF.printAnyway();
    });
    deck.before(skip, hud);                                   // DOM 순서: 건너뛰기 → HUD → 덱(§7-3)
  }
  function placeHud() {
    if (!hud) return;
    const lb = (root.clientWidth - W * K) / 2;                // 레터박스 폭
    const side = lb >= 64;
    hud.dataset.place = side ? 'side' : 'pill';
    root.style.setProperty('--pf-lb', `${Math.max(0, lb)}px`);
    root.classList.toggle('pf-hud-pill', !side);
  }
  let msg = '';
  function hudSync() {
    if (!hud) return;
    hud.querySelector('.pf-hud-count').textContent = `${cur + 1} / ${scenes.length}`;
    const sc = hud.querySelector('[data-a=scope]');
    if (sc) sc.setAttribute('aria-pressed', String(scope === 'summary'));
    hud.querySelector('.pf-hud-print small').textContent = `PDF ${printed().length}쪽`;
    const r = root.dataset.pfReady;
    hud.querySelector('[data-a=anyway]').hidden = r !== 'timeout';
    const imgs = [...deck.querySelectorAll('img')];
    const m = r === 'timeout' ? `아직 다 그리지 못했습니다(이미지 ${imgs.filter((i) => i.complete).length}/${imgs.length})` : msg;
    hud.querySelector('.pf-hud-msg').textContent = m;
  }
  function badge() {
    const b = hud?.querySelector('.pf-hud-badge'); if (!b) return;
    const n = audit().length; b.textContent = String(n); b.hidden = n === 0;
  }

  // ── [PDF로 저장](§8-2 끝 문단) ──
  async function print() {
    const lazy = [...document.querySelectorAll('img[loading="lazy"]')].filter((i) => !i.complete);
    if (lazy.length) {                                        // 폰·데이터 절약(lazy 유지)에서도 먼저 모두 받음
      lazy.forEach((i) => { i.loading = 'eager'; });
      PF.track(Promise.all(lazy.map((i) => new Promise((r) => { if (i.complete) r(); else { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); } }))));
    }
    if (root.dataset.pfReady !== 'yes') {
      const imgs = [...(deck || document).querySelectorAll('img')];   // 【A4】 mount 전(deck 없음)에 불려도 예외 없이 yes를 기다림
      const tickMsg = () => { msg = `이미지 ${imgs.filter((i) => i.complete).length}/${imgs.length} 불러오는 중`; hudSync(); };
      tickMsg(); const iv = setInterval(tickMsg, 300);
      await whenReady(); clearInterval(iv); msg = ''; hudSync();
    }
    window.print();
  }

  // ── Mermaid(§6-2 4번): render()로 차례대로. 장면 안에서 run()을 제자리 실행하지 않음 ──
  let mmdN = 0;
  async function renderMermaid(nodes, config) {
    if (!window.mermaid) return [];
    if (config) window.mermaid.initialize(config);
    const errs = [];
    for (const el of nodes) {
      try { const { svg } = await window.mermaid.render(`pf-mmd-${++mmdN}`, el.textContent); el.innerHTML = svg; el.dataset.processed = 'true'; }
      catch (err) { errs.push(String(err && err.message || err)); el.classList.add('pf-mmd-error'); }
    }
    return errs;
  }

  // ── 감사(§9-3 audit, §11-2 T1의 장면 단위 항목). 배율과 무관하게 동작(사각형 비교 허용오차 = 0.5 논리 px × 배율) ──
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
    const br = body ? body.getBoundingClientRect() : sr;
    if (body && (body.scrollHeight > body.clientHeight || body.scrollWidth > body.clientWidth))
      add('body-scroll', `본문 넘침 ${body.scrollWidth}×${body.scrollHeight} > ${body.clientWidth}×${body.clientHeight}`);
    const clipAnc = (e, stop) => { for (let a = e.parentElement; a && a !== stop; a = a.parentElement) { const c = getComputedStyle(a); if (c.overflowX !== 'visible' || c.overflowY !== 'visible') return true; } return false; };
    s.querySelectorAll('*').forEach((e) => {
      if (e.closest('[data-pf-bleed], [data-pf-allow-clip]')) return;
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
        if (hasText && (ecs.visibility === 'hidden' || parseFloat(ecs.opacity) < 0.05)) add('hidden', `${desc(e)} ${ecs.visibility === 'hidden' ? 'visibility:hidden' : 'opacity ' + ecs.opacity}`);
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
  // 【R0 결정 #14】 화면 매체 감사 "덱 밖에 보이는 요소"(outside-deck). 인쇄 CSS(scene-kit.css 수정안 4)가 덱 밖·덱 안 비장면 요소를
  //   PDF에서 조용히 빼므로, 화면에서 보이는 그런 내용을 대신 알림(01 §1-4 ① "조용히 잘리지 않음"). 인쇄 매체에서는 돌지 않음(인쇄 감사 불변).
  //   대상: 덱 조상(body … 덱 부모)의 자식 중 덱을 품지 않은 것, 덱·래퍼(.pf-scene을 품은 덱 안 요소)의 자식 중 장면도 래퍼도 아닌 것,
  //         그 자리의 글자 노드, 덱 조상·덱·래퍼의 ::before/::after(content가 빈 문자열이 아닐 때).
  //   "보임": display ≠ none, checkVisibility(opacity·visibility; 조상 opacity 포함), 넓이 > 0인 상자가 문서 음수 좌표 밖에 있고
  //         실제로 무엇을 칠함(글자·대체 요소·배경·테두리·그림자·외곽선). 자손이 visibility:visible로 되살아난 경우도 찾음.
  //         clip:rect(0…)·clip-path:inset(50%)·1px 이하 overflow 상자(sr-only 패턴) 안은 안 보임으로 침.
  //   예외(키트 UI·명시적 화면 전용): [data-pf-ui] 하위, .pf-screen-only(HUD·건너뛰기 링크가 닮), .pf-hud, .pf-skiplink, #pf-audit, .pf-measure,
  //         라이트박스(dialog.lightbox, .pf-lightbox), script·style·link·meta·template·noscript·head·title·base, 닫힌 dialog·popover, 게이트 안내 문구.
  const OD_TAGS = /^(script|style|link|meta|template|noscript|head|title|base)$/i;
  // 【fix4-probe 변형 4b】 [data-pf-ui]는 렌더러의 "UI 문구"(장면 머리·바닥글, 글자 보존 제외) 표식이라 키트 UI 예외에서 뺌(A28). 키트 UI는 클래스로 충분
  const OD_EXEMPT = '.pf-screen-only, .pf-hud, .pf-skiplink, #pf-audit, .pf-measure, dialog.lightbox, .pf-lightbox';
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
  // 【4b】 fixed 조상이 있으면 뷰포트 밖(오른쪽·아래 포함)은 안 보임(I09 닫힌 서랍). 그 밖은 문서 스크롤 범위 밖이면 안 보임
  const odFixed = (e) => { for (let a = e; a && a.nodeType === 1; a = a.parentElement || a.getRootNode().host) if (getComputedStyle(a).position === 'fixed') return true; return false; };
  const odRects = (list, e) => { const fx = e && odFixed(e); const W = fx ? root.clientWidth : root.scrollWidth, Hh = fx ? innerHeight : root.scrollHeight, ox = fx ? 0 : scrollX, oy = fx ? 0 : scrollY;
    return [...list].filter((r) => r.width > 0.5 && r.height > 0.5 && r.right + ox > 0 && r.bottom + oy > 0 && r.left + ox < W - 0.5 && r.top + oy < Hh - 0.5); };
  function odClipped(e, cs) {                                 // 화면 낭독기 전용(sr-only) 등 "보이지 않게 잘린" 상자
    if (/^(absolute|fixed)$/.test(cs.position) && /rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)/.test(cs.clip)) return true;
    if (/^inset\(\s*50%/.test(cs.clipPath) || /^circle\(\s*0(px)?\s/.test(cs.clipPath)) return true;
    if (cs.overflowX !== 'visible' && cs.overflowY !== 'visible') { const r = e.getBoundingClientRect(); if (r.width <= 1 && r.height <= 1) return true; }
    return false;
  }
  function odPaints(e, cs) {                                  // 이 요소 자체가 칠하는 것(글자는 글자 노드에서 따로 봄)
    if (OD_REPLACED.test(e.tagName)) return e.tagName.toLowerCase();
    if (cs.backgroundImage !== 'none') return '배경 그림';
    if (alphaOf(cs.backgroundColor) > 0) return '배경색';
    for (const s of ['Top', 'Right', 'Bottom', 'Left'])
      if (parseFloat(cs[`border${s}Width`]) > 0 && !/none|hidden/.test(cs[`border${s}Style`]) && alphaOf(cs[`border${s}Color`]) > 0) return '테두리';
    if (cs.boxShadow !== 'none') return '그림자';
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && alphaOf(cs.outlineColor) > 0) return '외곽선';
    return '';
  }
  function odPseudo(e) {                                      // ::before/::after 생성 글자. 【4b】 빈 content라도 크기가 있고 칠하면(장식 띠, A07·A08) 보임
    for (const p of ['::before', '::after']) {
      const c = getComputedStyle(e, p), ct = c.content;
      if (!ct || ct === 'none' || ct === 'normal' || ct.includes(OD_GATE)) continue;
      if (c.display === 'none' || c.visibility !== 'visible' || parseFloat(c.opacity) === 0) continue;
      if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true })) continue;
      if (ct === '""' || ct === "''") {
        const w = parseFloat(c.width), h = parseFloat(c.height);
        const paint = odPaints({ tagName: 'X' }, c);
        if (paint && w > 0.5 && h > 0.5) return { el: e, why: `${p}(빈 content, ${paint} ${Math.round(w)}×${Math.round(h)})`, text: '' };
        continue;
      }
      return { el: e, why: p, text: ct.replace(/^["']|["']$/g, '').slice(0, 40) };
    }
    return null;
  }
  function odText(t) {
    const s = t.data.replace(/\s+/g, ' ').trim(); if (!s) return null;
    const p = t.parentElement || t.parentNode?.host; if (!p || odExempt(p) || !odVis(p)) return null;
    const pc = getComputedStyle(p);                           // 【4b】 투명 글자(외곽선·그림자 없음)는 안 보임(I10)
    if (alphaOf(pc.color) === 0 && !(parseFloat(pc.webkitTextStrokeWidth) > 0) && pc.textShadow === 'none') return null;
    const rg = document.createRange(); rg.selectNodeContents(t);
    return odRects(rg.getClientRects(), p).length ? { el: p, why: '글자', text: s.slice(0, 40) } : null;
  }
  function odFind(n) {                                        // n(요소·글자)과 그 하위에서 처음 보이는 것
    if (n.nodeType === 3) return odText(n);
    if (n.nodeType !== 1 || odExempt(n)) return null;
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || parseFloat(cs.opacity) === 0 || odClipped(n, cs)) return null;
    if (cs.display !== 'contents' && odVis(n) && odRects(n.getClientRects(), n).length) { const why = odPaints(n, cs); if (why) return { el: n, why, text: textOf(n) }; }
    if (OD_REPLACED.test(n.tagName)) return null;
    if (n.shadowRoot) for (const c of n.shadowRoot.childNodes) { const r = odFind(c); if (r) return { ...r, why: `그림자 DOM ${r.why}` }; }   // 【4b】 열린 그림자 DOM(A17·A19)
    for (const c of n.childNodes) { const r = odFind(c); if (r) return r; }
    return odPseudo(n);
  }
  function outsideDeck() {
    const out = [];
    if (!deck || !deck.isConnected) return out;
    const wraps = new Set();                                  // 덱 안에서 장면을 품은 요소(래퍼). 장면 안에 든 장면은 무시
    deck.querySelectorAll('.pf-scene').forEach((s) => { const ch = [];
      for (let a = s.parentElement; a && a !== deck; a = a.parentElement) { if (a.classList.contains('pf-scene')) return; ch.push(a); }
      ch.forEach((a) => wraps.add(a)); });
    const isWrap = (e) => wraps.has(e);
    const conts = [];
    for (let a = deck.parentElement; a; a = a.parentElement) conts.push(a);   // 덱 조상(덱 부모 … html)
    conts.push(deck, ...wraps);
    const where = (n) => { if (deck.contains(n)) return '덱 안'; return (deck.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_PRECEDING) ? '덱 앞' : '덱 뒤'; };
    for (const c of conts) {
      const inDeck = c === deck || deck.contains(c);
      for (const n of c.childNodes) {
        if (n.nodeType === 1 && (n === deck || n.contains(deck))) continue;                       // 덱 조상 사슬
        if (inDeck && n.nodeType === 1 && (n.classList.contains('pf-scene') || isWrap(n))) continue;   // 장면·래퍼
        const hit = odFind(n);
        if (!hit) continue;
        const el = n.nodeType === 1 ? descFull(n) : `#text(${descFull(c)} 바로 아래)`;
        const sub = hit.el !== n ? ` → ${descFull(hit.el)}` : '';
        out.push({ scene: null, type: 'outside-deck', el, text: textOf(n) || hit.text, why: hit.why, pos: where(n),
                   detail: `<${el}> ${where(n)}에 보임(${hit.why}${sub}) "${textOf(n) || hit.text}"` });
      }
      const ps = odPseudo(c);                                 // 【4b】 html::before/::after도 봄(A06)
      if (ps) out.push({ scene: null, type: 'outside-deck', el: `${descFull(c)}${ps.why}`, text: ps.text, why: ps.why, pos: inDeck ? '덱 안' : '덱 조상',
                         detail: `<${descFull(c)}>${ps.why} 생성 글자가 보임 "${ps.text}"` });
    }
    return out;
  }
  function audit() {
    const out = [];
    if (!deck) return [{ scene: null, type: 'no-deck', detail: 'mount 전' }];
    // 【4b】 덱 표식 이상: 인쇄 CSS(수정안 4)는 .pf-deck 클래스로 덱을 찾으므로 JS의 deck과 다르면 PDF가 통째로 비거나 장면이 숨겨짐(A23·A24·A25)
    if (deck === document.body || deck === root) out.push({ scene: null, type: 'deck', detail: `<${deck.tagName.toLowerCase()}>를 덱으로 씀 — 인쇄에서 장면이 모두 숨겨짐. <main class="pf-deck">를 body 안에 둠` });
    else if (!deck.classList.contains('pf-deck')) out.push({ scene: null, type: 'deck', detail: `${desc(deck)}에 pf-deck 클래스가 없음 — 인쇄에서 덱이 통째로 숨겨짐` });
    const nDeck = document.querySelectorAll('.pf-deck').length;
    if (nDeck > 1) out.push({ scene: null, type: 'deck', detail: `.pf-deck가 ${nDeck}개 — 덱은 하나만(장면 안에서 pf-deck 이름을 쓰지 않음)` });
    [...deck.children].forEach((e) => { if (!e.classList.contains('pf-scene')) out.push({ scene: null, type: 'foreign', detail: `${desc(e)} 장면 사이 이물질` }); });
    scenes.forEach((s, i) => sceneIssues(s).forEach((x) => out.push({ scene: i + 1, ...x })));
    document.querySelectorAll('dialog[open]').forEach((d) => out.push({ scene: null, type: 'dialog', detail: `${desc(d)} 열린 dialog` }));
    if (!matchMedia('print').matches) out.push(...outsideDeck());   // 【R0 결정 #14】 화면 매체에서만
    return out;
  }
  function report() {
    const a = audit();
    return { ready: root.dataset.pfReady, scenes: scenes.length, printScenes: printed().length, scope,
             audit: a, clipped: a.filter((x) => x.type === 'clipped').length,
             outsideDeck: a.filter((x) => x.type === 'outside-deck').length,        // 【R0 결정 #14】 화면 매체에서만 셈(인쇄 매체에서는 0)
             media: matchMedia('print').matches ? 'print' : 'screen', selfTest: null,
             timing: { ...T }, eager: PF._eager, k: K, info: PF.info || null };
  }
  function writeAudit() {
    let pre = document.getElementById('pf-audit');
    if (!pre) { pre = document.createElement('pre'); pre.id = 'pf-audit'; pre.hidden = true; document.body.appendChild(pre); }
    const bytes = new TextEncoder().encode(JSON.stringify(report()));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    pre.textContent = btoa(bin);
  }

  // ── mount(§9-3): 데이터 렌더 후 한 번. 다시 나눈 뒤에는 refresh() ──
  function mount(o = {}) {
    opts = Object.assign({ deck: '#deck', hud: true, scope: true }, o);
    deck = typeof opts.deck === 'string' ? document.querySelector(opts.deck) : opts.deck;
    collect();
    if (Q.get('pf-scope') === 'summary') setScope('summary');
    if (opts.hud && !hud) buildHud();
    fit();
    observe();
    if (!mountedOnce) {
      mountedOnce = true;
      T.mount = performance.now();
      addEventListener('resize', fit);
      addEventListener('keydown', onKey);
      addEventListener('hashchange', goHash);
      document.addEventListener('focusin', onFocus);
      whenReady().then(() => { if (location.hash) goHash(); if (isLocal) badge(); });
      PF._mounted();
    }
    hudSync();
    return PF;
  }
  function refresh() { collect(); setScope(scope); observe(); hudSync(); if (isLocal && root.dataset.pfReady === 'yes') badge(); }

  Object.assign(PF, { mount, refresh, whenReady, go, print, setScope, audit, sceneIssues, report, renderMermaid, refUrl, fit });
  Object.defineProperty(PF, 'k', { get() { return K; }, configurable: true });
  Object.defineProperty(PF, 'count', { get() { return scenes.length; }, configurable: true });
  Object.defineProperty(PF, 'scope', { get() { return scope; }, configurable: true });
  // ?pf-audit=1인데 mount가 끝내 안 불려도(렌더 실패) timeout 때 결과를 씀 → onReadyChange가 처리
})();
