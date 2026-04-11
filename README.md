# YouTube Milliseconds Timer

Chrome extension that adds millisecond precision to YouTube video timestamps, lets you copy any moment with one click, and tracks your total viewing time.

## Screenshots
![Extension Preview](screenshots/1.jpg)
![Extension Preview](screenshots/2.jpg)

## Features
- Millisecond-accurate timestamps in MM:SS.mmm format (e.g. 1:23:45.678)
- One-click copy button next to the timestamp — copies the exact moment to clipboard
- Total watch time tracker across all YouTube sessions, including Shorts
- Toggle milliseconds on/off via the extension popup
- Works with all YouTube videos, playlists, and Shorts
- No overlays, no clutter — integrates directly into the native player

## Installation
Available in Chrome Web Store: [YouTube Milliseconds Timer](https://chromewebstore.google.com/detail/youtube-milliseconds-time/bchlendkhiidadpakkfgnpeklmifffcp)

## Usage
- **Timestamps**: Millisecond precision is shown automatically on all YouTube videos
- **Copy button**: Click the clipboard icon next to the time to copy the exact timestamp
- **Settings**: Click the extension icon to toggle milliseconds and view watch time stats
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
zip -r youtube-milliseconds-v1.3.0.zip manifest.json popup.html popup.css styles.css js/ icons/
```

The zip includes only the files required by the extension. Do **not** include `node_modules/`, `tests/`, screenshots, or any markdown files.

## Privacy
This extension only runs on YouTube pages and does not collect any personal data. All viewing statistics are stored locally on your device and never transmitted externally.
