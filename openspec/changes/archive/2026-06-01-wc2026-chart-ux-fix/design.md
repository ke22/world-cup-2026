## Context

三個 CNA 世界杯互動圖表（`wc2026-bracket.html`、`wc2026-groups.html`、`wc2026-schedule.html`）以 `<iframe>` 嵌入 CNA 新聞頁。目前三個頁面均採用 `height: 100vh; overflow: hidden` 佈局模式：在獨立瀏覽器視窗運作正常，但在 iframe 環境下父頁面無法得知 chart 真實高度，導致內容被截斷或留有大量空白。`bracket` 和 `groups` 頁完全無 postMessage 機制；`schedule` 頁有 postMessage 但只在初始載入時觸發，切換日期 tab 後不更新。此外行動裝置觸控目標最小僅 28px（規範要求 44px），且無 `prefers-reduced-motion` 保護。

## Goals / Non-Goals

**Goals:**

- 三頁均採用捲動友善佈局，iframe 嵌入時不截斷內容
- 三頁均實作 postMessage 高度通知，任何改變頁面高度的操作後均重發
- 所有互動元素觸控目標 ≥ 44px
- CSS transition 受 `prefers-reduced-motion` 保護
- iOS Safari `100vh` 截斷問題透過 `svh` / `-webkit-fill-available` 解決

**Non-Goals:**

- 不更動 chart 資料邏輯或視覺設計
- 不修改 CNA 父頁面的 iframe 嵌入程式碼
- 不新增 `prefers-color-scheme` dark mode

## Decisions

### 捲動友善佈局取代 `100vh + overflow:hidden`

**決策**：移除三頁的 `.page` / `.wrapper` 上的 `height: 100vh; overflow: hidden`，改為 `min-height: 100svh`（iOS 16+），搭配 `-webkit-fill-available` fallback 處理舊版 Safari。內容區塊改由各自的 `overflow-y: auto` 控制捲動，不再依賴外層截斷。

**替代方案**：保留 `100vh` 並讓 CNA 父頁面用 JavaScript 動態設定 iframe 高度。拒絕原因：需要 CNA 端配合修改，侵入性高；本方案只改 chart 自身，零依賴。

### postMessage 高度通知統一合約

**決策**：三頁均實作 `notifyHeight()` 函式，發送 `{ type: 'wc2026-resize', height: document.documentElement.scrollHeight }`。origin 維持 `'*'`（chart 只傳高度數值，無敏感資料）。

觸發時機（所有三頁統一）：
1. 初始化完成後
2. 資料渲染完成後
3. 任何改變可見內容高度的用戶互動後（tab 切換、篩選、展開）
4. `resize` 事件（bracket 頁的 `fitBracket` 呼叫鏈末端）

**替代方案**：使用 `ResizeObserver`。拒絕原因：LINE 瀏覽器與舊版 Android WebView 支援不穩定；明確觸發點比持續監聽更可預測，且無需 guard。

### `resize` Debounce（bracket 頁）

**決策**：`fitBracket` 加入 150ms debounce（`clearTimeout` + `setTimeout` 模式）。150ms 是人類感知「結束拖曳」的合理閾值，不影響旋轉裝置的響應感。

### 觸控目標最小尺寸

**決策**：
- `anchor-btn`（groups）：`height: 32px → 44px`
- `date-tab`（schedule）：`padding: 5px 2px → padding: 8px 4px`，確保實際點擊高度 ≥ 44px
- `cnav-btn` mobile（bracket）：`padding: 4px 2px → padding: 10px 8px`

不調整元素視覺尺寸（字體大小、圖示不變），只擴大 padding 增加點擊區域。

### `prefers-reduced-motion` Guard

**決策**：在三頁所有含 `transition` 的 CSS 規則後，加入：
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; }
}
```
全域覆蓋比逐條修改更完整，且在 chart 頁面不影響功能。

## Implementation Contract

**postMessage 合約**（適用三頁）：
- 訊息格式：`{ type: 'wc2026-resize', height: number }`
- `height` 值來源：`document.documentElement.scrollHeight`
- 發送對象：`window.parent`，origin `'*'`
- CNA 父頁面監聽範例（供參考，不在本次修改範圍）：
  ```js
  window.addEventListener('message', e => {
    if (e.data?.type === 'wc2026-resize') iframe.style.height = e.data.height + 'px';
  });
  ```

**佈局行為**：
- iframe 內，chart 頁面的 body 高度由內容撐開，父頁面可依 postMessage 設定 iframe 高度
- 獨立開啟時，頁面行為與修改前相同（`min-height: 100svh` 保持全螢幕填充感）

**觸控目標驗收條件**：
- 用瀏覽器 DevTools 量測 `anchor-btn`、`date-tab`、`cnav-btn` 的 box 高度 ≥ 44px

**`prefers-reduced-motion` 驗收條件**：
- macOS「減少動態效果」開啟後，所有 hover/active transition 停止

**範圍邊界**：
- 修改僅限三個 HTML 檔案的 CSS `<style>` 區塊與 `<script>` 區塊
- 不修改 HTML 結構（DOM 節點增刪）
- 不修改任何資料取得或計算邏輯

## Risks / Trade-offs

- [`svh` 單位 iOS 15 不支援] → 已加 `-webkit-fill-available` fallback；iOS 15 降級為接近 `100vh` 的行為，可接受
- [全域 `transition: none` 可能影響未來新增的動畫] → 此類 chart 無需複雜動畫；若未來需要，改為具名 class guard
- [postMessage `'*'` origin] → chart 只傳高度數值，無 PII 或操作指令，風險可接受
