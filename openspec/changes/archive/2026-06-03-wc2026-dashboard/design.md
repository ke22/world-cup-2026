## Context

世界杯 2026 賽程儀表板是一個無伺服器、可嵌入的靜態元件。資料源為 Google Sheet，由人工維護比分與狀態；GAS Web App 擔任唯讀 JSON API；前端為單一 HTML 檔，可直接部署至任何靜態主機或以 iframe 嵌入任意網頁。

## Goals / Non-Goals

**Goals:**
- 三層架構（Sheet → GAS → HTML）皆可獨立部署與測試
- 前端無打包工具，單檔可直接開啟或 iframe 嵌入
- 人工更新 Sheet 後，前端最長 60 秒反映（快取 TTL）
- live 場次每 60 秒自動重新 fetch

**Non-Goals:**
- 不自動同步第三方比分 API（P3 已決定跳過）
- 不支援寫入操作（GAS 只回應 GET）
- 不實作使用者帳號、認證、或頁面路由

## Decisions

### GAS 作為唯讀 JSON API 層（非直接讀 Sheet）

前端不直接存取 Google Sheet；改透過 GAS `doGet(e)` 統一序列化後回傳 JSON。

替代方案：Google Sheets API v4（需 OAuth）或 CSV 公開匯出（格式脆弱、無法篩選）。

選擇 GAS 理由：免費、跨域無需 CORS 配置、可加 server-side 篩選（date/phase 參數）、部署門檻最低。

### sessionStorage 快取（TTL 60 秒）

每次 fetch 結果寫入 `sessionStorage`，key 為 `wc26_{date}`。命中且未過期則跳過 fetch。

Live 場次強制略過快取，每 60 秒重新 fetch。

替代方案：無快取（每次互動都打 GAS，延遲高、可能被 rate-limit）；Service Worker（過於複雜，不符合單檔需求）。

### 分組積分彈窗顯示所有組別（非僅當日組別）

`group popup.jpg` 參考圖顯示 Group A + Group B 並排，且世界杯 2026 有 12 組（A–L），僅顯示當日首場所屬組別資訊價值太低。

設計決策：點擊「查看分組」按鈕後，以全螢幕 overlay 呈現所有 12 組積分榜，2 欄網格排版。

### iframe 高度自適應用 postMessage

前端每次重新渲染後執行 `window.parent.postMessage({ type: 'wc2026-resize', height: document.body.scrollHeight }, '*')`；宿主頁面監聽並設定 iframe height。

替代方案：固定高度（內容截斷）；ResizeObserver（需 host 端有 JS 權限，不保證）。

### 旗幟使用 emoji（非圖片檔）

Spec 已定義 `team_flag` 欄為 emoji 字串。優點：零外部依賴、Sheet 直接輸入。缺點：各平台 emoji 外觀不一致。

V1 接受此 trade-off；若需統一外觀，未來可改用 flagcdn.com URL，但需更新 Sheet 欄位格式。

## Implementation Contract

**行為（使用者視角）：**
- 開啟頁面 → 自動導航至今日（或最近有賽事的日期）
- 日期導覽列顯示 7 天滑動視窗，有賽事的日期顯示藍點
- 每場比賽顯示為一張卡片：upcoming 顯示台灣時間（HH:MM）、live 顯示即時比分 + 閃爍紅點、finished 顯示最終比分（粗體大字）
- 點擊「查看分組」→ overlay 顯示 A–L 共 12 組積分榜，點擊 overlay 外側關閉
- live 場次每 60 秒自動刷新，不需手動操作

**API 介面（GAS doGet）：**

```
GET {GAS_URL}?action=getMatches[&date=YYYY-MM-DD][&phase=小組賽]
GET {GAS_URL}?action=getGroups[&group=A]
GET {GAS_URL}?action=getConfig
```

回應外層結構：`{ "status": "ok", "updated": "ISO8601", "data": [...] }`

錯誤回應：`{ "status": "error", "message": "..." }`

**失敗模式：**
- GAS fetch 失敗 → 顯示「資料載入失敗，請稍後重試」提示，不崩潰
- 當日無賽事 → 顯示「本日無賽事」提示
- Score 欄為空 → `score1/score2` 為 `null`，不渲染比分

**驗收條件：**
1. 在任意瀏覽器以 `file://` 協定開啟 `wc2026-schedule.html`，日期導覽可正常操作
2. 以 iframe 嵌入測試頁，宿主頁面高度隨內容自動調整
3. Sheet 中將一場比賽 status 改為 `live` → 60 秒內前端卡片變為橘紅底色 + 閃爍圓點
4. GAS URL 設為空字串時，前端顯示錯誤提示而非白屏
5. 分組積分彈窗正確顯示 12 組（A–L）資料

**範圍邊界：**
- In scope：`wc2026-schedule.html`、`Code.gs`、Sheet 結構定義
- Out of scope：資料填入（賽程資料由使用者自行填入 Sheet）、自動比分同步、多語系

## Risks / Trade-offs

- [GAS 冷啟動延遲] 第一次 fetch 可能需 2–4 秒 → 加 loading 狀態動畫緩解體感
- [GAS 每日配額] Web App URL Fetch 每天上限 20,000 次，104 場 × N 訪客，大流量時可能觸頂 → 前端快取 TTL 已緩解；若流量大可考慮 CDN 加一層
- [Emoji 旗幟一致性] 不同 OS/瀏覽器 emoji 外觀差異 → V1 接受；未來可換 flagcdn.com
- [Sheet 手動更新延遲] 人工填分最快 0 秒、最慢數分鐘（取決於監看人員反應速度）→ 這是 P1 設計的已知限制，非 bug
