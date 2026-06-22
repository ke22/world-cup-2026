## Context

淘汰賽對陣圖（`wc2026-bracket.html`）的 32 強隊伍欄長期維持 TBD，無法隨小組賽結果自動填入。根因在於 `syncBracket()`（Code.gs）只把 football-data.org 已解析好的淘汰賽對陣鏡射過來——在該 API 寫入晉級隊伍前，淘汰賽列的 `tla` 為空，`if (!t1 || !t2) return;` 使其完全不填。

本專案已具備自行解析所需的素材：

- `recalcGroups()` 累積各隊 `pts / gd / gf`（寫入 `groups` 工作表），但**不做排名**。
- 前端 `R32_SEEDS`（`wc2026-bracket.html`）以 seed 代碼編碼官方 32 強對陣（如 `73: ['2A','2B']`、`74: ['1E','3 ABCDF']`），其中 `3 XXXXX` 代表「最佳第三名」slot。

缺口是三層計算：小組內排名、跨組第三名排名、以及 WC2026「最佳第三名」官方組合分配表。

## Goals / Non-Goals

**Goals:**

- 在後端以決定式計算填入 32 強（match_id 73–88）的對陣隊伍，移除對 football-data.org 淘汰賽解析的依賴。
- 將官方對陣結構與最佳第三名分配表移入後端，作為單一事實來源。
- 以 TDD 開發三段純函式，沿用既有 `vm` 抽取測試模式。

**Non-Goals:**

- **不**處理 16 強之後的晉級遞補（依淘汰賽勝者推進 R16→決賽）。那是「勝者傳播」而非「小組積分排名」，屬另一獨立能力，列為後續變更。
- **不**抓取或解析 Google 搜尋頁面；Google 並非本系統的資料 API，目標是以相同官方規則得到相同結果。
- **不**變更 bracket 視覺結構；前端只新增定時重抓與重新渲染。
- **不**移除 football-data 比分同步；`syncScores()` 仍保留即時比分功能。

## Decisions

### 後端純函式解析器取代 football-data 淘汰賽鏡射

`syncBracket()` 改為呼叫本地解析器 `resolveR32(groups)`，不再讀取 football-data 的 `homeTeam.tla`。解析器為純函式（無 Sheet / 網路 I/O），由 `syncBracket()` 負責讀寫 Sheet。理由：解析邏輯可單元測試、不受第三方更新時程影響。
替代方案：在前端解析（沿用現有 `R32_SEEDS`）——否決，因 Sheet 與 admin 仍會停在 TBD，且 seed 表會在前後端重複。

### seed 對照表與最佳第三名分配表移入後端作為單一事實來源

後端新增兩個常數：`R32_SEED_MAP`（match_id → 兩個 seed 代碼，等價於前端 `R32_SEEDS`）與 `THIRD_PLACE_ALLOCATION`（最佳第三名組合 → slot 指派表）。`THIRD_PLACE_ALLOCATION` 內容必須逐筆轉錄自 FIFA 官方 WC2026 文件並於測試中以已知組合驗證。理由：避免前後端各持一份對照表造成漂移。

### 小組排序採 FIFA 2026 對賽優先規則

`rankGroup(teams, matches)` 先按總積分分組；同分隊伍以彼此間已完成比賽計算對賽積分、對賽得失球與對賽進球。若只分開部分隊伍，對仍同分的子集合重新套用這三項。之後依序比較整體得失球、整體進球、紀律分與 FIFA 排名；最後才以 team code 作為資料缺漏時的決定式 fallback。`rankThirds` 維持跨組規則 pts → gd → gf，兩者不可共用同一 comparator。

理由：2026 小組同分規則改為對賽優先；只用整體 gd/gf 會比 Google 晚辨識已鎖定名次。替代方案是等待官方 API 直接填淘汰賽隊伍，但其免費資料更新延遲正是本變更要移除的依賴。

### 已確定的小組名次漸進寫入，未鎖定列持續重算

每次同步以球隊目前積分與剩餘場次的最高可得分建立保守上下界。只有某隊在所有可能結果下都固定為小組第 1 或第 2，才解析對應的 `1X` 或 `2X` seed；整組賽事完成時則直接採 `rankGroup` 的最終排序。最佳第三名 slot 必須等 8 支晉級第三名的完整集合確定後才解析。

R32 未鎖定列由自動解析器管理：每次同步分別寫入已解析的主客隊，未解析的一側維持空白，並允許後續同步修正。`row[17] === true` 的手動鎖定列仍整列跳過。理由：只以 `row[6]` 判斷「已有資料」無法區分自動結果與人工資料，會讓過早結果永久卡住；現有 manual 欄已是明確的人工保護界線。

替代方案：等待 12 組全部完賽後一次填入——否決，會讓已確定的冠亞軍無法及時出現在對戰表。

### 對戰表每 60 秒無重疊刷新

`wc2026-bracket.html` 在初次 `init()` 完成後啟動 60 秒 timer；每次 tick 重新呼叫資料載入與渲染。若上一次刷新尚未完成則跳過該 tick，避免慢速 GAS 冷啟動造成並行請求。`fetchAllMatches()` 已使用 timestamp query 且 `CACHE_TTL = 0`，因此每次取得最新資料。

### 沿用 vm 抽取式 TDD，先測試後實作

新增 `tests/knockout-resolution.test.js`，以既有 `loadFunctions(gasCode, [...])` 模式從 Code.gs 抽取純函式測試。每段函式先寫失敗測試再實作。理由：與 `tests/api-auto-update.test.js` 一致，無需引入測試框架。

## Implementation Contract

**Behavior:** 每次 `syncScores()` 尾端依 FIFA 2026 對賽優先規則執行淘汰賽解析。已鎖定的小組冠軍或亞軍立即寫入 match_id 73–88；尚未確定的一側保持空白。最佳第三名在完整晉級集合確定後寫入。已開啟的 bracket 最遲在下一次 60 秒刷新後呈現後端資料。

**Interface / data shape（純函式，皆無 I/O）：**

- `rankGroup(teams, matches)` — 輸入同組 4 隊與已完成的同組比賽 `{team1, team2, score1, score2, status}`；輸出依 FIFA 2026 小組規則排序後的 4 隊。
- `rankThirds(thirds)` — 輸入 12 個第三名 `{group, code, pts, gd, gf}`；輸出依同規則排序的陣列，前 8 名為晉級者。
- `assignThirds(qualifiedGroups)` — 輸入 8 個晉級組字母（已排序）；查 `THIRD_PLACE_ALLOCATION` 回傳 `{ slotId: groupLetter }` 指派。輸入非 8 組或查無對應組合時回傳 `null`。
- `resolveR32(groups, matches)` — 協調者：輸入 12 組積分與小組賽結果；輸出 `{ [matchId]: { home, away } }`。
- `resolveClinchedGroupRanks(teams, matches)` — 以剩餘最高可得分與已完成直接對賽結果保守判定固定名次。
- `startBracketAutoRefresh()` — 啟動單一 60 秒 timer；刷新進行中時不建立第二個請求。

**Failure modes:** 名次仍可能變動 → 對應 slot 保持空白。`assignThirds` 查無組合 → 回傳 null，第三名 slot 保持空白並記 Logger。隊伍 code 在 `groups` 找不到中文/旗標 metadata → 該側保持空白並記 Logger。手動鎖定列一律不變。

**Acceptance criteria:**

- `node tests/knockout-resolution.test.js` 通過，涵蓋：`rankGroup` 排序與 tiebreaker、`rankThirds` 取前 8、`assignThirds` 至少 2 組已知 FIFA 組合、`resolveR32` 對一組完整模擬積分輸出正確 match 73–88 對陣。
- `node tests/api-auto-update.test.js` 仍通過（既有比分同步不回歸）。
- 手動驗證：在測試 Sheet 建立「某組冠軍已確定、亞軍未確定」的進行中狀態後執行 `syncBracket()`，只填入已確定 slot；完成全部小組賽後 32 強完整填入；手動鎖定列不被覆寫。

**Scope boundaries:** 僅 R32（match 73–88）由小組結果解析。16 強之後的勝者遞補與抓取 Google 頁面不在範圍；前端只新增輪詢，不變更版面。

## Risks / Trade-offs

- [最佳第三名分配表轉錄錯誤 → 第三名被指派到錯誤 slot 且不易察覺] → 從 FIFA 官方文件逐筆轉錄，並以多組已知組合寫成測試；於 design 留 Open Question 標示需確認官方來源。
- [Sheet 尚未保存紀律分或 FIFA 排名 → 極端同分無法完整重現官方排序] → 純函式接受可選 `conduct` / `fifaRank`，缺少時採 team code fallback 並記錄限制；一般對賽與得失球情境仍按官方規則。
- [積分上下界是保守判定，部分實際已晉級情境可能較晚才辨識] → 寧可延後顯示，也不填入仍可能變動的隊伍；整組完賽後一定採最終排序。

## Open Questions

- `THIRD_PLACE_ALLOCATION` 的官方 WC2026 來源文件需確認（FIFA 規程附件）；轉錄完成後須以官方範例組合核對。
- `slotId` 命名方式（以 match_id+position，或以面對的小組第 1 名標示）待實作時定案，須與 `R32_SEED_MAP` 中的 `3 XXXXX` 代碼一致。
