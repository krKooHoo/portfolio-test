#!/usr/bin/env node
// a2-edge.js — A2 보조: 배율 k에서 장면 "경계"가 세 가지로 같은지
//   ① gBCR(레이아웃 계산) ② 실제로 칠해진 픽셀(스크린샷, DPR 1·2) ③ 클릭 판정(elementFromPoint를 0.25px 간격으로 훑음)
//   형제 + 여백 보정(pages)과 감싸개(pages-wrapper)를 같은 조건에서 비교. 장면 사이 간격(16px) 위·아래 경계와 왼쪽 경계를 봄
// 실행(PowerShell): node spikes/r0/harness/a2-edge.js → spikes/r0/out/a2/edge.json (+ 픽셀 분석은 a2-edge.py)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');
const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out/a2/edge');
const VPS = [{ id: 'k0.29', w: 375, h: 812, mobile: true }, { id: 'k0.5', w: 655, h: 900 }, { id: 'k0.835', w: 1366, h: 633 }, { id: 'k1.268', w: 1920, h: 945 }];
const SCAN = `((si) => {
  const deck = document.querySelector('.pf-deck'); const ss = [...deck.querySelectorAll('.pf-scene')];
  const a = ss[si], b = ss[si + 1], ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  const x = Math.round(ra.left + ra.width * 0.37) + 0.5;            // 장면 안쪽 세로선(글자 적은 곳을 고르진 않음 — 배경 칠은 장면 전체)
  const who = (y) => { const e = document.elementFromPoint(x, y); const s = e && e.closest('.pf-scene'); return s ? ss.indexOf(s) : -1; };
  // 아래 경계(a의 bottom)와 다음 장면 위 경계(b의 top) 근처를 0.25px 간격으로
  const scan = (y0, y1) => { const out = []; for (let y = y0; y <= y1 + 1e-9; y += 0.25) out.push([+y.toFixed(2), who(y)]); return out; };
  const firstChange = (arr, from) => { for (let i = 1; i < arr.length; i++) if (arr[i][1] !== arr[i - 1][1]) return arr[i][0]; return null; };
  const sb = scan(ra.bottom - 3, ra.bottom + 3), st = scan(rb.top - 3, rb.top + 3);
  const yy = Math.round(rb.top + 40) + 0.5;
  const whoX = (xx) => { const e = document.elementFromPoint(xx, yy); const s = e && e.closest('.pf-scene'); return s ? ss.indexOf(s) : -1; };
  const sl = []; for (let xx = rb.left - 3; xx <= rb.left + 3 + 1e-9; xx += 0.25) sl.push([+xx.toFixed(2), whoX(xx)]);
  // 오른쪽 경계(장면 b)
  const sr = []; for (let xx = rb.right - 3; xx <= rb.right + 3 + 1e-9; xx += 0.25) sr.push([+xx.toFixed(2), whoX(xx)]);
  return { k: PFScene.k, x, yy, a: { top: ra.top, bottom: ra.bottom, left: ra.left, right: ra.right, offsetTop: a.offsetTop }, b: { top: rb.top, offsetTop: b.offsetTop },
    hitBottom: firstChange(sb), hitTop: firstChange(st), hitLeft: firstChange(sl), hitRight: firstChange(sr), bLeft: rb.left, bRight: rb.right, scanBottom: sb, scanTop: st };
})`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve(ROOT, 4622);
  const c = await launch('chrome');
  const res = [];
  try {
    const page = await c.newPage();
    for (const v of ['pages', 'pages-wrapper']) for (const vp of VPS) for (const dpr of [1, 2]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: dpr, mobile: !!vp.mobile });
      await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      const bl = page.once('Page.loadEventFired'); await page.send('Page.navigate', { url: 'about:blank' }); await bl;
      const l = page.once('Page.loadEventFired', 120000); await page.send('Page.navigate', { url: `${server.base}spikes/r0/${v}/project.html?p=00-example-crafting` }); await l;
      for (let t = Date.now(); Date.now() - t < 60000;) { if ((await page.evaluate('document.documentElement.dataset.pfReady')) === 'yes') break; await sleep(80); }
      // 장면 9의 아래 경계가 화면 가운데에 오게 스크롤(간격 위·아래 경계와 장면 10 왼쪽 경계가 모두 화면 안)
      await page.evaluate('(() => { const r = document.getElementById("s-9").getBoundingClientRect(); scrollTo(0, scrollY + r.bottom - innerHeight / 2); })()'); await sleep(300);
      const s = await page.evaluate(`${SCAN}(8)`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      const f = path.join(OUT, `${v}-${vp.id}-dpr${dpr}.png`); fs.writeFileSync(f, Buffer.from(shot.data, 'base64'));
      const px = JSON.parse(execFileSync('python', ['-I', path.join(__dirname, 'a2-edge.py'), f, String(dpr), String(s.x), String(s.yy), String(s.a.bottom), String(s.b.top), String(s.bLeft)], { encoding: 'utf8' }));
      const row = { variant: v, vp: vp.id, dpr, k: s.k, gbcr: { aBottom: s.a.bottom, bTop: s.b.top, bLeft: s.bLeft, bRight: s.bRight }, hit: { aBottom: s.hitBottom, bTop: s.hitTop, bLeft: s.hitLeft, bRight: s.hitRight }, paint: px };
      res.push(row);
      console.log(JSON.stringify(row));
    }
  } finally { await c.close(); await server.close(); }
  fs.writeFileSync(path.join(OUT, '..', 'edge.json'), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(2); });
