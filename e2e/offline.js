// Real-Chromium check without network: www.youtube.com/watch is answered by a
// fake page carrying YouTube's player markup, so the real content script, the
// real service worker, real chrome.storage and the real popup all run.
// See TESTING.md, layer 2.
//
// Usage: node e2e/offline.js [extension-dir]     (default: the repo root)
//
// Playwright is not a devDependency (it would add ~150 MB to every install for
// a check run once per release). Point PLAYWRIGHT_DIR at any playwright
// package, e.g. one npx already cached:
//   export PLAYWRIGHT_DIR=$(find ~/.npm/_npx -maxdepth 3 -type d -path '*/node_modules/playwright' | head -1)
// and install its browser once: node "$PLAYWRIGHT_DIR/cli.js" install chromium
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function loadPlaywright() {
  for (const id of [process.env.PLAYWRIGHT_DIR, 'playwright'].filter(Boolean)) {
    try { return require(id); } catch { /* try the next one */ }
  }
  console.error('Playwright not found. Set PLAYWRIGHT_DIR — see the header of this file.');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const EXT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

// A real 10-minute file: the content script runs in an isolated world, so a
// duration faked from the page script is invisible to it, and a canvas
// stream reports duration === Infinity (a live stream, by the extension's rules).
const VIDEO_PATH = path.join(os.tmpdir(), 'ytms-test600.webm');
if (!fs.existsSync(VIDEO_PATH)) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
    '-i', 'testsrc=size=160x90:rate=5:duration=600', '-c:v', 'libvpx', '-b:v', '20k',
    '-deadline', 'realtime', VIDEO_PATH]);
}

const PAGE = `<!doctype html><html><head><title>fake watch</title></head><body>
<div id="movie_player" class="html5-video-player" style="position:relative;width:960px;height:540px;background:#000">
  <div class="html5-video-container"><video muted autoplay playsinline width="960" height="500"></video></div>
  <div class="ytp-chrome-bottom">
    <div class="ytp-progress-bar" style="position:relative;height:4px;background:#555"></div>
    <div class="ytp-chrome-controls"><div class="ytp-left-controls">
      <div class="ytp-time-display"><span class="ytp-time-current">0:00</span><span> / </span><span class="ytp-time-duration">0:00</span></div>
    </div></div>
  </div>
</div>
<a href="/watch?v=second" id="next">next</a>
<script>
  // A real 10-minute file (served by the route below), so duration is finite
  // in the content script's isolated world too.
  const v = document.querySelector('video'); v.src = '/test600.webm'; v.play();
  // YouTube's own readout: rewritten on timeupdate; clicking it toggles
  // "time remaining" (as observed on youtube.com, 2026-10-06).
  let remaining = false;
  const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const ytWrite = () => {
    const t = v.currentTime;
    document.querySelector('.ytp-time-current').textContent = remaining ? '-' + fmt(Math.ceil(v.duration - t)) : fmt(t);
  };
  v.addEventListener('timeupdate', ytWrite);
  document.querySelector('.ytp-time-display').addEventListener('click', () => { remaining = !remaining; ytWrite(); });
  // YouTube-like SPA navigation for the link.
  document.getElementById('next').addEventListener('click', (e) => {
    e.preventDefault(); history.pushState({}, '', '/watch?v=second');
    window.dispatchEvent(new Event('yt-navigate-finish'));
  });
</script></body></html>`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

(async () => {
  const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ytms-off-')), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required'],
  });
  const VIDEO_FILE = fs.readFileSync(VIDEO_PATH);
  await context.route(/^https:\/\/www\.youtube\.com\//, (route) =>
    route.request().url().endsWith('/test600.webm')
      ? route.fulfill({ status: 200, contentType: 'video/webm', body: VIDEO_FILE })
      : route.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://www.youtube.com' });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(worker.url()).host;
  const swErrors = [];
  worker.on('console', (m) => { if (m.type() === 'error') swErrors.push(m.text()); });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('https://www.youtube.com/watch?v=first');
  await page.waitForSelector('.ytp-copy-time-btn', { timeout: 10000 }).catch(() => {});

  const sel = ['.ytp-copy-time-btn', '.ytp-ms-toggle-btn', '.ytp-jump-btn', '.ytp-interval-btn-a', '.ytp-interval-btn-b'];
  const count = () => page.evaluate((s) => s.map((x) => document.querySelectorAll(x).length), sel);
  let c = await count();
  check('content script injected all 5 buttons once', c.every((n) => n === 1), JSON.stringify(c));

  const read = () => page.evaluate(() => ({
    text: document.querySelector('.ytp-time-current').textContent,
    t: document.querySelector('video').currentTime,
    paused: document.querySelector('video').paused,
  }));
  const r1 = await read(); await page.waitForTimeout(1500); const r2 = await read();
  check('video is actually playing', !r2.paused && r2.t > r1.t, `t ${r1.t.toFixed(2)} → ${r2.t.toFixed(2)}`);
  check('readout in ms format and advancing', /^\d+:\d{2}\.\d{3}$/.test(r2.text) && r2.text !== r1.text, `${r1.text} → ${r2.text}`);

  await page.click('.ytp-ms-toggle-btn');
  await page.waitForTimeout(500);
  const off = await read();
  const stored = await worker.evaluate(() => chrome.storage.local.get('showMilliseconds'));
  check('ms toggle writes storage and drops ms', stored.showMilliseconds === false && /^\d+:\d{2}$/.test(off.text), off.text);
  await page.click('.ytp-ms-toggle-btn');
  await page.waitForTimeout(500);
  check('ms toggle back on', /\.\d{3}$/.test((await read()).text));

  // Remaining-time mode, milliseconds off then on.
  const sampleReadout = async (n) => {
    const out = [];
    for (let i = 0; i < n; i++) { out.push((await read()).text); await page.waitForTimeout(100); }
    return out;
  };
  await page.click('.ytp-ms-toggle-btn');            // ms off
  await page.waitForTimeout(300);
  await page.click('.ytp-time-current');               // YouTube: show remaining
  let seen = await sampleReadout(20);
  check('ms off + remaining mode: readout never flips to elapsed', seen.every((x) => /^-\d+:\d{2}$/.test(x)),
    [...new Set(seen)].slice(0, 6).join(' '));
  await page.click('.ytp-ms-toggle-btn');            // ms on
  await page.waitForTimeout(300);
  seen = await sampleReadout(10);
  check('ms on + remaining mode: remaining with milliseconds', seen.every((x) => /^-\d+:\d{2}\.\d{3}$/.test(x)),
    [...new Set(seen)].slice(0, 4).join(' '));
  await page.click('.ytp-time-current');               // back to elapsed
  await page.waitForTimeout(300);
  seen = await sampleReadout(5);
  check('back to elapsed mode', seen.every((x) => /^\d+:\d{2}\.\d{3}$/.test(x)), seen.join(' '));

  await page.click('.ytp-copy-time-btn');
  await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'ERR ' + e.message);
  check('copy button → clipboard', /^\d+:\d{2}\.\d{3}$/.test(clip), clip);

  await page.mouse.click(5, 700); // focus the page, not an input
  await page.keyboard.press('g');
  check('G opens jump input', !!(await page.$('.ytp-jump-input')));
  await page.keyboard.press('Escape');
  await page.keyboard.press('[');
  await page.waitForTimeout(1200);
  await page.keyboard.press(']');
  const delta = await page.evaluate(() => document.querySelector('[data-interval="delta"]')?.textContent);
  check('[ ] interval delta ≈ 1.2 s', /^0:01\.\d{3}$/.test(delta || ''), delta);

  // Watch time is batched every 5 s.
  await page.waitForTimeout(6500);
  let s = await worker.evaluate(() => chrome.storage.local.get(['totalWatchTime', 'dailyStats']));
  check('watch time reached the service worker', s.totalWatchTime > 4, `total=${s.totalWatchTime?.toFixed(2)}`);

  // Settings: hide copy + jump from storage; open tab must follow.
  await worker.evaluate(() => chrome.storage.local.set({ showCopyBtn: false, showJumpBtn: false }));
  await page.waitForTimeout(500);
  c = await count();
  check('hiding copy/jump in settings removes them live', c[0] === 0 && c[2] === 0 && c[1] === 1 && c[3] === 1, JSON.stringify(c));

  // SPA navigation
  await page.click('#next');
  await page.waitForTimeout(2500);
  c = await count();
  check('after SPA navigation: buttons rebuilt once, interval cleared',
    c[1] === 1 && c[3] === 1 && c[0] === 0 && !(await page.$('.ytp-interval-badge--visible')), JSON.stringify(c));

  // Popup reset with a tab still reporting watch time.
  const popup = await context.newPage();
  popup.on('pageerror', (e) => pageErrors.push('popup: ' + e));
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForTimeout(500);
  const total = await popup.textContent('#totalTime');
  check('popup renders total', /\d+s/.test(total), total);

  // Version history: footer version → in-popup list → GitHub link.
  const manifestVersion = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const versionText = await popup.textContent('#versionBtn').catch(() => null);
  check('popup footer shows the installed version', versionText === `v${manifestVersion}`, versionText);
  if (process.env.SHOTS) await popup.screenshot({ path: path.join(process.env.SHOTS, 'popup-closed.png'), fullPage: true });
  await popup.click('#versionBtn').catch(() => {});
  await popup.waitForTimeout(400);
  const history = await popup.evaluate(() => {
    const panel = document.querySelector('#changelog');
    return panel && {
      visible: !panel.hidden && panel.getBoundingClientRect().height > 0,
      entries: panel.querySelectorAll('.changelog-entry').length,
      firstOpen: panel.querySelector('.changelog-entry')?.open,
      scrolls: panel.scrollHeight > panel.clientHeight,
      lastLink: panel.lastElementChild?.href,
    };
  });
  check('version history opens with 10 releases, newest expanded, scrollable, GitHub link last',
    history && history.visible && history.entries === 10 && history.firstOpen && history.scrolls &&
    /github\.com\/.+\/releases$/.test(history.lastLink || ''), JSON.stringify(history));
  if (process.env.SHOTS) {
    await popup.locator('#changelog').screenshot({ path: path.join(process.env.SHOTS, 'changelog-top.png') });
    await popup.evaluate(() => { const p = document.querySelector('#changelog'); p.scrollTop = p.scrollHeight; });
    await popup.locator('#changelog').screenshot({ path: path.join(process.env.SHOTS, 'changelog-bottom.png') });
    await popup.screenshot({ path: path.join(process.env.SHOTS, 'popup-open.png'), fullPage: true });
  }
  await popup.click('#versionBtn').catch(() => {});
  // Pause first: pausing flushes the tab's pending watch time at once, and a
  // still-playing tab would legitimately add its next 5 s batch after the
  // reset — which made this check pass or fail on timing alone.
  await page.evaluate(() => document.querySelector('video').pause());
  await page.waitForTimeout(500);
  await popup.click('#resetBtn');
  await popup.click('#resetBtn');
  await popup.waitForTimeout(1500);
  s = await worker.evaluate(() => chrome.storage.local.get(null));
  check('reset zeroes stats, keeps settings',
    s.totalWatchTime === 0 && Object.values(s.dailyStats || {}).every((v) => v === 0) &&
    s.showCopyBtn === false && s.showJumpBtn === false && s.showMilliseconds === true,
    JSON.stringify({ total: s.totalWatchTime, showCopyBtn: s.showCopyBtn, showJumpBtn: s.showJumpBtn }));
  c = await count();
  check('open tab kept its hidden buttons hidden through the reset', c[0] === 0 && c[2] === 0, JSON.stringify(c));

  check('no errors in page/popup console', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  check('no errors in service worker console', swErrors.length === 0, swErrors.slice(0, 3).join(' | '));

  await context.close();
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
