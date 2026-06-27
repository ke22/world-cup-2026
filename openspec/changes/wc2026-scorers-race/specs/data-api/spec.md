## ADDED Requirements

### Requirement: GAS Web App responds to getTopScorers action

The GAS `doGet(e)` function SHALL handle `action=getTopScorers` and return aggregated 2026 World Cup goal data per active player from the `scorers` sheet. The response SHALL use the standard envelope `{ "status": "ok", "updated": "<ISO8601>", "data": [...] }`. The endpoint SHALL accept no additional filter parameters.

#### Scenario: getTopScorers returns valid envelope

- **WHEN** the request is `?action=getTopScorers`
- **THEN** the response SHALL have `status: "ok"` and a `data` array (empty array if no rows exist in the `scorers` sheet)

#### Scenario: getTopScorers is routed by the existing switch statement

- **WHEN** `action=getTopScorers` is present in the request
- **THEN** `doGet(e)` SHALL dispatch to the `getTopScorers(e.parameter)` function without altering any other existing action routes (`getMatches`, `getGroups`, `getConfig`)
