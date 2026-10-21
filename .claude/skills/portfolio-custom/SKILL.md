---
name: portfolio-custom
description: 직접 생성 모드 — data/의 포트폴리오 데이터로 Claude가 디자인을 새로 그린 단일 HTML 페이지(custom/index.html)를 만든다. 사용자가 /portfolio-custom을 직접 입력했을 때만 실행.
argument-hint: "[디자인 요청 — 예: 다크 톤, 첫 화면은 이름만 크게]"
disable-model-invocation: true
---

# /portfolio-custom — 직접 생성 모드

디자인 요청: `$ARGUMENTS` (비어 있으면 "취업용답게 깔끔하고 절제된, 템플릿 같지 않은 디자인")

고정 렌더러(`index.html`)와 **같은 데이터**로, 겉모습만 새로 그린 페이지를 `custom/index.html`에 만듭니다.
고정 렌더러 파일은 **수정하지 않습니다.**

## 0. 준비

1. `format/05-custom-page-prompts.md`의 **생성 규칙**과 `format/04-layout-patterns.md`의 패턴 13종을 읽습니다.
2. `data/portfolio.json`과 `data/projects/*.json`을 읽습니다. **없으면 멈추고** `/portfolio-build`를 먼저 하라고 안내합니다.
3. 스키마는 [../portfolio-build/schema.md](../portfolio-build/schema.md) 참고.

## 1. 생성 규칙

- **단일 HTML 파일** `custom/index.html`. 설치·빌드 없음.
  - React 18 + ReactDOM은 CDN에서 **버전 고정** (`https://unpkg.com/react@18.3.1/umd/react.production.min.js` 등),
    JSX를 쓰면 `@babel/standalone@7.24.7`. 스타일은 Tailwind CDN(`https://cdn.tailwindcss.com`).
- **데이터는 `fetch('../data/portfolio.json')`로 읽어 렌더**합니다. JSON 내용을 HTML에 복사해 넣지 않습니다
  → 다음에 `/portfolio-build`만 다시 하면 이 페이지도 자동으로 최신이 됩니다.
- 내용은 데이터에 있는 것만. 문구를 새로 지어내지 않습니다 (섹션 제목·버튼 문구 같은 UI 텍스트는 예외).
- 프로젝트 상세는 새로 만들지 않고 `../project.html?p=<id>`로 링크합니다.
- 이미지 경로: `../src/<id>/<cover 또는 screenshots[].src>` (상대경로).
- 강조색은 `settings.accent`를 기본으로 하되, 디자인 요청에 다른 색이 있으면 그 색.
- 반응형(모바일 375px에서 가로 스크롤 없음), 3색 이내, 여백·타이포그래피 중심.
- 링크가 빈 값(`""`)이면 그 버튼을 그리지 않습니다.

## 2. 확인과 보고

1. 로컬 서버(`python -m http.server 4600`, 없으면 `py -m ...`)로 `http://localhost:4600/custom/`을 열어
   콘솔 오류·깨진 이미지를 확인합니다 (브라우저 도구가 있으면 스크린샷까지).
2. 사용자에게 알립니다:
   - 주소와 어떤 디자인 결정을 했는지 3줄
   - **"직접 생성 결과는 실행할 때마다 달라질 수 있습니다. 화면을 직접 확인하세요."**
   - 다듬고 싶으면 "방금 만든 페이지에서 [이 부분]을 [이렇게] 바꿔줘"처럼 이어서 말하면 된다는 안내
   - 메인으로 쓰려면 이력서 링크를 `.../custom/`으로 — 고정 렌더러는 백업으로 남겨 두기
