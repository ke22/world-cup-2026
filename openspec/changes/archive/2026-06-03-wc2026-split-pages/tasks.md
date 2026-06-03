## 1. 確認 API 資料結構

- [x] 1.1 在 `wc2026-schedule.html` 的 `fetchAllMatches` 結果中 `console.log` 輸出前 3 筆淘汰賽比賽，確認 `m.phase` 欄位的實際字串值（例如 `"Round of 32"`、`"Quarter-final"` 等）。驗收：在瀏覽器 DevTools Console 看到 phase 值列表，可對應至 R32/R16/QF/SF/F 五個輪次。

## 2. 獨立分組積分榜頁面（Standalone groups standings page）

- [x] 2.1 建立符合「Standalone groups standings page」規格的 `wc2026-groups.html` 基礎骨架：複製設計系統 CSS 變數（`:root`）與 reset，套用 `max-width: 720px` wrapper，引入相同的 `fetchGroups` API 呼叫邏輯。驗收：在瀏覽器開啟頁面後不報 JS 錯誤，且積分資料可從 DevTools Network 看到成功回應。

- [x] 2.2 實作頂部 A–L 錨點快捷按鈕（Anchor quick-nav buttons）：在頁面頂部渲染 12 個按鈕（A 到 L），每個按鈕的 `href` 指向對應組別的 `#group-{letter}` id。驗收：點擊「G」按鈕後，頁面平滑捲動至 G 組區塊（手動驗證 `behavior: 'smooth'`）。

- [x] 2.3 實作單欄積分榜（三個頁面各自獨立的 HTML 檔 / groups-page 單欄排版與錨點快捷按鈕）：以單欄排列 12 組積分表，不使用 CSS Grid 雙欄，每組 section 加上 `id="group-{letter}"`。驗收：在 375px 寬度下 12 組垂直排列，不出現橫向溢出（Chrome DevTools 手機模擬器確認）。

- [x] 2.4 實作旗幟 emoji 加隊名顯示（Team row displays flag emoji and name together）：每隊儲存格渲染為 `{flag_emoji} {name}` 並排，旗幟 font-size: 18px。驗收：任一組別表格中，每個隊伍列可看到旗幟 emoji 緊接隊名，不換行。

- [x] 2.5 套用放大字型（Enlarged typography）：隊名字體 >= 16px、積分字體 >= 15px、組別標題字體 >= 18px。驗收：Chrome DevTools Computed Styles 確認三個元素的 font-size 數值符合規格。

- [x] 2.6 確認排序邏輯正確（Teams sorted correctly within each group）：積分 DESC → 球差 DESC → 進球 DESC。驗收：找一個有積分相同隊伍的組別，確認球差較大者排在前面（手動比對 API 回傳資料）。

## 3. 獨立淘汰賽樹狀圖頁面（Standalone tournament bracket page）

- [x] 3.1 建立 `wc2026-bracket.html` 基礎骨架：複製設計系統 CSS 變數，引入 `fetchAllMatches` API 邏輯，以 `m.phase` 欄位將比賽分類至 R32/R16/QF/SF/F/3rd 六個輪次物件。驗收：DevTools Console 可輸出各輪次的比賽數量（R32 應有 16 場，R16 8 場，QF 4 場，SF 2 場，F 1 場，3rd 1 場）。

- [x] 3.2 實作桌面橫向 bracket 佈局（bracket-page 佈局：獎盃居中、雙側展開）：>=640px 時以 Flexbox 橫向排列 9 欄（R32-left, R16-left, QF-left, SF-left, Final/Trophy, SF-right, QF-right, R16-right, R32-right），獎盃 🏆 置中。驗收：在 1280px 寬度下，9 欄水平排列可見，獎盃在第 5 欄。

- [x] 3.3 實作 bracket 連線（bracket-page 佈局：獎盃居中、雙側展開）：在每個 `.match-node` 使用 CSS `::before`/`::after` 繪製 L 型連線，連接相鄰輪次的比賽卡片。驗收：桌面視圖下，R32 的兩個相鄰比賽的連線匯聚到 R16 的單個比賽節點（目視確認）。

- [x] 3.4 實作手機垂直折疊佈局（Standalone tournament bracket page / Mobile layout renders collapsible vertical rounds）：<640px 時每輪改為垂直 `<section>` 區塊，點擊標題列切換展開/折疊，使用 JS class toggle 控制 `max-height` 或 `display`。驗收：375px 下，點擊「R32」標題後，R32 比賽列表顯示/隱藏切換正常。

- [x] 3.5 實作自動追蹤展開當前賽段（Auto-expand current active round / bracket-page 自動追蹤展開邏輯）：頁面載入後掃描 `allMatches`，找出含有 `live` 比賽的輪次 → 若無則找最早有 `upcoming` 的輪次 → 若全部完賽則選 Final 輪，自動展開該輪，其餘輪次依折疊規則處理。驗收：模擬資料中設定 QF 某場為 `live`，重載頁面後 QF 輪自動展開，其他輪折疊。

- [x] 3.6 實作完賽輪次預設折疊（Completed rounds collapse by default）：所有比賽 `status === 'finished'` 的輪次，預設 `collapsed`，標題顯示輪次名稱與 toggle 圖示。驗收：若 R32 全部完賽，初始載入時 R32 顯示折疊狀態；點擊後展開所有比賽結果。

- [x] 3.7 實作未開賽輪次預設折疊（Unstarted rounds collapse by default）：所有隊伍槽皆為 TBD 的輪次預設折疊，標題顯示「待定」灰色文字。驗收：在 SF 全為 TBD 狀況下，SF 顯示折疊且有「待定」提示（使用模擬資料或早期頁面載入時確認）。

- [x] 3.8 套用 bracket 放大字型（Enlarged bracket typography）：match node 中隊名 font-size >= 15px，比分/時間 font-size >= 13px。驗收：Chrome DevTools Computed Styles 確認 `.match-node` 內隊名與比分元素字體大小符合規格。

## 4. 修改主賽程頁月份顯示（Date navigation with 7-day sliding window）

- [x] 4.1 修改 `wc2026-schedule.html`（wc2026-schedule.html（修改）/ match-schedule 日期列月份顯示）的 `renderDateNav` 函式，實作「Date navigation with 7-day sliding window」月份標示行為：計算 7 個日期 tab 中每個跨越新月份的位置，在該 tab 上方加入月份標籤（`{月}月` 格式）；若 7 天同月，在導覽列左側（nav-arrow 旁）顯示月份名稱。驗收：手動調整 `windowStart` 為 2026-06-29，確認 6/30 的 tab 不顯示月份、7/1 的 tab 上方顯示「七月」。

## 5. 修改主賽程頁初始自動定位（Date navigation with 7-day sliding window）

- [x] 5.1 在 `wc2026-schedule.html` 的初始化流程中新增 `scrollToActiveTab()` 函式，完成「Date navigation with 7-day sliding window」自動定位要求（match-schedule 初始載入自動定位）：在 `renderDateNav()` 執行後，對 active date tab 元素呼叫 `el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })`。驗收：在手機模式（375px）下重載頁面，active date tab 自動捲動至導覽列中央可見位置（Chrome DevTools 手機模擬器確認）。
