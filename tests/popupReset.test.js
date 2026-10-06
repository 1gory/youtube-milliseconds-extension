/**
 * @jest-environment jsdom
 *
 * "Reset Statistics" in the real popup.html + popup.js.
 */

const { bootPopup } = require('./helpers/popupHarness');

const SETTINGS = {
  showMilliseconds: true, showIntervalTimer: true,
  showCopyBtn: false, showMsToggleBtn: true, showJumpBtn: false,
};

const boot = () => bootPopup({
  store: { totalWatchTime: 500, dailyStats: { '2026-01-01': 500 }, ...SETTINGS },
  onSendMessage: (msg, store) => {
    if (msg.type === 'RESET_STATS') Object.assign(store, { totalWatchTime: 0, dailyStats: {} });
    return { success: true };
  },
});

beforeEach(() => {
  // jsdom cannot navigate; location.reload() only logs "not implemented".
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const flush = () => new Promise((r) => setTimeout(r, 0));

test('the first click only arms the button', async () => {
  const { messages } = boot();
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
  const { messages, local, changes, store } = boot();
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
  boot();
  chrome.runtime.sendMessage.mockImplementation(() => Promise.resolve({ success: false }));
  const btn = document.getElementById('resetBtn');

  btn.click();
  btn.click();
  await flush();

  expect(btn.textContent).toBe('Reset failed — try again');
});
