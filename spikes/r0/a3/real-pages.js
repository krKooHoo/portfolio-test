#!/usr/bin/env node
// A3 ② "요약만" 인쇄(실제 상세 페이지 2편) + ⑤ 배경 끔 픽셀 검사(실제 장면 배경·다크 코드 블록)
//   전체 / 요약만(setScope) / 합성 변형(목차를 남기고 P5만 빼기 — 목차 번호 다시 계산을 PDF로 확인) × Chrome·Edge × 배경 켬·끔
//   검사: 쪽 수 = 인쇄 장면 수, 빈 쪽 0, 960×540, 바닥글 "j / M" = PDF 쪽 번호(PyMuPDF 글자 추출), 목차·교차 참조 번호(DOM 값 = 기대값,
//         PDF의 해당 쪽 글자에 "제목+p.N"이 있고 p.N 쪽에 대상 제목이 있음), 빠진 장면 참조 = URL 글자, 화면 번호 미노출, 배경 끔↔켬 래스터 차이, 픽셀 색
// 실행(PowerShell, 레포 루트): node spikes/r0/a3/real-pages.js [--kit-file <대체 scene-kit.css 경로>] [--tag real] [--browser both]
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, sleep } = require('../harness/lib/cdp');
const { serve } = require('./server');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out/a3');
const PORT = 4623;
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const TAG = arg('tag', 'real');
const KIT_FILE = arg('kit-file');
const BROWSERS = arg('browser', 'both') === 'both' ? ['chrome', 'edge'] : [arg('browser')];
const PROJECTS = (arg('projects', '0-Tidy-Mommy,2-Yggdrasil')).split(',');
const VP = { w: 1536, h: 864, dpr: 1.25 };

function snapInPage() {
  const scenes = [...document.querySelectorAll('#deck > .pf-scene')];
  const printed = scenes.filter((s) => !s.classList.contains('pf-skip'));
  const norm = (t) => (t || '').replace(/\s+/g, '');
  const S = scenes.map((s, i) => ({ i, tpl: s.dataset.pfTpl, part: s.dataset.pfPart, skip: s.classList.contains('pf-skip'), pj: printed.indexOf(s),
    nPrint: s.querySelector('.pf-foot .pf-n-print')?.textContent ?? null, nScreen: s.querySelector('.pf-foot .pf-n-screen')?.textContent ?? null }));
  const refs = [...document.querySelectorAll('#deck [data-pf-ref]')].map((a) => {
    const host = a.closest('.pf-scene');
    const t = document.getElementById(a.dataset.pfRef);
    const ts = t ? (t.classList.contains('pf-scene') ? t : t.closest('.pf-scene')) : null;
    const c = a.cloneNode(true); c.querySelectorAll('.pf-n-screen, .pf-n-print').forEach((e) => e.remove());
    const tt = t ? (t.classList.contains('pf-scene') ? (t.querySelector('.pf-title, h1, h2, h3')?.textContent || '') : t.textContent) : '';
    return { kind: a.classList.contains('pf-xref') ? 'xref' : 'toc', ref: a.dataset.pfRef, host: scenes.indexOf(host), hostPj: printed.indexOf(host),
      target: scenes.indexOf(ts), targetPj: printed.indexOf(ts), prn: a.querySelector('.pf-n-print')?.textContent ?? '', scr: a.querySelector('.pf-n-screen')?.textContent ?? '',
      label: norm(c.textContent), targetText: norm(tt).slice(0, 20), url: PFScene.refUrl(a.dataset.pfRef) };
  });
  return { N: scenes.length, M: printed.length, scope: PFScene.scope, scenes: S, refs };
}
// 인쇄 매체·1280×720에서 픽셀 검사 위치(인쇄 순서 쪽, pt)와 기대색(계산된 CSS 색)
function probesInPage() {
  const rgb = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map((x) => parseFloat(x)); return v.length > 3 && v[3] === 0 ? null : v.slice(0, 3).map(Math.round); };
  const out = [];
  const ss = [...document.querySelectorAll('#deck > .pf-scene')].filter((s) => !s.classList.contains('pf-skip'));
  ss.forEach((s, j) => {
    const sr = s.getBoundingClientRect();
    const bg = rgb(getComputedStyle(s).backgroundColor);
    if (bg) for (const [x, y] of [[3, 3], [1277, 3], [3, 717], [1277, 717]]) out.push({ page: j + 1, x: x * 0.75, y: y * 0.75, rgb: bg, tol: 4, name: `장면 배경(${s.dataset.pfTpl})` });
    const pre = [...s.querySelectorAll('pre')].find((p) => { const r = p.getBoundingClientRect(); return r.width > 60 && r.height > 40 && r.bottom <= sr.bottom && r.top >= sr.top; });
    if (pre) { const r = pre.getBoundingClientRect(); const c = rgb(getComputedStyle(pre).backgroundColor);
      if (c) out.push({ page: j + 1, x: (r.right - sr.left - 16) * 0.75, y: (r.top - sr.top + r.height / 2) * 0.75, rgb: c, tol: 4, mode: 'median', r: 4, name: '다크 코드 블록 배경' }); }
    const soft = [...s.querySelectorAll('.hl .why, .pf-md blockquote, .ts .st.res, .badge.team')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 30 && r.height > 14 && r.bottom <= sr.bottom; });
    if (soft) { const r = soft.getBoundingClientRect(); const c = rgb(getComputedStyle(soft).backgroundColor);
      if (c) out.push({ page: j + 1, x: (r.left - sr.left + r.width / 2) * 0.75, y: (r.top - sr.top + 4) * 0.75, rgb: c, tol: 5, mode: 'median', r: 1, name: `연한 강조 배경(${soft.className || soft.tagName})` }); }
  });
  return out;
}

async function printBoth(page, base) {
  const out = {};
  for (const bg of [true, false]) {
    const r = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: bg, transferMode: 'ReturnAsBase64' });
    const f = `${base}__bg${bg ? 1 : 0}.pdf`;
    fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
    out[bg ? 'bg1' : 'bg0'] = f;
  }
  return out;
}
async function inPrint(page, expr) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(150);
  const v = await page.evaluate(expr);
  await page.send('Emulation.setEmulatedMedia', { media: '' });
  await page.send('Emulation.setDeviceMetricsOverride', { width: VP.w, height: VP.h, deviceScaleFactor: VP.dpr, mobile: false });
  await sleep(100);
  return v;
}

(async () => {
  const pdfDir = path.join(OUT, TAG); fs.mkdirSync(pdfDir, { recursive: true });
  const rewrite = KIT_FILE ? { '/spikes/r0/kit/scene-kit.css': path.resolve(KIT_FILE) } : null;
  const server = await serve(ROOT, PORT, { rewrite });
  const R = { tag: TAG, kitFile: KIT_FILE || null, date: new Date().toISOString(), viewport: `${VP.w}x${VP.h}@${VP.dpr}`, browsers: {}, runs: [] };
  try {
    for (const b of BROWSERS) {
      const c = await launch(b);
      R.browsers[b] = c.version;
      try {
        const page = await c.newPage();
        for (const id of PROJECTS) {
          await page.send('Emulation.setEmulatedMedia', { media: '' });
          await page.send('Emulation.setDeviceMetricsOverride', { width: VP.w, height: VP.h, deviceScaleFactor: VP.dpr, mobile: false });
          const loaded = page.once('Page.loadEventFired', 60000);
          await page.send('Page.navigate', { url: id === 'index' ? `${server.base}spikes/r0/pages/index.html` : `${server.base}spikes/r0/pages/project.html?p=${encodeURIComponent(id)}` });
          await loaded;
          const t0 = Date.now(); let ready = '';
          while (Date.now() - t0 < 90000) { ready = await page.evaluate('document.documentElement.dataset.pfReady || ""'); if (ready === 'yes') break; await sleep(100); }
          const run = { browser: b, id, ready, modes: {} };
          const SNAP = `(${snapInPage.toString()})()`, PROBES = `(${probesInPage.toString()})()`;
          const doMode = async (mode) => {
            const m = { snap: await page.evaluate(SNAP) };
            m.probes = await inPrint(page, PROBES);
            m.audit = await inPrint(page, 'PFScene.audit().map((x) => `${x.scene}:${x.type}:${String(x.detail).slice(0, 90)}`)');
            m.pdf = await printBoth(page, path.join(pdfDir, `${b}__${id}__${mode}`));
            run.modes[mode] = m;
          };
          await doMode('all');
          await page.evaluate("(PFScene.setScope('summary'), 1)");
          await doMode('summary');
          // 합성 변형: 목차(P2)·문서(D)는 남기고 P5(없으면 P6)만 인쇄에서 뺌 → 목차의 p.N이 밀린 번호로 다시 계산되는지, 빠진 대상은 URL 글자인지
          run.victim = await page.evaluate(`(() => { const S = [...document.querySelectorAll('#deck > .pf-scene')]; window.__parts = S.map((s) => s.dataset.pfPart);
            const v = S.some((s) => s.dataset.pfTpl === 'P5') ? 'P5' : 'P6'; S.forEach((s) => { s.dataset.pfPart = s.dataset.pfTpl === v ? 'doc' : 'summary'; }); PFScene.setScope('summary'); return v; })()`);
          await doMode('tocKept');
          run.tocIssues = await inPrint(page, `[...document.querySelectorAll('#deck > .pf-scene[data-pf-tpl="P2"]')].flatMap((s) => PFScene.sceneIssues(s).map((x) => x.type + ': ' + String(x.detail).slice(0, 100)))`);
          await page.evaluate(`(() => { const S = [...document.querySelectorAll('#deck > .pf-scene')]; S.forEach((s, i) => { s.dataset.pfPart = window.__parts[i]; }); PFScene.setScope('all'); return 1; })()`);
          R.runs.push(run);
          console.log(`${b} ${id}: ready=${ready} 장면 ${run.modes.all.snap.N} 요약만 ${run.modes.summary.snap.M} 목차유지변형 ${run.modes.tocKept.snap.M}(${run.victim} 뺌)`);
        }
        await page.close();
      } finally { await c.close(); }
    }
  } finally { await server.close(); }
  R.serverRewritten = server.stats.rewritten;

  // ── PDF 분석 ──
  const jobs = [], keys = [];
  for (const run of R.runs) for (const [mode, m] of Object.entries(run.modes)) {
    const s = m.snap;
    const forbidden = ['본문으로 건너뛰기', 'PDF로 저장PDF', '그래도 인쇄'];
    if (mode === 'summary') forbidden.push('CONTENTS');
    if (s.M !== s.N) for (let i = 1; i <= s.N; i++) forbidden.push(`${i} / ${s.N}`);   // 인쇄 집합이 줄었으면 화면 번호(i / N)가 인쇄되면 안 됨
    const required = [];
    for (const r of s.refs) {
      if (r.hostPj < 0) continue;
      const want = r.targetPj >= 0 ? `p.${r.targetPj + 1}` : r.url;
      required.push({ page: r.hostPj + 1, text: r.label + want, why: `${r.kind} ${r.ref}` });
      if (r.targetPj >= 0 && r.targetText) required.push({ page: r.targetPj + 1, text: r.targetText, why: `대상 ${r.ref}` });
    }
    for (const bg of ['bg1', 'bg0']) {
      jobs.push({ file: m.pdf[bg], w: 960, h: 540, n: s.M, labels: false, footer: 'band', required, forbidden, probes: bg === 'bg0' ? m.probes : [], compare: bg === 'bg0' ? m.pdf.bg1 : null });
      keys.push([run, mode, bg]);
    }
  }
  const jf = path.join(OUT, `${TAG}-jobs.json`);
  fs.writeFileSync(jf, JSON.stringify(jobs));
  const lines = execFileSync('python', ['-I', path.join(__dirname, 'a3-pdf.py'), jf], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim().split(/\r?\n/);
  lines.forEach((l, k) => { const [run, mode, bg] = keys[k]; const a = JSON.parse(l); a.file = path.relative(OUT, a.file); run.modes[mode][bg] = a; });

  // ── 판정 ──
  for (const run of R.runs) for (const [mode, m] of Object.entries(run.modes)) {
    const s = m.snap, f = [];
    // DOM: 바닥글 인쇄 번호와 참조 번호가 인쇄 집합 기준인지
    s.scenes.filter((x) => !x.skip).forEach((x) => { if (x.nPrint !== `${x.pj + 1} / ${s.M}`) f.push(`DOM 바닥글 장면${x.i + 1} "${x.nPrint}" ≠ "${x.pj + 1} / ${s.M}"`); });
    s.refs.forEach((r) => { const want = r.targetPj >= 0 ? `p.${r.targetPj + 1}` : r.url; if (r.prn !== want) f.push(`DOM 참조 ${r.kind} ${r.ref} "${r.prn}" ≠ "${want}"`); });
    for (const bg of ['bg1', 'bg0']) {
      const a = m[bg];
      if (a.pages !== s.M) f.push(`${bg} 쪽 ${a.pages} ≠ ${s.M}`);
      if (a.badSize.length) f.push(`${bg} 크기 ${JSON.stringify(a.sizes)}`);
      if (a.blank.length) f.push(`${bg} 빈 쪽 ${a.blank}`);
      if (a.outside.length) f.push(`${bg} 쪽 밖 글자 ${JSON.stringify(a.outside[0])}`);
      if (a.hf.length) f.push(`${bg} 머리글·바닥글 ${JSON.stringify(a.hf[0])}`);
      if (a.footer.length) f.push(`${bg} PDF 바닥글 번호 ${a.footer.length}쪽 ${JSON.stringify(a.footer[0])}`);
      const rq = a.required.filter((x) => !x.ok);
      if (rq.length) f.push(`${bg} PDF 글자 없음 ${rq.length}건 ${JSON.stringify(rq.slice(0, 2))}`);
      if (a.forbidden.length) f.push(`${bg} 금지 글자 ${JSON.stringify(a.forbidden.slice(0, 3))}`);
      const bp = a.probes.filter((x) => !x.ok);
      if (bp.length) f.push(`${bg} 픽셀 ${bp.length}/${a.probes.length} ${JSON.stringify(bp.slice(0, 2))}`);
      if (a.diff && (a.diff.max > 8 || a.diff.error)) f.push(`배경 끔↔켬 래스터 차이 ${JSON.stringify(a.diff)}`);
    }
    m.fails = f;
    m.summary = { N: s.N, M: s.M, refs: s.refs.length, refsPrinted: s.refs.filter((r) => r.hostPj >= 0).length, refsToUrl: s.refs.filter((r) => r.targetPj < 0).length,
      pdfChecks: m.bg0.required.length, probes: m.bg0.probes.length, probeKinds: [...new Set(m.bg0.probes.map((p) => p.name.replace(/\(.*$/, '')))], diff: m.bg0.diff, audit: m.audit.length };
  }
  fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(R, null, 1));
  const L = [`# A3 실제 상세 페이지: 요약만 인쇄·번호·배경 끔 (${TAG})`, '', `- ${R.date}, 화면 ${R.viewport}, 키트 CSS ${KIT_FILE ? '대체 파일 ' + KIT_FILE : 'kit/scene-kit.css'}`];
  Object.entries(R.browsers).forEach(([b, v]) => L.push(`- ${b}: ${v}`));
  L.push('', '| 브라우저 | 프로젝트 | 범위 | 장면 N | 인쇄 M | PDF 쪽(켬/끔) | 참조(인쇄 쪽에 있는 것/URL로 바뀐 것) | PDF 글자 검사 | 픽셀 검사(끔) | 끔↔켬 차이 max | 감사 | 판정 |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const run of R.runs) for (const [mode, m] of Object.entries(run.modes)) {
    const s = m.summary;
    L.push(`| ${run.browser} | ${run.id} | ${mode}${mode === 'tocKept' ? `(${run.victim} 뺌)` : ''} | ${s.N} | ${s.M} | ${m.bg1.pages}/${m.bg0.pages} | ${s.refs}(${s.refsPrinted}/${s.refsToUrl}) | ${m.bg0.required.filter((x) => x.ok).length}/${s.pdfChecks} | ${m.bg0.probes.filter((x) => x.ok).length}/${s.probes} ${s.probeKinds.join('·')} | ${s.diff ? s.diff.max : '?'} | ${s.audit} | ${m.fails.length ? 'FAIL: ' + m.fails.slice(0, 3).join(' / ').replace(/\|/g, '/').slice(0, 400) : 'PASS'} |`);
  }
  L.push('', '## 목차 유지 변형에서 P2 장면 감사(URL 글자가 목차 칸을 넘는지)');
  for (const run of R.runs) L.push(`- ${run.browser} ${run.id}: ${run.tocIssues.length ? run.tocIssues.slice(0, 4).join(' / ') : '문제 없음'}`);
  L.push('', '## 요약만: 참조 예시(DOM 인쇄 번호)');
  for (const run of R.runs) L.push(`- ${run.browser} ${run.id}: ${run.modes.summary.snap.refs.slice(0, 3).map((r) => `${r.kind} ${r.ref} → "${r.prn}"`).join(' · ')} … / 바닥글 ${run.modes.summary.snap.scenes.filter((x) => !x.skip).map((x) => x.nPrint).join(', ')}`);
  fs.writeFileSync(path.join(OUT, `${TAG}.md`), L.join('\n') + '\n');
  const bad = R.runs.flatMap((r) => Object.values(r.modes)).filter((m) => m.fails.length).length;
  console.log(`\n실패 ${bad} / ${R.runs.length * 3} → ${path.join(OUT, TAG + '.md')}`);
})().catch((e) => { console.error(e); process.exit(2); });
