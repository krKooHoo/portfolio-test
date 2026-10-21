# 데이터 스키마 (data/)

고정 렌더러(`index.html`, `project.html`)가 읽는 데이터 형식입니다. **이 형식을 정확히 지킵니다.**
값이 없으면 문자열은 `""`, 배열은 `[]`, 객체 필드는 `null` — **추측해서 채우지 않습니다.**

## `data/portfolio.json`

```json
{
  "generatedAt": "2026-10-21",
  "profile": {
    "name": "홍길동",
    "nameEn": "Gildong Hong",
    "headline": "구조를 설명할 줄 아는 유니티 클라이언트 개발자",
    "intro": "profile.md 자기소개를 줄바꿈까지 그대로",
    "email": "you@example.com",
    "github": "https://github.com/your-id",
    "links": [{ "label": "블로그", "url": "https://your-blog.example.com" }]
  },
  "settings": {
    "layout": "project",
    "accent": "#2F6FEB"
  },
  "skills": [
    {
      "name": "Unity",
      "evidence": [
        { "text": "Animator 기반 FSM으로 보스 패턴 5종 설계", "project": "1-action-platformer" }
      ]
    }
  ],
  "projects": ["00-example-crafting", "0-Tidy-Mommy"]
}
```

| 필드 | 규칙 |
|---|---|
| `profile.*` | **`profile.md`에서만.** 자기소개(`intro`)는 고쳐 쓰지 않고 그대로 |
| `settings.layout` | `"project"` 또는 `"stack"` (profile.md `구성 방식`, 없으면 `"project"`) |
| `settings.accent` | `#RRGGBB` 형식. 형식이 틀리면 `"#2F6FEB"` + 리포트에 알림 |
| `skills[]` | 3~8개. 기술마다 `evidence`(근거)가 **1개 이상**. 근거 없는 기술은 넣지 않음 |
| `skills[].name` | 원문에 나온 기술명, 또는 원문의 **구체 항목을 묶는 상위 범주** (싱글톤·Strategy → "디자인 패턴", `csharp` 코드 → "C#") |
| `skills[].evidence[].text` | "무엇을 만들었는지" 한 줄(40자 내외). 기술 문서에 있는 사실만. 상위 범주로 묶었다면 **원문의 구체 용어**를 문장에 넣음 |
| `skills[].evidence[].project` | 근거 프로젝트의 **폴더 이름** |
| `projects` | 표시 순서대로 폴더 이름 배열. profile.md `프로젝트 순서`가 있으면 그 순서 |

## `data/projects/<폴더 이름>.json`

```json
{
  "id": "1-action-platformer",
  "doc": "기술문서.md",
  "title": "Switch Strike",
  "tagline": "교대 한 번으로 위기를 반격 기회로 바꾸는 2D 사이드뷰 액션 플랫포머",
  "cover": "images/cover.png",
  "team": { "type": "solo", "size": "1인", "role": "" },
  "meta": [
    { "label": "장르", "value": "2D 사이드뷰 액션 플랫포머" },
    { "label": "기간", "value": "2주 (2026.06.24 ~ 2026.07.07)" },
    { "label": "인원", "value": "1인 개발" },
    { "label": "환경", "value": "Unity 6.3, C#, Rider" }
  ],
  "tags": ["Unity 6", "C#", "Kinematic 이동", "Animator FSM"],
  "links": {
    "github": "https://github.com/...",
    "video": "https://www.youtube.com/watch?v=...",
    "extra": [{ "label": "Notion", "url": "https://..." }]
  },
  "highlights": [
    {
      "title": "Kinematic 이동 컨트롤러",
      "what": "기능 설명 — 무엇을 하는가",
      "how": "구현 방법 — 구조·흐름·로직 순으로 한두 문장",
      "why": "선택 이유 — 대안과 비교한 근거",
      "section": "3. 이동 컨트롤러"
    }
  ],
  "troubleshooting": [
    {
      "title": "점프 이동 중 타일 모서리에 끼는 문제",
      "problem": "이슈 상황",
      "cause": "원인 분석",
      "solution": "해결 방법",
      "result": "결과",
      "lesson": "배운 점·회고 (원문에 있을 때만)",
      "section": "3.8 트러블슈팅: 점프 이동 중 타일 모서리에 끼는 문제"
    }
  ],
  "screenshots": [
    { "src": "images/boss_intro.gif", "caption": "보스방 진입 연출" }
  ],
  "retro": {
    "achieved": ["달성한 것 — 측정값이 있으면 그대로"],
    "regrets": ["아쉬운 점(기술 부채)"],
    "plans": ["개선 계획"]
  }
}
```

| 필드 | 규칙 |
|---|---|
| `id` | **폴더 이름 그대로** (파일 이름과 같아야 함) |
| `doc` | 프로젝트 폴더 안 기술 문서 파일 이름 |
| `title` | 문서 제목에서 "기술 문서" 같은 꼬리를 뗀 프로젝트명 |
| `tagline` | 한 줄 소개 = 제목 바로 아래 인용문·부제, 또는 "한 줄 소개" 항목. 있으면 **그대로**. 없으면 What을 40자 내외로 압축 + "확인해 주세요" |
| `cover` | 대표 이미지. 문서가 "대표 이미지"로 지정한 것 → 없으면 첫 이미지 → 없으면 `null` |
| `team.type` | `"solo"` 또는 `"team"` |
| `team.size` | "1인", "3인"처럼 짧게. 중도 이탈 같은 사정은 `meta`의 인원에 |
| `team.role` | **팀: 필수.** 문서의 "내 역할/담당"을 그대로 (여러 곳이면 개요 표 우선). 없으면 `""` + 리포트 **필수**. **개인:** 담당 범위가 적혀 있을 때만, 없으면 `""` + 리포트 **참고**. "1인 개발"에서 "전체"를 유추하지 않음 |
| `meta` | 장르·기간·인원·환경 순(있는 것만). 문서의 개요 표에서 가져옴 (표가 여러 개면 맨 앞 개요 표 우선, 합쳤다면 "확인해 주세요"). 버전은 원문 그대로 |
| `tags` | 4~7개, **15자 내외의 짧은 키워드**. 개발 환경·주요 기술·본문에 실제로 나온 기술·패턴. 버전은 줄여도 됨(`Unity 6000.3.15f1` → `Unity 6.3`). IDE는 제외 |
| `links.*` | 문서·profile에 있는 URL만. `#`·빈 링크는 `""` + 리포트 **권장**. 저장소가 여럿이면 주 저장소를 `github`, 나머지는 `extra`(예: `서버 GitHub`). 기획서·전체 플레이 영상 등도 `extra` |
| `highlights` | **2~4개.** 핵심 시스템·기능, 또는 구조 섹션의 중요한 설계 결정. `why`는 같은 기능의 "고민과 선택" → 없으면 코드의 `(Why)` 주석·본문 설명 → 그래도 없으면 `""` + 리포트 **필수**. `how`와 `why`는 **같은 결정**을 말해야 함 |
| `troubleshooting` | **0~3개.** 트러블슈팅 섹션 우선, 없으면 본문의 문제→해결 서술. `result`는 **해결 뒤 달라진 점**만 — 없으면 `""` + 리포트 권장(배운 점을 `result`로 옮기지 않음). 배운 점·회고는 `lesson`. 한 절에 사례가 2개면 하나로 묶어도 됨 |
| `screenshots` | **최대 6장**, 이미지 파일(`.png .jpg .jpeg .gif .webp`)만. 6장보다 많으면 `highlights` 기능의 화면 우선 + 기능이 겹치지 않게. `caption`은 alt → 짧으면 주변 제목·표 머리와 조합(조합했으면 "확인해 주세요") |
| `retro` | 문서의 결과·회고 섹션에서. 각 배열 1~4개. 4개보다 많으면 개요의 Why와 관련이 큰 순. `regrets[i]`와 `plans[i]`는 같은 항목끼리 짝 |
| `section` | 원문 **제목 텍스트 그대로**(앞의 `#` 제외, 코드 블록 안의 `#` 줄은 제목 아님). `how`가 설명된 **가장 구체적인 하위 절** 우선. 렌더러가 이 텍스트로 원문 위치 링크를 만듦 (`★`·`①`·`:` 등 특수문자 그대로 두어도 됨) |

### "그대로"와 "압축"의 구분

- **그대로**: 굵게·기호 제거, 주어·어미 정리 정도만 한 경우. "확인해 주세요"에 넣지 않음.
- **압축**: 여러 문장을 합치거나, 표현을 바꾸거나, 여러 섹션을 조합한 경우. 반드시 "확인해 주세요"에 넣음.

### 경로 규칙

- `cover`, `screenshots[].src`는 **프로젝트 폴더 기준 상대경로** (`images/...`). 문서에 적힌 경로 그대로.
- 실제 파일 이름과 **대소문자까지 일치**해야 합니다 (GitHub Pages는 대소문자를 구분).
- 텍스트 필드에는 마크다운을 쓰지 않습니다. 단, 코드명은 `` `백틱` ``을 써도 됩니다 (렌더러가 코드 스타일로 표시).
