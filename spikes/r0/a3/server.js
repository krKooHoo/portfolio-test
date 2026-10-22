// A3 정적 서버: ../harness/lib/server.js와 같은 규칙(127.0.0.1 전용, 읽기 전용, 루트 밖 403, delay 훅) + rewrite 훅.
// rewrite: { '/spikes/r0/kit/scene-kit.css': 'C:/…/variant.css' } → 그 경로 요청에 다른 파일을 줌(실제 페이지를 고치지 않고 키트 수정안을 시험)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.cs': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

function serve(root, port, opts = {}) {
  root = path.resolve(root);
  const stats = { requests: 0, rewritten: 0, notFound: [] };
  const srv = http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
    if (p.endsWith('/')) p += 'index.html';
    let f = path.resolve(root, '.' + p);
    if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (opts.rewrite && opts.rewrite[p]) { f = opts.rewrite[p]; stats.rewritten++; }
    const d = opts.delay ? opts.delay(p) : 0;
    if (d) await new Promise((r) => setTimeout(r, d));
    fs.readFile(f, (err, buf) => {
      stats.requests++;
      if (err) { stats.notFound.push(p); res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': buf.length });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  });
  return new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve({ srv, stats, base: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => { srv.close(() => r()); srv.closeAllConnections?.(); }) }));
  });
}
module.exports = { serve };
