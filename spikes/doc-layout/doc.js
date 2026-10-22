// 상세 기술문서 시안 — doc.html?p=<폴더>&layout=1|2|3  (portfolio-structure.md §4, 링크는 §5 / README F10)
// 문서 처리 순서는 assets/project.js renderDoc과 같습니다(marked 12.0.2 → 상대경로 → GitHub식 slug·목차 → 절 연결 → Mermaid 11.4.1 → hljs 11.9.0).
// 이 시안에서 더한 것: 머리·목차·레일·절 머리 칩, 링크 규칙(F10), 표 감싸개·그림 문단 표시, 코드·표 접근성, 라이트박스, 인쇄용 링크 목록.
(async () => {
  const root = document.getElementById('app');
  if (PF.guardFileProtocol(root)) return;

  const { esc, inline } = PF;
  const html = document.documentElement;
  const Q = new URLSearchParams(location.search);
  const id = Q.get('p') || '1-action-platformer';
  const layout = ['1', '2', '3'].includes(Q.get('layout')) ? Q.get('layout') : '2';
  html.dataset.layout = layout;

  const UP = '../../';                                             // 이 시안은 spikes/doc-layout/ 아래에 있음
  const srcPath = (rel) => UP + PF.srcPath(id, rel);
  const deckUrl = (hash = '') => `../deck/pages/project.html?p=${encodeURIComponent(id)}${hash}`;
  const portfolioUrl = UP + 'index.html';

  // ── 링크 규칙 (F10 / §5-1): 문서 사이·외부 = 새 탭 + ↗ + 숨김 "(새 탭)", 같은 문서 안·mailto·라이트박스 = 같은 탭 ──
  const ICON = '<svg class="pf-newtab-icon" aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="12" height="12"><path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const NEWTAB = `${ICON}<span class="sr-only pf-newtab-sr">(새 탭)</span>`;
  const NEW_TAB_KINDS = new Set(['external', 'page', 'file']);
  function link({ href, label, kind, cls = '' }) {
    const nt = NEW_TAB_KINDS.has(kind);
    return `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}"${nt ? ' target="_blank" rel="noopener"' : ''}>${label}${nt ? NEWTAB : ''}</a>`;
  }
  function markNewTab(a) {                                           // md 안 <a>에 같은 규칙 적용
    a.target = '_blank'; a.rel = 'noopener';
    if (!a.querySelector('.pf-newtab-icon')) a.insertAdjacentHTML('beforeend', NEWTAB);
  }

  const pf = await PF.loadJSON(UP + 'data/portfolio.json').catch(() => ({}));
  PF.applyAccent(pf.settings?.accent);
  let p;
  try {
    p = await PF.loadJSON(`${UP}data/projects/${encodeURIComponent(id)}.json`);
  } catch (err) {
    return PF.notice(root, '프로젝트를 찾을 수 없습니다', `<p>${esc(err.message)}</p>`);
  }
  const name = pf.profile?.name || '';
  document.title = `${p.title} — 기술 문서 · ${name || '포트폴리오'}`;

  // ── 요약 덱 장면 대응 (§3-3·§4-5): highlights → #s=hl-<n>, troubleshooting → #s=ts-<n>. 그 밖(회고 등)은 data에 section이 없어 없음 ──
  const targets = [
    ...(p.highlights || []).map((h, i, a) => ({ section: h.section, scene: `hl-${i + 1}`, kind: '핵심 구현', n: `${i + 1}/${a.length}`, title: h.title })),
    ...(p.troubleshooting || []).map((t, i, a) => ({ section: t.section, scene: `ts-${i + 1}`, kind: '이슈 해결', n: `${i + 1}/${a.length}`, title: t.title })),
  ].filter((t) => t.section);

  // ── 뼈대 ──
  const metaRows = (p.meta || []).map((m) => `<div><dt>${esc(m.label)}</dt><dd>${inline(m.value)}</dd></div>`).join('') +
    (p.team?.role ? `<div class="role"><dt>내 역할</dt><dd>${inline(p.team.role)}</dd></div>` : '');
  const ext = [
    PF.isUrl(p.links?.github) && link({ href: p.links.github, label: 'GitHub', kind: 'external', cls: 'btn' }),
    PF.isUrl(p.links?.video) && link({ href: p.links.video, label: '시연 영상', kind: 'external', cls: 'btn' }),
    ...(p.links?.extra || []).filter((l) => PF.isUrl(l.url)).map((l) => link({ href: l.url, label: esc(l.label), kind: 'external', cls: 'btn' })),
  ].filter(Boolean);
  const deckBtn = link({ href: deckUrl(), label: '요약 덱으로', kind: 'page', cls: 'btn primary' });
  const tags = (p.tags || []).length ? `<ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';

  root.innerHTML = `
    <header class="doc-head">
      <div class="doc-head-in">
        <p class="crumb">${link({ href: portfolioUrl, label: `← ${esc(name || '포트폴리오')}`, kind: 'page' })}<span aria-hidden="true">›</span><b>${esc(p.title)} — 기술 문서</b></p>
        <nav class="head-nav" aria-label="프로젝트 링크">
          ${deckBtn}${ext.join('')}
          ${layout === '3' ? '<button type="button" class="btn narrow-btn" aria-pressed="false">좁게 읽기</button>' : ''}
          <span class="newtab-note">링크는 새 탭에서 열립니다</span>
        </nav>
      </div>
    </header>
    <div class="print-only print-urls"></div>
    <div class="doc-page">
      <nav class="toc" id="toc" aria-label="문서 목차"><p class="toc-title">목차</p><div class="toc-links" id="toc-links"></div></nav>
      <main class="doc-main" id="main" tabindex="-1">
        <div class="doc-intro">
          <p class="eyebrow">상세 기술 문서</p>
          <h1>${esc(p.title)}</h1>
          ${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
          <dl class="meta-line">${metaRows}</dl>
          ${tags}
          <details class="glance" id="glance"><summary>한눈에 · 링크</summary>
            <div class="glance-body"><div class="actions">${deckBtn}${ext.join('')}</div>
            <p class="newtab-note">링크는 새 탭에서 열립니다. 요약 덱은 PC에서 보기 좋습니다.</p></div>
          </details>
        </div>
        <article class="md" id="doc"><p class="loading">기술 문서를 불러오는 중…</p></article>
      </main>
      <aside class="rail" aria-label="요약 덱 연결">
        <section class="rail-card"><p class="rail-title">이 프로젝트</p><dl class="rail-meta">${metaRows}</dl>
          <div class="actions">${deckBtn}${ext.join('')}</div></section>
        <section class="rail-card" id="rail-now" aria-live="polite"><p class="rail-title">지금 읽는 절</p><p class="now-title">—</p><div class="now-body"></div></section>
        <section class="rail-card rail-misc">
          ${link({ href: srcPath(p.doc), label: '원문 마크다운', kind: 'file' })}
          ${PF.isUrl(p.links?.github) ? link({ href: p.links.github, label: '원문 GitHub', kind: 'external' }) : ''}
          <a href="#top" class="to-top">맨 위로 ↑</a>
        </section>
      </aside>
    </div>
    <div class="doc-fab" role="group" aria-label="빠른 이동"><button type="button" class="fab-toc" aria-haspopup="dialog">목차</button><a class="fab-top" href="#top" aria-label="맨 위로">↑</a></div>
    <dialog class="toc-dialog" aria-label="문서 목차"><div class="toc-dialog-head"><p class="toc-title">목차</p><button type="button" class="btn dlg-close">닫기</button></div><div class="toc-links"></div></dialog>
    <footer class="doc-foot"><span>© ${esc(name)}</span>${link({ href: portfolioUrl, label: '← 포트폴리오', kind: 'page' })}</footer>`;

  // 좁은 화면(< 720px)에서는 "한눈에" 상자를 접어 둠
  document.getElementById('glance').open = !matchMedia('(max-width: 719.98px)').matches;

  // ③ [좁게 읽기] 전환 (48rem ↔ 40rem). 선택은 이 브라우저에만 기억(실패해도 동작)
  const narrowBtn = root.querySelector('.narrow-btn');
  if (narrowBtn) {
    const KEY = 'pf-doc-narrow';
    const set = (on) => { html.classList.toggle('narrow', on); narrowBtn.setAttribute('aria-pressed', String(on)); };
    let saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch { /* 저장소 없음 */ }
    if (Q.get('narrow') === '1') saved = true;
    set(saved);
    narrowBtn.addEventListener('click', () => {
      const on = !html.classList.contains('narrow'); set(on);
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* */ }
    });
  }

  const zoom = lightbox();
  await renderDoc();
  ready();

  // ───────────────────────────────────────────────────────────────
  async function renderDoc() {
    const doc = document.getElementById('doc');
    let md;
    try {
      const res = await fetch(srcPath(p.doc), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      md = await res.text();
    } catch (err) {
      doc.innerHTML = `<p class="error">기술 문서를 불러오지 못했습니다 (${esc(err.message)}).</p>`;
      return;
    }
    doc.innerHTML = marked.parse(md, { gfm: true });

    // ① 상대경로(이미지) + 링크 분류(§5-2)
    const isRelative = (u) => u && !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(u);
    const decode = (u) => { try { return decodeURI(u); } catch (_) { return u; } };
    doc.querySelectorAll('img[src], video[src], source[src]').forEach((el) => {
      const s = el.getAttribute('src');
      if (isRelative(s)) el.setAttribute('src', srcPath(decode(s)));
    });
    doc.querySelectorAll('a[href]').forEach((a) => classifyMdLink(a, isRelative, decode));

    // ② 제목 앵커(GitHub 규칙, PF.slugger 그대로) + 목차(H2·H3)
    const slug = PF.slugger();
    const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    headings.forEach((h) => { h.id = slug(h.textContent.trim()); });

    // ③ 요약 덱 장면 ↔ 제목 (규칙: 정규화 → 정확히 일치 → 앞부분 양방향 일치, 여럿이면 문서 순서상 첫 번째 §3-3)
    const norm = headings.map((h) => [PF.normTitle(h.textContent), h]);
    const resolve = (title) => {
      const want = PF.normTitle(title);
      return (norm.find(([t]) => t === want) || norm.find(([t]) => t.startsWith(want) || want.startsWith(t)))?.[1] || null;
    };
    const sceneOf = new Map();                                        // heading → target
    targets.forEach((t) => {
      const h = resolve(t.section);
      if (!h) { console.warn('[doc] 요약 덱 대상 제목을 찾지 못함:', t.section); return; }
      if (!sceneOf.has(h)) sceneOf.set(h, t);
    });
    window.PFDoc = { resolve };

    const tocHtml = headings.filter((h) => h.tagName === 'H2' || h.tagName === 'H3').map((h) => {
      const star = sceneOf.has(h) ? '<span class="star" aria-hidden="true">★</span><span class="sr-only">(요약 덱에 있음)</span>' : '';
      return `<a class="${h.tagName.toLowerCase()}" href="#${esc(h.id)}">${esc(h.textContent.trim())}${star}</a>`;
    }).join('');
    document.querySelectorAll('.toc-links').forEach((el) => { el.innerHTML = tocHtml; });

    // ④ 절 머리 칩: 요약 덱이 가리키는 제목 바로 뒤 (모든 폭에서 보임, 휴대폰에서는 접은 모양)
    const chip = (t) => `<a class="chip" href="${esc(deckUrl(`#s=${t.scene}`))}" target="_blank" rel="noopener">` +
      `<span class="chip-ic" aria-hidden="true">◧</span><span class="chip-k">요약 덱의 이 장면</span>` +
      `<span class="chip-t">${esc(t.kind)} ${esc(t.n)} · ${inline(t.title)}</span>${NEWTAB}</a>`;
    sceneOf.forEach((t, h) => {
      h.insertAdjacentHTML('afterend', `<p class="doc-chip">${chip(t)}<span class="chip-note">요약 덱은 PC에서 보기 좋습니다</span></p>`);
    });

    // ⑤ 표 → .table-wrap(스크롤 영역), 그림만 있는 문단 → .pf-figure, 코드 → 키보드 스크롤 영역
    let nTable = 0;
    doc.querySelectorAll('table').forEach((tb) => {
      const w = document.createElement('div');
      w.className = 'table-wrap';
      w.setAttribute('role', 'region'); w.tabIndex = 0; w.setAttribute('aria-label', `표 ${++nTable}`);
      tb.replaceWith(w); w.appendChild(tb);
    });
    doc.querySelectorAll('p').forEach((para) => {
      const kids = [...para.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent.trim()));
      const only = kids.length === 1 && kids[0].nodeType === 1 ? kids[0] : null;
      const img = only && (only.tagName === 'IMG' ? only : (only.tagName === 'A' && only.children.length >= 1 && [...only.childNodes].every((n) => n.nodeType === 1 ? n.tagName === 'IMG' || n.classList.contains('pf-newtab-icon') || n.classList.contains('pf-newtab-sr') : !n.textContent.trim()) ? only.querySelector('img') : null));
      if (img) para.classList.add('pf-figure');
    });

    // ⑥ Mermaid (같은 설정: theme default, securityLevel loose). 글꼴을 먼저 받아 글자 폭을 맞춤
    let n = 0;
    const figs = [];
    doc.querySelectorAll('code.language-mermaid').forEach((code) => {
      const fig = document.createElement('figure');
      fig.className = 'mmd';
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.id = `mmd-${n++}`;
      div.textContent = code.textContent;
      const acc = /^\s*accTitle\s*:\s*(.+)$/m.exec(code.textContent)?.[1]?.trim();
      fig.dataset.label = acc || `다이어그램 ${n}`;
      fig.appendChild(div);
      fig.insertAdjacentHTML('beforeend', `<div class="mmd-bar"><details class="mmd-src"><summary>다이어그램 원문</summary><pre><code>${esc(code.textContent)}</code></pre></details>` +
        `<button type="button" class="mmd-zoom">크게 보기</button></div>`);
      (code.closest('pre') || code).replaceWith(fig);
      figs.push(fig);
    });
    try { await Promise.race([Promise.all([document.fonts.load('16px Pretendard'), document.fonts.load('700 16px Pretendard')]), sleep(4000)]); } catch { /* 글꼴 없이 진행 */ }
    if (window.mermaid && figs.length) {
      mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'Pretendard, sans-serif' });
      try { await mermaid.run({ nodes: doc.querySelectorAll('.mermaid') }); }
      catch (err) { console.warn('[doc] Mermaid 렌더 오류:', err); }
    }
    figs.forEach((fig) => {
      const svg = fig.querySelector('.mermaid svg');
      if (!svg) return;
      const natural = svg.viewBox?.baseVal?.width || parseFloat(svg.style.maxWidth) || 0;
      if (natural) { svg.setAttribute('width', String(Math.ceil(natural))); svg.style.maxWidth = '100%'; svg.removeAttribute('height'); }
      svg.dataset.naturalWidth = String(natural);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', fig.dataset.label);
      svg.querySelectorAll('a[href], a[*|href]').forEach((a) => {           // Mermaid click 링크에도 같은 분류
        const h = a.getAttribute('href') || a.getAttribute('xlink:href') || '';
        if (/^https?:/i.test(h)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
      });
    });

    // ⑦ 코드 하이라이트 + 접근성 (다이어그램 원문 pre는 제외)
    const LANG = { csharp: 'C#', cs: 'C#', js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', html: 'HTML', css: 'CSS', python: 'Python', py: 'Python', bash: 'Shell', sh: 'Shell', powershell: 'PowerShell', hlsl: 'HLSL', shader: 'Shader', cpp: 'C++', c: 'C', lua: 'Lua' };
    doc.querySelectorAll('pre > code').forEach((el) => {
      if (el.closest('.mmd-src')) return;
      if (window.hljs) { try { hljs.highlightElement(el); } catch (_) { /* */ } }
      const lang = /language-([\w+#-]+)/.exec(el.className)?.[1]?.toLowerCase();
      const pre = el.parentElement;
      pre.tabIndex = 0; pre.setAttribute('role', 'region');
      pre.setAttribute('aria-label', lang && LANG[lang] ? `코드 (${LANG[lang]})` : '코드');
    });

    // ⑧ 인쇄용: 바깥 링크 각주 번호 + 문서 끝 링크 목록(§4-8). 화면에는 보이지 않음. ?pf-footnotes=0이면 끔
    if (Q.get('pf-footnotes') !== '0') {
      const urls = [];
      doc.querySelectorAll('a[href^="http"]').forEach((a) => {
        if (a.closest('.mmd')) return;
        let k = urls.indexOf(a.href);
        if (k < 0) { urls.push(a.href); k = urls.length - 1; }
        a.insertAdjacentHTML('afterend', `<sup class="print-only fn">[${k + 1}]</sup>`);
      });
      if (urls.length) doc.insertAdjacentHTML('beforeend', `<section class="print-only link-list"><p class="ll-title">링크 목록</p><ol>${urls.map((u) => `<li>${esc(u)}</li>`).join('')}</ol></section>`);
    }
    const here = new URL(location.href); here.hash = '';
    const deckAbs = new URL(deckUrl(), location.href).href;
    document.querySelector('.print-urls').innerHTML = `<p>웹에서 보기: ${esc(here.href)}</p><p>요약 덱: ${esc(deckAbs)}</p>`;

    // ⑨ 목차 현재 위치(스크롤 기준) + 레일 "지금 읽는 절"
    trackSection(headings.filter((h) => h.tagName === 'H2' || h.tagName === 'H3'), sceneOf, chip);

    // ⑩ 이미지 크게 보기, 다이어그램 크게 보기
    doc.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (img && !img.closest('a')) return zoom({ src: img.currentSrc || img.src, caption: img.alt });
      const zb = e.target.closest('.mmd-zoom');
      if (zb) { const svg = zb.closest('.mmd').querySelector('.mermaid svg'); if (svg) zoom({ svg, caption: zb.closest('.mmd').dataset.label }); }
    });
    // 코드 오른쪽 흐림 표시: 가로로 더 있을 때만
    const fade = (pre) => pre.classList.toggle('fade-r', pre.scrollWidth > pre.clientWidth + 1 && pre.scrollLeft + pre.clientWidth < pre.scrollWidth - 1);
    const pres = [...doc.querySelectorAll('pre')].filter((x) => !x.closest('.mmd-src'));
    pres.forEach((pre) => { fade(pre); pre.addEventListener('scroll', () => fade(pre), { passive: true }); });
    addEventListener('resize', () => pres.forEach(fade));
    html.addEventListener('pf-relayout', () => pres.forEach(fade));
  }

  function classifyMdLink(a, isRelative, decode) {
    const h = a.getAttribute('href') || '';
    if (/^mailto:/i.test(h)) return;                                  // 메일: target 없음
    if (h.startsWith('#')) return;                                    // 같은 문서 안: 같은 탭
    if (/^https?:/i.test(h) || /^[a-z][a-z0-9+.-]*:/i.test(h)) return markNewTab(a);   // 외부
    if (h.startsWith('/')) return markNewTab(a);
    if (!isRelative(h)) return;
    const k = h.indexOf('#');
    const path = decode(k < 0 ? h : h.slice(0, k)).replace(/^\.\//, '');
    const frag = k < 0 ? '' : h.slice(k);
    if (!path || path === p.doc) { a.setAttribute('href', frag || '#top'); return; }      // 자기 문서: 같은 문서 안 앵커
    const other = /^\.\.\/([^/]+)\/[^/]+\.md$/i.exec(path);
    if (other) { a.setAttribute('href', `doc.html?p=${encodeURIComponent(other[1])}${layout !== '2' ? `&layout=${layout}` : ''}${frag}`); return markNewTab(a); }
    a.setAttribute('href', srcPath(path) + frag);                      // 그 밖의 상대 파일: 원문 파일
    markNewTab(a);
  }

  function trackSection(list, sceneOf, chip) {
    const links = new Map([...document.querySelectorAll('#toc-links a')].map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const tocBox = document.getElementById('toc');
    const nowTitle = document.querySelector('#rail-now .now-title');
    const nowBody = document.querySelector('#rail-now .now-body');
    let cur, raf = 0;
    const parentH2 = (h) => { let i = list.indexOf(h); while (i >= 0 && list[i].tagName !== 'H2') i--; return list[i] || null; };
    const update = () => {
      raf = 0;
      let c = null;
      for (const h of list) { if (h.getBoundingClientRect().top <= 120) c = h; else break; }
      if (c === cur && cur !== undefined) return;
      cur = c;
      links.forEach((a) => { a.classList.remove('active'); a.removeAttribute('aria-current'); });
      if (!c) { nowTitle.textContent = '문서 처음'; nowBody.innerHTML = '<p class="now-none">절 제목을 지나면 그 절이 요약 덱의 어느 장면인지 여기에 보입니다.</p>'; return; }
      const a = links.get(c.id);
      if (a) {
        a.classList.add('active'); a.setAttribute('aria-current', 'location');
        if (tocBox && tocBox.scrollHeight > tocBox.clientHeight) {
          const top = a.offsetTop, bottom = top + a.offsetHeight;
          if (top < tocBox.scrollTop + 40 || bottom > tocBox.scrollTop + tocBox.clientHeight - 40) tocBox.scrollTop = Math.max(0, top - tocBox.clientHeight / 3);
        }
      }
      nowTitle.textContent = c.textContent.trim();
      const t = sceneOf.get(c);
      const h2 = parentH2(c);
      nowBody.innerHTML = t ? chip(t)
        : `<p class="now-none">이 절은 요약 덱에 따로 실리지 않았습니다.</p>${h2 && h2 !== c ? `<p class="now-parent">${esc(h2.textContent.trim())}</p>` : ''}`;
    };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    addEventListener('resize', () => { cur = undefined; update(); });
    update();
  }

  function lightbox() {
    const dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', '크게 보기');
    dlg.innerHTML = '<div class="lb-stage"></div><p class="lb-cap"></p><button type="button" class="btn lb-close">닫기 (Esc)</button>';
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.lb-close') || e.target.tagName === 'IMG') dlg.close(); });
    document.body.appendChild(dlg);
    return ({ src, svg, caption }) => {
      const st = dlg.querySelector('.lb-stage');
      st.className = svg ? 'lb-stage lb-svg' : 'lb-stage';
      st.innerHTML = '';
      if (svg) { const c = svg.cloneNode(true); c.removeAttribute('id'); c.style.maxWidth = 'none'; st.appendChild(c); }
      else { const im = new Image(); im.src = src; im.alt = caption || ''; st.appendChild(im); }
      dlg.querySelector('.lb-cap').textContent = caption || '';
      dlg.showModal();
    };
  }

  function ready() {
    // 목차 서랍(< 1200px): 같은 탭, 고르면 닫힘
    const dlg = document.querySelector('.toc-dialog');
    document.querySelector('.fab-toc').addEventListener('click', () => dlg.showModal());
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.dlg-close') || e.target.closest('a')) dlg.close(); });

    // 딥링크: #sec=<절 제목> → 정규 앵커 #<slug>로 바꾸고 도착 강조, 그냥 #<slug>도 도착 강조
    const arrive = (el) => {
      el.scrollIntoView({ block: 'start', behavior: 'instant' });
      el.classList.add('arrive'); setTimeout(() => el.classList.remove('arrive'), 2100);
    };
    const raw = (() => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); } })();
    if (raw.startsWith('sec=')) {
      const el = window.PFDoc?.resolve(raw.slice(4));
      if (el) { history.replaceState(null, '', `#${el.id}`); arrive(el); } else console.warn('[doc] #sec= 제목을 찾지 못함 → 맨 위:', raw.slice(4));
    } else if (raw) {
      const el = document.getElementById(raw); if (el) arrive(el);
    }
    addEventListener('hashchange', () => { const el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el && el.matches('h1,h2,h3,h4,h5,h6')) { el.classList.add('arrive'); setTimeout(() => el.classList.remove('arrive'), 2100); } });

    // 준비 신호(캡처 하네스용): 문서·Mermaid·코드 처리와 글꼴이 끝난 뒤
    document.fonts.ready.then(() => { html.dataset.docReady = '1'; });
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
})();
