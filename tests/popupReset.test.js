/**
 * @jest-environment jsdom
 *
 * "Reset Statistics" in the real popup.html + popup.js.
 */

const { readFileSync } = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POPUP_HTML = readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
const POPUP_JS = readFileSync(path.join(ROOT, 'js', 'popup.js'), 'utf8');

const SETTINGS = {
  showMilliseconds: true, showIntervalTimer: true,
  showCopyBtn: false, showMsToggleBtn: true, showJumpBtn: false,
};

function bootPopup() {
  const store = { totalWatchTime: 500, dailyStats: { '2026-01-01': 500 }, ...SETTINGS };
  const changes = [];
  const messages = [];
  const local = {
    get: (keys) => Promise.resolve(Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]]))),
    set: jest.fn((obj) => {
      Object.keys(obj).forEach((k) => changes.push({ key: k, newValue: obj[k] }));
      Object.assign(store, obj);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => { changes.push({ key: k, newValue: undefined }); delete store[k]; });
      return Promise.resolve();
    }),
  };
  global.chrome = {
    runtime: {
      sendMessage: jest.fn((msg) => {
        messages.push(msg);
        if (msg.type === 'RESET_STATS') Object.assign(store, { totalWatchTime: 0, dailyStats: {} });
        return Promise.resolve({ success: true });
      }),
    },
    storage: { local, onChanged: { addListener: () => {} } },
  };

  document.documentElement.innerHTML = POPUP_HTML.replace(/<script[\s\S]*?<\/script>/g, '');
  window.eval(POPUP_JS);
  return { store, changes, messages, local };
}

beforeEach(() => {
  // jsdom cannot navigate; location.reload() only logs "not implemented".
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const flush = () => new Promise((r) => setTimeout(r, 0));

test('the first click only arms the button', async () => {
  const { messages } = bootPopup();
  const btn = document.getElementById('resetBtn');

  btn.click();
  await flush();

  expect(messages).toEqual([]);
  expect(btn.textContent).toBe('Click again to confirm');
});

// The worker owns every statistics write; resetting from the popup directly
// raced its write chain. And clear() briefly deleted the settings keys, which
// every open YouTube tab read as "show every button" and rebuilt its controls.
test('the second click asks the service worker to reset and never clears storage', async () => {
  const { messages, local, changes, store } = bootPopup();
  const btn = document.getElementById('resetBtn');

  btn.click();
  btn.click();
  await flush();

  expect(messages).toEqual([{ type: 'RESET_STATS' }]);
  expect(local.clear).not.toHaveBeenCalled();
  expect(changes.filter((c) => c.key in SETTINGS)).toEqual([]);
  expect(store).toMatchObject({ totalWatchTime: 0, dailyStats: {}, ...SETTINGS });
});

test('a refused reset is reported on the button', async () => {
  bootPopup();
  chrome.runtime.sendMessage.mockImplementation(() => Promise.resolve({ success: false }));
  const btn = document.getElementById('resetBtn');

  btn.click();
  btn.click();
  await flush();

  expect(btn.textContent).toBe('Reset failed — try again');
});
