#!/usr/bin/env node
// a2-tab.js — A2 보조: Tab 이동(§7-4 "focusin에서 포커스가 간 장면이 화면에 통째로 보이게")이 배율 k에서도 맞는지
//   변형(pages / pages-wrapper / pages-navfix) × 뷰포트 × 페이지에서 Tab을 30번 눌러, 매번 포커스된 요소와 그 장면이 화면 안에 있는지 잼
// 실행(PowerShell): node spikes/r0/harness/a2-tab.js [--browser chrome] [--port 4622]
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out/a2');
const VPS = [{ id: 'k0.29', w: 375, h: 812, mobile: true }, { id: 'k0.75', w: 975, h: 1000 }, { id: 'k1.0', w: 1366, h: 752 }, { id: 'k1.268', w: 1920, h: 945 }];
const VARIANTS = ['spikes/r0/pages', 'spikes/r0/pages-wrapper', 'spikes/r0/pages-navfix'];
const PAGES = [{ id: 'index', q: 'index.html' }, { id: '0-Tidy-Mommy', q: 'project.html?p=0-Tidy-Mommy' }];
const STATE = `(() => { const a = document.activeElement, vh = innerHeight, vw = document.documentElement.clientWidth;
  const s = a && a.closest ? a.closest('.pf-scene') : null; const r = a ? a.getBoundingClientRect() : null; const sr = s ? s.getBoundingClientRect() : null;
  return { tag: a ? a.tagName.toLowerCase() + (a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : '') : null, inScene: !!s,
    elIn: !!r && r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1, sceneIn: !sr || (sr.top >= -1 && sr.bottom <= vh + 1), sceneTop: sr ? Math.round(sr.top * 10) / 10 : null }; })()`;
(async () => {
  const server = await serve(ROOT, +arg('port', 4622));
  const c = await launch(arg('browser', 'chrome'));
  const res = [];
  try {
    const page = await c.newPage();
    for (const v of VARIANTS) for (const vp of VPS) for (const pg of PAGES) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: !!vp.mobile });
      await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      const b = page.once('Page.loadEventFired'); await page.send('Page.navigate', { url: 'about:blank' }); await b;
      const l = page.once('Page.loadEventFired', 120000); await page.send('Page.navigate', { url: `${server.base}${v}/${pg.q}` }); await l;
      for (let t = Date.now(); Date.now() - t < 60000;) { if ((await page.evaluate('document.documentElement.dataset.pfReady')) === 'yes') break; await sleep(80); }
      const steps = [];
      for (let n = 0; n < 30; n++) {
        await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
        await sleep(60);
        steps.push(await page.evaluate(STATE));
      }
      const inScene = steps.filter((s) => s.inScene);
      const bad = inScene.filter((s) => !s.elIn || !s.sceneIn);
      res.push({ variant: v.split('/').pop(), vp: vp.id, page: pg.id, tabs: steps.length, inScene: inScene.length, bad: bad.length, sample: bad.slice(0, 3) });
      console.log(`${bad.length ? 'FAIL' : 'PASS'} ${v.split('/').pop().padEnd(14)} ${vp.id.padEnd(7)} ${pg.id.padEnd(14)} 장면 안 포커스 ${inScene.length}/30, 화면 밖 ${bad.length} ${bad.length ? JSON.stringify(bad[0]) : ''}`);
    }
  } finally { await c.close(); await server.close(); }
  fs.writeFileSync(path.join(OUT, 'tab.json'), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(2); });
