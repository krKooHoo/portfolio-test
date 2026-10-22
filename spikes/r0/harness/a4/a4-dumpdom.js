#!/usr/bin/env node
// A4 사례 7: ?pf-audit=1 감사 JSON을 CDP 없이 명령줄 헤드리스 --dump-dom(+ --virtual-time-budget)으로 읽을 수 있는가 (C2 스파이크의 통로)
// 실행(PowerShell): node spikes/r0/harness/a4/a4-dumpdom.js [--browser chrome,edge] [--budgets none,1000,3000,5000,10000,30000] [--pages index,0-Tidy-Mommy] [--warm 1]
//   --warm 1: 같은 프로필로 한 번 먼저 열어 CDN 캐시를 데운 뒤 잼(기본은 매번 새 프로필 = 차가운 캐시)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { EXE } = require('../lib/cdp');
const L = require('./a4-lib');

const argv = process.argv.slice(2);
const opt = { browser: 'chrome,edge', budgets: 'none,1000,3000,5000,10000,30000', pages: 'index,0-Tidy-Mommy', warm: '0', tag: '', hold: '0', extra: '' };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
const pageUrl = (base, p) => base + (p === 'index' ? 'spikes/r0/pages/index.html?pf-audit=1' : `spikes/r0/pages/project.html?p=${encodeURIComponent(p)}&pf-audit=1`);

function run(browser, url, budget, prof, killMs = 150000) {
  return new Promise((resolve) => {
    const flags = ['--headless=new', '--dump-dom', budget !== 'none' ? `--virtual-time-budget=${budget}` : null, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--mute-audio', ...(opt.extra ? opt.extra.split(' ') : []), url].filter(Boolean);
    const t = Date.now();
    const p = spawn(EXE[browser], flags, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const out = [], err = [];
    p.stdout.on('data', (d) => out.push(d)); p.stderr.on('data', (d) => err.push(d));
    const k = setTimeout(() => { try { p.kill(); } catch { /* */ } }, killMs);
    p.on('exit', (code) => { clearTimeout(k); resolve({ code, ms: Date.now() - t, dom: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8').slice(-600) }); });
  });
}
function parse(dom) {
  const html = (dom.match(/<html[^>]*>/) || [''])[0];
  const r = { domBytes: dom.length, htmlReady: (html.match(/data-pf-ready="([^"]*)"/) || [])[1] || null, deckScenes: (dom.match(/<section class="pf-scene/g) || []).length };
  const m = dom.match(/<pre id="pf-audit"[^>]*>([A-Za-z0-9+/=\s]*)<\/pre>/);
  if (!m) return { ...r, audit: null };
  try {
    const j = JSON.parse(Buffer.from(m[1].replace(/\s+/g, ''), 'base64').toString('utf8'));
    return { ...r, audit: { ready: j.ready, scenes: j.scenes, printScenes: j.printScenes, auditIssues: j.audit.length, auditTypes: [...new Set(j.audit.map((x) => x.type))], clipped: j.clipped,
      timing: Object.fromEntries(Object.entries(j.timing || {}).map(([k, v]) => [k, v == null ? null : Math.round(v)])), eager: j.eager, k: j.k, imgFailed: j.info && j.info.imgFailed, doc: j.info && j.info.doc ? { scenes: j.info.doc.scenes, conservation: j.info.doc.conservation && j.info.doc.conservation.equal } : null } };
  } catch (e) { return { ...r, audit: { parseError: e.message } }; }
}

(async () => {
  const srv = await L.startServer();
  const rows = [];
  try {
    for (const b of opt.browser.split(',')) for (const pg of opt.pages.split(',')) for (const bud of opt.budgets.split(',')) {
      const prof = fs.mkdtempSync(path.join(os.tmpdir(), `r0-a4dd-${b}-`));
      try {
        if (opt.warm === '1') await run(b, pageUrl(srv.base, pg), '30000', prof);
        srv.cfg.imgReleaseAt = +opt.hold ? Date.now() + +opt.hold : 0;   // --hold: 이미지 응답을 실행 시작부터 N ms 붙잡음(느린 네트워크 대역)
        const r = await run(b, pageUrl(srv.base, pg), bud, prof);
        const row = { browser: b, page: pg, budget: bud, warm: opt.warm === '1', holdMs: +opt.hold, extra: opt.extra || undefined, code: r.code, wallMs: r.ms, ...parse(r.dom), stderrTail: r.code ? r.stderr : undefined };
        rows.push(row);
        console.log(`${b.padEnd(6)} ${pg.padEnd(20)} budget ${String(bud).padStart(5)}  wall ${String(r.ms).padStart(6)}ms  html=${row.htmlReady}  pre=${row.audit ? (row.audit.ready + ' scenes ' + row.audit.scenes + ' issues ' + row.audit.auditIssues + ' yes@' + (row.audit.timing && row.audit.timing.firstYes)) : '없음'}  deck ${row.deckScenes}`);
      } finally {
        for (let i = 0; i < 10; i++) { try { fs.rmSync(prof, { recursive: true, force: true }); break; } catch { await L.sleep(500); } }
      }
    }
  } finally { await srv.close(); }
  fs.writeFileSync(path.join(L.OUT, `case7-dumpdom${opt.warm === '1' ? '-warm' : ''}${opt.tag}.json`), JSON.stringify(rows, null, 1));
})().catch((e) => { console.error(e); process.exit(2); });
