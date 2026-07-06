## 1. Google Sheet：新增 scorers 工作表

- [ ] 1.1 建立 `scorers` 工作表滿足 GAS scorers sheet stores 2026 individual goal events 規格（決策 3：GAS `scorers` 工作表僅記錄 2026 年進球事件）：在 Google Sheet 新增 `scorers` 工作表，標題列欄位為 `match_id`、`player_name`、`player_code`、`goals`。驗證：開啟 Sheet 可看到四欄標題，且第一列為標題、無資料列。
- [ ] 1.2 為 `scorers` 工作表加入資料驗證：`match_id` 欄接受正整數、`goals` 欄接受 ≥1 的整數、`player_code` 欄僅接受 `mbappe`、`messi`、`ronaldo`、`kane` 四個值（凱恩亦為 active 球員，其 2026 進球需可由 Sheet 更新）。驗證：輸入不合規值時 Sheet 顯示警告，且 `kane` 為合規值。

## 2. GAS：實作 getTopScorers 端點

- [x] 2.1 實作 GAS Web App responds to getTopScorers action（GAS 端點：`getTopScorers`）：在 `Code.gs` 的 `doGet(e)` switch 語句新增 `case 'getTopScorers'`，呼叫新的 `getTopScorers()` 函式，不修改既有路由（`getMatches`、`getGroups`、`getConfig`）。驗證：呼叫 `?action=getMatches` 仍正常回應，確認既有路由不受影響。
- [x] 2.2 實作 `getTopScorers()` 以滿足 GAS getTopScorers endpoint aggregates 2026 scorer data 規格：讀取 `scorers` 工作表全部列，依 `player_code` 分組，計算 `total_goals_2026`、`matches_played_2026`、`goals_2026`（`{ match_id, goals }` 陣列），回傳標準 envelope。驗證：在 `scorers` 工作表加入兩列 Mbappé 資料後，呼叫 `?action=getTopScorers` 回應中 Mbappé 的 `total_goals_2026` 等於兩列 `goals` 之和。
- [x] 2.3 驗證 `scorers` 工作表無資料時 `getTopScorers` 回傳空陣列 `data: []` 而非錯誤。驗證：清空 `scorers` 工作表後呼叫端點，回應為 `{ status: "ok", data: [] }`。

## 3. 前端：CNA Design System 樣式與結構

- [x] 3.1 實作 Component applies CNA Design System visual tokens and is registered in embed-info（決策 5：套用 CNA Design System 視覺規範，並登錄至 wc2026-embed-info.html）：在 `wc2026-scorers.html` 的 `<style>` 區塊宣告完整 CNA CSS 變數（`--bg: #eef2f6`、`--surface: #ffffff`、`--accent: #0f4b8f`、`--header-from: #13579f`、`--header-to: #0f4b8f`、`--border: rgba(15,50,96,0.12)`、`--shadow: rgba(15,75,143,0.08)`、`--fg: #1f2937`、`--muted: #66758a`、`--accent-2: #2c73c9`），並設定 CNA 標準字型堆疊。驗證：DevTools 查詢 `getComputedStyle(document.documentElement).getPropertyValue('--accent')` 應回傳 `#0f4b8f`。
- [x] 3.2 建立 CNA 標準標題列：`div.header` 使用 `linear-gradient(180deg, var(--header-from) 0%, var(--header-to) 100%)`、`border-radius: 16px 16px 0 0`，內含 `img.cna-logo`（`src="cna_logo.svg"`、`filter: brightness(0) invert(1)`）與標題文字「世界盃歷史射手競賽」。驗證：並排開啟 `wc2026-schedule.html` 與 `wc2026-scorers.html`，標題漸層色、圓角、Logo 外觀完全一致。
- [x] 3.3 在 `wc2026-embed-info.html` 的 `CHARTS` 陣列新增 `{ id: 'scorers', file: 'wc2026-scorers.html', title: '世界盃歷史射手競賽', height: 500 }`，使頁面生成使用 `class="wc2026-embed"` div 格式的嵌入代碼卡片（非直接 `<iframe>`）。驗證：開啟 `wc2026-embed-info.html`，確認出現「世界盃歷史射手競賽」卡片，嵌入代碼含 `class="wc2026-embed"`，「複製」按鈕正常運作。

## 4. 前端：靜態歷史資料 JSON

- [x] 4.1 在 `wc2026-scorers.html` 實作 Historical pre-2026 career data embedded as static JSON（前端靜態歷史資料結構，決策 1：歷史資料內嵌靜態 JSON，2026 資料由 GAS 提供）：定義 `HISTORICAL_DATA` 常數，包含六位球員完整生涯資料，每位球員含 `active` 布林欄位——現役三人（Mbappé、Messi、Ronaldo，`active: true`）及退役三人（Klose、Gerd Müller、Fontaine，`active: false`），附資料來源注解（FIFA/OPTA）。驗證：`Object.keys(HISTORICAL_DATA).length` 等於 6；`HISTORICAL_DATA.klose.active` 等於 `false`；`HISTORICAL_DATA.mbappe.active` 等於 `true`。

## 5. 前端：GAS 資料取得與快取

- [x] 5.1 實作 Live 2026 data appended from GAS getTopScorers（決策 4：前端以 `sessionStorage` 快取 GAS 回應）：建立 `fetchTopScorers()` 非同步函式，先查 `sessionStorage` 的 `wc26_scorers` key（age < `cache_ttl_sec`），命中則直接回傳快取資料，否則 fetch `?action=getTopScorers` 並寫入快取。驗證：連續呼叫兩次，Network 面板顯示只有一次請求。
- [x] 5.2 實作資料合併函式 `mergePlayerData(historical, live2026)`（決策 1：歷史資料內嵌靜態 JSON，2026 資料由 GAS 提供）：以 `player_code` 為鍵合併靜態歷史陣列與 GAS 2026 場次，產生供圖表使用的完整 `goals_per_match` 陣列。驗證：mock Mbappé 2026 兩場進球傳入，合併後陣列長度等於歷史場次數 + 2。
- [x] 5.3 GAS 呼叫失敗時，仍以靜態歷史資料繪圖，圖表下方顯示「2026 資料暫時無法取得」提示。驗證：將 GAS URL 改為無效值，重整後三條歷史折線仍顯示，並出現提示文字。

## 6. 前端：SVG 步階折線圖繪製

- [x] 6.1 實作 Step chart renders cumulative World Cup goals per match 與 All tournaments are part of one continuous polyline（前端圖表契約，決策 2：純 SVG 實作步階圖，不引入外部依賴）：建立 `buildCareerPath(player)` 函式，輸入球員物件，回傳 `{ points: string, dotPositions: [{x, y}] }`，其中 `points` 為橫跨所有屆次的連續步階路徑，`dotPositions` 包含生涯起點 (1,0) 及每屆末端座標。驗證：輸入 2018=[1,0]、2022=[0,1]，`dotPositions` 長度為 3（起點 + 2 屆末端），且 polyline points 含 match 1–4 所有坐標。
- [x] 6.2 實作 Tournament boundary dots at career start and each tournament end（決策 2）：對每位球員，依 `dotPositions` 各繪製一個 `<circle r="3">`（顏色同折線）。對擁有 2018、2022 兩屆的球員，圖表中恰好出現 3 個圓點。驗證：DevTools 中指定球員 SVG group 的 `<circle>` 數量等於 `dotPositions.length`（屆數 + 1）。
- [x] 6.3 實作 Retired players displayed as muted gray reference lines（決策 6：退役球員以灰色參考線渲染，繪製順序在彩色線之後）：退役球員的 `<polyline>` 使用 `stroke="#b0b8c1"`、`stroke-width="1.5"`、`stroke-opacity="0.6"`，boundary dots 同色；DOM 中退役線先渲染（z-order 在下），最後一屆末端附灰色小字標籤。驗證：六條折線均出現，Klose 線在 Mbappé 線之下，顏色明顯更淡更細。
- [x] 6.4 實作 Three active 2026 players displayed with distinct colors：現役球員 `<polyline>` 使用 `stroke-width="2.5"`、全不透明，Mbappé `#C62828`、Messi `#1565C0`、Ronaldo `#2E7D32`；生涯終點附名稱與累計進球數標籤（如「Messi 18」）。驗證：三條彩色折線比退役灰線明顯更粗更鮮豔，標籤出現在折線終點。
- [x] 6.5 實作 Chart is responsive and mobile-friendly：圖表容器設定 `overflow-x: auto`，SVG 固定最小寬度 600px，使窄視口可水平捲動。驗證：DevTools 模擬 320px 視口，圖表容器出現橫向捲軸，頁面 body 無水平溢位。

## 7. 前端：iframe 嵌入與高度回報

- [x] 7.1 實作 Component reports height to parent frame：在每次圖表渲染完成後執行 `window.parent.postMessage({ type: 'wc2026-resize', height: document.body.scrollHeight }, '*')`。驗證：將嵌入代碼貼入 `test-embed.html` 並透過 `embed-loader.js` 載入，確認 iframe 高度自動調整至內容高度。

## 8. 整合測試與驗收

- [x] 8.1 驗收條件 1：開啟 `wc2026-scorers.html` 後六條步階折線完整顯示（三彩色現役 + 三灰色退役），X 軸從第 1 場開始，Y 軸從 0 開始，視覺與其他 CNA 元件一致（標題漸層、圓角、Logo）。
- [x] 8.2 驗收條件 2：在 `scorers` 工作表新增一列進球資料，等待快取過期（或清除 `sessionStorage`）後重新整理，對應球員折線新增一格進球步階。
- [x] 8.3 驗收條件 3：在 320px 寬度的行動裝置視口下，圖表可水平捲動且頁面不破版。
- [x] 8.4 驗收條件 4：從 `wc2026-embed-info.html` 複製嵌入代碼，貼入任意測試頁面，圖表透過 `embed-loader.js` 正常載入並自動調整 iframe 高度。
