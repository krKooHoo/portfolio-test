// 문구 표(스트링 테이블) — 포트폴리오 문서·발표 덱·상세 문서의 UI 문구(절 이름·버튼·라벨) 기본값 + theme/strings.tsv 읽기
//   기본 문구는 아래 ROWS 한 곳에만 있습니다. 수강생은 theme/strings.tsv의 "내 문구"(맨 끝 칸)로 바꿉니다(렌더러를 고치지 않음). 빈 칸 = 기본 문구
//   자리표시: {name.deck}처럼 점이 있으면 다른 키의 문구(3단계까지), {n}처럼 점이 없으면 렌더러가 넣는 값
//   data의 정해진 어휘(장면 탭·카드 라벨)는 data 값을 그대로 두고 화면에서만 바꿉니다(색·영문 짝은 원래 단어로 판정) → tab()·label()
//   표에 없는 것: 점검·진단 문구, 콘솔, 안내 화면(데이터 없음·file://), 화면 읽기 프로그램 전용 라벨(aria-label·alt), 발표 덱의 PDF 저장 안내(? 버튼)
//   theme/strings.tsv를 새로 만들기(템플릿 유지관리용 — 수강생 레포에서는 실행하지 않음. 수강생이 고친 칸이 지워짐):
//     node -e "process.stdout.write(require('./assets/strings.js').tsv())" > theme/strings.tsv
//   점검: PFStr.report() — 포트폴리오 문서 PFPage.report().strings · 발표 덱 PFScene.report().info.strings · 상세 문서 PFDoc.report().strings
const PFStr = (() => {
  // [키, 기본 문구, 보이는 곳, 권장 글자 수(자리표시 하나 = 2자), 'en' = 영문 라벨 칸]
  const ROWS = [
    // ── 공통 이름(여러 페이지·여러 줄이 {name.…}으로 끌어 씀) ──
    ['name.portfolio', '포트폴리오', '공통 · 포트폴리오 문서의 이름(브라우저 탭 제목·발표 덱 링크 카드)', 10],
    ['name.deck', '발표 덱', '공통 · 발표 덱의 이름(버튼·링크·탭 제목)', 8],
    ['name.doc', '상세 기술문서', '공통 · 상세 기술문서의 이름(버튼·링크·탭 제목)', 10],
    ['name.doc-short', '상세 문서', '공통 · 상세 기술문서의 짧은 이름(한눈에 보기 링크·발표 덱 휴대폰 안내)', 6],
    ['name.video', '시연 영상', '공통 · 시연 영상 링크', 8],
    ['name.role', '내 역할', '공통 · 프로젝트 정보의 역할 항목', 8],
    ['name.role-short', '역할', '포트폴리오 문서 · 한눈에 보기의 역할 항목', 4],
    ['name.intent', '개발 의도', '포트폴리오 문서 프로젝트 소개 · 발표 덱 표지', 8],
    ['name.team', '팀 프로젝트', '공통 · 팀 프로젝트 표시(인원이 있으면 뒤에 · 인원)', 8],
    ['name.solo', '개인 프로젝트', '공통 · 개인 프로젝트 표시', 8],
    ['name.toc', '목차', '발표 덱 목차 장면 · 상세 문서 목차', 4],
    // ── 포트폴리오 문서(index.html) ──
    ['page.updated', '업데이트 {date}', '포트폴리오 문서 · 맨 위 오른쪽 날짜', 16],
    ['page.intro', '자기소개', '포트폴리오 문서 · 절 제목', 12],
    ['page.stack', '기술 스택', '포트폴리오 문서 · 절 제목', 12],
    ['page.stack-note', '근거 프로젝트와 함께', '포트폴리오 문서 · 기술 스택 절 오른쪽', 16],
    ['page.project-no', '{en.project} {no} / {total}', '포트폴리오 문서 · 프로젝트 절 위 작은 글', 20],
    ['page.features', '기능 소개', '포트폴리오 문서 · 기능 절 위 작은 글(프로젝트 번호 뒤)', 8],
    ['page.see-in-deck', '{name.deck}에서 보기', '포트폴리오 문서 · 기능마다 버튼', 12],
    ['page.deck-all', '{name.deck} 전체', '포트폴리오 문서 · 기능 절 아래 버튼', 10],
    ['page.glance', '프로젝트 요약', '포트폴리오 문서 · 한눈에 보기 절 제목', 12],
    ['page.nav-intro', '소개', '포트폴리오 문서 · 맨 위 메뉴', 6],
    ['page.nav-stack', '{page.stack}', '포트폴리오 문서 · 맨 위 메뉴', 6],
    ['page.nav-projects', '프로젝트', '포트폴리오 문서 · 맨 위 메뉴', 6],
    ['page.nav-glance', '한눈에 보기', '포트폴리오 문서 · 맨 위 메뉴', 6],
    ['page.nav-contact', '연락처', '포트폴리오 문서 · 맨 위 메뉴', 6],
    ['page.print-email', '이메일', '포트폴리오 문서 · 인쇄(PDF) 연락처 이름', 6],
    ['page.print-web', '웹 {name.portfolio}', '포트폴리오 문서 · 인쇄(PDF) 연락처 이름', 10],
    // ── 영문 라벨(영문 글꼴은 라틴 글자만 있음 — 한글을 넣으면 다른 글꼴로 보임) ──
    ['en.portfolio', 'PORTFOLIO', '포트폴리오 문서 맨 위 · 발표 덱 링크 카드', 14, 'en'],
    ['en.about', 'ABOUT ME', '포트폴리오 문서 · 자기소개 절 위', 14, 'en'],
    ['en.skills', 'SKILLS', '포트폴리오 문서 · 기술 스택 절 위', 14, 'en'],
    ['en.project', 'PROJECT', '포트폴리오 문서 프로젝트 절 위 · 발표 덱 표지', 10, 'en'],
    ['en.feature', 'FEATURE', '포트폴리오 문서 기능 목록 · 발표 덱 화면 카드(뒤에 번호)', 10, 'en'],
    ['en.glance', 'AT A GLANCE', '포트폴리오 문서 · 한눈에 보기 절 위', 14, 'en'],
    ['en.contact', 'CONTACT', '포트폴리오 문서 · 맨 아래 연락처', 14, 'en'],
    ['en.chapter', 'CHAPTER', '발표 덱 · 장 표지(뒤에 번호)', 10, 'en'],
    ['en.contents', 'CONTENTS', '발표 덱 · 목차 장면 제목', 12, 'en'],
    ['en.more', 'MORE', '발표 덱 · 맺음 장면 왼쪽 위', 10, 'en'],
    ['en.techdoc', 'TECH DOC', '발표 덱 · 상세 기술문서 링크 카드', 12, 'en'],
    ['en.link', 'LINK', '발표 덱 · 그 밖의 링크 카드', 12, 'en'],
    ['en.repo', 'REPOSITORY', '발표 덱 · GitHub 링크 카드', 12, 'en'],
    ['en.gameplay', 'GAMEPLAY', '발표 덱 · 시연 영상 링크 카드', 12, 'en'],
    ['en.role', 'ROLE', '발표 덱 표지 · 역할 항목 앞', 10, 'en'],
    ['en.intent', 'INTENT', '발표 덱 표지 · 개발 의도 앞', 10, 'en'],
    ['en.meta-genre', 'GENRE', "발표 덱 표지 · 메타 '장르' 앞", 12, 'en'],
    ['en.meta-duration', 'DURATION', "발표 덱 표지 · 메타 '기간'·'개발 기간' 앞", 12, 'en'],
    ['en.meta-team', 'TEAM', "발표 덱 표지 · 메타 '인원'·'팀'·'팀 구성' 앞", 12, 'en'],
    ['en.meta-env', 'ENVIRONMENT', "발표 덱 표지 · 메타 '환경'·'개발 환경' 앞", 12, 'en'],
    ['en.meta-engine', 'ENGINE', "발표 덱 표지 · 메타 '엔진' 앞", 12, 'en'],
    ['en.meta-platform', 'PLATFORM', "발표 덱 표지 · 메타 '플랫폼' 앞", 12, 'en'],
    // ── 발표 덱(project.html) ──
    ['deck.cover', '표지', '발표 덱 · 표지 장면 이름(아래 띠·개요)', 8],
    ['deck.cover-eyebrow', '{en.project} · {name.deck}', '발표 덱 · 표지 왼쪽 위', 20],
    ['deck.ch-count', '장면 {n}개', '발표 덱 · 장 표지 오른쪽 위', 10],
    ['deck.toc-count', '장면 {n}장', '발표 덱 · 목차 줄 설명', 10],
    ['deck.retro', '결과와 회고', '발표 덱 · 회고 장면 제목·목차', 12],
    ['deck.retro-eyebrow', '결과 · 회고', '발표 덱 · 회고 장면 왼쪽 위', 12],
    ['deck.retro-desc', '{deck.achieved} · {deck.regrets} → {deck.plans}', '발표 덱 · 목차의 회고 줄 설명', 24],
    ['deck.achieved', '달성', '발표 덱 · 회고 카드 머리(앞에 ✓)', 6],
    ['deck.regrets', '아쉬운 점', '발표 덱 · 회고 표 머리(앞에 △)', 8],
    ['deck.plans', '개선 계획', '발표 덱 · 회고 표 머리(앞에 →)', 8],
    ['deck.more', '더 보기', '발표 덱 · 맺음 장면 이름(아래 띠·목차)', 8],
    ['deck.more-desc', '{name.doc} · 링크', '발표 덱 · 목차의 맺음 줄 설명', 16],
    ['deck.end-title', '{name.doc}와 링크', '발표 덱 · 맺음 장면 제목(개요). 조사(와/과)를 이름에 맞게', 16],
    ['deck.end-doc', '{name.doc} — 코드·다이어그램·설계 과정 전문', '발표 덱 · 맺음 장면 큰 링크 카드', 30],
    ['deck.code-lines', '{a}~{b}줄 / 전체 {all}줄', '발표 덱 · 나뉜 코드 아래', 20],
    ['deck.mobile-doc', '휴대폰에서는 {name.doc-short}가 읽기 편합니다', '발표 덱 · 휴대폰 세로 화면 안내. 조사(가/이)를 이름에 맞게', 24],
    // ── 발표 덱 장면 탭(data의 tab 값 → 화면 글자) ──
    ['tab.overview', '개요', '발표 덱 · 장면 머리 오른쪽 라벨·장 표지 목록', 6],
    ['tab.structure', '구조', '발표 덱 · 장면 머리 오른쪽 라벨·장 표지 목록', 6],
    ['tab.flow', '흐름', '발표 덱 · 장면 머리 오른쪽 라벨·장 표지 목록', 6],
    ['tab.impl', '구현', '발표 덱 · 장면 머리 오른쪽 라벨·장 표지 목록', 6],
    ['tab.choice', '선택', '발표 덱 · 장면 머리 오른쪽 라벨·장 표지 목록', 6],
    ['tab.trouble', '문제 해결', '발표 덱 · 장면 머리 오른쪽 라벨·장 표지 목록', 6],
    ['tab.result', '결과', '발표 덱 · 장면 머리 오른쪽 라벨·장 표지 목록', 6],
    // ── 발표 덱 카드 라벨(data의 points[].label 값 → 화면 글자. 원문의 굵은 머리말은 그대로) ──
    ['label.feature', '기능', '발표 덱 · 카드 라벨', 6],
    ['label.impl', '구현', '발표 덱 · 카드 라벨', 6],
    ['label.reason', '이유', '발표 덱 · 카드 라벨', 6],
    ['label.problem', '문제', '발표 덱 · 문제 해결 칩', 6],
    ['label.cause', '원인', '발표 덱 · 문제 해결 칩', 6],
    ['label.solution', '해결', '발표 덱 · 문제 해결 칩(강조색)', 6],
    ['label.result', '결과', '발표 덱 · 문제 해결 칩(초록)', 6],
    ['label.lesson', '배운 점', '발표 덱 · 문제 해결 칩', 6],
    // ── 상세 문서(doc.html) ──
    ['doc.glance', '한눈에 · 링크', '상세 문서 · 제목 아래 접는 상자', 10],
    ['doc.deck-note', '{ui.newtab}. {name.deck}은 PC에서 보기 좋습니다.', '상세 문서 · 한눈에 상자 안내. 조사(은/는)를 이름에 맞게', 40],
    ['doc.rail-project', '이 프로젝트', '상세 문서 · 오른쪽 칸 제목', 10],
    ['doc.rail-now', '지금 읽는 절', '상세 문서 · 오른쪽 칸 제목', 10],
    ['doc.raw-md', '원문 마크다운', '상세 문서 · 오른쪽 칸 링크', 10],
    ['doc.raw-github', '원문 GitHub', '상세 문서 · 오른쪽 칸 링크', 12],
    ['doc.top', '맨 위로', '상세 문서 · 오른쪽 칸 링크(뒤에 ↑)', 6],
    ['doc.start', '문서 처음', '상세 문서 · 지금 읽는 절(맨 위에 있을 때)', 10],
    ['doc.now-none', '절 제목을 지나면 여기에 지금 읽는 절이 보입니다.', '상세 문서 · 지금 읽는 절(맨 위에 있을 때)', 30],
    ['doc.diagram-n', '다이어그램 {n}', '상세 문서 · 크게 보기 창의 다이어그램 이름(원문에 accTitle이 없을 때)', 12],
    ['doc.diagram-src', '다이어그램 원문', '상세 문서 · 다이어그램 아래 접는 상자', 10],
    ['doc.zoom', '크게 보기', '상세 문서 · 다이어그램 아래 버튼', 8],
    ['doc.links-list', '링크 목록', '상세 문서 · 인쇄(PDF) 문서 끝', 10],
    ['doc.print-web', '웹에서 보기', '상세 문서 · 인쇄(PDF) 맨 위 주소 이름', 10],
    // ── 화면 조작(인쇄·PDF에는 나오지 않음) ──
    ['ui.pdf', 'PDF로 저장', '포트폴리오 문서 맨 위 버튼 · 발표 덱 아래 띠', 8],
    ['ui.pdf-short', 'PDF', '발표 덱 · 아래 띠(좁은 화면)', 4],
    ['ui.pages', '{n}쪽', '발표 덱 · 아래 띠 PDF 버튼 옆 쪽 수', 5],
    ['ui.preparing', '준비 중…', '포트폴리오 문서 · PDF 버튼을 누른 뒤', 8],
    ['ui.newtab', '링크는 새 탭에서 열립니다', '발표 덱 아래 띠 · 상세 문서 맨 위', 16],
    ['ui.back', '← {name.portfolio}', '상세 문서 맨 위·맨 아래 · 발표 덱 맺음 카드', 12],
    ['ui.skip', '본문으로 건너뛰기', '세 페이지 · 키보드 Tab을 처음 누르면 보이는 링크', 12],
    ['ui.prev', '이전 (←)', '발표 덱 · 아래 띠 ‹ 버튼 툴팁', 16],
    ['ui.next', '다음 (→, Space, 휠)', '발표 덱 · 아래 띠 › 버튼 툴팁', 20],
    ['ui.overview', '개요', '발표 덱 · 아래 띠 버튼', 4],
    ['ui.overview-tip', '모든 슬라이드 보기 (O)', '발표 덱 · 개요 버튼 툴팁', 20],
    ['ui.to-scroll', '한 번에 보기', '발표 덱 · 아래 띠 보기 버튼(슬라이드 보기일 때)', 8],
    ['ui.to-scroll-short', '전체', '발표 덱 · 아래 띠 보기 버튼(좁은 화면)', 4],
    ['ui.to-scroll-tip', '모든 슬라이드를 세로로 이어서 보기(찾기 Ctrl+F가 모든 장에 닿음)', '발표 덱 · 보기 버튼 툴팁', 40],
    ['ui.to-deck', '슬라이드로 보기', '발표 덱 · 아래 띠 보기 버튼(한 번에 보기일 때)', 8],
    ['ui.to-deck-short', '슬라이드', '발표 덱 · 아래 띠 보기 버튼(좁은 화면)', 4],
    ['ui.to-deck-tip', '한 번에 한 장씩 보기', '발표 덱 · 보기 버튼 툴팁', 20],
    ['ui.print-anyway', '그래도 인쇄', '발표 덱 · 아래 띠(그림을 다 받지 못했을 때)', 8],
    ['ui.not-ready', '아직 다 그리지 못했습니다(이미지 {done}/{total})', '발표 덱 · 아래 띠 알림', 30],
    ['ui.loading-images', '이미지 {done}/{total} 불러오는 중', '발표 덱 · PDF 저장을 기다리는 동안', 24],
    ['ui.print-wait', '인쇄 준비 중…', '발표 덱 · PDF 저장을 기다리는 동안', 12],
    ['ui.ov-title', '슬라이드 개요', '발표 덱 · 개요 창 제목', 10],
    ['ui.ov-count', '{n}장', '발표 덱 · 개요 창 제목 옆', 5],
    ['ui.ov-hint', '화살표로 고르고 Enter · 닫기 Esc', '발표 덱 · 개요 창 안내', 30],
    ['ui.rotate', '가로로 돌리면 더 크게 보입니다.', '발표 덱 · 휴대폰 세로 화면 안내', 24],
    ['ui.close', '닫기', '상세 문서 · 목차 창 버튼', 4],
    ['ui.close-esc', '닫기 (Esc)', '상세 문서 · 크게 보기 창 버튼', 8],
  ];
  // theme/strings.tsv 맨 위 안내 줄(키가 #이면 읽을 때 건너뜀 — GitHub이 표로 보여 주도록 주석 줄 대신 칸 수를 맞춘 줄)
  const HELP = [
    ['#', '사용법: 맨 끝 "내 문구" 칸에 바꿀 글을 쓰면 세 페이지에 반영됩니다. 비워 두면 기본 문구. 키·보이는 곳·기본 문구 칸은 고치지 않습니다', '', ''],
    ['#', '{name.deck}처럼 점이 있는 { }는 다른 줄의 문구를 끌어 쓰고, {n}처럼 점이 없는 { }는 페이지가 숫자 등을 넣는 자리입니다(지우지 마세요)', '', ''],
  ];
  // data의 정해진 어휘 → 키(schema.md의 tab·points[].label 목록)
  const TAB = { '개요': 'tab.overview', '구조': 'tab.structure', '흐름': 'tab.flow', '구현': 'tab.impl', '선택': 'tab.choice', '문제 해결': 'tab.trouble', '결과': 'tab.result' };
  const LABEL = { '기능': 'label.feature', '구현': 'label.impl', '이유': 'label.reason', '문제': 'label.problem', '원인': 'label.cause',
                  '해결': 'label.solution', '결과': 'label.result', '배운 점': 'label.lesson' };

  const DEF = new Map(ROWS.map(([k, d, w, n, f]) => [k, { d, w, n, en: f === 'en' }]));
  const mine = new Map();                                              // 키 → 내 문구(theme/strings.tsv)
  const lineOf = new Map();                                            // 키 → 파일의 줄 번호
  const st = { file: '', loaded: false, encoding: '', rows: 0, issues: [] };
  const warned = new Set();
  const REF = /\{([a-z][a-z0-9-]*\.[a-z0-9.-]+)\}/g, VAR = /\{([A-Za-z_]\w*)\}/g;

  // 자리표시 {키} 풀기. own=false면 기본 문구만으로(비교용). 3단계를 넘으면(서로 가리킴) 남은 {키}를 그대로 둠
  function resolve(k, own = true, depth = 0) {
    const s = (own ? mine.get(k) : undefined) ?? DEF.get(k)?.d;
    if (s == null || depth > 3) return s ?? null;
    return s.replace(REF, (m, r) => resolve(r, own, depth + 1) ?? m);
  }
  function t(k, vars) {
    let s = resolve(k);
    if (s == null) { if (!warned.has(k)) { warned.add(k); console.warn('[strings] 기본 표에 없는 키:', k); } return k; }
    if (vars) s = s.replace(VAR, (m, v) => (v in vars ? String(vars[v]) : m));
    return s;
  }
  const tab = (v) => (TAB[v] ? t(TAB[v]) : v || '');
  const label = (v) => (LABEL[v] ? t(LABEL[v]) : v || '');

  // ── theme/strings.tsv 읽기 ──
  //   인코딩: UTF-8(BOM 있어도 됨) · UTF-16(엑셀 "유니코드 텍스트") · 그 밖은 CP949(엑셀 "텍스트(탭으로 분리)")로 다시 읽음
  function decode(buf) {
    const b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return ['utf-16le', new TextDecoder('utf-16le').decode(b)];
    if (b[0] === 0xFE && b[1] === 0xFF) return ['utf-16be', new TextDecoder('utf-16be').decode(b)];
    try { return [b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF ? 'utf-8-bom' : 'utf-8', new TextDecoder('utf-8', { fatal: true }).decode(b)]; }
    catch { return ['euc-kr', new TextDecoder('euc-kr').decode(b)]; }
  }
  const issue = (type, key, line, detail) => st.issues.push({ type, key, line, detail });
  const cell = (c) => { c = String(c ?? '').trim(); return c.length >= 2 && c[0] === '"' && c.at(-1) === '"' ? c.slice(1, -1).replace(/""/g, '"').trim() : c; };   // 엑셀이 붙인 따옴표
  // CP949로 저장하며 —·✓처럼 없는 글자가 ?로 바뀐 것뿐이면 "기본 문구를 고침"으로 보지 않음
  const lossy = (got, want) => { const a = [...got], b = [...want]; return a.length === b.length && a.every((ch, i) => ch === b[i] || ch === '?'); };
  // 칸: [키, 보이는 곳, 기본 문구, 내 문구]. 끝 탭이 지워진 줄(3칸) = 내 문구 없음, 2칸 = [키, 내 문구](직접 만든 짧은 표)
  function parse(text) {
    text.split(/\r\n|\n|\r/).forEach((line, i) => {
      const n = i + 1;
      if (!line.trim()) return;
      if (!line.includes('\t')) {
        if (/\S {2,}\S/.test(line)) issue('spaces', line.trim().split(/\s+/)[0], n, '칸 사이가 탭이 아니라 공백입니다. 이 줄은 기본 문구로 보입니다(편집기에서 Tab 키가 공백으로 들어갔을 수 있음)');
        return;
      }
      const c = line.split('\t').map(cell);
      const k = c[0];
      if (!k || k.startsWith('#') || k === '키' || k.toLowerCase() === 'key') return;
      st.rows++;
      if (!DEF.has(k)) { issue('unknown-key', k, n, '기본 표에 없는 키입니다(오타이거나 템플릿에서 없어진 키). 이 줄은 쓰지 않습니다'); return; }
      const [d, v] = c.length === 2 ? [null, c[1]] : [c[2], c[3] ?? ''];
      if (c.length > 4 && c.slice(4).some(Boolean)) issue('extra-cols', k, n, `"내 문구" 뒤에 칸이 더 있습니다(쓰지 않음): ${c.slice(4).filter(Boolean).join(' / ')}`);
      if (lineOf.has(k)) issue('duplicate', k, n, `${lineOf.get(k)}번째 줄에도 같은 키가 있습니다. 두 줄 모두 "내 문구"가 있으면 아래 줄을 씁니다`);
      lineOf.set(k, n);
      if (v) mine.set(k, v);
      else if (d && d !== DEF.get(k).d && !lossy(d, DEF.get(k).d)) issue('default-edited', k, n, '"기본 문구" 칸이 지금 기본 문구와 다릅니다. 바꾸려면 맨 끝 "내 문구" 칸에 쓰세요(템플릿 업데이트로 기본 문구가 바뀐 것이면 그대로 둬도 됩니다)');
    });
  }
  // 바뀐 문구 점검: 권장 길이 · 영문 칸의 한글 · 빠진/모르는 자리표시 · 풀리지 않는 {키}
  const vars = (s) => [...String(s).matchAll(VAR)].map((m) => m[1]);
  function check() {
    for (const [k, r] of DEF) {
      const now = resolve(k), base = resolve(k, false);
      if (now === base) continue;
      const line = lineOf.get(k) ?? null;
      const len = [...now.replace(VAR, '00')].length;
      if (r.n && len > r.n) issue('too-long', k, line, `${len}자(권장 ${r.n}자 이하) — 칸을 넘치거나 줄이 바뀔 수 있습니다${mine.has(k) ? '' : '(끌어 쓰는 다른 줄의 문구가 길어짐)'}`);
      if (r.en && /[ᄀ-ᇿ㄰-㆏가-힣]/.test(now)) issue('hangul-in-en', k, line, '영문 라벨 칸입니다. 영문 글꼴에 한글이 없어 한글은 다른 글꼴(굵기·자간이 다름)로 보입니다');
      if (!mine.has(k)) continue;
      const need = vars(base), have = vars(now);
      const lost = need.filter((v) => !have.includes(v)), extra = have.filter((v) => !need.includes(v));
      if (lost.length) issue('missing-var', k, line, `{${lost.join('}, {')}} 자리가 빠졌습니다. 그 자리에 들어가던 값이 화면에서 사라집니다`);
      if (extra.length) issue('unknown-var', k, line, `{${extra.join('}, {')}}는 이 줄에서 쓸 수 없는 자리표시입니다(글자 그대로 보임)`);
      const left = [...now.matchAll(REF)].map((m) => m[1]);
      if (left.length) issue(left.every((x) => DEF.has(x)) ? 'ref-loop' : 'unknown-ref', k, line,
        `{${left.join('}, {')}}를 풀지 못했습니다(${left.every((x) => DEF.has(x)) ? '줄끼리 서로 가리킴' : '없는 키'}). 글자 그대로 보입니다`);
    }
  }
  let loading = null;
  function load(path = 'theme/strings.tsv') {
    return (loading ??= (async () => {
      st.file = path;
      try {
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) { issue('no-file', '', null, `${path}를 읽지 못해 기본 문구로 보입니다(HTTP ${res.status})`); return st; }
        const [enc, text] = decode(await res.arrayBuffer());
        Object.assign(st, { loaded: true, encoding: enc });
        if (enc === 'euc-kr') issue('encoding', '', null, 'CP949(엑셀 기본)로 저장된 파일입니다. 페이지에는 바르게 보이지만 GitHub에서는 한글이 깨져 보입니다. UTF-8로 저장하면 좋습니다');
        if (enc.startsWith('utf-16')) issue('encoding', '', null, 'UTF-16(엑셀 "유니코드 텍스트")으로 저장된 파일입니다. 페이지에는 바르게 보이지만 GitHub에서 표로 보이지 않을 수 있습니다. UTF-8로 저장하면 좋습니다');
        parse(text);
        check();
      } catch (e) { issue('no-file', '', null, `${path}를 읽지 못해 기본 문구로 보입니다(${e && e.message || e})`); }
      if (st.issues.length) console.warn(`[strings] ${path}: 확인할 것 ${st.issues.length}건`, st.issues);
      return st;
    })());
  }
  const report = () => ({ ...st, overridden: mine.size, mine: Object.fromEntries(mine), issues: [...st.issues] });
  // 템플릿용 theme/strings.tsv(내 문구는 모두 빈 칸, 줄 끝 탭을 남겨 둠 — 줄 끝에 글자만 치면 됨). UTF-8 BOM: 엑셀로 열어도 한글이 깨지지 않게
  const tsv = () => '﻿' + [['키', '보이는 곳 (권장 길이)', '기본 문구', '내 문구'], ...HELP,
    ...ROWS.map(([k, d, w, n, f]) => [k, `${w}${f === 'en' ? ' · 영문 칸' : ''} · ${n}자`, d, ''])].map((r) => r.join('\t')).join('\n') + '\n';

  return { t, tab, label, load, report, tsv, keys: () => [...DEF.keys()] };
})();
if (typeof module === 'object' && module.exports) module.exports = PFStr;
