## Why

三個 interactive chart（`wc2026-bracket.html`、`wc2026-groups.html`、`wc2026-schedule.html`）在 CNA 新聞頁以 `<iframe>` 嵌入時，因 `height: 100vh` + `overflow: hidden` 的組合導致內容被截斷，且 `bracket` 和 `groups` 兩頁缺乏 postMessage 高度通知，父頁面無法自適應 iframe 高度。同時存在行動裝置觸控目標過小（最小僅 28px）及缺乏 `prefers-reduced-motion` 支援等無障礙問題。

## What Changes

- **所有三頁**：將 `height: 100vh; overflow: hidden` 替換為捲動友善的 flex 佈局，搭配 `min-height: 100dvh` fallback，解除 iframe 內容截斷
- **bracket.html、groups.html**：新增 `postMessage` iframe 高度通知（`{ type: 'wc2026-resize', height }` 傳至 `window.parent`）
- **schedule.html**：`notifyHeight()` 擴充至日期 tab 切換、賽程渲染完成後均觸發
- **bracket.html**：`resize` 事件監聽器加入 debounce（150ms），避免旋轉裝置時 CPU 暴衝
- **所有三頁**：互動元素觸控目標升至 ≥ 44px（`anchor-btn`、`date-tab`、`cnav-btn`）
- **所有三頁**：CSS transition 規則加入 `@media (prefers-reduced-motion: reduce)` guard
- **所有三頁**：`height: 100vh` 改用 `height: 100svh` 並搭配 `-webkit-fill-available` fallback，解決 iOS Safari URL bar 截斷

## Non-Goals

- 不更動 chart 的視覺設計或資料邏輯
- 不為 bracket、groups 頁面建立完整的 GAS 資料層 spec（僅修 layout 與互動層）
- 不新增 dark mode 或 `prefers-color-scheme` 支援（P2，本次不處理）
- 不修改 CNA 父頁面的 iframe embed 程式碼（本次只修 chart 自身）

## Capabilities

### New Capabilities

- `iframe-embed-height`: 三個 chart 頁面統一透過 `postMessage` 向父頁面報告自身高度，並在任何會改變頁面高度的操作後重新通知；佈局改為捲動友善模式，不依賴固定 viewport 高度

### Modified Capabilities

- `match-schedule`: 擴充高度通知觸發時機，涵蓋日期 tab 切換與賽程資料渲染完成

## Impact

- Affected specs: `iframe-embed-height`（new）、`match-schedule`（modified）
- Affected code:
  - Modified: `wc2026-bracket.html`
  - Modified: `wc2026-groups.html`
  - Modified: `wc2026-schedule.html`
