const { pruneDailyStats } = require('../js/background.js');

// Builds { 'YYYY-MM-DD': 60 } for `count` consecutive days ending at `endDate`.
function buildStats(endDate, count) {
  const stats = {};
  for (let i = 0; i < count; i++) {
    const d = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    stats[key] = 60;
  }
  return stats;
}

describe('pruneDailyStats', () => {
  const today = new Date(2026, 7, 15); // 2026-08-15

  test('returns the same object when under the limit', () => {
    const stats = buildStats(today, 10);
    expect(pruneDailyStats(stats, today, 730)).toBe(stats);
  });

  test('returns the same object exactly at the limit', () => {
    const stats = buildStats(today, 30);
    expect(pruneDailyStats(stats, today, 30)).toBe(stats);
  });

  test('drops days older than the retention window', () => {
    const stats = buildStats(today, 40);
    const pruned = pruneDailyStats(stats, today, 30);

    expect(Object.keys(pruned)).toHaveLength(30);
    expect(pruned['2026-08-15']).toBe(60);   // today, kept
    expect(pruned['2026-07-17']).toBe(60);   // 29 days back, oldest kept
    expect(pruned['2026-07-16']).toBeUndefined(); // 30 days back, dropped
    expect(pruned['2026-07-07']).toBeUndefined();
  });

  test('does not mutate the input', () => {
    const stats = buildStats(today, 40);
    const before = Object.keys(stats).length;
    pruneDailyStats(stats, today, 30);
    expect(Object.keys(stats)).toHaveLength(before);
  });

  test('keeps sparse history intact when the key count is small', () => {
    const stats = { '2019-01-01': 10, '2026-08-15': 20 };
    expect(pruneDailyStats(stats, today, 730)).toEqual(stats);
  });

  test('keeps future-dated keys (clock skew) rather than silently losing them', () => {
    const stats = { ...buildStats(today, 40), '2026-09-01': 99 };
    const pruned = pruneDailyStats(stats, today, 30);
    expect(pruned['2026-09-01']).toBe(99);
  });

  test('handles a window that crosses a year boundary', () => {
    const jan = new Date(2026, 0, 5); // 2026-01-05
    const stats = buildStats(jan, 20);
    const pruned = pruneDailyStats(stats, jan, 10);

    expect(Object.keys(pruned)).toHaveLength(10);
    expect(pruned['2025-12-27']).toBe(60);        // 9 days back, oldest kept
    expect(pruned['2025-12-26']).toBeUndefined(); // 10 days back, dropped
  });
});
