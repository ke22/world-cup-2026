## 1. 共用基礎（三頁均適用）

- [x] 1.1 建立 a11y CSS 設計系統 token：在三個新 HTML 的 `<style>` 中定義高對比 `:root`（`--fg: #1a1a1a`、`--muted: #595959`、`--accent: #0056b3`、`--header-bg: #003d82`、`--border: #767676`、`--focus: #0056b3`）。驗收：Chrome DevTools Accessibility 面板顯示所有文字對比比率 ≥ 4.5:1，`--fg` ≥ 7:1。設計依據：設計系統：高對比配色 token。規格依據：High-contrast color tokens meeting WCAG 2.1 AA。

- [x] 1.2 設定 `html { font-size: 18px }` 並改用 `rem` 單位：body 1rem、說明文字 0.85rem、heading 1.2rem+、比分/時間 1.8rem+。驗收：DevTools computed styles 確認 body 文字 computed size = 18px；放大瀏覽器字型後頁面文字等比例縮放。設計依據：字型比例。規格依據：Enlarged typography using relative units。

- [x] 1.3 所有互動元素設 `min-height: 48px; min-width: 48px; padding`：適用 date-tab、anchor-btn、cnav-btn、nav-arrow 等。驗收：DevTools 量測三頁所有按鈕的 box height ≥ 48px。設計依據：觸控目標尺寸。規格依據：Touch target minimum size of 48×48 CSS pixels。

- [x] 1.4 加入 skip navigation 連結：`<a href="#main-content" class="skip-link">跳至主要內容</a>` 作為 `<body>` 第一個子元素，CSS 平時 `position: absolute; left: -9999px`，`:focus` 時 `left: 0; top: 0` 浮現。主內容區塊加 `id="main-content"`。驗收：按 Tab 第一個焦點落在 skip link，可見「跳至主要內容」文字；按 Enter 後焦點移至主內容。設計依據：跳過導覽（Skip Navigation）。規格依據：Skip navigation link。

- [x] 1.5 加入全域 `:focus-visible` 樣式：`outline: 3px solid var(--focus); outline-offset: 3px; border-radius: 4px`。驗收：用 Tab 鍵導覽時，每個互動元素的焦點框清晰可見，對比 ≥ 3:1。設計依據：焦點指示器。規格依據：Visible focus indicator on all interactive elements。

- [x] 1.6 加入 `@media (prefers-contrast: more)` 區塊：`--border: #000; --muted: #000`，card border-width 2px。驗收：Chrome DevTools Rendering → Emulate CSS media feature `prefers-contrast: more` 開啟後，邊框變黑色、muted 文字變全黑。設計依據：`prefers-contrast: more` 加強。規格依據：prefers-contrast media query enhancement。

- [x] 1.7 保留 `parseTwemoji()`、`notifyHeight()`、`cacheGet()`/`cacheSet()`、GAS_URL 與 Service Worker 註冊，與 v1.1 邏輯完全相同。版本標籤改為 `v1.1-a11y`。驗收：開啟三個 a11y 頁面，國旗正常顯示，postMessage 可收到 `wc2026-resize` 訊息。

---

## 2. wc2026-schedule-a11y.html

- [x] 2.1 以 `wc2026-schedule.html` 為基礎複製後修改語義結構：整體內容包在 `<main id="main-content">`、date nav 改為 `<nav aria-label="日期導覽">`、比賽列表區塊加 `aria-live="polite"` 和 `aria-label="今日賽事"`。載入中 / 錯誤訊息容器加 `role="status"`。驗收：Chrome Accessibility Tree 顯示 main landmark、nav landmark（標籤「日期導覽」）、live region。設計依據：ARIA 語義結構。規格依據：Semantic HTML structure with ARIA landmarks。

- [x] 2.2 套用任務 1.1–1.6 的樣式調整至 `wc2026-schedule-a11y.html`（字型、對比、觸控目標、focus、prefers-contrast）。驗收：axe-core 或 WAVE 工具掃描，0 個 Critical 違規。

---

## 3. wc2026-groups-a11y.html

- [x] 3.1 以 `wc2026-groups.html` 為基礎複製後修改語義結構：整體內容包在 `<main id="main-content">`、anchor nav 改為 `<nav aria-label="跳至組別">`、groups-container 加 `aria-live="polite"`、各組 `<section>` 加 `aria-label="{G} 組積分"`。驗收：Chrome Accessibility Tree 顯示 main、nav（標籤「跳至組別」）、各 section landmark。設計依據：ARIA 語義結構。規格依據：Semantic HTML structure with ARIA landmarks。

- [x] 3.2 套用任務 1.1–1.6 的樣式調整至 `wc2026-groups-a11y.html`。驗收：axe-core 掃描 0 個 Critical 違規。

---

## 4. wc2026-bracket-a11y.html

- [x] 4.1 建立 `wc2026-bracket-a11y.html`：不使用視覺賽程樹，改用清單模式。從 GAS `?action=getMatches` 取得淘汰賽資料，按輪次分組渲染為 `<section aria-label="{輪次名稱}">`，每場比賽渲染為卡片（與 schedule 的 match-card 樣式相近）。輪次順序：32強 → 16強 → 8強 → 4強 → 季軍賽 → 決賽。驗收：開啟頁面，所有淘汰賽比賽無需任何點擊即可上下捲動瀏覽；Tab 鍵可逐一聚焦到每張卡片（若有互動）。設計依據：bracket-a11y 簡化策略。規格依據：Bracket a11y list mode。

- [x] 4.2 套用任務 1.1–1.6 的樣式調整至 `wc2026-bracket-a11y.html`。驗收：axe-core 掃描 0 個 Critical 違規。

---

## 5. 更新 wc2026-embed-info.html

- [x] 5.1 在 `wc2026-embed-info.html` 中新增「無障礙版（a11y）」區段，提供三個 a11y 頁面的嵌入代碼（與現有格式相同的 iframe + postMessage script）。驗收：開啟 embed-info 頁，可看到 a11y 版嵌入代碼區塊，複製後可正常使用。

---

## 6. 整合驗收

- [x] 6.1 用 Chrome DevTools 375px 手機模擬，開啟三個 a11y 頁面：確認所有文字 ≥ 18px，按鈕高度 ≥ 48px，國旗顯示，skip link 可用。

- [x] 6.2 在 `test-embed.html` 中加入三個 a11y iframe，確認 postMessage 高度自動調整正常，各 iframe 撐開至正確高度。
