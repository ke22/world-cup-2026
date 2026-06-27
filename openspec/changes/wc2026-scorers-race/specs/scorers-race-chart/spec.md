## ADDED Requirements

### Requirement: Step chart renders cumulative World Cup goals per match

The `wc2026-scorers.html` component SHALL render a step chart where the X-axis represents each player's World Cup career match number (1-based, cumulative across all tournaments) and the Y-axis represents their cumulative goals scored. Each player's entire career SHALL be rendered as **one continuous SVG `<polyline>`** spanning all tournaments. The line SHALL step up vertically when a goal is scored and extend horizontally when no goal is scored. The chart SHALL be rendered as inline SVG with no external JavaScript library dependencies.

#### Scenario: No goals in a match produces horizontal step

- **WHEN** a player's goal count for match N is 0
- **THEN** the polyline segment between match N-1 and match N SHALL be horizontal at the same Y value

#### Scenario: Goals in a match produce vertical step

- **WHEN** a player scores G goals in match N
- **THEN** the polyline SHALL step up vertically by G units at X position N

#### Scenario: All tournaments are part of one continuous polyline

- **WHEN** a player has appeared in multiple World Cups
- **THEN** exactly one `<polyline>` element SHALL exist for that player, with points covering all career matches in sequence

##### Example: Two tournaments, single continuous polyline

- **GIVEN** a player with 2018 goals_per_match = [1, 0] and 2022 goals_per_match = [0, 1]
- **WHEN** the chart is rendered
- **THEN** exactly one `<polyline>` element SHALL exist for that player covering career matches 1–4 with path: (1,0)→(1,1)→(2,1)→(3,1)→(3,1)→(4,2)

---

### Requirement: Tournament boundary dots at career start and each tournament end

A small `<circle>` SHALL be placed at the career start position (career match 1, cumulative goals = 0) and at the final match position of every World Cup tournament in the player's career. This produces the visual sequence: dot → lines(T1) → dot → lines(T2) → dot → … → dot.

#### Scenario: Career start has a dot

- **WHEN** the chart renders any player
- **THEN** a `<circle>` SHALL appear at (x=1, y=0), the player's career start position before any match is processed

#### Scenario: Every tournament endpoint has a dot

- **WHEN** a player has completed N World Cup tournaments (including their last one)
- **THEN** exactly N `<circle>` elements SHALL appear at tournament end positions, plus 1 at career start, for a total of N+1 dots per player

#### Scenario: Last tournament also gets a closing dot

- **WHEN** a player's most recent tournament has concluded (retired player or active player's last completed WC)
- **THEN** a `<circle>` SHALL be rendered at the endpoint of that final tournament

##### Example: Dot count for a three-tournament career

- **GIVEN** a player with tournaments 2014, 2018, 2022
- **WHEN** the chart renders
- **THEN** 4 `<circle>` elements SHALL exist for that player: at career start, at end of 2014, at end of 2018, and at end of 2022

---

### Requirement: Three active 2026 players displayed with distinct colors

The chart SHALL display exactly three active players: Mbappé (red `#C62828`), Messi (blue `#1565C0`), Cristiano Ronaldo (green `#2E7D32`). Each active player's polyline SHALL use `stroke-width: 2.5` and full opacity. Each active polyline SHALL terminate with a label showing the player's display name and current cumulative total.

#### Scenario: Player label appears at line end

- **WHEN** the chart renders
- **THEN** each active polyline's endpoint SHALL have an adjacent text label with the player's name and total goal count (e.g., "Messi 18")

---

### Requirement: Retired players displayed as muted gray reference lines

The chart SHALL also display three retired players: Klose, Gerd Müller, and Fontaine. Retired player polylines SHALL use color `#b0b8c1`, `stroke-width: 1.5`, and `stroke-opacity: 0.6`. Retired player lines SHALL be rendered before (behind) active player lines in SVG z-order so they do not obscure active player lines. Retired player data is fully static — no 2026 live data is appended.

#### Scenario: Retired player line is visually subordinate to active lines

- **WHEN** a retired player line and an active player line overlap at the same coordinates
- **THEN** the active player line SHALL appear on top and the retired player line SHALL appear behind it

#### Scenario: All six players visible after render

- **WHEN** the chart finishes rendering
- **THEN** six polylines SHALL be present in the SVG: three colored (active) and three gray (retired), each with a terminal label showing name and total goals

---

### Requirement: Historical pre-2026 career data embedded as static JSON

The HTML file SHALL contain a `HISTORICAL_DATA` JavaScript constant with per-tournament goal arrays for all six players covering their complete World Cup careers before 2026. Each player entry SHALL include an `active` boolean field. This data SHALL never be fetched from an external source.

#### Scenario: Chart renders without network access for static content

- **WHEN** the GAS endpoint is unavailable
- **THEN** the chart SHALL still render the historical portions of all six polylines using the embedded static data, showing "2026 data unavailable" notice for the active players' 2026 portion only

---

### Requirement: Live 2026 data appended from GAS getTopScorers

The frontend SHALL fetch `?action=getTopScorers` from the GAS URL on page load, merge the returned 2026 match-level goals with the static historical data, and extend each player's polyline to include 2026 matches. The response SHALL be cached in `sessionStorage` under key `wc26_scorers` with TTL equal to `cache_ttl_sec` (default 60 seconds).

#### Scenario: 2026 goals extend the historical polyline

- **WHEN** `getTopScorers` returns `matches_played_2026: 3` and `total_goals_2026: 2` for Mbappé
- **THEN** Mbappé's polyline SHALL extend 3 additional match segments beyond his pre-2026 endpoint, stepping up at the correct match positions

#### Scenario: Cached response is used within TTL

- **WHEN** a valid `wc26_scorers` entry exists in `sessionStorage` and its age is less than `cache_ttl_sec`
- **THEN** the page SHALL render using the cached data without making a network request

---

### Requirement: Chart is responsive and mobile-friendly

The SVG viewBox SHALL accommodate up to 35 World Cup matches on the X-axis and up to 25 goals on the Y-axis with margins. On viewports narrower than the chart's natural width, the chart container SHALL be horizontally scrollable without breaking the page layout.

#### Scenario: 320px viewport does not cause layout overflow

- **WHEN** the page is viewed at 320px viewport width
- **THEN** the chart container SHALL display a horizontal scrollbar and the page body SHALL NOT overflow horizontally

---

### Requirement: Component reports height to parent frame

After each render, `wc2026-scorers.html` SHALL post a `{ type: "wc2026-resize", height: <scrollHeight> }` message to `window.parent`, consistent with the existing embed widget pattern.

#### Scenario: Parent iframe adjusts height on load

- **WHEN** the component finishes rendering inside an iframe
- **THEN** the parent page's message handler SHALL receive a `wc2026-resize` message and set the iframe height accordingly

---

### Requirement: Component applies CNA Design System visual tokens and is registered in embed-info

`wc2026-scorers.html` SHALL use the same CNA Design System CSS variables (`--bg`, `--surface`, `--accent`, `--header-from`, `--header-to`, `--border`, `--shadow`, `--fg`, `--muted`, `--accent-2`) and font stack as the other CNA embed components. The header SHALL use `linear-gradient(180deg, var(--header-from) 0%, var(--header-to) 100%)` with `border-radius: 16px 16px 0 0` and include the `cna_logo.svg` image. `wc2026-embed-info.html` SHALL include a card entry for this component with the `wc2026-embed` div embed format (not a raw `<iframe>`).

#### Scenario: Visual appearance matches existing CNA components

- **WHEN** `wc2026-scorers.html` is placed side-by-side with `wc2026-schedule.html`
- **THEN** both components SHALL share the same header gradient color, border radius, font, and shadow treatment

#### Scenario: Embed code card present in embed-info

- **WHEN** a CNA editor opens `wc2026-embed-info.html`
- **THEN** a card for the scorers race chart SHALL be present with a copyable embed code block using the `wc2026-embed` div format pointing to `wc2026-scorers.html`

#### Scenario: Embed loader drives iframe creation, not raw iframe tag

- **WHEN** the embed code from `wc2026-embed-info.html` is pasted into a CNA article page
- **THEN** `embed-loader.js` SHALL create the iframe element and wire the `wc2026-resize` postMessage listener automatically, without requiring a raw `<iframe>` tag in the article
