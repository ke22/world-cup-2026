## ADDED Requirements

### Requirement: Date navigation with 7-day sliding window

The dashboard SHALL display a horizontal date navigation bar showing exactly 7 consecutive dates at a time. The active date SHALL be highlighted. Dates that have at least one match SHALL display a visual indicator (blue dot). The user SHALL be able to navigate forward and backward in 7-day increments using arrow controls.

#### Scenario: Initial load navigates to today

- **WHEN** the page is opened
- **THEN** the date navigation SHALL focus on today's date if today has matches, otherwise on the nearest future date that has matches

#### Scenario: Navigate to previous week

- **WHEN** the user clicks the left arrow
- **THEN** the 7-day window shifts back by 7 days

#### Scenario: Navigate to next week

- **WHEN** the user clicks the right arrow
- **THEN** the 7-day window shifts forward by 7 days

#### Scenario: Date indicator for match days

- **WHEN** a date in the navigation bar has one or more matches
- **THEN** a blue dot SHALL appear below that date label

##### Example: Group stage week

- **GIVEN** dates Jun 11 (2 matches), Jun 12 (4 matches), Jun 13 (0 matches)
- **WHEN** the navigation window includes Jun 11–17
- **THEN** Jun 11 and Jun 12 show blue dots; Jun 13 does not

### Requirement: Match card rendering by status

Each match SHALL be rendered as a card. The center of the card SHALL display different content based on the match status:
- `upcoming`: Taiwan local time (UTC+8) in HH:MM format
- `live`: current score as `score1 : score2` with an animated red dot indicator and orange-red background
- `finished`: final score as `score1 : score2` in bold large font with dark color

The card SHALL also display: team codes, team flag emoji, round info, group (if applicable), venue name, and city.

#### Scenario: Upcoming match displays kickoff time

- **WHEN** a match has status `upcoming`
- **THEN** the center displays the Taiwan kickoff time (e.g., `22:00`)
- **AND** score columns SHALL NOT be rendered

#### Scenario: Live match displays live score with indicator

- **WHEN** a match has status `live`
- **THEN** the center displays `score1 : score2`
- **AND** the card background SHALL be orange-red
- **AND** an animated blinking red dot SHALL be visible

#### Scenario: Finished match displays final score

- **WHEN** a match has status `finished`
- **THEN** the center displays `score1 : score2` in bold large font
- **AND** no animation or color indicator SHALL be present

##### Example: Status-to-display mapping

| status     | score1 | score2 | Center display | Background |
|------------|--------|--------|----------------|------------|
| upcoming   | null   | null   | `22:00`        | white      |
| live       | 1      | 0      | `1 : 0`        | orange-red |
| finished   | 3      | 1      | `3 : 1`        | white      |

### Requirement: Date change triggers data fetch

When the user selects a different date in the navigation bar, the dashboard SHALL fetch match data for that date and re-render all match cards.

#### Scenario: Cached date loads without network request

- **WHEN** the user selects a date that was previously fetched and the cached data has not expired (within TTL)
- **THEN** match cards render immediately from cache without a new network request

#### Scenario: Uncached date triggers fetch

- **WHEN** the user selects a date with no valid cache entry
- **THEN** a loading state SHALL be shown while the fetch is in progress
- **THEN** match cards render upon successful response

#### Scenario: No matches on selected date

- **WHEN** the selected date has zero matches in the response
- **THEN** the dashboard SHALL display a "本日無賽事" (no matches today) message

### Requirement: Live match auto-refresh

When the currently displayed date contains at least one match with status `live`, the dashboard SHALL automatically re-fetch match data every 60 seconds, bypassing the cache.

#### Scenario: Auto-refresh fires on live date

- **WHEN** the active date has one or more `live` matches
- **THEN** a new fetch SHALL be triggered every 60 seconds regardless of cache state

#### Scenario: Auto-refresh stops when no live matches

- **WHEN** the active date has no `live` matches (all are `upcoming` or `finished`)
- **THEN** no periodic refresh timer SHALL be active

### Requirement: Height notification on date tab switch

After the user selects a date in the date navigation bar and the match list re-renders, the schedule page SHALL call `notifyHeight()` to report the updated `scrollHeight` to the parent frame. The notification SHALL be sent after the DOM update from the tab switch is complete.

#### Scenario: Tab switch triggers height notification

- **WHEN** the user clicks a date tab in the navigation bar
- **THEN** the match list for that date SHALL render AND `notifyHeight()` SHALL be called once after rendering completes

#### Scenario: Empty date tab triggers height notification

- **WHEN** the user clicks a date tab that has no matches
- **THEN** the empty-state UI SHALL render AND `notifyHeight()` SHALL be called with the reduced content height

##### Example: height change on tab switch

| Date selected | Match count | Expected notifyHeight call |
|---------------|-------------|---------------------------|
| Jun 12 (4 matches) | 4 | Once, after 4 match cards render |
| Jun 13 (0 matches) | 0 | Once, after empty-state renders |
| Jun 18 (2 matches) | 2 | Once, after 2 match cards render |

## Requirements


<!-- @trace
source: wc2026-chart-ux-fix
updated: 2026-06-01
code:
  - wc2026-schedule.html
  - .antigravitycli/5dd1ba32-5d02-465a-b397-faa5c2e3c80b.json
  - .DS_Store
  - wc2026-groups.html
  - wc2026-bracket.html
  - test-embed.html
-->

### Requirement: Height notification on date tab switch

After the user selects a date in the date navigation bar and the match list re-renders, the schedule page SHALL call `notifyHeight()` to report the updated `scrollHeight` to the parent frame. The notification SHALL be sent after the DOM update from the tab switch is complete.

#### Scenario: Tab switch triggers height notification

- **WHEN** the user clicks a date tab in the navigation bar
- **THEN** the match list for that date SHALL render AND `notifyHeight()` SHALL be called once after rendering completes

#### Scenario: Empty date tab triggers height notification

- **WHEN** the user clicks a date tab that has no matches
- **THEN** the empty-state UI SHALL render AND `notifyHeight()` SHALL be called with the reduced content height

##### Example: height change on tab switch

| Date selected | Match count | Expected notifyHeight call |
|---------------|-------------|---------------------------|
| Jun 12 (4 matches) | 4 | Once, after 4 match cards render |
| Jun 13 (0 matches) | 0 | Once, after empty-state renders |
| Jun 18 (2 matches) | 2 | Once, after 2 match cards render |