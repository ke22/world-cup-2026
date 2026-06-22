// ── 部署時修改這裡 ───────────────────────────
const SHEET_ID = '1YDuNRBGTx5Jw3kZBYehlYUW4eIFPClDIC91TR_720js';
const SCORE_EDITOR_SHEET = '比分編輯';
const TEAM_NAME_ALIASES = {
  '庫拉索': '古拉索',
  '剛果': '民主剛果',
  '波士尼亞': '波赫'
};
const TEAM_FLAGS_BY_CODE = {
  ENG: String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f),
  SCO: String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0073, 0xe0063, 0xe0074, 0xe007f)
};
// ────────────────────────────────────────────

// ── Custom Menu ───────────────────────────────

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⚽ WC2026')
      .addItem('Update Score…', 'showUpdateScoreDialog')
      .addItem('Clear Manual Override…', 'showClearOverrideDialog')
      .addSeparator()
      .addItem('建立/刷新比分編輯分頁', 'refreshScoreEditorSheet')
      .addItem('套用比分編輯分頁', 'applyScoreEditorSheet')
      .addItem('統一中文譯名', 'normalizeTeamNamesInSheets')
      .addSeparator()
      .addItem('Recalc Group Standings', 'recalcGroups')
      .addItem('Sync Bracket (Knockout Teams)', 'syncBracket')
      .addItem('Setup Sheet Validation', 'setupSheetValidation')
      .addToUi();
  } catch (err) {
    Logger.log('onOpen skipped outside spreadsheet UI: ' + err.message);
  }
}

function setupScoreEditor() {
  normalizeTeamNamesInSheets(false);
  refreshScoreEditorSheet(false);
  Logger.log('比分編輯分頁已建立/刷新。請回 Google Sheet 重新整理頁面查看選單。');
}

function showUpdateScoreDialog() {
  const ui = SpreadsheetApp.getUi();
  const idResp = ui.prompt('Update Score', 'Match ID (number):', ui.ButtonSet.OK_CANCEL);
  if (idResp.getSelectedButton() !== ui.Button.OK) return;
  const matchId = Number(idResp.getResponseText().trim());
  if (!matchId) { ui.alert('Invalid match ID.'); return; }

  const scoreResp = ui.prompt('Update Score', 'Score for match ' + matchId + '\nFormat: home-away  (e.g. 2-1):', ui.ButtonSet.OK_CANCEL);
  if (scoreResp.getSelectedButton() !== ui.Button.OK) return;
  const parts = scoreResp.getResponseText().split('-');
  if (parts.length !== 2) { ui.alert('Invalid format — use e.g. 2-1'); return; }
  const score1 = Number(parts[0].trim());
  const score2 = Number(parts[1].trim());
  if (isNaN(score1) || isNaN(score2)) { ui.alert('Scores must be numbers.'); return; }

  const ok = manualSetScore(matchId, score1, score2);
  if (ok) ui.alert('Match ' + matchId + ' set to ' + score1 + '–' + score2 + ' ✓');
  else    ui.alert('Match ID ' + matchId + ' not found.');
}

function showClearOverrideDialog() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Clear Manual Override', 'Match ID to unlock (API sync will resume):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const matchId = Number(resp.getResponseText().trim());
  if (!matchId) { ui.alert('Invalid match ID.'); return; }
  const ok = clearManualOverride(matchId);
  if (ok) ui.alert('Match ' + matchId + ' unlocked — will sync from API next run.');
  else    ui.alert('Match ID ' + matchId + ' not found.');
}

function manualSetScore(matchId, score1, score2) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
  const rows = sheet.getDataRange().getValues();
  const i = rows.findIndex((r, idx) => idx > 0 && Number(r[0]) === matchId);
  if (i < 0) return false;
  sheet.getRange(i + 1, 13, 1, 3).setValues([[score1, score2, 'finished']]);
  sheet.getRange(i + 1, 18).setValue(true);
  recalcGroups();
  touchDataVersion();
  Logger.log('manualSetScore: match ' + matchId + ' → ' + score1 + '-' + score2);
  return true;
}

function clearManualOverride(matchId) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
  const rows = sheet.getDataRange().getValues();
  const i = rows.findIndex((r, idx) => idx > 0 && Number(r[0]) === matchId);
  if (i < 0) return false;
  sheet.getRange(i + 1, 18).setValue('');
  touchDataVersion();
  Logger.log('clearManualOverride: match ' + matchId + ' unlocked');
  return true;
}

function clearAllScores() {
  const ss     = SpreadsheetApp.openById(SHEET_ID);
  const sheet  = ss.getSheetByName('matches');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert('No data rows found.'); return; }

  const numRows = lastRow - 1;
  // Col M (score_home) + N (score_away) → blank; Col O (status) → 'upcoming'; Col R (manual) → blank
  sheet.getRange(2, 13, numRows, 2).clearContent();                        // score_home, score_away
  sheet.getRange(2, 15, numRows, 1).setValue('upcoming');                   // status
  sheet.getRange(2, 18, numRows, 1).clearContent();                         // manual lock

  recalcGroups(); // resets group standings to all-zero
  touchDataVersion();
  SpreadsheetApp.getUi().alert('Done — all scores cleared, standings reset to 0.');
}

function normalizeTeamNamesInSheets(showAlert) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const matches = ss.getSheetByName('matches');
  const groups = ss.getSheetByName('groups');
  let changed = 0;

  if (matches && matches.getLastRow() > 1) {
    const lastRow = matches.getLastRow();
    const teams = matches.getRange(2, 7, lastRow - 1, 6).getValues();
    teams.forEach(row => {
      const homeName = normalizeTeamName_(row[1]);
      const homeFlag = normalizeTeamFlag_(row[0], row[2]);
      const awayName = normalizeTeamName_(row[4]);
      const awayFlag = normalizeTeamFlag_(row[3], row[5]);
      if (homeName !== row[1]) { row[1] = homeName; changed++; }
      if (homeFlag !== row[2]) { row[2] = homeFlag; changed++; }
      if (awayName !== row[4]) { row[4] = awayName; changed++; }
      if (awayFlag !== row[5]) { row[5] = awayFlag; changed++; }
    });
    matches.getRange(2, 7, lastRow - 1, 6).setValues(teams);
  }

  if (groups && groups.getLastRow() > 1) {
    const lastRow = groups.getLastRow();
    const teams = groups.getRange(2, 2, lastRow - 1, 3).getValues();
    teams.forEach(row => {
      const name = normalizeTeamName_(row[1]);
      const flag = normalizeTeamFlag_(row[0], row[2]);
      if (name !== row[1]) { row[1] = name; changed++; }
      if (flag !== row[2]) { row[2] = flag; changed++; }
    });
    groups.getRange(2, 2, lastRow - 1, 3).setValues(teams);
  }

  if (changed > 0) {
    touchDataVersion();
    try { refreshScoreEditorSheet(false); } catch (_) {}
  }

  if (showAlert !== false) {
    try { SpreadsheetApp.getUi().alert(`中文譯名已統一，更新 ${changed} 個儲存格。`); } catch (_) {}
  }
}

function normalizeTeamName_(name) {
  const raw = String(name || '').trim();
  return TEAM_NAME_ALIASES[raw] || raw;
}

function normalizeTeamFlag_(code, flag) {
  return TEAM_FLAGS_BY_CODE[String(code || '')] || String(flag || '');
}

function setupSheetValidation() {
  setupHeaders(); // ensure headers exist before applying validation

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
  const lastRow = Math.max(sheet.getLastRow(), 2);

  // Col O (status): dropdown
  sheet.getRange(2, 15, lastRow - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['upcoming', 'live', 'finished'], true)
      .setAllowInvalid(false)
      .build()
  );

  // Col R (manual): checkbox
  sheet.getRange(2, 18, lastRow - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build()
  );

  Logger.log('Sheet validation set up ✓');
  try { SpreadsheetApp.getUi().alert('Sheet validation set up ✓'); } catch (_) {}
}

function setupHeaders() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  ss.getSheetByName('matches').getRange(1, 1, 1, 18).setValues([[
    'match_id', 'date', 'time_utc8', 'phase', 'group', 'round',
    'home_code', 'home_name', 'home_flag',
    'away_code', 'away_name', 'away_flag',
    'score_home', 'score_away', 'status',
    'venue', 'city', 'manual'
  ]]);

  ss.getSheetByName('groups').getRange(1, 1, 1, 12).setValues([[
    'group', 'team_code', 'team_name', 'team_flag',
    'played', 'win', 'draw', 'loss',
    'gf', 'ga', 'gd', 'pts'
  ]]);
}
// ─────────────────────────────────────────────

// ── Score editor sheet ───────────────────────
// Editors use this simplified sheet instead of touching the 18-column matches tab.
// "主隊", "客隊", "比分" and "狀態" are applied back to matches.

function refreshScoreEditorSheet(showAlert) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const source = ss.getSheetByName('matches');
  if (!source) throw new Error('matches sheet not found');
  const teamRows = getEditorTeamRows_(ss);
  const teamNames = teamRows.map(t => t.name);

  let editor = ss.getSheetByName(SCORE_EDITOR_SHEET);
  if (!editor) editor = ss.insertSheet(SCORE_EDITOR_SHEET);
  const existingFilter = editor.getFilter();
  if (existingFilter) existingFilter.remove();
  const helperSheetName = '_比分編輯隊伍';
  let helper = ss.getSheetByName(helperSheetName);
  if (!helper) {
    helper = ss.insertSheet(helperSheetName);
    helper.hideSheet();
  }
  helper.clear();
  if (teamNames.length) helper.getRange(1, 1, teamNames.length, 1).setValues(teamNames.map(name => [name]));

  const rows = source.getDataRange().getValues();
  rows.shift();

  const values = [[
    'match_id', '日期', '時間', '階段', '組別',
    '主隊', '客隊', '比分', '狀態', '場館', '城市', '備註'
  ]];

  rows
    .filter(r => r[0] !== '' && r[0] !== null)
    .forEach(r => {
      const score = toEditorScore_(r[12], r[13]);
      values.push([
        Number(r[0]),
        formatDate(r[1]),
        formatTime(r[2]),
        String(r[3] || ''),
        String(r[4] || ''),
        String(r[7] || ''),
        String(r[10] || ''),
        score,
        toEditorStatus_(r[14]),
        String(r[15] || ''),
        String(r[16] || ''),
        ''
      ]);
    });

  editor.getRange(1, 1, editor.getMaxRows(), editor.getMaxColumns()).clearDataValidations();
  editor.clear({ contentsOnly: false });
  editor.getRange(1, 1, values.length, values[0].length).setValues(values);

  editor.setFrozenRows(1);
  editor.hideColumns(1);
  const dataRows = Math.max(values.length - 1, 1);
  editor.getRange(1, 1, 1, values[0].length)
    .setFontWeight('bold')
    .setBackground('#0f4b8f')
    .setFontColor('#ffffff');
  editor.getRange(2, 2, dataRows, 1).setNumberFormat('yyyy-mm-dd');
  editor.getRange(2, 6, dataRows, 4).setBackground('#fff8d6');
  if (teamNames.length) {
    editor.getRange(2, 6, dataRows, 2).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInRange(helper.getRange(1, 1, teamNames.length, 1), true)
        .setAllowInvalid(true)
        .build()
    );
  }
  editor.getRange(2, 8, dataRows, 1)
    .setNumberFormat('@')
    .setNotes(
    Array.from({ length: dataRows }, () => ['填寫格式：2-1。留空表示沒有比分。'])
  );
  editor.getRange(2, 9, dataRows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['未開賽', '進行中', '已結束'], true)
      .setAllowInvalid(false)
      .build()
  );
  editor.getRange(1, 1, values.length, values[0].length).createFilter();
  editor.autoResizeColumns(2, values[0].length - 1);
  editor.setColumnWidth(6, 220);
  editor.setColumnWidth(7, 220);
  editor.setColumnWidth(8, 80);
  editor.setColumnWidth(12, 180);

  if (showAlert !== false) {
    try {
      SpreadsheetApp.getUi().alert('比分編輯分頁已刷新。黃色欄位「主隊 / 客隊 / 比分 / 狀態」可編輯，再執行「套用比分編輯分頁」。');
    } catch (_) {}
  }
}

function applyScoreEditorSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const editor = ss.getSheetByName(SCORE_EDITOR_SHEET);
  const matches = ss.getSheetByName('matches');
  if (!editor) throw new Error('請先建立「比分編輯」分頁');
  if (!matches) throw new Error('matches sheet not found');

  const editorRange = editor.getDataRange();
  const editorRows = editorRange.getValues();
  const editorDisplayRows = editorRange.getDisplayValues();
  if (editorRows.length < 2) {
    try { SpreadsheetApp.getUi().alert('比分編輯分頁沒有資料。'); } catch (_) {}
    return;
  }

  const matchRows = matches.getDataRange().getValues();
  const teamByName = getEditorTeamMap_(ss);
  const rowById = {};
  matchRows.forEach((r, idx) => {
    if (idx > 0 && r[0] !== '' && r[0] !== null) rowById[Number(r[0])] = idx + 1;
  });

  const errors = [];
  let changed = 0;

  editorRows.slice(1).forEach((r, idx) => {
    const displayRow = editorDisplayRows[idx + 1];
    const editorRowNum = idx + 2;
    const matchId = Number(r[0]);
    if (!matchId) return;

    const targetRow = rowById[matchId];
    if (!targetRow) {
      errors.push(`第 ${editorRowNum} 列：match_id ${matchId} 不存在`);
      return;
    }

    const homeTeam = parseEditorTeam_(displayRow[5], teamByName, editorRowNum, '主隊');
    if (homeTeam.error) {
      errors.push(homeTeam.error);
      return;
    }

    const awayTeam = parseEditorTeam_(displayRow[6], teamByName, editorRowNum, '客隊');
    if (awayTeam.error) {
      errors.push(awayTeam.error);
      return;
    }

    const parsedScore = parseEditorScore_(r[7], editorRowNum, displayRow[7]);
    if (parsedScore.error) {
      errors.push(parsedScore.error);
      return;
    }

    const status = parseEditorStatus_(displayRow[8], editorRowNum);
    if (status.error) {
      errors.push(status.error);
      return;
    }

    const currentTeams = matches.getRange(targetRow, 7, 1, 6).getValues()[0];
    const currentResult = matches.getRange(targetRow, 13, 1, 6).getValues()[0];
    const nextTeams = [
      homeTeam.code, homeTeam.name, homeTeam.flag,
      awayTeam.code, awayTeam.name, awayTeam.flag
    ];
    const nextScoreHome = parsedScore.blank ? '' : parsedScore.home;
    const nextScoreAway = parsedScore.blank ? '' : parsedScore.away;
    const nextStatus = status.value;
    const nextManual = !(parsedScore.blank && nextStatus === 'upcoming');

    const same =
      currentTeams.every((v, i) => String(v || '') === String(nextTeams[i] || '')) &&
      String(currentResult[0]) === String(nextScoreHome) &&
      String(currentResult[1]) === String(nextScoreAway) &&
      String(currentResult[2] || 'upcoming') === nextStatus &&
      Boolean(currentResult[5]) === nextManual;

    if (same) return;

    matches.getRange(targetRow, 7, 1, 6).setValues([nextTeams]);
    matches.getRange(targetRow, 13, 1, 3).setValues([[nextScoreHome, nextScoreAway, nextStatus]]);
    matches.getRange(targetRow, 18).setValue(nextManual);
    changed++;
  });

  if (errors.length) {
    SpreadsheetApp.getUi().alert('套用失敗，請修正後再試：\n\n' + errors.slice(0, 20).join('\n'));
    return;
  }

  if (changed > 0) {
    recalcGroups();
    touchDataVersion();
    refreshScoreEditorSheet(false);
  }

  try {
    SpreadsheetApp.getUi().alert(`已套用 ${changed} 場比賽。${changed ? '前台資料已更新。' : '沒有偵測到變更。'}`);
  } catch (_) {}
}

function getEditorTeamRows_(ss) {
  const groups = ss.getSheetByName('groups');
  if (!groups) return [];
  const rows = groups.getDataRange().getValues();
  rows.shift();
  return rows
    .filter(r => r[1] && r[2])
    .map(r => ({ code: String(r[1]), name: normalizeTeamName_(r[2]), flag: String(r[3] || '') }));
}

function getEditorTeamMap_(ss) {
  const map = {};
  getEditorTeamRows_(ss).forEach(t => {
    map[t.name] = t;
    map[t.code] = t;
    if (t.flag) map[`${t.flag} ${t.name}`] = t;
  });
  return map;
}

function parseEditorTeam_(value, teamByName, rowNum, label) {
  const raw = String(value || '').trim();
  if (!raw || raw === '待定') return { code: '', name: '', flag: '' };
  const team = teamByName[raw];
  if (!team) return { error: `第 ${rowNum} 列：${label}「${raw}」不在 groups 隊伍清單內` };
  return team;
}

function toEditorScore_(home, away) {
  if (home === '' || home === null || home === undefined || away === '' || away === null || away === undefined) return '';
  return `${Number(home)}-${Number(away)}`;
}

function toEditorStatus_(status) {
  const map = { upcoming: '未開賽', live: '進行中', finished: '已結束' };
  return map[String(status || 'upcoming')] || '未開賽';
}

function parseEditorStatus_(value, rowNum) {
  const raw = String(value || '').trim();
  const map = {
    '未開賽': 'upcoming',
    '進行中': 'live',
    '已結束': 'finished',
    upcoming: 'upcoming',
    live: 'live',
    finished: 'finished'
  };
  const status = map[raw] || (raw ? null : 'upcoming');
  if (!status) return { error: `第 ${rowNum} 列：狀態只能填「未開賽 / 進行中 / 已結束」` };
  return { value: status };
}

function parseEditorScore_(value, rowNum, displayValue) {
  if (value instanceof Date) {
    return { blank: false, home: value.getMonth() + 1, away: value.getDate() };
  }

  const raw = String(displayValue || value || '').trim();
  if (!raw) return { blank: true };
  const match = raw.match(/^(\d+)\s*[-:：/／]\s*(\d+)$/);
  if (!match) return { error: `第 ${rowNum} 列：比分格式請填 2-1` };
  return { blank: false, home: Number(match[1]), away: Number(match[2]) };
}
// ─────────────────────────────────────────────

// ── Auto Score Sync (football-data.org) ──────
// Step 1: run setApiKey() once from the Apps Script editor to store your key.
// Step 2: run setupSyncTrigger() to auto-sync every 10 minutes.

function setApiKey() {
  const key = SpreadsheetApp.getUi().prompt('Enter football-data.org API key:').getResponseText().trim();
  if (!key) return;
  PropertiesService.getScriptProperties().setProperty('FD_API_KEY', key);
  SpreadsheetApp.getUi().alert('API key saved.');
}

// Our team codes → football-data.org TLA (only list differences)
const CODE_MAP = {
  HAI: 'HTI',  // Haiti
  CGO: 'COD',  // DR Congo
  SCO: 'SCO',  // Scotland (same, listed for clarity)
};
function fdCode(c) { return CODE_MAP[c] || c; }

function footballDataStatusToMatchStatus_(status) {
  switch (String(status || '').toUpperCase()) {
    case 'FINISHED':
      return 'finished';
    case 'IN_PLAY':
    case 'PAUSED':
    case 'LIVE':
      return 'live';
    default:
      return 'upcoming';
  }
}

function getFootballDataFullTimeScore_(match) {
  const s = match && match.score && match.score.fullTime;
  if (!s) return { home: null, away: null };
  return {
    home: s.home === null || s.home === undefined ? null : Number(s.home),
    away: s.away === null || s.away === undefined ? null : Number(s.away)
  };
}

function shouldSyncFootballDataMatch_(match) {
  const status = footballDataStatusToMatchStatus_(match && match.status);
  const score = getFootballDataFullTimeScore_(match);
  return status === 'live' || status === 'finished' || score.home !== null || score.away !== null;
}

// Convert UTC ISO string to YYYY-MM-DD in UTC+8
function utcToDate8(utcStr) {
  const d = new Date(new Date(utcStr).getTime() + 8 * 3600000);
  return d.toISOString().slice(0, 10);
}

function syncScores() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('FD_API_KEY');
  if (!apiKey) { Logger.log('No API key — run setApiKey() first.'); return; }

  const resp = UrlFetchApp.fetch(
    'https://api.football-data.org/v4/competitions/WC/matches',
    { headers: { 'X-Auth-Token': apiKey }, muteHttpExceptions: true }
  );

  if (resp.getResponseCode() !== 200) {
    Logger.log('API error ' + resp.getResponseCode() + ': ' + resp.getContentText());
    return;
  }

  const apiMatches = JSON.parse(resp.getContentText()).matches;

  // Lookup by "T1_T2" — each pair plays at most once in WC group stage
  const byTeams = {};
  // Also by "YYYY-MM-DD_T1_T2" (UTC+8) for robustness
  const byDateTeams = {};
  apiMatches.forEach(m => {
    const t1 = m.homeTeam.tla;
    const t2 = m.awayTeam.tla;
    const d8 = utcToDate8(m.utcDate);
    byTeams[`${t1}_${t2}`] = m;
    byDateTeams[`${d8}_${t1}_${t2}`] = m;
  });

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('matches');
  const rows = sheet.getDataRange().getValues();

  let updated = 0;
  rows.slice(1).forEach((row, i) => {
    if (!row[0] || !row[6]) return; // skip empty or knockout TBD rows
    if (row[17] === true) return;   // col R manual lock — don't overwrite
    const t1 = fdCode(String(row[6]));
    const t2 = fdCode(String(row[9]));
    const date = formatDate(row[1]);
    const m = byDateTeams[`${date}_${t1}_${t2}`] || byTeams[`${t1}_${t2}`];
    if (!m) return;

    const status = footballDataStatusToMatchStatus_(m.status);
    if (!shouldSyncFootballDataMatch_(m)) return;

    const s = getFootballDataFullTimeScore_(m);
    const scoreHome = s.home === null ? row[12] : s.home;
    const scoreAway = s.away === null ? row[13] : s.away;

    sheet.getRange(i + 2, 13, 1, 3).setValues([[scoreHome, scoreAway, status]]);
    updated++;
  });

  Logger.log(`syncScores: ${updated} matches updated`);
  if (updated > 0) {
    recalcGroups();
    try { refreshScoreEditorSheet(false); } catch (err) { Logger.log('refreshScoreEditorSheet skipped: ' + err.message); }
    touchDataVersion();
  }
  syncBracket(); // also fill in knockout teams when bracket is set
}

// ── syncBracket ───────────────────────────────
// Fills in the Round-of-32 team slots (match_id 73–88) by resolving them
// from the local group standings + the official seed/allocation tables —
// no longer dependent on football-data.org for knockout teams. Runs
// automatically at the end of syncScores().

function syncBracket() {
  const ss     = SpreadsheetApp.openById(SHEET_ID);
  const mSheet = ss.getSheetByName('matches');
  const rows   = mSheet.getDataRange().getValues();

  // Standings + team metadata (name/flag by code) from the groups sheet.
  const gRows = ss.getSheetByName('groups').getDataRange().getValues();
  gRows.shift();
  const standings  = [];
  const metaByCode = {};
  gRows.forEach(r => {
    const code = String(r[1] || '');
    if (!code) return;
    standings.push({
      group: String(r[0]), code: code,
      played: Number(r[4]) || 0, pts: Number(r[11]) || 0,
      gd: Number(r[10]) || 0, gf: Number(r[8]) || 0
    });
    metaByCode[code] = { name: String(r[2] || ''), flag: String(r[3] || '') };
  });

  const groupMatches = buildGroupMatchResults_(rows.slice(1));
  const r32 = resolveR32(standings, groupMatches);

  let updated = 0;
  rows.slice(1).forEach((row, i) => {
    const id = Number(row[0]);
    if (!id || !r32[id]) return; // not a resolvable R32 row (73–88)
    const resolved = r32[id];
    const next = planR32RowUpdate_(row, resolved, metaByCode);
    if (!next) return; // manual lock
    if (resolved.home && !metaByCode[resolved.home])
      Logger.log(`syncBracket: #${id} missing metadata for ${resolved.home}`);
    if (resolved.away && !metaByCode[resolved.away])
      Logger.log(`syncBracket: #${id} missing metadata for ${resolved.away}`);

    const current = row.slice(6, 12).map(v => String(v || ''));
    if (current.every((v, idx) => v === String(next[idx] || ''))) return;
    mSheet.getRange(i + 2, 7, 1, 6).setValues([next]);
    updated++;
    Logger.log(`syncBracket: #${id} → ${next[1] || 'TBD'} vs ${next[4] || 'TBD'}`);
  });

  if (updated > 0) touchDataVersion();
  Logger.log(`syncBracket: ${updated} matches updated`);
  return updated;
}

// Return the six team cells for an automatically managed R32 row.
// A locked row returns null. Missing/unresolved sides intentionally become
// blank triples so stale automatic values cannot survive a later recalculation.
function planR32RowUpdate_(row, resolved, metaByCode) {
  if (row[17] === true) return null;
  function side(code) {
    const meta = code && metaByCode[code];
    return meta ? [code, meta.name, meta.flag] : ['', '', ''];
  }
  return side(resolved.home).concat(side(resolved.away));
}

// Convert matches Sheet rows into the pure match shape used by FIFA
// head-to-head ranking. Scores remain null until both cells are populated.
function buildGroupMatchResults_(rows) {
  return rows.filter(row => String(row[3] || '') === '小組賽' && row[6] && row[9]).map(row => ({
    group: String(row[4] || ''),
    team1: String(row[6]),
    team2: String(row[9]),
    score1: row[12] === '' || row[12] === null || row[12] === undefined ? null : Number(row[12]),
    score2: row[13] === '' || row[13] === null || row[13] === undefined ? null : Number(row[13]),
    status: String(row[14] || 'upcoming')
  }));
}

// ── Knockout bracket resolution (pure functions) ──────────────────
// Resolve Round-of-32 teams from group standings + the official seed
// map, replacing the football-data.org dependency for the bracket.
// See change: knockout-bracket-resolution.

// Compare two standing entries for ranking: points → goal difference →
// goals for (all descending), then a deterministic fallback by group
// letter, then team code, so ranking output is always stable.
function compareStanding_(a, b) {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  if (a.group !== b.group) return a.group < b.group ? -1 : 1;
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  return 0;
}

// Overall criteria used only after the head-to-head criteria cannot split
// a tied subset: goal difference, goals scored, conduct, FIFA ranking.
function compareOverallGroup_(a, b) {
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  const aConduct = Number(a.conduct), bConduct = Number(b.conduct);
  if (!isNaN(aConduct) && !isNaN(bConduct) && bConduct !== aConduct)
    return bConduct - aConduct;
  const aRank = Number(a.fifaRank), bRank = Number(b.fifaRank);
  if (!isNaN(aRank) && !isNaN(bRank) && aRank !== bRank) return aRank - bRank;
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  return 0;
}

// Head-to-head mini-table for only the supplied tied teams.
function getHeadToHeadStats_(teams, matches) {
  const codes = {};
  const stats = {};
  teams.forEach(t => {
    codes[t.code] = true;
    stats[t.code] = { pts: 0, gd: 0, gf: 0, ga: 0 };
  });
  (matches || []).forEach(m => {
    if (m.status !== 'finished' || !codes[m.team1] || !codes[m.team2]) return;
    if (m.score1 === null || m.score1 === undefined || m.score2 === null || m.score2 === undefined) return;
    const home = stats[m.team1], away = stats[m.team2];
    const s1 = Number(m.score1), s2 = Number(m.score2);
    home.gf += s1; home.ga += s2; home.gd = home.gf - home.ga;
    away.gf += s2; away.ga += s1; away.gd = away.gf - away.ga;
    if (s1 > s2) home.pts += 3;
    else if (s2 > s1) away.pts += 3;
    else { home.pts++; away.pts++; }
  });
  return stats;
}

// Apply FIFA's head-to-head criteria and reapply them when only part of a
// tied set separates. If the current mini-table cannot split the set, fall
// through to the overall criteria.
function rankTiedGroup_(teams, matches) {
  if (teams.length <= 1) return teams.slice();
  const stats = getHeadToHeadStats_(teams, matches);
  const sorted = teams.slice().sort((a, b) => {
    const sa = stats[a.code], sb = stats[b.code];
    if (sb.pts !== sa.pts) return sb.pts - sa.pts;
    if (sb.gd !== sa.gd) return sb.gd - sa.gd;
    if (sb.gf !== sa.gf) return sb.gf - sa.gf;
    return 0;
  });
  const buckets = [];
  sorted.forEach(team => {
    const s = stats[team.code];
    const key = `${s.pts}|${s.gd}|${s.gf}`;
    const last = buckets[buckets.length - 1];
    if (!last || last.key !== key) buckets.push({ key: key, teams: [team] });
    else last.teams.push(team);
  });
  if (buckets.length === 1) return teams.slice().sort(compareOverallGroup_);
  const result = teams.slice(0, 0);
  buckets.forEach(bucket => {
    const ranked = bucket.teams.length > 1 ? rankTiedGroup_(bucket.teams, matches) : bucket.teams;
    ranked.forEach(team => result.push(team));
  });
  return result;
}

// Rank a group's teams using FIFA 2026: total points, then the head-to-head
// mini-table, then overall criteria. Does not mutate the input array.
function rankGroup(teams, matches) {
  const byPoints = {};
  teams.forEach(t => { (byPoints[t.pts] || (byPoints[t.pts] = [])).push(t); });
  const result = teams.slice(0, 0);
  Object.keys(byPoints).map(Number).sort((a, b) => b - a).forEach(pts => {
    rankTiedGroup_(byPoints[pts], matches || []).forEach(team => result.push(team));
  });
  return result;
}

// Rank the twelve third-placed teams. The first eight in the returned
// array are the qualifying thirds; the rest are eliminated.
function rankThirds(thirds) {
  return thirds.slice().sort(compareStanding_);
}

// Conservatively resolve exact positions that can no longer change.
// A team is fixed at rank N only when exactly N rivals are guaranteed to
// finish above it and no additional rival can still reach its current points.
// Completed groups use the final tiebreak ordering directly.
function hasFinishedHeadToHeadWin_(teamCode, rivalCode, matches) {
  return (matches || []).some(m => {
    if (m.status !== 'finished') return false;
    if (m.team1 === teamCode && m.team2 === rivalCode) return Number(m.score1) > Number(m.score2);
    if (m.team2 === teamCode && m.team1 === rivalCode) return Number(m.score2) > Number(m.score1);
    return false;
  });
}

function resolveClinchedGroupRanks(teams, matches) {
  const unresolved = { winner: null, runnerUp: null, third: null };
  if (!Array.isArray(teams) || teams.length !== 4) return unresolved;

  const normalized = teams.map(t => ({
    group: t.group,
    code: t.code,
    pts: Number(t.pts) || 0,
    gd: Number(t.gd) || 0,
    gf: Number(t.gf) || 0,
    played: t.played === undefined ? 3 : Math.max(0, Math.min(3, Number(t.played) || 0))
  }));

  if (normalized.every(t => t.played === 3)) {
    const ranked = rankGroup(normalized, matches || []);
    return { winner: ranked[0].code, runnerUp: ranked[1].code, third: ranked[2].code };
  }

  const keys = ['winner', 'runnerUp', 'third'];
  normalized.forEach(team => {
    const maxPoints = team.pts + (3 - team.played) * 3;
    const rivals = normalized.filter(other => other.code !== team.code);
    const guaranteedAbove = rivals.filter(other => other.pts > maxPoints).length;
    const canFinishAbove = rivals.filter(other => {
      const otherMax = other.pts + (3 - other.played) * 3;
      if (otherMax > team.pts) return true;
      if (otherMax < team.pts) return false;
      return !hasFinishedHeadToHeadWin_(team.code, other.code, matches || []);
    }).length;
    if (guaranteedAbove === canFinishAbove && guaranteedAbove < keys.length) {
      unresolved[keys[guaranteedAbove]] = team.code;
    }
  });
  return unresolved;
}

// Official WC2026 Round-of-32 seed map (match_id 73–88 → two seed
// codes). Single source of truth, kept equivalent to R32_SEEDS in
// wc2026-bracket.html. A `3 XXXXX` code is a best-third-place slot.
function getR32SeedMap() {
  return {
    73: ['2A', '2B'],      74: ['1E', '3 ABCDF'],
    75: ['1F', '2C'],      76: ['1C', '2F'],
    77: ['1I', '3 CDFGH'], 78: ['2E', '2I'],
    79: ['1A', '3 CEFHI'], 80: ['1L', '3 EHIJK'],
    81: ['1D', '3 BEFIJ'], 82: ['1G', '3 AEHIJ'],
    83: ['2K', '2L'],      84: ['1H', '2J'],
    85: ['1B', '3 EFGIJ'], 86: ['1J', '2H'],
    87: ['1K', '3 DEIJL'], 88: ['2D', '2G']
  };
}

// Official WC2026 best-third-place allocation table (FIFA regulations
// Annex C) — all C(12,8) = 495 combinations. Parsed and verified from
// Wikipedia Template:2026_FIFA_World_Cup_third-place_table: every row's
// assignment was cross-checked against getR32SeedMap allowed-sets and the
// combination cells, with zero mismatches. NEEDS-VERIFICATION against the
// official FIFA regulations PDF before the tournament.
// Key: 8 qualifying group letters (sorted, joined). Value: the third-place
// group assigned to each winner slot, in order [1A,1B,1D,1E,1G,1I,1K,1L].
function getThirdPlaceAllocation() {
  return {
    'ABCDEFGH':'HGBCAFDE', 'ABCDEFGI':'CGBDAFEI', 'ABCDEFGJ':'CGBDAFEJ', 'ABCDEFGK':'CGBDAFEK',
    'ABCDEFGL':'CGBDAFLE', 'ABCDEFHI':'HEBCAFDI', 'ABCDEFHJ':'HJBCAFDE', 'ABCDEFHK':'HEBCAFDK',
    'ABCDEFHL':'HFBCADLE', 'ABCDEFIJ':'CJBDAFEI', 'ABCDEFIK':'CEBDAFIK', 'ABCDEFIL':'CEBDAFLI',
    'ABCDEFJK':'CJBDAFEK', 'ABCDEFJL':'CJBDAFLE', 'ABCDEFKL':'CEBDAFLK', 'ABCDEGHI':'HGBCADEI',
    'ABCDEGHJ':'HGBCADEJ', 'ABCDEGHK':'HGBCADEK', 'ABCDEGHL':'HGBCADLE', 'ABCDEGIJ':'EGBCADIJ',
    'ABCDEGIK':'EGBCADIK', 'ABCDEGIL':'EGBCADLI', 'ABCDEGJK':'EGBCADJK', 'ABCDEGJL':'EGBCADLJ',
    'ABCDEGKL':'EGBCADLK', 'ABCDEHIJ':'HJBCADEI', 'ABCDEHIK':'HEBCADIK', 'ABCDEHIL':'HEBCADLI',
    'ABCDEHJK':'HJBCADEK', 'ABCDEHJL':'HJBCADLE', 'ABCDEHKL':'HEBCADLK', 'ABCDEIJK':'EJBCADIK',
    'ABCDEIJL':'EJBCADLI', 'ABCDEIKL':'EIBCADLK', 'ABCDEJKL':'EJBCADLK', 'ABCDFGHI':'HGBCAFDI',
    'ABCDFGHJ':'HGBCAFDJ', 'ABCDFGHK':'HGBCAFDK', 'ABCDFGHL':'CGBDAFLH', 'ABCDFGIJ':'CGBDAFIJ',
    'ABCDFGIK':'CGBDAFIK', 'ABCDFGIL':'CGBDAFLI', 'ABCDFGJK':'CGBDAFJK', 'ABCDFGJL':'CGBDAFLJ',
    'ABCDFGKL':'CGBDAFLK', 'ABCDFHIJ':'HJBCAFDI', 'ABCDFHIK':'HFBCADIK', 'ABCDFHIL':'HFBCADLI',
    'ABCDFHJK':'HJBCAFDK', 'ABCDFHJL':'CJBDAFLH', 'ABCDFHKL':'HFBCADLK', 'ABCDFIJK':'CJBDAFIK',
    'ABCDFIJL':'CJBDAFLI', 'ABCDFIKL':'CIBDAFLK', 'ABCDFJKL':'CJBDAFLK', 'ABCDGHIJ':'HGBCADIJ',
    'ABCDGHIK':'HGBCADIK', 'ABCDGHIL':'HGBCADLI', 'ABCDGHJK':'HGBCADJK', 'ABCDGHJL':'HGBCADLJ',
    'ABCDGHKL':'HGBCADLK', 'ABCDGIJK':'CJBDAGIK', 'ABCDGIJL':'CJBDAGLI', 'ABCDGIKL':'IGBCADLK',
    'ABCDGJKL':'CJBDAGLK', 'ABCDHIJK':'HJBCADIK', 'ABCDHIJL':'HJBCADLI', 'ABCDHIKL':'HIBCADLK',
    'ABCDHJKL':'HJBCADLK', 'ABCDIJKL':'IJBCADLK', 'ABCEFGHI':'HGBCAFEI', 'ABCEFGHJ':'HGBCAFEJ',
    'ABCEFGHK':'HGBCAFEK', 'ABCEFGHL':'HGBCAFLE', 'ABCEFGIJ':'EGBCAFIJ', 'ABCEFGIK':'EGBCAFIK',
    'ABCEFGIL':'EGBCAFLI', 'ABCEFGJK':'EGBCAFJK', 'ABCEFGJL':'EGBCAFLJ', 'ABCEFGKL':'EGBCAFLK',
    'ABCEFHIJ':'HJBCAFEI', 'ABCEFHIK':'HEBCAFIK', 'ABCEFHIL':'HEBCAFLI', 'ABCEFHJK':'HJBCAFEK',
    'ABCEFHJL':'HJBCAFLE', 'ABCEFHKL':'HEBCAFLK', 'ABCEFIJK':'EJBCAFIK', 'ABCEFIJL':'EJBCAFLI',
    'ABCEFIKL':'EIBCAFLK', 'ABCEFJKL':'EJBCAFLK', 'ABCEGHIJ':'HJBCAGEI', 'ABCEGHIK':'EGBCAHIK',
    'ABCEGHIL':'EGBCAHLI', 'ABCEGHJK':'HJBCAGEK', 'ABCEGHJL':'HJBCAGLE', 'ABCEGHKL':'EGBCAHLK',
    'ABCEGIJK':'EJBCAGIK', 'ABCEGIJL':'EJBCAGLI', 'ABCEGIKL':'EGBAICLK', 'ABCEGJKL':'EJBCAGLK',
    'ABCEHIJK':'EJBCAHIK', 'ABCEHIJL':'EJBCAHLI', 'ABCEHIKL':'EIBCAHLK', 'ABCEHJKL':'EJBCAHLK',
    'ABCEIJKL':'EJBAICLK', 'ABCFGHIJ':'HGBCAFIJ', 'ABCFGHIK':'HGBCAFIK', 'ABCFGHIL':'HGBCAFLI',
    'ABCFGHJK':'HGBCAFJK', 'ABCFGHJL':'HGBCAFLJ', 'ABCFGHKL':'HGBCAFLK', 'ABCFGIJK':'CJBFAGIK',
    'ABCFGIJL':'CJBFAGLI', 'ABCFGIKL':'IGBCAFLK', 'ABCFGJKL':'CJBFAGLK', 'ABCFHIJK':'HJBCAFIK',
    'ABCFHIJL':'HJBCAFLI', 'ABCFHIKL':'HIBCAFLK', 'ABCFHJKL':'HJBCAFLK', 'ABCFIJKL':'IJBCAFLK',
    'ABCGHIJK':'HJBCAGIK', 'ABCGHIJL':'HJBCAGLI', 'ABCGHIKL':'IGBCAHLK', 'ABCGHJKL':'HJBCAGLK',
    'ABCGIJKL':'IJBCAGLK', 'ABCHIJKL':'IJBCAHLK', 'ABDEFGHI':'HGBDAFEI', 'ABDEFGHJ':'HGBDAFEJ',
    'ABDEFGHK':'HGBDAFEK', 'ABDEFGHL':'HGBDAFLE', 'ABDEFGIJ':'EGBDAFIJ', 'ABDEFGIK':'EGBDAFIK',
    'ABDEFGIL':'EGBDAFLI', 'ABDEFGJK':'EGBDAFJK', 'ABDEFGJL':'EGBDAFLJ', 'ABDEFGKL':'EGBDAFLK',
    'ABDEFHIJ':'HJBDAFEI', 'ABDEFHIK':'HEBDAFIK', 'ABDEFHIL':'HEBDAFLI', 'ABDEFHJK':'HJBDAFEK',
    'ABDEFHJL':'HJBDAFLE', 'ABDEFHKL':'HEBDAFLK', 'ABDEFIJK':'EJBDAFIK', 'ABDEFIJL':'EJBDAFLI',
    'ABDEFIKL':'EIBDAFLK', 'ABDEFJKL':'EJBDAFLK', 'ABDEGHIJ':'HJBDAGEI', 'ABDEGHIK':'EGBDAHIK',
    'ABDEGHIL':'EGBDAHLI', 'ABDEGHJK':'HJBDAGEK', 'ABDEGHJL':'HJBDAGLE', 'ABDEGHKL':'EGBDAHLK',
    'ABDEGIJK':'EJBDAGIK', 'ABDEGIJL':'EJBDAGLI', 'ABDEGIKL':'EGBAIDLK', 'ABDEGJKL':'EJBDAGLK',
    'ABDEHIJK':'EJBDAHIK', 'ABDEHIJL':'EJBDAHLI', 'ABDEHIKL':'EIBDAHLK', 'ABDEHJKL':'EJBDAHLK',
    'ABDEIJKL':'EJBAIDLK', 'ABDFGHIJ':'HGBDAFIJ', 'ABDFGHIK':'HGBDAFIK', 'ABDFGHIL':'HGBDAFLI',
    'ABDFGHJK':'HGBDAFJK', 'ABDFGHJL':'HGBDAFLJ', 'ABDFGHKL':'HGBDAFLK', 'ABDFGIJK':'FJBDAGIK',
    'ABDFGIJL':'FJBDAGLI', 'ABDFGIKL':'IGBDAFLK', 'ABDFGJKL':'FJBDAGLK', 'ABDFHIJK':'HJBDAFIK',
    'ABDFHIJL':'HJBDAFLI', 'ABDFHIKL':'HIBDAFLK', 'ABDFHJKL':'HJBDAFLK', 'ABDFIJKL':'IJBDAFLK',
    'ABDGHIJK':'HJBDAGIK', 'ABDGHIJL':'HJBDAGLI', 'ABDGHIKL':'IGBDAHLK', 'ABDGHJKL':'HJBDAGLK',
    'ABDGIJKL':'IJBDAGLK', 'ABDHIJKL':'IJBDAHLK', 'ABEFGHIJ':'HJBFAGEI', 'ABEFGHIK':'EGBFAHIK',
    'ABEFGHIL':'EGBFAHLI', 'ABEFGHJK':'HJBFAGEK', 'ABEFGHJL':'HJBFAGLE', 'ABEFGHKL':'EGBFAHLK',
    'ABEFGIJK':'EJBFAGIK', 'ABEFGIJL':'EJBFAGLI', 'ABEFGIKL':'EGBAIFLK', 'ABEFGJKL':'EJBFAGLK',
    'ABEFHIJK':'EJBFAHIK', 'ABEFHIJL':'EJBFAHLI', 'ABEFHIKL':'EIBFAHLK', 'ABEFHJKL':'EJBFAHLK',
    'ABEFIJKL':'EJBAIFLK', 'ABEGHIJK':'EJBAHGIK', 'ABEGHIJL':'EJBAHGLI', 'ABEGHIKL':'EGBAIHLK',
    'ABEGHJKL':'EJBAHGLK', 'ABEGIJKL':'EJBAIGLK', 'ABEHIJKL':'EJBAIHLK', 'ABFGHIJK':'HJBFAGIK',
    'ABFGHIJL':'HJBFAGLI', 'ABFGHIKL':'HGBAIFLK', 'ABFGHJKL':'HJBFAGLK', 'ABFGIJKL':'IJBFAGLK',
    'ABFHIJKL':'HJBAIFLK', 'ABGHIJKL':'HJBAIGLK', 'ACDEFGHI':'HGECAFDI', 'ACDEFGHJ':'HGJCAFDE',
    'ACDEFGHK':'HGECAFDK', 'ACDEFGHL':'HGFCADLE', 'ACDEFGIJ':'CGJDAFEI', 'ACDEFGIK':'CGEDAFIK',
    'ACDEFGIL':'CGEDAFLI', 'ACDEFGJK':'CGJDAFEK', 'ACDEFGJL':'CGJDAFLE', 'ACDEFGKL':'CGEDAFLK',
    'ACDEFHIJ':'HJECAFDI', 'ACDEFHIK':'HEFCADIK', 'ACDEFHIL':'HEFCADLI', 'ACDEFHJK':'HJECAFDK',
    'ACDEFHJL':'HJFCADLE', 'ACDEFHKL':'HEFCADLK', 'ACDEFIJK':'CJEDAFIK', 'ACDEFIJL':'CJEDAFLI',
    'ACDEFIKL':'CEIDAFLK', 'ACDEFJKL':'CJEDAFLK', 'ACDEGHIJ':'HGJCADEI', 'ACDEGHIK':'HGECADIK',
    'ACDEGHIL':'HGECADLI', 'ACDEGHJK':'HGJCADEK', 'ACDEGHJL':'HGJCADLE', 'ACDEGHKL':'HGECADLK',
    'ACDEGIJK':'EGJCADIK', 'ACDEGIJL':'EGJCADLI', 'ACDEGIKL':'EGICADLK', 'ACDEGJKL':'EGJCADLK',
    'ACDEHIJK':'HJECADIK', 'ACDEHIJL':'HJECADLI', 'ACDEHIKL':'HEICADLK', 'ACDEHJKL':'HJECADLK',
    'ACDEIJKL':'EJICADLK', 'ACDFGHIJ':'HGJCAFDI', 'ACDFGHIK':'HGFCADIK', 'ACDFGHIL':'HGFCADLI',
    'ACDFGHJK':'HGJCAFDK', 'ACDFGHJL':'CGJDAFLH', 'ACDFGHKL':'HGFCADLK', 'ACDFGIJK':'CGJDAFIK',
    'ACDFGIJL':'CGJDAFLI', 'ACDFGIKL':'CGIDAFLK', 'ACDFGJKL':'CGJDAFLK', 'ACDFHIJK':'HJFCADIK',
    'ACDFHIJL':'HJFCADLI', 'ACDFHIKL':'HFICADLK', 'ACDFHJKL':'HJFCADLK', 'ACDFIJKL':'CJIDAFLK',
    'ACDGHIJK':'HGJCADIK', 'ACDGHIJL':'HGJCADLI', 'ACDGHIKL':'HGICADLK', 'ACDGHJKL':'HGJCADLK',
    'ACDGIJKL':'IGJCADLK', 'ACDHIJKL':'HJICADLK', 'ACEFGHIJ':'HGJCAFEI', 'ACEFGHIK':'HGECAFIK',
    'ACEFGHIL':'HGECAFLI', 'ACEFGHJK':'HGJCAFEK', 'ACEFGHJL':'HGJCAFLE', 'ACEFGHKL':'HGECAFLK',
    'ACEFGIJK':'EGJCAFIK', 'ACEFGIJL':'EGJCAFLI', 'ACEFGIKL':'EGICAFLK', 'ACEFGJKL':'EGJCAFLK',
    'ACEFHIJK':'HJECAFIK', 'ACEFHIJL':'HJECAFLI', 'ACEFHIKL':'HEICAFLK', 'ACEFHJKL':'HJECAFLK',
    'ACEFIJKL':'EJICAFLK', 'ACEGHIJK':'EGJCAHIK', 'ACEGHIJL':'EGJCAHLI', 'ACEGHIKL':'EGICAHLK',
    'ACEGHJKL':'EGJCAHLK', 'ACEGIJKL':'EJICAGLK', 'ACEHIJKL':'EJICAHLK', 'ACFGHIJK':'HGJCAFIK',
    'ACFGHIJL':'HGJCAFLI', 'ACFGHIKL':'HGICAFLK', 'ACFGHJKL':'HGJCAFLK', 'ACFGIJKL':'IGJCAFLK',
    'ACFHIJKL':'HJICAFLK', 'ACGHIJKL':'HJICAGLK', 'ADEFGHIJ':'HGJDAFEI', 'ADEFGHIK':'HGEDAFIK',
    'ADEFGHIL':'HGEDAFLI', 'ADEFGHJK':'HGJDAFEK', 'ADEFGHJL':'HGJDAFLE', 'ADEFGHKL':'HGEDAFLK',
    'ADEFGIJK':'EGJDAFIK', 'ADEFGIJL':'EGJDAFLI', 'ADEFGIKL':'EGIDAFLK', 'ADEFGJKL':'EGJDAFLK',
    'ADEFHIJK':'HJEDAFIK', 'ADEFHIJL':'HJEDAFLI', 'ADEFHIKL':'HEIDAFLK', 'ADEFHJKL':'HJEDAFLK',
    'ADEFIJKL':'EJIDAFLK', 'ADEGHIJK':'EGJDAHIK', 'ADEGHIJL':'EGJDAHLI', 'ADEGHIKL':'EGIDAHLK',
    'ADEGHJKL':'EGJDAHLK', 'ADEGIJKL':'EJIDAGLK', 'ADEHIJKL':'EJIDAHLK', 'ADFGHIJK':'HGJDAFIK',
    'ADFGHIJL':'HGJDAFLI', 'ADFGHIKL':'HGIDAFLK', 'ADFGHJKL':'HGJDAFLK', 'ADFGIJKL':'IGJDAFLK',
    'ADFHIJKL':'HJIDAFLK', 'ADGHIJKL':'HJIDAGLK', 'AEFGHIJK':'EGJFAHIK', 'AEFGHIJL':'EGJFAHLI',
    'AEFGHIKL':'EGIFAHLK', 'AEFGHJKL':'EGJFAHLK', 'AEFGIJKL':'EJIFAGLK', 'AEFHIJKL':'EJIFAHLK',
    'AEGHIJKL':'EJIAHGLK', 'AFGHIJKL':'HJIFAGLK', 'BCDEFGHI':'CGBDHFEI', 'BCDEFGHJ':'HGBCJFDE',
    'BCDEFGHK':'CGBDHFEK', 'BCDEFGHL':'CGBDHFLE', 'BCDEFGIJ':'CGBDJFEI', 'BCDEFGIK':'CGBDEFIK',
    'BCDEFGIL':'CGBDEFLI', 'BCDEFGJK':'CGBDJFEK', 'BCDEFGJL':'CGBDJFLE', 'BCDEFGKL':'CGBDEFLK',
    'BCDEFHIJ':'CJBDHFEI', 'BCDEFHIK':'CEBDHFIK', 'BCDEFHIL':'CEBDHFLI', 'BCDEFHJK':'CJBDHFEK',
    'BCDEFHJL':'CJBDHFLE', 'BCDEFHKL':'CEBDHFLK', 'BCDEFIJK':'CJBDEFIK', 'BCDEFIJL':'CJBDEFLI',
    'BCDEFIKL':'CEBDIFLK', 'BCDEFJKL':'CJBDEFLK', 'BCDEGHIJ':'HGBCJDEI', 'BCDEGHIK':'EGBCHDIK',
    'BCDEGHIL':'EGBCHDLI', 'BCDEGHJK':'HGBCJDEK', 'BCDEGHJL':'HGBCJDLE', 'BCDEGHKL':'EGBCHDLK',
    'BCDEGIJK':'EGBCJDIK', 'BCDEGIJL':'EGBCJDLI', 'BCDEGIKL':'EGBCIDLK', 'BCDEGJKL':'EGBCJDLK',
    'BCDEHIJK':'EJBCHDIK', 'BCDEHIJL':'EJBCHDLI', 'BCDEHIKL':'EIBCHDLK', 'BCDEHJKL':'EJBCHDLK',
    'BCDEIJKL':'EJBCIDLK', 'BCDFGHIJ':'HGBCJFDI', 'BCDFGHIK':'CGBDHFIK', 'BCDFGHIL':'CGBDHFLI',
    'BCDFGHJK':'HGBCJFDK', 'BCDFGHJL':'CGBDHFLJ', 'BCDFGHKL':'CGBDHFLK', 'BCDFGIJK':'CGBDJFIK',
    'BCDFGIJL':'CGBDJFLI', 'BCDFGIKL':'CGBDIFLK', 'BCDFGJKL':'CGBDJFLK', 'BCDFHIJK':'CJBDHFIK',
    'BCDFHIJL':'CJBDHFLI', 'BCDFHIKL':'CIBDHFLK', 'BCDFHJKL':'CJBDHFLK', 'BCDFIJKL':'CJBDIFLK',
    'BCDGHIJK':'HGBCJDIK', 'BCDGHIJL':'HGBCJDLI', 'BCDGHIKL':'HGBCIDLK', 'BCDGHJKL':'HGBCJDLK',
    'BCDGIJKL':'IGBCJDLK', 'BCDHIJKL':'HJBCIDLK', 'BCEFGHIJ':'HGBCJFEI', 'BCEFGHIK':'EGBCHFIK',
    'BCEFGHIL':'EGBCHFLI', 'BCEFGHJK':'HGBCJFEK', 'BCEFGHJL':'HGBCJFLE', 'BCEFGHKL':'EGBCHFLK',
    'BCEFGIJK':'EGBCJFIK', 'BCEFGIJL':'EGBCJFLI', 'BCEFGIKL':'EGBCIFLK', 'BCEFGJKL':'EGBCJFLK',
    'BCEFHIJK':'EJBCHFIK', 'BCEFHIJL':'EJBCHFLI', 'BCEFHIKL':'EIBCHFLK', 'BCEFHJKL':'EJBCHFLK',
    'BCEFIJKL':'EJBCIFLK', 'BCEGHIJK':'EJBCHGIK', 'BCEGHIJL':'EJBCHGLI', 'BCEGHIKL':'EGBCIHLK',
    'BCEGHJKL':'EJBCHGLK', 'BCEGIJKL':'EJBCIGLK', 'BCEHIJKL':'EJBCIHLK', 'BCFGHIJK':'HGBCJFIK',
    'BCFGHIJL':'HGBCJFLI', 'BCFGHIKL':'HGBCIFLK', 'BCFGHJKL':'HGBCJFLK', 'BCFGIJKL':'IGBCJFLK',
    'BCFHIJKL':'HJBCIFLK', 'BCGHIJKL':'HJBCIGLK', 'BDEFGHIJ':'HGBDJFEI', 'BDEFGHIK':'EGBDHFIK',
    'BDEFGHIL':'EGBDHFLI', 'BDEFGHJK':'HGBDJFEK', 'BDEFGHJL':'HGBDJFLE', 'BDEFGHKL':'EGBDHFLK',
    'BDEFGIJK':'EGBDJFIK', 'BDEFGIJL':'EGBDJFLI', 'BDEFGIKL':'EGBDIFLK', 'BDEFGJKL':'EGBDJFLK',
    'BDEFHIJK':'EJBDHFIK', 'BDEFHIJL':'EJBDHFLI', 'BDEFHIKL':'EIBDHFLK', 'BDEFHJKL':'EJBDHFLK',
    'BDEFIJKL':'EJBDIFLK', 'BDEGHIJK':'EJBDHGIK', 'BDEGHIJL':'EJBDHGLI', 'BDEGHIKL':'EGBDIHLK',
    'BDEGHJKL':'EJBDHGLK', 'BDEGIJKL':'EJBDIGLK', 'BDEHIJKL':'EJBDIHLK', 'BDFGHIJK':'HGBDJFIK',
    'BDFGHIJL':'HGBDJFLI', 'BDFGHIKL':'HGBDIFLK', 'BDFGHJKL':'HGBDJFLK', 'BDFGIJKL':'IGBDJFLK',
    'BDFHIJKL':'HJBDIFLK', 'BDGHIJKL':'HJBDIGLK', 'BEFGHIJK':'EJBFHGIK', 'BEFGHIJL':'EJBFHGLI',
    'BEFGHIKL':'EGBFIHLK', 'BEFGHJKL':'EJBFHGLK', 'BEFGIJKL':'EJBFIGLK', 'BEFHIJKL':'EJBFIHLK',
    'BEGHIJKL':'EJIBHGLK', 'BFGHIJKL':'HJBFIGLK', 'CDEFGHIJ':'CGJDHFEI', 'CDEFGHIK':'CGEDHFIK',
    'CDEFGHIL':'CGEDHFLI', 'CDEFGHJK':'CGJDHFEK', 'CDEFGHJL':'CGJDHFLE', 'CDEFGHKL':'CGEDHFLK',
    'CDEFGIJK':'CGEDJFIK', 'CDEFGIJL':'CGEDJFLI', 'CDEFGIKL':'CGEDIFLK', 'CDEFGJKL':'CGEDJFLK',
    'CDEFHIJK':'CJEDHFIK', 'CDEFHIJL':'CJEDHFLI', 'CDEFHIKL':'CEIDHFLK', 'CDEFHJKL':'CJEDHFLK',
    'CDEFIJKL':'CJEDIFLK', 'CDEGHIJK':'EGJCHDIK', 'CDEGHIJL':'EGJCHDLI', 'CDEGHIKL':'EGICHDLK',
    'CDEGHJKL':'EGJCHDLK', 'CDEGIJKL':'EGICJDLK', 'CDEHIJKL':'EJICHDLK', 'CDFGHIJK':'CGJDHFIK',
    'CDFGHIJL':'CGJDHFLI', 'CDFGHIKL':'CGIDHFLK', 'CDFGHJKL':'CGJDHFLK', 'CDFGIJKL':'CGIDJFLK',
    'CDFHIJKL':'CJIDHFLK', 'CDGHIJKL':'HGICJDLK', 'CEFGHIJK':'EGJCHFIK', 'CEFGHIJL':'EGJCHFLI',
    'CEFGHIKL':'EGICHFLK', 'CEFGHJKL':'EGJCHFLK', 'CEFGIJKL':'EGICJFLK', 'CEFHIJKL':'EJICHFLK',
    'CEGHIJKL':'EJICHGLK', 'CFGHIJKL':'HGICJFLK', 'DEFGHIJK':'EGJDHFIK', 'DEFGHIJL':'EGJDHFLI',
    'DEFGHIKL':'EGIDHFLK', 'DEFGHJKL':'EGJDHFLK', 'DEFGIJKL':'EGIDJFLK', 'DEFHIJKL':'EJIDHFLK',
    'DEGHIJKL':'EJIDHGLK', 'DFGHIJKL':'HGIDJFLK', 'EFGHIJKL':'EJIFHGLK'
  };
}

// Map a set of eight qualifying third-place groups to bracket slots using
// the official allocation table. Returns { '1A': group, ... } for the eight
// winner slots that face a third, or null when the input is not exactly
// eight distinct known groups (i.e. no matching combination).
function assignThirds(qualifiedGroups) {
  if (!Array.isArray(qualifiedGroups) || qualifiedGroups.length !== 8) return null;
  const key = qualifiedGroups.slice().sort().join('');
  const packed = getThirdPlaceAllocation()[key];
  if (!packed) return null;
  const slots = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'];
  const out = {};
  for (let i = 0; i < slots.length; i++) out[slots[i]] = packed[i];
  return out;
}

// Resolve Round-of-32 matchups (match_id 73–88) from group standings.
// Input: array of { group, code, pts, gd, gf }. Output: a map from
// match_id to { home, away } team codes. A `1X` / `2X` seed resolves to a
// group winner / runner-up; a `3 XXXXX` seed resolves through the partner
// winner slot via the allocation table. Any side that cannot be resolved
// (group stage incomplete, thirds not yet decidable) is set to null so the
// caller can skip writing it.
function resolveR32(standings, matches) {
  const byGroup = {};
  standings.forEach(t => {
    if (!byGroup[t.group]) byGroup[t.group] = [];
    byGroup[t.group].push(t);
  });

  const winner = {}, runnerUp = {}, thirdByGroup = {};
  const thirds = [];
  Object.keys(byGroup).forEach(g => {
    const codes = {};
    byGroup[g].forEach(t => { codes[t.code] = true; });
    const groupMatches = (matches || []).filter(m => codes[m.team1] && codes[m.team2]);
    const clinched = resolveClinchedGroupRanks(byGroup[g], groupMatches);
    if (clinched.winner) winner[g] = clinched.winner;
    if (clinched.runnerUp) runnerUp[g] = clinched.runnerUp;
  });

  // Cross-group third-place ranking is safe only after all twelve groups
  // have complete final standings. Until then those slots remain empty.
  const groupLetters = 'ABCDEFGHIJKL'.split('');
  const thirdsFinal = groupLetters.every(g =>
    byGroup[g] && byGroup[g].length === 4 &&
    byGroup[g].every(t => (t.played === undefined ? 3 : Number(t.played)) === 3)
  );
  if (thirdsFinal) {
    groupLetters.forEach(g => {
      const codes = {};
      byGroup[g].forEach(t => { codes[t.code] = true; });
      const groupMatches = (matches || []).filter(m => codes[m.team1] && codes[m.team2]);
      const third = rankGroup(byGroup[g], groupMatches)[2];
      if (third) { thirdByGroup[g] = third.code; thirds.push(third); }
    });
  }
  const qualified = thirdsFinal ? rankThirds(thirds).slice(0, 8) : [];
  const slotToGroup = thirdsFinal ? assignThirds(qualified.map(t => t.group)) : null;

  function resolveSeed(seed, partnerSeed) {
    const m = /^([12])([A-L])$/.exec(seed);
    if (m) return (m[1] === '1' ? winner : runnerUp)[m[2]] || null;
    if (/^3\s/.test(seed)) {
      if (!slotToGroup) return null;
      const grp = slotToGroup[partnerSeed]; // partner is the `1X` winner slot
      return grp ? (thirdByGroup[grp] || null) : null;
    }
    return null;
  }

  const seedMap = getR32SeedMap();
  const out = {};
  Object.keys(seedMap).forEach(id => {
    const seeds = seedMap[id];
    out[id] = {
      home: resolveSeed(seeds[0], seeds[1]),
      away: resolveSeed(seeds[1], seeds[0])
    };
  });
  return out;
}

// True only when at least one group-stage match exists and every one is
// finished. Guards resolution from writing provisional knockout teams
// (which the row[6]-already-filled rule would then lock in).
function isGroupStageComplete(matches) {
  const groupMatches = matches.filter(m => m.phase === '小組賽');
  if (groupMatches.length === 0) return false;
  return groupMatches.every(m => m.status === 'finished');
}

function setupSyncTrigger() {
  // Remove existing syncScores triggers, then create a fresh 10-min trigger
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncScores')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncScores').timeBased().everyMinutes(10).create();
  SpreadsheetApp.getUi().alert('Done — syncScores will run every 10 minutes.');
}
// ─────────────────────────────────────────────

function doGet(e) {
  const action = (e.parameter.action || '').trim();
  let result;

  try {
    switch (action) {
      case 'getMatches':   result = getMatches(e.parameter);    break;
      case 'getGroups':    result = getGroups(e.parameter);     break;
      case 'getConfig':    result = getConfig();                 break;
      case 'updateMatch':  result = updateMatchFromGet(e.parameter); break;
      default:             result = { status: 'error', message: 'Invalid action' };
    }
  } catch (err) {
    result = { status: 'error', message: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action !== 'updateMatch') throw new Error('unknown action');

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
    const rows  = sheet.getDataRange().getValues();
    const i     = rows.findIndex((r, idx) => idx > 0 && Number(r[0]) === Number(d.match_id));
    if (i < 0) throw new Error('match not found: ' + d.match_id);

    if (d.score1 !== undefined && d.score1 !== '')
      sheet.getRange(i + 1, 13).setValue(Number(d.score1));
    if (d.score2 !== undefined && d.score2 !== '')
      sheet.getRange(i + 1, 14).setValue(Number(d.score2));
    if (d.status)
      sheet.getRange(i + 1, 15).setValue(d.status);

    sheet.getRange(i + 1, 18).setValue(true);

    recalcGroups();
    touchDataVersion();

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', match_id: d.match_id, updated: getDataVersion() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function updateMatchFromGet(p) {
  const matchId = Number(p.match_id);
  if (!matchId) throw new Error('missing match_id');

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
  const rows  = sheet.getDataRange().getValues();
  const i     = rows.findIndex((r, idx) => idx > 0 && Number(r[0]) === matchId);
  if (i < 0) throw new Error('match not found: ' + matchId);

  if (p.score1 !== undefined && p.score1 !== '')
    sheet.getRange(i + 1, 13).setValue(Number(p.score1));
  if (p.score2 !== undefined && p.score2 !== '')
    sheet.getRange(i + 1, 14).setValue(Number(p.score2));
  if (p.status)
    sheet.getRange(i + 1, 15).setValue(p.status);

  // Knockout team fields
  if (p.team1_code !== undefined) sheet.getRange(i + 1, 7).setValue(p.team1_code);
  if (p.team1_name !== undefined) sheet.getRange(i + 1, 8).setValue(p.team1_name);
  if (p.team1_flag !== undefined) sheet.getRange(i + 1, 9).setValue(p.team1_flag);
  if (p.team2_code !== undefined) sheet.getRange(i + 1, 10).setValue(p.team2_code);
  if (p.team2_name !== undefined) sheet.getRange(i + 1, 11).setValue(p.team2_name);
  if (p.team2_flag !== undefined) sheet.getRange(i + 1, 12).setValue(p.team2_flag);

  sheet.getRange(i + 1, 18).setValue(true);

  recalcGroups();
  touchDataVersion();

  return { status: 'ok', match_id: matchId, updated: getDataVersion() };
}

function testDiag() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
    const rows  = sheet.getDataRange().getValues();
    const total = rows.length;
    const ids   = rows.slice(1, 6).map(r => r[0]);   // first 5 match IDs
    const i     = rows.findIndex((r, idx) => idx > 0 && Number(r[0]) === 90);
    Logger.log('rows=' + total + '  first IDs=' + ids + '  match90_idx=' + i);
    if (i > 0) {
      sheet.getRange(i + 1, 8).setValue('診斷寫入OK');
      SpreadsheetApp.flush();
      Logger.log('Wrote to H' + (i+1));
    }
  } catch(e) { Logger.log('ERROR: ' + e.message); }
}

// ─── getMatches ───────────────────────────────

function getMatches(params) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
  const rows  = sheet.getDataRange().getValues();
  rows.shift(); // remove header row

  let data = rows
    .filter(r => r[0] !== '' && r[0] !== null)
    .map(r => ({
      match_id:  Number(r[0]),
      date:      formatDate(r[1]),
      time_utc8: formatTime(r[2]),
      phase:     String(r[3] || ''),
      group:     String(r[4] || ''),
      round:     Number(r[5]) || 0,
      team1: { code: String(r[6] || ''), name: normalizeTeamName_(r[7]), flag: normalizeTeamFlag_(r[6], r[8]) },
      team2: { code: String(r[9] || ''), name: normalizeTeamName_(r[10]), flag: normalizeTeamFlag_(r[9], r[11]) },
      score1: toScore(r[12]),
      score2: toScore(r[13]),
      status: String(r[14] || 'upcoming'),
      venue:  String(r[15] || ''),
      city:   String(r[16] || '')
    }));

  if (params.date)  data = data.filter(m => m.date === params.date);
  if (params.phase) data = data.filter(m => m.phase === params.phase);

  return {
    status:  'ok',
    updated: getDataVersion(),
    data
  };
}

// ─── getGroups ────────────────────────────────

function getGroups(params) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('groups');
  const rows  = sheet.getDataRange().getValues();
  rows.shift();

  let data = rows
    .filter(r => r[0] !== '' && r[0] !== null)
    .map(r => ({
      group: String(r[0]),
      team:  { code: String(r[1] || ''), name: normalizeTeamName_(r[2]), flag: normalizeTeamFlag_(r[1], r[3]) },
      played: Number(r[4])  || 0,
      win:    Number(r[5])  || 0,
      draw:   Number(r[6])  || 0,
      loss:   Number(r[7])  || 0,
      gf:     Number(r[8])  || 0,
      ga:     Number(r[9])  || 0,
      gd:     Number(r[10]) || 0,
      pts:    Number(r[11]) || 0
    }));

  if (params.group) data = data.filter(g => g.group === params.group);

  return {
    status:  'ok',
    updated: getDataVersion(),
    data
  };
}

// ─── getConfig ────────────────────────────────

function getConfig() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('config');
  const rows  = sheet.getDataRange().getValues();
  const cfg   = {};
  rows.forEach(([k, v]) => { if (k) cfg[String(k)] = v; });

  return {
    status:  'ok',
    updated: getDataVersion(),
    data:    cfg
  };
}

// ─── Helpers ──────────────────────────────────

function touchDataVersion() {
  const updated = new Date().toISOString();
  PropertiesService.getScriptProperties().setProperty('DATA_UPDATED_AT', updated);
  const cache = CacheService.getScriptCache();
  ['matches_all', 'groups_all', 'config_all'].forEach(key => cache.remove(key));
  SpreadsheetApp.flush();
  return updated;
}

function getDataVersion() {
  return PropertiesService.getScriptProperties().getProperty('DATA_UPDATED_AT') || new Date().toISOString();
}

function toScore(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    const y  = value.getFullYear();
    const m  = String(value.getMonth() + 1).padStart(2, '0');
    const d  = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number') {
    // Sheets serial date (days since 1899-12-30)
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    const y  = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${dd}`;
  }
  return String(value).slice(0, 10);
}

function formatTime(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) {
    const h = String(value.getHours()).padStart(2, '0');
    const m = String(value.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  if (typeof value === 'number') {
    // Fractional day (0.625 = 15:00)
    const totalMin = Math.round(value * 1440);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return String(value);
}

// ─── Optional: recalcGroups ───────────────────
// Call this after each matchday to auto-update the groups sheet.
// Trigger manually or set a time-based trigger.

function recalcGroups() {
  const ss      = SpreadsheetApp.openById(SHEET_ID);
  const mSheet  = ss.getSheetByName('matches');
  const gSheet  = ss.getSheetByName('groups');

  const mRows = mSheet.getDataRange().getValues();
  mRows.shift();

  // Collect finished matches
  const finished = mRows
    .filter(r => r[0] !== '' && String(r[14]) === 'finished' && r[4] !== '')
    .map(r => ({
      group:  String(r[4]),
      code1:  String(r[6]),
      code2:  String(r[9]),
      score1: Number(r[12]),
      score2: Number(r[13])
    }));

  // Read existing groups rows to preserve team metadata
  const gRows = gSheet.getDataRange().getValues();
  gRows.shift();

  const stats = {};
  gRows.forEach(r => {
    const key = String(r[1]);
    stats[key] = { group: r[0], code: r[1], name: r[2], flag: r[3], played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  });

  finished.forEach(m => {
    const t1 = stats[m.code1];
    const t2 = stats[m.code2];
    if (!t1 || !t2) return;
    t1.played++; t2.played++;
    t1.gf += m.score1; t1.ga += m.score2; t1.gd = t1.gf - t1.ga;
    t2.gf += m.score2; t2.ga += m.score1; t2.gd = t2.gf - t2.ga;
    if (m.score1 > m.score2)      { t1.win++; t1.pts += 3; t2.loss++; }
    else if (m.score1 < m.score2) { t2.win++; t2.pts += 3; t1.loss++; }
    else                          { t1.draw++; t1.pts++; t2.draw++; t2.pts++; }
  });

  // Write back (preserve row order from gRows)
  gRows.forEach((r, i) => {
    const s = stats[String(r[1])];
    if (!s) return;
    const rowNum = i + 2; // +2: 1-indexed + header row
    gSheet.getRange(rowNum, 5, 1, 8).setValues([[s.played, s.win, s.draw, s.loss, s.gf, s.ga, s.gd, s.pts]]);
  });

  // Update last_updated in config
  const cSheet = ss.getSheetByName('config');
  const cRows  = cSheet.getDataRange().getValues();
  cRows.forEach((r, i) => {
    if (r[0] === 'last_updated') {
      cSheet.getRange(i + 1, 2).setValue(new Date().toISOString());
    }
  });
}

// ─── initializeMatches ────────────────────────
// Run once from the GAS editor to populate the matches sheet.

function listSheets() {
  const names = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName());
  SpreadsheetApp.getUi().alert('現有分頁：\n' + names.join('\n'));
}

function initializeMatches() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('matches');
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 17).clearContent();

  const data = [
    // [match_id, date, time_utc8, phase, group, round, t1_code, t1_name, t1_flag, t2_code, t2_name, t2_flag, score1, score2, status, venue, city]
    // ── GROUP STAGE - MATCHDAY 1 ──────────────────────────────────────────────
    [1,  '2026-06-12', '03:00', '小組賽', 'A', 1, 'MEX', '墨西哥', '🇲🇽', 'RSA', '南非',       '🇿🇦', '', '', 'upcoming', 'Estadio Banorte',                    '墨西哥城'],
    [2,  '2026-06-12', '10:00', '小組賽', 'A', 1, 'KOR', '韓國',   '🇰🇷', 'CZE', '捷克',       '🇨🇿', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    [3,  '2026-06-13', '03:00', '小組賽', 'B', 1, 'CAN', '加拿大', '🇨🇦', 'BIH', '波赫',   '🇧🇦', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [4,  '2026-06-13', '09:00', '小組賽', 'C', 1, 'USA', '美國',   '🇺🇸', 'PAR', '巴拉圭',     '🇵🇾', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [5,  '2026-06-14', '03:00', '小組賽', 'B', 1, 'QAT', '卡達',   '🇶🇦', 'SUI', '瑞士',       '🇨🇭', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [6,  '2026-06-14', '06:00', '小組賽', 'D', 1, 'BRA', '巴西',   '🇧🇷', 'MAR', '摩洛哥',     '🇲🇦', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [7,  '2026-06-14', '09:00', '小組賽', 'D', 1, 'HAI', '海地',   '🇭🇹', 'SCO', '蘇格蘭',     TEAM_FLAGS_BY_CODE.SCO, '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [8,  '2026-06-14', '12:00', '小組賽', 'C', 1, 'AUS', '澳洲',   '🇦🇺', 'TUR', '土耳其',     '🇹🇷', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [9,  '2026-06-15', '01:00', '小組賽', 'E', 1, 'GER', '德國',   '🇩🇪', 'CUW', '古拉索',     '🇨🇼', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [10, '2026-06-15', '04:00', '小組賽', 'F', 1, 'NED', '荷蘭',   '🇳🇱', 'JPN', '日本',       '🇯🇵', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [11, '2026-06-15', '07:00', '小組賽', 'E', 1, 'CIV', '象牙海岸','🇨🇮', 'ECU', '厄瓜多',     '🇪🇨', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [12, '2026-06-15', '10:00', '小組賽', 'F', 1, 'SWE', '瑞典',   '🇸🇪', 'TUN', '突尼西亞',   '🇹🇳', '', '', 'upcoming', 'Estadio BBVA',                       '蒙特雷'],
    [13, '2026-06-16', '00:00', '小組賽', 'G', 1, 'ESP', '西班牙', '🇪🇸', 'CPV', '維德角',     '🇨🇻', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [14, '2026-06-16', '03:00', '小組賽', 'H', 1, 'BEL', '比利時', '🇧🇪', 'EGY', '埃及',       '🇪🇬', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [15, '2026-06-16', '06:00', '小組賽', 'G', 1, 'KSA', '沙烏地阿拉伯','🇸🇦','URU','烏拉圭',  '🇺🇾', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [16, '2026-06-16', '09:00', '小組賽', 'H', 1, 'IRN', '伊朗',   '🇮🇷', 'NZL', '紐西蘭',     '🇳🇿', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [17, '2026-06-17', '03:00', '小組賽', 'J', 1, 'FRA', '法國',   '🇫🇷', 'SEN', '塞內加爾',   '🇸🇳', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [18, '2026-06-17', '06:00', '小組賽', 'J', 1, 'IRQ', '伊拉克', '🇮🇶', 'NOR', '挪威',       '🇳🇴', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [19, '2026-06-17', '09:00', '小組賽', 'I', 1, 'ARG', '阿根廷', '🇦🇷', 'ALG', '阿爾及利亞', '🇩🇿', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    [20, '2026-06-17', '12:00', '小組賽', 'I', 1, 'AUT', '奧地利', '🇦🇹', 'JOR', '約旦',       '🇯🇴', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [21, '2026-06-18', '01:00', '小組賽', 'L', 1, 'POR', '葡萄牙', '🇵🇹', 'CGO', '民主剛果',       '🇨🇩', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [22, '2026-06-18', '04:00', '小組賽', 'K', 1, 'ENG', '英格蘭', TEAM_FLAGS_BY_CODE.ENG, 'CRO', '克羅埃西亞', '🇭🇷', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [23, '2026-06-18', '07:00', '小組賽', 'K', 1, 'GHA', '迦納',   '🇬🇭', 'PAN', '巴拿馬',     '🇵🇦', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [24, '2026-06-18', '10:00', '小組賽', 'L', 1, 'UZB', '烏茲別克','🇺🇿','COL', '哥倫比亞',   '🇨🇴', '', '', 'upcoming', 'Estadio Banorte',                    '墨西哥城'],
    // ── GROUP STAGE - MATCHDAY 2 ──────────────────────────────────────────────
    [25, '2026-06-19', '00:00', '小組賽', 'A', 2, 'CZE', '捷克',   '🇨🇿', 'RSA', '南非',       '🇿🇦', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [26, '2026-06-19', '03:00', '小組賽', 'B', 2, 'SUI', '瑞士',   '🇨🇭', 'BIH', '波赫',   '🇧🇦', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [27, '2026-06-19', '06:00', '小組賽', 'B', 2, 'CAN', '加拿大', '🇨🇦', 'QAT', '卡達',       '🇶🇦', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [28, '2026-06-19', '09:00', '小組賽', 'A', 2, 'MEX', '墨西哥', '🇲🇽', 'KOR', '韓國',       '🇰🇷', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    [29, '2026-06-20', '03:00', '小組賽', 'C', 2, 'USA', '美國',   '🇺🇸', 'AUS', '澳洲',       '🇦🇺', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [30, '2026-06-20', '06:00', '小組賽', 'D', 2, 'SCO', '蘇格蘭',     TEAM_FLAGS_BY_CODE.SCO, 'MAR', '摩洛哥',     '🇲🇦', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [31, '2026-06-20', '08:30', '小組賽', 'D', 2, 'BRA', '巴西',   '🇧🇷', 'HAI', '海地',       '🇭🇹', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [32, '2026-06-20', '11:00', '小組賽', 'C', 2, 'TUR', '土耳其', '🇹🇷', 'PAR', '巴拉圭',     '🇵🇾', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [33, '2026-06-21', '01:00', '小組賽', 'F', 2, 'NED', '荷蘭',   '🇳🇱', 'SWE', '瑞典',       '🇸🇪', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [34, '2026-06-21', '04:00', '小組賽', 'E', 2, 'GER', '德國',   '🇩🇪', 'CIV', '象牙海岸',   '🇨🇮', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [35, '2026-06-21', '08:00', '小組賽', 'E', 2, 'ECU', '厄瓜多', '🇪🇨', 'CUW', '古拉索',     '🇨🇼', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    [36, '2026-06-21', '12:00', '小組賽', 'F', 2, 'TUN', '突尼西亞','🇹🇳','JPN', '日本',       '🇯🇵', '', '', 'upcoming', 'Estadio BBVA',                       '蒙特雷'],
    [37, '2026-06-22', '00:00', '小組賽', 'G', 2, 'ESP', '西班牙', '🇪🇸', 'KSA', '沙烏地阿拉伯','🇸🇦','', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [38, '2026-06-22', '03:00', '小組賽', 'H', 2, 'BEL', '比利時', '🇧🇪', 'IRN', '伊朗',       '🇮🇷', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [39, '2026-06-22', '06:00', '小組賽', 'G', 2, 'URU', '烏拉圭', '🇺🇾', 'CPV', '維德角',     '🇨🇻', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [40, '2026-06-22', '09:00', '小組賽', 'H', 2, 'EGY', '埃及',   '🇪🇬', 'NZL', '紐西蘭',     '🇳🇿', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [41, '2026-06-23', '01:00', '小組賽', 'I', 2, 'ARG', '阿根廷', '🇦🇷', 'AUT', '奧地利',     '🇦🇹', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [42, '2026-06-23', '05:00', '小組賽', 'J', 2, 'FRA', '法國',   '🇫🇷', 'IRQ', '伊拉克',     '🇮🇶', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [43, '2026-06-23', '08:00', '小組賽', 'J', 2, 'SEN', '塞內加爾','🇸🇳','NOR', '挪威',       '🇳🇴', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [44, '2026-06-23', '11:00', '小組賽', 'I', 2, 'ALG', '阿爾及利亞','🇩🇿','JOR','約旦',      '🇯🇴', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [45, '2026-06-24', '01:00', '小組賽', 'L', 2, 'POR', '葡萄牙', '🇵🇹', 'UZB', '烏茲別克',   '🇺🇿', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [46, '2026-06-24', '04:00', '小組賽', 'K', 2, 'ENG', '英格蘭', TEAM_FLAGS_BY_CODE.ENG, 'GHA', '迦納',       '🇬🇭', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [47, '2026-06-24', '07:00', '小組賽', 'K', 2, 'CRO', '克羅埃西亞','🇭🇷','PAN','巴拿馬',    '🇵🇦', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [48, '2026-06-24', '10:00', '小組賽', 'L', 2, 'COL', '哥倫比亞','🇨🇴','CGO','民主剛果',        '🇨🇩', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    // ── GROUP STAGE - MATCHDAY 3 ──────────────────────────────────────────────
    [49, '2026-06-25', '03:00', '小組賽', 'B', 3, 'BIH', '波赫','🇧🇦','QAT', '卡達',       '🇶🇦', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [50, '2026-06-25', '03:00', '小組賽', 'B', 3, 'SUI', '瑞士',   '🇨🇭', 'CAN', '加拿大',     '🇨🇦', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [51, '2026-06-25', '06:00', '小組賽', 'D', 3, 'MAR', '摩洛哥', '🇲🇦', 'HAI', '海地',       '🇭🇹', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [52, '2026-06-25', '06:00', '小組賽', 'D', 3, 'BRA', '巴西',   '🇧🇷', 'SCO', '蘇格蘭',     TEAM_FLAGS_BY_CODE.SCO, '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [53, '2026-06-25', '09:00', '小組賽', 'A', 3, 'MEX', '墨西哥', '🇲🇽', 'CZE', '捷克',       '🇨🇿', '', '', 'upcoming', 'Estadio Banorte',                    '墨西哥城'],
    [54, '2026-06-25', '09:00', '小組賽', 'A', 3, 'KOR', '韓國',   '🇰🇷', 'RSA', '南非',       '🇿🇦', '', '', 'upcoming', 'Estadio BBVA',                       '蒙特雷'],
    [55, '2026-06-26', '04:00', '小組賽', 'E', 3, 'CUW', '古拉索', '🇨🇼', 'CIV', '象牙海岸',   '🇨🇮', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [56, '2026-06-26', '04:00', '小組賽', 'E', 3, 'ECU', '厄瓜多', '🇪🇨', 'GER', '德國',       '🇩🇪', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [57, '2026-06-26', '07:00', '小組賽', 'F', 3, 'JPN', '日本',   '🇯🇵', 'SWE', '瑞典',       '🇸🇪', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [58, '2026-06-26', '07:00', '小組賽', 'F', 3, 'TUN', '突尼西亞','🇹🇳','NED', '荷蘭',       '🇳🇱', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    [59, '2026-06-26', '10:00', '小組賽', 'C', 3, 'PAR', '巴拉圭', '🇵🇾', 'AUS', '澳洲',       '🇦🇺', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [60, '2026-06-26', '10:00', '小組賽', 'C', 3, 'TUR', '土耳其', '🇹🇷', 'USA', '美國',       '🇺🇸', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [61, '2026-06-27', '03:00', '小組賽', 'J', 3, 'NOR', '挪威',   '🇳🇴', 'FRA', '法國',       '🇫🇷', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [62, '2026-06-27', '03:00', '小組賽', 'J', 3, 'IRQ', '伊拉克', '🇮🇶', 'SEN', '塞內加爾',   '🇸🇳', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [63, '2026-06-27', '08:00', '小組賽', 'G', 3, 'CPV', '維德角', '🇨🇻', 'KSA', '沙烏地阿拉伯','🇸🇦','', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [64, '2026-06-27', '08:00', '小組賽', 'G', 3, 'URU', '烏拉圭', '🇺🇾', 'ESP', '西班牙',     '🇪🇸', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    [65, '2026-06-27', '11:00', '小組賽', 'H', 3, 'EGY', '埃及',   '🇪🇬', 'IRN', '伊朗',       '🇮🇷', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [66, '2026-06-27', '11:00', '小組賽', 'H', 3, 'NZL', '紐西蘭', '🇳🇿', 'BEL', '比利時',     '🇧🇪', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [67, '2026-06-28', '05:00', '小組賽', 'K', 3, 'GHA', '迦納',   '🇬🇭', 'CRO', '克羅埃西亞', '🇭🇷', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [68, '2026-06-28', '05:00', '小組賽', 'K', 3, 'PAN', '巴拿馬', '🇵🇦', 'ENG', '英格蘭', TEAM_FLAGS_BY_CODE.ENG, '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [69, '2026-06-28', '07:30', '小組賽', 'L', 3, 'COL', '哥倫比亞','🇨🇴','POR', '葡萄牙',     '🇵🇹', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [70, '2026-06-28', '07:30', '小組賽', 'L', 3, 'UZB', '烏茲別克','🇺🇿','CGO','民主剛果',        '🇨🇩', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [71, '2026-06-28', '10:00', '小組賽', 'I', 3, 'ALG', '阿爾及利亞','🇩🇿','AUT','奧地利',    '🇦🇹', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    [72, '2026-06-28', '10:00', '小組賽', 'I', 3, 'JOR', '約旦',   '🇯🇴', 'ARG', '阿根廷',     '🇦🇷', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    // ── ROUND OF 32 ───────────────────────────────────────────────────────────
    [73,  '2026-06-29', '03:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [74,  '2026-06-30', '01:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [75,  '2026-06-30', '04:30', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [76,  '2026-06-30', '09:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Estadio BBVA',                       '蒙特雷'],
    [77,  '2026-07-01', '01:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [78,  '2026-07-01', '05:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [79,  '2026-07-01', '09:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Estadio Banorte',                    '墨西哥城'],
    [80,  '2026-07-02', '00:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [81,  '2026-07-02', '04:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [82,  '2026-07-02', '08:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [83,  '2026-07-03', '03:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [84,  '2026-07-03', '07:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [85,  '2026-07-03', '11:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [86,  '2026-07-04', '02:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [87,  '2026-07-04', '06:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [88,  '2026-07-04', '09:30', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    // ── ROUND OF 16 ───────────────────────────────────────────────────────────
    [89,  '2026-07-05', '01:00', '16強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [90,  '2026-07-05', '05:00', '16強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [91,  '2026-07-06', '04:00', '16強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [92,  '2026-07-06', '08:00', '16強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Estadio Banorte',                    '墨西哥城'],
    [93,  '2026-07-07', '03:00', '16強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [94,  '2026-07-07', '08:00', '16強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [95,  '2026-07-08', '00:00', '16強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [96,  '2026-07-08', '04:00', '16強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    // ── QUARTER-FINALS ────────────────────────────────────────────────────────
    [97,  '2026-07-10', '04:00', '8強',  '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [98,  '2026-07-11', '03:00', '8強',  '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [99,  '2026-07-12', '05:00', '8強',  '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [100, '2026-07-12', '09:00', '8強',  '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    // ── SEMI-FINALS ───────────────────────────────────────────────────────────
    [101, '2026-07-15', '03:00', '4強',  '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [102, '2026-07-16', '03:00', '4強',  '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    // ── THIRD PLACE ───────────────────────────────────────────────────────────
    [103, '2026-07-19', '05:00', '季軍賽','', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    // ── FINAL ─────────────────────────────────────────────────────────────────
    [104, '2026-07-20', '03:00', '決賽',  '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'MetLife Stadium',                    '紐約']
  ];

  if (data.length > 0) sheet.getRange(2, 1, data.length, 17).setValues(data);
  SpreadsheetApp.getUi().alert('matches 初始化完成，共 ' + data.length + ' 場比賽');
}

// ─── initializeGroups ─────────────────────────
// Run once from the GAS editor to populate the groups sheet.

function initializeGroups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('groups');
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 12).clearContent();

  const data = [
    // [group, team_code, team_name, team_flag, played, win, draw, loss, gf, ga, gd, pts]
    // ── Group A ───────────────────────────────────────────────────────────────
    ['A', 'MEX', '墨西哥', '🇲🇽', 0, 0, 0, 0, 0, 0, 0, 0],
    ['A', 'RSA', '南非',   '🇿🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    ['A', 'KOR', '韓國',   '🇰🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['A', 'CZE', '捷克',   '🇨🇿', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group B ───────────────────────────────────────────────────────────────
    ['B', 'CAN', '加拿大',   '🇨🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    ['B', 'BIH', '波赫', '🇧🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    ['B', 'SUI', '瑞士',     '🇨🇭', 0, 0, 0, 0, 0, 0, 0, 0],
    ['B', 'QAT', '卡達',     '🇶🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group C ───────────────────────────────────────────────────────────────
    ['C', 'USA', '美國',   '🇺🇸', 0, 0, 0, 0, 0, 0, 0, 0],
    ['C', 'PAR', '巴拉圭', '🇵🇾', 0, 0, 0, 0, 0, 0, 0, 0],
    ['C', 'AUS', '澳洲',   '🇦🇺', 0, 0, 0, 0, 0, 0, 0, 0],
    ['C', 'TUR', '土耳其', '🇹🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group D ───────────────────────────────────────────────────────────────
    ['D', 'BRA', '巴西',   '🇧🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['D', 'MAR', '摩洛哥', '🇲🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    ['D', 'HAI', '海地',   '🇭🇹', 0, 0, 0, 0, 0, 0, 0, 0],
    ['D', 'SCO', '蘇格蘭', TEAM_FLAGS_BY_CODE.SCO, 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group E ───────────────────────────────────────────────────────────────
    ['E', 'GER', '德國',     '🇩🇪', 0, 0, 0, 0, 0, 0, 0, 0],
    ['E', 'CIV', '象牙海岸', '🇨🇮', 0, 0, 0, 0, 0, 0, 0, 0],
    ['E', 'ECU', '厄瓜多',   '🇪🇨', 0, 0, 0, 0, 0, 0, 0, 0],
    ['E', 'CUW', '古拉索',   '🇨🇼', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group F ───────────────────────────────────────────────────────────────
    ['F', 'NED', '荷蘭',     '🇳🇱', 0, 0, 0, 0, 0, 0, 0, 0],
    ['F', 'JPN', '日本',     '🇯🇵', 0, 0, 0, 0, 0, 0, 0, 0],
    ['F', 'SWE', '瑞典',     '🇸🇪', 0, 0, 0, 0, 0, 0, 0, 0],
    ['F', 'TUN', '突尼西亞', '🇹🇳', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group G ───────────────────────────────────────────────────────────────
    ['G', 'ESP', '西班牙',     '🇪🇸', 0, 0, 0, 0, 0, 0, 0, 0],
    ['G', 'CPV', '維德角',     '🇨🇻', 0, 0, 0, 0, 0, 0, 0, 0],
    ['G', 'KSA', '沙烏地阿拉伯','🇸🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    ['G', 'URU', '烏拉圭',     '🇺🇾', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group H ───────────────────────────────────────────────────────────────
    ['H', 'BEL', '比利時', '🇧🇪', 0, 0, 0, 0, 0, 0, 0, 0],
    ['H', 'EGY', '埃及',   '🇪🇬', 0, 0, 0, 0, 0, 0, 0, 0],
    ['H', 'IRN', '伊朗',   '🇮🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['H', 'NZL', '紐西蘭', '🇳🇿', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group I ───────────────────────────────────────────────────────────────
    ['I', 'ARG', '阿根廷',     '🇦🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['I', 'ALG', '阿爾及利亞', '🇩🇿', 0, 0, 0, 0, 0, 0, 0, 0],
    ['I', 'AUT', '奧地利',     '🇦🇹', 0, 0, 0, 0, 0, 0, 0, 0],
    ['I', 'JOR', '約旦',       '🇯🇴', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group J ───────────────────────────────────────────────────────────────
    ['J', 'FRA', '法國',     '🇫🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['J', 'SEN', '塞內加爾', '🇸🇳', 0, 0, 0, 0, 0, 0, 0, 0],
    ['J', 'IRQ', '伊拉克',   '🇮🇶', 0, 0, 0, 0, 0, 0, 0, 0],
    ['J', 'NOR', '挪威',     '🇳🇴', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group K ───────────────────────────────────────────────────────────────
    ['K', 'ENG', '英格蘭',   TEAM_FLAGS_BY_CODE.ENG, 0, 0, 0, 0, 0, 0, 0, 0],
    ['K', 'GHA', '迦納',     '🇬🇭', 0, 0, 0, 0, 0, 0, 0, 0],
    ['K', 'PAN', '巴拿馬',   '🇵🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    ['K', 'CRO', '克羅埃西亞','🇭🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group L ───────────────────────────────────────────────────────────────
    ['L', 'POR', '葡萄牙',   '🇵🇹', 0, 0, 0, 0, 0, 0, 0, 0],
    ['L', 'UZB', '烏茲別克', '🇺🇿', 0, 0, 0, 0, 0, 0, 0, 0],
    ['L', 'COL', '哥倫比亞', '🇨🇴', 0, 0, 0, 0, 0, 0, 0, 0],
    ['L', 'CGO', '民主剛果',     '🇨🇩', 0, 0, 0, 0, 0, 0, 0, 0]
  ];

  if (data.length > 0) sheet.getRange(2, 1, data.length, 12).setValues(data);
  SpreadsheetApp.getUi().alert('groups 初始化完成，共 ' + data.length + ' 支球隊');
}
