// A4 공용 도구: 조절 가능한 정적 서버(127.0.0.1:4624), Q12 모의(빌드가 media w×h를 기록한 상태), 페이지 관찰 스크립트, PDF 분석
//   lib/server.js·lib/cdp.js를 그대로 쓰지 않고(다른 스파이크와 공유) 이 폴더 안에서만 확장합니다.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { launch, sleep } = require('../lib/cdp');

const ROOT = path.resolve(__dirname, '../../../..');          // harness/a4 → 레포 루트
const OUT = path.resolve(__dirname, '../../out/a4');
const PORT = 4624;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.cs': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const IMG = /\.(gif|png|jpe?g|webp)$/i;

// ── 이미지 크기(PNG IHDR, GIF 논리 화면) → Q12 모의용 지도 { '/src/<id>/images/x.gif': {w,h} } ──
function imageDims() {
  const map = {};
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) return walk(f);
    if (!/\.(png|gif)$/i.test(e.name)) return;
    const b = Buffer.alloc(32); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 32, 0); fs.closeSync(fd);
    let w = 0, h = 0;
    if (b.toString('latin1', 1, 4) === 'PNG') { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
    else if (b.toString('latin1', 0, 3) === 'GIF') { w = b.readUInt16LE(6); h = b.readUInt16LE(8); }
    if (w && h) map['/' + path.relative(ROOT, f).split(path.sep).join('/')] = { w, h };
  });
  walk(path.join(ROOT, 'src'));
  return map;
}

// ── 서버: cfg를 실행 중에 바꿔 가며 씀 ──
//   cfg.imgReleaseAt(epoch ms): 그때까지 이미지 응답을 붙잡음(HTTP/1.1 연결 6개 제한이 있어도 "25초 뒤 일제히 풀림"이 되도록 절대 시각)
//   cfg.delay(p) → ms: 그 밖의 느린 응답(데이터 JSON 등) · cfg.q12: pf-common.js의 imageSize를 크기 지도 조회로 바꿔 보냄
function startServer() {
  const cfg = { imgReleaseAt: 0, delay: null, q12: false, override: null, log: [] };
  const dims = imageDims();
  const q12Src = () => {
    const f = fs.readFileSync(path.join(ROOT, 'spikes/r0/pages/pf-common.js'), 'utf8');
    const needle = '  function imageSize(src) {\n';
    const nl = f.includes(needle) ? needle : needle.replace('\n', '\r\n');
    if (!f.includes(nl)) throw new Error('pf-common.js에서 imageSize를 찾지 못함(Q12 모의 불가)');
    return `window.__A4_DIMS = ${JSON.stringify(dims)};\n` + f.replace(nl, nl +
      '    if (window.__A4_DIMS) { let k = src; try { k = decodeURIComponent(new URL(src, location.href).pathname); } catch (_) { /* */ } return Promise.resolve(window.__A4_DIMS[k] || null); }   // 【A4 Q12 모의】 받지 않고 기록된 크기\n');
  };
  const srv = http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
    if (p.endsWith('/')) p += 'index.html';
    const f = path.resolve(ROOT, '.' + p);
    if (f !== ROOT && !f.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    const t0 = Date.now();
    let d = cfg.delay ? cfg.delay(p) || 0 : 0;
    if (IMG.test(p) && cfg.imgReleaseAt > t0) d = Math.max(d, cfg.imgReleaseAt - t0);
    if (d) await sleep(d);
    const send = (buf, type) => {
      cfg.log.push({ t: t0, p, held: d, bytes: buf.length });
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': buf.length });
      res.end(req.method === 'HEAD' ? undefined : buf);
    };
    if (cfg.q12 && p === '/spikes/r0/pages/pf-common.js') return send(Buffer.from(q12Src(), 'utf8'), MIME['.js']);
    const ov = cfg.override && cfg.override[p];               // A/B 대조: 이 경로 대신 다른 파일을 보냄(예: 고치기 전 키트)
    fs.readFile(ov || f, (err, buf) => {
      if (err) { cfg.log.push({ t: t0, p, status: 404 }); res.writeHead(404); return res.end('not found'); }
      send(buf, MIME[path.extname(f).toLowerCase()] || 'application/octet-stream');
    });
  });
  return new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(PORT, '127.0.0.1', () => resolve({ cfg, dims, base: `http://127.0.0.1:${PORT}/`,
      close: () => new Promise((r) => { srv.close(() => r()); srv.closeAllConnections?.(); }) }));
  });
}

// ── 페이지 관찰 스크립트(새 문서마다 키트보다 먼저 실행) ──
//   __a4.ev: beforeprint/afterprint(키트 핸들러 앞·뒤), matchMedia('print') change, print() 호출
//   __a4.mo: data-pf-ready / data-pf-print-anyway 변화(이전 값 포함) + 그때 이미지·장면 상태
//   __a4.raf: rAF 횟수(가려진 탭 확인용)
const PROBE = `(() => {
  if (window.__a4) return;
  const A = (window.__a4 = { ev: [], mo: [], raf: 0, vis: [] });
  // 주의: 이 스크립트가 도는 시점에는 document.documentElement가 아직 없음(null) → 매번 새로 읽고, MO는 document에 subtree로 붙임
  const R = () => document.documentElement || { dataset: {}, hasAttribute: () => false, getAttribute: () => null };
  const now = () => Math.round(performance.now());
  const snap = () => { const im = [...document.images].filter((i) => !i.closest('.pf-measure'));
    return { n: im.length, done: im.filter((i) => i.complete).length, ok: im.filter((i) => i.complete && i.naturalWidth > 0).length,
             lazy: im.filter((i) => i.loading === 'lazy').length, lazyPending: im.filter((i) => i.loading === 'lazy' && !i.complete).length }; };
  A.snap = snap;
  const st = () => ({ ready: R().dataset.pfReady, anyway: R().hasAttribute('data-pf-print-anyway'), mq: matchMedia('print').matches });
  addEventListener('beforeprint', () => A.ev.push({ t: now(), type: 'beforeprint:first', ...st(), img: snap() }));
  addEventListener('afterprint', () => A.ev.push({ t: now(), type: 'afterprint:first', ...st() }));
  addEventListener('load', () => {                     // 키트 핸들러보다 뒤에 등록 → 키트가 바꾼 뒤 상태
    addEventListener('beforeprint', () => A.ev.push({ t: now(), type: 'beforeprint:last', ...st(), img: snap() }));
    addEventListener('afterprint', () => A.ev.push({ t: now(), type: 'afterprint:last', ...st() }));
  });
  try { matchMedia('print').addEventListener('change', (e) => A.ev.push({ t: now(), type: 'mq-print-change', matches: e.matches, ready: R().dataset.pfReady })); } catch (_) {}
  document.addEventListener('visibilitychange', () => A.vis.push({ t: now(), v: document.visibilityState }));
  // 기록 시점의 값(now)은 레코드마다 다를 수 있으므로, 같은 콜백 안에서는 다음 레코드의 old를 이 레코드의 값으로 씀
  new MutationObserver((recs) => recs.forEach((r, i) => { if (r.target !== document.documentElement) return;
      const nx = recs.slice(i + 1).find((x) => x.attributeName === r.attributeName && x.target === r.target);
      A.mo.push({ t: now(), attr: r.attributeName, old: r.oldValue, now: nx ? nx.oldValue : r.target.getAttribute(r.attributeName),
      img: snap(), scenes: document.querySelectorAll('.pf-deck > .pf-scene').length, mounted: !!(window.PFScene && PFScene._t && PFScene._t.mount), font: R().dataset.pfFont || null }); }))
    .observe(document, { attributes: true, subtree: true, attributeOldValue: true, attributeFilter: ['data-pf-ready', 'data-pf-print-anyway'] });
  const tickRaf = () => { A.raf++; requestAnimationFrame(tickRaf); }; requestAnimationFrame(tickRaf);
})();`;

// ── 페이지 열기 ──
//   o.vp {w,h,dpr} · o.mobile(bool, 화면 크기 에뮬레이션의 mobile) · o.touch(터치 에뮬레이션 → pointer:coarse 시도) · o.saveData
//   o.fontBlock { pattern, releaseAt } : CDP Fetch로 글꼴 응답을 releaseAt까지 붙잡음
async function preparePage(page, o = {}) {
  const vp = o.vp || { w: 1920, h: 945, dpr: 1 };
  await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr || 1, mobile: !!o.mobile });
  const applied = {};
  if (o.touch) { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); applied.touch = true; }
  if (o.pointerMedia) {
    try { await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'pointer', value: 'coarse' }, { name: 'any-pointer', value: 'coarse' }, { name: 'hover', value: 'none' }] }); applied.pointerMedia = 'cdp'; }
    catch (e) { applied.pointerMedia = 'cdp-fail: ' + e.message; }
  }
  if (o.saveData) {
    try { await page.send('Emulation.setDataSaverOverride', { dataSaverEnabled: true }); applied.saveData = 'cdp'; }
    catch (e) { applied.saveData = 'cdp-fail: ' + e.message; }
  }
  if (o.probe !== false) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
  if (o.extraScript) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: o.extraScript });
  return applied;
}

function fontBlocker(c, page, pattern) {                  // 요청마다 holdMs 동안 붙잡음(요청 시각 기준: CDN 스크립트가 늦어도 "글꼴만 N초 늦음"이 되게)
  const fb = { holdMs: 0, seen: [], t0: 0 };
  c.on('Fetch.requestPaused', (p) => {
    const rec = { url: p.request.url.replace(/^.*\//, ''), pausedAt: Date.now() - fb.t0, hold: fb.holdMs };
    fb.seen.push(rec);
    setTimeout(() => { rec.releasedAt = Date.now() - fb.t0; page.send('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {}); }, fb.holdMs);
  }, page.sessionId);
  fb.enable = () => page.send('Fetch.enable', { patterns: [{ urlPattern: pattern, requestStage: 'Request' }] });
  return fb;
}

async function navigate(page, url, { waitLoad = true, loadMs = 120000 } = {}) {
  const loaded = waitLoad ? page.once('Page.loadEventFired', loadMs) : null;
  await page.send('Page.navigate', { url });
  if (loaded) await loaded;
}
const ready = (page) => page.evaluate('document.documentElement.dataset.pfReady || ""').catch(() => 'eval-err');
async function waitReady(page, want = ['yes'], ms = 90000, step = 100) {
  const t = Date.now(); let r = '';
  while (Date.now() - t < ms) { r = await ready(page); if (want.includes(r)) return { r, waited: Date.now() - t }; await sleep(step); }
  return { r, waited: Date.now() - t, timedOut: true };
}
const state = (page) => page.evaluate(`JSON.stringify({ t: Math.round(performance.now()), ready: document.documentElement.dataset.pfReady, anyway: document.documentElement.hasAttribute('data-pf-print-anyway'),
  scenes: document.querySelectorAll('.pf-deck > .pf-scene').length, img: window.__a4 ? __a4.snap() : null, timing: window.PFScene && PFScene._t, eager: window.PFScene && PFScene._eager,
  font: document.documentElement.dataset.pfFont || null, vis: document.visibilityState, raf: window.__a4 ? __a4.raf : null,
  hudMsg: (document.querySelector('.pf-hud-msg') || {}).textContent || '', anywayBtn: document.querySelector('.pf-hud [data-a=anyway]') ? !document.querySelector('.pf-hud [data-a=anyway]').hidden : null })`).then(JSON.parse);
const events = (page) => page.evaluate('JSON.stringify(window.__a4 ? { ev: __a4.ev, mo: __a4.mo, vis: __a4.vis } : null)').then(JSON.parse);

async function pdf(page, file, { bg = false } = {}) {
  const t = Date.now();
  const r = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: bg, transferMode: 'ReturnAsBase64' });
  const buf = Buffer.from(r.data, 'base64');
  fs.writeFileSync(file, buf);
  return { file: path.relative(ROOT, file).split(path.sep).join('/'), ms: Date.now() - t, bytes: buf.length };
}
function analyze(files) {                                  // a4-pdf.py: 쪽 수·크기·안내 쪽 여부·쪽마다 그림 수
  if (!files.length) return [];
  const out = execFileSync('python', ['-I', path.join(__dirname, 'a4-pdf.py'), ...files.map((f) => path.resolve(ROOT, f))], { encoding: 'utf8', maxBuffer: 64 << 20 });
  return out.trim().split(/\r?\n/).map((l) => JSON.parse(l));
}

// 브라우저 하나 + 페이지 하나를 열고 fn 실행, 끝나면 닫음
async function withBrowser(browser, fn, launchOpts = {}) {
  const c = await launch(browser, launchOpts);
  try { return await fn(c); } finally { await c.close(); }
}

module.exports = { ROOT, OUT, PORT, startServer, imageDims, PROBE, preparePage, fontBlocker, navigate, ready, waitReady, state, events, pdf, analyze, withBrowser, sleep, launch };
