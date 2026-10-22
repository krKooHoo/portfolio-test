#!/usr/bin/env node
// a2-probe.js — A2 보조 실험: elementFromPoint 경계 반올림, 실제 마우스 이벤트 경계(형제 transform 장면과 일반 상자 비교)
// 실행(PowerShell): node spikes/r0/harness/a2-probe.js [chrome|edge]
'use strict';
const { launch } = require('./lib/cdp');
const html = `<!doctype html><meta charset=utf-8><style>html,body{margin:0}
#a{position:absolute;left:100.4px;top:10px;width:50px;height:50px;background:#c00}
#d{display:flex;flex-direction:column;align-items:center;position:absolute;top:100px;left:0;width:1905px}
#d>section{flex:none;width:1280px;height:720px;transform:scale(1.268);transform-origin:0 0;margin:0 calc(1280px*(1.268 - 1)) calc(720px*(1.268 - 1)) 0;background:#0c0}
</style><div id=a></div><div id=d><section id=s></section></div>`;
(async () => {
  const c = await launch(process.argv[2] || 'chrome');
  try {
    const p = await c.newPage();
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1100, deviceScaleFactor: 1, mobile: false });
    const l = p.once('Page.loadEventFired'); await p.send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') }); await l;
    const r = await p.evaluate(`(() => {
      const a = document.getElementById('a'), s = document.getElementById('s');
      const ra = a.getBoundingClientRect(), rs = s.getBoundingClientRect();
      const t = (el, xs, y) => xs.map((x) => [x, document.elementFromPoint(x, y) === el]);
      return { aLeft: ra.left, plain: t(a, [99.9, 100.1, 100.3, 100.45, 100.55, 100.7], 30),
               sLeft: rs.left, sTop: rs.top, scaled: t(s, [rs.left - 0.7, rs.left - 0.45, rs.left - 0.3, rs.left - 0.1, rs.left + 0.1, rs.left + 0.3], rs.top + 50) };
    })()`);
    // 실제 마우스 이벤트(CDP Input)도 같은지: 장면 왼쪽 경계 근처에서 mousedown 대상
    await p.evaluate(`window.__hits = []; addEventListener('mousedown', (e) => __hits.push([e.clientX, e.target.id || e.target.tagName]), true); 1`);
    for (const x of [r.sLeft - 0.7, r.sLeft - 0.45, r.sLeft - 0.3, r.sLeft + 0.3]) {
      await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y: r.sTop + 50, button: 'left', buttons: 1, clickCount: 1 });
      await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y: r.sTop + 50, button: 'left', buttons: 0, clickCount: 1 });
    }
    r.mouse = await p.evaluate('__hits');
    console.log(JSON.stringify({ browser: c.version, ...r }, null, 1));
  } finally { await c.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
