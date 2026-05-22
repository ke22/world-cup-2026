## 1. Google Sheet 資料結構

- [x] 1.1 建立 `matches` 工作表：17 欄（match_id, date, time_utc8, phase, group, round, team1_code, team1_name, team1_flag, team2_code, team2_name, team2_flag, score1, score2, status, venue, city）。驗收：開啟 Sheet 可見標題列，欄位順序與 GAS Web App responds to getMatches action 所需欄位一致。

- [x] 1.2 建立 `groups` 工作表：12 欄（group, team_code, team_name, team_flag, played, win, draw, loss, gf, ga, gd, pts）。驗收：工作表存在且標題列完整，支援 GAS Web App responds to getGroups action 讀取。

- [x] 1.3 建立 `config` 工作表：鍵值列 cache_ttl_sec=60、live_refresh_sec=60、last_updated=（空白）。驗收：GAS Web App responds to getConfig action 回傳物件含這三個鍵。

## 2. GAS Web App（data-api，GAS 作為唯讀 JSON API 層（非直接讀 Sheet））

- [x] 2.1 實作 `doGet(e)` 路由分派與 GAS returns standard response envelope：所有成功回應包裝為 `{ status: "ok", updated: "<ISO8601>", data: [...] }`；未知 action 回傳 `{ status: "error", message: "Invalid action" }`。驗收：`?action=foo` 回傳錯誤 JSON；`?action=getMatches` 回應含 status/updated/data 三個頂層鍵。

- [x] 2.2 實作 GAS Web App responds to getMatches action：`getMatches(params)` 讀取 matches 工作表，序列化為標準 match 物件（team1/team2 巢狀物件、空分數映射為 null）；支援 `date` 與 `phase` 篩選。驗收：`?action=getMatches&date=2026-06-11` 只回傳該日場次；未踢場次 score1/score2 為 null。

- [x] 2.3 實作 GAS Web App responds to getGroups action：`getGroups(params)` 讀取 groups 工作表，序列化為 group 物件；支援 `group` 單組篩選。驗收：`?action=getGroups` 回傳全部隊伍；`?action=getGroups&group=A` 只回傳 A 組。

- [x] 2.4 實作 GAS Web App responds to getConfig action：`getConfig()` 讀取 config 工作表鍵值，回傳含 cache_ttl_sec、live_refresh_sec、last_updated 的物件。驗收：`?action=getConfig` 回傳含三個必要鍵的 data 物件。

- [x] 2.5 執行 GAS deployment allows unauthenticated GET access：部署設定執行身分為擁有者、存取對象為「任何人（無需登入）」。驗收：以 curl 對部署 URL 發 GET 請求，收到 JSON 且瀏覽器端無 CORS 錯誤。

## 3. 前端：基礎架構（embed-widget，旗幟使用 emoji（非圖片檔））

- [x] 3.1 建立符合 Single self-contained HTML file requirement 的 `wc2026-schedule.html`：單檔含全部 HTML/CSS/JS；頂部宣告 Configuration via top-of-file constants：`GAS_URL`（預設空字串）、`CACHE_TTL`（60）、`LIVE_REFRESH`（60）。驗收：以 `file://` 開啟不報錯；GAS_URL 為空時顯示「資料來源未設定」而非白屏；所有隊伍旗幟使用 emoji 字元（旗幟使用 emoji（非圖片檔））。

- [x] 3.2 實作符合 sessionStorage caching with TTL 的 `fetchMatches(date)` 函式（sessionStorage 快取（TTL 60 秒））：key 為 `wc26_{date}`，命中且未過期（< CACHE_TTL 秒）直接回傳；否則 fetch GAS 並寫入快取。驗收：連續切換同一日期兩次，Network 面板第二次無新請求；手動將快取 ts 改為過期值後切換，觸發新請求。

- [x] 3.3 實作 Fetch failure shows error message without crash：catch 網路錯誤或非 ok HTTP 狀態，顯示「資料載入失敗，請稍後重試」，不拋出未捕捉例外。驗收：將 GAS_URL 改為無效 URL，頁面顯示錯誤訊息而非白屏或 console error。

- [x] 3.4 實作 iframe embed with auto-height resize（iframe 高度自適應用 postMessage）：每次重新渲染後執行 `window.parent.postMessage({ type: 'wc2026-resize', height: document.body.scrollHeight }, '*')`。驗收：以測試頁 iframe 嵌入元件，切換日期後宿主頁面 iframe 高度隨內容變動。

## 4. 前端：日期導覽（Date navigation with 7-day sliding window）

- [x] 4.1 實作 Date navigation with 7-day sliding window：計算今日（或最近有賽事日）為初始 activeDate，顯示連續 7 天；左右箭頭以 7 天為單位滑動。驗收：初始開啟含今日的 7 天視窗；點右箭頭整組向後移 7 天。

- [x] 4.2 渲染日期藍點指示器（Date navigation with 7-day sliding window）：有賽事日期下方顯示藍點，無賽事日期不顯示。驗收：Jun 11（有賽事）顯示藍點，Jun 13（無賽事）不顯示。

- [x] 4.3 實作 Date change triggers data fetch：點擊日期觸發 fetch 並重新渲染比賽卡；無賽事顯示「本日無賽事」。驗收：切換至無賽事日期顯示空狀態訊息；切換回有賽事日期正常渲染卡片。

## 5. 前端：比賽卡（Match card rendering by status）

- [x] 5.1 實作比賽卡 DOM 結構（Match card rendering by status）：左側 team1（flag emoji + code）、中央狀態區、右側 team2（code + flag emoji）；下方顯示 round、group、venue、city。驗收：渲染任一場次，DOM 可見兩隊資料與場地資訊。

- [x] 5.2 實作三種狀態中央顯示（Match card rendering by status）：`upcoming` → 顯示 time_utc8；`live` → 顯示 `score1 : score2` + 橘紅底色 + 閃爍紅點；`finished` → 顯示 `score1 : score2` 粗體大字。驗收：依狀態表修改測試資料，三種視覺狀態正確切換（見 spec 狀態表）。

- [x] 5.3 實作 Live match auto-refresh：activeDate 含 `live` 場次時啟動每 LIVE_REFRESH 秒繞過快取的定時 fetch；無 live 場次時清除計時器。驗收：設一場為 live，60 秒後 Network 面板出現新請求；改為 finished 後計時器停止。

## 6. 前端：分組積分彈窗（group-standings，分組積分彈窗顯示所有組別（非僅當日組別））

- [x] 6.1 實作 View groups button triggers standings overlay：「查看分組」按鈕點擊後開啟全屏 overlay；點擊 overlay 外側關閉。驗收：點擊按鈕 overlay 出現；點擊 overlay 背景 overlay 消失。

- [x] 6.2 實作 Standings display all groups in two-column grid（分組積分彈窗顯示所有組別（非僅當日組別））：overlay 以 2 欄網格渲染 A–L 共 12 組積分表，欄位含排名/flag/code/P/W/D/L/GD/Pts，依 Pts→GD 降序排列。驗收：overlay 開啟可見 12 個組別表格，排名符合排序規則。

- [x] 6.3 驗證 Standings overlay shows empty state before group stage：所有場次為 upcoming 時，積分表各欄顯示 0。驗收：所有 score 為 null 的測試資料下，各隊 P/W/D/L/GD/Pts 均為 0。
