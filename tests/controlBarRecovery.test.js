/**
 * @jest-environment jsdom
 *
 * YouTube re-renders the player control bar without touching the <video>
 * element (ad breaks, player re-renders), and on a cold load it can render the
 * bar well after the video. When that happens every cached time node and every
 * injected button ends up detached or never attached at all: the readout stops
 * advancing and the buttons are simply gone, with no event to tell us.
 *
 * The <video> watchdog added in 1.6.1 does not cover this — the video element
 * is still connected — so the extension stayed dead until the next navigation.
 *
 * These tests drive the real content.js against a fake player DOM.
 */

const { readFileSync } = require('fs');
const path = require('path');

const CONTENT_PATH = path.join(__dirname, '..', 'js', 'content.js');
const CONTENT = readFileSync(CONTENT_PATH, 'utf8');

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

// The <video> exists but YouTube has not rendered the control bar yet — the
// state that made the buttons never appear at all.
const PLAYER_WITHOUT_BAR_HTML = `
  <div id="movie_player" class="html5-video-player">
    <div class="html5-video-container"><video></video></div>
  </div>`;

const addControlBar = () =>
  q('#movie_player').insertAdjacentHTML('beforeend', CHROME_BOTTOM_HTML);

const CONTROL_BAR_HTML = `
  <div class="ytp-time-display">
    <span class="ytp-time-current">0:00</span>
    <span class="ytp-time-separator"> / </span>
    <span class="ytp-time-duration">10:00</span>
  </div>`;

const BUTTON_SELECTORS = [
  '.ytp-copy-time-btn',
  '.ytp-ms-toggle-btn',
  '.ytp-jump-btn',
  '.ytp-interval-btn-a',
  '.ytp-interval-btn-b',
];

// Give the <video> element a clock we can drive; jsdom does not play media.
function rigVideo(el) {
  let time = 0;
  let paused = false;
  Object.defineProperty(el, 'currentTime', {
    get: () => time, set: (v) => { time = v; }, configurable: true,
  });
  Object.defineProperty(el, 'duration', { get: () => 600, configurable: true });
  Object.defineProperty(el, 'playbackRate', { get: () => 1, configurable: true });
  Object.defineProperty(el, 'paused', {
    get: () => paused, set: (v) => { paused = v; }, configurable: true,
  });
  return el;
}

let rafQueue;

// Deterministic frame pump — the display loop runs on requestAnimationFrame.
function flushFrames(n) {
  for (let i = 0; i < n; i++) {
    const batch = rafQueue;
    rafQueue = [];
    batch.forEach((f) => f.cb(0));
  }
}

function advanceVideo(video, seconds) {
  video.currentTime += seconds;
}

const q = (sel) => document.querySelector(sel);
const liveButtons = () => BUTTON_SELECTORS.filter((sel) => q(sel)).length;

async function bootExtension(html = PLAYER_HTML) {
  document.body.innerHTML = html;
  rigVideo(q('video'));

  let rafId = 0;
  rafQueue = [];
  global.requestAnimationFrame = (cb) => { rafQueue.push({ id: ++rafId, cb }); return rafId; };
  global.cancelAnimationFrame = (id) => { rafQueue = rafQueue.filter((f) => f.id !== id); };

  const store = {};
  global.chrome = {
    runtime: { id: 'test-extension', sendMessage: () => Promise.resolve() },
    storage: {
      local: {
        get: (keys) => {
          const out = {};
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in store) out[k] = store[k]; });
          return Promise.resolve(out);
        },
        set: (obj) => { Object.assign(store, obj); return Promise.resolve(); },
      },
      onChanged: { addListener: () => {} },
    },
  };

  // eval rather than require: content.js installs itself into whatever window
  // it is evaluated in, and each test needs a fresh copy of that state.
  window.eval(CONTENT);

  // 100 ms player poll + the awaited settings promise
  await jest.advanceTimersByTimeAsync(300);
}

describe('recovery after YouTube re-renders the control bar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.history.replaceState({}, '', '/watch?v=abc123');
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  test('readout keeps advancing after the control bar is replaced', async () => {
    await bootExtension();
    const video = q('video');

    video.dispatchEvent(new Event('play'));
    advanceVideo(video, 1.5);
    flushFrames(1);
    expect(q('.ytp-time-current').textContent).toBe('0:01.500');

    // YouTube rebuilds the control bar; the <video> element is untouched.
    q('.ytp-chrome-controls').innerHTML = CONTROL_BAR_HTML;
    expect(video.isConnected).toBe(true);

    advanceVideo(video, 2);
    await jest.advanceTimersByTimeAsync(1200);
    flushFrames(1);

    expect(q('.ytp-time-current').textContent).toBe('0:03.500');
  });

  test('injected buttons come back after the control bar is replaced', async () => {
    await bootExtension();
    expect(liveButtons()).toBe(BUTTON_SELECTORS.length);

    q('.ytp-chrome-controls').innerHTML = CONTROL_BAR_HTML;
    expect(liveButtons()).toBe(0);

    await jest.advanceTimersByTimeAsync(1200);

    expect(liveButtons()).toBe(BUTTON_SELECTORS.length);
  });

  test('an untouched control bar is never rebuilt on the watchdog tick', async () => {
    await bootExtension();
    const copyBtn = q('.ytp-copy-time-btn');
    expect(copyBtn).not.toBeNull();

    // Five watchdog cycles with nothing changing must not recreate the UI:
    // rebuilding the control bar every second would be its own perf bug.
    await jest.advanceTimersByTimeAsync(5000);

    expect(q('.ytp-copy-time-btn')).toBe(copyBtn);
  });
});

describe('recovery when the control bar renders after the video', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.history.replaceState({}, '', '/watch?v=abc123');
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  // updateDisplayMode() retries for 5 s, so the readout used to recover on its
  // own here — but the button setups bail silently on a missing anchor and
  // nothing ever retried them, leaving a session with a live timestamp and no
  // copy/jump/ms/interval controls.
  test('buttons appear when the bar lands within the retry window', async () => {
    await bootExtension(PLAYER_WITHOUT_BAR_HTML);
    expect(q('.ytp-time-current')).toBeNull();

    addControlBar();
    await jest.advanceTimersByTimeAsync(2000);

    expect(liveButtons()).toBe(BUTTON_SELECTORS.length);

    const video = q('video');
    video.dispatchEvent(new Event('play'));
    advanceVideo(video, 1.5);
    flushFrames(1);
    expect(q('.ytp-time-current').textContent).toBe('0:01.500');
  });

  // Past MAX_DISPLAY_MODE_RETRIES nothing is cached at all, so a watchdog that
  // asked "did we lose our node" answered "no" forever and the extension stayed
  // dead for the whole session.
  test('everything recovers when the bar lands after the retry ceiling', async () => {
    await bootExtension(PLAYER_WITHOUT_BAR_HTML);

    await jest.advanceTimersByTimeAsync(8000);
    addControlBar();
    await jest.advanceTimersByTimeAsync(2000);

    expect(liveButtons()).toBe(BUTTON_SELECTORS.length);

    const video = q('video');
    video.dispatchEvent(new Event('play'));
    advanceVideo(video, 1.5);
    flushFrames(1);
    expect(q('.ytp-time-current').textContent).toBe('0:01.500');
  });

  // The watchdog must anchor on the live bar, not on the cached node. Anchoring
  // on the cached node restarted updateDisplayMode()'s 100 ms retry chain on
  // every tick, so a bar that never came back meant unbounded DOM polling —
  // the exact "extension makes YouTube lag" failure this all exists to avoid.
  test('a control bar that never returns does not turn into a DOM poll', async () => {
    await bootExtension();

    const realQuerySelector = Document.prototype.querySelector;
    let calls = 0;
    Document.prototype.querySelector = function (...args) {
      calls++;
      return realQuerySelector.apply(this, args);
    };

    try {
      await jest.advanceTimersByTimeAsync(10000);
      const healthy = calls;

      q('.ytp-chrome-bottom').remove();
      calls = 0;
      await jest.advanceTimersByTimeAsync(10000);
      const barGone = calls;

      // One getPlayerRoot() per watchdog tick either way; the retry chain would
      // add ~40/s on top.
      expect(healthy).toBeLessThanOrEqual(20);
      expect(barGone).toBeLessThanOrEqual(healthy * 2);
    } finally {
      Document.prototype.querySelector = realQuerySelector;
    }
  });
});
