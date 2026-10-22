#!/usr/bin/env node
// shot.js — 디버그 도구: 페이지를 열어 준비(yes)까지 기다린 뒤 보고서 요약을 찍고, 장면 PNG를 저장합니다.
// 사용(PowerShell): node spikes/deck/harness/shot.js "spikes/deck/pages/project.html?p=0-Tidy-Mommy" [--viewport 1920x1080@1] [--slides 1,2,3|all] [--out spikes/deck/out/dbg] [--browser chrome] [--eval "식"]
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');
const argv = process.argv.slice(2);
const opt = { viewport: '1920x1080@1', slides: '', out: path.resolve(__dirname, '../out/dbg'), browser: 'chrome', port: 4642, eval: '' };
const pages = [];
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) opt[a.slice(2)] = argv[++i]; else pages.push(a); }
(async () => {
  fs.mkdirSync(opt.out, { recursive: true });
  const [wh, d] = opt.viewport.split('@'); const [vw, vh] = wh.split('x').map(Number);
  const server = await serve(path.resolve(__dirname, '../../..'), +opt.port);
  const c = await launch(opt.browser);
  try {
    const page = await c.newPage();
    await page.send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: +(d || 1), mobile: false });
    for (const pg of pages) {
      const t0 = Date.now();
      const loaded = page.once('Page.loadEventFired', 60000);
      await page.send('Page.navigate', { url: new URL(pg, server.base).href });
      await loaded;
      let ready = '';
      while (Date.now() - t0 < 60000) { ready = await page.evaluate('document.documentElement.dataset.pfReady || ""').catch(() => ''); if (ready === 'yes') break; await sleep(100); }
      const r = await page.evaluate('JSON.stringify((() => { const r = PFScene.report(); return { ready: r.ready, scenes: r.scenes, view: r.view, k: r.k, audit: r.audit.slice(0, 20), auditN: r.audit.length, info: { summary: r.info.summary, overflow: r.info.overflow, errors: r.info.errors, doc: r.info.doc && { scenes: r.info.doc.scenes, clipped: r.info.doc.clipped, forced: r.info.doc.forced, conservation: r.info.doc.conservation } }, tpl: [...document.querySelectorAll(".pf-deck > .pf-scene")].map((s) => s.dataset.pfTpl).join(" ") }; })())').then(JSON.parse);
      console.log(pg, `ready=${ready} ${Date.now() - t0}ms`);
      console.log(JSON.stringify(r, null, 1).slice(0, 6000));
      if (opt.eval) console.log('eval:', JSON.stringify(await page.evaluate(opt.eval)).slice(0, 4000));
      const n = r.scenes;
      const list = opt.slides === 'all' ? Array.from({ length: n }, (_, i) => i + 1) : opt.slides ? opt.slides.split(',').map(Number) : [];
      const tag = pg.replace(/^.*\//, '').replace(/[^\w.-]+/g, '_');
      for (const i of list) {
        await page.evaluate(`PFScene.go(${i - 1}, { focus: false }), 1`);
        await sleep(260);
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(opt.out, `${tag}__${String(i).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'));
      }
      if (page.logs.length) console.log('logs:', JSON.stringify(page.logs.slice(0, 10)));
    }
  } finally { await c.close(); await server.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
