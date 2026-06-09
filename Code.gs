// ── 部署時修改這裡 ───────────────────────────
const SHEET_ID = '1YDuNRBGTx5Jw3kZBYehlYUW4eIFPClDIC91TR_720js';
// ────────────────────────────────────────────

// ── Custom Menu ───────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚽ WC2026')
    .addItem('Update Score…', 'showUpdateScoreDialog')
    .addItem('Clear Manual Override…', 'showClearOverrideDialog')
    .addSeparator()
    .addItem('Recalc Group Standings', 'recalcGroups')
    .addItem('Setup Sheet Validation', 'setupSheetValidation')
    .addToUi();
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
  Logger.log('manualSetScore: match ' + matchId + ' → ' + score1 + '-' + score2);
  return true;
}

function clearManualOverride(matchId) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
  const rows = sheet.getDataRange().getValues();
  const i = rows.findIndex((r, idx) => idx > 0 && Number(r[0]) === matchId);
  if (i < 0) return false;
  sheet.getRange(i + 1, 18).setValue('');
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
  SpreadsheetApp.getUi().alert('Done — all scores cleared, standings reset to 0.');
}

function setupSheetValidation() {
  setupHeaders(); // ensure headers exist before applying validation

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
  const lastRow = Math.max(sheet.getLastRow(), 2);

  // Col O (status): dropdown
  sheet.getRange(2, 15, lastRow - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['upcoming', 'finished'], true)
      .setAllowInvalid(false)
      .build()
  );

  // Col R (manual): checkbox
  sheet.getRange(2, 18, lastRow - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build()
  );

  SpreadsheetApp.getUi().alert('Sheet validation set up ✓\nCol O: dropdown  |  Col R: checkbox\nHeaders added to matches & groups tabs.');
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

    const s = m.score.fullTime;
    if (s.home === null && s.away === null) return;

    const status = m.status === 'FINISHED' ? 'finished' : 'upcoming';

    sheet.getRange(i + 2, 13, 1, 3).setValues([[s.home, s.away, status]]);
    updated++;
  });

  Logger.log(`syncScores: ${updated} matches updated`);
  if (updated > 0) recalcGroups();
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
      case 'getMatches': result = getMatches(e.parameter); break;
      case 'getGroups':  result = getGroups(e.parameter);  break;
      case 'getConfig':  result = getConfig();              break;
      default:           result = { status: 'error', message: 'Invalid action' };
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

    if (d.status === 'finished') recalcGroups();

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', match_id: d.match_id }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
      team1: { code: String(r[6] || ''), name: String(r[7] || ''), flag: String(r[8] || '') },
      team2: { code: String(r[9] || ''), name: String(r[10] || ''), flag: String(r[11] || '') },
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
    updated: new Date().toISOString(),
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
      team:  { code: String(r[1] || ''), name: String(r[2] || ''), flag: String(r[3] || '') },
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
    updated: new Date().toISOString(),
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
    updated: new Date().toISOString(),
    data:    cfg
  };
}

// ─── Helpers ──────────────────────────────────

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
    [7,  '2026-06-14', '09:00', '小組賽', 'D', 1, 'HAI', '海地',   '🇭🇹', 'SCO', '蘇格蘭',     '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [8,  '2026-06-14', '12:00', '小組賽', 'C', 1, 'AUS', '澳洲',   '🇦🇺', 'TUR', '土耳其',     '🇹🇷', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [9,  '2026-06-15', '01:00', '小組賽', 'E', 1, 'GER', '德國',   '🇩🇪', 'CUW', '庫拉索',     '🇨🇼', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
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
    [21, '2026-06-18', '01:00', '小組賽', 'L', 1, 'POR', '葡萄牙', '🇵🇹', 'CGO', '剛果',       '🇨🇩', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [22, '2026-06-18', '04:00', '小組賽', 'K', 1, 'ENG', '英格蘭', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'CRO', '克羅埃西亞', '🇭🇷', '', '', 'upcoming', 'AT&T Stadium',                       '達拉斯'],
    [23, '2026-06-18', '07:00', '小組賽', 'K', 1, 'GHA', '迦納',   '🇬🇭', 'PAN', '巴拿馬',     '🇵🇦', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [24, '2026-06-18', '10:00', '小組賽', 'L', 1, 'UZB', '烏茲別克','🇺🇿','COL', '哥倫比亞',   '🇨🇴', '', '', 'upcoming', 'Estadio Banorte',                    '墨西哥城'],
    // ── GROUP STAGE - MATCHDAY 2 ──────────────────────────────────────────────
    [25, '2026-06-19', '00:00', '小組賽', 'A', 2, 'CZE', '捷克',   '🇨🇿', 'RSA', '南非',       '🇿🇦', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [26, '2026-06-19', '03:00', '小組賽', 'B', 2, 'SUI', '瑞士',   '🇨🇭', 'BIH', '波赫',   '🇧🇦', '', '', 'upcoming', 'SoFi Stadium',                       '洛杉磯'],
    [27, '2026-06-19', '06:00', '小組賽', 'B', 2, 'CAN', '加拿大', '🇨🇦', 'QAT', '卡達',       '🇶🇦', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [28, '2026-06-19', '09:00', '小組賽', 'A', 2, 'MEX', '墨西哥', '🇲🇽', 'KOR', '韓國',       '🇰🇷', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    [29, '2026-06-20', '03:00', '小組賽', 'C', 2, 'USA', '美國',   '🇺🇸', 'AUS', '澳洲',       '🇦🇺', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [30, '2026-06-20', '06:00', '小組賽', 'D', 2, 'SCO', '蘇格蘭', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'MAR', '摩洛哥',     '🇲🇦', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [31, '2026-06-20', '08:30', '小組賽', 'D', 2, 'BRA', '巴西',   '🇧🇷', 'HAI', '海地',       '🇭🇹', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
    [32, '2026-06-20', '11:00', '小組賽', 'C', 2, 'TUR', '土耳其', '🇹🇷', 'PAR', '巴拉圭',     '🇵🇾', '', '', 'upcoming', "Levi's Stadium",                     '舊金山'],
    [33, '2026-06-21', '01:00', '小組賽', 'F', 2, 'NED', '荷蘭',   '🇳🇱', 'SWE', '瑞典',       '🇸🇪', '', '', 'upcoming', 'NRG Stadium',                        '休士頓'],
    [34, '2026-06-21', '04:00', '小組賽', 'E', 2, 'GER', '德國',   '🇩🇪', 'CIV', '象牙海岸',   '🇨🇮', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [35, '2026-06-21', '08:00', '小組賽', 'E', 2, 'ECU', '厄瓜多', '🇪🇨', 'CUW', '庫拉索',     '🇨🇼', '', '', 'upcoming', 'GEHA Field at Arrowhead Stadium',    '堪薩斯城'],
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
    [46, '2026-06-24', '04:00', '小組賽', 'K', 2, 'ENG', '英格蘭', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'GHA', '迦納',       '🇬🇭', '', '', 'upcoming', 'Gillette Stadium',                   '波士頓'],
    [47, '2026-06-24', '07:00', '小組賽', 'K', 2, 'CRO', '克羅埃西亞','🇭🇷','PAN','巴拿馬',    '🇵🇦', '', '', 'upcoming', 'BMO Field',                          '多倫多'],
    [48, '2026-06-24', '10:00', '小組賽', 'L', 2, 'COL', '哥倫比亞','🇨🇴','CGO','剛果',        '🇨🇩', '', '', 'upcoming', 'Estadio Akron',                      '瓜達拉哈拉'],
    // ── GROUP STAGE - MATCHDAY 3 ──────────────────────────────────────────────
    [49, '2026-06-25', '03:00', '小組賽', 'B', 3, 'BIH', '波赫','🇧🇦','QAT', '卡達',       '🇶🇦', '', '', 'upcoming', 'Lumen Field',                        '西雅圖'],
    [50, '2026-06-25', '03:00', '小組賽', 'B', 3, 'SUI', '瑞士',   '🇨🇭', 'CAN', '加拿大',     '🇨🇦', '', '', 'upcoming', 'BC Place',                           '溫哥華'],
    [51, '2026-06-25', '06:00', '小組賽', 'D', 3, 'MAR', '摩洛哥', '🇲🇦', 'HAI', '海地',       '🇭🇹', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
    [52, '2026-06-25', '06:00', '小組賽', 'D', 3, 'BRA', '巴西',   '🇧🇷', 'SCO', '蘇格蘭',     '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [53, '2026-06-25', '09:00', '小組賽', 'A', 3, 'MEX', '墨西哥', '🇲🇽', 'CZE', '捷克',       '🇨🇿', '', '', 'upcoming', 'Estadio Banorte',                    '墨西哥城'],
    [54, '2026-06-25', '09:00', '小組賽', 'A', 3, 'KOR', '韓國',   '🇰🇷', 'RSA', '南非',       '🇿🇦', '', '', 'upcoming', 'Estadio BBVA',                       '蒙特雷'],
    [55, '2026-06-26', '04:00', '小組賽', 'E', 3, 'CUW', '庫拉索', '🇨🇼', 'CIV', '象牙海岸',   '🇨🇮', '', '', 'upcoming', 'Lincoln Financial Field',            '費城'],
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
    [68, '2026-06-28', '05:00', '小組賽', 'K', 3, 'PAN', '巴拿馬', '🇵🇦', 'ENG', '英格蘭',     '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '', '', 'upcoming', 'MetLife Stadium',                    '紐約'],
    [69, '2026-06-28', '07:30', '小組賽', 'L', 3, 'COL', '哥倫比亞','🇨🇴','POR', '葡萄牙',     '🇵🇹', '', '', 'upcoming', 'Hard Rock Stadium',                  '邁阿密'],
    [70, '2026-06-28', '07:30', '小組賽', 'L', 3, 'UZB', '烏茲別克','🇺🇿','CGO','剛果',        '🇨🇩', '', '', 'upcoming', 'Mercedes-Benz Stadium',              '亞特蘭大'],
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
    ['D', 'SCO', '蘇格蘭', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group E ───────────────────────────────────────────────────────────────
    ['E', 'GER', '德國',     '🇩🇪', 0, 0, 0, 0, 0, 0, 0, 0],
    ['E', 'CIV', '象牙海岸', '🇨🇮', 0, 0, 0, 0, 0, 0, 0, 0],
    ['E', 'ECU', '厄瓜多',   '🇪🇨', 0, 0, 0, 0, 0, 0, 0, 0],
    ['E', 'CUW', '庫拉索',   '🇨🇼', 0, 0, 0, 0, 0, 0, 0, 0],
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
    ['K', 'ENG', '英格蘭',   '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 0, 0, 0, 0, 0, 0, 0, 0],
    ['K', 'GHA', '迦納',     '🇬🇭', 0, 0, 0, 0, 0, 0, 0, 0],
    ['K', 'PAN', '巴拿馬',   '🇵🇦', 0, 0, 0, 0, 0, 0, 0, 0],
    ['K', 'CRO', '克羅埃西亞','🇭🇷', 0, 0, 0, 0, 0, 0, 0, 0],
    // ── Group L ───────────────────────────────────────────────────────────────
    ['L', 'POR', '葡萄牙',   '🇵🇹', 0, 0, 0, 0, 0, 0, 0, 0],
    ['L', 'UZB', '烏茲別克', '🇺🇿', 0, 0, 0, 0, 0, 0, 0, 0],
    ['L', 'COL', '哥倫比亞', '🇨🇴', 0, 0, 0, 0, 0, 0, 0, 0],
    ['L', 'CGO', '剛果',     '🇨🇩', 0, 0, 0, 0, 0, 0, 0, 0]
  ];

  if (data.length > 0) sheet.getRange(2, 1, data.length, 12).setValues(data);
  SpreadsheetApp.getUi().alert('groups 初始化完成，共 ' + data.length + ' 支球隊');
}
