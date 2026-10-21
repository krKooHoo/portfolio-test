// 포트폴리오 고정 렌더러 — 공통 유틸
// 데이터: data/portfolio.json, data/projects/<폴더 이름>.json  (/portfolio-build가 생성)
const PF = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 텍스트 필드: HTML 이스케이프 + `백틱` → <code>
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

  const isUrl = (u) => /^https?:\/\//i.test(u || '');

  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} (HTTP ${res.status})`);
    return res.json();
  }

  function applyAccent(hex) {
    if (/^#[0-9a-f]{6}$/i.test(hex || '')) document.documentElement.style.setProperty('--accent', hex);
  }

  // src/<폴더>/<상대경로> — 경로 조각마다 인코딩 (한글 폴더·파일 이름 대응)
  const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');
  const srcPath = (id, rel) => `src/${encodeURIComponent(id)}/${encodePath(rel.replace(/^\.\//, ''))}`;

  const projectUrl = (id) => `project.html?p=${encodeURIComponent(id)}`;

  const metaValue = (p, label) => (p.meta || []).find((m) => m.label === label)?.value || '';

  const teamLabel = (team) => team?.type === 'team'
    ? `팀 프로젝트${team.size ? ' · ' + team.size : ''}`
    : '개인 프로젝트';

  // 커버 이미지, 없으면 제목 첫 글자 플레이스홀더
  function cover(p, alt = '') {
    return p.cover
      ? `<img src="${srcPath(p.id, p.cover)}" alt="${esc(alt || p.title)}" loading="lazy" />`
      : `<div class="ph" aria-hidden="true">${esc((p.title || '?').slice(0, 1))}</div>`;
  }

  function linkButtons(links, { doc } = {}) {
    const out = [];
    if (doc) out.push(`<a class="btn primary" href="${doc}">기술 문서 보기 →</a>`);
    if (isUrl(links?.github)) out.push(`<a class="btn" href="${esc(links.github)}" target="_blank" rel="noopener">GitHub</a>`);
    if (isUrl(links?.video)) out.push(`<a class="btn" href="${esc(links.video)}" target="_blank" rel="noopener">시연 영상</a>`);
    (links?.extra || []).filter((l) => isUrl(l.url)).forEach((l) =>
      out.push(`<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`));
    return out.join('');
  }

  // GitHub와 같은 제목 앵커 규칙 (github-slugger) — 원문 목차의 #링크가 그대로 동작하도록
  function slugger() {
    const seen = Object.create(null);
    return (text) => {
      const base = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '').replace(/ /g, '-');
      let slug = base;
      while (seen[slug] !== undefined) { seen[base] += 1; slug = `${base}-${seen[base]}`; }
      seen[slug] = 0;
      return slug;
    };
  }

  // 제목 비교용 정규화 — 백틱·강조 기호·공백 차이 무시
  const normTitle = (t) => String(t || '').replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim();

  function notice(root, title, bodyHtml) {
    root.innerHTML = `<div class="wrap"><div class="notice"><h1>${title}</h1>${bodyHtml}</div></div>`;
  }

  // file:// 로 열면 fetch가 막힌다 → 로컬 서버 안내
  function guardFileProtocol(root) {
    if (location.protocol !== 'file:') return false;
    notice(root, '로컬 서버로 열어 주세요', `
      <p>이 페이지는 <code>data/</code>와 기술 문서를 불러와 그리기 때문에, 파일을 더블클릭해서는 열리지 않습니다.</p>
      <ol>
        <li>레포 폴더에서 터미널을 열고 아래 명령을 실행한 뒤 <b>http://localhost:4600</b> 접속
          <pre>python -m http.server 4600</pre>(Windows에서 안 되면 <code>py -m http.server 4600</code>)</li>
        <li>또는 JetBrains IDE(Rider·WebStorm)에서 <code>index.html</code> 우클릭 → <b>Open in → Browser</b></li>
        <li>또는 Claude Code에게 "미리보기 띄워줘"라고 요청</li>
      </ol>`);
    return true;
  }

  function noData(root, err) {
    notice(root, '아직 포트폴리오 데이터가 없습니다', `
      <p>Claude Code에서 아래 명령을 실행하면 <code>src/</code>의 기술 문서·스크린샷을 읽어 데이터를 만듭니다.</p>
      <pre>/portfolio-build</pre>
      <p style="color:var(--faint);font-size:13px;margin-top:14px">${esc(err?.message || '')}</p>`);
  }

  function lightbox() {
    let dlg = document.querySelector('dialog.lightbox');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.className = 'lightbox';
      dlg.innerHTML = '<img alt="" /><p></p>';
      dlg.addEventListener('click', () => dlg.close());
      document.body.appendChild(dlg);
    }
    return (src, caption) => {
      dlg.querySelector('img').src = src;
      dlg.querySelector('p').textContent = caption || '';
      dlg.showModal();
    };
  }

  return { esc, inline, isUrl, loadJSON, applyAccent, srcPath, projectUrl, metaValue, teamLabel,
           cover, linkButtons, slugger, normTitle, notice, guardFileProtocol, noData, lightbox };
})();
