const { parseTimestamp } = require('../js/content');

describe('parseTimestamp — valid formats', () => {
  test('SS.mmm form', () => {
    expect(parseTimestamp('5.500')).toBeCloseTo(5.5, 5);
    expect(parseTimestamp('59.999')).toBeCloseTo(59.999, 5);
    expect(parseTimestamp('0.001')).toBeCloseTo(0.001, 5);
  });

  test('plain integer seconds', () => {
    expect(parseTimestamp('42')).toBe(42);
    expect(parseTimestamp('0')).toBe(0);
  });

  test('M:SS form', () => {
    expect(parseTimestamp('1:30')).toBe(90);
    expect(parseTimestamp('12:34')).toBe(12 * 60 + 34);
    expect(parseTimestamp('0:00')).toBe(0);
  });

  test('M:SS.mmm form', () => {
    expect(parseTimestamp('1:01.123')).toBeCloseTo(61.123, 5);
    expect(parseTimestamp('59:59.999')).toBeCloseTo(59 * 60 + 59.999, 5);
  });

  test('H:MM:SS form', () => {
    expect(parseTimestamp('1:00:00')).toBe(3600);
    expect(parseTimestamp('2:30:45')).toBe(2 * 3600 + 30 * 60 + 45);
  });

  test('H:MM:SS.mmm form', () => {
    expect(parseTimestamp('1:01:01.456')).toBeCloseTo(3661.456, 5);
    expect(parseTimestamp('10:00:00.000')).toBe(36000);
  });

  test('comma as decimal separator', () => {
    expect(parseTimestamp('5,500')).toBeCloseTo(5.5, 5);
    expect(parseTimestamp('1:01,123')).toBeCloseTo(61.123, 5);
  });

  test('whitespace is trimmed', () => {
    expect(parseTimestamp('  1:30  ')).toBe(90);
    expect(parseTimestamp('\t5.500\n')).toBeCloseTo(5.5, 5);
  });

  test('large leading hours (no upper bound on top group)', () => {
    expect(parseTimestamp('100:00:00')).toBe(100 * 3600);
  });

  test('large leading minutes when no hours group', () => {
    expect(parseTimestamp('120:00')).toBe(120 * 60);
  });
});

describe('parseTimestamp — invalid input', () => {
  test('non-string input', () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp(123)).toBeNull();
    expect(parseTimestamp({})).toBeNull();
  });

  test('empty / whitespace-only string', () => {
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('   ')).toBeNull();
  });

  test('non-numeric content', () => {
    expect(parseTimestamp('abc')).toBeNull();
    expect(parseTimestamp('1:abc')).toBeNull();
    expect(parseTimestamp('1h30m')).toBeNull();
  });

  test('minutes/seconds >= 60', () => {
    expect(parseTimestamp('1:60:00')).toBeNull();
    expect(parseTimestamp('1:00:60')).toBeNull();
    expect(parseTimestamp('1:60')).toBeNull();
    expect(parseTimestamp('1:99')).toBeNull();
  });

  test('negative values', () => {
    expect(parseTimestamp('-1')).toBeNull();
    expect(parseTimestamp('-1:00')).toBeNull();
  });

  test('too many colon-separated parts', () => {
    expect(parseTimestamp('1:2:3:4')).toBeNull();
  });

  test('empty segments', () => {
    expect(parseTimestamp(':30')).toBeNull();
    expect(parseTimestamp('1::30')).toBeNull();
    expect(parseTimestamp('1:30:')).toBeNull();
  });
});

describe('parseTimestamp — comma decimal separator (replace-all regression)', () => {
  // Locks in the fix changing .replace(',', '.') → .replace(/,/g, '.').
  // A single comma is a valid decimal separator; multiple commas are invalid
  // (would previously leave a stray comma, but must resolve to null either way).
  test('single comma parses as decimal', () => {
    expect(parseTimestamp('1,5')).toBeCloseTo(1.5, 5);
    expect(parseTimestamp('5,500')).toBeCloseTo(5.5, 5);
  });

  test('comma decimal in M:SS form', () => {
    expect(parseTimestamp('1:2,5')).toBeCloseTo(62.5, 5);
    expect(parseTimestamp('1:01,123')).toBeCloseTo(61.123, 5);
  });

  test('multiple commas are invalid', () => {
    expect(parseTimestamp('1,2,3')).toBeNull();
    expect(parseTimestamp('1,2,3,4')).toBeNull();
    expect(parseTimestamp('1:2,3,4')).toBeNull();
  });
});

describe('applyJump clamp semantics (pure logic)', () => {
  // Mirrors the clamp performed inside applyJump():
  //   clamped = Math.max(0, Math.min(seconds, duration))
  function clamp(seconds, duration) {
    return Math.max(0, Math.min(seconds, duration));
  }

  test('negative input clamps to 0', () => {
    expect(clamp(-5, 100)).toBe(0);
  });

  test('input greater than duration clamps to duration', () => {
    expect(clamp(150, 100)).toBe(100);
  });

  test('input within range is unchanged', () => {
    expect(clamp(42.5, 100)).toBe(42.5);
  });

  test('boundary values are preserved', () => {
    expect(clamp(0, 100)).toBe(0);
    expect(clamp(100, 100)).toBe(100);
  });
});
