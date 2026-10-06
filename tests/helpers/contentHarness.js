// Shared jsdom harness: evaluates the real js/content.js against a fake YouTube
// player DOM and a fake chrome.* API. Only usable from suites that opt in with
// `@jest-environment jsdom`.

const { readFileSync } = require('fs');
const path = require('path');

const CONTENT = readFileSync(path.join(__dirname, '..', '..', 'js', 'content.js'), 'utf8');

const CHROME_BOTTOM_HTML = `
    <div class="ytp-chrome-bottom">
      <div class="ytp-progress-bar"></div>
      <div class="ytp-chrome-controls">
        <div class="ytp-time-display">
          <span class="ytp-time-current">0:00</span>
          <span class="ytp-time-separator"> / </span>
          <span class="ytp-time-duration">10:00</span>
        </div>
      </div>
    </div>`;

const PLAYER_HTML = `
  <div id="movie_player" class="html5-video-player">
    <div class="html5-video-container"><video></video></div>
    ${CHROME_BOTTOM_HTML}
  </div>`;

const BUTTON_SELECTORS = [
  '.ytp-copy-time-btn',
  '.ytp-ms-toggle-btn',
  '.ytp-jump-btn',
  '.ytp-interval-btn-a',
  '.ytp-interval-btn-b',
];

const q = (sel) => document.querySelector(sel);

// Give the <video> element a clock we can drive; jsdom does not play media.
function rigVideo(el, { duration = 600 } = {}) {
  let time = 0;
  let paused = false;
  Object.defineProperty(el, 'currentTime', {
    get: () => time, set: (v) => { time = v; }, configurable: true,
  });
  Object.defineProperty(el, 'duration', { get: () => duration, configurable: true });
  Object.defineProperty(el, 'playbackRate', { get: () => 1, configurable: true });
  Object.defineProperty(el, 'paused', {
    get: () => paused, set: (v) => { paused = v; }, configurable: true,
  });
  return el;
}

let rafQueue = [];

// Deterministic frame pump — the display loop runs on requestAnimationFrame.
function flushFrames(n) {
  for (let i = 0; i < n; i++) {
    const batch = rafQueue;
    rafQueue = [];
    batch.forEach((f) => f.cb(0));
  }
}

// chrome.* stand-in. storage.local.set notifies onChanged listeners on a
// microtask, as the real API does asynchronously.
function makeChrome(initialStore = {}) {
  const store = { ...initialStore };
  const changeListeners = [];
  const messages = [];
  const chrome = {
    runtime: {
      id: 'test-extension',
      sendMessage: (msg) => { messages.push(msg); return Promise.resolve({ success: true }); },
    },
    storage: {
      local: {
        get: (keys) => {
          const out = {};
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in store) out[k] = store[k]; });
          return Promise.resolve(out);
        },
        set: (obj) => {
          const changes = {};
          Object.keys(obj).forEach((k) => { changes[k] = { oldValue: store[k], newValue: obj[k] }; });
          Object.assign(store, obj);
          queueMicrotask(() => changeListeners.forEach((l) => l(changes, 'local')));
          return Promise.resolve();
        },
      },
      onChanged: { addListener: (l) => changeListeners.push(l) },
    },
  };
  return { chrome, store, messages };
}

// Fresh page + fresh copy of content.js. Requires jest fake timers.
async function bootExtension(html = PLAYER_HTML, { store } = {}) {
  document.body.innerHTML = html;
  rigVideo(q('video'));

  let rafId = 0;
  rafQueue = [];
  global.requestAnimationFrame = (cb) => { rafQueue.push({ id: ++rafId, cb }); return rafId; };
  global.cancelAnimationFrame = (id) => { rafQueue = rafQueue.filter((f) => f.id !== id); };

  const fake = makeChrome(store);
  global.chrome = fake.chrome;

  // eval rather than require: content.js installs itself into whatever window
  // it is evaluated in, and each test needs a fresh copy of that state.
  // Record its window/document listeners so teardown() can remove them —
  // otherwise every earlier copy keeps answering keydown in later tests.
  const targets = [window, document];
  const originals = targets.map((t) => t.addEventListener);
  targets.forEach((t, i) => {
    t.addEventListener = function (type, fn, opts) {
      installed.push({ target: t, type, fn, opts });
      return originals[i].call(this, type, fn, opts);
    };
  });
  try {
    window.eval(CONTENT);
  } finally {
    targets.forEach((t, i) => { t.addEventListener = originals[i]; });
  }

  // 100 ms player poll + the awaited settings promise
  await jest.advanceTimersByTimeAsync(300);
  return fake;
}

let installed = [];

// Call from afterEach: detaches the previous content.js copy and its timers.
function teardown() {
  installed.forEach(({ target, type, fn, opts }) => target.removeEventListener(type, fn, opts));
  installed = [];
  jest.clearAllTimers();
  document.body.innerHTML = '';
}

function pressKey(key, code, target = document.body) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }));
}

module.exports = {
  CHROME_BOTTOM_HTML, PLAYER_HTML, BUTTON_SELECTORS,
  q, rigVideo, flushFrames, bootExtension, pressKey, teardown,
};
