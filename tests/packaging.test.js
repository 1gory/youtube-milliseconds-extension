// The store ZIP is built from a hand-maintained file list in RELEASE.md
// (step 10). A runtime file missing from it ships an extension that breaks
// only after install — e.g. a popup script that 404s and leaves the popup
// half-rendered. Every file the extension loads must exist and be in the list.

const { readFileSync, existsSync } = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');
const MANIFEST = JSON.parse(read('manifest.json'));

// Paths named by the `zip -r … \` command in RELEASE.md step 10.
function zipList() {
  const release = read('RELEASE.md');
  const cmd = /```bash\n[^`]*?zip -r [^\n]*\\\n([\s\S]*?)```/.exec(release);
  if (!cmd) throw new Error('zip command not found in RELEASE.md');
  return cmd[1].split('\n').map((l) => l.replace(/\\$/, '').trim()).filter(Boolean);
}

function runtimeFiles() {
  const files = new Set(['manifest.json']);
  (MANIFEST.content_scripts || []).forEach((cs) => [...(cs.js || []), ...(cs.css || [])].forEach((f) => files.add(f)));
  files.add(MANIFEST.background.service_worker);
  files.add(MANIFEST.action.default_popup);
  Object.values(MANIFEST.icons || {}).forEach((f) => files.add(f));
  Object.values(MANIFEST.action.default_icon || {}).forEach((f) => files.add(f));

  const popup = read(MANIFEST.action.default_popup);
  for (const m of popup.matchAll(/<(?:script|link)[^>]*\b(?:src|href)="([^"]+)"/g)) {
    if (!/^[a-z]+:/i.test(m[1])) files.add(m[1]);
  }
  return [...files];
}

const inZip = (file, list) => list.some((entry) =>
  entry === file || (entry.endsWith('/') && file.startsWith(entry)));

test('every file the extension loads exists', () => {
  const missing = runtimeFiles().filter((f) => !existsSync(path.join(ROOT, f)));
  expect(missing).toEqual([]);
});

test('every file the extension loads is in the RELEASE.md zip command', () => {
  const list = zipList();
  const notPackaged = runtimeFiles().filter((f) => !inZip(f, list));
  expect(notPackaged).toEqual([]);
});
