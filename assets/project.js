// 프로젝트 상세 — format/01-portfolio.md §2
// 위: 한눈에 보기(data/projects/<id>.json) · 아래: 기술 문서 전문(src/<id>/<doc>를 라이브 렌더)
(async () => {
  const root = document.getElementById('app');
  if (PF.guardFileProtocol(root)) return;

  const { esc, inline } = PF;
  const id = new URLSearchParams(location.search).get('p');
  const pf = await PF.loadJSON('data/portfolio.json').catch(() => ({}));
  PF.applyAccent(pf.settings?.accent);

  let p;
  try {
    if (!id) throw new Error('주소에 ?p=<폴더 이름>이 없습니다');
    p = await PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`);
  } catch (err) {
    return PF.notice(root, '프로젝트를 찾을 수 없습니다', `
      <p>${esc(err.message)}</p><p style="margin-top:12px"><a class="btn" href="index.html">← 포트폴리오로</a></p>`);
  }

  const name = pf.profile?.name || '';
  document.title = `${p.title} · ${name || '포트폴리오'}`;
  const zoom = PF.lightbox();

  // ── 히어로: 이름·한 줄 소개·개발 환경·링크 ─────────────
  const metaRows = [
    ...(p.meta || []).map((m) => `<div><dt>${esc(m.label)}</dt><dd>${inline(m.value)}</dd></div>`),
    p.team?.role && `<div class="role"><dt>내 역할</dt><dd>${inline(p.team.role)}</dd></div>`,
  ].filter(Boolean).join('');

  const hero = `
    <header class="p-hero wrap">
      <a class="back" href="index.html">← ${esc(name || '포트폴리오')}</a>
      <h1>${esc(p.title)}</h1>
      ${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
      <div class="row">
        <span class="badge${p.team?.type === 'team' ? ' team' : ''}">${esc(PF.teamLabel(p.team))}</span>
        <ul class="tags">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <div class="p-top">
        <div class="p-cover">${PF.cover(p)}</div>
        <div>
          <dl class="meta">${metaRows}</dl>
          <div class="actions" style="margin-top:14px">${PF.linkButtons(p.links)}</div>
        </div>
      </div>
    </header>`;

  const sectionHead = (no, title, sub = '') =>
    `<div class="section-head"><span class="no">${no}</span><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>`;
  const more = (section) => section
    ? `<a class="more" href="#" data-section="${esc(section)}">원문에서 자세히 →</a>` : '';
  let no = 0;
  const nextNo = () => String(++no).padStart(2, '0');

  // ── 핵심 구현: 기능 · 구현 방법 · 선택 이유 ─────────────
  const highlights = (p.highlights || []).length ? `
    <section class="section wrap" id="pf-highlights">
      ${sectionHead(nextNo(), '핵심 구현', '무엇을, 어떻게, 왜 그렇게 만들었는지')}
      <div class="hl-grid">${p.highlights.map((h) => `
        <article class="hl">
          <h3>${inline(h.title)}</h3>
          <dl>
            ${h.what ? `<div><dt>기능</dt><dd>${inline(h.what)}</dd></div>` : ''}
            ${h.how ? `<div><dt>구현 방법</dt><dd>${inline(h.how)}</dd></div>` : ''}
            ${h.why ? `<div class="why"><dt>선택 이유</dt><dd>${inline(h.why)}</dd></div>` : ''}
          </dl>
          ${more(h.section)}
        </article>`).join('')}
      </div>
    </section>` : '';

  // ── 이슈 해결: 문제 → 원인 → 해결 → 결과 ──────────────
  const steps = [['problem', '문제'], ['cause', '원인'], ['solution', '해결'], ['result', '결과']];
  const troubles = (p.troubleshooting || []).length ? `
    <section class="section wrap" id="pf-troubleshooting">
      ${sectionHead(nextNo(), '이슈 해결', '문제 → 원인 → 해결 → 결과')}
      ${p.troubleshooting.map((t) => `
        <article class="ts">
          <div class="ts-head"><h3>${inline(t.title)}</h3>${more(t.section)}</div>
          <dl class="ts-steps" style="--n:${steps.filter(([k]) => t[k]).length}">${steps.filter(([k]) => t[k])
            .map(([k, label]) => `<div${k === 'result' ? ' class="is-result"' : ''}><dt>${label}</dt><dd>${inline(t[k])}</dd></div>`).join('')}</dl>
          ${t.lesson ? `<p class="ts-lesson"><b>배운 점</b>${inline(t.lesson)}</p>` : ''}
        </article>`).join('')}
    </section>` : '';

  // ── 스크린샷 4~6장 ─────────────────────────────────
  const shots = (p.screenshots || []).length ? `
    <section class="section wrap" id="pf-screenshots">
      ${sectionHead(nextNo(), '스크린샷', '이미지를 누르면 크게 볼 수 있습니다')}
      <div class="shots">${p.screenshots.map((s) => `
        <figure class="shot">
          <img src="${PF.srcPath(p.id, s.src)}" alt="${esc(s.caption)}" loading="lazy" />
          ${s.caption ? `<figcaption>${inline(s.caption)}</figcaption>` : ''}
        </figure>`).join('')}
      </div>
    </section>` : '';

  // ── 회고: 달성 / 아쉬움 / 계획 ─────────────────────
  const r = p.retro || {};
  const retroCol = (title, items) => (items || []).length
    ? `<div><h3>${title}</h3><ul>${items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul></div>` : '';
  const retroCols = retroCol('달성', r.achieved) + retroCol('아쉬운 점', r.regrets) + retroCol('개선 계획', r.plans);
  const retro = retroCols ? `
    <section class="section wrap" id="pf-retro">
      ${sectionHead(nextNo(), '결과와 회고')}
      <div class="retro">${retroCols}</div>
    </section>` : '';

  // ── 기술 문서 전문 ──────────────────────────────────
  const docSection = `
    <section class="section wrap" id="pf-doc">
      ${sectionHead(nextNo(), '기술 문서 전문', esc(`src/${p.id}/${p.doc}`))}
      <div class="doc-layout">
        <details class="toc" id="toc" open><summary>목차</summary><div id="toc-links"></div></details>
        <article class="md" id="doc"><div class="loading">기술 문서를 불러오는 중…</div></article>
      </div>
    </section>`;

  const nav = `
    <div class="topbar"><div class="wrap">
      <a class="brand" href="index.html">${esc(name || '포트폴리오')}</a>
      <nav>
        ${highlights ? '<a href="#pf-highlights">핵심 구현</a>' : ''}
        ${troubles ? '<a href="#pf-troubleshooting">이슈 해결</a>' : ''}
        ${shots ? '<a href="#pf-screenshots">스크린샷</a>' : ''}
        ${retro ? '<a href="#pf-retro">회고</a>' : ''}
        <a href="#pf-doc">기술 문서</a>
      </nav>
    </div></div>`;

  root.innerHTML = nav + hero + highlights + troubles + shots + retro + docSection +
    `<footer class="footer"><div class="wrap"><span>© ${esc(name)}</span><a href="index.html">← 포트폴리오로</a></div></footer>`;

  root.addEventListener('click', (e) => {
    const img = e.target.closest('.p-cover img, .shot img, .md img');
    if (img) zoom(img.currentSrc || img.src, img.alt);
  });

  await renderDoc(p);
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();

  async function renderDoc(p) {
    const doc = document.getElementById('doc');
    let md;
    try {
      const res = await fetch(PF.srcPath(p.id, p.doc), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      md = await res.text();
    } catch (err) {
      doc.innerHTML = `<p style="color:#C0392B">기술 문서를 불러오지 못했습니다 (${esc(err.message)}).</p>`;
      return;
    }
    doc.innerHTML = marked.parse(md, { gfm: true });

    // ① 상대경로(이미지·링크)를 src/<id>/ 기준으로
    const isRelative = (u) => u && !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(u);
    const decode = (u) => { try { return decodeURI(u); } catch (_) { return u; } };
    doc.querySelectorAll('img[src], video[src], source[src]').forEach((el) => {
      const s = el.getAttribute('src');
      if (isRelative(s)) el.setAttribute('src', PF.srcPath(p.id, decode(s)));
    });
    doc.querySelectorAll('a[href]').forEach((a) => {
      const h = a.getAttribute('href');
      if (isRelative(h)) a.setAttribute('href', PF.srcPath(p.id, decode(h)));
      else if (/^https?:/i.test(h)) { a.target = '_blank'; a.rel = 'noopener'; }
    });

    // ② 제목 앵커 (GitHub 규칙) + 목차
    const slug = PF.slugger();
    const tocLinks = [];
    const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    headings.forEach((h) => {
      h.id = slug(h.textContent.trim());
      if (h.tagName === 'H2' || h.tagName === 'H3') {
        tocLinks.push(`<a class="${h.tagName.toLowerCase()}" href="#${h.id}">${esc(h.textContent.trim())}</a>`);
      }
    });
    document.getElementById('toc-links').innerHTML = tocLinks.join('');
    if (matchMedia('(max-width: 960px)').matches) document.getElementById('toc').open = false;

    // ③ "원문에서 자세히 →" 링크를 제목 앵커에 연결
    const byTitle = new Map(headings.map((h) => [PF.normTitle(h.textContent), h.id]));
    document.querySelectorAll('a[data-section]').forEach((a) => {
      const want = PF.normTitle(a.dataset.section);
      const hit = byTitle.get(want) ||
        [...byTitle.entries()].find(([t]) => t.startsWith(want) || want.startsWith(t))?.[1];
      if (hit) a.setAttribute('href', `#${hit}`);
      else { console.warn('[portfolio] 원문에서 제목을 찾지 못함:', a.dataset.section); a.remove(); }
    });

    // ④ Mermaid 라이브 렌더
    let n = 0;
    doc.querySelectorAll('code.language-mermaid').forEach((code) => {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.id = `mmd-${n++}`;
      div.textContent = code.textContent;
      (code.closest('pre') || code).replaceWith(div);
    });
    if (window.mermaid) {
      mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'Pretendard, sans-serif' });
      try { await mermaid.run({ nodes: doc.querySelectorAll('.mermaid') }); }
      catch (err) { console.warn('[portfolio] Mermaid 렌더 오류:', err); }
    }

    // ⑤ 코드 하이라이트
    if (window.hljs) doc.querySelectorAll('pre code').forEach((el) => { try { hljs.highlightElement(el); } catch (_) {} });

    // ⑥ 목차 현재 위치 표시
    const links = new Map([...document.querySelectorAll('#toc-links a')].map((a) => [a.hash.slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e) => {
        links.forEach((a) => a.classList.remove('active'));
        links.get(e.target.id)?.classList.add('active');
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    headings.filter((h) => links.has(h.id)).forEach((h) => io.observe(h));
  }
})();
