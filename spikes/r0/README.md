# R0 통합 시험대 (spikes/r0)

`docs/design/01-scene-layout-print.md`(이하 01)의 **통합 설계**를 실제 샘플 데이터로 돌려 보는 실험장입니다.
R0 스파이크(A2~A4 등)는 모두 이 시험대 위에서 측정합니다. 제품 코드가 아니며, 레포의 렌더러(`index.html`, `project.html`, `assets/`)와
데이터(`data/`, `src/`)는 **읽기만** 하고 고치지 않습니다.

- 대상 브라우저: Windows의 Chrome·Edge(보장 범위 Q1-b). 하네스는 헤드리스 Chrome·Edge를 CDP로 조종합니다.
- 산출물(PDF·PNG·JSON 결과)은 `out/`에 쌓이고 커밋하지 않습니다(`.gitignore`).

## 빠른 시작

PowerShell에서 레포 루트(`C:\Users\user\portfolio-test`)를 기준으로 실행합니다. **Git Bash에서는 Edge의 파이프 연결이 끊겨** Edge가 바로 종료되므로 쓰지 않습니다.

```powershell
# A1 기준선: 페이지 5개 × Chrome·Edge × 배경 끔·켬(+ 상세는 "요약만") → out/a1-baseline.md, out/a1-baseline.json, out/a1/*.pdf
node spikes/r0/harness/run-all.js
node spikes/r0/harness/run-all.js --browser chrome --only 0-Tidy-Mommy --tag tidy   # 한 페이지만, 결과 이름 바꾸기
node spikes/r0/harness/run-all.js --viewport 1366x633@1                          # 화면 뷰포트(배율 k)를 바꿔서

# 포트를 바꿔서(다른 실행과 동시에 돌릴 때). run-all.js·eval.js·od-probe.js·a3/traps.js가 --port를 받음
node spikes/r0/harness/run-all.js --tag fix4 --port 4631

# 결정 #14 화면 감사(outside-deck)의 실제 페이지 오탐·양성 대조 → out/od-probe.json
node spikes/r0/harness/od-probe.js

# 페이지 몇 개만 검사(결과 out/check/report.json)
node spikes/r0/harness/scene-print-check.js --browser both "spikes/r0/pages/project.html?p=0-Tidy-Mommy"

# 디버그: 준비(yes)까지 기다린 뒤 JS 식 평가 / 화면 캡처
node spikes/r0/harness/eval.js "spikes/r0/pages/index.html" "PFScene.report()"
node spikes/r0/harness/eval.js --viewport 375x812@3 --mobile 1 --shot spikes/r0/out/m.png "spikes/r0/pages/project.html?p=00-example-crafting"

# PDF 쪽 모아 보기(PNG)
python -I spikes/r0/harness/contact-sheet.py spikes/r0/out/a1/chrome__0-Tidy-Mommy__bg0.pdf spikes/r0/out/sheet.png 4 1 16
```

브라우저에서 직접 보려면 레포 루트를 서버로 열고 `http://127.0.0.1:4621/spikes/r0/pages/index.html`,
`…/project.html?p=<src 폴더 이름>`으로 들어갑니다(예: `py -m http.server 4621 --bind 127.0.0.1`).
하네스는 같은 포트에 자체 읽기 전용 서버를 띄우므로 동시에 쓰지 않습니다.

## 파일 지도

| 파일 | 내용 | 01 근거 |
|---|---|---|
| `kit/scene-kit.css` | ① §8-1 원문(글자 그대로) ② 시험대 추가: **A3 인쇄 수정 블록**(`@page size !important`, 인쇄 html·body 높이·overflow 초기화, 장면 box-sizing·position 고정 — 인쇄에만 영향), **【R0 결정 #14】 수정안 4**(인쇄에서 덱 밖·덱 안 비장면 요소 숨김), 측정용 컨테이너, HUD, 건너뛰기 링크, `#pf-audit`, A2용 zoom 실험 훅 | §8-1, §6-2, §7-3 |
| `kit/scene-kit.js` | 블록 A: §8-2 준비 게이트 원문(바꾼 곳 【시험대 1~5】) / 블록 B: `fit()`, `mount()`, HUD, 키보드·딥 링크, 인쇄 범위·번호 다시 계산, `audit()`(+ **【R0 결정 #14】 화면 매체 감사 `outside-deck`**), `report()`(`outsideDeck`·`media`), `?pf-audit=1`, `renderMermaid()` | §7-1·7-2, §8-2~8-4, §9-3 |
| `pages/index.html`, `pages/landing.js` | 랜딩 L1 표지 → L2 기술 스택 → L3 카드 → L4 한눈에 보기 표 → L5 링크 | §5-1, §4 |
| `pages/project.html`, `pages/project.js` | 상세(`?p=<id>`) P1 → P2 목차 → P5 → P3 → P4 → P6 → 기술 문서 D 장면. 문서 파이프라인(§6-2 준비 단계 3~9)과 구간별 분할·재시도 | §5-2(Q7), §6 |
| `pages/paginator.js` | 분할기. 프로토타입 `ScenePager`를 형제 구조(감싸개 없음)로 옮김 + force 결과 정의(잘림 띠) | §6-3·6-4 |
| `pages/pf-common.js` | 공통 유틸(지금 렌더러 규칙: 이스케이프·경로·슬러그), 장면 틀, 측정 후 고르기 `pack()`, 원칙 5 축소·잘림 띠 | §3-2, §4-3 |
| `pages/pf-scenes.css` | 렌더러 CSS(portfolio.css 자리): 토큰, 격자(§3-1), 템플릿, 문서 타이포. 인쇄 규칙 없음 | §2-2, §3, §4 |
| `harness/lib/cdp.js` | CDP 연결(의존성 0). `--remote-debugging-pipe`라 TCP 디버그 포트를 열지 않음. 프로필은 `%TEMP%\r0-*`에 만들고 지움 | §11-1 |
| `harness/lib/server.js` | 127.0.0.1 읽기 전용 정적 서버(포트 4621). `delay`·`block` 훅(느린 응답·글꼴 차단 시험용) | §11-1 |
| `harness/scene-print-check.js` | 페이지 검사: 준비 대기 → **화면 매체 감사 outside-deck(T1, 인쇄 전)** → 화면 배치(형제 + 여백 보정) → 인쇄 매체 DOM 감사(T1) → PDF 배경 끔·켬(T2) → "요약만"(화면 감사 한 번 더 + PDF, T8 일부) → 깊은 검사(T3) → 장면 나눔 서명(T5) | §11-2 |
| `harness/pdf-deep.py` | PyMuPDF: 쪽 수·쪽 크기·빈 쪽·쪽 밖 글자·브라우저 머리글/바닥글(날짜·URL·"1/12"·제목)·장면 표식·바닥글 인쇄 번호 | §11-2 T2·T3 |
| `harness/run-all.js` | A1 기준선 실행기 + 머리글 검출기 양성 대조 + Chrome·Edge 서명 비교. 표에 "덱 밖(화면, 전체/요약만)" 열. `--tag`·`--port` | — |
| `harness/od-probe.js` | 【R0 결정 #14】 화면 감사 outside-deck의 실제 페이지 오탐 검사(HUD 옆·알약, 건너뛰기 링크 포커스, `?pf-audit=1` JSON)와 양성 대조(`<p>`·글자 노드·`body::after`·고정 바), 인쇄 매체에서 0인지. 결과 `out/od-probe.json` | §9-3, §11-2 T1 |
| `harness/eval.js`, `harness/contact-sheet.py` | 디버그 도구(`eval.js --port`) | — |
| `harness/fixtures/hf-control.html` | 머리글·바닥글 검출기 양성 대조 페이지(키트 없음) | — |
| `a3/` | A3 인쇄 레시피 재시험: `traps.js`(함정 102종 = A3 92종 + 결정 #14 화면 감사 시험 OD01~OD10, × Chrome·Edge × 배경 × preferCSSPageSize, `--kit`로 다른 키트 CSS, `--port`. 화면 감사 outside-deck도 판정에 씀), `real-pages.js`("요약만"·번호·배경 끔, `--kit-file`), `band.js`(잘림 띠), `a3-pdf.py`(PDF 분석), `server.js`(127.0.0.1:4623, rewrite 훅), `variants/`(`scene-kit.orig.css` A3 전 키트, `scene-kit.deckonly.css` 수정안 4 원 사본, `scene-kit.fix123.css` 결정 #14 반영 직전 공유 키트), `fixtures/clip-band.html`. 결과 `out/a3/` | §8-1·§8-4·§8-5 |

## 시험 훅(쿼리 문자열)

| 쿼리 | 효과 | 쓰는 곳 |
|---|---|---|
| `?pf-timeout=<ms>` | 준비 게이트 timeout(기본 20000) | T7·A4 |
| `?pf-k=<수>` | 화면 배율 k 고정 | T14·A2 |
| `?pf-scale=zoom` / `hybrid` | transform 대신 zoom(hybrid는 k ≥ 1.1일 때만). **미검증 실험 훅** | A2 |
| `?pf-scope=summary` | 처음부터 "요약만" 인쇄 범위 | T8 |
| `?pf-audit=1` | 준비가 yes·timeout이 되면 `{ready, scenes, printScenes, audit, outsideDeck, media, timing, …}` JSON을 base64로 `<pre id="pf-audit">`에 씀(화면 매체에서 쓰므로 `outsideDeck`가 들어감) | §9-3, R0 ⑥ |

페이지 안 API(콘솔·CDP): `PFScene.ready`, `whenReady()`, `track(p)`, `mount()`, `refresh()`, `go(i)`, `print()`, `printAnyway()`,
`setScope('all'|'summary')`, `audit()`, `sceneIssues(el, {layoutOnly})`, `report()`, `refUrl(id)`, `k`, `count`, `scope`,
`_t`(mount·timeout·ready 시각, 탐색 시작 기준 ms), `_eager`(게이트의 데스크톱 판정), `info`(렌더러 통계: 분할·재시도·채움·글자 보존·Mermaid 실효 글자 등).

## 통합 설계 대비 구현 범위(요약 — 자세한 표는 `docs/design/R0-results.md`가 생기면 그쪽)

- **그대로 구현**: §8-1 CSS 원문, §8-2 게이트(timeout 회복·mount 대기 포함), §7-1 형제 + 여백 보정 transform, §7-2 `fit()`(단일 모드, 상한 1.5, 하한 없음),
  §8-4 "요약만"(`.pf-skip`) + 인쇄 번호·교차 참조 다시 계산(인쇄 집합 밖은 URL 글자), §6-3 분할(H2 엄격, soft 0.8, keep 0.35, 구간 재시도, 짧은 장 이어 붙이기 40%),
  §6-4 블록 규칙(코드 줄 분할·"계속", 표 행 분할·머리행 반복, 그림·도식 비분할 축소), force → 잘림 띠, §6-1 글자 보존 검사, §6-2 Mermaid `render()` + 촘촘한 설정,
  D2Coding 실제 로드, Q7 장면 순서, P2 목차(R1.5 항목이지만 시험대에 포함), `?pf-audit=1`.
- **줄이거나 뺀 것**: 발표 모드·전체 화면, 브라우저 확대 보완안, 실행 중 넘침 감시(ResizeObserver)와 다시 나누기, 늦은 글꼴 `loadingdone` 재분할, `selfTest()`, `flow()`, `fetchData()`,
  스타일 엔진(`applyStyle`·theme.css·변형 축), 회전 안내, 경고 문구 일부(대체 글꼴·localhost 링크), 원칙 5 ①의 "필드 안 줄 단위 분할"(필드 경계 분할만),
  `media` w×h(Q12 빌드 미구현 → 이미지를 받아서 크기를 잼), L2 `stack` 구성, P1 "커버 없음 → 메타 2단" 변형.

## 알려진 함정(시험대를 쓰는 사람에게)

- 01 §8-2 원문의 `Object.assign(…, { get ready() {…} })`는 getter를 실행한 값('no')을 복사해 `PFScene.ready`가 영원히 'no'가 됩니다. 시험대는 `defineProperty`로 고쳤습니다(【시험대 2】).
- 헤드리스 Chrome·Edge는 `matchMedia('(pointer: fine)')`가 true입니다(모바일 에뮬레이션을 켜도 true). lazy 유지 경로(폰)를 시험하려면 따로 에뮬레이션이 필요합니다.
- 헤드리스 창에도 클래식 스크롤바(15px)가 있어 `root.clientWidth`가 뷰포트보다 15px 작습니다(예: 960×1000에서 k = 0.738, 01 §2-3 표의 0.75와 다름).
- 페이지는 `spikes/r0/pages/`에 있으므로 데이터 경로는 `../../../data`, `../../../src`입니다.
- 헤드리스에서 폰 경로(lazy 유지)는 `Emulation.setTouchEmulationEnabled`(→ `pointer: coarse`)와 `Emulation.setDataSaverOverride`(→ `saveData`)로 켜집니다. `setEmulatedMedia`의 `pointer` 기능은 받아들이지만 효과가 없습니다(A4).
- 헤드리스 브라우저 하나에 페이지를 여러 개 열면 **마지막에 만든 페이지만 visible**이고 나머지는 hidden(rAF 멈춤)입니다(A4 probe).

## A4가 키트에 고친 곳(`kit/scene-kit.js`)

- 【시험대 4】 `beforeprint`: `data-pf-print-anyway`면 건너뜀, `yes`일 때만 `no`로 내림(원문은 `timeout`도 `no`로 내려 [그래도 인쇄]가 항상 안내 쪽이 되고 HUD 경고가 사라졌음).
- 【시험대 5】 `printAnyway()`: mount 전이면 속성을 붙이지 않음(원문대로면 빈 쪽 1장).
- 블록 B `print()`: mount 전(`deck` 없음)에 불려도 예외 없이 `yes`를 기다림.
- 고치기 전 블록 A 대조본: `harness/a4/scene-kit.before-a4.js`. A4 하네스·결과: `harness/a4/`, `out/a4/`.

## 결정 #14(수정안 4 채택)가 키트·하네스에 고친 곳

유지관리자 결정(2026-10-22): A3 수정안 4를 채택하고, 그 대가인 "덱 밖 내용이 PDF에서 조용히 빠짐"을 **화면 매체 감사**로 알립니다(01 §1-4 ①).

- `kit/scene-kit.css` 【R0 결정 #14】: 인쇄에서 `:is(body, body :has(.pf-deck)) > :not(.pf-deck, :has(.pf-deck))`와 `.pf-deck > :not(.pf-scene, :has(.pf-scene))`를 `display:none !important`. 수정 1~3은 그대로입니다.
- `kit/scene-kit.js` `audit()` 【R0 결정 #14】: **화면 매체에서만**(`matchMedia('print')`가 아닐 때) `type: 'outside-deck'` 항목을 더합니다. 인쇄 매체 감사는 바꾸지 않았습니다(`.pf-skip` 상자 오탐도 그대로).
  - 대상: 덱 조상(body … 덱 부모)의 자식 중 덱을 품지 않은 것, 덱·래퍼(장면을 품은 덱 안 요소)의 자식 중 장면도 래퍼도 아닌 것, 그 자리의 **글자 노드**, 덱 조상·덱·래퍼의 `::before`/`::after`(content가 빈 문자열이 아닐 때).
  - "보임": `display ≠ none`, `checkVisibility({opacityProperty, visibilityProperty})`(조상 opacity 포함), 넓이 > 0이고 문서 음수 좌표 밖이 아닌 상자, 실제로 칠하는 것(글자·대체 요소·배경·테두리·그림자·외곽선)이 있음. `visibility:hidden` 부모 안에서 `visible`로 되살아난 자식, `display:contents` 안 글자도 찾습니다. `clip:rect(0…)`·`clip-path:inset(50%)`·1px 이하 overflow 상자(sr-only) 안은 안 보임으로 칩니다.
  - 예외(키트 UI·명시적 화면 전용): `[data-pf-ui]` 하위, `.pf-screen-only`, `.pf-hud`, `.pf-skiplink`, `#pf-audit`, `.pf-measure`, `dialog.lightbox`·`.pf-lightbox`, script·style·link·meta·template·noscript·head·title·base, 닫힌 dialog·popover, 게이트 안내 문구.
  - 항목: `{ type: 'outside-deck', el: 'tag#id.class', text: 앞 40자, why: 글자|배경색|img|::after…, pos: 덱 앞|덱 뒤|덱 안|덱 조상, detail }`. `report().outsideDeck` = 그 수(인쇄 매체에서는 0), `report().media`.
- `harness/scene-print-check.js` T1: 준비 직후·인쇄 전에 `PFScene.report()`의 outside-deck를 `where: 'screen'` 문제로 넣고(하나라도 있으면 FAIL), "요약만"으로 바꾼 뒤에도 한 번 더 봅니다(`where: 'screen-summary'`). `rep.outsideDeck`·`rep.outsideDeckSummary`.
- `a3/traps.js`: `outsideExpect` 함정(T09c·T11a~d·T12a·b·OD01~04·06~10)은 모든 브라우저에서 잡혀야 하고, 인쇄가 통과하면 판정이 **"계약 위반 감지"**가 됩니다. 나머지는 0이어야 하며 아니면 "FAIL(화면 감사 오탐)"입니다.
- 결과: `out/a3/traps-fix4.md`(최종 키트), `out/a3/traps-fix123-audit.md`(반영 전 CSS + 새 감사), `out/a3/fix4-compare.md`(비교), `out/fix4.md`(실제 페이지 10/10), `out/od-probe.json`.
- **알아 둘 점**
  - 수정안 4가 **숨기지 못하는 것**: body·덱 바로 아래 글자 노드(OD01·OD09), `body::after` 생성 글자(OD02), 래퍼 안 장면 옆 요소(OD04). 이것들은 여전히 쪽이 늘어나 인쇄 감사(doc-height)가 잡고, 화면 감사도 잡습니다.
  - T09d(덱 뒤 `visibility:hidden` 10px)는 화면에서도 안 보이므로 감사 대상이 아닙니다(빠지는 내용 없음).
  - `.topbar`는 §8-1 숨김 목록에 있지만 키트 UI 표식이 아니므로 **잡습니다**(T11a·T12a). 화면 전용으로 두려면 `.pf-screen-only`나 `data-pf-ui`를 붙입니다. 열린 dialog·popover(키트 라이트박스 제외)도 잡습니다(T11b·T11c).
  - `color: transparent` 글자, 다른 요소에 완전히 가려진 요소는 "보임"으로 칩니다(미확인: 실제 custom 페이지에서 생기는지).
