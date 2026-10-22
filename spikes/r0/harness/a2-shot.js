#!/usr/bin/env node
// a2-shot.js — A2 증거 캡처: 지금 키트(pages)와 이동 수정안(pages-navfix)에서 PFScene.go(i) 직후 화면
//   ① 1366×752(k 1.0, HUD 알약): 지금 키트는 장면 위 20px이 화면 위로 잘림  ② 375×812 모바일(k 0.29): HUD 카운터
// 실행(PowerShell): node spikes/r0/harness/a2-shot.js → spikes/r0/out/a2/shot-*.png
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');
const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out/a2');
const CASES = [
  { id: 'k1.0-pill', w: 1366, h: 752, mobile: false, page: 'project.html?p=0-Tidy-Mommy', go: 10 },
  { id: 'k0.29-phone', w: 375, h: 812, mobile: true, page: 'project.html?p=0-Tidy-Mommy', go: 48 },
];
(async () => {
  const server = await serve(ROOT, 4622);
  const c = await launch('chrome');
  const out = [];
  try {
    const page = await c.newPage();
    for (const v of ['pages', 'pages-navfix']) for (const cs of CASES) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: cs.w, height: cs.h, deviceScaleFactor: 1, mobile: cs.mobile });
      await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      const l = page.once('Page.loadEventFired', 120000); await page.send('Page.navigate', { url: `${server.base}spikes/r0/${v}/${cs.page}` }); await l;
      for (let t = Date.now(); Date.now() - t < 60000;) { if ((await page.evaluate('document.documentElement.dataset.pfReady')) === 'yes') break; await sleep(80); }
      await page.evaluate(`PFScene.go(${cs.go})`); await sleep(400);
      const st = await page.evaluate(`(() => { const s = document.getElementById('s-${cs.go + 1}').getBoundingClientRect(); return { top: s.top, bottom: s.bottom, vh: innerHeight, hud: document.querySelector('.pf-hud-count').textContent, pill: document.documentElement.classList.contains('pf-hud-pill') }; })()`);
      const r = await page.send('Page.captureScreenshot', { format: 'png' });
      const f = path.join(OUT, `shot-${v}-${cs.id}.png`); fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      out.push({ variant: v, case: cs.id, target: cs.go + 1, ...st, file: path.basename(f) });
      console.log(JSON.stringify(out[out.length - 1]));
    }
  } finally { await c.close(); await server.close(); }
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(2); });
