// 덱 장면 공통 — index.html(포트폴리오 덱)·project.html(발표 덱)이 common.js 다음에 싣습니다. 출처: spikes/deck/pages/pf-common.js
//   장면 틀 scene()(제목 + 도입 1~2줄, 결정 G7), 측정 후 고르기 pack(), 넘침 처리 shrinkOrClip()(§4-3 원칙 5: 변형 → 축소 → 보이는 잘림 띠),
//   글자 하한(결정 G5: 본문 14 · 코드 12 · 라벨 11px), 세로 가운데(.pf-fill, G8)·채움률, 시각 자료 맞추기(fitVisuals), 프로젝트 소개 장면, 글꼴·이미지 크기 대기
//   주석의 설계 근거(docs/design/…의 portfolio-structure·deck-vs-scroll·01 §, R0, 결정 F·Q·# 번호)와 원본 시안(spikes/…)은 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.
(() => {
  const { esc, inline } = PF;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 글꼴: 굵기마다 load + 각각 catch → fonts.ready, 상한 8초. 실패하면 data-pf-font="fallback"(늦게 들어오면 페이지가 다시 그림)
  async function loadFonts(sample = '가나다ABC123', ms = 8000) {
    const want = ['400', '600', '700', '800'].map((w) => `${w} 16px Pretendard`).concat(['400 14px D2Coding']);
    const errs = [];
    const CODE_SAMPLE = 'public void {}();=<>[]0Oil|';                    // 코드 블록 글자(영문·기호)로도 받음 — 한글 표본만으로는 코드 글꼴 조각이 늦게 올 수 있음
    const all = Promise.all(want.map((f) => document.fonts.load(f, /D2Coding/.test(f) ? sample + CODE_SAMPLE : sample).then((r) => { if (!r.length) errs.push(f + ' (일치 없음)'); }).catch((e) => errs.push(f + ' ' + e))))
      .then(() => document.fonts.ready);
    const timedOut = await Promise.race([all.then(() => false), sleep(ms).then(() => true)]);
    const ok = want.map((f) => document.fonts.check(f, '가'));
    if (timedOut || ok.some((x) => !x)) document.documentElement.dataset.pfFont = 'fallback';
    else delete document.documentElement.dataset.pfFont;
    return { timedOut, errs, check: Object.fromEntries(want.map((f, i) => [f, ok[i]])) };
  }

  // 이미지 크기: data에 media w×h 기록이 아직 없으므로(Q12) 머리만 받아서 잼. rAF·decode() 금지 → setTimeout 폴링
  const dimCache = new Map();
  function imageSize(src) {
    if (dimCache.has(src)) return dimCache.get(src);
    const p = new Promise((res) => {
      const im = new Image();
      let done = false;
      const fin = () => { if (done) return; done = true; res(im.naturalWidth ? { w: im.naturalWidth, h: im.naturalHeight } : null); };
      im.onload = fin; im.onerror = fin;
      im.src = src;
      const poll = () => { if (done) return; if (im.naturalWidth) fin(); else setTimeout(poll, 15); };
      poll();
    });
    dimCache.set(src, p);
    return p;
  }

  // 측정용 컨테이너: 이 안의 장면은 배율 1
  let measure = null;
  function measureRoot() {
    if (!measure || !measure.isConnected) { measure = document.createElement('div'); measure.className = 'pf-measure'; measure.setAttribute('aria-hidden', 'true'); document.body.appendChild(measure); }
    return measure;
  }
  function dropMeasure() { measure?.remove(); measure = null; }

  // 장면 틀. kind: 'sum'(eyebrow │ 오른쪽 라벨 줄 + 제목 줄) | 'bare'(머리 없음: 표지·목차·맺음)
  //   id = 안정 장면 id(#s=<id> 공유 주소·장면 안 링크 목적지), sec = HUD·개요의 섹션명, stitle = 낭독·개요용 제목, group = 개요 묶음 이름
  //   lead = 제목 아래 도입 1~2줄(머리 높이가 그만큼 늘고 본문 상자가 줄어듦, 결정 G7). 머리는 축소하지 않음
  function scene({ id = '', tpl, part = 'summary', kind = 'sum', eyebrow = '', rlabel = '', title = '', sub = '', pill = '', lead = '', cls = '', foot = '', titleTag = 'h2', sec = '', stitle = '', group = '' }) {
    const s = document.createElement('section');
    s.className = `pf-scene pf-${kind} t-${tpl}${cls ? ' ' + cls : ''}`;
    if (id) s.id = id;
    s.dataset.pfTpl = tpl; s.dataset.pfPart = part;
    if (sec) s.dataset.sec = sec;
    if (stitle) s.dataset.title = stitle;
    if (group) s.dataset.group = group;
    const row = (right) => `<div class="pf-headrow"><p class="pf-eyebrow">${esc(eyebrow)}</p>${right}</div>`;
    const head = kind === 'bare' ? ''
      : `<header class="pf-head" data-pf-ui="chrome">${row(rlabel ? `<p class="pf-rlabel">${esc(rlabel)}</p>` : '')}${title ? `<div class="pf-titlerow"><${titleTag} class="pf-title">${inline(title)}${sub ? `<span class="pf-part" data-pf-ui="cont" aria-hidden="true">${esc(sub)}</span>` : ''}</${titleTag}>${pill ? `<span class="pill">${inline(pill)}</span>` : ''}</div>` : ''}${lead ? `<p class="pf-lead">${inline(lead)}</p>` : ''}</header>`;
    s.innerHTML = `${head}<div class="pf-body"></div>` +
      `<footer class="pf-foot" data-pf-ui="chrome"><span>${esc(foot)}</span><span class="pf-num"><span class="pf-n-screen"></span><span class="pf-n-print"></span></span></footer>`;
    return s;
  }
  const body = (s) => s.querySelector(':scope > .pf-body');
  // 장면이 넘치지 않는가(배치용: 이미지 로딩·숨김 검사는 빼고 키트 감사의 배치 항목만)
  const fitsScene = (s) => window.PFScene.sceneIssues(s, { layoutOnly: true }).length === 0;
  const fitsM = (s) => { const M = measureRoot(); M.appendChild(s); const ok = fitsScene(s); s.remove(); return ok; };

  // 측정 후 고르기(§4-3 원칙 1): 항목을 장면에 하나씩 넣어 보고, 우선순위대로 변형을 시험해 넘치지 않는 첫 변형을 씀
  //   build(chunk, variant, i, n) → 장면 요소. variants: [{ name, min, max }]
  function pack(items, variants, build) {
    const M = measureRoot();
    const tryFit = (chunk) => {
      for (const v of variants) {
        if (chunk.length < (v.min || 1) || chunk.length > (v.max || 99)) continue;
        const s = build(chunk, v.name, 0, 1); M.appendChild(s);
        const ok = fitsScene(s); s.remove();
        if (ok) return v.name;
      }
      return null;
    };
    const pages = []; let cur = [];
    for (const it of items) {
      const trial = cur.concat([it]);
      if (tryFit(trial)) { cur = trial; continue; }
      if (cur.length) pages.push(cur);
      cur = [it];
    }
    if (cur.length) pages.push(cur);
    if (pages.length > 1) {                                  // 균형: 마지막 장면이 1개뿐이고 앞 장면이 3개 이상이면 하나 옮김
      const a = pages[pages.length - 2], b = pages[pages.length - 1];
      if (b.length === 1 && a.length >= 3) { const na = a.slice(0, -1), nb = [a[a.length - 1], ...b]; if (tryFit(na) && tryFit(nb)) { pages[pages.length - 2] = na; pages[pages.length - 1] = nb; } }
    }
    return pages.map((chunk) => ({ chunk, variant: tryFit(chunk) }));   // variant null = 가장 넓은 변형에도 안 들어감(원칙 5로)
  }

  // ── 글자 하한(결정 G5): 본문 14 · 코드 12 · 라벨 11px. 장면 본문의 보이는 글자를 셋으로 나눠 가장 작은 크기를 잼 ──
  //   .fit-in(시각 자료 맞추기로 이미 줄인 코드·표)은 data-pf-fz 배율을 곱해 실제 크기로 셈. SVG(다이어그램) 글자는 따로(tiny-diagram 참고)
  const FLOOR = { body: 14, code: 12, label: 11 };
  const CODE_SEL = 'pre, code, kbd, .url, .pg, .mono';
  const LABEL_SEL = '.fe-a, .pf-eyebrow, .pf-rlabel, .pf-part, .tags li, .badge, .labelchip, .toc-lb, .nlabel, figcaption, .chip, th, .lb, .lk a, .pc-links b, .cv-lb, .rl, .toc-sub, .kick, .cap, .ix, .lc-k, .meta-k, .fe-k, .num, .toc-list .n';
  function minFonts(root) {
    const m = { body: Infinity, code: Infinity, label: Infinity };
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.data.trim()) continue;
      const e = n.parentElement;
      if (!e || e.closest('svg, .pf-sr-only, [data-pf-ui], .pf-vband') || !e.getClientRects().length) continue;
      const fz = e.closest('[data-pf-fz]');
      const px = parseFloat(getComputedStyle(e).fontSize) * (fz ? +fz.dataset.pfFz : 1);
      const c = e.closest(CODE_SEL) ? 'code' : e.closest(LABEL_SEL) ? 'label' : 'body';
      if (px < m[c]) m[c] = px;
    }
    return m;
  }
  // 줄일 수 있는 가장 작은 배율 = 분류마다 (하한 ÷ 지금 가장 작은 글자) 중 가장 큰 값. 1 이상이면 줄이지 못함
  const minZoom = (root) => { const m = minFonts(root); return Math.max(...Object.keys(FLOOR).map((c) => (m[c] === Infinity ? 0 : FLOOR[c] / m[c]))); };

  // §4-3 원칙 5의 ②③: 장면 본문을 글자 하한까지 비례 축소 → 그래도 넘치면 보이는 잘림 띠 + 리포트
  function shrinkOrClip(s, srcUrl, stats) {
    const b = body(s);
    const M = measureRoot(); const wasIn = s.isConnected; if (!wasIn) M.appendChild(s);
    let z = 1;
    if (!fitsScene(s)) {
      stats?.push({ tpl: s.dataset.pfTpl, action: 'overflow', issues: window.PFScene.sceneIssues(s, { layoutOnly: true }).slice(0, 4) });
      const zmin = Math.min(1, minZoom(b));
      if (zmin < 1) {                                                    // 이미 하한이면 감싸지 않음(크기 없는 감싸개가 세로 가운데를 깸)
        const w = document.createElement('div'); w.className = 'pf-zoomwrap'; w.append(...b.childNodes); b.appendChild(w);
        const bw = b.clientWidth, bh = b.clientHeight;
        while (!fitsScene(s) && z > zmin + 1e-9) {
          z = Math.max(+(z - 0.01).toFixed(2), zmin);
          Object.assign(w.style, { zoom: String(z), width: `${bw / z}px`, height: `${bh / z}px` });
        }
      }
      stats?.push({ tpl: s.dataset.pfTpl, action: 'shrink', zoom: +z.toFixed(4), floor: +zmin.toFixed(4) });
      if (!fitsScene(s)) note(s.id, 'font-floor', +zmin.toFixed(3), `글자 하한(본문 14·코드 12·라벨 11px)에 닿아 더 줄이지 못함`);
    }
    if (!fitsScene(s)) {
      const c = document.createElement('div');
      c.className = 'pf-clipped'; c.dataset.pfUi = 'clip';
      c.textContent = `내용이 잘렸습니다 → 원문: ${srcUrl}`;
      s.appendChild(c);
      stats?.push({ tpl: s.dataset.pfTpl, action: 'clipped' });
    }
    if (!wasIn) s.remove();
    return s;
  }
  // 맞으면 그대로, 아니면 원칙 5
  const guard = (s, srcUrl, stats) => (fitsM(s) ? s : shrinkOrClip(s, srcUrl, stats));

  // 안내 장면(데이터 없음·file:// 등). 글은 옛 렌더러의 안내 문구
  function msgScene({ id = 'notice', title, html, foot = '', eyebrow = 'PORTFOLIO' }) {
    const s = scene({ id, tpl: 'msg', kind: 'bare', foot, sec: '안내', stitle: title });
    body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">${esc(eyebrow)}</span></div><div class="msg"><h1>${esc(title)}</h1><div class="msg-b">${html}</div></div>`;
    return s;
  }

  // 참고 덱 모티프: 점 선(2px 선 + 14px 점)
  const DOT = '<div class="dotrule" aria-hidden="true"><span class="ln"></span><span class="dot"></span></div>';
  const imgTag = (src, alt, d, cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${d ? ` width="${d.w}" height="${d.h}"` : ''}>`;

  // 프로젝트 외부 링크(시연 영상 · GitHub · 그 밖의 링크) — data 순서 그대로
  const extLinks = (p) => [
    PF.isUrl(p.links?.video) && { label: '시연 영상', url: p.links.video },
    PF.isUrl(p.links?.github) && { label: 'GitHub', url: p.links.github },
    ...(p.links?.extra || []).filter((l) => PF.isUrl(l.url)).map((l) => ({ label: l.label, url: l.url, extra: true })),
  ].filter(Boolean);

  // 늦게 들어온 글꼴로 다시 그리기(R0 설계 공백 1: 게이트의 fonts.ready는 그리기만 지키고 측정·나눔은 지키지 못함)
  function refitOnLateFont(render) {
    if (document.documentElement.dataset.pfFont !== 'fallback' || !document.fonts) return;
    let done = false;
    document.fonts.addEventListener('loadingdone', () => {
      if (done || !document.fonts.check('700 16px Pretendard', '가') || !document.fonts.check('400 14px D2Coding', '{}();')) return;
      done = true;
      window.PFScene.track(render().then(() => window.PFScene.refresh()));
    });
  }

  // ── 참고 지표(결정 G8): 빨간 배지·audit에 넣지 않고 report().info.notes에만. {id, type, value, detail} — 장면 번호는 report()가 채움 ──
  //   type: low-fill(채움률 60% 미만) · tiny-diagram(다이어그램 실효 글자 10px 미만) · long-code(20줄 넘어 나뉨) · many-scenes(30장 초과) · auto-mode · font-floor
  function note(id, type, value, detail = '') {
    const info = window.PFScene.info || (window.PFScene.info = {});
    (info.notes || (info.notes = [])).push({ id, type, value, detail });
  }
  // 채움률 = 본문 상자 높이 중 내용이 차지한 비율(배율 1의 측정 컨테이너에서)
  function fillOf(s) {
    const M = measureRoot(); const wasIn = s.isConnected; if (!wasIn) M.appendChild(s);
    const b = body(s); let f = 1;
    if (b && b.clientHeight) {
      const box = b.querySelector(':scope > .pf-zoomwrap') || b;
      const br = b.getBoundingClientRect(); let top = Infinity, bot = -Infinity;
      for (const k of box.children) { const r = k.getBoundingClientRect(); if (!r.height) continue; top = Math.min(top, r.top); bot = Math.max(bot, r.bottom); }
      f = top === Infinity ? 0 : Math.min(1, (bot - top) / br.height);
    }
    if (!wasIn) s.remove();
    return f;
  }
  // 최종 장면들의 참고 지표: 채움률 60% 미만(표지·목차·장 표지 같은 bare 장면은 레이아웃이 정하므로 빼고), 다이어그램 실효 글자 10px 미만
  //   detail에 원인을 적음(리포트 안내를 원인별로, /portfolio-build SKILL §7-1): 다이어그램은 폭·높이 중 무엇에 막혔는지, 채움률은 장면에 든 것
  const KIND = { mermaid: '다이어그램', table: '표', code: '코드', image: '그림' };
  function noteFill(scenes, { fill = true } = {}) {
    scenes.forEach((s) => {
      s.querySelectorAll('.vbox[data-eff]').forEach((b) => {
        const eff = +b.dataset.eff; if (eff >= 10) return;
        const why = { h: '세로로 긴 그림 — 높이에 막힘', w: '가로로 긴 그림 — 폭에 막힘', multi: '다른 자료와 한 장면 — 나누면 커짐' }[b.dataset.lim] || '';
        note(s.id, 'tiny-diagram', +eff.toFixed(1), `다이어그램 글자가 약 ${Math.round(eff)}px로 작음${why ? `(${why}, ${b.dataset.vb})` : ''}`);
      });
      if (!s.classList.contains('pf-sum')) return;
      const f = fillOf(s);
      s.dataset.pfFill = f.toFixed(2);
      if (fill && f < 0.6 && !s.querySelector('.vbox.err')) {           // 원문을 못 찾은 자리가 있으면 그 문제(감사 visual-*)가 먼저
        const kinds = [...s.querySelectorAll('.vbox[data-kind]')].map((b) => KIND[b.dataset.kind] || b.dataset.kind);
        note(s.id, 'low-fill', +f.toFixed(2), `본문 상자의 ${Math.round(f * 100)}%만 채움(${kinds.length ? [...new Set(kinds)].join('·') : '글만'})`);
      }
    });
  }

  // ── 원문 블록 문제 띠(배포·PDF에도 보임 → 조용히 비지 않음). audit type = data-pf-visual-err ──
  const VBAND = { 'visual-missing': '원문에서 찾지 못했습니다', 'visual-ambiguous': '원문 위치가 여러 곳입니다', 'visual-changed': '원문이 바뀌었습니다' };
  //   edited = 장면 고치기(src/<폴더>/deck-edits.json)로 고친 장면: 빌드가 아니라 /portfolio-edit로 고쳐야 함
  const vband = (type, detail, edited) => `<div class="pf-vband" data-pf-visual-err="${esc(type)}" role="note"><b>${esc(VBAND[type] || type)}</b> → ${edited ? '고친 장면입니다. /portfolio-edit로 고치세요' : '/portfolio-build를 다시 실행하세요'}<span>${esc(detail || '')}</span></div>`;

  // ── 시각 자료 맞추기: .vis 안의 .vbox(그림·다이어그램·코드·표)를 칸에 맞춰 크기를 정함 ──
  //   1) 장면에 .pf-sizing을 붙여 .vis가 쓸 수 있는 칸 크기(W×H)를 잼  2) 한 개/세로로 쌓기/가로로 늘어놓기 중 가장 크게 보이는 배치
  //   3) 크기를 px로 적고 .pf-sizing을 떼면 내용 높이만큼만 차지 → .pf-fill이 세로 가운데로
  //   코드·표는 CSS zoom으로 줄임(글자 하한: 코드 12/14, 표 14/15). 하한 아래로는 줄이지 않고 넘침으로 둠(→ 변형·나눔·잘림 띠)
  //   다이어그램은 쪼개지 않고 줄임(Q9). 실효 글자 = 16px × 표시 폭 ÷ viewBox 폭, 10px 미만이면 tiny-diagram 참고
  const GAP = 16;
  function natOf(box) {
    const k = box.dataset.kind, media = box.querySelector(':scope > .vmedia');
    if (k === 'image') { const w = +box.dataset.w || 0, h = +box.dataset.h || 0; return { k, ar: w && h ? w / h : 16 / 9, max: w ? 1.25 : Infinity, nw: w || 1600 }; }
    if (k === 'mermaid') {
      const svg = media.querySelector('svg'); const vb = svg?.viewBox?.baseVal;
      const w = vb?.width || 400, h = vb?.height || 300;
      return { k, ar: w / h, nw: w, max: 22 / 16 };                       // 다이어그램 글자는 22px까지만 키움
    }
    const fin = media.querySelector(':scope > .fit-in');
    Object.assign(fin.style, { zoom: '1', width: 'max-content' });
    if (k === 'code') return { k, ar: fin.offsetWidth / Math.max(1, fin.offsetHeight), nw: fin.offsetWidth, nh: fin.offsetHeight, max: 1, min: 12 / 14 };
    // 표: 높이는 놓일 폭에 따라 달라지므로 hAt(w)로 잼(배율 1)
    const hAt = (w) => { Object.assign(fin.style, { zoom: '1', width: `${Math.max(1, Math.floor(w))}px` }); return fin.offsetHeight; };
    return { k, table: true, min: 14 / 15, max: 1, hAt };
  }
  // 시각 자료 상자 안에서 그림 말고 차지하는 높이: 캡션 + 원문 문제 띠(visual-changed). 상자 안 간격 6px씩
  const capOf = (box) => [...box.querySelectorAll(':scope > figcaption, :scope > .pf-vband')].reduce((a, c) => a + c.offsetHeight + 6, 0);
  // 표: 폭 bw에서 높이 bh 안에 들어가는 가장 큰 배율(하한까지)
  function fitTable(fin, bw, bh, min) {
    const at = (z) => { Object.assign(fin.style, { zoom: String(z), width: `${bw / z}px` }); return fin.offsetHeight * z <= bh + 0.5 && fin.scrollWidth <= bw / z + 1; };
    if (at(1)) return 1;
    if (!at(min)) return min;
    let lo = min, hi = 1;
    for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (at(m)) lo = m; else hi = m; }
    at(lo);
    return lo;
  }
  function sizeBoxes(boxes, arr, W, H, capsIn) {
    const nat = boxes.map(natOf), caps = capsIn || boxes.map(capOf), n = boxes.length;
    const out = nat.map(() => ({ w: 0, h: 0 }));
    const contain = (i, w, h) => {
      const t = nat[i];
      if (t.table) return { w: Math.floor(w), h: Math.floor(h) };
      if (t.k === 'code') {                                              // 코드는 칸 폭을 다 쓰고, 높이는 줄인 배율만큼
        const z = Math.max(t.min, Math.min(1, w / t.nw, h / t.nh));
        return { w: Math.floor(w), h: Math.ceil(t.nh * z) };
      }
      let bw = Math.min(w, h * t.ar);
      const lim = w <= h * t.ar ? 'w' : 'h';                             // 폭에 막힘(가로로 긴 그림) / 높이에 막힘(세로로 긴 그림)
      if (t.max !== Infinity && t.nw) bw = Math.min(bw, t.nw * t.max);
      return { w: Math.max(1, Math.floor(bw)), h: Math.max(1, Math.floor(bw / t.ar)), lim };
    };
    if (arr === 'one' || n === 1) out[0] = contain(0, W, H - caps[0]);
    else if (arr === 'col') {
      // 세로로 쌓기: 표는 똑같이 나눈 몫까지 받되 칸 폭에서의 실제 높이가 더 작으면 그만큼만(남는 높이는 다이어그램·그림에)
      const avail = H - GAP * (n - 1) - caps.reduce((a, c) => a + c, 0);
      const need = nat.map((t) => (t.table ? Math.min(avail / n, t.hAt(W)) : t.k === 'code' ? t.nh : W / t.ar));
      const f = Math.min(1, avail / Math.max(1, need.reduce((a, x) => a + x, 0)));
      nat.forEach((t, i) => { out[i] = contain(i, W, need[i] * f); });
    } else {
      const avail = W - GAP * (n - 1);
      const ars = nat.map((t) => (t.table ? 1.6 : t.ar));
      const hh = Math.min(avail / ars.reduce((a, x) => a + x, 0), H - Math.max(...caps));
      nat.forEach((t, i) => { out[i] = contain(i, hh * ars[i], t.k === 'code' ? H - caps[i] : hh); });
    }
    // 표가 받은 칸에서 실제로 몇 배로 보일지(fitTable로 잼) — 배치 점수용. 하한에서도 안 들어가면 0.01(그 배치를 피함)
    nat.forEach((t, i) => {
      if (!t.table) return;
      const fin = boxes[i].querySelector(':scope > .vmedia > .fit-in'), o = out[i];
      const z = fitTable(fin, o.w, o.h, t.min);
      o.z = fin.offsetHeight * z <= o.h + 0.5 && fin.scrollWidth <= o.w / z + 1 ? z : 0.01;
    });
    return { out, nat, caps };
  }
  // 시각 자료가 원래 크기의 몇 배로 보이는가(1 이상은 1). 배치 고르기 점수
  const scaleOf = (t, o) => (t.table ? (o.z ?? 0.9) : t.k === 'code' ? Math.min(1, o.w / t.nw, o.h / t.nh) : Math.min(1, o.w / (t.nw || 1600)));
  // 장면 점수 = 시각 자료마다 log(보이는 배율)의 합(PF.fitVisuals 뒤). 클수록 그림·코드가 크게 보임
  const visScore = (s) => [...s.querySelectorAll('.vbox[data-sc]')].reduce((x, b) => x + Math.log(Math.max(0.01, +b.dataset.sc)), 0);
  function fitVisuals(s) {
    const M = measureRoot(); const wasIn = s.isConnected; if (!wasIn) M.appendChild(s);
    s.classList.add('pf-sizing');
    const plans = [...s.querySelectorAll('.vis')].map((vis) => {
      const boxes = [...vis.children].filter((e) => e.classList.contains('vbox') && e.dataset.kind);
      // 원문을 찾지 못한 자리(.vbox.err, 띠만 있음)는 크기를 정하지 않으므로 그 높이를 칸에서 빼고 세로로 쌓음
      const errs = [...vis.children].filter((e) => e.classList.contains('vbox') && !e.dataset.kind);
      const errH = errs.reduce((a, e) => a + e.offsetHeight + GAP, 0);
      return { vis, boxes, W: vis.clientWidth, H: vis.clientHeight - errH, col: errs.length > 0 };
    });
    for (const { vis, boxes, W, H, col } of plans) {
      if (!boxes.length || !W || H <= 0) continue;
      const arrs = boxes.length === 1 ? ['one'] : col ? ['col'] : (vis.dataset.arr ? [vis.dataset.arr] : ['col', 'row']);
      let best = null;
      for (const a of arrs) {
        const r = sizeBoxes(boxes, a, W, H);
        const score = r.out.reduce((x, o, i) => x + Math.log(Math.max(0.01, scaleOf(r.nat[i], o))), 0);   // 모두가 고르게 크게(하나만 크고 하나는 아주 작은 배치를 피함)
        if (!best || score > best.score + 1e-6) best = { ...r, a, score };
      }
      // 캡션·원문 문제 띠는 상자 폭이 정해진 뒤 다시 잼: 세로로 긴 그림은 상자가 좁아 띠가 여러 줄로 꺾여 높아짐 → 그 높이로 다시 배분(최대 3번)
      for (let k = 0; k < 3; k++) {
        boxes.forEach((box, i) => { box.style.width = `${best.out[i].w}px`; });
        const caps = boxes.map(capOf);
        if (!caps.some((c, i) => c > best.caps[i] + 1)) break;
        best = { ...best, ...sizeBoxes(boxes, best.a, W, H, caps.map((c, i) => Math.max(c, best.caps[i]))) };
      }
      vis.dataset.arr = best.a;
      boxes.forEach((box, i) => {
        const o = best.out[i], t = best.nat[i], media = box.querySelector(':scope > .vmedia');
        box.style.width = `${o.w}px`;
        box.dataset.sc = scaleOf(t, o).toFixed(3);
        if (t.k === 'image' || t.k === 'mermaid') {
          Object.assign(media.style, { width: `${o.w}px`, height: `${o.h}px` });
          if (t.k === 'mermaid') {
            const eff = 16 * o.w / t.nw;
            box.dataset.eff = eff.toFixed(1);                                // 참고 지표는 최종 장면에서만(noteFill)
            box.dataset.lim = best.a === 'one' ? o.lim : 'multi';             // 다른 자료와 함께면 막힌 쪽이 아니라 '함께 있어서'가 원인
            box.dataset.vb = `${Math.round(t.nw)}×${Math.round(t.nw / t.ar)}`;
          }
        } else {
          const fin = media.querySelector(':scope > .fit-in');
          let z;
          if (t.k === 'code') { z = Math.max(t.min, Math.min(1, o.w / t.nw, o.h / t.nh)); Object.assign(fin.style, { zoom: String(z), width: `${o.w / z}px` }); }
          else z = fitTable(fin, o.w, o.h, t.min);
          fin.dataset.pfFz = z.toFixed(3);
          box.dataset.sc = z.toFixed(3);
        }
      });
    }
    s.classList.remove('pf-sizing');
    if (!wasIn) s.remove();
    return s;
  }

  // ── 프로젝트 소개 장면(포트폴리오 덱의 프로젝트 소개 = 발표 덱 표지, 결정 G4): 큰 대표 이미지 · 메타 격자 · 개발 의도 · 링크 카드 · 태그 ──
  //   글: title · tagline · meta · team.role · intent · tags(data 그대로). 링크: [{ k, label, href, kind, visible }]
  const META_EN = { '장르': 'GENRE', '기간': 'DURATION', '개발 기간': 'DURATION', '인원': 'TEAM', '팀': 'TEAM', '팀 구성': 'TEAM', '환경': 'ENVIRONMENT', '개발 환경': 'ENVIRONMENT', '엔진': 'ENGINE', '플랫폼': 'PLATFORM' };
  const metaEn = (label) => META_EN[String(label || '').replace(/\s+/g, ' ').trim()] || '';
  async function projectIntro(p, { id, titleTag = 'h2', eyebrow = 'PROJECT', links = [], foot = '', sec = '', group = '', stats, tpl = 'P1' }) {
    const d = p.cover ? (p.coverSize?.w ? p.coverSize : await imageSize(PF.srcPath(p.id, p.cover))) : null;
    const ar = d ? d.w / d.h : null;
    const variant = !p.cover || !ar ? 'nocover' : ar < 0.9 ? 'portrait' : 'landscape';
    const meta = (p.meta || []).map((m) => `<div class="mi"><dt class="meta-k">${metaEn(m.label) ? `${esc(metaEn(m.label))} · ` : ''}${esc(m.label)}</dt><dd>${inline(m.value)}</dd></div>`);
    if (p.team?.role) meta.push(`<div class="mi wide role"><dt class="meta-k">ROLE · 내 역할</dt><dd>${inline(p.team.role)}</dd></div>`);
    const intent = p.intent?.text ? `<div class="intent"><p class="lc-k">INTENT · 개발 의도</p><p class="it">${inline(p.intent.text)}</p></div>` : '';
    const cards = links.map((l) => `<div class="lcard">${PF.link({ href: l.href, kind: l.kind, label: `<span class="lc-k">${esc(l.k)}</span><span class="lc-t">${esc(l.label)}</span><span class="url">${esc(l.visible)}</span>` })}</div>`).join('');
    const tags = (p.tags || []).length ? `<ul class="tags">${p.tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    const cover = p.cover ? `<div class="media pi-cover"${ar ? ` style="aspect-ratio:${ar.toFixed(4)}"` : ''}>${imgTag(PF.srcPath(p.id, p.cover), p.title, d)}</div>` : '';
    const head = `<div class="pi-head"><${titleTag} class="pi-t">${esc(p.title)}</${titleTag}>${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}</div>`;
    const make = (tight, linksLeft) => {
      const s = scene({ id, tpl, kind: 'bare', cls: `${variant}${tight ? ' pi-tight' : ''}`, foot, sec, group, stitle: p.title });
      const right = `<div class="pi-right">${meta.length ? `<dl class="pi-meta">${meta.join('')}</dl>` : ''}${intent}${!linksLeft && cards ? `<div class="pi-links">${cards}</div>` : ''}${tags}</div>`;
      const left = `<div class="pi-left">${head}${cover}${linksLeft && cards ? `<div class="pi-links row">${cards}</div>` : ''}</div>`;
      body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">${esc(eyebrow)}</span><span class="rl">${esc(PF.teamLabel(p.team))}</span></div><div class="pi-main">${left}${right}</div>`;
      return s;
    };
    for (const tight of [false, true]) for (const linksLeft of variant === 'nocover' ? [false] : [false, true]) { const s = make(tight, linksLeft); if (fitsM(s)) return s; }
    return shrinkOrClip(make(true, true), window.PFScene.refUrl(id), stats);
  }

  // 발표 덱에서 원문 절(section 글자)에 해당하는 장면 id(포트폴리오 덱의 기능 카드 링크·옛 주소 hl-n 넘기기)
  const KEY_RE = /^[a-z][a-z0-9-]{1,31}$/;
  const keyOk = (k) => KEY_RE.test(k || '') && !/^s-\d+$/.test(k);
  function deckSceneFor(p, section) {
    const want = PF.normTitle(section);
    if (!want || !p.deck?.slides?.length) return '';
    const last = (x) => PF.normTitle((x.sectionPath || []).slice(-1)[0]);
    const find = (list) => list.find((x) => last(x) === want) || list.find((x) => (x.sectionPath || []).some((t) => PF.normTitle(t) === want));
    const sl = find(p.deck.slides);
    if (sl) return keyOk(sl.key) ? `d-${sl.key}` : '';
    // 장면 고치기로 숨긴 장면(빌드 결과 deck.base에만 있음) → 같은 장에 장면이 남아 있으면 그 장 표지
    const hid = find(p.deck.base || []);
    return hid && keyOk(hid.chapter) && p.deck.slides.some((x) => x.chapter === hid.chapter) ? `ch-${hid.chapter}` : '';
  }
  // 덱에 없는 장면 주소(#s=d-<key>·d-<key>-2·ch-<key>: 숨겼거나 다시 빌드로 없어짐) → 가장 가까운 장면(결정 G3 정신):
  //   나뉜 장면의 앞 장면 → 같은 절의 남은 장면 → 그 장 표지 → ''(목차는 부르는 쪽이 정함). has(id) = 그 장면이 덱에 있는가
  function deckSceneNear(p, want, has) {
    const m = /^d-(.+)$/.exec(want);
    if (!m) return '';
    const k = m[1], stem = k.replace(/-(\d+|t\d+)$/, '');
    if (stem !== k && has(`d-${stem}`)) return `d-${stem}`;
    const all = [...(p.deck?.base || []), ...(p.deck?.slides || [])];
    const sl = all.find((x) => x.key === k) || all.find((x) => x.key === stem);
    if (!sl) return '';
    const path = (x) => (x.sectionPath || []).map(PF.normTitle).join(' › ');   // 절 경로 전체(하위 제목 '개요'처럼 여러 절에 같은 이름이 있음)
    const same = (p.deck?.slides || []).find((x) => path(x) === path(sl) && has(`d-${x.key}`));
    if (same) return `d-${same.key}`;
    return sl.chapter && has(`ch-${sl.chapter}`) ? `ch-${sl.chapter}` : '';
  }

  Object.assign(PF, { sleep, loadFonts, imageSize, measureRoot, dropMeasure, scene, body, fitsScene, fitsM, pack, shrinkOrClip, guard, msgScene, DOT, imgTag, extLinks, refitOnLateFont,
                      projectIntro, note, fillOf, noteFill, vband, fitVisuals, visScore, minFonts, deckSceneFor, deckSceneNear, keyOk, FLOOR });
})();
