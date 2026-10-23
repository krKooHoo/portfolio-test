// 기술 문서 md 해석 공용 — doc.html(상세 기술문서) · project.html(발표 덱)이 common.js 다음에 싣습니다.
//   하는 일: marked 12.0.2(gfm) → 비활성 <template> → 상대경로(그림·영상) → 제목 slug(PF.slugger) → 제목의 조상 목록 → 원문 블록 찾기
//   <template>에 넣는 이유: 그 안의 내용은 비활성이라 문서 속 이미지(GIF 수십 MB)를 받지 않음(PF.headingsOf와 같은 방식)
//   원문 블록 참조 규칙은 .claude/skills/portfolio-build/schema.md 「발표 덱」: 절 경로(sectionPath) → 그 절 범위(다음 제목 전까지) → kind별 n번째, 지문(fp) 대조
//   이 파일은 글을 만들지 않습니다. 원문 블록을 찾아 그대로 돌려줄 뿐입니다.
(() => {
  const isRelative = (u) => u && !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(u);
  const decode = (u) => { try { return decodeURI(u); } catch (_) { return u; } };

  // md → { frag, headings: [{ el, level, text, id, parents }] }. 상대경로는 src/<폴더>/… 로 바꾸고 원래 값은 data-md-src에 둠
  function parse(md, id) {
    const tpl = document.createElement('template');
    tpl.innerHTML = marked.parse(md, { gfm: true });
    const frag = tpl.content;
    frag.querySelectorAll('img[src], video[src], source[src]').forEach((el) => {
      const s = el.getAttribute('src');
      if (isRelative(s)) { el.dataset.mdSrc = s; el.setAttribute('src', PF.srcPath(id, decode(s))); }
    });
    frag.querySelectorAll('video[poster]').forEach((el) => { const s = el.getAttribute('poster'); if (isRelative(s)) el.setAttribute('poster', PF.srcPath(id, decode(s))); });
    // 제목 앵커(GitHub 규칙). 링크 분류·각주가 섞이기 전의 원문 제목 글자로 계산(첫 H1 포함 같은 순서)
    const slug = PF.slugger();
    const stack = [];
    const headings = [...frag.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((el) => {
      const text = el.textContent.trim();
      const h = { el, level: +el.tagName[1], text, id: slug(text) };
      el.id = h.id;
      while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
      h.parents = stack.slice();
      stack.push(h);
      return h;
    });
    return { frag, headings, md, index: null };
  }

  // 제목마다 그 절 범위(다음 제목 전까지, 수준 무관)의 블록 목록. 표 안 이미지는 표째로만
  function index(P) {
    if (P.index) return P.index;
    const map = new Map();
    const bucket = () => ({ mermaid: [], code: [], table: [], image: [] });
    let cur = bucket();
    map.set(null, cur);
    const byEl = new Map(P.headings.map((h) => [h.el, h]));
    const w = document.createTreeWalker(P.frag, NodeFilter.SHOW_ELEMENT);
    for (let el = w.nextNode(); el; el = w.nextNode()) {
      if (byEl.has(el)) { cur = bucket(); map.set(byEl.get(el), cur); continue; }
      if (el.tagName === 'PRE') {
        const code = el.querySelector(':scope > code');
        if (code && /\blanguage-mermaid\b/.test(code.className)) cur.mermaid.push(el); else cur.code.push(el);
      } else if (el.tagName === 'TABLE') cur.table.push(el);
      else if (el.tagName === 'IMG' && !el.closest('table')) cur.image.push(el);
    }
    return (P.index = map);
  }

  // 절 경로 → 일치하는 제목 목록(정확히 일치가 있으면 그것만, 없으면 앞부분 일치). 앞 칸들은 조상에 순서대로 있어야 함
  const tier = (t, want) => (t === want ? 2 : t && want && (t.startsWith(want) || want.startsWith(t)) ? 1 : 0);
  function findSection(P, path) {
    const list = (Array.isArray(path) ? path : [path]).map(PF.normTitle).filter(Boolean);
    if (!list.length) return [];
    const last = list[list.length - 1], anc = list.slice(0, -1);
    let cands = P.headings.map((h) => [h, tier(PF.normTitle(h.text), last)]).filter(([, t]) => t);
    const best = Math.max(0, ...cands.map(([, t]) => t));
    cands = cands.filter(([, t]) => t === best).map(([h]) => h);
    return cands.filter((h) => {
      let i = 0;
      for (const a of h.parents) if (i < anc.length && tier(PF.normTitle(a.text), anc[i])) i++;
      return i === anc.length;
    });
  }

  // 지문: code·mermaid = 첫 번째 비어 있지 않은 줄(60자), table = 머리 칸 글자를 |로
  const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  function fpOf(el, kind) {
    if (kind === 'table') { const row = el.querySelector('tr'); return row ? squash([...row.children].map((c) => squash(c.textContent)).join('|')) : ''; }
    const line = (el.textContent || '').split('\n').map((x) => x.trim()).find((x) => x && !(kind === 'mermaid' && x.startsWith('%%'))) || '';   // mermaid는 %%{init…}%% 지시 줄을 건너뜀
    return squash(line).slice(0, 60);
  }
  const fpSame = (a, b, kind) => { const x = squash(a), y = squash(b); return kind === 'table' ? x === y : x.slice(0, 60) === y.slice(0, 60); };
  const normSrc = (s) => decode(String(s || '')).replace(/^\.\//, '');

  // 원문 블록 하나 찾기. ref = { kind, n?, src?, fp?, sectionPath? }, path = 장면의 sectionPath
  //   → { status: 'ok'|'missing'|'ambiguous'|'changed', el?, heading?, detail }
  function pick(P, ref, path) {
    const where = ref.sectionPath && ref.sectionPath.length ? ref.sectionPath : path;
    const hs = findSection(P, where);
    const label = (Array.isArray(where) ? where : [where]).filter(Boolean).join(' › ');
    if (hs.length === 0) return { status: 'missing', detail: `절 "${label}"` };
    if (hs.length > 1) return { status: 'ambiguous', detail: `절 "${label}" ${hs.length}곳` };
    const h = hs[0], b = index(P).get(h);
    const kind = ref.kind;
    if (!b || !b[kind]) return { status: 'missing', heading: h, detail: `${kind} 종류 없음` };
    let list = b[kind];
    if (kind === 'image') {
      list = list.filter((i) => normSrc(i.dataset.mdSrc || i.getAttribute('src')) === normSrc(ref.src));
      if (list.length > 1 && !ref.n) return { status: 'ambiguous', heading: h, detail: `이미지 ${ref.src} ${list.length}곳` };
    }
    const el = list[(ref.n || 1) - 1];
    if (!el) return { status: 'missing', heading: h, detail: `${label}의 ${kind}${kind === 'image' ? ' ' + ref.src : ' ' + (ref.n || 1) + '번째'}` };
    if (ref.fp && kind !== 'image' && !fpSame(fpOf(el, kind), ref.fp, kind)) return { status: 'changed', el, heading: h, detail: `${label}의 ${kind} ${ref.n || 1}번째: "${fpOf(el, kind)}"` };
    return { status: 'ok', el, heading: h };
  }

  // 그 절 범위의 첫 그림(이미지 → mermaid → 코드 순) — 예전 데이터 자동 구성용
  function firstVisual(P, h) {
    const b = index(P).get(h);
    if (!b) return null;
    if (b.image[0]) return { kind: 'image', el: b.image[0], src: b.image[0].dataset.mdSrc || b.image[0].getAttribute('src') };
    if (b.mermaid[0]) return { kind: 'mermaid', el: b.mermaid[0], n: 1 };
    if (b.code[0]) return { kind: 'code', el: b.code[0], n: 1 };
    return null;
  }

  PF.md = { parse, index, findSection, pick, fpOf, firstVisual, isRelative, decode };
})();
