// 포트폴리오 요약(랜딩) — format/01-portfolio.md §1
(async () => {
  const root = document.getElementById('app');
  if (PF.guardFileProtocol(root)) return;

  let pf;
  try { pf = await PF.loadJSON('data/portfolio.json'); }
  catch (err) { return PF.noData(root, err); }

  PF.applyAccent(pf.settings?.accent);
  const projects = (await Promise.all((pf.projects || []).map((id) =>
    PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`)
      .catch((err) => { console.warn('[portfolio] 프로젝트 데이터 없음:', err.message); return null; })
  ))).filter(Boolean);
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));

  const { esc, inline } = PF;
  const profile = pf.profile || {};
  const stackFirst = pf.settings?.layout === 'stack';
  document.title = `${profile.name || '포트폴리오'} · 포트폴리오`;

  // ① 헤더: 이름 / 연락처
  const contact = [
    profile.email && `<a class="btn" href="mailto:${esc(profile.email)}">✉ ${esc(profile.email)}</a>`,
    PF.isUrl(profile.github) && `<a class="btn" href="${esc(profile.github)}" target="_blank" rel="noopener">GitHub</a>`,
    ...(profile.links || []).filter((l) => PF.isUrl(l.url))
      .map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`),
  ].filter(Boolean).join('');

  const hero = `
    <header class="hero wrap">
      <div class="kicker">PORTFOLIO</div>
      <h1>${esc(profile.name)}${profile.nameEn ? `<small>${esc(profile.nameEn)}</small>` : ''}</h1>
      ${profile.headline ? `<p class="headline">${inline(profile.headline)}</p>` : ''}
      ${profile.intro ? `<div class="intro">${profile.intro.split(/\n+/).map((l) => `<p>${inline(l)}</p>`).join('')}</div>` : ''}
      ${contact ? `<div class="contact">${contact}</div>` : ''}
    </header>`;

  // ② 기술 스택 — 경험 기반 (기술마다 근거 프로젝트)
  const evidenceItem = (e) => {
    const p = byId[e.project];
    return `<li><span>${inline(e.text)}</span>${p ? `<a href="${PF.projectUrl(p.id)}">${esc(p.title)}</a>` : ''}</li>`;
  };
  const skillProjects = (s) => [...new Set((s.evidence || []).map((e) => e.project))]
    .map((id) => byId[id]).filter(Boolean)
    .map((p) => `<a class="mini" href="${PF.projectUrl(p.id)}">${PF.cover(p)}${esc(p.title)}</a>`).join('');
  const skillRows = (pf.skills || []).map((s) => `
    <div class="skill">
      <h3>${esc(s.name)}</h3>
      <div>
        <ul>${(s.evidence || []).map(evidenceItem).join('')}</ul>
        ${stackFirst ? `<div class="skill-projects">${skillProjects(s)}</div>` : ''}
      </div>
    </div>`).join('');
  const skills = skillRows ? `
    <section class="section wrap" id="skills">
      <div class="section-head"><span class="no">01</span><h2>기술 스택</h2><p>무엇을 만들며 썼는지, 근거 프로젝트와 함께</p></div>
      <div class="skills${stackFirst ? ' large' : ''}">${skillRows}</div>
    </section>` : '';

  // ③ 대표 프로젝트 카드 — 제목 · 한 줄 소개 · 기술 키워드 · 본인 역할
  const card = (p) => `
    <article class="card">
      <a class="card-cover" href="${PF.projectUrl(p.id)}" aria-label="${esc(p.title)} 상세">${PF.cover(p)}</a>
      <div class="card-body">
        <div class="card-kicker">
          <span class="badge${p.team?.type === 'team' ? ' team' : ''}">${esc(PF.teamLabel(p.team))}</span>
          <span>${esc(PF.metaValue(p, '기간'))}</span>
        </div>
        <h3><a href="${PF.projectUrl(p.id)}">${esc(p.title)}</a></h3>
        ${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
        ${p.team?.role ? `<p class="role"><b>내 역할</b>${inline(p.team.role)}</p>` : ''}
        <ul class="tags">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="actions">${PF.linkButtons(p.links, { doc: PF.projectUrl(p.id) })}</div>
      </div>
    </article>`;
  const projectSection = `
    <section class="section wrap" id="projects">
      <div class="section-head"><span class="no">02</span><h2>프로젝트</h2><p>${projects.length}개 · 카드를 누르면 기술 문서로 이동합니다</p></div>
      <div class="grid${stackFirst ? ' compact' : ''}">${projects.map(card).join('')}</div>
    </section>`;

  // ④ 프로젝트 요약 표
  const linkCell = (p) => [
    PF.isUrl(p.links?.github) && `<a href="${esc(p.links.github)}" target="_blank" rel="noopener">GitHub</a>`,
    `<a href="${PF.projectUrl(p.id)}">기술문서</a>`,
    PF.isUrl(p.links?.video) && `<a href="${esc(p.links.video)}" target="_blank" rel="noopener">영상</a>`,
  ].filter(Boolean).join('<span class="sep">·</span>');
  const summary = projects.length ? `
    <section class="section wrap" id="summary">
      <div class="section-head"><span class="no">03</span><h2>한눈에 보기</h2></div>
      <div class="table-wrap"><table class="summary">
        <thead><tr><th>프로젝트명</th><th>한 줄 소개</th><th>핵심 기술</th><th>역할</th><th>링크</th></tr></thead>
        <tbody>${projects.map((p) => `<tr>
          <td>${esc(p.title)}</td>
          <td>${inline(p.tagline)}</td>
          <td>${esc((p.tags || []).slice(0, 4).join(', '))}</td>
          <td>${esc(PF.teamLabel(p.team))}${p.team?.role ? `<br />${inline(p.team.role)}` : ''}</td>
          <td style="white-space:nowrap">${linkCell(p)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>` : '';

  const nav = `
    <div class="topbar"><div class="wrap">
      <a class="brand" href="#">${esc(profile.name)}</a>
      <nav>${skills ? '<a href="#skills">기술 스택</a>' : ''}<a href="#projects">프로젝트</a>${summary ? '<a href="#summary">한눈에 보기</a>' : ''}</nav>
    </div></div>`;

  const footer = `
    <footer class="footer"><div class="wrap">
      <span>© ${esc(profile.name)}${profile.email ? ' · ' + esc(profile.email) : ''}</span>
      <span>업데이트 ${esc(pf.generatedAt || '')}</span>
    </div></footer>`;

  root.innerHTML = nav + hero + skills + projectSection + summary + footer;
})();
