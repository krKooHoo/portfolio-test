#!/usr/bin/env node
// run-all.js — A1 기준선: 페이지 5개(랜딩 + 상세 4) × {Chrome, Edge} × {배경 끔, 배경 켬} (+ 상세는 "요약만" PDF)
//   + 머리글 검출기 양성 대조(fixtures/hf-control.html, displayHeaderFooter:true)
// 결과: spikes/r0/out/a1-baseline.json, spikes/r0/out/a1-baseline.md, PDF는 spikes/r0/out/a1/
// 실행(PowerShell): node spikes/r0/harness/run-all.js [--browser chrome|edge|both] [--viewport 1920x945@1] [--only <id>] [--tag <이름>] [--port <n>(기본 4621)]
// T1에는 화면 매체 감사 "덱 밖에 보이는 요소"(outside-deck, 【R0 결정 #14】)가 들어 있고, 표의 "덱 밖(화면)" 열이 그 수입니다(0이어야 PASS).
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib/cdp');
const { serve } = require('./lib/server');
const { checkPage, printPdf, deep } = require('./scene-print-check');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const PORT = +arg('port', 4621);
const browsers = (arg('browser', 'both') === 'both') ? ['chrome', 'edge'] : [arg('browser')];
const [wh, dpr] = arg('viewport', '1920x945@1').split('@'); const [vw, vh] = wh.split('x').map(Number);
const tag = arg('tag', 'a1-baseline');

(async () => {
  const projects = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/portfolio.json'), 'utf8')).projects;
  let pages = [{ id: 'index', url: 'spikes/r0/pages/index.html' }, ...projects.map((id) => ({ id, url: `spikes/r0/pages/project.html?p=${encodeURIComponent(id)}` }))];
  if (arg('only')) pages = pages.filter((p) => p.id === arg('only'));
  const pdfDir = path.join(OUT, tag.replace(/-baseline$/, ''));
  fs.mkdirSync(pdfDir, { recursive: true });
  const server = await serve(ROOT, PORT);
  const results = { tag, date: new Date().toISOString(), viewport: `${vw}x${vh}@${dpr || 1}`, port: PORT, browsers: {}, pages: [], control: [] };
  const t0 = Date.now();
  try {
    for (const b of browsers) {
      const c = await launch(b);
      results.browsers[b] = c.version;
      try {
        const page = await c.newPage();
        for (const pg of pages) {
          const label = `${b}__${pg.id}`;
          process.stdout.write(`${label} … `);
          const rep = await checkPage(page, server.base + pg.url, { label, outDir: pdfDir, vp: { w: vw, h: vh, dpr: +(dpr || 1) } });
          rep.browser = b; rep.version = c.version; rep.page = pg.id;
          results.pages.push(rep);
          console.log(`${rep.ok ? 'PASS' : 'FAIL'} 장면 ${rep.scenes} PDF ${rep.pdf.bg0.pages}/${rep.pdf.bg1.pages}${rep.pdf.summary ? ' 요약만 ' + rep.pdf.summary.pages + '/' + rep.pdf.summary.expect : ''} 덱 밖(화면) ${rep.outsideDeck ?? '?'} 준비 ${Math.round(rep.timing.firstYes ?? -1)}ms 문제 ${rep.issues.length}`);
          rep.issues.slice(0, 8).forEach((i) => console.log(`   ✗ [${i.type}] ${i.scene ? '장면 ' + i.scene + ' ' : ''}${String(i.detail || '').slice(0, 200)}`));
        }
        // 양성 대조: 검출기가 실제 브라우저 머리글·바닥글을 잡는지
        const cfile = path.join(pdfDir, `${b}__hf-control.pdf`);
        await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
        const loaded = page.once('Page.loadEventFired');
        await page.send('Page.navigate', { url: server.base + 'spikes/r0/harness/fixtures/hf-control.html' });
        await loaded;
        const r = await page.send('Page.printToPDF', { displayHeaderFooter: true, printBackground: false, marginTop: 0.5, marginBottom: 0.5 });
        fs.writeFileSync(cfile, Buffer.from(r.data, 'base64'));
        const d = deep([cfile], { markers: false })[0];
        results.control.push({ browser: b, pages: d.pages, headerFooter: d.headerFooter, sample: d.headerFooterSample, detectorWorks: d.headerFooter > 0 });
        console.log(`${b} 머리글 양성 대조: 검출 ${d.headerFooter}개 ${JSON.stringify(d.headerFooterSample || []).slice(0, 160)}`);
        await page.close();
      } finally { await c.close(); }
    }
  } finally { await server.close(); }
  // T5 결정성: 같은 페이지의 Chrome·Edge 장면 나눔 서명 비교
  results.determinism = [...new Set(results.pages.map((p) => p.page))].map((id) => {
    const rs = results.pages.filter((p) => p.page === id);
    const sigs = rs.map((p) => `${p.browser}:${p.split?.signature}`);
    const diff = rs.length > 1 ? rs[0].split.per.map((h, i) => (h !== rs[1].split.per[i] ? i + 1 : 0)).filter(Boolean) : [];
    return { page: id, same: new Set(rs.map((p) => p.split?.signature)).size === 1, sigs, diffScenes: diff.slice(0, 10) };
  });
  results.totalMs = Date.now() - t0;
  results.serverStats = { requests: server.stats.requests, bytes: server.stats.bytes, notFound: [...new Set(server.stats.notFound)].slice(0, 20) };
  fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(results, null, 1));
  fs.writeFileSync(path.join(OUT, `${tag}.md`), toMd(results));
  console.log(`\n${path.join(OUT, tag + '.md')}  (${Math.round(results.totalMs / 1000)}초)`);
  process.exit(results.pages.every((p) => p.ok) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });

function toMd(R) {
  const L = [];
  L.push(`# ${R.tag}`, '', `- 실행: ${R.date}, 화면 뷰포트 ${R.viewport}, 정적 서버 127.0.0.1:${R.port}`);
  Object.entries(R.browsers).forEach(([b, v]) => L.push(`- ${b}: ${v}`));
  L.push('', '| 페이지 | 브라우저 | 장면 | PDF 쪽(배경 끔/켬) | 쪽 크기 | 빈 쪽 | 머리글·바닥글 | 쪽 밖 글자 | 표식 | 넘침(감사) | 잘림 띠 | 덱 밖(화면, 전체/요약만) | 요약만(PDF/기대, 번호 문제) | 준비(ms) | 문서 장면·채움 평균/p10 | 글자 보존 | 화면 배치 | 판정 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of R.pages) {
    const d0 = (p.deep || []).find((x) => /__bg0\.pdf$/.test(x.file)) || {}, d1 = (p.deep || []).find((x) => /__bg1\.pdf$/.test(x.file)) || {};
    const ds = (p.deep || []).find((x) => /summary/.test(x.file));
    const sizes = [...new Set([d0.sizes, d1.sizes].filter(Boolean).flatMap((s) => Object.keys(s)))].join(', ');
    const doc = p.info?.doc;
    L.push(`| ${p.page} | ${p.browser} | ${p.scenes} | ${p.pdf.bg0.pages}/${p.pdf.bg1.pages} | ${sizes}pt | ${(d0.blank ?? '?')}/${(d1.blank ?? '?')} | ${(d0.headerFooter ?? '?')}/${(d1.headerFooter ?? '?')} | ${(d0.outside ?? '?')}/${(d1.outside ?? '?')} | ${(d0.markerIssues ?? '?')}/${(d1.markerIssues ?? '?')} | ${p.overflow} | ${p.clipped} | ${p.outsideDeck ?? '?'}/${p.outsideDeckSummary ?? '—'} | ${p.pdf.summary ? `${p.pdf.summary.pages}/${p.pdf.summary.expect}, ${ds ? ds.footerIssues : '?'}` : '—'} | ${Math.round(p.timing.firstYes ?? -1)} | ${doc ? `${doc.scenes} · ${doc.fill.mean}/${doc.fill.p10}` : '—'} | ${doc ? (doc.conservation.equal ? '같음' : '다름') : '—'} | ${p.screen.count ? '문제 ' + p.screen.count : `k=${p.screen.k.toFixed(3)} 정상`} | ${p.ok ? 'PASS' : 'FAIL'} |`);
  }
  L.push('', '## 문제 목록');
  for (const p of R.pages) {
    if (!p.issues.length) continue;
    L.push('', `### ${p.page} · ${p.browser}`);
    p.issues.slice(0, 30).forEach((i) => L.push(`- [${i.type}]${i.where ? ' (' + i.where + ')' : ''} ${i.scene ? '장면 ' + i.scene + ': ' : ''}${String(i.detail || '').replace(/\|/g, '\\|').slice(0, 300)}`));
    if (p.issues.length > 30) L.push(`- … 외 ${p.issues.length - 30}건`);
  }
  L.push('', '## 결정성(T5): 장면 나눔 서명', '', '| 페이지 | 같음 | 서명 | 다른 장면 |', '|---|---|---|---|');
  (R.determinism || []).forEach((d) => L.push(`| ${d.page} | ${d.same ? '같음' : '다름'} | ${d.sigs.join(', ')} | ${d.diffScenes.join(', ') || '—'} |`));
  L.push('', '## 머리글 검출기 양성 대조', '', '| 브라우저 | 쪽 | 검출 | 예 |', '|---|---|---|---|');
  R.control.forEach((c) => L.push(`| ${c.browser} | ${c.pages} | ${c.headerFooter} | ${JSON.stringify(c.sample || []).replace(/\|/g, '/').slice(0, 200)} |`));
  L.push('', '## 페이지별 세부(첫 브라우저 기준)');
  const seen = new Set();
  for (const p of R.pages) {
    if (seen.has(p.page)) continue; seen.add(p.page);
    const i = p.info || {};
    L.push('', `### ${p.page}`, `- 요약 장면: ${JSON.stringify(i.summary || {})}`);
    if (i.doc) L.push(`- 문서: 장면 ${i.doc.scenes}, 분할 ${JSON.stringify(i.doc.splits)}, 짧은 장 이어 붙임 ${i.doc.merged}, 재시도 ${JSON.stringify(i.doc.retry)}, 축소 ${i.doc.scaled.length}, 강제 ${i.doc.forced.length}, 잘림 띠 ${i.doc.clipped.length}, 분할 ${i.doc.paginateMs}ms, fits ${i.doc.fitCalls}회`,
      `- 채움: ${JSON.stringify(i.doc.fill)}, 글자 보존: ${JSON.stringify(i.doc.conservation)}`,
      `- Mermaid 실효 글자 12px 미만: ${JSON.stringify(i.doc.smallDiagrams)}`, `- 문서 준비: ${JSON.stringify(i.docPrep)}`);
    L.push(`- 시각(ms, 탐색 시작 기준): ${JSON.stringify(i.t)}`, `- 게이트 EAGER: ${p.eager}, 글꼴: ${JSON.stringify(i.fonts?.check || {})}${p.font ? ' (fallback)' : ''}`, `- 넘침 처리(요약): ${JSON.stringify(i.overflow || [])}`);
    if ((p.logs || []).length) L.push(`- 콘솔: ${JSON.stringify(p.logs.slice(0, 5)).slice(0, 600)}`);
  }
  return L.join('\n') + '\n';
}
