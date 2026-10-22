#!/usr/bin/env node
// fix4-probe/compare.js — 두 실행(<tagA>-fixtures.json, <tagB>-fixtures.json)의 인쇄·감사 판정 비교 → out/fix4-probe/compare-<A>-vs-<B>.md
// 사용: node spikes/r0/harness/fix4-probe/compare.js fix123 final [더 많은 태그…]
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '../../out/fix4-probe');
const tags = process.argv.slice(2);
const runs = tags.map((t) => JSON.parse(fs.readFileSync(path.join(OUT, `${t}-fixtures.json`), 'utf8')));
const short = (r) => { if (!r) return '—'; if (r.printOk) return 'PASS'; const f = r.fails.find((x) => x.fails.length); return 'FAIL ' + (f ? f.fails.join('; ').slice(0, 90) : ''); };
const L = [`# fix4-probe 비교: ${tags.join(' vs ')}`, '', ...runs.map((R) => `- ${R.tag}: 키트 CSS \`${R.kit}\`, ${R.date}`), '',
  `| ID | 내용 | ${tags.map((t) => `인쇄 ${t}`).join(' | ')} | ${tags.map((t) => `감사 ${t} (c/e)`).join(' | ')} | 바뀜 |`, `|---|---|${tags.map(() => '---').join('|')}|${tags.map(() => '---').join('|')}|---|`];
for (const row of runs[0].rows) {
  const rs = runs.map((R) => R.rows.find((x) => x.id === row.id));
  const p = rs.map(short), a = rs.map((r) => (r ? `${r.audit} ${Object.values(r.odN).join('/')}` : '—'));
  const changed = new Set(rs.map((r) => r && r.printOk)).size > 1 ? '**인쇄**' : '';
  L.push(`| ${row.id} | ${row.name.replace(/\|/g, '/').slice(0, 70)} | ${p.join(' | ').replace(/\|(?= )/g, '|')} | ${a.join(' | ')} | ${changed} |`);
}
const f = path.join(OUT, `compare-${tags.join('-vs-')}.md`);
fs.writeFileSync(f, L.join('\n') + '\n');
console.log(L.filter((l) => /\*\*인쇄\*\*/.test(l)).join('\n'));
console.log(f);
