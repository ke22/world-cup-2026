## Context

專案目前以 Google Sheet → GAS → 單一 HTML 檔案的三層架構運作，已有 `wc2026-schedule.html`、`wc2026-bracket.html`、`wc2026-groups.html` 等嵌入元件。`Code.gs` 的 `doGet()` 以 action 參數路由不同端點。`matches` 工作表儲存比賽結果，但不記錄個人射手資料。

本設計新增第四個嵌入元件：一個 Reuters 風格的步階折線圖，呈現六位歷代頂尖射手的進球競賽——Mbappé、Messi、Ronaldo 三位仍在 2026 年世界盃征戰者以彩色顯示，Klose、Müller、Fontaine 三位退役者以灰色參考線顯示。

## Goals / Non-Goals

**Goals:**

- 以步階折線圖呈現六位球員自世界盃初登場以來逐場比賽的累計進球軌跡
- X 軸為球員個人世界盃出賽場次（從 1 開始），Y 軸為累計進球數
- 歷史資料（2026 年以前）以靜態 JSON 內嵌於 HTML，不依賴外部服務
- 2026 年現場資料透過 GAS `getTopScorers` 端點取得，可即時更新
- 元件為獨立 HTML 檔，支援 iframe 嵌入，與現有元件架構一致

**Non-Goals:**

- 退役球員（Klose、Müller、Fontaine）僅顯示靜態灰色參考線，不接受 2026 年即時資料、不可互動、不套用彩色
- 不支援自動進球偵測，進球資料由管理員手動填入 `scorers` 工作表
- 不修改現有 `matches`、`groups`、`config` 工作表
- 不使用外部 JS 函式庫（如 D3.js）；圖表以純 SVG + 原生 JavaScript 實作

## Decisions

### 決策 1：歷史資料內嵌靜態 JSON，2026 資料由 GAS 提供

**選擇**：將 2006–2022 各屆賽事的逐場進球資料以靜態 JSON 物件直接寫入 `wc2026-scorers.html`，2026 年賽事資料透過 GAS `getTopScorers` 端點動態取得，前端合併後繪圖。

**備選方案**：將所有歷史資料也存入 GAS 工作表。

**原因**：歷史資料為不可變事實，存入可編輯的 Google Sheet 只會增加誤改風險，且無任何維護效益。2026 年資料需要動態更新，因此只有這部分需要 GAS。

---

### 決策 2：純 SVG 實作步階圖，不引入外部依賴

**選擇**：以手動座標計算生成 SVG `<polyline>` 元素，無外部函式庫。每位球員為**一條連續 polyline**，貫穿整個生涯（各屆之間連線不斷）。在生涯起點與每屆世界盃末端位置疊加 `<circle>` 圓點作為屆次分界標記。

**備選方案**：使用 cdnjs.cloudflare.com 上的 D3.js；各屆改為獨立不連線的 polyline。

**原因**：專案規格明定無外部依賴。連續折線保留生涯累積感；圓點在每屆末端清楚標示「這屆結束在此」，讀者可直觀看出各屆節奏。

**圓點位置（視覺序列）**：

```
點 — 線(T1) — 點 — 線(T2) — 點 — 線(T3) — 點
↑               ↑               ↑           ↑
生涯起點       T1 末端         T2 末端     T3 末端
(x=1, y=0)                              (即生涯終點)
```

**SVG 渲染虛擬碼（每位球員）**：
```
draw <polyline> spanning ALL career matches (one continuous path)

draw <circle> at (x=1, y=0)                    // 生涯起點
for each tournament T in player.career:
  draw <circle> at (x=T.lastMatchX, y=T.endCumulativeGoals)  // 每屆末端
// 最後一屆末端即為上方迴圈最後一次，不需額外判斷
```

X 軸使用**生涯累計場次**（跨屆連續，x=1 為生涯第 1 場），Y 軸使用**跨屆累計進球數**。

---

### 決策 3：GAS `scorers` 工作表僅記錄 2026 年進球事件

**選擇**：`scorers` 工作表每列代表「某場 2026 年比賽中某球員的進球數」，欄位為 `match_id`、`player_name`、`goals`。`match_id` 對應現有 `matches` 工作表，`goals` 為 0 時不需記錄（僅記錄有進球的場次即可，前端以 0 補齊缺失場次）。

**原因**：最小化工作表列數，只在有進球時才需新增列，降低管理員維護成本。

---

### 決策 6：退役球員以灰色參考線渲染，繪製順序在彩色線之後

**選擇**：`HISTORICAL_DATA` 中每位球員加入 `active: boolean` 欄位。退役球員（`active: false`）的折線顏色固定為 `#b0b8c1`（淺灰），`stroke-width` 較細（1.5px vs 彩色線 2.5px），`stroke-opacity: 0.6`，無球員名稱色塊標籤（只在折線尾端附灰色小字）。退役線先繪製（z-order 在下），彩色線後繪製（z-order 在上），確保活躍球員折線不被遮蓋。

**備選方案**：退役球員完全不顯示（先前的 Non-Goal）。

**原因**：灰色參考線提供歷史基準，讀者可直觀看出 Mbappé 超越 Klose 16 球的時間點，這正是 Reuters 圖表的核心敘事價值。不上色確保視覺焦點仍在三位現役球員身上。

**退役球員資料（完全靜態）**：
- Klose：2002–2014（4 屆，24 場，16 球）
- Gerd Müller：1970–1974（2 屆，13 場，14 球）
- Fontaine：1958（1 屆，6 場，13 球）

---

### 決策 5：套用 CNA Design System 視覺規範，並登錄至 wc2026-embed-info.html

**選擇**：`wc2026-scorers.html` 使用與其他 CNA 嵌入元件完全相同的 CSS 設計系統變數、標題樣式及字型堆疊。完成後在 `wc2026-embed-info.html` 新增一個圖表卡片，使 CNA 編輯可直接複製嵌入代碼。

**CNA Design System 核心變數**（需與現有元件保持一致）：
```css
:root {
  --bg: #eef2f6;
  --surface: #ffffff;
  --surface-2: #f5f8fc;
  --fg: #1f2937;
  --muted: #66758a;
  --border: rgba(15, 50, 96, 0.12);
  --shadow: rgba(15, 75, 143, 0.08);
  --accent: #0f4b8f;
  --accent-2: #2c73c9;
  --header-from: #13579f;
  --header-to: #0f4b8f;
}
```

**標題結構**（與 schedule / bracket / groups 一致）：
```html
<div class="header">
  <img src="cna_logo.svg" class="cna-logo" alt="CNA">
  <span class="header-title">世界盃歷史射手競賽</span>
</div>
```
標題背景：`linear-gradient(180deg, var(--header-from) 0%, var(--header-to) 100%)`，圓角 `border-radius: 16px 16px 0 0`。

**字型堆疊**：`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", Arial, sans-serif`

**embed-info 嵌入格式**（使用 embed-loader.js，不直接寫 `<iframe>`）：
```html
<div class="wc2026-embed"
  data-src="{baseUrl}/wc2026-scorers.html"
  data-title="世界盃歷史射手競賽"
  data-height="500"></div>
<script async src="{baseUrl}/embed-loader.js"></script>
```

**備選方案**：自訂元件專屬樣式，不套用 CNA 設計系統。

**原因**：CNA 編輯工具會將多個圖表並排顯示，視覺一致性是必要條件。`wc2026-embed-info.html` 是編輯複製嵌入代碼的唯一入口，缺少射手圖表卡片將導致此元件無法被 CNA 文章使用。

---

### 決策 4：前端以 `sessionStorage` 快取 GAS 回應

**選擇**：與現有元件相同，使用 `sessionStorage` 快取 `getTopScorers` 回應，TTL 沿用 `config` 工作表的 `cache_ttl_sec` 設定（預設 60 秒）。

**原因**：與現有快取策略一致，無需新增設定。

## Implementation Contract

### GAS 端點：`getTopScorers`

**請求**：
```
GET {GAS_URL}?action=getTopScorers
```

**回應結構**：
```json
{
  "status": "ok",
  "updated": "2026-06-27T10:00:00+08:00",
  "data": [
    {
      "player_name": "Mbappé",
      "player_code": "mbappe",
      "goals_2026": [
        { "match_id": 23, "goals": 2 },
        { "match_id": 31, "goals": 0 }
      ],
      "total_goals_2026": 2,
      "matches_played_2026": 2
    }
  ]
}
```

- `goals_2026` 僅包含 2026 年 `scorers` 工作表有記錄的場次（包含 0 進球場次，如管理員有填入）
- `player_code` 為前端對應靜態歷史資料的 key（`"mbappe"`, `"messi"`, `"ronaldo"`）

**`scorers` 工作表欄位**：

| 欄 | 欄名 | 型別 | 說明 |
|----|------|------|------|
| A | `match_id` | 整數 | 對應 `matches` 工作表 |
| B | `player_name` | 字串 | 顯示名稱（如 `Mbappé`） |
| C | `player_code` | 字串 | 識別碼（如 `mbappe`） |
| D | `goals` | 整數 | 本場進球數（≥1） |

### 前端靜態歷史資料結構

`active: true` 球員用彩色粗線；`active: false` 退役球員用灰色細線。退役球員無 `goals_2026` 合併邏輯，資料完全靜態。

```javascript
const HISTORICAL_DATA = {
  // 現役（彩色，stroke-width: 2.5）
  mbappe:  { name: "Mbappé",      color: "#C62828", active: true,
             career: [{ wc: 2018, goals_per_match: [1,0,0,3,0,1,0] },
                      { wc: 2022, goals_per_match: [1,2,0,0,1,0,4] }] },
  messi:   { name: "Messi",       color: "#1565C0", active: true,  career: [...] },
  ronaldo: { name: "C. Ronaldo",  color: "#2E7D32", active: true,  career: [...] },
  // 退役（灰色，stroke-width: 1.5，stroke-opacity: 0.6）
  klose:   { name: "Klose",       color: "#b0b8c1", active: false, career: [...] },
  muller:  { name: "Gerd Müller", color: "#b0b8c1", active: false, career: [...] },
  fontaine:{ name: "Fontaine",    color: "#b0b8c1", active: false, career: [...] },
};
```

### 前端圖表契約

- SVG viewBox 寬度足以容納最多 35 場比賽（X 軸）、最高 25 進球（Y 軸），帶邊距
- 每位球員各自以一條顏色折線表示，折線尾端標示球員名稱與當前進球總數
- 有進球時折線垂直上升，無進球時水平延伸（步階效果）
- 圖表支援行動裝置，最小寬度 320px 可捲動顯示
- `sessionStorage` key 為 `wc26_scorers`，TTL 60 秒

### 驗收條件

1. 開啟 `wc2026-scorers.html`：三條步階折線正確顯示，X 軸從第 1 場開始，Y 軸從 0 開始
2. GAS `getTopScorers` 回傳有效 JSON：`status: "ok"`，`data` 陣列含三位球員資料
3. 管理員在 `scorers` 工作表新增一列進球資料後，重新載入頁面（或快取過期後），圖表反映新進球
4. 在寬度 320px 的行動裝置視口下，圖表可水平捲動而不破版
5. 元件可嵌入 iframe 並正確回報高度至父頁面（`postMessage wc2026-resize`）

## Risks / Trade-offs

- **[風險] 歷史資料有誤** → 在靜態 JSON 中標記資料來源（FIFA/OPTA），並在程式碼注解中說明資料截止日期，便於未來核對
- **[風險] 管理員忘記填入 scorers 工作表** → 圖表靜止不更新，不會崩潰；2026 年部分保持最後已知狀態
- **[取捨] 不含退役球員** → 圖表缺乏 Klose 等歷史基準線的對比，但符合「只呈現仍在場上的競爭者」的設計決策
