// 덱 스파이크 랜딩(index.html) — R0 spikes/r0/pages/landing.js와 같은 내용·순서(L1 표지 → L2 기술 스택 → L3 프로젝트 카드 → L4 한눈에 보기 → L5 링크),
// 장면 모양만 참고 덱 체계로 바꿈. 모든 글은 data/portfolio.json·data/projects/*.json에 있는 값만 씁니다(지어내지 않음).
(() => {
  const deck = document.getElementById('deck');
  const info = (PFScene.info = { page: 'index', t: {}, summary: {}, overflow: [], errors: [] });
  const mark = (k) => { info.t[k] = Math.round(performance.now()); };
  const { esc, inline, isUrl, shortUrl, DOT } = PF;

  PFScene.track(renderAll().catch((err) => {
    info.errors.push(String(err && err.stack || err));
    const s = PF.scene({ tpl: 'msg', kind: 'sum', eyebrow: 'PORTFOLIO', sec: '안내' });
    PF.body(s).innerHTML = `<h1>아직 포트폴리오 데이터가 없습니다</h1><div>${esc(err && err.message || err)}</div>`;
    deck.replaceChildren(s);
  }).finally(() => { PF.dropMeasure(); PFScene.mount({ deck: '#deck' }); mark('mounted'); }));

  async function renderAll() {
    mark('start');
    const pf = await PF.loadJSON('data/portfolio.json');
    const projects = (await Promise.all((pf.projects || []).map((id) => PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`).catch(() => null)))).filter(Boolean);
    const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
    const prof = pf.profile || {};
    const foot = prof.name || '';
    document.title = `${prof.name || '포트폴리오'} · 포트폴리오 덱`;
    mark('data');
    info.fonts = await PF.loadFonts();
    mark('fonts');
    const M = PF.measureRoot();
    const fits = (s) => { M.appendChild(s); const ok = PF.fitsScene(s); s.remove(); return ok; };
    const guard = (s, anchor) => (fits(s) ? s : PF.shrinkOrClip(s, PFScene.refUrl(anchor), info.overflow));
    const out = [];
    const contactRows = [prof.email && ['EMAIL', esc(prof.email)], isUrl(prof.github) && ['GITHUB', `<span class="url">${esc(shortUrl(prof.github))}</span>`],
      ...(prof.links || []).filter((l) => isUrl(l.url)).map((l) => [esc(l.label).toUpperCase(), `<span class="url">${esc(shortUrl(l.url))}</span>`])].filter(Boolean);

    // L1 표지(참고 덱 A: 윗줄 eyebrow │ 오른쪽 라벨 / 큰 문장 / 아래 이름 + 메타 표)
    const c = PF.scene({ tpl: 'L1', kind: 'bare', foot, sec: '표지', stitle: prof.name || '포트폴리오' });
    PF.body(c).innerHTML = `<div class="toprow"><span class="pf-eyebrow">PORTFOLIO</span>${prof.nameEn ? `<span class="rl">${esc(prof.nameEn)}</span>` : ''}</div>
      <div class="cv-mid">${prof.headline ? `<h1 class="cv-h">${inline(prof.headline)}</h1>` : `<h1 class="cv-h">${esc(prof.name)}</h1>`}
        ${prof.intro ? `<div class="cv-intro">${prof.intro.split(/\n+/).map((l) => `<p>${inline(l)}</p>`).join('')}</div>` : ''}</div>
      <div class="cv-bot"><div><p class="cv-lb">PORTFOLIO BY</p><p class="cv-name">${esc(prof.name)}${prof.nameEn ? `<span>${esc(prof.nameEn)}</span>` : ''}</p></div>
        ${contactRows.length ? `<table class="kv"><tbody>${contactRows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>` : ''}</div>`;
    out.push(guard(c, 's-1'));

    // L2 기술 스택(카드 격자 3열 → 넘치면 줄 목록). 한 기술은 쪼개지 않음
    const skillCard = (s) => `<article class="skill card"><h3>${esc(s.name)}</h3>${DOT}<ul>${(s.evidence || []).map((e) => `<li><span>${inline(e.text)}</span>${byId[e.project] ? `<span class="chip">${esc(byId[e.project].title)}</span>` : ''}</li>`).join('')}</ul></article>`;
    const buildSkills = (items, v, i, n) => {
      const s = PF.scene({ tpl: 'L2', eyebrow: 'SKILLS', rlabel: '기술 스택', title: '무엇을 만들며 썼는지', sub: n > 1 ? `${i + 1}/${n}` : '', foot, titleId: i === 0 ? 'pf-skills' : '', sec: '기술 스택' });
      PF.body(s).innerHTML = `<div class="skills ${v}">${items.map(skillCard).join('')}</div>`; return s;
    };
    if ((pf.skills || []).length) {
      const V = [{ name: 'c3', min: 1, max: 3 }, { name: 'rows', min: 4, max: 6 }];
      const pages = PF.pack(pf.skills, V, buildSkills);
      pages.forEach((pg, i) => out.push(pg.variant ? buildSkills(pg.chunk, pg.variant, i, pages.length) : PF.shrinkOrClip(buildSkills(pg.chunk, 'rows', i, pages.length), PFScene.refUrl('pf-skills'), info.overflow)));
    }

    // L3 대표 프로젝트 카드: 4장까지 한 장면, 5→3+2, 6→3+3, 7→4+3, 8→4+4 (A1과 같은 규칙)
    const dims = await Promise.all(projects.map((p) => (p.cover ? PF.imageSize(PF.srcPath(p.id, p.cover)) : null)));
    const card = (p, j) => `<article class="pcard card"><div class="media">${p.cover ? `<img src="${esc(PF.srcPath(p.id, p.cover))}" alt="" loading="lazy" decoding="async"${dims[j] ? ` width="${dims[j].w}" height="${dims[j].h}"` : ''}>` : `<div class="ph">${esc((p.title || '?')[0])}</div>`}</div><div class="cb">
      <div class="kick"><span class="badge${p.team?.type === 'team' ? ' team' : ''}">${esc(PF.teamLabel(p.team))}</span><span>${esc(PF.metaValue(p, '기간'))}</span></div>
      <h3><a href="project.html?p=${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3>${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
      ${p.team?.role ? `<p class="role"><b>내 역할</b>${inline(p.team.role)}</p>` : ''}
      <ul class="tags">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></article>`;
    const n = projects.length;
    if (n) {
      const k = Math.ceil(n / 4), chunks = []; let a = 0;
      for (let i = 0; i < k; i++) { const m = Math.ceil((n - a) / (k - i)); chunks.push(projects.slice(a, a + m).map((p) => [p, projects.indexOf(p)])); a += m; }
      chunks.forEach((ch, i) => {
        const s = PF.scene({ tpl: 'L3', eyebrow: 'PROJECTS', rlabel: '대표 프로젝트', title: `대표 프로젝트 ${n}개`, sub: chunks.length > 1 ? `${i + 1}/${chunks.length}` : '', foot, titleId: i === 0 ? 'pf-projects' : '', sec: '프로젝트' });
        PF.body(s).innerHTML = `<div class="cards n${ch.length}">${ch.map(([p, j]) => card(p, j)).join('')}</div>`;
        out.push(guard(s, 'pf-projects'));
      });
    }

    // L4 한눈에 보기 표(참고 덱 mini 표): 행 단위로 나누고 머리행 반복
    const row = (p) => `<tr><td>${esc(p.title)}</td><td>${inline(p.tagline)}</td><td>${esc((p.tags || []).slice(0, 4).join(', '))}</td><td>${esc(PF.teamLabel(p.team))}${p.team?.role ? `<br>${inline(p.team.role)}` : ''}</td><td>${[isUrl(p.links?.github) && 'GitHub', '기술 문서', isUrl(p.links?.video) && '영상'].filter(Boolean).join(' · ')}</td></tr>`;
    const buildSum = (items, v, i, n2) => {
      const s = PF.scene({ tpl: 'L4', eyebrow: 'AT A GLANCE', rlabel: '한눈에 보기', title: '프로젝트 요약', sub: n2 > 1 ? `${i + 1}/${n2}` : '', foot, titleId: i === 0 ? 'pf-summary' : '', sec: '한눈에 보기' });
      PF.body(s).innerHTML = `<table class="mini">${i > 0 ? '<caption data-pf-ui="cont" aria-hidden="true">표 이어서</caption>' : ''}<colgroup><col style="width:16%"><col style="width:31%"><col style="width:21%"><col style="width:20%"><col style="width:12%"></colgroup><thead${i > 0 ? ' data-pf-ui="cont" aria-hidden="true"' : ''}><tr><th>프로젝트명</th><th>한 줄 소개</th><th>핵심 기술</th><th>역할</th><th>링크</th></tr></thead><tbody>${items.map(row).join('')}</tbody></table>`; return s;
    };
    if (n) {
      const pages = PF.pack(projects, [{ name: 'rows', min: 1, max: 99 }], (it, v) => buildSum(it, v, 1, 2));
      pages.forEach((pg, i) => out.push(pg.variant ? buildSum(pg.chunk, 'rows', i, pages.length) : PF.shrinkOrClip(buildSum(pg.chunk, 'rows', i, pages.length), PFScene.refUrl('pf-summary'), info.overflow)));
    }

    // L5 링크·연락처(참고 덱 맺음 장 모양): 어느 프로젝트에도 링크가 없으면 생략(A1과 같음)
    const anyLinks = projects.some((p) => isUrl(p.links?.github) || isUrl(p.links?.video) || (p.links?.extra || []).some((l) => isUrl(l.url)));
    if (anyLinks) {
      const cl = PF.scene({ tpl: 'L5', kind: 'bare', foot, sec: '링크', stitle: '연락처와 프로젝트 링크' });
      PF.body(cl).innerHTML = `<div class="toprow"><span class="pf-eyebrow">CONTACT</span><span class="rl">연락처와 프로젝트 링크</span></div>
        <div class="cl-mid"><div class="cl-me"><p class="cl-name">${esc(prof.name)}</p>${DOT}${prof.email ? `<p class="em">${esc(prof.email)}</p>` : ''}${isUrl(prof.github) ? `<p class="url">${esc(shortUrl(prof.github))}</p>` : ''}${(prof.links || []).filter((l) => isUrl(l.url)).map((l) => `<p class="url">${esc(shortUrl(l.url))}</p>`).join('')}</div>
        <div class="cl-lk">${projects.map((p) => `<div><b>${esc(p.title)}</b>${[isUrl(p.links?.github) && `GitHub <span class="url">${esc(shortUrl(p.links.github))}</span>`, isUrl(p.links?.video) && `영상 <span class="url">${esc(shortUrl(p.links.video))}</span>`, ...(p.links?.extra || []).filter((l) => isUrl(l.url)).map((l) => `${esc(l.label)} <span class="url">${esc(shortUrl(l.url))}</span>`)].filter(Boolean).join('<br>') || '<span class="none">외부 링크 없음</span>'}</div>`).join('')}</div></div>`;
      out.push(guard(cl, 's-1'));
    }
    info.summary = Object.fromEntries(['L1', 'L2', 'L3', 'L4', 'L5'].map((t) => [t, out.filter((s) => s.dataset.pfTpl === t).length]));
    deck.replaceChildren(...out);
    deck.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('loading')) i.loading = 'lazy'; i.decoding = 'async'; });
    mark('assembled');
  }
})();
