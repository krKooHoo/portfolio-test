#!/usr/bin/env node
// eval.js — 디버그용: 페이지를 열고 준비(yes)를 기다린 뒤 식을 평가해 JSON으로 출력
// 사용(PowerShell): node spikes/r0/harness/eval.js [--browser chrome] [--viewport 1920x945@1] [--mobile 1] [--media print] [--shot out.png] [--wait yes|any] [--port 4621] "<페이지 경로>" "<JS 식>"
'use strict';
const path = require('path');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');
const argv = process.argv.slice(2);
const opt = { browser: 'chrome', viewport: '1920x945@1', media: '', mobile: '0', wait: 'yes' }; const pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else pos.push(argv[i]); }
(async () => {
  const server = await serve(path.resolve(__dirname, '../../..'), +(opt.port || 4621));
  const c = await launch(opt.browser);
  try {
    const page = await c.newPage();
    const [wh, d] = opt.viewport.split('@'); const [w, h] = wh.split('x').map(Number);
    await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: +(d || 1), mobile: opt.mobile === '1' });
    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url: server.base + pos[0] });
    await loaded;
    for (let t = Date.now(); Date.now() - t < 60000;) { const r = await page.evaluate('document.documentElement.dataset.pfReady'); if (r === 'yes' || (opt.wait === 'any' && r)) break; await sleep(100); }
    if (opt.media) await page.send('Emulation.setEmulatedMedia', { media: opt.media });
    if (pos[1]) console.log(JSON.stringify(await page.evaluate(pos[1]), null, 1));
    if (opt.shot) { await sleep(300); const r = await page.send('Page.captureScreenshot', { format: 'png' }); require('fs').writeFileSync(opt.shot, Buffer.from(r.data, 'base64')); console.log('shot', opt.shot); }
    if (page.logs.length) console.log('logs', JSON.stringify(page.logs.slice(0, 10)));
  } finally { await c.close(); await server.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
