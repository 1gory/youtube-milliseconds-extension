const { accumulateWatchTime } = require('../js/background');

describe('accumulateWatchTime', () => {
  test('adds seconds to zero', () => {
    expect(accumulateWatchTime(0, 5)).toBe(5);
  });

  test('adds to existing total', () => {
    expect(accumulateWatchTime(100, 50)).toBe(150);
  });

  test('handles null current total', () => {
    expect(accumulateWatchTime(null, 5)).toBe(5);
  });

  test('handles undefined current total', () => {
    expect(accumulateWatchTime(undefined, 5)).toBe(5);
  });

  test('preserves float precision', () => {
    expect(accumulateWatchTime(0, 1.5)).toBe(1.5);
    expect(accumulateWatchTime(1.5, 1.5)).toBe(3.0);
  });

  test('accumulates fractional seconds correctly', () => {
    expect(accumulateWatchTime(0, 0.3)).toBeCloseTo(0.3);
    expect(accumulateWatchTime(0.3, 0.3)).toBeCloseTo(0.6);
  });

  // Regression test: old code used Math.round() on every update.
  // Math.round(0 + 0.5) = 1, Math.round(1 + 0.5) = 2 → 10 updates of 0.5s = 10s instead of 5s!
  test('regression: no premature rounding — 10 updates of 0.5s = 5s', () => {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total = accumulateWatchTime(total, 0.5);
    }
    expect(total).toBe(5);
  });

  // With old Math.round code: after 1000 updates of 1.001s,
  // each Math.round(n + 1.001) rounds up, giving ~1001s instead of ~1001s.
  // But for 0.499s each: Math.round rounds down to 0 every time → 0s total!
  test('regression: sub-second increments are not lost', () => {
    let total = 0;
    for (let i = 0; i < 100; i++) {
      total = accumulateWatchTime(total, 0.499);
    }
    expect(total).toBeCloseTo(49.9, 0);
  });

  test('large accumulation preserves reasonable precision', () => {
    let total = 0;
    for (let i = 0; i < 1000; i++) {
      total = accumulateWatchTime(total, 1.123);
    }
    expect(total).toBeCloseTo(1123, 0);
  });
});
