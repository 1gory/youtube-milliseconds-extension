const { getLocalDateString } = require('../js/background');
const popup = require('../js/popup');

const { formatShortTime } = popup;

describe('getLocalDateString (background.js)', () => {
  test('formats a known date correctly', () => {
    const d = new Date(2026, 3, 14); // April 14, 2026 local
    expect(getLocalDateString(d)).toBe('2026-04-14');
  });

  test('zero-pads single-digit month', () => {
    const d = new Date(2026, 2, 5); // March 5
    expect(getLocalDateString(d)).toBe('2026-03-05');
  });

  test('zero-pads single-digit day', () => {
    const d = new Date(2026, 11, 1); // December 1
    expect(getLocalDateString(d)).toBe('2026-12-01');
  });

  // background.js writes dailyStats keys, popup.js reads them: the two copies
  // of this helper must agree or the popup shows empty days.
  test('agrees with the popup copy that reads the keys back', () => {
    for (const d of [new Date(2026, 0, 9), new Date(2026, 11, 31, 23, 59), new Date(2024, 1, 29, 0, 0)]) {
      expect(popup.getLocalDateString(d)).toBe(getLocalDateString(d));
    }
  });
});

describe('formatShortTime', () => {
  test('0 seconds', () => {
    expect(formatShortTime(0)).toBe('0s');
  });

  test('45 seconds', () => {
    expect(formatShortTime(45)).toBe('45s');
  });

  test('exactly 1 minute', () => {
    expect(formatShortTime(60)).toBe('1m');
  });

  test('1 minute 30 seconds', () => {
    expect(formatShortTime(90)).toBe('1m 30s');
  });

  test('exactly 1 hour', () => {
    expect(formatShortTime(3600)).toBe('1h');
  });

  test('1 hour 30 minutes', () => {
    expect(formatShortTime(5430)).toBe('1h 30m');
  });

  test('truncates fractional seconds', () => {
    expect(formatShortTime(90.9)).toBe('1m 30s');
  });

  test('hours without extra minutes', () => {
    expect(formatShortTime(7200)).toBe('2h');
  });
});

// Accumulation into dailyStats is covered against the real service worker in
// backgroundMessages.test.js.
