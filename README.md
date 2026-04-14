# YouTube Milliseconds Timer

Chrome extension that adds millisecond precision to YouTube video timestamps, an interval timer A→B, one-click copy, and a watch time stats dashboard.

## Screenshots
<img src="screenshots/1.jpg" width="600" alt="Extension Preview">
<img src="screenshots/2.jpg" width="600" alt="Extension Preview">

## Features
- Millisecond-accurate timestamps in M:SS.mmm format (e.g. 1:23.456)
- One-click copy button next to the timestamp — copies the exact moment to clipboard
- Interval timer A→B — mark two points with `[` and `]` keys (or buttons), see the exact delta down to the millisecond, copy it with one click, visual markers on the progress bar
- Watch time stats dashboard: total time, today, daily average (7d / 30d / all), 7-day bar chart, monthly calendar heatmap with month navigation
- Toggle milliseconds and interval timer on/off via the extension popup
- Works with all YouTube videos, playlists, and Shorts
- No overlays, no clutter — integrates directly into the native player

## Installation
Available in Chrome Web Store: [YouTube Milliseconds Timer](https://chromewebstore.google.com/detail/youtube-milliseconds-time/bchlendkhiidadpakkfgnpeklmifffcp)

## Usage
- **Timestamps**: Millisecond precision is shown automatically on all YouTube videos
- **Copy button**: Click the clipboard icon next to the time to copy the exact timestamp
- **Interval timer**: Press `[` to set point A, `]` to set point B — or use the A/B buttons in the player. The delta appears above the controls
- **Settings**: Click the extension icon to toggle features and view watch time stats
- **Time Tracking**: Only counts time when video is actively playing

## Development

### Run tests
```bash
npm install
npm test
```

### Load unpacked
1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" and select this folder

### Package for Chrome Web Store
```bash
zip -r youtube-milliseconds-v1.4.0.zip manifest.json popup.html popup.css styles.css js/ icons/
```

The zip includes only the files required by the extension. Do **not** include `node_modules/`, `tests/`, screenshots, or any markdown files.

## Privacy
This extension only runs on YouTube pages and does not collect any personal data. All viewing statistics are stored locally on your device and never transmitted externally.
