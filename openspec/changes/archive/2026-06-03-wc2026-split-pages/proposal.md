## Why

現有的 `wc2026-schedule.html` 把所有功能集中在單一頁面，分組積分榜以 overlay 呈現、缺乏專屬的淘汰賽樹狀圖，且日期導覽列未顯示月份資訊，初次載入也無法自動定位到今天日期。這些問題降低了賽事資訊的可讀性與瀏覽便利性。

## What Changes

- **新增** `wc2026-groups.html`：獨立的分組積分榜頁面，12 組單欄排列，字體放大，頂部設 A–L 錨點快捷按鈕，隊伍名稱以「旗幟 emoji + 隊名」顯示
- **新增** `wc2026-bracket.html`：獨立的淘汰賽樹狀圖頁面，獎盃居中、左右各 24 隊展開（R32 → R16 → QF → SF → F），自動偵測當前賽段並展開，已完賽輪次與未開賽輪次預設折疊，字體放大，RWD 兼容手機與桌面
- **修改** `wc2026-schedule.html`：
  - 日期導覽列加入月份標示（跨月份時顯示月份分隔）
  - 頁面載入時自動捲動定位到今天日期

## Capabilities

### New Capabilities

- `groups-page`: 獨立分組積分榜頁面，含 12 組、錨點快捷按鈕、旗幟+隊名顯示、單欄大字型排版
- `bracket-page`: 獨立淘汰賽樹狀圖頁面，獎盃居中左右展開、自動追蹤賽段展開、可折疊輪次、RWD 支援

### Modified Capabilities

- `match-schedule`: 日期導覽列加入月份顯示、初始載入自動定位今天

## Impact

- Affected specs: `groups-page` (new), `bracket-page` (new), `match-schedule` (modified)
- Affected code:
  - New: `wc2026-groups.html`, `wc2026-bracket.html`
  - Modified: `wc2026-schedule.html`
  - Removed: (none)
