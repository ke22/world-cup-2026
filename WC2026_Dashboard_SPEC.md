# 世界杯 2026 賽程儀表板 · 技術規格

**版本** v1.0 · 2026-05-22  
**性質** 可嵌入網頁的賽程播報元件，以 Google Sheet 為資料源，GAS 為 API 層

---

## 1. 系統架構

```
Google Sheet（資料源）
    ↕ GAS doGet()
JSON API（Web App URL）
    ↕ fetch()
前端 HTML 元件（iframe 嵌入）
```

| 層 | 工具 | 職責 |
|----|------|------|
| 資料層 | Google Sheet | 賽程靜態資料 + 比分手動/自動填入 |
| API 層 | Google Apps Script | 將 Sheet 資料序列化為 JSON |
| 前端層 | 單一 HTML 檔 | 渲染賽程、日期導覽、比分顯示，可 iframe 嵌入 |

---

## 2. Google Sheet 結構

### 2-1. `matches` 工作表

每列一場比賽，共 104 列（不含標題）。

| 欄 | 欄名 | 型別 | 說明 | 範例 |
|----|------|------|------|------|
| A | `match_id` | 整數 | 唯一識別碼 1–104 | `1` |
| B | `date` | 字串 | ISO 日期 | `2026-06-11` |
| C | `time_utc8` | 字串 | 台灣時間 HH:MM | `15:00` |
| D | `phase` | 字串 | `小組賽` / `32強` / `16強` / `8強` / `4強` / `決賽` | `小組賽` |
| E | `group` | 字串 | A–L，淘汰賽留空 | `A` |
| F | `round` | 整數 | 小組賽輪次 1–3，淘汰賽填 0 | `1` |
| G | `team1_code` | 字串 | 3 碼代碼 | `MEX` |
| H | `team1_name` | 字串 | 繁中隊名 | `墨西哥` |
| I | `team1_flag` | 字串 | emoji 國旗 | `🇲🇽` |
| J | `team2_code` | 字串 | 3 碼代碼 | `RSA` |
| K | `team2_name` | 字串 | 繁中隊名 | `南非` |
| L | `team2_flag` | 字串 | emoji 國旗 | `🇿🇦` |
| M | `score1` | 整數或空 | 隊1進球，未踢留空 | `3` |
| N | `score2` | 整數或空 | 隊2進球，未踢留空 | `1` |
| O | `status` | 字串 | `upcoming` / `live` / `finished` | `finished` |
| P | `venue` | 字串 | 場館名 | `Estadio Azteca` |
| Q | `city` | 字串 | 城市（繁中） | `墨西哥城` |

### 2-2. `groups` 工作表（積分榜）

| 欄 | 欄名 | 說明 |
|----|------|------|
| A | `group` | A–L |
| B | `team_code` | 3 碼 |
| C | `team_name` | 繁中隊名 |
| D | `team_flag` | emoji |
| E | `played` | 出賽數 |
| F | `win` | 勝 |
| G | `draw` | 平 |
| H | `loss` | 負 |
| I | `gf` | 進球 |
| J | `ga` | 失球 |
| K | `gd` | 球差 |
| L | `pts` | 積分 |

可由 GAS 根據 matches 自動計算後寫入，或手動維護。

### 2-3. `config` 工作表

| 鍵 | 說明 | 預設值 |
|----|------|--------|
| `cache_ttl_sec` | 前端快取秒數 | `60` |
| `live_refresh_sec` | live 狀態自動刷新秒數 | `60` |
| `last_updated` | GAS 最後寫入時間（自動） | — |

---

## 3. GAS API 規格

### 3-1. 部署設定

- 執行身分：**「我（擁有者）」**
- 存取對象：**「任何人」（無需登入）**
- 部署類型：Web App
- URL 格式：`https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

### 3-2. `doGet(e)` 查詢參數

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `action` | 字串 | 是 | `getMatches` / `getGroups` / `getConfig` |
| `date` | 字串 | 否 | ISO 日期，只回傳該日賽程 |
| `phase` | 字串 | 否 | 篩選賽事階段 |

請求範例：
```
GET {GAS_URL}?action=getMatches&date=2026-06-11
```

### 3-3. 回應格式

所有端點共用外層結構：
```json
{
  "status": "ok",
  "updated": "2026-06-12T15:30:00+08:00",
  "data": [ ... ]
}
```

`getMatches` 單筆比賽物件：
```json
{
  "match_id": 1,
  "date": "2026-06-11",
  "time_utc8": "15:00",
  "phase": "小組賽",
  "group": "A",
  "round": 1,
  "team1": { "code": "MEX", "name": "墨西哥", "flag": "🇲🇽" },
  "team2": { "code": "RSA", "name": "南非",   "flag": "🇿🇦" },
  "score1": 3,
  "score2": 1,
  "status": "finished",
  "venue": "Estadio Azteca",
  "city": "墨西哥城"
}
```

`score1`、`score2` 未踢時為 `null`。

錯誤回應：
```json
{ "status": "error", "message": "Invalid action" }
```

### 3-4. GAS Code.gs 結構

```javascript
const SHEET_ID = 'YOUR_SPREADSHEET_ID'; // 部署時填入

function doGet(e) {
  const action = e.parameter.action || '';
  let result;
  switch (action) {
    case 'getMatches': result = getMatches(e.parameter); break;
    case 'getGroups':  result = getGroups(e.parameter);  break;
    case 'getConfig':  result = getConfig();              break;
    default: result = { status: 'error', message: 'Invalid action' };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getMatches(params) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('matches');
  const [headers, ...rows] = sheet.getDataRange().getValues();
  let data = rows.map(r => ({
    match_id:  r[0],
    date:      r[1],
    time_utc8: r[2],
    phase:     r[3],
    group:     r[4],
    round:     r[5],
    team1: { code: r[6], name: r[7], flag: r[8] },
    team2: { code: r[9], name: r[10], flag: r[11] },
    score1: r[12] === '' ? null : Number(r[12]),
    score2: r[13] === '' ? null : Number(r[13]),
    status: r[14],
    venue:  r[15],
    city:   r[16]
  }));
  if (params.date)  data = data.filter(m => m.date === params.date);
  if (params.phase) data = data.filter(m => m.phase === params.phase);
  return {
    status: 'ok',
    updated: new Date().toISOString(),
    data
  };
}

function getGroups(params) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('groups');
  const [, ...rows] = sheet.getDataRange().getValues();
  let data = rows.map(r => ({
    group: r[0],
    team:  { code: r[1], name: r[2], flag: r[3] },
    played: r[4], win: r[5], draw: r[6], loss: r[7],
    gf: r[8], ga: r[9], gd: r[10], pts: r[11]
  }));
  if (params.group) data = data.filter(g => g.group === params.group);
  return { status: 'ok', updated: new Date().toISOString(), data };
}

function getConfig() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('config');
  const rows = sheet.getDataRange().getValues();
  const cfg = {};
  rows.forEach(([k, v]) => { cfg[k] = v; });
  return { status: 'ok', data: cfg };
}

// 選用：定時更新積分榜（每場賽後手動或觸發器呼叫）
function recalcGroups() {
  // 讀取 matches 工作表所有 finished 場次
  // 計算各組積分，寫入 groups 工作表
}
```

### 3-5. CORS

GAS Web App 的 GET 請求天然支援跨域，前端直接 `fetch(GAS_URL)` 即可，無需額外 header。

---

## 4. 前端元件規格

### 4-1. 技術要求

- 單一 `wc2026-schedule.html`，含 CSS + JS，無需打包工具
- 無外部依賴（或僅允許 cdnjs.cloudflare.com）
- 支援 `<iframe>` 嵌入，自動通知宿主頁面高度

### 4-2. 元件版面

```
┌──────────────────────────────────────────┐
│ FIFA 世界杯 2026 賽程                     │  標題列
├──────────────────────────────────────────┤
│ ‹  一6/8  二6/9  三6/10  [四6/11]  五6/12 ›│  日期導覽（7天窗口）
├──────────────────────────────────────────┤
│ 6月11日（四）2026              查看分組  │  日標題
├──────────────────────────────────────────┤
│  🇲🇽 MEX        3 : 1        RSA 🇿🇦     │  ← finished：大字比分
│      第一輪 · A組 · Estadio Azteca · 墨西哥城 │
├──────────────────────────────────────────┤
│  🇰🇷 KOR       22:00        CZE 🇨🇿     │  ← upcoming：台灣時間
│      第一輪 · A組 · Estadio Akron · 瓜達拉哈拉 │
└──────────────────────────────────────────┘
```

### 4-3. 比賽卡狀態規則

| `status` | 中央顯示 | 視覺 |
|----------|---------|------|
| `finished` | `score1 : score2`（大字） | 黑色字重 |
| `live` | `score1' : score2'` | 橘紅底色 + 🔴 閃爍圓點 |
| `upcoming` | `HH:MM`（台灣時間） | 次要灰色 |

### 4-4. 日期導覽

- 7 天滑動視窗（初始 focus = 今日，無比賽則跳最近有比賽日）
- 有比賽的日期顯示藍點
- 左右箭頭以 7 天為單位滑動
- 切換日期觸發 fetch（有快取則跳過）

### 4-5. 分組積分彈窗

點擊「查看分組」按鈕後疊層顯示當日第一場比賽所屬組別的積分表，欄位：
`排名 · 球隊 · P · W · D · L · GD · Pts`

### 4-6. 資料快取策略

```javascript
// sessionStorage 快取，key = wc26_{date}
async function fetchMatches(date) {
  const key = `wc26_${date}`;
  const cached = sessionStorage.getItem(key);
  if (cached) {
    const { ts, data } = JSON.parse(cached);
    if (Date.now() - ts < CACHE_TTL * 1000) return data;
  }
  const res  = await fetch(`${GAS_URL}?action=getMatches&date=${date}`);
  const json = await res.json();
  sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: json.data }));
  return json.data;
}
```

live 狀態下每 `live_refresh_sec` 秒強制繞過快取重新 fetch。

### 4-7. iframe 嵌入與自適應高度

**前端元件**（每次渲染後執行）：
```javascript
window.parent.postMessage(
  { type: 'wc2026-resize', height: document.body.scrollHeight }, '*'
);
```

**宿主頁面**：
```html
<iframe src="wc2026-schedule.html"
        width="100%" height="600"
        frameborder="0" scrolling="no" id="wc-frame"></iframe>
<script>
  window.addEventListener('message', e => {
    if (e.data?.type === 'wc2026-resize')
      document.getElementById('wc-frame').height = e.data.height + 20;
  });
</script>
```

### 4-8. 設定變數（檔案頂部宣告）

```javascript
// ── 部署時修改這裡 ──────────────────────────
const GAS_URL       = 'https://script.google.com/macros/s/YOUR_ID/exec';
const CACHE_TTL     = 60;   // 秒
const LIVE_REFRESH  = 60;   // 秒
// ────────────────────────────────────────────
```

---

## 5. 資料流時序

```
使用者開啟頁面
    │
    ▼
計算 activeDate（今日 or 最近有賽事日）
    │
    ▼
fetch GAS?action=getMatches&date={activeDate}
    │
    ├─ sessionStorage 命中且未過期 ──→ 渲染比賽卡
    │
    └─ 未命中 ──→ GAS 讀 Sheet ──→ 回傳 JSON ──→ 寫快取 ──→ 渲染
                                                        │
                                             有 live 場次 → 60s 後重 fetch
```

---

## 6. 維護流程

### 手動更新比分（最簡）

1. 開啟 Sheet → `matches` 工作表
2. 找到對應場次列，填入 `score1`、`score2`
3. `status` 欄改為 `finished`
4. 前端快取過期後（最長 60 秒）自動反映

### 半自動（建議）

- 比賽開始前將 `status` 改為 `live`
- 終場後填入比分，改為 `finished`
- 可搭配 GAS `recalcGroups()` 自動重算積分榜

### 全自動（選用，進階）

- GAS 定時觸發器每 5 分鐘呼叫第三方比分 API（如 football-data.org / API-Football）
- 將比分與狀態寫回 `matches` 工作表
- 前端無需修改

---

## 7. 開發優先順序

| 優先 | 項目 | 交付物 |
|------|------|--------|
| P0 | Sheet 結構 + 填入 6/11–7/19 全部賽程 | `matches` 工作表 |
| P0 | GAS `doGet` + `getMatches` | `Code.gs` |
| P0 | 前端日期導覽 + 比賽卡（比分/時間切換） | `wc2026-schedule.html` |
| P1 | iframe 嵌入 + 自適應高度 | 宿主頁面範例 |
| P1 | 分組積分彈窗（`getGroups` + modal） | 前端擴充 |
| P2 | live 狀態 60s 自動刷新 | 前端擴充 |
| P3 | GAS 定時觸發器自動同步比分 | `Code.gs` 擴充 |

---

## 8. 檔案清單

```
wc2026-schedule.html   前端元件（單檔，含 CSS + JS）
Code.gs                GAS 主程式
README.md              部署說明（Sheet ID、GAS URL 填寫位置）
```
