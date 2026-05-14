## ADDED Requirements

### Requirement: Reset clears daily stats history
When the user resets statistics, `dailyStats` SHALL be cleared along with `totalWatchTime`.

#### Scenario: Reset removes dailyStats from storage
- **WHEN** user confirms the Reset Statistics action
- **THEN** `dailyStats` is removed (or set to `{}`) in `chrome.storage.local` alongside resetting `totalWatchTime` to `0`

#### Scenario: Settings are preserved after reset
- **WHEN** user confirms the Reset Statistics action
- **THEN** `showMilliseconds` and `showIntervalTimer` settings retain their current values
