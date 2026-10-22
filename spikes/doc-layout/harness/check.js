// check.js — 시안의 동작 점검(딥링크 #sec=, [좁게 읽기], 목차 서랍, 라이트박스, 건너뛰기 링크, md 안 링크 분류). 결과는 out/check.json
// 사용: node spikes/doc-layout/harness/check.js
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out');
const ID = '1-action-platformer';
const DOC = `spikes/doc-layout/doc.html?p=${ID}`;

async function open(browser, base, url, vp) {
  const pg = await browser.newPage();
  await pg.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: !!vp.mobile });
  if (vp.mobile) await pg.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const loaded = pg.once('Page.loadEventFired', 90000);
  await pg.send('Page.navigate', { url: base + url });
  await loaded;
  await pg.evaluate(`(async () => { const t = Date.now(); while (document.documentElement.dataset.docReady !== '1' && Date.now() - t < 60000) await new Promise((r) => setTimeout(r, 100)); return 1; })()`);
  await sleep(300);
  return pg;
}

(async () => {
  const srv = await serve(ROOT, 4651);
  const browser = await launch('chrome');
  const r = {};
  try {
    // 1) #sec=<절 제목> → 정규 앵커로 바뀌고 그 제목이 화면 위쪽에
    let pg = await open(browser, srv.base, `${DOC}&layout=2#sec=${encodeURIComponent('4.3 핵심 동작')}`, { w: 1920, h: 1080 });
    r.secDeepLink = await pg.evaluate(`(() => { const h = document.getElementById(decodeURIComponent(location.hash.slice(1))); return { hash: decodeURIComponent(location.hash), headingTop: h ? Math.round(h.getBoundingClientRect().top) : null, text: h?.textContent, tocActive: document.querySelector('#toc-links a.active')?.textContent, rail: document.querySelector('#rail-now .now-body')?.textContent.trim().slice(0, 80) }; })()`);
    // 2) md 안 링크 분류 + 머리 링크
    r.links = await pg.evaluate(`(() => {
      const md = [...document.querySelectorAll('.md a[href]')];
      const anchors = md.filter((a) => a.getAttribute('href').startsWith('#'));
      const ext = md.filter((a) => /^https?:/.test(a.getAttribute('href')));
      return { mdAnchors: anchors.length, mdAnchorsWithTarget: anchors.filter((a) => a.target).length,
               mdExternal: ext.length, mdExternalOk: ext.filter((a) => a.target === '_blank' && /noopener/.test(a.rel) && a.querySelector('.pf-newtab-icon') && a.querySelector('.pf-newtab-sr')).length,
               chips: document.querySelectorAll('.doc-chip a').length, chipHrefs: [...document.querySelectorAll('.doc-chip a')].map((a) => a.getAttribute('href').replace(/^.*#/, '#')),
               tocStars: document.querySelectorAll('#toc-links .star').length,
               skip: { href: document.querySelector('.skip-link').getAttribute('href'), target: document.querySelector('.skip-link').target },
               headLinks: [...document.querySelectorAll('.head-nav a, .crumb a')].map((a) => ({ t: a.textContent.trim(), href: a.getAttribute('href'), target: a.target })),
               printOnlyVisible: [...document.querySelectorAll('.print-only')].filter((e) => getComputedStyle(e).display !== 'none').length,
               landmarks: { header: !!document.querySelector('header'), navToc: !!document.querySelector('nav[aria-label="문서 목차"]'), main: !!document.querySelector('main#main'), aside: !!document.querySelector('aside[aria-label="요약 덱 연결"]') },
               codeRegions: document.querySelectorAll('.md pre[role="region"][tabindex="0"]').length,
               mermaidImg: document.querySelectorAll('.mermaid svg[role="img"][aria-label]').length,
               tableRegions: document.querySelectorAll('.table-wrap[role="region"]').length,
               figures: document.querySelectorAll('.md .pf-figure').length };
    })()`);
    // 3) 라이트박스(그림, 다이어그램)
    r.lightbox = await pg.evaluate(`(async () => {
      const img = document.querySelector('.md .pf-figure img'); img.click(); await new Promise((r) => setTimeout(r, 100));
      const d = document.querySelector('dialog.lightbox'); const a = d.open && !!d.querySelector('.lb-stage img'); d.close();
      document.querySelector('.mmd-zoom').click(); await new Promise((r) => setTimeout(r, 100));
      const b = d.open && !!d.querySelector('.lb-stage svg'); d.close();
      return { image: a, diagram: b };
    })()`);
    await pg.close();
    // 4) ③ [좁게 읽기]
    pg = await open(browser, srv.base, `${DOC}&layout=3`, { w: 1920, h: 1080 });
    r.narrow = await pg.evaluate(`(async () => {
      const p = () => Math.round([...document.querySelectorAll('.md > p')].find((x) => x.textContent.length > 120).getBoundingClientRect().width);
      const before = p(); document.querySelector('.narrow-btn').click(); await new Promise((r) => setTimeout(r, 50));
      const after = p(); const pressed = document.querySelector('.narrow-btn').getAttribute('aria-pressed');
      document.querySelector('.narrow-btn').click(); try { localStorage.removeItem('pf-doc-narrow'); } catch {}
      return { before, after, pressed };
    })()`);
    await pg.close();
    // 5) 휴대폰: 한눈에 접힘, 목차 서랍, 가로 넘침 0
    pg = await open(browser, srv.base, `${DOC}&layout=2`, { w: 375, h: 812, mobile: true });
    r.phone = await pg.evaluate(`(async () => {
      const res = { glanceOpen: document.getElementById('glance').open, tocHidden: getComputedStyle(document.querySelector('.toc')).display === 'none',
                    fab: getComputedStyle(document.querySelector('.doc-fab')).display, hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      document.querySelector('.fab-toc').click(); await new Promise((r) => setTimeout(r, 100));
      const d = document.querySelector('.toc-dialog'); res.dialogOpen = d.open; res.dialogLinks = d.querySelectorAll('a').length;
      d.querySelector('a[href="#3-이동-컨트롤러"]').click(); await new Promise((r) => setTimeout(r, 400));
      res.dialogClosedAfterPick = !d.open; res.hashAfterPick = decodeURIComponent(location.hash);
      return res;
    })()`);
    r.logs = pg.logs;
    await pg.close();
  } finally {
    await browser.close();
    await srv.close();
  }
  fs.writeFileSync(path.join(OUT, 'check.json'), JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
