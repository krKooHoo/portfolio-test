// 덱 스파이크 상세 페이지(project.html?p=<폴더 이름>) — R0 spikes/r0/pages/project.js 복사본에서 요약 장면을 참고 덱 체계로 다시 짬.
//   기동 순서는 R0와 같음: 데이터 → 글꼴 → 문서 준비(marked → Mermaid render → hljs → 정규화) → 요약 장면 → 문서 분할 → 목차 → 덱에 붙임 → mount
// 장면 순서(Q7): 표지 P1 → 목차 P2 → 스크린샷 P5 → 핵심 구현 P3 → 이슈 해결 P4 → 회고 P6 → (부록 디바이더) → 기술 문서 부록 D
//   【덱】 바꾼 점: 핵심 구현·이슈 해결은 한 장에 한 항목(발표 덱의 "한 장 = 한 생각"), 목차는 Q7 구간 + 문서 H2 장(H3는 뺌),
//         부록 앞 디바이더(참고 덱 C + bignum). ?dividers=all이면 요약 구간마다 디바이더, none이면 없음(기본 appendix)
//   내용(글)은 모두 data/projects/<id>.json과 src/<id>/기술문서.md에서 옴. 새 문장·수치를 만들지 않음(장면 이름·라벨은 UI 글자)
(() => {
  const Q = new URLSearchParams(location.search);
  const id = Q.get('p');
  const DIV = ['all', 'none'].includes(Q.get('dividers')) ? Q.get('dividers') : 'appendix';
  const deck = document.getElementById('deck');
  const info = (PFScene.info = { page: 'project', id, dividers: DIV, t: {}, summary: {}, doc: null, overflow: [], errors: [] });
  const mark = (k) => { info.t[k] = Math.round(performance.now()); };
  const { esc, inline, isUrl, shortUrl, DOT } = PF;
  const BODY_SUM = 516, BODY_DOC = 584;
  const MERMAID = { startOnLoad: false, theme: 'base', securityLevel: 'loose', fontFamily: 'Pretendard, sans-serif',
                    themeVariables: { fontSize: '16px', fontFamily: 'Pretendard, sans-serif', primaryColor: '#EDEFFB', primaryBorderColor: '#5B6AD0', primaryTextColor: '#20233A',
                                      secondaryColor: '#F7F8FD', tertiaryColor: '#FFFFFF', lineColor: '#5B6AD0', textColor: '#20233A', noteBkgColor: '#FAFBFF', noteBorderColor: '#8B95E4',
                                      actorBkg: '#EDEFFB', actorBorder: '#5B6AD0', signalColor: '#3E4CAB', labelBoxBkgColor: '#EDEFFB', clusterBkg: '#FBFBFE', clusterBorder: '#E0E4FA' },
                    flowchart: { nodeSpacing: 28, rankSpacing: 32 }, sequence: { mirrorActors: false, messageMargin: 22 } };   // §6-5 촘촘한 기본값(R0와 같음)

  PFScene.track(renderAll().catch((err) => {
    info.errors.push(String(err && err.stack || err));
    deck.replaceChildren(msgScene('페이지를 그리지 못했습니다', esc(err && err.message || err)));
  }).finally(() => { PF.dropMeasure(); PFScene.mount({ deck: '#deck' }); mark('mounted'); }));

  function msgScene(title, html, foot = '') {
    const s = PF.scene({ tpl: 'msg', eyebrow: 'PORTFOLIO', foot, sec: '안내' });
    PF.body(s).innerHTML = `<h1>${esc(title)}</h1><div>${html}</div>`;
    return s;
  }

  async function renderAll() {
    mark('start');
    if (!id) { deck.replaceChildren(msgScene('프로젝트를 고르세요', '주소 끝에 <code>?p=폴더이름</code>을 붙여 주세요.')); return; }
    const pf = await PF.loadJSON('data/portfolio.json').catch(() => ({}));
    const p = await PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`);
    let md = null;
    try { md = await PF.loadText(PF.srcRel(p.id, p.doc)); } catch (e) { info.errors.push('doc: ' + e.message); }
    const name = pf.profile?.name || '';
    const foot = `${name} · ${p.title}`;
    document.title = `${p.title} · 포트폴리오 덱`;
    mark('data');

    info.fonts = await PF.loadFonts();
    mark('fonts');

    const doc = md != null ? await prepareDoc(p, md) : null;
    mark('docPrep');

    // ── 요약 장면 ──
    const P1 = await buildP1(p, foot);
    const P5 = await buildP5(p, foot);
    const P3 = buildItems(p.highlights || [], 'P3', p, foot, doc);
    const P4 = buildItems(p.troubleshooting || [], 'P4', p, foot, doc);
    const P6 = buildP6(p.retro || {}, p, foot);
    mark('summary');

    // ── 문서 장면 ──
    const D = doc ? paginateDoc(doc, p, foot) : [docMsgScene(p, foot)];
    mark('paginate');

    // ── 구간 정의(Q7). 번호는 있는 구간만 1부터 ──
    const chapters = [];                                     // 문서 H2 장: { id, title }
    D.forEach((s) => s.querySelectorAll(':scope > .pf-body > h2[id]').forEach((h) => chapters.push({ id: h.id, title: h.textContent.trim() })));
    const secs = [
      P5.length && { key: 'shots', id: 'pf-shots', t: '스크린샷', d: `${(p.screenshots || []).length}장`, list: P5, agenda: (p.screenshots || []).map((x) => x.caption).filter(Boolean) },
      P3.length && { key: 'hl', id: 'pf-hl', t: '핵심 구현', d: `${(p.highlights || []).length}개 항목`, list: P3, agenda: (p.highlights || []).map((x) => x.title) },
      P4.length && { key: 'ts', id: 'pf-ts', t: '이슈 해결', d: `${(p.troubleshooting || []).length}개 사례`, list: P4, agenda: (p.troubleshooting || []).map((x) => x.title) },
      P6.length && { key: 'retro', id: 'pf-retro', t: '결과와 회고', d: '달성 · 아쉬움 → 개선 계획', list: P6, agenda: ['달성', '아쉬운 점', '개선 계획'] },
      D.length && { key: 'doc', id: 'pf-appendix', t: '기술 문서 부록', d: `원문 전체 · ${D.length}장`, list: D, agenda: chapters.map((c) => c.title), part: 'doc' },
    ].filter(Boolean);
    secs.forEach((x, i) => { x.n = i + 1; });
    // 디바이더(참고 덱 C): 기본은 부록 앞 하나. 디바이더 id(pf-…)가 목차 링크 대상이 됨 → 요약 장면 제목 id와 겹치지 않게 dv- 접두
    const dividers = {};
    secs.forEach((x) => { if (DIV === 'all' || (DIV === 'appendix' && x.key === 'doc')) dividers[x.key] = buildDivider(x, p, foot); });
    const before = 1 + secs.reduce((a, x) => a + x.list.length, 0);                // 목차는 장면 8개 이상일 때(R0와 같은 기준)
    const TOC = before >= 8 ? [buildToc(p, foot, secs, chapters, dividers)] : [];
    Object.assign(info.summary, { P1: 1, P2: TOC.length, P5: P5.length, P3: P3.length, P4: P4.length, P6: P6.length, DIV: Object.keys(dividers).length, D: D.length });
    const seq = [P1, ...TOC];
    secs.forEach((x) => { if (dividers[x.key]) seq.push(dividers[x.key]); seq.push(...x.list); });
    deck.replaceChildren(...seq);
    deck.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('loading')) i.loading = 'lazy'; i.decoding = 'async'; });
    mark('assembled');
  }

  // ════════════════════ 요약 장면 ════════════════════
  const linkRows = (p) => [
    isUrl(p.links?.github) && ['GITHUB', p.links.github],
    isUrl(p.links?.video) && ['영상', p.links.video],
    ...(p.links?.extra || []).filter((l) => isUrl(l.url)).map((l) => [l.label, l.url]),
  ].filter(Boolean);
  const imgTag = (src, alt, d) => `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${d ? ` width="${d.w}" height="${d.h}"` : ''}>`;
  const M = () => PF.measureRoot();
  const fitsM = (s) => { M().appendChild(s); const ok = PF.fitsScene(s); s.remove(); return ok; };

  // P1 프로젝트 표지(참고 덱 A를 프로젝트용으로): 윗줄 PROJECT │ 팀 구분 / 제목·한 줄 소개·태그·메타 표 │ 커버 카드
  async function buildP1(p, foot) {
    const d = p.cover ? await PF.imageSize(PF.srcPath(p.id, p.cover)) : null;
    const ar = d ? d.w / d.h : null;
    const variant = !p.cover || !ar ? 'nocover' : ar < 0.9 ? 'portrait' : 'landscape';
    const metaRows = [...(p.meta || []).map((m) => `<tr><th>${esc(m.label)}</th><td>${inline(m.value)}</td></tr>`),
      p.team?.role && `<tr><th>내 역할</th><td class="role">${inline(p.team.role)}</td></tr>`].filter(Boolean).join('');
    const links = linkRows(p).map(([l, u]) => `<div><b>${esc(l)}</b><a class="url" href="${esc(u)}">${esc(shortUrl(u))}</a></div>`).join('');
    const cover = p.cover ? `<div class="media"${ar ? ` style="aspect-ratio:${ar.toFixed(4)}"` : ''}>${imgTag(PF.srcPath(p.id, p.cover), p.title, d)}</div>` : '';
    const text = (withLinks) => `<div class="pc-text"><h1>${esc(p.title)}</h1>${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
      <ul class="tags">${(p.tags || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${metaRows ? `<table class="kv"><tbody>${metaRows}</tbody></table>` : ''}${withLinks && links ? `<div class="pc-links">${links}</div>` : ''}</div>`;
    const make = (linksLeft) => {
      const s = PF.scene({ tpl: 'P1', kind: 'bare', cls: variant, foot, sec: '표지', stitle: p.title });
      const main = variant === 'nocover' ? text(true)
        : variant === 'portrait' ? text(true) + cover
        : text(linksLeft) + `<div class="pc-right">${cover}${!linksLeft && links ? `<div class="pc-links">${links}</div>` : ''}</div>`;
      PF.body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">PROJECT</span><span class="rl">${esc(PF.teamLabel(p.team))}</span></div><div class="pc-main">${main}</div>`;
      return s;
    };
    for (const linksLeft of variant === 'landscape' ? [false, true] : [true]) {
      const s = make(linksLeft);
      if (fitsM(s)) return s;
    }
    return PF.shrinkOrClip(make(false), PFScene.refUrl('s-1'), info.overflow);
  }

  // P5 스크린샷(참고 덱 H): R0의 줄 맞춤 배치(bestLayout)를 본문 1136×516에 맞춤. 이미지 높이 ≥180 아니면 나눔
  async function buildP5(p, foot) {
    const list = p.screenshots || [];
    if (!list.length) return [];
    const dims = await Promise.all(list.map((s) => PF.imageSize(PF.srcPath(p.id, s.src))));
    const shots = list.map((s, i) => ({ ...s, d: dims[i], ar: dims[i] ? dims[i].w / dims[i].h : 16 / 9 }));
    const BW = 1136, BH = BODY_SUM, GAP = 20;
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
    for (let i = 0; i < shots.length; i += 6) chunks.push(shots.slice(i, i + 6));
    const pages = [];
    for (const ch of chunks) {
      const one = bestLayout(ch, 28);
      const mixed = ch.some((s) => s.ar < 0.9) && ch.some((s) => s.ar > 1.2);
      if (ch.length === 1 || (one.minH >= 180 && (one.fill >= 0.6 || !mixed))) pages.push(ch);
      else if (mixed) { pages.push(ch.filter((s) => s.ar < 0.9)); pages.push(ch.filter((s) => s.ar >= 0.9)); }
      else { const h = Math.ceil(ch.length / 2); pages.push(ch.slice(0, h), ch.slice(h)); }
    }
    info.summary.galleryPages = pages.map((x) => x.length);
    return pages.map((pg, i) => {
      const make = (CAP) => {
        const s = PF.scene({ tpl: 'P5', eyebrow: p.title, rlabel: '스크린샷', title: '실제 화면', sub: pages.length > 1 ? `${i + 1}/${pages.length}` : '', foot, titleId: i === 0 ? 'pf-shots' : '', sec: '스크린샷' });
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
      for (const CAP of [28, 48]) { const s = make(CAP); if (fitsM(s)) return s; }
      return PF.shrinkOrClip(make(48), PFScene.refUrl('pf-shots'), info.overflow);
    });
  }

  // P3 핵심 구현 · P4 이슈 해결: 한 장에 한 항목(참고 덱 I의 "라벨칩 → 설명", 이슈는 문제 → 원인 → 해결 → 결과 흐름 + 배운 점 Note)
  //   넘치면 A1과 같은 원칙 5: 변형(촘촘) → 필드 경계에서 이어짐(1/2) → 축소 → 잘림 띠
  function buildItems(items, tpl, p, foot, doc) {
    if (!items.length) return [];
    const isHL = tpl === 'P3';
    const sec = isHL ? '핵심 구현' : '이슈 해결';
    const steps = [['problem', '문제', ''], ['cause', '원인', ''], ['solution', '해결', 'indigo'], ['result', '결과', 'ok']];
    const xref = (s) => {
      if (!s || !doc) return '';
      const hit = doc.resolve(s);
      if (!hit) return '';
      return `<a class="pf-xref" href="#s=${esc(hit)}" data-pf-ref="${esc(hit)}">원문에서 자세히 → <span class="pf-n-screen">${esc(PFScene.refUrl(hit))}</span><span class="pf-n-print"></span></a>`;   // 긴 형태로 측정(§4-3 원칙 1)
    };
    const hlBody = (h, v) => `<div class="hl ${v}">
      ${h.what ? `<div class="hl-row"><span class="labelchip">기능</span><span class="arrow" aria-hidden="true">→</span><p>${inline(h.what)}</p></div>` : ''}
      ${h.how ? `<div class="hl-row"><span class="labelchip">구현 방법</span><span class="arrow" aria-hidden="true">→</span><p>${inline(h.how)}</p></div>` : ''}
      ${h.why ? `<div class="callout"><span class="lb">선택 이유</span><p>${inline(h.why)}</p></div>` : ''}${xref(h.section)}</div>`;
    const tsBody = (x, v) => {
      const st = steps.filter(([k]) => x[k]);
      const cols = st.map(() => 'minmax(0, 1fr)').join(' auto ');
      const flow = st.map(([k, l, c], j) => `${j ? '<span class="arrow" aria-hidden="true">→</span>' : ''}<div class="ts-step card${k === 'result' ? ' res' : ''}"><span class="labelchip${c ? ' ' + c : ''}">${l}</span><p>${inline(x[k])}</p></div>`).join('');
      return `<div class="ts ${v}">${st.length ? `<div class="ts-flow" style="grid-template-columns:${cols}">${flow}</div>` : ''}
        ${x.lesson ? `<div class="note"><p class="nlabel">배운 점</p><p class="nbody">${inline(x.lesson)}</p></div>` : ''}${xref(x.section)}</div>`;
    };
    const build = (chunk, v, i, n) => {
      const x = chunk[0];
      const s = PF.scene({ tpl, eyebrow: p.title, rlabel: `${sec} ${x._n}/${items.length}`, title: x.title, sub: x._part || '', foot,
                           titleId: i === 0 ? (isHL ? 'pf-hl' : 'pf-ts') : '', sec, stitle: x.title });
      PF.body(s).innerHTML = isHL ? hlBody(x, v) : tsBody(x, v);
      return s;
    };
    const variants = isHL ? [{ name: 'one', min: 1, max: 1 }, { name: 'tight', min: 1, max: 1 }] : [{ name: 'row', min: 1, max: 1 }, { name: 'stack', min: 1, max: 1 }];
    const widest = variants[variants.length - 1].name;
    const fields = isHL ? ['what', 'how', 'why'] : ['problem', 'cause', 'solution', 'result', 'lesson'];
    const fitsWide = (x) => fitsM(build([x], widest, 1, 2));
    const expanded = [];
    items.forEach((it, k) => {
      const base = { title: it.title, section: it.section, _n: k + 1 };
      if (fitsWide({ ...it, _n: k + 1 })) { expanded.push({ ...it, _n: k + 1 }); return; }
      const present = fields.filter((f) => it[f]);
      const parts = []; let cur = null;
      for (const f of present) {
        const trial = cur ? { ...cur, [f]: it[f] } : { ...base, [f]: it[f] };
        if (cur && !fitsWide(trial)) { parts.push(cur); cur = { ...base, [f]: it[f] }; } else cur = trial;
      }
      if (cur) parts.push(cur);
      parts.forEach((x, j) => { x._part = `${j + 1}/${parts.length}`; expanded.push(x); });
      info.overflow.push({ tpl, action: 'continue', title: it.title, parts: parts.length });
    });
    const pages = PF.pack(expanded, variants, build);
    info.summary[tpl + 'variants'] = pages.map((x) => `${x.variant || 'none'}×${x.chunk.length}`);
    return pages.map((pg, i) => {
      const s = build(pg.chunk, pg.variant || widest, i, pages.length);
      return pg.variant ? s : PF.shrinkOrClip(s, PFScene.refUrl(isHL ? 'pf-hl' : 'pf-ts'), info.overflow);
    });
  }

  // P6 결과와 회고(참고 덱 K): ✓ 달성 카드 │ 아쉬운 점 → 개선 계획 표. 안 들어가면 두 장으로(A1과 같음)
  function buildP6(r, p, foot) {
    const ach = r.achieved || [], reg = r.regrets || [], plan = r.plans || [];
    if (!ach.length && !reg.length && !plan.length) return [];
    const n = Math.max(reg.length, plan.length);
    const achHtml = ach.length ? `<div class="rt-ach card"><p class="rt-h ok">✓ 달성</p><ul>${ach.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div>` : '';
    const pairHtml = n ? `<table class="mini"><thead><tr><th>△ 아쉬운 점</th><th>→ 개선 계획</th></tr></thead><tbody>${Array.from({ length: n }, (_, i) => `<tr><td>${inline(reg[i] || '')}</td><td class="p">${inline(plan[i] || '')}</td></tr>`).join('')}</tbody></table>` : '';
    const make = (html, one, i, cnt) => {
      const s = PF.scene({ tpl: 'P6', eyebrow: p.title, rlabel: '결과와 회고', title: '달성 · 아쉬움 → 개선 계획', sub: cnt > 1 ? `${i + 1}/${cnt}` : '', foot, titleId: i === 0 ? 'pf-retro' : '', sec: '회고' });
      PF.body(s).innerHTML = `<div class="rt${one ? ' one' : ''}">${html}</div>`;
      return s;
    };
    const s = make(achHtml + pairHtml, !achHtml || !pairHtml, 0, 1);
    if (fitsM(s)) return [s];
    const two = [achHtml, pairHtml].filter(Boolean).map((h, i, a) => make(h, true, i, a.length));
    return two.map((x) => (fitsM(x) ? x : PF.shrinkOrClip(x, PFScene.refUrl('pf-retro'), info.overflow)));
  }

  // 디바이더(참고 덱 C): 인디고 전면 + bignum(구간 번호, 장식) + 구간 이름 + 오른쪽 아젠다 카드(그 구간의 실제 항목 이름)
  function buildDivider(x, p, foot) {
    const s = PF.scene({ tpl: 'DIV', kind: 'bare', part: x.part || 'summary', foot, sec: x.key === 'doc' ? '기술 문서' : x.t, stitle: x.t });
    const items = x.agenda.slice(0, 9);
    const more = x.agenda.length - items.length;
    PF.body(s).innerHTML = `<div class="dv"><p class="bignum" aria-hidden="true">${String(x.n).padStart(2, '0')}</p>
      <p class="dv-part">${x.key === 'doc' ? 'APPENDIX' : 'SECTION'}</p><h2 class="dv-title" id="dv-${x.key}">${esc(x.t)}</h2><p class="dv-sub">${esc(p.title)}</p></div>`;
    if (items.length) {
      s.insertAdjacentHTML('beforeend', `<aside class="dv-card card${items.length > 6 ? ' compact' : ''}"><p class="lb">${x.key === 'doc' ? '목차' : esc(x.t)}</p>${DOT}<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}${more > 0 ? `<li>외 ${more}개</li>` : ''}</ul></aside>`);
    }
    return fitsM(s) ? s : PF.shrinkOrClip(s, PFScene.refUrl(`dv-${x.key}`), info.overflow);
  }

  // P2 목차(참고 덱 B): CONTENTS + 점 선 + 번호 목록 2단(왼쪽 Q7 요약 구간 │ 오른쪽 기술 문서 H2 장). 쪽 번호는 키트가 채움(p.N)
  function buildToc(p, foot, secs, chapters, dividers) {
    const ref = (x) => (dividers[x.key] ? `dv-${x.key}` : x.key === 'doc' ? (chapters[0]?.id || 's-1') : x.id);   // 디바이더가 있으면 디바이더로
    const item = (n, t, d, ref, cls = '') => `<li${cls ? ` class="${cls}"` : ''}><a href="#s=${esc(ref)}" data-pf-ref="${esc(ref)}"><span class="n">${esc(n)}</span><span class="tx"><span class="t">${esc(t)}</span>${d ? `<span class="d">${esc(d)}</span>` : ''}</span><span class="pg"><span class="pf-n-screen">p.000</span><span class="pf-n-print"></span></span></a></li>`;
    const sum = secs.filter((x) => x.key !== 'doc');
    const docSec = secs.find((x) => x.key === 'doc');
    const make = (compact) => {
      const s = PF.scene({ tpl: 'P2', kind: 'bare', part: 'doc', cls: compact ? 'compact' : '', foot, sec: '목차', stitle: '목차' });
      const left = `<section><p class="toc-lb">프로젝트 요약</p><ol class="toc-list">${sum.map((x) => item(String(x.n).padStart(2, '0'), x.t, x.d, ref(x))).join('')}${docSec ? item(String(docSec.n).padStart(2, '0'), docSec.t, docSec.d, ref(docSec)) : ''}</ol></section>`;
      const right = chapters.length ? `<section><p class="toc-lb">기술 문서 부록 · 장</p><ol class="toc-list sub">${chapters.map((c) => { const m = /^(\d+)\.\s*(.*)$/.exec(c.title); return item(m ? m[1] : '·', m ? m[2] : c.title, '', c.id); }).join('')}</ol></section>` : '';
      PF.body(s).innerHTML = `<div class="toc-top"><p class="toc-h">CONTENTS</p><p class="toc-sub">${esc(p.title)}</p></div>${DOT}<div class="toc-cols">${left}${right}</div>`;
      return s;
    };
    for (const compact of [false, true]) { const s = make(compact); if (fitsM(s)) return s; }
    return PF.shrinkOrClip(make(true), PFScene.refUrl('s-2'), info.overflow);
  }

  // ════════════════════ 기술 문서 ════════════════════
  function docMsgScene(p, foot) {
    const s = PF.scene({ tpl: 'D1', part: 'doc', kind: 'doc', eyebrow: `${p.title} · 기술 문서`, crumb: '', foot, sec: '기술 문서' });
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
                  makeScene: () => PF.scene({ tpl: 'D1', part: 'doc', kind: 'doc', eyebrow: `${p.title} · 기술 문서`, crumb: '', foot, sec: '기술 문서' }),   // 【덱】 참고 덱 머리줄
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
      // 【덱】 머리줄 오른쪽 = 지금 장(H2) + (계속). 섹션명(HUD·개요) = 기술 문서 · 장, 장면 제목 = 장면 안 첫 제목 또는 장
      s.querySelector('.pf-crumb').innerHTML = `${crumbH2 ? `<b>${esc(crumbH2)}</b>` : '도입'}${cont ? ' <span class="pf-cont" data-pf-ui="cont" aria-hidden="true">(계속)</span>' : ''}`;
      s.dataset.sec = `기술 문서${crumbH2 ? ' · ' + crumbH2 : ''}`;
      const fh = b.querySelector(':scope > h2, :scope > h3, :scope > h4');
      s.dataset.title = `${fh ? fh.textContent.trim() : crumbH2 || '기술 문서'}${cont && !fh ? ' (계속)' : ''}`;
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
