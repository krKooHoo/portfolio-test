#!/usr/bin/env node
// b-check.js — 덱 스파이크(B) 자체 점검. 랜딩 + 프로젝트 3개 × Chrome·Edge(헤드리스, CDP 파이프)
//   ① 준비·장면 수·화면 감사(R0 audit + outside-deck) ② 덱 보기 배치(한 장만 보임, 1280k×720k 가운데, 문서 스크롤 0, inert)
//   ③ 키보드(→로 끝까지, 끝에서 멈춤, Home/End/PageUp/Space/←/↑/↓, 포커스) ④ hash(#n·#0·#99·#abc·#s=<id>·#s-n, 목차 링크 클릭 + 뒤로)
//   ⑤ 개요(o 키·격자 수·현재 표시·→+Enter·Esc) ⑥ 클릭 구역·터치 스와이프 ⑦ 보기 전환(스크롤 보기 배치·휠 스크롤 → 현재 장면·되돌리기)
//   ⑧ 인쇄: 덱 보기에서 인쇄 매체 DOM 감사(R0 AUDIT_DOC) → PDF 배경 끔·켬(쪽 수 = 장면 수, 960×540pt, pdf-deep: 빈 쪽·쪽 밖 글자·머리글/바닥글·장면 표식)
//      → 스크롤 보기에서도 PDF → 두 PDF 쪽마다 글자 비교, 배경 끔 ↔ 켬 그림 비교 → "요약만"(상세) 쪽 수·바닥글 번호
//   ⑨ (랜딩만) ?wheel=1 휠 넘기기와 기본값(휠 무시), prefers-reduced-motion, 폰 화면(375×812) HUD 넘침
// 실행(PowerShell, 레포 루트): node spikes/deck/harness/b-check.js [--browser chrome|edge|both] [--only <페이지 꼬리>] [--port 4642]
// 결과: spikes/deck/out/b-check.md, b-check.json, out/b/pdf/*.pdf, out/b/views/*.png
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out');
const PDF_DIR = path.join(OUT, 'b', 'pdf'), VIEW_DIR = path.join(OUT, 'b', 'views');
const W = 1280, H = 720, PT = { w: 960, h: 540 }, VP = { w: 1920, h: 945 };
const argv = process.argv.slice(2);
const opt = { browser: 'both', only: '', port: 4642 };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
const PAGES = [
  { key: 'index', url: 'spikes/deck/pages/index.html' },
  { key: '0-Tidy-Mommy', url: 'spikes/deck/pages/project.html?p=0-Tidy-Mommy' },
  { key: '1-action-platformer', url: 'spikes/deck/pages/project.html?p=1-action-platformer' },
  { key: '2-Yggdrasil', url: 'spikes/deck/pages/project.html?p=2-Yggdrasil' },
].filter((p) => !opt.only || p.key.includes(opt.only));

// R0 harness/scene-print-check.js의 인쇄 매체 문서 감사(AUDIT_DOC)·장면 표식(MARK)과 같은 식
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
    if (getComputedStyle(s).visibility !== 'visible') issues.push({ type: 'visibility', scene: i + 1, detail: getComputedStyle(s).visibility });
  });
  const docH = document.documentElement.scrollHeight, docW = document.documentElement.scrollWidth;
  if (docH > scenes.length * ${H} + 0.5) issues.push({ type: 'doc-height', detail: docH + ' > ' + scenes.length * ${H} });
  if (docW > ${W} + 0.5) issues.push({ type: 'doc-width', detail: String(docW) });
  document.querySelectorAll('body *').forEach((e) => { const c = getComputedStyle(e);
    if ((c.position === 'fixed' || c.position === 'sticky') && e.getClientRects().length && c.visibility !== 'hidden') issues.push({ type: 'fixed', detail: '<' + e.tagName.toLowerCase() + '.' + (e.className || '') + '> ' + c.position }); });
  document.querySelectorAll('dialog[open], :popover-open').forEach((e) => { if (e.getClientRects().length) issues.push({ type: 'dialog', detail: e.tagName }); });
  const imgs = [...document.images].filter((i) => i.getClientRects().length);
  const broken = imgs.filter((i) => !i.complete || !i.naturalWidth);
  if (broken.length) issues.push({ type: 'img', detail: broken.length + '개 미완료·실패' });
  const sa = PFScene.audit();
  return { printScenes: scenes.length, docH, docW, issues, sceneAudit: sa };
})()`;
const MARK = `(() => { document.querySelectorAll('[data-pf-mark]').forEach((m) => m.remove());
  const ss = [...document.querySelectorAll('.pf-deck > .pf-scene')].filter((s) => !s.classList.contains('pf-skip'));
  ss.forEach((s, i) => { for (const [pos, tag] of [['left:0;top:0', 'T'], ['right:0;bottom:0', 'B']]) { const m = document.createElement('i');
    m.setAttribute('data-pf-bleed', ''); m.setAttribute('data-pf-mark', ''); m.setAttribute('data-pf-ui', 'chrome'); m.textContent = 'PFK' + (i + 1) + tag;
    m.style.cssText = 'position:absolute;' + pos + ';font:1px/1 sans-serif;color:rgba(0,0,0,.004);pointer-events:none;margin:0;padding:0;z-index:0'; s.appendChild(m); } });
  return ss.length; })()`;
const STATE = `JSON.stringify((() => {
  const ss = [...document.querySelectorAll('.pf-deck > .pf-scene')];
  const vis = ss.filter((s) => getComputedStyle(s).visibility === 'visible').map((s) => ss.indexOf(s));
  const a = document.activeElement;
  return { cur: PFScene.cur, n: ss.length, hash: decodeURIComponent(location.hash), view: PFScene.view, vis: vis.length, visFirst: vis[0] ?? -1,
    hud: document.querySelector('.pf-hud-count')?.textContent || '', sec: document.querySelector('.pf-hud-sec')?.textContent || '',
    live: document.querySelector('.pf-hud .pf-sr')?.textContent || '', active: a ? (a.id || a.className || a.tagName) : '', ov: !!document.querySelector('dialog.pf-ov[open]'),
    inert: ss.filter((s) => s.inert).length, url: location.pathname + location.search + location.hash, hist: history.length };
})())`;
const KEYS = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Home: 36, End: 35, PageUp: 33, PageDown: 34, ' ': 32, Enter: 13, Escape: 27, o: 79 };
const CODES = { ' ': 'Space', o: 'KeyO' };

function py(script, args) {
  try { return execFileSync('python', ['-I', path.join(__dirname, script), ...args], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim().split(/\r?\n/).map((l) => JSON.parse(l)); }
  catch (e) { return [{ error: String(e.message).slice(0, 300) }]; }
}
function pdfPages(buf) {
  const s = buf.toString('latin1');
  const boxes = [...s.matchAll(/\/Type \/Page\b(?!s)[\s\S]*?\/MediaBox \[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
  return { count: (s.match(/\/Type \/Page\b(?!s)/g) || []).length, boxes };
}

async function checkPage(page, base, pg, bname) {
  const rep = { page: pg.key, browser: bname, checks: [], notes: [] };
  const ok = (name, pass, detail = '') => { rep.checks.push({ name, pass: !!pass, detail: String(detail) }); return pass; };
  const ev = (e) => page.evaluate(e);
  const st = async () => JSON.parse(await ev(STATE));
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { const vk = KEYS[k]; const p = { key: k, code: CODES[k] || k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(k === 'Enter' ? { text: String.fromCharCode(13), unmodifiedText: String.fromCharCode(13) } : {}) };   // Enter는 글자 이벤트가 있어야 버튼이 눌림
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...p }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); } };
  const click = async (x, y) => { await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
  const vp = async (w, h, mobile = false, dpr = 1) => page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
  const open = async (url, { wait = true } = {}) => {
    await page.send('Page.navigate', { url: 'about:blank' }); await sleep(50);
    const t0 = Date.now();
    const loaded = page.once('Page.loadEventFired', 90000);
    await page.send('Page.navigate', { url: new URL(url, base).href });
    await loaded;
    let ready = '';
    if (wait) while (Date.now() - t0 < 90000) { ready = await ev('document.documentElement.dataset.pfReady || ""').catch(() => ''); if (ready === 'yes') break; await sleep(80); }
    return { ready, ms: Date.now() - t0 };
  };
  const shot = async (name) => { const s = await page.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(VIEW_DIR, `${bname}__${pg.key}__${name}.png`), Buffer.from(s.data, 'base64')); };
  page.logs.length = 0;
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });
  await vp(VP.w, VP.h);

  // ① 준비·장면 수·화면 감사
  const o = await open(pg.url);
  rep.readyMs = o.ms;
  if (!ok('준비 yes', o.ready === 'yes', `${o.ready} ${o.ms}ms`)) return rep;
  const r0 = JSON.parse(await ev('JSON.stringify((() => { const r = PFScene.report(); return { scenes: r.scenes, k: r.k, view: r.view, audit: r.audit, outsideDeck: r.outsideDeck, timing: r.timing, info: { summary: r.info.summary, overflow: r.info.overflow, errors: r.info.errors, doc: r.info.doc && { scenes: r.info.doc.scenes, clipped: r.info.doc.clipped.length, forced: r.info.doc.forced.length, conservation: r.info.doc.conservation } } }; })())'));
  const N = rep.scenes = r0.scenes;
  rep.k = r0.k; rep.info = r0.info; rep.firstYes = Math.round(r0.timing.firstYes || -1);
  rep.tpl = await ev('[...document.querySelectorAll(".pf-deck > .pf-scene")].map((s) => s.dataset.pfTpl).join(" ")');
  ok('기본 보기 = 덱', r0.view === 'deck', r0.view);
  ok('화면 감사 0(장면 넘침·잘림·덱 밖)', r0.audit.length === 0, r0.audit.slice(0, 3).map((x) => `${x.type} ${x.scene || ''} ${x.detail}`).join(' / ') || '0건');
  ok('분할 오류 없음(잘림 띠·강제 배치·요약 넘침 0, 글자 보존)', !r0.info.errors.length && !r0.info.overflow.length && (!r0.info.doc || (r0.info.doc.clipped === 0 && r0.info.doc.forced === 0 && r0.info.doc.conservation.equal)),
     r0.info.doc ? `문서 ${r0.info.doc.scenes}장, 글자 ${r0.info.doc.conservation.src}=${r0.info.doc.conservation.out}` : '문서 없음');
  // ② 덱 보기 배치
  const geo = JSON.parse(await ev(`JSON.stringify((() => { const k = PFScene.k, s = document.querySelector('.pf-deck > .pf-scene.pf-cur'); const r = s.getBoundingClientRect();
    return { k, w: r.width, h: r.height, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, vw: innerWidth, vh: innerHeight, sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth,
      hudH: document.querySelector('.pf-hud').getBoundingClientRect().height }; })())`));
  const expK = Math.min(VP.w / W, (VP.h - 44) / H);
  ok('덱 보기 배율 k = min(vw/1280, (vh−44)/720)', Math.abs(geo.k - expK) < 1e-6, `k ${geo.k.toFixed(4)}`);
  ok('지금 장면 1280k×720k, 가운데', Math.abs(geo.w - W * geo.k) < 0.75 && Math.abs(geo.h - H * geo.k) < 0.75 && Math.abs(geo.cx - geo.vw / 2) < 0.75 && Math.abs(geo.cy - (geo.vh - 44) / 2) < 0.75,
     `${geo.w.toFixed(1)}×${geo.h.toFixed(1)} 중심 (${geo.cx.toFixed(1)}, ${geo.cy.toFixed(1)})`);
  ok('문서 스크롤 없음(덱 보기)', geo.sh <= geo.vh && geo.sw <= geo.vw, `${geo.sw}×${geo.sh}`);
  let s = await st();
  ok('보이는 장면 1장 + 나머지 inert', s.vis === 1 && s.visFirst === 0 && s.inert === N - 1, `보임 ${s.vis}, inert ${s.inert}`);
  ok('HUD 번호 "01 / N"', s.hud === `01 / ${N}`, s.hud);
  await shot('deck-01');

  // ③ 키보드: →로 끝까지(한 칸씩), 끝에서 멈춤, 나머지 키
  await ev('document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1');
  let stepBad = 0;
  for (let i = 1; i < N; i++) { await key('ArrowRight'); const c = await ev('PFScene.cur'); if (c !== i) { stepBad++; if (stepBad < 3) rep.notes.push(`→ ${i}번째: cur ${c}`); } }
  s = await st();
  ok('→로 마지막 장까지 한 장씩', stepBad === 0 && s.cur === N - 1 && s.hash === `#${N}` && s.hud === `${String(N).padStart(2, '0')} / ${N}` && s.vis === 1 && s.visFirst === N - 1,
     `틀린 걸음 ${stepBad}, 끝 ${s.cur + 1}/${N}, hash ${s.hash}, HUD ${s.hud}`);
  ok('포커스가 지금 장면으로(낭독기 이름 = 장면)', s.active === `s-${N}`, s.active);
  await key('ArrowRight'); s = await st();
  ok('끝에서 → 무시', s.cur === N - 1);
  const seq = [['Home', 0], ['End', N - 1], ['PageUp', N - 2], [' ', N - 1], ['ArrowLeft', N - 2], ['ArrowUp', N - 3], ['ArrowDown', N - 2], ['PageDown', N - 1]];
  const bad = [];
  for (const [k, want] of seq) { await key(k); const c = await ev('PFScene.cur'); if (c !== want) bad.push(`${k}→${c + 1}(기대 ${want + 1})`); }
  ok('Home·End·PageUp·Space·←·↑·↓·PageDown', !bad.length, bad.join(', ') || '모두 맞음');
  // HUD 버튼(포커스가 버튼에 남음 → aria-live로 알림)
  await key('Home');
  const nb = JSON.parse(await ev('JSON.stringify((() => { const r = document.querySelector(".pf-hud [data-a=next]").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })())'));
  await click(nb.x, nb.y); await sleep(30); s = await st();
  ok('HUD › 버튼 + aria-live 알림', s.cur === 1 && /슬라이드 2 \//.test(s.live), `cur ${s.cur + 1}, live "${s.live.slice(0, 40)}"`);

  // ④ hash
  let h = await open(`${pg.url}#5`); s = await st();
  ok('처음 열 때 #5 → 5장', h.ready === 'yes' && s.cur === Math.min(4, N - 1) && s.visFirst === s.cur, `cur ${s.cur + 1}`);
  await ev('location.hash = "#3", 1'); await sleep(80); s = await st();
  ok('열린 상태에서 hash #3 → 3장', s.cur === 2 && s.hash === '#3', `cur ${s.cur + 1} ${s.hash}`);
  await ev('location.hash = "#999", 1'); await sleep(80); s = await st();
  ok('#999 → 마지막 장 + hash 바로잡음', s.cur === N - 1 && s.hash === `#${N}`, `cur ${s.cur + 1} ${s.hash}`);
  await ev('location.hash = "#abc", 1'); await sleep(80); s = await st();
  ok('#abc → 그대로 + hash 바로잡음(주소 = 화면)', s.cur === N - 1 && s.hash === `#${N}`, `cur ${s.cur + 1} ${s.hash}`);
  h = await open(`${pg.url}#0`); s = await st();
  ok('#0 → 1장', s.cur === 0 && s.hash === '#1', `${s.cur + 1} ${s.hash}`);
  h = await open(`${pg.url}#s-4`); s = await st();
  ok('A1 주소 #s-4 → 4장', s.cur === 3, `${s.cur + 1}`);
  h = await open(`${pg.url}${pg.url.includes('?') ? '&' : '?'}view=scroll#4`); s = await st();
  const inV = await ev('(() => { const r = document.querySelector(".pf-deck > .pf-scene#s-4").getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight - 44 + 1; })()');
  ok('처음부터 ?view=scroll#4 → 스크롤 보기, 4장이 화면 안', s.view === 'scroll' && s.cur === 3 && inV, `${s.view} cur ${s.cur + 1} 화면 안 ${inV}`);
  if (pg.key !== 'index') {
    h = await open(`${pg.url}&dividers=all`);
    const dv = JSON.parse(await ev('JSON.stringify({ n: PFScene.count, div: document.querySelectorAll(".pf-deck > .t-DIV").length, audit: PFScene.audit().length })'));
    ok('?dividers=all: 구간마다 디바이더, 감사 0', dv.div >= 4 && dv.n === N + dv.div - 1 && dv.audit === 0, `장면 ${dv.n}(기본 ${N}), 디바이더 ${dv.div}, 감사 ${dv.audit}`);
    rep.scenesAllDividers = dv.n;
    h = await open(`${pg.url}&dividers=none`);
    const dn = JSON.parse(await ev('JSON.stringify({ n: PFScene.count, div: document.querySelectorAll(".pf-deck > .t-DIV").length, audit: PFScene.audit().length })'));
    ok('?dividers=none: 디바이더 없음, 감사 0', dn.div === 0 && dn.n === N - 1 && dn.audit === 0, `장면 ${dn.n}, 감사 ${dn.audit}`);
    rep.scenesNoDividers = dn.n;
  }
  await open(pg.url);                                       // 아래 점검은 기본 주소(덱 보기, 디바이더 기본)에서
  if (pg.key !== 'index') {
    const tgt = JSON.parse(await ev(`JSON.stringify((() => { const hs = [...document.querySelectorAll('.pf-deck .pf-body h2[id], .pf-deck .pf-body h3[id]')]; const t = hs[Math.min(5, hs.length - 1)];
      return { id: t.id, idx: [...document.querySelectorAll('.pf-deck > .pf-scene')].indexOf(t.closest('.pf-scene')) }; })())`));
    h = await open(`${pg.url}#s=${encodeURIComponent(tgt.id)}`); s = await st();
    ok('#s=<제목 id> → 그 제목이 있는 장', s.cur === tgt.idx && s.hash === `#${tgt.idx + 1}`, `${tgt.id} → ${s.cur + 1}(기대 ${tgt.idx + 1})`);
    // 목차 링크 클릭(pushState) → 뒤로 → 목차
    await ev('PFScene.go(1, { focus: false }), 1'); await sleep(250);
    const lk = JSON.parse(await ev(`JSON.stringify((() => { const a = document.querySelector('.pf-deck > .pf-scene.pf-cur .toc-list.sub a') || document.querySelector('.pf-deck > .pf-scene.pf-cur .toc-list a');
      const r = a.getBoundingClientRect(); const id = a.dataset.pfRef; const el = document.getElementById(id);
      return { x: r.left + 20, y: r.top + r.height / 2, idx: [...document.querySelectorAll('.pf-deck > .pf-scene')].indexOf(el.closest('.pf-scene')), hist: history.length }; })())`));
    await click(lk.x, lk.y); await sleep(80); s = await st();
    const afterHist = s.hist;
    ok('목차 링크 클릭 → 그 장(기록 +1)', s.cur === lk.idx && afterHist === lk.hist + 1, `→ ${s.cur + 1}(기대 ${lk.idx + 1}), history ${lk.hist}→${afterHist}`);
    await ev('history.back(), 1'); await sleep(250); s = await st();
    ok('브라우저 뒤로 → 목차(2장)', s.cur === 1, `${s.cur + 1}`);
  }

  // ⑤ 개요
  await ev('PFScene.go(2, { focus: false }), 1'); await sleep(30);
  await key('o'); await sleep(150);
  const ov = JSON.parse(await ev(`JSON.stringify((() => { const d = document.querySelector('dialog.pf-ov'); const items = d ? [...d.querySelectorAll('.pf-ov-item')] : [];
    return { open: !!(d && d.open), items: items.length, cur: items.findIndex((b) => b.getAttribute('aria-current') === 'true'), focus: items.indexOf(document.activeElement),
      k: d ? parseFloat(getComputedStyle(d).getPropertyValue('--ov-k')) : 0, secs: d ? d.querySelectorAll('.pf-ov-sec').length : 0, audit: PFScene.audit().filter((x) => x.type === 'dialog').length }; })())`));
  ok('개요 열림(o 키): 격자 수 = 장면 수, 지금 장면 표시·포커스', ov.open && ov.items === N && ov.cur === 2 && ov.focus === 2 && ov.k > 0.1, `열림 ${ov.open}, ${ov.items}칸, 현재 ${ov.cur + 1}, 포커스 ${ov.focus + 1}, 축소 ${ov.k.toFixed(3)}, 묶음 ${ov.secs}`);
  await shot('overview');
  await key('ArrowRight'); await key('Enter'); await sleep(120); s = await st();
  ok('개요에서 → + Enter → 4장으로 이동·닫힘', !s.ov && s.cur === 3, `ov ${s.ov}, cur ${s.cur + 1}`);
  await key('o'); await sleep(100); await key('Escape'); await sleep(100); s = await st();
  ok('개요 Esc → 닫힘(장면 그대로)', !s.ov && s.cur === 3, `ov ${s.ov}, cur ${s.cur + 1}`);

  // ⑥ 클릭 구역·터치 스와이프(윗줄 높이 = 링크 없는 곳)
  await ev('PFScene.go(2, { focus: false }), 1'); await sleep(30);
  const sr = JSON.parse(await ev('JSON.stringify(document.querySelector(".pf-deck > .pf-scene.pf-cur").getBoundingClientRect())'));
  const yTop = sr.top + sr.height * 0.03;
  await click(sr.left + sr.width * 0.85, yTop); await sleep(30); const c1 = await ev('PFScene.cur');
  await click(sr.left + sr.width * 0.1, yTop); await sleep(30); const c2 = await ev('PFScene.cur');
  ok('클릭 구역: 오른쪽 → 다음, 왼쪽 30% → 이전', c1 === 3 && c2 === 2, `${c1 + 1}, ${c2 + 1}`);
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const swipe = async (x0, x1, y) => { await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 5; i++) await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 5, y }] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(60); };
  const ym = sr.top + sr.height * 0.5;
  await swipe(sr.left + sr.width * 0.7, sr.left + sr.width * 0.3, ym); const t1 = await ev('PFScene.cur');
  await swipe(sr.left + sr.width * 0.3, sr.left + sr.width * 0.7, ym); const t2 = await ev('PFScene.cur');
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  ok('터치 스와이프: 왼쪽으로 → 다음, 오른쪽으로 → 이전', t1 === 3 && t2 === 2, `${t1 + 1}, ${t2 + 1}`);

  // ⑦ 보기 전환(HUD 버튼) → 스크롤 보기
  await ev('PFScene.go(3, { focus: false }), 1'); await sleep(30);
  const vb = JSON.parse(await ev('JSON.stringify((() => { const r = document.querySelector(".pf-hud [data-a=view]").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })())'));
  await click(vb.x, vb.y); await sleep(200); s = await st();
  const sg = JSON.parse(await ev(`JSON.stringify((() => { const k = PFScene.k, ss = [...document.querySelectorAll('.pf-deck > .pf-scene')], vw = document.documentElement.clientWidth; let bad = 0, gapBad = 0;
    ss.forEach((x, i) => { const r = x.getBoundingClientRect(); if (Math.abs(r.width - 1280 * k) > 0.75 || Math.abs(r.height - 720 * k) > 0.75 || Math.abs((r.left + r.right) / 2 - vw / 2) > 0.75) bad++;
      if (i) { const p = ss[i - 1].getBoundingClientRect(); if (Math.abs(r.top - p.bottom - 16) > 0.75) gapBad++; } });
    const c = ss[PFScene.cur].getBoundingClientRect();
    return { k, bad, gapBad, inView: c.top >= -1 && c.bottom <= innerHeight - 44 + 1, sw: document.documentElement.scrollWidth, vw, visible: ss.filter((x) => getComputedStyle(x).visibility === 'visible').length, audit: PFScene.audit().length }; })())`));
  ok('스크롤 보기로 전환(같은 장면, 주소 ?view=scroll)', s.view === 'scroll' && s.cur === 3 && /view=scroll/.test(s.url) && s.inert === 0, `${s.view} cur ${s.cur + 1} ${s.url.replace(/^.*\//, '')}`);
  ok('스크롤 보기 배치(A1 형제 + 여백 보정: 크기·가운데·간격 16, 가로 넘침 0, 모두 보임, 지금 장면이 화면 안)', sg.bad === 0 && sg.gapBad === 0 && sg.sw <= sg.vw && sg.visible === N && sg.inView,
     `k ${sg.k.toFixed(3)}, 크기 오류 ${sg.bad}, 간격 오류 ${sg.gapBad}, 보임 ${sg.visible}, 화면 안 ${sg.inView}`);
  ok('스크롤 보기 화면 감사 0', sg.audit === 0, String(sg.audit));
  await shot('scroll');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: VP.w / 2, y: VP.h / 2, deltaX: 0, deltaY: Math.round(720 * sg.k + 16) * 2 });
  await sleep(700); s = await st();
  ok('휠 스크롤 → 지금 장면·hash 따라감', s.cur >= Math.min(5, N - 1) && s.hash === `#${s.cur + 1}`, `cur ${s.cur + 1} ${s.hash}`);
  const curScroll = s.cur;
  await click(vb.x, vb.y); await sleep(200); s = await st();
  ok('덱 보기로 되돌림(스크롤에서 고른 장면 유지)', s.view === 'deck' && s.cur === curScroll && s.vis === 1 && s.visFirst === curScroll && !/view=scroll/.test(s.url), `${s.view} cur ${s.cur + 1}`);

  // ⑧ 인쇄(덱 보기에서): 인쇄 매체 DOM 감사 → PDF
  await ev(`PFScene.go(${Math.min(3, N - 1)}, { focus: false }), 1`);
  await vp(W, H); await page.send('Emulation.setEmulatedMedia', { media: 'print' }); await sleep(150);
  const pa = await ev(AUDIT_DOC);
  ok('인쇄 매체 DOM 감사 0(덱 보기에서, 모든 장면 1280×720·i×720 위치·쪽 나눔·보임)', pa.issues.length === 0 && pa.sceneAudit.length === 0 && pa.printScenes === N,
     `인쇄 장면 ${pa.printScenes}/${N}, 문제 ${pa.issues.length + pa.sceneAudit.length} ${[...pa.issues, ...pa.sceneAudit].slice(0, 2).map((x) => x.type + ' ' + (x.detail || '')).join(' / ')}`);
  await page.send('Emulation.setEmulatedMedia', { media: '' }); await vp(VP.w, VP.h); await sleep(100);
  await ev(MARK);
  const pdf = {};
  for (const [tag, bg] of [['deck-bg0', false], ['deck-bg1', true]]) {
    const r = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: bg, displayHeaderFooter: false, transferMode: 'ReturnAsBase64' });
    const buf = Buffer.from(r.data, 'base64'); const f = path.join(PDF_DIR, `${bname}__${pg.key}__${tag}.pdf`); fs.writeFileSync(f, buf);
    const p = pdfPages(buf);
    pdf[tag] = { file: f, pages: p.count, badBox: p.boxes.filter((b) => Math.abs(b[2] - b[0] - PT.w) > 0.01 || Math.abs(b[3] - b[1] - PT.h) > 0.01).length };
  }
  ok('PDF(덱 보기, 배경 끔·켬) 쪽 수 = 장면 수, 모두 960×540pt', pdf['deck-bg0'].pages === N && pdf['deck-bg1'].pages === N && !pdf['deck-bg0'].badBox && !pdf['deck-bg1'].badBox,
     `${pdf['deck-bg0'].pages}/${pdf['deck-bg1'].pages}쪽, 크기 불일치 ${pdf['deck-bg0'].badBox + pdf['deck-bg1'].badBox}`);
  // 스크롤 보기에서 인쇄
  await ev('PFScene.setView("scroll"), 1'); await sleep(150); await ev(MARK);
  { const r = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, transferMode: 'ReturnAsBase64' });
    const buf = Buffer.from(r.data, 'base64'); const f = path.join(PDF_DIR, `${bname}__${pg.key}__scroll-bg1.pdf`); fs.writeFileSync(f, buf); pdf['scroll-bg1'] = { file: f, pages: pdfPages(buf).count }; }
  await ev('PFScene.setView("deck"), 1'); await sleep(100);
  const deep = py('pdf-deep.py', [String(PT.w), String(PT.h), '--markers', '--no-footer', pdf['deck-bg0'].file, pdf['deck-bg1'].file, pdf['scroll-bg1'].file]);
  rep.deep = deep.map((d) => ({ file: path.basename(d.file || ''), pages: d.pages, badSize: d.badSize, blank: d.blank, outside: d.outside, headerFooter: d.headerFooter, markerIssues: d.markerIssues, issues: d.issues }));
  ok('PDF 깊은 검사(빈 쪽·글자 없는 쪽·쪽 밖 글자·머리글/바닥글 0, 장면 i = i쪽)', deep.every((d) => !d.error && d.issues.length === 0), deep.map((d) => d.error || `${path.basename(d.file).split('__').pop()}: ${d.issues.length ? d.issues.slice(0, 2).join('; ') : '0'}`).join(' | '));
  const same = py('pdf-compare.py', [pdf['deck-bg1'].file, pdf['scroll-bg1'].file])[0];
  ok('덱 보기 PDF = 스크롤 보기 PDF(쪽 수, 쪽마다 글자)', same.pagesA === N && same.pagesB === N && same.textSame === N, `${same.pagesA}/${same.pagesB}쪽, 글자 같은 쪽 ${same.textSame}`);
  const bgcmp = py('pdf-compare.py', [pdf['deck-bg0'].file, pdf['deck-bg1'].file, '--visual'])[0];
  ok('배경 그래픽 끔 = 켬(print-color-adjust: exact, 그림 차이 ≤ 1/255)', bgcmp.visualMax <= 1, `최대 ${bgcmp.visualMax}, 평균 ${bgcmp.visualMean}, 차이 쪽 ${JSON.stringify(bgcmp.visualOver1)}`);
  rep.pdf = Object.fromEntries(Object.entries(pdf).map(([k, v]) => [k, { pages: v.pages, file: path.relative(ROOT, v.file).replace(/\\/g, '/') }]));
  // 요약만(상세)
  if (pg.key !== 'index') {
    const n2 = await ev('(PFScene.setScope("summary"), document.querySelectorAll(".pf-deck > .pf-scene:not(.pf-skip)").length)');
    await ev(MARK);
    const r = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: false, displayHeaderFooter: false, transferMode: 'ReturnAsBase64' });
    const buf = Buffer.from(r.data, 'base64'); const f = path.join(PDF_DIR, `${bname}__${pg.key}__summary-bg0.pdf`); fs.writeFileSync(f, buf);
    const d = py('pdf-deep.py', [String(PT.w), String(PT.h), '--markers', '--footer', f])[0];
    ok('"요약만" PDF 쪽 수 = 인쇄 장면 수, 바닥글 번호 = 쪽 번호', pdfPages(buf).count === n2 && !d.error && d.issues.length === 0, `${pdfPages(buf).count}/${n2}쪽 ${d.error || d.issues.slice(0, 2).join('; ')}`);
    rep.summaryPages = n2;
    await ev('(PFScene.setScope("all"), 1)');
  }

  // ⑨ 랜딩에서만: 휠 플래그, 줄인 움직임, 폰 화면
  if (pg.key === 'index') {
    await open(pg.url); await ev('PFScene.go(0, { focus: false }), 1');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 400, deltaX: 0, deltaY: 300 }); await sleep(250);
    ok('기본값: 덱 보기에서 휠 무시', (await ev('PFScene.cur')) === 0);
    await open(`${pg.url.replace('.html', '.html?wheel=1')}`);
    for (let i = 0; i < 6; i++) { await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 400, deltaX: 0, deltaY: 100 }); await sleep(40); }
    const w1 = await ev('PFScene.cur'); await sleep(320);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 400, deltaX: 0, deltaY: 100 }); await sleep(60);
    const w2 = await ev('PFScene.cur'); await sleep(320);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 400, deltaX: 0, deltaY: -100 }); await sleep(60);
    const w3 = await ev('PFScene.cur');
    ok('?wheel=1: 몸짓 하나(연속 6틱) = 한 장, 쉬고 다시 = 한 장, 위로 = 이전', w1 === 1 && w2 === 2 && w3 === 1, `${w1 + 1}, ${w2 + 1}, ${w3 + 1}`);
    await open(pg.url);
    await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await key('ArrowRight'); const an = await ev('document.querySelector(".pf-deck > .pf-scene.pf-cur").getAnimations().length');
    await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });
    await key('ArrowRight'); const an2 = await ev('document.querySelector(".pf-deck > .pf-scene.pf-cur").getAnimations().length');
    ok('prefers-reduced-motion: 전환 효과 없음(기본은 0.18초 페이드)', an === 0 && an2 >= 1, `줄임 ${an}개, 기본 ${an2}개`);
  }
  // 폰 화면(모든 페이지): 375×812 세로, 812×375 가로
  for (const [w, hh, tag] of [[375, 812, 'phone'], [812, 375, 'phone-land']]) {
    await vp(w, hh, true, 2); await sleep(150);
    const m = JSON.parse(await ev(`JSON.stringify((() => { const hud = document.querySelector('.pf-hud'); const r = document.querySelector('.pf-deck > .pf-scene.pf-cur').getBoundingClientRect();
      const btns = [...hud.querySelectorAll('button')].filter((b) => !b.hidden && b.getClientRects().length).map((b) => b.getBoundingClientRect());
      return { k: PFScene.k, over: hud.scrollWidth > hud.clientWidth + 1, clipBtn: btns.filter((b) => b.right > innerWidth + 0.5 || b.left < -0.5).length, inView: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight - 44 + 0.5, minBtnH: Math.min(...btns.map((b) => b.height)) }; })())`));
    ok(`${tag} ${w}×${hh}: 장면 화면 안, HUD 넘침 0`, !m.over && m.clipBtn === 0 && m.inView, `k ${m.k.toFixed(3)}, 본문 16px → ${(16 * m.k).toFixed(1)}px, 버튼 높이 ${m.minBtnH}`);
    await shot(tag);
  }
  await vp(VP.w, VP.h);
  rep.logs = page.logs.filter((l) => l.type !== 'net-fail' || !/ERR_ABORTED/.test(l.text)).slice(0, 10);
  rep.ok = rep.checks.every((c) => c.pass);
  return rep;
}

(async () => {
  fs.mkdirSync(PDF_DIR, { recursive: true }); fs.mkdirSync(VIEW_DIR, { recursive: true });
  const server = await serve(ROOT, +opt.port);
  const all = [];
  try {
    for (const b of opt.browser === 'both' ? ['chrome', 'edge'] : [opt.browser]) {
      const c = await launch(b);
      try {
        for (const pg of PAGES) {
          const page = await c.newPage();                     // 페이지마다 새 탭(방문 기록 50개 상한에 걸리지 않게)
          const rep = await checkPage(page, server.base, pg, b).finally(() => page.close());
          rep.version = c.version; all.push(rep);
          const fails = rep.checks.filter((x) => !x.pass);
          console.log(`${rep.ok ? 'PASS' : 'FAIL'}  ${b.padEnd(6)} ${pg.key.padEnd(20)} 장면 ${rep.scenes}  점검 ${rep.checks.length - fails.length}/${rep.checks.length}  준비 ${rep.firstYes}ms`);
          fails.forEach((x) => console.log(`   ✗ ${x.name}: ${x.detail}`));
        }
      } finally { await c.close(); }
    }
  } finally { await server.close(); }
  fs.writeFileSync(path.join(OUT, 'b-check.json'), JSON.stringify(all, null, 1));
  fs.writeFileSync(path.join(OUT, 'b-check.md'), toMd(all));
  process.exit(all.every((r) => r.ok) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });

function toMd(all) {
  const L = [];
  const v = [...new Set(all.map((r) => r.version))].join(', ');
  L.push('# B(슬라이드 덱 샘플) 자체 점검 결과', '');
  L.push(`- 실행: \`node spikes/deck/harness/b-check.js\` (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`);
  L.push(`- 브라우저: ${v} — 헤드리스, CDP 파이프(디버그 포트 없음), 프로필은 %TEMP%\\deck-*에 만들고 지움`);
  L.push(`- 서버: 127.0.0.1:${opt.port}(읽기 전용, 끝나면 닫음). 화면 ${VP.w}×${VP.h}@1(A1 기준선과 같은 높이), PDF는 CDP \`Page.printToPDF\`(preferCSSPageSize). 실제 인쇄 대화상자 "PDF로 저장"은 **미확인**`);
  L.push('', '## 요약', '', '| 페이지 | 브라우저 | 장면(= PDF 쪽) | 요약만 쪽 | 디바이더 all / none일 때 장면 | 점검 통과 | 준비(ms) | 판정 |', '|---|---|---|---|---|---|---|---|');
  all.forEach((r) => { const p = r.checks.filter((c) => c.pass).length; L.push(`| ${r.page} | ${r.browser} | ${r.scenes ?? '—'} | ${r.summaryPages ?? '—'} | ${r.scenesAllDividers ? `${r.scenesAllDividers} / ${r.scenesNoDividers}` : '—'} | ${p}/${r.checks.length} | ${r.firstYes ?? '—'} | ${r.ok ? 'PASS' : '**FAIL**'} |`); });
  L.push('', '## 장면 구성', '');
  const seen = new Set();
  all.forEach((r) => { if (seen.has(r.page)) return; seen.add(r.page); const s = r.info?.summary || {};
    L.push(`- **${r.page}** ${r.scenes}장: ${Object.entries(s).filter(([k, x]) => typeof x === 'number').map(([k, x]) => `${k} ${x}`).join(' · ')}${r.info?.doc ? ` (문서 글자 보존 ${r.info.doc.conservation.src} = ${r.info.doc.conservation.out})` : ''}`); });
  L.push('', '## 점검 항목별', '');
  all.forEach((r) => {
    L.push(`### ${r.page} · ${r.browser} — ${r.ok ? 'PASS' : 'FAIL'}`, '', '| 점검 | 결과 | 값 |', '|---|---|---|');
    r.checks.forEach((c) => L.push(`| ${c.name} | ${c.pass ? '✓' : '✗'} | ${String(c.detail).replace(/\|/g, '\\|').slice(0, 200)} |`));
    if (r.notes.length) L.push('', `메모: ${r.notes.join(' / ')}`);
    if (r.logs?.length) L.push('', `콘솔: ${r.logs.map((l) => `${l.type} ${l.text.slice(0, 120)}`).join(' / ')}`);
    L.push('');
  });
  L.push('## 산출물', '', '- PDF: `spikes/deck/out/b/pdf/<브라우저>__<페이지>__{deck-bg0,deck-bg1,scroll-bg1,summary-bg0}.pdf`',
    '- 화면: `spikes/deck/out/b/views/<브라우저>__<페이지>__{deck-01,overview,scroll,phone,phone-land}.png`', '- 원자료: `spikes/deck/out/b-check.json`', '');
  return L.join('\n');
}
