const assert = require('assert');
const fs = require('fs');

const gasCode = fs.readFileSync('Code.gs', 'utf8');

const EXPECTED_GROUP_CODES = {
  A: ['MEX', 'RSA', 'KOR', 'CZE'],
  B: ['CAN', 'BIH', 'SUI', 'QAT'],
  C: ['BRA', 'MAR', 'HAI', 'SCO'],
  D: ['USA', 'PAR', 'AUS', 'TUR'],
  E: ['GER', 'CIV', 'ECU', 'CUW'],
  F: ['NED', 'JPN', 'SWE', 'TUN'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'],
  H: ['ESP', 'CPV', 'KSA', 'URU'],
  I: ['FRA', 'SEN', 'IRQ', 'NOR'],
  J: ['ARG', 'ALG', 'AUT', 'JOR'],
  K: ['POR', 'UZB', 'COL', 'CGO'],
  L: ['ENG', 'CRO', 'GHA', 'PAN'],
};

const codeToGroup = Object.fromEntries(
  Object.entries(EXPECTED_GROUP_CODES).flatMap(([group, codes]) =>
    codes.map(code => [code, group])
  )
);

const officialGroupConst = gasCode.match(/const OFFICIAL_GROUP_BY_CODE_2026 = \{([\s\S]*?)\n\};/);
assert(officialGroupConst, 'OFFICIAL_GROUP_BY_CODE_2026 should exist');
for (const [code, group] of Object.entries(codeToGroup)) {
  assert(
    new RegExp(`${code}: '${group}'`).test(officialGroupConst[1]),
    `OFFICIAL_GROUP_BY_CODE_2026 should map ${code} to group ${group}`
  );
}

assert(
  gasCode.includes(".addItem('修正 2026 分組字母', 'fixOfficialGroupAssignments2026')"),
  'custom menu should expose fixOfficialGroupAssignments2026'
);

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

const initializeGroups = extractFunction(gasCode, 'initializeGroups');
const groupRows = [...initializeGroups.matchAll(/^\s*\['([A-L])',\s*'([A-Z]{3})'/gm)];
assert.strictEqual(groupRows.length, 48, 'initializeGroups should contain 48 team rows');

const actualGroupCodes = {};
for (const [, group, code] of groupRows) {
  (actualGroupCodes[group] ??= []).push(code);
}

for (const [group, expectedCodes] of Object.entries(EXPECTED_GROUP_CODES)) {
  assert.strictEqual(
    JSON.stringify(actualGroupCodes[group]),
    JSON.stringify(expectedCodes),
    `initializeGroups group ${group} should match official teams`
  );
}

const initializeMatches = extractFunction(gasCode, 'initializeMatches');
const matchLines = initializeMatches
  .split('\n')
  .filter(line => line.includes("'小組賽'"));
assert.strictEqual(matchLines.length, 72, 'initializeMatches should contain 72 group-stage matches');

for (const line of matchLines) {
  const groupMatch = line.match(/'小組賽',\s*'([A-L])'/);
  assert(groupMatch, `group not found in line: ${line}`);
  const group = groupMatch[1];
  const codes = [...line.matchAll(/'([A-Z]{3})'/g)]
    .map(match => match[1])
    .filter(code => codeToGroup[code]);
  assert.strictEqual(codes.length, 2, `expected two team codes in line: ${line}`);
  for (const code of codes) {
    assert.strictEqual(
      group,
      codeToGroup[code],
      `match row should put ${code} in group ${codeToGroup[code]}`
    );
  }
}

console.log('group data consistency tests passed');
