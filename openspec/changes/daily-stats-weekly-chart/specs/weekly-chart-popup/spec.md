## ADDED Requirements

### Requirement: Today and 7-day average metrics
The popup SHALL display today's watch time and the 7-day daily average alongside the existing total.

#### Scenario: Today metric shows time watched on the current local date
- **WHEN** popup opens and `dailyStats` contains an entry for today
- **THEN** "Today" stat shows the formatted time for today's date

#### Scenario: Today metric shows zero when no data for today
- **WHEN** popup opens and `dailyStats` has no entry for today
- **THEN** "Today" stat shows `0s`

#### Scenario: 7-day average counts only days with recorded data
- **WHEN** user has data for 3 of the last 7 days
- **THEN** average = sum of those 3 days / 3 (not divided by 7)

#### Scenario: Average shows at least 1 as divisor
- **WHEN** `dailyStats` is empty or has no entries in the last 7 days
- **THEN** average is displayed as `0s` (sum 0 / max(count, 1))

### Requirement: 7-day CSS bar chart
The popup SHALL render a horizontal row of 7 bars representing the last 7 calendar days, ordered oldest-left to today-right.

#### Scenario: Bars are sized relative to the maximum day
- **WHEN** the day with most watch time has value `maxSeconds`
- **THEN** that bar renders at 100% height; all other bars scale proportionally

#### Scenario: Today's bar is visually distinct
- **WHEN** the chart is rendered
- **THEN** today's bar uses a different color from the rest

#### Scenario: Day with zero watch time renders a minimal bar
- **WHEN** a day in the last 7 has no recorded data
- **THEN** its bar is shown at minimal height (not hidden) so the chart always has 7 columns

#### Scenario: Bar tooltip shows exact time
- **WHEN** user hovers a bar
- **THEN** the browser tooltip (`title` attribute) shows the formatted duration for that day

#### Scenario: Day labels show short weekday names
- **WHEN** the chart is rendered
- **THEN** each column shows a short day label (Mon, Tue… or locale equivalent) below the bar

### Requirement: Short time formatter for chart metrics
The popup SHALL use a compact time format for the today/average metrics (e.g., `1h 23m`, `45s`) distinct from the existing `formatWatchTime` which includes years/days.

#### Scenario: Value under one minute shows seconds
- **WHEN** value is 45 seconds
- **THEN** displays `45s`

#### Scenario: Value over one minute shows hours and minutes
- **WHEN** value is 5430 seconds (1h 30m 30s)
- **THEN** displays `1h 30m`
