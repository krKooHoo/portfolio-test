---
name: portfolio-intake
description: 수강생의 GitHub 레포(또는 로컬 폴더)에서 포트폴리오 재료를 뽑아 src/<NN-이름>/에 핵심 .cs와 "재료집 + 질문지", "촬영 목록"을 만든다. 기술 문서를 대신 쓰지 않는다. 사용자가 /portfolio-intake를 직접 입력했을 때만 실행.
argument-hint: "<레포 주소 | owner/repo | 로컬 폴더 경로> [NN-폴더이름] [--branch <이름>] [--update]"
disable-model-invocation: true
---

# /portfolio-intake — GitHub 재료 추출

대상: `$ARGUMENTS`

수강생의 Unity 레포에서 **코드와 커밋 기록으로 확인되는 사실**만 뽑아 기술 문서의 재료를 만듭니다.
기술 문서(`기술문서.md`)는 **수강생이 직접** 씁니다. 이 명령이 만드는 것은 재료집(사실 + 질문)과 촬영 목록, 핵심 `.cs` 사본뿐입니다.

시작 전에 `CLAUDE.md`의 **반드시 지킬 원칙**을 다시 확인합니다. 이 명령에서 특히 중요한 것:

- **지어내지 않는다** — 재료집의 문장은 모두 ✅사실(근거 `경로:줄`·커밋 해시) / ❓질문 / ⚠추정 셋 중 하나입니다.
- **대신 쓰지 않는다** — 기능을 설명하는 문장("…을 처리하는 매니저입니다"), What·Why·고민과 선택·배운 점은 한 글자도 쓰지 않습니다. 그것이 수강생이 쓸 글입니다.
  수강생이 "질문에 대신 답해 줘"라고 하면 정중히 거절하고 가이드 원칙(*"내 코드를 설명할 줄 안다"*, `format/02-tech-document.md` 끝)을 안내합니다. 사실 표를 문서로 옮기는 것은 도와도 됩니다.
- **비밀값을 보지도 옮기지도 않는다** — 아래 §5. 값이 Claude의 화면(도구 출력)에 나오는 명령을 쓰지 않습니다.
- **남의 코드·개인정보를 공개 레포에 올리지 않는다** — 레포는 공개라서 `src/`에 들어간 것은 누구나 봅니다.

## 셸·경로 규칙

- git과 파이프 명령은 **Bash 도구(Git Bash)** 한 가지로 씁니다. 매번 **절대 경로**를 씁니다(호출마다 작업 폴더가 처음으로 돌아갑니다). `git -C "<폴더>" …` 형식을 씁니다.
- 임시 폴더는 **레포 밖의 짧은 경로**에 만듭니다: `T="$(cygpath -u "$LOCALAPPDATA")/Temp/pfi/$(date +%H%M%S)"`. 레포 안에 만들지 않습니다.
- 복제는 먼저 그냥 실행하고, 10초 안에 끝나지 않으면(큰 레포) `run_in_background`로 다시 실행해 완료 알림을 기다립니다. 그때 수강생에게 "레포를 받는 중입니다(1~5분 걸릴 수 있습니다)"라고 알립니다.
- **Git Bash는 `/`로 시작하는 인자를 Windows 경로로 바꿉니다**(`'/ProjectSettings/…'` → `C:/Program Files/Git/ProjectSettings/…`, 오류 없이 조용히). 그래서 sparse 패턴은 반드시 `--stdin`으로 넘기고, 넘긴 뒤 `sparse-checkout list`로 확인합니다(§2-A).
- 경로에 공백·점이 든 폴더(`98. Test/`)가 흔합니다. 파일 목록은 `find … -print0 | xargs -0 …` 또는 `git ls-files -z`로 다룹니다.
- `.cs` 파일은 **반드시 `cp`로 복사**합니다(Read → Write로 옮기지 않음: BOM·줄 끝·탭이 바뀝니다). 복사 뒤 `git hash-object`로 원본과 같은지 확인합니다.
- 재료집·리포트 같은 새 파일은 Write 도구로 씁니다. Write 도구가 막히는 환경이면 Bash `cat > "<경로>" <<'EOF'`로 씁니다.

## 0. 준비

1. `git --version`. 실패하면 멈추고 Git for Windows 설치를 안내합니다(설치는 수강생이 직접). 2.37 미만이면 §2의 sparse 대신 대체 경로를 씁니다.
2. 읽을 기준: `format/02-tech-document.md`(5단 구조·있으면 좋은 항목), `format/01-portfolio.md`(스크린샷·영상), `format/03-diagrams.md`, 그리고 [templates.md](templates.md)(재료집·촬영목록 형식).
3. `profile.md`의 GitHub 줄에서 수강생 아이디를 읽어 둡니다(예시 값 `your-id`면 비워 둠).

## 1. 대상 확인(대화 한 번)

1. 인자 해석: `https://github.com/o/r(.git)`, `git@github.com:o/r.git`, `o/r` → `https://github.com/o/r.git`. 로컬 폴더 경로면 §2-B.
2. 접근 확인은 **로그인 창을 띄우지 않고** 바로 판정합니다:
   `GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never timeout 60 git ls-remote --symref <url> HEAD`
   - 실패(`Repository not found` 등)하면: "레포가 비공개이거나 주소가 틀렸을 수 있습니다. 주소를 확인해 주세요. 비공개 레포라면 ① 레포를 직접 clone하거나 ZIP으로 받아 그 폴더 경로로 다시 실행하거나, ② '로그인해서 받아 줘'라고 말씀해 주세요(브라우저 창이 뜨면 직접 로그인)"라고 안내하고 멈춥니다.
   - ②를 고르면 `GCM_INTERACTIVE` 없이 `run_in_background`로 다시 확인하고 기다립니다. Claude는 토큰·비밀번호를 **입력하지 않습니다**.
3. 폴더 이름 **제안**을 먼저 만듭니다: `src/`의 기존 번호 다음 번호 + 레포 이름(대문자 경계·공백·`_`를 `-`로 바꾸고 영문 소문자, 예: `TidyMommy` → `3-tidy-mommy`). 폴더 이름은 데이터 `id`가 되고 `project.html?p=`·`doc.html?p=` 주소에 그대로 나오므로 "나중에 바꾸면 공유한 주소가 깨집니다"를 함께 알립니다.
   - 샘플 프로젝트(`src/00-example-crafting`, `0-Tidy-Mommy`, `1-action-platformer`, `2-Yggdrasil`) 중 **같은 프로젝트**가 있으면(샘플 `data/projects/*.json`의 `links.github`가 같은 레포이거나 제목이 같으면) "같은 게임의 샘플이 들어 있습니다. 샘플은 선배 작품이라 내용을 옮기면 안 되니, 먼저 그 샘플 폴더와 데이터를 지워 주세요"라고 알립니다. 수강생 답(영상 링크 등)이 샘플 문서의 값과 같으면 한 번 더 확인합니다.
4. 아래를 **번호 목록 하나로 한 번에** 묻습니다.
   1. 폴더 이름(제안: `…`) 그대로 쓸까요?
   2. 개인 프로젝트인가요, 팀 프로젝트인가요?
   3. 수업에서 받은 코드나 에셋 스토어·외부에서 가져온 코드가 들어 있나요? 있다면 어느 폴더인가요?
   4. 시연 영상 링크가 이미 있나요? (있으면 주소)
5. 대상 폴더 `src/<NN-이름>/`이 이미 있으면 멈추고 묻습니다. `--update`일 때만 계속하고, 그때도 §7의 규칙대로 `code/`(이 명령이 넣은 파일)·`_intake/`만 다시 씁니다. `기술문서.md`·`images/`는 **어떤 경우에도 덮어쓰지 않습니다**.

## 2. 받기

### 2-A. GitHub 주소

```bash
T="$(cygpath -u "$LOCALAPPDATA")/Temp/pfi/$(date +%H%M%S)"; mkdir -p "$(dirname "$T")"
git clone --filter=blob:none --no-checkout --single-branch [--branch <b>] \
  -c core.longpaths=true -c core.quotepath=false -c core.autocrlf=false -c diff.renames=false \
  "<url>" "$T"
```

`-c`는 **clone 뒤에** 둡니다(그래야 받은 레포의 설정에 남아 다음 명령에도 적용됨). 그다음 Unity 프로젝트 위치를 찾습니다:
`git -C "$T" ls-tree -r --name-only HEAD | grep -E '(^|/)ProjectSettings/ProjectVersion\.txt$'`
— 하위 폴더에 있으면 그 폴더를 `<R>`(루트 접두어)로 씁니다. 여러 개(클라이언트·서버 모노레포)면 수강생에게 고르게 합니다. 하나도 없으면 "Unity 프로젝트가 아닌 것 같습니다"라고 알리고 계속할지 묻습니다.

```bash
git -C "$T" sparse-checkout set --no-cone --stdin <<'EOF'
/<R>ProjectSettings/ProjectVersion.txt
/<R>ProjectSettings/EditorBuildSettings.asset
/<R>ProjectSettings/ProjectSettings.asset
/<R>Packages/manifest.json
/<R>Packages/packages-lock.json
/README*
/*.md
/<R>Assets/**/*.cs
/<R>Assets/**/*.asmdef
/<R>Assets/**/*Setting*.asset
/<R>Assets/**/*Config*.asset
/<R>Assets/**/google-services.json
/<R>Assets/StreamingAssets/**/*.json
EOF
git -C "$T" sparse-checkout list | head -3        # 줄이 '/'로 시작해야 함(C:/…로 바뀌었으면 잘못 넘긴 것)
GIT_LFS_SKIP_SMUDGE=1 git -C "$T" checkout
test -f "$T/<R>ProjectSettings/ProjectVersion.txt" && echo OK   # 없으면 sparse가 잘못된 것 — 고친 뒤 다시
```
(`<R>`가 빈 문자열이면 `/ProjectSettings/…`처럼 그대로 씁니다.)

- 10분 안에 끝나지 않거나 서버가 `--filter`를 받지 않으면 `--depth=1`로 다시 받고, 커밋 기록으로 만드는 항목(기간·작성자·버그 후보)은 비운 채 "얕게 받아 커밋 기록이 없습니다"라고 적습니다.
- git 2.37 미만: sparse 대신 `git -C "$T" ls-tree -r --name-only HEAD`로 위 패턴에 맞는 경로 목록을 만든 뒤 `git -C "$T" checkout HEAD -- <목록>`.
- `Assets` 아래 `.cs`가 2,000개를 넘으면 외부 패키지가 통째로 들어온 것일 수 있습니다. 상위 폴더별 개수를 보여 주고 뺄 폴더를 묻습니다.

### 2-B. 로컬 폴더

`.git`이 있으면 받지 않고 그 폴더를 `$T`로 삼아 §3부터(원본은 읽기만, 아무것도 쓰지 않음). `.git`이 없으면(ZIP) 커밋 기록 항목을 비우고 "ZIP이라 커밋 기록이 없습니다 — 기간·인원은 직접 쓰세요"라고 적습니다.

## 3. 사실 뽑기

모든 ✅ 항목에는 근거(`경로:줄` 또는 커밋 해시 7자리)를 붙입니다. 커밋 기록 명령에는 항상 `--no-renames`를 붙입니다(blob을 하나씩 내려받는 느린 명령 — `--numstat`, `--follow`, `blame -C` — 는 쓰지 않음).

| 사실 | 어디서 | 표시 |
|---|---|---|
| Unity 버전 | `ProjectSettings/ProjectVersion.txt`의 `m_EditorVersion` | ✅ 원문 그대로(줄이지 않음) |
| 패키지 | `Packages/manifest.json` dependencies 이름·버전 | ✅ 표. 패키지 이름을 기술명으로 바꿔 부른 것(`com.unity.render-pipelines.universal` → URP)은 ⚠ |
| 외부 코드 후보 | `Assets/` 바로 아래·한 단계 아래 폴더 이름(`Plugins`, `ThirdParty`, `DOTween`, `Demigiant`, `TextMesh Pro`, `Photon`, `Mirror`, `UniTask`, `Odin` 등), `.asmdef` 이름, 수강생이 §1-4-3에서 알려 준 폴더 | ✅ 경로. 무엇에 썼는지는 ❓. 수강생이 말한 폴더·에셋이 트리·`manifest.json`·`using`에 없으면 "없음(근거)"으로 적습니다. 수강생이 "어느 폴더인지 모른다"고 하면 이름·`using`(WebSocket·Room 등)으로 후보 파일을 보여 주고 **파일 단위로 다시 묻고**, 답을 받기 전까지 그 후보는 복사하지 않습니다 |
| 코드가 쓰지만 레포에 없는 것 | `using` 네임스페이스 중 트리에도 `manifest.json`에도 없는 것(예: `Sirenix.OdinInspector`, `DG.Tweening` — 유료 에셋을 커밋하지 않은 경우) | ✅ "코드가 참조하지만 레포에 없음"(`파일:줄`, 쓰는 파일 수). 개발 환경 질문(❓)으로 연결 |
| 씬 | 트리의 `*.unity` 경로(내려받지 않고 `ls-tree`로만), `EditorBuildSettings.asset`의 `m_Scenes` 순서 | ✅ 빌드 포함/미포함 구분 |
| 제품 이름 | `ProjectSettings.asset`의 `productName` | ✅ 제목 후보(`companyName`은 적지 않음 — 개인정보일 수 있음) |
| 스크립트 구조 | 외부 코드를 뺀 `.cs`의 폴더별 개수, 클래스·인터페이스·enum 이름, 상속(`: MonoBehaviour` 등), 줄 수 | ✅ 클래스 표(이름·`파일:줄`·상속·줄 수). 메서드·줄 범위를 적을 때는 **선언 줄 ~ 그 메서드를 닫는 `}` 줄**(뒤 빈 줄·`#region`·다음 메서드 주석은 넣지 않음). 적기 전에 `sed -n '<끝줄>p'`로 `}`인지 확인 |
| 참조 관계 | 클래스 이름이 다른 `.cs`에 나오는 파일 수(문자열 검색, `grep -rlw`). `partial` 클래스는 정의 파일을 **모두** 뺀 수 | ⚠ — 측정 방법을 괄호에("이름이 나오는 파일 수"). `User`·`Board`·`Player`처럼 흔한 낱말 이름은 "많게 잡혔을 수 있음"을 덧붙임 |
| 기간 후보 | 첫 커밋 `git -C "$T" log --date=short --format=%ad \| tail -1`, 마지막 `git -C "$T" log -1 --date=short --format=%ad`, `Assets/`를 바꾼 마지막 커밋 `git -C "$T" log -1 --date=short --format='%h %ad' -- '<R>Assets'`, 커밋 수 | ✅ "커밋 기준(작성자 날짜)" 접두어 필수. 코드가 아닌 파일(README 등)만 바뀐 커밋이 뒤에 있으면 그 사실도 적음. 실제 기간은 ❓ |
| 인원 후보 | `git -C "$T" shortlog -sne --no-merges HEAD`의 **계정 수** | ✅ "커밋 계정 N개". 이름이 같거나 같은 GitHub 아이디(noreply)인 계정은 한 사람일 수 있으므로 ⚠ "한 사람의 여러 이메일일 수 있음". 이름·이메일은 재료집에 쓰지 않음 |
| 커밋이 아주 적은 레포 | 커밋 5개 미만이거나 `.cs`의 90% 이상이 한 커밋에 들어 있음(다른 곳에서 만든 뒤 한꺼번에 올린 레포) | ✅ 그 사실. 기간·버그 후보·작성 비율은 "기록 없음"으로 두고, 원래 작업한 레포가 따로 있는지 ❓ |
| 버그 수정 후보 | 강한 신호 `--grep`(`fix\|bug\|버그\|오류\|crash\|NRE\|null\|freeze\|튕김\|exception`, `-i -E`)만 표에, 최대 15행. 약한 신호(`수정\|해결`)는 개수만. 파일은 `--name-only --no-renames` | 해시·날짜·파일은 ✅, "버그 수정"이라는 라벨은 ⚠(메시지 낱말로 고른 후보) |
| README | 위치(`README.md:3-5`)와 첫 문장 앞 40자 | ✅ 위치만. 그대로 옮기지 않음(팀원·AI가 썼을 수 있음). What/Why로 쓰지 않음(❓ 유지). README 안의 수치(기간·인원)가 커밋 기록과 다르면 "어느 쪽이 맞나요?" ❓만 둠 |
| 태그·릴리스 | `git -C "$T" tag -l --sort=creatordate` | ✅ 있으면 |

**커밋 메시지**: 개인 프로젝트는 메시지 원문을 표에 넣어도 됩니다. 단 메시지에 `@`, URL, `#숫자`, 사람 이름으로 보이는 낱말이 있으면 그 줄은 해시·날짜·파일만 적고 원문은 `report-intake.md`(로컬)로 보냅니다. 팀 프로젝트는 §6의 "내 계정" 커밋만 원문을 넣고, 남의 커밋은 해시·날짜·파일만 적습니다.

## 4. 핵심 .cs 고르기 (6~12개, 합계 1,500줄 안팎)

목적: ① 수강생이 기술 문서에 50줄 이내로 발췌할 원본 ② `/portfolio-build`가 문서 코드와 실제 코드를 대조하는 표본.

먼저 **빼고**, 남은 것에 점수를 줍니다. 점수는 추천일 뿐이고 최종 목록은 수강생이 정합니다.

| 빼기 | |
|---|---|
| 외부 코드 후보 폴더(§3), `Packages/`, `Library/` | 남의 코드 |
| `*.Designer.cs`, `*.g.cs`, 머리 5줄에 `<auto-generated>` | 생성 코드 |
| 머리 20줄에 `Copyright`·`License`·`All rights reserved`·`Asset Store` 주석이 있는 파일 | 외부에서 가져와 고친 코드일 수 있음 → 리포트에 적고 수강생에게 확인 |
| 비밀값이 의심되는 파일(§5) | |
| (팀) 내 작성 비율이 낮은 파일(§6) | |

| 점수 | 재는 법 |
|---|---|
| 참조 관계 상위 | §3의 "이름이 나오는 파일 수" |
| 버그 수정 후보 커밋이 건드린 파일 | §3 |
| 커밋이 많이 건드린 파일 | `git -C "$T" log --format= --name-only --no-renames -- '<R>Assets/*.cs' \| sort \| uniq -c \| sort -rn`(pathspec의 `*`는 하위 폴더까지 맞음). 폴더를 옮긴 기록이 있으면 같은 파일이 경로별로 나뉘므로 **파일 이름 기준으로 합산**하고, 옮긴 사실을 ⚠로 적음 |
| 이름에 `Manager·Controller·System·State·Server·Handler·Spawner` | 조금 |
| 50~600줄 | 600줄 넘으면 리포트에 "나눠서 발췌하세요". 50줄 미만이라도 참조가 많으면 넣어도 됨 |
| `Editor/` 폴더 | 감점 |

작은 프로젝트(외부 코드를 뺀 `.cs`가 15개 안팎)는 전부가 후보여도 됩니다. 저작권 주석 때문에 뺀 외부 파일을 내 코드가 호출하면, 그 호출 줄(`파일:줄`)을 재료집의 외부 코드 항목에 ✅로 적습니다(무엇을 가져다 썼는지 수강생이 밝힐 수 있게).

고른 목록(파일·줄 수·고른 이유 한 줄 — 이유는 ⚠ 추천)을 보여 주고 **넣고 뺄 파일을 묻습니다**. 확인을 받은 뒤 `cp`로 `src/<NN-이름>/code/`에 평면 배치합니다. 같은 이름이 둘이면 상위 폴더 이름을 앞에 붙이고(`UI_Player.cs`) 원래 경로를 `intake.json`에 적습니다.

## 5. 비밀값 검사 (Read보다 먼저)

검사 대상: 고른 `.cs` 후보 전부 + sparse로 받은 `*Setting*.asset`·`*Config*.asset`·`google-services.json`·`StreamingAssets/**/*.json` + 루트 README.
**값이 화면에 나오지 않게** 파일 이름·줄 번호만 출력합니다(Grep 도구는 `files_with_matches`/`count`만, 또는 아래처럼 `cut`으로 값을 잘라 냄). 걸린 파일은 Read하지 않습니다.

```bash
git -C "$T" grep -n -I -E -e 'AKIA[0-9A-Z]{16}' -e 'AIza[0-9A-Za-z_-]{35}' -e 'gh[pousr]_[A-Za-z0-9]{36,}' \
  -e 'xox[baprs]-[A-Za-z0-9-]+' -e 'eyJ[A-Za-z0-9_-]+\.eyJ' -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
  -e '(api[_-]?key|secret|token|passw(or)?d|pwd|app_?id)[^=:\n]{0,20}[:=][[:space:]]*"[^"]{8,}"' \
  -e '(Server|Host|Data Source)=[^;]*;[^"]*(Password|Pwd)=' -e 'https?://[^/[:space:]:]+:[^@[:space:]]+@' \
  -i -- <파일들> | cut -d: -f1,2
```

트리에 `PhotonServerSettings.asset`·`google-services.json`·`*.keystore`·`.env`가 **있다는 사실**은 `ls-tree`로 확인해 리포트에 "있음 — 직접 열어 확인하세요"라고 적습니다(열지 않음).

서버 주소 리터럴(`ws://`·`wss://`·점 네 개 IP)은 같은 방식(`-e 'wss?://' -e '([0-9]{1,3}\.){3}[0-9]{1,3}'` → `cut -d: -f1,2`)으로 **위치만** 찾아 리포트에 "공개해도 되는 주소인지 확인하세요"로 적습니다. 이것만으로는 복사를 막지 않습니다.

걸리면:
1. 그 파일은 **복사하지 않습니다**(값을 가려서 복사하지도 않음 — 수강생 코드를 고쳐 쓰는 일이 됨).
2. `report-intake.md`에 `파일:줄`·패턴 종류만 적습니다. 재료집에는 "비밀값이 의심되어 뺀 파일 N개(자세한 위치는 report-intake.md)"만.
3. 레포가 공개이고 커밋 기록에 남아 있으면 **필수**로: "그 키는 폐기하고 새로 발급하세요. 기록에서 지우는 것만으로는 부족합니다." Claude가 대신 폐기하지 않습니다.
4. 수강생이 직접 열어 보고 "테스트용 가짜 값이라 괜찮다"고 확인한 파일만 복사합니다.

## 6. 팀 프로젝트: 내 코드만

1. `git -C "$T" shortlog -sne --no-merges HEAD`(이름·이메일·커밋 수)를 **대화창에만** 보여 주고 "이 중 본인 계정을 모두 골라 주세요(여러 개 가능)"라고 묻습니다. 이 목록은 파일에 쓰지 않습니다.
   GitHub noreply 주소는 `(^|\+)<아이디>@users\.noreply\.github\.com$` 형식도 본인으로 봅니다. `--author`에는 `^<이메일>$`처럼 앞뒤를 고정한 값을 씁니다.
2. 파일마다 커밋 기준 작성 비율: `git -C "$T" log --no-renames --format=%ae -- <파일>`에서 본인 이메일 비율. 60% 이상 = 내 코드, 30~60% = 공동(수강생 확인), 30% 미만 = 뺌.
   **커밋이 아주 적은 레포**(§3)는 비율이 뜻이 없습니다(한 사람이 한꺼번에 올림). 비율을 쓰지 말고, 후보 파일 목록을 보여 주며 "이 중 직접 만든 파일을 골라 주세요"라고 파일 단위로 묻습니다. 답을 받은 파일만 복사합니다.
3. 줄 기준 비율(`git blame -w --line-porcelain`)은 **선택**입니다. 후보 12개 이하이고 빨리 끝날 때만 쓰고, 느리면 건너뜁니다(blob을 받아야 해서 큰 레포에서 오래 걸림).
4. 공동 파일은 복사 전에 한 번 묻습니다: "팀원 코드가 섞여 있습니다. 공개 레포에 올려도 되는지 팀원에게 동의를 받았나요?" 답이 없거나 아니면 복사하지 않습니다.
5. 재료집에는 파일마다 "커밋 기준 내 비율 n%" ✅와 "실제로 맡은 부분이 맞나요?" ❓를 둡니다. 한계도 적습니다: squash 병합·한 사람 PC에서 커밋·공동 작성·포매팅 커밋은 작성자가 잘못 잡힙니다. 최종 판단은 수강생입니다.

## 7. 쓰기

```
src/<NN-이름>/
├── code/            # 핵심 .cs (cp로 복사한 원본 그대로)
└── _intake/         # 재료 — build·check·doc.html이 읽지 않는 자리. git에 올라가지 않음(.gitignore)
    ├── 재료집.md
    ├── 촬영목록.md
    └── intake.json  # 출처 url · 커밋 SHA · 받은 날짜 · 루트 접두어 · 고른 파일과 원래 경로 · GitHub 아이디(§6에서 확인한 아이디, 없으면 profile.md — 이메일은 넣지 않음)
```

- `기술문서.md`는 **만들지 않습니다**(빈 틀이라도 만들면 build가 그것을 기술 문서로 집어 배포합니다). `images/`도 만들지 않습니다(빈 폴더는 git에 남지 않음) — 촬영목록에서 "images/ 폴더를 만들어 넣으세요"라고 안내합니다.
- 재료집·촬영목록 형식은 [templates.md](templates.md)를 그대로 따릅니다. 5단 구조는 `format/02-tech-document.md`와 같은 번호·제목입니다.
- **클래스 다이어그램 초안**(결정 H1): 참조 관계 상위 10개 이하 클래스만, 코드에서 읽은 관계만으로 `classDiagram`을 그리고 머리에 ⚠ 안내를 붙입니다("코드에서 읽은 관계만입니다. 무엇을 보여 줄 그림인지 한 줄 설명과 가지치기는 여러분이 하세요"). 관계의 뜻(역할)을 라벨로 쓰지 않습니다.
- `--update`: `intake.json`에 적힌 파일만 `code/`에서 바꾸고(수강생이 직접 넣은 파일은 그대로), `_intake/`는 새로 씁니다. 바뀐 파일 목록을 알려 줍니다.

**쓰기 전 검증** (하나라도 아니면 고친 뒤 씀)
- [ ] ✅ 행마다 근거(`경로:줄`·해시)가 있다. 장르·What·Why·역할·고민을 코드에서 유추해 쓴 문장이 없다
- [ ] 질문에 Claude가 고른 대안 예시("A vs B")가 없고, ⚠ 항목·촬영목록은 식별자·구문 이름의 명사구다(`재사용한다`·`선택한다`처럼 동작을 설명하는 말이 없다)
- [ ] 메서드 줄 범위의 끝 줄이 그 메서드를 닫는 `}`다. 개수(클래스 수·씬 수·패키지 수)를 다시 세어 맞췄다
- [ ] 재료집·촬영목록·intake.json에 남의 이름·이메일, `companyName`, 비밀값, 남의 커밋 메시지 원문이 없다
- [ ] `.cs`는 `cp`로 복사했고 `git hash-object` 값이 원본과 같다
- [ ] 폴더 이름이 확인받은 것과 대소문자까지 같다
- [ ] `기술문서.md`·`images/`를 만들거나 바꾸지 않았다

## 8. 리포트와 마무리

1. `report-intake.md`(레포 루트, 로컬 전용 — `.gitignore`)에 씁니다. `report.md`는 build·check가 덮어쓰므로 쓰지 않습니다.
   - `## 꼭 처리할 것`: 비밀값 의심(`파일:줄`·패턴 종류), 공개 레포에 이미 올라간 키
   - `## 확인해 주세요`: 재료집의 ⚠ 항목 전부(원칙 3)
   - `## 뺀 파일과 이유`, `## 작성자 분석`(팀: 계정 수·본인으로 고른 계정 수·파일별 비율 — **이름·이메일은 적지 않음**, §6-1), `## 받기 문제`(얕은 받기·LFS 포인터·큰 레포·커밋이 아주 적음)
2. 임시 폴더를 지웁니다(로컬 폴더 인자일 때는 지우지 않음): `rm -rf "$T"` → 실패하면 `cmd //c rmdir /s /q "$(cygpath -w "$T")"` → 그래도 남으면 경로를 알려 주고 직접 지워 달라고 합니다. 비어 있는 부모 폴더도 `rmdir "$(dirname "$T")" 2>/dev/null`로 지웁니다.
3. 대화창에 짧게 알립니다: 만든 경로, 고른 `.cs` 수, 질문 수, 촬영 항목 수, 임시 폴더를 지웠는지, 그리고 **다음 할 일**:
   1. `src/<NN-이름>/_intake/재료집.md`의 질문에 답하며 `src/<NN-이름>/기술문서.md`를 **직접** 씁니다(구조는 샘플 `src/00-example-crafting/기술문서.md` 참고).
   2. `_intake/촬영목록.md`대로 스크린샷·GIF를 찍어 `src/<NN-이름>/images/`에 넣습니다. 영상은 YouTube 등에 올려 링크로.
   3. `/portfolio-check <NN-이름>`으로 점검 → 고치기.
   4. `/portfolio-build <NN-이름>`.
   - `report-intake.md`의 "꼭 처리할 것"이 있으면 지금 처리하라고 덧붙입니다.
   - 처음 넣은 내 프로젝트라면, 샘플 프로젝트 4개와 그 `data/projects/*.json`을 지우라고 안내합니다(CLAUDE.md 폴더 규약).
