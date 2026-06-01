## ADDED Requirements

### Requirement: Standalone tournament bracket page

The bracket-page SHALL be a self-contained HTML file (`wc2026-bracket.html`) that renders the full WC 2026 knockout bracket. The trophy SHALL appear at the center. The left side and right side SHALL each contain 24 teams progressing through R32 → R16 → QF → SF → Final. A third-place match SHALL appear below the Final. The page SHALL be responsive for both mobile (< 640px) and desktop (>= 640px).

#### Scenario: Desktop layout renders horizontal bracket

- **WHEN** viewport width is 640px or wider
- **THEN** the bracket SHALL render horizontally with rounds as columns from left to right: R32, R16, QF, SF, 🏆 Final, SF, QF, R16, R32
- **THEN** connecting lines SHALL be visible between match nodes across rounds

#### Scenario: Mobile layout renders collapsible vertical rounds

- **WHEN** viewport width is less than 640px
- **THEN** each round SHALL render as a vertically stacked collapsible section
- **THEN** the user SHALL be able to tap a round header to toggle its expanded/collapsed state

### Requirement: Auto-expand current active round

The bracket SHALL automatically detect which round is currently active and expand it on page load. All other rounds SHALL follow default collapse rules.

#### Scenario: Active round auto-expands

- **WHEN** the page loads and at least one match in a given round has status "live" or "upcoming"
- **THEN** the round containing those matches SHALL be expanded by default

#### Scenario: All matches finished expands final round

- **WHEN** all matches across all rounds have status "finished"
- **THEN** the Final round SHALL be expanded by default

#### Scenario: Priority order for auto-expand

- **WHEN** multiple rounds contain upcoming matches
- **THEN** the round with the earliest upcoming match date SHALL be expanded

##### Example: QF active while SF is also scheduled

- **GIVEN** QF has matches with upcoming dates, SF has matches with future upcoming dates
- **THEN** QF round SHALL be expanded, SF round SHALL be collapsed

### Requirement: Completed rounds collapse by default

A round where all matches have status "finished" SHALL render collapsed by default, showing only the round title and an expand control.

#### Scenario: Completed round shows collapsed state

- **WHEN** all matches in R32 are finished
- **THEN** R32 section SHALL render in collapsed state showing only "R32" label and a toggle affordance
- **WHEN** user clicks the R32 header
- **THEN** R32 SHALL expand to show all match results

### Requirement: Unstarted rounds collapse by default

A round where no team slots are yet determined (all team slots are TBD) SHALL render collapsed by default.

#### Scenario: TBD round shows collapsed state

- **WHEN** all team slots in SF are TBD (no teams determined yet)
- **THEN** SF section SHALL render collapsed with a "待定" indicator
- **WHEN** user clicks the SF header
- **THEN** SF SHALL expand showing TBD placeholder nodes

### Requirement: Enlarged bracket typography

Match nodes in the bracket SHALL use a font size of at least 15px for team names and at least 13px for scores and metadata.

#### Scenario: Bracket match node uses large fonts

- **WHEN** a match node is rendered with two known teams
- **THEN** team name text SHALL be at least 15px
- **THEN** score or kickoff time text SHALL be at least 13px
