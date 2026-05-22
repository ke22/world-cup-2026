## ADDED Requirements

### Requirement: GAS Web App responds to getMatches action

The GAS `doGet(e)` function SHALL handle `action=getMatches` and return a JSON response containing match data from the `matches` sheet. An optional `date` parameter (ISO date string `YYYY-MM-DD`) SHALL filter results to that date only. An optional `phase` parameter SHALL filter by match phase.

#### Scenario: Fetch all matches

- **WHEN** the request is `?action=getMatches`
- **THEN** the response SHALL contain all 104 matches in the `data` array

#### Scenario: Fetch matches by date

- **WHEN** the request is `?action=getMatches&date=2026-06-11`
- **THEN** the response `data` array SHALL contain only matches where `date` equals `2026-06-11`

#### Scenario: Match with no score returns null

- **WHEN** a match row has empty `score1` and `score2` cells
- **THEN** the JSON object SHALL have `"score1": null` and `"score2": null`

##### Example: Match object shape

```json
{
  "match_id": 1,
  "date": "2026-06-11",
  "time_utc8": "15:00",
  "phase": "小組賽",
  "group": "A",
  "round": 1,
  "team1": { "code": "MEX", "name": "墨西哥", "flag": "🇲🇽" },
  "team2": { "code": "RSA", "name": "南非", "flag": "🇿🇦" },
  "score1": null,
  "score2": null,
  "status": "upcoming",
  "venue": "Estadio Azteca",
  "city": "墨西哥城"
}
```

### Requirement: GAS Web App responds to getGroups action

The GAS `doGet(e)` function SHALL handle `action=getGroups` and return standings data from the `groups` sheet. An optional `group` parameter SHALL filter results to a single group letter.

#### Scenario: Fetch all group standings

- **WHEN** the request is `?action=getGroups`
- **THEN** the response `data` array SHALL contain all teams across all 12 groups (A–L)

#### Scenario: Fetch single group standings

- **WHEN** the request is `?action=getGroups&group=A`
- **THEN** the response `data` array SHALL contain only Group A teams

### Requirement: GAS Web App responds to getConfig action

The GAS `doGet(e)` function SHALL handle `action=getConfig` and return key-value configuration from the `config` sheet, including `cache_ttl_sec`, `live_refresh_sec`, and `last_updated`.

#### Scenario: Config response contains required keys

- **WHEN** the request is `?action=getConfig`
- **THEN** the response `data` object SHALL contain `cache_ttl_sec`, `live_refresh_sec`, and `last_updated`

### Requirement: GAS returns standard response envelope

All successful responses SHALL use the envelope `{ "status": "ok", "updated": "<ISO8601 timestamp>", "data": [...] }`. All error responses SHALL use `{ "status": "error", "message": "<description>" }`.

#### Scenario: Unknown action returns error

- **WHEN** the request contains an unrecognized `action` value (e.g., `?action=foo`)
- **THEN** the response SHALL be `{ "status": "error", "message": "Invalid action" }`

#### Scenario: Missing action returns error

- **WHEN** the request contains no `action` parameter
- **THEN** the response SHALL be `{ "status": "error", "message": "Invalid action" }`

### Requirement: GAS deployment allows unauthenticated GET access

The GAS Web App SHALL be deployed with execution identity as the owner and access set to "Anyone" (no login required), enabling cross-origin GET requests from any domain without CORS headers.

#### Scenario: Cross-origin fetch from frontend

- **WHEN** the frontend HTML page hosted on any domain calls `fetch(GAS_URL)`
- **THEN** the browser SHALL receive a valid JSON response without CORS errors
