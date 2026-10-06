// The service worker's message handlers, driven through the real background.js
// with a fake chrome.storage whose reads and writes take real (fake-timer) time,
// so interleavings between tabs and the popup can actually happen.

const STORAGE_LATENCY_MS = 10;

function loadBackground(initialStore = {}) {
  const store = JSON.parse(JSON.stringify(initialStore));
  let onMessage;
  const delay = () => new Promise((r) => setTimeout(r, STORAGE_LATENCY_MS));

  global.chrome = {
    runtime: {
      getURL: (p) => `chrome-extension://test-extension-id/${p}`,
      onInstalled: { addListener: () => {} },
      onMessage: { addListener: (fn) => { onMessage = fn; } },
    },
    storage: {
      local: {
        get: async (keys) => {
          await delay();
          const out = {};
          keys.forEach((k) => { if (k in store) out[k] = JSON.parse(JSON.stringify(store[k])); });
          return out;
        },
        set: async (obj) => {
          await delay();
          Object.assign(store, JSON.parse(JSON.stringify(obj)));
        },
      },
    },
  };

  jest.isolateModules(() => { require('../js/background.js'); });

  // Resolves with the handler's sendResponse payload.
  const send = (message, sender = { tab: { id: 1 } }) => new Promise((resolve) => {
    const keepOpen = onMessage(message, sender, resolve);
    if (keepOpen !== true) resolve(undefined);
  });

  return { store, send };
}

const FROM_POPUP = { url: 'chrome-extension://test-extension-id/popup.html' };
// popup.html opened as a tab: has sender.tab, is still our own page.
const FROM_POPUP_IN_TAB = { ...FROM_POPUP, tab: { id: 3 } };
const FROM_TAB = { tab: { id: 7 }, url: 'https://www.youtube.com/watch?v=abc' };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  delete global.chrome;
});

describe('UPDATE_WATCH_TIME', () => {
  test('adds to the total and to today', async () => {
    const { store, send } = loadBackground({ totalWatchTime: 100, dailyStats: { [today()]: 40 } });

    const done = send({ type: 'UPDATE_WATCH_TIME', seconds: 5.5 });
    await jest.advanceTimersByTimeAsync(100);

    expect(await done).toEqual({ success: true });
    expect(store.totalWatchTime).toBeCloseTo(105.5, 9);
    expect(store.dailyStats[today()]).toBeCloseTo(45.5, 9);
  });

  test('two tabs reporting at the same moment are both counted', async () => {
    const { store, send } = loadBackground({ totalWatchTime: 0, dailyStats: {} });

    send({ type: 'UPDATE_WATCH_TIME', seconds: 5 });
    send({ type: 'UPDATE_WATCH_TIME', seconds: 7 });
    await jest.advanceTimersByTimeAsync(200);

    expect(store.totalWatchTime).toBe(12);
    expect(store.dailyStats[today()]).toBe(12);
  });

  test.each([[0], [-3], ['abc'], [NaN], [Infinity]])('rejects %p seconds', async (seconds) => {
    const { store, send } = loadBackground({ totalWatchTime: 50 });

    const res = send({ type: 'UPDATE_WATCH_TIME', seconds });
    await jest.advanceTimersByTimeAsync(100);

    expect(await res).toEqual({ success: false });
    expect(store.totalWatchTime).toBe(50);
  });

  test('clamps an oversized batch to one hour', async () => {
    const { store, send } = loadBackground({ totalWatchTime: 0 });

    send({ type: 'UPDATE_WATCH_TIME', seconds: 99999 });
    await jest.advanceTimersByTimeAsync(100);

    expect(store.totalWatchTime).toBe(3600);
  });
});

// The popup used to reset by calling storage.clear() + set() itself, outside
// the worker's write chain. A watch-time update already between its read and
// its write would then land after the reset and put the old total back.
describe('RESET_STATS', () => {
  const SETTINGS = {
    showMilliseconds: false, showIntervalTimer: true,
    showCopyBtn: false, showMsToggleBtn: true, showJumpBtn: false,
  };

  test('zeroes the statistics and leaves every setting alone', async () => {
    const { store, send } = loadBackground({
      totalWatchTime: 999, dailyStats: { '2026-01-01': 999 }, ...SETTINGS,
    });

    const res = send({ type: 'RESET_STATS' }, FROM_POPUP);
    await jest.advanceTimersByTimeAsync(100);

    expect(await res).toEqual({ success: true });
    expect(store.totalWatchTime).toBe(0);
    expect(store.dailyStats).toEqual({});
    expect(store).toMatchObject(SETTINGS);
  });

  test('is not overtaken by a watch-time update already in flight', async () => {
    const { store, send } = loadBackground({ totalWatchTime: 1000, dailyStats: { [today()]: 1000 } });

    send({ type: 'UPDATE_WATCH_TIME', seconds: 5 }, FROM_TAB);
    await jest.advanceTimersByTimeAsync(STORAGE_LATENCY_MS / 2); // update has read, not written
    send({ type: 'RESET_STATS' }, FROM_POPUP);
    await jest.advanceTimersByTimeAsync(200);

    expect(store.totalWatchTime).toBe(0);
    expect(store.dailyStats).toEqual({});
  });

  test('is accepted from popup.html opened in a tab', async () => {
    const { store, send } = loadBackground({ totalWatchTime: 1000 });

    const res = send({ type: 'RESET_STATS' }, FROM_POPUP_IN_TAB);
    await jest.advanceTimersByTimeAsync(100);

    expect(await res).toEqual({ success: true });
    expect(store.totalWatchTime).toBe(0);
  });

  test('is refused when it comes from a content script', async () => {
    const { store, send } = loadBackground({ totalWatchTime: 1000 });

    const res = send({ type: 'RESET_STATS' }, FROM_TAB);
    await jest.advanceTimersByTimeAsync(100);

    expect(await res).toEqual({ success: false });
    expect(store.totalWatchTime).toBe(1000);
  });
});
