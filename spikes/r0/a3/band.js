#!/usr/bin/env node
// A3 ③ 잘림 띠: 축소로도 안 들어가는 장면 → 빨간 띠(.pf-clipped)가 화면과 PDF(배경 켬·끔) 모두에 보이는지. Chrome·Edge
// 실행(PowerShell, 레포 루트): node spikes/r0/a3/band.js [--kit-file <대체 scene-kit.css>] [--tag band]
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, sleep } = require('../harness/lib/cdp');
const { serve } = require('./server');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../out/a3');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const TAG = arg('tag', 'band');
const KIT_FILE = arg('kit-file');
const VP = { w: 1536, h: 864, dpr: 1.25 };
const RED = [180, 35, 24];

const PY = `
import sys, json, pymupdf as f, numpy as np
sys.stdout.reconfigure(encoding='utf-8')
jobs = json.loads(open(sys.argv[1], encoding='utf-8').read())
out = []
for j in jobs:
    if j['kind'] == 'png':
        pm = f.Pixmap(j['file'])
        a = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width, pm.n)[:, :, :3]
        x, y, r = j['x'], j['y'], 5
        out.append({'kind': 'png', 'got': np.median(a[y-r:y+r+1, x-r:x+r+1].reshape(-1, 3), axis=0).round().astype(int).tolist()})
    else:
        d = f.open(j['file']); res = {'kind': 'pdf', 'pages': len(d), 'sizes': sorted({(p.rect.width, p.rect.height) for p in d}), 'band': []}
        for i, p in enumerate(d, 1):
            t = p.get_text()
            pix = p.get_pixmap(matrix=f.Matrix(1, 1), alpha=False)
            a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
            x, y, r = int(j['x']), int(j['y']), 4
            got = np.median(a[y-r:y+r+1, x-r:x+r+1].reshape(-1, 3), axis=0).round().astype(int).tolist()
            res['band'].append({'page': i, 'text': '내용이 잘렸습니다' in t, 'url': j['url'] in t.replace('\\n', ''), 'rgb': got})
        out.append(res)
print(json.dumps(out, ensure_ascii=False))
`;

(async () => {
  const dir = path.join(OUT, TAG); fs.mkdirSync(dir, { recursive: true });
  const server = await serve(ROOT, 4623, { rewrite: KIT_FILE ? { '/spikes/r0/kit/scene-kit.css': path.resolve(KIT_FILE) } : null });
  const R = { tag: TAG, kitFile: KIT_FILE || null, browsers: {}, runs: [] };
  try {
    for (const b of ['chrome', 'edge']) {
      const c = await launch(b); R.browsers[b] = c.version;
      try {
        const page = await c.newPage();
        await page.send('Emulation.setDeviceMetricsOverride', { width: VP.w, height: VP.h, deviceScaleFactor: VP.dpr, mobile: false });
        const loaded = page.once('Page.loadEventFired', 60000);
        await page.send('Page.navigate', { url: `${server.base}spikes/r0/a3/fixtures/clip-band.html` });
        await loaded;
        const t0 = Date.now(); let ready = '';
        while (Date.now() - t0 < 30000) { ready = await page.evaluate('document.documentElement.dataset.pfReady || ""'); if (ready === 'yes') break; await sleep(50); }
        await page.evaluate('(PFScene.go(1, { focus: false }), 1)');
        await sleep(400);
        const scr = await page.evaluate(`JSON.stringify((() => { const s = document.querySelectorAll('#deck > .pf-scene')[1]; const band = s.querySelector('.pf-clipped');
          if (!band) return { band: false };
          const cs = getComputedStyle(band), r = band.getBoundingClientRect(), sr = s.getBoundingClientRect();
          const cx = r.right - 6 * PFScene.k, cy = r.top + r.height / 2, hit = document.elementFromPoint(cx, cy);
          return { band: true, text: band.textContent, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, bg: cs.backgroundColor, k: PFScene.k,
            inside: r.left >= sr.left - 0.5 && r.right <= sr.right + 0.5 && r.top >= sr.top - 0.5 && r.bottom <= sr.bottom + 0.5,
            rect: [r.left, r.top, r.width, r.height].map((v) => +v.toFixed(1)), hitIsBand: !!hit && (hit === band || band.contains(hit)), cx, cy,
            logical: { left: band.offsetLeft, top: band.offsetTop, w: band.offsetWidth, h: band.offsetHeight },
            audit: PFScene.audit().map((x) => x.scene + ':' + x.type), overflow: PFScene.info.overflow }; })())`).then(JSON.parse);
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        const png = path.join(dir, `${b}__screen.png`); fs.writeFileSync(png, Buffer.from(shot.data, 'base64'));
        const url = await page.evaluate("PFScene.refUrl('a3-t2')");
        const pdfs = {};
        for (const bg of [true, false]) {
          const r = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: bg, transferMode: 'ReturnAsBase64' });
          const f = path.join(dir, `${b}__bg${bg ? 1 : 0}.pdf`); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); pdfs[bg ? 'bg1' : 'bg0'] = f;
        }
        R.runs.push({ browser: b, ready, screen: scr, png, url, pdfs });
        await page.close();
      } finally { await c.close(); }
    }
  } finally { await server.close(); }
  const jobs = [];
  for (const r of R.runs) {
    const L = r.screen.logical;                                   // 장면 안 논리 좌표(px) → 띠 오른쪽 끝 부근(글자 없는 곳)
    jobs.push({ kind: 'png', file: r.png, x: Math.round(r.screen.cx * VP.dpr), y: Math.round(r.screen.cy * VP.dpr) });
    for (const bg of ['bg1', 'bg0']) jobs.push({ kind: 'pdf', file: r.pdfs[bg], x: (L.left + L.w - 8) * 0.75, y: (L.top + L.h / 2) * 0.75, url: r.url });
  }
  const jf = path.join(OUT, `${TAG}-jobs.json`); fs.writeFileSync(jf, JSON.stringify(jobs));
  const pyf = path.join(OUT, `${TAG}-probe.py`); fs.writeFileSync(pyf, PY);
  const res = JSON.parse(execFileSync('python', ['-I', pyf, jf], { encoding: 'utf8' }));
  const near = (a, b, t = 8) => a && a.every((v, i) => Math.abs(v - b[i]) <= t);
  R.runs.forEach((r, i) => {
    const [p, b1, b0] = res.slice(i * 3, i * 3 + 3);
    r.screenPixel = p.got; r.pdf = { bg1: b1, bg0: b0 };
    const f = [];
    if (r.ready !== 'yes') f.push('ready ' + r.ready);
    if (!r.screen.band) f.push('띠 없음');
    else {
      if (r.screen.display === 'none' || r.screen.visibility !== 'visible' || +r.screen.opacity < 1) f.push('화면에서 숨김');
      if (!r.screen.inside) f.push('띠가 장면 밖');
      if (!r.screen.hitIsBand) f.push('띠가 가려짐(elementFromPoint)');
      if (!near(p.got, RED)) f.push(`화면 픽셀 ${JSON.stringify(p.got)}`);
      if (!r.screen.audit.includes('2:clipped')) f.push('audit가 clipped를 안 잡음');
    }
    for (const [k, d] of Object.entries(r.pdf)) {
      if (d.pages !== 3) f.push(`${k} 쪽 ${d.pages}`);
      const pg = d.band[1];
      if (!pg.text) f.push(`${k} 2쪽에 "내용이 잘렸습니다" 없음`);
      if (!pg.url) f.push(`${k} 2쪽에 원문 URL 없음`);
      if (!near(pg.rgb, RED)) f.push(`${k} 2쪽 띠 픽셀 ${JSON.stringify(pg.rgb)}`);
      if (d.band[0].text || d.band[2].text) f.push(`${k} 다른 쪽에도 띠 글자`);
    }
    r.fails = f;
    console.log(`${r.browser}: ${f.length ? 'FAIL ' + f.join(' / ') : 'PASS'}  화면 띠 ${JSON.stringify(r.screen.rect)} 픽셀 ${JSON.stringify(p.got)} · PDF 켬 ${JSON.stringify(b1.band[1].rgb)} 끔 ${JSON.stringify(b0.band[1].rgb)} · 축소 ${JSON.stringify(r.screen.overflow.filter((x) => x.action !== 'overflow'))}`);
  });
  fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(R, null, 1));
})().catch((e) => { console.error(e); process.exit(2); });
