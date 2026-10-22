#!/usr/bin/env node
// fix4-probe/probe.js — 【R0 결정 #14】 적대적 시험: 수정안 4 인쇄 규칙(덱 밖·덱 안 비장면 숨김) + 화면 매체 감사 outside-deck
//   --suite fixtures : fixtures.js 전부 × Chrome·Edge. 화면(1536×864@1.25) audit()/outside-deck → 인쇄 매체 AUDIT_DOC(T1) → PDF 3장(css1 bg1·bg0, css0 bg1)
//   --suite gate     : 게이트 안내 쪽(no·timeout·mount 전) 1쪽인지, [그래도 인쇄]·회복(yes) 뒤 덱 쪽 수(여러 배치)
//   --suite ui       : 키트 UI 상태(HUD 옆·알약, 건너뛰기 포커스, 요약만, 라이트박스, 배지) — 픽스처 A00과 실제 페이지 5개 × k ∈ {0.29, 0.75, 1.268}
//                      + 실제 페이지(Tidy) timeout 상태(이미지 지연)에서 HUD 경고·[그래도 인쇄]·인쇄 쪽 수
// 실행(PowerShell, 레포 루트): node spikes/r0/harness/fix4-probe/probe.js --suite fixtures [--kit /spikes/r0/kit/scene-kit.css] [--tag final] [--only <정규식>] [--browser both] [--port 4632]
// 결과: spikes/r0/out/fix4-probe/<tag>-<suite>.json·.md, PDF는 out/fix4-probe/<tag>-<suite>/, 생성 쪽은 out/fix4-probe/pages/<tag>/
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, sleep } = require('../lib/cdp');
const { serve } = require('../../a3/server');              // harness/lib/server.js와 같은 규칙 + rewrite 훅(키트 파일을 변형으로 바꿔 줌)
const { AUDIT_DOC, pdfPages } = require('../scene-print-check');
const { FIXTURES, pageHtml } = require('./fixtures');

const ROOT = path.resolve(__dirname, '../../../..');
const OUT = path.resolve(__dirname, '../../out/fix4-probe');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const PORT = +arg('port', 4632);
const SUITE = arg('suite', 'fixtures');
const KIT = arg('kit', '/spikes/r0/kit/scene-kit.css');
const TAG = arg('tag', 'final');
const ONLY = arg('only') ? new RegExp(arg('only')) : null;
const BROWSERS = arg('browser', 'both') === 'both' ? ['chrome', 'edge'] : [arg('browser')];
// --kit-css-file·--kit-js-file: /spikes/r0/kit/scene-kit.{css,js} 요청에 이 파일을 줌(실제 페이지·픽스처 모두). 공유 키트는 고치지 않음
const REWRITE = {};
if (arg('kit-css-file')) REWRITE['/spikes/r0/kit/scene-kit.css'] = path.resolve(arg('kit-css-file'));
if (arg('kit-js-file')) REWRITE['/spikes/r0/kit/scene-kit.js'] = path.resolve(arg('kit-js-file'));
const VP ={ w: 1536, h: 864, dpr: 1.25, mobile: false };
const GUIDE = '아직페이지를그리는중입니다';
const SHOTS = new Set(['A06', 'A07', 'A08', 'A17', 'A19', 'I06', 'I09', 'I10', 'I11', 'I15', 'I17', 'A23', 'A24', 'A25', 'K06']);

const pagesDir = path.join(OUT, 'pages', TAG);
const pageUrl = (base, id, q = '') => `${base}spikes/r0/out/fix4-probe/pages/${TAG}/${id}.html${q ? '?' + q : ''}`;
let slowSrc = null;                                         // ui suite: 실제 페이지 이미지 지연(정규식)

// ── 페이지 안 수집기 ──
const SCREEN = `JSON.stringify((() => {
  const t0 = performance.now(); const a = PFScene.audit(); const ms = performance.now() - t0;
  const od = a.filter((x) => x.type === 'outside-deck');
  return { ready: document.documentElement.dataset.pfReady, count: PFScene.count, k: PFScene.k, hud: document.querySelector('.pf-hud')?.dataset.place || null,
    auditMs: +ms.toFixed(1), types: [...new Set(a.map((x) => x.type))], od: od.map(({ el, text, why, pos }) => ({ el, text, why, pos })),
    docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth };
})())`;
const PRINT_KIT = `JSON.stringify((() => { const r = PFScene.report(); return { media: r.media, outsideDeck: r.outsideDeck, types: [...new Set(r.audit.map((x) => x.type))] }; })())`;

// 키트 UI 상태 시험(화면 매체). 상태마다 outside-deck 수
const UI_PROBE = `(async () => {
  const od = () => PFScene.audit().filter((x) => x.type === 'outside-deck');
  const sample = () => od().map((x) => x.detail).slice(0, 3);
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const r = { hud: document.querySelector('.pf-hud')?.dataset.place, k: PFScene.k, base: od().length, baseSample: sample() };
  const sk = document.querySelector('.pf-skiplink'); sk?.focus(); await wait(30);
  r.skipFocus = od().length; r.skipVisible = sk ? sk.getBoundingClientRect().top >= 0 : null; document.activeElement?.blur();
  const hasDoc = [...document.querySelectorAll('.pf-deck > .pf-scene')].some((s) => s.dataset.pfPart === 'doc');
  if (hasDoc) { PFScene.setScope('summary'); await wait(30); r.summary = od().length; PFScene.setScope('all'); }
  // 라이트박스(assets/common.js와 같은 dialog.lightbox)
  const d = document.createElement('dialog'); d.className = 'lightbox'; d.innerHTML = '<img alt="" style="width:300px;height:150px;background:#2F6FEB"><p>LB</p>'; document.body.appendChild(d); d.showModal(); await wait(30);
  r.lightbox = od().length; r.lightboxTypes = [...new Set(PFScene.audit().map((x) => x.type))]; d.close(); d.remove();
  const p = document.createElement('div'); p.className = 'pf-lightbox'; p.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);color:#fff;font:20px Arial'; p.textContent = 'PFLB'; document.body.appendChild(p); await wait(30);
  r.pfLightbox = od().length; p.remove();
  // localhost 배지: 문제 하나를 넣어 배지를 띄운 뒤, 문제를 빼고(배지는 그대로 보임) 다시 셈
  const bad = document.createElement('p'); bad.textContent = 'BADGE-TRIGGER'; bad.style.font = '20px Arial'; document.body.appendChild(bad);
  PFScene.refresh(); await wait(30);
  const b = document.querySelector('.pf-hud-badge'); r.badgeShown = b ? !b.hidden && b.textContent : null; r.withTrigger = od().length;
  bad.remove(); await wait(30); r.badgeStillShown = b ? !b.hidden : null; r.afterBadge = od().length; r.afterBadgeSample = sample();
  PFScene.refresh();
  return r;
})()`;

// ── PDF 분석(a3-pdf.py) ──
function analyze(jobs) {
  if (!jobs.length) return [];
  const jf = path.join(OUT, `${TAG}-${SUITE}-jobs.json`);
  fs.writeFileSync(jf, JSON.stringify(jobs));
  return execFileSync('python', ['-I', path.resolve(__dirname, '../../a3/a3-pdf.py'), jf], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim().split(/\r?\n/).map((l) => JSON.parse(l));
}
function jobFor(t, p, n) {
  const probes = p.css ? (t.probes || []).map((q) => ({ ...q, x: q.x * 0.75, y: q.y * 0.75, tol: 10, r: 3, mode: 'median' })) : [];
  return { file: p.file, w: p.css ? 960 : null, h: p.css ? 540 : null, n, labels: true, probes,
    required: (t.required || []).map(({ text, page }) => ({ text, page })), forbidden: t.forbidden || [], colors: [], keepText: false };
}
function printFails(t, p, a, n) {
  const f = [];
  if (a.error) return ['분석 실패 ' + a.error];
  if (a.pages !== n) f.push(`쪽 ${a.pages}/${n}`);
  if (p.css && a.badSize.length) f.push(`크기 ${Object.keys(a.sizes).join(',')}`);
  if (a.blank.length) f.push(`빈 쪽 ${a.blank.slice(0, 4).join(',')}`);
  if (a.outside.length) f.push(`쪽 밖 글자 ${a.outside.length}쪽`);
  if (a.seq.length && a.pages === n) f.push(`표식 ${a.seq.slice(0, 2).map((s) => `${s.page}:${(s.mine || []).join('+') || '없음'}${s.others && s.others.length ? '(+' + s.others.join(',') + ')' : ''}`).join(' ')}`);
  if (a.seq.length && a.pages !== n) { const miss = a.seq.filter((s) => s.page && !(s.mine || []).length).map((s) => s.page); if (miss.length) f.push(`표식 없는 쪽 ${miss.slice(0, 4).join(',')}`); }
  (t.required || []).forEach((r, i) => { const x = a.required[i]; if (!x) return;
    if (!x.ok) f.push(`글자 없음 ${r.text}${x.foundOn.length ? '(→' + x.foundOn.join(',') + ')' : ''}`);
    else if (r.only && (x.foundOn.length !== 1 || x.foundOn[0] !== r.page)) f.push(`${r.text} 여러 쪽 ${x.foundOn.join(',')}`); });
  if (a.forbidden.length) f.push(`덱 밖 글자 인쇄 ${a.forbidden.slice(0, 3).map((x) => `${x.text}@${x.foundOn.join(',')}`).join(' ')}`);
  const bp = a.probes.filter((x) => !x.ok);
  if (bp.length) f.push(`색 ${bp.map((x) => `${x.name}@${x.page} ${JSON.stringify(x.got)}≠${JSON.stringify(x.want)}`).join('; ')}`);
  return f;
}

// ── 공통: 이동·대기 ──
async function nav(page, url, vp, { waitLoad = true } = {}) {
  await page.send('Emulation.setEmulatedMedia', { media: '' });
  await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: !!vp.mobile });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: !!vp.mobile, maxTouchPoints: vp.mobile ? 5 : 1 }).catch(() => {});
  const loaded = page.once('Page.loadEventFired', 60000);
  await page.send('Page.navigate', { url });
  if (waitLoad) await loaded;
}
async function waitReady(page, want, ms) {
  const t0 = Date.now(); let r = '';
  while (Date.now() - t0 < ms) { r = await page.evaluate('document.documentElement.dataset.pfReady || ""').catch(() => ''); if (r === want) return { ok: true, ms: Date.now() - t0 }; await sleep(50); }
  return { ok: false, last: r, ms: Date.now() - t0 };
}
async function printAudit(page) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(120);
  const a = await page.evaluate(AUDIT_DOC).catch((e) => ({ error: String(e) }));
  const k = await page.evaluate(PRINT_KIT).then(JSON.parse).catch((e) => ({ error: String(e) }));
  await page.send('Emulation.setEmulatedMedia', { media: '' });
  return a.error ? { error: a.error, kit: k } : { printScenes: a.printScenes, docH: a.docH, docW: a.docW, docTypes: [...new Set(a.issues.map((x) => x.type))], sceneTypes: [...new Set((a.sceneAudit || []).map((x) => x.type))], sample: [...a.issues, ...(a.sceneAudit || [])].slice(0, 4).map((x) => `${x.type}:${x.scene || ''} ${x.detail || ''}`), kit: k };
}
async function pdf(page, file, css, bg) {
  const r = await page.send('Page.printToPDF', { preferCSSPageSize: css, printBackground: bg, transferMode: 'ReturnAsBase64' });
  const buf = Buffer.from(r.data, 'base64'); fs.writeFileSync(file, buf);
  return { file, css, bg, ...pdfPages(buf) };
}
async function shot(page, file) {
  const m = await page.send('Page.getLayoutMetrics');
  const cs = m.cssContentSize || m.contentSize;
  const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.min(cs.width, 3000), height: Math.min(cs.height, 4000), scale: 0.4 } });
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
}

// ── suite: fixtures ──
async function suiteFixtures(base, R) {
  const list = FIXTURES.filter((t) => !ONLY || ONLY.test(t.id));
  const pdfDir = path.join(OUT, `${TAG}-fixtures`); fs.mkdirSync(pdfDir, { recursive: true });
  const shotDir = path.join(OUT, 'shots'); fs.mkdirSync(shotDir, { recursive: true });
  for (const b of BROWSERS) {
    const c = await launch(b); R.browsers[b] = c.version;
    try {
      const page = await c.newPage();
      for (const t of list) {
        const rec = { id: t.id, browser: b, prints: [] };
        try {
          await nav(page, pageUrl(base, t.id), VP);
          rec.wait = await waitReady(page, 'yes', 20000);
          await sleep(80);
          rec.screen = await page.evaluate(SCREEN).then(JSON.parse);
          // 끝까지 스크롤한 뒤 다시 감사(스크롤 등장 내용, A29) — 하네스 T1 보완 후보
          rec.odScrolled = await page.evaluate(`(async () => { const w = (ms) => new Promise((q) => setTimeout(q, ms)); for (let y = 0; y <= document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await w(60); } scrollTo(0, document.documentElement.scrollHeight); await w(400); const n = PFScene.audit().filter((x) => x.type === 'outside-deck').length; scrollTo(0, 0); await w(60); return n; })()`);
          if (b === 'chrome' && SHOTS.has(t.id)) { await shot(page, path.join(shotDir, `${TAG}__${t.id}.png`)); rec.shot = `shots/${TAG}__${t.id}.png`; }
          rec.print = await printAudit(page);
          await page.send('Emulation.setDeviceMetricsOverride', { width: VP.w, height: VP.h, deviceScaleFactor: VP.dpr, mobile: false });
          await sleep(80);
          for (const [css, bg] of [[true, true], [true, false], [false, true]]) rec.prints.push(await pdf(page, path.join(pdfDir, `${b}__${t.id}__css${+css}__bg${+bg}.pdf`), css, bg));
          console.log(`${b} ${t.id} ready=${rec.screen.ready} od=${rec.screen.od.length} types=${rec.screen.types.join(',') || '-'} pdf=${rec.prints.map((p) => p.count).join('/')} doc=${(rec.print.docTypes || []).join(',') || '-'}`);
        } catch (e) { rec.error = String(e.stack || e); console.log(`${b} ${t.id} 오류 ${e.message}`); }
        R.runs.push(rec);
      }
      await page.close();
    } finally { await c.close(); }
  }
  // 분석
  const jobs = [], idx = [];
  for (const rec of R.runs) { if (rec.error) continue; const t = FIXTURES.find((x) => x.id === rec.id); rec.prints.forEach((p, i) => { jobs.push(jobFor(t, p, t.pages ?? t.n)); idx.push([rec, i]); }); }
  analyze(jobs).forEach((a, k) => { const [rec, i] = idx[k]; const t = FIXTURES.find((x) => x.id === rec.id); const p = rec.prints[i];
    p.analysis = { pages: a.pages, sizes: a.sizes, blank: a.blank, forbidden: a.forbidden, required: a.required, probes: a.probes, seq: a.seq.slice(0, 3) };
    p.fails = printFails(t, p, a, t.pages ?? t.n); p.file = path.relative(OUT, p.file); });
  R.rows = list.map((t) => {
    const runs = R.runs.filter((r) => r.id === t.id);
    const odN = Object.fromEntries(runs.map((r) => [r.browser, r.error ? null : r.screen.od.length]));
    const vals = Object.values(odN);
    const audit = vals.some((v) => v == null) ? 'error' : t.od > 0 ? (vals.every((v) => v >= 1) ? 'OK' : 'FN(못 잡음)') : (vals.every((v) => v === 0) ? 'OK' : 'FP(오탐)');
    const fails = runs.flatMap((r) => (r.prints || []).map((p) => ({ cell: `${r.browser[0]}${p.css ? 1 : 0}${p.bg ? 1 : 0}`, fails: p.fails || ['?'] })));
    const printOk = runs.length && runs.every((r) => !r.error) && fails.every((x) => !x.fails.length);
    const harness = runs.map((r) => r.error ? 'error' : [...(r.print.docTypes || []), ...(r.print.sceneTypes || [])].join(',') || '-');
    return { id: t.id, grp: t.grp, name: t.name, od: t.od, printNote: t.printNote || '', odN, audit, printOk, fails,
      kitScreenTypes: Object.fromEntries(runs.map((r) => [r.browser, r.screen && r.screen.types])), odItems: Object.fromEntries(runs.map((r) => [r.browser, r.screen && r.screen.od])),
      harness: Object.fromEntries(runs.map((r, i) => [r.browser, harness[i]])), auditMs: Object.fromEntries(runs.map((r) => [r.browser, r.screen && r.screen.auditMs])),
      count: Object.fromEntries(runs.map((r) => [r.browser, r.screen && r.screen.count])), shot: runs.find((r) => r.shot)?.shot || null,
      odScrolled: Object.fromEntries(runs.map((r) => [r.browser, r.odScrolled])),
      printKit: Object.fromEntries(runs.map((r) => [r.browser, r.print && r.print.kit])) };
  });
}
function mdFixtures(R) {
  const L = [`# fix4-probe 픽스처 (${R.tag}, 키트 CSS \`${R.kit}\`)`, '', `- 실행 ${R.date}, 화면 ${VP.w}×${VP.h}@${VP.dpr}, 서버 127.0.0.1:${PORT}, 브라우저 ${Object.entries(R.browsers).map(([b, v]) => `${b} ${v}`).join(' · ')}`,
    '- 인쇄 칸: c/e = Chrome/Edge, 11 = preferCSSPageSize true·배경 켬, 10 = true·끔, 01 = false(Letter)·켬. 계약 = 쪽 수 = 덱 장면 수, 960×540pt(css1), 빈 쪽 0, i쪽에 S{i}-TOP·BOT만, 덱 밖 글자 없음',
    '- 감사 기대 = 덱 밖에 화면에서 보이는 내용 수(정답). OK / FN(보이는데 못 잡음) / FP(안 보이는데 잡음)', '',
    '| ID | 묶음 | 내용 | 인쇄 | 인쇄 실패 칸 | 감사 기대 | outside-deck c/e | 감사 | 키트 audit(화면) 유형 | 인쇄 매체 감사(AUDIT_DOC·키트) c |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of R.rows) {
    const bad = r.fails.filter((x) => x.fails.length);
    const cells = bad.length ? [...new Set(bad.map((x) => x.fails.join('; ')))].map((f) => `${bad.filter((x) => x.fails.join('; ') === f).map((x) => x.cell).join(',')}: ${f}`).join(' / ').replace(/\|/g, '/').slice(0, 260) : '';
    L.push(`| ${r.id} | ${r.grp} | ${r.name.replace(/\|/g, '/')}${r.printNote ? ` _(${r.printNote})_` : ''} | ${r.printOk ? 'PASS' : '**FAIL**'} | ${cells} | ${r.od ? '≥' + r.od : '0'} | ${Object.values(r.odN).join('/')} | ${r.audit === 'OK' ? 'OK' : '**' + r.audit + '**'} | ${(r.kitScreenTypes.chrome || []).join(',') || '-'} | ${r.harness.chrome || '-'} |`);
  }
  L.push('', '## outside-deck 항목(Chrome)', '');
  for (const r of R.rows) { const x = r.odItems.chrome; if (x && x.length) L.push(`- ${r.id}: ${x.map((o) => `<${o.el}> ${o.pos} ${o.why} "${o.text}"`).join(' / ').replace(/\|/g, '/')}`); }
  L.push('', '## 기타', '');
  for (const r of R.rows) L.push(`- ${r.id}: 키트 장면 수 c/e ${Object.values(r.count).join('/')}, audit() ${Object.values(r.auditMs).join('/')}ms, 끝까지 스크롤한 뒤 outside-deck c/e ${Object.values(r.odScrolled || {}).join('/')}, 인쇄 매체 키트 report ${JSON.stringify(r.printKit.chrome)}${r.shot ? `, 화면 캡처 \`${r.shot}\`` : ''}`);
  return L.join('\n') + '\n';
}

// ── suite: gate ──
const GATE_SET = ['A00', 'A01', 'A02', 'A03', 'A05', 'W01', 'W02', 'W03', 'W04', 'W05', 'S01', 'A24'];
async function suiteGate(base, R) {
  const list = FIXTURES.filter((t) => GATE_SET.includes(t.id) && (!ONLY || ONLY.test(t.id)));
  const pdfDir = path.join(OUT, `${TAG}-gate`); fs.mkdirSync(pdfDir, { recursive: true });
  const jobs = [], idx = [];
  for (const b of BROWSERS) {
    const c = await launch(b); R.browsers[b] = c.version;
    try {
      const page = await c.newPage();
      for (const t of list) {
        const rec = { id: t.id, browser: b, steps: [] };
        const step = async (name, expectN, labels) => { const p = await pdf(page, path.join(pdfDir, `${b}__${t.id}__${name}.pdf`), true, true); p.name = name; p.expectN = expectN; p.labels = labels;
          p.state = await page.evaluate('JSON.stringify({ ready: document.documentElement.dataset.pfReady, anyway: "pfPrintAnyway" in document.documentElement.dataset })').then(JSON.parse); rec.steps.push(p); };
        try {
          // ① no(준비 전): 영원히 안 끝나는 track, timeout 기본 20초
          await nav(page, pageUrl(base, `${t.id}__gate`), VP); await sleep(150);
          await step('no', 1, false);
          // ② mount 전(no)
          await nav(page, pageUrl(base, `${t.id}__nomount`), VP); await sleep(150);
          await step('nomount', 1, false);
          // ③ timeout → 화면 감사(HUD 경고·[그래도 인쇄] 보임) → 인쇄 안내 → [그래도 인쇄] → 회복(yes)
          await nav(page, pageUrl(base, `${t.id}__gate`, 'pf-timeout=300'), VP);
          rec.waitTimeout = await waitReady(page, 'timeout', 8000); await sleep(100);
          rec.timeoutScreen = await page.evaluate(`JSON.stringify({ od: PFScene.audit().filter((x) => x.type === 'outside-deck').map((x) => x.detail), hudMsg: document.querySelector('.pf-hud-msg')?.textContent || null, anywayVisible: !!document.querySelector('[data-a=anyway]') && !document.querySelector('[data-a=anyway]').hidden })`).then(JSON.parse);
          await step('timeout', 1, false);
          await page.evaluate("(document.documentElement.dataset.pfPrintAnyway = '', 1)");
          await step('anyway', t.n, true);
          rec.afterAnyway = await page.evaluate('"pfPrintAnyway" in document.documentElement.dataset');
          await page.evaluate('(window.__release(), 1)');
          rec.waitYes = await waitReady(page, 'yes', 8000); await sleep(80);
          await step('yes', t.n, true);
          console.log(`${b} ${t.id} ${rec.steps.map((s) => `${s.name}=${s.count}`).join(' ')} timeoutOd=${rec.timeoutScreen.od.length} anyway버튼=${rec.timeoutScreen.anywayVisible}`);
        } catch (e) { rec.error = String(e.stack || e); console.log(`${b} ${t.id} 오류 ${e.message}`); }
        R.runs.push(rec);
        (rec.steps || []).forEach((s, i) => { jobs.push({ file: s.file, w: 960, h: 540, n: s.expectN, labels: s.labels, probes: [], required: s.labels ? [] : [{ text: GUIDE, page: 1 }], forbidden: s.labels ? [GUIDE] : ['S1-TOP', 'S2-TOP', 'S3-TOP', 'S1-BOT'], colors: [] }); idx.push([rec, i]); });
      }
      await page.close();
    } finally { await c.close(); }
  }
  analyze(jobs).forEach((a, k) => { const [rec, i] = idx[k]; const s = rec.steps[i];
    const f = [];
    if (a.pages !== s.expectN) f.push(`쪽 ${a.pages}/${s.expectN}`);
    if (a.badSize.length) f.push(`크기 ${Object.keys(a.sizes).join(',')}`);
    if (a.blank.length) f.push(`빈 쪽 ${a.blank.join(',')}`);
    if (s.labels && a.seq.length && a.pages === s.expectN) f.push('표식 순서');
    if (!s.labels && a.required.some((x) => !x.ok)) f.push('안내 문구 없음');
    if (a.forbidden.length) f.push(`금지 글자 ${a.forbidden.map((x) => x.text).join(',')}`);
    s.fails = f; s.file = path.relative(OUT, s.file); s.analysis = { pages: a.pages, blank: a.blank, sizes: a.sizes }; });
}
function mdGate(R) {
  const L = [`# fix4-probe 게이트 (${R.tag}, 키트 CSS \`${R.kit}\`)`, '', `- 실행 ${R.date}, 화면 ${VP.w}×${VP.h}@${VP.dpr}, printToPDF preferCSSPageSize:true·배경 켬, 서버 127.0.0.1:${PORT}`,
    '- no = 끝나지 않는 track(기본 timeout 20초), nomount = mount 안 부름, timeout = ?pf-timeout=300, anyway = timeout + data-pf-print-anyway, yes = track 해제 뒤 회복',
    '- 기대: no·nomount·timeout = 안내 1쪽(안내 문구 있음, 장면 표식 없음), anyway·yes = 장면 수 쪽·표식 순서', '',
    '| 픽스처 | 브라우저 | no | nomount | timeout | anyway | yes | timeout 화면: outside-deck · HUD 경고 · [그래도 인쇄] |', '|---|---|---|---|---|---|---|---|'];
  for (const r of R.runs) {
    if (r.error) { L.push(`| ${r.id} | ${r.browser} | 오류 ${r.error.slice(0, 80)} ||||||`); continue; }
    const c = (n) => { const s = r.steps.find((x) => x.name === n); return s ? `${s.analysis.pages}쪽${s.fails.length ? ' **' + s.fails.join('; ') + '**' : ' P'}` : '—'; };
    L.push(`| ${r.id} | ${r.browser} | ${c('no')} | ${c('nomount')} | ${c('timeout')} | ${c('anyway')} | ${c('yes')} | ${r.timeoutScreen.od.length} · "${(r.timeoutScreen.hudMsg || '').slice(0, 30)}" · ${r.timeoutScreen.anywayVisible} |`);
  }
  return L.join('\n') + '\n';
}

// ── suite: ui (키트 UI 상태 + 실제 페이지) ──
const REAL = ['spikes/r0/pages/index.html', 'spikes/r0/pages/project.html?p=00-example-crafting', 'spikes/r0/pages/project.html?p=0-Tidy-Mommy', 'spikes/r0/pages/project.html?p=1-action-platformer', 'spikes/r0/pages/project.html?p=2-Yggdrasil'];
const UI_VPS = [{ w: 375, h: 812, dpr: 3, mobile: true, name: 'k0.29(375 폰)' }, { w: 975, h: 1000, dpr: 1, name: 'k0.75(975)' }, { w: 1920, h: 945, dpr: 1, name: 'k1.268(FHD)' }];
async function suiteUi(base, R) {
  const pdfDir = path.join(OUT, `${TAG}-ui`); fs.mkdirSync(pdfDir, { recursive: true });
  const targets = [{ id: 'A00', url: (q) => pageUrl(base, 'A00', q) }, ...REAL.map((p) => ({ id: p.replace(/^.*\//, ''), url: (q) => base + p + (q ? (p.includes('?') ? '&' : '?') + q : '') }))].filter((x) => !ONLY || ONLY.test(x.id));
  for (const b of BROWSERS) {
    const c = await launch(b); R.browsers[b] = c.version;
    try {
      const page = await c.newPage();
      for (const vp of UI_VPS) for (const tg of targets) {
        const rec = { id: tg.id, browser: b, vp: vp.name };
        try {
          await nav(page, tg.url(''), vp);
          rec.wait = await waitReady(page, 'yes', 90000); await sleep(150);
          rec.screen = await page.evaluate(SCREEN).then(JSON.parse);
          rec.ui = await page.evaluate(UI_PROBE);
          rec.print = await printAudit(page);
          await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: !!vp.mobile }); await sleep(100);
          const p = await pdf(page, path.join(pdfDir, `${b}__${tg.id.replace(/[^\w.-]+/g, '_')}__${vp.w}.pdf`), true, true);
          rec.pdf = { pages: p.count, badBox: p.boxes.filter((x) => Math.abs(x[2] - x[0] - 960) > 0.01 || Math.abs(x[3] - x[1] - 540) > 0.01).length, file: path.relative(OUT, p.file) };
          const u = rec.ui;
          rec.ok = rec.wait.ok && rec.screen.od.length === 0 && u.skipFocus === 0 && (u.summary ?? 0) === 0 && u.lightbox === 0 && u.pfLightbox === 0 && u.withTrigger === 1 && u.afterBadge === 0 && rec.print.kit.outsideDeck === 0 && rec.pdf.pages === rec.screen.count && !rec.pdf.badBox;
          console.log(`${rec.ok ? 'OK' : 'NG'} ${b} ${vp.name} ${tg.id} k=${(+rec.screen.k).toFixed(3)} hud=${u.hud} od=${rec.screen.od.length} skip=${u.skipFocus} sum=${u.summary ?? '-'} lb=${u.lightbox}/${u.pfLightbox} badge=${u.badgeShown}→${u.badgeStillShown} trig=${u.withTrigger} after=${u.afterBadge} pdf=${rec.pdf.pages}/${rec.screen.count} audit=${rec.screen.auditMs}ms`);
        } catch (e) { rec.error = String(e.stack || e); console.log(`${b} ${vp.name} ${tg.id} 오류 ${e.message}`); }
        R.runs.push(rec);
      }
      // 실제 페이지 timeout 상태: 문서 시작 전에 끝나지 않는 track 하나를 등록(렌더·mount는 정상) + ?pf-timeout=9000 → timeout 상태의 HUD
      for (const vp of [UI_VPS[2], UI_VPS[0]]) {
        if (ONLY && !ONLY.test('timeout')) continue;
        const rec = { id: 'project.html?p=0-Tidy-Mommy(timeout)', browser: b, vp: vp.name };
        let sid = null;
        try {
          sid = (await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const iv = setInterval(() => { if (window.PFScene && PFScene.track) { clearInterval(iv); PFScene.track(new Promise((r) => { window.__release = r; })); } }, 0); })();` })).identifier;
          await nav(page, base + 'spikes/r0/pages/project.html?p=0-Tidy-Mommy&pf-timeout=9000', vp);
          rec.waitTimeout = await waitReady(page, 'timeout', 30000);
          for (let i = 0; i < 100; i++) { if (await page.evaluate('PFScene.count > 0').catch(() => false)) break; await sleep(100); }
          await sleep(200);
          rec.screen = await page.evaluate(SCREEN).then(JSON.parse);
          rec.hud = await page.evaluate(`JSON.stringify({ msg: document.querySelector('.pf-hud-msg')?.textContent, anyway: !document.querySelector('[data-a=anyway]').hidden, badge: document.querySelector('.pf-hud-badge') && !document.querySelector('.pf-hud-badge').hidden })`).then(JSON.parse);
          const p1 = await pdf(page, path.join(pdfDir, `${b}__tidy-timeout__${vp.w}.pdf`), true, true);
          await page.evaluate("(document.documentElement.dataset.pfPrintAnyway = '', 1)");
          const p2 = await pdf(page, path.join(pdfDir, `${b}__tidy-anyway__${vp.w}.pdf`), true, true);
          rec.stillTimeout = await page.evaluate('document.documentElement.dataset.pfReady');
          await page.evaluate('(window.__release(), 1)');
          rec.waitYes = await waitReady(page, 'yes', 40000); await sleep(150);
          const p3 = await pdf(page, path.join(pdfDir, `${b}__tidy-yes__${vp.w}.pdf`), true, true);
          rec.pdf = { timeout: p1.count, anyway: p2.count, yes: p3.count, files: [p1, p2, p3].map((p) => path.relative(OUT, p.file)) };
          rec.guide = analyze([{ file: p1.file, w: 960, h: 540, n: 1, labels: false, probes: [], required: [{ text: GUIDE, page: 1 }], forbidden: [], colors: [] }])[0].required[0].ok;
          rec.ok = rec.waitTimeout.ok && rec.screen.od.length === 0 && rec.hud.anyway && p1.count === 1 && rec.guide && p2.count === rec.screen.count && p3.count === rec.screen.count;
          console.log(`${rec.ok ? 'OK' : 'NG'} ${b} ${vp.name} Tidy timeout: od=${rec.screen.od.length} hud="${rec.hud.msg}" anyway=${rec.hud.anyway} pdf timeout=${p1.count}(안내 ${rec.guide}) anyway=${p2.count} yes=${p3.count} 장면=${rec.screen.count}`);
        } catch (e) { rec.error = String(e.stack || e); console.log(`${b} timeout 오류 ${e.message}`); }
        if (sid) await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: sid }).catch(() => {});
        R.runs.push(rec);
      }
      await page.close();
    } finally { await c.close(); }
  }
}
function mdUi(R) {
  const L = [`# fix4-probe 키트 UI·실제 페이지 (${R.tag}, 키트 CSS \`${R.kit}\`)`, '', `- 실행 ${R.date}, 서버 127.0.0.1:${PORT}, ${Object.entries(R.browsers).map(([b, v]) => `${b} ${v}`).join(' · ')}`,
    '- 상태별 outside-deck 수(모두 0이어야 함, 배지 유발 trig만 1): 기본 · 건너뛰기 포커스 · 요약만 · dialog.lightbox 열림 · .pf-lightbox · 배지 유발(덱 밖 <p>) → 배지 보임 상태에서 <p> 뺀 뒤', '',
    '| 판정 | 브라우저 | 뷰포트 | 페이지 | k | HUD | 기본 | 건너뛰기 | 요약만 | 라이트박스 | pf-lightbox | 배지 유발 → 뺀 뒤(배지 보임) | 인쇄 매체 | PDF/장면 | audit() ms |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of R.runs.filter((x) => x.ui || (x.error && !x.hud))) {
    if (r.error) { L.push(`| 오류 | ${r.browser} | ${r.vp} | ${r.id} | ${r.error.slice(0, 80)} ||||||||||`); continue; }
    const u = r.ui;
    L.push(`| ${r.ok ? 'OK' : '**NG**'} | ${r.browser} | ${r.vp} | ${r.id} | ${(+r.screen.k).toFixed(3)} | ${u.hud} | ${r.screen.od.length} | ${u.skipFocus}${u.skipVisible ? '(보임)' : ''} | ${u.summary ?? '—'} | ${u.lightbox} | ${u.pfLightbox} | ${u.withTrigger} → ${u.afterBadge} (${u.badgeStillShown}) | ${r.print.kit.media}/${r.print.kit.outsideDeck} | ${r.pdf.pages}/${r.screen.count}${r.pdf.badBox ? ' 크기!' : ''} | ${r.screen.auditMs} |`);
  }
  L.push('', '## 실제 페이지 timeout 상태(Tidy 이미지 15초 지연, ?pf-timeout=1500)', '', '| 판정 | 브라우저 | 뷰포트 | outside-deck | HUD 경고 | [그래도 인쇄] 보임 | 인쇄(timeout) | 안내 문구 | [그래도 인쇄] | 회복 yes | 장면 |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of R.runs.filter((x) => x.hud || (x.error && /timeout/.test(x.id)))) {
    if (r.error) { L.push(`| 오류 | ${r.browser} | ${r.vp} | ${r.error.slice(0, 100)} ||||||||`); continue; }
    L.push(`| ${r.ok ? 'OK' : '**NG**'} | ${r.browser} | ${r.vp} | ${r.screen.od.length} | ${r.hud.msg} | ${r.hud.anyway} | ${r.pdf.timeout}쪽 | ${r.guide} | ${r.pdf.anyway}쪽 | ${r.pdf.yes}쪽 | ${r.screen.count} |`);
  }
  return L.join('\n') + '\n';
}

// ── 실행 ──
(async () => {
  fs.mkdirSync(pagesDir, { recursive: true });
  for (const t of FIXTURES) {
    fs.writeFileSync(path.join(pagesDir, `${t.id}.html`), pageHtml(t, { kitCss: KIT }));
    fs.writeFileSync(path.join(pagesDir, `${t.id}__gate.html`), pageHtml(t, { kitCss: KIT, gate: 'track' }));
    fs.writeFileSync(path.join(pagesDir, `${t.id}__nomount.html`), pageHtml(t, { kitCss: KIT, gate: 'nomount' }));
  }
  const server = await serve(ROOT, PORT, { rewrite: REWRITE, delay: (p) => (slowSrc && slowSrc.test(p) && /\.(png|gif|jpe?g|webp)$/i.test(p) ? 15000 : 0) });
  const R = { tag: TAG, suite: SUITE, kit: KIT + (Object.keys(REWRITE).length ? ` (rewrite ${Object.entries(REWRITE).map(([k, v]) => `${k} → ${path.relative(ROOT, v)}`).join(', ')})` : ''), date: new Date().toISOString(), browsers: {}, runs: [] };
  const t0 = Date.now();
  try {
    if (SUITE === 'fixtures') await suiteFixtures(server.base, R);
    else if (SUITE === 'gate') await suiteGate(server.base, R);
    else if (SUITE === 'ui') await suiteUi(server.base, R);
    else throw new Error('suite?');
  } finally { await server.close(); }
  R.totalMs = Date.now() - t0;
  fs.writeFileSync(path.join(OUT, `${TAG}-${SUITE}.json`), JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, `${TAG}-${SUITE}.md`), SUITE === 'fixtures' ? mdFixtures(R) : SUITE === 'gate' ? mdGate(R) : mdUi(R));
  console.log(`\n${path.join(OUT, `${TAG}-${SUITE}.md`)} (${Math.round(R.totalMs / 1000)}초)`);
})().catch((e) => { console.error(e); process.exit(2); });
