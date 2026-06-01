## ADDED Requirements

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
