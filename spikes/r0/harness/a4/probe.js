#!/usr/bin/env node
// A4 사전 조사: 헤드리스에서 쓸 수 있는 에뮬레이션(pointer·saveData), window.print()의 동작, 가려진 탭 만들기
// 실행(PowerShell): node spikes/r0/harness/a4/probe.js [chrome|edge]
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./a4-lib');

(async () => {
  const browser = process.argv[2] || 'chrome';
  const srv = await L.startServer();
  const out = { browser };
  const url = srv.base + 'spikes/r0/harness/fixtures/hf-control.html';
  const MQ = `JSON.stringify({ fine: matchMedia('(pointer: fine)').matches, coarse: matchMedia('(pointer: coarse)').matches, anyFine: matchMedia('(any-pointer: fine)').matches,
    hoverNone: matchMedia('(hover: none)').matches, saveData: navigator.connection ? navigator.connection.saveData : 'no-connection', touch: navigator.maxTouchPoints, vis: document.visibilityState })`;
  try {
    await L.withBrowser(browser, async (c) => {
      out.version = c.version;
      for (const [name, o] of [['plain', {}], ['mobileOnly', { mobile: true, vp: { w: 390, h: 844, dpr: 3 } }], ['touch', { touch: true }],
                               ['touch+mobile', { touch: true, mobile: true, vp: { w: 390, h: 844, dpr: 3 } }], ['pointerMedia', { pointerMedia: true }], ['saveData', { saveData: true }]]) {
        const page = await c.newPage();
        const applied = await L.preparePage(page, { ...o, probe: false });
        await L.navigate(page, url);
        out[name] = { applied, mq: JSON.parse(await page.evaluate(MQ)) };
        await page.close();
      }
      // window.print()이 헤드리스에서 막히는가 + beforeprint가 불리는가
      const page = await c.newPage();
      await L.preparePage(page, {});
      await L.navigate(page, url);
      out.windowPrint = await page.evaluate(`(() => { const t = performance.now(); let err = null; try { window.print(); } catch (e) { err = String(e); } return { ms: +(performance.now() - t).toFixed(1), err, ev: __a4.ev }; })()`, { timeout: 15000 }).catch((e) => ({ error: e.message }));
      // 가려진 탭: 다른 탭을 앞에 열면 visibilityState가 바뀌는가
      const b = await c.newPage();
      await L.navigate(b, url);
      out.hiddenTab = { aAfterB: await page.evaluate('document.visibilityState'), b: await b.evaluate('document.visibilityState') };
      await b.send('Page.bringToFront').catch(() => {});
      out.hiddenTab.aAfterBringB = await page.evaluate('document.visibilityState');
      const { targetId } = await c.send('Target.createTarget', { url: 'about:blank', background: true });
      const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
      out.hiddenTab.background = (await c.send('Runtime.evaluate', { expression: 'document.visibilityState', returnByValue: true }, sessionId)).result.value;
      await c.send('Target.closeTarget', { targetId });
      try { await page.send('Emulation.setFocusEmulationEnabled', { enabled: false }); } catch (e) { out.focusEmu = e.message; }
      try { await page.send('Page.setWebLifecycleState', { state: 'frozen' }); out.frozenVis = await Promise.race([page.evaluate('document.visibilityState'), L.sleep(2000).then(() => 'eval-blocked')]); await page.send('Page.setWebLifecycleState', { state: 'active' }); } catch (e) { out.frozen = e.message; }
    });
  } finally { await srv.close(); }
  fs.writeFileSync(path.join(L.OUT, `probe-${browser}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(2); });
