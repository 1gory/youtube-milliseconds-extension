## ADDED Requirements

### Requirement: Record watch time per local calendar day
The background service worker SHALL record watch time in `chrome.storage.local` under key `dailyStats`, an object keyed by local date strings in `YYYY-MM-DD` format. Each value is the cumulative seconds watched on that day.

#### Scenario: Watch time is accumulated for today's date
- **WHEN** `UPDATE_WATCH_TIME` message is received with `seconds` value
- **THEN** `dailyStats[localDate]` is incremented by `seconds` alongside `totalWatchTime`

#### Scenario: New day starts fresh from zero
- **WHEN** first `UPDATE_WATCH_TIME` message arrives on a date with no existing entry
- **THEN** `dailyStats[localDate]` is initialized to `seconds` (not undefined)

#### Scenario: Local date is used, not UTC
- **WHEN** the date key is generated
- **THEN** it reflects the device's local calendar date (`getFullYear/getMonth/getDate`), not `toISOString()` UTC date

### Requirement: `getLocalDateString` helper
A pure function `getLocalDateString(date)` SHALL return a `YYYY-MM-DD` string for the given Date object using local time components.

#### Scenario: Formats local date correctly
- **WHEN** called with a Date representing 2026-04-14 in local time
- **THEN** returns the string `"2026-04-14"`

#### Scenario: Zero-pads single-digit months and days
- **WHEN** called with a Date where month is March (index 2) and day is 5
- **THEN** returns `"YYYY-03-05"` (zero-padded)
