/**
 * @jest-environment jsdom
 *
 * Version history in the real popup: the version link in the footer opens an
 * in-popup list of the latest releases, ending with a link to GitHub.
 */

const { bootPopup, MANIFEST } = require('./helpers/popupHarness');
const { CHANGELOG, CHANGELOG_VISIBLE, RELEASES_URL } = require('../js/changelog.js');

const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];

beforeEach(() => bootPopup({ store: { totalWatchTime: 0, dailyStats: {} } }));

test('the footer shows the installed version, read from the manifest', () => {
  expect(q('#versionBtn').textContent).toBe(`v${MANIFEST.version}`);
});

test('the history is closed until the version is clicked', () => {
  expect(q('#changelog').hidden).toBe(true);
  expect(q('#versionBtn').getAttribute('aria-expanded')).toBe('false');

  q('#versionBtn').click();

  expect(q('#changelog').hidden).toBe(false);
  expect(q('#versionBtn').getAttribute('aria-expanded')).toBe('true');
});

test('a second click closes it again', () => {
  q('#versionBtn').click();
  q('#versionBtn').click();

  expect(q('#changelog').hidden).toBe(true);
  expect(q('#versionBtn').getAttribute('aria-expanded')).toBe('false');
});

test('it lists the latest releases, newest first, with only the newest expanded', () => {
  q('#versionBtn').click();
  const entries = qa('#changelog .changelog-entry');

  expect(entries).toHaveLength(Math.min(CHANGELOG_VISIBLE, CHANGELOG.length));
  expect(entries.map((e) => e.querySelector('.changelog-version').textContent))
    .toEqual(CHANGELOG.slice(0, CHANGELOG_VISIBLE).map((c) => `v${c.version}`));
  expect(entries.map((e) => e.open)).toEqual(entries.map((_, i) => i === 0));
});

test('each release shows its month and its lines', () => {
  q('#versionBtn').click();
  const first = q('#changelog .changelog-entry');

  expect(first.querySelector('.changelog-date').textContent).toBe(
    new Date(`${CHANGELOG[0].date}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  expect([...first.querySelectorAll('li')].map((li) => li.textContent)).toEqual(CHANGELOG[0].changes);
});

test('the last row links to the full history on GitHub, in a new tab', () => {
  q('#versionBtn').click();
  const link = q('#changelog').lastElementChild;

  expect(link.tagName).toBe('A');
  expect(link.href).toBe(RELEASES_URL);
  expect(link.target).toBe('_blank');
  expect(link.rel).toContain('noopener');
});
