#!/usr/bin/env node
// od-probe.js — 【R0 결정 #14】 화면 매체 감사 outside-deck의 실제 페이지 오탐·양성 대조
//   페이지 × 뷰포트(HUD 옆 / 알약) × Chrome·Edge에서:
//   ① ?pf-audit=1 JSON의 outsideDeck, report().outsideDeck = 0(오탐 없음), 건너뛰기 링크에 포커스해도 0
//   ② 양성 대조: body에 <p>·글자 노드·body::after 생성 글자·덱 앞 고정 바를 하나씩 넣으면 1, 빼면 0
//   ③ 인쇄 매체(Emulation)에서는 넣은 채로도 outsideDeck 0, media = 'print'(인쇄 감사 불변)
// 실행(PowerShell): node spikes/r0/harness/od-probe.js [--port 4621] [--browser both] → spikes/r0/out/od-probe.json
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const PORT = +arg('port', 4621);
const BROWSERS = arg('browser', 'both') === 'both' ? ['chrome', 'edge'] : [arg('browser')];
const OUT = path.resolve(__dirname, '../out/od-probe.json');
const PAGES = ['spikes/r0/pages/index.html?pf-audit=1', 'spikes/r0/pages/project.html?p=0-Tidy-Mommy&pf-audit=1', 'spikes/r0/pages/project.html?p=1-action-platformer&pf-audit=1'];
const VPS = [{ w: 1920, h: 945, dpr: 1, mobile: false, name: 'FHD(HUD 옆)' }, { w: 375, h: 812, dpr: 3, mobile: true, name: '폰 375(HUD 알약)' }];

const PROBE = `(async () => {
  const od = () => PFScene.report().outsideDeck;
  const pre = document.getElementById('pf-audit');
  let fromPre = null;
  try { fromPre = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(pre.textContent), (c) => c.charCodeAt(0)))).outsideDeck; } catch (e) { fromPre = 'err ' + e.message; }
  const r = { fromPre, base: od(), hud: document.querySelector('.pf-hud')?.dataset.place, auditTypes: [...new Set(PFScene.audit().map((x) => x.type))] };
  document.querySelector('.pf-skiplink')?.focus(); r.skipFocused = od(); document.activeElement?.blur();
  const deck = document.getElementById('deck');
  const cases = {
    p: () => { const e = document.createElement('p'); e.textContent = 'OD-PROBE-P'; document.body.appendChild(e); return () => e.remove(); },
    text: () => { const t = document.createTextNode('OD-PROBE-TEXT'); document.body.appendChild(t); return () => t.remove(); },
    bodyAfter: () => { const s = document.createElement('style'); s.textContent = 'body::after{content:"OD-PROBE-AFTER";display:block}'; document.head.appendChild(s); return () => s.remove(); },
    fixedBar: () => { const e = document.createElement('div'); e.style.cssText = 'position:fixed;top:0;left:0;right:0;height:40px;background:#333;color:#fff'; e.textContent = 'OD-PROBE-BAR'; deck.before(e); return () => e.remove(); },
  };
  r.positive = {};
  for (const [k, f] of Object.entries(cases)) { const undo = f(); await new Promise((q) => setTimeout(q, 30)); const n = od(); const sample = PFScene.audit().filter((x) => x.type === 'outside-deck').map((x) => x.detail); undo(); await new Promise((q) => setTimeout(q, 30)); r.positive[k] = { with: n, after: od(), sample }; }
  cases.p();                // 인쇄 매체 검사용으로 <p> 하나를 남김(다음 탐색에서 사라짐)
  return r;
})()`;

(async () => {
  const server = await serve(path.resolve(__dirname, '../../..'), PORT);
  const results = [];
  try {
    for (const b of BROWSERS) {
      const c = await launch(b);
      try {
        const page = await c.newPage();
        for (const vp of VPS) for (const pg of PAGES) {
          await page.send('Emulation.setEmulatedMedia', { media: '' });
          await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: vp.mobile });
          const loaded = page.once('Page.loadEventFired', 60000);
          await page.send('Page.navigate', { url: server.base + pg });
          await loaded;
          for (let t = Date.now(); Date.now() - t < 60000;) { const ok = await page.evaluate('document.documentElement.dataset.pfReady === "yes" && !!(document.getElementById("pf-audit")?.textContent)').catch(() => false); if (ok) break; await sleep(100); }
          const r = await page.evaluate(PROBE);
          await page.send('Emulation.setEmulatedMedia', { media: 'print' });
          await sleep(120);
          r.print = await page.evaluate('({ media: PFScene.report().media, outsideDeck: PFScene.report().outsideDeck, injectedPresent: [...document.querySelectorAll("p")].some((p) => p.textContent === "OD-PROBE-P") })');
          await page.send('Emulation.setEmulatedMedia', { media: '' });
          const pos = Object.values(r.positive);
          r.ok = r.fromPre === 0 && r.base === 0 && r.skipFocused === 0 && pos.every((x) => x.with === 1 && x.after === 0) && r.print.media === 'print' && r.print.outsideDeck === 0 && r.print.injectedPresent;
          results.push({ browser: b, vp: vp.name, page: pg, ...r });
          console.log(`${r.ok ? 'OK ' : 'NG '} ${b.padEnd(6)} ${vp.name.padEnd(14)} ${pg.replace('spikes/r0/pages/', '')}  pre=${r.fromPre} base=${r.base} skip=${r.skipFocused} hud=${r.hud} 양성 ${pos.map((x) => `${x.with}/${x.after}`).join(' ')} 인쇄=${r.print.outsideDeck}`);
        }
        await page.close();
      } finally { await c.close(); }
    }
  } finally { await server.close(); }
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  console.log(`\n${OUT}  ${results.filter((r) => r.ok).length}/${results.length} OK`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
