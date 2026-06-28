## ADDED Requirements

### Requirement: Periodic bracket data refresh

The bracket page SHALL request fresh match data every 60 seconds after initial load and SHALL rerender the bracket with the newest resolved teams. The page SHALL NOT start a second refresh while a previous refresh is still in progress.

#### Scenario: Open page receives a newly resolved team

- **WHEN** the backend resolves a knockout team after the bracket page has loaded
- **THEN** the page SHALL display that team no later than the first successful 60-second refresh after the backend update

#### Scenario: Slow request does not overlap

- **WHEN** a refresh request is still pending at the next timer tick
- **THEN** the page SHALL skip that tick instead of issuing another request
