## ADDED Requirements

### Requirement: GAS scorers sheet stores 2026 individual goal events

The Google Sheet SHALL contain a `scorers` worksheet with one row per goal event in the 2026 World Cup. Each row SHALL have four columns: `match_id` (integer, references `matches` sheet), `player_name` (string, display name), `player_code` (string, machine identifier), and `goals` (integer ≥ 1). Rows with `goals = 0` SHALL NOT be required; the absence of a row for a player in a given match implicitly means zero goals.

#### Scenario: Goal event recorded after match

- **WHEN** an administrator adds a row with match_id=23, player_code="mbappe", goals=2
- **THEN** the `getTopScorers` endpoint SHALL include Mbappé with 2 goals attributed to match 23

#### Scenario: No row for a match means zero goals

- **WHEN** no row exists in the `scorers` sheet for player_code="messi" and match_id=31
- **THEN** the `getTopScorers` endpoint SHALL return 0 goals for Messi in match 31 (or omit that match entirely, treating it as 0)

---

### Requirement: GAS getTopScorers endpoint aggregates 2026 scorer data

The `doGet(e)` function SHALL handle `action=getTopScorers` and return a JSON array of objects, one per player tracked in the `scorers` sheet. Each object SHALL contain: `player_name` (string), `player_code` (string), `goals_2026` (array of `{ match_id, goals }` objects for matches with ≥1 goal), `total_goals_2026` (integer sum of all goals), and `matches_played_2026` (integer count of distinct match_ids for this player in the sheet).

#### Scenario: Response shape for a player with two scoring matches

- **WHEN** the `scorers` sheet contains rows for player_code="mbappe" with match_id=10 goals=1 and match_id=14 goals=2
- **THEN** the response data entry for Mbappé SHALL be:

##### Example: Mbappé with two goal events

```json
{
  "player_name": "Mbappé",
  "player_code": "mbappe",
  "goals_2026": [
    { "match_id": 10, "goals": 1 },
    { "match_id": 14, "goals": 2 }
  ],
  "total_goals_2026": 3,
  "matches_played_2026": 2
}
```

#### Scenario: Player with no 2026 goals is omitted from response

- **WHEN** no rows exist in the `scorers` sheet for player_code="ronaldo"
- **THEN** the `data` array SHALL NOT contain an entry for Ronaldo (frontend treats absence as 0 goals, 0 matches played in 2026)

#### Scenario: Response uses standard envelope

- **WHEN** `action=getTopScorers` is requested
- **THEN** the response SHALL use the standard envelope `{ "status": "ok", "updated": "<ISO8601>", "data": [...] }`
