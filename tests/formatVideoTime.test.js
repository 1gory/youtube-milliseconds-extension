const { formatVideoTime } = require('../js/content');

describe('formatVideoTime', () => {
  describe('with milliseconds (showMs = true)', () => {
    test('formats 0 seconds', () => {
      expect(formatVideoTime(0, true)).toBe('0:00.000');
    });

    test('formats single digit seconds', () => {
      expect(formatVideoTime(5, true)).toBe('0:05.000');
    });

    test('formats fractional seconds', () => {
      expect(formatVideoTime(5.5, true)).toBe('0:05.500');
    });

    test('formats minutes and seconds', () => {
      expect(formatVideoTime(61.123, true)).toBe('1:01.123');
    });

    test('formats exactly 1 minute', () => {
      expect(formatVideoTime(60, true)).toBe('1:00.000');
    });

    test('formats 59:59', () => {
      expect(formatVideoTime(3599, true)).toBe('59:59.000');
    });

    test('formats hours, minutes, seconds', () => {
      expect(formatVideoTime(3661.456, true)).toBe('1:01:01.456');
    });

    test('formats exactly 1 hour', () => {
      expect(formatVideoTime(3600, true)).toBe('1:00:00.000');
    });

    test('milliseconds are zero-padded to 3 digits', () => {
      expect(formatVideoTime(1.001, true)).toBe('0:01.001');
      expect(formatVideoTime(1.01, true)).toBe('0:01.010');
      expect(formatVideoTime(1.1, true)).toBe('0:01.100');
    });

    test('minutes are zero-padded when hour is present', () => {
      expect(formatVideoTime(3660, true)).toBe('1:01:00.000');
    });

    test('seconds are zero-padded', () => {
      expect(formatVideoTime(3601, true)).toBe('1:00:01.000');
    });

    test('just under 1 hour stays in MM:SS.mmm format', () => {
      expect(formatVideoTime(3599.999, true)).toBe('59:59.999');
    });

    test('long video (10+ hours)', () => {
      expect(formatVideoTime(36061.5, true)).toBe('10:01:01.500');
    });
  });

  describe('without milliseconds (showMs = false)', () => {
    test('formats 0 seconds', () => {
      expect(formatVideoTime(0, false)).toBe('0:00');
    });

    test('ignores fractional seconds', () => {
      expect(formatVideoTime(5.9, false)).toBe('0:05');
    });

    test('formats minutes and seconds', () => {
      expect(formatVideoTime(61.9, false)).toBe('1:01');
    });

    test('formats hours, minutes, seconds', () => {
      expect(formatVideoTime(3661.9, false)).toBe('1:01:01');
    });

    test('just under 1 hour stays in MM:SS format', () => {
      expect(formatVideoTime(3599.999, false)).toBe('59:59');
    });

    test('exactly 1 hour', () => {
      expect(formatVideoTime(3600, false)).toBe('1:00:00');
    });
  });

  describe('edge cases', () => {
    test('999ms', () => {
      expect(formatVideoTime(0.999, true)).toBe('0:00.999');
    });

    test('999.9ms rounds to 1000ms (next second boundary)', () => {
      expect(formatVideoTime(0.9999, true)).toBe('0:01.000');
    });

    test('large video does not overflow hours', () => {
      // 25 hours, 1 minute, 1 second
      expect(formatVideoTime(90061.5, true)).toBe('25:01:01.500');
    });
  });
});
