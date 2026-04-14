const { formatVideoTime } = require('../js/content');

// Helper: compute Δ the same way the extension does
function computeDelta(startTime, endTime) {
  return Math.abs(endTime - startTime);
}

describe('interval delta calculation', () => {
  test('normal case: A < B', () => {
    const delta = computeDelta(10.5, 20.75);
    expect(delta).toBeCloseTo(10.25, 5);
  });

  test('reversed case: B < A gives same positive Δ', () => {
    const delta = computeDelta(20.75, 10.5);
    expect(delta).toBeCloseTo(10.25, 5);
  });

  test('zero interval: A === B', () => {
    const delta = computeDelta(5.123, 5.123);
    expect(delta).toBe(0);
  });

  test('delta formatted correctly (sub-minute)', () => {
    const delta = computeDelta(83.456, 84.789);
    expect(formatVideoTime(delta, true)).toBe('0:01.333');
  });

  test('delta formatted correctly (cross-minute boundary)', () => {
    // 1:23.456 → 2:34.789 = 1:11.333
    const delta = computeDelta(83.456, 154.789);
    expect(formatVideoTime(delta, true)).toBe('1:11.333');
  });

  test('delta formatted correctly when B < A (reversed)', () => {
    const delta = computeDelta(154.789, 83.456);
    expect(formatVideoTime(delta, true)).toBe('1:11.333');
  });
});

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
