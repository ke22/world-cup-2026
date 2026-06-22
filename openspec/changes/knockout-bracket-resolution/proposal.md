## Why

淘汰賽對陣圖目前無法自動填入晉級隊伍。現行的 `syncBracket()`（`Code.gs`）只是「鏡射」football-data.org API 已經解析好的淘汰賽對陣（讀取 `homeTeam.tla` / `awayTeam.tla`）；在該 API 尚未把小組賽結束後的晉級隊伍寫入前，所有淘汰賽列的 `tla` 都是空的，導致 `syncBracket` 命中 `if (!t1 || !t2) return;` 而完全不填。換言之，我們把一件自己就能算的事，外包給一個更新時程不受控、且免費方案會延遲的第三方。

本專案其實已具備自行解析所需的兩項資料：前端 `wc2026-bracket.html` 的 `R32_SEEDS` 已編碼官方 WC2026 32 強對陣結構，後端 `recalcGroups()` 已累積各隊積分（pts / gd / gf）。缺的只是「排名」與「最佳第三名分配表」這層計算。

## What Changes

- 在 `Code.gs` 新增一組**純函式**淘汰賽解析器，從小組積分 + 官方 seed 對照表計算 32 強對陣隊伍，並寫入 `matches` 工作表的淘汰賽列。
- `syncBracket()` 改為呼叫此解析器，不再依賴 football-data.org 解析淘汰賽隊伍；football-data 僅保留供 `syncScores()` 同步即時比分。
- 解析器涵蓋三段純計算：
  1. `rankGroup` — 將同組四隊依 pts → gd → gf 排序，取得小組第 1、第 2。
  2. `rankThirds` — 將 12 個小組第 3 名跨組排名，取前 8 名。
  3. `assignThirds` — 依官方 FIFA「最佳第三名」組合分配表，把入選的 8 個第三名指派到對應的 32 強 slot（如 `3 ABCDF`）。
- seed 對照表（`R32_SEEDS` 等價物）移入後端解析器，作為單一事實來源；前端維持以 `getMatches` 渲染，不需改動渲染邏輯。
- 小組冠軍或亞軍一旦能由現有積分與剩餘最高可得分確定，就立即填入對應的 32 強 slot；不必等待全部小組賽結束。最佳第三名仍在 8 支晉級隊伍全部確定後才分配。
- 小組內同分判定改為 FIFA 2026 官方順序：先比較同分隊伍間的對賽積分、對賽得失球與對賽進球，仍同分時再比較整體得失球、整體進球、紀律分與 FIFA 排名。漸進式確定判斷亦使用已完成的直接對賽結果，讓墨西哥等已鎖定組別名次的隊伍能與 Google 同期顯示。
- 手動鎖定列（`row[17] === true`）不被覆寫；未鎖定列視為自動管理，可在後續同步重新計算，避免過早填入的資料永久卡住。
- `wc2026-bracket.html` 每 60 秒重新讀取 `getMatches`，讓已開啟的頁面不必人工重新整理。
- 以 TDD 方式開發：每段純函式先寫測試（沿用 `tests/api-auto-update.test.js` 的 `vm` 抽取模式）再實作。

## Capabilities

### New Capabilities

- `knockout-resolution`: 從小組積分榜與官方 WC2026 對陣結構，決定式地計算 32 強晉級隊伍並寫回賽程資料，取代對 football-data.org 淘汰賽解析的依賴。

### Modified Capabilities

- `bracket-page`: 已開啟的對戰表定時重新讀取資料並更新畫面。

## Impact

- Affected specs: 新增 `knockout-resolution`；與 `bracket-page`、`group-standings`、`data-api` 相關但其需求不變。
- Affected code:
  - Modified: Code.gs（重寫 `syncBracket` 的隊伍解析來源，新增純函式解析器、官方對賽排序與 seed/分配對照表）
  - Modified: wc2026-bracket.html（每 60 秒自動刷新）
  - New: tests/knockout-resolution.test.js（純函式 TDD 測試）
  - Removed: （無）
