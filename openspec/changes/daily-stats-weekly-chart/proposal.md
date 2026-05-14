## Why

Users have no visibility into their day-to-day YouTube watching habits — only a single cumulative total. A weekly breakdown with a simple chart makes patterns visible and adds meaningful context to the total.

## What Changes

- Daily watch time is recorded separately in storage (`dailyStats` object keyed by local date)
- Popup shows two new metrics: time watched today and 7-day daily average
- Popup displays a CSS bar chart of the last 7 days with today highlighted
- Reset Statistics also clears daily history

## Capabilities

### New Capabilities

- `daily-stats-tracking`: Records watch time per local calendar day in `chrome.storage.local` alongside the existing total
- `weekly-chart-popup`: Renders a 7-day bar chart and today/average metrics in the popup UI

### Modified Capabilities

- `watch-time-reset`: Reset now also clears `dailyStats` in addition to `totalWatchTime`

## Impact

- **`js/background.js`**: `updateWatchTime()` writes to `dailyStats[localDate]` on every update
- **`js/popup.js`**: New helpers for date math, short time formatting, and chart rendering; `loadStats()` extended; reset handler updated
- **`popup.html`**: New stat row (Today / Daily avg) and chart container added
- **`popup.css`**: New styles for stat row, chart container, bars, and labels
- **`chrome.storage.local`**: New key `dailyStats` (object); no breaking change to existing `totalWatchTime`