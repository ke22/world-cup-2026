## Why

現有三個 chart 頁面（`wc2026-schedule.html`、`wc2026-groups.html`、`wc2026-bracket.html`）以 14px 字型、低對比度設計為主，未符合 WCAG 2.1 AA 標準，且不適合長輩閱讀。CNA 讀者群中有大量銀髮族用戶，需要一組可嵌入同一新聞頁的無障礙版本，在不影響現有 v1.1 的前提下，另行提供更易讀、更易用的替代版本。

## What Changes

- 建立三個新的獨立 HTML 檔案：`wc2026-schedule-a11y.html`、`wc2026-groups-a11y.html`、`wc2026-bracket-a11y.html`
- **字型放大**：body 18px（原 14px），標題 22–28px，說明文字 16px
- **高對比配色**：前景 #1a1a1a、背景 #ffffff，所有文字對比比率 ≥ 7:1（AAA），互動元素 ≥ 4.5:1（AA）
- **觸控目標**：所有可點擊元素 ≥ 48×48px（長輩標準，原為 44px）
- **焦點指示器**：`:focus-visible` 加粗外框，3px solid #0056b3，不依賴顏色單一傳達狀態
- **語義結構**：完整 `<main>`、`<nav aria-label>`、`<section>`、`aria-live="polite"` 即時區域、每個互動元素具備 `aria-label`
- **跳過導覽連結**：頁面頂端加 skip-to-content 連結供鍵盤用戶
- **圖示+文字並存**：取消純圖示按鈕，所有操作均有可見文字標籤
- **`prefers-reduced-motion`**：已保留自 v1.1
- **`prefers-contrast: more`**：新增 media query，進一步增強對比
- 全部保留 postMessage height 通知與 GAS 資料串接，功能與 v1.1 相同

## Non-Goals

- 不修改現有 v1.1 檔案（wc2026-*.html 保持不變）
- 不支援 WCAG 2.1 AAA 全部標準（目標為 AA 合規，部分達到 AAA）
- 不新增語音閱讀（screen reader TTS）自訂音訊
- 不建立 dark mode 變體（可於後續版本加入）

## Capabilities

### New Capabilities

- `accessible-chart-edition`: 三個 chart 頁面的無障礙長輩版，符合 WCAG 2.1 AA，字型放大、高對比、完整鍵盤導覽、語義 HTML 結構

### Modified Capabilities

(none)

## Impact

- Affected specs: `accessible-chart-edition`（new）
- Affected code:
  - New: `wc2026-schedule-a11y.html`
  - New: `wc2026-groups-a11y.html`
  - New: `wc2026-bracket-a11y.html`
  - Modified: `wc2026-embed-info.html`（新增 a11y 版本嵌入代碼區塊）
