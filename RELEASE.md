# Release — YouTube Milliseconds Timer

The common runbook is [`../RELEASE.md`](../RELEASE.md) (the shared
`~/Sites/extensions/` workspace, outside this repo). Walk it step by step; this
file holds only what is specific to this extension. Section numbers match the
common steps.

| | |
|---|---|
| Version lives in | `manifest.json`, `package.json`, `package-lock.json` (two fields) |
| Version history | `js/changelog.js` |
| Store listing | `store-listing.md` · ID `bchlendkhiidadpakkfgnpeklmifffcp` |
| Landing | `https://ipershin.me/youtube-milliseconds-timer/` (+ `/privacy/`) |
| GitHub | `1gory/youtube-milliseconds-extension` · Pages **off**, keep it off |
| ZIP | `youtube-milliseconds-vX.Y.Z.zip` |

---

### 1. Version
```bash
grep -m3 '"version"' manifest.json package.json package-lock.json
```

### 2. Release notes
- [ ] Entry at the top of `CHANGELOG` in `js/changelog.js` (`version`,
      `date: 'YYYY-MM'`, `changes`). The popup shows it under the footer
      version link. `tests/changelog.test.js` fails until it matches
      `manifest.json`.

### 3. Checks
All three layers from [TESTING.md](TESTING.md):
- [ ] Layer 1 — `npm test`.
- [ ] Layer 2 — `node e2e/offline.js` on the working tree (and on
      `git archive HEAD` as a baseline, so a failure is known to be new).
- [ ] Layer 3 — build the ZIP (step 9), load it unpacked with the store build
      turned off, and have the agent run `e2e/live-check.js` on real YouTube:
      `passed === total`, `adBreaks === 0`.
- [ ] By hand, what layer 3 cannot reach: the copy button and the popup
      (stats, settings toggles, Reset Statistics).
- [ ] If the fix is about something YouTube does (a readout mode, a re-render,
      an ad), teach the fake page in `e2e/offline.js` to do it too.
- [ ] Every player lookup goes through `getPlayerRoot()` — no bare
      `querySelector('video')`.
- [ ] No stray `console.log` in `js/*.js`.

### 5. Screenshots
- [ ] `screenshots/N.jpg` — compare each against the current UI on YouTube.
      `screenshots/3.jpg` documents the exact control-bar button order.

### 6. README and tasks
- [ ] `README.md` still points at the ipershin.me landing and privacy URLs, not
      the retired `github.io` ones.
- [ ] `ai-tasks/` — mark shipped items or remove them.

### 9. Build ZIP
Only the runtime files — no `node_modules/`, `tests/`, `e2e/`, screenshots,
markdown, or the unpacked `youtube-milliseconds-v*/` folders in the repo root.

```bash
VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')
zip -r youtube-milliseconds-v${VERSION}.zip \
  manifest.json \
  popup.html \
  popup.css \
  styles.css \
  js/content.js \
  js/background.js \
  js/popup.js \
  js/changelog.js \
  icons/
unzip -l youtube-milliseconds-v${VERSION}.zip
```

A new file under `js/` that the extension loads must be added to this list.

### 12. After publish
- [ ] Smoke-test the player controls on a real video with the live version.
- [ ] `rm youtube-milliseconds-v*.zip`

---

## Project lessons

Shared lessons are in `../RELEASE.md`. These are about this codebase.

- **1.6.1** — `document.querySelector('video')` was how the content script found
  "the" player. YouTube keeps hover-preview `<video>` elements mounted on the
  home feed, search and channel pages, so preview autoplay counted as watch time
  and the buttons went into the preview player. Nothing errored. Lesson: every
  player lookup goes through `getPlayerRoot()`.
- **1.6.2** — the first cut of the control-bar watchdog reset
  `displayModeRetries` on every tick, so `MAX_DISPLAY_MODE_RETRIES` never bit: a
  control bar that never came back became a permanent 10 Hz DOM poll (164
  `document.querySelector` calls per 10 s against a healthy 10). Lesson: a
  watchdog must not reset a budget it does not own, and every recovery loop
  needs its own ceiling — `tests/controlBarRecovery.test.js` counts DOM lookups.
- **1.6.2** — `updateDisplayMode()` had a 5 s retry chain, the button setups
  (`setupCopyButton`, `setupJumpControl`, `setupIntervalControls`) had none. If
  YouTube rendered the control bar after the `<video>`, the buttons were gone
  for the session — unnoticed for six releases. Lesson: when one code path gets
  a retry because the DOM is late, check every sibling that reads the same DOM.
- **1.6.3** — four suites re-implemented the code under test;
  `msToggle.test.js` kept passing for a handler `content.js` had dropped two
  releases earlier. `tests/helpers/contentHarness.js` now boots the real
  `content.js` in jsdom.
- **1.6.3** — `RESET_STATS` first accepted only senders without `sender.tab`;
  every jsdom test passed, real Chromium refused it because `popup.html` opened
  in a tab has one.
- **1.6.3** — clicking the time readout puts YouTube into "time remaining" mode
  in the same `.ytp-time-current` node. The 4 Hz loop overwrote it, so the
  readout flickered. Lesson: before writing into a node YouTube owns, check what
  else YouTube writes there — the offline check now emulates this toggle.
