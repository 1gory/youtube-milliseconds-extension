/**
 * @jest-environment jsdom
 *
 * The player-bar controls, driven through the real content.js. These replace
 * suites that re-implemented a handler locally and tested the copy — one of
 * them kept passing for a toggle handler content.js no longer had.
 */

const {
  q, flushFrames, bootExtension, pressKey, teardown,
} = require('./helpers/contentHarness');

beforeEach(() => {
  jest.useFakeTimers();
  window.history.replaceState({}, '', '/watch?v=abc123');
});

afterEach(() => {
  teardown();
  jest.useRealTimers();
});

describe('milliseconds toggle button', () => {
  test('flips the stored setting and the readout format, both ways', async () => {
    const { store } = await bootExtension();
    const video = q('video');
    // Paused: no display loop, so every repaint below is the toggle's own doing.
    video.paused = true;
    video.dispatchEvent(new Event('pause'));
    video.currentTime = 61.25;
    video.dispatchEvent(new Event('seeked'));
    expect(q('.ytp-time-current').textContent).toBe('1:01.250');

    q('.ytp-ms-toggle-btn').click();
    await jest.advanceTimersByTimeAsync(0);
    expect(store.showMilliseconds).toBe(false);
    expect(q('.ytp-time-current').textContent).toBe('1:01');
    expect(q('.ytp-ms-toggle-btn').getAttribute('aria-pressed')).toBe('false');

    q('.ytp-ms-toggle-btn').click();
    await jest.advanceTimersByTimeAsync(0);
    expect(store.showMilliseconds).toBe(true);
    expect(q('.ytp-time-current').textContent).toBe('1:01.250');
  });

  test('a missing key counts as "on", so the first click turns milliseconds off', async () => {
    const { store } = await bootExtension();
    expect('showMilliseconds' in store).toBe(false);

    q('.ytp-ms-toggle-btn').click();
    await jest.advanceTimersByTimeAsync(0);

    expect(store.showMilliseconds).toBe(false);
  });
});

describe('jump to timestamp', () => {
  test('G opens the input pre-filled with the current position', async () => {
    await bootExtension();
    q('video').currentTime = 12.5;

    pressKey('g', 'KeyG');

    expect(q('.ytp-jump-input')).not.toBeNull();
    expect(q('.ytp-jump-input').value).toBe('0:12.500');
  });

  test('Enter seeks to the typed timestamp and closes the input', async () => {
    await bootExtension();
    pressKey('g', 'KeyG');
    const input = q('.ytp-jump-input');

    input.value = '1:02.345';
    pressKey('Enter', 'Enter', input);

    expect(q('video').currentTime).toBeCloseTo(62.345, 6);
    expect(q('.ytp-jump-input')).toBeNull();
  });

  test('a timestamp past the end clamps to the duration', async () => {
    await bootExtension();
    pressKey('g', 'KeyG');
    const input = q('.ytp-jump-input');

    input.value = '2:00:00';
    pressKey('Enter', 'Enter', input);

    expect(q('video').currentTime).toBe(600);
  });

  test('invalid input is flagged and does not seek', async () => {
    await bootExtension();
    q('video').currentTime = 5;
    pressKey('g', 'KeyG');
    const input = q('.ytp-jump-input');

    input.value = '1:75';
    pressKey('Enter', 'Enter', input);

    expect(q('video').currentTime).toBe(5);
    expect(input.classList.contains('ytp-jump-input--error')).toBe(true);
    expect(q('.ytp-jump-input')).toBe(input);
  });

  test('keys typed into the input never reach the page shortcuts', async () => {
    await bootExtension();
    pressKey('g', 'KeyG');
    const input = q('.ytp-jump-input');

    pressKey('[', 'BracketLeft', input);

    expect(q('.ytp-interval-badge--visible')).toBeNull();
  });
});

describe('interval A→B', () => {
  test('[ and ] mark both points and show the delta', async () => {
    await bootExtension();
    const video = q('video');

    video.currentTime = 10.5;
    pressKey('[', 'BracketLeft');
    video.currentTime = 20.75;
    pressKey(']', 'BracketRight');

    expect(q('.ytp-interval-badge').classList.contains('ytp-interval-badge--visible')).toBe(true);
    expect(q('[data-interval="start"]').textContent).toBe('0:10.500');
    expect(q('[data-interval="end"]').textContent).toBe('0:20.750');
    expect(q('[data-interval="delta"]').textContent).toBe('0:10.250');
    expect(q('.ytp-interval-copy-btn').disabled).toBe(false);
  });

  test('B before A still yields a positive delta', async () => {
    await bootExtension();
    const video = q('video');

    video.currentTime = 154.789;
    pressKey(']', 'BracketRight');
    video.currentTime = 83.456;
    pressKey('[', 'BracketLeft');

    expect(q('[data-interval="delta"]').textContent).toBe('1:11.333');
  });

  test('progress-bar markers sit at the right percentage', async () => {
    await bootExtension();
    const video = q('video');

    video.currentTime = 60;
    pressKey('[', 'BracketLeft');
    video.currentTime = 300;
    pressKey(']', 'BracketRight');

    expect(q('.ytp-interval-marker-a').style.left).toBe('10%');
    expect(q('.ytp-interval-marker-b').style.left).toBe('50%');
    expect(q('.ytp-interval-segment').style.width).toBe('40%');
  });

  test('reset hides the badge and the markers', async () => {
    await bootExtension();
    pressKey('[', 'BracketLeft');
    pressKey(']', 'BracketRight');

    q('.ytp-interval-reset-btn').click();

    expect(q('.ytp-interval-badge--visible')).toBeNull();
    expect(q('.ytp-interval-marker-a').style.display).toBe('none');
    expect(q('.ytp-interval-segment').style.display).toBe('none');
  });
});

// On a Cyrillic (or Greek, Hebrew…) layout the physical G key reports
// key === 'п', and [ / ] report 'х' / 'ъ', so matching on e.key alone left
// every shortcut dead for those users.
describe('shortcuts on non-Latin keyboard layouts', () => {
  test('the physical G key opens the jump input on a Russian layout', async () => {
    await bootExtension();

    pressKey('п', 'KeyG');

    expect(q('.ytp-jump-input')).not.toBeNull();
  });

  test('the physical bracket keys set A and B on a Russian layout', async () => {
    await bootExtension();
    const video = q('video');

    video.currentTime = 1;
    pressKey('х', 'BracketLeft');
    video.currentTime = 3;
    pressKey('ъ', 'BracketRight');

    expect(q('[data-interval="delta"]').textContent).toBe('0:02.000');
  });

  // Latin layouts keep matching on the character, so a German user typing ü
  // (which sits on the BracketLeft key) does not set a point by accident.
  test('a Latin letter on the bracket key does not trigger the shortcut', async () => {
    await bootExtension();

    pressKey('ü', 'BracketLeft');

    expect(q('.ytp-interval-badge--visible')).toBeNull();
  });

  test('a Latin layout that moves G elsewhere still follows the character', async () => {
    await bootExtension();

    // Dvorak: the physical G key types "i".
    pressKey('i', 'KeyG');

    expect(q('.ytp-jump-input')).toBeNull();
  });
});

// Clicking the time readout makes YouTube show the time *remaining*, written
// into the same .ytp-time-current node as "-10:05". With milliseconds off our
// 4 Hz loop kept writing the elapsed time over it, so the readout flickered
// between "-10:05" and "0:30"; with milliseconds on the mode was silently
// overridden. (Behaviour observed on youtube.com, 2026-10-06.)
describe("YouTube's remaining-time mode", () => {
  // What YouTube itself does on each of its ticks.
  const youtubeWrites = (text) => { q('.ytp-time-current').textContent = text; };

  test('with milliseconds off the readout is left to YouTube, no flicker', async () => {
    await bootExtension(undefined, { store: { showMilliseconds: false } });
    const video = q('video');
    video.dispatchEvent(new Event('play'));
    video.currentTime = 30;

    youtubeWrites('-9:30');
    await jest.advanceTimersByTimeAsync(1000);

    expect(q('.ytp-time-current').textContent).toBe('-9:30');
  });

  test('with milliseconds on the remaining time is shown with milliseconds', async () => {
    await bootExtension();
    const video = q('video');
    video.dispatchEvent(new Event('play'));
    video.currentTime = 30;

    youtubeWrites('-9:30');
    await jest.advanceTimersByTimeAsync(0);
    expect(q('.ytp-time-current').textContent).toBe('-9:30.000');

    video.currentTime = 31.25;
    flushFrames(1);
    expect(q('.ytp-time-current').textContent).toBe('-9:28.750');
  });

  test('switching YouTube back to elapsed time is followed too', async () => {
    await bootExtension();
    const video = q('video');
    video.dispatchEvent(new Event('play'));
    video.currentTime = 30;
    youtubeWrites('-9:30');
    await jest.advanceTimersByTimeAsync(0);

    youtubeWrites('0:30');
    await jest.advanceTimersByTimeAsync(0);
    video.currentTime = 31.25;
    flushFrames(1);

    expect(q('.ytp-time-current').textContent).toBe('0:31.250');
  });

  test('turning milliseconds on keeps a remaining-time mode chosen while they were off', async () => {
    await bootExtension(undefined, { store: { showMilliseconds: false } });
    const video = q('video');
    video.paused = true;
    video.dispatchEvent(new Event('pause'));
    video.currentTime = 30;
    youtubeWrites('-9:30');

    await chrome.storage.local.set({ showMilliseconds: true });
    await jest.advanceTimersByTimeAsync(0);

    expect(q('.ytp-time-current').textContent).toBe('-9:30.000');
  });

  test('a live stream (no finite duration) stays on elapsed time', async () => {
    await bootExtension();
    const video = q('video');
    Object.defineProperty(video, 'duration', { get: () => Infinity, configurable: true });
    video.dispatchEvent(new Event('play'));
    video.currentTime = 30;

    youtubeWrites('-0:00');
    await jest.advanceTimersByTimeAsync(0);
    flushFrames(1);

    expect(q('.ytp-time-current').textContent).toBe('0:30.000');
  });
});

// Chrome does not re-inject content scripts when the extension auto-updates,
// so every open YouTube tab keeps running the old copy with a dead runtime.
// Watch-time reporting has to stop there, but the readout needs nothing from
// the runtime — killing the display loop along with it left the milliseconds
// stuttering at YouTube's own tick rate until the next pause/play.
describe('after the extension context is invalidated', () => {
  test('the readout keeps advancing while the video plays', async () => {
    const { messages } = await bootExtension();
    const video = q('video');
    video.dispatchEvent(new Event('play'));

    delete global.chrome.runtime.id;
    video.currentTime = 1.5;
    await jest.advanceTimersByTimeAsync(1500);
    const sentBefore = messages.length;

    video.currentTime = 4.25;
    flushFrames(1);
    expect(q('.ytp-time-current').textContent).toBe('0:04.250');

    video.currentTime = 30;
    await jest.advanceTimersByTimeAsync(10000);
    expect(messages.length).toBe(sentBefore);
  });
});
