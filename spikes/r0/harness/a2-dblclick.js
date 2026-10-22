#!/usr/bin/env node
// a2-dblclick.js — A2 보조: 두 번 클릭 단어 선택이 배율 k와 상관있는지
//   k별로 같은 문서 장면의 단어 40개(Intl.Segmenter, 2글자 이상)의 가운데 글자를 실제 두 번 클릭 → 선택된 글자가 그 단어인지
//   대조: 클릭 지점의 caretRangeFromPoint 글자 위치, 같은 단어를 k=1(배율 없음)에서
// 실행(PowerShell): node spikes/r0/harness/a2-dblclick.js → spikes/r0/out/a2/dblclick.json
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');
const ROOT = path.resolve(__dirname, '../../..');
const VPS = [{ id: 'k1.0', w: 1366, h: 752 }, { id: 'k0.835', w: 1366, h: 633 }, { id: 'k0.75', w: 975, h: 1000 }, { id: 'k1.268', w: 1920, h: 945 }, { id: 'k0.29', w: 375, h: 812, mobile: true }];
const FX = +(process.argv[2] || 0.5);   // 글자 상자 안 가로 위치(0.5 = 한가운데). 0.5는 캐럿이 글자 앞/뒤로 갈리는 경계
const PREP = `(async (n) => { const FX = ${FX};
  const deck = document.querySelector('.pf-deck'), ss = [...deck.querySelectorAll('.pf-scene')];
  const s = ss.find((x) => x.dataset.pfPart === 'doc' && x.querySelectorAll('.pf-body p').length >= 3);
  PFScene.go(ss.indexOf(s), { focus: false }); await new Promise((r) => setTimeout(r, 300));
  const seg = new Intl.Segmenter('ko', { granularity: 'word' }), out = [];
  for (const p of s.querySelectorAll('.pf-body p')) for (const tn of [...p.childNodes].filter((x) => x.nodeType === 3)) for (const w of seg.segment(tn.data)) {
    if (!w.isWordLike || w.segment.length < 2 || out.length >= n) continue;
    const m = w.index + Math.floor(w.segment.length / 2); const r = document.createRange(); r.setStart(tn, m); r.setEnd(tn, m + 1);
    const q = [...r.getClientRects()][0]; if (!q) continue;
    const x = q.left + q.width * FX, y = (q.top + q.bottom) / 2; const c = document.caretRangeFromPoint(x, y);
    out.push({ word: w.segment, x, y, caretOk: !!c && c.startContainer === tn && Math.abs(c.startOffset - m) <= 1, ch: tn.data[m] });
  }
  return { scene: ss.indexOf(s) + 1, k: PFScene.k, words: out };
})`;
(async () => {
  const server = await serve(ROOT, 4622);
  const c = await launch('chrome');
  const res = [];
  try {
    const page = await c.newPage();
    for (const v of (process.argv[3] || 'pages,pages-wrapper').split(',')) for (const vp of VPS) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: !!vp.mobile });
      await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      const b = page.once('Page.loadEventFired'); await page.send('Page.navigate', { url: 'about:blank' }); await b;
      const l = page.once('Page.loadEventFired', 120000); await page.send('Page.navigate', { url: `${server.base}spikes/r0/${v}/project.html?p=0-Tidy-Mommy` }); await l;
      for (let t = Date.now(); Date.now() - t < 60000;) { if ((await page.evaluate('document.documentElement.dataset.pfReady')) === 'yes') break; await sleep(80); }
      const P = await page.evaluate(`${PREP}(40)`);
      let ok = 0, caret = 0; const bad = [];
      for (const w of P.words) {
        await page.evaluate('getSelection().removeAllRanges(), 1');
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: w.x, y: w.y });
        for (const cc of [1, 2]) {
          await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: w.x, y: w.y, button: 'left', buttons: 1, clickCount: cc });
          await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: w.x, y: w.y, button: 'left', buttons: 0, clickCount: cc });
        }
        const sel = await page.evaluate('getSelection().toString()');
        const good = sel.trim() && (sel.trim().includes(w.word) || w.word.includes(sel.trim()));
        if (good) ok++; else bad.push({ word: w.word, ch: w.ch, sel, x: +w.x.toFixed(2), y: +w.y.toFixed(2) });
        if (w.caretOk) caret++;
        await sleep(450);                                    // 다음 클릭이 세 번 클릭으로 이어지지 않게
      }
      const row = { variant: v, vp: vp.id, k: P.k, scene: P.scene, words: P.words.length, dblOk: ok, caretOk: caret, bad: bad.slice(0, 5) };
      res.push(row); console.log(JSON.stringify(row));
    }
  } finally { await c.close(); await server.close(); }
  fs.writeFileSync(path.resolve(__dirname, `../out/a2/dblclick-fx${FX}.json`), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(2); });
