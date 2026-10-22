// CDP 연결(의존성 0, Node 22+). 디버깅 포트 대신 --remote-debugging-pipe(fd 3·4)를 써서 TCP 포트를 열지 않습니다.
// 브라우저 프로필은 %TEMP%\doclayout-<browser>-XXXX에 만들고 close()에서 지웁니다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const EXE = {
  chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(browser, { headless = true, args = [] } = {}) {
  const exe = EXE[browser];
  if (!exe || !fs.existsSync(exe)) throw new Error(`${browser} 실행 파일 없음: ${exe}`);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), `doclayout-${browser}-`));
  const flags = [headless ? '--headless=new' : null, '--remote-debugging-pipe', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--mute-audio', ...args, 'about:blank'].filter(Boolean);
  const proc = spawn(exe, flags, { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], windowsHide: true });
  const w = proc.stdio[3], r = proc.stdio[4];
  let id = 0, buf = Buffer.alloc(0), closed = false;
  const pend = new Map();
  const listeners = new Map();                            // key: `${sessionId||''}|${method}` → Set(fn)
  r.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let i;
    while ((i = buf.indexOf(0)) >= 0) {
      const msg = JSON.parse(buf.subarray(0, i).toString('utf8'));
      buf = buf.subarray(i + 1);
      if (msg.id && pend.has(msg.id)) { const { res, rej, method } = pend.get(msg.id); pend.delete(msg.id); msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result); }
      else if (msg.method) {
        for (const key of [`${msg.sessionId || ''}|${msg.method}`, `*|${msg.method}`]) (listeners.get(key) || new Set()).forEach((f) => f(msg.params, msg.sessionId));
      }
    }
  });
  proc.on('exit', () => { closed = true; pend.forEach(({ rej, method }) => rej(new Error(`브라우저 종료됨(${method})`))); pend.clear(); });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    if (closed) return rej(new Error('브라우저 종료됨'));
    const i = ++id; pend.set(i, { res, rej, method });
    w.write(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }) + '\0');
  });
  const on = (method, fn, sessionId) => { const key = `${sessionId || '*'}|${method}`; if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(fn); return () => listeners.get(key).delete(fn); };
  const ver = await send('Browser.getVersion');

  async function newPage() {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const ps = (method, params) => send(method, params, sessionId);
    const once = (method, ms = 60000) => new Promise((res) => { const off = on(method, (p) => { off(); res(p); }, sessionId); setTimeout(() => { off(); res(null); }, ms); });
    const evaluate = async (expression, { timeout = 60000 } = {}) => {
      const r = await ps('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    const logs = [];
    on('Runtime.exceptionThrown', (p) => logs.push({ type: 'exception', text: (p.exceptionDetails.exception?.description || p.exceptionDetails.text || '').slice(0, 400) }), sessionId);
    on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error' || p.type === 'warning') logs.push({ type: p.type, text: p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400) }); }, sessionId);
    on('Network.loadingFailed', (p) => { if (!p.canceled) logs.push({ type: 'net-fail', text: `${p.errorText} ${p.type || ''}` }); }, sessionId);
    await ps('Page.enable'); await ps('Runtime.enable'); await ps('Network.enable');
    const close = () => send('Target.closeTarget', { targetId }).catch(() => {});
    return { targetId, sessionId, send: ps, once, evaluate, logs, close };
  }

  async function close() {
    try { await Promise.race([send('Browser.close'), sleep(3000)]); } catch { /* 이미 종료 */ }
    for (let i = 0; i < 30 && !closed; i++) await sleep(100);
    if (!closed) { try { proc.kill(); } catch { /* */ } await sleep(500); }
    for (let i = 0; i < 10; i++) { try { fs.rmSync(prof, { recursive: true, force: true }); break; } catch { await sleep(500); } }
  }
  return { browser, version: ver.product, send, on, newPage, close, profile: prof };
}

module.exports = { launch, EXE, sleep };
