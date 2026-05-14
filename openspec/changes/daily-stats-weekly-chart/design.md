## Context

The extension currently stores one value in `chrome.storage.local`: `totalWatchTime` (float seconds). The background service worker (`background.js`) updates it on every `UPDATE_WATCH_TIME` message from the content script. The popup reads it every second.

Adding per-day data means writing a second key (`dailyStats`) on every update and reading it in the popup for the chart and metrics.

## Goals / Non-Goals

**Goals:**
- Record watch time per local calendar day without breaking existing total
- Show today's time and 7-day average in the popup
- Render a 7-day bar chart (pure CSS, no canvas/library)
- Clear daily data when user resets statistics

**Non-Goals:**
- No data older than the last 7 days is shown (old keys stay in storage but are ignored by the UI)
- No export, no per-video breakdown
- No timezone settings — local device time is used as-is

## Decisions

### 1. Date key format: local `YYYY-MM-DD` string (not UTC ISO)

Using `Date.getFullYear/Month/Date` instead of `toISOString()` ensures the day boundary matches the user's clock. A helper `getLocalDateString()` is extracted and shared between `background.js` (for writing) and `popup.js` (for reading the chart range).

Considered: UTC ISO date — rejected because midnight UTC may be the previous local day.

### 2. Storage shape: flat object `{ "YYYY-MM-DD": seconds, ... }` under key `dailyStats`

Simple, no schema migration needed. Old keys accumulate silently; the UI only reads the last 7.

Considered: Array of `{ date, seconds }` — more verbose, no benefit here.

### 3. Chart rendering: CSS flexbox bars, no canvas

300px popup means canvas is unnecessary overhead. Each bar is a `div` with inline `height` set as a percentage of the max day. The outer container has a fixed height (70px bar area) so bars grow downward from the top (achieved with `align-items: flex-end`).

Day label sits below each bar. Today's bar gets a distinct color (dark red vs. YouTube red).

Value shown as `title` attribute (browser tooltip on hover) — avoids label overlap in tight space.

### 4. Average calculation: only days with data count toward the divisor

If the user installed the extension yesterday, showing "3h / 7 = 26m avg" is misleading. Average is `sum(last 7 days) / count(days with data in last 7)`, minimum divisor 1.

### 5. `getLocalDateString` duplicated in background.js and popup.js

Both files use Node.js module guards for testing isolation. A shared utility file would require changes to `manifest.json` (additional content script or import). Duplication of a 4-line pure function is the simpler trade-off.

## Risks / Trade-offs

- **Storage growth**: `dailyStats` grows indefinitely; keys older than 7 days are never pruned. For typical usage this is negligible (<1 KB/year). → Acceptable for now; can add pruning later.
- **Service worker wake-up latency**: `background.js` now does two storage reads/writes per update instead of one. At 1 update/second the overhead is immeasurable. → No mitigation needed.
- **Reset UX**: Resetting clears all daily history. User cannot recover it. → Acceptable; confirmed with the existing reset confirmation dialog.