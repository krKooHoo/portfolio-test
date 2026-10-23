// 덱 장면 공통 — index.html(포트폴리오 덱)·project.html(요약 덱)이 common.js 다음에 싣습니다. 출처: spikes/deck/pages/pf-common.js
//   장면 틀 scene(), 측정 후 고르기 pack(), 넘침 처리 shrinkOrClip()(§4-3 원칙 5: 변형 → 축소(15px까지) → 보이는 잘림 띠), 글꼴·이미지 크기 대기
//   주석의 설계 근거(docs/design/…의 portfolio-structure·deck-vs-scroll·01 §, R0, 결정 F·Q·# 번호)와 원본 시안(spikes/…)은 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.
(() => {
  const { esc, inline } = PF;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 글꼴: 굵기마다 load + 각각 catch → fonts.ready, 상한 8초. 실패하면 data-pf-font="fallback"(늦게 들어오면 페이지가 다시 그림)
  async function loadFonts(sample = '가나다ABC123', ms = 8000) {
    const want = ['400', '600', '700', '800'].map((w) => `${w} 16px Pretendard`).concat(['400 14px D2Coding']);
    const errs = [];
    const all = Promise.all(want.map((f) => document.fonts.load(f, sample).then((r) => { if (!r.length) errs.push(f + ' (일치 없음)'); }).catch((e) => errs.push(f + ' ' + e))))
      .then(() => document.fonts.ready);
    const timedOut = await Promise.race([all.then(() => false), sleep(ms).then(() => true)]);
    const ok = want.map((f) => document.fonts.check(f, '가'));
    if (timedOut || ok.some((x) => !x)) document.documentElement.dataset.pfFont = 'fallback';
    else delete document.documentElement.dataset.pfFont;
    return { timedOut, errs, check: Object.fromEntries(want.map((f, i) => [f, ok[i]])) };
  }

  // 이미지 크기: data에 media w×h 기록이 아직 없으므로(Q12) 머리만 받아서 잼. rAF·decode() 금지 → setTimeout 폴링
  const dimCache = new Map();
  function imageSize(src) {
    if (dimCache.has(src)) return dimCache.get(src);
    const p = new Promise((res) => {
      const im = new Image();
      let done = false;
      const fin = () => { if (done) return; done = true; res(im.naturalWidth ? { w: im.naturalWidth, h: im.naturalHeight } : null); };
      im.onload = fin; im.onerror = fin;
      im.src = src;
      const poll = () => { if (done) return; if (im.naturalWidth) fin(); else setTimeout(poll, 15); };
      poll();
    });
    dimCache.set(src, p);
    return p;
  }

  // 측정용 컨테이너: 이 안의 장면은 배율 1
  let measure = null;
  function measureRoot() {
    if (!measure || !measure.isConnected) { measure = document.createElement('div'); measure.className = 'pf-measure'; measure.setAttribute('aria-hidden', 'true'); document.body.appendChild(measure); }
    return measure;
  }
  function dropMeasure() { measure?.remove(); measure = null; }

  // 장면 틀. kind: 'sum'(eyebrow │ 오른쪽 라벨 줄 + 제목 줄) | 'bare'(머리 없음: 표지·목차·맺음)
  //   id = 안정 장면 id(#s=<id> 공유 주소·장면 안 링크 목적지), sec = HUD·개요의 섹션명, stitle = 낭독·개요용 제목, group = 개요 묶음 이름
  function scene({ id = '', tpl, part = 'summary', kind = 'sum', eyebrow = '', rlabel = '', title = '', sub = '', pill = '', cls = '', foot = '', titleTag = 'h2', sec = '', stitle = '', group = '' }) {
    const s = document.createElement('section');
    s.className = `pf-scene pf-${kind} t-${tpl}${cls ? ' ' + cls : ''}`;
    if (id) s.id = id;
    s.dataset.pfTpl = tpl; s.dataset.pfPart = part;
    if (sec) s.dataset.sec = sec;
    if (stitle) s.dataset.title = stitle;
    if (group) s.dataset.group = group;
    const row = (right) => `<div class="pf-headrow"><p class="pf-eyebrow">${esc(eyebrow)}</p>${right}</div>`;
    const head = kind === 'bare' ? ''
      : `<header class="pf-head" data-pf-ui="chrome">${row(rlabel ? `<p class="pf-rlabel">${esc(rlabel)}</p>` : '')}${title ? `<div class="pf-titlerow"><${titleTag} class="pf-title">${inline(title)}${sub ? `<span class="pf-part" data-pf-ui="cont" aria-hidden="true">${esc(sub)}</span>` : ''}</${titleTag}>${pill ? `<span class="pill">${inline(pill)}</span>` : ''}</div>` : ''}</header>`;
    s.innerHTML = `${head}<div class="pf-body"></div>` +
      `<footer class="pf-foot" data-pf-ui="chrome"><span>${esc(foot)}</span><span class="pf-num"><span class="pf-n-screen"></span><span class="pf-n-print"></span></span></footer>`;
    return s;
  }
  const body = (s) => s.querySelector(':scope > .pf-body');
  // 장면이 넘치지 않는가(배치용: 이미지 로딩·숨김 검사는 빼고 키트 감사의 배치 항목만)
  const fitsScene = (s) => window.PFScene.sceneIssues(s, { layoutOnly: true }).length === 0;
  const fitsM = (s) => { const M = measureRoot(); M.appendChild(s); const ok = fitsScene(s); s.remove(); return ok; };

  // 측정 후 고르기(§4-3 원칙 1): 항목을 장면에 하나씩 넣어 보고, 우선순위대로 변형을 시험해 넘치지 않는 첫 변형을 씀
  //   build(chunk, variant, i, n) → 장면 요소. variants: [{ name, min, max }]
  function pack(items, variants, build) {
    const M = measureRoot();
    const tryFit = (chunk) => {
      for (const v of variants) {
        if (chunk.length < (v.min || 1) || chunk.length > (v.max || 99)) continue;
        const s = build(chunk, v.name, 0, 1); M.appendChild(s);
        const ok = fitsScene(s); s.remove();
        if (ok) return v.name;
      }
      return null;
    };
    const pages = []; let cur = [];
    for (const it of items) {
      const trial = cur.concat([it]);
      if (tryFit(trial)) { cur = trial; continue; }
      if (cur.length) pages.push(cur);
      cur = [it];
    }
    if (cur.length) pages.push(cur);
    if (pages.length > 1) {                                  // 균형: 마지막 장면이 1개뿐이고 앞 장면이 3개 이상이면 하나 옮김
      const a = pages[pages.length - 2], b = pages[pages.length - 1];
      if (b.length === 1 && a.length >= 3) { const na = a.slice(0, -1), nb = [a[a.length - 1], ...b]; if (tryFit(na) && tryFit(nb)) { pages[pages.length - 2] = na; pages[pages.length - 1] = nb; } }
    }
    return pages.map((chunk) => ({ chunk, variant: tryFit(chunk) }));   // variant null = 가장 넓은 변형에도 안 들어감(원칙 5로)
  }

  // §4-3 원칙 5의 ②③: 장면 본문을 글자 하한(15px)까지 비례 축소 → 그래도 넘치면 보이는 잘림 띠 + 리포트
  function shrinkOrClip(s, srcUrl, stats) {
    const b = body(s);
    const M = measureRoot(); const wasIn = s.isConnected; if (!wasIn) M.appendChild(s);
    let z = 1;
    if (!fitsScene(s)) {
      stats?.push({ tpl: s.dataset.pfTpl, action: 'overflow', issues: window.PFScene.sceneIssues(s, { layoutOnly: true }).slice(0, 4) });
      const w = document.createElement('div'); w.className = 'pf-zoomwrap'; w.append(...b.childNodes); b.appendChild(w);
      const bw = b.clientWidth, bh = b.clientHeight;
      while (!fitsScene(s) && z > 15 / 16 + 1e-9) {
        z = Math.max(+(z - 0.01).toFixed(2), 15 / 16);
        Object.assign(w.style, { zoom: String(z), width: `${bw / z}px`, height: `${bh / z}px` });
      }
      stats?.push({ tpl: s.dataset.pfTpl, action: 'shrink', zoom: +z.toFixed(4) });
    }
    if (!fitsScene(s)) {
      const c = document.createElement('div');
      c.className = 'pf-clipped'; c.dataset.pfUi = 'clip';
      c.textContent = `내용이 잘렸습니다 → 원문: ${srcUrl}`;
      s.appendChild(c);
      stats?.push({ tpl: s.dataset.pfTpl, action: 'clipped' });
    }
    if (!wasIn) s.remove();
    return s;
  }
  // 맞으면 그대로, 아니면 원칙 5
  const guard = (s, srcUrl, stats) => (fitsM(s) ? s : shrinkOrClip(s, srcUrl, stats));

  // 안내 장면(데이터 없음·file:// 등). 글은 옛 렌더러의 안내 문구
  function msgScene({ id = 'notice', title, html, foot = '', eyebrow = 'PORTFOLIO' }) {
    const s = scene({ id, tpl: 'msg', kind: 'bare', foot, sec: '안내', stitle: title });
    body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">${esc(eyebrow)}</span></div><div class="msg"><h1>${esc(title)}</h1><div class="msg-b">${html}</div></div>`;
    return s;
  }

  // 참고 덱 모티프: 점 선(2px 선 + 14px 점)
  const DOT = '<div class="dotrule" aria-hidden="true"><span class="ln"></span><span class="dot"></span></div>';
  const imgTag = (src, alt, d, cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${d ? ` width="${d.w}" height="${d.h}"` : ''}>`;

  // 프로젝트 외부 링크(시연 영상 · GitHub · 그 밖의 링크) — data 순서 그대로
  const extLinks = (p) => [
    PF.isUrl(p.links?.video) && { label: '시연 영상', url: p.links.video },
    PF.isUrl(p.links?.github) && { label: 'GitHub', url: p.links.github },
    ...(p.links?.extra || []).filter((l) => PF.isUrl(l.url)).map((l) => ({ label: l.label, url: l.url, extra: true })),
  ].filter(Boolean);

  // 늦게 들어온 글꼴로 다시 그리기(R0 설계 공백 1: 게이트의 fonts.ready는 그리기만 지키고 측정·나눔은 지키지 못함)
  function refitOnLateFont(render) {
    if (document.documentElement.dataset.pfFont !== 'fallback' || !document.fonts) return;
    let done = false;
    document.fonts.addEventListener('loadingdone', () => {
      if (done || !document.fonts.check('700 16px Pretendard', '가')) return;
      done = true;
      window.PFScene.track(render().then(() => window.PFScene.refresh()));
    });
  }

  // 프로젝트 소개 장면: 포트폴리오 덱의 프로젝트 소개(F1)와 요약 덱 표지(P1)가 같은 템플릿(portfolio-structure §3-1)
  //   글: title · tagline · tags · meta · team.role(data 그대로). 링크: [{ label, href, kind, visible }] — 보이는 주소는 말줄임 없이
  async function introScene(p, { id, titleTag = 'h2', eyebrow = 'PROJECT', links = [], foot = '', sec = '', group = '', stats }) {
    const d = p.cover ? await imageSize(PF.srcPath(p.id, p.cover)) : null;
    const ar = d ? d.w / d.h : null;
    const variant = !p.cover || !ar ? 'nocover' : ar < 0.9 ? 'portrait' : 'landscape';
    const metaRows = [...(p.meta || []).map((m) => `<tr><th>${esc(m.label)}</th><td>${inline(m.value)}</td></tr>`),
      p.team?.role && `<tr><th>내 역할</th><td class="role">${inline(p.team.role)}</td></tr>`].filter(Boolean).join('');
    const linkHtml = links.map((l) => `<div><b>${esc(l.label)}</b>${PF.link({ href: l.href, label: `<span class="url">${esc(l.visible)}</span>`, kind: l.kind })}</div>`).join('');
    const cover = p.cover ? `<div class="media"${ar ? ` style="aspect-ratio:${ar.toFixed(4)}"` : ''}>${imgTag(PF.srcPath(p.id, p.cover), p.title, d)}</div>` : '';
    const text = (withLinks) => `<div class="pc-text"><${titleTag} class="pc-t">${esc(p.title)}</${titleTag}>${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
      ${(p.tags || []).length ? `<ul class="tags">${p.tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${metaRows ? `<table class="kv"><tbody>${metaRows}</tbody></table>` : ''}${withLinks && linkHtml ? `<div class="pc-links">${linkHtml}</div>` : ''}</div>`;
    const make = (linksLeft, tight) => {
      const s = scene({ id, tpl: 'P1', kind: 'bare', cls: `${variant}${tight ? ' pc-tight' : ''}`, foot, sec, group, stitle: p.title });
      const main = variant === 'nocover' ? text(true)
        : variant === 'portrait' ? text(true) + cover
        : text(linksLeft) + `<div class="pc-right">${cover}${!linksLeft && linkHtml ? `<div class="pc-links">${linkHtml}</div>` : ''}</div>`;
      body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">${esc(eyebrow)}</span><span class="rl">${esc(PF.teamLabel(p.team))}</span></div><div class="pc-main">${main}</div>`;
      return s;
    };
    for (const tight of [false, true]) {
      for (const linksLeft of variant === 'landscape' ? [false, true] : [true]) {
        const s = make(linksLeft, tight);
        if (fitsM(s)) return s;
      }
    }
    return shrinkOrClip(make(false, true), window.PFScene.refUrl(id), stats);
  }

  Object.assign(PF, { sleep, loadFonts, imageSize, measureRoot, dropMeasure, scene, body, fitsScene, fitsM, pack, shrinkOrClip, guard, msgScene, DOT, imgTag, extLinks, refitOnLateFont, introScene });
})();
