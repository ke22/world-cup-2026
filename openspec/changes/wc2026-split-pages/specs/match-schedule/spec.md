## MODIFIED Requirements

### Requirement: Date navigation with 7-day sliding window

The dashboard SHALL display a horizontal date navigation bar showing exactly 7 consecutive dates at a time. The active date SHALL be highlighted. Dates that have at least one match SHALL display a visual indicator (blue dot). The user SHALL be able to navigate forward and backward in 7-day increments using arrow controls. When the 7-day window spans two calendar months, the navigation bar SHALL display a month label for the first date of each new month visible in the window. When all 7 dates are within the same month, the current month name SHALL be displayed at the left side of the navigation bar.

#### Scenario: Initial load navigates to today

- **WHEN** the page is opened
- **THEN** the date navigation SHALL focus on today's date if today has matches, otherwise on the nearest future date that has matches
- **THEN** the active date tab SHALL be scrolled into the center of the visible navigation bar

#### Scenario: Active tab auto-centered on load

- **WHEN** the page finishes loading and the initial date is determined
- **THEN** the date tabs container SHALL call scrollIntoView on the active tab with inline: "center" and behavior: "smooth"

#### Scenario: Month label shown when window spans two months

- **WHEN** the 7-day window contains dates from two different calendar months (e.g., Jun 30 and Jul 1)
- **THEN** the first date of the new month (Jul 1) SHALL display a month label ("七月") above or within its tab

##### Example: Cross-month window

- **GIVEN** window showing Jun 30, Jul 1, Jul 2, Jul 3, Jul 4, Jul 5, Jul 6
- **THEN** Jul 1 tab SHALL display "七月" month label
- **THEN** Jun 30 tab SHALL NOT display a month label (it is the previous month already established)

#### Scenario: Single-month window shows month at nav bar left

- **WHEN** all 7 dates in the window are in the same calendar month (e.g., all in July)
- **THEN** the navigation bar left area SHALL display the month name (e.g., "七月")

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
