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
const OFFICIAL_GROUP_BY_CODE_2026 = {
  MEX: 'A', RSA: 'A', KOR: 'A', CZE: 'A',
  CAN: 'B', BIH: 'B', SUI: 'B', QAT: 'B',
  BRA: 'C', MAR: 'C', HAI: 'C', SCO: 'C',
  USA: 'D', PAR: 'D', AUS: 'D', TUR: 'D',
  GER: 'E', CIV: 'E', ECU: 'E', CUW: 'E',
  NED: 'F', JPN: 'F', SWE: 'F', TUN: 'F',
  BEL: 'G', EGY: 'G', IRN: 'G', NZL: 'G',
  ESP: 'H', CPV: 'H', KSA: 'H', URU: 'H',
  FRA: 'I', SEN: 'I', IRQ: 'I', NOR: 'I',
  ARG: 'J', ALG: 'J', AUT: 'J', JOR: 'J',
  POR: 'K', CGO: 'K', UZB: 'K', COL: 'K',
  ENG: 'L', CRO: 'L', GHA: 'L', PAN: 'L'
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
      .addItem('建立/更新 scorers 射手分頁', 'setupScorersSheet')
      .addItem('統一中文譯名', 'normalizeTeamNamesInSheets')
      .addItem('修正 2026 分組字母', 'fixOfficialGroupAssignments2026')
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

function fixOfficialGroupAssignments2026(showAlert) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const matches = ss.getSheetByName('matches');
  const groups = ss.getSheetByName('groups');
  let changed = 0;
  const errors = [];

  if (matches && matches.getLastRow() > 1) {
    const lastRow = matches.getLastRow();
    const rows = matches.getRange(2, 1, lastRow - 1, 18).getValues();
    const groupsCol = rows.map((r, idx) => {
      const currentGroup = String(r[4] || '');
      const homeCode = String(r[6] || '');
      const awayCode = String(r[9] || '');
      const expectedHome = OFFICIAL_GROUP_BY_CODE_2026[homeCode];
      const expectedAway = OFFICIAL_GROUP_BY_CODE_2026[awayCode];
      const nextGroup = expectedHome || currentGroup;

      if (currentGroup && expectedHome && expectedAway && expectedHome !== expectedAway) {
        errors.push(`matches 第 ${idx + 2} 列：${homeCode}/${awayCode} 分屬不同組`);
      }
      if (currentGroup && expectedHome && currentGroup !== nextGroup) changed++;
      return [currentGroup && expectedHome ? nextGroup : currentGroup];
    });
    if (groupsCol.length) matches.getRange(2, 5, groupsCol.length, 1).setValues(groupsCol);
  }

  if (groups && groups.getLastRow() > 1) {
    const lastRow = groups.getLastRow();
    const rows = groups.getRange(2, 1, lastRow - 1, 12).getValues();
    const groupsCol = rows.map(r => {
      const currentGroup = String(r[0] || '');
      const code = String(r[1] || '');
      const nextGroup = OFFICIAL_GROUP_BY_CODE_2026[code] || currentGroup;
      if (currentGroup && nextGroup && currentGroup !== nextGroup) changed++;
      return [nextGroup];
    });
    if (groupsCol.length) groups.getRange(2, 1, groupsCol.length, 1).setValues(groupsCol);
  }

  if (errors.length) throw new Error(errors.join('\n'));

  recalcGroups();
  touchDataVersion();
  try { refreshScoreEditorSheet(false); } catch (_) {}

  if (showAlert !== false) {
    try { SpreadsheetApp.getUi().alert(`2026 分組字母已修正，更新 ${changed} 個儲存格，積分已重算。`); } catch (_) {}
  }
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

  ss.getSheetByName('matches').getRange(1, 1, 1, 20).setValues([[
    'match_id', 'date', 'time_utc8', 'phase', 'group', 'round',
    'home_code', 'home_name', 'home_flag',
    'away_code', 'away_name', 'away_flag',
    'score_home', 'score_away', 'status',
    'venue', 'city', 'manual',
    'pen_home', 'pen_away'
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

// ── Auto Score Sync (ESPN unofficial API — no key required) ──────────
// ESPN's public JSON API covers WC 2026 with no authentication.
// Endpoint: site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
// Run setupSyncTrigger() once to enable 10-minute auto-sync.

// ESPN abbreviation → our internal team code (only differences listed)
const ESPN_CODE_MAP = {
  'BOC': 'BIH',   // Bosnia-Herzegovina
  'CRC': 'CRC',
  'DRC': 'CGO',   // DR Congo
  'HAI': 'HAI',
  'HTI': 'HAI',   // Haiti alternate
  'SCO': 'SCO',
  'SAU': 'KSA',   // Saudi Arabia
  'NZL': 'NZL',
  'CIV': 'CIV',
  'CPV': 'CPV',
  'CUW': 'CUW',
  'ALG': 'ALG',
  'MAR': 'MAR',
  'SEN': 'SEN',
  'IRQ': 'IRQ',
  'UZB': 'UZB',
  'JOR': 'JOR',
  'ECU': 'ECU',
  'PAR': 'PAR',
  'URU': 'URU',
  'PAN': 'PAN',
  'GHA': 'GHA',
  'NOR': 'NOR',
  'COL': 'COL',
  'AUT': 'AUT'
};
function espnCode_(abbr) { return ESPN_CODE_MAP[abbr] || abbr; }

function espnStatusToMatchStatus_(name) {
  const s = String(name || '').toUpperCase();
  if (s === 'STATUS_FULL_TIME' || s === 'STATUS_FINAL' || s.includes('FINAL')) return 'finished';
  if (s === 'STATUS_IN_PROGRESS' || s === 'STATUS_HALFTIME' || s.includes('PLAY')) return 'live';
  return 'upcoming';
}

// Convert UTC ISO string to YYYY-MM-DD in UTC+8
function utcToDate8(utcStr) {
  const d = new Date(new Date(utcStr).getTime() + 8 * 3600000);
  return d.toISOString().slice(0, 10);
}

function syncScores() {
  // Fetch entire WC 2026 group + knockout stage (Jun 12 – Jul 20)
  const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard' +
              '?dates=20260612-20260720&limit=200';

  let resp;
  try {
    resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (err) {
    Logger.log('ESPN fetch error: ' + err.message);
    return;
  }
  if (resp.getResponseCode() !== 200) {
    Logger.log('ESPN API error ' + resp.getResponseCode());
    return;
  }

  const json = JSON.parse(resp.getContentText());
  const events = json.events || [];

  // Build lookup: "CODE1_CODE2" → { home, away, status }
  const byTeams    = {};
  const byDateTeams = {};

  events.forEach(ev => {
    const comp = (ev.competitions || [])[0];
    if (!comp) return;
    const competitors = comp.competitors || [];
    let home, away;
    competitors.forEach(c => {
      const info = { code: espnCode_(c.team.abbreviation), score: c.score, shootout: c.shootoutScore };
      if (c.homeAway === 'home') home = info;
      else                       away = info;
    });
    if (!home || !away) return;

    const statusName = (comp.status && comp.status.type && comp.status.type.name) || '';
    const status     = espnStatusToMatchStatus_(statusName);
    const scoreHome  = (status !== 'upcoming' && home.score !== null && home.score !== '') ? Number(home.score) : null;
    const scoreAway  = (status !== 'upcoming' && away.score !== null && away.score !== '') ? Number(away.score) : null;
    // Penalty shootout: ESPN sends shootoutScore only when a PK shootout occurred.
    const penHome    = (status === 'finished' && home.shootout !== null && home.shootout !== undefined && home.shootout !== '') ? Number(home.shootout) : null;
    const penAway    = (status === 'finished' && away.shootout !== null && away.shootout !== undefined && away.shootout !== '') ? Number(away.shootout) : null;
    const entry = { scoreHome, scoreAway, penHome, penAway, status };
    const d8    = utcToDate8(ev.date);

    byTeams[`${home.code}_${away.code}`]           = entry;
    byDateTeams[`${d8}_${home.code}_${away.code}`] = entry;
  });

  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('matches');
  const rows  = sheet.getDataRange().getValues();

  let updated = 0;
  rows.slice(1).forEach((row, i) => {
    if (!row[0] || !row[6]) return;   // skip empty / knockout TBD rows
    if (row[17] === true)   return;   // manual lock — don't overwrite

    const t1   = String(row[6]);
    const t2   = String(row[9]);
    const date = formatDate(row[1]);
    const m    = byDateTeams[`${date}_${t1}_${t2}`] || byTeams[`${t1}_${t2}`];
    if (!m || m.status === 'upcoming') return;

    const scoreHome = m.scoreHome !== null ? m.scoreHome : row[12];
    const scoreAway = m.scoreAway !== null ? m.scoreAway : row[13];

    // Per-row try/catch: a single bad cell (e.g. a stale data-validation rule
    // rejecting 'live') must not abort the whole sync and strand later rows.
    try {
      sheet.getRange(i + 2, 13, 1, 3).setValues([[scoreHome, scoreAway, m.status]]);
      // Penalty shootout columns (19/20) — only written when ESPN reports a PK result.
      if (m.penHome !== null && m.penAway !== null) {
        sheet.getRange(i + 2, 19, 1, 2).setValues([[m.penHome, m.penAway]]);
      }
      updated++;
    } catch (err) {
      Logger.log(`syncScores: row ${i + 2} (match ${row[0]}) write failed — ${err.message}`);
    }
  });

  Logger.log(`syncScores (ESPN): ${updated} matches updated`);
  if (updated > 0) {
    recalcGroups();
    try { refreshScoreEditorSheet(false); } catch (err) { Logger.log('refreshScoreEditorSheet skipped: ' + err.message); }
    touchDataVersion();
  }
  syncBracket();
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

  // Advance knockout winners (and SF losers → 3rd place) through the bracket.
  // Sources are read from the freshly-loaded sheet rows, so each finished round
  // feeds the next; rounds not yet played leave their downstream slots blank.
  const rowById = {};
  rows.forEach((row, i) => {
    const id = Number(row[0]);
    if (id && i > 0) rowById[id] = { row, sheetRow: i + 1 };
  });
  const feed = getKnockoutFeed_();
  Object.keys(feed).forEach(idStr => {
    const id = Number(idStr);
    const entry = rowById[id];
    if (!entry) return;
    const next = planKnockoutRowUpdate_(entry.row, feed[id], rowById);
    if (!next) return; // manual lock
    const current = entry.row.slice(6, 12).map(v => String(v || ''));
    if (current.every((v, idx) => v === String(next[idx] || ''))) return;
    mSheet.getRange(entry.sheetRow, 7, 1, 6).setValues([next]);
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

// Knockout advancement tree (downstream match_id → which upstream match's
// Winner/Loser fills its home/away slot). Verified against the official FIFA
// 2026 bracket by venue: R32→R16 feed anchored to the resolved fixtures at
// each stadium; R16→QF→SF→Final and SF-losers→3rd are the fixed FIFA topology.
function getKnockoutFeed_() {
  const W = id => ({ match: id, take: 'W' });
  const L = id => ({ match: id, take: 'L' });
  return {
    89: { home: W(73), away: W(76) },
    90: { home: W(75), away: W(78) },
    91: { home: W(74), away: W(77) },
    92: { home: W(79), away: W(80) },
    93: { home: W(84), away: W(83) },
    94: { home: W(82), away: W(81) },
    95: { home: W(87), away: W(86) },
    96: { home: W(85), away: W(88) },
    97: { home: W(89), away: W(90) },
    98: { home: W(93), away: W(94) },
    99: { home: W(91), away: W(92) },
    100: { home: W(95), away: W(96) },
    101: { home: W(97), away: W(98) },
    102: { home: W(99), away: W(100) },
    103: { home: L(101), away: L(102) },
    104: { home: W(101), away: W(102) }
  };
}

// Determine winner/loser team cells [code, name, flag] of a finished knockout
// match row. Returns null when the match is not finished, scores are missing,
// or either team is still TBD. A level score is resolved by the penalty
// shootout columns (19/20) when present; if pens are absent or also level the
// draw can't be auto-resolved, so it's left for a manual override.
function knockoutOutcome_(row) {
  if (!row || String(row[14]) !== 'finished') return null;
  const s1 = row[12], s2 = row[13];
  if (s1 === '' || s1 === null || s1 === undefined) return null;
  if (s2 === '' || s2 === null || s2 === undefined) return null;
  const home = [String(row[6] || ''), String(row[7] || ''), String(row[8] || '')];
  const away = [String(row[9] || ''), String(row[10] || ''), String(row[11] || '')];
  if (!home[0] || !away[0]) return null;
  const n1 = Number(s1), n2 = Number(s2);
  if (isNaN(n1) || isNaN(n2)) return null;
  if (n1 !== n2) return n1 > n2 ? { winner: home, loser: away } : { winner: away, loser: home };
  // Level after regulation/extra time — decide by penalty shootout if recorded.
  const p1 = row[18], p2 = row[19];
  if (p1 === '' || p1 === null || p1 === undefined) return null;
  if (p2 === '' || p2 === null || p2 === undefined) return null;
  const np1 = Number(p1), np2 = Number(p2);
  if (isNaN(np1) || isNaN(np2) || np1 === np2) return null;
  return np1 > np2 ? { winner: home, loser: away } : { winner: away, loser: home };
}

// Plan the six team cells for a downstream knockout row from its feed entry.
// A manually locked row returns null; an unresolved feeder yields a blank triple.
function planKnockoutRowUpdate_(row, feed, rowById) {
  if (row[17] === true) return null;
  function side(src) {
    const entry = src && rowById[src.match];
    const outcome = entry && knockoutOutcome_(entry.row);
    if (!outcome) return ['', '', ''];
    return src.take === 'W' ? outcome.winner : outcome.loser;
  }
  return side(feed.home).concat(side(feed.away));
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
    73: ['2A', '2B'],      74: ['1C', '2F'],
    75: ['1E', '3 ABCDF'], 76: ['1F', '2C'],
    77: ['2E', '2I'],      78: ['1I', '3 CDFGH'],
    79: ['1A', '3 CEFHI'], 80: ['1L', '3 EHIJK'],
    81: ['1G', '3 AEHIJ'], 82: ['1D', '3 BEFIJ'],
    83: ['1H', '2J'],      84: ['2K', '2L'],
    85: ['1B', '3 EFGIJ'], 86: ['2D', '2G'],
    87: ['1J', '2H'],      88: ['1K', '3 DEIJL']
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
  const msg = 'Done — syncScores will run every 10 minutes.';
  Logger.log(msg);
  // getUi() only works when bound to the spreadsheet UI; ignore when run from
  // the script editor or a trigger.
  try { SpreadsheetApp.getUi().alert(msg); } catch (_) {}
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
      case 'getTopScorers': result = getTopScorers();               break;
      case 'getScorerRace': result = getScorerRace();               break;
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

    // Penalty shootout (knockout only). Empty string clears the cell.
    if (d.pen1 !== undefined)
      sheet.getRange(i + 1, 19).setValue(d.pen1 === '' ? '' : Number(d.pen1));
    if (d.pen2 !== undefined)
      sheet.getRange(i + 1, 20).setValue(d.pen2 === '' ? '' : Number(d.pen2));

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

  // Penalty shootout (knockout only). Empty string clears the cell.
  if (p.pen1 !== undefined)
    sheet.getRange(i + 1, 19).setValue(p.pen1 === '' ? '' : Number(p.pen1));
  if (p.pen2 !== undefined)
    sheet.getRange(i + 1, 20).setValue(p.pen2 === '' ? '' : Number(p.pen2));

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
  params = params || {};
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
      city:   String(r[16] || ''),
      pen1:   toScore(r[18]),
      pen2:   toScore(r[19])
    }));

  if (params.date)  data = data.filter(m => m.date === params.date);
  if (params.phase) data = data.filter(m => m.phase === params.phase);

  // ── Bracket display order ──────────────────────────────────────────────
  // R16 matches must arrive in visual-bracket order so bracket.html's
  // r16.slice(0,4) / slice(4,8) splits into the correct left/right halves:
  //   Left  (feeds QF97 Jul-10, QF98 Jul-11): 89,90,94,93
  //   Right (feeds QF99 Jul-12, QF100 Jul-12): 91,92,96,95
  const R16_BRACKET_ORDER = [89,90,94,93,91,92,96,95];
  const r16Rank = {};
  R16_BRACKET_ORDER.forEach((id, i) => { r16Rank[id] = i; });
  const hasR16 = data.some(m => m.phase === '16強');
  if (hasR16) {
    const pre  = data.filter(m => m.phase !== '16強');
    const r16  = data.filter(m => m.phase === '16強')
                     .sort((a, b) => (r16Rank[a.match_id] ?? 99) - (r16Rank[b.match_id] ?? 99));
    const firstR16Idx = pre.findIndex(m => m.match_id > 88);
    const insertAt = firstR16Idx >= 0 ? firstR16Idx : pre.length;
    data = [...pre.slice(0, insertAt), ...r16, ...pre.slice(insertAt)];
  }

  return {
    status:  'ok',
    updated: getDataVersion(),
    data
  };
}

// ─── getGroups ────────────────────────────────

function getGroups(params) {
  params = params || {};
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

// Short-lived script cache so repeat loads don't re-read (and re-scan) the
// spreadsheet on every request. touchDataVersion() clears these keys the moment
// a score edit happens; the TTL is the backstop for direct hand-edits to the
// scorers / career tabs, which don't go through touchDataVersion().
function withScriptCache_(key, ttlSeconds, producer) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (_) {}
  }
  const value = producer();
  try { cache.put(key, JSON.stringify(value), ttlSeconds); } catch (_) {}
  return value;
}

function getTopScorers() {
  return withScriptCache_('top_scorers', 30, computeTopScorers_);
}
function computeTopScorers_() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('scorers');
  if (!sheet) return { status: 'ok', updated: getDataVersion(), data: [] };

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { status: 'ok', updated: getDataVersion(), data: [] };

  // rows[0] = header: match_id, player_name, player_code, goals
  const byCode = {};
  for (let i = 1; i < rows.length; i++) {
    const [match_id, player_name, player_code, goals] = rows[i];
    if (!player_code) continue;
    const code = String(player_code).trim();
    if (!byCode[code]) {
      byCode[code] = { player_name: String(player_name), player_code: code, goals_2026: [], total_goals_2026: 0, matches_played_2026: 0 };
    }
    const g = Number(goals) || 0;
    byCode[code].goals_2026.push({ match_id: Number(match_id), goals: g });
    byCode[code].total_goals_2026 += g;
    byCode[code].matches_played_2026 += 1;
  }

  return { status: 'ok', updated: getDataVersion(), data: Object.values(byCode) };
}

// ── Full scorer-career feed for the data-driven race / bars / lines charts ──
// Reads the rich career tab (one row per player-per-tournament). The tab is
// located by header signature (`player_id` + `goals_added`) so it works even if
// the tab is renamed. Rows are grouped by player_id and returned sorted by
// display_order, each with a career[] sorted by year. The frontend filters to
// 2026 participants and maps colours/flags locally.
function getScorerRace() {
  return withScriptCache_('scorer_race', 30, computeScorerRace_);
}
function computeScorerRace_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = null;
  for (const sh of ss.getSheets()) {
    const lastCol = sh.getLastColumn();
    if (lastCol < 2) continue;
    const hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    if (hdr.indexOf('player_id') >= 0 && hdr.indexOf('goals_added') >= 0) { sheet = sh; break; }
  }
  if (!sheet) return { status: 'ok', updated: getDataVersion(), data: [] };

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { status: 'ok', updated: getDataVersion(), data: [] };

  const header = rows[0].map(h => String(h).trim());
  const col = name => header.indexOf(name);
  const ci = {
    id: col('player_id'), zh: col('player_name_zh'), en: col('player_name_en'),
    cc: col('country_code'), cn: col('country_name_zh'),
    year: col('year'), ga: col('goals_added'), cum: col('cumulative_goals'),
    role: col('series_role'), order: col('display_order'), proj: col('is_projected'),
  };

  const byId = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = String(r[ci.id] || '').trim();
    if (!id) continue;
    const year = Number(r[ci.year]) || 0;
    if (!year) continue;
    if (!byId[id]) {
      byId[id] = {
        player_id: id,
        name_zh: String(r[ci.zh] || ''),
        name_en: String(r[ci.en] || ''),
        country_code: String(r[ci.cc] || ''),
        country_name_zh: String(r[ci.cn] || ''),
        series_role: ci.role >= 0 ? String(r[ci.role] || '') : '',
        display_order: ci.order >= 0 ? (Number(r[ci.order]) || 999) : 999,
        career: [],
      };
    }
    byId[id].career.push({
      year: year,
      goals: Number(r[ci.ga]) || 0,
      cumulative: ci.cum >= 0 ? (Number(r[ci.cum]) || 0) : 0,
      is_projected: ci.proj >= 0 ? String(r[ci.proj]).toUpperCase() === 'TRUE' : false,
    });
  }

  const data = Object.values(byId);
  data.forEach(p => p.career.sort((a, b) => a.year - b.year));
  data.sort((a, b) => a.display_order - b.display_order);
  return { status: 'ok', updated: getDataVersion(), data: data };
}

// Create or refresh the `scorers` tab that getTopScorers() reads for live 2026
// goals. Header: match_id, player_name, player_code, goals — one row per
// player-per-match goal tally. Existing data rows are preserved; only the
// header, formatting and validation are (re)applied. player_code is limited to
// the four active players whose 2026 goals merge into wc2026-scorers.html.
function setupScorersSheet(showAlert) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const headers = ['match_id', 'player_name', 'player_code', 'goals'];
  let sheet = ss.getSheetByName('scorers');
  if (!sheet) sheet = ss.insertSheet('scorers');

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#0f4b8f')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  const n = Math.max(sheet.getMaxRows() - 1, 1);
  const posInt = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThan(0).setAllowInvalid(false)
    .setHelpText('正整數').build();
  const goalsRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(1).setAllowInvalid(false)
    .setHelpText('整數，至少 1').build();
  const codeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['mbappe', 'messi', 'ronaldo', 'kane'], true).setAllowInvalid(false).build();

  sheet.getRange(2, 1, n, 1).setDataValidation(posInt);    // match_id
  sheet.getRange(2, 3, n, 1).setDataValidation(codeRule);  // player_code
  sheet.getRange(2, 4, n, 1).setDataValidation(goalsRule); // goals

  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(2, 160); // player_name

  const msg = 'scorers 射手分頁已建立／更新。欄位：match_id, player_name, player_code, goals。' +
    'player_code 僅允許 mbappe / messi / ronaldo / kane，每列一名球員在一場比賽的進球數。';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (_) {}
  return sheet;
}

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
  ['matches_all', 'groups_all', 'config_all', 'top_scorers', 'scorer_race'].forEach(key => cache.remove(key));
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
    [1,  '2026-06-12', '03:00', '小組賽', 'A', 1, 'MEX', '墨西哥', '🇲🇽', 'RSA', '南非',       '🇿🇦', '', '', 'upcoming', 'Estadio Azteca',                    '墨西哥城'],
    [2,  '2026-06-12', '10:00', '小組賽', 'A', 1, 'KOR', '韓國',   '🇰🇷', 'CZE', '捷克',       '🇨🇿', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    [3,  '2026-06-13', '03:00', '小組賽', 'B', 1, 'CAN', '加拿大', '🇨🇦', 'BIH', '波赫',   '🇧🇦', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [4,  '2026-06-13', '09:00', '小組賽', 'D', 1, 'USA', '美國',   '🇺🇸', 'PAR', '巴拉圭',     '🇵🇾', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [5,  '2026-06-14', '03:00', '小組賽', 'B', 1, 'QAT', '卡達',   '🇶🇦', 'SUI', '瑞士',       '🇨🇭', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [6,  '2026-06-14', '06:00', '小組賽', 'C', 1, 'BRA', '巴西',   '🇧🇷', 'MAR', '摩洛哥',     '🇲🇦', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [7,  '2026-06-14', '09:00', '小組賽', 'C', 1, 'HAI', '海地',   '🇭🇹', 'SCO', '蘇格蘭',     TEAM_FLAGS_BY_CODE.SCO, '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [8,  '2026-06-14', '12:00', '小組賽', 'D', 1, 'AUS', '澳洲',   '🇦🇺', 'TUR', '土耳其',     '🇹🇷', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [9,  '2026-06-15', '01:00', '小組賽', 'E', 1, 'GER', '德國',   '🇩🇪', 'CUW', '古拉索',     '🇨🇼', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [10, '2026-06-15', '04:00', '小組賽', 'F', 1, 'NED', '荷蘭',   '🇳🇱', 'JPN', '日本',       '🇯🇵', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [11, '2026-06-15', '07:00', '小組賽', 'E', 1, 'CIV', '象牙海岸','🇨🇮', 'ECU', '厄瓜多',     '🇪🇨', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [12, '2026-06-15', '10:00', '小組賽', 'F', 1, 'SWE', '瑞典',   '🇸🇪', 'TUN', '突尼西亞',   '🇹🇳', '', '', 'upcoming', 'Estadio BBVA',                       '蒙特雷'],
    [13, '2026-06-16', '00:00', '小組賽', 'H', 1, 'ESP', '西班牙', '🇪🇸', 'CPV', '維德角',     '🇨🇻', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [14, '2026-06-16', '03:00', '小組賽', 'G', 1, 'BEL', '比利時', '🇧🇪', 'EGY', '埃及',       '🇪🇬', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [15, '2026-06-16', '06:00', '小組賽', 'H', 1, 'KSA', '沙烏地阿拉伯','🇸🇦','URU','烏拉圭',  '🇺🇾', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [16, '2026-06-16', '09:00', '小組賽', 'G', 1, 'IRN', '伊朗',   '🇮🇷', 'NZL', '紐西蘭',     '🇳🇿', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [17, '2026-06-17', '03:00', '小組賽', 'I', 1, 'FRA', '法國',   '🇫🇷', 'SEN', '塞內加爾',   '🇸🇳', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [18, '2026-06-17', '06:00', '小組賽', 'I', 1, 'IRQ', '伊拉克', '🇮🇶', 'NOR', '挪威',       '🇳🇴', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [19, '2026-06-17', '09:00', '小組賽', 'J', 1, 'ARG', '阿根廷', '🇦🇷', 'ALG', '阿爾及利亞', '🇩🇿', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    [20, '2026-06-17', '12:00', '小組賽', 'J', 1, 'AUT', '奧地利', '🇦🇹', 'JOR', '約旦',       '🇯🇴', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [21, '2026-06-18', '01:00', '小組賽', 'K', 1, 'POR', '葡萄牙', '🇵🇹', 'CGO', '民主剛果',       '🇨🇩', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [22, '2026-06-18', '04:00', '小組賽', 'L', 1, 'ENG', '英格蘭', TEAM_FLAGS_BY_CODE.ENG, 'CRO', '克羅埃西亞', '🇭🇷', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [23, '2026-06-18', '07:00', '小組賽', 'L', 1, 'GHA', '迦納',   '🇬🇭', 'PAN', '巴拿馬',     '🇵🇦', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [24, '2026-06-18', '10:00', '小組賽', 'K', 1, 'UZB', '烏茲別克','🇺🇿','COL', '哥倫比亞',   '🇨🇴', '', '', 'upcoming', 'Estadio Azteca',                    '墨西哥城'],
    // ── GROUP STAGE - MATCHDAY 2 ──────────────────────────────────────────────
    [25, '2026-06-19', '00:00', '小組賽', 'A', 2, 'CZE', '捷克',   '🇨🇿', 'RSA', '南非',       '🇿🇦', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [26, '2026-06-19', '03:00', '小組賽', 'B', 2, 'SUI', '瑞士',   '🇨🇭', 'BIH', '波赫',   '🇧🇦', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [27, '2026-06-19', '06:00', '小組賽', 'B', 2, 'CAN', '加拿大', '🇨🇦', 'QAT', '卡達',       '🇶🇦', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [28, '2026-06-19', '09:00', '小組賽', 'A', 2, 'MEX', '墨西哥', '🇲🇽', 'KOR', '韓國',       '🇰🇷', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    [29, '2026-06-20', '03:00', '小組賽', 'D', 2, 'USA', '美國',   '🇺🇸', 'AUS', '澳洲',       '🇦🇺', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [30, '2026-06-20', '06:00', '小組賽', 'C', 2, 'SCO', '蘇格蘭',     TEAM_FLAGS_BY_CODE.SCO, 'MAR', '摩洛哥',     '🇲🇦', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [31, '2026-06-20', '08:30', '小組賽', 'C', 2, 'BRA', '巴西',   '🇧🇷', 'HAI', '海地',       '🇭🇹', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [32, '2026-06-20', '11:00', '小組賽', 'D', 2, 'TUR', '土耳其', '🇹🇷', 'PAR', '巴拉圭',     '🇵🇾', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [33, '2026-06-21', '01:00', '小組賽', 'F', 2, 'NED', '荷蘭',   '🇳🇱', 'SWE', '瑞典',       '🇸🇪', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [34, '2026-06-21', '04:00', '小組賽', 'E', 2, 'GER', '德國',   '🇩🇪', 'CIV', '象牙海岸',   '🇨🇮', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [35, '2026-06-21', '08:00', '小組賽', 'E', 2, 'ECU', '厄瓜多', '🇪🇨', 'CUW', '古拉索',     '🇨🇼', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    [36, '2026-06-21', '12:00', '小組賽', 'F', 2, 'TUN', '突尼西亞','🇹🇳','JPN', '日本',       '🇯🇵', '', '', 'upcoming', 'Estadio BBVA',                       '蒙特雷'],
    [37, '2026-06-22', '00:00', '小組賽', 'H', 2, 'ESP', '西班牙', '🇪🇸', 'KSA', '沙烏地阿拉伯','🇸🇦','', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [38, '2026-06-22', '03:00', '小組賽', 'G', 2, 'BEL', '比利時', '🇧🇪', 'IRN', '伊朗',       '🇮🇷', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [39, '2026-06-22', '06:00', '小組賽', 'H', 2, 'URU', '烏拉圭', '🇺🇾', 'CPV', '維德角',     '🇨🇻', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [40, '2026-06-22', '09:00', '小組賽', 'G', 2, 'EGY', '埃及',   '🇪🇬', 'NZL', '紐西蘭',     '🇳🇿', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [41, '2026-06-23', '01:00', '小組賽', 'J', 2, 'ARG', '阿根廷', '🇦🇷', 'AUT', '奧地利',     '🇦🇹', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [42, '2026-06-23', '05:00', '小組賽', 'I', 2, 'FRA', '法國',   '🇫🇷', 'IRQ', '伊拉克',     '🇮🇶', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [43, '2026-06-23', '08:00', '小組賽', 'I', 2, 'SEN', '塞內加爾','🇸🇳','NOR', '挪威',       '🇳🇴', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [44, '2026-06-23', '11:00', '小組賽', 'J', 2, 'ALG', '阿爾及利亞','🇩🇿','JOR','約旦',      '🇯🇴', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [45, '2026-06-24', '01:00', '小組賽', 'K', 2, 'POR', '葡萄牙', '🇵🇹', 'UZB', '烏茲別克',   '🇺🇿', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [46, '2026-06-24', '04:00', '小組賽', 'L', 2, 'ENG', '英格蘭', TEAM_FLAGS_BY_CODE.ENG, 'GHA', '迦納',       '🇬🇭', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [47, '2026-06-24', '07:00', '小組賽', 'L', 2, 'CRO', '克羅埃西亞','🇭🇷','PAN','巴拿馬',    '🇵🇦', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [48, '2026-06-24', '10:00', '小組賽', 'K', 2, 'COL', '哥倫比亞','🇨🇴','CGO','民主剛果',        '🇨🇩', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    // ── GROUP STAGE - MATCHDAY 3 ──────────────────────────────────────────────
    [49, '2026-06-25', '03:00', '小組賽', 'B', 3, 'BIH', '波赫','🇧🇦','QAT', '卡達',       '🇶🇦', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [50, '2026-06-25', '03:00', '小組賽', 'B', 3, 'SUI', '瑞士',   '🇨🇭', 'CAN', '加拿大',     '🇨🇦', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [51, '2026-06-25', '06:00', '小組賽', 'C', 3, 'MAR', '摩洛哥', '🇲🇦', 'HAI', '海地',       '🇭🇹', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [52, '2026-06-25', '06:00', '小組賽', 'C', 3, 'BRA', '巴西',   '🇧🇷', 'SCO', '蘇格蘭',     TEAM_FLAGS_BY_CODE.SCO, '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [53, '2026-06-25', '09:00', '小組賽', 'A', 3, 'MEX', '墨西哥', '🇲🇽', 'CZE', '捷克',       '🇨🇿', '', '', 'upcoming', 'Estadio Azteca',                    '墨西哥城'],
    [54, '2026-06-25', '09:00', '小組賽', 'A', 3, 'KOR', '韓國',   '🇰🇷', 'RSA', '南非',       '🇿🇦', '', '', 'upcoming', 'Estadio BBVA',                       '蒙特雷'],
    [55, '2026-06-26', '04:00', '小組賽', 'E', 3, 'CUW', '古拉索', '🇨🇼', 'CIV', '象牙海岸',   '🇨🇮', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [56, '2026-06-26', '04:00', '小組賽', 'E', 3, 'ECU', '厄瓜多', '🇪🇨', 'GER', '德國',       '🇩🇪', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [57, '2026-06-26', '07:00', '小組賽', 'F', 3, 'JPN', '日本',   '🇯🇵', 'SWE', '瑞典',       '🇸🇪', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [58, '2026-06-26', '07:00', '小組賽', 'F', 3, 'TUN', '突尼西亞','🇹🇳','NED', '荷蘭',       '🇳🇱', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    [59, '2026-06-26', '10:00', '小組賽', 'D', 3, 'PAR', '巴拉圭', '🇵🇾', 'AUS', '澳洲',       '🇦🇺', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [60, '2026-06-26', '10:00', '小組賽', 'D', 3, 'TUR', '土耳其', '🇹🇷', 'USA', '美國',       '🇺🇸', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [61, '2026-06-27', '03:00', '小組賽', 'I', 3, 'NOR', '挪威',   '🇳🇴', 'FRA', '法國',       '🇫🇷', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [62, '2026-06-27', '03:00', '小組賽', 'I', 3, 'IRQ', '伊拉克', '🇮🇶', 'SEN', '塞內加爾',   '🇸🇳', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [63, '2026-06-27', '08:00', '小組賽', 'H', 3, 'CPV', '維德角', '🇨🇻', 'KSA', '沙烏地阿拉伯','🇸🇦','', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [64, '2026-06-27', '08:00', '小組賽', 'H', 3, 'URU', '烏拉圭', '🇺🇾', 'ESP', '西班牙',     '🇪🇸', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    [65, '2026-06-27', '11:00', '小組賽', 'G', 3, 'EGY', '埃及',   '🇪🇬', 'IRN', '伊朗',       '🇮🇷', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [66, '2026-06-27', '11:00', '小組賽', 'G', 3, 'NZL', '紐西蘭', '🇳🇿', 'BEL', '比利時',     '🇧🇪', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [67, '2026-06-28', '05:00', '小組賽', 'L', 3, 'GHA', '迦納',   '🇬🇭', 'CRO', '克羅埃西亞', '🇭🇷', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [68, '2026-06-28', '05:00', '小組賽', 'L', 3, 'PAN', '巴拿馬', '🇵🇦', 'ENG', '英格蘭', TEAM_FLAGS_BY_CODE.ENG, '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [69, '2026-06-28', '07:30', '小組賽', 'K', 3, 'COL', '哥倫比亞','🇨🇴','POR', '葡萄牙',     '🇵🇹', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [70, '2026-06-28', '07:30', '小組賽', 'K', 3, 'UZB', '烏茲別克','🇺🇿','CGO','民主剛果',        '🇨🇩', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [71, '2026-06-28', '10:00', '小組賽', 'J', 3, 'ALG', '阿爾及利亞','🇩🇿','AUT','奧地利',    '🇦🇹', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
    [72, '2026-06-28', '10:00', '小組賽', 'J', 3, 'JOR', '約旦',   '🇯🇴', 'ARG', '阿根廷',     '🇦🇷', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    // ── ROUND OF 32 ───────────────────────────────────────────────────────────
    [73,  '2026-06-29', '03:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [74,  '2026-06-30', '01:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [75,  '2026-06-30', '04:30', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [76,  '2026-06-30', '09:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Estadio BBVA',                       '蒙特雷'],
    [77,  '2026-07-01', '01:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [78,  '2026-07-01', '05:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [79,  '2026-07-01', '09:00', '32強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Estadio Azteca',                    '墨西哥城'],
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
    [92,  '2026-07-06', '08:00', '16強', '', 0, '', '', '', '', '', '', '', '', 'upcoming', 'Estadio Azteca',                    '墨西哥城'],
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
    ['C', 'BRA', '巴西',   '🇧🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['C', 'MAR', '摩洛哥', '🇲🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    ['C', 'HAI', '海地',   '🇭🇹', 0, 0, 0, 0, 0, 0, 0, 0],
    ['C', 'SCO', '蘇格蘭', TEAM_FLAGS_BY_CODE.SCO, 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group D ───────────────────────────────────────────────────────────────
    ['D', 'USA', '美國',   '🇺🇸', 0, 0, 0, 0, 0, 0, 0, 0],
    ['D', 'PAR', '巴拉圭', '🇵🇾', 0, 0, 0, 0, 0, 0, 0, 0],
    ['D', 'AUS', '澳洲',   '🇦🇺', 0, 0, 0, 0, 0, 0, 0, 0],
    ['D', 'TUR', '土耳其', '🇹🇷', 0, 0, 0, 0, 0, 0, 0, 0],
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
    ['G', 'BEL', '比利時', '🇧🇪', 0, 0, 0, 0, 0, 0, 0, 0],
    ['G', 'EGY', '埃及',   '🇪🇬', 0, 0, 0, 0, 0, 0, 0, 0],
    ['G', 'IRN', '伊朗',   '🇮🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['G', 'NZL', '紐西蘭', '🇳🇿', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group H ───────────────────────────────────────────────────────────────
    ['H', 'ESP', '西班牙',     '🇪🇸', 0, 0, 0, 0, 0, 0, 0, 0],
    ['H', 'CPV', '維德角',     '🇨🇻', 0, 0, 0, 0, 0, 0, 0, 0],
    ['H', 'KSA', '沙烏地阿拉伯','🇸🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    ['H', 'URU', '烏拉圭',     '🇺🇾', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group I ───────────────────────────────────────────────────────────────
    ['I', 'FRA', '法國',     '🇫🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['I', 'SEN', '塞內加爾', '🇸🇳', 0, 0, 0, 0, 0, 0, 0, 0],
    ['I', 'IRQ', '伊拉克',   '🇮🇶', 0, 0, 0, 0, 0, 0, 0, 0],
    ['I', 'NOR', '挪威',     '🇳🇴', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group J ───────────────────────────────────────────────────────────────
    ['J', 'ARG', '阿根廷',     '🇦🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['J', 'ALG', '阿爾及利亞', '🇩🇿', 0, 0, 0, 0, 0, 0, 0, 0],
    ['J', 'AUT', '奧地利',     '🇦🇹', 0, 0, 0, 0, 0, 0, 0, 0],
    ['J', 'JOR', '約旦',       '🇯🇴', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group K ───────────────────────────────────────────────────────────────
    ['K', 'POR', '葡萄牙',   '🇵🇹', 0, 0, 0, 0, 0, 0, 0, 0],
    ['K', 'UZB', '烏茲別克', '🇺🇿', 0, 0, 0, 0, 0, 0, 0, 0],
    ['K', 'COL', '哥倫比亞', '🇨🇴', 0, 0, 0, 0, 0, 0, 0, 0],
    ['K', 'CGO', '民主剛果',     '🇨🇩', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group L ───────────────────────────────────────────────────────────────
    ['L', 'ENG', '英格蘭',   TEAM_FLAGS_BY_CODE.ENG, 0, 0, 0, 0, 0, 0, 0, 0],
    ['L', 'CRO', '克羅埃西亞','🇭🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    ['L', 'GHA', '迦納',     '🇬🇭', 0, 0, 0, 0, 0, 0, 0, 0],
    ['L', 'PAN', '巴拿馬',   '🇵🇦', 0, 0, 0, 0, 0, 0, 0, 0]
  ];

  if (data.length > 0) sheet.getRange(2, 1, data.length, 12).setValues(data);
  SpreadsheetApp.getUi().alert('groups 初始化完成，共 ' + data.length + ' 支球隊');
}

// ─── importGroupStageResults ──────────────────
// 一鍵匯入 2026 小組賽全部比分（第 1–72 場），
// 並自動算出積分榜 + 填入 32 強對陣（第 73–88 場）。
// 在 Apps Script 編輯器執行一次即可；執行後無需再跑 syncScores。
function importGroupStageResults() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('matches');
  const rows  = sheet.getDataRange().getValues();

  // [match_id]: [score_home, score_away]
  const SCORES = {
     1:[2,0],  2:[2,1],  3:[1,1],  4:[4,1],  5:[1,1],  6:[1,1],
     7:[0,1],  8:[2,0],  9:[7,1], 10:[2,2], 11:[1,0], 12:[5,1],
    13:[0,0], 14:[1,1], 15:[1,1], 16:[2,2], 17:[3,1], 18:[1,4],
    19:[3,0], 20:[3,1], 21:[1,1], 22:[4,2], 23:[1,0], 24:[1,3],
    25:[1,1], 26:[4,1], 27:[6,0], 28:[1,0], 29:[2,0], 30:[0,1],
    31:[3,0], 32:[0,1], 33:[5,1], 34:[2,1], 35:[0,0], 36:[0,4],
    37:[4,0], 38:[0,0], 39:[2,2], 40:[3,1], 41:[2,0], 42:[3,0],
    43:[2,3], 44:[2,1], 45:[5,0], 46:[0,0], 47:[1,0], 48:[1,0],
    49:[3,1], 50:[3,1], 51:[4,2], 52:[3,0], 53:[3,0], 54:[0,1],
    55:[0,2], 56:[2,1], 57:[1,1], 58:[1,3], 59:[0,0], 60:[3,2],
    61:[1,4], 62:[0,5], 63:[0,0], 64:[0,1], 65:[1,1], 66:[1,5],
    67:[1,2], 68:[0,2], 69:[0,0], 70:[1,3], 71:[3,3], 72:[1,3]
  };

  // R32 teams: [home_code, home_name, home_flag, away_code, away_name, away_flag]
  // Venue-based mapping verified against official FIFA bracket (Wikipedia 2026 knockout stage)
  const R32 = {
    73: ['RSA','南非','🇿🇦','CAN','加拿大','🇨🇦'],
    74: ['BRA','巴西','🇧🇷','JPN','日本','🇯🇵'],
    75: ['GER','德國','🇩🇪','PAR','巴拉圭','🇵🇾'],
    76: ['NED','荷蘭','🇳🇱','MAR','摩洛哥','🇲🇦'],
    77: ['CIV','象牙海岸','🇨🇮','NOR','挪威','🇳🇴'],
    78: ['FRA','法國','🇫🇷','SWE','瑞典','🇸🇪'],
    79: ['MEX','墨西哥','🇲🇽','ECU','厄瓜多','🇪🇨'],
    80: ['ENG','英格蘭',String.fromCodePoint(0x1f3f4,0xe0067,0xe0062,0xe0065,0xe006e,0xe0067,0xe007f),'CGO','民主剛果','🇨🇩'],
    81: ['BEL','比利時','🇧🇪','SEN','塞內加爾','🇸🇳'],
    82: ['USA','美國','🇺🇸','BIH','波赫','🇧🇦'],
    83: ['ESP','西班牙','🇪🇸','AUT','奧地利','🇦🇹'],
    84: ['POR','葡萄牙','🇵🇹','CRO','克羅埃西亞','🇭🇷'],
    85: ['SUI','瑞士','🇨🇭','ALG','阿爾及利亞','🇩🇿'],
    86: ['AUS','澳洲','🇦🇺','EGY','埃及','🇪🇬'],
    87: ['ARG','阿根廷','🇦🇷','CPV','維德角','🇨🇻'],
    88: ['COL','哥倫比亞','🇨🇴','GHA','迦納','🇬🇭']
  };

  const rowById = {};
  rows.forEach((r, idx) => {
    if (idx > 0 && r[0] !== '' && r[0] !== null) rowById[Number(r[0])] = idx + 1;
  });

  // Write group stage scores
  Object.entries(SCORES).forEach(([id, s]) => {
    const rowNum = rowById[Number(id)];
    if (!rowNum) return;
    sheet.getRange(rowNum, 13, 1, 3).setValues([[s[0], s[1], 'finished']]);
    sheet.getRange(rowNum, 18).setValue(true); // manual lock
  });

  // Write R32 teams
  Object.entries(R32).forEach(([id, t]) => {
    const rowNum = rowById[Number(id)];
    if (!rowNum) return;
    sheet.getRange(rowNum, 7, 1, 6).setValues([[t[0], t[1], t[2], t[3], t[4], t[5]]]);
    sheet.getRange(rowNum, 18).setValue(true);
  });

  recalcGroups();
  touchDataVersion();

  try {
    SpreadsheetApp.getUi().alert('✅ 小組賽 72 場比分 + 32 強 16 組對陣已寫入完成，積分榜已重算。');
  } catch (_) {}
  Logger.log('importGroupStageResults: done');
}
