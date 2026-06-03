## Why

世界杯 2026 賽程橫跨 39 天、共 104 場，需要一個可嵌入任意網頁的賽程儀表板，讓讀者即時查閱比分與賽況，並由人工透過 Google Sheet 維護資料，無需架設獨立伺服器。

## What Changes

- 新增 Google Sheet 資料結構（matches、groups、config 三張工作表）
- 新增 Google Apps Script Web App，提供 JSON API（getMatches、getGroups、getConfig）
- 新增單檔前端元件（`wc2026-schedule.html`），含日期導覽、比賽卡、分組積分彈窗
- 前端支援 `<iframe>` 嵌入並自動通知宿主頁面高度
- 前端實作 sessionStorage 快取（TTL 60 秒）及 live 場次 60 秒自動刷新

## Non-Goals

- **不實作 P3 自動比分同步**：第三方比分 API 引入外部依賴與維護成本，對 39 天賽期不值得，由人工填入 Sheet 取代
- **不實作多語系切換**：介面固定為繁體中文
- **不建置打包工具或前端框架**：單一 HTML 檔，無 npm/build step
- **不實作使用者帳號或權限控管**：GAS Web App 公開存取，Sheet 編輯權限由 Google 帳號管理

## Capabilities

### New Capabilities

- `match-schedule`: 依日期瀏覽賽程，顯示比賽卡（upcoming/live/finished 三種狀態），含日期導覽與 7 天滑動視窗
- `group-standings`: 分組積分彈窗，顯示所有 A–L 組別的積分榜（P/W/D/L/GD/Pts）
- `data-api`: GAS doGet Web App，將 Google Sheet 序列化為 JSON，供前端 fetch 使用
- `embed-widget`: 單檔 HTML 可 iframe 嵌入，自動 postMessage 通知宿主頁面高度調整

### Modified Capabilities

（無）

## Impact

- Affected specs: match-schedule、group-standings、data-api、embed-widget（均為新建）
- Affected code:
  - New: `wc2026-schedule.html`
  - New: `Code.gs`
  - New: `README.md`
