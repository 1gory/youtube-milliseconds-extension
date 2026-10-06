# Testing

Three layers. Each one catches things the layer before it cannot, and every
release runs all three (RELEASE.md, steps 2 and 8).

| Layer | What runs | Where | Catches |
|-------|-----------|-------|---------|
| 1. Unit | real `js/*.js` against fakes | jsdom / node (`npm test`) | logic, races, regressions — deterministic, seconds |
| 2. Offline browser | the real unpacked extension | Playwright Chromium, youtube.com faked | what Chrome itself does: `sender`, `chrome.storage` events, the isolated world, the popup |
| 3. Live target browser | the build the user installed | **the user's own Chrome**, real youtube.com | YouTube's current markup and behaviour, ads, the store build left enabled |

Layer 3 is the one that answers "does it work on YouTube today". It was set up
on 2026-10-06; before that, releases shipped on layers 1–2 plus a manual click
through.

---

## 1. Unit — `npm test`

Jest; suites live in `tests/`. Rules that are not obvious from the code:

- **Test the shipped file, never a copy.** A suite must `require` or `eval` the
  file in `js/`. Until 1.6.3 four suites re-implemented the code under test and
  asserted against the copy — one kept passing for a handler `content.js` no
  longer had.
- `content.js` and `popup.js` are driven in jsdom (`@jest-environment jsdom`
  per file). `tests/helpers/contentHarness.js` boots a fresh `content.js`
  against a fake `#movie_player` with fake `chrome.*`, a drivable `<video>`
  clock and a manual `requestAnimationFrame` pump. Call its `teardown()` in
  `afterEach`, or every earlier copy keeps answering `keydown` in later tests.
- A new test must fail on the code without the fix. Replay it against the
  previous release (`git show <tag>:js/content.js > js/content.js`, run, restore)
  before calling it done.

## 2. Offline browser — `e2e/offline.js`

Loads the unpacked extension into Playwright's Chromium and answers every
`https://www.youtube.com/…` request with a fake watch page that carries
YouTube's player markup (`context.route`). So the real content script, service
worker, `chrome.storage` and popup all run, with no network.

```bash
export PLAYWRIGHT_DIR=$(find ~/.npm/_npx -maxdepth 3 -type d -path '*/node_modules/playwright' | head -1)
node "$PLAYWRIGHT_DIR/cli.js" install chromium     # once per machine
node e2e/offline.js                                # the working tree
mkdir -p /tmp/ytms-head && git archive HEAD | tar -x -C /tmp/ytms-head && node e2e/offline.js /tmp/ytms-head   # baseline
```

Needs `ffmpeg` once, to generate the 10-minute test video into the temp dir.

Why these choices:

- **Not Google Chrome.** Branded Chrome (137+) ignores `--load-extension`, so
  Playwright's own Chromium is the only browser this layer can load an
  unpacked extension into.
- **Not real YouTube.** From the agent's sandbox `www.youtube.com` is refused
  outright. The fake page is also deterministic: no ads, no A/B markup.
- **A real video file, not a canvas stream.** The content script lives in an
  isolated world: a `duration` faked from the page script is invisible to it,
  and a `captureStream()` video reports `duration === Infinity`, which the
  extension treats as a live stream.
- The fake page reproduces YouTube behaviour the extension has to coexist with
  — currently the click-to-toggle "time remaining" readout. When a bug turns
  out to come from something YouTube does, teach the fake page to do it too.

This layer caught the 1.6.3 `RESET_STATS` `sender.tab` bug that 153 unit tests
passed.

## 3. Live target browser — the user's own Chrome

The agent drives Igor's everyday Chrome through the chrome-devtools MCP server
attached to it. That is the browser the extension is actually installed in, on
the real youtube.com — true end to end.

### One-time setup (by the user)

1. Chrome → `chrome://inspect/#remote-debugging` → enable. It reports
   `Server running at: 127.0.0.1:9222`.
2. In a terminal (the agent is not allowed to edit its own `~/.claude.json`):
   ```bash
   claude mcp remove chrome-devtools -s user && \
   claude mcp add chrome-devtools -s user -- npx -y chrome-devtools-mcp@latest --autoConnect
   ```
3. Restart the Claude Code session (VS Code: *Developer: Reload Window*).
4. On first connection Chrome asks to allow debugging — allow.

Check: the chrome-devtools `list_pages` tool shows the user's real tabs, not a
single `about:blank`. To undo: re-add without `--autoConnect`, or switch remote
debugging off in Chrome.

This gives the agent the user's logged-in browser. Never touch tabs it did not
open.

### Each release

1. Build the ZIP and unpack it (RELEASE.md step 10):
   `unzip youtube-milliseconds-vX.Y.Z.zip -d youtube-milliseconds-vX.Y.Z`.
2. **User:** `chrome://extensions` → Developer mode → *Load unpacked* → that
   folder. **Turn the store build off**, or every button is injected twice.
   After every rebuild the user presses ↻ on the card — the agent cannot:
   the tool refuses `chrome://` URLs.
3. **Agent:** `new_page` → `https://www.youtube.com/watch?v=aqz-KE-bpKQ`, then
   `select_page` with `bringToFront: true`.
4. **Agent:** pass the whole of `e2e/live-check.js` as the `function` of
   `evaluate_script` on that tab. **User:** hands off the tab for ~2 minutes.
5. Read the report. `passed === total` and `adBreaks === 0` is a pass. Any
   failure with `adBreaks > 0` → rerun before investigating.
6. The script restores the milliseconds setting and YouTube's
   elapsed/remaining mode it found. Pause or close the tab afterwards.

What `live-check.js` covers: each button injected exactly once; the readout in
all four ms-on/off × elapsed/remaining combinations; the duration in ms; the
readout within 0.3 s of `currentTime`; `G`/`[`/`]` on Latin and Russian layouts
(`п`/`х`/`ъ`); jump-to-timestamp; interval A→B with progress-bar markers; SPA
navigation to a related video.

Not covered (by hand if the release touches it): the copy button (reading the
clipboard needs a permission prompt in the real profile), the popup (a
`chrome-extension://` page the tool will not open), watch-time totals.

### Things that look like bugs and are not

- **Ads.** Pre- and mid-roll ads play in the same `<video>`, and not every ad
  sets `.ad-showing` — one seen on 2026-10-06 did not. A
  readout reading `0:08 / 0:32` while the film is at 0:22 is an ad. The script
  gates on the film's duration (634.6 s) and counts `adBreaks`.
- **Background tabs.** No `requestAnimationFrame`, so the ms readout stands
  still. Bring the tab to the front.
- **Autohidden controls.** With `.ytp-autohide` set, the extension deliberately
  skips repainting the invisible readout, and YouTube stops updating its own.
  A synthetic `mousemove` does not clear autohide; the script removes the class
  itself before each reading. With milliseconds off the text is YouTube's, so
  it may stay frozen while hidden — the ms-off checks assert format only.
- **"Time remaining".** Clicking the readout (`.ytp-time-contents`, not its
  `.ytp-time-display` wrapper) makes YouTube show `-10:05`. A user clicking the
  player during a run flips this under the script.
- **`Unchecked runtime.lastError: The message port closed…`** in the page
  console comes from another installed extension: this one only uses
  promise-style `chrome.*` calls, and layer 2 (only this extension loaded)
  logs no errors.
- **Branded Chrome launched by the MCP without `--autoConnect`** is a separate
  profile with no extension — a session that sees only `about:blank` is not
  attached to the user's browser.
