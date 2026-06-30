## ADDED Requirements

### Requirement: 2026 participant cohort only

The 2026 scorers visualizations SHALL display exactly the 11 players who participate in the 2026 World Cup: Mbappé, Messi, C. Ronaldo, Kane, Neymar, Enner Valencia, James Rodríguez, Romelu Lukaku, Ivan Perišić, Cody Gakpo, and Vinícius Júnior. Retired players who did not participate in 2026 (e.g., Klose, Pelé, Müller, Fontaine, R9 Ronaldo, Klinsmann, Kocsis, Batistuta, Cubillas) SHALL NOT appear.

#### Scenario: Retired legends excluded

- **WHEN** either 2026 scorers chart renders
- **THEN** only the 11 listed 2026 participants SHALL be drawn, and no `active: false` historical reference players SHALL appear

### Requirement: Player dataset with per-tournament goals

The visualizations SHALL use a fixed dataset of each player's World Cup goals per tournament. Each player's total SHALL equal the sum of their per-tournament goals. Tournaments a player did not participate in SHALL be represented as non-participation (no data point), distinct from participation with zero goals.

#### Scenario: Totals reconcile with per-tournament goals

- **WHEN** a player's total goals are computed from the dataset
- **THEN** the total SHALL equal the sum of that player's per-tournament goals

##### Example: cohort goal dataset

| Player | 2014 | 2018 | 2022 | 2026 (fallback) | Total |
| --- | --- | --- | --- | --- | --- |
| Neymar | 4 | 2 | 2 | 0 | 8 |
| Messi | 4 | 1 | 7 | 5 | (see lines chart, full career) |
| Enner Valencia | 3 | — | 3 | 0 | 6 |
| James Rodríguez | 6 | 0 | — | 0 | 6 |
| Romelu Lukaku | 1 | 4 | 0 | 1 | 6 |
| Ivan Perišić | 2 | 3 | 1 | 0 | 6 |
| Cody Gakpo | — | — | 3 | 3 | 6 |
| Vinícius Júnior | — | — | 1 | 4 | 5 |

(`—` = did not participate; 2026 fallback values are overridden by live data when available.)

### Requirement: 2026 goals merged from live data with static fallback

For each player, the 2026 tournament goal count SHALL be sourced from the GAS `getTopScorers` live feed when that player's `player_code` matches a feed entry with at least one match played in 2026. When no matching live entry exists, the static fallback value from the dataset SHALL be used. A `player_code` alias map SHALL reconcile feed codes that differ from internal player keys.

#### Scenario: Live 2026 value overrides static fallback

- **WHEN** the live feed reports a player with a matching `player_code` and `matches_played_2026` greater than zero
- **THEN** that player's 2026 goal count SHALL use the live `total_goals_2026` value instead of the static fallback

#### Scenario: Live feed unavailable or unmatched

- **WHEN** the live feed fails to load, or a player has no matching feed entry
- **THEN** the chart SHALL render using the player's static 2026 fallback value without throwing an error

### Requirement: Horizontal stacked bar visualization

`wc2026-scorers-bars.html` SHALL render one horizontal bar per player, segmented by tournament, with bars sorted in descending order of total goals. Each player's total SHALL be labelled. Each bar's total length SHALL equal the player's full World Cup goal total; goals scored before 2014 SHALL be represented by a single aggregated "pre-2014" leading segment so that no goals are dropped. Bar segments SHALL NOT overlap one another.

#### Scenario: Bars sorted by total, segmented by tournament

- **WHEN** the bar chart renders
- **THEN** players SHALL appear top-to-bottom by descending total goals, each bar SHALL be divided into per-tournament segments (a leading pre-2014 segment plus 2014/2018/2022/2026), and each row SHALL show the player's total

##### Example: ordering by total

- **GIVEN** Messi total 18, Mbappé total 16, C. Ronaldo total 10, Neymar total 8, Vinícius total 5
- **WHEN** the bar chart renders
- **THEN** the row order from top SHALL be Messi, Mbappé, C. Ronaldo, …, Neymar, …, Vinícius (descending by total)

##### Example: pre-2014 goals retained

- **GIVEN** Messi scored 1 goal before 2014 (2006) and C. Ronaldo scored 2 (2006, 2010)
- **WHEN** the bar chart renders
- **THEN** Messi's bar total SHALL be 18 and C. Ronaldo's SHALL be 10, each with a leading pre-2014 segment

### Requirement: Compressed cumulative line visualization with hover focus

`wc2026-scorers-lines.html` SHALL render a cumulative-goals line chart for all 11 players as coloured lines, with the x-axis limited to World Cup years 2002 through 2026. At rest the lines SHALL be visually de-emphasised (thinner or lower opacity); when a player's line or dot is hovered or tapped, that player SHALL be highlighted and the others dimmed. Players from the same country SHALL use visually distinct colours.

#### Scenario: X-axis covers only 2002–2026

- **WHEN** the line chart renders
- **THEN** the x-axis SHALL include only the years 2002, 2006, 2010, 2014, 2018, 2022, 2026

#### Scenario: Hover isolates a single player

- **WHEN** the user hovers or taps one player's line or dot
- **THEN** that player SHALL be emphasised and all other players SHALL be dimmed; on hover/tap release the chart SHALL restore all players

#### Scenario: Same-country players are distinguishable

- **WHEN** two players from the same country are drawn (Neymar and Vinícius Júnior, both Brazil)
- **THEN** they SHALL be assigned visually distinct line colours

### Requirement: Self-contained embeddable files preserving existing chrome

Each new chart file SHALL be a single self-contained HTML file with no build step, reusing the existing CNA header/panel styling, and SHALL report its content height to a parent frame via `postMessage` for iframe embedding. The original `wc2026-scorers.html` SHALL remain unchanged.

#### Scenario: Height reported to parent frame

- **WHEN** either new chart finishes rendering inside an iframe
- **THEN** it SHALL post a resize message with its content height to the parent window

#### Scenario: Original file untouched

- **WHEN** the change is implemented
- **THEN** `wc2026-scorers.html` SHALL retain its existing content unchanged
