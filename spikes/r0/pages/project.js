// R0 시험대 상세 페이지(project.html?p=<폴더 이름>) — 01 §10-2 기동 순서
//   PFScene.track(renderAll()): 데이터 → 글꼴 → 요약 장면(측정 후 고르기) → 문서(marked → Mermaid render → hljs → 정규화 → 분할)
//   → 목차 → 덱에 붙임 → PFScene.mount()
// 장면 순서(Q7): 표지 P1 → 목차 P2 → 스크린샷 P5 → 핵심 구현 P3 → 이슈 해결 P4 → 회고 P6 → 기술 문서 부록 D
(() => {
  const Q = new URLSearchParams(location.search);
  const id = Q.get('p');
  const deck = document.getElementById('deck');
  const info = (PFScene.info = { page: 'project', id, t: {}, summary: {}, doc: null, overflow: [], errors: [] });
  const mark = (k) => { info.t[k] = Math.round(performance.now()); };
  const { esc, inline, isUrl, shortUrl } = PF;
  const BODY_SUM = 544, BODY_DOC = 590;
  const MERMAID = { startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'Pretendard, sans-serif',
                    themeVariables: { fontSize: '16px' },                                   // §2-2: Mermaid 글자 = 본문 16
                    flowchart: { nodeSpacing: 28, rankSpacing: 32 }, sequence: { mirrorActors: false, messageMargin: 22 } };   // §6-5 촘촘한 기본값

  PFScene.track(renderAll().catch((err) => {
    info.errors.push(String(err && err.stack || err));
    deck.replaceChildren(msgScene('페이지를 그리지 못했습니다', esc(err && err.message || err)));
  }).finally(() => { PF.dropMeasure(); PFScene.mount({ deck: '#deck' }); mark('mounted'); }));

  function msgScene(title, html, foot = '') {
    const s = PF.scene({ tpl: 'msg', eyebrow: 'PORTFOLIO', foot });
    PF.body(s).innerHTML = `<h1>${esc(title)}</h1><div>${html}</div>`;
    return s;
  }

  async function renderAll() {
    mark('start');
    if (!id) { deck.replaceChildren(msgScene('프로젝트를 고르세요', '주소 끝에 <code>?p=폴더이름</code>을 붙여 주세요.')); return; }
    const pf = await PF.loadJSON('data/portfolio.json').catch(() => ({}));
    PF.applyAccent(pf.settings?.accent);
    const p = await PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`);
    let md = null;
    try { md = await PF.loadText(PF.srcRel(p.id, p.doc)); } catch (e) { info.errors.push('doc: ' + e.message); }
    const name = pf.profile?.name || '';
    const foot = `${name} · ${p.title}`;
    document.title = `${p.title} · 장면 시험대`;
    mark('data');

    info.fonts = await PF.loadFonts();
    mark('fonts');

    // ── 문서 준비(요약 장면의 "원문에서 자세히" 대상 id가 필요하므로 먼저) ──
    const doc = md != null ? await prepareDoc(p, md) : null;
    mark('docPrep');

    // ── 요약 장면 ──
    const P1 = await buildP1(p, foot);
    const P5 = await buildP5(p, foot);
    const P3 = buildCards(p.highlights || [], 'P3', foot, doc);
    const P4 = buildCards(p.troubleshooting || [], 'P4', foot, doc);
    const P6 = buildP6(p.retro || {}, foot);
    mark('summary');

    // ── 문서 장면 ──
    let D = [];
    if (doc) D = paginateDoc(doc, p, foot);
    else D = [docMsgScene(p, foot)];
    mark('paginate');

    // ── 목차(P2): 장면 8개 미만이면 생략. 번호는 키트가 mount에서 채움(번호 자리를 먼저 비워 둠) ──
    const before = [P1, ...P5, ...P3, ...P4, ...P6].length + D.length;
    const TOC = before >= 8 ? buildToc(p, foot, { P5, P3, P4, P6, D }) : [];
    Object.assign(info.summary, { P1: 1, P2: TOC.length, P5: P5.length, P3: P3.length, P4: P4.length, P6: P6.length });
    deck.replaceChildren(P1, ...TOC, ...P5, ...P3, ...P4, ...P6, ...D);
    // 이미지: 화면에서는 lazy로 시작(§7-7). 데스크톱 기기면 게이트가 eager로 바꿈
    deck.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('loading')) i.loading = 'lazy'; i.decoding = 'async'; });
    mark('assembled');
  }

  // ════════════════════ 요약 장면 ════════════════════
  const linkRows = (p) => [
    isUrl(p.links?.github) && ['GitHub', p.links.github],
    isUrl(p.links?.video) && ['영상', p.links.video],
    ...(p.links?.extra || []).filter((l) => isUrl(l.url)).map((l) => [l.label, l.url]),
  ].filter(Boolean);
  const imgTag = (src, alt, d) => `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${d ? ` width="${d.w}" height="${d.h}"` : ''}>`;

  async function buildP1(p, foot) {
    const d = p.cover ? await PF.imageSize(PF.srcPath(p.id, p.cover)) : null;
    const ar = d ? d.w / d.h : null;
    const variant = !p.cover || !ar ? 'nocover' : ar < 0.9 ? 'portrait' : 'landscape';
    const metaRows = [...(p.meta || []).map((m) => `<div><dt>${esc(m.label)}</dt><dd>${inline(m.value)}</dd></div>`),
      p.team?.role && `<div class="role"><dt>내 역할</dt><dd>${inline(p.team.role)}</dd></div>`].filter(Boolean).join('');
    const links = linkRows(p).map(([l, u]) => `<div><b>${esc(l)}</b><a class="url" href="${esc(u)}">${esc(shortUrl(u))}</a></div>`).join('');
    const cover = p.cover ? `<div class="media"${ar ? ` style="aspect-ratio:${ar.toFixed(4)}"` : ''}>${imgTag(PF.srcPath(p.id, p.cover), p.title, d)}</div>` : '';
    const left = (withLinks) => `<div><h1>${esc(p.title)}</h1>${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
      <div class="row"><span class="badge${p.team?.type === 'team' ? ' team' : ''}">${esc(PF.teamLabel(p.team))}</span><ul class="tags">${(p.tags || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <dl class="meta">${metaRows}</dl>${withLinks && links ? `<div class="links">${links}</div>` : ''}</div>`;
    const make = (linksLeft) => {
      const s = PF.scene({ tpl: 'P1', eyebrow: 'PROJECT', cls: variant, foot });
      PF.body(s).innerHTML = variant === 'nocover' ? left(true)
        : variant === 'portrait' ? left(true) + cover
        : left(linksLeft) + `<div class="right">${cover}${!linksLeft && links ? `<div class="links">${links}</div>` : ''}</div>`;
      return s;
    };
    const M = PF.measureRoot();
    for (const linksLeft of variant === 'landscape' ? [false, true] : [true]) {   // 변형: 커버 아래 링크 → 왼쪽 링크
      const s = make(linksLeft); M.appendChild(s);
      if (PF.fitsScene(s)) { s.remove(); return s; }
      s.remove();
    }
    return PF.shrinkOrClip(make(false), PFScene.refUrl('s-1'), info.overflow);
  }

  // P5 스크린샷: 비율을 읽어 줄 맞춤 배치(info-design 프로토 bestLayout), 이미지 높이 ≥180 아니면 나눔
  async function buildP5(p, foot) {
    const list = p.screenshots || [];
    if (!list.length) return [];
    const dims = await Promise.all(list.map((s) => PF.imageSize(PF.srcPath(p.id, s.src))));
    const shots = list.map((s, i) => ({ ...s, d: dims[i], ar: dims[i] ? dims[i].w / dims[i].h : 16 / 9 }));
    const BW = 1152, BH = BODY_SUM, GAP = 16;
    function bestLayout(items, CAP) {
      let best = null; const n = items.length;
      const parts = (k) => { if (k === 0) return [[]]; const out = []; for (let i = 1; i <= k; i++) for (const rest of parts(k - i)) out.push([i, ...rest]); return out; };
      for (const def of parts(n)) {
        if (def.length > 3) continue;
        let idx = 0; const rows = def.map((c) => { const r = items.slice(idx, idx + c); idx += c; return r; });
        let hs = rows.map((r) => (BW - GAP * (r.length - 1)) / r.reduce((a, s) => a + s.ar, 0));
        const fixed = rows.length * CAP + GAP * (rows.length - 1);
        const k = Math.min(1, (BH - fixed) / hs.reduce((a, h) => a + h, 0));
        hs = hs.map((h) => Math.floor(h * k));
        const minH = Math.min(...hs);
        const used = hs.reduce((a, h) => a + h, 0) + fixed;
        if (!best || minH > best.minH) best = { rows, hs, minH, fill: used / BH };
      }
      return best;
    }
    const chunks = [];
    for (let i = 0; i < shots.length; i += 6) chunks.push(shots.slice(i, i + 6));   // 장면당 ≤6장
    const pages = [];
    for (const ch of chunks) {
      const one = bestLayout(ch, 26);
      const mixed = ch.some((s) => s.ar < 0.9) && ch.some((s) => s.ar > 1.2);
      if (ch.length === 1 || (one.minH >= 180 && (one.fill >= 0.6 || !mixed))) pages.push(ch);
      else if (mixed) { pages.push(ch.filter((s) => s.ar < 0.9)); pages.push(ch.filter((s) => s.ar >= 0.9)); }
      else { const h = Math.ceil(ch.length / 2); pages.push(ch.slice(0, h), ch.slice(h)); }
    }
    info.summary.galleryPages = pages.map((x) => x.length);
    const M = PF.measureRoot();
    return pages.map((pg, i) => {
      const make = (CAP) => {
        const s = PF.scene({ tpl: 'P5', eyebrow: '스크린샷', title: '실제 화면', sub: pages.length > 1 ? `${i + 1}/${pages.length}` : '', foot, titleId: i === 0 ? 'pf-shots' : '' });
        const L = bestLayout(pg, CAP);
        let y = 0, html = '';
        L.rows.forEach((r, ri) => {
          const h = L.hs[ri];
          const rw = r.reduce((a, x) => a + Math.floor(x.ar * h), 0) + GAP * (r.length - 1);
          let x = Math.floor((BW - rw) / 2);
          r.forEach((sh) => { const w = Math.floor(sh.ar * h);
            html += `<figure style="left:${x}px;top:${y}px;width:${w}px"><div class="media" style="height:${h}px">${imgTag(PF.srcPath(p.id, sh.src), sh.caption || '', sh.d)}</div><figcaption style="height:${CAP}px">${inline(sh.caption || '')}</figcaption></figure>`;
            x += w + GAP; });
          y += h + CAP + GAP;
        });
        PF.body(s).innerHTML = `<div class="gal">${html}</div>`;
        return s;
      };
      for (const CAP of [26, 46]) {                       // 캡션 1줄 → 2줄
        const s = make(CAP); M.appendChild(s); const ok = PF.fitsScene(s); s.remove();
        if (ok) return s;
      }
      return PF.shrinkOrClip(make(46), PFScene.refUrl('pf-shots'), info.overflow);
    });
  }

  // P3 핵심 구현 · P4 이슈 해결: 측정 후 변형 고르기(§4-3), 넘치면 원칙 5(이어짐 → 축소 → 잘림 띠)
  function buildCards(items, tpl, foot, doc) {
    if (!items.length) return [];
    const isHL = tpl === 'P3';
    const steps = [['problem', '문제'], ['cause', '원인'], ['solution', '해결'], ['result', '결과']];
    const xref = (sec) => {
      if (!sec || !doc) return '';
      const hit = doc.resolve(sec);
      if (!hit) return '';
      return `<a class="pf-xref" href="#${esc(hit)}" data-pf-ref="${esc(hit)}">원문에서 자세히 → <span class="pf-n-screen">${esc(PFScene.refUrl(hit))}</span><span class="pf-n-print"></span></a>`;   // 긴 형태로 측정(§4-3 원칙 1)
    };
    const hlCard = (h) => `<article class="hl"><h3>${inline(h.title)}${h._part ? ` <span class="pf-part" data-pf-ui="cont" aria-hidden="true">${h._part}</span>` : ''}</h3><dl>
      ${h.what ? `<div><dt>기능</dt><dd>${inline(h.what)}</dd></div>` : ''}${h.how ? `<div><dt>구현 방법</dt><dd>${inline(h.how)}</dd></div>` : ''}${h.why ? `<div class="why"><dt>선택 이유</dt><dd>${inline(h.why)}</dd></div>` : ''}</dl>${xref(h.section)}</article>`;
    const tsCard = (x, wide) => {
      const st = steps.filter(([k]) => x[k]);
      const inner = wide
        ? `<div class="flowrow" style="--n:${st.length}">${st.map(([k, l]) => `<div class="${k === 'result' ? 'res' : ''}"><b>${l}</b>${inline(x[k])}</div>`).join('')}</div>`
        : st.map(([k, l]) => `<div class="st${k === 'result' ? ' res' : ''}"><b>${l}</b><span>${inline(x[k])}</span></div>`).join('');
      return `<article class="ts"><h3>${inline(x.title)}${x._part ? ` <span class="pf-part" data-pf-ui="cont" aria-hidden="true">${x._part}</span>` : ''}</h3>${inner}${x.lesson ? `<p class="lesson"><b>배운 점</b>${inline(x.lesson)}</p>` : ''}${xref(x.section)}</article>`;
    };
    const variants = isHL
      ? [{ name: 'c3', min: 3, max: 3 }, { name: 'c2', min: 2, max: 2 }, { name: 'c1', min: 1, max: 1 }]
      : [{ name: 'c3', min: 3, max: 3 }, { name: 'flow', min: 2, max: 4 }, { name: 'c2', min: 2, max: 2 }, { name: 'c1', min: 1, max: 1 }];
    const head = isHL ? { eyebrow: '핵심 구현', title: '무엇을, 어떻게, 왜', id: 'pf-hl' } : { eyebrow: '이슈 해결', title: '문제 → 원인 → 해결 → 결과', id: 'pf-ts' };
    const build = (chunk, v, i, n) => {
      const s = PF.scene({ tpl, eyebrow: head.eyebrow, title: head.title, sub: n > 1 ? `${i + 1}/${n}` : '', foot, titleId: i === 0 ? head.id : '' });
      PF.body(s).innerHTML = `<div class="${isHL ? 'hl-g' : 'ts-g'} ${v}">${chunk.map((x) => (isHL ? hlCard(x) : tsCard(x, v === 'c1'))).join('')}</div>`;
      return s;
    };
    // 원칙 5 ① 이어짐: 가장 넓은 변형에도 안 들어가는 항목은 필드 경계에서 나눔(필드 안 줄 분할은 시험대에서 생략)
    const fields = isHL ? ['what', 'how', 'why'] : ['problem', 'cause', 'solution', 'result', 'lesson'];
    const M = PF.measureRoot();
    const fitsWide = (x) => { const s = build([x], 'c1', 0, 1); M.appendChild(s); const ok = PF.fitsScene(s); s.remove(); return ok; };
    const expanded = [];
    for (const it of items) {
      if (fitsWide(it)) { expanded.push(it); continue; }
      const present = fields.filter((f) => it[f]);
      const parts = []; let cur = null;
      for (const f of present) {
        const base = { title: it.title, section: it.section };
        const trial = cur ? { ...cur, [f]: it[f] } : { ...base, [f]: it[f] };
        if (cur && !fitsWide(trial)) { parts.push(cur); cur = { ...base, [f]: it[f] }; } else cur = trial;
      }
      if (cur) parts.push(cur);
      parts.forEach((x, j) => { x._part = `${j + 1}/${parts.length}`; expanded.push(x); });
      info.overflow.push({ tpl, action: 'continue', title: it.title, parts: parts.length });
    }
    const pages = PF.pack(expanded, variants, build);
    info.summary[tpl + 'variants'] = pages.map((x) => `${x.variant || 'none'}×${x.chunk.length}`);
    return pages.map((pg, i) => {
      const s = build(pg.chunk, pg.variant || 'c1', i, pages.length);
      return pg.variant ? s : PF.shrinkOrClip(s, PFScene.refUrl(head.id), info.overflow);   // ② 축소 ③ 잘림 띠
    });
  }

  function buildP6(r, foot) {
    const ach = r.achieved || [], reg = r.regrets || [], plan = r.plans || [];
    if (!ach.length && !reg.length && !plan.length) return [];
    const n = Math.max(reg.length, plan.length);
    const achHtml = ach.length ? `<div class="ach"><h3>달성</h3><ul>${ach.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div>` : '';
    const pairHtml = n ? `<div class="pairs"><div class="h">아쉬운 점</div><div class="h">개선 계획</div>${Array.from({ length: n }, (_, i) => `<div>${inline(reg[i] || '')}</div><div class="p">${inline(plan[i] || '')}</div>`).join('')}</div>` : '';
    const make = (html, one, i, cnt) => {
      const s = PF.scene({ tpl: 'P6', eyebrow: '결과와 회고', title: '달성 · 아쉬움 → 개선 계획', sub: cnt > 1 ? `${i + 1}/${cnt}` : '', foot, titleId: i === 0 ? 'pf-retro' : '' });
      PF.body(s).innerHTML = `<div class="retro${one ? ' one' : ''}">${html}</div>`;
      return s;
    };
    const M = PF.measureRoot();
    const s = make(achHtml + pairHtml, !achHtml || !pairHtml, 0, 1);
    M.appendChild(s); const ok = PF.fitsScene(s); s.remove();
    if (ok) return [s];
    const two = [achHtml, pairHtml].filter(Boolean).map((h, i, a) => make(h, true, i, a.length));
    return two.map((x) => { M.appendChild(x); const f = PF.fitsScene(x); x.remove(); return f ? x : PF.shrinkOrClip(x, PFScene.refUrl('pf-retro'), info.overflow); });
  }

  function buildToc(p, foot, parts) {
    const ents = [];
    if (parts.P5.length) ents.push({ lv: 2, id: 'pf-shots', t: '스크린샷' });
    if (parts.P3.length) ents.push({ lv: 2, id: 'pf-hl', t: '핵심 구현' });
    if (parts.P4.length) ents.push({ lv: 2, id: 'pf-ts', t: '이슈 해결' });
    if (parts.P6.length) ents.push({ lv: 2, id: 'pf-retro', t: '결과와 회고' });
    parts.D.forEach((s) => s.querySelectorAll('.pf-body h2[id], .pf-body h3[id]').forEach((h) => ents.push({ lv: h.tagName === 'H2' ? 2 : 3, id: h.id, t: h.textContent.trim() })));
    const ol = document.createElement('ol');
    ol.className = 'pf-toc';
    ol.innerHTML = ents.map((e) => `<li class="lv${e.lv}"><a href="#${esc(e.id)}" data-pf-ref="${esc(e.id)}"><span class="t">${esc(e.t)}</span><span class="pf-n-screen">p.000</span><span class="pf-n-print"></span></a></li>`).join('');
    const mdeck = document.createElement('div'); PF.measureRoot().appendChild(mdeck);
    const res = PFPaginator.paginate([ol], { mdeck, bodyH: BODY_SUM, soft: 0, keepRatio: 0, relScale: 0.85, minDiagFont: 10, imgMinScale: 0.5, orphans: 2, widows: 2, codeMin: 3, slack: 1, keepBoxes: false,
      makeScene: () => PF.scene({ tpl: 'P2', part: 'doc', eyebrow: 'CONTENTS', title: '목차', foot }), clipUrl: () => PFScene.refUrl('s-2') });
    const out = res.scenes.map((s) => s.el);
    out.forEach((s, i) => { if (out.length > 1) s.querySelector('.pf-title').insertAdjacentHTML('beforeend', `<span class="pf-part" data-pf-ui="cont" aria-hidden="true">${i + 1}/${out.length}</span>`); s.remove(); });
    mdeck.remove();
    info.tocEntries = ents.length;
    return out;
  }

  // ════════════════════ 기술 문서 ════════════════════
  function docMsgScene(p, foot) {
    const s = PF.scene({ tpl: 'D1', part: 'doc', kind: 'doc', crumb: `<b>${esc(p.title)}</b> › 기술 문서`, foot });
    PF.body(s).innerHTML = `<p>기술 문서를 불러오지 못했습니다.</p>`;
    return s;
  }

  // §6-2 준비 단계 3~9
  async function prepareDoc(p, md) {
    const M = PF.measureRoot();
    const flow = document.createElement('div');
    flow.className = 'pf-flow pf-md';
    M.appendChild(flow);
    flow.innerHTML = marked.parse(md, { gfm: true });
    // ① 상대경로(이미지·링크)를 src/<id>/ 기준으로 (지금 project.js와 같은 규칙)
    const isRelative = (u) => u && !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(u);
    const decode = (u) => { try { return decodeURI(u); } catch (_) { return u; } };
    flow.querySelectorAll('img[src], video[src], source[src]').forEach((el) => { const s = el.getAttribute('src'); if (isRelative(s)) el.setAttribute('src', PF.srcPath(p.id, decode(s))); });
    flow.querySelectorAll('a[href]').forEach((a) => { const h = a.getAttribute('href'); if (isRelative(h)) a.setAttribute('href', PF.srcPath(p.id, decode(h))); else if (/^https?:/i.test(h)) { a.target = '_blank'; a.rel = 'noopener'; } });
    // ② 제목 앵커(GitHub 슬러그)
    const slug = PF.slugger();
    const headings = [...flow.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    headings.forEach((h) => { h.id = slug(h.textContent.trim()); });
    const byTitle = new Map(headings.map((h) => [PF.normTitle(h.textContent), h.id]));
    const resolve = (sec) => { const want = PF.normTitle(sec); return byTitle.get(want) || [...byTitle.entries()].find(([t]) => t.startsWith(want) || want.startsWith(t))?.[1] || null; };
    // ④ Mermaid: render()로(§6-2 4번)
    let n = 0;
    flow.querySelectorAll('code.language-mermaid').forEach((code) => {
      const div = document.createElement('div'); div.className = 'mermaid'; div.id = `mmd-${n++}`; div.textContent = code.textContent;
      (code.closest('pre') || code).replaceWith(div);
    });
    const tm = performance.now();
    const mmdErr = await PFScene.renderMermaid([...flow.querySelectorAll('.mermaid')], MERMAID);
    info.t.mermaidMs = Math.round(performance.now() - tm);
    // ⑤ 코드 하이라이트 → 줄 배열 정규화
    if (window.hljs) flow.querySelectorAll('pre code').forEach((el) => { try { hljs.highlightElement(el); } catch (_) { /* */ } });
    flow.querySelectorAll('pre > code').forEach((c) => { c.parentElement._lines = PFPaginator.htmlLines(c); c.innerHTML = c.parentElement._lines.join('\n'); });
    // ⑥ 이미지 크기: data에 media 기록이 없으므로(Q12 빌드 미구현) 받아서 width·height 속성을 넣음
    const imgs = [...flow.querySelectorAll('img')];
    const ti = performance.now();
    const dims = await Promise.all(imgs.map((i) => PF.imageSize(i.src)));
    imgs.forEach((i, k) => { if (dims[k]) { i.width = dims[k].w; i.height = dims[k].h; } i.loading = 'lazy'; i.decoding = 'async'; });
    info.t.imgDimsMs = Math.round(performance.now() - ti);
    info.imgFailed = imgs.filter((i, k) => !dims[k]).map((i) => i.getAttribute('src'));
    // ⑦ 정규화
    flow.querySelectorAll(':scope > p').forEach((el) => {     // 그림만 있는 문단 → 그림 블록
      const kids = [...el.childNodes].filter((c) => !(c.nodeType === 3 && !c.data.trim()) && c.nodeName !== 'BR');
      if (kids.length && kids.every((c) => c.nodeName === 'IMG' || (c.nodeName === 'A' && c.children.length === 1 && c.firstElementChild.tagName === 'IMG'))) el.classList.add('pf-fig');
    });
    flow.querySelectorAll('li').forEach((li) => {             // 글자 + 블록이 섞인 항목 → 글자 묶음을 블록으로
      if (![...li.children].some((c) => /^(P|PRE|UL|OL|TABLE|BLOCKQUOTE|DIV)$/.test(c.tagName))) return;
      let run = null;
      [...li.childNodes].forEach((c) => {
        const inl = c.nodeType === 3 || !/^(P|PRE|UL|OL|TABLE|BLOCKQUOTE|DIV|H[1-6])$/.test(c.tagName);
        if (inl) { if (!run) { if (c.nodeType === 3 && !c.data.trim()) return; run = document.createElement('div'); run.className = 'pf-inl'; c.before(run); } run.appendChild(c); }
        else run = null;
      });
    });
    flow.querySelectorAll('table').forEach((t) => {          // 표: 첫 행 너비로 colgroup + table-layout: fixed
      const row = t.rows[0]; if (!row) return;
      const ws = [...row.cells].map((c) => c.getBoundingClientRect().width);
      const cg = document.createElement('colgroup');
      ws.forEach((w) => { const col = document.createElement('col'); col.style.width = `${w}px`; cg.appendChild(col); });
      t.insertBefore(cg, t.firstChild);
      t.style.tableLayout = 'fixed'; t.style.width = `${ws.reduce((a, b) => a + b, 0)}px`;
    });
    // ⑧ 구조: 첫 H1 제거, 문서 자체 "목차" H2 건너뜀, H2마다 새 장면(첫 H2 앞 도입부는 첫 장에 붙임)
    const h1 = flow.querySelector(':scope > h1:first-child'); if (h1) h1.remove();
    const skipped = [];
    [...flow.querySelectorAll(':scope > h2')].forEach((h) => {
      if (!/^(목차|차례|contents|table of contents)$/i.test(PF.normTitle(h.textContent))) return;
      const sec = []; for (let e = h.nextElementSibling; e && e.tagName !== 'H2'; e = e.nextElementSibling) sec.push(e);
      const onlyLinks = sec.every((e) => e.tagName === 'HR' || (/^(UL|OL)$/.test(e.tagName) && [...e.querySelectorAll('a')].every((a) => a.getAttribute('href')?.startsWith('#'))
        && e.textContent.replace(/\s+/g, '') === [...e.querySelectorAll('a')].map((a) => a.textContent).join('').replace(/\s+/g, '')));
      if (sec.length && onlyLinks) { skipped.push(h.textContent.trim()); [h, ...sec].forEach((e) => e.remove()); }
    });
    const blocks = [...flow.children];
    const firstH2 = blocks.findIndex((b) => b.tagName === 'H2');
    blocks.forEach((el, i) => { if (el.tagName === 'H2' && !(i === firstH2 && i > 0)) el.dataset.breakBefore = '1'; });
    // ⑨ 측정
    blocks.forEach((el, i) => {
      el.dataset.b = String(i);
      el._h = el.getBoundingClientRect().height;
      const k = PFPaginator.kindOf(el);
      if (k === 'figure' || k === 'diagram') {
        const m = el.querySelector('svg, img');
        if (!m) { el.dataset.k = 'atom'; return; }
        const r = m.getBoundingClientRect();
        el._nat = { w: r.width, h: r.height };
        if (k === 'diagram') { const vb = m.viewBox?.baseVal; el._eff1 = 16 * r.width / (vb?.width || r.width); el._vb = vb ? [vb.width, vb.height] : null; }
      }
    });
    const textOf = (root) => { const c = root.cloneNode(true); c.querySelectorAll('[data-pf-ui], style').forEach((e) => e.remove()); return c.textContent.replace(/\s+/g, ''); };
    const srcText = blocks.filter((b) => b.tagName !== 'HR').map(textOf).join('');
    info.docPrep = { blocks: blocks.length, mermaid: n, mermaidErrors: mmdErr, skippedToc: skipped, images: imgs.length };
    return { flow, blocks, resolve, srcText, textOf };
  }

  // §6-3: 구간(H2)마다 → 짧은 장 이어 붙이기 → 엄격 분할 → 꼬리가 거의 비면 완화·조임 재시도
  function paginateDoc(doc, p, foot) {
    const { flow, blocks, srcText, textOf } = doc;
    const M = PF.measureRoot();
    const OPT = { bodyH: BODY_DOC, soft: 0.8, keepRatio: 0.35, relScale: 0.85, minDiagFont: 10, imgMinScale: 0.5, orphans: 2, widows: 2, codeMin: 3, slack: 1, keepBoxes: true,
                  makeScene: () => PF.scene({ tpl: 'D1', part: 'doc', kind: 'doc', crumb: '', foot }),
                  clipUrl: (b) => PFScene.refUrl(b.id || '') };
    const RELAX = { soft: 0, keepRatio: 0, relScale: 0.6, keepBoxes: false };
    const fitsEl = (s) => PFPaginator.fits({ body: s.querySelector(':scope > .pf-body') });
    const groups = [];
    blocks.forEach((b) => { if (!groups.length || b.dataset.breakBefore) groups.push([b]); else groups[groups.length - 1].push(b); });
    const agg = { splits: { text: 0, code: 0, table: 0, list: 0, box: 0 }, scaled: [], forced: [], clipped: [], keepMoves: 0, merged: 0, retry: [] };
    const add = (st) => { Object.keys(agg.splits).forEach((k) => (agg.splits[k] += st.splits[k])); agg.scaled.push(...st.scaled); agg.forced.push(...st.forced); agg.clipped.push(...st.clipped); agg.keepMoves += st.keepMoves; };
    let all = [], ms = 0, fitCalls = 0;
    const t0 = performance.now();
    for (const g of groups) {
      // 짧은 장 이어 붙이기(§6-3 첫 줄): 장 전체 ≤ 본문 40%이고 앞 장면 남은 칸에 통째로 들어가면
      const prev = all[all.length - 1];
      const gh = g.reduce((a, b) => a + b._h, 0);
      if (prev && gh <= 0.4 * BODY_DOC) {
        const pb = prev.querySelector(':scope > .pf-body');
        g.forEach((b) => { if (b._nat) PFPaginator.setScale(b, 1); pb.appendChild(b); });
        if (fitsEl(prev)) { agg.merged++; continue; }
        g.forEach((b) => b.remove());
      }
      const pristine = g.map(PFPaginator.cloneBlock);
      const mdeck = document.createElement('div'); M.appendChild(mdeck);
      let res = PFPaginator.paginate(g, { ...OPT, mdeck });
      ms += res.ms; fitCalls += res.fitCalls;
      const last = res.scenes[res.scenes.length - 1];
      if (res.scenes.length > 1 && PFPaginator.fill(last) < 0.3) {
        const p2 = pristine.map(PFPaginator.cloneBlock);
        const rdeck = document.createElement('div'); M.appendChild(rdeck);
        const r2 = PFPaginator.paginate(pristine, { ...OPT, ...RELAX, mdeck: rdeck });
        ms += r2.ms; fitCalls += r2.fitCalls;
        let take = r2.scenes.length < res.scenes.length ? 'relaxed' : null, r3 = null;
        if (!take) {
          p2.forEach((x) => { x.classList.add('pf-tight'); x.querySelectorAll('p, ul, ol, pre').forEach((y) => y.classList.add('pf-tight')); });
          const t3 = document.createElement('div'); M.appendChild(t3);
          r3 = PFPaginator.paginate(p2, { ...OPT, ...RELAX, mdeck: t3 });
          ms += r3.ms; fitCalls += r3.fitCalls;
          if (r3.scenes.length < res.scenes.length) take = 'tight';
        }
        agg.retry.push({ b: g[0].dataset.b, strict: res.scenes.length, relaxed: r2.scenes.length, tight: r3?.scenes.length ?? null, lastFill: +PFPaginator.fill(last).toFixed(3), taken: take });
        if (take === 'relaxed') res = r2;
        if (take === 'tight') res = r3;
      }
      add(res.stats);
      all.push(...res.scenes.map((s) => s.el));
    }
    // 측정 덱에서 꺼냄(선택되지 않은 시도 장면은 측정 컨테이너와 함께 버려짐)
    all.forEach((s) => s.remove());
    // 이동 경로(머리줄) + (계속) + D1/D2/D3 이름
    let h2 = '';
    all.forEach((s) => {
      const b = s.querySelector(':scope > .pf-body');
      const first = b.firstElementChild;
      const startsChapter = first?.tagName === 'H2';
      const firstH2 = b.querySelector(':scope > h2');
      const crumbH2 = startsChapter ? first.textContent.trim() : h2;
      const cont = !startsChapter && h2 !== '';
      s.querySelector('.pf-crumb').innerHTML = `<b>${esc(p.title)}</b> › 기술 문서${crumbH2 ? ` › ${esc(crumbH2)}` : ''}${cont ? ' <span class="pf-cont" data-pf-ui="cont" aria-hidden="true">(계속)</span>' : ''}`;
      b.querySelectorAll(':scope > h2').forEach((h) => { h2 = h.textContent.trim(); });
      if (!firstH2 && !h2) { /* 도입부 */ }
      const tpl = b.querySelector('.mermaid, p.pf-fig') ? 'D2' : b.querySelector('pre') ? 'D3' : 'D1';
      s.dataset.pfTpl = tpl; s.classList.remove('t-D1'); s.classList.add(`t-${tpl}`);
    });
    // 글자 보존(§6-1 원칙 2, T4)
    const outText = all.map((s) => textOf(s.querySelector(':scope > .pf-body'))).join('');
    const cons = { src: srcText.length, out: outText.length, equal: srcText === outText };
    if (!cons.equal) { let i = 0; while (srcText[i] === outText[i]) i++; cons.firstDiff = i; cons.srcCtx = srcText.slice(Math.max(0, i - 30), i + 30); cons.outCtx = outText.slice(Math.max(0, i - 30), i + 30); }
    // 채움률(리포트 지표, §1-4 ③)
    const fills = all.map((s) => { const b = s.querySelector(':scope > .pf-body'); M.appendChild(s); const f = PFPaginator.fill({ body: b }); s.remove(); return f; }).sort((a, b) => a - b);
    const q = (x) => +fills[Math.min(fills.length - 1, Math.floor(x * fills.length))].toFixed(3);
    const smallDiagrams = [];
    all.forEach((s, i) => s.querySelectorAll('.mermaid svg').forEach((sv) => { const vb = sv.viewBox?.baseVal; const w = parseFloat(sv.style.width) || null; if (vb && w) { const eff = 16 * w / vb.width; if (eff < 12) smallDiagrams.push({ docScene: i + 1, eff: +eff.toFixed(2) }); } }));
    info.doc = { scenes: all.length, paginateMs: Math.round(ms), totalMs: Math.round(performance.now() - t0), fitCalls, ...agg,
                 conservation: cons, fill: { mean: +(fills.reduce((a, b) => a + b, 0) / fills.length).toFixed(3), median: q(0.5), p10: q(0.1) }, smallDiagrams };
    flow.remove();
    return all;
  }
})();
