// fix4-probe/fixtures.js — 【R0 결정 #14】 적대적 시험 픽스처(수정안 4 인쇄 규칙 + 화면 매체 감사 outside-deck)
//   필드: id, grp, name
//     layout(D)  덱 HTML(D)을 둘러싼 body 안 HTML. 기본은 D 그대로
//     deckTag    덱 여는 태그(기본 '<main class="pf-deck" id="deck">'), deckClose
//     scene(k)   장면 HTML(기본 S{k}-TOP/BOT 표식), wrap(s,k) 장면 감싸기, n 장면 수(기본 3)
//     bodyAttrs  <body …> 속성, css 함정 CSS(키트 뒤), head 추가 head HTML, script 마운트 뒤 스크립트, preMount 마운트 앞 스크립트
//     pages      기대 쪽 수(기본 n). 인쇄 계약 = 덱 장면만, 쪽 i에 S{i}-TOP·BOT
//     forbidden  PDF에 없어야 할 글자(덱 밖 내용), required [{text, page, only}], probes [{page, x, y, rgb, name}] (장면 px)
//     od         화면 감사 기대: 덱 밖에 "보이는" 내용 수(정답). 0이면 0이어야 하고, ≥1이면 1 이상이어야 함
//     printNote  인쇄 기대 메모(표에 그대로)
'use strict';

const svgData = (hex, w = 60, h = 30) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${hex}"/></svg>`)}`;
const T = [];
const add = (t) => T.push({ n: 3, od: 0, forbidden: [], required: [], probes: [], ...t });
const TX = (s, extra = '') => `font:20px Arial;${extra}`;

// ── A. 덱 바깥 구조 ──
add({ id: 'A00', grp: '기준', name: 'body > main.pf-deck > 장면 3' });
add({ id: 'A01', grp: '깊은 중첩', name: 'React식 #root > div.app > main.layout > div.pf-deck(형제 없음)',
  layout: (D) => `<div id="root"><div class="app"><main class="layout">${D}</main></div></div>`, deckTag: '<div class="pf-deck" id="deck">', deckClose: '</div>' });
add({ id: 'A02', grp: '깊은 중첩', name: '각 층마다 형제: body header·footer, #root nav, .app aside·footer, main h1·p', od: 7,
  layout: (D) => `<header style="${TX()}background:#333;color:#fff">H-BODY</header><div id="root"><nav style="${TX()}">NAV-ROOT</nav><div class="app"><aside style="${TX()}">ASIDE-APP</aside><main class="layout"><h1 style="font:28px Arial">H1-MAIN</h1>${D}<p style="${TX()}">P-MAIN</p></main><footer style="${TX()}">FOOT-APP</footer></div></div><footer style="${TX()}">FOOT-BODY</footer>`,
  deckTag: '<div class="pf-deck" id="deck">', deckClose: '</div>', forbidden: ['H-BODY', 'NAV-ROOT', 'ASIDE-APP', 'H1-MAIN', 'P-MAIN', 'FOOT-APP', 'FOOT-BODY'] });
add({ id: 'A03', grp: '글자 노드', name: 'body 바로 아래 글자 노드(덱 앞)', od: 1, layout: (D) => `BARE-BEFORE${D}`, forbidden: ['BARE-BEFORE'], printNote: 'CSS로 숨길 수 없음(알려진 구멍)' });
add({ id: 'A04', grp: '글자 노드', name: '#root 안 덱 뒤 글자 노드', od: 1, layout: (D) => `<div id="root">${D}ROOT-BARE-AFTER</div>`, forbidden: ['ROOT-BARE-AFTER'], printNote: 'CSS로 숨길 수 없음' });
add({ id: 'A05', grp: '생성 글자', name: 'body::before 생성 글자(게이트 문구 아님)', od: 1, css: 'body::before{content:"BODY-BEFORE";display:block;font:20px Arial}', forbidden: ['BODY-BEFORE'], printNote: 'CSS로 숨길 수 없음' });
add({ id: 'A06', grp: '생성 글자', name: 'html::before 생성 글자', od: 1, css: 'html::before{content:"HTML-BEFORE";display:block;font:20px Arial}', forbidden: ['HTML-BEFORE'] });
add({ id: 'A07', grp: '생성 글자', name: 'body::before 빈 content 장식 띠(높이 60px, 배경색)', od: 1, css: 'body::before{content:"";display:block;height:60px;background:#C0392B}' });
add({ id: 'A08', grp: '생성 글자', name: '.pf-deck::after 빈 content 장식(높이 40px, 배경색)', od: 1, css: '.pf-deck::after{content:"";display:block;width:600px;height:40px;background:#C0392B}' });
add({ id: 'A09', grp: '생성 글자', name: '#root::after 생성 글자(덱 조상)', od: 1, layout: (D) => `<div id="root">${D}</div>`, css: '#root::after{content:"ROOT-AFTER";display:block;font:20px Arial}', forbidden: ['ROOT-AFTER'] });
add({ id: 'A10', grp: '겹친 요소', name: 'absolute 오버레이(body 자식, 배경+글자)', od: 1,
  layout: (D) => `<div style="position:absolute;top:120px;left:120px;padding:16px;background:#FFE08A;${TX()}">ABS-OVERLAY</div>${D}`, forbidden: ['ABS-OVERLAY'] });
add({ id: 'A11', grp: '겹친 요소', name: 'fixed 반투명 전체 오버레이 + pointer-events:none 워터마크 글자', od: 2,
  layout: (D) => `${D}<div style="position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:50"></div><div style="position:fixed;right:24px;bottom:24px;pointer-events:none;color:rgba(0,0,0,.35);font:32px Arial;z-index:51">WATERMARK</div>`, forbidden: ['WATERMARK'] });
add({ id: 'A12', grp: '대체 요소', name: 'iframe(srcdoc 글자) 덱 뒤', od: 1, layout: (D) => `${D}<iframe srcdoc="<p style='font:20px Arial'>IFRAME-TEXT</p>" style="width:400px;height:80px;border:0"></iframe>`, forbidden: ['IFRAME-TEXT'] });
add({ id: 'A13', grp: '대체 요소', name: 'canvas(빨간 칠) 덱 앞', od: 1, layout: (D) => `<canvas id="cv" width="200" height="60"></canvas>${D}`,
  preMount: 'const x = document.getElementById("cv").getContext("2d"); x.fillStyle = "#C00"; x.fillRect(0, 0, 200, 60);' });
add({ id: 'A14', grp: '대체 요소', name: 'inline svg(글자 포함) 덱 뒤', od: 1,
  layout: (D) => `${D}<svg width="300" height="60"><rect width="300" height="60" fill="#0A0"/><text x="10" y="40" font-size="24" font-family="Arial" fill="#fff">SVG-OUT</text></svg>`, forbidden: ['SVG-OUT'] });
add({ id: 'A16', grp: '대체 요소', name: 'img 로고(덱 뒤 footer 안, 글자 없음)', od: 1, layout: (D) => `${D}<footer><img src="${svgData('#B42318')}" style="width:60px;height:30px" alt=""></footer>` });
// SVG 정의(defs)를 덱 밖 0×0 svg에 두고 장면 안에서 참조 — 수정안 4가 그 svg를 display:none으로 만들면 참조가 깨지는지
const DEFS = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>
<symbol id="ic" viewBox="0 0 10 10"><rect width="10" height="10"/></symbol>
<linearGradient id="gr"><stop offset="0" stop-color="#AA00AA"/><stop offset="1" stop-color="#AA00AA"/></linearGradient>
<clipPath id="cp" clipPathUnits="objectBoundingBox"><rect width="0.5" height="1"/></clipPath>
<filter id="fx" x="0" y="0" width="1" height="1"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>
<pattern id="pt" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#00AAAA"/></pattern>
<marker id="mk" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="40" markerHeight="40" markerUnits="userSpaceOnUse"><rect width="10" height="10" fill="#FF8800"/></marker>
</defs></svg>`;
const BG = [223, 233, 255];
add({ id: 'A15', grp: 'SVG 정의 참조', name: '덱 밖 0×0 svg의 symbol·gradient·clipPath·filter·pattern·marker를 장면 안에서 참조(스프라이트·defs 패턴)', od: 0,
  layout: (D) => `${DEFS}${D}`,
  scene: (k) => {
    const body = k === 1
      ? `<svg style="position:absolute;left:200px;top:200px" width="200" height="200"><use href="#ic" width="200" height="200" fill="#00AA00"/></svg>
         <svg style="position:absolute;left:600px;top:200px" width="200" height="200"><rect width="200" height="200" fill="url(#gr)"/></svg>`
      : k === 2
        ? `<svg style="position:absolute;left:200px;top:200px" width="200" height="200"><rect width="200" height="200" fill="#0000FF" clip-path="url(#cp)"/></svg>
           <svg style="position:absolute;left:600px;top:200px" width="200" height="200"><rect width="200" height="200" fill="#0000FF" filter="url(#fx)"/></svg>`
        : `<svg style="position:absolute;left:200px;top:200px" width="200" height="200"><rect width="200" height="200" fill="url(#pt)"/></svg>
           <svg style="position:absolute;left:600px;top:200px" width="300" height="200"><line x1="20" y1="100" x2="200" y2="100" stroke="#000" stroke-width="2" marker-end="url(#mk)"/></svg>`;
    return `<section class="pf-scene"><div class="lbl tl">S${k}-TOP</div>${body}<div class="lbl br">S${k}-BOT</div></section>`;
  },
  probes: [
    { page: 1, x: 300, y: 300, rgb: [0, 170, 0], name: 'symbol(use)' }, { page: 1, x: 700, y: 300, rgb: [170, 0, 170], name: 'gradient' },
    { page: 2, x: 250, y: 300, rgb: [0, 0, 255], name: 'clipPath 안' }, { page: 2, x: 350, y: 300, rgb: BG, name: 'clipPath 밖' },
    { page: 2, x: 700, y: 300, rgb: [255, 0, 0], name: 'filter' },
    { page: 3, x: 300, y: 300, rgb: [0, 170, 170], name: 'pattern' }, { page: 3, x: 800, y: 300, rgb: [255, 136, 0], name: 'marker' }] });
// 그림자 DOM
const SH = (mode, extraStyle = '', text = 'SHADOW') => `<div class="sh"><template shadowrootmode="${mode}"><style>${extraStyle}</style><p style="margin:0;padding:12px;background:#333;color:#fff;font:20px Arial">${text}</p></template></div>`;
add({ id: 'A17', grp: '그림자 DOM', name: '덱 밖 그림자 호스트(open, 그림자 안 글자·배경, 빛 DOM 없음)', od: 1, layout: (D) => `${D}${SH('open', '', 'SHADOW-OPEN')}`, forbidden: ['SHADOW-OPEN'] });
add({ id: 'A18', grp: '그림자 DOM', name: '덱 밖 그림자 호스트(closed)', od: 1, layout: (D) => `${SH('closed', '', 'SHADOW-CLOSED')}${D}`, forbidden: ['SHADOW-CLOSED'] });
add({ id: 'A19', grp: '그림자 DOM', name: '덱 밖 그림자 호스트 + 그림자 안 :host{display:block !important}', od: 1, layout: (D) => `${D}${SH('open', ':host{display:block !important}', 'SHADOW-IMPORTANT')}`, forbidden: ['SHADOW-IMPORTANT'] });
add({ id: 'A20', grp: '그림자 DOM', name: '덱 밖 그림자 호스트 + slot으로 보이는 빛 DOM 글자', od: 1,
  layout: (D) => `${D}<div class="sh"><template shadowrootmode="open"><b style="font:20px Arial">[<slot></slot>]</b></template>LIGHT-SLOTTED</div>`, forbidden: ['LIGHT-SLOTTED'] });
// 덱이 여럿·덱 표식 이상
const D2 = `<div class="pf-deck" id="deck2">${[1, 2].map((k) => `<section class="pf-scene"><div class="lbl tl">D2-${k}-TOP</div><div class="lbl br">D2-${k}-BOT</div></section>`).join('')}</div>`;
add({ id: 'A21', grp: '덱 여럿', name: '두 번째 .pf-deck(덱 뒤, 장면 2)', od: 1, layout: (D) => `${D}${D2}`, forbidden: ['D2-1-TOP', 'D2-2-TOP'] });
add({ id: 'A22', grp: '덱 여럿', name: '두 번째 .pf-deck(덱 앞, 장면 2)', od: 1, layout: (D) => `${D2}${D}`, forbidden: ['D2-1-TOP', 'D2-2-TOP'] });
add({ id: 'A23', grp: '덱 표식 이상', name: '장면 2 안에 class="pf-deck" 요소(이름 재사용)', od: 0,
  scene: (k) => `<section class="pf-scene"><div class="lbl tl">S${k}-TOP</div>${k === 2 ? '<div class="pf-deck" style="position:absolute;left:300px;top:300px;font:20px Arial">MINI-DECK</div>' : ''}<div class="lbl br">S${k}-BOT</div></section>`,
  required: [{ text: 'MINI-DECK', page: 2 }] });
add({ id: 'A24', grp: '덱 표식 이상', name: '덱에 pf-deck 클래스 없음(<main id="deck">, mount는 #deck)', od: 0, deckTag: '<main id="deck">' });
add({ id: 'A25', grp: '덱 표식 이상', name: 'body가 덱(<body class="pf-deck" id="deck">)', od: 0, bodyAttrs: ' class="pf-deck" id="deck"', deckTag: '', deckClose: '' });
add({ id: 'A26', grp: '인쇄 전용', name: '덱 밖 인쇄 전용 머리글(화면 display:none, @media print display:block)', od: 0,
  layout: (D) => `<header class="print-only" style="${TX()}">PRINT-ONLY-HEADER</header>${D}`, css: '.print-only{display:none}@media print{.print-only{display:block}}',
  required: [{ text: 'PRINT-ONLY-HEADER', page: 0 }], printNote: '인쇄용으로 만든 내용 → 숨겨지면 조용한 손실' });
add({ id: 'A28', grp: '예외 표식', name: '덱 밖 연락처 바닥글에 렌더러식 data-pf-ui="chrome"(장면 안 바닥글 표식을 그대로 씀)', od: 1,
  layout: (D) => `${D}<footer class="pf-foot site" data-pf-ui="chrome" style="${TX()}background:#eee;padding:12px">CONTACT-FOOTER 010-0000-0000</footer>`, forbidden: ['CONTACT-FOOTER'],
  printNote: '키트 UI가 아닌 학생 내용인데 예외 목록 [data-pf-ui]에 걸림' });
add({ id: 'A29', grp: '시점', name: '덱 뒤 footer가 스크롤해야 나타남(IntersectionObserver로 opacity 0 → 1)', od: 1,
  layout: (D) => `${D}<footer id="rv" style="opacity:0;transition:opacity .3s;${TX()}background:#eee;padding:12px">REVEAL-FOOTER</footer>`,
  script: `new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.style.opacity = '1'; })).observe(document.getElementById('rv'));`,
  forbidden: ['REVEAL-FOOTER'], printNote: '사용자가 스크롤하면 보이는 내용. 감사 시점(맨 위)에는 opacity 0' });
add({ id: 'A27', grp: '덱 안 비장면', name: '장면 사이 hr·글자 있는 div(덱 바로 아래)', od: 2,
  wrap: (s, k) => (k === 2 ? `<hr style="border:0;border-top:4px solid #333;margin:0">${s}` : k === 3 ? `<div class="divider" style="${TX()}">DIVIDER</div>${s}` : s), forbidden: ['DIVIDER'] });

// ── W. 덱 조상의 상자(수정안 4가 :has(.pf-deck)로 남기는 요소) ──
const R = (style, D, pre = '', post = '') => `<div id="root" style="${style}">${pre}${D}${post}</div>`;
add({ id: 'W01', grp: '조상 상자', name: '#root padding 24px', layout: (D) => R('padding:24px', D) });
add({ id: 'W02', grp: '조상 상자', name: '.container margin:32px auto; max-width:1400px', layout: (D) => `<div class="container" style="margin:32px auto;max-width:1400px">${D}</div>` });
add({ id: 'W03', grp: '조상 상자', name: '#root min-height:100vh + flex column + header·footer 형제', od: 2,
  layout: (D) => R('min-height:100vh;display:flex;flex-direction:column', D, `<header style="${TX()}background:#333;color:#fff">W3-HEAD</header>`, `<footer style="${TX()}">W3-FOOT</footer>`), forbidden: ['W3-HEAD', 'W3-FOOT'] });
add({ id: 'W04', grp: '조상 상자', name: '.app height:100vh; overflow-y:auto(스크롤 컨테이너 감싸개)', layout: (D) => `<div class="app" style="height:100vh;overflow-y:auto">${D}</div>` });
add({ id: 'W05', grp: '조상 상자', name: '.shell position:fixed; inset:0; overflow:auto(앱 셸)', layout: (D) => `<div class="shell" style="position:fixed;inset:0;overflow:auto">${D}</div>` });
add({ id: 'W06', grp: '조상 상자', name: '#root border 1px', layout: (D) => R('border:1px solid #999', D) });
add({ id: 'W07', grp: '조상 상자', name: '#root display:grid; place-items:center; gap:40px + aside 형제', od: 1, layout: (D) => R('display:grid;place-items:center;gap:40px', D, `<aside style="${TX()}">W7-ASIDE</aside>`), forbidden: ['W7-ASIDE'] });
add({ id: 'W08', grp: '조상 상자', name: '#root display:flex(가로) + aside 240px + 덱 flex:1', od: 1,
  layout: (D) => R('display:flex', D, `<aside style="width:240px;flex:none;${TX()}">W8-ASIDE</aside>`), css: '#deck{flex:1}', forbidden: ['W8-ASIDE'] });

add({ id: 'W09', grp: '조상 상자', name: 'body display:flex column + align-items:center + min-height:100vh', css: 'body{display:flex;flex-direction:column;align-items:center;min-height:100vh}' });
add({ id: 'W10', grp: '조상 상자', name: 'body display:grid; place-items:center; min-height:100vh', css: 'body{display:grid;place-items:center;min-height:100vh}' });

// ── S. 덱 안 구조 ──
add({ id: 'S01', grp: '덱 안 래퍼', name: '장면마다 래퍼 div(스타일 없음)', wrap: (s) => `<div class="w">${s}</div>` });
add({ id: 'S02', grp: '덱 안 래퍼', name: '래퍼 하나가 장면 전부를 감쌈(.pf-deck > div.inner > 장면들)', deckTag: '<main class="pf-deck" id="deck"><div class="inner">', deckClose: '</div></main>' });
add({ id: 'S03', grp: '덱 안 래퍼', name: '장면마다 래퍼 + padding 8px', wrap: (s) => `<div class="w" style="padding:8px">${s}</div>` });
add({ id: 'S04', grp: '덱 안 래퍼', name: '장면마다 display:contents 래퍼', wrap: (s) => `<div style="display:contents">${s}</div>` });
add({ id: 'S05', grp: '덱 안 래퍼', name: 'display:contents 래퍼 안 장면 + 캡션', od: 3, wrap: (s, k) => `<div style="display:contents">${s}<p style="margin:0;${TX()}">CAP-${k}</p></div>`, forbidden: ['CAP-1', 'CAP-2', 'CAP-3'], printNote: 'OD04와 같은 계열(래퍼 안 비장면)' });
add({ id: 'S06', grp: '장면 안', name: '장면 2 안 position:sticky(인쇄돼야 함)',
  scene: (k) => `<section class="pf-scene"><div class="lbl tl">S${k}-TOP</div>${k === 2 ? `<div style="position:sticky;top:0;margin-top:200px;margin-left:300px;width:400px;background:#2F6FEB;color:#fff;${TX()}">STICKY-IN</div>` : ''}<div class="lbl br">S${k}-BOT</div></section>`,
  required: [{ text: 'STICKY-IN', page: 2, only: true }] });
add({ id: 'S07', grp: '장면 안', name: '장면 2 안 position:fixed(§9-4 금지, 수정안 4 범위 밖)',
  scene: (k) => `<section class="pf-scene"><div class="lbl tl">S${k}-TOP</div>${k === 2 ? `<div style="position:fixed;left:300px;top:300px;background:#2F6FEB;color:#fff;${TX()}">FIXED-IN</div>` : ''}<div class="lbl br">S${k}-BOT</div></section>`,
  required: [{ text: 'FIXED-IN', page: 2, only: true }] });
add({ id: 'S08', grp: '장면 안', name: '장면 2 안 <dialog open>(비모달)',
  scene: (k) => `<section class="pf-scene"><div class="lbl tl">S${k}-TOP</div>${k === 2 ? `<dialog open style="position:absolute;left:300px;top:300px;${TX()}">DIALOG-IN</dialog>` : ''}<div class="lbl br">S${k}-BOT</div></section>`,
  printNote: '§8-1 원문이 dialog를 숨김(수정안 4와 무관)' });
add({ id: 'S09', grp: '장면 안', name: '장면 2 안 dialog showModal()',
  scene: (k) => `<section class="pf-scene"><div class="lbl tl">S${k}-TOP</div>${k === 2 ? `<dialog id="dm" style="${TX()}">MODAL-IN</dialog>` : ''}<div class="lbl br">S${k}-BOT</div></section>`,
  script: 'document.getElementById("dm").showModal()', printNote: '§8-1 원문이 dialog를 숨김' });
add({ id: 'S10', grp: '장면 안', name: '장면 2 안 popover 열림',
  scene: (k) => `<section class="pf-scene"><div class="lbl tl">S${k}-TOP</div>${k === 2 ? `<div id="pp" popover style="${TX()}">POPOVER-IN</div>` : ''}<div class="lbl br">S${k}-BOT</div></section>`,
  script: 'document.getElementById("pp").showPopover()', printNote: '§8-1 원문이 [popover]를 숨김' });

// ── I. 안 보이는 것·경계(덱 밖) ──
add({ id: 'I01', grp: '안 보임', name: 'opacity:0 글자', layout: (D) => `${D}<p style="opacity:0;${TX()}">OPAQ0</p>` });
add({ id: 'I02', grp: '안 보임', name: 'visibility:hidden 10px(T09d)', layout: (D) => `${D}<div style="visibility:hidden;height:10px">VISH</div>` });
add({ id: 'I03', grp: '안 보임', name: 'display:none + hidden 속성', layout: (D) => `${D}<p style="display:none">DNONE</p><p hidden>HIDDENATTR</p>` });
add({ id: 'I04', grp: '안 보임', name: '크기 0(width·height 0 + overflow hidden)', layout: (D) => `${D}<div style="width:0;height:0;overflow:hidden">ZERO</div>` });
add({ id: 'I05', grp: '보임', name: 'aria-hidden="true"인데 보이는 장식 글자', od: 1, layout: (D) => `${D}<div aria-hidden="true" style="${TX()}">ARIA-HIDDEN-VISIBLE</div>`, forbidden: ['ARIA-HIDDEN-VISIBLE'] });
add({ id: 'I06', grp: '경계', name: '왼쪽 화면 밖 absolute(left:-9999px) 글자', layout: (D) => `${D}<div style="position:absolute;left:-9999px;top:0;${TX()}">OFF-LEFT</div>`, printNote: '어느 스크롤에서도 안 보임 → 0이 정답(sr-only 기법)' });
add({ id: 'I07', grp: '보임', name: '덱 뒤 아래쪽 멀리(margin-top:3000px) 글자', od: 1, layout: (D) => `${D}<p style="margin-top:3000px;${TX()}">FAR-BELOW</p>`, forbidden: ['FAR-BELOW'] });
add({ id: 'I08', grp: '보임', name: '오른쪽 멀리 absolute(left:2600px, 가로 스크롤로 보임)', od: 1, layout: (D) => `${D}<div style="position:absolute;left:2600px;top:100px;${TX()}">FAR-RIGHT</div>`, forbidden: ['FAR-RIGHT'] });
add({ id: 'I09', grp: '경계', name: '닫힌 오프캔버스 서랍(fixed, right:0, translateX(100%), 배경)', layout: (D) => `${D}<nav style="position:fixed;top:0;right:0;width:280px;height:100vh;transform:translateX(100%);background:#222;color:#fff;${TX()}">DRAWER</nav>` });
add({ id: 'I10', grp: '경계', name: 'color:transparent 글자', layout: (D) => `${D}<p style="color:transparent;${TX()}">TRANSPARENT-TEXT</p>` });
add({ id: 'I11', grp: '경계', name: '장면 1 뒤에 완전히 가려진 요소(z-index:-1)', layout: (D) => `<div style="position:absolute;left:40px;top:60px;width:300px;height:100px;z-index:-1;background:#0F0;${TX()}">COVERED</div>${D}` });
add({ id: 'I12', grp: '안 보임', name: 'sr-only 3종(clip rect 0 / clip-path inset(50%) / clip rect(1px…))', layout: (D) => `${D}<span style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0">SR1</span><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap">SR2</span><span style="position:absolute!important;clip:rect(1px,1px,1px,1px);height:1px;width:1px;overflow:hidden;word-wrap:normal">SR3</span>` });
add({ id: 'I13', grp: '안 보임', name: 'font-size:0 글자', layout: (D) => `${D}<p style="font-size:0">FS0</p>` });
add({ id: 'I14', grp: '안 보임', name: '빈 간격 div 200px + br + 빈 p', layout: (D) => `<div style="height:200px"></div><br><p></p>${D}` });
add({ id: 'I15', grp: '경계', name: 'clip-path:inset(0 0 100% 0)로 완전히 잘린 글자', layout: (D) => `${D}<p style="clip-path:inset(0 0 100% 0);${TX()}">CLIPPED-ALL</p>` });
add({ id: 'I16', grp: '안 보임', name: 'visibility:hidden 큰 하위 트리(노드 3000개) — 감사 시간', layout: (D) => `${D}<div style="visibility:hidden;position:absolute;top:0;left:0">${'<span>x</span>'.repeat(3000)}</div>` });
add({ id: 'I17', grp: '경계', name: 'body white-space:pre-line(태그 사이 줄바꿈이 빈 줄로)', css: 'body{white-space:pre-line}', layout: (D) => `\n\n\n${D}\n\n\n` });

// ── K. 키트 UI·라이트박스(덱 밖) ──
add({ id: 'K06', grp: '키트 UI', name: '라이트박스 dialog.lightbox 열림(assets/common.js 구조)', od: 0,
  script: `const d = document.createElement('dialog'); d.className = 'lightbox'; d.innerHTML = '<img src="${svgData('#2F6FEB', 300, 150)}" alt=""><p>LB-CAPTION</p>'; document.body.appendChild(d); d.showModal();`, forbidden: ['LB-CAPTION'] });
add({ id: 'K07', grp: '키트 UI', name: '.pf-lightbox div 열림(fixed 오버레이)', od: 0,
  layout: (D) => `${D}<div class="pf-lightbox" style="position:fixed;inset:0;background:rgba(0,0,0,.8);display:grid;place-items:center"><p style="color:#fff;${TX()}">PFLB-CAPTION</p></div>`, forbidden: ['PFLB-CAPTION'] });
add({ id: 'K08', grp: '키트 UI', name: '학생 모달 div.modal.is-open(키트 표식 없음)', od: 1,
  layout: (D) => `${D}<div class="modal is-open" style="position:fixed;inset:0;background:rgba(0,0,0,.8);display:grid;place-items:center"><p style="color:#fff;${TX()}">STUDENT-MODAL</p></div>`, forbidden: ['STUDENT-MODAL'], printNote: '키트 UI 아님 → 잡혀야 함' });
add({ id: 'K09', grp: '키트 UI', name: 'data-pf-ui 토스트(fixed, 글자)', od: 0,
  layout: (D) => `${D}<div data-pf-ui="toast" style="position:fixed;left:16px;bottom:16px;padding:8px;background:#333;color:#fff;${TX()}">PFUI-TOAST</div>`, forbidden: ['PFUI-TOAST'] });

// ── 쪽 HTML ──
const BASE = `:root { --bg: #DFE9FF; }
body { font-family: Arial, sans-serif; color: #111; }
.lbl { position: absolute; font: 700 28px/1.2 Arial, sans-serif; color: #111; margin: 0; }
.tl { left: 12px; top: 8px; } .br { right: 12px; bottom: 8px; }`;
const defScene = (k) => `<section class="pf-scene"><div class="lbl tl">S${k}-TOP</div><div class="lbl br">S${k}-BOT</div></section>`;

function pageHtml(t, { kitCss, query = '', gate = null } = {}) {
  const scenes = Array.from({ length: t.n }, (_, i) => { const k = i + 1; const s = (t.scene || defScene)(k); return t.wrap ? t.wrap(s, k) : s; }).join('\n');
  const deckTag = t.deckTag ?? '<main class="pf-deck" id="deck">';
  const deckClose = t.deckClose ?? (deckTag ? (deckTag.startsWith('<main') ? '</main>' : '</div>') : '');
  const D = `${deckTag}${scenes}${deckClose}`;
  const inner = (t.layout || ((x) => x))(D);
  const gateJs = gate === 'track' ? 'PFScene.track(new Promise((r) => { window.__release = r; }));' : '';
  const mountJs = gate === 'nomount' ? '' : "PFScene.mount({ deck: '#deck' });";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>fix4 ${t.id}</title>
<script src="/spikes/r0/kit/scene-kit.js"></script>
<link rel="stylesheet" href="${kitCss}">
<style id="fx-base">${BASE}</style>
<style id="fx-trap">${t.css || ''}</style>
${t.head || ''}</head><body${t.bodyAttrs || ''}>${inner}
<script>${t.preMount || ''}${gateJs}${mountJs}</script>
${t.script ? `<script>${t.script}</script>` : ''}
</body></html>`;
}

module.exports = { FIXTURES: T, pageHtml, svgData };
