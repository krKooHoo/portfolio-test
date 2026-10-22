// 127.0.0.1 전용 읽기 전용 정적 서버(의존성 0). 쓰기 메서드는 405. 루트 밖 경로는 403.
// opts.delay(pathname) → ms : 느린 응답 시험용(T7·A4). opts.block(pathname) → true면 404(글꼴 차단 등 T6).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.cs': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

function serve(root, port, opts = {}) {
  root = path.resolve(root);
  const stats = { requests: 0, bytes: 0, notFound: [] };
  const srv = http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
    if (p.endsWith('/')) p += 'index.html';
    const f = path.resolve(root, '.' + p);
    if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (opts.block && opts.block(p)) { res.writeHead(404); return res.end('blocked'); }
    const d = opts.delay ? opts.delay(p) : 0;
    if (d) await new Promise((r) => setTimeout(r, d));
    fs.readFile(f, (err, buf) => {
      stats.requests++;
      if (err) { stats.notFound.push(p); res.writeHead(404); return res.end('not found'); }
      stats.bytes += buf.length;
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
