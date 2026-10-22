#!/usr/bin/env node
// a2-summary.js — A2 결과 묶기: out/a2/<tag>.json 여러 개 → out/a2/a2-summary.md(+ .json)
//   변형별 실패 분류, 뷰포트 × DPR 매트릭스(페이지 5개 합산), 변형·브라우저·k·DPR을 가로지르는 PDF 배치 서명 비교, 창 크기 변경, Tab
// 실행: node spikes/r0/harness/a2-summary.js sib-chrome sib-edge wrap-chrome fix-chrome fix-edge
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '../out/a2');
const tags = process.argv.slice(2);
const sets = tags.map((t) => ({ tag: t, R: JSON.parse(fs.readFileSync(path.join(OUT, `${t}.json`), 'utf8')) }));
const code = (f) => (f.match(/^\[([\w-]+)\]/) || [, 'other'])[1];
const L = ['# A2 결과 묶음', '', `- 만든 시각 ${new Date().toISOString()}, 입력: ${tags.map((t) => `\`${t}.json\``).join(', ')}`];
const S = { variants: {}, pdf: {} };

for (const { tag, R } of sets) {
  const runs = R.runs;
  const byCode = {};
  runs.forEach((r) => r.fails.forEach((f) => { const c = code(f); byCode[c] = (byCode[c] || 0) + 1; }));
  const failedRuns = runs.filter((r) => r.fails.length).length;
  // 구조·인쇄 항목. [link]는 클릭 자체가 빗나간 경우만(링크 이동 뒤 위치·HUD 문제는 이동 항목), nav-hash는 HUD 카운터가 틀려 다음/이전이 엉뚱한 장면으로 간 것(이동 항목)
  const structural = ['k', 'geom', 'audit', 'signature', 'hit', 'select', 'lightbox', 'afterPrint', 'pdf', 'pdf-sig', 'dpr-drift', 'dpr-split', 'console', 'exception', 'ready'];
  const isStruct = (f) => structural.includes(code(f)) || (code(f) === 'link' && /efp false|"inLink":false|click \[\]/.test(f));
  const structFails = runs.filter((r) => r.fails.some(isStruct)).length;
  S.variants[tag] = { pagesDir: R.pagesDir, browsers: R.browsers, runs: runs.length, failedRuns, structFails, byCode };
  L.push('', `## ${tag} — \`${R.pagesDir}\` · ${Object.entries(R.browsers).map(([b, v]) => `${b} ${v}`).join(', ')} · DPR ${R.dprs.join(', ')}(폰은 3 추가)`, '',
    `- 실행 ${runs.length}개, 실패가 하나라도 있는 실행 ${failedRuns}개, 그중 구조·인쇄 항목(배치·넘침·감사·서명·클릭·선택·라이트박스·PDF·DPR) 실패가 있는 실행 **${structFails}개**`,
    `- 실패 항목별 건수: ${Object.keys(byCode).length ? Object.entries(byCode).sort((a, b) => b[1] - a[1]).map(([c, n]) => `\`${c}\` ${n}`).join(', ') : '없음'}`, '',
    '| 뷰포트 | k | DPR | 페이지 | 장면 합 | (a) 최대 오차 px(크기·여백 상자·가운데·간격·원점) | (b) 가로 넘침·유령 스크롤 | (c) 화면 audit · 나눔 서명 | (d) 위치 ok | (d) HUD ok(목표) | (d) HUD ok(직접·임의 스크롤) | (d) 딥 링크 | (e) 격자 불일치 | (e) 링크 | (e) 선택 | (f) 라이트박스 | (g) PDF 쪽=장면 · 빈 쪽 · 배치 같음 | (h) DPR 표류 px |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const vids = [...new Set(runs.map((r) => r.vp))];
  for (const v of vids) for (const d of [...new Set(runs.filter((r) => r.vp === v).map((r) => r.dpr))]) {
    const rs = runs.filter((r) => r.vp === v && r.dpr === d && r.geom);
    if (!rs.length) continue;
    const g = (f) => Math.max(...rs.map((r) => f(r.geom)));
    const maxDev = g((x) => Math.max(x.maxDW, x.maxDH, x.maxDSlotW, x.maxDSlotH, x.maxDC, x.maxDGap, x.maxDOrigin > 1 ? x.maxDOrigin : 0)).toFixed(3);
    const ovf = rs.filter((r) => r.geom.scrollW > r.geom.clientW || r.geom.maxScrollX > 0 || r.geom.scrollH > Math.ceil(r.geom.docBottom) + 1 || (r.geom.vvScale != null && r.geom.vvScale !== 1)).length;
    const audit = rs.reduce((a, r) => a + r.geom.auditN, 0);
    const sigBad = rs.filter((r) => r.fails.some((f) => f.startsWith('[signature]') || f.startsWith('[dpr-split]'))).length;
    const nav = rs.flatMap((r) => [...(r.nav || [])]);
    const sum = (f) => rs.reduce((a, r) => a + f(r), 0);
    const navN = sum((r) => r.checks.nav.n), posOk = sum((r) => r.checks.nav.posOk), hudOkAll = sum((r) => r.checks.nav.hudOk);
    // 목표가 있는 이동(go·키·HUD·해시) vs 직접 스크롤: 실패 코드로 나눔
    const hudTarget = sum((r) => r.fails.filter((f) => f.startsWith('[nav-hud]')).length), hudIo = sum((r) => r.fails.filter((f) => f.startsWith('[io-hud]')).length) + sum((r) => (r.checks.ioRandom ? r.checks.ioRandom.n - r.checks.ioRandom.ok : 0));
    const ioN = sum((r) => (r.nav || []).length >= 0 ? 5 + (r.checks.ioRandom ? r.checks.ioRandom.n : 0) : 0);
    const dl = `${sum((r) => r.checks.deeplink.ok)}/${sum((r) => r.checks.deeplink.n)}`;
    const hitBad = sum((r) => r.checks.hit.bad), hitN = sum((r) => r.checks.hit.n);
    const lk = `${sum((r) => r.checks.links.ok)}/${sum((r) => r.checks.links.n)}`;
    const sel = `${rs.filter((r) => r.checks.select && (r.checks.select.ok || r.checks.select.skipped)).length}/${rs.length}`;
    const lb = `${rs.filter((r) => r.checks.lightbox && (r.checks.lightbox.ok || r.checks.lightbox.skipped)).length}/${rs.length}`;
    const pdfOk = rs.filter((r) => r.pdf && r.pdf.pages === r.N).length, blank = sum((r) => (r.pdf ? r.pdf.blank || 0 : 0)), same = rs.filter((r) => r.pdf && r.pdf.sameAsRef).length;
    const drift = rs.some((r) => r.dprDrift != null) ? Math.max(...rs.map((r) => r.dprDrift ?? 0)).toFixed(3) : '—';
    L.push(`| ${v} ${rs[0].w}×${rs[0].h}${rs[0].mobile ? ' m' : ''} | ${rs[0].k.toFixed(4)} | ${d} | ${rs.length} | ${sum((r) => r.N)} | ${maxDev} | ${ovf ? '**' + ovf + '**' : 0} | ${audit} · ${sigBad ? '**다름 ' + sigBad + '**' : '같음'} | ${posOk === navN ? posOk + '/' + navN : '**' + posOk + '/' + navN + '**'} | ${hudTarget ? '**실패 ' + hudTarget + '**' : '0 실패'} | ${hudIo ? '**실패 ' + hudIo + '/' + ioN + '**' : '0/' + ioN + ' 실패'} | ${dl} | ${hitBad ? '**' + hitBad + '**' : 0}/${hitN} | ${lk} | ${sel} | ${lb} | ${pdfOk}/${rs.length} · ${blank} · ${same}/${rs.length} | ${drift} |`);
    void nav; void hudOkAll;
  }
  if (R.resize && R.resize.length) {
    L.push('', '창 크기 변경(같은 페이지, k 1.268에서 시작해 9개 뷰포트를 거꾸로·바로 16단계, 현재 장면이 화면 가운데에 남는지):', '');
    R.resize.forEach((z) => { const bad = z.steps.filter((s) => !s.ok); L.push(`- ${z.browser} ${z.page}: ${z.steps.length - bad.length}/${z.steps.length}${bad.length ? ' — 실패 ' + [...new Set(bad.map((s) => `${s.vp}(top ${s.top}, inView ${s.inView}, HUD ${s.hud})`))].join(', ') : ''}`); });
  }
  // PDF 서명 모음
  runs.forEach((r) => { if (r.pdf && r.pdf.sig) { const k = r.page; (S.pdf[k] = S.pdf[k] || {}); const key = r.pdf.sig; (S.pdf[k][key] = S.pdf[k][key] || []).push(`${tag}:${r.browser}:${r.vp}@${r.dpr}`); } });
}

L.push('', '## 인쇄 배치 서명: 변형·브라우저·k·DPR 전체 비교', '', '쪽마다 글자 조각 위치(0.25pt)와 이미지 상자(0.5pt)의 해시. 한 페이지에서 서명이 1개면 어느 화면 상태에서 인쇄해도 PDF 배치가 같다는 뜻입니다.', '',
  '| 페이지 | PDF 수 | 서로 다른 서명 수 | 서명 |', '|---|---|---|---|');
for (const [p, m] of Object.entries(S.pdf)) L.push(`| ${p} | ${Object.values(m).reduce((a, x) => a + x.length, 0)} | ${Object.keys(m).length} | ${Object.entries(m).map(([s, l]) => `${s}(${l.length})`).join(', ')} |`);

const tabF = path.join(OUT, 'tab.json');
if (fs.existsSync(tabF)) {
  const T = JSON.parse(fs.readFileSync(tabF, 'utf8'));
  L.push('', '## Tab 이동(a2-tab.js)', '', '| 변형 | 뷰포트 | 페이지 | 장면 안 포커스 | 포커스 요소·장면이 화면 밖 | 예 |', '|---|---|---|---|---|---|');
  T.forEach((t) => L.push(`| ${t.variant} | ${t.vp} | ${t.page} | ${t.inScene}/${t.tabs} | ${t.bad} | ${t.bad ? JSON.stringify(t.sample[0]).replace(/\|/g, '/') : '—'} |`));
}
fs.writeFileSync(path.join(OUT, 'a2-summary.md'), L.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'a2-summary.json'), JSON.stringify(S, null, 1));
console.log(L.join('\n'));
