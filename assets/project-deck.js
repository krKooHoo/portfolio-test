// 프로젝트 요약 덱(project.html?p=<폴더 이름>) — 요약 기술문서, 16:9 덱, 기술 문서 부록 없음(F1·F3, portfolio-structure §3)
//   장면 순서(Q7 개정): 표지 → 목차 → 스크린샷 → 핵심 구현 → 이슈 해결 → 회고 → 상세 문서로(장 목록)
//   장면 id(공유 주소 #s=<id>): cover · toc · shots(-n) · hl-<n>(-<쪽>) · ts-<n>(-<쪽>) · retro(-n) · more
//   핵심 구현·이슈 해결 장면마다 "상세 문서에서 보기 ↗" → doc.html?p=<폴더>#<그 절 제목의 slug>(새 탭).
//   slug는 상세 문서와 같은 파이프라인(marked → 제목 글자 → PF.slugger)으로 기술 문서 md에서 계산합니다. md는 그리지 않고 제목만 읽습니다.
//   내용(글)은 모두 data/projects/<id>.json과 src/<id>/기술문서.md(제목)에서 옴. 새 문장·수치를 만들지 않음(장면 이름·라벨은 UI 글자)
(() => {
  const Q = new URLSearchParams(location.search);
  const id = Q.get('p');
  const deck = document.getElementById('deck');
  const info = (PFScene.info = { page: 'project', id, t: {}, summary: {}, overflow: [], errors: [], unresolved: [] });
  const mark = (k) => { info.t[k] = Math.round(performance.now()); };
  const { esc, inline, isUrl, shortUrl, DOT, link } = PF;
  const BODY_SUM = 516;

  // ── 옛 주소 넘기기(portfolio-structure §1-2). 이미 이력서·메신저로 공유된 project.html?p=X#… 를 지킴 ──
  //   #s=… · #<숫자> · #s-n · 새 장면 id → 그대로 덱이 받음 / #pf-doc → 상세 문서 / #pf-highlights 등 → 첫 장면 / 그 밖(옛 기술 문서 제목 앵커) → 상세 문서의 같은 조각
  const SLIDE = /^(cover|toc|shots(-\d+)?|hl-\d+(-\d+)?|ts-\d+(-\d+)?|retro(-\d+)?|more|notice)$/;
  const LEGACY = { 'pf-highlights': 'hl-1', 'pf-troubleshooting': 'ts-1', 'pf-screenshots': 'shots', 'pf-retro': 'retro' };
  const redirected = (() => {
    if (!id || !location.hash || location.hash === '#') return false;
    const rawEnc = location.hash.slice(1);
    let raw = rawEnc; try { raw = decodeURIComponent(rawEnc); } catch { /* 그대로 */ }
    if (/^s=/.test(raw) || /^-?\d+$/.test(raw) || /^s-\d+$/.test(raw) || SLIDE.test(raw)) return false;
    if (raw === 'pf-doc') { location.replace(PF.docUrl(id)); return true; }
    if (LEGACY[raw]) { try { history.replaceState(null, '', `${location.pathname}${location.search}#s=${LEGACY[raw]}`); } catch { /* */ } return false; }
    location.replace(PF.docUrl(id, rawEnc));
    return true;
  })();
  if (redirected) return;

  PFScene.track(start().catch((err) => {
    info.errors.push(String(err && err.stack || err));
    deck.replaceChildren(PF.msgScene({ title: '페이지를 그리지 못했습니다', html: `<p>${esc(err && err.message || err)}</p>` }));
  }).finally(() => { PF.dropMeasure(); PFScene.mount({ deck: '#deck', hint: link({ href: id ? PF.docUrl(id) : 'index.html', label: '휴대폰에서는 상세 문서가 읽기 편합니다', kind: 'page' }) }); mark('mounted'); }));

  async function start() {
    mark('start');
    if (PF.isFile()) { deck.replaceChildren(PF.msgScene({ title: '로컬 서버로 열어 주세요', html: PF.FILE_HELP })); return; }
    const back = `<p>${link({ href: 'index.html', label: '← 포트폴리오로', kind: 'page' })}</p>`;
    if (!id) { deck.replaceChildren(PF.msgScene({ title: '프로젝트를 고르세요', html: `<p>주소 끝에 <code>?p=폴더이름</code>을 붙여 주세요.</p>${back}` })); return; }
    const pf = await PF.loadJSON('data/portfolio.json').catch(() => ({}));
    PF.applyTheme(pf.settings?.accent);
    let p;
    try { p = await PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`); }
    catch (err) { deck.replaceChildren(PF.msgScene({ title: '프로젝트를 찾을 수 없습니다', html: `<p>${esc(err.message)}</p>${back}` })); return; }
    let heads = [];
    try { heads = PF.headingsOf(await PF.loadText(PF.srcPath(p.id, p.doc))); } catch (e) { info.errors.push('doc: ' + e.message); }
    info.headings = heads.length;
    mark('data');
    const render = () => renderAll(pf, p, heads);
    await render();
    PF.refitOnLateFont(render);
  }

  async function renderAll(pf, p, heads) {
    const name = pf.profile?.name || '';
    const foot = `${name ? name + ' · ' : ''}${p.title}`;
    document.title = `${p.title} · 요약 덱${name ? ' · ' + name : ''}`;
    info.fonts = await PF.loadFonts();
    mark('fonts');
    const ov = info.overflow;
    // data의 section(절 제목) → 상세 문서 주소(같은 규칙: 정확히 일치 → 앞부분 일치, 첫 번째)
    const docLink = (section) => {
      const h = section ? PF.resolveHeading(heads, section) : null;
      if (section && !h) { info.unresolved.push(section); console.warn('[portfolio] 상세 문서에서 절 제목을 찾지 못함 → 문서 맨 위로:', section); }
      return link({ href: PF.docUrl(p.id, h ? h.id : ''), kind: 'page', cls: 'pf-doclink',
                    label: `<span class="t">상세 문서에서 보기</span>${h ? `<span class="sec">${esc(h.text)}</span>` : ''}` });
    };
    const ext = PF.extLinks(p);

    // P1 표지 = 포트폴리오 덱의 프로젝트 소개와 같은 템플릿
    const coverLinks = [
      ...ext.filter((l) => !l.extra).map((l) => ({ label: l.label, href: l.url, kind: 'external', visible: shortUrl(l.url) })),
      { label: '상세 문서', href: PF.docUrl(p.id), kind: 'page', visible: PF.visibleUrl(PF.docUrl(p.id)) },
      { label: '포트폴리오', href: 'index.html', kind: 'page', visible: PF.visibleUrl('') },
    ];
    const P1 = await PF.introScene(p, { id: 'cover', titleTag: 'h1', eyebrow: 'PROJECT · 요약 덱', links: coverLinks, foot, sec: '표지', stats: ov });
    const P5 = await buildShots(p, foot);
    const P3 = buildItems(p.highlights || [], 'P3', p, foot, docLink);
    const P4 = buildItems(p.troubleshooting || [], 'P4', p, foot, docLink);
    const P6 = buildRetro(p.retro || {}, p, foot);
    const chapters = heads.filter((h) => h.level === 2 && !/^(목차|차례|contents|table of contents)$/i.test(PF.normTitle(h.text)));
    const P8 = buildMore(p, foot, chapters, ext);
    const TOC = buildToc(p, foot, { P5, P3, P4, P6, chapters });
    mark('summary');
    Object.assign(info.summary, { P1: 1, P2: 1, P5: P5.length, P3: P3.length, P4: P4.length, P6: P6.length, P8: 1, chapters: chapters.length });
    deck.replaceChildren(P1, TOC, ...P5, ...P3, ...P4, ...P6, P8);
    deck.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('loading')) i.loading = 'lazy'; i.decoding = 'async'; });
    mark('assembled');
  }

  // ── P5 스크린샷: 줄 맞춤 배치(본문 1136×516). 이미지 높이 ≥180이 아니면 나눔 ──
  async function buildShots(p, foot) {
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
      const sid = i === 0 ? 'shots' : `shots-${i + 1}`;
      const make = (CAP) => {
        const s = PF.scene({ id: sid, tpl: 'P5', eyebrow: p.title, rlabel: '스크린샷', title: '실제 화면', sub: pages.length > 1 ? `${i + 1}/${pages.length}` : '', foot, sec: '스크린샷' });
        const L = bestLayout(pg, CAP);
        let y = 0, html = '';
        L.rows.forEach((r, ri) => {
          const h = L.hs[ri];
          const rw = r.reduce((a, x) => a + Math.floor(x.ar * h), 0) + GAP * (r.length - 1);
          let x = Math.floor((BW - rw) / 2);
          r.forEach((sh) => { const w = Math.floor(sh.ar * h);
            html += `<figure style="left:${x}px;top:${y}px;width:${w}px"><div class="media" style="height:${h}px">${PF.imgTag(PF.srcPath(p.id, sh.src), sh.caption || '', sh.d)}</div><figcaption style="height:${CAP}px">${inline(sh.caption || '')}</figcaption></figure>`;
            x += w + GAP; });
          y += h + CAP + GAP;
        });
        PF.body(s).innerHTML = `<div class="gal">${html}</div>`;
        return s;
      };
      for (const CAP of [28, 48]) { const s = make(CAP); if (PF.fitsM(s)) return s; }
      return PF.shrinkOrClip(make(48), PFScene.refUrl(sid), info.overflow);
    });
  }

  // ── P3 핵심 구현 · P4 이슈 해결: 한 장에 한 항목. 넘치면 원칙 5: 변형(촘촘) → 필드 경계에서 이어짐(1/2) → 축소 → 잘림 띠 ──
  function buildItems(items, tpl, p, foot, docLink) {
    if (!items.length) return [];
    const isHL = tpl === 'P3';
    const sec = isHL ? '핵심 구현' : '이슈 해결';
    const pre = isHL ? 'hl' : 'ts';
    const steps = [['problem', '문제', ''], ['cause', '원인', ''], ['solution', '해결', 'accent'], ['result', '결과', 'ok']];
    const hlBody = (h, v) => `<div class="hl ${v}">
      ${h.what ? `<div class="hl-row"><span class="labelchip">기능</span><span class="arrow" aria-hidden="true">→</span><p>${inline(h.what)}</p></div>` : ''}
      ${h.how ? `<div class="hl-row"><span class="labelchip">구현 방법</span><span class="arrow" aria-hidden="true">→</span><p>${inline(h.how)}</p></div>` : ''}
      ${h.why ? `<div class="callout"><span class="lb">선택 이유</span><p>${inline(h.why)}</p></div>` : ''}${docLink(h.section)}</div>`;
    const tsBody = (x, v) => {
      const st = steps.filter(([k]) => x[k]);
      const cols = st.map(() => 'minmax(0, 1fr)').join(' auto ');
      const flow = st.map(([k, l, c], j) => `${j ? '<span class="arrow" aria-hidden="true">→</span>' : ''}<div class="ts-step card${k === 'result' ? ' res' : ''}"><span class="labelchip${c ? ' ' + c : ''}">${l}</span><p>${inline(x[k])}</p></div>`).join('');
      return `<div class="ts ${v}">${st.length ? `<div class="ts-flow" style="grid-template-columns:${cols}">${flow}</div>` : ''}
        ${x.lesson ? `<div class="note"><p class="nlabel">배운 점</p><p class="nbody">${inline(x.lesson)}</p></div>` : ''}${docLink(x.section)}</div>`;
    };
    const build = (chunk, v) => {
      const x = chunk[0];
      const s = PF.scene({ id: x._part && x._pi > 1 ? `${pre}-${x._n}-${x._pi}` : `${pre}-${x._n}`, tpl, eyebrow: p.title, rlabel: `${sec} ${x._n}/${items.length}`, title: x.title, sub: x._part || '', foot, sec, stitle: x.title });
      PF.body(s).innerHTML = isHL ? hlBody(x, v) : tsBody(x, v);
      return s;
    };
    const variants = isHL ? [{ name: 'one', min: 1, max: 1 }, { name: 'tight', min: 1, max: 1 }] : [{ name: 'row', min: 1, max: 1 }, { name: 'stack', min: 1, max: 1 }];
    const widest = variants[variants.length - 1].name;
    const fields = isHL ? ['what', 'how', 'why'] : ['problem', 'cause', 'solution', 'result', 'lesson'];
    const fitsWide = (x) => PF.fitsM(build([x], widest));
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
      parts.forEach((x, j) => { x._part = `${j + 1}/${parts.length}`; x._pi = j + 1; expanded.push(x); });
      info.overflow.push({ tpl, action: 'continue', title: it.title, parts: parts.length });
    });
    const pages = expanded.map((x) => ({ chunk: [x], variant: variants.find((v) => PF.fitsM(build([x], v.name)))?.name || null }));
    info.summary[tpl + 'variants'] = pages.map((x) => x.variant || 'none');
    return pages.map((pg) => {
      const s = build(pg.chunk, pg.variant || widest);
      return pg.variant ? s : PF.shrinkOrClip(s, PFScene.refUrl(s.id), info.overflow);
    });
  }

  // ── P6 결과와 회고: ✓ 달성 카드 │ 아쉬운 점 → 개선 계획 표. 안 들어가면 두 장으로 ──
  function buildRetro(r, p, foot) {
    const ach = r.achieved || [], reg = r.regrets || [], plan = r.plans || [];
    if (!ach.length && !reg.length && !plan.length) return [];
    const n = Math.max(reg.length, plan.length);
    const achHtml = ach.length ? `<div class="rt-ach card"><p class="rt-h ok">✓ 달성</p><ul>${ach.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div>` : '';
    const pairHtml = n ? `<table class="mini"><thead><tr><th scope="col">△ 아쉬운 점</th><th scope="col">→ 개선 계획</th></tr></thead><tbody>${Array.from({ length: n }, (_, i) => `<tr><td>${inline(reg[i] || '')}</td><td class="p">${inline(plan[i] || '')}</td></tr>`).join('')}</tbody></table>` : '';
    const make = (html, one, i, cnt) => {
      const s = PF.scene({ id: i === 0 ? 'retro' : `retro-${i + 1}`, tpl: 'P6', eyebrow: p.title, rlabel: '결과와 회고', title: '달성 · 아쉬움 → 개선 계획', sub: cnt > 1 ? `${i + 1}/${cnt}` : '', foot, sec: '회고' });
      PF.body(s).innerHTML = `<div class="rt${one ? ' one' : ''}">${html}</div>`;
      return s;
    };
    const s = make(achHtml + pairHtml, !achHtml || !pairHtml, 0, 1);
    if (PF.fitsM(s)) return [s];
    const two = [achHtml, pairHtml].filter(Boolean).map((h, i, a) => make(h, true, i, a.length));
    return two.map((x) => (PF.fitsM(x) ? x : PF.shrinkOrClip(x, PFScene.refUrl(x.id), info.overflow)));
  }

  // ── P8 상세 문서로: 상세 문서 열기 + 장(H2) 목록(원문 제목 그대로, 각 장으로 새 탭) + 바깥 링크 ──
  function buildMore(p, foot, chapters, ext) {
    const bottom = [...ext.map((l) => link({ href: l.url, label: esc(l.label) })), link({ href: 'index.html', label: '← 포트폴리오 덱', kind: 'page' })];
    const make = (compact) => {
      const s = PF.scene({ id: 'more', tpl: 'P8', kind: 'bare', foot, sec: '상세 문서로', stitle: '상세 기술문서' });
      PF.body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">DETAILED DOCUMENT</span><span class="rl">${esc(p.title)}</span></div>
        <h2 class="mo-h">상세 기술문서</h2><p class="mo-lead">코드 · 다이어그램 · 설계 과정 전문은 상세 문서에 있습니다.</p>
        <div class="mo-open">${link({ href: PF.docUrl(p.id), label: '상세 문서 열기', kind: 'page', cls: 'btnlink primary' })}<span class="url">${esc(PF.visibleUrl(PF.docUrl(p.id)))}</span></div>
        ${chapters.length ? `<div class="mo-ch${compact ? ' compact' : ''}"><p class="toc-lb">장 목록</p><ol>${chapters.map((c) => `<li>${link({ href: PF.docUrl(p.id, c.id), label: esc(c.text), kind: 'page' })}</li>`).join('')}</ol></div>` : '<div class="mo-ch"></div>'}
        <div class="mo-bot">${bottom.join('')}</div>`;
      return s;
    };
    for (const compact of [false, true]) { const s = make(compact); if (PF.fitsM(s)) return s; }
    return PF.shrinkOrClip(make(true), PFScene.refUrl('more'), info.overflow);
  }

  // ── P2 목차: 왼쪽 = 요약 구간(같은 덱 안 이동, 같은 탭) · 오른쪽 = 핵심 구현·이슈 해결 항목. 쪽 번호(p.N)는 키트가 채움 ──
  function buildToc(p, foot, { P5, P3, P4, P6, chapters }) {
    const item = (n, t, d, ref, sub) => `<li><a href="#${esc(ref)}" data-pf-ref="${esc(ref)}"><span class="n">${esc(n)}</span><span class="tx"><span class="t">${inline(t)}</span>${d ? `<span class="d">${esc(d)}</span>` : ''}</span><span class="pg"><span class="pf-n-screen">p.00</span><span class="pf-n-print"></span></span></a></li>`;
    const secs = [
      P5.length && ['스크린샷', `${(p.screenshots || []).length}장`, P5[0].id],
      P3.length && ['핵심 구현', `${(p.highlights || []).length}개 항목`, P3[0].id],
      P4.length && ['이슈 해결', `${(p.troubleshooting || []).length}개 사례`, P4[0].id],
      P6.length && ['결과와 회고', '달성 · 아쉬운 점 → 개선 계획', P6[0].id],
      ['상세 기술문서로', chapters.length ? `장 ${chapters.length}개 목록 · 상세 문서는 새 탭` : '상세 문서는 새 탭', 'more'],
    ].filter(Boolean);
    const firstOf = (list, pre, n) => list.find((s) => s.id === `${pre}-${n}`)?.id || `${pre}-${n}`;
    const subs = [
      (p.highlights || []).length && ['핵심 구현', p.highlights.map((h, i) => item(String(i + 1), h.title, '', firstOf(P3, 'hl', i + 1))).join('')],
      (p.troubleshooting || []).length && ['이슈 해결', p.troubleshooting.map((t, i) => item(String(i + 1), t.title, '', firstOf(P4, 'ts', i + 1))).join('')],
    ].filter(Boolean);
    const make = (compact) => {
      const s = PF.scene({ id: 'toc', tpl: 'P2', kind: 'bare', cls: compact ? 'compact' : '', foot, sec: '목차', stitle: '목차' });
      const left = `<section><p class="toc-lb">프로젝트 요약</p><ol class="toc-list">${secs.map(([t, d, ref], i) => item(String(i + 1).padStart(2, '0'), t, d, ref)).join('')}</ol></section>`;
      const right = subs.length ? `<section>${subs.map(([h, html], i) => `<p class="toc-lb${i ? ' toc-grp' : ''}">${esc(h)}</p><ol class="toc-list sub">${html}</ol>`).join('')}</section>` : '';
      PF.body(s).innerHTML = `<div class="toc-top"><p class="toc-h">CONTENTS</p><p class="toc-sub">${esc(p.title)}</p></div>${DOT}<div class="toc-cols">${left}${right}</div>`;
      return s;
    };
    for (const compact of [false, true]) { const s = make(compact); if (PF.fitsM(s)) return s; }
    return PF.shrinkOrClip(make(true), PFScene.refUrl('toc'), info.overflow);
  }
})();
