## ADDED Requirements

### Requirement: Standalone groups standings page

The groups-page SHALL be a self-contained HTML file (`wc2026-groups.html`) that displays standings for all 12 groups (A–L) in a single-column layout with larger typography. The page SHALL fetch group data from the same API used by the main schedule page.

#### Scenario: Page renders all 12 groups in single column

- **WHEN** the user opens `wc2026-groups.html`
- **THEN** the page SHALL display all 12 groups (A through L) stacked vertically in a single column, with no multi-column grid

#### Scenario: Anchor quick-nav buttons

- **WHEN** the page loads
- **THEN** a sticky or top-positioned row of 12 buttons labeled A through L SHALL be visible
- **WHEN** the user clicks a group button (e.g., "E")
- **THEN** the page SHALL smooth-scroll to the corresponding group section (id="group-E")

#### Scenario: Team row displays flag emoji and name together

- **WHEN** a group standings table is rendered
- **THEN** each team row SHALL display the team's flag emoji followed by the team's name in the same cell, on a single line

##### Example: team cell format

- **GIVEN** a team with flag emoji 🇧🇷 and name "巴西"
- **THEN** the cell SHALL render as: 🇧🇷 巴西

#### Scenario: Enlarged typography

- **WHEN** the standings table is rendered
- **THEN** the team name font size SHALL be at least 16px
- **THEN** the points cell font size SHALL be at least 15px
- **THEN** the group card title font size SHALL be at least 18px

#### Scenario: Teams sorted correctly within each group

- **WHEN** the group standings are rendered
- **THEN** teams within each group SHALL be sorted: points DESC, then goal difference DESC, then goals for DESC

##### Example: three-way sort

- **GIVEN** teams: A(pts=6, gd=+3, gf=5), B(pts=6, gd=+3, gf=4), C(pts=6, gd=+2, gf=8)
- **THEN** order SHALL be: A, B, C
