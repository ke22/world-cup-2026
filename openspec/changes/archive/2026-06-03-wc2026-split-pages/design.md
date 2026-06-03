## Context

`wc2026-schedule.html` 是一個單頁 HTML，無外部框架依賴，透過自架 API (`apiFetch`) 取得比賽資料與分組積分。目前分組積分僅以 overlay 呈現，缺少淘汰賽樹狀圖，日期列無月份資訊，初始定位由 `findInitialDate()` 計算但不自動捲動。

WC 2026 淘汰賽結構：48 隊 → R32（16 場）→ R16（8 場）→ QF（4 場）→ SF（2 場）→ 決賽（1 場）＋季軍賽（1 場）。

## Goals / Non-Goals

**Goals:**

- 建立獨立的 `wc2026-groups.html`：單欄、字體大、旗幟+隊名、A-L 錨點按鈕
- 建立獨立的 `wc2026-bracket.html`：獎盃居中、左右各 24 隊淘汰賽樹、自動追蹤並展開當前賽段、可折疊輪次、RWD
- 修改 `wc2026-schedule.html`：日期列加月份、初始載入自動捲動到今天

**Non-Goals:**

- 不重構現有的 API 呼叫模式（apiFetch 保持不動）
- 不加入 Router 或 SPA 架構，三個頁面各自獨立
- 不修改後端 API
- 不支援深色模式

## Decisions

### 三個頁面各自獨立的 HTML 檔

**決定**：每個頁面為獨立 HTML，共享相同的 CSS 變數設計系統，但不共用 JS 模組。

**替代方案**：單一 HTML + Tab 切換（複雜度低但 URL 無法分享個別頁面）。

**理由**：可獨立嵌入 iframe、URL 可分享，維護清晰。代價是部分 CSS 重複，但整體小於 50KB，可接受。

### groups-page 單欄排版與錨點快捷按鈕

**決定**：移除 CSS Grid 雙欄（`groups-grid`），改為單欄；頂部加固定（或 sticky）的 12 個錨點按鈕（A-L），點擊捲動至對應組別 section（`#group-A` 等 id）。

**字體大小**：
- 隊名：14px → 16px
- 積分：12px → 15px
- 組別標題：原有大小 → 18px

**旗幟顯示**：隊伍格 = `{flag_emoji} {name}` 並排，旗幟 font-size: 18px。

### bracket-page 佈局：獎盃居中、雙側展開

**決定**：使用 CSS Flexbox 橫向排列，結構如下：

```
[R32] [R16] [QF] [SF] [🏆決賽] [SF] [QF] [R16] [R32]
```

每輪為一個 `.round` 欄，比賽卡片為 `.match-node`，連線用 CSS `::before`/`::after` pseudo-element 畫 L 型線段。

**手機 RWD**：寬度 < 640px 時切換為垂直堆疊，每輪為一個可折疊區塊（`<details>` 元素或 JS toggle）。

### bracket-page 自動追蹤展開邏輯

**決定**：比較今天日期（`new Date()`）與各輪次的比賽日期範圍，找出「包含今天或距今最近的未完賽輪次」作為自動展開目標。

展開規則：
1. 有 `status: 'live'` 的比賽 → 展開該輪
2. 有 `status: 'upcoming'` 且最近的輪次 → 展開
3. 全部完賽 → 展開決賽輪

折疊規則：
- 所有比賽 `status: 'finished'` 的輪次 → 預設折疊
- 尚無任何已知隊伍（`TBD` 佔位）的輪次 → 預設折疊

### match-schedule 日期列月份顯示

**決定**：在 7 天視窗中，當日期跨越月份時（例如 6/30 → 7/1），在該日期 tab 上方或 tab 內部以小字顯示月份名稱（「七月」）。若 7 天全在同一個月，在導覽列左側顯示當前月份。

### match-schedule 初始載入自動定位

**決定**：`findInitialDate()` 回傳目標日期後，呼叫 `scrollToActiveTab()` 讓 date-tabs 容器以 `scrollIntoView({ behavior: 'smooth', inline: 'center' })` 定位到 active tab。

## Implementation Contract

### wc2026-groups.html

**行為**：
- 載入後顯示 12 組積分榜，各組 4 隊，單欄排列
- 頂部 12 個按鈕（A–L），點擊後平滑捲動到對應組別
- 每隊顯示格式：`{旗幟 emoji} {隊名} | 賽 | 勝 | 平 | 負 | 球差 | 積分`

**資料來源**：與 `wc2026-schedule.html` 相同的 `fetchGroups()` API 呼叫。

**驗收標準**：
- 所有 12 組（A-L）均顯示，排序正確（積分 DESC → 球差 DESC → 進球 DESC）
- 錨點按鈕點擊後頁面捲動至對應組別（可手動驗證）
- 在 375px 寬度下單欄正常顯示，不超出螢幕

### wc2026-bracket.html

**行為**：
- 5 輪（R32、R16、QF、SF、決賽）左右各一側，決賽在中央
- 季軍賽顯示在決賽下方
- 頁面載入後自動展開「當前賽段」輪次
- 已完賽輪次預設折疊，可點擊展開
- 未開賽輪次預設折疊，可點擊展開

**資料形狀**：複用 `allMatches` 陣列，以 `m.phase`（如 `'Round of 32'`、`'Quarter-final'`）分類各輪。

**驗收標準**：
- 桌面（>= 640px）：橫向 bracket，連線可見
- 手機（< 640px）：每輪為垂直區塊，可折疊
- 自動展開邏輯：若今天在 QF 期間，QF 輪展開，R32/R16 折疊，SF/決賽折疊
- 點擊輪次標題可切換折疊/展開

### wc2026-schedule.html（修改）

**行為**：
- 日期列 7 tab 中，若有跨月份，月份名稱顯示在相應 tab 上
- 頁面載入後 active tab 自動捲動至可見區域（`scrollIntoView`）

**驗收標準**：
- 跨月份日期（如 6/30、7/1）可看到月份標示
- 在 375px 寬度下，打開頁面後 active date tab 置中顯示

## Risks / Trade-offs

- [Risk] bracket 連線的 CSS pseudo-element 在不同瀏覽器可能有 1px 偏差 → 使用 `border` 而非 `outline`，接受輕微偏差
- [Risk] API 回傳的 `m.phase` 欄位值格式不確定 → 在 tasks 中需先 console.log 確認實際值再對應
- [Risk] 淘汰賽早期比賽隊伍為 `TBD`，bracket 需優雅顯示佔位 → 顯示 `待定` 灰色文字
