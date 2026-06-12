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

const gasHelpers = loadFunctions(gasCode, [
  'footballDataStatusToMatchStatus_',
  'getFootballDataFullTimeScore_',
  'shouldSyncFootballDataMatch_'
]);
const toMatchStatus = gasHelpers.footballDataStatusToMatchStatus_;
assert.strictEqual(toMatchStatus('FINISHED'), 'finished');
assert.strictEqual(toMatchStatus('IN_PLAY'), 'live');
assert.strictEqual(toMatchStatus('PAUSED'), 'live');
assert.strictEqual(toMatchStatus('LIVE'), 'live');
assert.strictEqual(toMatchStatus('TIMED'), 'upcoming');
assert.strictEqual(toMatchStatus('SCHEDULED'), 'upcoming');

const shouldSync = gasHelpers.shouldSyncFootballDataMatch_;
assert.strictEqual(shouldSync({ status: 'IN_PLAY', score: { fullTime: { home: null, away: null } } }), true);
assert.strictEqual(shouldSync({ status: 'PAUSED', score: { fullTime: { home: null, away: null } } }), true);
assert.strictEqual(shouldSync({ status: 'FINISHED', score: { fullTime: { home: 2, away: 1 } } }), true);
assert.strictEqual(shouldSync({ status: 'TIMED', score: { fullTime: { home: null, away: null } } }), false);

console.log('api-auto-update tests passed');
