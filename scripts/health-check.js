#!/usr/bin/env node
/**
 * WC2026 bracket/match data health check.
 *
 * Two layers:
 *   1. REPO checks  — run every tests/*.test.js (catches code/data drift in Code.gs,
 *      hardcoded seed maps, fixtures). These are fixable + committable in the repo.
 *   2. LIVE checks  — fetch the GAS API and validate match/group/bracket invariants.
 *      Live data lives in the Google Sheet, NOT the repo, so live failures are
 *      reported (not auto-committable) — they need a fix in the Sheet / Apps Script.
 *
 * Exit code: 0 = healthy, 1 = at least one ERROR.
 *
 * Usage:
 *   node scripts/health-check.js            # repo + live
 *   node scripts/health-check.js --no-live  # repo only (offline)
 *   GAS_URL=... node scripts/health-check.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const NO_LIVE = process.argv.includes('--no-live');

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// ---------------------------------------------------------------------------
// GAS URL — read from the bracket HTML so it tracks the real deployment.
// ---------------------------------------------------------------------------
function resolveGasUrl() {
  if (process.env.GAS_URL) return process.env.GAS_URL;
  try {
    const html = fs.readFileSync(path.join(ROOT, 'wc2026-bracket.html'), 'utf8');
    const m = html.match(/const\s+GAS_URL\s*=\s*'([^']+)'/);
    if (m) return m[1];
  } catch (_) { /* fall through */ }
  return null;
}

// ---------------------------------------------------------------------------
// 1. REPO checks — run the test suite.
// ---------------------------------------------------------------------------
function runRepoTests() {
  const dir = path.join(ROOT, 'tests');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();
  } catch (_) {
    warn('tests/ directory not found — skipping repo tests');
    return;
  }
  for (const f of files) {
    try {
      execFileSync('node', [path.join(dir, f)], { stdio: 'pipe', cwd: ROOT });
      console.log(`  PASS  tests/${f}`);
    } catch (e) {
      const out = (e.stderr || e.stdout || Buffer.from('')).toString().trim().split('\n').slice(-4).join('\n  ');
      console.log(`  FAIL  tests/${f}`);
      err(`[repo] test failed: tests/${f}\n  ${out}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. LIVE checks — fetch + validate.
// ---------------------------------------------------------------------------
async function fetchJson(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.status && j.status !== 'ok') throw new Error(`API status=${j.status} ${j.message || ''}`);
  return j;
}

const GROUP_PHASE = '小組賽';

function recomputeStandings(matches) {
  // code -> {group, played,win,draw,loss,gf,ga,gd,pts}
  const t = {};
  const ensure = (code, group) => {
    if (!t[code]) t[code] = { group, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    return t[code];
  };
  for (const m of matches) {
    if (m.phase !== GROUP_PHASE) continue;
    if (m.status !== 'finished') continue;
    const c1 = m.team1 && m.team1.code, c2 = m.team2 && m.team2.code;
    if (!c1 || !c2) continue;
    const s1 = m.score1, s2 = m.score2;
    if (typeof s1 !== 'number' || typeof s2 !== 'number') continue;
    const a = ensure(c1, m.group), b = ensure(c2, m.group);
    a.played++; b.played++;
    a.gf += s1; a.ga += s2; b.gf += s2; b.ga += s1;
    if (s1 > s2) { a.win++; b.loss++; a.pts += 3; }
    else if (s1 < s2) { b.win++; a.loss++; b.pts += 3; }
    else { a.draw++; b.draw++; a.pts++; b.pts++; }
  }
  for (const c of Object.keys(t)) t[c].gd = t[c].gf - t[c].ga;
  return t;
}

function checkStructure(matches) {
  if (matches.length !== 104) err(`[live] expected 104 matches, got ${matches.length}`);
  const ids = new Set();
  for (const m of matches) {
    if (ids.has(m.match_id)) err(`[live] duplicate match_id ${m.match_id}`);
    ids.add(m.match_id);
    if (m.status === 'finished') {
      if (typeof m.score1 !== 'number' || typeof m.score2 !== 'number')
        err(`[live] match ${m.match_id} finished but score missing (${m.score1}-${m.score2})`);
    }
  }
}

function checkStandingsArithmetic(groups) {
  for (const row of groups) {
    const c = row.team && row.team.code;
    if (row.pts !== row.win * 3 + row.draw) err(`[live] ${c} pts ${row.pts} != 3*W+D`);
    if (row.gd !== row.gf - row.ga) err(`[live] ${c} gd ${row.gd} != gf-ga`);
    if (row.played !== row.win + row.draw + row.loss) err(`[live] ${c} played ${row.played} != W+D+L`);
    if (row.played > 3) err(`[live] ${c} played ${row.played} > 3`);
  }
}

function checkGroupsMatchRecompute(groups, recomputed) {
  const FIELDS = ['played', 'win', 'draw', 'loss', 'gf', 'ga', 'gd', 'pts'];
  for (const row of groups) {
    const c = row.team && row.team.code;
    const r = recomputed[c];
    if (!r) {
      if (row.played > 0) err(`[live] ${c} has played=${row.played} in standings but no finished matches found`);
      continue;
    }
    for (const f of FIELDS) {
      if (row[f] !== r[f]) err(`[live] ${c} ${f}: standings=${row[f]} but recomputed=${r[f]}`);
    }
  }
}

function rank(a, b) { return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf; }

function qualifiedTeams(groups) {
  // Returns { top2:Set, thirds:Set(best-8), complete:bool, eliminated:Set }
  const byGroup = {};
  for (const row of groups) (byGroup[row.group] = byGroup[row.group] || []).push(row);
  const top2 = new Set(), eliminated = new Set(), thirdsAll = [];
  let complete = true;
  for (const g of Object.keys(byGroup)) {
    const rows = byGroup[g].slice().sort(rank);
    if (rows.length < 4 || rows.some((r) => r.played < 3)) complete = false;
    rows.forEach((r, i) => {
      const code = r.team && r.team.code;
      if (i < 2) top2.add(code);
      else if (i === 2) thirdsAll.push(r);
      else eliminated.add(code);
    });
  }
  const thirds = new Set(thirdsAll.sort(rank).slice(0, 8).map((r) => r.team && r.team.code));
  return { top2, thirds, complete, eliminated };
}

function checkBracketTeams(matches, groups) {
  const q = qualifiedTeams(groups);
  if (!q.complete) return; // group stage not over — knockout slots still resolving, skip
  const ko = matches.filter((m) => m.phase !== GROUP_PHASE);
  for (const m of ko) {
    for (const team of [m.team1, m.team2]) {
      const code = team && team.code;
      if (!code) continue; // empty slot = TBD, fine
      if (q.eliminated.has(code))
        err(`[live] eliminated team ${code} appears in knockout match ${m.match_id} (${m.phase})`);
      else if (!q.top2.has(code) && !q.thirds.has(code))
        warn(`[live] ${code} in knockout match ${m.match_id} is not top-2 nor a computed best-8 third (check tie-breaks)`);
    }
  }
}

async function runLiveChecks() {
  const base = resolveGasUrl();
  if (!base) { warn('GAS_URL not found — skipping live checks'); return; }
  let matchesResp, groupsResp;
  try {
    matchesResp = await fetchJson(`${base}?action=getMatches&_=${Date.now()}`);
    groupsResp = await fetchJson(`${base}?action=getGroups&_=${Date.now()}`);
  } catch (e) {
    err(`[live] API fetch failed: ${e.message}`);
    return;
  }
  const matches = matchesResp.data || [];
  const groups = groupsResp.data || [];
  console.log(`  fetched ${matches.length} matches, ${groups.length} standings rows (updated ${groupsResp.updated || '?'})`);
  checkStructure(matches);
  checkStandingsArithmetic(groups);
  checkGroupsMatchRecompute(groups, recomputeStandings(matches));
  checkBracketTeams(matches, groups);
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('== WC2026 health check ==', new Date().toISOString());
  console.log('\n[1/2] Repo tests:');
  runRepoTests();
  if (!NO_LIVE) {
    console.log('\n[2/2] Live data:');
    await runLiveChecks();
  } else {
    console.log('\n[2/2] Live data: skipped (--no-live)');
  }

  console.log('\n== Summary ==');
  if (warns.length) { console.log(`WARN (${warns.length}):`); warns.forEach((w) => console.log('  - ' + w)); }
  if (errors.length) {
    console.log(`ERROR (${errors.length}):`); errors.forEach((e) => console.log('  - ' + e));
    console.log('\nRESULT: UNHEALTHY');
    process.exit(1);
  }
  console.log('RESULT: HEALTHY');
  process.exit(0);
}

main().catch((e) => { console.error('health-check crashed:', e); process.exit(2); });
