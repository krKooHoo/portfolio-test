#!/usr/bin/env node
// A4 — 통합 준비 게이트(01 §8-2·§8-3, spikes/r0/kit/scene-kit.js 블록 A) 검증. 헤드리스 Chrome·Edge + CDP printToPDF
// 실행(PowerShell, 레포 루트): node spikes/r0/harness/a4/a4-run.js --case 1,2,3,4,5,6 --browser chrome,edge [--tag 이름]
//   결과: spikes/r0/out/a4/case<N>-<browser><tag>.json, PDF는 out/a4/pdf/
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./a4-lib');
const { SIGNATURE } = require('../scene-print-check');

const argv = process.argv.slice(2);
const opt = { case: '1,2,3,4,5,6', browser: 'chrome,edge', page: '0-Tidy-Mommy', tag: '', kit: 'current' };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
const PDFDIR = path.join(L.OUT, 'pdf');
fs.mkdirSync(PDFDIR, { recursive: true });
const PROJ = (id, q = '') => `spikes/r0/pages/project.html?p=${encodeURIComponent(id)}${q}`;
const FX = (q = '') => `spikes/r0/harness/a4/fx-gate.html${q}`;
const log = (...a) => console.log(...a);

// 페이지 시각(performance.now) 기준으로 기다리기
async function untilPageTime(page, ms) { for (;;) { const t = await page.evaluate('performance.now()').catch(() => 0); if (t >= ms) return t; await L.sleep(Math.min(200, ms - t)); } }
// 상태 변화만 남기는 관찰 기록
async function watch(page, { until, maxMs = 60000, step = 250 } = {}) {
  const tl = []; const t0 = Date.now(); let last = '';
  for (;;) {
    const s = await L.state(page).catch((e) => ({ err: e.message }));
    const key = JSON.stringify([s.ready, s.scenes, s.img && s.img.done, s.anyway, s.font, !!(s.timing && s.timing.mount)]);
    if (key !== last) { tl.push({ t: s.t, ready: s.ready, scenes: s.scenes, img: s.img ? `${s.img.done}/${s.img.n} lazyPending ${s.img.lazyPending}` : null, mounted: !!(s.timing && s.timing.mount), font: s.font, anyway: s.anyway }); last = key; }
    if (until && until(s)) return { tl, last: s };
    if (Date.now() - t0 > maxMs) return { tl, last: s, timedOut: true };
    await L.sleep(step);
  }
}
async function pdfA(page, name, o) { const r = await L.pdf(page, path.join(PDFDIR, name + '.pdf'), o); const [a] = L.analyze([r.file]); return { ...r, ...a, file: r.file }; }
const deckImgs = (page) => page.evaluate('document.querySelectorAll(".pf-deck img").length');
const sig = (page) => page.evaluate(SIGNATURE).then((x) => ({ scenes: x.scenes, signature: x.signature }));
const evDigest = (ev) => ev ? ev.ev.map((e) => `${e.t} ${e.type}${e.ready !== undefined ? ' ready=' + e.ready : ''}${e.mq !== undefined ? ' mq=' + e.mq : ''}${e.matches !== undefined ? ' matches=' + e.matches : ''}${e.anyway ? ' anyway' : ''}${e.img ? ` img ${e.img.done}/${e.img.n} lazyPending ${e.img.lazyPending}` : ''}`) : null;
const moDigest = (ev) => ev ? ev.mo.map((m) => `${m.t} ${m.attr} ${m.old}→${m.now} scenes ${m.scenes} img ${m.img.done}/${m.img.n} lazy ${m.img.lazy}/${m.img.lazyPending}p${m.mounted ? ' mounted' : ''}${m.font ? ' font=' + m.font : ''}`) : null;
async function newPage(c, o) { const page = await c.newPage(); const applied = await L.preparePage(page, o); return { page, applied }; }

// ════════ 사례 1: mount 전 인쇄 ════════
async function case1(c, srv, b) {
  const R = {};
  // 1a 실제 상세 페이지: 프로젝트 JSON을 5초 늦춰 mount 전에 인쇄
  srv.cfg.delay = (p) => (p.startsWith('/data/projects/') ? 5000 : 0);
  { const { page } = await newPage(c, {});
    await L.navigate(page, srv.base + PROJ(opt.page));
    await untilPageTime(page, 1500);
    const s1 = await L.state(page);
    const p1 = await pdfA(page, `c1a-${b}-before-mount`);
    const after1 = await L.state(page);
    const w = await L.waitReady(page, ['yes'], 40000);
    const s2 = await L.state(page);
    const p2 = await pdfA(page, `c1a-${b}-after-yes`);
    const ev = await L.events(page);
    R['1a'] = { expect: '1쪽 안내, 장면 0, mount 전 / yes 뒤 장면 수 = 쪽 수', s1, p1, after1, wait: w, s2, p2, ev: evDigest(ev), mo: moDigest(ev),
      pass: p1.pages === 1 && p1.notice && !s1.timing.mount && p2.pages === s2.scenes && !p2.notice };
    await page.close(); }
  srv.cfg.delay = null;
  // 1b 대조 페이지: 장면은 DOM에 있고 fetch track은 끝났지만 mount를 부르지 않음 → no → timeout(3초 훅) → mount 호출 → yes
  { const { page } = await newPage(c, {});
    await L.navigate(page, srv.base + FX('?pf-timeout=3000'));
    await untilPageTime(page, 1500);
    const s1 = await L.state(page); const p1 = await pdfA(page, `c1b-${b}-nomount-no`);
    await untilPageTime(page, 3600);
    const s2 = await L.state(page); const p2 = await pdfA(page, `c1b-${b}-nomount-timeout`);
    await page.evaluate('(PFScene.mount({ deck: "#deck" }), 1)');
    const w = await L.waitReady(page, ['yes'], 10000);
    const s3 = await L.state(page); const p3 = await pdfA(page, `c1b-${b}-mounted`);
    const ev = await L.events(page);
    R['1b'] = { expect: 'mount 전에는 장면이 DOM에 있어도 no→timeout, 인쇄는 안내 1쪽 / mount 뒤 yes, 3쪽', s1, p1, s2, p2, wait: w, s3, p3, mo: moDigest(ev),
      pass: s1.ready === 'no' && p1.notice && s2.ready === 'timeout' && p2.notice && s3.ready === 'yes' && p3.pages === 3 && !p3.notice };
    await page.close(); }
  // 1c 대조 페이지: mount를 2초 뒤에 부름 → yes 시각 ≥ mount 시각
  { const { page } = await newPage(c, {});
    await L.navigate(page, srv.base + FX('?mount=2000'));
    const w = await L.waitReady(page, ['yes'], 10000);
    const s = await L.state(page); const ev = await L.events(page);
    const yesAt = ev.mo.find((m) => m.now === 'yes')?.t;
    R['1c'] = { expect: 'yes 시각 ≥ mount 시각(≈2000ms)', mountAt: s.timing.mount, yesAt, wait: w, mo: moDigest(ev), pass: yesAt >= s.timing.mount && s.timing.mount >= 2000 };
    await page.close(); }
  // 1d (덤) timeout 시각(1초 훅)이 이미 지난 뒤 yes 상태에서 끝나지 않는 작업을 track하면? timeout이 다시 걸리는가 → 원문은 한 번만 걸리는 setTimeout
  { const { page } = await newPage(c, {});
    await L.navigate(page, srv.base + FX('?mount=0&pf-timeout=1000'));
    await L.waitReady(page, ['yes'], 10000);
    await untilPageTime(page, 1500);
    await page.evaluate('(PFScene.track(new Promise(() => {})), 1)');
    const trackedAt = await page.evaluate('Math.round(performance.now())');
    await untilPageTime(page, trackedAt + 6000);
    const s = await L.state(page); const p = await pdfA(page, `c1d-${b}-hung-after-yes`); const ev = await L.events(page);
    R['1d'] = { expect: '관찰만: yes 뒤 다시 닫힌 게이트에 timeout이 걸리는가', trackedAt, after6s: s.ready, hud: { msg: s.hudMsg, anywayBtn: s.anywayBtn }, p, mo: moDigest(ev) };
    await page.close(); }
  return R;
}

// ════════ 사례 2: 느린 서버(이미지 25초 뒤에 풀림) ════════
//   mode real: 지금 시험대(분할 전에 이미지 크기를 받아서 잼 → renderAll이 이미지에 묶임) · q12: 빌드가 w×h를 기록한 상태 모의(덱은 곧 mount, 이미지만 늦음)
//   seq notice: 21s Ctrl+P 대역(printToPDF) → 그 뒤 HUD 상태 → yes 뒤 인쇄
//   seq anyway: 21s [그래도 인쇄](PFScene.printAnyway) + printToPDF → yes 뒤 인쇄
//   seq hud:    21s [PDF로 저장](PFScene.print) → window.print이 yes 뒤에 불리는가 → yes 뒤 인쇄
async function case2(c, srv, b) {
  const R = {};
  for (const mode of (opt.modes || 'real,q12').split(',')) for (const seq of (opt.seqs || 'notice,anyway,hud').split(',')) {
    const id = `${mode}-${seq}`;
    srv.cfg.q12 = mode === 'q12';
    const { page } = await newPage(c, {});
    // window.print을 기록용으로 바꿈(헤드리스에서는 원래도 아무 일도 안 함 — probe 참고). PFScene.print·printAnyway가 부른 시각을 남김
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__a4pc = []; window.print = () => { __a4pc.push({ t: Math.round(performance.now()), ready: document.documentElement.dataset.pfReady, anyway: document.documentElement.hasAttribute("data-pf-print-anyway") }); };' });
    srv.cfg.imgReleaseAt = Date.now() + 25000;
    await L.navigate(page, srv.base + PROJ(opt.page), { waitLoad: false });
    const r = { mode, seq, releaseAfterMs: 25000 };
    const w1 = await watch(page, { until: (s) => s.t >= 21000, maxMs: 30000 });
    r.tl = w1.tl;
    r.atTimeout = w1.last;
    if (seq === 'notice') r.pA = await pdfA(page, `c2-${b}${opt.tag}-${id}-A-print-in-timeout`);
    if (seq === 'anyway') { await page.evaluate('(PFScene.printAnyway(), 1)'); r.anywaySet = await L.state(page); r.pB = await pdfA(page, `c2-${b}${opt.tag}-${id}-B-print-anyway`); }
    if (seq === 'hud') { r.hudCalledAt = await page.evaluate('(PFScene.print(), Math.round(performance.now()))'); await L.sleep(500); r.hudMid = await L.state(page); }
    r.afterPrint = await L.state(page);
    const w2 = await watch(page, { until: (s) => s.ready === 'yes', maxMs: 40000 });
    r.tl2 = w2.tl;
    r.atYes = w2.last;
    await L.sleep(300);
    r.printCalls = await page.evaluate('JSON.stringify(window.__a4pc)').then(JSON.parse);
    r.pC = await pdfA(page, `c2-${b}${opt.tag}-${id}-C-after-recovery`);
    r.deckImgs = await deckImgs(page);
    const ev = await L.events(page);
    r.ev = evDigest(ev); r.mo = moDigest(ev);
    r.timing = (await L.state(page)).timing;
    const notice = (p) => p && p.pages === 1 && p.notice;
    r.checks = {
      timeoutAt20s: r.timing.timeout != null && Math.abs(r.timing.timeout - 20000) < 1500,
      recoveredYes: r.atYes.ready === 'yes' && r.timing.ready > 25000,
      hudInTimeout: { msg: r.atTimeout.hudMsg, anywayBtn: r.atTimeout.anywayBtn },
      fullDeckAfterRecovery: r.pC.pages === r.atYes.scenes && !r.pC.notice && r.pC.imgs >= r.deckImgs,
    };
    if (seq === 'notice') Object.assign(r.checks, { printInTimeoutIsNotice: notice(r.pA), stateAfterPrint: r.afterPrint.ready, hudAfterPrint: { msg: r.afterPrint.hudMsg, anywayBtn: r.afterPrint.anywayBtn } });
    if (seq === 'anyway') Object.assign(r.checks, { printAnyway: notice(r.pB) ? 'notice' : `${r.pB.pages}p img ${r.pB.imgs}/${r.deckImgs} blank ${r.pB.blank}`, anywayClearedAfterPrint: !r.afterPrint.anyway, stateAfterPrint: r.afterPrint.ready });
    if (seq === 'hud') Object.assign(r.checks, { hudPrintCalls: r.printCalls.map((x) => `${x.t}:${x.ready}`), waitedForYes: r.printCalls.length === 1 && r.printCalls[0].ready === 'yes' && r.printCalls[0].t >= r.timing.ready - 1, hudMsgWhileWaiting: r.hudMid.hudMsg });
    R[id] = r;
    log(`  [2 ${b} ${id}]`, JSON.stringify(r.checks));
    await page.close();
    srv.cfg.imgReleaseAt = 0; srv.cfg.q12 = false;
  }
  return R;
}

// ════════ 사례 3: lazy 이미지 — 데스크톱(pointer:fine)은 eager로 바꿔 다 받은 뒤 yes, 폰(pointer:coarse + saveData)은 lazy 유지 → beforeprint가 게이트를 닫음 ════════
async function case3(c, srv, b) {
  const R = {};
  const DESK = { vp: { w: 1920, h: 945, dpr: 1 } };
  const PHONE = { vp: { w: 390, h: 844, dpr: 3 }, mobile: true, touch: true, saveData: true };
  for (const [id, o, q12, hold] of [['desktop-q12', DESK, true, 2000], ['desktop-real', DESK, false, 0], ['phone-q12', PHONE, true, 1500], ['phone-real', PHONE, false, 0]]) {
    srv.cfg.q12 = q12;
    const { page, applied } = await newPage(c, o);
    srv.cfg.imgReleaseAt = hold ? Date.now() + hold : 0;
    await L.navigate(page, srv.base + PROJ(opt.page), { waitLoad: false });
    const w = await L.waitReady(page, ['yes'], 60000);
    const s = await L.state(page);
    const ev0 = await L.events(page);
    const yesRec = ev0.mo.find((m) => m.now === 'yes');
    const r = { applied, eager: s.eager, mq: await page.evaluate('({ fine: matchMedia("(pointer: fine)").matches, saveData: navigator.connection && navigator.connection.saveData })'), wait: w, atYes: yesRec, s, deckImgs: await deckImgs(page) };
    r.p1 = await pdfA(page, `c3-${b}-${id}-1`);
    r.after1 = await L.state(page);
    if (r.p1.notice) {                                    // 안내 쪽이 나왔으면 게이트가 다시 열릴 때까지 기다려 두 번째 인쇄
      r.wait2 = await L.waitReady(page, ['yes'], 60000);
      r.s2 = await L.state(page);
      r.p2 = await pdfA(page, `c3-${b}-${id}-2`);
    }
    const ev = await L.events(page);
    r.ev = evDigest(ev); r.mo = moDigest(ev);
    const desktop = id.startsWith('desktop');
    r.checks = desktop
      ? { eager: s.eager === true, allCompleteAtYes: yesRec && yesRec.img.done === yesRec.img.n && yesRec.img.lazy === 0, printFull: r.p1.pages === s.scenes && !r.p1.notice && r.p1.imgs >= r.deckImgs }
      : { eagerFalse: s.eager === false, lazyPendingAtYes: yesRec ? yesRec.img.lazyPending : null,
          firstPrint: r.p1.notice ? 'notice' : `${r.p1.pages}p img ${r.p1.imgs}/${r.deckImgs}`,
          secondPrintFull: r.p2 ? (r.p2.pages === s.scenes && r.p2.imgs >= r.deckImgs) : null };
    R[id] = r;
    log(`  [3 ${b} ${id}]`, JSON.stringify(r.checks));
    await page.close();
    srv.cfg.q12 = false; srv.cfg.imgReleaseAt = 0;
  }
  // 3e: pointer만 coarse / saveData만 → 게이트 판정
  for (const [id, o] of [['touch-only', { touch: true }], ['saveData-only', { saveData: true }], ['mobile-metrics-only', { mobile: true, vp: { w: 390, h: 844, dpr: 3 } }]]) {
    const { page, applied } = await newPage(c, o);
    await L.navigate(page, srv.base + FX('?mount=0'));
    R[id] = { applied, eager: await page.evaluate('PFScene._eager') };
    await page.close();
  }
  log(`  [3 ${b} flags]`, R['touch-only'].eager, R['saveData-only'].eager, R['mobile-metrics-only'].eager);
  return R;
}

// ════════ 사례 4: 늦은 글꼴(Pretendard woff2를 CDP Fetch로 붙잡음) ════════
//   rerender: §8-3 "loadingdone → PFScene.track(repaginate())"의 대역. 시험대 project.js에는 다시 나누기가 없으므로
//   loadingdone(Pretendard)이 첫 mount 뒤에 오면 project.js를 한 번 더 실행(renderAll 전체 = 데이터·분할 다시 → mount)하고 그 로드를 track
const RERENDER = `(() => {
  const A = (window.__a4rr = { n: 0, log: [] });
  document.fonts.addEventListener('loadingdone', (e) => {
    const fams = e.fontfaces.map((f) => f.family.replace(/["']/g, '') + ' ' + f.weight);
    const mounted = !!(window.PFScene && PFScene._t && PFScene._t.mount);
    A.log.push({ t: Math.round(performance.now()), fams, mounted, ready: document.documentElement.dataset.pfReady });
    if (!mounted || !fams.some((f) => /Pretendard/.test(f))) return;
    A.n++;
    const s = document.createElement('script'); s.src = 'project.js?a4rerender=' + A.n;
    PFScene.track(new Promise((r) => { s.onload = r; s.onerror = r; document.body.appendChild(s); }));
  });
})();`;
async function case4(c, srv, b) {
  const R = {};
  for (const [id, blockMs, rerender] of [['baseline', 0, false], ['block3s', 3000, false], ['block10s', 10000, false], ['block10s-rerender', 10000, true], ['block13s-rerender', 13000, true]]) {
    const page = await c.newPage();
    await L.preparePage(page, { extraScript: rerender ? RERENDER : null });
    const fb = L.fontBlocker(c, page, '*pretendard*woff2*');
    await fb.enable();                                   // baseline도 가로채되 붙잡지 않음(가로채기 자체의 영향 배제)
    fb.holdMs = blockMs; fb.t0 = Date.now();
    await L.navigate(page, srv.base + PROJ(opt.page), { waitLoad: false });
    const w = await L.waitReady(page, ['yes'], 60000);
    const firstYes = await L.state(page);
    const sig1 = await sig(page);
    // 글꼴이 모두 들어올 때까지(+ 다시 나누기가 있으면 그 뒤 yes까지) 기다림
    await page.evaluate(`Promise.race([document.fonts.load('400 16px Pretendard', '가').then(() => document.fonts.ready), new Promise((r) => setTimeout(r, 20000))]).then(() => 1)`, { timeout: 25000 });
    await L.sleep(400);
    const w2 = await L.waitReady(page, ['yes'], 30000);
    const fin = await L.state(page);
    const sig2 = await sig(page);
    const audit = await page.evaluate('JSON.stringify(PFScene.audit().reduce((m, x) => (m[x.type] = (m[x.type] || 0) + 1, m), {}))').then(JSON.parse);
    const fontsOk = await page.evaluate("['400','600','700','800'].map((w) => document.fonts.check(w + ' 16px Pretendard', '가'))");
    const ev = await L.events(page);
    const rr = rerender ? await page.evaluate('JSON.stringify(window.__a4rr)').then(JSON.parse) : null;
    const yesCount = ev.mo.filter((m) => m.now === 'yes').length;
    const marks = await page.evaluate('JSON.stringify(PFScene.info && PFScene.info.t)').then(JSON.parse);
    R[id] = { blockMs, rerender, wait: w, firstYes: { t: firstYes.timing.firstYes, scenes: firstYes.scenes, font: firstYes.font, sig: sig1.signature },
      final: { readyAt: fin.timing.ready, scenes: fin.scenes, font: fin.font, sig: sig2.signature, wait: w2 }, fontsOk, audit, fonts: fb.seen, rr, yesCount, marks, mo: moDigest(ev) };
    log(`  [4 ${b} ${id}] firstYes ${Math.round(firstYes.timing.firstYes)}ms scenes ${firstYes.scenes}→${fin.scenes} font ${firstYes.font}→${fin.font} yes×${yesCount} audit ${JSON.stringify(audit)} sig ${sig1.signature}→${sig2.signature}`);
    await page.close();
  }
  const base = R.baseline.final.sig;
  Object.values(R).forEach((r) => { r.sameAsBaseline = { first: r.firstYes.sig === base, final: r.final.sig === base }; });
  return R;
}

// ════════ 사례 5(헤드리스): printToPDF와 beforeprint — 이벤트가 불리는가, 핸들러 안의 속성 변경이 그 인쇄에 반영되는가 ════════
async function case5(c, srv, b) {
  const R = {};
  const { page } = await newPage(c, {});
  await L.navigate(page, srv.base + 'spikes/r0/pages/index.html');
  await L.waitReady(page, ['yes'], 30000);
  const scenes = (await L.state(page)).scenes;
  // 5-0 평범한 인쇄: 이벤트 순서
  await page.evaluate('(__a4.ev.length = 0, 1)');
  R.plain = { p: await pdfA(page, `c5-${b}-plain`), ev: evDigest(await L.events(page)) };
  // 5-1 yes 상태에서 beforeprint 핸들러가 'no'로 바꿈 → 이번 인쇄가 안내 쪽이 되는가
  await page.evaluate(`(__a4.ev.length = 0, addEventListener('beforeprint', () => { if (!window.__t51) { window.__t51 = 1; document.documentElement.dataset.pfReady = 'no'; } }), addEventListener('afterprint', () => { if (window.__t51 === 1) { window.__t51 = 2; document.documentElement.dataset.pfReady = 'yes'; } }), 1)`);
  R.yesToNo = { p: await pdfA(page, `c5-${b}-yes-to-no`), ev: evDigest(await L.events(page)), readyAfter: await L.ready(page) };
  // 5-2 반대: 'no'인 상태에서 beforeprint가 'yes'로 바꿈 → 덱이 인쇄되는가
  await page.evaluate(`(__a4.ev.length = 0, document.documentElement.dataset.pfReady = 'no', addEventListener('beforeprint', () => { if (!window.__t52) { window.__t52 = 1; document.documentElement.dataset.pfReady = 'yes'; } }), 1)`);
  R.noToYes = { p: await pdfA(page, `c5-${b}-no-to-yes`), ev: evDigest(await L.events(page)), readyAfter: await L.ready(page) };
  // 5-3 beforeprint에서 DOM 글자를 바꿈(첫 장면 제목) → PDF 1쪽 글자에 반영되는가
  await page.evaluate(`(__a4.ev.length = 0, addEventListener('beforeprint', () => { if (!window.__t53) { window.__t53 = 1; const h = document.querySelector('.pf-deck > .pf-scene h1'); if (h) h.textContent = 'BP-CHANGED'; } }), 1)`);
  R.textChange = { p: await pdfA(page, `c5-${b}-text`), ev: evDigest(await L.events(page)) };
  R.scenes = scenes;
  R.checks = { beforeprintFires: R.plain.ev.some((x) => /beforeprint/.test(x)), afterprintFires: R.plain.ev.some((x) => /afterprint/.test(x)),
    mqPrintTrueInBeforeprint: R.plain.ev.find((x) => /beforeprint:first/.test(x))?.includes('mq=true'), mqChangeEvents: R.plain.ev.filter((x) => /mq-print-change/.test(x)).length,
    yesToNoAppliesToThisPrint: R.yesToNo.p.notice === true, noToYesAppliesToThisPrint: R.noToYes.p.pages === scenes && !R.noToYes.p.notice, textChangeApplies: /BP-CHANGED/.test(R.textChange.p.text0) };
  log(`  [5 ${b}]`, JSON.stringify(R.checks));
  await page.close();
  return R;
}

// ════════ 사례 6: 가려진 탭 — 다른 탭이 앞에 있는 동안 불러옴(rAF 멈춤) ════════
async function case6(c, srv, b) {
  const R = {};
  for (const [id, url, q12] of [['index', 'spikes/r0/pages/index.html', false], ['tidy-real', PROJ(opt.page), false], ['tidy-q12', PROJ(opt.page), true]]) {
    srv.cfg.q12 = q12;
    const a = await newPage(c, {});
    const front = await c.newPage();                     // 나중에 만든 탭이 앞 → a는 hidden(probe로 확인)
    await front.send('Page.bringToFront').catch(() => {});
    const visBefore = await a.page.evaluate('document.visibilityState');
    const t0 = Date.now();
    await L.navigate(a.page, srv.base + url, { waitLoad: false });
    const w = await L.waitReady(a.page, ['yes', 'timeout'], 40000);
    const s = await L.state(a.page);
    const p = await pdfA(a.page, `c6-${b}-${id}-hidden`);
    const ev = await L.events(a.page);
    R[id] = { visBefore, vis: s.vis, raf: s.raf, wallMs: Date.now() - t0, wait: w, ready: s.ready, firstYes: s.timing.firstYes, scenes: s.scenes, img: s.img, eager: s.eager, p,
      visEvents: ev.vis, pass: s.vis === 'hidden' && s.ready === 'yes' && p.pages === s.scenes && !p.notice };
    log(`  [6 ${b} ${id}] vis ${s.vis} raf ${s.raf} ready ${s.ready} @${Math.round(s.timing.firstYes)}ms scenes ${s.scenes} pdf ${p.pages} img ${s.img.done}/${s.img.n}`);
    await front.close(); await a.page.close();
    srv.cfg.q12 = false;
  }
  return R;
}

const CASES = { 1: case1, 2: case2, 3: case3, 4: case4, 5: case5, 6: case6 };
(async () => {
  const srv = await L.startServer();
  if (opt.kit === 'before') { srv.cfg.override = { '/spikes/r0/kit/scene-kit.js': path.join(__dirname, 'scene-kit.before-a4.js') }; log('# kit: 【시험대 4】 이전 사본'); }
  try {
    for (const b of opt.browser.split(',')) {
      await L.withBrowser(b, async (c) => {
        log(`# ${b} ${c.version}`);
        // 데우기: CDN(marked·mermaid·hljs·Pretendard·D2Coding)을 브라우저 캐시에 올려 둠 → 이후 시각은 "다시 방문" 기준(A1과 같음)
        { const t = Date.now(); const w = await newPage(c, {});
          for (const u of ['spikes/r0/pages/index.html', PROJ(opt.page)]) { await L.navigate(w.page, srv.base + u, { waitLoad: false }); await L.waitReady(w.page, ['yes'], 90000); }
          await w.page.close(); log(`  warm-up ${Date.now() - t}ms`); }
        for (const n of opt.case.split(',')) {
          const t = Date.now();
          let res;
          try { res = await CASES[n](c, srv, b); } catch (e) { res = { error: String(e.stack || e) }; log(`  [${n} ${b}] ERROR`, e.message); }
          srv.cfg.delay = null; srv.cfg.imgReleaseAt = 0; srv.cfg.q12 = false;
          fs.writeFileSync(path.join(L.OUT, `case${n}-${b}${opt.tag}.json`), JSON.stringify({ browser: c.version, page: opt.page, ms: Date.now() - t, res }, null, 1));
          log(`  case ${n} ${b} done ${Date.now() - t}ms`);
        }
      });
    }
  } finally { await srv.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
