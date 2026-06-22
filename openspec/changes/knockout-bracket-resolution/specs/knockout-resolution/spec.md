## ADDED Requirements

### Requirement: Rank teams within a group

The system SHALL rank the four teams of a group by total points. Teams tied on total points SHALL then be ranked by points, goal difference, and goals scored in matches among the tied teams. If those criteria separate only part of the tied set, the system SHALL reapply the same head-to-head criteria to the remaining tied subset. Teams still tied SHALL be ranked by overall goal difference, overall goals scored, team conduct score, and FIFA ranking in that order. When optional conduct or ranking data is absent and all available official criteria remain equal, the system SHALL use team code as a deterministic fallback.

#### Scenario: Rank by points then goal difference then goals for

- **WHEN** a group's four teams are ranked
- **THEN** the team with the most points SHALL be index 0 (group winner) and the second SHALL be index 1 (runner-up)

##### Example: ordering keys

| Team | Pts | GD | GF | Rank |
| ---- | --- | -- | -- | ---- |
| A1   | 9   | 4  | 6  | 1    |
| A2   | 4   | 1  | 4  | 2    |
| A3   | 4   | 1  | 3  | 3    |
| A4   | 0   | -6 | 1  | 4    |

Notes: A2 and A3 tie on Pts and GD; A2 ranks higher on GF (4 > 3).

#### Scenario: Head-to-head result ranks teams tied on points

- **WHEN** Mexico and Korea can finish tied on six points and Mexico has defeated Korea
- **THEN** Mexico SHALL rank above Korea regardless of their overall goal difference

### Requirement: Rank third-placed teams and select the best eight

The system SHALL rank the twelve third-placed teams (one per group A–L) by the same keys (points, goal difference, goals for, then deterministic fallback) and SHALL select the top eight as the qualifying third-placed teams.

#### Scenario: Top eight thirds qualify

- **WHEN** the twelve third-placed teams are ranked
- **THEN** the first eight SHALL be marked as qualified and the remaining four SHALL be eliminated

### Requirement: Assign qualified thirds to bracket slots via the official allocation table

The system SHALL map the set of eight qualifying groups to specific Round-of-32 third-place slots using the official FIFA WC2026 allocation table. The allocation function SHALL accept exactly eight group letters and SHALL return a mapping from each third-place slot to a group letter. When the input does not contain exactly eight groups, or the combination has no entry in the table, the function SHALL return null.

#### Scenario: Known combination resolves to defined slots

- **WHEN** the eight qualifying groups are passed to the allocation function
- **THEN** the function SHALL return a slot-to-group mapping that matches the official table for that combination

#### Scenario: Invalid input returns null

- **WHEN** the allocation function receives other than eight groups, or an unknown combination
- **THEN** the function SHALL return null

### Requirement: Resolve Round-of-32 matchups from group standings

The system SHALL resolve the home and away teams for Round-of-32 matches (match_id 73 through 88) from the group standings using the official seed map. A seed code of the form `1X` or `2X` SHALL resolve to the winner or runner-up of group X. A third-place seed slot SHALL resolve to the group assigned by the allocation table. The output SHALL be a mapping from match_id to home and away team codes.

#### Scenario: Seed codes resolve to concrete teams

- **WHEN** standings are complete and Round-of-32 is resolved
- **THEN** each match_id from 73 to 88 SHALL map to a home team code and an away team code derived from the seed map and allocation table

### Requirement: Progressively write mathematically clinched group positions

The system SHALL write a group winner or runner-up into its Round-of-32 slot as soon as that exact position cannot change under any remaining group-stage result. The system SHALL use each team's current points, maximum points available from remaining matches, and completed head-to-head results. When all matches in a group are finished, the system SHALL use the final official ranked order. The system SHALL leave an unresolved side empty and SHALL defer third-place allocation until the complete set of eight qualifying third-placed groups is known.

#### Scenario: Clinched winner is written before the group stage ends

- **WHEN** a team is guaranteed to finish first even if it loses every remaining match and every rival earns its maximum remaining points
- **THEN** the system SHALL write that team into the corresponding `1X` Round-of-32 slot while leaving uncertain slots empty

#### Scenario: Head-to-head locks a winner before the final match

- **WHEN** Mexico has six points, Korea can reach six points, every other Group A team can reach at most four points, and Mexico has defeated Korea
- **THEN** the system SHALL resolve Mexico as `1A`

#### Scenario: Uncertain rank remains empty

- **WHEN** two or more teams can still occupy a seed position based on their current and maximum possible points
- **THEN** the system SHALL leave that seed unresolved

#### Scenario: Completed group resolves final positions

- **WHEN** all matches in one group are finished
- **THEN** the system SHALL resolve that group's winner and runner-up using the final ranked order without waiting for other groups

### Requirement: Preserve manually locked rows and recalculate automatic rows

The system SHALL NOT overwrite a knockout match row that is manually locked. An unlocked Round-of-32 row SHALL remain under automatic management: each synchronization SHALL update its resolved sides and SHALL clear an unresolved stale side so later results cannot leave an obsolete automatic team in place.

#### Scenario: Manual lock is respected

- **WHEN** a Round-of-32 row is manually locked
- **THEN** resolution SHALL skip that row and leave its existing values unchanged

#### Scenario: Automatic row is recalculated

- **WHEN** an unlocked Round-of-32 row contains a previously calculated team and a later synchronization produces a different resolved value or no resolved value
- **THEN** resolution SHALL replace or clear that side to match the latest calculation
