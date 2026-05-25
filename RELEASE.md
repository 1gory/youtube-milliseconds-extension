# Release checklist

Use this every time you publish a new version to the Chrome Web Store.
It exists because the moving parts (manifest, package.json, ZIP, store
listing, screenshots, GitHub release, **and the GitHub Pages landing page**)
drift apart easily, and nothing breaks loudly when they do.

## Versioning

`manifest.json` is the source of truth for the shipped version.
`package.json` must carry the **same** number.

| Change | Bump |
|--------|------|
| Bug fix, copy tweak, no behaviour change | PATCH (1.5.1 → 1.5.2) |
| New user-visible feature, backwards compatible | MINOR (1.5.1 → 1.6.0) |
| Breaking change / major rework | MAJOR (1.5.1 → 2.0.0) |

**Rule: both numbers must be identical.** Step 1 enforces this.

---

## Step-by-step release checklist

### 1. Versions match
- [ ] Bump `manifest.json` → `"version"`
- [ ] Bump `package.json` → `"version"` to the **same** value
- [ ] `grep '"version"' manifest.json package.json` — confirm they agree

### 2. Pre-flight
- [ ] All feature work merged into `main`
- [ ] `npm test` — all tests pass
- [ ] Manually loaded the extension (`chrome://extensions` → Reload), opened a
      YouTube video, exercised every player-bar control: ms toggle, copy,
      jump-to-timestamp (`G`), interval A/B (`[` / `]`), and the popup stats.
- [ ] No stray `console.log` left in `js/*.js`

### 3. Store listing copy
- [ ] Re-read `store-listing.md`. If a user-visible feature was added,
      changed, or removed, update the **Full description** and the
      **Summary** (≤ 132 chars) to match.
- [ ] If you added a new permission, update the **Privacy tab** justifications.
- [ ] Re-read the **Single purpose** line — does it still match?

### 4. Screenshots (Chrome Web Store)
A feature you add is often visible in *more than one* screenshot. Re-audit
every slot, not only the one you obviously changed.

For every screenshot in `screenshots/`:
- [ ] Open `screenshots/N.jpg`, compare against the current UI in YouTube.
      If anything in it is now stale (missing button, old timestamp format),
      re-shoot it.
- [ ] Replace the file, keep the same file name (README and store listing
      reference them by name).

### 5. README
- [ ] Search `README.md` for every mention of a feature this release touches.
      Update copy and the screenshot section.
- [ ] Update the feature list and any "version 1.x adds…" line if present.
- [ ] If you do not update README in the same PR, open a follow-up and link
      it from the release notes — do not silently skip.

### 6. GitHub Pages (docs/)
The project ships a landing page from the `docs/` folder on `main`
(GitHub Pages → Settings → Pages → source: `main` / `/docs`). It lives outside
the extension code and nothing breaks if it goes stale — so it gets forgotten.

- [ ] Open `docs/index.html`. Audit the **feature cards** and the **tagline**
      against the current `store-listing.md` — every user-visible feature this
      release touched (jump-to-timestamp, interval A→B, toolbar customization,
      stats…) must be reflected. Same drift trap as the README.
- [ ] Update `docs/icon128.png` if the icon changed.
- [ ] If the Chrome Web Store listing URL or slug changed, fix the CWS links
      in both `docs/index.html` and `docs/privacy-policy.html`.
- [ ] If the privacy policy text changed, mirror it in `docs/privacy-policy.html`.
- [ ] After push, open `https://1gory.github.io/youtube-milliseconds-extension/`
      and confirm the page reflects this release.

### 7. ai-tasks/
- [ ] If this release implements or closes anything tracked in `ai-tasks/`,
      mark it shipped or remove the file, so future-you sees only open work.

### 8. Tests
- [ ] If new logic was added (timestamp parser, interval math, version
      comparator, etc.), add tests under `tests/`
- [ ] `npm test` — still green

### 9. Commit + tag
- [ ] `git add` only the files that should ship (see *Packaging* below)
- [ ] Commit message: `Release X.Y.Z: <one-line summary>`
- [ ] Tag: `git tag vX.Y.Z`
- [ ] Push: `git push && git push --tags`

### 10. Build ZIP
Run from the repo root. The ZIP must contain **only** the files the extension
needs at runtime — no `node_modules/`, `tests/`, screenshots, or markdown.

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
  icons/
```

Verify the contents:
```bash
unzip -l youtube-milliseconds-v${VERSION}.zip
```

**Must NOT be inside:** `node_modules/`, `package.json`, `package-lock.json`,
`tests/`, `screenshots/`, `docs/`, `.git/`, `.idea/`, `.claude/`, any `*.md`,
`.DS_Store`, `ai-tasks/`.

### 11. Chrome Web Store dashboard
- [ ] Upload the ZIP under "Package".
- [ ] Replace **every** stale screenshot in the listing (re-audit per step 4).
- [ ] Update the description text if `store-listing.md` changed.
- [ ] Fill the **What's new in this version** field (1–3 sentences from the
      GitHub release notes).
- [ ] Confirm Privacy practices if CWS asks (same answers as last time unless
      permissions changed).
- [ ] Hit **Submit for review**.

### 12. GitHub Release
The git tag is not enough — wrap it in a GitHub Release so users (and
changelog aggregators) can see it.

- [ ] Open `https://github.com/1gory/youtube-milliseconds-extension/releases/new`.
- [ ] Choose the existing tag `vX.Y.Z` (do not create a new one).
- [ ] Title: `vX.Y.Z — <one-line summary>`.
- [ ] Body: highlights / under the hood / install, based on the previous
      release as a template.
- [ ] Attach `youtube-milliseconds-vX.Y.Z.zip` so people can sideload without
      waiting for CWS review.
- [ ] Tick **Set as the latest release**. Leave pre-release unchecked.
- [ ] Publish.

### 13. After publish
- [ ] Wait for the email confirming the CWS update is live (a few hours to a
      couple of days).
- [ ] Open the listing URL and verify the version number, screenshots, and
      description match expectations.
- [ ] Install the live version (not your unpacked dev build) and smoke-test
      the player controls on a real video.
- [ ] Delete the local ZIP (`rm youtube-milliseconds-v*.zip`) so it does not
      drift out of sync next release.

---

## Things we forgot before — do not forget again

A running log of mistakes from past releases. Read this before each release,
add to it after each release.

- **pre-1.5.x** — the GitHub Pages landing page (`docs/index.html`) was never
  updated after the early releases: it advertised only timestamps, copy,
  interval A→B, and stats, and never mentioned jump-to-timestamp (`G`) or the
  per-button toolbar customization. Lesson: step 6 now audits `docs/` against
  `store-listing.md` every release.
- **1.5.1** — `manifest.json` shipped at 1.5.1 while `package.json` was still
  at 1.5.0. Lesson: step 1 makes the two-number match the very first thing.