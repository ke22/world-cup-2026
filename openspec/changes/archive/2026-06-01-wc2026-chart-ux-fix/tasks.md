## 1. 捲動友善佈局（三頁共同）

- [x] 1.1 移除 `wc2026-bracket.html` 外層容器的 `height: 100vh; overflow: hidden`，改為 `min-height: 100svh`；加入 `-webkit-fill-available` fallback（`body { min-height: -webkit-fill-available; }`）。驗收：在 375px 寬的 iframe（高度 400px）中開啟，bracket 內容不被截斷，可向下捲動。設計依據：捲動友善佈局取代 `100vh + overflow:hidden`。

- [x] 1.2 移除 `wc2026-groups.html` 外層容器的 `height: 100vh; overflow: hidden`，改為 `min-height: 100svh`；加入 `-webkit-fill-available` fallback。驗收：iframe（高度 400px）中，積分榜可完整顯示或向下捲動，無截斷。設計依據：捲動友善佈局取代 `100vh + overflow:hidden`。

- [x] 1.3 移除 `wc2026-schedule.html` 外層容器的 `height: 100vh; overflow: hidden`，改為 `min-height: 100svh`；加入 `-webkit-fill-available` fallback。驗收：iframe（高度 400px）中，賽程內容可向下捲動，無截斷。設計依據：捲動友善佈局取代 `100vh + overflow:hidden`。

## 2. postMessage 高度通知

- [x] 2.1 在 `wc2026-bracket.html` 加入 `notifyHeight()` 函式，格式為 `window.parent.postMessage({ type: 'wc2026-resize', height: document.documentElement.scrollHeight }, '*')`，包於 `try/catch`。在初始化完成及 `fitBracket()` 末端呼叫。驗收：在 iframe 中開啟 bracket 頁，瀏覽器 DevTools Console 監聽 `message` 事件可收到 `type: 'wc2026-resize'`，`height` 為正整數。設計依據：postMessage 高度通知統一合約。

- [x] 2.2 在 `wc2026-groups.html` 加入 `notifyHeight()` 函式（同上格式），在資料渲染完成（`renderGroups()` 末端）及各 loading/error state 後呼叫。驗收：同 2.1，在 groups iframe 中可收到 `wc2026-resize` 訊息。設計依據：postMessage 高度通知統一合約。

- [x] 2.3 將 `wc2026-schedule.html` 現有 `notifyHeight()` 的呼叫擴充至 `renderMatches()` 函式末端（日期 tab 切換後的渲染完成點）。驗收：切換日期 tab 後，DevTools Console 可收到新的 `wc2026-resize` 訊息，且 `height` 值與新內容高度一致。規格依據：Height notification on date tab switch。

## 3. resize Debounce（bracket 頁）

- [x] 3.1 在 `wc2026-bracket.html` 的 `resize` 監聽器加入 150ms debounce：宣告 `let _resizeTimer`，在 handler 中執行 `clearTimeout(_resizeTimer); _resizeTimer = setTimeout(fitBracket, 150)`。驗收：連續快速拖曳視窗邊緣 1 秒，`fitBracket` 呼叫次數 ≤ 1 次（可用 `console.count('fitBracket')` 驗證）。規格依據：Resize event debounce on bracket page。設計依據：`resize` Debounce（bracket 頁）。

## 4. 觸控目標最小尺寸

- [x] 4.1 將 `wc2026-groups.html` 的 `.anchor-btn` CSS 高度從 `height: 32px` 改為 `height: 44px`。驗收：DevTools 量測 `.anchor-btn` 的 box height = 44px。規格依據：Touch target minimum size。設計依據：觸控目標最小尺寸。

- [x] 4.2 將 `wc2026-schedule.html` 的 `.date-tab` CSS 由 `padding: 5px 2px` 改為 `padding: 8px 4px`，確保實際渲染高度 ≥ 44px。驗收：DevTools 量測 `.date-tab` computed height ≥ 44px。規格依據：Touch target minimum size。設計依據：觸控目標最小尺寸。

- [x] 4.3 將 `wc2026-bracket.html` mobile view 的 `.cnav-btn` CSS 由 `padding: 4px 2px` 改為 `padding: 10px 8px`。驗收：在 375px 寬的 viewport，DevTools 量測 `.cnav-btn` computed height ≥ 44px。規格依據：Touch target minimum size。設計依據：觸控目標最小尺寸。

## 5. prefers-reduced-motion Guard

- [x] 5.1 在 `wc2026-bracket.html`、`wc2026-groups.html`、`wc2026-schedule.html` 各自的 `<style>` 末端加入 `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }`。驗收：在 macOS 系統「減少動態效果」開啟後，三頁的 hover transition 均停止（DevTools Emulate CSS media feature `prefers-reduced-motion: reduce` 可驗證）。規格依據：prefers-reduced-motion guard。設計依據：`prefers-reduced-motion` Guard。

## 6. iOS Safari Viewport 修正

- [x] 6.1 確認三頁的 `<body>` style 加入 `min-height: -webkit-fill-available`（`html` 元素同步設定）。在三頁最外層容器套用 `min-height: 100svh`（已在 1.1–1.3 完成），此任務確認 `html` 和 `body` 同步設定以啟用 `-webkit-fill-available` 回退鏈。驗收：iOS Safari（可用 BrowserStack 或 Simulator）開啟三頁，頁面底部不被 URL bar 遮蓋。規格依據：iOS Safari viewport unit fallback。

## 7. 整合驗收

- [x] 7.1 建立 `test-embed.html` 測試頁面，在同一頁面以三個 `<iframe>`（寬度 375px、高度從 300px 開始）分別嵌入三個 chart，監聽 `wc2026-resize` 訊息並動態更新各 iframe 的 `height` 樣式。開啟 `test-embed.html`，確認三個 iframe 均能自動撐開至完整內容高度，無截斷。規格依據：Scroll-friendly layout without viewport height lock、postMessage height notification to parent frame。

- [x] 7.2 以 375px viewport（Chrome DevTools 裝置模擬）開啟三頁，逐一量測 `anchor-btn`、`date-tab`、`cnav-btn` 的 computed height ≥ 44px，切換 `prefers-reduced-motion: reduce`，確認 transition 停止。記錄三頁均通過。
