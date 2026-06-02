## ADDED Requirements

### Requirement: High-contrast color tokens meeting WCAG 2.1 AA

Each a11y page SHALL define CSS custom properties that meet the following minimum contrast ratios against their respective backgrounds. Body text (`--fg` on `--bg`) SHALL achieve ≥ 7:1 (AAA). Interactive text (`--accent` on `--bg`) SHALL achieve ≥ 4.5:1 (AA). Muted text (`--muted` on `--bg`) SHALL achieve ≥ 4.5:1 (AA). Border strokes used as the sole visual differentiator SHALL achieve ≥ 3:1 (AA).

#### Scenario: Body text contrast verified

- **WHEN** the page is rendered with default OS settings
- **THEN** all body text elements SHALL have a contrast ratio ≥ 7:1 against the page background, verifiable via Chrome DevTools Accessibility panel or axe-core audit

#### Scenario: Interactive element contrast verified

- **WHEN** a button or link is in its default (non-focus, non-hover) state
- **THEN** its foreground text SHALL have a contrast ratio ≥ 4.5:1 against its background

##### Example: Color token contrast ratios

| Token | Value | Background | Contrast | Level |
|-------|-------|------------|----------|-------|
| `--fg` | #1a1a1a | #ffffff | 16.7:1 | AAA |
| `--muted` | #595959 | #ffffff | 7.0:1 | AA |
| `--accent` | #0056b3 | #ffffff | 7.2:1 | AAA |
| `--border` | #767676 | #ffffff | 4.54:1 | AA |
| `--header-bg` | #003d82 | #ffffff (text) | 9.0:1 | AAA |

### Requirement: Enlarged typography using relative units

Each a11y page SHALL set `html { font-size: 18px }` and use `rem` for all font sizes. Body text SHALL be 1rem (18px). Section headings SHALL be at least 1.2rem (21.6px). Score display and match time SHALL be at least 1.8rem (32.4px). Header page title SHALL be at least 1.2rem (21.6px).

#### Scenario: User browser font size preference respected

- **WHEN** the user sets their browser or OS base font size to a value larger than 16px
- **THEN** all text on the a11y page SHALL scale proportionally, because rem units are used throughout

#### Scenario: Minimum body font size enforced

- **WHEN** the a11y page renders under default browser settings
- **THEN** all body text SHALL appear at a computed size of at least 18px, verifiable via DevTools computed styles

### Requirement: Touch target minimum size of 48×48 CSS pixels

All interactive elements (buttons, tabs, navigation links) on a11y pages SHALL have a minimum computed height and width of 48px. This applies to: date navigation tabs, anchor navigation buttons, score tab buttons, and any action buttons.

#### Scenario: Date tab meets 48px requirement

- **WHEN** the schedule a11y page renders the date navigation
- **THEN** each date tab button SHALL have a computed height ≥ 48px, verifiable via DevTools box model

#### Scenario: Anchor nav button meets 48px requirement

- **WHEN** the groups a11y page renders the A–L anchor navigation
- **THEN** each anchor button SHALL have a computed height ≥ 48px

### Requirement: Skip navigation link

Each a11y page SHALL include a skip-to-content link as the first focusable element in the DOM. The link SHALL target `#main-content`. The link SHALL be visually hidden until focused, at which point it SHALL appear at the top-left of the viewport. The main content area SHALL carry `id="main-content"`.

#### Scenario: Skip link appears on keyboard focus

- **WHEN** a keyboard user presses Tab as the first interaction on the page
- **THEN** a visible "跳至主要內容" link SHALL appear at the top of the page

#### Scenario: Skip link navigates to main content

- **WHEN** the user activates the skip link (Enter or click)
- **THEN** keyboard focus SHALL move to the element with `id="main-content"`

### Requirement: Visible focus indicator on all interactive elements

Each a11y page SHALL define a `:focus-visible` CSS rule that applies a 3px solid outline in `--focus` color (#0056b3) with 3px offset to all interactive elements. Browser default outlines SHALL NOT be suppressed without this replacement.

#### Scenario: Focus indicator visible during keyboard navigation

- **WHEN** a keyboard user navigates to any button or link using Tab
- **THEN** a clearly visible outline SHALL appear around the focused element, with contrast ≥ 3:1 against the surrounding background

### Requirement: Semantic HTML structure with ARIA landmarks

Each a11y page SHALL wrap interactive content in `<main id="main-content">`. Navigation controls SHALL use `<nav>` with descriptive `aria-label`. Dynamic content regions that update without page reload SHALL carry `aria-live="polite"`. Loading and error state containers SHALL carry `role="status"`. Tables SHALL have `aria-label` identifying their content.

#### Scenario: Screen reader announces dynamic content update

- **WHEN** the user selects a different date tab and the match list updates
- **THEN** the match list container's `aria-live="polite"` SHALL cause screen readers to announce the updated content after the current reading is complete

#### Scenario: Navigation landmark accessible by role

- **WHEN** a screen reader user navigates by landmarks
- **THEN** they SHALL find a `<nav>` landmark labeled "日期導覽" on the schedule page and "跳至組別" on the groups page

### Requirement: prefers-contrast media query enhancement

Each a11y page SHALL include a `@media (prefers-contrast: more)` CSS block that sets `--border` to #000000, `--muted` to #000000, and increases card border width to 2px.

#### Scenario: High contrast mode activated

- **WHEN** the OS or browser "increase contrast" accessibility setting is enabled
- **THEN** all borders SHALL become solid black and muted text SHALL become full black

### Requirement: Bracket a11y list mode

The bracket a11y page (`wc2026-bracket-a11y.html`) SHALL render knockout matches as a grouped card list organized by round (32強 → 16強 → 8強 → 4強 → 決賽), rather than as a visual tree diagram. Each round SHALL be a `<section>` with a heading. Each match SHALL be a card with team names, flags, scores, and status fully visible without requiring tree-navigation interaction.

#### Scenario: All knockout matches visible without interaction

- **WHEN** the bracket a11y page loads
- **THEN** all knockout match cards SHALL be visible by scrolling, with no expand/collapse interaction required
