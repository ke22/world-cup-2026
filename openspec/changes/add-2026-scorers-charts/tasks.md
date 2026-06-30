## 1. 共用球員資料集與 2026 合併

- [x] 1.1 建立 11 名 2026 參賽球員的資料集（中文名、旗幟 emoji、國家、每屆 `{ wc, goals }`），未參賽屆別不入 career；退役名將全部移除。驗證：資料集恰含 11 人，且每人總進球數等於各屆 goals 加總（手動核對）。依據需求 "2026 participant cohort only"、"Player dataset with per-tournament goals"；設計「11 名球員資料集與哈克波資料校正」。
- [x] 1.2 校正哈克波（Gakpo）資料為 2022:3、2026:3，總進球數 6。驗證：資料集中哈克波 career 加總為 6。依據設計「11 名球員資料集與哈克波資料校正」。
- [x] 1.3 擴充 `PLAYER_CODE_ALIASES`，將 7 名新球員的內部鍵對應到 GAS `getTopScorers` 的 `player_code`；無法確認對應者以程式註解標明採靜態後備。驗證：別名表涵蓋全部新球員內部鍵，code review 確認。依據需求 "2026 goals merged from live data with static fallback"；設計「2026 即時資料合併與 player_code 對應」。

## 2. 長條圖 wc2026-scorers-bars.html

- [x] 2.1 建立自包含 HTML，內嵌共用球員資料集與 `mergePlayerData`／`fetchTopScorers` 合併邏輯，GAS 失敗或球員未匹配時靜默採靜態後備值。驗證：瀏覽器開啟無 console error；模擬斷網仍能渲染。依據需求 "2026 goals merged from live data with static fallback"。
- [x] 2.2 渲染水平堆疊長條圖：每名球員一條，依總進球數由多到少由上而下排序，每條以「2014前」彙總段＋2014/2018/2022/2026 著色分段（長條總長＝該球員世界盃總進球），列尾標示總進球數，分段互不重疊。驗證：手動檢視列序為 Messi(18)→Mbappé(16)→C.Ronaldo(10)→…→Vinícius(5)（總數遞減），分段與總數正確（梅西含 2014前 1 球、C 羅納度含 2014前 2 球）。依據需求 "Horizontal stacked bar visualization"；設計「圖表類型：水平堆疊長條圖與壓縮折線圖（捨棄 bump 排名圖）」。
- [x] 2.3 套用既有 CNA header/panel 樣式並以 `window.parent.postMessage({ type: 'wc2026-resize', height })` 回報內容高度。驗證：嵌入 iframe 後父頁收到 wc2026-resize 訊息。依據需求 "Self-contained embeddable files preserving existing chrome"；設計「自包含檔案與 postMessage 高度回報」。

## 3. 折線圖 wc2026-scorers-lines.html

- [x] 3.1 由 `wc2026-scorers.html` 複製為基礎建立自包含 HTML，內嵌同一份共用球員資料集與合併邏輯，移除所有退役名將。驗證：瀏覽器開啟無 console error，畫面僅 11 名球員。依據需求 "2026 participant cohort only"。
- [x] 3.2 將 `WC_YEARS` 壓縮為 `[2002, 2006, 2010, 2014, 2018, 2022, 2026]`，並把 11 名球員全部以彩色累計線渲染。驗證：X 軸僅顯示這七個年份（手動檢視）。依據需求 "Compressed cumulative line visualization with hover focus"；設計「折線圖 X 軸壓縮至 2002–2026」。
- [x] 3.3 為 7 名新球員指定線條顏色，確保同為巴西的內馬爾與維尼修斯顏色可區分。驗證：手動檢視兩人線條顏色明顯不同。依據設計「折線圖靜止淡化與 hover 聚焦、同國配色區分」。
- [x] 3.4 靜止時線條變細／降低 opacity，hover 或點選某球員時沿用 `dimOthers`／`restoreAll` 聚焦該球員、淡出其餘，放開後復原。驗證：hover 一條線時其餘變淡，移開後全部復原（手動操作）。依據需求 "Compressed cumulative line visualization with hover focus"；設計「折線圖靜止淡化與 hover 聚焦、同國配色區分」。
- [x] 3.5 以 `postMessage` 回報內容高度。驗證：嵌入 iframe 後父頁收到 wc2026-resize 訊息。依據需求 "Self-contained embeddable files preserving existing chrome"；設計「自包含檔案與 postMessage 高度回報」。

## 4. 一致性與整體驗證

- [x] 4.1 確認原始 `wc2026-scorers.html` 完全未被更動。驗證：`git diff` 對該檔無任何變更。
- [x] 4.2 在瀏覽器開啟兩個新檔做整體比對，確認皆正常渲染且哈克波總進球數顯示為 6。驗證：兩檔皆無 console error，畫面數值與資料集一致（手動檢視）。
