## 1. 測試骨架（沿用 vm 抽取式 TDD）

- [x] 1.1 建立 `tests/knockout-resolution.test.js`，沿用 `tests/api-auto-update.test.js` 的 `loadFunctions(gasCode, [...])` 模式從 Code.gs 抽取純函式。先寫對尚未存在的 `rankGroup` 的失敗測試以確立 harness。完成定義：`node tests/knockout-resolution.test.js` 因函式未定義而失敗（紅燈），證明抽取管線可運作。

## 2. 小組與第三名排名（tiebreaker pts→gd→gf）

- [x] 2.1 在 `tests/knockout-resolution.test.js` 補上 `rankGroup` 測試案例：含 pts→gd→gf 主排序，以及 gd 相同時以 gf 分高下、完全同分時以組字母→code 的決定式 fallback。完成定義：測試表達設計決策「小組排序 tiebreaker 採 pts→gd→gf；更深層 tiebreaker 列為 Non-Goal」與「沿用 vm 抽取式 TDD，先測試後實作」，且目前為紅燈。
- [x] 2.2 實作規格需求 Rank teams within a group：在 Code.gs 實作純函式 `rankGroup(teams)`，輸入同組 4 隊 `{code, pts, gd, gf}`，回傳排序後 4 隊陣列（index 0 = 小組第 1）。完成定義：2.1 的 `rankGroup` 測試全綠。
- [x] 2.3 實作規格需求 Rank third-placed teams and select the best eight：補上 `rankThirds` 測試（12 個第三名排序、取前 8 名為晉級者）後，在 Code.gs 實作 `rankThirds(thirds)`。完成定義：`node tests/knockout-resolution.test.js` 中 `rankThirds` 案例驗證前 8 名選取正確並全綠。

## 3. 最佳第三名分配表（移入後端作為單一事實來源）

- [x] 3.1 落實設計決策「seed 對照表與最佳第三名分配表移入後端作為單一事實來源」：在 Code.gs 新增常數 `THIRD_PLACE_ALLOCATION`，逐筆轉錄 FIFA 官方 WC2026「最佳第三名」組合分配表（8 組字母組合 → slot 指派）。完成定義：常數涵蓋官方表全部組合，並於檔案註解標明來源文件。
- [x] 3.2 實作規格需求 Assign qualified thirds to bracket slots via the official allocation table：先寫 `assignThirds` 測試（至少 2 組已知官方組合驗證 slot→組字母；非 8 組或未知組合回傳 null），再在 Code.gs 實作純函式 `assignThirds(qualifiedGroups)`。完成定義：`assignThirds` 測試全綠，含 null 邊界案例。

## 4. R32 解析協調者（取代 football-data 淘汰賽鏡射）

- [x] 4.1 在 Code.gs 新增常數 `R32_SEED_MAP`（match_id 73–88 → 兩個 seed 代碼），內容與前端 `wc2026-bracket.html` 的 `R32_SEEDS` 等價。完成定義：以測試斷言 73–88 全部 16 場皆有 seed 對應。
- [x] 4.2 實作規格需求 Resolve Round-of-32 matchups from group standings（落實設計決策「後端純函式解析器取代 football-data 淘汰賽鏡射」）：先寫 `resolveR32` 測試（給一組完整模擬 12 組積分，斷言 match 73–88 的 home/away code），再在 Code.gs 實作純函式 `resolveR32(groups)`：以 `R32_SEED_MAP` 將 `1X/2X` 解析為小組第 1/2，`3 XXXXX` slot 經 `rankThirds`+`assignThirds` 解析。完成定義：`resolveR32` 測試全綠，輸出 `{matchId: {home, away}}`。
- [x] 4.3 實作規格需求 Write resolved teams only after the group stage is complete（落實設計決策「僅在小組賽全部結束後才寫入 R32，避免暫定隊伍被既有 row[6] 鎖住」）：先寫 `isGroupStageComplete` 測試（全部小組賽 `finished` → true；任一未完成 → false），再在 Code.gs 實作。完成定義：兩個分支案例皆綠。

## 5. 整合進 syncBracket

- [x] 5.1 改寫 Code.gs 的 `syncBracket()`：移除對 football-data `homeTeam.tla` 的依賴，改為僅在 `isGroupStageComplete()` 為真時呼叫 `resolveR32()`，依結果寫入 matches 工作表 73–88 列的 code/name/flag（隊伍 metadata 由 groups 工作表以 code 查表）。落實規格需求 Preserve manually locked and already-filled rows：保留既有保護——已填入列（`row[6]` 非空）與手動鎖定列（`row[17] === true`）跳過。完成定義：在測試 Sheet 填入完整小組賽結果並執行 `syncBracket()` 後，32 強列正確填入；手動鎖定列不被覆寫（手動驗證並於 Logger 確認 N 場更新）。
- [x] 5.2 確認 `resolveR32` 對未解析 slot（`assignThirds` 回傳 null）留空不寫、隊伍 code 查無 metadata 時跳過該列，皆記入 Logger。完成定義：以模擬輸入觸發兩種失敗路徑，確認靜默跳過且有 log。

## 6. 驗證與回歸

- [x] 6.1 執行完整測試確認無回歸。完成定義：`node tests/knockout-resolution.test.js` 與 `node tests/api-auto-update.test.js` 皆通過（既有比分同步不回歸）。

## 7. 漸進式填入已確定名次

- [x] 7.1 實作規格需求 Progressively write mathematically clinched group positions：先在 `tests/knockout-resolution.test.js` 加入冠軍已確定、亞軍仍未確定、整組完賽三種案例，再於 `Code.gs` 實作 `resolveClinchedGroupRanks(teams)`，以目前積分與剩餘最高可得分保守判定 exact rank；完成定義為三種案例只回傳數學上已固定的 winner / runnerUp / third，且測試全綠。
- [x] 7.2 落實設計決策「已確定的小組名次漸進寫入，未鎖定列持續重算」與規格需求 Preserve manually locked rows and recalculate automatic rows：改寫 `syncBracket()`，移除全小組賽完成 gate 與 `row[6]` 跳過條件，對未鎖定 R32 列逐側寫入最新解析值或清除未解析舊值；完成定義為整合測試證明鎖定列不變、未鎖定列可更新或清空。
- [x] 7.3 更新 `resolveR32` 讓 `1X` / `2X` 使用漸進式確定名次，而最佳第三名只在完整 8 隊集合可安全決定時解析；完成定義為部分小組資料只輸出已確定側、完整資料仍輸出 match_id 73–88 全部對陣，並由 `node tests/knockout-resolution.test.js` 驗證。

## 8. 最終驗證

- [x] 8.1 執行 `node tests/knockout-resolution.test.js`、`node tests/api-auto-update.test.js`、`spectra analyze knockout-bracket-resolution --json` 與 `spectra validate knockout-bracket-resolution`；完成定義為兩套測試通過且 Spectra 無 Critical/Warning。

## 9. FIFA 2026 對賽優先排名

- [x] 9.1 落實設計決策「小組排序採 FIFA 2026 對賽優先規則」與規格需求 Rank teams within a group：先加入墨西哥與韓國同為 6 分但墨西哥憑直接對賽居前、三隊同分後子集合重排的失敗測試，再將 `rankGroup(teams, matches)` 改為對賽積分→對賽得失球→對賽進球→重套子集合→整體 gd/gf→可選 conduct/fifaRank；完成定義為新增案例與既有排名案例全綠。
- [x] 9.2 更新 `resolveClinchedGroupRanks(teams, matches)` 與 `resolveR32(groups, matches)`，讓已完成直接對賽可排除同分反超可能；以目前 A 組資料驗證墨西哥解析為 `1A`，並確認未鎖定名次仍為 null，執行 `node tests/knockout-resolution.test.js` 全綠。
- [x] 9.3 更新 `syncBracket()` 從 `matches` 工作表建立小組賽結果並傳入解析器；完成定義為 fixture 驗證 match_id 79 寫入墨西哥且手動鎖定列仍不變。

## 10. 對戰表自動刷新

- [x] 10.1 落實設計決策「對戰表每 60 秒無重疊刷新」與規格需求 Periodic bracket data refresh：在 `wc2026-bracket.html` 新增單一 timer 與 in-flight guard，初次載入後每 60 秒重新執行資料抓取及渲染；以 `tests/bracket-auto-refresh.test.js` 靜態契約測試驗證 60000ms、guard 與重新呼叫 `init()`。

## 11. 回歸與規格驗證

- [x] 11.1 執行 `node tests/knockout-resolution.test.js`、`node tests/api-auto-update.test.js`、`node tests/bracket-auto-refresh.test.js`、`spectra analyze knockout-bracket-resolution --json` 與 `spectra validate knockout-bracket-resolution`；完成定義為三套測試通過且 Spectra 無 Critical/Warning。
