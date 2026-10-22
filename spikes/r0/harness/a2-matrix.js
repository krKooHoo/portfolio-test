#!/usr/bin/env node
// a2-matrix.js — R0 A2: 화면 배율 transform "형제 + 여백 보정"(01 §7-1) 검증 매트릭스
//   페이지 5개(랜딩 + 상세 4) × 뷰포트(배율 k 9종) × DPR {1, 1.25, 1.5} × Chrome·Edge
//   (a) 장면 상자 1280k×720k·간격·레터박스·가운데  (b) 가로 넘침 0·유령 스크롤 0  (c) 화면 audit() 0 + 장면 나눔 서명 = A1
//   (d) 이동: go()·키보드·HUD 클릭·해시·딥 링크 → 장면이 화면 안(가운데 맞춤 계산과 일치), IO 카운터
//   (e) 클릭 판정: 화면 격자 점마다 elementFromPoint ↔ 보이는 상자 계산, 장면 안 링크 실제 클릭, 끌어서 선택·두 번 클릭 선택
//   (f) 라이트박스(body 아래 dialog, 지금 렌더러 방식) + 장면 안 dialog 대조  (g) 그 뷰포트에서 바로 printToPDF
//   (h) DPR별 장면 위치 차이(같은 뷰포트의 DPR 1 대비)
// 실행(PowerShell, 레포 루트): node spikes/r0/harness/a2-matrix.js [--browser chrome|edge|both] [--dpr 1,1.25,1.5] [--vp all|k0.5,k1.268]
//                              [--pages spikes/r0/pages] [--tag sib] [--only <페이지 id>] [--port 4622]
// 결과: spikes/r0/out/a2/<tag>.json · <tag>.md, PDF는 spikes/r0/out/a2/pdf/<tag>/
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, sleep } = require('./lib/cdp');
const { serve } = require('./lib/server');
const SPC = require('./scene-print-check');
// 감싸개 대조안(.pf-deck > .pf-frame > .pf-scene)에서도 같은 식이 돌도록 선택자를 넓힌 사본(측정용 컨테이너는 덱 밖이라 섞이지 않음)
const SIGNATURE = SPC.SIGNATURE.replace(/\.pf-deck > \.pf-scene/g, '.pf-deck .pf-scene');
const MARK = SPC.MARK.replace(/\.pf-deck > \.pf-scene/g, '.pf-deck .pf-scene');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out/a2');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const PORT = +arg('port', 4622);
const TAG = arg('tag', 'sib');
const PAGES_DIR = arg('pages', 'spikes/r0/pages').replace(/\\/g, '/').replace(/\/$/, '');
const browsers = arg('browser', 'chrome') === 'both' ? ['chrome', 'edge'] : [arg('browser', 'chrome')];
const DPRS = arg('dpr', '1,1.25,1.5').split(',').map(Number);
const NO_PDF = argv.includes('--no-pdf');
const NO_RESIZE = argv.includes('--no-resize');

// 뷰포트 → 기대 k (헤드리스 클래식 스크롤바 15px 반영. 모바일 에뮬레이션은 오버레이 스크롤바라 0)
const VPS = [
  { id: 'k0.29', w: 375, h: 812, mobile: true, note: 'iPhone 세로(모바일 에뮬레이션)' },
  { id: 'k0.5', w: 655, h: 900, note: '좁은 창(폭이 k를 정함)' },
  { id: 'k0.728', w: 1280, h: 556, note: '14인치 FHD@150% + 즐겨찾기 막대' },
  { id: 'k0.75', w: 975, h: 1000, note: '반쪽 스냅 창(폭이 k를 정함)' },
  { id: 'k0.835', w: 1366, h: 633, note: 'HD 노트북' },
  { id: 'k0.968', w: 1536, h: 729, note: 'FHD@125%' },
  { id: 'k1.0', w: 1366, h: 752, note: '정확히 1' },
  { id: 'k1.268', w: 1920, h: 945, note: 'FHD 최대화' },
  { id: 'k1.5', w: 2560, h: 1305, note: 'QHD(상한 1.5)' },
];
VPS.forEach((v) => { const cw = v.w - (v.mobile ? 0 : 15); v.k = Math.min(1.5, cw / 1280, (v.h - 32) / 720); });
const vpSel = arg('vp', 'all');
const vps = vpSel === 'all' ? VPS : VPS.filter((v) => vpSel.split(',').includes(v.id));

// 시드 고정 난수(재현용)
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const seedOf = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ════════════════════ 페이지 안 도우미(문자열로 주입) ════════════════════
function helper() {
  if (window.__a2) return 'again';
  const de = document.documentElement;
  const deck = document.querySelector('.pf-deck');
  const scenes = () => [...deck.querySelectorAll('.pf-scene')].filter((s) => !s.closest('.pf-measure'));
  const slotOf = (s) => (s.parentElement === deck ? s : s.parentElement);       // 형제 구조: 장면 자신 / 감싸개 구조: .pf-frame
  const settle = (ms = 40) => new Promise((r) => { let d = false; const fin = () => { if (!d) { d = true; setTimeout(r, ms); } }; requestAnimationFrame(() => requestAnimationFrame(fin)); setTimeout(fin, 600); });
  const hudCount = () => (document.querySelector('.pf-hud-count') || {}).textContent || '';
  const hudRect = () => { const h = document.querySelector('.pf-hud'); return h ? h.getBoundingClientRect() : null; };
  const mul = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const f3 = (v) => Math.round(v * 1000) / 1000;

  function geom() {
    const k = PFScene.k, vw = de.clientWidth, vh = innerHeight, ss = scenes(), N = ss.length;
    const W = 1280 * k, H = 720 * k;
    const sx = scrollX, sy = scrollY;
    const dr = deck.getBoundingClientRect();
    const m = { k, vw, vh, iw: innerWidth, N, W: f3(W), H: f3(H), lb: f3((vw - W) / 2), dpr: devicePixelRatio,
      vvScale: window.visualViewport ? visualViewport.scale : null, structure: ss[0] && slotOf(ss[0]) !== ss[0] ? 'wrapper' : 'sibling',
      maxDW: 0, maxDH: 0, maxDC: 0, maxDGap: 0, maxDSlotW: 0, maxDSlotH: 0, maxDOrigin: 0, issues: [], rects: [] };
    let prev = null;
    ss.forEach((s, i) => {
      const r = s.getBoundingClientRect(), slot = slotOf(s), cs = getComputedStyle(slot);
      const sw = slot.offsetWidth + parseFloat(cs.marginLeft) + parseFloat(cs.marginRight);
      const sh = slot.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
      // 보이는 상자의 왼쪽 위 = 레이아웃 원점(transform-origin 0 0). offset*은 정수 반올림이라 허용오차 1
      const ox = slot === s ? s.offsetLeft : slot.getBoundingClientRect().left + sx;
      const oy = slot === s ? s.offsetTop : slot.getBoundingClientRect().top + sy;
      const dW = Math.abs(r.width - W), dH = Math.abs(r.height - H), dC = Math.abs((r.left + r.right) / 2 - vw / 2);
      const dSW = Math.abs(sw - W), dSH = Math.abs(sh - H), dO = Math.max(Math.abs(r.left + sx - ox), Math.abs(r.top + sy - oy));
      m.maxDW = Math.max(m.maxDW, dW); m.maxDH = Math.max(m.maxDH, dH); m.maxDC = Math.max(m.maxDC, dC);
      m.maxDSlotW = Math.max(m.maxDSlotW, dSW); m.maxDSlotH = Math.max(m.maxDSlotH, dSH); m.maxDOrigin = Math.max(m.maxDOrigin, dO);
      if (dW > 1 || dH > 1) m.issues.push(`장면 ${i + 1} 보이는 크기 ${f3(r.width)}×${f3(r.height)} ≠ ${f3(W)}×${f3(H)}`);
      if (dSW > 1 || dSH > 1) m.issues.push(`장면 ${i + 1} 차지하는 상자(여백 상자) ${f3(sw)}×${f3(sh)} ≠ ${f3(W)}×${f3(H)}`);
      if (dC > 1) m.issues.push(`장면 ${i + 1} 가운데 아님(중심 ${f3((r.left + r.right) / 2)} vs ${vw / 2})`);
      if (dO > 1.01) m.issues.push(`장면 ${i + 1} 보이는 원점 ≠ 레이아웃 원점 (${f3(dO)}px)`);
      if (prev) { const g = r.top - prev.bottom; m.maxDGap = Math.max(m.maxDGap, Math.abs(g - 16)); if (Math.abs(g - 16) > 1) m.issues.push(`장면 ${i}→${i + 1} 간격 ${f3(g)}`); }
      prev = r;
      m.rects.push([f3(r.left - dr.left), f3(r.top - dr.top), f3(r.width), f3(r.height)]);
    });
    m.firstTop = N ? f3(ss[0].getBoundingClientRect().top - dr.top) : null;
    m.lastGap = N ? f3(dr.bottom - ss[N - 1].getBoundingClientRect().bottom) : null;
    m.deckH = f3(dr.height); m.expectDeckH = f3(N * H + (N + 1) * 16);
    if (Math.abs(m.firstTop - 16) > 1) m.issues.push(`첫 장면 위 여백 ${m.firstTop}`);
    if (Math.abs(m.lastGap - 16) > 1) m.issues.push(`마지막 장면 아래 여백 ${m.lastGap}`);
    if (Math.abs(m.deckH - m.expectDeckH) > 1) m.issues.push(`덱 높이 ${m.deckH} ≠ ${m.expectDeckH}`);
    // (b) 넘침: 문서 폭, 가로 스크롤 시도, 세로 유령 스크롤(변환 전 상자가 문서 높이를 늘리는지)
    m.scrollW = de.scrollWidth; m.bodyScrollW = document.body.scrollWidth; m.clientW = vw;
    m.scrollH = de.scrollHeight; m.docBottom = f3(dr.bottom + sy);
    scrollTo(1e7, sy); m.maxScrollX = scrollX; scrollTo(sx, sy);
    if (m.scrollW > vw || m.bodyScrollW > vw) m.issues.push(`가로 넘침: scrollWidth ${m.scrollW}/${m.bodyScrollW} > ${vw}`);
    if (m.maxScrollX > 0) m.issues.push(`가로 스크롤 가능 ${m.maxScrollX}px`);
    if (m.scrollH > Math.ceil(m.docBottom) + 1) m.issues.push(`세로 유령 스크롤: scrollHeight ${m.scrollH} > 덱 끝 ${m.docBottom}`);
    if (m.vvScale != null && Math.abs(m.vvScale - 1) > 1e-6) m.issues.push(`visualViewport.scale ${m.vvScale}(모바일 축소 맞춤 발생)`);
    if (m.iw !== Math.round(m.iw)) m.issues.push(`innerWidth ${m.iw}`);
    // (c) 화면 상태에서 키트 감사
    const t0 = performance.now();
    m.audit = PFScene.audit(); m.auditMs = Math.round(performance.now() - t0);
    m.auditN = m.audit.length; m.audit = m.audit.slice(0, 8);
    m.issues = m.issues.slice(0, 20);
    return m;
  }

  // 지금 가장 많이 보이는 장면들(보이는 비율이 최댓값과 0.001 안). 장면 여럿이 통째로 보이는 작은 k에서는 여럿
  function mostVisible() {
    const ss = scenes(), vh = innerHeight; let mx = -1;
    const fr = ss.map((s) => { const r = s.getBoundingClientRect(); const v = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / r.height; mx = Math.max(mx, v); return v; });
    return fr.map((v, i) => (v >= mx - 1e-3 ? i : -1)).filter((i) => i >= 0);
  }
  // 장면 i를 맞출 기대 스크롤 위치: 루트 scroll-padding(HUD 알약일 때 아래 72px) 안에 장면이 다 들어가면 그 영역 가운데,
  // 안 들어가면 화면 전체 가운데(= 장면 전체가 보임). 지금 키트의 scrollIntoView({block:'center'})는 앞의 경우만 맞음
  function wantY(r) {
    const vh = innerHeight, rcs = getComputedStyle(de), pt = parseFloat(rcs.scrollPaddingTop) || 0, pb = parseFloat(rcs.scrollPaddingBottom) || 0, avail = vh - pt - pb;
    const off = r.height <= avail ? pt + (avail - r.height) / 2 : Math.max(0, (vh - r.height) / 2);
    return { y: Math.max(0, Math.min(de.scrollHeight - vh, r.top + scrollY - off)), pad: pt || pb ? [pt, pb] : undefined };
  }
  function navState(i, wantHash, relaxed) {
    const ss = scenes(), s = ss[i], r = s.getBoundingClientRect(), vh = innerHeight;
    const { y: want, pad } = wantY(r);
    const st = { i, scrollY: f3(scrollY), want: f3(want), pad, dScroll: f3(Math.abs(scrollY - want)), top: f3(r.top), bottom: f3(r.bottom),
      inView: r.top >= -1 && r.bottom <= vh + 1, hud: hudCount(), hudWant: `${i + 1} / ${ss.length}`, hash: location.hash };
    // relaxed(go() 없이 직접 스크롤): HUD 장면이 "가장 많이 보이는 장면" 가운데 하나면 맞음. 그 밖(go·키·HUD·해시·딥 링크): 목표 장면과 같아야 함
    const mv = relaxed ? mostVisible() : null;
    st.hudOk = relaxed ? mv.includes(parseInt(st.hud, 10) - 1) : st.hud === st.hudWant;
    if (relaxed) st.mostVisible = mv.map((x) => x + 1);
    const dh = (h) => { try { return decodeURIComponent(h); } catch { return h; } };
    st.hashOk = wantHash == null || dh(location.hash) === dh(wantHash);
    st.posOk = st.dScroll <= 1 && st.inView;
    st.ok = st.dScroll <= 1 && st.inView && st.hudOk && st.hashOk;
    return st;
  }
  async function goState(i, wantHash) { PFScene.go(i); await settle(); await settle(60); return navState(i, wantHash === undefined ? `#s-${i + 1}` : wantHash); }
  async function scrollCenter(i) {          // go() 없이 직접 스크롤 → IO 카운터만으로 맞는지
    const ss = scenes(), r = ss[i].getBoundingClientRect(), vh = innerHeight;
    scrollTo(0, wantY(r).y); await settle(); await settle(60); return navState(i, null, true);
  }
  // 임의 위치로 스크롤 → HUD 카운터가 "지금 가장 많이 보이는 장면" 가운데 하나인지
  async function scrollRandom(frac) {
    const vh = innerHeight, maxY = de.scrollHeight - vh; scrollTo(0, Math.round(frac * maxY)); await settle(); await settle(60);
    const mv = mostVisible(), hud = hudCount();
    return { y: f3(scrollY), hud, mostVisible: mv.map((x) => x + 1), ok: mv.includes(parseInt(hud, 10) - 1) };
  }
  async function setHash(h, i) { location.hash = h; await settle(); await settle(60); return navState(i, null); }
  function sceneOfId(id) { const el = document.getElementById(id); const s = el && (el.classList.contains('pf-scene') ? el : el.closest('.pf-scene')); return scenes().indexOf(s); }
  function firstDocHeadingId() { const h = deck.querySelector('.pf-scene[data-pf-part="doc"] .pf-body h2[id]') || deck.querySelector('.pf-title[id]'); return h ? h.id : null; }

  // (e) 화면 격자 점 클릭 판정: 기대 = 보이는 상자(gBCR) 안에 든 장면, 실제 = elementFromPoint(...).closest('.pf-scene')
  function hitGrid(seed) {
    const ss = scenes(), vw = de.clientWidth, vh = innerHeight, rs = ss.map((s) => s.getBoundingClientRect());
    const hr = hudRect(), rnd = mul(seed);
    const pts = [];
    const nx = 13, ny = 11;
    for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) pts.push([(a + 0.5) * vw / nx, (b + 0.5) * vh / ny]);
    for (let n = 0; n < 60; n++) pts.push([rnd() * vw, rnd() * vh]);
    // 경계 바로 안·밖(1.5px), 그리고 k<1의 "유령" 영역(변환 전 1280×720 상자가 보이는 상자 밖으로 뻗은 곳)
    rs.forEach((r, i) => {
      if (r.bottom < 0 || r.top > vh) return;
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      pts.push([r.left + 1.5, cy], [r.right - 1.5, cy], [cx, r.top + 1.5], [cx, r.bottom - 1.5], [r.right - 1.5, r.bottom - 1.5]);
      pts.push([r.left - 1.5, cy], [r.right + 1.5, cy], [cx, r.top - 1.5], [cx, r.bottom + 1.5], [r.right + 1.5, r.bottom + 1.5]);
      if (PFScene.k < 1) { pts.push([Math.min(r.left + 1279, (r.right + vw) / 2), r.top + 5], [r.left + 5, Math.min(r.top + 719, r.bottom + 8)], [r.left + 5, r.top + 719]); }
    });
    let n = 0, bad = [], skipped = 0;
    for (const [x, y] of pts) {
      if (x < 0.5 || y < 0.5 || x > vw - 0.5 || y > vh - 0.5) { skipped++; continue; }
      if (hr && x >= hr.left - 2 && x <= hr.right + 2 && y >= hr.top - 2 && y <= hr.bottom + 2) { skipped++; continue; }
      // 경계에서 1px 안쪽은 판정하지 않음: Chrome 클릭 판정은 상자 경계를 정수 픽셀로 감싸 최대 1px 넓게 잡음(a2-probe.js, 일반 상자도 같음)
      const B = 1.0;
      const exp = rs.findIndex((r) => x > r.left && x < r.right && y > r.top && y < r.bottom);
      const amb = rs.some((r) => (Math.abs(x - r.left) <= B || Math.abs(x - r.right) <= B || Math.abs(y - r.top) <= B || Math.abs(y - r.bottom) <= B) && x >= r.left - B && x <= r.right + B && y >= r.top - B && y <= r.bottom + B);
      if (amb) { skipped++; continue; }
      const el = document.elementFromPoint(x, y);
      const got = el ? ss.indexOf(el.closest('.pf-scene')) : -2;
      n++;
      if (got !== exp) bad.push({ x: f3(x), y: f3(y), exp: exp + 1, got: got + 1, el: el ? el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') : null });
    }
    return { n, bad: bad.length, sample: bad.slice(0, 6), skipped };
  }

  // 링크 실제 클릭 준비: 장면으로 이동 → 링크의 첫 줄 상자 가운데(장면 안, 화면 안으로 자름)
  const clicks = [];
  let expectLink = null, prevent = true;
  addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    clicks.push({ target: e.target.tagName.toLowerCase(), inLink: !!(a && a === expectLink), x: e.clientX, y: e.clientY });
    if (prevent) e.preventDefault();
  }, true);
  function links(seed) {
    const ss = scenes(), all = [];
    ss.forEach((s, i) => s.querySelectorAll('a[href]').forEach((a) => { if (a.getClientRects().length) all.push({ si: i, a }); }));
    const rnd = mul(seed), pick = [];
    const ext = all.filter((x) => !x.a.getAttribute('href').startsWith('#'));
    const inpage = all.filter((x) => x.a.getAttribute('href').startsWith('#') && document.getElementById(decodeURIComponent(x.a.getAttribute('href').slice(1))));
    for (let n = 0; n < 3 && ext.length; n++) pick.push(ext.splice(Math.floor(rnd() * ext.length), 1)[0]);
    for (let n = 0; n < 2 && inpage.length; n++) pick.push(inpage.splice(Math.floor(rnd() * inpage.length), 1)[0]);
    window.__a2links = pick;
    return pick.map((x, j) => ({ j, si: x.si, href: x.a.getAttribute('href'), inPage: x.a.getAttribute('href').startsWith('#'), text: x.a.textContent.trim().slice(0, 40) }));
  }
  async function prepLink(j, prev) {
    const { si, a } = window.__a2links[j];
    PFScene.go(si); await settle(); await settle(40);
    const sr = scenes()[si].getBoundingClientRect(); const rr = [...a.getClientRects()].find((r) => r.width > 1 && r.height > 1) || a.getBoundingClientRect();
    const l = Math.max(rr.left, sr.left, 0), r = Math.min(rr.right, sr.right, de.clientWidth), t = Math.max(rr.top, sr.top, 0), b = Math.min(rr.bottom, sr.bottom, innerHeight);
    expectLink = a; prevent = prev; clicks.length = 0;
    const x = (l + r) / 2, y = (t + b) / 2;
    const el = document.elementFromPoint(x, y);
    return { x, y, w: f3(r - l), h: f3(b - t), efpInLink: !!(el && a.contains(el)), visible: r > l && b > t };
  }
  function clickResult() { const c = clicks.slice(); clicks.length = 0; prevent = true; return c; }

  // 끌어서 선택: 문단 첫 글자 왼쪽 → 마지막 글자 오른쪽. 기대 = caretRangeFromPoint 두 점 사이 글자
  async function selPrep(seed) {
    const ss = scenes();
    const cand = [];
    ss.forEach((s, i) => s.querySelectorAll('.pf-body p, .pf-body li').forEach((p) => { const t = p.textContent.trim(); if (t.length >= 40 && !p.querySelector('a, code, img') && p.getClientRects().length) cand.push({ i, p }); }));
    if (!cand.length) return null;
    const rnd = mul(seed), order = cand.map((c) => [rnd(), c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const seg = window.Intl && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'word' }) : null;
    let tried = 0;
    for (const { i, p } of order.slice(0, 8)) {
      tried++;
      PFScene.go(i, { focus: false }); await settle(); await settle(40);
      getSelection().removeAllRanges();
      const rg = document.createRange(); rg.selectNodeContents(p);
      const rects = [...rg.getClientRects()].filter((r) => r.width > 0.5);
      const f = rects[0], l = rects[rects.length - 1];
      const A = [f.left + Math.min(0.6, f.width / 4), (f.top + f.bottom) / 2], B = [l.right - Math.min(0.6, l.width / 4), (l.top + l.bottom) / 2];
      const inP = (pt) => { const e = document.elementFromPoint(pt[0], pt[1]); return !!e && p.contains(e); };
      if (!inP(A) || !inP(B)) continue;                       // 끝점이 HUD 알약 등에 가려진 문단은 건너뜀(장면 배율과 무관한 겹침)
      const ca = document.caretRangeFromPoint(A[0], A[1]), cb = document.caretRangeFromPoint(B[0], B[1]);
      let expected = null;
      if (ca && cb) { const e = document.createRange(); e.setStart(ca.startContainer, ca.startOffset); e.setEnd(cb.startContainer, cb.startOffset); expected = e.toString(); }
      // 두 번 클릭할 단어: Intl.Segmenter 단어 경계로 가운데 단어의 가운데 글자, 줄바꿈에 걸리지 않게 그 글자의 첫 줄 상자
      let W = null, word = null;
      const tn = [...p.childNodes].find((n) => n.nodeType === 3 && n.data.trim().length > 6);
      if (tn && seg) {
        const ws = [...seg.segment(tn.data)].filter((w) => w.isWordLike && w.segment.length >= 2);
        const w = ws[Math.floor(ws.length / 2)];
        if (w) { const m = w.index + Math.floor(w.segment.length / 2); const wr = document.createRange(); wr.setStart(tn, m); wr.setEnd(tn, m + 1); const r = [...wr.getClientRects()][0];
          if (r) { const pt = [r.left + r.width * 0.3, (r.top + r.bottom) / 2]; if (inP(pt)) { W = pt; word = w.segment; } } }   // 글자 한가운데(0.5)는 캐럿이 글자 앞/뒤로 갈리는 경계라 k<1에서 뒤 공백이 잡힐 수 있음(a2-dblclick.js)
      }
      return { scene: i + 1, tried, A, B, W, word, expected, text: p.textContent, fontPx: f3(parseFloat(getComputedStyle(p).fontSize) * PFScene.k) };
    }
    return null;
  }
  function selResult() { const s = getSelection().toString(); getSelection().removeAllRanges(); return s; }

  // (f) 라이트박스: 지금 렌더러(assets/common.js lightbox, portfolio.css 244~247행)와 같은 마크업·CSS를 body 아래에 둠
  async function lbOpen() {
    if (!document.getElementById('a2-lb-css')) {
      const st = document.createElement('style'); st.id = 'a2-lb-css';
      st.textContent = 'dialog.lightbox{border:0;padding:0;background:transparent;max-width:94vw;max-height:94vh;margin:auto}dialog.lightbox::backdrop{background:rgba(10,11,14,.82)}dialog.lightbox img{display:block;max-width:94vw;max-height:86vh;border-radius:10px;margin:0 auto}dialog.lightbox p{color:#fff;text-align:center;font-size:14px;margin-top:10px}';
      document.head.appendChild(st);
      const d = document.createElement('dialog'); d.className = 'lightbox'; d.innerHTML = '<img alt="" /><p></p>'; d.addEventListener('click', () => d.close()); document.body.appendChild(d);
    }
    const src = [...deck.querySelectorAll('img')].find((i) => i.naturalWidth > 0);
    if (!src) return null;
    const d = document.querySelector('dialog.lightbox'), im = d.querySelector('img');
    const y0 = scrollY, h0 = location.hash, c0 = hudCount();
    im.src = src.currentSrc || src.src; d.querySelector('p').textContent = 'A2 lightbox';
    d.showModal();
    for (let t = 0; t < 100 && !(im.complete && im.naturalWidth); t++) await new Promise((r) => setTimeout(r, 20));
    await settle();
    const dr = d.getBoundingClientRect(), ir = im.getBoundingClientRect(), vw = de.clientWidth, vh = innerHeight, iw = innerWidth;
    const nw = im.naturalWidth, nh = im.naturalHeight;
    const s = Math.min(1, (0.94 * iw) / nw, (0.86 * vh) / nh);
    const ew = nw * s, eh = nh * s;
    const el = document.elementFromPoint((ir.left + ir.right) / 2, (ir.top + ir.bottom) / 2);
    const au = PFScene.audit();
    const r = { y0, h0, c0, img: [f3(ir.width), f3(ir.height)], expect: [f3(ew), f3(eh)], dSize: f3(Math.max(Math.abs(ir.width - ew), Math.abs(ir.height - eh))),
      dCenterX: f3(Math.abs((dr.left + dr.right) / 2 - vw / 2)), dCenterY: f3(Math.abs((dr.top + dr.bottom) / 2 - vh / 2)), topImg: el === im,
      auditDialog: au.filter((x) => x.type === 'dialog').length, auditOther: au.filter((x) => x.type !== 'dialog').length };
    return r;
  }
  function lbState() { const d = document.querySelector('dialog.lightbox'); return { open: !!(d && d.open), y: scrollY, hash: location.hash, hud: hudCount(), auditN: PFScene.audit().length }; }
  // 대조: 장면 안에 둔 dialog(01 §9-4 금지 항목)는 배율의 영향을 받는가
  async function inSceneDialog() {
    const s = scenes()[0];
    const d = document.createElement('dialog'); d.style.cssText = 'width:400px;height:200px;padding:0;border:0;margin:auto'; d.textContent = 'in-scene';
    s.appendChild(d); d.showModal(); await settle();
    const r = d.getBoundingClientRect(); d.close(); d.remove();
    return { w: f3(r.width), h: f3(r.height), scaled: Math.abs(r.width - 400) > 1 || Math.abs(r.height - 200) > 1 };
  }

  window.__a2 = { geom, navState, goState, scrollCenter, scrollRandom, setHash, sceneOfId, firstDocHeadingId, hitGrid, links, prepLink, clickResult, selPrep, selResult, lbOpen, lbState, inSceneDialog, settle, count: () => scenes().length, hudCount };
  return 'ok';
}
const HELPER = `(${helper.toString()})()`;

// ════════════════════ Node 쪽 ════════════════════
const KEYS = {
  PageDown: { key: 'PageDown', code: 'PageDown', vk: 34, d: 1 }, PageUp: { key: 'PageUp', code: 'PageUp', vk: 33, d: -1 },
  Space: { key: ' ', code: 'Space', vk: 32, d: 1, text: ' ' }, ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39, d: 1 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37, d: -1 }, End: { key: 'End', code: 'End', vk: 35, abs: 'end' }, Home: { key: 'Home', code: 'Home', vk: 36, abs: 0 },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
};
async function key(page, name) {
  const k = KEYS[name];
  await page.send('Input.dispatchKeyEvent', { type: k.text ? 'keyDown' : 'rawKeyDown', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk, text: k.text, unmodifiedText: k.text });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk });
}
async function click(page, x, y, count = 1) {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  for (let c = 1; c <= count; c++) {
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: c });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: c });
  }
}
async function drag(page, [x0, y0], [x1, y1]) {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1 });
  for (let s = 1; s <= 8; s++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * s / 8, y: y0 + (y1 - y0) * s / 8, button: 'left', buttons: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', buttons: 0, clickCount: 1 });
}
async function load(page, url, { timeout = 60000 } = {}) {
  const t0 = Date.now();
  const blank = page.once('Page.loadEventFired', 20000);
  await page.send('Page.navigate', { url: 'about:blank' }); await blank;
  const loaded = page.once('Page.loadEventFired', 120000);
  await page.send('Page.navigate', { url });
  await loaded;
  let ready = '';
  while (Date.now() - t0 < timeout) { ready = await page.evaluate('document.documentElement.dataset.pfReady || ""').catch(() => ''); if (ready === 'yes') break; await sleep(80); }
  return { ready, ms: Date.now() - t0 };
}
const ev = (page, expr) => page.evaluate(expr, { timeout: 90000 });
const call = (page, fn, ...args) => ev(page, `window.__a2.${fn}(${args.map((a) => JSON.stringify(a)).join(',')})`);

async function setVp(page, vp, dpr) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: dpr, mobile: !!vp.mobile });
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
}

async function runOne(page, base, pg, vp, dpr, browser, pdfDir) {
  const rep = { page: pg.id, vp: vp.id, w: vp.w, h: vp.h, mobile: !!vp.mobile, dpr, browser, expectK: +vp.k.toFixed(4), checks: {}, fails: [] };
  const fail = (c, d) => rep.fails.push(`[${c}] ${d}`);
  const rnd = mulberry(seedOf(`${pg.id}|${vp.id}|${dpr}`));
  await setVp(page, vp, dpr);
  page.logs.length = 0;
  const L = await load(page, base + pg.url);
  rep.ready = L.ready; rep.loadMs = L.ms;
  if (L.ready !== 'yes') { fail('ready', `data-pf-ready=${L.ready}`); return rep; }
  await ev(page, HELPER);
  await call(page, 'settle', 80);
  // (a)(b)(c)
  const g = await call(page, 'geom');
  rep.geom = g; rep.k = g.k; rep.N = g.N;
  if (Math.abs(g.k - vp.k) > 0.002) fail('k', `k=${g.k} ≠ 기대 ${vp.k.toFixed(4)}`);
  g.issues.forEach((x) => fail('geom', x));
  if (g.auditN) fail('audit', `화면 audit ${g.auditN}건: ${JSON.stringify(g.audit.slice(0, 3))}`);
  const sig = await ev(page, SIGNATURE);
  rep.signature = sig.signature;
  if (pg.sig && sig.signature !== pg.sig) fail('signature', `장면 나눔 서명 ${sig.signature} ≠ A1 ${pg.sig}`);
  const N = g.N;
  // (d) 이동
  const nav = [];
  const navCode = (st) => (!st.posOk ? 'nav-pos' : !st.hashOk ? 'nav-hash' : st.mostVisible ? 'io-hud' : 'nav-hud');   // io-hud: 직접 스크롤인데 HUD가 가장 많이 보이는 장면이 아님
  const pushNav = (how, st) => { nav.push({ how, ...st }); if (!st.ok) fail(navCode(st), `${how} → 장면 ${st.i + 1}: dScroll ${st.dScroll}, top ${st.top}, bottom ${st.bottom}, inView ${st.inView}, HUD "${st.hud}"(기대 "${st.hudWant}"), hash ${st.hash}`); };
  const picks = [0, N - 1, ...Array.from({ length: 6 }, () => Math.floor(rnd() * N))];
  for (const i of picks) pushNav('go()', await call(page, 'goState', i));
  for (let n = 0; n < 5; n++) { const i = Math.floor(rnd() * N); pushNav('직접 스크롤(IO)', await call(page, 'scrollCenter', i)); }
  const ior = [];
  for (let n = 0; n < 6; n++) ior.push(await call(page, 'scrollRandom', rnd()));
  rep.checks.ioRandom = { n: ior.length, ok: ior.filter((x) => x.ok).length, bad: ior.filter((x) => !x.ok).slice(0, 4) };
  if (ior.some((x) => !x.ok)) fail('io-random', `임의 스크롤 ${ior.filter((x) => !x.ok).length}/${ior.length}곳에서 HUD ≠ 가장 많이 보이는 장면: ${JSON.stringify(ior.filter((x) => !x.ok).slice(0, 2))}`);
  // 키보드: go(0) 뒤 실제 키 이벤트
  await call(page, 'goState', 0);
  let exp = 0;
  for (const kn of ['PageDown', 'PageDown', 'Space', 'ArrowRight', 'PageUp', 'ArrowLeft', 'End', 'PageUp', 'Home', 'PageDown']) {
    const k = KEYS[kn];
    exp = k.abs === 'end' ? N - 1 : k.abs === 0 ? 0 : Math.max(0, Math.min(N - 1, exp + k.d));
    await key(page, kn);
    await call(page, 'settle', 60);
    pushNav(`키 ${kn}`, await call(page, 'navState', exp, `#s-${exp + 1}`));
  }
  // HUD 버튼 실제 클릭
  await call(page, 'goState', 0); exp = 0;
  for (const a of ['next', 'next', 'prev', 'next']) {
    const p = await ev(page, `(() => { const b = document.querySelector('.pf-hud [data-a="${a}"]'); const r = b.getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; })()`);
    await click(page, p.x, p.y);
    await call(page, 'settle', 60);
    exp = Math.max(0, Math.min(N - 1, exp + (a === 'next' ? 1 : -1)));
    pushNav(`HUD ${a}`, await call(page, 'navState', exp, `#s-${exp + 1}`));
  }
  // 해시 바꾸기(hashchange)
  for (let n = 0; n < 2; n++) { const i = Math.floor(rnd() * N); pushNav('hashchange #s-N', await call(page, 'setHash', `#s-${i + 1}`, i)); }
  const hid = await call(page, 'firstDocHeadingId');
  if (hid) { const i = await call(page, 'sceneOfId', hid); pushNav(`hashchange #${hid.slice(0, 20)}`, await call(page, 'setHash', `#${hid}`, i)); }
  rep.checks.nav = { n: nav.length, ok: nav.filter((x) => x.ok).length, posOk: nav.filter((x) => x.posOk).length, hudOk: nav.filter((x) => x.hudOk).length, maxDScroll: Math.max(...nav.map((x) => x.dScroll)) };
  rep.nav = nav.filter((x) => !x.ok).slice(0, 10);
  // (e) 클릭 판정: 장면 몇 곳으로 이동해 화면 격자 검사
  const hits = { n: 0, bad: 0, sample: [], positions: 0 };
  for (const i of [0, N - 1, Math.floor(N / 2), ...Array.from({ length: 3 }, () => Math.floor(rnd() * N))]) {
    await call(page, 'goState', i);
    const h = await call(page, 'hitGrid', Math.floor(rnd() * 1e9));
    hits.n += h.n; hits.bad += h.bad; hits.positions++; if (h.sample.length && hits.sample.length < 6) hits.sample.push({ scene: i + 1, ...h.sample[0] });
  }
  rep.checks.hit = hits;
  if (hits.bad) fail('hit', `격자 점 ${hits.bad}/${hits.n} 불일치 ${JSON.stringify(hits.sample.slice(0, 3))}`);
  // 링크 실제 클릭(밖 링크는 preventDefault로 기록만, 페이지 안 링크 하나는 실제 이동)
  const ls = await call(page, 'links', Math.floor(rnd() * 1e9));
  const lc = [];
  for (const l of ls) {
    const real = l.inPage && !lc.some((x) => x.real);
    const pr = await call(page, 'prepLink', l.j, !real);
    if (!pr.visible) { lc.push({ ...l, skipped: 'not visible' }); continue; }
    await click(page, pr.x, pr.y);
    await call(page, 'settle', 80);
    const cr = await call(page, 'clickResult');
    const r = { ...l, real, w: pr.w, h: pr.h, efpInLink: pr.efpInLink, clickInLink: cr.length === 1 && cr[0].inLink, clicks: cr.length };
    if (real) { const id = decodeURIComponent(l.href.slice(1)); const i = await call(page, 'sceneOfId', id); r.after = await call(page, 'navState', i, l.href); r.ok = r.clickInLink && r.after.posOk && r.after.hashOk; r.afterHudOk = r.after.hudOk; if (!r.after.hudOk) fail('nav-hud', `링크 ${l.href} 이동 뒤 HUD "${r.after.hud}"(기대 "${r.after.hudWant}")`); }
    else r.ok = r.clickInLink && r.efpInLink;
    lc.push(r);
    if (!r.ok) fail('link', `${l.href} (장면 ${l.si + 1}, ${pr.w}×${pr.h}px): efp ${pr.efpInLink}, click ${JSON.stringify(cr)}${r.after ? ' after ' + JSON.stringify(r.after) : ''}`);
  }
  rep.checks.links = { n: lc.filter((x) => !x.skipped).length, ok: lc.filter((x) => x.ok).length, real: lc.filter((x) => x.real).length };
  rep.links = lc;
  // 텍스트 선택
  const sp = await call(page, 'selPrep', Math.floor(rnd() * 1e9));
  if (sp) {
    await drag(page, sp.A, sp.B);
    const got = await call(page, 'selResult');
    const norm = (s) => String(s || '').replace(/\s+/g, '');
    const sel = { scene: sp.scene, tried: sp.tried, fontPx: sp.fontPx, len: got.length, textLen: sp.text.length, expectedLen: sp.expected ? sp.expected.length : null,
      same: norm(got) === norm(sp.expected), dLen: Math.abs(norm(got).length - norm(sp.expected).length), cover: +(norm(got).length / Math.max(1, norm(sp.text).length)).toFixed(3) };
    if (sp.W) { await click(page, sp.W[0], sp.W[1], 2); const w = await call(page, 'selResult'); const wt = w.trim(); sel.word = w; sel.wordWant = sp.word; sel.wordOk = !!wt && !/\s/.test(wt) && sp.text.includes(wt) && (wt.includes(sp.word) || sp.word.includes(wt)); }
    sel.ok = (sel.same || sel.dLen <= 2) && sel.cover >= 0.9 && (sel.wordOk !== false);   // 글자 4~5px(k 0.29)에서는 끝점 캐럿이 1~2자 어긋날 수 있음
    rep.checks.select = sel;
    if (!sel.ok) fail('select', JSON.stringify(sel).slice(0, 300));
  } else rep.checks.select = { skipped: true };
  // (f) 라이트박스
  await call(page, 'goState', Math.min(1, N - 1));
  const lb = await call(page, 'lbOpen');
  if (lb) {
    await key(page, 'PageDown'); await call(page, 'settle', 60);
    const afterKey = await call(page, 'lbState');
    await key(page, 'Escape'); await call(page, 'settle', 60);
    const closed = await call(page, 'lbState');
    const isd = await call(page, 'inSceneDialog');
    lb.kitIgnoredKey = afterKey.hash === lb.h0; lb.keyScrollDelta = +(afterKey.y - lb.y0).toFixed(2);   // 키트는 가로채지 않음(hash 그대로). 배경 스크롤은 브라우저 기본 동작
    lb.closed = !closed.open; lb.scrollRestored = Math.abs(closed.y - lb.y0) <= 1 || Math.abs(closed.y - afterKey.y) <= 1; lb.auditAfterClose = closed.auditN;
    lb.inScene = isd;
    lb.ok = lb.dSize <= 1 && lb.dCenterX <= 1 && lb.dCenterY <= 1 && lb.topImg && lb.kitIgnoredKey && lb.closed && lb.auditAfterClose === 0 && lb.auditOther === 0;
    rep.checks.lightbox = lb;
    if (!lb.ok) fail('lightbox', JSON.stringify(lb).slice(0, 400));
  } else rep.checks.lightbox = { skipped: 'no image' };
  // (g) 그 뷰포트 그대로(가운데쯤 장면으로 스크롤한 상태) printToPDF
  if (!NO_PDF) {
    await call(page, 'goState', Math.floor(N / 2));
    await ev(page, MARK);
    const file = path.join(pdfDir, `${browser}__${pg.id}__${vp.id}__dpr${dpr}.pdf`);
    const t = Date.now();
    const r = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: false, transferMode: 'ReturnAsBase64' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    rep.pdf = { file, ms: Date.now() - t };
    // 인쇄 뒤 화면이 그대로인지(beforeprint/afterprint·resize 부작용)
    const g2 = await call(page, 'geom');
    rep.checks.afterPrint = { issues: g2.issues.length, auditN: g2.auditN, sameRects: JSON.stringify(g2.rects) === JSON.stringify(g.rects) };
    if (g2.issues.length || !rep.checks.afterPrint.sameRects) fail('afterPrint', `인쇄 뒤 화면 배치 변화: ${g2.issues.slice(0, 2).join(' / ')} sameRects=${rep.checks.afterPrint.sameRects}`);
  }
  // 딥 링크(새로 열기): #s-<가운데>, DPR 1이면 문서 제목 id도
  const mid = Math.floor(N * 0.6);
  const dl = [];
  const L2 = await load(page, `${base}${pg.url}${pg.url.includes('?') ? '&' : '?'}a2dl=1#s-${mid + 1}`);
  if (L2.ready === 'yes') { await ev(page, HELPER); await call(page, 'settle', 150); dl.push({ how: `deep #s-${mid + 1}`, ...(await call(page, 'navState', mid, `#s-${mid + 1}`)) }); }
  if (hid && dpr === 1) {
    const L3 = await load(page, `${base}${pg.url}${pg.url.includes('?') ? '&' : '?'}a2dl=2#${encodeURIComponent(hid)}`);
    if (L3.ready === 'yes') { await ev(page, HELPER); await call(page, 'settle', 150); const i = await call(page, 'sceneOfId', hid); dl.push({ how: `deep #${hid.slice(0, 20)}`, ...(await call(page, 'navState', i, null)) }); }
  }
  dl.forEach((x) => { if (!x.ok) fail(x.posOk && x.hashOk ? 'deeplink-hud' : 'deeplink-pos', `${x.how} → 장면 ${x.i + 1}: dScroll ${x.dScroll}, top ${x.top}, inView ${x.inView}, HUD "${x.hud}"(기대 "${x.hudWant}")`); });
  rep.checks.deeplink = { n: dl.length, ok: dl.filter((x) => x.ok).length };
  rep.deeplink = dl;
  rep.logs = page.logs.filter((l) => l.type === 'exception' || l.type === 'error').slice(0, 5);
  if (rep.logs.length) fail('console', JSON.stringify(rep.logs).slice(0, 300));
  return rep;
}

// 같은 페이지에서 창 크기만 바꿈(resize → fit → realign): 현재 장면이 화면 가운데에 남는지, 배치가 새 k를 따르는지
async function runResize(page, base, pg, browser) {
  const seq = VPS.filter((v) => !v.mobile);
  const out = { page: pg.id, browser, steps: [], fails: [] };
  await setVp(page, VPS.find((v) => v.id === 'k1.268'), 1);
  const L = await load(page, base + pg.url);
  if (L.ready !== 'yes') { out.fails.push('ready'); return out; }
  await ev(page, HELPER);
  const N = await call(page, 'count');
  const cur = Math.floor(N * 0.4);
  await call(page, 'goState', cur);
  for (const v of [...seq.slice().reverse(), ...seq]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: false });
    await call(page, 'settle', 120);
    const g = await call(page, 'geom');
    const st = await call(page, 'navState', cur, null);
    const ok = !g.issues.length && !g.auditN && Math.abs(g.k - v.k) < 0.002 && st.ok;
    out.steps.push({ vp: v.id, k: g.k, issues: g.issues.length, auditN: g.auditN, dScroll: st.dScroll, top: st.top, bottom: st.bottom, inView: st.inView, hud: st.hud, hudOk: st.hudOk, ok });
    if (!ok) out.fails.push(`${v.id}: geom ${g.issues.slice(0, 2).join(' / ')} audit ${g.auditN} nav dScroll ${st.dScroll} inView ${st.inView} HUD ${st.hud}/${st.hudWant}`);
  }
  return out;
}

function py(script, files, extra = []) {
  const res = [];
  for (let i = 0; i < files.length; i += 24) {
    const chunk = files.slice(i, i + 24);
    try { res.push(...execFileSync('python', ['-I', path.join(__dirname, script), ...extra, ...chunk], { encoding: 'utf8', maxBuffer: 256 << 20 }).trim().split(/\r?\n/).map((l) => JSON.parse(l))); }
    catch (e) { chunk.forEach((f) => res.push({ file: f, error: String(e.message).slice(0, 300) })); }
  }
  return res;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pdfDir = path.join(OUT, 'pdf', TAG); fs.mkdirSync(pdfDir, { recursive: true });
  const projects = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/portfolio.json'), 'utf8')).projects;
  let pages = [{ id: 'index', url: `${PAGES_DIR}/index.html` }, ...projects.map((id) => ({ id, url: `${PAGES_DIR}/project.html?p=${encodeURIComponent(id)}` }))];
  if (arg('only')) pages = pages.filter((p) => arg('only').split(',').includes(p.id));
  // A1 장면 나눔 서명(배율이 분할을 바꾸지 않는지 비교 기준)
  try { const a1 = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../out/a1-baseline.json'), 'utf8')); pages.forEach((p) => { const r = a1.pages.find((x) => x.page === p.id && x.browser === 'chrome'); if (r) p.sig = r.split.signature; }); } catch { /* 기준 없음 */ }
  const server = await serve(ROOT, PORT);
  const R = { tag: TAG, pagesDir: PAGES_DIR, date: new Date().toISOString(), port: PORT, browsers: {}, vps: VPS, dprs: DPRS, runs: [], resize: [] };
  const t0 = Date.now();
  try {
    for (const b of browsers) {
      const c = await launch(b);
      R.browsers[b] = c.version;
      try {
        const page = await c.newPage();
        for (const pg of pages) {
          for (const vp of vps) {
            for (const dpr of (vp.mobile ? [...DPRS, ...(DPRS.includes(1) ? [3] : [])] : DPRS)) {
              const t = Date.now();
              let rep;
              try { rep = await runOne(page, server.base, pg, vp, dpr, b, pdfDir); }
              catch (e) { rep = { page: pg.id, vp: vp.id, dpr, browser: b, fails: [`[exception] ${String(e && e.stack || e).slice(0, 400)}`], checks: {} }; }
              rep.wallMs = Date.now() - t;
              R.runs.push(rep);
              console.log(`${rep.fails.length ? 'FAIL' : 'PASS'} ${b} ${pg.id.padEnd(20)} ${vp.id.padEnd(7)} dpr${dpr} k=${rep.k?.toFixed?.(4)} N=${rep.N} nav ${rep.checks.nav?.ok}/${rep.checks.nav?.n} hit ${rep.checks.hit ? rep.checks.hit.n - rep.checks.hit.bad : '?'}/${rep.checks.hit?.n} ${Math.round(rep.wallMs / 100) / 10}s`);
              rep.fails.slice(0, 4).forEach((f) => console.log('   ✗ ' + f.slice(0, 260)));
            }
          }
          if (!NO_RESIZE && DPRS.includes(1)) {
            const rz = await runResize(page, server.base, pg, b);
            R.resize.push(rz);
            console.log(`${rz.fails.length ? 'FAIL' : 'PASS'} ${b} ${pg.id} 창 크기 변경 ${rz.steps.filter((s) => s.ok).length}/${rz.steps.length}`);
            rz.fails.slice(0, 3).forEach((f) => console.log('   ✗ ' + f));
          }
        }
        await page.close();
      } finally { await c.close(); }
    }
  } finally { await server.close(); }
  // PDF 깊은 검사 + 배치 서명
  const files = R.runs.filter((r) => r.pdf).map((r) => r.pdf.file);
  if (files.length) {
    const deep = py('pdf-deep.py', files, ['960', '540', '--markers', '--no-footer']);
    const sig = py('a2-pdf-sig.py', files);
    const byF = (arr) => Object.fromEntries(arr.map((x) => [path.resolve(x.file), x]));
    const D = byF(deep), S = byF(sig);
    for (const r of R.runs) {
      if (!r.pdf) continue;
      const d = D[path.resolve(r.pdf.file)] || {}, s = S[path.resolve(r.pdf.file)] || {};
      r.pdf = { ...r.pdf, file: path.relative(OUT, r.pdf.file), pages: d.pages, sizes: d.sizes, blank: d.blank, noContent: d.noContent, outside: d.outside, headerFooter: d.headerFooter, markerIssues: d.markerIssues, deepIssues: d.issues, sig: s.sig, per: s.per };
      if (d.error || s.error) r.fails.push(`[pdf] 검사 오류 ${d.error || s.error}`);
      if (d.pages !== r.N) r.fails.push(`[pdf] ${d.pages}쪽 ≠ 장면 ${r.N}`);
      (d.issues || []).forEach((x) => r.fails.push(`[pdf] ${x}`));
    }
    // 같은 페이지·브라우저 안에서 PDF 배치 서명 비교(기준: k1.268 dpr1) → 인쇄가 화면 배율·DPR과 무관한지
    for (const r of R.runs) {
      if (!r.pdf || !r.pdf.sig) continue;
      const ref = R.runs.find((x) => x.page === r.page && x.browser === r.browser && x.vp === 'k1.268' && x.dpr === 1 && x.pdf?.sig) || R.runs.find((x) => x.page === r.page && x.browser === r.browser && x.pdf?.sig);
      r.pdf.ref = `${ref.vp}@${ref.dpr}`;
      r.pdf.sameAsRef = r.pdf.sig === ref.pdf.sig;
      if (!r.pdf.sameAsRef) { const diff = r.pdf.per.map((h, i) => (h !== ref.pdf.per[i] ? i + 1 : 0)).filter(Boolean); r.pdf.diffPages = diff.slice(0, 20); r.fails.push(`[pdf-sig] 인쇄 배치가 ${r.pdf.ref}와 다름: 쪽 ${diff.slice(0, 10).join(',')}${diff.length > 10 ? ' …' : ''} (${diff.length}쪽)`); }
    }
  }
  // (h) DPR 표류: 같은 브라우저·페이지·뷰포트의 DPR 1 대비 장면 상자 최대 차이(CSS px)
  for (const r of R.runs) {
    if (!r.geom) continue;
    const ref = R.runs.find((x) => x.page === r.page && x.browser === r.browser && x.vp === r.vp && x.dpr === 1 && x.geom);
    if (!ref || ref === r) continue;
    let mx = 0;
    if (ref.geom.rects.length !== r.geom.rects.length) mx = Infinity;
    else r.geom.rects.forEach((q, i) => q.forEach((v, j) => { mx = Math.max(mx, Math.abs(v - ref.geom.rects[i][j])); }));
    r.dprDrift = mx;
    if (mx > 1) r.fails.push(`[dpr-drift] DPR 1 대비 장면 상자 최대 ${mx}px 차이`);
    if (r.signature !== ref.signature) r.fails.push(`[dpr-split] 장면 나눔 서명이 DPR 1과 다름 ${r.signature} ≠ ${ref.signature}`);
  }
  R.totalMs = Date.now() - t0;
  R.serverStats = { requests: server.stats.requests, notFound: [...new Set(server.stats.notFound)].slice(0, 20) };
  for (const r of R.runs) { if (r.geom) r.geom.rects = r.geom.rects.length; if (r.pdf) delete r.pdf.per; }
  fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, `${TAG}.md`), toMd(R));
  const nf = R.runs.filter((r) => r.fails.length).length + R.resize.filter((r) => r.fails.length).length;
  console.log(`\n${path.join(OUT, TAG + '.md')}  실행 ${R.runs.length}개 중 실패 ${R.runs.filter((r) => r.fails.length).length}, 창 크기 변경 실패 ${R.resize.filter((r) => r.fails.length).length} (${Math.round(R.totalMs / 1000)}초)`);
  process.exit(nf ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

function toMd(R) {
  const L = [`# A2 매트릭스 — ${R.tag}`, '', `- 실행 ${R.date}, 페이지 폴더 \`${R.pagesDir}\`, 127.0.0.1:${R.port}, 걸린 시간 ${Math.round(R.totalMs / 1000)}초`];
  Object.entries(R.browsers).forEach(([b, v]) => L.push(`- ${b}: ${v}`));
  L.push('', '| 브라우저 | 페이지 | 뷰포트 | DPR | k | 장면 | (a) 크기·간격·가운데 최대 오차 px | (b) 넘침 | (c) audit·서명 | (d) 이동 | (e) 격자·링크·선택 | (f) 라이트박스 | (g) PDF 쪽·빈 쪽·같음 | (h) DPR 표류 px | 판정 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of R.runs) {
    const g = r.geom || {}, c = r.checks || {};
    const a = g.N ? Math.max(g.maxDW, g.maxDH, g.maxDC, g.maxDGap, g.maxDSlotW, g.maxDSlotH).toFixed(3) : '?';
    const b = g.N ? (g.scrollW <= g.clientW && !g.maxScrollX && g.scrollH <= Math.ceil(g.docBottom) + 1 ? `0 (${g.scrollW}/${g.clientW})` : `넘침 ${g.scrollW}/${g.clientW} H ${g.scrollH}/${g.docBottom}`) : '?';
    const cc = `${g.auditN ?? '?'} · ${r.fails.some((f) => f.startsWith('[signature]')) ? '다름' : '같음'}`;
    const d = c.nav ? `${c.nav.ok}/${c.nav.n} · 딥 ${c.deeplink?.ok}/${c.deeplink?.n}` : '?';
    const e = c.hit ? `${c.hit.n - c.hit.bad}/${c.hit.n} · ${c.links?.ok}/${c.links?.n} · ${c.select?.skipped ? '—' : c.select?.ok ? 'OK' : 'X'}` : '?';
    const f = c.lightbox ? (c.lightbox.skipped ? '—' : c.lightbox.ok ? 'OK' : 'X') : '?';
    const p = r.pdf ? `${r.pdf.pages}/${r.N} · ${r.pdf.blank} · ${r.pdf.sameAsRef ? '같음' : '다름'}` : '—';
    L.push(`| ${r.browser} | ${r.page} | ${r.vp} ${r.w}×${r.h}${r.mobile ? 'm' : ''} | ${r.dpr} | ${r.k?.toFixed?.(4) ?? '?'} | ${r.N ?? '?'} | ${a} | ${b} | ${cc} | ${d} | ${e} | ${f} | ${p} | ${r.dprDrift ?? '—'} | ${r.fails.length ? 'FAIL ' + r.fails.length : 'PASS'} |`);
  }
  L.push('', '## 창 크기 변경(같은 페이지에서 resize)', '', '| 브라우저 | 페이지 | 단계 통과 | 실패 |', '|---|---|---|---|');
  R.resize.forEach((z) => L.push(`| ${z.browser} | ${z.page} | ${z.steps.filter((s) => s.ok).length}/${z.steps.length} | ${z.fails.slice(0, 3).join('<br>').replace(/\|/g, '/') || '—'} |`));
  L.push('', '## 실패 목록');
  for (const r of R.runs) { if (!r.fails.length) continue; L.push('', `### ${r.browser} · ${r.page} · ${r.vp} · DPR ${r.dpr}`); r.fails.slice(0, 15).forEach((f) => L.push(`- ${f.replace(/\|/g, '/').slice(0, 400)}`)); if (r.fails.length > 15) L.push(`- … 외 ${r.fails.length - 15}건`); }
  return L.join('\n') + '\n';
}
