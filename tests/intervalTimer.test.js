const { formatVideoTime } = require('../js/content');

// The A/B flow itself (points, Δ, markers) is driven through the real
// content.js in contentControls.test.js; this suite covers Δ formatting.

describe('formatVideoTime with milliseconds (delta values)', () => {
  test('zero seconds', () => {
    expect(formatVideoTime(0, true)).toBe('0:00.000');
  });

  test('sub-second value', () => {
    expect(formatVideoTime(0.5, true)).toBe('0:00.500');
  });

  test('exactly one minute', () => {
    expect(formatVideoTime(60, true)).toBe('1:00.000');
  });

  test('one minute with milliseconds', () => {
    expect(formatVideoTime(61.123, true)).toBe('1:01.123');
  });

  test('exactly one hour', () => {
    expect(formatVideoTime(3600, true)).toBe('1:00:00.000');
  });

  test('over one hour with milliseconds', () => {
    expect(formatVideoTime(3723.456, true)).toBe('1:02:03.456');
  });

  test('floating point precision: 61.123 rounds correctly', () => {
    // IEEE 754: 61.123 % 1 ≈ 0.12299... — must use Math.round on total ms
    expect(formatVideoTime(61.123, true)).toBe('1:01.123');
  });
});
