## Why

世界盃 2026 正在進行中，Mbappé、Messi、Ronaldo 三位仍在場上的歷代最佳射手正在爭奪世界盃史上最多進球的紀錄。讀者需要一個視覺化工具，即時呈現這場歷史性競賽的進展。

## What Changes

- 新增 `wc2026-scorers.html`：單一 HTML 嵌入元件，以 Reuters 風格的步階折線圖呈現進球競賽——仍在場的球員（Mbappé、Messi、Ronaldo）以彩色顯示，退役球員（Klose、Müller、Fontaine）以灰色參考線顯示
- 新增 GAS `scorers` 工作表：記錄 2026 年世界盃各場比賽的個人射手進球資料（match_id, player_name, goals）
- 新增 GAS `getTopScorers` 端點：回傳 2026 賽事各球員進球彙整資料
- 歷史賽事資料（2026 年以前各屆）以靜態 JSON 直接內嵌於 HTML，GAS 僅負責 2026 年現場資料

## Non-Goals

- 退役球員（Klose、Müller、Fontaine）只顯示灰色參考線，無彩色、無即時更新需求，資料完全靜態
- 不支援手動以外的自動進球偵測（進球資料由管理員手動填入 scorers 工作表）
- 不修改現有 `matches` 或 `groups` 工作表結構

## Capabilities

### New Capabilities

- `scorers-race-chart`: 步階折線圖元件，以世界盃比賽場次為 X 軸、累計進球數為 Y 軸，呈現 Mbappé、Messi、Ronaldo 三人的彩色競賽軌跡，以及 Klose、Müller、Fontaine 的灰色歷史參考線
- `scorers-data-api`: GAS `getTopScorers` 端點，從 `scorers` 工作表彙整並回傳各球員 2026 年世界盃逐場進球資料

### Modified Capabilities

- `data-api`：新增 `getTopScorers` action 至現有 GAS doGet 路由

## Impact

- Affected specs: `scorers-race-chart`（新建）、`scorers-data-api`（新建）、`data-api`（修改）
- Affected code:
  - New: `wc2026-scorers.html`
  - Modified: `Code.gs`
  - Modified: `wc2026-embed-info.html`（新增射手競賽圖表嵌入代碼卡片）
  - New: （Google Sheet `scorers` 工作表，非程式碼檔案）
