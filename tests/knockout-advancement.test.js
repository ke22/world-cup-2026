// Verifies automatic knockout advancement: finished-match winners (and SF
// losers → 3rd place) propagate into the correct downstream slots, the feed
// tree matches the official FIFA 2026 bracket, and manual locks / draws / TBD
// feeders are handled safely.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const gasCode = fs.readFileSync('Code.gs', 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notStrictEqual(start, -1, `${name} not found`);
  let depth = 0, seen = false;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') { depth++; seen = true; }
    else if (source[i] === '}') { depth--; if (seen && depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error(`${name} not closed`);
}
function load(names) {
  const ctx = { String, Number, Object, Array, isNaN };
  vm.createContext(ctx);
  vm.runInContext(names.map(n => extractFunction(gasCode, n)).join('\n') +
    '\n' + names.map(n => `this.${n}=${n};`).join('\n'), ctx);
  return ctx;
}
const { getKnockoutFeed_, knockoutOutcome_, planKnockoutRowUpdate_ } =
  load(['getKnockoutFeed_', 'knockoutOutcome_', 'planKnockoutRowUpdate_']);

// matches-sheet row layout (0-based): 6/7/8 home code/name/flag,
// 9/10/11 away, 12/13 scores, 14 status, 17 manual lock.
function row(id, opts = {}) {
  const r = new Array(18).fill('');
  r[0] = id;
  r[6] = opts.hc || ''; r[7] = opts.hn || ''; r[8] = opts.hf || '';
  r[9] = opts.ac || ''; r[10] = opts.an || ''; r[11] = opts.af || '';
  r[12] = opts.s1 === undefined ? '' : opts.s1;
  r[13] = opts.s2 === undefined ? '' : opts.s2;
  r[14] = opts.status || 'upcoming';
  r[17] = opts.manual || '';
  return r;
}

// 1. Feed tree matches the official FIFA 2026 bracket topology
{
  const feed = getKnockoutFeed_();
  assert.deepStrictEqual(Object.keys(feed).map(Number).sort((a, b) => a - b),
    [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104],
    'feed covers every downstream knockout match 89-104');

  // R32→R16 (verified by venue)
  const r16 = { 89: [73, 76], 90: [75, 78], 91: [74, 77], 92: [79, 80],
                93: [84, 83], 94: [82, 81], 95: [87, 86], 96: [85, 88] };
  for (const [id, [h, a]] of Object.entries(r16)) {
    assert.strictEqual(feed[id].home.match, h, `R16 ${id} home feeder`);
    assert.strictEqual(feed[id].away.match, a, `R16 ${id} away feeder`);
    assert.strictEqual(feed[id].home.take, 'W');
  }
  // QF/SF/Final winners + 3rd place from SF losers
  assert.deepStrictEqual([feed[97].home.match, feed[97].away.match], [89, 90]);
  assert.deepStrictEqual([feed[101].home.match, feed[101].away.match], [97, 98]);
  assert.deepStrictEqual([feed[104].home.match, feed[104].away.match], [101, 102]);
  assert.strictEqual(feed[103].home.take, 'L');
  assert.strictEqual(feed[103].away.take, 'L');
  assert.deepStrictEqual([feed[103].home.match, feed[103].away.match], [101, 102]);
  console.log('  ✓ feed tree matches official bracket (R32→R16→QF→SF→Final + 3rd)');
}

// 2. knockoutOutcome_ winner/loser detection
{
  const home = row(73, { hc: 'BRA', hn: '巴西', hf: 'F1', ac: 'JPN', an: '日本', af: 'F2', s1: 2, s2: 1, status: 'finished' });
  const oc = knockoutOutcome_(home);
  assert.deepStrictEqual(Array.from(oc.winner), ['BRA', '巴西', 'F1'], 'higher home score wins');
  assert.deepStrictEqual(Array.from(oc.loser), ['JPN', '日本', 'F2'], 'loser captured');

  const awayWin = row(73, { hc: 'BRA', hn: '巴西', hf: 'F1', ac: 'JPN', an: '日本', af: 'F2', s1: 0, s2: 3, status: 'finished' });
  assert.strictEqual(knockoutOutcome_(awayWin).winner[0], 'JPN', 'higher away score wins');

  assert.strictEqual(knockoutOutcome_(row(73, { hc: 'BRA', ac: 'JPN', s1: 1, s2: 1, status: 'finished' })), null, 'level score → null (no penalty data)');
  assert.strictEqual(knockoutOutcome_(row(73, { hc: 'BRA', ac: 'JPN', s1: 2, s2: 1, status: 'live' })), null, 'unfinished → null');
  assert.strictEqual(knockoutOutcome_(row(73, { hc: 'BRA', ac: 'JPN', status: 'finished' })), null, 'missing scores → null');
  assert.strictEqual(knockoutOutcome_(row(89, { hc: '', ac: '', status: 'finished', s1: 2, s2: 1 })), null, 'TBD teams → null');
  console.log('  ✓ knockoutOutcome_ detects winner/loser and guards draws/TBD/unfinished');
}

// 3. planKnockoutRowUpdate_ advances winners; SF losers feed the 3rd-place match
{
  const feed = getKnockoutFeed_();
  const rowById = {
    73: { row: row(73, { hc: 'RSA', hn: '南非', hf: 'fR', ac: 'CAN', an: '加拿大', af: 'fC', s1: 0, s2: 2, status: 'finished' }) },
    76: { row: row(76, { hc: 'NED', hn: '荷蘭', hf: 'fN', ac: 'MAR', an: '摩洛哥', af: 'fM', s1: 3, s2: 1, status: 'finished' }) },
  };
  const r89 = planKnockoutRowUpdate_(row(89), feed[89], rowById);
  assert.deepStrictEqual(Array.from(r89), ['CAN', '加拿大', 'fC', 'NED', '荷蘭', 'fN'],
    'R16 #89 = winner(73)=Canada vs winner(76)=Netherlands');

  // unresolved away feeder → blank triple on that side
  const partial = planKnockoutRowUpdate_(row(89), feed[89], { 73: rowById[73] });
  assert.deepStrictEqual(Array.from(partial), ['CAN', '加拿大', 'fC', '', '', ''], 'missing feeder leaves that side blank');

  // manual lock → null (never auto-overwritten)
  assert.strictEqual(planKnockoutRowUpdate_(row(89, { manual: true }), feed[89], rowById), null, 'manual lock returns null');

  // SF losers → 3rd place
  const sfRows = {
    101: { row: row(101, { hc: 'ARG', hn: '阿根廷', hf: 'fA', ac: 'FRA', an: '法國', af: 'fF', s1: 1, s2: 2, status: 'finished' }) },
    102: { row: row(102, { hc: 'BRA', hn: '巴西', hf: 'fB', ac: 'ESP', an: '西班牙', af: 'fE', s1: 0, s2: 1, status: 'finished' }) },
  };
  const third = planKnockoutRowUpdate_(row(103), feed[103], sfRows);
  assert.deepStrictEqual(Array.from(third), ['ARG', '阿根廷', 'fA', 'BRA', '巴西', 'fB'],
    '3rd place = losers of both semis');
  const fin = planKnockoutRowUpdate_(row(104), feed[104], sfRows);
  assert.deepStrictEqual(Array.from(fin), ['FRA', '法國', 'fF', 'ESP', '西班牙', 'fE'],
    'final = winners of both semis');
  console.log('  ✓ planKnockoutRowUpdate_ advances winners, 3rd-place losers, respects locks');
}

// 4. Multi-level propagation across a full quarter of the bracket
{
  const feed = getKnockoutFeed_();
  const fin = (id, hc, ac, s1, s2) => row(id, { hc, hn: hc, hf: 'f' + hc, ac, an: ac, af: 'f' + ac, s1, s2, status: 'finished' });
  // R32 results feeding R16 #89 (W73, W76) and #90 (W75, W78)
  const rowById = {
    73: { row: fin(73, 'RSA', 'CAN', 0, 2) }, 76: { row: fin(76, 'NED', 'MAR', 3, 1) },
    75: { row: fin(75, 'GER', 'PAR', 2, 0) }, 78: { row: fin(78, 'FRA', 'SWE', 1, 0) },
  };
  // advance R16
  rowById[89] = { row: Object.assign(row(89), { _u: planKnockoutRowUpdate_(row(89), feed[89], rowById) }) };
  const r89cells = planKnockoutRowUpdate_(row(89), feed[89], rowById); // CAN vs NED
  const r90cells = planKnockoutRowUpdate_(row(90), feed[90], rowById); // GER vs FRA
  // play R16: CAN beats NED, GER beats FRA → QF #97 = CAN vs GER
  const r16Rows = {
    89: { row: fin(89, r89cells[0], r89cells[3], 1, 0) },
    90: { row: fin(90, r90cells[0], r90cells[3], 2, 1) },
  };
  const qf = planKnockoutRowUpdate_(row(97), feed[97], r16Rows);
  assert.deepStrictEqual([qf[0], qf[3]], ['CAN', 'GER'], 'QF #97 = winner(89)=CAN vs winner(90)=GER');
  console.log('  ✓ multi-level: R32→R16→QF propagates correctly');
}

console.log('knockout-advancement tests passed');
