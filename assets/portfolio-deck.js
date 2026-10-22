// 포트폴리오 덱(index.html) — 제출용 PDF가 되는 16:9 덱(결정 F1·F4·F8·F9, portfolio-structure §2)
//   장면: 표지 → 자기소개 → 기술 스택 → 프로젝트마다 2장(소개 + 핵심 요약) → 한눈에 보기 → 맺음(연락처·링크)
//   이력서·자기소개서(에세이) 장면은 만들지 않습니다: 학생이 직접 쓴 원천(resume.md·essay)이 아직 없기 때문입니다(F7, 원칙 1 지어내지 않음).
//   모든 글은 data/portfolio.json·data/projects/*.json에 있는 값 그대로입니다. 장면 이름·라벨만 UI 글자입니다.
(() => {
  const deck = document.getElementById('deck');
  const info = (PFScene.info = { page: 'index', t: {}, summary: {}, overflow: [], errors: [] });
  const mark = (k) => { info.t[k] = Math.round(performance.now()); };
  const { esc, inline, isUrl, shortUrl, DOT, link } = PF;
  const pad2 = (n) => String(n).padStart(2, '0');

  PFScene.track(start().catch((err) => {
    info.errors.push(String(err && err.stack || err));
    deck.replaceChildren(PF.msgScene({ title: '페이지를 그리지 못했습니다', html: `<p>${esc(err && err.message || err)}</p>` }));
  }).finally(() => { PF.dropMeasure(); PFScene.mount({ deck: '#deck' }); mark('mounted'); }));

  async function start() {
    mark('start');
    if (PF.isFile()) { deck.replaceChildren(PF.msgScene({ title: '로컬 서버로 열어 주세요', html: PF.FILE_HELP })); return; }
    let pf;
    try { pf = await PF.loadJSON('data/portfolio.json'); }
    catch (err) { deck.replaceChildren(PF.msgScene({ title: '아직 포트폴리오 데이터가 없습니다', html: PF.noDataHtml(err) })); return; }
    PF.applyTheme(pf.settings?.accent);
    const projects = (await Promise.all((pf.projects || []).map((id) => PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`)
      .catch((err) => { console.warn('[portfolio] 프로젝트 데이터 없음:', err.message); return null; })))).filter(Boolean);
    mark('data');
    // 옛 랜딩의 조각 주소 → 새 장면(이미 공유된 링크 보호)
    let rawHash = location.hash.slice(1); try { rawHash = decodeURIComponent(rawHash); } catch { /* 그대로 */ }
    const legacy = { skills: 'stack', projects: projects[0] ? `p-${projects[0].id}` : '', summary: 'glance' }[rawHash];
    if (legacy) try { history.replaceState(null, '', `${location.pathname}${location.search}#s=${encodeURIComponent(legacy)}`); } catch { /* */ }
    const render = () => renderAll(pf, projects);
    await render();
    PF.refitOnLateFont(render);
  }

  async function renderAll(pf, projects) {
    const prof = pf.profile || {};
    const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
    const foot = `${prof.name ? prof.name + ' · ' : ''}포트폴리오`;
    document.title = `${prof.name || '포트폴리오'} · 포트폴리오`;
    info.fonts = await PF.loadFonts();
    mark('fonts');
    const ov = info.overflow;
    const out = [];

    // ① 표지: 이름 · 한 줄 정체성 · 연락처(mailto는 같은 탭, 웹 주소는 새 탭)
    const contacts = [
      prof.email && ['EMAIL', link({ href: `mailto:${prof.email}`, label: esc(prof.email), kind: 'mail' })],
      isUrl(prof.github) && ['GITHUB', link({ href: prof.github, label: `<span class="url">${esc(shortUrl(prof.github))}</span>` })],
      ...(prof.links || []).filter((l) => isUrl(l.url)).map((l) => [esc(l.label), link({ href: l.url, label: `<span class="url">${esc(shortUrl(l.url))}</span>` })]),
    ].filter(Boolean);
    const c = PF.scene({ id: 'cover', tpl: 'L1', kind: 'bare', foot, sec: '표지', stitle: prof.name || '포트폴리오' });
    PF.body(c).innerHTML = `<div class="toprow"><span class="pf-eyebrow">PORTFOLIO</span>${pf.generatedAt ? `<span class="rl">업데이트 ${esc(pf.generatedAt)}</span>` : ''}</div>
      <div class="cv-mid"><h1 class="cv-name">${esc(prof.name || '포트폴리오')}${prof.nameEn ? `<span lang="en">${esc(prof.nameEn)}</span>` : ''}</h1>${DOT}
        ${prof.headline ? `<p class="cv-h">${inline(prof.headline)}</p>` : ''}</div>
      <div class="cv-bot">${contacts.length ? `<table class="kv"><tbody>${contacts.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>` : '<span></span>'}
        <div class="cv-web"><p class="cv-lb">웹 포트폴리오</p><span class="url">${esc(PF.visibleUrl(''))}</span></div></div>`;
    out.push(PF.guard(c, PFScene.refUrl('cover'), ov));

    // ② 자기소개: profile.intro를 줄바꿈까지 그대로(고쳐 쓰지 않음)
    if (prof.intro) {
      const make = (small) => {
        const s = PF.scene({ id: 'intro', tpl: 'ME', eyebrow: 'ABOUT ME', rlabel: prof.name || '', title: '자기소개', foot, sec: '자기소개' });
        PF.body(s).innerHTML = `<div class="me${small ? ' s' : ''}">${prof.intro.split(/\n+/).filter((l) => l.trim()).map((l) => `<p>${inline(l)}</p>`).join('')}</div>`;
        return s;
      };
      const big = make(false);
      out.push(PF.fitsM(big) ? big : PF.guard(make(true), PFScene.refUrl('intro'), ov));
    }

    // ③ 기술 스택: 기술마다 근거(evidence)와 근거 프로젝트. 프로젝트 칩은 같은 덱의 그 프로젝트 소개 장면으로(같은 탭)
    const skillCard = (s) => `<article class="skill card"><h3>${esc(s.name)}</h3>${DOT}<ul>${(s.evidence || []).map((e) => `<li><span>${inline(e.text)}</span>${byId[e.project]
      ? link({ href: `#p-${e.project}`, label: esc(byId[e.project].title), kind: 'anchor', cls: 'chip' }) : ''}</li>`).join('')}</ul></article>`;
    const buildSkills = (items, v, i, n) => {
      const s = PF.scene({ id: i === 0 ? 'stack' : `stack-${i + 1}`, tpl: 'L2', eyebrow: 'SKILLS', rlabel: '기술 스택 · 근거 프로젝트와 함께', title: '무엇을 만들며 썼는지', sub: n > 1 ? `${i + 1}/${n}` : '', foot, sec: '기술 스택' });
      PF.body(s).innerHTML = `<div class="skills ${v}">${items.map(skillCard).join('')}</div>`; return s;
    };
    if ((pf.skills || []).length) {
      const V = [{ name: 'c3', min: 1, max: 3 }, { name: 'c2', min: 4, max: 4 }, { name: 'rows', min: 1, max: 8 }];
      const pages = PF.pack(pf.skills, V, buildSkills);
      pages.forEach((pg, i) => out.push(pg.variant ? buildSkills(pg.chunk, pg.variant, i, pages.length) : PF.shrinkOrClip(buildSkills(pg.chunk, 'rows', i, pages.length), PFScene.refUrl('stack'), ov)));
    }

    // ④ 프로젝트마다 2장(F8): 소개(영상·GitHub·요약 덱·상세 문서 링크) + 핵심 요약(핵심 구현 제목·기능 설명, 이슈 해결 제목)
    for (const [j, p] of projects.entries()) {
      const no = `PROJECT ${pad2(j + 1)} / ${pad2(projects.length)}`;
      const links = [
        isUrl(p.links?.video) && { label: '시연 영상', href: p.links.video, kind: 'external', visible: shortUrl(p.links.video) },
        isUrl(p.links?.github) && { label: 'GitHub', href: p.links.github, kind: 'external', visible: shortUrl(p.links.github) },
        { label: '요약 덱', href: PF.projectUrl(p.id), kind: 'page', visible: PF.visibleUrl(PF.projectUrl(p.id)) },
        { label: '상세 문서', href: PF.docUrl(p.id), kind: 'page', visible: PF.visibleUrl(PF.docUrl(p.id)) },
      ].filter(Boolean);
      out.push(await PF.introScene(p, { id: `p-${p.id}`, eyebrow: no, links, foot, sec: `프로젝트 · ${p.title}`, group: '프로젝트', stats: ov }));
      const core = coreScene(p, no, foot);
      if (core) out.push(core);
    }
    function coreScene(p, no, foot2) {
      const hl = p.highlights || [], ts = p.troubleshooting || [];
      if (!hl.length && !ts.length) return null;
      const item = (x, sid, withWhat) => `<li><div class="ct"><b>${inline(x.title)}</b>${link({ href: PF.projectUrl(p.id, sid), label: '요약 덱', kind: 'page',
        attrs: `aria-label="${esc(PF.normTitle(x.title))} — 요약 덱에서 보기 (새 탭)"` })}</div>${withWhat && x.what ? `<p class="cw">${inline(x.what)}</p>` : ''}</li>`;
      const col = (h, list, pre, withWhat) => (list.length ? `<section class="core-col"><p class="core-h">${h}<span>${list.length}</span></p><ol class="core-list">${list.map((x, i) => item(x, `${pre}-${i + 1}`, withWhat)).join('')}</ol></section>` : '<div></div>');
      const make = (v) => {
        const s = PF.scene({ id: `p-${p.id}-core`, tpl: 'F2', eyebrow: `${no} · 핵심 요약`, rlabel: PF.teamLabel(p.team), title: p.title, foot: foot2, sec: `프로젝트 · ${p.title} · 핵심 요약`, group: '프로젝트', stitle: `${p.title} 핵심 요약` });
        PF.body(s).innerHTML = `<div class="core ${v}">${col('핵심 구현', hl, 'hl', true)}${col('이슈 해결', ts, 'ts', false)}
          <div class="core-act">${link({ href: PF.projectUrl(p.id), label: '요약 덱 전체', kind: 'page', cls: 'btnlink primary' })}${link({ href: PF.docUrl(p.id), label: '상세 문서', kind: 'page', cls: 'btnlink' })}</div></div>`;
        return s;
      };
      for (const v of ['', 'tight']) { const s = make(v); if (PF.fitsM(s)) return s; }
      return PF.shrinkOrClip(make('tight'), PFScene.refUrl(`p-${p.id}-core`), ov);
    }

    // ⑤ 한눈에 보기 표(format/01 §1 프로젝트 요약 표): 프로젝트명 · 한 줄 소개 · 핵심 기술 · 역할 · 링크
    const row = (p) => `<tr><td>${link({ href: `#p-${p.id}`, label: esc(p.title), kind: 'anchor' })}</td><td>${inline(p.tagline)}</td><td>${esc((p.tags || []).slice(0, 4).join(', '))}</td>
      <td>${esc(PF.teamLabel(p.team))}${p.team?.role ? `<br>${inline(p.team.role)}` : ''}</td>
      <td><span class="lk">${[isUrl(p.links?.github) && link({ href: p.links.github, label: 'GitHub' }), link({ href: PF.projectUrl(p.id), label: '요약 덱', kind: 'page' }),
        link({ href: PF.docUrl(p.id), label: '상세 문서', kind: 'page' }), isUrl(p.links?.video) && link({ href: p.links.video, label: '시연 영상' })].filter(Boolean).join('')}</span></td></tr>`;
    const buildSum = (items, v, i, n2) => {
      const s = PF.scene({ id: i === 0 ? 'glance' : `glance-${i + 1}`, tpl: 'L4', eyebrow: 'AT A GLANCE', rlabel: '한눈에 보기', title: '프로젝트 요약', sub: n2 > 1 ? `${i + 1}/${n2}` : '', foot, sec: '한눈에 보기' });
      PF.body(s).innerHTML = `<table class="mini">${i > 0 ? '<caption data-pf-ui="cont" aria-hidden="true">표 이어서</caption>' : ''}<colgroup><col style="width:17%"><col style="width:31%"><col style="width:20%"><col style="width:19%"><col style="width:13%"></colgroup><thead><tr><th scope="col">프로젝트명</th><th scope="col">한 줄 소개</th><th scope="col">핵심 기술</th><th scope="col">역할</th><th scope="col">링크</th></tr></thead><tbody>${items.map(row).join('')}</tbody></table>`; return s;
    };
    if (projects.length) {
      const pages = PF.pack(projects, [{ name: 'rows', min: 1, max: 99 }], (it, v) => buildSum(it, v, 1, 2));
      pages.forEach((pg, i) => out.push(pg.variant ? buildSum(pg.chunk, 'rows', i, pages.length) : PF.shrinkOrClip(buildSum(pg.chunk, 'rows', i, pages.length), PFScene.refUrl('glance'), ov)));
    }

    // ⑥ 맺음: 연락처 + 프로젝트별 링크(요약 덱 · 상세 문서 · GitHub · 영상 · 그 밖의 링크는 주소까지)
    const contactHtml = `<p class="cl-name">${esc(prof.name || '')}</p>${DOT}${prof.email ? `<p class="em">${link({ href: `mailto:${prof.email}`, label: esc(prof.email), kind: 'mail' })}</p>` : ''}
      ${isUrl(prof.github) ? `<p>${link({ href: prof.github, label: `<span class="url">${esc(shortUrl(prof.github))}</span>` })}</p>` : ''}
      ${(prof.links || []).filter((l) => isUrl(l.url)).map((l) => `<p>${esc(l.label)} ${link({ href: l.url, label: `<span class="url">${esc(shortUrl(l.url))}</span>` })}</p>`).join('')}
      <p class="cl-web"><span class="url">${esc(PF.visibleUrl(''))}</span></p>`;
    const projRow = (p) => {
      const std = [link({ href: PF.projectUrl(p.id), label: '요약 덱', kind: 'page' }), link({ href: PF.docUrl(p.id), label: '상세 문서', kind: 'page' }),
        isUrl(p.links?.github) && link({ href: p.links.github, label: 'GitHub' }), isUrl(p.links?.video) && link({ href: p.links.video, label: '시연 영상' })].filter(Boolean);
      const ex = (p.links?.extra || []).filter((l) => isUrl(l.url)).map((l) => `<span class="ex">${esc(l.label)} ${link({ href: l.url, label: `<span class="url">${esc(shortUrl(l.url))}</span>` })}</span>`);
      return `<div><b>${esc(p.title)}</b><span class="row">${std.join('')}</span>${ex.join('')}</div>`;
    };
    const cl = PF.scene({ id: 'contact', tpl: 'L5', kind: 'bare', foot, sec: '연락처', stitle: '연락처와 프로젝트 링크' });
    PF.body(cl).innerHTML = `<div class="toprow"><span class="pf-eyebrow">CONTACT</span><span class="rl">연락처와 프로젝트 링크</span></div>
      <div class="cl-mid"><div class="cl-me">${contactHtml}</div><div class="cl-lk">${projects.map(projRow).join('')}</div></div>`;
    out.push(PF.guard(cl, PFScene.refUrl('contact'), ov));

    info.summary = Object.fromEntries(['L1', 'ME', 'L2', 'P1', 'F2', 'L4', 'L5'].map((t) => [t, out.filter((s) => s.dataset.pfTpl === t).length]));
    deck.replaceChildren(...out);
    deck.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('loading')) i.loading = 'lazy'; i.decoding = 'async'; });
    mark('assembled');
  }
})();
