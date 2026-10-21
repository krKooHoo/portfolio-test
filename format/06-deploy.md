# 기준 ⑥ GitHub Pages 배포

> 원본: 「유니티 개발자 취업·기술 문서 작성 가이드 v2」 **Part 7 GitHub Pages 배포**
> (https://koohoo-dev.github.io/portfolio-guide/guide.html#7)

이 템플릿은 **빌드 과정이 없는 정적 파일**이라, 가장 쉬운 **브랜치 배포**로 충분합니다.

```mermaid
flowchart LR
    A["공개 레포<br/>(Use this template)"] --> B["data/ 생성 후 push"]
    B --> C["Settings → Pages"]
    C --> D["Source:<br/>Deploy from a branch"]
    D --> E["Branch: main / (root)<br/>→ Save"]
    E --> F["1~2분 뒤<br/>github.io 주소 발급"]
```

1. 레포 → **Settings** → 좌측 **Pages**.
2. **Source** = **Deploy from a branch**.
3. **Branch** = `main`, 폴더 = `/(root)` → **Save**.
4. 1~2분 뒤 `https://<아이디>.github.io/<레포>/` 주소가 뜹니다.

## 자주 겪는 문제

| 증상 | 확인할 것 |
|---|---|
| 빈 화면·404 | 루트에 `index.html`이 있나요? 브랜치/폴더 설정이 `main` / `(root)`인가요? |
| 프로젝트가 안 보여요 | `data/portfolio.json`을 **커밋·push** 했나요? (`/portfolio-build` 후 push) |
| 이미지가 안 떠요 | **대소문자**가 정확한가요? Pages는 `Cover.png` ≠ `cover.png`. 상대경로인가요? |
| `_`로 시작하는 파일이 404 | 루트의 `.nojekyll` 파일을 지우지 마세요 (Jekyll 처리를 끕니다) |
| 비공개 레포 | 무료 플랜은 **공개 레포**에서만 Pages가 동작합니다 |
| 반영이 안 돼요 | 배포에 1~2분 걸립니다. 강력 새로고침(Ctrl+F5) |

## 팁

- 레포 이름을 `<아이디>.github.io`로 만들면 주소가 `https://<아이디>.github.io/`로 짧아집니다.
- **기업 보안 정책상 외부 링크가 막힌 곳**도 있습니다. 링크와 함께 **PDF 사본**도 준비하세요
  (각 페이지에서 Ctrl+P → "PDF로 저장" — 인쇄용 스타일이 들어 있습니다).
- 자동 배포(GitHub Actions)는 원본 Part 7 §7-4를 참고하세요. 입문 단계에서는 브랜치 배포로 충분합니다.
