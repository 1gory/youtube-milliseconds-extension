Chrome Web Store Listing
========================

SUMMARY (from manifest, max 132 chars)
---------------------------------------
Millisecond timestamps, jump-to-timestamp, interval timer A→B, ms toggle button, one-click copy, watch time stats


FULL DESCRIPTION
----------------
YouTube Milliseconds Timer adds millisecond precision to YouTube's video player and a full set of tools for anyone who needs to work with video time precisely — editors, researchers, educators, content creators, and sport analysts.

FEATURES

Millisecond-accurate timestamps
Displays time in M:SS.mmm format (e.g. 1:23.456) directly in the YouTube player. No overlays, no clutter — replaces the native timestamp seamlessly. Toggle milliseconds on/off from the popup or directly in the player control bar.

One-click timestamp copy
A small copy button appears next to the time display. Click it to instantly copy the exact timestamp to your clipboard — great for notes, subtitles, video editing, or sharing precise moments.

Jump to timestamp (press G)
Press G — or click the target button in the player — and a small input appears, pre-filled with the current timestamp. Edit the digits you need and press Enter: the video jumps to that exact moment with millisecond precision. Accepts SS.mmm, M:SS.mmm, and H:MM:SS.mmm formats.

Milliseconds toggle button
A dedicated button in the player control bar toggles millisecond display on and off without opening the popup. Two visual states (active / dimmed) make the current mode obvious. Synchronises in both directions with the popup setting.

Interval Timer (A → B)
Mark two points on any video and instantly see the exact time difference between them, down to the millisecond. Press [ to set point A, ] to set point B — or use the A/B buttons in the player controls. The result appears in a floating badge above the controls. Copy the interval delta with one click. Visual markers on the progress bar show your selected range.

Per-button visibility controls
Each player-bar button (copy, milliseconds toggle, jump, interval A/B) can be individually shown or hidden from the popup, so you keep only the controls you actually use.

Watch time statistics
Track your YouTube viewing habits with a full stats dashboard in the popup:
• Total watch time across all sessions
• Today's watch time
• Daily average — calculated over 7 days, 30 days, or all time
• 7-day bar chart showing your recent activity
• Monthly calendar heatmap with color-coded intensity per day
Navigate back through previous months to see historical data.

PRIVACY

No accounts. No tracking. No data leaves your device. All stats are stored locally in your browser using Chrome's built-in storage. The extension never accesses the clipboard without an explicit user action.


PRIVACY TAB
-----------
Single purpose:
Displays millisecond-precision timestamps on YouTube videos, provides an interval timer for measuring segments, and tracks local watch time statistics.

Justification for storage:
Stores user settings (milliseconds toggle, interval timer toggle, per-button visibility settings) and watch time statistics (total and per-day) locally on the device. No data is transmitted or shared.

Justification for host permissions (youtube.com):
The extension injects a content script into YouTube pages to access the video player's time display, modify it with millisecond precision, and add UI controls (copy button, milliseconds toggle, jump-to-timestamp button, interval timer buttons). Access is limited to youtube.com only.

Justification for clipboardWrite:
Copies the current video timestamp or interval delta to the clipboard only when the user explicitly clicks the corresponding copy button. The extension never accesses the clipboard without user action.

Remote code: No

Data collection: No
