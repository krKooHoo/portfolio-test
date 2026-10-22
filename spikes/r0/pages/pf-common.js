// R0 시험대 공통 유틸 — 지금 렌더러 assets/common.js 규칙(이스케이프·경로·슬러그·제목 정규화)을 그대로 옮기고,
// 장면 공통 조각(장면 틀·측정용 컨테이너·측정 후 고르기·글꼴 대기·이미지 크기)을 더했습니다.
// 데이터 경로: 이 페이지는 spikes/r0/pages/에 있으므로 레포 루트는 ../../../ (pages → r0 → spikes → 루트)
const PF = (() => {
  const BASE = '../../../';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  const isUrl = (u) => /^https?:\/\//i.test(u || '');
  const shortUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  async function loadJSON(path) {
    const res = await fetch(BASE + path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} (HTTP ${res.status})`);
    return res.json();
  }
  async function loadText(path) {
    const res = await fetch(BASE + path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} (HTTP ${res.status})`);
    return res.text();
  }
  const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');
  const srcRel = (id, rel) => `src/${encodeURIComponent(id)}/${encodePath(String(rel).replace(/^\.\//, ''))}`;
  const srcPath = (id, rel) => BASE + srcRel(id, rel);
  const applyAccent = (hex) => { if (/^#[0-9a-f]{6}$/i.test(hex || '')) document.documentElement.style.setProperty('--accent', hex); };
  const teamLabel = (team) => (team?.type === 'team' ? `팀 프로젝트${team.size ? ' · ' + team.size : ''}` : '개인 프로젝트');
  const metaValue = (p, label) => (p.meta || []).find((m) => m.label === label)?.value || '';
  function slugger() {                                   // github-slugger 규칙(지금 렌더러와 같음)
    const seen = Object.create(null);
    return (text) => {
      const base = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '').replace(/ /g, '-');
      let slug = base;
      while (seen[slug] !== undefined) { seen[base] += 1; slug = `${base}-${seen[base]}`; }
      seen[slug] = 0;
      return slug;
    };
  }
  const normTitle = (t) => String(t || '').replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 글꼴(§6-2 2번): 굵기마다 load + 각각 catch → fonts.ready, 상한 8초. 실패하면 data-pf-font="fallback"
  async function loadFonts(sample = '가나다ABC123', ms = 8000) {
    const want = ['400', '600', '700', '800'].map((w) => `${w} 16px Pretendard`).concat(['400 14px D2Coding', '700 14px D2Coding']);
    const errs = [];
    const all = Promise.all(want.map((f) => document.fonts.load(f, sample).then((r) => { if (!r.length) errs.push(f + ' (일치 없음)'); }).catch((e) => errs.push(f + ' ' + e))))
      .then(() => document.fonts.ready);
    const timedOut = await Promise.race([all.then(() => false), sleep(ms).then(() => true)]);
    const ok = want.map((f) => document.fonts.check(f, '가'));
    if (timedOut || ok.some((x) => !x)) document.documentElement.dataset.pfFont = 'fallback';
    return { timedOut, errs, check: Object.fromEntries(want.map((f, i) => [f, ok[i]])) };
  }

  // 이미지 크기(§6-2 6번 대체 경로: data에 media w×h 기록이 없으므로 받아서 잼). rAF·decode() 금지 → setTimeout 폴링
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

  // 측정용 컨테이너(§6-2): 이 안의 장면은 배율 1
  let measure = null;
  function measureRoot() {
    if (!measure || !measure.isConnected) { measure = document.createElement('div'); measure.className = 'pf-measure'; measure.setAttribute('aria-hidden', 'true'); document.body.appendChild(measure); }
    return measure;
  }
  function dropMeasure() { measure?.remove(); measure = null; }

  // 장면 틀(§3-2). kind: 'sum'(머리 큰형) | 'doc'(머리줄형). 바닥글 번호는 키트가 mount에서 채움
  function scene({ tpl, part = 'summary', kind = 'sum', eyebrow = '', title = '', sub = '', crumb = '', cls = '', foot = '', titleId = '' }) {
    const s = document.createElement('section');
    s.className = `pf-scene pf-${kind} t-${tpl}${cls ? ' ' + cls : ''}`;
    s.dataset.pfTpl = tpl; s.dataset.pfPart = part;
    const head = kind === 'doc'
      ? `<header class="pf-head" data-pf-ui="chrome"><p class="pf-crumb">${crumb}</p></header>`
      : `<header class="pf-head" data-pf-ui="chrome">${eyebrow ? `<p class="pf-eyebrow">${esc(eyebrow)}</p>` : ''}${title ? `<h2 class="pf-title"${titleId ? ` id="${esc(titleId)}"` : ''}>${inline(title)}${sub ? `<span class="pf-part" data-pf-ui="cont" aria-hidden="true">${esc(sub)}</span>` : ''}</h2>` : ''}</header>`;
    s.innerHTML = `${head}<div class="pf-body${kind === 'doc' ? ' pf-md' : ''}"></div>` +
      `<footer class="pf-foot" data-pf-ui="chrome"><span>${esc(foot)}</span><span class="pf-num"><span class="pf-n-screen"></span><span class="pf-n-print"></span></span></footer>`;
    return s;
  }
  const body = (s) => s.querySelector(':scope > .pf-body');
  // 장면이 넘치지 않는가(배치용: 이미지 로딩·숨김 검사는 빼고 키트 감사의 배치 항목만)
  const fitsScene = (s) => window.PFScene.sceneIssues(s, { layoutOnly: true }).length === 0;

  // 측정 후 고르기(§4-3 원칙 1): 항목을 장면에 하나씩 넣어 보고, 우선순위대로 변형을 시험해 넘치지 않는 첫 변형을 씀
  //   build(chunk, variant, i, n) → 장면 요소(측정 컨테이너에 붙여서 잼). variants: [{ name, min, max }]
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
    // 균형: 마지막 장면이 1개뿐이고 앞 장면이 3개 이상이면 하나 옮김(옮긴 뒤에도 맞을 때만)
    if (pages.length > 1) {
      const a = pages[pages.length - 2], b = pages[pages.length - 1];
      if (b.length === 1 && a.length >= 3) { const na = a.slice(0, -1), nb = [a[a.length - 1], ...b]; if (tryFit(na) && tryFit(nb)) { pages[pages.length - 2] = na; pages[pages.length - 1] = nb; } }
    }
    return pages.map((chunk) => ({ chunk, variant: tryFit(chunk) }));   // variant null = 가장 넓은 변형에도 안 들어감(원칙 5로)
  }

  // §4-3 원칙 5의 ②③: 장면 본문을 글자 하한(15px)까지 비례 축소 → 그래도 넘치면 보이는 잘림 띠 + 리포트
  function shrinkOrClip(s, srcUrl, stats) {
    const b = body(s);
    const M = measureRoot(); const wasIn = s.isConnected; if (!wasIn) M.appendChild(s);
    let z = 1;
    if (!fitsScene(s)) {                                 // 본문 자체에 zoom을 걸면 상자도 같이 줄어 효과가 없으므로 안쪽 감싸개에 걸고 크기를 1/z로
      stats?.push({ tpl: s.dataset.pfTpl, action: 'overflow', issues: window.PFScene.sceneIssues(s, { layoutOnly: true }).slice(0, 4) });
      const w = document.createElement('div'); w.className = 'pf-zoomwrap'; w.append(...b.childNodes); b.appendChild(w);
      const bw = b.clientWidth, bh = b.clientHeight;
      while (!fitsScene(s) && z > 15 / 16 + 1e-9) {
        z = Math.max(+(z - 0.01).toFixed(2), 15 / 16);
        Object.assign(w.style, { zoom: String(z), width: `${bw / z}px`, height: `${bh / z}px` });
      }
      stats?.push({ tpl: s.dataset.pfTpl, action: 'shrink', zoom: +z.toFixed(4) });
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

  return { BASE, esc, inline, isUrl, shortUrl, loadJSON, loadText, srcRel, srcPath, applyAccent, teamLabel, metaValue, slugger, normTitle, sleep,
           loadFonts, imageSize, measureRoot, dropMeasure, scene, body, fitsScene, pack, shrinkOrClip };
})();
