#!/usr/bin/env node
// scene-print-check.js — R0 시험대 하네스(01 §11). 프로토타입 scratchpad\scene\print-recipe\harness\scene-print-check.js를 옮겨
//   통합 키트(PFScene.audit()·report()·data-pf-ready)와 형제 구조 화면 배치 검사를 더했습니다. 의존성 0(Node 22+), --deep은 Python + PyMuPDF.
//   T1 = 화면 매체 감사(인쇄 전, PFScene.audit()의 outside-deck — 【R0 결정 #14】) + 인쇄 매체 DOM 감사(AUDIT_DOC + PFScene.audit()).
// 실행(PowerShell에서. Git Bash에서는 Edge 파이프 연결이 끊김):
//   node spikes/r0/harness/scene-print-check.js --browser both "spikes/r0/pages/project.html?p=0-Tidy-Mommy"
// 옵션: --root <dir>(기본 레포 루트) --port <n>(기본 4621) --browser chrome|edge|both --viewport 1920x945@1 --out <dir> --no-deep --scope(요약만 PDF도)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');

const W = 1280, H = 720, PT = { w: 960, h: 540 };

// ── 인쇄 매체 + 뷰포트 = 캔버스에서의 문서 단위 검사(T1의 덱 항목). 장면 단위는 PFScene.audit()이 함 ──
const AUDIT_DOC = `(() => {
  const issues = [];
  const scenes = [...document.querySelectorAll('.pf-scene')].filter((s) => s.getClientRects().length > 0 && !s.closest('.pf-measure'));
  if (!scenes.length) issues.push({ type: 'no-scenes', detail: '인쇄되는 장면이 없습니다' });
  if (new Set(scenes.map((s) => s.parentElement)).size > 1) issues.push({ type: 'parents', detail: '장면이 서로 다른 부모에 흩어져 있습니다' });
  scenes.forEach((s, i) => {
    const r = s.getBoundingClientRect(), top = r.top + scrollY;
    if (Math.abs(r.width - ${W}) > 0.01 || Math.abs(r.height - ${H}) > 0.01) issues.push({ type: 'size', scene: i + 1, detail: r.width + 'x' + r.height });
    if (Math.abs(top - i * ${H}) > 0.02) issues.push({ type: 'position', scene: i + 1, detail: 'top ' + top + ' ≠ ' + i * ${H} });
    if (i > 0 && getComputedStyle(s).breakBefore !== 'page') issues.push({ type: 'break', scene: i + 1, detail: 'break-before ' + getComputedStyle(s).breakBefore });
  });
  const docH = document.documentElement.scrollHeight, docW = document.documentElement.scrollWidth;
  if (docH > scenes.length * ${H} + 0.5) issues.push({ type: 'doc-height', detail: docH + ' > ' + scenes.length * ${H} });
  if (docW > ${W} + 0.5) issues.push({ type: 'doc-width', detail: String(docW) });
  document.querySelectorAll('body *').forEach((e) => { const c = getComputedStyle(e);
    if ((c.position === 'fixed' || c.position === 'sticky') && e.getClientRects().length && c.visibility !== 'hidden') issues.push({ type: 'fixed', detail: '<' + e.tagName.toLowerCase() + '.' + (e.className || '') + '> ' + c.position }); });
  document.querySelectorAll('dialog[open], :popover-open').forEach((e) => { if (e.getClientRects().length) issues.push({ type: 'dialog', detail: e.tagName }); });
  const imgs = [...document.images].filter((i) => i.getClientRects().length);
  const lazy = imgs.filter((i) => i.loading === 'lazy');
  if (lazy.length) issues.push({ type: 'lazy', detail: lazy.length + '개 loading=lazy 남음(실제 대화상자는 화면 밖 lazy를 빼고 인쇄)' });
  const broken = imgs.filter((i) => !i.complete || !i.naturalWidth);
  if (broken.length) issues.push({ type: 'img', detail: broken.length + '개 미완료·실패: ' + broken.slice(0, 2).map((i) => i.getAttribute('src')).join(', ') });
  const sa = window.PFScene && PFScene.audit ? PFScene.audit() : [{ type: 'no-kit' }];
  return { printScenes: scenes.length, docH, docW, issues, sceneAudit: sa };
})()`;

// ── 화면(장면 축소 보기)의 형제 + 여백 보정 배치 검사(§7-1). 레이아웃 크기 = 1280k × 720k, 가운데, 간격 16, 가로 넘침 0 ──
const SCREEN_GEOM = `(() => {
  const k = PFScene.k, issues = [];
  const vw = document.documentElement.clientWidth;
  const ss = [...document.querySelectorAll('.pf-deck > .pf-scene')];
  const tol = 0.75;
  ss.forEach((s, i) => {
    const r = s.getBoundingClientRect();
    if (Math.abs(r.width - 1280 * k) > tol || Math.abs(r.height - 720 * k) > tol) issues.push('장면 ' + (i + 1) + ' 보이는 크기 ' + r.width.toFixed(2) + 'x' + r.height.toFixed(2) + ' ≠ ' + (1280 * k).toFixed(2) + 'x' + (720 * k).toFixed(2));
    if (Math.abs((r.left + r.right) / 2 - vw / 2) > tol) issues.push('장면 ' + (i + 1) + ' 가운데 아님 (중심 ' + ((r.left + r.right) / 2).toFixed(2) + ' vs ' + (vw / 2) + ')');
    if (i > 0) { const p = ss[i - 1].getBoundingClientRect(); const g = r.top - p.bottom; if (Math.abs(g - 16) > tol) issues.push('장면 ' + i + '→' + (i + 1) + ' 간격 ' + g.toFixed(2)); }
  });
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 0.5) issues.push('가로 넘침: 문서 폭 ' + sw + ' > 뷰포트 ' + vw);
  const expectH = ss.length * 720 * k + (ss.length + 1) * 16;
  const dh = document.getElementById('deck').getBoundingClientRect().height;
  if (Math.abs(dh - expectH) > 1) issues.push('덱 높이 ' + dh.toFixed(1) + ' ≠ ' + expectH.toFixed(1));
  return { k, vw, scenes: ss.length, issues: issues.slice(0, 12), count: issues.length };
})()`;

// 장면 나눔 서명(T5): 장면마다 보이는 글자(UI 문구 data-pf-ui 제외)의 FNV-1a 해시 → 전체 서명. Chrome = Edge, 재실행 = 같아야 함
function signatureInPage() {                              // 페이지 안에서 실행(문자열로 넘김 → 이스케이프 문제 없게 함수 원문 사용)
  const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
  const per = [...document.querySelectorAll('.pf-deck > .pf-scene')].map((s) => { const b = s.querySelector(':scope > .pf-body') || s; const c = b.cloneNode(true);
    c.querySelectorAll('[data-pf-ui], [data-pf-mark], style').forEach((e) => e.remove()); return fnv((s.dataset.pfTpl || '') + '|' + c.textContent.replace(/\s+/g, '')); });
  return { scenes: per.length, signature: fnv(per.join('|')), per };
}
const SIGNATURE = `(${signatureInPage.toString()})()`;

// 장면마다 거의 투명한 1px 표식(인쇄 순서 번호). T3: i쪽에 PFK{i}T·PFK{i}B만 있어야 함
const MARK = `(() => { document.querySelectorAll('[data-pf-mark]').forEach((m) => m.remove());
  const ss = [...document.querySelectorAll('.pf-deck > .pf-scene')].filter((s) => !s.classList.contains('pf-skip'));
  ss.forEach((s, i) => { for (const [pos, tag] of [['left:0;top:0', 'T'], ['right:0;bottom:0', 'B']]) { const m = document.createElement('i');
    m.setAttribute('data-pf-bleed', ''); m.setAttribute('data-pf-mark', ''); m.setAttribute('data-pf-ui', 'chrome'); m.textContent = 'PFK' + (i + 1) + tag;
    m.style.cssText = 'position:absolute;' + pos + ';font:1px/1 sans-serif;color:rgba(0,0,0,.004);pointer-events:none;margin:0;padding:0;z-index:0'; s.appendChild(m); } });
  return ss.length; })()`;

function pdfPages(buf) {                                   // Chrome PDF의 페이지 사전은 평문 → 쪽 수·MediaBox
  const s = buf.toString('latin1');
  const boxes = [...s.matchAll(/\/Type \/Page\b(?!s)[\s\S]*?\/MediaBox \[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
  return { count: (s.match(/\/Type \/Page\b(?!s)/g) || []).length, boxes };
}
function deep(files, { markers = true, footer = false } = {}) {
  if (!files.length) return [];
  const args = ['-I', path.join(__dirname, 'pdf-deep.py'), String(PT.w), String(PT.h), markers ? '--markers' : '--no-markers', footer ? '--footer' : '--no-footer', ...files];
  try { return execFileSync('python', args, { encoding: 'utf8', maxBuffer: 64 << 20 }).trim().split(/\r?\n/).map((l) => JSON.parse(l)); }
  catch (e) { return files.map((f) => ({ file: f, error: String(e.message).slice(0, 300) })); }
}

async function printPdf(page, file, { bg, headerFooter = false }) {
  const t = Date.now();
  const r = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: bg, displayHeaderFooter: headerFooter, transferMode: 'ReturnAsBase64' });
  const buf = Buffer.from(r.data, 'base64');
  fs.writeFileSync(file, buf);
  const p = pdfPages(buf);
  const badBox = p.boxes.map((b, i) => [i + 1, b]).filter(([, b]) => Math.abs(b[2] - b[0] - PT.w) > 0.01 || Math.abs(b[3] - b[1] - PT.h) > 0.01);
  return { file, bytes: buf.length, pages: p.count, badBox: badBox.length, badBoxSample: badBox.slice(0, 2), ms: Date.now() - t };
}

// 한 페이지 검사. vp: 화면 뷰포트(장면 축소 보기 배율 k를 실제로 걸어 봄)
async function checkPage(page, url, { label, outDir, vp = { w: 1920, h: 945, dpr: 1 }, readyTimeout = 90000, deepCheck = true, scope = true }) {
  const rep = { label, url, vp: `${vp.w}x${vp.h}@${vp.dpr}`, issues: [], warn: [] };
  page.logs.length = 0;
  await page.send('Emulation.setEmulatedMedia', { media: '' });
  await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: false });
  const t0 = Date.now();
  const loaded = page.once('Page.loadEventFired', 120000);
  await page.send('Page.navigate', { url });
  await loaded;
  let ready = '';
  while (Date.now() - t0 < readyTimeout) { ready = await page.evaluate('document.documentElement.dataset.pfReady || ""').catch(() => ''); if (ready === 'yes') break; await sleep(100); }
  rep.wallMs = Date.now() - t0;
  rep.ready = ready;
  if (ready !== 'yes') rep.issues.push({ type: 'ready', detail: `data-pf-ready="${ready}" (${readyTimeout}ms 안에 yes 아님)` });
  const r0 = await page.evaluate('JSON.stringify({ report: PFScene.report(), info: PFScene.info, eager: PFScene._eager, font: document.documentElement.dataset.pfFont || null })').then(JSON.parse);
  rep.scenes = r0.report.scenes;
  rep.timing = r0.report.timing;
  rep.eager = r0.eager; rep.font = r0.font;
  rep.info = r0.info;
  rep.screenAudit = r0.report.audit;
  // 【R0 결정 #14】 T1 화면 매체 감사(인쇄 전): 덱 밖에 보이는 요소. 키트 인쇄 CSS(수정안 4)가 이것들을 PDF에서 조용히 빼므로 하나라도 있으면 T1 실패
  const od = (r0.report.audit || []).filter((x) => x.type === 'outside-deck');
  rep.outsideDeck = r0.report.outsideDeck ?? od.length;
  od.forEach((x) => rep.issues.push({ ...x, where: 'screen' }));
  rep.split = await page.evaluate(SIGNATURE);
  // ① 화면 배치(형제 + 여백 보정). 화면 매체 감사(outside-deck)는 위 r0에서 이미 봄
  rep.screen = await page.evaluate(SCREEN_GEOM);
  if (rep.screen.count) rep.issues.push({ type: 'screen-geom', detail: rep.screen.issues.join(' / ') });
  // ② 인쇄 매체 DOM 감사(T1): 뷰포트 = 캔버스
  await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(150);
  const a = await page.evaluate(AUDIT_DOC);
  rep.printAudit = { printScenes: a.printScenes, docH: a.docH, docW: a.docW, doc: a.issues, scenes: a.sceneAudit };
  rep.printScenes = a.printScenes;
  a.issues.forEach((x) => rep.issues.push({ ...x, where: 'print-doc' }));
  a.sceneAudit.forEach((x) => rep.issues.push({ ...x, where: 'print-scene' }));
  rep.overflow = a.sceneAudit.filter((x) => /scroll|outside|box|overflow/.test(x.type)).length;
  rep.clipped = a.sceneAudit.filter((x) => x.type === 'clipped').length;
  await page.send('Emulation.setEmulatedMedia', { media: '' });
  await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: false });
  await sleep(100);
  // ③ PDF: 배경 그래픽 끔(대화상자 기본값)·켬
  await page.evaluate(MARK);
  rep.pdf = {};
  for (const bg of [false, true]) {
    const r = await printPdf(page, path.join(outDir, `${label}__bg${bg ? 1 : 0}.pdf`), { bg });
    rep.pdf[bg ? 'bg1' : 'bg0'] = r;
    if (r.pages !== rep.scenes) rep.issues.push({ type: 'pages', detail: `배경${bg ? '켬' : '끔'}: PDF ${r.pages}쪽 ≠ 장면 ${rep.scenes}` });
    if (r.badBox) rep.issues.push({ type: 'pagebox', detail: `배경${bg ? '켬' : '끔'}: 쪽 크기 불일치 ${r.badBox}쪽 ${JSON.stringify(r.badBoxSample)}` });
  }
  // ④ 인쇄 범위 "요약만"(T8 일부): 쪽 수 = 인쇄 장면 수, 바닥글 인쇄 번호 = PDF 쪽 번호
  const hasDoc = await page.evaluate('[...document.querySelectorAll(".pf-deck > .pf-scene")].some((s) => s.dataset.pfPart === "doc")');
  if (scope && hasDoc) {
    const n = await page.evaluate('(PFScene.setScope("summary"), document.querySelectorAll(".pf-deck > .pf-scene:not(.pf-skip)").length)');
    // 【R0 결정 #14】 "요약만" 범위에서도 화면 매체 감사(인쇄 전). 표식(MARK)은 장면 안(data-pf-ui)이라 대상이 아님
    const ods = await page.evaluate('JSON.stringify(PFScene.audit().filter((x) => x.type === "outside-deck"))').then(JSON.parse);
    rep.outsideDeckSummary = ods.length;
    ods.forEach((x) => rep.issues.push({ ...x, where: 'screen-summary' }));
    await page.evaluate(MARK);
    const r = await printPdf(page, path.join(outDir, `${label}__summary__bg0.pdf`), { bg: false });
    rep.pdf.summary = { ...r, expect: n };
    if (r.pages !== n) rep.issues.push({ type: 'pages-summary', detail: `요약만: PDF ${r.pages}쪽 ≠ 인쇄 장면 ${n}` });
    await page.evaluate('(PFScene.setScope("all"), 1)');
    await page.evaluate(MARK);
  }
  // ⑤ 깊은 검사(T3 + 머리글·바닥글 + 빈 쪽 + 쪽 밖 글자)
  if (deepCheck) {
    const d = deep([rep.pdf.bg0.file, rep.pdf.bg1.file]);
    if (rep.pdf.summary) d.push(...deep([rep.pdf.summary.file], { footer: true }));
    rep.deep = d.map((x) => ({ ...x, file: path.basename(x.file || '') }));
    d.forEach((x) => { if (x.error) rep.issues.push({ type: 'deep-error', detail: x.error }); (x.issues || []).forEach((i) => rep.issues.push({ type: 'pdf-deep', detail: `${path.basename(x.file)}: ${i}` })); });
  }
  rep.logs = page.logs.slice(0, 30);
  rep.ok = rep.issues.length === 0;
  return rep;
}

module.exports = { checkPage, printPdf, pdfPages, deep, AUDIT_DOC, SCREEN_GEOM, MARK, SIGNATURE };

// ── CLI ──
if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = { root: path.resolve(__dirname, '../../..'), port: 4621, browser: 'chrome', viewport: '1920x945@1', out: path.resolve(__dirname, '../out/check'), deep: true, scope: true };
  const pages = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-deep') opt.deep = false; else if (a === '--no-scope') opt.scope = false;
    else if (a.startsWith('--')) opt[a.slice(2)] = argv[++i]; else pages.push(a);
  }
  (async () => {
    if (!pages.length) { console.error('검사할 페이지를 주세요'); process.exit(2); }
    fs.mkdirSync(opt.out, { recursive: true });
    const [wh, d] = opt.viewport.split('@'); const [vw, vh] = wh.split('x').map(Number);
    const server = await serve(opt.root, +opt.port);
    const all = [];
    try {
      for (const b of opt.browser === 'both' ? ['chrome', 'edge'] : [opt.browser]) {
        const c = await launch(b);
        try {
          const page = await c.newPage();
          for (const pg of pages) {
            const label = `${b}__${pg.replace(/^.*\//, '').replace(/[^\w.-]+/g, '_')}`;
            const rep = await checkPage(page, new URL(pg, server.base).href, { label, outDir: opt.out, vp: { w: vw, h: vh, dpr: +(d || 1) }, deepCheck: opt.deep, scope: opt.scope });
            rep.browser = c.version; all.push(rep);
            console.log(`${rep.ok ? 'PASS' : 'FAIL'}  ${b.padEnd(6)} ${pg}  장면 ${rep.scenes}  PDF ${rep.pdf.bg0.pages}/${rep.pdf.bg1.pages}${rep.pdf.summary ? ' 요약만 ' + rep.pdf.summary.pages : ''}  덱 밖(화면) ${rep.outsideDeck}  준비 ${Math.round(rep.timing.firstYes || -1)}ms`);
            rep.issues.slice(0, 15).forEach((i) => console.log(`   ✗ [${i.type}] ${i.scene ? '장면 ' + i.scene + ' ' : ''}${i.detail || ''}`));
          }
        } finally { await c.close(); }
      }
    } finally { await server.close(); }
    fs.writeFileSync(path.join(opt.out, 'report.json'), JSON.stringify(all, null, 1));
    process.exit(all.every((r) => r.ok) ? 0 : 1);
  })().catch((e) => { console.error(e); process.exit(2); });
}
