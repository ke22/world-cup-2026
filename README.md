# FIFA 世界杯 2026 賽程儀表板

可嵌入任意網頁的賽程播報元件。資料源為 Google Sheet，GAS 提供 JSON API，前端為單一 HTML 檔。

---

## 快速開始

1. 建立 Google Sheet → 複製 Spreadsheet ID
2. 在 `Code.gs` 頂部填入 `SHEET_ID`
3. 部署 GAS Web App → 複製部署 URL
4. 在 `wc2026-schedule.html` 頂部填入 `GAS_URL`
5. 填入賽程資料至 `matches` 工作表

---

## Google Sheet 結構

### 工作表 1：`matches`（每列一場比賽）

**第 1 列為標題列，以下為欄位定義：**

| 欄 | 欄名 | 型別 | 說明 | 範例 |
|----|------|------|------|------|
| A | `match_id` | 整數 | 唯一識別碼 1–104 | `1` |
| B | `date` | 文字 | ISO 日期（格式化為文字）| `2026-06-11` |
| C | `time_utc8` | 文字 | 台灣時間 HH:MM | `15:00` |
| D | `phase` | 文字 | `小組賽` / `32強` / `16強` / `8強` / `4強` / `決賽` | `小組賽` |
| E | `group` | 文字 | A–L，淘汰賽留空 | `A` |
| F | `round` | 整數 | 小組賽輪次 1–3，淘汰賽填 0 | `1` |
| G | `team1_code` | 文字 | 3 碼代碼 | `MEX` |
| H | `team1_name` | 文字 | 繁中隊名 | `墨西哥` |
| I | `team1_flag` | 文字 | emoji 國旗 | `🇲🇽` |
| J | `team2_code` | 文字 | 3 碼代碼 | `RSA` |
| K | `team2_name` | 文字 | 繁中隊名 | `南非` |
| L | `team2_flag` | 文字 | emoji 國旗 | `🇿🇦` |
| M | `score1` | 整數或空 | 隊1進球，未踢留空 | `3` |
| N | `score2` | 整數或空 | 隊2進球，未踢留空 | `1` |
| O | `status` | 文字 | `upcoming` / `live` / `finished` | `upcoming` |
| P | `venue` | 文字 | 場館名（英文） | `Estadio Azteca` |
| Q | `city` | 文字 | 城市（繁中） | `墨西哥城` |

> **注意**：B 欄（date）請將儲存格格式設為「純文字」後再輸入 `2026-06-11`，避免 Sheets 自動轉換為日期物件。C 欄（time_utc8）同理。

### 工作表 2：`groups`（積分榜，每列一支隊伍）

**第 1 列為標題列：**

| 欄 | 欄名 | 說明 |
|----|------|------|
| A | `group` | A–L |
| B | `team_code` | 3 碼代碼 |
| C | `team_name` | 繁中隊名 |
| D | `team_flag` | emoji 國旗 |
| E | `played` | 出賽數（初始填 0） |
| F | `win` | 勝（初始填 0） |
| G | `draw` | 平（初始填 0） |
| H | `loss` | 負（初始填 0） |
| I | `gf` | 進球（初始填 0） |
| J | `ga` | 失球（初始填 0） |
| K | `gd` | 球差（初始填 0） |
| L | `pts` | 積分（初始填 0） |

每場賽後手動更新各隊數據，或呼叫 GAS `recalcGroups()`（可選）自動計算。

### 工作表 3：`config`（設定，鍵值列）

| A 欄（key） | B 欄（value） |
|------------|---------------|
| `cache_ttl_sec` | `60` |
| `live_refresh_sec` | `60` |
| `last_updated` | （留空，GAS 自動填入） |

---

## GAS 部署步驟（任務 2.5）

1. 開啟 Google Apps Script（從 Sheet 選單「擴充功能 → Apps Script」）
2. 將 `Code.gs` 內容貼入編輯器
3. 將頂部 `SHEET_ID` 改為你的 Spreadsheet ID
4. 點選「部署 → 新增部署」
   - 類型：**網路應用程式**
   - 執行身分：**我（擁有者）**
   - 存取對象：**任何人**（無需登入）
5. 點擊「部署」→ 複製部署 URL
6. 將 URL 貼入 `wc2026-schedule.html` 頂部的 `GAS_URL` 常數

---

## 前端嵌入（iframe）

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

---

## 日常維護（比分更新）

1. 開啟 Google Sheet → `matches` 工作表
2. 找到對應場次列，在 `score1`、`score2` 欄填入進球數
3. 將 `status` 欄改為 `finished`（賽中可先改為 `live`）
4. 前端快取過期後（最長 60 秒）自動反映新比分

---

## 檔案清單

| 檔案 | 說明 |
|------|------|
| `wc2026-schedule.html` | 前端元件（單檔，含 CSS + JS） |
| `Code.gs` | GAS 主程式 |
| `README.md` | 本部署指南 |
