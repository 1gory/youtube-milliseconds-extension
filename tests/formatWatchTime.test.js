const { formatWatchTime } = require('../js/popup');

describe('formatWatchTime', () => {
  test('0 seconds', () => {
    expect(formatWatchTime(0)).toBe('0s');
  });

  test('1 second', () => {
    expect(formatWatchTime(1)).toBe('1s');
  });

  test('59 seconds', () => {
    expect(formatWatchTime(59)).toBe('59s');
  });

  test('exactly 1 minute (no seconds shown)', () => {
    expect(formatWatchTime(60)).toBe('1m');
  });

  test('1 minute 1 second', () => {
    expect(formatWatchTime(61)).toBe('1m 1s');
  });

  test('1 minute 30 seconds', () => {
    expect(formatWatchTime(90)).toBe('1m 30s');
  });

  test('exactly 1 hour (no minutes or seconds shown)', () => {
    expect(formatWatchTime(3600)).toBe('1h');
  });

  test('1 hour 1 minute', () => {
    expect(formatWatchTime(3660)).toBe('1h 1m');
  });

  test('1 hour 1 minute 1 second', () => {
    expect(formatWatchTime(3661)).toBe('1h 1m 1s');
  });

  test('exactly 1 day', () => {
    expect(formatWatchTime(86400)).toBe('1d');
  });

  test('1 day 1 hour', () => {
    expect(formatWatchTime(90000)).toBe('1d 1h');
  });

  test('exactly 1 year', () => {
    expect(formatWatchTime(365 * 24 * 3600)).toBe('1y');
  });

  test('1 year 1 day 1 hour 1 minute 1 second', () => {
    const total = 365 * 24 * 3600 + 86400 + 3600 + 60 + 1;
    expect(formatWatchTime(total)).toBe('1y 1d 1h 1m 1s');
  });

  test('truncates fractional seconds', () => {
    expect(formatWatchTime(1.9)).toBe('1s');
    expect(formatWatchTime(59.9)).toBe('59s');
  });

  test('shows 0s when total is fractional but < 1s', () => {
    expect(formatWatchTime(0.9)).toBe('0s');
  });
});
