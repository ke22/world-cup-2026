const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('wc2026-bracket.html', 'utf8');

assert.match(html, /function startBracketAutoRefresh\s*\(/,
  'bracket defines a dedicated auto-refresh starter');
assert.match(html, /setInterval\s*\(\s*refreshBracket\s*,\s*60\s*\*\s*1000\s*\)/,
  'bracket refreshes every 60 seconds');
assert.match(html, /if\s*\(_bracketRefreshInFlight\)\s*return/,
  'a pending refresh prevents overlapping API requests');
assert.match(html, /await\s+init\s*\(\s*\)/,
  'each refresh fetches and rerenders through init');
assert.match(html, /startBracketAutoRefresh\s*\(\s*\)/,
  'auto-refresh starts after initial page setup');

console.log('bracket-auto-refresh tests passed');
