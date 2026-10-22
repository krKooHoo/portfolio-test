#!/usr/bin/env node
// A4 사례 5(실제 대화상자): 창이 있는 Chrome·Edge에서 window.print()/Ctrl+P로 인쇄 미리보기를 열고,
//   beforeprint 핸들러 안의 속성 변경이 "그 미리보기"에 반영되는지 쪽 수 글자와 스크린샷으로 봄. 저장 버튼·OS 창은 건드리지 않음(Esc로 닫음)
// 실행(PowerShell): node spikes/r0/harness/a4/a4-dialog.js chrome|edge
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./a4-lib');

const H = `
window.__all = () => { const all = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return all; };
window.__vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
window.__texts = () => { const out = []; __all().forEach((e) => { if (!e.getBoundingClientRect || !__vis(e)) return; for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) out.push(n.textContent.trim()); }); return [...new Set(out)]; };
window.__count = () => { const hdr = __all().find((x) => x.tagName.toLowerCase() === 'print-preview-header');
  const t = hdr ? (hdr.shadowRoot || hdr).textContent.replace(/\\s+/g, ' ').trim() : __texts().join(' | ');
  const m = t.match(/(인쇄 용지|인쇄 페이지|합계:?)\\s*(\\d+)/); return { n: m ? +m[2] : null, text: (m ? m[0] : t).slice(0, 160) }; };
window.__model = () => __all().find((x) => x.tagName.toLowerCase() === 'print-preview-model');
true;`;

(async () => {
  const browser = process.argv[2] || 'chrome';
  const only = process.argv[3] ? process.argv[3].split(',') : null;
  const outDir = path.join(L.OUT, 'dialog'); fs.mkdirSync(outDir, { recursive: true });
  const srv = await L.startServer();
  const res = { browser, scenarios: {} };
  const c = await L.launch(browser, { headless: false, args: ['--window-position=40,40', '--window-size=1400,1000'] });
  res.version = c.version;
  const T0 = Date.now();
  const step = (id, x) => console.log(`${((Date.now() - T0) / 1000).toFixed(1)}s ${id} ${x}`);
  const S = (p, ms, label) => Promise.race([p, L.sleep(ms).then(() => { throw new Error('timeout ' + label); })]);
  const dog = setTimeout(async () => { console.log('WATCHDOG'); fs.writeFileSync(path.join(L.OUT, `case5-dialog-${browser}-partial.json`), JSON.stringify(res, null, 1)); await c.close().catch(() => {}); await srv.close(); process.exit(3); }, 600000);
  const findPreview = async (ms = 15000) => {
    for (const t = Date.now(); Date.now() - t < ms;) {
      const { targetInfos } = await c.send('Target.getTargets');
      const p = targetInfos.find((x) => /^(chrome|edge):\/\/print/.test(x.url));
      if (p) return p;
      await L.sleep(300);
    }
    return null;
  };
  const attach = async (targetId) => { const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    const ev = async (expression) => { const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId); return r.result.value; };
    return { sessionId, send: (m, p) => c.send(m, p, sessionId), ev }; };
  const readCount = async (pv, ms = 20000) => { let last = null;
    for (const t = Date.now(); Date.now() - t < ms;) { await pv.ev(H).catch(() => {}); last = await pv.ev('__count()').catch((e) => ({ err: e.message })); if (last && last.n) return last; await L.sleep(500); }
    return last; };
  const pageEval = (page, expr, ms = 3000) => Promise.race([page.evaluate(expr), L.sleep(ms).then(() => 'eval-blocked')]);

  async function scenario(id, { url, q12 = false, emu = {}, setup = '', trigger = 'js', regenerate = false, afterWaitMs = 0, holdMs = 0, holdFromNavMs = 0 }) {
    if (only && !only.includes(id)) return;
    srv.cfg.q12 = q12;
    step(id, 'start');
    const page = await S(c.newPage(), 15000, 'newPage');
    await L.preparePage(page, { ...emu, vp: undefined, probe: true });
    await page.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await page.send('Page.bringToFront');
    if (holdFromNavMs) srv.cfg.imgReleaseAt = Date.now() + holdFromNavMs;   // 처음부터 모든 이미지를 붙잡음(폰은 lazy를 기다리지 않으므로 yes가 먼저 옴)
    await L.navigate(page, srv.base + url, { waitLoad: false });
    const w = await L.waitReady(page, ['yes'], 60000);
    step(id, 'ready ' + JSON.stringify(w));
    if (setup) await page.evaluate(setup);
    const before = await L.state(page);
    const r = { url, trigger, wait: w, before: { ready: before.ready, scenes: before.scenes, img: before.img, eager: before.eager } };
    if (holdMs) srv.cfg.imgReleaseAt = Date.now() + holdMs;      // 지금부터 요청되는 이미지(남은 lazy)를 holdMs 동안 붙잡음
    if (trigger === 'js') page.send('Runtime.evaluate', { expression: 'setTimeout(() => window.print(), 50)' }).catch(() => {});
    else {                                                  // Ctrl+P: 브라우저 단축키 경로(window.print()처럼 페이지 JS를 붙잡지 않는지 보려고)
      for (const type of ['rawKeyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, modifiers: 2, key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80, nativeVirtualKeyCode: 80 });
    }
    step(id, 'print triggered');
    if (holdMs) r.holdMs = holdMs;
    const pt = await findPreview();
    step(id, 'preview ' + (pt ? pt.url : 'none'));
    if (!pt) { r.preview = 'not-opened'; r.ev = (await L.events(page)).ev; res.scenarios[id] = r; console.log(id, 'preview not opened'); await page.close(); return; }
    const pv = await S(attach(pt.targetId), 10000, 'attach');
    step(id, 'attached');
    await L.sleep(2500);
    r.count1 = await S(readCount(pv), 30000, 'count1').catch((e) => ({ err: e.message }));
    step(id, 'count1 ' + JSON.stringify(r.count1));
    r.pageJsDuringPreview = await pageEval(page, 'JSON.stringify({ ready: document.documentElement.dataset.pfReady, t: Math.round(performance.now()) })');
    const shot = await S(pv.send('Page.captureScreenshot', { format: 'png' }), 10000, 'shot').catch((e) => { step(id, e.message); return null; });
    if (shot) fs.writeFileSync(path.join(outDir, `${browser}-${id}-1.png`), Buffer.from(shot.data, 'base64'));
    if (afterWaitMs) { await L.sleep(afterWaitMs); r.pageJsAfterWait = await pageEval(page, 'JSON.stringify({ ready: document.documentElement.dataset.pfReady, img: __a4.snap(), t: Math.round(performance.now()) })'); r.count2 = await readCount(pv, 5000); }
    if (regenerate) {                                       // 설정을 바꿔 미리보기를 다시 만들게 함(Chrome: 모델 setSetting)
      r.regen = await pv.ev(`(() => { const m = __model(); if (!m) return 'no-model'; const v = m.getSetting('cssBackground').value; m.setSetting('cssBackground', !v); return 'cssBackground ' + v + '→' + !v; })()`).catch((e) => e.message);
      await L.sleep(4000);
      r.count3 = await readCount(pv, 8000);
      const s3 = await S(pv.send('Page.captureScreenshot', { format: 'png' }), 10000, 'shot2').catch(() => null);
      if (s3) fs.writeFileSync(path.join(outDir, `${browser}-${id}-2-regen.png`), Buffer.from(s3.data, 'base64'));
    }
    step(id, 'closing');
    for (const type of ['rawKeyDown', 'keyUp']) await S(pv.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }), 5000, 'esc').catch(() => {});
    await L.sleep(1500);
    if (await findPreview(500)) { await S(c.send('Target.closeTarget', { targetId: pt.targetId }), 5000, 'closePreview').catch(() => {}); r.closedBy = 'closeTarget'; } else r.closedBy = 'Escape';
    step(id, 'closed by ' + r.closedBy);
    await L.sleep(800);
    const ev = await Promise.race([L.events(page), L.sleep(5000).then(() => null)]);
    r.ev = ev && ev.ev.map((e) => `${e.t} ${e.type} ready=${e.ready}${e.img ? ` img ${e.img.done}/${e.img.n} lazyPending ${e.img.lazyPending}` : ''}`);
    r.mo = ev && ev.mo.map((m) => `${m.t} ${m.old}→${m.now}`);
    r.after = await pageEval(page, 'document.documentElement.dataset.pfReady');
    res.scenarios[id] = r;
    step(id, JSON.stringify({ before: r.before.ready, count1: r.count1, js: r.pageJsDuringPreview, count2: r.count2, count3: r.count3, after: r.after }));
    await S(page.close(), 8000, 'pageClose').catch((e) => step(id, e.message));
    srv.cfg.q12 = false; srv.cfg.imgReleaseAt = 0;
  }

  try {
    const IDX = 'spikes/r0/pages/index.html';
    const PHONE = { touch: true, saveData: true };
    const yesToNo = `(addEventListener('beforeprint', () => { if (!window.__t) { window.__t = 1; document.documentElement.dataset.pfReady = 'no'; } }), addEventListener('afterprint', () => { if (window.__t === 1) { window.__t = 2; document.documentElement.dataset.pfReady = 'yes'; } }), 1)`;
    const noToYes = `(document.documentElement.dataset.pfReady = 'no', addEventListener('beforeprint', () => { if (!window.__t) { window.__t = 1; document.documentElement.dataset.pfReady = 'yes'; } }), 1)`;
    await scenario('plain', { url: IDX });
    await scenario('yes-to-no', { url: IDX, setup: yesToNo });
    await scenario('no-to-yes', { url: IDX, setup: noToYes });
    await scenario('phone-lazy', { url: 'spikes/r0/pages/project.html?p=0-Tidy-Mommy', q12: true, emu: PHONE, afterWaitMs: 4000, regenerate: browser === 'chrome' });
    await scenario('ctrlp-yes-to-no', { url: IDX, setup: yesToNo, trigger: 'ctrlp' });
    await scenario('ctrlp-phone-lazy-slow', { url: 'spikes/r0/pages/project.html?p=0-Tidy-Mommy', q12: true, emu: PHONE, trigger: 'ctrlp', holdFromNavMs: 12000, afterWaitMs: 13000, regenerate: browser === 'chrome' });
    await scenario('js-phone-lazy-slow', { url: 'spikes/r0/pages/project.html?p=0-Tidy-Mommy', q12: true, emu: PHONE, trigger: 'js', holdFromNavMs: 12000, afterWaitMs: 13000, regenerate: browser === 'chrome' });
    await scenario('ctrlp-phone-lazy', { url: 'spikes/r0/pages/project.html?p=0-Tidy-Mommy', q12: true, emu: PHONE, trigger: 'ctrlp', afterWaitMs: 4000, regenerate: browser === 'chrome' });
  } catch (e) { console.log('ERROR', e.stack); res.error = String(e.stack); } finally { clearTimeout(dog); await c.close(); await srv.close(); }
  fs.writeFileSync(path.join(L.OUT, `case5-dialog-${browser}.json`), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(2); });
