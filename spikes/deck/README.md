# 슬라이드 덱 샘플 B (spikes/deck)

포트폴리오 페이지를 **발표 슬라이드 덱**(한 번에 16:9 한 장)으로 보여 주면 어떤지 비교하려고 만든 샘플입니다. 제품 코드가 아니며 커밋 대상도 아닙니다. 비교 대상은 셋입니다.

| 이름 | 무엇 | 위치 |
|---|---|---|
| A0 | 지금 배포 중인 렌더러(긴 스크롤 문서) | 레포 루트 `index.html`, `project.html`, `assets/` |
| A1 | R0 통합 시험대: 1280×720 장면을 세로로 쌓고 휠로 스크롤 | `spikes/r0/pages/` |
| **B** | 이 샘플: 같은 장면을 **한 장씩 넘기는 덱**(기본) + 같은 테마의 **스크롤 보기** | `spikes/deck/pages/` |

- 내용은 A1과 같은 원천(`data/portfolio.json`, `data/projects/*.json`, `src/<id>/기술문서.md`)만 씁니다. 새 문장·수치는 만들지 않았습니다(장면 이름·라벨 같은 UI 글자만 더함).
- 레포의 `data/`, `src/`, `profile.md`, 배포 렌더러, `spikes/r0/`는 **읽기만** 했습니다. R0 파일은 복사해서 고쳤습니다(아래 파일 지도).
- 시각 체계는 가이드 발표 덱 46장(https://koohoo-dev.github.io/portfolio-guide/slides/deck.html)을 따랐습니다. 그 덱을 연구한 결과(PNG·PDF·측정 JSON)는 `out/ref/`에 있습니다.

## 여는 법

`fetch()`로 데이터를 읽으므로 파일을 더블클릭하면 열리지 않습니다. **레포 루트**에서 로컬 서버를 띄웁니다.

```powershell
# 레포 루트(C:\Users\user\portfolio-test)에서
python -m http.server 4600 --bind 127.0.0.1      # python이 없으면 py -m http.server 4600 --bind 127.0.0.1
```

- 랜딩 덱: http://127.0.0.1:4600/spikes/deck/pages/index.html
- 프로젝트 덱: http://127.0.0.1:4600/spikes/deck/pages/project.html?p=0-Tidy-Mommy (`1-action-platformer`, `2-Yggdrasil`)
- 스크롤 보기로 바로 열기: `…/project.html?p=0-Tidy-Mommy&view=scroll`
- A1과 나란히 보기: `…/spikes/r0/pages/project.html?p=0-Tidy-Mommy`

### 주소 옵션

| 주소 | 효과 |
|---|---|
| `?view=deck`(기본) · `?view=scroll` | 한 장씩 넘기기 / 세로로 쌓아 스크롤(A1 방식, 같은 테마). HUD 버튼으로 바꾸면 주소도 같이 바뀜 |
| `#n` | n번째 장(1부터). `#0`·`#-3` → 1장, `#99` → 마지막 장. 모르는 값(`#abc`)은 무시하고 주소를 지금 장 번호로 바로잡음 |
| `#s=<제목 id>` | 그 제목(기술 문서 H2·H3의 GitHub식 id)이 있는 장. 목차·"원문에서 자세히" 링크가 이 형식. A1의 `#s-n`도 받음 |
| `?wheel=1` | 덱 보기에서 휠 = 다음/이전(**기본은 꺼짐**). 몸짓 하나(200ms 이상 쉬면 끝)에 한 장만 넘김 |
| `?dividers=appendix`(기본) · `all` · `none` | 섹션 디바이더: 부록 앞 하나 / 요약 구간마다 / 없음 |
| `?pf-scope=summary`, `?pf-timeout=`, `?pf-k=`, `?pf-audit=1` | R0 시험 훅 그대로 |

## 조작

| 동작 | 덱 보기 | 스크롤 보기 |
|---|---|---|
| 다음 | `→` `↓` `Space` `PageDown`, HUD `›`, 장면 오른쪽 70% 클릭·탭, 왼쪽으로 스와이프 | `→` `Space` `PageDown`, HUD `›`, 휠·스크롤 |
| 이전 | `←` `↑` `Shift+Space` `PageUp`, HUD `‹`, 장면 왼쪽 30% 클릭·탭, 오른쪽으로 스와이프 | `←` `Shift+Space` `PageUp`, HUD `‹` |
| 처음·끝 | `Home` · `End` | 같음 |
| 개요(모든 장 격자) | `O` 또는 HUD `▦ 개요` → 화살표로 고르고 `Enter`, 닫기 `Esc`·바깥 클릭 | 같음 |
| 전체 화면 | `F` | 같음 |
| PDF | HUD `[PDF로 저장]` 또는 `Ctrl+P` → 대상 "PDF로 저장" | 같음(어느 보기든 PDF는 같음) |
| 요약만 인쇄 | HUD `[요약만]`(프로젝트 덱) — 기술 문서 부록·목차·부록 디바이더를 PDF에서 뺌 | 같음 |
| 보기 전환 | HUD `[스크롤로 보기]` | HUD `[슬라이드로 보기]` |

- 링크·버튼 위 클릭, 글자를 고른 상태의 클릭은 넘기지 않습니다. 손가락으로 확대한 상태(`visualViewport.scale > 1`)에서는 스와이프로 넘기지 않습니다.
- 키보드·장면 클릭으로 넘기면 포커스가 새 장면(이름 = "n / N · 섹션 · 제목")으로 가고, HUD 버튼으로 넘기면 포커스는 버튼에 남고 `aria-live`로 알립니다. 덱 보기에서 보이지 않는 장은 `inert`라 Tab·찾기에서 빠집니다.
- 키보드로 넘길 때는 방문 기록을 남기지 않고(`replaceState`), 목차·원문 링크·개요로 **건너뛸 때만** 기록을 남깁니다(`pushState`) → 브라우저 "뒤로"가 건너뛰기 전 장으로 돌아갑니다.
- `prefers-reduced-motion: reduce`면 장 전환 페이드(0.18초)와 부드러운 스크롤을 끕니다.

## 파일 지도

| 파일 | 내용 | R0와의 관계 |
|---|---|---|
| `kit/scene-kit.css` | 장면 계약 + **인쇄 레시피**(01 §8-1 원문, A3 수정 1~3, 【R0 결정 #14】 덱 밖 숨김) | `spikes/r0/kit/scene-kit.css`와 **바이트까지 같음** |
| `kit/deck-kit.js` | 블록 A 준비 게이트(R0 그대로) + 블록 B 덱 키트(새로 씀): 두 보기, 배율, HUD 띠, 키보드·클릭/탭·스와이프·(선택) 휠, hash, 개요 dialog, 포커스·aria-live, 줄인 움직임, `print()`, `audit()`(R0 감사 그대로 + 덱 보기의 숨긴 장 예외 한 곳), A2 이동 수정 ①② | `spikes/r0/kit/scene-kit.js` 복사 후 블록 B 교체 |
| `kit/deck-kit.css` | 화면 전용 규칙: 덱 보기(고정 무대, 지금 장만 보임), 스크롤 보기 보정, HUD 띠, 개요 격자 | 새로 씀(R0 HUD 규칙을 덮어씀) |
| `pages/index.html`, `pages/landing.js` | 랜딩 덱 L1 표지 → L2 기술 스택 → L3 프로젝트 → L4 한눈에 보기 → L5 연락처 | A1과 같은 내용·순서, 장면 모양만 바꿈 |
| `pages/project.html`, `pages/project.js` | 프로젝트 덱(Q7): 표지 → 목차 → 스크린샷 → 핵심 구현 → 이슈 해결 → 회고 → (부록 디바이더) → 기술 문서 부록 | 문서 준비·분할 단계는 R0 그대로, 요약 장면은 다시 짬 |
| `pages/paginator.js` | 기술 문서 분할기(Q8 코드 규칙: 넘치면 줄 단위로 나누고 "다음 장에 계속 ↓ / 이어서 ↑") | R0와 같음(머리말 주석만 다름) |
| `pages/pf-common.js` | 공통 유틸, 장면 틀 `scene()`(참고 덱 머리 + 'bare' 종류 + 섹션명) | R0 복사 후 `scene()`만 바꿈 |
| `pages/deck-theme.css` | 장면 테마: 참고 덱 색 토큰·글자 단계·모티프(eyebrow/rlabel, pill, banner, chip, card, labelchip→arrow, note, callout, mini 표, dotrule, bignum), 장면 템플릿, 문서 타이포, hljs 색 | R0 `pf-scenes.css` 자리(새로 씀) |
| `harness/b-check.js` | 자체 점검(아래). 결과 `out/b-check.md`·`out/b-check.json`, PDF `out/b/pdf/`, 화면 `out/b/views/` | 새로 씀(R0 AUDIT_DOC·MARK 식 재사용) |
| `harness/shot.js` | 디버그: 페이지를 열어 보고서 요약 + 장면 PNG(`out/dbg/`) | 새로 씀 |
| `harness/pdf-compare.py` | 두 PDF 비교(쪽마다 글자, `--visual` 그림 차이) | 새로 씀 |
| `harness/pdf-deep.py`, `harness/contact-sheet.py`, `harness/lib/cdp.js`, `harness/lib/server.js` | PDF 깊은 검사, 모아 보기 PNG, CDP 연결, 읽기 전용 서버 | R0 복사(cdp.js는 프로필 접두 `deck-`, contact-sheet.py는 배율 인자 추가) |
| `out/` | 산출물(커밋 안 함, `.gitignore`). `ref/` = 참고 덱 연구, `b/` = B 점검, `dbg/` = 디버그 PNG | — |

## A1과 다른 점

| 항목 | A1(R0 시험대) | B(이 샘플) |
|---|---|---|
| 넘기는 방식 | 세로로 쌓은 장면을 휠로 스크롤 | **기본 = 한 장씩**(덱). `?view=scroll`·HUD로 A1 방식 전환(같은 DOM, 화면 CSS만 다름) |
| 배율 | `k = min(vw/1280, (vh−32)/720)`, 상한 1.5 | 덱: `k = min(vw/1280, (vh−44)/720)`, 상한 없음(발표 모드와 같음). 스크롤: A1 식에서 HUD 44px를 더 뺌, 상한 1.5 |
| HUD | 오른쪽 옆 세로 / 알약(이전·다음·n/N·요약만·PDF) | 아래 44px 띠(참고 덱): ‹ › · "03 / 46" · 섹션명 · 진행 막대 · 개요 · 요약만 · PDF로 저장(쪽 수) · 보기 전환. 두 보기 공통 |
| 주소 | `#s-n`(go 때만 갱신) | `#n`(항상 지금 장), `#s=<id>`, `#s-n` 호환. 잘못된 hash는 바로잡음 |
| 개요 | 없음 | 모든 장 축소 격자(dialog, 섹션별 묶음, 지금 장 표시) |
| 터치 | 스크롤만 | 탭 구역 + 스와이프 |
| 요약 장면 | 핵심 구현·이슈 해결을 한 장에 여러 개(3·2·1단 변형) | **한 장에 한 항목**(라벨칩 → 설명 / 문제 → 원인 → 해결 → 결과 흐름 + 배운 점). 넘치면 A1과 같은 원칙 5(촘촘 변형 → 필드 경계 이어짐 → 축소 → 잘림 띠) |
| 목차 | 요약 구간 + 문서 H2·H3, 여러 장으로 나뉠 수 있음 | 참고 덱 "CONTENTS": 요약 구간(번호·항목 수) │ 문서 H2 장, 한 장(넘치면 촘촘 → 축소). **H3는 뺌** |
| 디바이더 | 없음 | 부록 앞 1장(인디고 전면 + bignum + 장 목록 카드). `?dividers=all|none` |
| 테마 | R0 기본(강조색 = `profile` 강조색 #2F6FEB) | 참고 덱 인디고 체계(#5B6AD0). **profile 강조색은 적용하지 않음** |
| 인쇄 | R0 레시피 | **같은 파일**(scene-kit.css). 덱 보기·스크롤 보기 어디서 인쇄해도 같은 PDF |

장면 수(1920×945, Chrome = Edge): 랜딩 5 / 5, Tidy 49 → **52**, Switch Strike 75 → **80**, 이그드라실 74 → **79**(A1 → B). 늘어난 몫은 한 장 한 항목(+2~3), 부록 디바이더(+1), 문서 장면 차이(0~+2, 본문 상자 1152×590 → 1136×584와 글자 단계 차이)입니다. "요약만" PDF는 Tidy 8 → 11, Switch Strike 6 → 10, 이그드라실 7 → 10쪽입니다.

## 참고 덱에서 가져온 것 · 고친 것

- **가져옴**: 1280×720 무대 + `k = min(…)` 레터박스, 아래 HUD 띠(번호 두 자리·섹션명·진행 막대), `#n` 주소, ←/→/Space/PageUp/PageDown/Home/End, 색 토큰·글자 단계·모티프, 레이아웃 A(표지·맺음)·B(목차)·C(디바이더)·E(카드 격자)·H(그림 나란히)·I(라벨칩 → 설명)·K(회고)·mini 표·Note·callout.
- **고침**
  - 코드 블록: 고정폭 글꼴(D2Coding을 실제로 불러옴) + `white-space: pre-wrap`(참고 덱은 가변폭 글꼴로 그려지고 들여쓰기가 사라짐). 코드는 Q8대로 "코드 위·'왜' 아래", 넘치면 장을 나눔.
  - React + 브라우저 안 Babel·버전 없는 CDN → 바닐라 JS, CDN은 모두 버전 고정(marked 12.0.2, mermaid 11.4.1, highlight.js 11.9.0, Pretendard v1.3.9, D2Coding 1.3.2).
  - 덱 모드에서 Ctrl+P → 1쪽만, 22px 밀림 → 화면 규칙을 모두 `@media screen`에 두어 어느 보기에서든 모든 장이 쪽마다 나감.
  - 배경 그래픽을 끄면 디바이더·코드 바탕이 사라짐 → 장면에 `print-color-adjust: exact`(R0 키트). 점검에서 배경 끔·켬 PDF 그림 차이 0.
  - hash와 화면이 어긋남 → 잘못된 hash는 바로잡음. 키마다 방문 기록이 쌓임 → 건너뛸 때만 기록.
  - 접근성: 제목 태그, `role=group` + `aria-roledescription="슬라이드"` + 이름, 버튼 `aria-label`, `aria-live`, `inert`, 포커스 표시, 이미지 alt(스크린샷 = 캡션), 줄인 움직임. 대비 4.5:1 미만이던 `--muted`·상태색 글자를 어둡게 바꿈.
  - 터치 스와이프·탭 구역 추가, 375px에서 HUD 버튼 이름을 짧게.
- **뺌**(강의 덱 전용): 비유·👎👍·프롬프트 카드·체크리스트·치트시트·어두운 경고 장·"복습본" 모드(인쇄는 어느 보기에서든 바로 됨).

## 자체 점검

```powershell
node spikes/deck/harness/b-check.js                         # 랜딩 + 프로젝트 3개 × Chrome·Edge
node spikes/deck/harness/b-check.js --browser chrome --only Tidy
node spikes/deck/harness/shot.js "spikes/deck/pages/project.html?p=0-Tidy-Mommy" --slides 1,2,3   # 디버그 PNG
```

- PowerShell에서 실행합니다(Git Bash에서는 Edge의 파이프 연결이 끊김 — R0와 같음). 서버는 127.0.0.1:4642, 브라우저 프로필은 `%TEMP%\deck-*`에 만들고 지웁니다. 같은 포트로 동시에 돌리지 않습니다.
- 점검 항목: 준비·장면 수·화면 감사(R0 audit + 덱 밖) / 덱 보기 배치(한 장만 보임, 1280k×720k 가운데, 문서 스크롤 0, inert) / 키보드로 끝까지 / hash(`#5`·`#3`·`#999`·`#abc`·`#0`·`#s-4`·`?view=scroll#4`·`#s=<id>`, 목차 링크 + 뒤로) / 개요 / 클릭 구역·스와이프 / 보기 전환·휠 스크롤 / 인쇄 매체 DOM 감사 / PDF 배경 끔·켬(쪽 수 = 장면 수, 960×540pt, 빈 쪽·쪽 밖 글자·머리글/바닥글 0, 장면 i = i쪽) / 덱 PDF = 스크롤 PDF / "요약만" / `?dividers=` / (랜딩) `?wheel=1`·기본 휠 무시·줄인 움직임 / 폰 375×812·812×375 HUD.
- 결과: `out/b-check.md`(2026-10-22, 8/8 PASS).

## 알려진 빈틈

- **실제 인쇄 대화상자 "PDF로 저장"은 미확인**입니다. PDF는 모두 CDP `Page.printToPDF`로 뽑았습니다(A1과 같은 한계).
- **profile 강조색 미적용**: 테마가 인디고로 고정입니다. 강조색에서 인디고 계열을 파생할지는 정하지 않았습니다.
- 디바이더 bignum(`05`)은 장식(aria-hidden)이고 대비가 낮습니다(인디고 위 #8B95E4). 다른 글자는 4.5:1 이상으로 골랐지만 장면 전체를 도구로 검사하지는 않았습니다(**미확인**).
- 데스크톱에서 장면을 클릭하면 넘어가므로, 낱말을 **더블클릭해 고르기**가 첫 클릭에서 넘겨 버립니다(드래그로 고른 뒤 클릭은 넘기지 않음). 탭 구역을 터치에만 둘지 정해야 합니다.
- 개요는 처음 열 때 모든 장을 복제해 축소합니다(80장). 메모리·속도는 재지 않았습니다(**미확인**). 복제본의 SVG 안 id는 Mermaid 스타일 때문에 남겨 두어 중복됩니다.
- `F`(전체 화면)와 HUD `[PDF로 저장]` 버튼(→ `window.print()`)은 점검하지 않았습니다(**미확인**). 인쇄 결과 자체는 같은 인쇄 CSS로 CDP에서 확인했습니다.
- 터치·스와이프·휠 몸짓은 CDP 에뮬레이션으로만 확인했습니다. 실제 휴대폰·트랙패드 관성에서의 동작은 **미확인**입니다.
- 폰 세로에서 본문 16px이 약 4.7px로 보입니다(Q2에서 수용한 리스크). 회전 안내는 없습니다.
- 이그드라실 부록 첫 장(13쪽)은 첫 H2 앞 도입 한 줄만 남습니다(분할기 keep 규칙: 다음 제목이 큰 그림과 함께 다음 장으로 감). A1도 같은지는 **미확인**입니다.
- A1에서 빠진 것(늦은 글꼴 재분할, 실행 중 넘침 감시, 스타일 엔진 등)은 그대로 빠져 있습니다.
- 덱 보기에서도 모든 장이 DOM에 있습니다(보이지 않는 장은 `visibility:hidden`). 큰 문서에서의 메모리는 A1과 같습니다.
