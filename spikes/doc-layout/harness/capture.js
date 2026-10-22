// capture.js — A0(지금 렌더러)와 시안 ①②③을 4개 화면 × 5개 위치로 캡처하고, 폭·넘침을 재고, ②를 A4 PDF로 인쇄합니다.
// 사용(레포 루트 아무 곳에서나, PowerShell 권장): node spikes/doc-layout/harness/capture.js [--only=1920x1080] [--no-pdf]
// 서버: 127.0.0.1:4651(레포 루트, 읽기 전용) · 브라우저: 헤드리스 Chrome(CDP 파이프, 프로필은 %TEMP%\doclayout-chrome-*, 끝나면 지움)
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out');
const PORT = 4651;
const ID = '1-action-platformer';
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const noPdf = args.includes('--no-pdf');

const VIEWPORTS = [
  { key: '1366x768', w: 1366, h: 768 },
  { key: '1920x1080', w: 1920, h: 1080 },
  { key: '2560x1440', w: 2560, h: 1440 },
  { key: '375x812', w: 375, h: 812, mobile: true },
].filter((v) => !only || only.split(',').includes(v.key));
const VARIANTS = [
  { key: 'A0', url: `project.html?p=${ID}`, offset: 76 },                      // 지금 배포 렌더러(상단 막대 60 + scroll-padding 76)
  { key: 'L1', url: `spikes/doc-layout/doc.html?p=${ID}&layout=1`, offset: 24 },
  { key: 'L2', url: `spikes/doc-layout/doc.html?p=${ID}&layout=2`, offset: 24 },
  { key: 'L3', url: `spikes/doc-layout/doc.html?p=${ID}&layout=3`, offset: 24 },
];
const POSITIONS = [
  { key: 'a', label: '문서 맨 위', heading: null },
  { key: 'b', label: '코드', heading: '3.4 핵심 동작: 축 분리 충돌 해결' },
  { key: 'c', label: '도식(Mermaid)', heading: '2.1 아키텍처 개관' },
  { key: 'd', label: '표', heading: '8.2 아쉬운 점과 개선 계획' },
  { key: 'e', label: '문단만', heading: '4.7 고민과 선택 ⑥ 패링을 구현하지 않은 이유' },
];
const EXTRA = [   // ③ [좁게 읽기] 켠 상태(참고용)
  { vp: '1920x1080', key: 'L3n', url: `spikes/doc-layout/doc.html?p=${ID}&layout=3&narrow=1`, offset: 24, pos: ['a', 'b'] },
  { vp: '2560x1440', key: 'L3n', url: `spikes/doc-layout/doc.html?p=${ID}&layout=3&narrow=1`, offset: 24, pos: ['a', 'b'] },
];
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';

// ── 페이지 안에서 실행하는 식 ──
const WAIT_READY = `(async () => {
  const t0 = Date.now();
  const ok = () => {
    const md = document.querySelector('.md');
    if (!md || md.querySelector('.loading')) return false;
    if (![...document.querySelectorAll('.mermaid')].every((m) => m.querySelector('svg'))) return false;
    if (document.querySelector('.doc-page') && document.documentElement.dataset.docReady !== '1') return false;
    return document.querySelectorAll('#toc-links a').length > 0;
  };
  while (!ok() && Date.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 200));
  await document.fonts.ready;
  await Promise.all([...document.querySelectorAll('.md img')].map((i) => i.complete ? 0 : new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 30000); })));
  return { ready: ok(), ms: Date.now() - t0, fonts: document.fonts.check('16px Pretendard') };
})()`;

const MEASURE = `(() => {
  const cw = document.documentElement.clientWidth, vw = innerWidth;
  const md = document.querySelector('.md');
  const isDoc = !!document.querySelector('.doc-page');
  const shown = (el) => el && getComputedStyle(el).display !== 'none';
  const mr = md.getBoundingClientRect();
  let left, right, colW, toc = null, rail = null;
  if (isDoc) {
    const t = document.querySelector('.toc'), r = document.querySelector('.rail');
    toc = shown(t) ? Math.round(t.getBoundingClientRect().width) : 0;
    rail = shown(r) ? Math.round(r.getBoundingClientRect().width) : 0;
    left = shown(t) ? t.getBoundingClientRect().left : mr.left;
    right = cw - (shown(r) ? r.getBoundingClientRect().right : mr.right);
    colW = mr.width;
  } else {
    const lay = document.querySelector('.doc-layout').getBoundingClientRect();
    left = lay.left; right = cw - lay.right;
    const cs = getComputedStyle(md);
    colW = md.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const t = document.querySelector('.toc'); toc = Math.round(t.getBoundingClientRect().width);
  }
  const para = [...md.querySelectorAll(':scope > p')].find((p) => !p.classList.contains('pf-figure') && !p.classList.contains('doc-chip') && p.textContent.trim().length > 120);
  const pr = para ? para.getBoundingClientRect() : null;
  const pres = [...md.querySelectorAll('pre')].filter((p) => !p.closest('.mmd-src') && p.offsetParent);
  const preScroll = pres.filter((p) => {                       // A0는 hljs CSS 때문에 <code>가 스크롤 상자, 시안은 <pre>
    const c = p.querySelector('code');
    return p.scrollWidth > p.clientWidth + 1 || (c && getComputedStyle(c).overflowX !== 'visible' && c.scrollWidth > c.clientWidth + 1);
  }).length;
  const codeMax = Math.max(0, ...pres.map((p) => p.getBoundingClientRect().width));
  const svgs = [...md.querySelectorAll('.mermaid svg')];
  const scales = svgs.map((s) => { const nat = s.viewBox?.baseVal?.width || parseFloat(s.dataset.naturalWidth) || 0; return nat ? s.getBoundingClientRect().width / nat : 1; });
  const tables = [...md.querySelectorAll('table')];
  const tScroll = tables.filter((t) => { const w = t.parentElement.classList.contains('table-wrap') ? t.parentElement : t; return w.scrollWidth > w.clientWidth + 1; }).length;
  const imgs = [...md.querySelectorAll('img')].filter((i) => i.naturalWidth && i.offsetParent);
  const imgSmall = imgs.filter((i) => i.getBoundingClientRect().width < i.naturalWidth * 0.99).length;
  // 링크 규칙 검사(F10): 같은 문서 안 앵커에 target 없음, 바깥·문서 사이에는 _blank + noopener + ↗, mailto에는 target 없음
  const all = [...document.querySelectorAll('a[href]')].filter((a) => !a.closest('dialog.toc-dialog'));
  const bad = [];
  for (const a of all) {
    const h = a.getAttribute('href');
    const blank = a.target === '_blank';
    if (h.startsWith('#') || h.startsWith('mailto:')) { if (blank) bad.push('same-tab:' + h); continue; }
    if (!blank || !/noopener/.test(a.rel)) bad.push('newtab:' + h.slice(0, 60));
    else if (isDoc && !a.querySelector('.pf-newtab-icon')) bad.push('icon:' + h.slice(0, 60));
  }
  return {
    vw, cw, outerLeft: Math.round(left), outerRight: Math.round(right), toc, rail, col: Math.round(colW),
    para: pr ? Math.round(pr.width) : null, paraLeftInCol: pr ? Math.round(pr.left - mr.left) : null, paraRightGap: pr ? Math.round(mr.right - pr.right) : null,
    codeMax: Math.round(codeMax), preScroll: preScroll + '/' + pres.length,
    mmdScaled: scales.filter((x) => x < 0.99).length + '/' + svgs.length, mmdMinScale: +(Math.min(1, ...scales)).toFixed(2),
    tableScroll: tScroll + '/' + tables.length, imgShrunk: imgSmall + '/' + imgs.length,
    pageHScroll: document.documentElement.scrollWidth > cw ? document.documentElement.scrollWidth - cw : 0,
    links: all.length, linkRuleViolations: bad.slice(0, 20), linkRuleViolationCount: bad.length,
  };
})()`;

const scrollTo = (heading, offset, isA0) => `(() => {
  const norm = (t) => PF.normTitle(t);
  let el = null, y = 0;
  if (${JSON.stringify(heading)}) {
    el = [...document.querySelectorAll('.md h2, .md h3')].find((h) => norm(h.textContent) === norm(${JSON.stringify(heading)}));
    if (!el) return { error: 'heading not found' };
    y = el.getBoundingClientRect().top + scrollY - ${offset};
  } else if (${isA0}) {
    el = document.getElementById('pf-doc'); y = el.getBoundingClientRect().top + scrollY - ${offset};
  }
  window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
  return { want: Math.round(y), got: Math.round(scrollY), top: el ? Math.round(el.getBoundingClientRect().top) : 0, max: document.documentElement.scrollHeight - innerHeight };
})()`;

const SETTLE = `(async () => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 350));
  const vis = [...document.images].filter((i) => { const b = i.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.top < innerHeight; });
  await Promise.all(vis.map((i) => i.complete ? 0 : new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 30000); })));
  await Promise.all(vis.map((i) => i.decode ? i.decode().catch(() => 0) : 0));
  await new Promise((r) => setTimeout(r, 150));
  return vis.length;
})()`;

async function openPage(browser, base, vp, url) {
  const pg = await browser.newPage();
  await pg.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: !!vp.mobile });
  if (vp.mobile) {
    await pg.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await pg.send('Emulation.setUserAgentOverride', { userAgent: MOBILE_UA, platform: 'Linux armv8l' });
  }
  await pg.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });   // 부드러운 스크롤·도착 강조 끄기(캡처 결정성)
  const loaded = pg.once('Page.loadEventFired', 90000);
  await pg.send('Page.navigate', { url: base + url });
  await loaded;
  const ready = await pg.evaluate(WAIT_READY, { timeout: 120000 });
  return { pg, ready };
}

async function shoot(pg, file) {
  const { data } = await pg.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const srv = await serve(ROOT, PORT);
  const browser = await launch('chrome');
  const result = { browser: browser.version, date: new Date().toISOString(), id: ID, positions: POSITIONS, viewports: {}, extra: {}, logs: {} };
  const t0 = Date.now();
  try {
    for (const vp of VIEWPORTS) {
      result.viewports[vp.key] = {};
      for (const v of VARIANTS) {
        const { pg, ready } = await openPage(browser, srv.base, vp, v.url);
        const m = await pg.evaluate(MEASURE);
        const pos = {};
        for (const p of POSITIONS) {
          pos[p.key] = await pg.evaluate(scrollTo(p.heading, v.offset, v.key === 'A0'));
          await pg.evaluate(SETTLE, { timeout: 90000 });
          await shoot(pg, path.join(OUT, 'shots', vp.key, `${v.key}-${p.key}.png`));
        }
        result.viewports[vp.key][v.key] = { ready, measure: m, scroll: pos };
        result.logs[`${vp.key}/${v.key}`] = pg.logs.filter((l) => !/favicon/.test(l.text));
        console.log(vp.key, v.key, JSON.stringify(ready), `col=${m.col} outer=${m.outerLeft}/${m.outerRight} para=${m.para} code=${m.codeMax} pre=${m.preScroll} mmd=${m.mmdScaled}(min ${m.mmdMinScale}) tbl=${m.tableScroll} img=${m.imgShrunk} hscroll=${m.pageHScroll} linkbad=${m.linkRuleViolationCount}`);
        await pg.close();
      }
    }
    for (const x of EXTRA.filter((e) => !only || only.split(',').includes(e.vp))) {
      const vp = VIEWPORTS.find((v) => v.key === x.vp) || { key: x.vp, w: +x.vp.split('x')[0], h: +x.vp.split('x')[1] };
      const { pg } = await openPage(browser, srv.base, vp, x.url);
      const m = await pg.evaluate(MEASURE);
      for (const pk of x.pos) {
        const p = POSITIONS.find((q) => q.key === pk);
        await pg.evaluate(scrollTo(p.heading, x.offset, false));
        await pg.evaluate(SETTLE, { timeout: 90000 });
        await shoot(pg, path.join(OUT, 'shots', 'extra', `${x.vp}-${x.key}-${pk}.png`));
      }
      result.extra[`${x.vp}/${x.key}`] = m;
      await pg.close();
    }
    if (!noPdf) {
      const vp = { w: 1920, h: 1080 };
      const { pg } = await openPage(browser, srv.base, vp, `spikes/doc-layout/doc.html?p=${ID}&layout=2`);
      await pg.evaluate(`(async () => { for (const i of document.images) { if (i.decode) await i.decode().catch(() => 0); } return 1; })()`, { timeout: 90000 });
      const { data } = await pg.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
      fs.writeFileSync(path.join(OUT, 'print-layout2.pdf'), Buffer.from(data, 'base64'));
      result.pdf = { file: 'out/print-layout2.pdf', bytes: Buffer.from(data, 'base64').length };
      result.logs['pdf'] = pg.logs;
      await pg.close();
    }
  } finally {
    await browser.close();
    await srv.close();
  }
  result.seconds = Math.round((Date.now() - t0) / 1000);
  const mf = path.join(OUT, only ? `measure-${only}.json` : 'measure.json');
  fs.writeFileSync(mf, JSON.stringify(result, null, 2));
  console.log('done', result.seconds + 's', mf, 'server 404:', srv.stats.notFound.slice(0, 10));
})().catch((e) => { console.error(e); process.exit(1); });
