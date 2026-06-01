## ADDED Requirements

### Requirement: Scroll-friendly layout without viewport height lock

Each chart page SHALL use a scroll-friendly layout that does not lock the page to the viewport height. The outermost container SHALL use `min-height: 100svh` with a `-webkit-fill-available` fallback instead of `height: 100vh`. The container SHALL NOT apply `overflow: hidden` at the page/wrapper level; content overflow SHALL be handled by inner scroll containers only.

#### Scenario: Content is not clipped inside an iframe

- **WHEN** a chart page is embedded in a `<iframe>` whose height is smaller than the chart's natural content height
- **THEN** the chart's content SHALL NOT be silently truncated; the iframe's content SHALL be scrollable or the parent page SHALL receive a height notification to resize the iframe

#### Scenario: Standalone page retains full-screen appearance

- **WHEN** a chart page is opened directly in a browser window
- **THEN** the page SHALL fill the full visible viewport height, consistent with pre-fix behavior

### Requirement: postMessage height notification to parent frame

Each chart page SHALL implement a `notifyHeight()` function that posts `{ type: 'wc2026-resize', height: number }` to `window.parent` using `window.parent.postMessage(...)`. The `height` value SHALL be `document.documentElement.scrollHeight`. The function SHALL be called after every operation that changes the page's total rendered height.

#### Scenario: Height notified on initial render

- **WHEN** the page completes initial data fetch and renders content
- **THEN** `notifyHeight()` SHALL be called once with the rendered content height

#### Scenario: Height notified on error or loading state

- **WHEN** the page enters a loading, error, or empty state
- **THEN** `notifyHeight()` SHALL be called with the current `scrollHeight` of that state

#### Scenario: Height notified after user interaction changes content

- **WHEN** the user performs an interaction that changes the total rendered height (tab switch, filter change, data expand)
- **THEN** `notifyHeight()` SHALL be called after the DOM update completes

#### Scenario: notifyHeight is safe when not in an iframe

- **WHEN** the page is opened directly (not embedded)
- **THEN** calling `notifyHeight()` SHALL NOT throw an error; the `try/catch` wrapper SHALL suppress any cross-origin `postMessage` errors silently

##### Example: postMessage payload

| Property | Type | Example value |
|----------|------|---------------|
| `type` | string | `"wc2026-resize"` |
| `height` | number | `1240` (pixels, integer) |

### Requirement: iOS Safari viewport unit fallback

Each chart page SHALL resolve iOS Safari URL-bar truncation by applying `height: 100svh` for iOS 16+ and `-webkit-fill-available` as a fallback. The `100vh` unit SHALL NOT be used as the sole height constraint on any full-page container.

#### Scenario: Page fills viewport on iOS Safari with URL bar expanded

- **WHEN** the page is opened on iOS Safari with the URL bar visible
- **THEN** the bottom of the visible content area SHALL NOT be hidden behind the browser chrome

### Requirement: Resize event debounce on bracket page

The `wc2026-bracket.html` page's `resize` event listener SHALL debounce the `fitBracket()` call with a 150ms delay using `clearTimeout`/`setTimeout`. A new `resize` event during the debounce window SHALL reset the timer.

#### Scenario: Rapid resize events do not cause layout thrashing

- **WHEN** the user drags the browser window edge continuously, triggering multiple `resize` events within 150ms
- **THEN** `fitBracket()` SHALL be called at most once per 150ms interval

#### Scenario: Device rotation triggers fitBracket after debounce

- **WHEN** the device orientation changes (triggering a `resize` event)
- **THEN** `fitBracket()` SHALL execute once, 150ms after the resize event fires

### Requirement: Touch target minimum size

All interactive elements across the three chart pages SHALL have a minimum clickable area of 44×44 CSS pixels. Elements affected: `anchor-btn` in `wc2026-groups.html`, `date-tab` in `wc2026-schedule.html`, and `cnav-btn` in the mobile view of `wc2026-bracket.html`.

#### Scenario: anchor-btn meets 44px height requirement

- **WHEN** the groups page renders the anchor navigation
- **THEN** each `anchor-btn` element SHALL have a computed height of at least 44px

#### Scenario: date-tab meets 44px height requirement

- **WHEN** the schedule page renders the date tab navigation
- **THEN** each `date-tab` element SHALL have a computed height of at least 44px

#### Scenario: cnav-btn meets 44px height requirement on mobile

- **WHEN** the bracket page renders in mobile mode (viewport width < 660px)
- **THEN** each `cnav-btn` element SHALL have a computed height of at least 44px

### Requirement: prefers-reduced-motion guard

All three chart pages SHALL include a `@media (prefers-reduced-motion: reduce)` CSS rule that sets `transition: none !important` on all elements. This rule SHALL appear after all transition declarations.

#### Scenario: Transitions disabled when user prefers reduced motion

- **WHEN** the operating system's "reduce motion" accessibility setting is enabled
- **THEN** all CSS transitions on interactive elements SHALL be suppressed
