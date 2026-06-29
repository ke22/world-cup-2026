const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const scheduleHtml = fs.readFileSync('wc2026-schedule.html', 'utf8');
const deployScheduleHtml = fs.readFileSync('wc2026-v1.0-deploy/wc2026-schedule.html', 'utf8');
const gasCode = fs.readFileSync('Code.gs', 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notStrictEqual(start, -1, `${name} not found`);
  let depth = 0;
  let seenBody = false;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
      seenBody = true;
    } else if (source[i] === '}') {
      depth--;
      if (seenBody && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} body not closed`);
}

function loadFunction(source, name) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractFunction(source, name)}; this.fn = ${name};`, context);
  return context.fn;
}

function loadFunctions(source, names) {
  const context = {};
  vm.createContext(context);
  const definitions = names.map(name => extractFunction(source, name)).join('\n');
  vm.runInContext(`${definitions}\n${names.map(name => `this.${name} = ${name};`).join('\n')}`, context);
  return context;
}

function testScheduleTodayUsesTaiwanDate(source, label) {
  const todayUTC8 = loadFunction(source, 'todayUTC8');
  const instant = Date.parse('2026-06-11T18:00:00Z');
  assert.strictEqual(todayUTC8(instant), '2026-06-12', `${label} should calculate today in UTC+8`);
  assert.match(source, /const today\s*=\s*todayUTC8\(\);/, `${label} findInitialDate should use todayUTC8()`);
}

testScheduleTodayUsesTaiwanDate(scheduleHtml, 'root schedule');
testScheduleTodayUsesTaiwanDate(deployScheduleHtml, 'deploy schedule');

// Score auto-sync now pulls from the ESPN scoreboard API. Verify the pure
// helpers that map ESPN status / abbreviations / dates onto our match model.
const gasHelpers = loadFunctions(gasCode, [
  'espnStatusToMatchStatus_',
  'utcToDate8'
]);

// espnCode_ depends on the top-level ESPN_CODE_MAP const, so load it too.
const espnCtx = {};
vm.createContext(espnCtx);
const mapStart = gasCode.indexOf('const ESPN_CODE_MAP');
const mapDef = gasCode.slice(mapStart, gasCode.indexOf('};', mapStart) + 2);
vm.runInContext(`${mapDef}\n${extractFunction(gasCode, 'espnCode_')}\nthis.espnCode_ = espnCode_;`, espnCtx);
gasHelpers.espnCode_ = espnCtx.espnCode_;

const toMatchStatus = gasHelpers.espnStatusToMatchStatus_;
assert.strictEqual(toMatchStatus('STATUS_FULL_TIME'), 'finished');
assert.strictEqual(toMatchStatus('STATUS_FINAL'), 'finished');
assert.strictEqual(toMatchStatus('STATUS_IN_PROGRESS'), 'live');
assert.strictEqual(toMatchStatus('STATUS_HALFTIME'), 'live');
assert.strictEqual(toMatchStatus('IN_PLAY'), 'live');      // matches the "PLAY" substring rule
assert.strictEqual(toMatchStatus('STATUS_SCHEDULED'), 'upcoming');
assert.strictEqual(toMatchStatus(''), 'upcoming');
assert.strictEqual(toMatchStatus(null), 'upcoming');

const espnCode = gasHelpers.espnCode_;
assert.strictEqual(espnCode('BOC'), 'BIH', 'mapped ESPN abbreviation → internal code');
assert.strictEqual(espnCode('DRC'), 'CGO', 'DR Congo maps to CGO');
assert.strictEqual(espnCode('SAU'), 'KSA', 'Saudi Arabia maps to KSA');
assert.strictEqual(espnCode('BRA'), 'BRA', 'unmapped abbreviation passes through unchanged');

const utcToDate8 = gasHelpers.utcToDate8;
assert.strictEqual(utcToDate8('2026-06-11T18:00:00Z'), '2026-06-12', 'UTC+8 rolls 18:00Z to next day');
assert.strictEqual(utcToDate8('2026-06-12T03:00:00Z'), '2026-06-12', 'morning UTC stays same UTC+8 day');

console.log('api-auto-update tests passed');
