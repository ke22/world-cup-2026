## ADDED Requirements

### Requirement: View groups button triggers standings overlay

The dashboard SHALL display a "查看分組" (View Groups) button in the date section header. Clicking the button SHALL open a full-screen overlay displaying the standings for all groups (A through L). Clicking outside the overlay panel SHALL close it.

#### Scenario: Open standings overlay

- **WHEN** the user clicks "查看分組"
- **THEN** a full-screen overlay SHALL appear containing standings tables for all 12 groups (A–L)

#### Scenario: Close overlay by clicking outside

- **WHEN** the overlay is open and the user clicks outside the standings panel
- **THEN** the overlay SHALL close

### Requirement: Standings display all groups in two-column grid

The standings overlay SHALL display all groups (A–L) arranged in a 2-column grid layout. Each group table SHALL include: rank, team flag emoji, team code, P (played), W (win), D (draw), L (loss), GD (goal difference), Pts (points). Teams SHALL be sorted by Pts descending, then GD descending.

#### Scenario: All 12 groups visible in overlay

- **WHEN** the standings overlay is open
- **THEN** all 12 groups (A through L) SHALL be visible, arranged in a 2-column grid

#### Scenario: Teams sorted by points then goal difference

- **WHEN** the overlay renders a group table
- **THEN** teams SHALL be sorted: primary by Pts descending, secondary by GD descending

##### Example: Group A sort order

- **GIVEN** Group A teams: MEX (Pts=6, GD=+3), RSA (Pts=3, GD=0), KOR (Pts=3, GD=-1), CZE (Pts=0, GD=-2)
- **WHEN** the overlay renders Group A
- **THEN** order SHALL be: 1. MEX, 2. RSA, 3. KOR, 4. CZE

### Requirement: Standings overlay shows empty state before group stage

When no matches have been played yet (all scores are null), the standings overlay SHALL still render all 12 group tables with zero values across all columns.

#### Scenario: Pre-tournament standings show zeros

- **WHEN** all matches have status `upcoming` and no scores have been entered
- **THEN** each team row SHALL display P=0, W=0, D=0, L=0, GD=0, Pts=0
