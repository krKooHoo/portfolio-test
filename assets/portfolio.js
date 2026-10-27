// 포트폴리오 문서(index.html) — 아래로 읽는 한 페이지 + A4 인쇄(제출 PDF)
//   순서: 머리(이름·정체성·연락처) → 자기소개 → 기술 스택 → 프로젝트마다 소개 + 기능 소개 → 한눈에 보기 → 연락처
//   기능 소개: 화면(그 기능 절의 이미지 highlights[].image만)은 왼쪽에 모으고, 기능 설명과 [발표 덱에서 보기]는 오른쪽 목록에 한 열로 맞춤
//   모든 글은 data/portfolio.json·data/projects/*.json 값 그대로입니다. 절 이름·버튼 같은 UI 문구는 문구 표(PF.t, assets/strings.js + theme/strings.tsv)에서 옵니다.
//   주소: #<절 id>(cover · intro · stack · p-<폴더> · p-<폴더>-core · glance · contact). 예전 포트폴리오 덱 주소(#s=<장면 id> · #<번호>)는 같은 절로 넘깁니다.
//   점검: PFPage.whenReady() → PFPage.report() · ?pf-audit=1이면 #pf-audit에 report()의 base64 JSON(headless용, 발표 덱과 같은 형식)
(() => {
  const root = document.getElementById('app');
  const html = document.documentElement;
  const { esc, inline, isUrl, shortUrl, link, t } = PF;
  const T = (k, v) => esc(t(k, v));                                    // HTML에 넣는 문구
  const pad2 = (n) => String(n).padStart(2, '0');
  const info = { errors: [], sections: [], projects: 0 };
  html.dataset.pfReady = 'no';
  // 처음 주소로 도착한 절, 또는 새로고침 전 스크롤 위치. 글꼴·그림이 늦게 와 위치가 밀리면 settle()에서 한 번 더 맞춤(그사이 사용자가 움직이지 않았을 때만)
  let arrived = '', restoreY = null, userMoved = false;
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, () => { userMoved = true; }, { once: true, passive: true }));
  const POS = `pf-portfolio-y:${location.pathname}`;                 // 새로고침해도 읽던 곳으로(내용을 늦게 그려 브라우저가 스스로 되돌리지 못함)
  try { history.scrollRestoration = 'manual'; } catch { /* 그대로 */ }
  addEventListener('pagehide', () => { try { sessionStorage.setItem(POS, String(Math.round(scrollY))); } catch { /* 저장소 막힘 */ } });
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  window.PFPage = { whenReady: () => ready, report };

  start().catch((err) => {
    info.errors.push(String(err && err.stack || err));
    PF.notice(root, '페이지를 그리지 못했습니다', `<p>${esc(err && err.message || err)}</p>`);
  }).finally(settle);

  async function start() {
    if (PF.guardFileProtocol(root)) { info.errors.push('file:// — 로컬 서버로 열어야 합니다'); return; }
    let pf;
    const strings = PF.loadStrings();                                   // 실패해도 기본 문구(던지지 않음)
    try { pf = await PF.loadJSON('data/portfolio.json'); }
    catch (err) { info.errors.push(`data/portfolio.json: ${err && err.message || err}`); PF.noData(root, err); return; }
    PF.applyTheme(pf.settings?.accent);
    const projects = (await Promise.all((pf.projects || []).map((id) => PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`)
      .catch((err) => { console.warn('[portfolio] 프로젝트 데이터 없음:', err.message); return null; })))).filter(Boolean);
    await strings;
    render(pf, projects);
    bind();
    arrived = go(projects);                                            // 내용을 그린 뒤라 브라우저가 처음 주소의 절로 스스로 가지 못함
    if (!arrived && performance.getEntriesByType?.('navigation')[0]?.type === 'reload') {
      try { restoreY = +sessionStorage.getItem(POS) || null; } catch { /* 저장소 막힘 */ }
      if (restoreY) scrollTo({ top: restoreY, behavior: 'instant' });
    }
    addEventListener('hashchange', () => go(projects));                // 같은 페이지에서 예전 주소(#s=…)를 붙여 넣은 경우
  }

  function go(projects) {
    const want = legacyTarget(projects);
    const el = want && document.getElementById(want);
    if (!el) return '';
    if (location.hash !== `#${encodeURIComponent(want)}`) try { history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(want)}`); } catch { /* 그대로 */ }
    el.scrollIntoView({ behavior: 'instant', block: 'start' });        // 부드러운 스크롤은 가려진 창에서 멈춤 → 바로 이동
    return want;
  }

  // 예전 포트폴리오 덱의 주소(#s=<장면 id> · #<번호> · #s-<번호> · 옛 랜딩 #skills 등) → 이 페이지의 절 id. 지금 주소가 절 id 그대로여도 돌려줌(그리고 나서 그 절로 스크롤)
  //   번호는 실제로 그린 절의 차례(예전 덱도 그린 장면만 셈. 나뉜 장면 stack-2·glance-2는 이제 한 절). #0·#-3 → 첫 절, #99 → 마지막 절(덱 키트와 같은 규칙)
  function legacyTarget(projects) {
    let h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch { /* 그대로 */ }
    if (!h) return '';
    const nth = (n) => info.sections[Math.max(1, Math.min(info.sections.length, n)) - 1] || '';
    if (/^-?\d+$/.test(h)) return nth(+h);
    const m = /^s=(.+)$/.exec(h);
    if (m) h = m[1].replace(/^(stack|glance)-\d+$/, '$1');
    const sn = /^s-(\d+)$/.exec(h);
    if (sn) return nth(+sn[1]);
    return { skills: 'stack', projects: projects[0] ? `p-${projects[0].id}` : '', summary: 'glance' }[h] ?? h;
  }

  function render(pf, projects) {
    const prof = pf.profile || {};
    const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
    const nameT = prof.name || t('name.portfolio');
    document.title = `${prof.name ? prof.name + ' · ' : ''}${t('name.portfolio')}`;
    document.querySelector('.skip-link')?.replaceChildren(t('ui.skip'));
    const total = pad2(projects.length);
    const btn = (href, label, kind, cls = 'btn') => link({ href, label, kind, cls });
    const profLinks = (prof.links || []).filter((l) => isUrl(l.url));
    // 인쇄(PDF)에서는 버튼 대신 칠 수 있는 주소를 보여 줌. rows: [이름, 보이는 주소, 링크, 종류] — PDF에서는 눌러도 열림(링크 규칙은 PF.link 그대로, ↗는 인쇄에서 숨김)
    const printUrls = (rows) => rows.length ? `<dl class="print-only purls">${rows.map(([k, u, href, kind]) => `<div><dt>${esc(k)}</dt><dd class="url">${href
      ? link({ href, label: esc(u), kind }) : esc(u)}</dd></div>`).join('')}</dl>` : '';
    const sec = (id, eyebrow, title, right, body, cls = '') => `<section id="${esc(id)}" class="sec${cls ? ' ' + cls : ''}"><div class="wrap">
      <div class="sec-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2></div>${right ? `<p class="sec-r">${esc(right)}</p>` : ''}</div>${body}</div></section>`;
    const out = [];

    // ① 머리: 이름 · 영문 이름 · 한 줄 정체성 · 연락처
    out.push(`<section id="cover" class="hero"><p class="hero-mark no-print" aria-hidden="true">${esc(prof.nameEn || nameT)}</p><div class="wrap">
      <div class="hero-top"><p class="eyebrow">${T('en.portfolio')}</p>${pf.generatedAt ? `<p class="upd">${T('page.updated', { date: pf.generatedAt })}</p>` : ''}</div>
      <h1>${esc(nameT)}${prof.nameEn ? `<span class="en" lang="en">${esc(prof.nameEn)}</span>` : ''}</h1>
      ${prof.headline ? `<p class="headline">${inline(prof.headline)}</p>` : ''}
      <div class="btns no-print">${[prof.email && link({ href: `mailto:${prof.email}`, label: esc(prof.email), kind: 'mail', cls: 'btn' }),
        isUrl(prof.github) && btn(prof.github, 'GitHub', 'external'), ...profLinks.map((l) => btn(l.url, esc(l.label), 'external'))].filter(Boolean).join('')}</div>
      ${printUrls([prof.email && [t('page.print-email'), prof.email, `mailto:${prof.email}`, 'mail'], isUrl(prof.github) && ['GitHub', shortUrl(prof.github), prof.github, 'external'],
        ...profLinks.map((l) => [l.label, shortUrl(l.url), l.url, 'external']), [t('page.print-web'), PF.visibleUrl('')]].filter(Boolean))}
    </div></section>`);

    // ② 자기소개: profile.intro를 줄바꿈까지 그대로(고쳐 쓰지 않음)
    if (prof.intro) out.push(sec('intro', t('en.about'), t('page.intro'), '',`<div class="about">${prof.intro.split(/\n+/).filter((l) => l.trim()).map((l) => `<p>${inline(l)}</p>`).join('')}</div>`));

    // ③ 기술 스택: 기술마다 "무엇을 만들며 썼는지"(evidence)와 근거 프로젝트(같은 페이지의 그 프로젝트로)
    if ((pf.skills || []).length) out.push(sec('stack', t('en.skills'), t('page.stack'), t('page.stack-note'),`<ul class="skills">${pf.skills.map((s) => `<li class="skill">
      <h3>${esc(s.name)}</h3><ul>${(s.evidence || []).map((e) => `<li><span>${inline(e.text)}</span>${byId[e.project] ? link({ href: `#p-${e.project}`, label: esc(byId[e.project].title), kind: 'anchor', cls: 'chip' }) : ''}</li>`).join('')}</ul></li>`).join('')}</ul>`, 'tint'));

    // ④ 프로젝트마다 소개 + 기능 소개
    projects.forEach((p, j) => {
      const no = t('page.project-no', { no: pad2(j + 1), total });
      out.push(projectIntro(p, no, sec, btn, printUrls));
      const fe = features(p, no, sec, btn);
      if (fe) out.push(fe);
    });

    // ⑤ 한눈에 보기(format/01 §1 프로젝트 요약 표) — 좁은 화면에서도 가로 스크롤이 없도록 표 대신 행 목록
    if (projects.length) out.push(sec('glance', t('en.glance'), t('page.glance'), '',`<ul class="glance">${projects.map((p) => `<li>
      <div class="g-t">${link({ href: `#p-${p.id}`, label: esc(p.title), kind: 'anchor' })}<p>${esc(PF.teamLabel(p.team))}</p></div>
      <div class="g-b">${p.tagline ? `<p>${inline(p.tagline)}</p>` : ''}${(p.tags || []).length ? `<p class="g-tags">${esc(p.tags.slice(0, 4).join(' · '))}</p>` : ''}
        ${p.team?.role ? `<p class="g-role"><b>${T('name.role-short')}</b> ${inline(p.team.role)}</p>` : ''}</div>
      <div class="g-l">${projLinks(p)}</div></li>`).join('')}</ul>`, 'tint'));

    // ⑥ 연락처 + 프로젝트별 링크(그 밖의 링크는 주소까지)
    out.push(`<footer id="contact" class="sec contact"><div class="wrap">
      <p class="eyebrow">${T('en.contact')}</p>
      <div class="ct">
        <div class="ct-me"><p class="ct-name">${esc(nameT)}</p>
          ${prof.email ? `<p class="em">${link({ href: `mailto:${prof.email}`, label: esc(prof.email), kind: 'mail' })}</p>` : ''}
          ${isUrl(prof.github) ? `<p>${link({ href: prof.github, label: `<span class="url">${esc(shortUrl(prof.github))}</span>` })}</p>` : ''}
          ${profLinks.map((l) => `<p><span class="k">${esc(l.label)}</span> ${link({ href: l.url, label: `<span class="url">${esc(shortUrl(l.url))}</span>` })}</p>`).join('')}
          <p class="print-only"><span class="url">${esc(PF.visibleUrl(''))}</span></p></div>
        <div class="ct-lk">${projects.map((p) => `<div><b>${esc(p.title)}</b><span class="row">${projLinks(p)}</span>${(p.links?.extra || []).filter((l) => isUrl(l.url))
          .map((l) => `<span class="ex">${esc(l.label)} ${link({ href: l.url, label: `<span class="url">${esc(shortUrl(l.url))}</span>` })}</span>`).join('')}</div>`).join('')}</div>
      </div></div></footer>`);

    const nav = [['intro', t('page.nav-intro'), prof.intro], ['stack', t('page.nav-stack'), (pf.skills || []).length], [projects[0] ? `p-${projects[0].id}` : '', t('page.nav-projects'), projects.length],
      ['glance', t('page.nav-glance'), projects.length], ['contact', t('page.nav-contact'), true]].filter((x) => x[0] && x[2]);
    root.innerHTML = `<header class="top no-print"><div class="wrap top-in">
        <a class="top-name" href="#cover">${esc(nameT)}</a>
        <nav aria-label="절 이동"><ul>${nav.map(([id, label]) => `<li><a href="#${esc(id)}">${esc(label)}</a></li>`).join('')}</ul></nav>
        <button type="button" class="btn primary pdf" data-pdf>${T('ui.pdf')}</button></div></header>
      <main id="main">${out.join('')}</main>`;
    root.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('loading')) i.loading = 'lazy'; i.decoding = 'async'; });
    info.sections = [...root.querySelectorAll('main > section[id], main > footer[id]')].map((s) => s.id);
    info.projects = projects.length;
  }

  // 프로젝트 소개: 대표 이미지 · 메타(장르·기간·인원·환경) · 내 역할 · 개발 의도 · 태그 · 링크
  function projectIntro(p, no, sec, btn, printUrls) {
    const meta = (p.meta || []).map((m) => `<div><dt>${esc(m.label)}</dt><dd>${inline(m.value)}</dd></div>`);
    if (p.team?.role) meta.push(`<div class="wide"><dt>${T('name.role')}</dt><dd>${inline(p.team.role)}</dd></div>`);
    const extra = (p.links?.extra || []).filter((l) => isUrl(l.url));
    const btns = [btn(PF.projectUrl(p.id), T('name.deck'), 'page', 'btn primary'), btn(PF.docUrl(p.id), T('name.doc'), 'page'),
      isUrl(p.links?.github) && btn(p.links.github, 'GitHub', 'external'), isUrl(p.links?.video) && btn(p.links.video, T('name.video'), 'external'),
      ...extra.map((l) => btn(l.url, esc(l.label), 'external'))].filter(Boolean);
    const urls = [[t('name.deck'), PF.visibleUrl(PF.projectUrl(p.id)), PF.projectUrl(p.id), 'page'], [t('name.doc'), PF.visibleUrl(PF.docUrl(p.id)), PF.docUrl(p.id), 'page'],
      isUrl(p.links?.github) && ['GitHub', shortUrl(p.links.github), p.links.github, 'external'], isUrl(p.links?.video) && [t('name.video'), shortUrl(p.links.video), p.links.video, 'external'],
      ...extra.map((l) => [l.label, shortUrl(l.url), l.url, 'external'])].filter(Boolean);
    const cover = p.cover ? `<figure class="cover"><img src="${esc(PF.srcPath(p.id, p.cover))}" alt="${esc(p.title)} 대표 화면"></figure>` : '';
    const body = `${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
      <div class="pi${cover ? '' : ' nocover'}">${cover}<div class="pi-r">
        ${meta.length ? `<dl class="meta">${meta.join('')}</dl>` : ''}
        ${p.intent?.text ? `<div class="intent"><p class="k">${T('name.intent')}</p><p>${inline(p.intent.text)}</p></div>` : ''}
        ${(p.tags || []).length ? `<ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <div class="btns no-print">${btns.join('')}</div>${printUrls(urls)}</div></div>`;
    return sec(`p-${p.id}`, no, p.title, PF.teamLabel(p.team), body, 'proj');
  }

  // 기능 소개: 화면은 왼쪽(기능 번호와 함께), 기능 설명과 [발표 덱에서 보기]는 오른쪽 목록. 화면이 하나도 없으면 목록이 폭 전체
  function features(p, no, sec, btn) {
    const hl = (p.highlights || []).slice(0, 4);
    if (!hl.length) return '';
    const capText = (c) => (typeof c === 'string' ? c : c?.text || '');      // 그림 설명은 글 조각 또는 글자
    const shots = hl.map((h, i) => ({ h, i })).filter(({ h }) => h.image?.src);
    const tiles = shots.map(({ h, i }) => {
      const d = h.image.w && h.image.h ? ` width="${h.image.w}" height="${h.image.h}"` : '';
      return `<figure class="shot" data-fi="${i}"><div class="shot-m"><img src="${esc(PF.srcPath(p.id, h.image.src))}" alt="${esc(capText(h.image.caption) || h.title)}"${d}></div>
        <figcaption><span class="n">${pad2(i + 1)}</span><span>${inline(capText(h.image.caption) || h.title)}</span></figcaption></figure>`;
    }).join('');
    const rows = hl.map((h, i) => `<li data-fi="${i}"><div class="fr-t"><p class="fk">${T('en.feature')} ${pad2(i + 1)}</p><h3>${inline(h.title)}</h3>${h.what ? `<p>${inline(h.what)}</p>` : ''}</div>
      <div class="fr-a">${link({ href: PF.projectUrl(p.id, PF.deckSceneFor(p, h.section)), label: T('page.see-in-deck'), kind: 'page', cls: 'pill',
        attrs: `aria-label="${esc(PF.normTitle(h.title))} — ${T('page.see-in-deck')} (새 탭)"` })}</div></li>`).join('');
    const body = `<div class="fe${shots.length ? '' : ' noshot'}" style="--shots:${shots.length}">${shots.length ? `<div class="shots">${tiles}</div>` : ''}
      <div class="fe-r"><ol class="flist">${rows}</ol>
        <div class="btns end no-print">${btn(PF.projectUrl(p.id), T('page.deck-all'), 'page', 'btn primary')}${btn(PF.docUrl(p.id), T('name.doc'), 'page')}</div></div></div>`;
    return sec(`p-${p.id}-core`, `${no} · ${t('page.features')}`, p.title, PF.teamLabel(p.team), body, 'tint core');
  }

  function projLinks(p) {
    return [link({ href: PF.projectUrl(p.id), label: T('name.deck'), kind: 'page' }), link({ href: PF.docUrl(p.id), label: T('name.doc-short'), kind: 'page' }),
      isUrl(p.links?.github) && link({ href: p.links.github, label: 'GitHub' }), isUrl(p.links?.video) && link({ href: p.links.video, label: T('name.video') })].filter(Boolean).join('');
  }

  // 화면과 설명 짝 강조(마우스·키보드 포커스) + [PDF로 저장]
  function bind() {
    const pair = (el, on) => {
      const item = el.closest('[data-fi]');
      const box = item?.closest('.fe');
      if (!box) return;
      box.querySelectorAll(`[data-fi="${item.dataset.fi}"]`).forEach((x) => x.classList.toggle('on', on));
    };
    root.addEventListener('mouseover', (e) => pair(e.target, true));
    root.addEventListener('mouseout', (e) => pair(e.target, false));
    root.addEventListener('focusin', (e) => pair(e.target, true));
    root.addEventListener('focusout', (e) => pair(e.target, false));
    root.querySelector('[data-pdf]')?.addEventListener('click', async (e) => {
      const b = e.currentTarget, label = b.textContent;
      b.disabled = true; b.textContent = t('ui.preparing');
      await loadAll(15000);                                            // 아래쪽 그림까지 받은 뒤 인쇄(늦게 받는 그림은 PDF에서 빠짐)
      b.disabled = false; b.textContent = label;
      window.print();
    });
    addEventListener('beforeprint', () => eager());                    // Ctrl+P: 아직 받지 않은 그림을 바로 받기 시작(할 수 있는 만큼)
  }

  const eager = () => document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
  const loaded = (i) => (i.complete ? null : new Promise((r) => {     // decode()·rAF는 쓰지 않음: 가려진 창에서 끝나지 않음(발표 덱 키트와 같은 이유)
    i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }));
  async function loadAll(ms) {
    eager();
    await Promise.race([Promise.all([...document.images].map(loaded)), new Promise((r) => setTimeout(r, ms))]);
  }

  // 준비: 데스크톱 기기면 그림을 미리 다 받아 Ctrl+P도 빠짐없이 인쇄(휴대폰·데이터 절약 모드는 화면에 올 때 받음)
  async function settle() {
    const desk = matchMedia('(pointer: fine)').matches && !(navigator.connection && navigator.connection.saveData);
    if (desk) eager();
    await Promise.race([Promise.all([...document.querySelectorAll('img:not([loading="lazy"])')].map(loaded)), new Promise((r) => setTimeout(r, 20000))]);
    if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
    if (!userMoved) {                                                  // 글꼴이 바뀌며 절 높이가 달라져 도착 위치가 밀린 만큼 다시 맞춤
      const el = arrived && document.getElementById(arrived);
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      else if (restoreY) scrollTo({ top: restoreY, behavior: 'instant' });
    }
    html.dataset.pfReady = 'yes';
    resolveReady(report());
    if (new URLSearchParams(location.search).get('pf-audit') === '1') writeAudit();
  }

  function report() {
    const imgs = [...document.images];
    return {
      page: 'portfolio', ready: html.dataset.pfReady, sections: info.sections, projects: info.projects,
      images: { total: imgs.length, broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
                pending: imgs.filter((i) => !i.complete).map((i) => i.getAttribute('src')) },
      deckLinks: [...document.querySelectorAll('.flist a.pill')].map((a) => a.getAttribute('href')),
      overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      errors: info.errors, strings: PF.stringsReport(),
    };
  }
  function writeAudit() {
    let pre = document.getElementById('pf-audit');
    if (!pre) { pre = document.createElement('pre'); pre.id = 'pf-audit'; pre.hidden = true; document.body.appendChild(pre); }
    const bytes = new TextEncoder().encode(JSON.stringify(report()));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    pre.textContent = btoa(bin);
  }
})();
