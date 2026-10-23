# format/ — 가이드 판정 기준

「유니티 개발자 취업·기술 문서 작성 가이드 v2」(https://koohoo-dev.github.io/portfolio-guide/)에서
**포트폴리오 페이지를 만들고 점검하는 데 필요한 기준만** 골라 압축한 폴더입니다.
Claude는 `/portfolio-build`·`/portfolio-check`를 실행할 때 이 파일들을 판정 근거로 읽습니다.

| 파일 | 내용 | 원본 |
|---|---|---|
| [01-portfolio.md](01-portfolio.md) | 세 페이지(포트폴리오 덱 · 발표 덱 · 상세 기술문서) 항목, 체크리스트 | Part 1 §3 포트폴리오 |
| [02-tech-document.md](02-tech-document.md) | 기술 문서 5단 구조, 유형 A/B/C, 단계별 판정, 있으면 좋은 항목, 리포트 심각도 | Part 2 기술 문서 |
| [03-diagrams.md](03-diagrams.md) | 다이어그램 5종 선택·점검, 덱 장면에서 작아지는 문제, 제안용 프롬프트 틀 | Part 4 Mermaid · Part 3 ④ · Part 6 §6-3 |
| [04-layout-patterns.md](04-layout-patterns.md) | 덱 장면 틀 · 문서 패턴 13종 → 세 페이지 매핑, 레이아웃 원칙 둘 | Part 3 · 레이아웃 카탈로그 |
| [05-custom-page-prompts.md](05-custom-page-prompts.md) | 직접 생성 모드 규칙·프롬프트 | Part 6 트랙 B · 만능 틀 ③④ |
| [06-deploy.md](06-deploy.md) | GitHub Pages 브랜치 배포·문제 해결 | Part 7 배포 |

## 가이드에서 가져오지 않은 것

| 가이드 내용 | 이유 |
|---|---|
| Part 1 이력서·자기소개서 | 웹 포트폴리오 범위 밖 (가이드 원문 참고) |
| Part 2·4의 비유·크래프팅 워크스루 전문 | 판정 기준만 남김. 예시는 `src/00-example-crafting/`에 한 편으로 |
| Part 6 트랙 A(Marp 생성 프롬프트) | 슬라이드는 고정 렌더러가 그리므로 생성 프롬프트가 필요 없음. **발표 덱·포트폴리오 덱은 Part 3의 슬라이드 원칙(한 화면 한 메시지 · 8유형)을 장면 틀로 그대로 따름**(기준 ④) |
| Part 4 Mermaid → PNG 변환 | 페이지가 Mermaid를 라이브 렌더하므로 불필요 |
| Part 5 웹 챗봇 워크플로우 | Claude Code 스킬로 대체. "이해 없이 복붙 금지" 원칙은 `CLAUDE.md`로 이전 |
| Part 7 GitHub Actions 배포 | 입문은 브랜치 배포로 충분. 필요하면 원문 §7-4 |

> 기준이 바뀌면 **가이드 원문을 먼저** 고치고, 이 폴더를 그에 맞게 갱신하세요.
