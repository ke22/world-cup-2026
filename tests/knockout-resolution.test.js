const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

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

function loadFunctions(source, names) {
  const context = {};
  vm.createContext(context);
  const definitions = names.map(name => extractFunction(source, name)).join('\n');
  vm.runInContext(`${definitions}\n${names.map(name => `this.${name} = ${name};`).join('\n')}`, context);
  return context;
}

// ── Task 1.1 / 2.1 / 2.2 / 9.1: rankGroup ────────────────────────
// Decision: 沿用 vm 抽取式 TDD，先測試後實作
const ranking = loadFunctions(gasCode, [
  'compareStanding_', 'compareOverallGroup_', 'getHeadToHeadStats_',
  'rankTiedGroup_', 'rankGroup', 'rankThirds'
]);
const rankGroup = ranking.rankGroup;

// ── Task 7.1: progressively resolve mathematically clinched ranks ──
const progressive = loadFunctions(gasCode, [
  'compareStanding_', 'compareOverallGroup_', 'getHeadToHeadStats_',
  'rankTiedGroup_', 'rankGroup', 'hasFinishedHeadToHeadWin_',
  'resolveClinchedGroupRanks'
]);
const resolveClinchedGroupRanks = progressive.resolveClinchedGroupRanks;

const winnerClinched = [
  { group: 'A', code: 'A1', pts: 7, gd: 5, gf: 6, played: 2 },
  { group: 'A', code: 'A2', pts: 3, gd: 0, gf: 2, played: 2 },
  { group: 'A', code: 'A3', pts: 2, gd: -1, gf: 1, played: 2 },
  { group: 'A', code: 'A4', pts: 1, gd: -4, gf: 1, played: 2 }
];
assert.deepStrictEqual(
  { ...resolveClinchedGroupRanks(winnerClinched) },
  { winner: 'A1', runnerUp: null, third: null },
  'a mathematically clinched winner resolves while uncertain lower ranks stay empty'
);

const completedGroup = [
  { group: 'B', code: 'B4', pts: 0, gd: -5, gf: 1, played: 3 },
  { group: 'B', code: 'B2', pts: 6, gd: 2, gf: 4, played: 3 },
  { group: 'B', code: 'B1', pts: 9, gd: 5, gf: 7, played: 3 },
  { group: 'B', code: 'B3', pts: 3, gd: -2, gf: 2, played: 3 }
];
assert.deepStrictEqual(
  { ...resolveClinchedGroupRanks(completedGroup) },
  { winner: 'B1', runnerUp: 'B2', third: 'B3' },
  'a completed group resolves its final top three positions'
);

const currentGroupA = [
  { group: 'A', code: 'MEX', pts: 6, gd: 3, gf: 3, played: 2 },
  { group: 'A', code: 'KOR', pts: 3, gd: 0, gf: 2, played: 2 },
  { group: 'A', code: 'CZE', pts: 1, gd: -1, gf: 2, played: 2 },
  { group: 'A', code: 'RSA', pts: 1, gd: -2, gf: 1, played: 2 }
];
const currentGroupAMatches = [
  { group: 'A', team1: 'MEX', team2: 'KOR', score1: 1, score2: 0, status: 'finished' }
];
assert.deepStrictEqual(
  { ...resolveClinchedGroupRanks(currentGroupA, currentGroupAMatches) },
  { winner: 'MEX', runnerUp: null, third: null },
  'Mexico is locked as 1A because its only possible six-point rival lost the head-to-head match'
);

// Spec Example: ordering keys (pts → gd → gf)
const groupA = [
  { group: 'A', code: 'A4', pts: 0, gd: -6, gf: 1 },
  { group: 'A', code: 'A2', pts: 4, gd: 1, gf: 4 },
  { group: 'A', code: 'A1', pts: 9, gd: 4, gf: 6 },
  { group: 'A', code: 'A3', pts: 4, gd: 1, gf: 3 }
];
const rankedA = rankGroup(groupA);
assert.deepStrictEqual(
  rankedA.map(t => t.code),
  ['A1', 'A2', 'A3', 'A4'],
  'rankGroup should order by pts → gd → gf (A2 before A3 on gf)'
);
assert.strictEqual(rankedA[0].code, 'A1', 'index 0 is group winner');
assert.strictEqual(rankedA[1].code, 'A2', 'index 1 is runner-up');

// rankGroup must not mutate its input
assert.strictEqual(groupA[0].code, 'A4', 'rankGroup should not mutate input order');

// Deterministic fallback: fully tied → order by code within a group
const tiedGroup = [
  { group: 'B', code: 'BZZ', pts: 3, gd: 0, gf: 2 },
  { group: 'B', code: 'BAA', pts: 3, gd: 0, gf: 2 }
];
assert.deepStrictEqual(
  rankGroup(tiedGroup).map(t => t.code),
  ['BAA', 'BZZ'],
  'fully tied teams break deterministically by code'
);

// FIFA 2026: head-to-head precedes overall goal difference.
const mexicoKorea = [
  { group: 'A', code: 'MEX', pts: 6, gd: -5, gf: 3 },
  { group: 'A', code: 'KOR', pts: 6, gd: 8, gf: 10 },
  { group: 'A', code: 'CZE', pts: 4, gd: 0, gf: 2 },
  { group: 'A', code: 'RSA', pts: 1, gd: -3, gf: 1 }
];
const mexicoKoreaMatches = [
  { team1: 'MEX', team2: 'KOR', score1: 1, score2: 0, status: 'finished' }
];
assert.deepStrictEqual(
  rankGroup(mexicoKorea, mexicoKoreaMatches).map(t => t.code),
  ['MEX', 'KOR', 'CZE', 'RSA'],
  'Mexico ranks above Korea on head-to-head despite worse overall goal difference'
);

// Initial four-team head-to-head separates C and D while A/B remain tied;
// reapplying the criteria to A/B uses their direct match (A beat B).
const recursiveTieTeams = ['A', 'B', 'C', 'D'].map(code => ({
  group: 'X', code, pts: 6, gd: 0, gf: 0
}));
const recursiveTieMatches = [
  ['A', 'B', 1, 0], ['A', 'C', 0, 1], ['A', 'D', 0, 0],
  ['B', 'C', 1, 0], ['B', 'D', 0, 0], ['C', 'D', 3, 0]
].map(([team1, team2, score1, score2]) => ({ team1, team2, score1, score2, status: 'finished' }));
assert.deepStrictEqual(
  rankGroup(recursiveTieTeams, recursiveTieMatches).map(t => t.code),
  ['C', 'A', 'B', 'D'],
  'head-to-head criteria are reapplied to a remaining tied subset'
);

// ── Task 2.3: rankThirds ─────────────────────────────────────────
const rankThirds = ranking.rankThirds;

// 12 third-placed teams with distinct points L(12) … A(1) descending
const groups12 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const thirds = groups12.map((g, i) => ({
  group: g, code: g + '3', pts: i + 1, gd: 0, gf: 0
}));
const rankedThirds = rankThirds(thirds);
assert.strictEqual(rankedThirds.length, 12, 'rankThirds returns all teams sorted');
const top8 = rankedThirds.slice(0, 8).map(t => t.group);
assert.deepStrictEqual(
  top8,
  ['L', 'K', 'J', 'I', 'H', 'G', 'F', 'E'],
  'top eight thirds are the highest-scoring groups'
);
const eliminated = rankedThirds.slice(8).map(t => t.group);
assert.deepStrictEqual(
  eliminated,
  ['D', 'C', 'B', 'A'],
  'lowest four thirds are eliminated'
);

// Cross-group tiebreak: equal pts/gd/gf → order by group letter
const tiedThirds = [
  { group: 'H', code: 'H3', pts: 4, gd: 1, gf: 3 },
  { group: 'C', code: 'C3', pts: 4, gd: 1, gf: 3 }
];
assert.deepStrictEqual(
  rankThirds(tiedThirds).map(t => t.group),
  ['C', 'H'],
  'tied thirds break deterministically by group letter'
);

// ── Task 4.1: R32_SEED_MAP ───────────────────────────────────────
const seeds = loadFunctions(gasCode, ['getR32SeedMap']);
const seedMap = seeds.getR32SeedMap();
// Note: arrays returned from the vm context have a different Array
// prototype than the host, so compare by value (join) not deepStrictEqual.
for (let id = 73; id <= 88; id++) {
  assert.ok(Array.isArray(seedMap[id]) && seedMap[id].length === 2,
    `match ${id} has exactly two seed codes`);
}
assert.strictEqual(seedMap[73].join('|'), '2A|2B', 'match 73 seed codes');
assert.strictEqual(seedMap[74].join('|'), '1C|2F', 'match 74 seed codes');
assert.strictEqual(seedMap[88].join('|'), '1K|3 DEIJL', 'match 88 seed codes');

// ── Task 4.3: isGroupStageComplete ───────────────────────────────
const gate = loadFunctions(gasCode, ['isGroupStageComplete']);
const isGroupStageComplete = gate.isGroupStageComplete;

const allFinished = [
  { phase: '小組賽', status: 'finished' },
  { phase: '小組賽', status: 'finished' },
  { phase: '16強', status: 'upcoming' }
];
assert.strictEqual(isGroupStageComplete(allFinished), true,
  'all group matches finished → true');

const onePending = [
  { phase: '小組賽', status: 'finished' },
  { phase: '小組賽', status: 'live' }
];
assert.strictEqual(isGroupStageComplete(onePending), false,
  'any unfinished group match → false');

assert.strictEqual(isGroupStageComplete([]), false,
  'no group matches → false (not vacuously complete)');

// ── Task 3.1 / 3.2: assignThirds (best-third allocation table) ────
// Decision: seed 對照表與最佳第三名分配表移入後端作為單一事實來源
const alloc = loadFunctions(gasCode, ['getThirdPlaceAllocation', 'assignThirds']);
const assignThirds = alloc.assignThirds;

// Table has all C(12,8) = 495 combinations.
assert.strictEqual(Object.keys(alloc.getThirdPlaceAllocation()).length, 495,
  'allocation table covers all 495 combinations');

// Known combination (FIFA Annex C, option 1): thirds E,F,G,H,I,J,K,L
// → slots [1A,1B,1D,1E,1G,1I,1K,1L] = E,J,I,F,H,G,L,K
const r1 = assignThirds(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
assert.deepStrictEqual(
  { ...r1 },
  { '1A': 'E', '1B': 'J', '1D': 'I', '1E': 'F', '1G': 'H', '1I': 'G', '1K': 'L', '1L': 'K' },
  'option 1 combination resolves to the official slot assignment'
);

// Known combination (FIFA Annex C, option 495): thirds A,B,C,D,E,F,G,H
// → slots [1A,1B,1D,1E,1G,1I,1K,1L] = H,G,B,C,A,F,D,E
const r495 = assignThirds(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
assert.deepStrictEqual(
  { ...r495 },
  { '1A': 'H', '1B': 'G', '1D': 'B', '1E': 'C', '1G': 'A', '1I': 'F', '1K': 'D', '1L': 'E' },
  'option 495 combination resolves to the official slot assignment'
);

// Input order independence: same set, different order → same result
assert.deepStrictEqual({ ...assignThirds(['L', 'K', 'J', 'I', 'H', 'G', 'F', 'E']) }, { ...r1 },
  'allocation is independent of input order');

// Each assigned third must come from that slot's allowed set (seed code)
const allowed = { '1A': 'CEFHI', '1B': 'EFGIJ', '1D': 'BEFIJ', '1E': 'ABCDF', '1G': 'AEHIJ', '1I': 'CDFGH', '1K': 'DEIJL', '1L': 'EHIJK' };
Object.keys(allowed).forEach(slot => {
  assert.ok(allowed[slot].includes(r1[slot]),
    `slot ${slot} third 3${r1[slot]} must be in allowed set ${allowed[slot]}`);
});

// Invalid input → null
assert.strictEqual(assignThirds(['A', 'B', 'C', 'D', 'E', 'F', 'G']), null,
  'fewer than 8 groups → null');
assert.strictEqual(assignThirds('not-an-array'), null, 'non-array → null');
assert.strictEqual(assignThirds(['A', 'A', 'B', 'C', 'D', 'E', 'F', 'G']), null,
  'duplicate groups (unknown combination) → null');

// ── Task 4.2: resolveR32 (orchestrator) ──────────────────────────
// Decision: 後端純函式解析器取代 football-data 淘汰賽鏡射
const resolver = loadFunctions(gasCode, [
  'compareStanding_', 'compareOverallGroup_', 'getHeadToHeadStats_',
  'rankTiedGroup_', 'rankGroup', 'rankThirds', 'hasFinishedHeadToHeadWin_',
  'resolveClinchedGroupRanks',
  'getThirdPlaceAllocation', 'assignThirds', 'getR32SeedMap', 'resolveR32'
]);
const resolveR32 = resolver.resolveR32;

// Build standings for all 12 groups: every group X has X1>X2>X3>X4.
// All third-placed teams are equal (pts 3), so the best-eight tiebreak
// by group letter selects A–H → combination 'ABCDEFGH' → 'HGBCAFDE'.
const standings = [];
groups12.forEach(g => {
  [['1', 9], ['2', 6], ['3', 3], ['4', 0]].forEach(([rank, pts]) => {
    standings.push({ group: g, code: g + rank, pts, gd: 0, gf: 0 });
  });
});

const r32 = resolveR32(standings);

// slot→group for combination ABCDEFGH: 1A=H,1B=G,1D=B,1E=C,1G=A,1I=F,1K=D,1L=E
// Seed→match-id verified against the official FIFA 2026 bracket (by venue).
const expected = {
  73: { home: 'A2', away: 'B2' },
  74: { home: 'C1', away: 'F2' },
  75: { home: 'E1', away: 'C3' }, // 1E vs 3rd (slot 1E → C)
  76: { home: 'F1', away: 'C2' },
  77: { home: 'E2', away: 'I2' },
  78: { home: 'I1', away: 'F3' }, // slot 1I → F
  79: { home: 'A1', away: 'H3' }, // slot 1A → H
  80: { home: 'L1', away: 'E3' }, // slot 1L → E
  81: { home: 'G1', away: 'A3' }, // slot 1G → A
  82: { home: 'D1', away: 'B3' }, // slot 1D → B
  83: { home: 'H1', away: 'J2' },
  84: { home: 'K2', away: 'L2' },
  85: { home: 'B1', away: 'G3' }, // slot 1B → G
  86: { home: 'D2', away: 'G2' },
  87: { home: 'J1', away: 'H2' },
  88: { home: 'K1', away: 'D3' } // slot 1K → D
};

for (let id = 73; id <= 88; id++) {
  assert.strictEqual(r32[id].home, expected[id].home, `match ${id} home`);
  assert.strictEqual(r32[id].away, expected[id].away, `match ${id} away`);
}

// Incomplete standings: only two entries per group cannot prove exact ranks.
const partial = standings.filter(t => t.code.endsWith('1') || t.code.endsWith('2'));
const r32partial = resolveR32(partial);
assert.strictEqual(r32partial[73].home, null, 'incomplete group data does not resolve a rank');
assert.strictEqual(r32partial[80].away, null, 'third slot is null when thirds unavailable');

// Progressive resolution: group A winner is uncatchable after two matches,
// but runner-up remains uncertain. Other groups are also still undecided.
const progressiveStandings = [];
groups12.forEach(g => {
  const rows = g === 'A' ? winnerClinched : [
    { code: g + '1', pts: 4, gd: 1, gf: 3, played: 2 },
    { code: g + '2', pts: 4, gd: 1, gf: 2, played: 2 },
    { code: g + '3', pts: 1, gd: -1, gf: 1, played: 2 },
    { code: g + '4', pts: 1, gd: -1, gf: 0, played: 2 }
  ];
  rows.forEach(t => progressiveStandings.push({ ...t, group: g }));
});
const progressiveR32 = resolveR32(progressiveStandings);
assert.strictEqual(progressiveR32[79].home, 'A1', 'clinched 1A resolves before all groups finish');
assert.strictEqual(progressiveR32[73].home, null, 'uncertain 2A remains unresolved');
assert.strictEqual(progressiveR32[80].away, null, 'third-place slots remain unresolved during group play');

const googleAlignedR32 = resolveR32(currentGroupA, currentGroupAMatches);
assert.strictEqual(googleAlignedR32[79].home, 'MEX', 'current Group A resolves Mexico into the 1A bracket slot');
assert.strictEqual(googleAlignedR32[73].home, null, '2A remains empty while the runner-up is uncertain');

// ── Task 7.2: automatic rows recalculate; manual rows remain untouched ──
const rowPlanner = loadFunctions(gasCode, ['planR32RowUpdate_']);
const planR32RowUpdate = rowPlanner.planR32RowUpdate_;
const sheetMatchBuilder = loadFunctions(gasCode, ['buildGroupMatchResults_']);
const buildGroupMatchResults = sheetMatchBuilder.buildGroupMatchResults_;
const meta = {
  A1: { name: 'Alpha', flag: '🇦🇦' },
  B1: { name: 'Bravo', flag: '🇧🇧' }
};
const unlockedRow = Array(18).fill('');
unlockedRow[6] = 'OLD';
unlockedRow[7] = 'Old team';
unlockedRow[9] = 'STALE';
assert.deepStrictEqual(
  Array.from(planR32RowUpdate(unlockedRow, { home: 'A1', away: null }, meta)),
  ['A1', 'Alpha', '🇦🇦', '', '', ''],
  'an unlocked row updates a resolved side and clears an unresolved stale side'
);
const lockedRow = unlockedRow.slice();
lockedRow[17] = true;
assert.strictEqual(
  planR32RowUpdate(lockedRow, { home: 'B1', away: null }, meta),
  null,
  'a manually locked row produces no automatic update'
);

// Task 9.3 integration fixture: Sheet row → head-to-head result → R32 row plan.
const mexKorSheetRow = Array(18).fill('');
mexKorSheetRow[0] = 28;
mexKorSheetRow[3] = '小組賽';
mexKorSheetRow[4] = 'A';
mexKorSheetRow[6] = 'MEX';
mexKorSheetRow[9] = 'KOR';
mexKorSheetRow[12] = 1;
mexKorSheetRow[13] = 0;
mexKorSheetRow[14] = 'finished';
const builtGroupMatches = buildGroupMatchResults([mexKorSheetRow]);
assert.deepStrictEqual(
  { ...builtGroupMatches[0] },
  { group: 'A', team1: 'MEX', team2: 'KOR', score1: 1, score2: 0, status: 'finished' },
  'syncBracket extracts the completed head-to-head result from matches rows'
);
const integratedR32 = resolveR32(currentGroupA, builtGroupMatches);
const match79Row = Array(18).fill('');
match79Row[0] = 79;
assert.deepStrictEqual(
  Array.from(planR32RowUpdate(match79Row, integratedR32[79], { MEX: { name: '墨西哥', flag: '🇲🇽' } })),
  ['MEX', '墨西哥', '🇲🇽', '', '', ''],
  'match 79 receives Mexico from the Sheet-derived head-to-head fixture'
);
match79Row[17] = true;
assert.strictEqual(planR32RowUpdate(match79Row, integratedR32[79], meta), null,
  'the integrated update still preserves a manually locked match 79 row');

console.log('knockout-resolution tests passed');
