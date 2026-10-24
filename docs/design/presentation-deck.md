# 발표 덱 전환 + GitHub 재료 추출 스킬 계획 (2026-10-23)

> 결정 기록은 [README.md](README.md)의 "발표 덱 전환 결정"(G1~G19)과 "GitHub 재료 추출 스킬 결정"(H1~H3)입니다. 계획 검토(Fable 에이전트) 결과로 바뀐 점은 맨 아래 "검토 반영"에 덧붙입니다.

레포: krKooHoo/portfolio-test (계획 시점 main = 857c2c2, 공개 레포, main push = 곧바로 GitHub Pages 배포)
유지관리자 = 유니티 강의 강사. 사용자(수강생) = 유니티(C#) 지망생. 결과물 문구는 한국어 경어체, 쉬운 말.
가이드 원문 레포: portfolio-guide (별도 공개 사이트 https://koohoo-dev.github.io/portfolio-guide/)
설계 문서: `git show origin/maintainer:docs/design/README.md` (결정 현황 F1~F11, Q1~Q16), 같은 폴더의 01-scene-layout-print.md, portfolio-structure.md, 02-style-presets.md, deck-vs-scroll.md

## 지금 구조 (바꾸기 전)

- `index.html` 포트폴리오 덱(16:9, 1280×720 장면, 제출 PDF). 장면: 표지 → 자기소개 → 기술 스택 → 프로젝트마다 2장(소개·핵심 요약) → 한눈에 보기 → 연락처. 코드: assets/portfolio-deck.js
- `project.html?p=<폴더>` 요약 덱. 장면: 표지 → 목차 → 스크린샷 → 핵심 구현(한 장에 한 항목) → 이슈 해결 → 회고 → 상세 문서로. 장면마다 "상세 문서에서 보기 ↗". 코드: assets/project-deck.js
- `doc.html?p=<폴더>` 상세 기술문서(스크롤, A4 인쇄). src/<폴더>/기술문서.md를 marked 12.0.2 + mermaid 11.4.1 + highlight.js 11.9.0으로 그림. 절 머리 칩 "요약 덱의 이 장면", 목차 ★, [요약 덱으로] 버튼. 코드: assets/doc.js
- 공통: assets/common.js(PF 유틸), deck-common.js(scene(), pack, shrinkOrClip — 변형 → 축소(본문 15px까지) → 빨간 잘림 띠), deck-kit.js/css(덱 보기, HUD, #s=<장면 id>, 준비 게이트 data-pf-ready, audit), scene-kit.css(1280×720 장면 계약, @page 1280×720), deck-theme.css(.pf-body 위치 top 152·높이 516 고정, 제목 32px)
- 데이터: /portfolio-build 스킬(.claude/skills/portfolio-build/SKILL.md, schema.md)이 profile.md + src/를 읽어 data/portfolio.json, data/projects/<id>.json 생성. highlights(2~4: title/what/how/why/section), troubleshooting(0~3), screenshots(최대 6), retro.
- 원칙(CLAUDE.md): 지어내지 않기 / 수강생 문서 대신 고쳐 쓰지 않기 / Claude가 압축한 문장은 리포트 "확인해 주세요" / 고칠 곳은 소스 / 렌더러는 요청 시만 / 상대경로·대소문자.
- 점검 도구(로컬 전용, 커밋 금지): tools/site-check/run-all.js (기준선 499/499, 덱 PDF 11/13/12/12쪽, 상세 A4 26/38/38쪽)
- 샘플: src/00-example-crafting, 0-Tidy-Mommy, 1-action-platformer, 2-Yggdrasil (data에는 00 빼고 3개). 샘플 문서 3개에 mermaid 23, 코드 블록 68, 이미지 24장이 있지만 요약 덱은 스크린샷만 씀.

## 유지관리자 요청 (2026-10-23)

1. 요약 덱 ↔ 상세 문서 구조 폐기. 상세 기술문서(md)를 바탕으로 한 **발표용 슬라이드 덱**을 project.html 자리에 만듦.
2. 장면마다 다이어그램·스크린샷·표·코드를 적극 사용. 스타일 참고: 참고 PDF A(16:9 기술문서 덱, 51쪽: 장 표지, 장 이름 + 큰 제목 + 도입 2줄, "시스템 구조/시스템 흐름/실제 구현" 탭 라벨, 그림 한쪽 + 번호 카드 다른 쪽, 코드 + 콜아웃, 비교 표·As-Is/To-Be, 트러블슈팅 = 의도→문제→해결→배운 점→TO-BE + 화면, 본문 글자 약 14px@1280, 장면이 꽉 참), 참고 PDF B(포트폴리오 요약 문서, 19쪽 A4 가로: 프로젝트 소개 = 큰 대표 이미지 + GENRE/DURATION/TEAM/ENVIRONMENT 격자 + 개발 의도 + 링크 카드 + 태그, 기능 소개 = 스크린샷 3열 + FEATURE 01 라벨 + 제목 + 설명, 본문 10~14px@1280). 두 PDF에는 실제 인물 개인정보가 있어 내용은 옮기지 않고 모양만 참고.
3. 빈 공간이 많음 → 내용이 적으면 세로 가운데 정렬.

## 확정 결정 19개 (모두 추천안)

A 구조
1. doc.html 유지. 상세 문서의 칩·★·[요약 덱으로] 삭제, 머리에 [발표 덱 ↗] 하나. 덱 → 상세 문서 링크는 표지·마지막 장면에만.
2. 주소 project.html?p= 유지, 이름은 "발표 덱".
3. 옛 공유 주소(#s=hl-1, ts-n, shots, retro, toc, more, 옛 문서 앵커)는 가장 가까운 장면으로 넘김.
4. 포트폴리오 덱도 바꿈: 프로젝트마다 소개 1장 + 기능 3열 1장(요약 문서 스타일).
B 레이아웃
5. 글자 하한: 본문 14px, 코드 12px, 라벨 11px (기존 15/13/13).
6. "한 장에 한 항목" 폐기, 한 주제를 구조·흐름·구현 여러 장으로.
7. 장면 머리: 제목 + 도입 1~2줄, 높이 가변.
8. 내용이 본문 상자보다 짧으면 항상 세로 가운데. 채움률 60% 미만은 리포트 "참고"(빨간 배지 아님).
9. format/04 원칙을 "덱 = 시각 자료 중심 / 상세 문서 = 읽는 문서형" 둘로.
10. 겉모양은 지금 틀 유지, 배치만 바꿈(참고 PDF A식 굵은 테두리는 나중 스타일 프리셋).
C 데이터
11. 장면 목록은 build 때 Claude가 고름. 그림·코드·표는 md 원문 블록을 가리키기만 하고 그대로 그림.
12. 스크린샷 6장·highlights 2~4·troubleshooting 0~3 상한은 포트폴리오 덱용으로만.
13. format/02에 권장 항목 추가: 레퍼런스, 핵심 루프, 조작법, TO-BE, As-Is/To-Be.
14. 장면 수 프로젝트당 15~30장 권장, 넘으면 리포트 "참고".
15. 발표자 노트·다이어그램 번호 배지는 2차.
D 진행
16. Q4 그대로: 가이드 원문(로컬 portfolio-guide 레포) 먼저 고치고 format/ 동기화. 가이드 push는 별도 확인.
17. F1·Q7·글자 하한·Q8 적용 범위를 maintainer 설계 문서에 기록.
18. 프로필·이력서 장면은 이번 범위 밖(F7 대기).

## 단계

1. 결정 기록(maintainer 브랜치 worktree).
2. 가이드 원문 Part 2·3 → format/ (README의 "발표용 슬라이드 제외" 행 삭제, 01 세 페이지 기준으로, 02 권장 항목, 04 패턴 재매핑·원칙 둘로·results→retro, 05 doc.html·장면 틀, 06:37).
3. 스키마: 프로젝트 JSON에 `deck` = { chapters:[{title, section}], slides:[{ id?, chapter, tab, layout, title, lead, section, points:[{label,text}], visuals:[{kind:'mermaid'|'code'|'table', section, n, lines?} | {kind:'image', src, caption}] }] }. 포트폴리오 덱용 `intent`(개발 의도), `highlights[].image`. 장면 id = 원문 절 제목 slug + 순번.
4. md 처리 공용화: doc.js의 md 해석·상대경로·slug·mermaid·hljs → assets/md-blocks.js (상세 문서 결과 동일 유지).
5. 장면 키트: 글자 하한 14/12/11(가장 작은 글자 기준으로 축소 멈춤), 가변 머리(머리 잰 뒤 본문 위치), 세로 가운데(두 덱 공통), 채움률 report(), 시각 자료 맞추기(다이어그램 실효 글자 10px 미만 "권장", 코드 20줄 넘으면 "계속" 장면, 원문 블록 못 찾으면 감사 항목).
6. 발표 덱: 표지 → 목차(장 목록) → [장 표지 → 장면들]×장 → 회고 → 맺음. 장면 틀 9개: 표지·장 표지·개요·시각+번호 카드·코드+설명·큰 그림/표 한 장 가득·화면 3열·문제 해결·회고. 머리 왼쪽 장 이름, 오른쪽 탭 + n/m. deck 없는 옛 데이터는 highlights·troubleshooting 원문 절의 첫 그림·코드로 자동 구성. md 없으면 안내 장면. 옛 주소 넘기기.
7. 상세 문서: 칩·★·[요약 덱으로] 삭제, [발표 덱 ↗] 추가. A4 인쇄 유지.
8. 포트폴리오 덱: 프로젝트 2장 개편(소개: 큰 대표 이미지·격자·개발 의도·링크 카드·태그 / 기능 3열: 스크린샷 + FEATURE + 제목 + 설명). 나머지 장면은 세로 가운데만.
9. 스킬: /portfolio-build 장면 고르기 규칙(원문 장 순서, 장면당 시각 자료 1~2, 15~30장, 원문에 없는 내용 금지, 압축 문장 → 확인해 주세요), 미리보기 점검을 발표 덱에 맞게. /portfolio-check 새 권장 항목. /portfolio-custom 임시 덮어쓰기 제거. 샘플 3개 재빌드.
10. README·CLAUDE.md 문구.
11. tools/site-check 갱신 + 극단 데이터 시험(큰 다이어그램, 40줄 코드, 넓은 표, deck 없음, md 없음, 빈약) + run-all + 픽셀 비교(포트폴리오 덱: 세로 가운데·프로젝트 장면 외 이동 없음 / 상세 문서: 칩 자리 외 이동 없음) + 다관점 검증·반박 검토.
12. 보고. commit은 세 곳(이 레포·maintainer·가이드) 각각 요청 받아서.

진행 분담: 발표 덱 핵심(4~8단계)은 메인 세션 한 명이 맡음. 계획 검토와 병렬 가능한 부분(문서·스킬·점검 도구·샘플 재빌드·검증)만 Fable 에이전트.
순서: 발표 덱을 먼저 끝내고 GitHub 스킬은 그다음(렌더러 계약이 먼저 굳어야 함).

## 새 아이디어: GitHub 재료 추출 스킬 (승인됨, 발표 덱 다음)

- 수강생 GitHub 레포에서 재료 추출(얕은 복제, .cs·ProjectSettings/ProjectVersion.txt·Packages/manifest.json·README·커밋 기록). 비공개 레포는 수강생 PC의 gh 로그인.
- 추출 결과로 "찍어야 할 화면 목록"(스크린샷·영상)을 수강생에게 줌. 영상은 링크(YouTube 등) 위주.
- src/<NN-프로젝트>/ 아래 보관. 코드는 **핵심 .cs만**(비밀값 검사, 팀 프로젝트의 남의 코드 제외).
- 기술 문서는 **재료집 + 질문지(1-a)**: 코드에서 확인된 사실(개발 환경, 클래스 구조 다이어그램 초안, 핵심 코드 발췌, 커밋에서 찾은 트러블슈팅 후보)은 Claude가 채우고, 수강생만 답할 수 있는 칸(Why, 고민과 선택, 트러블슈팅 과정, 배운 점)은 질문으로 남김. 수강생이 답을 써서 기술문서.md 완성 → 기존 /portfolio-build 흐름.
- 원칙 유지: 지어내지 않기, 수강생 문서를 대신 쓰지 않기.

## 검토 반영 (2026-10-23)

계획 검토(세 관점 합본, blocker 1 · major 11 · minor 12)를 위 단계에 어떻게 넣었는지 정리한 표입니다. 19개 결정은 그대로이고, 검토가 지적한 **단계의 빈 곳과 모순**만 반영했습니다.

읽는 법
- **반영 단계**는 위 "단계" 번호입니다. 검토가 제안한 순서 변경(계약 동결을 1단계 안으로, 샘플 재빌드는 '덱 추가 모드'로 픽셀 비교 앞에)은 그대로 받았습니다.
- **반영 방식**의 근거는 두 가지입니다. ① 데이터 계약: `.claude/skills/portfolio-build/schema.md` 「발표 덱 `deck`」 절(확정, 이 문서는 고치지 않음). ② 렌더러가 내보낼 점검 정보(계약): `PFScene.report().audit`의 type `clipped`(기존 그대로) · `visual-missing`(원문 블록 0곳) · `visual-ambiguous`(2곳 이상) · `visual-changed`(지문 불일치) · `key-invalid` — 장면 안 빨간 띠로도 보이고 배포·PDF에도 남음 / `PFScene.report().info.notes[]` = `{scene, id, type, value, detail}`, type `low-fill`(채움률 60% 미만) · `tiny-diagram`(다이어그램 실효 글자 10px 미만) · `long-code`(20줄 넘어 나뉨) · `many-scenes`(30장 초과) · `auto-mode`(예전 데이터로 자동 구성) · `font-floor`(글자 하한에 걸려 더 줄이지 못함) — 빨간 배지·audit에 넣지 않는 참고 지표.
- 장면 id: 발표 덱 `cover` · `toc` · `ch-<장key>` · `d-<key>`(나뉘면 `d-<key>-2`) · `retro` · `end`, 포트폴리오 덱 `cover` · `intro` · `stack` · `p-<폴더>` · `p-<폴더>-core` · `glance` · `contact`. 글자 하한 본문 14 · 코드 12 · 라벨 11px. 장면 틀 = 렌더러 고정(표지·목차·장 표지·회고·맺음) + `deck.slides[].layout`(`overview`·`visual`·`code`·`full`·`screens`·`problem`).
- 렌더러 안쪽 세부(측정 순서, CSS, 로드 방식 등)는 계약이 아니라 **"구현 중"**으로 표시했습니다. 스킬·format·하네스 쪽은 "예정(n단계)"입니다.

| # | 지적(요지) | 반영 단계 | 반영 방식 |
|---|---|---|---|
| **B1** | 원문 블록 참조 `{kind, section, n}`이 모호(같은 제목이 여럿, `n` 셈 규칙 없음) | 3 · 5 · 9 | **3(계약)**: `sectionPath`(원문 제목을 위에서 아래로, 같은 제목이 여럿이면 구분될 때까지 위 제목을 앞에 붙임, **정확히 1곳**일 때만 사용) · 절 범위 = 그 제목부터 다음 제목(수준 무관) 바로 앞까지(하위 절은 하위 절 경로로) · kind는 펜스로(`mermaid` 펜스 = mermaid, 그 밖 펜스 = code, 언어 없는 펜스도 code로 세고 평문으로 그림) · 표 안 이미지는 `table`로만 · `image`는 `src`로 찾고 같은 `src`가 두 번이면 `n` 필수 · 지문 `fp`(code·mermaid는 첫 비어 있지 않은 줄 60자, table은 머리 칸을 `\|`로 이은 것) 필수. **5(렌더러)**: 0곳 → `visual-missing`, 2곳 이상 → `visual-ambiguous`, 지문 불일치 → `visual-changed`를 audit에 넣고 장면 안 빨간 띠로 그림(배포·PDF에도 보이므로 조용히 비지 않음). **9(스킬)**: `project.html?p=<id>&pf-audit=1`로 모든 참조가 1곳으로 풀렸는지 확인, Claude가 눈으로 센 `n`을 믿지 않음 — 예정 |
| **M1** | 글자 하한 "가장 작은 글자 기준"이 지금 템플릿에서는 축소 단계를 없앰 | 1 · 5 | **1(이 작업)**: 01 §2-2 하한 행·§9-4 "13px 미만" 행·§3-1, 02 §4(렌더러 상수·`--fs-body`·`--fs-code`·라벨)를 14/12/11로 개정, 【G5·G7·G8 결정】 표시. **5(렌더러)**: 하한에 걸려 더 못 줄인 장면은 `info.notes[]` `font-floor`로 내보냄(계약). 분류표(어느 선택자가 본문·코드·라벨인지)·z 적용 전 한 번 수집·SVG 실효 크기 공식·기존 14·13.5px 글자 처리는 **구현 중**. format/05 문구 동기화는 2단계 예정 |
| **M2** | 장면 id "절 제목 slug + 순번"은 설계 규칙과 충돌, 공유 주소 못 지킴 | 3 · 10 | **3(계약)**: `key` = `^[a-z][a-z0-9-]{1,31}$`, `s-숫자`·숫자만 금지, **빌드가 항상 명시**(렌더러만 생성하는 길은 두지 않음), 재빌드 때 같은 `sectionPath`면 예전 `key` 유지, 렌더러 id는 `d-<key>`(나뉘면 `d-<key>-2`), 규칙에 안 맞으면 순번 id로 바꾸고 audit `key-invalid`. 절 slug는 딥링크용으로만. **10**: README에 "다시 빌드하면 장면 주소가 바뀔 수 있음" 한 줄 — 예정 |
| **M3** | 옛 주소 → 가장 가까운 장면이 지금 구조로는 조용히 표지로 떨어짐 | 6 · 8 · 11 | **6·8(렌더러, 구현 중)**: renderAll 뒤·mount 전에 데이터 기반 대응 — `hl-n` → `highlights[n-1].section`이 속한 장의 첫 장면(없으면 장 표지), `ts-n` → `problem` 장면, `shots` → `screens`, `toc`/`retro`/`more` → `toc`/`retro`/`end`, 옛 제목 slug → 그 제목이 속한 장면(없으면 `doc.html`). 포트폴리오 덱 기능 3열 장면은 **`p-<폴더>-core` id를 그대로** 써서 공유 주소 유지, index의 `hl-n` 링크는 새 id로. **11**: deck-check의 want·order·LEGACY 단언 갱신 — 예정 |
| **M4** | Mermaid·hljs·글꼴 파이프라인(측정 순서·실패 처리·로드)이 계획에 없음 | 4 · 5 | 모두 **구현 중**(렌더러 내부, 계약 밖): `<template>`에서 장면이 가리키는 블록만 꺼냄, mermaid는 측정 컨테이너에서 `render` 뒤 viewBox로 실효 글자 계산, `suppressErrorRendering` + 다이어그램별 try/catch + 실패 대체물, D2Coding 실제 글자로 `fonts.load` + refit 조건 추가, mermaid·hljs는 필요할 때만 로드, timeout 문구에 다이어그램·글꼴 상태. 계약으로 드러나는 것은 `tiny-diagram`(실효 10px 미만)과 `visual-changed`뿐 |
| **M5** | 세로 가운데·채움률·참고 지표를 `audit()`에 넣으면 결정 8과 어긋남 | 5 · 8 · 9 | **5(계약)**: 참고 지표는 `info.notes[]`(`low-fill`·`tiny-diagram`·`long-code`·`many-scenes`·`auto-mode`·`font-floor`)로 분리, `audit`에는 넣지 않음(빨간 배지 아님). `clipped`는 기존 그대로 audit. 세로 가운데 구현(`.pf-fill` + `margin-block:auto`, inherit 목록 확장, 템플릿별 오프셋)은 **구현 중**. **9(스킬)**: SKILL §6 `## 장면 점검` 섹션·요약 표 '참고' 열·clipped = 필수 통일·format/02 참고 정의 확장·쉬운 말 문구 예시 — 예정 |
| **M6** | 가이드 측 범위(결정 16·Q4)가 `slides/deck.html`과 설계 §13을 빠뜨림 | 1 · 2 | **1(이 작업)**: 01 §13 표를 새 장면 틀·새 순서(Q7 폐기)·"덱 = 시각 자료 / 상세 = 읽는 문서" 원칙으로 개정(【G 결정】 머리말 + 행별 표시, `format/03`·`format/05:6·12·15·21·27`·`format/02` 권장 항목 행 추가). **2(예정, 줄 단위)**: 가이드 `src/01` Part 1 §3 flowchart + F9 문구, `src/02:131` 더미 주소·`:264` "문서 50줄 · 덱 20줄"·권장 항목 소절, `src/03:142` ⑤·`:200-211` 표, Part 4·6·7 → `slides/deck.html` 해당 슬라이드 → `format/01:37-38·78-81·117-120`, `format/03:25-26·47·103-111`, `format/04` 재매핑, `format/05`, `format/06:36-37`, `format/README:22`(삭제 + 대체 문구). 비교 표·As-Is/To-Be는 계약에서 **`layout: "full"`에 담는 것으로 확정**(schema.md `layout` 행)이라 별도 확인 항목에서 뺌 |
| **M7** | 포트폴리오 덱 '기능 3열 1장'과 데이터·공유 요소가 안 맞음 | 3 · 8 | **3(계약)**: `intent` = `{text, verbatim}`(Why 문단에서, 없으면 `null`), `highlights[].image` = `{src, w, h, caption}`(그 기능 절에 실제로 있는 이미지만, 없으면 `null`), `highlights` 2~4·`screenshots` 최대 6은 포트폴리오 덱·자동 구성용으로 한정, `meta`는 장르·기간·인원·환경 순. **8(렌더러, 구현 중)**: `pack` 변형(3열 ≤3 / 2×2 또는 4열 / 2열 가운데), 넘치면 '1/2' 두 장, meta 라벨 정규화 표, introScene `variant` 분기, 대체 동작(intent 없으면 칸 숨김, image 없으면 `screenshots` 앞 3장, 그것도 없으면 글만 가운데). `format/01` "스크린샷 4~6장" 셈은 md 안 이미지 수로(2단계 예정) |
| **M8** | 9단계 '샘플 재빌드' ↔ 11단계 '픽셀 비교 이동 없음' 순서 충돌, Sync fork data 충돌 | 9 · 11 · 10 | 순서를 **9b '덱 추가 모드' 재빌드**(기존 필드 바이트 유지, `schemaVersion`·`deck`·`intent`·`highlights[].image`·`retro.section`·`w`·`h`만 추가) → **11a 비교·기준선**(499/499, PDF 11/13/12/12쪽, A4 26/38/38) → **9c 전체 재빌드는 별도 커밋 + 기준선 재기록**으로 바꿈. **10**: README '템플릿 업데이트'에 data 충돌 레시피 — 예정. **유지관리자 확인**: 이번 릴리스를 Sync fork로 전달할지 `/portfolio-update`(R1k)로 할지 |
| **M9** | `deck` 없는 옛 데이터 자동 구성의 규칙 공백 | 3 · 6 | **3(계약)**: `schemaVersion: 2`로 모드 판별, `retro.section` 추가. schema.md 「예전 데이터(자동 구성)」: `highlights`·`troubleshooting`·`screenshots`·`retro`로 덱을 만들고 `section`이 **정확히 1곳**으로 풀릴 때만 그 절의 첫 그림(이미지·mermaid·코드 순), 장면마다 띠 "예전 데이터로 자동 구성 — /portfolio-build를 다시 실행하면 발표 덱이 됩니다". **6(렌더러)**: `info.notes[]` `auto-mode`로 내보내고, 자동 구성 모드에서는 `many-scenes`·`low-fill` 참고를 내지 않음 + "다시 빌드 필요" 권장 1건 — 구현 중 |
| **M10** | 압축 문장 표시(원칙 3)가 발표 덱 규모(50~120문장)에서 작동하지 않음 | 3 · 9 · 11 | **3(계약)**: 글 조각 `{text, verbatim}`(`title`·`lead`·`points[].text`·`caption`·`intent`), `verbatim: true`는 원문 그 절 범위 안에 같은 글자가 그대로 있을 때만(기호·공백 차이 무시)이고 **빌드가 검사**, `title` 기본 = `sectionPath` 마지막 제목(`verbatim: true`), `tab`·`layout`은 열거형. "확인해 주세요"에는 `verbatim: false`만 장면별로. **9·11**: SKILL §4 검사 절차와 tools/site-check verbatim 검사 스크립트 — 예정 |
| **M11** | 상세 문서(7단계) 삭제 범위가 칩·★·버튼보다 넓고, 하네스·픽셀 기준이 그대로는 통과 불가 | 7 · 11 | **7(렌더러, 구현 중)**: `doc.js`의 targets/sceneOf/chip 경로 통째로 제거, 레일 "지금 읽는 절"은 제목·상위 H2만, print-urls·newtab-note·noscript·주석 문구 교체, 머리에 [발표 덱 ↗] 하나(G1). **11(예정)**: 비교 기준 "칩 제거로 생기는 세로 이동 허용, 각 블록 폭·높이 동일", doc-check ③·칩 단언과 run-all 교차 확인을 [발표 덱 ↗]로, md-blocks 분리 회귀 오라클(slugs·A4 쪽 수·코드/표 쪼개짐 0). 설계 쪽은 portfolio-structure §4-5에 【G1 결정】 표시(이 작업) |
| m1 | 가변 머리를 JS로 재면 측정 순서 의존, 실제 위험은 머리가 무한히 커지는 것 | 5 · 7 | **계약**: 머리 = 제목 + 도입(`lead`, 80자 안팎, 없으면 `null`), 머리는 축소하지 않음(축소는 본문 안만). flex 가변 유지·`lead` 인자·머리 높이 상한(넘으면 overflow 기록 → 리포트 권장)은 **구현 중**. 설계 01 §3-1에 【G7 결정】 메모(이 작업) |
| m2 | md-blocks.js 분리 경계(slug 계산 시점, `.table-wrap`·markPrintWide·mermaid 후처리는 doc.js에) | 4 | **구현 중**: md-blocks.js 책임을 "marked → 상대경로 → 헤딩 slug → 블록 목록"까지로 한정, 상세 문서 결과 동일(회귀 오라클은 M11) |
| m3 | 덱 테마에 md 블록 스타일 없음, hljs 테마, 코드 분할 시 span 끊김, `lines` 의미 | 3 · 6 | **3(계약)**: `lines: [시작, 끝]`(펜스 줄 제외, 1부터, 블록 안 줄 번호), 범위가 20줄을 넘으면 렌더러가 "계속" 장면으로 나눔 → `info.notes[]` `long-code`. **6(구현 중)**: `.pf-scene .md-block` 스타일 세트, hljs 테마 1종(PDF = 화면), 원문 줄로 자른 뒤 조각마다 hljs 재적용, 조각 최소 3줄·20% 규칙, "(일부 · n~m줄)" UI 문구 |
| m4 | 장 표지·계속·안내 장면 모두 `.pf-deck` 직계 `.pf-scene`이어야 함 | 6 | **계약**: 장면 id 목록(`cover`·`toc`·`ch-<장key>`·`d-<key>`·`d-<key>-2`·`retro`·`end`)은 모두 `.pf-deck` 직계 장면. 장 묶음은 `data-group`으로만 — 구현 중 |
| m5 | `chapters[]`를 H2에서 만들 때 제외 규칙 없음 | 3 | **계약**(schema.md 「장」): 목차 H2(`목차`·`차례`·`Contents`) 제외, 개요 앞 요약 H2(예: `0. 한 장 요약`)는 장으로 만들지 않고 표지·개요 재료로만, `title`은 번호·★ 기호만 뗀 글자, `sectionPath`는 그 H2 제목 그대로 한 칸 |
| m6 | Q12 `media`(w×h)가 스키마 목록에 없음, 새 image도 크기 정보 필요 | 3 · 9 | **계약**: 이미지 공통형 `{src, w, h, caption}`(`screenshots[]`·`highlights[].image`·`visuals[] image`), `w`·`h`는 파일 머리에서 읽은 값만(추측 금지), 없으면 렌더러가 실행 중에 잼. **9**: PowerShell 헤더 읽기 절차 — 예정 |
| m7 | `visuals.caption`·`points[].label` 출처 미정(원칙 3) | 3 | **계약**: `caption`은 이미지 alt가 기본(`verbatim: true`), 조합했으면 `verbatim: false`; `label`은 원문의 굵은 머리말·표 머리 또는 고정 라벨(`기능`·`구현`·`이유`·`문제`·`원인`·`해결`·`결과`·`배운 점`) 또는 `""` |
| m8 | 결정 13 권장 항목이 샘플 어디에도 그 이름으로 없음 → 영구 권장 소음 | 2 · 9 | **예정**: '있으면 좋은 항목'으로 묶어 요약 표 권장 개수에 넣지 않거나 참고로, 이름이 아니라 내용으로 판정('원작과 다른 점'도 레퍼런스로 인정). 설계 01 §13에 `format/02` 권장 항목 행으로 적음(이 작업). 샘플 기대치는 11단계 기준선에 기록 — 예정 |
| m9 | 15~30장 규칙 공백(하한 미달 미지적, 상한 초과 때 빼는 순서) | 3 · 9 | **계약**(schema.md 「분량」): 15장 미만은 지적하지 않음, 30장을 넘으면 `many-scenes` 참고 + 같은 절의 두 번째 코드 → 보조 표 → 겹치는 화면 순으로 빼고 빠진 내용은 상세 문서에 그대로 |
| m10 | "md 없으면 안내 장면"은 빌드 흐름에서 생길 수 없는 상태(JSON만 남은 경우) | 6 · 11 | **구현 중**: 문구를 "기술 문서 파일을 찾지 못했습니다(json의 doc: …) → src 확인 후 다시 빌드"로. **11(예정)**: 시험 케이스에 'JSON만 남긴 상태' 명시 |
| m11 | 큰 GIF 준비 시간·표 안 GIF 4장 장면이 극단 시험에 없음 | 11 · 9 | **예정**: 11단계 시험 추가(50MB GIF·10Mbps, `2-Yggdrasil` 표 안 GIF 4장), SKILL §7-1에 5MB 이상 GIF 참고 안내 |
| m12 | '요약 덱' 문구가 코드·문서 여러 곳에 남을 위험, PDF 안내 구분 없음 | 1 · 10 · 11 | **1(이 작업)**: 설계 문서(portfolio-structure·01 §13·02)의 "요약 덱"에 【G2 결정】 개정 표시(역사 기록은 남김). **10·11(예정)**: README·CLAUDE.md·project.html·doc.html·스킬 문구 체크리스트 + `grep -rn "요약 덱"` 0건 확인, README PDF 절에 "제출 기본 = 포트폴리오 덱 PDF, 발표 덱 PDF는 요청·백업", "영상은 PDF에서 주소 글자로 보이니 짧은 공개 주소 권장", PDF 쪽 수 기준선 갱신 |

**검토가 더한 단계(요약)**: 1단계 안에 계약 동결 소단계(필드 단위 schema.md 확정 — 완료, 위 계약) + 설계 01 §13·§2-2·§9-4 개정(이 작업) → 그 뒤 4~8단계 시작. 샘플 재빌드는 '덱 추가 모드'(9b)로 픽셀 비교(11a) 앞에, 전체 재빌드(9c)는 별도 커밋.

**유지관리자 확인이 필요한 것**: ① 기존 수강생 전달 경로(Sync fork + data 충돌 레시피 vs `/portfolio-update` R1k) ② 샘플 전체 재빌드(9c)를 이번 릴리스에 넣을지 ③ 가이드 원문 push 시점(G16).

---

## 구현 기록 (2026-10-23)

### 출시
- main `b9d74ce`: 발표 덱 전환·포트폴리오 덱 개편·샘플 덱 데이터(덱 추가 모드)·format/·스킬·README. 점검 도구 541/541(Chrome·Edge), 덱 PDF 11/30/29/30쪽, 상세 A4 26/38/38쪽.
- main `b55d391`: `/portfolio-intake`. main `d72c073`: `/portfolio-update`. 가이드 레포 `21ccf31`(Part 1·2·3·7, deck.html 해당 슬라이드).
- 위 "유지관리자 확인" ① 전달 경로는 **`/portfolio-update`를 추천, Sync fork는 다른 방법**으로 정함(2026-10-23 유지관리자 승인). ② 9c 전체 재빌드는 하지 않음(덱 추가 모드만). ③ 가이드는 함께 push함.

### `/portfolio-intake` 기본값 (설계안 §6 열린 질문, 유지관리자가 "추천대로" 승인)
| 질문 | 정한 값 |
|---|---|
| 다이어그램 초안 | H1대로 그림(⚠ 머리말, 10개 이하, 관계만) |
| `_intake/` 커밋 | 안 함(`.gitignore`에 `src/*/_intake/`, `report-intake.md`) |
| 핵심 .cs | 6~12개·1,500줄 안팎, 작은 프로젝트는 전부 후보 |
| 내 코드 판정 | 커밋 비율 60% 이상 = 내 것, 30~60% 수강생 확인, 커밋이 아주 적은 레포는 파일 단위로 물음 |
| 비밀값 의심 파일 | 가려서 복사하지 않고 제외, 위치만 report-intake.md |
| 보조 스크립트 | 없음(git + Grep) |
| 시험 | TidyMommy(개인)·Yggdrasil(팀)·없는 레포. 원칙 위반 0, .cs 바이트 동일. 발견: Git Bash가 `/…` sparse 패턴을 Windows 경로로 바꿔 ProjectSettings가 조용히 빠짐 → `--stdin`으로 수정 |

### `/portfolio-update` (R1k 최소판 구현, 02 §8-8과 다른 점)
- `data/theme.css` 생성·`PF_CONTRACT` 확인은 없음(스타일 프리셋 미구현). `tools/`·내장 프리셋은 템플릿에 없음.
- 교체 대상에 `doc.html`·`.nojekyll`·`.claude/skills/portfolio-*/` 전부(이 명령 자신 포함). `README.md`는 수강생이 고쳤으면 묻고 기본 유지.
- 수강생 수정 판별 = 내 파일 blob이 템플릿 기록의 어느 버전과도 다르면 "수정"(Fork·복사 레포 모두 동작).
- 템플릿에서 지워진 파일: 템플릿 기록 그대로면 삭제, 템플릿에 없던 내 파일은 유지, 고친 흔적이 있으면 물음(기본 유지).
- 부트스트랩 스킬은 업데이트와 **따로 커밋**(되돌려도 명령이 남게). 커밋은 파일 단위 add(폴더째 add 금지). 트레일러 `Template-Version: <sha>`.
- "이미 최신"은 버전 글자가 아니라 내용 diff로 판단(되돌린 뒤 재실행 오판 방지). 지난 버전은 되돌린 업데이트 커밋을 건너뛰고 찾음.
- 시험: 857c2c2 Fork 레포(업데이트→되돌리기→재업데이트), f42d897 복사 레포(옛 CSS·README 수정, 내 파일). 수강생 소유 경로 무변경, 업데이트 뒤 모든 페이지 감사 0·자동 구성 모드 확인.
