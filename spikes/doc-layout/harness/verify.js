// verify.js — 시안 ①②③과 A0를 독립적으로 다시 재는 검증 하네스(capture.js와 따로 작성).
// 사용(PowerShell): node spikes/doc-layout/harness/verify.js [--part=measure,links,phone,find,print,shots]
// 서버: 127.0.0.1:4652(레포 루트, 읽기 전용) · 브라우저: 헤드리스 Chrome(CDP 파이프, 프로필 %TEMP%\doclayout-chrome-*, 끝나면 지움)
// 결과: spikes/doc-layout/out/verify/*.json, *.pdf, shots/*.png
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out/verify');
const PORT = 4652;
const args = process.argv.slice(2);
const parts = ((args.find((a) => a.startsWith('--part=')) || '--part=measure,links,phone,find,print,shots').slice(7)).split(',');
const DOCS = ['1-action-platformer', '0-Tidy-Mommy', '2-Yggdrasil'];
const WIDTHS = [{ w: 1366, h: 768 }, { w: 1880, h: 1000 }, { w: 1920, h: 1080 }, { w: 2560, h: 1440 }];
const variants = (id) => [
  { key: 'A0', url: `project.html?p=${id}` },
  { key: 'L1', url: `spikes/doc-layout/doc.html?p=${id}&layout=1` },
  { key: 'L2', url: `spikes/doc-layout/doc.html?p=${id}&layout=2` },
  { key: 'L3', url: `spikes/doc-layout/doc.html?p=${id}&layout=3` },
];
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';

const READY = `(async () => {
  const t0 = Date.now();
  const ok = () => {
    const md = document.querySelector('.md');
    if (!md || md.querySelector('.loading')) return false;
    if (document.querySelector('.doc-page') && document.documentElement.dataset.docReady !== '1') return false;
    const mm = [...md.querySelectorAll('.mermaid')];
    if (!mm.every((m) => m.querySelector('svg'))) return false;
    if (!document.querySelector('#toc-links a')) return false;
    return true;
  };
  while (!ok() && Date.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 150));
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 30000); })));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { ok: ok(), ms: Date.now() - t0, pretendard: document.fonts.check('16px Pretendard') };
})()`;

// ── 폭 실측 (A0·시안 공통 식) ──
const MEASURE = `(() => {
  const de = document.documentElement, cw = de.clientWidth;
  const isDoc = !!document.querySelector('.doc-page');
  const md = document.querySelector('.md');
  const R = (e) => e.getBoundingClientRect();
  const shown = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0;
  const mcs = getComputedStyle(md), mr = R(md);
  const colL = mr.left + parseFloat(mcs.borderLeftWidth) + parseFloat(mcs.paddingLeft);
  const colR = mr.right - parseFloat(mcs.borderRightWidth) - parseFloat(mcs.paddingRight);
  const toc = document.querySelector('.toc'), rail = document.querySelector('.rail');
  const boxes = [toc, md, rail].filter(shown).map(R);
  const outerL = Math.min(...boxes.map((b) => b.left)), outerR = cw - Math.max(...boxes.map((b) => b.right));
  const tocR = shown(toc) ? R(toc).right : 0, railL = shown(rail) ? R(rail).left : cw;

  // 문단(글만 있는 긴 문단)
  const paras = [...md.querySelectorAll(':scope > p')].filter((p) => !p.classList.contains('pf-figure') && !p.classList.contains('doc-chip')
    && !p.classList.contains('print-only') && !p.querySelector('img') && p.textContent.trim().length > 160);
  const pw = paras.map((p) => R(p).width);
  const p0 = paras[0] ? R(paras[0]) : null;
  // 한 줄 글자 수(공백 포함, 마지막 줄 제외): 글자마다 Range로 줄 위치를 잼
  const perLine = [], perLineHangul = [];
  const rng = document.createRange();
  for (const p of paras.slice(0, 14)) {
    const lh = parseFloat(getComputedStyle(p).lineHeight), top0 = R(p).top;
    const lines = [];
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.parentElement.closest('.sr-only, .print-only, svg')) continue;
      const s = n.data;
      for (let i = 0; i < s.length; i++) {
        rng.setStart(n, i); rng.setEnd(n, i + 1);
        const rc = rng.getClientRects(); if (!rc.length) continue;
        const r = rc[rc.length - 1]; if (r.width === 0) continue;
        const li = Math.floor(((r.top + r.bottom) / 2 - top0) / lh);
        lines[li] = lines[li] || { all: 0, hangul: 0 };
        lines[li].all++; if (/[\\uAC00-\\uD7A3]/.test(s[i])) lines[li].hangul++;
      }
    }
    const full = lines.filter(Boolean).slice(0, -1);
    full.forEach((l) => { perLine.push(l.all); perLineHangul.push(l.hangul); });
  }
  const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const probe = document.createElement('span'); probe.textContent = '가'.repeat(50); probe.style.cssText = 'position:absolute;white-space:nowrap;visibility:hidden';
  (paras[0] || md).appendChild(probe); const gaW = probe.getBoundingClientRect().width / 50; probe.remove();

  // 코드
  const pres = [...md.querySelectorAll('pre')].filter((p) => !p.closest('.mmd-src, .mermaid') && shown(p));
  const pre = pres.map((p) => {
    const c = p.querySelector('code');
    const sc = [p, c].filter(Boolean).filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowX));
    const r = R(p);
    return { w: Math.round(r.width), avail: Math.round(colR - r.left), indent: Math.round(r.left - colL),
             over: sc.some((e) => e.scrollWidth > e.clientWidth + 1), need: Math.max(p.scrollWidth, c ? c.scrollWidth : 0) };
  });
  // 도식
  const figMaxVar = parseFloat(getComputedStyle(de).getPropertyValue('--fig-max')) || Infinity;
  const svgs = [...md.querySelectorAll('.mermaid svg')];
  const mm = svgs.map((s) => { const nat = s.viewBox && s.viewBox.baseVal ? s.viewBox.baseVal.width : 0; const w = R(s).width;
    const box = R(s.closest('.mmd') || s.closest('.mermaid')).width; return { nat: Math.round(nat), w: Math.round(w), scale: nat ? +(w / nat).toFixed(3) : 1, box: Math.round(box) }; });
  // 그림
  const imgs = [...md.querySelectorAll('img')].filter((i) => shown(i) && i.naturalWidth);
  const im = imgs.map((i) => { const r = R(i); return { w: Math.round(r.width), h: Math.round(r.height), nat: i.naturalWidth, natH: i.naturalHeight, left: Math.round(r.left - colL) }; });
  // 표
  const tables = [...md.querySelectorAll('table')];
  const tOver = tables.filter((t) => { const s = t.parentElement.classList.contains('table-wrap') ? t.parentElement : t; return s.scrollWidth > s.clientWidth + 1; }).length;
  const tW = tables.map((t) => R(t).width);

  return {
    isDoc, vw: innerWidth, cw, scrollbar: innerWidth - cw,
    outerL: Math.round(outerL), outerR: Math.round(outerR),
    toc: shown(toc) ? Math.round(R(toc).width) : 0, rail: shown(rail) ? Math.round(R(rail).width) : 0,
    col: Math.round(colR - colL),
    para: { n: paras.length, wMin: Math.round(Math.min(...pw)), wMax: Math.round(Math.max(...pw)),
            leftGap: p0 ? Math.round(p0.left - colL) : null, rightGap: p0 ? Math.round(colR - p0.right) : null,
            toLeftNeighbor: p0 ? Math.round(p0.left - tocR) : null, toRightNeighbor: p0 ? Math.round(railL - p0.right) : null,
            charsMedian: med(perLine), charsMin: perLine.length ? Math.min(...perLine) : null, charsMax: perLine.length ? Math.max(...perLine) : null,
            hangulMedian: med(perLineHangul), lines: perLine.length, gaW: +gaW.toFixed(2), fullHangulPerLine: p0 ? Math.floor(p0.width / gaW) : null },
    code: { n: pre.length, over: pre.filter((x) => x.over).length, areaMax: Math.max(0, ...pre.map((x) => x.avail)), wMax: Math.max(0, ...pre.map((x) => x.w)),
            needMax: Math.max(0, ...pre.map((x) => x.need)), indent: pre.length ? pre[0].indent : null },
    mmd: { n: mm.length, area: Math.round(isDoc ? Math.min(colR - colL, figMaxVar) : colR - colL), boxMax: Math.max(0, ...mm.map((x) => x.box)),
           below08: mm.filter((x) => x.scale < 0.8).length, below099: mm.filter((x) => x.scale < 0.99).length,
           minScale: mm.length ? Math.min(...mm.map((x) => x.scale)) : null, scales: mm.map((x) => x.scale), nat: mm.map((x) => x.nat) },
    img: { n: im.length, shrunk: im.filter((x) => x.w < x.nat * 0.99).length, maxW: Math.max(0, ...im.map((x) => x.w)),
           first: im[0] || null, tallest: Math.max(0, ...im.map((x) => x.h)) },
    table: { n: tables.length, over: tOver, wMax: Math.round(Math.max(0, ...tW)) },
    pageHOverflow: de.scrollWidth - cw,
  };
})()`;

const SCROLL_TO = (heading, offset) => `(() => {
  const norm = (t) => PF.normTitle(t);
  let y = 0;
  if (${JSON.stringify(heading)}) {
    const el = [...document.querySelectorAll('.md h2, .md h3')].find((h) => norm(h.textContent) === norm(${JSON.stringify(heading)}));
    if (!el) return 'not found';
    y = el.getBoundingClientRect().top + scrollY - ${offset};
  } else if (document.getElementById('pf-doc')) y = document.getElementById('pf-doc').getBoundingClientRect().top + scrollY - ${offset};
  window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
  return Math.round(scrollY);
})()`;

async function open(browser, base, url, vp) {
  const pg = await browser.newPage();
  await pg.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: !!vp.mobile });
  if (vp.mobile) {
    await pg.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await pg.send('Emulation.setUserAgentOverride', { userAgent: MOBILE_UA, platform: 'Linux armv8l' });
  }
  await pg.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const loaded = pg.once('Page.loadEventFired', 90000);
  await pg.send('Page.navigate', { url: base + url });
  await loaded;
  const ready = await pg.evaluate(READY, { timeout: 120000 });
  return { pg, ready };
}
const save = (name, obj) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 2)); };
async function shoot(pg, file) {
  const { data } = await pg.send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}
async function key(pg, k) {
  const map = { Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' } };
  const d = map[k];
  await pg.send('Input.dispatchKeyEvent', { type: d.text ? 'keyDown' : 'rawKeyDown', ...d });
  await pg.send('Input.dispatchKeyEvent', { type: 'keyUp', ...d, text: undefined });
}
async function clickSel(pg, sel) {
  const pt = await pg.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect(); return { x: r.left + Math.min(20, r.width / 2), y: r.top + r.height / 2, href: e.getAttribute('href') }; })()`);
  if (!pt) return null;
  await sleep(100);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await pg.send('Input.dispatchMouseEvent', { type, x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  await sleep(700);
  return pt.href;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(ROOT, PORT);
  const browser = await launch('chrome');
  const t0 = Date.now();
  console.log('browser', browser.version, 'profile', browser.profile);
  try {
    // ── 1) 폭 실측: 문서 3개 × 화면 4개 × A0·①②③ ──
    if (parts.includes('measure')) {
      const res = { browser: browser.version, date: new Date().toISOString(), data: {} };
      for (const id of DOCS) {
        res.data[id] = {};
        for (const vp of WIDTHS) {
          res.data[id][vp.w] = {};
          for (const v of variants(id)) {
            const { pg, ready } = await open(browser, srv.base, v.url, vp);
            const m = await pg.evaluate(MEASURE);
            m.ready = ready; m.errors = pg.logs.filter((l) => l.type !== 'warning' && !/favicon/.test(l.text));
            res.data[id][vp.w][v.key] = m;
            console.log(id, vp.w, v.key, `outer ${m.outerL}/${m.outerR} col ${m.col} para ${m.para.wMin} (${m.para.charsMedian}자) gapR ${m.para.rightGap} code ${m.code.areaMax} over ${m.code.over}/${m.code.n} mmd<0.8 ${m.mmd.below08}/${m.mmd.n} rail ${m.rail} hov ${m.pageHOverflow}`);
            await pg.close();
          }
        }
      }
      save('measure.json', res);
    }

    // ── 2) 링크 규칙(F10) + 건너뛰기 + 클릭 시 새 탭 여부 + 접근성 트리 ──
    if (parts.includes('links')) {
      const res = {};
      for (const L of ['1', '2', '3']) {
        const { pg } = await open(browser, srv.base, `spikes/doc-layout/doc.html?p=1-action-platformer&layout=${L}`, { w: 1920, h: 1080 });
        res[`L${L}`] = await pg.evaluate(`(() => {
          const here = new URL(location.href);
          const XL = 'http://www.w3.org/1999/xlink';
          const hrefOf = (a) => a.getAttribute('href') ?? a.getAttributeNS(XL, 'href') ?? '';
          const all = [...document.querySelectorAll('a')].filter((a) => a.hasAttribute('href') || a.hasAttributeNS(XL, 'href'));
          const where = (a) => a.closest('.skip-link') ? 'skip' : a.closest('.toc-dialog') ? 'toc-dialog' : a.closest('#toc') ? 'toc' : a.closest('.doc-head') ? 'head'
            : a.closest('.rail') ? 'rail' : a.closest('.doc-chip') ? 'chip' : a.closest('.glance') ? 'glance' : a.closest('.mermaid') ? 'mermaid' : a.closest('.md') ? 'md'
            : a.closest('.doc-fab') ? 'fab' : a.closest('.doc-foot') ? 'foot' : 'other';
          const cat = (a) => {
            const h = hrefOf(a);
            if (/^mailto:/i.test(h)) return 'mailto';
            const u = new URL(h, location.href);
            if (u.origin === here.origin && u.pathname === here.pathname && u.search === here.search) return 'same-doc';
            return u.origin !== here.origin ? 'external' : 'cross-doc';
          };
          const rows = all.map((a) => {
            const c = cat(a);
            const icon = a.querySelector('svg.pf-newtab-icon');
            const sr = [...a.querySelectorAll('*')].find((e) => e.textContent.trim() === '(새 탭)');
            const srR = sr ? sr.getBoundingClientRect() : null;
            const srHidden = !!sr && srR.width <= 1 && srR.height <= 1 && getComputedStyle(sr).display !== 'none';
            return { cat: c, where: where(a), href: hrefOf(a).slice(0, 90), target: a.getAttribute('target') || '', rel: a.getAttribute('rel') || '',
                     icon: !!icon && icon.getAttribute('aria-hidden') === 'true', sr: !!sr, srHidden };
          });
          const newTab = rows.filter((r) => r.cat === 'external' || r.cat === 'cross-doc');
          const sameTab = rows.filter((r) => r.cat === 'same-doc' || r.cat === 'mailto');
          const okNew = (r) => r.target === '_blank' && /\\bnoopener\\b/.test(r.rel) && r.icon && r.sr && r.srHidden;
          const count = (arr) => arr.reduce((m, r) => { const k = r.cat + '/' + r.where; m[k] = (m[k] || 0) + 1; return m; }, {});
          return { total: rows.length, byCatWhere: count(rows),
                   newTab: { n: newTab.length, ok: newTab.filter(okNew).length, bad: newTab.filter((r) => !okNew(r)) },
                   sameTab: { n: sameTab.length, ok: sameTab.filter((r) => !r.target || r.target === '_self').length, bad: sameTab.filter((r) => r.target && r.target !== '_self') },
                   newTabNote: [...document.querySelectorAll('.newtab-note')].filter((e) => e.offsetParent).map((e) => e.textContent.trim()),
                   mdHrefSamples: rows.filter((r) => r.where === 'md' && r.cat !== 'same-doc').map((r) => r.href + ' → ' + r.cat) };
        })()`);
        if (L === '2') {
          // 접근성 트리: 제목 수, 새 탭 링크 이름
          await pg.send('Accessibility.enable');
          const { nodes } = await pg.send('Accessibility.getFullAXTree');
          const heads = nodes.filter((n) => !n.ignored && n.role?.value === 'heading');
          const lvl = (n) => (n.properties || []).find((p) => p.name === 'level')?.value?.value;
          const links = nodes.filter((n) => !n.ignored && n.role?.value === 'link');
          res.ax = {
            headings: heads.length, byLevel: heads.reduce((m, n) => { const k = 'h' + lvl(n); m[k] = (m[k] || 0) + 1; return m; }, {}),
            firstHeadings: heads.slice(0, 4).map((n) => `h${lvl(n)} ${n.name?.value}`),
            links: links.length, linksNamedNewTab: links.filter((n) => /\(새 탭\)/.test(n.name?.value || '')).length,
            linkNameSamples: links.filter((n) => /\(새 탭\)/.test(n.name?.value || '')).slice(0, 6).map((n) => n.name.value),
          };
          res.domHeadings = await pg.evaluate(`(() => { const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
            const vis = hs.filter((h) => getComputedStyle(h).display !== 'none' && h.getClientRects().length);
            return { all: hs.length, visible: vis.length, hidden: hs.filter((h) => !vis.includes(h)).map((h) => h.tagName + ' ' + h.textContent.trim().slice(0, 60)),
                     byLevel: vis.reduce((m, h) => { m[h.tagName] = (m[h.tagName] || 0) + 1; return m; }, {}),
                     landmarks: { header: document.querySelectorAll('header').length, nav: [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label')),
                                  main: document.querySelectorAll('main').length, aside: [...document.querySelectorAll('aside')].map((n) => n.getAttribute('aria-label')) },
                     ariaCurrent: document.querySelectorAll('[aria-current="location"]').length }; })()`);
          await pg.close();

          // 동작: 새 페이지에서 Tab → 건너뛰기 링크, Enter → #main. 목차·칩·머리 버튼·md 파일 링크 클릭 시 새 탭이 생기는지
          const created = [];
          await browser.send('Target.setDiscoverTargets', { discover: true });
          const off = browser.on('Target.targetCreated', (p) => { if (p.targetInfo.type === 'page') created.push(p.targetInfo); });
          const { pg: q } = await open(browser, srv.base, `spikes/doc-layout/doc.html?p=1-action-platformer&layout=2`, { w: 1920, h: 1080 });
          await sleep(300);
          const base0 = created.length;
          await q.evaluate(`window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); 1`);
          await key(q, 'Tab');
          const afterTab = await q.evaluate(`(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { cls: a.className, text: a.textContent.trim(), top: Math.round(r.top), visible: r.top >= 0 && r.bottom <= innerHeight && r.width > 20 }; })()`);
          await key(q, 'Enter');
          await sleep(400);
          const afterEnter = await q.evaluate(`(() => ({ hash: location.hash, active: document.activeElement.id || document.activeElement.tagName, mainTop: Math.round(document.getElementById('main').getBoundingClientRect().top), scrollY: Math.round(scrollY) }))()`);
          await key(q, 'Tab');
          const nextFocus = await q.evaluate(`(() => { const a = document.activeElement; return { tag: a.tagName, cls: a.className, inMain: !!a.closest('main'), text: a.textContent.trim().slice(0, 40) }; })()`);
          res.skip = { afterTab, afterEnter, nextFocus, newTabs: created.length - base0 };
          const url0 = await q.evaluate('location.href');
          const clicks = [];
          for (const [label, sel] of [['목차 링크', '#toc-links a:nth-child(5)'], ['md 안 앵커', '.md a[href^="#"]'], ['맨 위로(레일)', '.rail .to-top'],
            ['절 머리 칩', '.doc-chip a'], ['머리 [요약 덱으로]', '.head-nav a.btn.primary'], ['md 안 상대 파일', '.md a[target="_blank"]:not([href^="http"])'], ['← 포트폴리오', '.crumb a']]) {
            const before = created.length;
            const href = await clickSel(q, sel);
            const now = await q.evaluate('location.href');
            clicks.push({ label, href, newTab: created.length - before, newUrl: created.slice(before).map((t) => t.url.replace(srv.base, '/')),
                          thisTabUrlChanged: now.split('#')[0] !== url0.split('#')[0], hash: decodeURIComponent(new URL(now).hash) });
          }
          res.clicks = clicks;
          off();
          for (const t of created) await browser.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
          await q.close();
        } else await pg.close();
        console.log('links', 'L' + L, JSON.stringify(res[`L${L}`].newTab.n), res[`L${L}`].newTab.ok, res[`L${L}`].sameTab.n, res[`L${L}`].sameTab.ok);
      }
      save('links.json', res);
    }

    // ── 3) 휴대폰 375×812 ──
    if (parts.includes('phone')) {
      const res = {};
      for (const id of DOCS) {
        for (const v of variants(id)) {
          const { pg, ready } = await open(browser, srv.base, v.url, { w: 375, h: 812, mobile: true });
          const m = await pg.evaluate(`(async () => {
            const de = document.documentElement, cw = de.clientWidth;
            const R = (e) => e.getBoundingClientRect();
            const shown = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0;
            const off = [];
            for (const el of document.body.querySelectorAll('*')) {
              if (!shown(el)) continue;
              const r = R(el); if (r.width === 0 || (r.right <= cw + 0.5 && r.left >= -0.5)) continue;
              let p = el.parentElement, clipped = false;
              while (p && p !== document.body) { if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break; } p = p.parentElement; }
              if (!clipped && !el.classList.contains('sr-only') && !el.closest('.sr-only')) off.push(el.tagName + '.' + el.className + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
            }
            const md = document.querySelector('.md');
            const pres = [...md.querySelectorAll('pre')].filter((p) => !p.closest('.mmd-src, .mermaid') && shown(p));
            const scroller = (p) => [p, p.querySelector('code')].find((e) => e && /auto|scroll/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 1);
            const overPres = pres.filter(scroller);
            let selfScroll = 0;
            for (const p of overPres) { const s = scroller(p); s.scrollLeft = 60; if (s.scrollLeft > 0 && scrollX === 0) selfScroll++; s.scrollLeft = 0; }
            const preInside = pres.filter((p) => { const r = R(p); return r.left >= -0.5 && r.right <= cw + 0.5; }).length;
            const imgs = [...md.querySelectorAll('img')].filter((i) => shown(i));
            const imgFit = imgs.filter((i) => { const r = R(i); const pr = R(i.parentElement); return r.left >= -0.5 && r.right <= cw + 0.5 && r.width <= pr.width + 0.5; }).length;
            const svgs = [...md.querySelectorAll('.mermaid svg')];
            const svgFit = svgs.filter((s) => { const r = R(s); return r.left >= -0.5 && r.right <= cw + 0.5; }).length;
            const scales = svgs.map((s) => R(s).width / (s.viewBox.baseVal.width || R(s).width));
            const tables = [...md.querySelectorAll('table')];
            const tWrapInside = tables.filter((t) => { const w = t.parentElement.classList.contains('table-wrap') ? t.parentElement : t; const r = R(w); return r.left >= -0.5 && r.right <= cw + 0.5; }).length;
            const toc = document.querySelector('#toc');
            const tocState = document.querySelector('.doc-page') ? { tocDisplay: getComputedStyle(toc).display, fab: getComputedStyle(document.querySelector('.doc-fab')).display,
                 dialogOpen: document.querySelector('.toc-dialog').open, glanceOpen: document.getElementById('glance').open, headNav: getComputedStyle(document.querySelector('.head-nav')).display }
              : { tocDetailsOpen: toc.open, tocHeight: Math.round(R(toc).height) };
            const p = [...md.querySelectorAll(':scope > p')].find((x) => x.textContent.length > 160 && !x.querySelector('img'));
            return { cw, vw: innerWidth, pageHOverflow: de.scrollWidth - cw, bodyHOverflow: document.body.scrollWidth - cw, offenders: off.slice(0, 12), offendersN: off.length,
                     pre: { n: pres.length, inside: preInside, overflow: overPres.length, selfScroll },
                     img: { n: imgs.length, fit: imgFit }, mmd: { n: svgs.length, fit: svgFit, minScale: +(Math.min(1, ...scales)).toFixed(2), below08: scales.filter((x) => x < 0.8).length },
                     table: { n: tables.length, inside: tWrapInside }, toc: tocState,
                     para: p ? { w: Math.round(R(p).width), left: Math.round(R(p).left), fontSize: getComputedStyle(p).fontSize } : null };
          })()`);
          m.ready = ready;
          res[`${id}/${v.key}`] = m;
          if (id === '1-action-platformer') await shoot(pg, path.join(OUT, 'shots', '375', `${v.key}-top.png`));
          console.log('phone', id, v.key, `hov ${m.pageHOverflow} off ${m.offendersN} pre ${m.pre.inside}/${m.pre.n} scroll ${m.pre.selfScroll}/${m.pre.overflow} img ${m.img.fit}/${m.img.n} mmd ${m.mmd.fit}/${m.mmd.n} toc ${JSON.stringify(m.toc)}`);
          await pg.close();
        }
      }
      save('phone.json', res);
    }

    // ── 4) Ctrl+F 대용: 원문 블록 글자가 화면에 보이는 글자(innerText)에 모두 있는가 + 숨은 내용 목록 + window.find 표본 ──
    if (parts.includes('find')) {
      const res = {};
      for (const v of variants('1-action-platformer')) {
        const { pg } = await open(browser, srv.base, v.url, { w: 1920, h: 1080 });
        res[v.key] = await pg.evaluate(`(async () => {
          const mdUrl = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\\.md(\\?|$)/.test(n));
          const src = await (await fetch(mdUrl)).text();
          const tpl = document.createElement('template'); tpl.innerHTML = marked.parse(src, { gfm: true }); const ref = tpl.content;   // template: 이미지를 불러오지 않음
          const squash = (s) => s.replace(/\\s+/g, '');
          const md = document.querySelector('.md');
          const vis = squash(md.innerText).split('(새탭)').join('');
          const blocks = [...ref.children];
          let total = 0, found = 0; const missing = []; let mmdBlocks = 0;
          for (const b of blocks) {
            if (b.matches('pre') && b.querySelector('code.language-mermaid')) { mmdBlocks++; continue; }
            const t = squash(b.textContent); if (!t) continue;
            total++;
            if (vis.includes(t)) { found++; continue; }
            missing.push({ tag: b.tagName, text: b.textContent.trim().slice(0, 80) });
          }
          // Mermaid: 도식 안 글자(라벨)가 innerText에 있는가, 원문(<details>)이 보이는가
          const svgNodes = [];
          md.querySelectorAll('.mermaid svg').forEach((s) => { const tw = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { if (!n.parentElement.closest('style') && n.data.trim()) svgNodes.push(squash(n.data)); } });
          const svgText = svgNodes; const svgInInner = svgNodes.filter((t) => vis.includes(t)).length;
          // 화면에서 렌더되지 않는 것
          const hidden = [];
          for (const el of md.querySelectorAll('*')) {
            const cs = getComputedStyle(el);
            const why = cs.display === 'none' ? 'display:none' : cs.visibility === 'hidden' ? 'visibility:hidden' : el.hidden ? 'hidden' : el.inert ? 'inert'
              : (cs.contentVisibility && cs.contentVisibility !== 'visible') ? 'content-visibility:' + cs.contentVisibility : null;
            if (why && !el.parentElement.closest('[style*="display: none"]')) {
              if (el.closest('svg') && why === 'display:none') continue;
              hidden.push(why + ' ' + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ' "' + el.textContent.trim().slice(0, 40) + '"');
            }
          }
          const closedDetails = [...md.querySelectorAll('details:not([open])')].length;
          const agg = hidden.reduce((m, h) => { const k = h.split(' "')[0]; m[k] = (m[k] || 0) + 1; return m; }, {});
          // window.find 표본(찾기 동작 대용)
          const samples = [];
          const pick = (label, text) => text && samples.push({ label, text: text.slice(0, 24) });
          pick('문단', [...md.querySelectorAll(':scope > p')].find((p) => p.textContent.length > 200)?.textContent.trim().slice(30));
          pick('코드 줄', [...md.querySelectorAll('pre code')].find((c) => !c.closest('.mmd-src'))?.textContent.split('\\n').find((l) => l.trim().length > 30)?.trim());
          pick('표 칸', [...md.querySelectorAll('td')].find((td) => td.textContent.trim().length > 20)?.textContent.trim());
          { const tw = document.createTreeWalker(md.querySelector('.mermaid svg'), NodeFilter.SHOW_TEXT); let n, t = null; while ((n = tw.nextNode())) { if (!n.parentElement.closest('style') && n.data.trim().length > 5) { t = n.data.trim(); break; } } pick('도식 라벨', t); }
          pick('도식 원문(닫힌 details)', md.querySelector('.mmd-src code')?.textContent.split('\\n').find((l) => /-->/.test(l))?.trim());
          pick('숨긴 첫 H1', md.querySelector(':scope > h1')?.textContent.trim());
          for (const s of samples) { getSelection().removeAllRanges(); window.scrollTo(0, 0); s.found = window.find(s.text, false, false, true, false, false, false); s.openDetailsAfter = md.querySelectorAll('details[open]').length; }
          getSelection().removeAllRanges();
          return { blocksTotal: total, blocksVisible: found, missing: missing.slice(0, 10), mermaidBlocks: mmdBlocks, svgLabelsInInnerText: svgInInner + '/' + svgText.length,
                   closedDetails, hiddenAgg: agg, hiddenSamples: hidden.slice(0, 8), findSamples: samples };
        })()`, { timeout: 60000 });
        console.log('find', v.key, JSON.stringify({ t: res[v.key].blocksTotal, v: res[v.key].blocksVisible, h: res[v.key].hiddenAgg, f: res[v.key].findSamples.map((s) => s.found) }));
        await pg.close();
      }
      save('find.json', res);
    }

    // ── 5) A4 인쇄 PDF (①②③) + 쪼개짐 판정을 위한 DOM 정보 ──
    if (parts.includes('print')) {
      for (const L of ['1', '2', '3']) {
        const { pg } = await open(browser, srv.base, `spikes/doc-layout/doc.html?p=1-action-platformer&layout=${L}`, { w: 1920, h: 1080 });
        await pg.evaluate(`(async () => { for (const i of document.images) { if (i.decode) await i.decode().catch(() => 0); } return 1; })()`, { timeout: 90000 });
        const info = await pg.evaluate(`(() => {
          const md = document.querySelector('.md');
          const code = [...md.querySelectorAll('pre')].filter((p) => !p.closest('.mmd-src')).map((p) => p.textContent);
          const tables = [...md.querySelectorAll('table')].map((t) => t.textContent);
          const mermaid = [...md.querySelectorAll('.mermaid svg')].map((s) => [...s.querySelectorAll('foreignObject, text')].filter((e) => !e.closest('foreignObject') || e.tagName === 'foreignObject').map((e) => e.textContent.trim()).filter(Boolean));
          const imgs = [...md.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src'), nat: [i.naturalWidth, i.naturalHeight] }));
          return { code, tables, mermaid, imgs };
        })()`);
        save(`print-L${L}-dom.json`, info);
        const { data } = await pg.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
        fs.writeFileSync(path.join(OUT, `print-L${L}.pdf`), Buffer.from(data, 'base64'));
        console.log('print', 'L' + L, Buffer.from(data, 'base64').length);
        await pg.close();
      }
    }

    // ── 5b) 추가: 넓은 블록 비율(문단 옆이 비는 세로 길이), 블록 오른쪽 끝 분포, 목차 현재 위치, 휴대폰 그림 넘침 상세, 인쇄 회귀(.fade-r) ──
    if (parts.includes('extra')) {
      const res = { wide: {}, phoneImg: {}, ariaCurrent: null };
      for (const vp of [{ w: 1920, h: 1080 }, { w: 2560, h: 1440 }]) {
        for (const L of ['1', '2', '3']) {
          const { pg } = await open(browser, srv.base, `spikes/doc-layout/doc.html?p=1-action-platformer&layout=${L}`, vp);
          res.wide[`${vp.w}/L${L}`] = await pg.evaluate(`(() => {
            const md = document.querySelector('.md'), mr = md.getBoundingClientRect();
            const kids = [...md.children].filter((e) => getComputedStyle(e).display !== 'none' && e.getClientRects().length);
            const measure = Math.max(...[...md.querySelectorAll(':scope > p')].filter((p) => !p.classList.contains('pf-figure') && !p.classList.contains('doc-chip')).map((p) => p.getBoundingClientRect().width));
            const para = [...md.querySelectorAll(':scope > p')].find((p) => !p.classList.contains('pf-figure') && !p.classList.contains('doc-chip') && p.textContent.length > 160).getBoundingClientRect();
            let wideH = 0, total = 0, fullH = 0, wSum = 0;
            const blocks = [];
            for (const k of kids) {
              const r = k.getBoundingClientRect(); total += r.height;
              const wider = r.right > para.right + 1 || r.left < para.left - 1;
              if (wider) wideH += r.height;
              if (r.width >= mr.width * 0.9) fullH += r.height;
              wSum += r.height * r.width;
              if (k.matches('pre, .table-wrap, .mmd, .pf-figure')) blocks.push({ k: k.matches('pre') ? 'code' : k.matches('.table-wrap') ? 'table' : k.matches('.mmd') ? 'diagram' : 'figure', w: Math.round(r.width), l: Math.round(r.left - mr.left), r: Math.round(r.right - mr.left) });
            }
            const q = (a) => { const s = a.map((b) => b.w).sort((x, y) => x - y); return s.length ? [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]] : null; };
            const by = (k) => blocks.filter((b) => b.k === k);
            return { col: Math.round(mr.width), measure: Math.round(measure), paraLeft: Math.round(para.left - mr.left), wideShare: +(wideH / total).toFixed(2), docHeight: Math.round(total),
                     fullShare: +(fullH / total).toFixed(2), meanWidth: Math.round(wSum / total), meanEmpty: Math.round(mr.width - wSum / total),
                     widths: { code: q(by('code')), table: q(by('table')), diagram: q(by('diagram')), figure: q(by('figure')) },
                     distinctRightEdges: new Set(blocks.map((b) => Math.round(b.r / 20))).size, blocks: blocks.length,
                     leftEdges: [...new Set(blocks.map((b) => b.l))].slice(0, 12) };
          })()`);
          if (vp.w === 1920 && L === '2') {
            res.ariaCurrent = await pg.evaluate(`(async () => {
              const h = [...document.querySelectorAll('.md h3')][10]; window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 30);
              await new Promise((r) => setTimeout(r, 300)); window.dispatchEvent(new Event('scroll')); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 100)));
              const a = document.querySelector('#toc-links [aria-current="location"]');
              return { heading: h.textContent.trim(), current: a ? a.textContent.trim() : null, rail: document.querySelector('#rail-now .now-title').textContent };
            })()`);
          }
          await pg.close();
        }
      }
      for (const v of variants('2-Yggdrasil')) {
        const { pg } = await open(browser, srv.base, v.url, { w: 375, h: 812, mobile: true });
        res.phoneImg[v.key] = await pg.evaluate(`(() => { const cw = document.documentElement.clientWidth; return [...document.querySelectorAll('.md img')].filter((i) => i.getClientRects().length).map((i) => {
          const r = i.getBoundingClientRect(), p = i.parentElement.getBoundingClientRect();
          return { src: i.getAttribute('src').split('/').pop(), w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), parentTag: i.parentElement.tagName, parentW: Math.round(p.width),
                   inTable: !!i.closest('table'), scroller: !!i.closest('.table-wrap') || (i.closest('table') && getComputedStyle(i.closest('table')).overflowX !== 'visible') }; }).filter((x) => x.right > cw + 0.5 || x.left < -0.5 || x.w > x.parentW + 0.5); })()`);
        await pg.close();
      }
      save('extra.json', res);
      // 인쇄 회귀: 화면에서 가로 넘침(.fade-r)이 있는 상태로 인쇄 → 코드가 그림으로 바뀌지 않아야 함
      for (const [name, url, vp] of [['regress-L1-1920', 'spikes/doc-layout/doc.html?p=1-action-platformer&layout=1', { w: 1920, h: 1080 }],
                                     ['regress-tidy-L2-1366', 'spikes/doc-layout/doc.html?p=0-Tidy-Mommy&layout=2', { w: 1366, h: 768 }]]) {
        const { pg } = await open(browser, srv.base, url, vp);
        const fades = await pg.evaluate(`document.querySelectorAll('.md pre.fade-r').length`);
        const { data } = await pg.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
        fs.writeFileSync(path.join(OUT, `print-${name}.pdf`), Buffer.from(data, 'base64'));
        console.log('regress', name, 'fade-r on screen', fades);
        await pg.close();
      }
      console.log('extra', JSON.stringify(res.wide), JSON.stringify(res.ariaCurrent), JSON.stringify(res.phoneImg));
    }

    // ── 6) 1880(스크린샷 폭) 캡처 ──
    if (parts.includes('shots')) {
      const POS = [['a', null], ['b', '3.4 핵심 동작: 축 분리 충돌 해결'], ['c', '2.1 아키텍처 개관'], ['e', '4.7 고민과 선택 ⑥ 패링을 구현하지 않은 이유']];
      for (const vp of [{ w: 1880, h: 1000 }]) {
        for (const v of variants('1-action-platformer')) {
          const { pg } = await open(browser, srv.base, v.url, vp);
          for (const [k, h] of POS) {
            await pg.evaluate(SCROLL_TO(h, v.key === 'A0' ? 76 : 24));
            await sleep(500);
            await shoot(pg, path.join(OUT, 'shots', String(vp.w), `${v.key}-${k}.png`));
          }
          await pg.close();
        }
      }
    }
  } finally {
    await browser.close();
    await srv.close();
  }
  console.log('done', Math.round((Date.now() - t0) / 1000) + 's', 'profile removed:', !fs.existsSync(browser.profile), '404:', srv.stats.notFound.slice(0, 8));
})().catch((e) => { console.error(e); process.exit(1); });
