// Responsive QA probe (spec §55): loads each path at each width in headless
// Chrome with real device emulation and reports horizontal overflow, naming
// the outermost elements that extend past the viewport. Elements inside an
// intentional horizontal scroller are ignored.
//
// Usage (against a running server):
//   node scripts/qa_responsive_overflow.mjs http://localhost:3000 / /anime/naruto /community
// Env: CHROME_PATH, WIDTHS (default 360..1440), WAIT (ms per page, default 6000),
//      SHOTDIR (also save a full-page PNG per path/width).
//
// Note: don't use `chrome --screenshot --window-size=390,...` for this —
// headless windows have a ~500px minimum width, so pages lay out wider than
// the requested size and then get cropped, which looks like overflow.
// Git Bash rewrites "/path" args into Windows paths; run with MSYS_NO_PATHCONV=1.
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [base, ...paths] = process.argv.slice(2);
if (!base || paths.length === 0) {
  console.error('Usage: node scripts/qa_responsive_overflow.mjs <baseUrl> <path> [path...]');
  process.exit(2);
}
const widths = (process.env.WIDTHS || '360,390,414,768,820,1024,1280,1440').split(',').map(Number);
const port = 9333;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), 'otakuva-cdp')}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

const probe = `(() => {
  const vw = document.documentElement.clientWidth;
  const doc = document.documentElement.scrollWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 1) continue;
    // skip things inside an intentional horizontal scroller
    let p = el.parentElement, scrolled = false;
    while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX)) { scrolled = true; break; } p = p.parentElement; }
    if (scrolled) continue;
    const parent = el.parentElement; const pr = parent?.getBoundingClientRect();
    if (pr && pr.right > vw + 1 && parent !== document.body) continue; // report outermost only
    const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ')[0] : '';
    offenders.push(el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width) + ' minW=' + getComputedStyle(el).minWidth);
  }
  return JSON.stringify({ vw, doc, overflow: doc > vw, offenders: offenders.slice(0, 8) });
})()`;

let failures = 0;
for (const p of paths) {
  for (const w of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
    await send('Page.navigate', { url: base + p });
    await sleep(Number(process.env.WAIT || 6000));
    const res = await send('Runtime.evaluate', { expression: probe, returnByValue: true });
    const out = JSON.parse(res.result.result.value);
    if (process.env.SHOTDIR) {
      const full = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true });
      const h = Math.min(6000, full.result.result.value);
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
      await sleep(800);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(process.env.SHOTDIR, p.replace(/[^a-z0-9]+/gi, '_') + '_' + w + '.png'), Buffer.from(shot.result.data, 'base64'));
    }
    if (out.overflow) failures++;
    console.log(`${p} @${w}: ${out.overflow ? `OVERFLOW doc=${out.doc}` : 'ok'}${out.offenders.length ? '\n   ' + out.offenders.join('\n   ') : ''}`);
  }
}
ws.close();
chrome.kill();
process.exit(failures > 0 ? 1 : 0);
