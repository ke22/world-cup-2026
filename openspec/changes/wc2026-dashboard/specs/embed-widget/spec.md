## ADDED Requirements

### Requirement: Single self-contained HTML file

The entire frontend component SHALL be delivered as a single file (`wc2026-schedule.html`) containing all HTML, CSS, and JavaScript inline. It SHALL have no external dependencies beyond optional CDN-hosted fonts. No build tools, npm, or bundlers SHALL be required to produce or run the file.

#### Scenario: File opens directly in browser

- **WHEN** the user opens `wc2026-schedule.html` via `file://` protocol in any modern browser
- **THEN** the page SHALL render the date navigation and match cards without errors

### Requirement: iframe embed with auto-height resize

When embedded in a host page via `<iframe>`, the component SHALL notify the host page of its rendered height by posting a message after each render. The host page can listen to this message to set the iframe height dynamically, eliminating scrollbars inside the iframe.

#### Scenario: Component posts resize message after render

- **WHEN** the component finishes rendering match cards
- **THEN** it SHALL execute `window.parent.postMessage({ type: 'wc2026-resize', height: document.body.scrollHeight }, '*')`

#### Scenario: Host page receives and applies height

- **WHEN** the host page listens for `message` events and receives `{ type: 'wc2026-resize', height: N }`
- **THEN** the host page SHALL set the iframe element's height to `N + 20` pixels

### Requirement: Configuration via top-of-file constants

The file SHALL expose the following constants at the top of the script block for easy deployment configuration:
- `GAS_URL`: the GAS Web App deployment URL (string, required)
- `CACHE_TTL`: cache TTL in seconds (integer, default 60)
- `LIVE_REFRESH`: live match refresh interval in seconds (integer, default 60)

#### Scenario: Empty GAS_URL shows error state

- **WHEN** `GAS_URL` is an empty string or placeholder value
- **THEN** the component SHALL display an error message ("資料來源未設定") instead of a blank page or console-only error

### Requirement: sessionStorage caching with TTL

The component SHALL cache API responses in `sessionStorage` using the key format `wc26_{date}`. A cached entry SHALL be considered valid for `CACHE_TTL` seconds from the time it was stored. Live match fetches SHALL bypass the cache.

#### Scenario: Valid cache entry skips network request

- **WHEN** `sessionStorage` contains a `wc26_{date}` entry stored less than `CACHE_TTL` seconds ago
- **THEN** the component SHALL use the cached data without making a network request

#### Scenario: Expired cache entry triggers refetch

- **WHEN** `sessionStorage` contains a `wc26_{date}` entry stored more than `CACHE_TTL` seconds ago
- **THEN** the component SHALL fetch fresh data and overwrite the stale cache entry

#### Scenario: Live refresh bypasses cache

- **WHEN** the auto-refresh timer fires for a date with live matches
- **THEN** the component SHALL fetch fresh data regardless of cache state

### Requirement: Fetch failure shows error message without crash

If the API fetch fails (network error, non-OK HTTP status, or malformed JSON), the component SHALL display a user-visible error message and SHALL NOT render a blank page or throw an uncaught exception.

#### Scenario: Network error shows error message

- **WHEN** the fetch to GAS_URL fails with a network error
- **THEN** the component SHALL display "資料載入失敗，請稍後重試" in place of the match list
