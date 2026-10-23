// 포트폴리오 렌더러 공통 유틸 — index.html(포트폴리오 덱) · project.html(요약 덱) · doc.html(상세 문서)가 함께 씁니다.
// 데이터: data/portfolio.json, data/projects/<폴더 이름>.json(/portfolio-build가 생성), src/<폴더>/<기술 문서>.md
// 이 파일은 글을 만들지 않습니다. 화면에 나오는 내용은 모두 위 데이터에서 오고, 여기 있는 글자는 UI 문구뿐입니다.
// 주석의 설계 근거(docs/design/…의 portfolio-structure·deck-vs-scroll·01 §, R0, 결정 F·Q·# 번호)와 원본 시안(spikes/…)은 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.
const PF = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 텍스트 필드: HTML 이스케이프 + `백틱` → <code>
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  const isUrl = (u) => /^https?:\/\//i.test(u || '');
  const shortUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

  // 오류 문구의 경로는 사람이 읽게 디코딩(src/%EA%B8%B0… → src/기술…). 조각마다 encodeURIComponent로 만들었으므로 조각마다 되돌림(#·& 등 포함)
  const shownPath = (path) => String(path).split('/').map((s) => { try { return decodeURIComponent(s); } catch { return s; } }).join('/');
  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${shownPath(path)} (HTTP ${res.status})`);
    return res.json();
  }
  async function loadText(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${shownPath(path)} (HTTP ${res.status})`);
    return res.text();
  }

  // src/<폴더>/<상대경로> — 경로 조각마다 인코딩(한글 폴더·파일 이름 대응). 페이지는 모두 레포 루트에 있으므로 상대경로 그대로
  const encodePath = (p) => String(p).split('/').map(encodeURIComponent).join('/');
  const srcPath = (id, rel) => `src/${encodeURIComponent(id)}/${encodePath(String(rel).replace(/^\.\//, ''))}`;
  // 페이지 사이 주소(상대경로, 앞에 / 없음 — 프로젝트 Pages는 /<레포>/ 아래에 있음)
  const projectUrl = (id, sid = '') => `project.html?p=${encodeURIComponent(id)}${sid ? `#s=${sid}` : ''}`;
  const docUrl = (id, anchor = '') => `doc.html?p=${encodeURIComponent(id)}${anchor ? `#${anchor}` : ''}`;
  // 보이는 주소(PDF에서 그대로 칠 수 있게): 지금 사이트 주소 + 상대경로. 조각(#…)은 넣지 않음(portfolio-structure §5-4)
  const siteBase = () => `${location.host}${location.pathname.replace(/[^/]*$/, '')}`;
  const visibleUrl = (rel) => { let u = siteBase() + String(rel).replace(/#.*$/, ''); try { u = decodeURI(u); } catch { /* 그대로 */ } return u; };

  const metaValue = (p, label) => (p.meta || []).find((m) => m.label === label)?.value || '';
  const teamLabel = (team) => (team?.type === 'team' ? `팀 프로젝트${team.size ? ' · ' + team.size : ''}` : '개인 프로젝트');

  // GitHub와 같은 제목 앵커 규칙(github-slugger). slug는 이 함수만 만듭니다(빌드·Claude가 손으로 계산하지 않음)
  function slugger() {
    const seen = Object.create(null);
    return (text) => {
      const base = String(text).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '').replace(/ /g, '-');
      let slug = base;
      while (seen[slug] !== undefined) { seen[base] += 1; slug = `${base}-${seen[base]}`; }
      seen[slug] = 0;
      return slug;
    };
  }
  // 제목 비교용 정규화 — 백틱·강조 기호·공백 차이 무시
  const normTitle = (t) => String(t || '').replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim();
  // data의 section(절 제목) → 문서 제목. 규칙(portfolio-structure §3-3): 정규화 → 정확히 일치 → 앞부분 양방향 일치, 여럿이면 문서 순서상 첫 번째
  //   list: [{ text, ... }] 문서 순서. 돌려주는 값: 그 항목 또는 null
  function resolveHeading(list, title) {
    const want = normTitle(title);
    if (!want) return null;
    const norm = list.map((h) => [normTitle(h.text), h]);
    return (norm.find(([t]) => t === want) || norm.find(([t]) => t && (t.startsWith(want) || want.startsWith(t))))?.[1] || null;
  }
  // md → 제목 목록(상세 문서와 같은 파이프라인: marked gfm → 제목 textContent → slugger). 요약 덱의 딥링크·장 목록용
  //   <template>에 넣는 이유: 그 안의 내용은 비활성이라 문서 속 이미지(GIF 수십 MB)를 받지 않음. div에 넣으면 DOM에 붙이지 않아도 이미지를 받기 시작함
  function headingsOf(md) {
    if (!window.marked) return [];
    const box = document.createElement('template');
    box.innerHTML = marked.parse(md, { gfm: true });
    const slug = slugger();
    return [...box.content.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => ({ level: +h.tagName[1], text: h.textContent.trim(), id: slug(h.textContent.trim()) }));
  }

  // ── 링크 규칙(F10, portfolio-structure §5): 문서 사이·외부·원문 파일 = 새 탭 + ↗(aria-hidden) + 숨김 "(새 탭)".
  //    같은 문서 안 이동(앵커·목차·건너뛰기·같은 덱 장면)·mailto:·덱 조작 버튼·라이트박스 = 같은 탭(target 없음)
  const ICON = '<svg class="pf-newtab-icon" aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="12" height="12"><path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const NEWTAB = `${ICON}<span class="pf-sr-only pf-newtab-sr">(새 탭)</span>`;
  const NEW_TAB_KINDS = new Set(['external', 'page', 'file']);
  function link({ href, label, kind = 'external', cls = '', attrs = '' }) {
    const nt = NEW_TAB_KINDS.has(kind);
    return `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}"${nt ? ' target="_blank" rel="noopener"' : ''}${attrs ? ' ' + attrs : ''}>${label}${nt ? NEWTAB : ''}</a>`;
  }
  function markNewTab(a) {                                           // 이미 있는 <a>(md 안 등)에 같은 규칙 적용
    a.target = '_blank'; a.rel = 'noopener';
    if (!a.querySelector('.pf-newtab-icon')) a.insertAdjacentHTML('beforeend', NEWTAB);
  }

  // ── 강조색(profile.md "강조색") → 장면 색 토큰. 글자에 쓰는 색은 흰 바탕 대비 4.5:1 이상이 되게 어둡게 맞춤 ──
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgbHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);           // t = b 쪽 비율
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function themeTokens(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null;
    const A = hexRgb(hex), WHITE = [255, 255, 255], BLACK = [0, 0, 0];
    const soft = mix(A, WHITE, 0.91), chip = mix(A, WHITE, 0.82), mid = mix(A, WHITE, 0.45);
    let ink = A;                                                          // 글자용 진한 강조색: 흰 바탕 6.5:1·옅은 칠 6:1 이상(작은 글자 4.5:1에 여유)
    for (let t = 0; t <= 1 && (contrast(ink, WHITE) < 6.5 || contrast(ink, soft) < 6); t += 0.02) ink = mix(A, BLACK, t);
    const fill = contrast(A, WHITE) >= 4.5 ? A : ink;                    // 흰 글자를 올리는 칠(표 머리·배지)
    return { '--accent': rgbHex(A), '--accent-ink': rgbHex(ink), '--accent-fill': rgbHex(fill), '--accent-soft': rgbHex(soft), '--accent-chip': rgbHex(chip), '--accent-mid': rgbHex(mid) };
  }
  function applyTheme(hex) {
    const t = themeTokens(hex);
    if (t) Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    return t;
  }

  // ── 안내 문구(옛 렌더러와 같은 글) ──
  const FILE_HELP = `<p>이 페이지는 <code>data/</code>와 기술 문서를 불러와 그리기 때문에, 파일을 더블클릭해서는 열리지 않습니다.</p>
      <ol>
        <li>레포 폴더에서 터미널을 열고 아래 명령을 실행한 뒤 <b>http://localhost:4600</b> 접속
          <pre>python -m http.server 4600</pre>(Windows에서 안 되면 <code>py -m http.server 4600</code>)</li>
        <li>또는 JetBrains IDE(Rider·WebStorm)에서 <code>index.html</code> 우클릭 → <b>Open in → Browser</b></li>
        <li>또는 Claude Code에게 "미리보기 띄워줘"라고 요청</li>
      </ol>`;
  const noDataHtml = (err) => `<p>Claude Code에서 아래 명령을 실행하면 <code>src/</code>의 기술 문서·스크린샷을 읽어 데이터를 만듭니다.</p>
      <pre>/portfolio-build</pre>
      <p class="pf-note-err">${esc(err?.message || '')}</p>`;
  const isFile = () => location.protocol === 'file:';
  function notice(root, title, bodyHtml) {
    root.innerHTML = `<div class="notice"><h1>${title}</h1>${bodyHtml}</div>`;
  }
  // file:// 로 열면 fetch가 막힌다 → 로컬 서버 안내(흐르는 페이지용. 덱은 안내 장면으로 보여 줌)
  function guardFileProtocol(root) {
    if (!isFile()) return false;
    notice(root, '로컬 서버로 열어 주세요', FILE_HELP);
    return true;
  }
  function noData(root, err) { notice(root, '아직 포트폴리오 데이터가 없습니다', noDataHtml(err)); }

  return { esc, inline, isUrl, shortUrl, loadJSON, loadText, encodePath, srcPath, projectUrl, docUrl, siteBase, visibleUrl, metaValue, teamLabel,
           slugger, normTitle, resolveHeading, headingsOf, ICON, NEWTAB, link, markNewTab, themeTokens, applyTheme, contrast, hexRgb,
           FILE_HELP, noDataHtml, isFile, notice, guardFileProtocol, noData };
})();
