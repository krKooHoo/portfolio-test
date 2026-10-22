#!/usr/bin/env node
// A3 — 인쇄 레시피(01 §8-1 = kit/scene-kit.css) 함정 재시험
//   01 §8-5 함정 21종 + 원 레시피 시험(exp-recipe.js R00~R13) 이식 + 새 함정 2종(기본 숨김 + forwards 등장, CSS background-image)
//   + §8-1에서 바뀐 줄 시험(.pf-skip 선택자, [data-pf-reveal], animation-duration:0s, var(--bg), .pf-clipped, .pf-n-print, timeout 게이트, zoom-fit, transform 되돌리기)
//   최악의 순서: 키트 CSS(<link>)가 먼저, 함정 CSS(<style>)·마크업이 뒤에.
//   매트릭스: Chrome × Edge × printBackground {true,false} × preferCSSPageSize {true,false}
// 실행(PowerShell, 레포 루트): node spikes/r0/a3/traps.js [--kit /spikes/r0/kit/scene-kit.css] [--tag traps] [--only <정규식>] [--browser chrome|edge|both] [--port <n>(기본 4623)]
// 【R0 결정 #14】 화면 매체 감사 outside-deck(PFScene.audit())도 판정에 씀: outsideExpect 함정은 모든 브라우저에서 잡혀야 하고(인쇄 통과면 "계약 위반 감지"),
//   나머지 함정은 0이어야 함(아니면 "FAIL(화면 감사 오탐)")
// 결과: spikes/r0/out/a3/<tag>.json, <tag>.md, PDF는 out/a3/<tag>/, 생성한 함정 페이지는 out/a3/pages/
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const { launch, sleep } = require('../harness/lib/cdp');
const { serve } = require('../harness/lib/server');
const { AUDIT_DOC } = require('../harness/scene-print-check');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out/a3');
const PAGES = path.join(OUT, 'pages');
const PAGES_URL = '/spikes/r0/out/a3/pages/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const PORT = +arg('port', 4623);
const KIT_CSS = arg('kit', '/spikes/r0/kit/scene-kit.css');
const TAG = arg('tag', 'traps');
const ONLY = arg('only') ? new RegExp(arg('only')) : null;
const BROWSERS = arg('browser', 'both') === 'both' ? ['chrome', 'edge'] : [arg('browser')];
const VP = { w: 1536, h: 864, dpr: 1.25 };                      // 화면 배율 k≈1.156(transform이 실제로 걸린 상태에서 인쇄)
const GUIDE = '아직 페이지를 그리는 중입니다';
const HUD_TEXT = ['본문으로 건너뛰기', 'PDF로 저장PDF', '그래도 인쇄', '요약만'];   // HUD 버튼 글자(인쇄 버튼은 'PDF로 저장' + 'PDF n쪽'). 안내 문구 속 '[PDF로 저장]'과 구별

// ── 단색 PNG(Pillow 없이) ──
function png(w, h, [r, g, b]) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const IMG_COLORS = [[240, 120, 0], [0, 150, 200], [200, 0, 120], [90, 160, 0], [120, 60, 200], [200, 170, 0]];
const PURPLE = [136, 0, 136];
const svgData = (hex) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="15"><rect width="30" height="15" fill="${hex}"/></svg>`)}`;

// ── 시험 골격(키트 CSS 뒤, 함정 CSS 앞): 장면 위·아래 글자 표식 ──
const BASE = `:root { --bg: #DFE9FF; }
body { font-family: Arial, sans-serif; color: #111; }
.lbl { position: absolute; font: 700 28px/1.2 Arial, sans-serif; color: #111; margin: 0; }
.tl { left: 12px; top: 8px; } .br { right: 12px; bottom: 8px; }
.box { position: absolute; left: 380px; top: 300px; width: 300px; height: 150px; font: 700 24px Arial; color: #fff;
       display: flex; align-items: center; justify-content: center; }
.pf-foot { position: absolute; left: 64px; right: 64px; bottom: 0; height: 40px; display: flex; align-items: center; justify-content: space-between; font: 600 13px Arial; color: #333; }
.xr { position: absolute; left: 40px; width: 1100px; font: 16px Arial; color: #123; overflow-wrap: anywhere; }
@keyframes rvIn { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: none; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`;
const COUNTERS = `window.__pf = { bp: 0, ap: 0 }; addEventListener('beforeprint', () => { __pf.bp++; }); addEventListener('afterprint', () => { __pf.ap++; });`;
const sc = (lab, inner = '', { cls = '', attrs = '', first = '' } = {}) =>
  `<section class="pf-scene${cls ? ' ' + cls : ''}"${attrs}>${first}<div class="lbl tl">${lab}-TOP</div>${inner}<div class="lbl br">${lab}-BOT</div></section>`;

const LIGHT = [223, 233, 255], DARK = [20, 22, 28];
const T = [];
const add = (t) => T.push({ n: 3, kind: 'recipe', bg: LIGHT, ...t });

// ── 기준 ──
add({ id: 'B00', grp: '기준', name: '레시피만(함정 없음)' });
// ── 01 §8-5 #1~#21 ──
add({ id: 'T01', grp: '#1', name: '뒤에 margin 없는 @page(크기만)', css: '@page{size:1280px 720px}' });
add({ id: 'T02a', grp: '#2/R07', name: '뒤에 @media print{@page{margin:14mm}}', css: '@media print{@page{margin:14mm}}' });
add({ id: 'T02b', grp: '#2', name: '뒤에 @page:first{margin:20mm}', css: '@page:first{margin:20mm}' });
add({ id: 'T03a', grp: '#3', name: '뒤에 @page{size:13.333in 7.5in}', css: '@page{size:13.333in 7.5in}' });
add({ id: 'T03b', grp: '#3', name: '뒤에 @page{size:338.67mm 190.5mm}', css: '@page{size:338.67mm 190.5mm}' });
add({ id: 'T04a', grp: '#4', name: '장면 height 720.016px', css: '.pf-scene{height:720.016px}' });
add({ id: 'T04b', grp: '#4', name: '장면 min-height 740px', css: '.pf-scene{min-height:740px}' });
add({ id: 'T05a', grp: '#5/R01', name: 'body margin 8px', css: 'body{margin:8px}' });
add({ id: 'T05b', grp: '#5', name: 'body 테두리 1px + html padding 10px', css: 'body{border:1px solid #333}html{padding:10px}' });
add({ id: 'T05c', grp: '#5/R12', name: '장면 테두리 3px(border-box)', css: '.pf-scene{border:3px solid #333}', inset: 8 });   // 모서리 색은 테두리 안쪽에서 잼
add({ id: 'T06a', grp: '#6/R08', name: '장면 margin-top 24px', css: '.pf-scene{margin-top:24px}' });
add({ id: 'T06b', grp: '#6', name: '장면 margin 24px auto', css: '.pf-scene{margin:24px auto}' });
const H1 = (k) => `<h1 style="margin:60px 0 0;font:700 40px Arial">S${k}-H1</h1>`;
add({ id: 'T07a', grp: '#7/R02', name: '첫 자식 margin collapse(h1 60px)', first: H1 });
add({ id: 'T07b', grp: '#7', name: '뒤에 장면 overflow:clip + 첫 자식 margin', css: '.pf-scene{overflow:clip}', first: H1 });
add({ id: 'T07c', grp: '#7', name: '뒤에 장면 overflow:visible + 첫 자식 margin', css: '.pf-scene{overflow:visible}', first: H1 });
add({ id: 'T08a', grp: '#8/R03', name: '장면보다 넓은 자식 1600px', css: '.wide{width:1600px;height:40px;background:#f99;margin-top:300px}', inner: () => '<div class="wide">wide</div>' });
add({ id: 'T08b', grp: '#8', name: '넓은 absolute 자식 + 뒤에 overflow:visible', css: '.pf-scene{overflow:visible}.wide{position:absolute;left:0;top:300px;width:1600px;height:40px;background:#f99}', inner: () => '<div class="wide">wide</div>' });
add({ id: 'T09a', grp: '#9/R04', name: '덱 끝 높이 0 토스트·visibility:hidden 0px', deckTail: '<div class="toast" style="height:0"></div><div style="visibility:hidden;height:0"></div>' });
add({ id: 'T09b', grp: '#9', name: '덱 뒤 빈 div + script', after: '<div></div><script>1</script>' });
add({ id: 'T09c', grp: '#9', name: '덱 뒤 footer(글자 있음)', after: '<footer style="font:14px Arial">FOOTER-AFTER</footer>', forbidden: ['FOOTER-AFTER'], outsideExpect: true });
add({ id: 'T09d', grp: '#9', name: '덱 뒤 visibility:hidden 10px 요소', after: '<div style="visibility:hidden;height:10px">x</div>' });
add({ id: 'T09e', grp: '#9(추가)', name: '뒤에 모든 장면 break-after:page', css: '.pf-scene{break-after:page}' });
add({ id: 'T09f', grp: '#9(추가)', name: '뒤에 모든 장면 break-before:page(첫 장면 포함)', css: '.pf-scene{break-before:page}' });
add({ id: 'T09g', grp: '#9(추가)', name: '덱 clearfix ::after', css: '.pf-deck::after{content:"";display:table;clear:both}' });
add({ id: 'T10a', grp: '#10', name: 'html,body{height:100%;overflow:hidden}', css: 'html,body{height:100%;overflow:hidden}' });
add({ id: 'T10b', grp: '#10/R09', name: '덱 스냅 컨테이너(100vh + overflow:auto)', css: '.pf-deck{height:100vh;overflow-y:auto;scroll-snap-type:y mandatory}.pf-scene{scroll-snap-align:start}' });
add({ id: 'T10c', grp: '#10', name: 'body 스크롤 컨테이너(height:100vh; overflow-y:auto)', css: 'body{height:100vh;overflow-y:auto}' });
add({ id: 'T11a', grp: '#11', name: 'position:fixed .topbar', before: '<div class="topbar" style="position:fixed;top:0;left:0;right:0;height:50px;background:#333;color:#fff;font:24px Arial;z-index:9">FIXEDBAR</div>', forbidden: ['FIXEDBAR'], outsideExpect: true });
add({ id: 'T11b', grp: '#11/R11', name: '열린 모달 dialog(showModal)', after: '<dialog id="dlg"><p style="font:24px Arial">LIGHTBOX</p></dialog>', script: 'document.getElementById("dlg").showModal()', forbidden: ['LIGHTBOX'], outsideExpect: true });
add({ id: 'T11c', grp: '#11', name: '열린 popover', after: '<div id="pop" popover style="font:24px Arial">POPOVER</div>', script: 'document.getElementById("pop").showPopover()', forbidden: ['POPOVER'], outsideExpect: true });
add({ id: 'T11d', grp: '#11(계약)', kind: 'contract', name: '숨김 목록 밖 position:fixed 토스트', after: '<div class="toast-x" style="position:fixed;right:20px;bottom:20px;padding:8px;background:#333;color:#fff;font:20px Arial">FIXEDTOAST</div>', forbidden: ['FIXEDTOAST'], auditExpect: ['fixed'], outsideExpect: true });
add({ id: 'T12a', grp: '#12/R05', name: 'sticky .topbar', before: '<div class="topbar" style="position:sticky;top:0;height:50px;background:#333;color:#fff;font:24px Arial">STICKYBAR</div>', forbidden: ['STICKYBAR'], outsideExpect: true });
add({ id: 'T12b', grp: '#12(계약)', kind: 'contract', name: '숨김 목록 밖 sticky 바', before: '<nav class="nav-x" style="position:sticky;top:0;height:50px;background:#333;color:#fff;font:24px Arial">STICKYNAV</nav>', forbidden: ['STICKYNAV'], auditExpect: ['fixed'], outsideExpect: true });
add({ id: 'T13a', grp: '#13', name: '키트 화면 배율 ?pf-k=0.6(transform + 여백 보정)', query: 'pf-k=0.6' });
add({ id: 'T13b', grp: '#13/R06', name: 'JS 인라인 transform·zoom·margin', script: `document.querySelectorAll('.pf-scene').forEach((s)=>{s.style.transform='scale(.75)';s.style.transformOrigin='0 0';s.style.zoom='.8';s.style.margin='24px'})` });
add({ id: 'T13c', grp: '#13', name: '@media 없는 zoom·transform CSS', css: '.pf-deck{zoom:.75}.pf-scene{transform:scale(.75);transform-origin:0 0}' });
add({ id: 'T13d', grp: '#13/R10', name: '덱 grid gap + zoom + padding', css: '.pf-deck{display:grid;gap:40px;zoom:.7;padding:30px}' });
add({ id: 'T13e', grp: '#13', name: 'A2 zoom 훅 ?pf-k=0.6&pf-scale=zoom', query: 'pf-k=0.6&pf-scale=zoom' });
add({ id: 'T13f', grp: '#13', name: '덱 2열 grid(화면 배치)', css: '.pf-deck{display:grid;grid-template-columns:repeat(2,1280px)}' });
add({ id: 'T14', grp: '#14', name: '유동 장면 width:100%; aspect-ratio:16/9', css: '.pf-scene{width:100%;height:auto;aspect-ratio:16/9}' });
// #15 배경 끔: 다크 장면 + 그라디언트·pre·밝은 글자·SVG·img·방사형·그림자
const RICH = () => `
  <div style="position:absolute;left:40px;top:80px;width:300px;height:150px;background:linear-gradient(90deg,#f00,#00f)"></div>
  <pre style="position:absolute;left:380px;top:80px;width:300px;height:150px;margin:0;padding:8px;box-sizing:border-box;background:#1C1D22;color:#E6E6E6;font:20px Consolas,monospace">code{dark}</pre>
  <svg style="position:absolute;left:720px;top:80px" width="300" height="150"><rect width="300" height="150" fill="#00AA00"/><text x="20" y="40" fill="#fff" font-size="24" font-family="Arial">SVGTEXT</text></svg>
  <img style="position:absolute;left:40px;top:300px;width:300px;height:150px" src="${svgData('#FF8800')}" alt="">
  <div style="position:absolute;left:380px;top:300px;width:300px;height:150px;background:#2F6FEB;color:#fff;font:24px Arial">CHIP</div>
  <p style="position:absolute;left:720px;top:300px;margin:0;color:#E8E8E8;font:24px Arial">LIGHT-TEXT</p>
  <div style="position:absolute;left:40px;top:480px;width:300px;height:150px;background:radial-gradient(circle,#ffcc00 0 30%,#ff0066 100%)"></div>
  <div style="position:absolute;left:380px;top:480px;width:300px;height:150px;background:#fff;box-shadow:0 0 30px 10px rgba(255,0,0,.9)"></div>`;
const RICH_PROBES = [
  { x: 45, y: 100, rgb: [251, 0, 4], tol: 25, name: '그라디언트 왼쪽' }, { x: 335, y: 100, rgb: [4, 0, 251], tol: 25, name: '그라디언트 오른쪽' },
  { x: 670, y: 220, rgb: [28, 29, 34], tol: 6, name: 'pre 다크 배경' }, { x: 1000, y: 220, rgb: [0, 170, 0], tol: 6, name: 'SVG' },
  { x: 190, y: 375, rgb: [255, 136, 0], tol: 6, name: 'img' }, { x: 670, y: 440, rgb: [47, 111, 235], tol: 6, name: '칩 배경' },
  { x: 190, y: 555, rgb: [255, 204, 0], tol: 30, name: '방사형 가운데' }, { x: 374, y: 555, rgb: [151, 9, 11], tol: 35, name: 'box-shadow' }];
const RICH_COLORS = [{ text: 'LIGHT-TEXT', rgb: [232, 232, 232] }, { text: 'code{dark}', rgb: [230, 230, 230] }];
const LIGHTLBL = '.pf-scene .lbl{color:#E8E8E8}';
add({ id: 'T15a', grp: '#15', name: '다크 장면(--bg 토큰) + 그라디언트·pre·밝은 글자·SVG·img', css: `:root{--bg:#14161C}${LIGHTLBL}`, inner: RICH, bg: DARK, probes: () => RICH_PROBES, colors: RICH_COLORS });
add({ id: 'T15b', grp: '#15', name: '다크 배경을 뒤 규칙 .pf-scene{background}로', css: `.pf-scene{background:#14161C}${LIGHTLBL}`, inner: RICH, bg: DARK, probes: () => RICH_PROBES, colors: RICH_COLORS });
add({ id: 'T15c', grp: '#15', name: '장면 배경 자체가 그라디언트', css: `.pf-scene{background:linear-gradient(90deg,#0E1115,#1E2A44)}${LIGHTLBL}`, bg: null,
  probes: () => [{ x: 3, y: 360, rgb: [14, 17, 21], tol: 6, name: '왼쪽 끝' }, { x: 1277, y: 360, rgb: [30, 42, 68], tol: 6, name: '오른쪽 끝' }, { x: 640, y: 360, rgb: [22, 30, 45], tol: 6, name: '가운데' }] });
add({ id: 'T15d', grp: '#15(바뀐 줄)', name: '--bg 미정의 → 키트 기본값 #F7F7F5', css: ':root{--bg:initial}', bg: [247, 247, 245] });
// #16 lazy 이미지(화면 밖): 게이트가 데스크톱에서 eager로 바꾸고 기다림
add({ id: 'T16', grp: '#16', name: '화면 밖 lazy 이미지 6장(서버 400ms 지연)', n: 6,
  inner: (k) => `<img loading="lazy" src="img/c${k}__d400.png" style="position:absolute;left:300px;top:150px;width:640px;height:360px" alt="">`,
  probes: (k) => [{ x: 620, y: 330, rgb: IMG_COLORS[k - 1], tol: 6, name: `이미지 ${k}` }], images: true });
// #17 준비 게이트(바뀐 줄: timeout 두 줄)
const GUIDE_EXP = { n: 1, labels: false, bg: null, required: [{ page: 1, text: GUIDE }], forbidden: ['S1-TOP', 'S2-TOP'] };
add({ id: 'T17a', grp: '#17', name: '준비 전(no) 인쇄 → 안내 1쪽', preMount: 'PFScene.track(new Promise((r) => setTimeout(r, 15000)));', waitFor: 'load', ...GUIDE_EXP });
add({ id: 'T17b', grp: '#17(바뀐 줄)', name: 'timeout 상태 인쇄 → 안내 1쪽', query: 'pf-timeout=300', preMount: 'PFScene.track(new Promise(() => {}));', waitFor: 'timeout', ...GUIDE_EXP });
add({ id: 'T17c', grp: '#17(바뀐 줄)', name: 'timeout + [그래도 인쇄](data-pf-print-anyway) → 장면 3쪽', query: 'pf-timeout=300', preMount: 'PFScene.track(new Promise(() => {}));', waitFor: 'timeout', printAnyway: true });
add({ id: 'T17d', grp: '#17(바뀐 줄)', name: 'timeout 뒤 완료 → yes 회복 → 장면 3쪽', query: 'pf-timeout=300', preMount: 'PFScene.track(new Promise((r) => setTimeout(r, 1500)));', waitFor: 'timeout-then-yes' });
add({ id: 'G1', grp: '게이트(미확인 항목)', kind: 'info', name: 'yes 뒤 늦게 붙은 이미지가 받는 중일 때 인쇄 → beforeprint의 no 전환이 이번 인쇄에 반영되나', n: null, count: 3, labels: false, bg: null,
  prepareJs: `const i = document.createElement('img'); i.src = 'img/slow__d8000.png?' + Date.now(); i.style.cssText = 'position:absolute;left:300px;top:150px;width:640px;height:360px'; document.querySelectorAll('#deck > .pf-scene')[1].appendChild(i)` });
add({ id: 'T18', grp: '#18', name: '백그라운드 탭에서 준비·인쇄', background: true });
add({ id: 'T19', grp: '#19(계약)', kind: 'contract', name: '숨겨진 넘침 overflow:auto 상자', allowOutside: true, auditExpect: ['inner-scroll'],
  css: '.ovf{position:absolute;left:40px;top:120px;width:600px;height:200px;overflow:auto;font:20px/1.5 Arial}',
  inner: (k) => `<div class="ovf">${Array.from({ length: 20 }, (_, i) => `S${k}-OVF-${i + 1}`).join('<br>')}</div>` });
add({ id: 'T20a', grp: '#20', name: '뒤에 @page{size:auto}', css: '@page{size:auto}' });
add({ id: 'T20b', grp: '#20', name: '뒤에 @page{size:A4}', css: '@page{size:A4}' });
add({ id: 'T20c', grp: '#20', name: '뒤에 @media print{@page{size:A4 landscape;margin:10mm}}', css: '@media print{@page{size:A4 landscape;margin:10mm}}' });
add({ id: 'T21', grp: '#21', kind: 'recipe+audit', name: 'height:auto 장면에 900px 내용', allowOutside: true, auditExpect: ['scene-scroll'],
  css: '.pf-scene{height:auto}.long{height:900px;padding-top:760px;font:700 28px Arial}', inner: (k) => `<div class="long">S${k}-LONG-HIDDEN</div>` });
// ── 새 함정 1: 기본 숨김 + forwards 등장 애니메이션 / 등장 효과 ──
const BOXP = (rgb) => () => [{ x: 390, y: 310, rgb, tol: 8, name: '등장 상자' }];
const rv = (id, grp, name, html, rgb, extra = {}) => add({ id, grp, name, inner: () => html, probes: BOXP(rgb), required: [1, 2, 3].map((p) => ({ page: p, text: `REVEAL-${id}` })), ...extra });
rv('N1a', '새 함정 1', 'opacity:0 + animation … 30s forwards(지연 중)', `<div class="box" style="opacity:0;animation:rvIn .8s ease 30s forwards;background:#00AA00">REVEAL-N1a</div>`, [0, 170, 0]);
rv('N1b', '새 함정 1', 'animation-fill-mode:both(지연 중 from 상태)', `<div class="box" style="animation:rvIn .8s ease 30s both;background:#FF8800">REVEAL-N1b</div>`, [255, 136, 0]);
rv('N1c', '새 함정 1', 'opacity:0 + forwards + animation-play-state:paused', `<div class="box" style="opacity:0;animation:rvIn .8s ease forwards;animation-play-state:paused;background:#880088">REVEAL-N1c</div>`, PURPLE);
rv('N1d', '새 함정 1', '무한 반복 깜빡임(infinite)', `<div class="box" style="animation:pulse 2s infinite;background:#0096C8">REVEAL-N1d</div>`, [0, 150, 200]);
rv('N1e', '새 함정 1(계약)', 'WAAPI animate() 지연 중, data-pf-reveal 없음', `<div class="box wa" style="background:#5A9F00">REVEAL-N1e</div>`, [90, 160, 0],
  { kind: 'contract', auditExpect: ['hidden'], script: `document.querySelectorAll('.wa').forEach((e)=>e.animate([{opacity:0,transform:'translateY(60px)'},{opacity:1,transform:'none'}],{duration:800,delay:30000,fill:'both'}))` });
rv('N1f', '새 함정 1', 'WAAPI animate() 지연 중 + data-pf-reveal', `<div class="box wa" data-pf-reveal style="background:#5A9F00">REVEAL-N1f</div>`, [90, 160, 0],
  { script: `document.querySelectorAll('.wa').forEach((e)=>e.animate([{opacity:0,transform:'translateY(60px)'},{opacity:1,transform:'none'}],{duration:800,delay:30000,fill:'both'}))` });
rv('N1g', '새 함정 1', '인쇄 직전 시작한 20s transition(진행 중)', `<div class="box tg" style="opacity:0;transform:translateY(60px);transition:opacity 20s,transform 20s;background:#D97706">REVEAL-N1g</div>`, [217, 119, 6],
  { css: '.tg.in{opacity:1 !important;transform:none !important}', prepareJs: `document.querySelectorAll('.tg').forEach((e)=>e.classList.add('in'))` });
rv('N1j', '새 함정 1(계약)', '스크롤 등장(클래스로 애니메이션 시작, 화면 밖은 미시작), data-pf-reveal 없음', `<div class="box sr" style="opacity:0;background:#2F6FEB">REVEAL-N1j</div>`, [47, 111, 235],
  { kind: 'contract', auditExpect: ['hidden'], css: '.sr.go{animation:rvIn .8s forwards}', script: `document.querySelector('#deck > .pf-scene .sr').classList.add('go')` });
rv('N1k', '새 함정 1', '스크롤 등장 + data-pf-reveal', `<div class="box sr" data-pf-reveal style="opacity:0;background:#2F6FEB">REVEAL-N1k</div>`, [47, 111, 235],
  { css: '.sr.go{animation:rvIn .8s forwards}', script: `document.querySelector('#deck > .pf-scene .sr').classList.add('go')` });
rv('C2a', '바뀐 줄 [data-pf-reveal]', '인라인 opacity:0 + translateY(60px) + data-pf-reveal', `<div class="box" data-pf-reveal style="opacity:0;transform:translateY(60px);background:#2F6FEB">REVEAL-C2a</div>`, [47, 111, 235]);
rv('C2b', '바뀐 줄 [data-pf-reveal]', '클래스 transition 미발동 + data-pf-reveal', `<div class="box rvt" data-pf-reveal style="background:#B42318">REVEAL-C2b</div>`, [180, 35, 24],
  { css: '.rvt{opacity:0;transform:translateY(60px);transition:opacity .6s,transform .6s}.rvt.in{opacity:1;transform:none}' });
// ── 새 함정 2: 장면 안 CSS background-image ──
const BGP = () => [{ x: 530, y: 375, rgb: PURPLE, tol: 8, name: 'background-image' }];
add({ id: 'N2a', grp: '새 함정 2', name: 'CSS background-image(data: URI)', css: `.bgimg{position:absolute;left:380px;top:300px;width:300px;height:150px;background:url("${svgData('#880088')}") center/cover no-repeat}`, inner: () => '<div class="bgimg"></div>', probes: BGP, auditInfo: ['bg-image'] });
add({ id: 'N2b', grp: '새 함정 2(계약)', kind: 'contract', name: 'CSS background-image(서버 2.5초 지연, load 뒤 렌더처럼 삽입), 준비 직후 인쇄', css: '.bgimg{position:absolute;left:380px;top:300px;width:300px;height:150px;background:url("img/purple__d2500.png") center/cover no-repeat}', late: '<div class="bgimg"></div>', probes: BGP, auditExpect: ['bg-image'] });
add({ id: 'N2c', grp: '새 함정 2(대조)', name: '같은 그림을 <img>로(서버 2.5초 지연, load 뒤 삽입)', late: '<img src="img/purple2__d2500.png" style="position:absolute;left:380px;top:300px;width:300px;height:150px" alt="">', probes: BGP });
// ── 바뀐 줄: 잘림 띠, .pf-skip, 인쇄 번호 ──
add({ id: 'C4', grp: '바뀐 줄 .pf-clipped', name: '잘림 띠(.pf-clipped)가 인쇄에 보임', inner: (k) => (k === 2 ? '<div class="pf-clipped">내용이 잘렸습니다 → 원문: example.test/a3</div>' : ''),
  probes: (k) => (k === 2 ? [{ x: 1200, y: 663, rgb: [180, 35, 24], tol: 6, name: '잘림 띠' }] : []), required: [{ page: 2, text: '내용이 잘렸습니다' }], auditInfo: ['clipped'] });
add({ id: 'C1a', grp: '바뀐 줄 .pf-skip', name: '.pf-skip 장면이 앞·가운데·연속·끝에', scenes: [sc('X1', '', { cls: 'pf-skip' }), sc('S1'), sc('X2', '', { cls: 'pf-skip' }), sc('X3', '', { cls: 'pf-skip' }), sc('S2'), sc('S3'), sc('X4', '', { cls: 'pf-skip' })],
  forbidden: ['X1-TOP', 'X2-TOP', 'X3-TOP', 'X4-TOP'] });
add({ id: 'C1b', grp: '바뀐 줄 .pf-skip', kind: 'info', name: '모든 장면이 .pf-skip', scenes: [sc('X1', '', { cls: 'pf-skip' }), sc('X2', '', { cls: 'pf-skip' })], n: null, labels: false, bg: null, forbidden: ['X1-TOP', 'X2-TOP'] });
const FOOT = '<footer class="pf-foot"><span>A3 FOOT</span><span class="pf-num"><span class="pf-n-screen"></span><span class="pf-n-print"></span></span></footer>';
const XREFS = '<a class="xr" style="top:200px" href="#h-s4" data-pf-ref="h-s4">REF-A <span class="pf-n-screen"></span><span class="pf-n-print"></span></a><a class="xr" style="top:260px" href="#h-s6" data-pf-ref="h-s6">REF-B <span class="pf-n-screen"></span><span class="pf-n-print"></span></a>';
const C1_SCENES = [['S1', 'summary', XREFS], ['S2', 'doc', ''], ['S3', 'summary', ''], ['S4', 'doc', '<h2 id="h-s4" style="position:absolute;left:40px;top:120px;margin:0;font:700 30px Arial">HEAD-S4</h2>'], ['S5', 'doc', ''], ['S6', 'summary', '<h2 id="h-s6" style="position:absolute;left:40px;top:120px;margin:0;font:700 30px Arial">HEAD-S6</h2>']]
  .map(([l, part, inner]) => sc(l, inner + FOOT, { attrs: ` data-pf-part="${part}"` }));
add({ id: 'C5a', grp: '바뀐 줄 .pf-n-print', name: '전체 인쇄: 바닥글 j / 6, 교차 참조 p.N', scenes: C1_SCENES, n: 6, footer: true,
  dynRequired: `[{ page: 1, text: 'REF-A p.4' }, { page: 1, text: 'REF-B p.6' }]`, forbidden: [] });
add({ id: 'C5b', grp: '바뀐 줄 .pf-skip/.pf-n-print', name: '요약만(setScope): 3쪽, 바닥글 j / 3, 빠진 장면 참조 = URL 글자', scenes: C1_SCENES, n: 3, labels: false, footer: true,
  prepareJs: `PFScene.setScope('summary')`,
  dynRequired: `[{ page: 1, text: 'S1-TOP' }, { page: 2, text: 'S3-TOP' }, { page: 3, text: 'S6-TOP' }, { page: 1, text: 'REF-A ' + PFScene.refUrl('h-s4') }, { page: 1, text: 'REF-B p.3' }]`,
  forbidden: ['S2-TOP', 'S4-TOP', 'S5-TOP', 'REF-Ap.4', 'REF-Bp.6', '1 / 6', '3 / 6', '6 / 6'] });
// ── 추가 함정(01 표에 없음, 같은 원리의 변형) ──
add({ id: 'X01', grp: '추가', name: '뒤에 장면 box-sizing:content-box + 테두리 3px', css: '.pf-scene{box-sizing:content-box;border:3px solid #333}', inset: 8 });
add({ id: 'X02', grp: '추가', name: '뒤에 장면 position:static', css: '.pf-scene{position:static}' });
add({ id: 'X03', grp: '추가', name: '뒤에 장면 display:inline-block', css: '.pf-scene{display:inline-block;vertical-align:top}' });
add({ id: 'X04', grp: '추가(계약)', kind: 'contract', name: '장면마다 감싸개 div(형제 아님)', wrap: true, auditExpect: ['parents'] });
add({ id: 'X05', grp: '추가', name: 'content-visibility:auto 12장면', css: '.pf-scene{content-visibility:auto;contain-intrinsic-size:1280px 720px}', n: 12 });
add({ id: 'X06', grp: '추가', name: 'content-visibility:hidden', css: '.pf-scene{content-visibility:hidden}' });
add({ id: 'X07', grp: '추가', name: '둥근 모서리·outline·그림자(화면 장식)', css: '.pf-scene{border-radius:24px;outline:4px solid #f00;box-shadow:0 0 40px 10px #f00}' });
add({ id: 'X08', grp: '추가', name: '측정용 컨테이너(.pf-measure)가 남음', after: '<div class="pf-measure"><section class="pf-scene"><div class="lbl tl">MEASURE-LEAK</div></section></div>', forbidden: ['MEASURE-LEAK'] });
add({ id: 'X09', grp: 'R13', name: '30장면', n: 30 });
add({ id: 'X11', grp: '추가', name: '뒤에 @page{size:A4 !important}(중요도까지 붙인 덮어쓰기)', css: '@page{size:A4 !important}' });
add({ id: 'X12', grp: '추가', kind: 'info', name: '뒤에 @page{margin:20px !important} — 쪽 여백이 실제로 생기나(전면 채움이면 무시된 것)', css: '@page{margin:20px !important}' });
// ── zoom-fit 줄(바뀐 줄): 쪽 영역이 1280×720이 아닐 때(대화상자 "맞춤"·배율) 장면을 쪽에 맞추는지. CDP printToPDF의 scale로 쪽 영역(CSS px)을 바꿈
//    (뒤에 @page{margin:20px !important}를 두는 방법은 레시피의 margin:0 !important를 이기지 못해 쪽 영역을 줄이지 못했음 — 실측)
add({ id: 'Z1', grp: 'zoom-fit(바뀐 줄)', name: 'printToPDF scale 0.75(쪽 영역 1707×960px) → zoom-fit 1.333', printOpts: { scale: 0.75 } });
add({ id: 'Z2', grp: 'zoom-fit(바뀐 줄)', name: 'printToPDF scale 1.25(쪽 영역 1024×576px) → zoom-fit 0.8', printOpts: { scale: 1.25 } });
add({ id: 'Z0a', grp: 'zoom-fit(대조)', kind: 'info', name: 'scale 0.75 + zoom-fit 끔(@media print{.pf-scene{zoom:1 !important}})', css: '@media print{.pf-scene{zoom:1 !important}}', printOpts: { scale: 0.75 } });
add({ id: 'Z0b', grp: 'zoom-fit(대조)', kind: 'info', name: 'scale 1.25 + zoom-fit 끔', css: '@media print{.pf-scene{zoom:1 !important}}', printOpts: { scale: 1.25 } });
add({ id: 'X10', grp: '문제없던 조건', name: '200장면', n: 200 });
// ── 【R0 결정 #14】 화면 매체 감사 outside-deck 시험(OD). 수정안 4가 숨기지 못하는 것(글자 노드·body 생성 글자·래퍼 안 비장면)과
//    오탐 대조(키트 UI·안 보이는 것)를 함께 봄. outsideExpect = 화면 감사가 잡아야 함 ──
const SRONLY = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
add({ id: 'OD01', grp: '#14 덱 밖 감사', kind: 'contract', name: 'body 바로 아래 글자 노드(덱 뒤) — CSS로 숨길 수 없음', after: 'BARE-TEXT-AFTER', forbidden: ['BARE-TEXT-AFTER'], auditExpect: ['doc-height'], outsideExpect: true });
add({ id: 'OD02', grp: '#14 덱 밖 감사', kind: 'contract', name: 'body::after 생성 글자', css: 'body::after{content:"BODY-AFTER";display:block;font:20px Arial}', forbidden: ['BODY-AFTER'], auditExpect: ['doc-height'], outsideExpect: true });
add({ id: 'OD03', grp: '#14 덱 밖 감사', name: 'React식 #root 감싸개 안 덱 옆 header·footer', root: { before: '<header style="font:20px Arial;background:#333;color:#fff">ROOT-HEADER</header>', after: '<footer style="font:14px Arial">ROOT-FOOTER</footer>' }, forbidden: ['ROOT-HEADER', 'ROOT-FOOTER'], outsideExpect: true });
add({ id: 'OD04', grp: '#14 덱 밖 감사', kind: 'contract', name: '래퍼 안 장면 옆 캡션(수정안 4 규칙 2는 덱 바로 아래만 숨김)', wrap: true, wrapExtra: (k) => `<p style="margin:0;font:16px Arial">WRAP-CAP-${k}</p>`, auditExpect: ['parents'], outsideExpect: true });
add({ id: 'OD05', grp: '#14 덱 밖 감사(오탐 대조)', name: '안 보이는 것·키트 UI만 덱 밖에(감사 0이어야 함): 닫힌 dialog·popover, sr-only, opacity 0(자식 포함), 화면 밖, 빈 간격 div, visibility:hidden, data-pf-ui, .pf-screen-only, 열린 라이트박스',
  after: `<dialog id="closed"><p>CLOSED-DIALOG</p></dialog><div popover id="pc">CLOSED-POPOVER</div><span style="${SRONLY}">SR-ONLY</span>`
    + '<div style="opacity:0;font:20px Arial">OPAQ0<span style="opacity:1">OPAQ-CHILD</span></div><div style="position:absolute;left:-9999px;top:0;font:20px Arial">OFFSCREEN</div>'
    + '<div style="height:40px"></div><div style="visibility:hidden;height:10px">VISHIDDEN</div><template><p>TPL</p></template><noscript>NOSCRIPT</noscript>'
    + '<div data-pf-ui="note" style="font:14px Arial;background:#eee">PFUI-NOTE</div><div class="pf-screen-only" style="position:fixed;left:8px;bottom:8px;font:14px Arial;background:#ffd">SCREEN-ONLY</div>'
    + `<dialog class="lightbox" id="lb"><img src="${svgData('#2F6FEB')}" style="width:300px;height:150px" alt=""><p>LB-CAPTION</p></dialog>`,
  script: 'document.getElementById("lb").showModal()',
  forbidden: ['CLOSED-DIALOG', 'CLOSED-POPOVER', 'SR-ONLY', 'OPAQ', 'OFFSCREEN', 'VISHIDDEN', 'TPL', 'NOSCRIPT', 'PFUI-NOTE', 'SCREEN-ONLY', 'LB-CAPTION'] });
add({ id: 'OD06', grp: '#14 덱 밖 감사', name: 'visibility:hidden 부모 안 visibility:visible 자식', after: '<div style="visibility:hidden;font:20px Arial">HID-PARENT <span style="visibility:visible">VIS-CHILD</span></div>', forbidden: ['VIS-CHILD'], outsideExpect: true });
add({ id: 'OD07', grp: '#14 덱 밖 감사', name: 'display:contents 감싸개 안 글자', after: '<div style="display:contents"><p style="font:20px Arial">CONTENTS-P</p></div>', forbidden: ['CONTENTS-P'], outsideExpect: true });
add({ id: 'OD08', grp: '#14 덱 밖 감사', name: '덱 밖에 놓인 장면(.pf-scene)', after: '<section class="pf-scene"><div class="lbl tl">STRAY-SCENE</div></section>', forbidden: ['STRAY-SCENE'], outsideExpect: true });
add({ id: 'OD09', grp: '#14 덱 밖 감사', kind: 'contract', name: '덱 안 장면 뒤 글자 노드 — CSS로 숨길 수 없음', deckTail: 'DECK-BARE-TEXT', forbidden: ['DECK-BARE-TEXT'], auditExpect: ['doc-height'], outsideExpect: true });
add({ id: 'OD10', grp: '#14 덱 밖 감사', name: '덱 앞 그림(로고 img, 글자 없음)', before: `<img src="${svgData('#B42318')}" style="width:60px;height:30px" alt="">`, outsideExpect: true });

// ── 페이지 만들기 ──
function scenesOf(t) {
  if (t.scenes) return t.scenes;
  return Array.from({ length: t.count ?? t.n }, (_, i) => {
    const k = i + 1;
    const s = sc(`S${k}`, t.inner ? t.inner(k) : '', { first: t.first ? t.first(k) : '' });
    return t.wrap ? `<div class="w">${s}${t.wrapExtra ? t.wrapExtra(k) : ''}</div>` : s;
  });
}
function pageHtml(t) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>A3 ${t.id}</title>
<script src="/spikes/r0/kit/scene-kit.js"></script>
<link rel="stylesheet" href="${KIT_CSS}">
<style id="a3-base">${BASE}</style>
<style id="a3-trap">${t.css || ''}</style>
</head><body>${t.before || ''}${t.root ? '<div id="root">' + (t.root.before || '') : ''}<main class="pf-deck" id="deck">${scenesOf(t).join('\n')}${t.deckTail || ''}</main>${t.root ? (t.root.after || '') + '</div>' : ''}${t.after || ''}
<script>${COUNTERS}${t.preMount || ''}${t.late ? `addEventListener('load', () => setTimeout(() => { document.querySelectorAll('#deck > .pf-scene').forEach((s) => s.insertAdjacentHTML('beforeend', ${JSON.stringify(t.late)})); PFScene.mount({ deck: '#deck' }); }, 50));` : "PFScene.mount({ deck: '#deck' });"}</script>
${t.script ? `<script>${t.script}</script>` : ''}
</body></html>`;
}

// ── 실행 ──
async function waitAttr(page, want, ms = 20000) {
  const t0 = Date.now(); let r = '';
  while (Date.now() - t0 < ms) { r = await page.evaluate('document.documentElement.dataset.pfReady || ""').catch(() => ''); if (r === want) return { ok: true, ms: Date.now() - t0 }; await sleep(30); }
  return { ok: false, last: r, ms: Date.now() - t0 };
}
async function runTrap(c, page, t, base, pdfDir) {
  const url = `${base}${PAGES_URL.slice(1)}${t.id}.html${t.query ? '?' + t.query : ''}`;
  const rec = { id: t.id, prints: [], log: [] };
  let sess = page;
  let bgTarget = null;
  if (t.background) {                                       // #18: 앞 탭(about:blank)이 앞에 있는 상태에서 백그라운드 탭을 새로 만듦
    const { targetId } = await c.send('Target.createTarget', { url: 'about:blank', background: true });
    const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    const ps = (m, p) => c.send(m, p, sessionId);
    await ps('Page.enable'); await ps('Runtime.enable');
    const evaluate = async (expression) => { const r = await ps('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    sess = { send: ps, evaluate, once: (m, ms = 30000) => new Promise((res) => { const off = c.on(m, (p) => { off(); res(p); }, sessionId); setTimeout(() => { off(); res(null); }, ms); }) };
    bgTarget = targetId;
    await page.send('Page.bringToFront').catch(() => {});
  }
  await sess.send('Emulation.setEmulatedMedia', { media: '' });
  await sess.send('Emulation.setDeviceMetricsOverride', { width: VP.w, height: VP.h, deviceScaleFactor: VP.dpr, mobile: false });
  const t0 = Date.now();
  const loaded = sess.once('Page.loadEventFired', 30000);
  await sess.send('Page.navigate', { url });
  await loaded;
  rec.loadMs = Date.now() - t0;
  if (t.waitFor === 'load') rec.wait = { state: await sess.evaluate('document.documentElement.dataset.pfReady') };
  else if (t.waitFor === 'timeout') rec.wait = await waitAttr(sess, 'timeout', 10000);
  else if (t.waitFor === 'timeout-then-yes') { rec.wait = await waitAttr(sess, 'timeout', 10000); rec.wait2 = await waitAttr(sess, 'yes', 10000); }
  else rec.wait = await waitAttr(sess, 'yes', 20000);
  await sleep(60);
  if (t.prepareJs) { await sess.evaluate(`${t.prepareJs}; 1`); await sleep(60); }
  rec.dynRequired = t.dynRequired ? await sess.evaluate(`JSON.stringify(${t.dynRequired})`).then(JSON.parse) : [];
  rec.screen = await sess.evaluate(`JSON.stringify((() => { const s = document.querySelector('#deck > .pf-scene') || document.querySelector('.pf-scene');
    return { ready: document.documentElement.dataset.pfReady, k: window.PFScene && PFScene.k, transform: s ? getComputedStyle(s).transform : null, zoom: s ? getComputedStyle(s).zoom : null,
      visibility: document.visibilityState, hidden: document.hidden, readyState: document.readyState, eager: PFScene._eager,
      lazyLeft: [...document.images].filter((i) => i.loading === 'lazy').length, imgsDone: [...document.images].filter((i) => i.complete && i.naturalWidth).length, imgs: document.images.length,
      screenAudit: window.PFScene && PFScene.audit ? [...new Set(PFScene.audit().map((x) => x.type))] : null,
      outsideDeck: window.PFScene && PFScene.audit ? PFScene.audit().filter((x) => x.type === 'outside-deck').map(({ el, text, why, pos }) => ({ el, text, why, pos })) : null }; })())`).then(JSON.parse);
  // 인쇄 매체 감사(하네스 AUDIT_DOC: 뷰포트 = 캔버스)
  await sess.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await sess.send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(120);
  const a = await sess.evaluate(AUDIT_DOC).catch((e) => ({ error: String(e) }));
  rec.audit = a.error ? { error: a.error } : { printScenes: a.printScenes, docH: a.docH, docW: a.docW, types: [...new Set([...a.issues.map((x) => x.type), ...(a.sceneAudit || []).map((x) => x.type)])], sample: [...a.issues, ...(a.sceneAudit || [])].slice(0, 4) };
  await sess.send('Emulation.setEmulatedMedia', { media: '' });
  await sess.send('Emulation.setDeviceMetricsOverride', { width: VP.w, height: VP.h, deviceScaleFactor: VP.dpr, mobile: false });
  await sleep(80);
  for (const css of [true, false]) for (const bg of [true, false]) {
    if (t.printAnyway) await sess.evaluate("(document.documentElement.dataset.pfPrintAnyway = '', 1)");
    const before = await sess.evaluate('JSON.stringify({ ...window.__pf, ready: document.documentElement.dataset.pfReady, anyway: "pfPrintAnyway" in document.documentElement.dataset })').then(JSON.parse);
    const tp = Date.now();
    const r = await sess.send('Page.printToPDF', { preferCSSPageSize: css, printBackground: bg, transferMode: 'ReturnAsBase64', ...(t.printOpts || {}) });
    const file = path.join(pdfDir, `${c.browser}__${t.id}__css${css ? 1 : 0}__bg${bg ? 1 : 0}.pdf`);
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    const after = await sess.evaluate('JSON.stringify({ ...window.__pf, ready: document.documentElement.dataset.pfReady, anyway: "pfPrintAnyway" in document.documentElement.dataset })').then(JSON.parse);
    rec.prints.push({ css, bg, file, ms: Date.now() - tp, before, after });
  }
  if (bgTarget) await c.send('Target.closeTarget', { targetId: bgTarget }).catch(() => {});
  return rec;
}

function jobFor(t, rec, p, pdfs) {
  const css = p.css;
  const n = t.n;
  const probes = [];
  if (css) {
    const nPages = n || 0;
    for (let k = 1; k <= nPages; k++) {
      const e = t.inset || 3;
      if (t.bg) for (const [x, y] of [[e, e], [1280 - e, e], [e, 720 - e], [1280 - e, 720 - e]]) probes.push({ page: k, x: x * 0.75, y: y * 0.75, rgb: t.bg, tol: 6, name: `모서리(${x},${y})` });
      if (t.probes) for (const q of t.probes(k)) probes.push({ ...q, page: k, x: q.x * 0.75, y: q.y * 0.75 });
      if (t.pageProbes) for (const q of t.pageProbes(k)) probes.push({ ...q, page: k });   // 쪽 좌표(pt) 그대로
    }
  }
  const twin = pdfs.find((q) => q.css === css && q.bg !== p.bg && q.bg);       // 배경 끔 쪽을 켬 쪽과 비교
  return { file: p.file, w: css ? 960 : null, h: css ? 540 : null, n: n ?? null, labels: t.labels !== false, probes,
    required: [...(t.required || []), ...(rec.dynRequired || [])], forbidden: [...HUD_TEXT, ...(t.forbidden || [])], colors: t.colors || [], footer: t.footer ? (css ? 'band' : 'any') : false,
    compare: !p.bg && twin ? twin.file : null };
}
function verdict(t, p, a, rec) {
  const f = [];
  if (a.error) return ['분석 실패: ' + a.error];
  if (t.n != null && a.pages !== t.n) f.push(`쪽 ${a.pages}/${t.n}`);
  if (p.css && a.badSize.length) f.push(`크기 ${Object.keys(a.sizes).join(',')}`);
  if (a.blank.length) f.push(`빈 쪽 ${a.blank.slice(0, 3).join(',')}`);
  if (!t.allowOutside && a.outside.length) f.push(`쪽 밖 글자 ${a.outside.length}쪽`);
  if (a.hf.length) f.push('머리글·바닥글');
  if (t.labels !== false && a.seq.length && !(t.n != null && a.pages !== t.n)) f.push(`표식 ${a.seq.length}쪽`);
  const bp = a.probes.filter((x) => !x.ok);
  if (bp.length) f.push(`색 ${[...new Set(bp.map((x) => x.name))].slice(0, 3).join('·')}${bp[0].got ? ` (${bp[0].name} ${JSON.stringify(bp[0].got)}≠${JSON.stringify(bp[0].want)})` : ''}`);
  const rq = a.required.filter((x) => !x.ok);
  if (rq.length) f.push(`글자 없음 ${rq.slice(0, 2).map((x) => `"${x.text.slice(0, 24)}"@${x.page}${x.foundOn.length ? '(→' + x.foundOn.join(',') + ')' : ''}`).join(', ')}`);
  if (a.forbidden.length) f.push(`금지 글자 ${a.forbidden.slice(0, 2).map((x) => `"${x.text}"@${x.foundOn.join(',')}`).join(', ')}`);
  const bc = a.colors.filter((x) => !x.ok);
  if (bc.length) f.push(`글자색 ${bc.map((x) => `${x.text} ${JSON.stringify(x.got)}`).join(', ')}`);
  if (a.footer.length) f.push(`번호 ${a.footer.length}쪽(예: ${JSON.stringify(a.footer[0])})`);
  return f;
}

(async () => {
  const traps = T.filter((t) => !ONLY || ONLY.test(t.id));
  fs.mkdirSync(path.join(PAGES, 'img'), { recursive: true });
  const pdfDir = path.join(OUT, TAG); fs.mkdirSync(pdfDir, { recursive: true });
  IMG_COLORS.forEach((c, i) => fs.writeFileSync(path.join(PAGES, 'img', `c${i + 1}__d400.png`), png(64, 36, c)));
  fs.writeFileSync(path.join(PAGES, 'img', 'purple__d2500.png'), png(64, 36, PURPLE));
  fs.writeFileSync(path.join(PAGES, 'img', 'purple2__d2500.png'), png(64, 36, PURPLE));
  fs.writeFileSync(path.join(PAGES, 'img', 'slow__d8000.png'), png(64, 36, [0, 0, 0]));
  for (const t of traps) fs.writeFileSync(path.join(PAGES, `${t.id}.html`), pageHtml(t));
  const server = await serve(ROOT, PORT, { delay: (p) => { const m = p.match(/__d(\d+)\.png$/); return m ? +m[1] : 0; } });
  const R = { tag: TAG, kit: KIT_CSS, date: new Date().toISOString(), viewport: `${VP.w}x${VP.h}@${VP.dpr}`, browsers: {}, runs: [] };
  const t0 = Date.now();
  try {
    for (const b of BROWSERS) {
      const c = await launch(b);
      R.browsers[b] = c.version;
      try {
        const page = await c.newPage();
        for (const t of traps) {
          process.stdout.write(`${b} ${t.id} … `);
          try {
            const rec = await runTrap(c, page, t, server.base, pdfDir);
            rec.browser = b; R.runs.push(rec);
            console.log(`ready=${rec.screen.ready} audit=${(rec.audit.types || []).join(',') || '-'} bp/ap=${rec.prints.at(-1).after.bp}/${rec.prints.at(-1).after.ap}`);
          } catch (e) { console.log('오류 ' + e.message); R.runs.push({ id: t.id, browser: b, error: String(e.stack || e) }); }
        }
        await page.close();
      } finally { await c.close(); }
    }
  } finally { await server.close(); }
  // ── PDF 분석 ──
  const jobs = [], idx = [];
  for (const rec of R.runs) {
    if (rec.error) continue;
    const t = T.find((x) => x.id === rec.id);
    rec.prints.forEach((p, i) => { jobs.push(jobFor(t, rec, p, rec.prints)); idx.push([rec, i]); });
  }
  const jf = path.join(OUT, `${TAG}-jobs.json`);
  fs.writeFileSync(jf, JSON.stringify(jobs));
  const lines = execFileSync('python', ['-I', path.join(__dirname, 'a3-pdf.py'), jf], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim().split(/\r?\n/);
  lines.forEach((l, k) => { const [rec, i] = idx[k]; const a = JSON.parse(l); const p = rec.prints[i]; p.analysis = a; p.fails = verdict(T.find((x) => x.id === rec.id), p, a, rec); p.file = path.relative(OUT, p.file); });
  // ── 판정 ──
  R.rows = traps.map((t) => {
    const runs = R.runs.filter((r) => r.id === t.id);
    const cells = {};
    let allPass = true, auditOk = true;
    for (const r of runs) {
      if (r.error) { allPass = false; cells[r.browser] = 'error'; continue; }
      for (const p of r.prints) { cells[`${r.browser}|css${p.css ? 1 : 0}|bg${p.bg ? 1 : 0}`] = p.fails; if (p.fails.length) allPass = false; }
      const types = r.audit.types || [];
      if (t.auditExpect && !t.auditExpect.every((x) => types.includes(x))) auditOk = false;
    }
    // 【R0 결정 #14】 화면 매체 감사(인쇄 전): 브라우저별 outside-deck 수
    const odN = runs.filter((r) => !r.error).map((r) => (r.screen && r.screen.outsideDeck ? r.screen.outsideDeck.length : 0));
    const odHit = odN.length > 0 && odN.every((x) => x > 0), odNone = odN.every((x) => x === 0);
    let status;
    if (t.kind === 'info') status = 'INFO';
    else if (t.kind === 'contract') status = allPass ? (t.auditExpect && auditOk ? 'PASS(쪽 규칙 유지 + 감사가 잡음)' : 'PASS(레시피가 막음)') : auditOk ? '계약(감사가 잡음)' : 'FAIL(감사도 못 잡음)';
    else if (t.kind === 'recipe+audit') status = allPass && auditOk ? 'PASS' : 'FAIL';
    else status = allPass ? 'PASS' : 'FAIL';
    if (t.outsideExpect) status = !odHit ? 'FAIL(화면 감사가 못 잡음)' : allPass ? '계약 위반 감지(화면 감사 outside-deck, 인쇄는 덱만)' : `${status} + 화면 감사 outside-deck`;
    else if (!odNone) status = `FAIL(화면 감사 오탐: ${status})`;
    const diffs = runs.flatMap((r) => (r.prints || []).filter((p) => p.analysis && p.analysis.diff).map((p) => ({ b: r.browser, css: p.css, ...p.analysis.diff })));
    return { id: t.id, grp: t.grp, name: t.name, kind: t.kind, status, cells, audit: Object.fromEntries(runs.map((r) => [r.browser, r.audit && r.audit.types])),
      outsideDeck: Object.fromEntries(runs.map((r) => [r.browser, r.screen && r.screen.outsideDeck])), outsideExpect: !!t.outsideExpect,
      diff: diffs, events: Object.fromEntries(runs.map((r) => [r.browser, r.prints && r.prints.map((p) => `${p.after.bp}/${p.after.ap}`).join(' ')])),
      screen: Object.fromEntries(runs.map((r) => [r.browser, r.screen])), wait: Object.fromEntries(runs.map((r) => [r.browser, { wait: r.wait, wait2: r.wait2 }])),
      sizes: Object.fromEntries(runs.flatMap((r) => (r.prints || []).map((p) => [`${r.browser}|css${p.css ? 1 : 0}|bg${p.bg ? 1 : 0}`, p.analysis && p.analysis.sizes]))) };
  });
  R.totalMs = Date.now() - t0;
  fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, `${TAG}.md`), toMd(R, traps));
  const cnt = (s) => R.rows.filter((r) => r.status.startsWith(s)).length;
  const odRows = R.rows.filter((r) => Object.values(r.outsideDeck).some((x) => x && x.length)).map((r) => r.id);
  console.log(`\nPASS ${cnt('PASS')} / FAIL ${cnt('FAIL')} / 계약 ${cnt('계약')}(그중 계약 위반 감지 ${cnt('계약 위반 감지')}) / INFO ${cnt('INFO')}  (${Math.round(R.totalMs / 1000)}초) → ${path.join(OUT, TAG + '.md')}`);
  console.log(`화면 감사 outside-deck가 잡은 함정: ${odRows.join(', ') || '없음'}`);
})().catch((e) => { console.error(e); process.exit(2); });

function toMd(R, traps) {
  const L = [`# A3 함정 매트릭스 (${R.tag})`, '', `- 실행 ${R.date}, 키트 CSS \`${R.kit}\`, 화면 뷰포트 ${R.viewport}(인쇄 전 화면 배율이 걸린 상태), 서버 127.0.0.1:${PORT}`];
  Object.entries(R.browsers).forEach(([b, v]) => L.push(`- ${b}: ${v}`));
  L.push('- 칸: `css1`=preferCSSPageSize:true, `css0`=false(용지 Letter, zoom-fit 시험) · `bg1`/`bg0`=printBackground true/false · `P`=통과, 아니면 실패 이유', '');
  const cols = []; for (const b of Object.keys(R.browsers)) for (const css of [1, 0]) for (const bg of [1, 0]) cols.push(`${b}|css${css}|bg${bg}`);
  L.push(`| ID | 묶음 | 함정 | 판정 | ${cols.map((c) => c.replace(/\|/g, ' ')).join(' | ')} | 인쇄 감사(T1) | 화면 감사 덱 밖(T1) | 끔↔켬 래스터 차이(max) |`);
  L.push(`|---|---|---|---|${cols.map(() => '---').join('|')}|---|---|---|`);
  for (const r of R.rows) {
    const cell = (c) => { const f = r.cells[c]; return f === undefined ? '—' : f === 'error' ? 'error' : f.length ? f.join('; ').replace(/\|/g, '/').slice(0, 140) : 'P'; };
    const au = Object.entries(r.audit).map(([b, t]) => `${b[0]}:${(t || []).join(',') || '-'}`).join(' ');
    const df = r.diff.map((d) => `${d.b[0]}${d.css ? 1 : 0}:${d.max ?? d.error}`).join(' ');
    const od = Object.entries(r.outsideDeck || {}).map(([b, x]) => `${b[0]}:${x ? x.length : '?'}`).join(' ') + (r.outsideExpect ? ' (기대 ≥1)' : '');
    L.push(`| ${r.id} | ${r.grp} | ${r.name.replace(/\|/g, '/')} | ${r.status} | ${cols.map(cell).join(' | ')} | ${au} | ${od} | ${df} |`);
  }
  L.push('', '## 화면 매체 감사 outside-deck가 잡은 요소(【R0 결정 #14】, 인쇄 전 화면 매체에서 PFScene.audit())', '');
  const odRows = R.rows.filter((r) => Object.values(r.outsideDeck || {}).some((x) => x && x.length));
  if (!odRows.length) L.push('- 없음');
  for (const r of odRows) L.push(`- ${r.id}${r.outsideExpect ? '' : ' (기대하지 않음 = 오탐)'}: ${Object.entries(r.outsideDeck).map(([b, x]) => `${b} ${(x || []).map((o) => `<${o.el}> ${o.pos} ${o.why} "${o.text}"`).join(' / ').replace(/\|/g, '/')}`).join(' · ')}`);
  L.push('', '## beforeprint/afterprint 횟수(인쇄 4회 뒤, 브라우저별) · 화면 상태', '');
  for (const r of R.rows) L.push(`- ${r.id}: ${Object.entries(r.events).map(([b, e]) => `${b} ${e}`).join(' · ')} · ${Object.entries(r.screen).map(([b, s]) => `${b} ready=${s && s.ready} k=${s && s.k && s.k.toFixed ? s.k.toFixed(3) : s && s.k} tf=${s && s.transform} vis=${s && s.visibility} lazy=${s && s.lazyLeft} img=${s && s.imgsDone}/${s && s.imgs} readyState=${s && s.readyState}`).join(' · ')}`);
  L.push('', '## css0(preferCSSPageSize:false) 쪽 크기', '');
  for (const r of R.rows) L.push(`- ${r.id}: ${Object.entries(r.sizes).filter(([k]) => /css0/.test(k)).map(([k, v]) => `${k.split('|')[0]}/${k.split('|')[2]} ${JSON.stringify(v)}`).join(' · ')}`);
  return L.join('\n') + '\n';
}
