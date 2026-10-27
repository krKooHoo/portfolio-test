// 발표 덱(project.html?p=<폴더 이름>) — 기술 문서를 바탕으로 한 16:9 발표 슬라이드(결정 G1·G2·G6·G11)
//   장면 순서: 표지(cover) → 목차(toc) → [장 표지(ch-<장 key>) → 장면(d-<key>, 나뉘면 d-<key>-2…)] × 장 → 결과와 회고(retro) → 맺음(end)
//   장면 목록은 data/projects/<id>.json의 deck(/portfolio-build가 원문을 읽고 고름). 그림·코드·표·이미지는 원문 md 블록을 가리키기만 하고
//   여기서 원문을 찾아 **그대로** 그립니다(PF.md, 규칙은 .claude/skills/portfolio-build/schema.md 「발표 덱」). 장면 글은 deck의 글 조각뿐입니다.
//   deck이 없는 예전 데이터는 highlights·troubleshooting·screenshots·retro로 자동 구성하고 장면마다 띠로 알립니다.
//   옛 주소(#s=hl-n·ts-n·shots·more, #pf-*)는 가까운 장면으로 넘기고, 옛 기술 문서 제목 앵커는 상세 문서로 보냅니다(결정 G3).
//   상세 문서 링크는 표지와 맺음 장면에만 둡니다(결정 G1). 새 문장·수치를 만들지 않습니다(장면 이름·라벨은 UI 글자 — 문구 표 PF.t).
//   data의 탭·카드 라벨은 PF.tab()·PF.label()로 보여 주기만 바꾸고, 칩 색(FLOW)은 data 값 그대로 판정합니다.
//   주석의 설계 근거(docs/design/…, 결정 F·G·Q 번호)는 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.
(() => {
  const Q = new URLSearchParams(location.search);
  const id = Q.get('p');
  const deck = document.getElementById('deck');
  const info = (PFScene.info = { page: 'project', id, t: {}, summary: {}, overflow: [], errors: [], unresolved: [], notes: [], mode: '' });
  const mark = (k) => { info.t[k] = Math.round(performance.now()); };
  const { esc, inline, shortUrl, DOT, link } = PF;
  const MAXL = 20;                                                     // 코드 한 장면 20줄 안팎(Q8), 넘으면 "계속" 장면

  // ── 옛 주소(결정 G3) ──
  //   #s=… · #<숫자> · #s-n · 새 장면 id → 덱이 받음(옛 장면 id는 그린 뒤 remapHash가 바꿈) / #pf-doc → 상세 문서 /
  //   #pf-highlights 등 → 옛 장면 id로 바꾼 뒤 같은 처리 / 그 밖(옛 기술 문서 제목 앵커) → 상세 문서의 같은 조각
  const SCENE = /^(cover|toc|ch-[a-z][a-z0-9-]*|d-[a-z0-9-]+|retro(-\d+)?|end|notice|hl-\d+(-\d+)?|ts-\d+(-\d+)?|shots(-\d+)?|more)$/;
  const LEGACY = { 'pf-highlights': 'hl-1', 'pf-troubleshooting': 'ts-1', 'pf-screenshots': 'shots', 'pf-retro': 'retro' };
  const redirected = (() => {
    if (!id || !location.hash || location.hash === '#') return false;
    const rawEnc = location.hash.slice(1);
    let raw = rawEnc; try { raw = decodeURIComponent(rawEnc); } catch { /* 그대로 */ }
    if (/^s=/.test(raw) || /^-?\d+$/.test(raw) || /^s-\d+$/.test(raw) || SCENE.test(raw)) return false;
    if (raw === 'pf-doc') { location.replace(PF.docUrl(id)); return true; }
    if (LEGACY[raw]) { try { history.replaceState(null, '', `${location.pathname}${location.search}#s=${LEGACY[raw]}`); } catch { /* */ } return false; }
    location.replace(PF.docUrl(id, rawEnc));
    return true;
  })();
  if (redirected) return;

  PFScene.track(start().catch((err) => {
    info.errors.push(String(err && err.stack || err));
    deck.replaceChildren(PF.msgScene({ title: '페이지를 그리지 못했습니다', html: `<p>${esc(err && err.message || err)}</p>` }));
  }).finally(async () => {
    await PF.loadStrings();                                            // 아래 띠(HUD)도 문구 표로 — 안내 장면으로 끝난 경우에도
    info.strings = PF.stringsReport();
    PF.dropMeasure(); mmdHost?.remove();
    PFScene.mount({ deck: '#deck', hint: link({ href: id ? PF.docUrl(id) : 'index.html', label: esc(PF.t('deck.mobile-doc')), kind: 'page' }) }); mark('mounted');
  }));

  async function start() {
    mark('start');
    if (PF.isFile()) { deck.replaceChildren(PF.msgScene({ title: '로컬 서버로 열어 주세요', html: PF.FILE_HELP })); return; }
    const strings = PF.loadStrings();
    const back = `<p>${link({ href: 'index.html', label: '← 포트폴리오로', kind: 'page' })}</p>`;
    if (!id) { deck.replaceChildren(PF.msgScene({ title: '프로젝트를 고르세요', html: `<p>주소 끝에 <code>?p=폴더이름</code>을 붙여 주세요.</p>${back}` })); return; }
    const pf = await PF.loadJSON('data/portfolio.json').catch(() => ({}));
    PF.applyTheme(pf.settings?.accent);
    let p;
    try { p = await PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`); }
    catch (err) { deck.replaceChildren(PF.msgScene({ title: '프로젝트를 찾을 수 없습니다', html: `<p>${esc(err.message)}</p>${back}` })); return; }
    let md = null;
    try { md = await PF.loadText(PF.srcPath(p.id, p.doc)); }
    catch (e) {
      info.errors.push('doc: ' + e.message);
      deck.replaceChildren(PF.msgScene({ title: '기술 문서 파일을 찾지 못했습니다', eyebrow: 'PROJECT',
        html: `<p>데이터에 적힌 기술 문서(<code>src/${esc(p.id)}/${esc(p.doc || '')}</code>)를 열 수 없습니다. <code>src/</code> 폴더를 확인한 뒤 <code>/portfolio-build</code>를 다시 실행해 주세요.</p><p class="pf-note-err">${esc(e.message)}</p>${back}` }));
      return;
    }
    const P = PF.md.parse(md, p.id);
    info.headings = P.headings.length;
    await strings;
    mark('data');
    const render = () => renderAll(pf, p, P);
    await render();
    PF.refitOnLateFont(render);
  }

  // ── 장면 모델: deck(schemaVersion 2) 또는 자동 구성 ──
  const firstOf = (P, section) => { const hs = PF.md.findSection(P, [section]); return hs.length === 1 ? PF.md.firstVisual(P, hs[0]) : null; };
  function modelOf(p, P) {
    if (p.schemaVersion >= 2 && p.deck?.slides?.length) {
      info.mode = 'deck';
      const chapters = (p.deck.chapters || []).map((c) => ({ ...c, slides: [] }));
      const byKey = new Map(chapters.map((c) => [c.key, c]));
      p.deck.slides.forEach((sl) => {
        let c = byKey.get(sl.chapter);
        if (!c) { c = { key: sl.chapter || 'etc', title: '', sectionPath: [], slides: [] }; byKey.set(c.key, c); chapters.push(c); }
        c.slides.push(sl);
      });
      return chapters.filter((c) => c.slides.length);
    }
    // 예전 데이터 자동 구성(schema.md 「예전 데이터」): 절이 정확히 1곳으로 풀릴 때만 그 절의 첫 그림을 붙임
    info.mode = 'auto';
    const T = (text) => (text ? { text, verbatim: true } : null);
    const vis = (section) => { const v = firstOf(P, section); return v ? [{ ...v, _el: v.el, sectionPath: [section] }] : []; };
    const out = [];
    const hl = p.highlights || [], ts = p.troubleshooting || [], shots = p.screenshots || [];
    if (hl.length) out.push({ key: 'hl', title: '핵심 구현', slides: hl.map((h, i) => ({ key: `hl-${i + 1}`, layout: 'visual', tab: '구현', title: T(h.title), sectionPath: h.section ? [h.section] : [],
      points: [['기능', h.what], ['구현', h.how], ['이유', h.why]].filter(([, t]) => t).map(([label, text]) => ({ label, text })), visuals: h.section ? vis(h.section) : [] })) });
    if (ts.length) out.push({ key: 'ts', title: '이슈 해결', slides: ts.map((t, i) => ({ key: `ts-${i + 1}`, layout: 'problem', tab: '문제 해결', title: T(t.title), sectionPath: t.section ? [t.section] : [],
      points: [['문제', t.problem], ['원인', t.cause], ['해결', t.solution], ['결과', t.result], ['배운 점', t.lesson]].filter(([, x]) => x).map(([label, text]) => ({ label, text })), visuals: t.section ? vis(t.section) : [] })) });
    if (shots.length) {
      const sl = [];
      for (let i = 0; i < shots.length; i += 3) sl.push({ key: i ? `shots-${i / 3 + 1}` : 'shots', layout: 'screens', tab: '화면', title: T('실제 화면'), sectionPath: [],
        points: shots.slice(i, i + 3).map((s) => ({ label: '', text: s.caption || '' })), visuals: shots.slice(i, i + 3).map((s) => ({ kind: 'image', direct: true, src: s.src, w: s.w, h: s.h })) });
      out.push({ key: 'screens', title: '실제 화면', slides: sl });
    }
    return out;
  }

  // ── 원문 블록 → 장면에 넣을 준비(이미지 크기·다이어그램 SVG를 미리 구함) ──
  let mmdHost = null;
  const svgCache = new Map();
  async function renderMermaid(els) {
    if (!els.length) return;
    if (!window.mermaid) { els.forEach((el) => svgCache.set(el, { error: 'Mermaid를 불러오지 못했습니다' })); return; }
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'Pretendard, sans-serif', suppressErrorRendering: true });
    if (!mmdHost) { mmdHost = document.createElement('div'); mmdHost.setAttribute('aria-hidden', 'true'); Object.assign(mmdHost.style, { position: 'absolute', left: '-20000px', top: '0', width: '1280px', visibility: 'hidden' }); document.body.appendChild(mmdHost); }
    let n = 0;
    for (const el of els) {
      if (svgCache.has(el)) continue;
      const text = el.querySelector('code')?.textContent || '';
      try { const { svg } = await mermaid.render(`dk-mmd-${n++}`, text, mmdHost); svgCache.set(el, { svg }); }
      catch (err) { svgCache.set(el, { error: String(err?.message || err).split('\n')[0].slice(0, 120) }); info.errors.push('mermaid: ' + (err?.message || err)); }
    }
    mmdHost.replaceChildren();
  }
  async function resolveVisuals(model, P, p) {
    const mm = [];
    for (const c of model) for (const sl of c.slides) {
      sl._v = (await Promise.all((sl.visuals || []).map(async (ref) => {
        if (ref.direct) { const d = ref.w && ref.h ? { w: ref.w, h: ref.h } : await PF.imageSize(PF.srcPath(p.id, ref.src)); return { ref, status: 'ok', src: PF.srcPath(p.id, ref.src), d }; }
        const r = ref._el ? { status: 'ok', el: ref._el } : PF.md.pick(P, ref, sl.sectionPath || []);
        if (r.status === 'missing' || r.status === 'ambiguous') { info.unresolved.push(`${sl.key}: ${r.detail}`); return { ref, ...r }; }
        if (ref.kind === 'mermaid') mm.push(r.el);
        if (ref.kind === 'image') { const src = r.el.getAttribute('src'); const d = ref.w && ref.h ? { w: ref.w, h: ref.h } : await PF.imageSize(src); return { ref, ...r, src, d }; }
        // 표 안 그림: 불러오기 전 높이로 재면 나중에 표가 커져 조용히 잘림 → 크기를 먼저 받아 두고 복제본에 width·height를 적음(vboxHtml)
        if (ref.kind === 'table' && r.el) return { ref, ...r, imgDims: await Promise.all([...r.el.querySelectorAll('img')].map((i) => PF.imageSize(i.getAttribute('src')))) };
        return { ref, ...r };
      }))).map((v) => (sl.edited ? { ...v, edited: true } : v));             // 장면 고치기로 고친 장면: 원문 문제 띠 문구가 다름
    }
    await renderMermaid(mm);
  }

  // ── 시각 자료 HTML(.vbox). 코드는 줄 범위를 잘라 조각마다 강조 ──
  const LANG = { csharp: 'C#', cs: 'C#', js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', html: 'HTML', css: 'CSS', python: 'Python', py: 'Python', bash: 'Shell', sh: 'Shell', powershell: 'PowerShell', hlsl: 'HLSL', shader: 'Shader', cpp: 'C++', c: 'C', lua: 'Lua' };
  const codeLines = (el) => { const t = (el.querySelector('code')?.textContent || '').replace(/\n$/, ''); return t.split('\n'); };
  const langOf = (el) => /language-([\w+#-]+)/.exec(el.querySelector('code')?.className || '')?.[1]?.toLowerCase() || '';
  function codeHtml(el, a, b) {
    const lang = langOf(el), text = codeLines(el).slice(a - 1, b).join('\n');
    const code = document.createElement('code');
    code.textContent = text;
    if (lang && window.hljs && hljs.getLanguage(lang)) { code.className = `language-${lang}`; try { hljs.highlightElement(code); } catch { /* 강조 없이 */ } }
    return code.outerHTML;
  }
  function vboxHtml(v, chunk) {
    if (v.status === 'missing' || v.status === 'ambiguous') return `<figure class="vbox err">${PF.vband(`visual-${v.status}`, v.detail, v.edited)}</figure>`;
    const warn = v.status === 'changed' ? PF.vband('visual-changed', v.detail, v.edited) : '';
    const cap = (t) => (t ? `<figcaption class="cap">${t}</figcaption>` : '');
    const k = v.ref.kind;
    if (k === 'image') {
      const alt = v.ref.caption?.text || v.el?.getAttribute('alt') || '';
      return `<figure class="vbox" data-kind="image"${v.d ? ` data-w="${v.d.w}" data-h="${v.d.h}"` : ''}><div class="vmedia">${PF.imgTag(v.src, alt, v.d)}</div>${cap(inline(alt))}</figure>`;
    }
    if (k === 'mermaid') {
      const r = svgCache.get(v.el) || {};
      if (!r.svg) return `<figure class="vbox err">${PF.vband('visual-missing', `다이어그램을 그리지 못했습니다: ${r.error || ''}`)}</figure>`;
      return `<figure class="vbox" data-kind="mermaid"><div class="vmedia">${r.svg}</div>${cap(v.ref.caption?.text ? inline(v.ref.caption.text) : '')}${warn}</figure>`;
    }
    if (k === 'code') {
      const all = codeLines(v.el).length, [a, b] = chunk;
      const lang = LANG[langOf(v.el)] || '';
      const part = a > 1 || b < all ? PF.t('deck.code-lines', { a, b, all }) : '';
      return `<figure class="vbox" data-kind="code"><div class="vmedia"><div class="fit-in"><pre>${codeHtml(v.el, a, b)}</pre></div></div>${cap([lang, part].filter(Boolean).map(esc).join(' · '))}${warn}</figure>`;
    }
    if (k === 'table') {
      const t = v.el.cloneNode(true);
      t.classList.add('md-table');
      t.querySelectorAll('img').forEach((i, n) => {                       // 행을 나누기 전에(원본과 같은 순서로) 크기를 적음
        const d = v.imgDims?.[n];
        if (d) { const h = Math.min(d.h, 120); i.width = Math.round((h * d.w) / d.h); i.height = h; }   // CSS max-height 120px와 같은 크기
        i.loading = 'lazy'; i.decoding = 'async';
      });
      if (chunk) { const rows = [...t.querySelectorAll('tbody tr')]; rows.forEach((r, i) => { if (i < chunk[0] || i >= chunk[1]) r.remove(); }); }
      return `<figure class="vbox" data-kind="table"><div class="vmedia"><div class="fit-in">${t.outerHTML}</div></div>${cap(v.ref.caption?.text ? inline(v.ref.caption.text) : '')}${warn}</figure>`;
    }
    return '';
  }

  // ── 장면 틀(deck.slides[].layout) ──
  const txt = (t) => (t && typeof t === 'object' ? t.text : t) || '';
  const ncards = (points, { row = false, num = true, two = false } = {}) => (points.length
    ? `<div class="cards${row ? ' row' : ''}${two ? ' two' : ''}" style="--n:${Math.min(points.length, 4)}">${points.map((pt, i) =>
      `<div class="ncard${num ? '' : ' nonum'}">${num ? `<span class="num" aria-hidden="true">${i + 1}</span>` : ''}<div>${pt.label ? `<span class="lb">${esc(PF.label(pt.label))}</span>` : ''}<p>${inline(txt(pt))}</p></div></div>`).join('')}</div>` : '');
  const FLOW = { '문제': '', '원인': '', '해결': 'accent', '결과': 'ok', '배운 점': '' };   // data 값 → 칩 색(보이는 글자만 PF.label로 바뀜)
  const flowHtml = (points, dir) => `<div class="flow ${dir}" style="--n:${Math.min(points.length, 4)}">${points.map((pt) =>
    `<div class="fstep${pt.label === '결과' ? ' res' : ''}">${pt.label ? `<span class="labelchip${FLOW[pt.label] ? ' ' + FLOW[pt.label] : ''}">${esc(PF.label(pt.label))}</span>` : ''}<p>${inline(txt(pt))}</p></div>`).join('')}</div>`;
  function bodyHtml(sl, vs, variant) {
    const points = sl.points || [];
    const vis = (list) => `<div class="vis">${list.join('')}</div>`;
    const tight = variant.tight ? ' tight' : '';
    if (!vs.length) {
      if (sl.layout === 'problem') return `<div class="dk dk-text${tight}">${flowHtml(points, variant.stack || variant.tight ? 'row' : 'col')}</div>`;
      return `<div class="dk dk-text${tight}">${ncards(points, { two: points.length >= 3 && !variant.stack, num: sl.layout !== 'overview' })}</div>`;
    }
    if (sl.layout === 'screens') {
      return `<div class="dk scr-row${tight}" style="--n:${vs.length}">${vs.map((v, i) => `<div class="fe-card">${vis([v])}${points[i] ? `<p class="fe-k">${esc(PF.t('en.feature'))} ${String(i + 1).padStart(2, '0')}</p>${points[i].label ? `<h3>${esc(PF.label(points[i].label))}</h3>` : ''}${txt(points[i]) ? `<p>${inline(txt(points[i]))}</p>` : ''}` : ''}</div>`).join('')}</div>`;
    }
    if (sl.layout === 'problem') {
      if (variant.stack || !points.length) return `<div class="dk dk-stack${tight}">${vis(vs)}${points.length ? flowHtml(points, 'row') : ''}</div>`;
      return `<div class="dk dk-side flip${tight}" style="--vw:${variant.vw}fr">${vis(vs)}${flowHtml(points, 'col')}</div>`;
    }
    // 요점이 없으면(나눈 장면 등) 옆 칸이 비지 않게 시각 자료를 가로 전체로
    if (sl.layout === 'full' || variant.stack || !points.length) return `<div class="dk dk-stack${tight}">${vis(vs)}${ncards(points, { row: true, num: sl.layout !== 'full' })}</div>`;
    return `<div class="dk dk-side${tight}" style="--vw:${variant.vw}fr">${vis(vs)}${ncards(points, { num: true })}</div>`;
  }

  // 장면 하나(나뉠 수 있음): 코드 줄 범위 20줄 단위, 표는 넘치면 행을 반으로
  function slideScenes(sl, sid, meta) {
    const vis = sl._v || [];
    const code = vis.find((v) => v.ref.kind === 'code' && (v.status === 'ok' || v.status === 'changed'));
    let chunks = [null];
    if (code) {
      const n = codeLines(code.el).length;
      let [a, b] = Array.isArray(code.ref.lines) && code.ref.lines.length === 2 ? code.ref.lines : [1, n];
      a = Math.max(1, Math.min(a, n)); b = Math.max(a, Math.min(b, n));
      chunks = [];
      const len = b - a + 1, parts = Math.ceil(len / MAXL);
      for (let i = 0; i < parts; i++) { const s0 = a + Math.round((len * i) / parts), e0 = a + Math.round((len * (i + 1)) / parts) - 1; chunks.push([s0, e0]); }
      if (parts > 1) PF.note(sid, 'long-code', len, `코드 ${len}줄을 장면 ${parts}개로 나눔`);
    }
    const out = [];
    chunks.forEach((ch, ci) => {
      const part = chunks.length > 1 ? `${ci + 1}/${chunks.length}` : '';
      const myId = ci ? `${sid}-${ci + 1}` : sid;
      const list = vis.filter((v) => !(ci > 0 && v.ref.kind !== 'code'));            // 나뉜 뒤쪽 장면은 코드만
      const me = { ...sl, points: ci ? [] : sl.points || [], layout: ci ? 'full' : sl.layout };
      out.push(...fitSlide(me, list, myId, part, ch, meta));
    });
    return out;
  }
  function fitSlide(sl, vis, sid, part, codeChunk, meta, tableChunk = null, depth = 0) {
    const vs = vis.map((v) => vboxHtml(v, v.ref.kind === 'code' ? codeChunk : v.ref.kind === 'table' ? tableChunk : null));
    const V = sl.layout === 'full' || sl.layout === 'screens' ? [{}, { tight: true }]
      : [{ vw: 1.4 }, { vw: 1.7 }, { vw: 1.15 }, { vw: 1.4, tight: true }, { stack: true }, { stack: true, tight: true }];
    const build = (v) => {
      const s = PF.scene({ id: sid, tpl: 'D', eyebrow: meta.chapter, rlabel: meta.rlabel, title: txt(sl.title) || meta.chapter, sub: part, lead: part && part !== `1/${part.split('/')[1]}` ? '' : txt(sl.lead), foot: meta.foot, sec: meta.chapter, group: meta.chapter, stitle: txt(sl.title) });
      s.classList.add(`l-${sl.layout || 'visual'}`);
      if (meta.err) s.dataset.pfErr = meta.err;
      if (sl.edited) s.dataset.pfEdited = '1';                       // 장면 고치기로 고친 장면(미리보기 개요에 ✎)
      PF.body(s).innerHTML = `<div class="pf-fill">${bodyHtml(sl, vs, v)}</div>`;
      if (meta.auto) s.querySelector('.pf-foot > span').insertAdjacentHTML('beforeend', '<span class="pf-autoband" data-pf-ui="note">예전 데이터로 자동 구성 — /portfolio-build를 다시 실행하면 발표 덱이 됩니다</span>');
      return PF.fitVisuals(s);
    };
    // 들어가는 변형 중 시각 자료가 가장 크게 보이는 것(같으면 앞의 것). 가로로 긴 다이어그램은 위아래 배치가, 세로로 긴 것은 옆 배치가 이김
    let best = null;
    for (const v of V) { const s = build(v); if (!PF.fitsM(s)) continue; const sc = PF.visScore(s); if (!best || sc > best.sc + 0.05) best = { s, sc }; }
    if (best) return [best.s];
    // 표가 하한에서도 안 들어가면 행을 반으로 나눠 "계속" 장면으로
    const tbl = vis.find((v) => v.ref.kind === 'table' && v.el);
    if (tbl && depth < 3) {
      const rows = tableChunk ? tableChunk : [0, tbl.el.querySelectorAll('tbody tr').length];
      if (rows[1] - rows[0] >= 4) {
        const mid = rows[0] + Math.ceil((rows[1] - rows[0]) / 2);
        const a = fitSlide(sl, vis, sid, part, codeChunk, meta, [rows[0], mid], depth + 1);
        const b = fitSlide({ ...sl, points: [], lead: null, layout: 'full' }, vis.filter((v) => v === tbl), `${sid}-t${depth + 1}`, part, codeChunk, meta, [mid, rows[1]], depth + 1);
        return [...a, ...b];
      }
    }
    return [PF.shrinkOrClip(build(V[V.length - 1]), PFScene.refUrl(sid), info.overflow)];
  }

  async function renderAll(pf, p, P) {
    info.notes = []; info.overflow = []; info.unresolved = [];
    const name = pf.profile?.name || '';
    const foot = `${name ? name + ' · ' : ''}${p.title}`;
    document.title = `${p.title} · ${PF.t('name.deck')}${name ? ' · ' + name : ''}`;
    info.fonts = await PF.loadFonts();
    mark('fonts');
    const model = modelOf(p, P);
    await resolveVisuals(model, P, p);
    mark('visuals');
    const auto = info.mode === 'auto';
    const ext = PF.extLinks(p);
    const used = new Set(['cover', 'toc', 'retro', 'end']);

    // 표지 = 프로젝트 소개 템플릿(PF.projectIntro, 결정 G4). 상세 문서 링크는 표지·맺음에만(G1)
    const cards = [
      ...ext.map((l) => ({ k: PF.extEn(l), label: l.label, href: l.url, kind: 'external', visible: shortUrl(l.url) })),
      { k: PF.t('en.techdoc'), label: PF.t('name.doc'), href: PF.docUrl(p.id), kind: 'page', visible: PF.visibleUrl(PF.docUrl(p.id)) },
      { k: PF.t('en.portfolio'), label: PF.t('name.portfolio'), href: 'index.html', kind: 'page', visible: PF.visibleUrl('') },
    ];
    const cover = await PF.projectIntro(p, { id: 'cover', titleTag: 'h1', eyebrow: PF.t('deck.cover-eyebrow'), links: cards, foot, sec: PF.t('deck.cover'), stats: info.overflow });
    if (auto) cover.querySelector('.pf-foot > span').insertAdjacentHTML('beforeend', '<span class="pf-autoband" data-pf-ui="note">예전 데이터로 자동 구성 — /portfolio-build를 다시 실행하면 발표 덱이 됩니다</span>');

    // 장 → 장 표지 + 장면들
    const chapterScenes = [];
    const tocItems = [];
    model.forEach((c, ci) => {
      const ckey = PF.keyOk(c.key) ? c.key : `c${ci + 1}`;
      let chId = `ch-${ckey}`; if (used.has(chId)) chId = `ch-c${ci + 1}`; used.add(chId);
      const slides = [];
      c.slides.forEach((sl, si) => {
        let sid = PF.keyOk(sl.key) ? `d-${sl.key}` : `d${ci + 1}-${si + 1}`, err = '';
        if (!PF.keyOk(sl.key)) err = `key-invalid: "${sl.key || ''}"`;
        if (used.has(sid)) { err = `key-invalid: "${sl.key}" 중복`; sid = `d${ci + 1}-${si + 1}`; }
        used.add(sid);
        const rl = [PF.tab(sl.tab), `${si + 1}/${c.slides.length}`].filter(Boolean).join(' · ');
        const scenes = slideScenes(sl, sid, { chapter: c.title || '', rlabel: rl, foot, auto, err });
        scenes.forEach((s) => used.add(s.id));
        slides.push({ sl, scenes });
      });
      const chs = chapterScene(c, ci, chId, slides, foot, auto, p.title);
      chapterScenes.push(chs, ...slides.flatMap((x) => x.scenes));
      tocItems.push({ c, chId, n: slides.reduce((a, x) => a + x.scenes.length, 0) });
    });
    const retro = buildRetro(p.retro || {}, p, foot, auto);
    const end = endScene(p, foot, ext, auto);
    const toc = tocScene(p, foot, tocItems, retro, auto);
    const all = [cover, toc, ...chapterScenes, ...retro, end];
    PF.noteFill(all, { fill: !auto });                                  // 예전 데이터 자동 구성은 채움률 참고를 내지 않음(다시 빌드 안내 1건만)
    if (auto) PF.note('cover', 'auto-mode', 1, '예전 데이터로 자동 구성(다시 빌드하면 발표 덱)');
    else if (all.length > 30) PF.note('cover', 'many-scenes', all.length, `장면 ${all.length}장(권장 15~30장)`);
    Object.assign(info.summary, { scenes: all.length, chapters: model.length, slides: model.reduce((a, c) => a + c.slides.length, 0), mode: info.mode });
    mark('summary');
    remapHash(p, all, model);
    deck.replaceChildren(...all);
    deck.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('loading')) i.loading = 'lazy'; i.decoding = 'async'; });
    mark('assembled');
  }

  // 옛 장면 id(#s=hl-n …)·없는 장면 id(#s=d-<key>·ch-<key>) → 새 장면 id. 마운트 전에 주소만 바꿈(키트가 그 장면으로 이동)
  function remapHash(p, scenes, model) {
    let raw = location.hash.slice(1); try { raw = decodeURIComponent(raw); } catch { /* */ }
    const m = /^(?:s=)?(.+)$/.exec(raw); if (!m) return;
    const want = m[1];
    if (scenes.some((s) => s.id === want)) return;
    let to = '';
    const hm = /^(hl|ts)-(\d+)/.exec(want);
    if (hm) {
      const list = hm[1] === 'hl' ? p.highlights || [] : p.troubleshooting || [];
      const it = list[+hm[2] - 1];
      to = info.mode === 'auto' ? `d-${hm[1]}-${hm[2]}` : it ? PF.deckSceneFor(p, it.section) : '';
      if (!to && it?.section) {                                          // 같은 장(H2)의 장 표지
        const ch = model.find((c) => (c.slides || []).some((x) => (x.sectionPath || []).some((t) => PF.normTitle(t) === PF.normTitle(it.section))));
        if (ch) to = scenes.find((s) => s.dataset.group === ch.title && s.classList.contains('t-CH'))?.id || '';
      }
    } else if (/^shots/.test(want)) to = scenes.find((s) => s.classList.contains('l-screens'))?.id || '';
    else if (want === 'more') to = 'end';
    else if (/^retro/.test(want)) to = 'retro';
    else if (/^d-/.test(want)) to = PF.deckSceneNear(p, want, (id) => scenes.some((s) => s.id === id));   // 숨겼거나 다시 빌드로 없어진 장면
    if (!to || !scenes.some((s) => s.id === to)) to = /^(hl|ts|shots|more|retro|d-|ch-)/.test(want) ? 'toc' : '';
    if (to) try { history.replaceState(null, '', `${location.pathname}${location.search}#s=${encodeURIComponent(to)}`); } catch { /* */ }
  }

  // 목록 한 줄(같은 덱 안 이동 = 같은 탭). 쪽 번호(p.N)는 키트가 채움
  //   ld = 장 표지 넉넉한 변형에서 그 장면의 도입(lead, 데이터의 글 조각 그대로)
  const item = (n, t, d, ref, ld = '') => `<li><a href="#${esc(ref)}" data-pf-ref="${esc(ref)}"><span class="n">${esc(n)}</span><span class="tx"><span class="t">${inline(t)}</span>${d ? `<span class="d">${esc(d)}</span>` : ''}${ld ? `<span class="ld">${inline(ld)}</span>` : ''}</span><span class="pg"><span class="pf-n-screen">p.00</span><span class="pf-n-print"></span></span></a></li>`;
  const band = (s, auto) => { if (auto) s.querySelector('.pf-foot > span').insertAdjacentHTML('beforeend', '<span class="pf-autoband" data-pf-ui="note">예전 데이터로 자동 구성</span>'); return s; };

  // 장 표지: 장면이 적으면(4개 이하) 넉넉한 변형 — 목차 크기 목록 + 장면마다 도입(결정 I7). 안 들어가면 보통 → 촘촘
  const ROOMY_MAX = 4;
  function chapterScene(c, ci, chId, slides, foot, auto, ptitle) {
    const make = (mode) => {
      const s = PF.scene({ id: chId, tpl: 'CH', kind: 'bare', cls: mode === 'compact' ? 'compact' : '', foot, sec: c.title, group: c.title, stitle: c.title });
      const roomy = mode === 'roomy';
      const list = slides.map((x, i) => item(String(i + 1), txt(x.sl.title) || c.title, PF.tab(x.sl.tab), x.scenes[0].id, roomy ? txt(x.sl.lead) : '')).join('');
      PF.body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow long">${esc(ptitle)}</span><span class="rl">${esc(PF.t('deck.ch-count', { n: slides.length }))}</span></div>
        <div class="ch-mid"><div><p class="ch-no">${esc(PF.t('en.chapter'))} ${String(ci + 1).padStart(2, '0')}</p><h2 class="ch-t">${esc(c.title)}</h2>${DOT}</div>
        <div class="ch-list t-P2${mode === 'normal' ? '' : ' ' + mode}"><ol class="toc-list${roomy ? '' : ' sub'}">${list}</ol></div></div>`;
      return band(s, auto);
    };
    const modes = slides.length <= ROOMY_MAX ? ['roomy', 'normal', 'compact'] : ['normal', 'compact'];
    for (const m of modes) { const s = make(m); if (PF.fitsM(s)) return s; }
    return PF.shrinkOrClip(make('compact'), PFScene.refUrl(chId), info.overflow);
  }

  function tocScene(p, foot, items, retro, auto) {
    const rows = [...items.map((x, i) => [String(i + 1).padStart(2, '0'), x.c.title, PF.t('deck.toc-count', { n: x.n }), x.chId]),
      retro.length && [String(items.length + 1).padStart(2, '0'), PF.t('deck.retro'), PF.t('deck.retro-desc'), retro[0].id],
      [String(items.length + (retro.length ? 2 : 1)).padStart(2, '0'), PF.t('deck.more'), PF.t('deck.more-desc'), 'end']].filter(Boolean);
    const make = (compact) => {
      const s = PF.scene({ id: 'toc', tpl: 'P2', kind: 'bare', cls: compact ? 'compact' : '', foot, sec: PF.t('name.toc'), stitle: PF.t('name.toc') });
      const half = rows.length > 7 ? Math.ceil(rows.length / 2) : rows.length;
      const col = (list) => `<section><ol class="toc-list">${list.map((r) => item(...r)).join('')}</ol></section>`;
      PF.body(s).innerHTML = `<div class="toc-top"><p class="toc-h">${esc(PF.t('en.contents'))}</p><p class="toc-sub">${esc(p.title)}</p></div>${DOT}<div class="toc-cols${rows.length > 7 ? '' : ' one'}">${col(rows.slice(0, half))}${rows.length > half ? col(rows.slice(half)) : ''}</div>`;
      return band(s, auto);
    };
    for (const compact of [false, true]) { const s = make(compact); if (PF.fitsM(s)) return s; }
    return PF.shrinkOrClip(make(true), PFScene.refUrl('toc'), info.overflow);
  }

  // 결과와 회고: ✓ 달성 카드 │ 아쉬운 점 → 개선 계획 표. 안 들어가면 두 장으로
  function buildRetro(r, p, foot, auto) {
    const ach = r.achieved || [], reg = r.regrets || [], plan = r.plans || [];
    if (!ach.length && !reg.length && !plan.length) return [];
    const n = Math.max(reg.length, plan.length);
    const achHtml = ach.length ? `<div class="rt-ach card"><p class="rt-h ok">✓ ${esc(PF.t('deck.achieved'))}</p><ul>${ach.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div>` : '';
    const pairHtml = n ? `<table class="mini"><thead><tr><th scope="col">△ ${esc(PF.t('deck.regrets'))}</th><th scope="col">→ ${esc(PF.t('deck.plans'))}</th></tr></thead><tbody>${Array.from({ length: n }, (_, i) => `<tr><td>${inline(reg[i] || '')}</td><td class="p">${inline(plan[i] || '')}</td></tr>`).join('')}</tbody></table>` : '';
    const make = (html, one, i, cnt) => {
      const s = PF.scene({ id: i === 0 ? 'retro' : `retro-${i + 1}`, tpl: 'P6', eyebrow: PF.t('deck.retro-eyebrow'), rlabel: p.title, title: PF.t('deck.retro'), sub: cnt > 1 ? `${i + 1}/${cnt}` : '', foot,
        sec: PF.t('deck.retro'), group: PF.t('deck.retro') });
      PF.body(s).innerHTML = `<div class="pf-fill"><div class="rt${one ? ' one' : ''}">${html}</div></div>`;
      return band(s, auto);
    };
    const s = make(achHtml + pairHtml, !achHtml || !pairHtml, 0, 1);
    if (PF.fitsM(s)) return [s];
    const two = [achHtml, pairHtml].filter(Boolean).map((h, i, a) => make(h, true, i, a.length));
    return two.map((x) => (PF.fitsM(x) ? x : PF.shrinkOrClip(x, PFScene.refUrl(x.id), info.overflow)));
  }

  // 맺음: 상세 기술문서(전문) · 바깥 링크 · 포트폴리오. 덱 → 상세 문서 링크는 표지와 여기에만(G1)
  function endScene(p, foot, ext, auto) {
    const card = (k, label, href, kind, visible, primary) => `<div class="lcard${primary ? ' primary' : ''}">${link({ href, kind, label: `<span class="lc-k">${esc(k)}</span><span class="lc-t">${esc(label)}</span><span class="url">${esc(visible)}</span>` })}</div>`;
    const make = () => {
      const s = PF.scene({ id: 'end', tpl: 'EN', kind: 'bare', foot, sec: PF.t('deck.more'), stitle: PF.t('deck.end-title') });
      PF.body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">${esc(PF.t('en.more'))}</span><span class="rl">${esc(PF.teamLabel(p.team))}</span></div>
        <div class="en-mid"><div><h2 class="en-t">${esc(p.title)}</h2>${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}${DOT}</div>
        <div class="en-links">${card(PF.t('en.techdoc'), PF.t('deck.end-doc'), PF.docUrl(p.id), 'page', PF.visibleUrl(PF.docUrl(p.id)), true)}
          ${ext.map((l) => card(PF.extEn(l), l.label, l.url, 'external', shortUrl(l.url))).join('')}
          ${card(PF.t('en.portfolio'), PF.t('ui.back'), 'index.html', 'page', PF.visibleUrl(''))}</div></div>`;
      return band(s, auto);
    };
    return PF.guard(make(), PFScene.refUrl('end'), info.overflow);
  }
})();
