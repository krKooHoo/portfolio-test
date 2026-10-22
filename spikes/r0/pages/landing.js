// R0 시험대 랜딩(index.html) — 01 §5-1: L1 표지 → L2 기술 스택 → L3 프로젝트 카드 → L4 한눈에 보기 표 → L5 링크·연락처
(() => {
  const deck = document.getElementById('deck');
  const info = (PFScene.info = { page: 'index', t: {}, summary: {}, overflow: [], errors: [] });
  const mark = (k) => { info.t[k] = Math.round(performance.now()); };
  const { esc, inline, isUrl, shortUrl } = PF;

  PFScene.track(renderAll().catch((err) => {
    info.errors.push(String(err && err.stack || err));
    const s = PF.scene({ tpl: 'msg', eyebrow: 'PORTFOLIO' });
    PF.body(s).innerHTML = `<h1>아직 포트폴리오 데이터가 없습니다</h1><div>${esc(err && err.message || err)}</div>`;
    deck.replaceChildren(s);
  }).finally(() => { PF.dropMeasure(); PFScene.mount({ deck: '#deck' }); mark('mounted'); }));

  async function renderAll() {
    mark('start');
    const pf = await PF.loadJSON('data/portfolio.json');
    PF.applyAccent(pf.settings?.accent);
    const projects = (await Promise.all((pf.projects || []).map((id) => PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`).catch(() => null)))).filter(Boolean);
    const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
    const prof = pf.profile || {};
    const foot = prof.name || '';
    document.title = `${prof.name || '포트폴리오'} · 장면 시험대`;
    mark('data');
    info.fonts = await PF.loadFonts();
    mark('fonts');
    const M = PF.measureRoot();
    const fits = (s) => { M.appendChild(s); const ok = PF.fitsScene(s); s.remove(); return ok; };
    const guard = (s, anchor) => (fits(s) ? s : PF.shrinkOrClip(s, PFScene.refUrl(anchor), info.overflow));
    const out = [];

    // L1 표지
    const c = PF.scene({ tpl: 'L1', eyebrow: 'PORTFOLIO', foot });
    PF.body(c).innerHTML = `<h1>${esc(prof.name)}${prof.nameEn ? `<small>${esc(prof.nameEn)}</small>` : ''}</h1>
      ${prof.headline ? `<p class="headline">${inline(prof.headline)}</p>` : ''}
      ${prof.intro ? `<div class="intro">${prof.intro.split(/\n+/).map((l) => `<p>${inline(l)}</p>`).join('')}</div>` : ''}
      <div class="contact">${prof.email ? `<span><b>Email</b>${esc(prof.email)}</span>` : ''}${isUrl(prof.github) ? `<span><b>GitHub</b><span class="url">${esc(shortUrl(prof.github))}</span></span>` : ''}
      ${(prof.links || []).filter((l) => isUrl(l.url)).map((l) => `<span><b>${esc(l.label)}</b><span class="url">${esc(shortUrl(l.url))}</span></span>`).join('')}</div>`;
    out.push(guard(c, 's-1'));

    // L2 기술 스택: 기술 단위로 나눔(한 기술은 쪼개지 않음)
    const skillRow = (s) => `<div class="skill"><h3>${esc(s.name)}</h3><ul>${(s.evidence || []).map((e) => `<li><span>${inline(e.text)}</span>${byId[e.project] ? `<span class="chip">${esc(byId[e.project].title)}</span>` : ''}</li>`).join('')}</ul></div>`;
    const buildSkills = (items, v, i, n) => { const s = PF.scene({ tpl: 'L2', eyebrow: '기술 스택', title: '무엇을 만들며 썼는지', sub: n > 1 ? `${i + 1}/${n}` : '', foot, titleId: i === 0 ? 'pf-skills' : '' }); PF.body(s).innerHTML = `<div class="skills">${items.map(skillRow).join('')}</div>`; return s; };
    if ((pf.skills || []).length) {
      const pages = PF.pack(pf.skills, [{ name: 'list', min: 1, max: 99 }], buildSkills);
      pages.forEach((pg, i) => out.push(pg.variant ? buildSkills(pg.chunk, 'list', i, pages.length) : PF.shrinkOrClip(buildSkills(pg.chunk, 'list', i, pages.length), PFScene.refUrl('pf-skills'), info.overflow)));
    }

    // L3 대표 프로젝트 카드: 4장까지 한 장면, 5→3+2, 6→3+3, 7→4+3, 8→4+4
    const dims = await Promise.all(projects.map((p) => (p.cover ? PF.imageSize(PF.srcPath(p.id, p.cover)) : null)));
    const card = (p, j) => `<article class="card"><div class="media">${p.cover ? `<img src="${esc(PF.srcPath(p.id, p.cover))}" alt="" loading="lazy" decoding="async"${dims[j] ? ` width="${dims[j].w}" height="${dims[j].h}"` : ''}>` : `<div class="ph">${esc((p.title || '?')[0])}</div>`}</div><div class="cb">
      <div class="kick"><span class="badge${p.team?.type === 'team' ? ' team' : ''}">${esc(PF.teamLabel(p.team))}</span><span>${esc(PF.metaValue(p, '기간'))}</span></div>
      <h3><a href="project.html?p=${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3>${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
      ${p.team?.role ? `<p class="role"><b>내 역할</b>${inline(p.team.role)}</p>` : ''}
      <ul class="tags">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></article>`;
    const n = projects.length;
    if (n) {
      const k = Math.ceil(n / 4), chunks = []; let a = 0;
      for (let i = 0; i < k; i++) { const m = Math.ceil((n - a) / (k - i)); chunks.push(projects.slice(a, a + m).map((p) => [p, projects.indexOf(p)])); a += m; }
      chunks.forEach((ch, i) => {
        const s = PF.scene({ tpl: 'L3', eyebrow: '프로젝트', title: `대표 프로젝트 ${n}개`, sub: chunks.length > 1 ? `${i + 1}/${chunks.length}` : '', foot, titleId: i === 0 ? 'pf-projects' : '' });
        PF.body(s).innerHTML = `<div class="cards n${ch.length}">${ch.map(([p, j]) => card(p, j)).join('')}</div>`;
        out.push(guard(s, 'pf-projects'));
      });
    }

    // L4 한눈에 보기 표: 행 단위로 나누고 머리행 반복
    const row = (p) => `<tr><td>${esc(p.title)}</td><td>${inline(p.tagline)}</td><td>${esc((p.tags || []).slice(0, 4).join(', '))}</td><td>${esc(PF.teamLabel(p.team))}${p.team?.role ? `<br>${inline(p.team.role)}` : ''}</td><td>${[isUrl(p.links?.github) && 'GitHub', '기술 문서', isUrl(p.links?.video) && '영상'].filter(Boolean).join(' · ')}</td></tr>`;
    const buildSum = (items, v, i, n2) => { const s = PF.scene({ tpl: 'L4', eyebrow: '한눈에 보기', title: '프로젝트 요약', sub: n2 > 1 ? `${i + 1}/${n2}` : '', foot, titleId: i === 0 ? 'pf-summary' : '' });
      PF.body(s).innerHTML = `<table class="sum">${i > 0 ? '<caption data-pf-ui="cont" aria-hidden="true">표 이어서</caption>' : ''}<colgroup><col style="width:17%"><col style="width:30%"><col style="width:20%"><col style="width:23%"><col style="width:10%"></colgroup><thead${i > 0 ? ' data-pf-ui="cont" aria-hidden="true"' : ''}><tr><th>프로젝트명</th><th>한 줄 소개</th><th>핵심 기술</th><th>역할</th><th>링크</th></tr></thead><tbody>${items.map(row).join('')}</tbody></table>`; return s; };
    if (n) {
      const pages = PF.pack(projects, [{ name: 'rows', min: 1, max: 99 }], (it, v) => buildSum(it, v, 1, 2));   // "표 이어서"가 붙은 긴 형태로 측정
      pages.forEach((pg, i) => out.push(pg.variant ? buildSum(pg.chunk, 'rows', i, pages.length) : PF.shrinkOrClip(buildSum(pg.chunk, 'rows', i, pages.length), PFScene.refUrl('pf-summary'), info.overflow)));
    }

    // L5 링크·연락처: 어느 프로젝트에도 링크가 없으면 생략
    const anyLinks = projects.some((p) => isUrl(p.links?.github) || isUrl(p.links?.video) || (p.links?.extra || []).some((l) => isUrl(l.url)));
    if (anyLinks) {
      const cl = PF.scene({ tpl: 'L5', eyebrow: '링크 모음', title: '연락처와 프로젝트 링크', foot });
      PF.body(cl).innerHTML = `<div class="closing"><div><h2>${esc(prof.name)}</h2><p style="margin-top:14px;font-size:18px">${esc(prof.email || '')}</p>${isUrl(prof.github) ? `<p class="url" style="font-size:16px">${esc(shortUrl(prof.github))}</p>` : ''}</div>
        <div class="lk">${projects.map((p) => `<div><b>${esc(p.title)}</b>${[isUrl(p.links?.github) && `GitHub <span class="url">${esc(shortUrl(p.links.github))}</span>`, isUrl(p.links?.video) && `영상 <span class="url">${esc(shortUrl(p.links.video))}</span>`, ...(p.links?.extra || []).filter((l) => isUrl(l.url)).map((l) => `${esc(l.label)} <span class="url">${esc(shortUrl(l.url))}</span>`)].filter(Boolean).join('<br>') || '<span style="color:var(--muted);font-size:14px">외부 링크 없음</span>'}</div>`).join('')}</div></div>`;
      out.push(guard(cl, 's-1'));
    }
    info.summary = Object.fromEntries(['L1', 'L2', 'L3', 'L4', 'L5'].map((t) => [t, out.filter((s) => s.dataset.pfTpl === t).length]));
    deck.replaceChildren(...out);
    deck.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('loading')) i.loading = 'lazy'; i.decoding = 'async'; });
    mark('assembled');
  }
})();
