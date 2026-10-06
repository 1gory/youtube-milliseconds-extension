// Shared jsdom harness for the real popup.html: renders its markup and
// evaluates every <script src> it references, in order, the way Chrome does —
// so a script missing from popup.html (or a wrong load order) fails here too.
// Only usable from suites that opt in with `@jest-environment jsdom`.

const { readFileSync } = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const POPUP_HTML = readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
const MANIFEST = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

const popupScripts = () =>
  [...POPUP_HTML.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);

// Fake chrome.* for the popup. `onSendMessage` lets a suite decide how the
// service worker answers.
function bootPopup({ store: initial = {}, onSendMessage } = {}) {
  const store = { ...initial };
  const changes = [];
  const messages = [];
  const local = {
    get: (keys) => Promise.resolve(Object.fromEntries(
      (Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, store[k]]))),
    set: jest.fn((obj) => {
      Object.keys(obj).forEach((k) => changes.push({ key: k, newValue: obj[k] }));
      Object.assign(store, obj);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => { changes.push({ key: k, newValue: undefined }); delete store[k]; });
      return Promise.resolve();
    }),
  };
  global.chrome = {
    runtime: {
      getManifest: () => MANIFEST,
      sendMessage: jest.fn((msg) => {
        messages.push(msg);
        return Promise.resolve(onSendMessage ? onSendMessage(msg, store) : { success: true });
      }),
    },
    storage: { local, onChanged: { addListener: () => {} } },
  };

  document.documentElement.innerHTML = POPUP_HTML.replace(/<script[\s\S]*?<\/script>/g, '');
  // The page's scripts, in popup.html order, inside one block: a later script
  // sees an earlier one's top-level consts (as classic scripts on the real
  // page do), while each boot gets a fresh scope — re-running a top-level
  // `const` in the shared global scope would throw on the second boot.
  const code = popupScripts().map((src) => readFileSync(path.join(ROOT, src), 'utf8')).join('\n;\n');
  // jsdom reports a throwing <script> only as a window 'error' event; surface
  // it, or a broken popup script would pass every test that does not look.
  let scriptError = null;
  const onError = (e) => { scriptError = scriptError || e.error || new Error(e.message); };
  window.addEventListener('error', onError);
  const el = document.createElement('script');
  el.textContent = `{\n${code}\n}`;
  document.body.appendChild(el);
  window.removeEventListener('error', onError);
  if (scriptError) throw scriptError;
  return { store, changes, messages, local };
}

module.exports = { bootPopup, popupScripts, MANIFEST };
