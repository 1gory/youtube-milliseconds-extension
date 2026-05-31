const { calcAvg, getLast7Days, getLocalDateString } = require('../js/popup.js');

describe('calcAvg', () => {
  test('7d average divides by the full 7-day window, not active days', () => {
    const days = getLast7Days();
    // 7000s of watch time on a single day within the window.
    const stats = { [days[3]]: 7000 };
    // Window-length divisor → 7000 / 7 = 1000 (the old bug divided by 1 → 7000).
    expect(calcAvg(stats, '7d')).toBeCloseTo(1000, 6);
  });

  test('7d average spreads multiple active days over 7', () => {
    const days = getLast7Days();
    const stats = { [days[0]]: 700, [days[6]]: 700 };
    expect(calcAvg(stats, '7d')).toBeCloseTo(200, 6); // 1400 / 7
  });

  test('7d average is 0 with no data', () => {
    expect(calcAvg({}, '7d')).toBe(0);
  });

  test('30d average divides by the full 30-day window', () => {
    const today = getLocalDateString(new Date());
    const stats = { [today]: 3000 };
    expect(calcAvg(stats, '30d')).toBeCloseTo(100, 6); // 3000 / 30
  });

  test('all-time average divides by days that actually have data', () => {
    const stats = { '2020-01-01': 100, '2020-01-02': 300, '2020-01-03': 0 };
    // Two active days → 400 / 2 = 200 (the zero day is excluded from the divisor).
    expect(calcAvg(stats, 'all')).toBeCloseTo(200, 6);
  });

  test('all-time average is 0 with no data', () => {
    expect(calcAvg({}, 'all')).toBe(0);
  });
});
