// The version history shown in the popup (js/changelog.js) is hand-written
// each release. These checks make forgetting it, or mangling it, fail loudly
// instead of shipping a popup that advertises the previous version.

const { readFileSync } = require('fs');
const path = require('path');
const { CHANGELOG, CHANGELOG_VISIBLE, RELEASES_URL } = require('../js/changelog.js');

const MANIFEST = JSON.parse(readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));

const parse = (v) => v.split('.').map(Number);
const newer = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

test('the newest entry is the version in manifest.json', () => {
  expect(CHANGELOG[0].version).toBe(MANIFEST.version);
});

test('versions are X.Y.Z, unique, and strictly newest first', () => {
  CHANGELOG.forEach(({ version }) => expect(version).toMatch(/^\d+\.\d+\.\d+$/));
  for (let i = 1; i < CHANGELOG.length; i++) {
    expect(newer(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBe(true);
  }
});

test('dates are YYYY-MM and never go forward in time down the list', () => {
  CHANGELOG.forEach(({ date }) => expect(date).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/));
  for (let i = 1; i < CHANGELOG.length; i++) {
    expect(CHANGELOG[i - 1].date >= CHANGELOG[i].date).toBe(true);
  }
});

test('every entry has one to three non-empty lines', () => {
  CHANGELOG.forEach(({ version, changes }) => {
    expect({ version, n: changes.length >= 1 && changes.length <= 3 }).toEqual({ version, n: true });
    changes.forEach((line) => expect(line.trim().length).toBeGreaterThan(0));
  });
});

test('there are enough entries to fill the popup list', () => {
  expect(CHANGELOG.length).toBeGreaterThanOrEqual(CHANGELOG_VISIBLE);
});

test('the full-history link points at this repository\'s releases', () => {
  expect(RELEASES_URL).toBe(`${MANIFEST.homepage_url}/releases`);
});
