const { computeWatchedSeconds } = require('../js/content');

const MAX = 300;

describe('computeWatchedSeconds', () => {
  test('normal 1s tick during playback counts fully', () => {
    expect(computeWatchedSeconds(1, 1, 1, MAX)).toBeCloseTo(1, 6);
  });

  test('background tab: throttled 60s tick with 60s of media counts fully', () => {
    // Regression: the old `elapsed < 10` guard discarded this entirely,
    // so watching in a background tab recorded zero watch time.
    expect(computeWatchedSeconds(60, 60, 1, MAX)).toBeCloseTo(60, 6);
  });

  test('machine sleep: huge wall clock but no media progress counts nothing', () => {
    expect(computeWatchedSeconds(3600, 0, 1, MAX)).toBe(0);
  });

  test('stalled buffering counts nothing', () => {
    expect(computeWatchedSeconds(1, 0, 1, MAX)).toBe(0);
  });

  test('forward seek is bounded by wall clock', () => {
    expect(computeWatchedSeconds(1, 600, 1, MAX)).toBeCloseTo(1, 6);
  });

  test('backward seek counts nothing rather than going negative', () => {
    expect(computeWatchedSeconds(1, -600, 1, MAX)).toBe(0);
  });

  test('2x playback: 1s of wall clock consuming 2s of media counts 1s', () => {
    expect(computeWatchedSeconds(1, 2, 2, MAX)).toBeCloseTo(1, 6);
  });

  test('0.5x playback: 1s of wall clock consuming 0.5s of media counts 1s', () => {
    expect(computeWatchedSeconds(1, 0.5, 0.5, MAX)).toBeCloseTo(1, 6);
  });

  test('result is clamped to maxSample', () => {
    expect(computeWatchedSeconds(10000, 10000, 1, MAX)).toBe(MAX);
  });

  test('invalid playbackRate falls back to 1x', () => {
    expect(computeWatchedSeconds(1, 1, 0, MAX)).toBeCloseTo(1, 6);
    expect(computeWatchedSeconds(1, 1, NaN, MAX)).toBeCloseTo(1, 6);
    expect(computeWatchedSeconds(1, 1, -2, MAX)).toBeCloseTo(1, 6);
  });

  test('non-finite inputs count nothing', () => {
    expect(computeWatchedSeconds(NaN, 1, 1, MAX)).toBe(0);
    expect(computeWatchedSeconds(1, NaN, 1, MAX)).toBe(0);
    expect(computeWatchedSeconds(Infinity, Infinity, 1, MAX)).toBe(0);
  });

  test('zero-length window counts nothing', () => {
    expect(computeWatchedSeconds(0, 0, 1, MAX)).toBe(0);
  });

  test('a full hour of continuous 1s ticks sums to one hour', () => {
    let total = 0;
    for (let i = 0; i < 3600; i++) total += computeWatchedSeconds(1, 1, 1, MAX);
    expect(total).toBeCloseTo(3600, 6);
  });
});
