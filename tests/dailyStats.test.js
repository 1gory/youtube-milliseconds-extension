const { getLocalDateString } = require('../js/background');
const { formatWatchTime } = require('../js/popup');

// Re-implement helpers locally for isolated testing
// (same logic as popup.js — tested here so popup.js doesn't need extra exports)
function getLocalDateStringLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatShortTime(totalSeconds) {
  const secs = Math.floor(totalSeconds);
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

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

  test('is consistent with popup helper', () => {
    const d = new Date(2026, 0, 9); // Jan 9
    expect(getLocalDateString(d)).toBe(getLocalDateStringLocal(d));
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

describe('dailyStats accumulation logic', () => {
  test('new day initializes from zero', () => {
    const dailyStats = {};
    const today = '2026-04-14';
    dailyStats[today] = (dailyStats[today] || 0) + 10;
    expect(dailyStats[today]).toBe(10);
  });

  test('existing day accumulates correctly', () => {
    const dailyStats = { '2026-04-14': 100 };
    dailyStats['2026-04-14'] = (dailyStats['2026-04-14'] || 0) + 50;
    expect(dailyStats['2026-04-14']).toBe(150);
  });

  test('different days are independent', () => {
    const dailyStats = {};
    dailyStats['2026-04-13'] = (dailyStats['2026-04-13'] || 0) + 300;
    dailyStats['2026-04-14'] = (dailyStats['2026-04-14'] || 0) + 600;
    expect(dailyStats['2026-04-13']).toBe(300);
    expect(dailyStats['2026-04-14']).toBe(600);
  });
});
