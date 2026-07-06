# WC2026 技術筆記 / Dev Learnings

開發 WC2026 互動圖表嵌入元件過程中遇到的問題與解法記錄。

---

## 1. 全高 iframe 的 `scrollIntoView` 會觸發外層捲動

**問題**：積分榜切換組別時使用 `element.scrollIntoView()`，外層 CNA 文章頁面跟著跳動。

**原因**：iframe 設定為 `height = scrollHeight`（自動撐滿內容），內部沒有 overflow scroll，瀏覽器找不到可滾動的祖先，`scrollIntoView` 就一路往上冒泡到父視窗，由父頁面捲動到讓 iframe 位置可見。

**解法 A（一時）**：改用 display:none/block 的 Tab 切換，完全不捲動。
**解法 B（最終）**：改為固定高度 iframe + 內部 `overflow-y: auto`，組別切換用 `container.scrollTop = target.offsetTop`——直接操作 scrollTop，沒有冒泡風險。

---

## 2. iframe 內的 `position: sticky` 要在可捲動容器內才有效

全高 iframe 時 `.anchor-nav` 的 `position: sticky; top: 0` 完全無效（父視窗在捲動，不是 iframe body）。改為固定高度 + 內部 scroll 後，nav 自然固定在 `.page` flex 頂部（不需要 sticky），groups-container 在下方滾動。

---

## 3. sessionStorage 在 iframe 重新載入後失效

**問題**：文章頁面內嵌的 iframe，每次文章重新載入（或切頁回來）都是全新的 sessionStorage。快取形同虛設。

**解法**：改用 `localStorage`。`localStorage` 跨分頁（同 origin）持久保存，iframe 重載後立即從快取渲染，再背景 fetch 更新。

---

## 4. Stale-While-Revalidate 讓首屏顯示開賽時間

**問題**：賽程 iframe 冷啟動需等待 GAS API（3–8 秒），這段時間只顯示 loading 文字。

**解法**：`init()` 先從 localStorage 讀取上次快取立刻渲染（顯示開賽時間），同時背景 fetch 新資料；若有更新才重新渲染成比分。使用者感知零延遲。

---

## 5. `hasScore` null guard

**問題**：GAS 回傳的比賽資料中，`status: "finished"` 但 `score1: null, score2: null`（分數尚未寫入 sheet）。前端渲染出「null : null」。

**解法**：只在 `score1 !== null && score2 !== null` 時才渲染比分；否則顯示開賽時間。

```javascript
const hasScore = m.score1 !== null && m.score2 !== null;
if (m.status === 'finished' && hasScore) { /* 顯示比分 */ }
else { /* 顯示開賽時間 */ }
```

---

## 6. ResizeObserver postMessage 去重

ResizeObserver 觸發非常頻繁（字型載入、twemoji 圖片換入等都會觸發），每次都送 postMessage 會讓外層頁面 layout reflow 不斷。

加上 `lastHeight` guard：只在高度真的改變時才送。

```javascript
let lastHeight = 0;
new ResizeObserver(() => {
  const h = Math.ceil(document.documentElement.scrollHeight);
  if (h !== lastHeight) { lastHeight = h; window.parent.postMessage(...); }
}).observe(document.body);
```

---

## 7. IntersectionObserver 讓滾動同步更新 Tab 高亮

積分榜改為內部滾動後，需要在使用者手動滾動時更新 A–L 按鈕的 active 狀態。用 scroll event + getBoundingClientRect 效能差；IntersectionObserver 更乾淨：

```javascript
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) highlightTab(e.target.id.replace('group-', ''));
  });
}, { root: container, threshold: 0.4 });
document.querySelectorAll('.group-section').forEach(s => io.observe(s));
```

---

## 8. Playwright 的 `click()` 會自動 scrollIntoView

Playwright 在 `click()` 前會先 scroll 元素進視窗，這個 scroll 本身就會觸發父視窗的 `scroll` event，導致「父頁面捲動」的 Playwright 測試出現偽陽性。

**解法**：先手動 `scrollIntoViewIfNeeded()`，等 300ms 穩定後記錄 `y0`，再 click，最後量 `Math.abs(y1 - y0) === 0`。

---

## 9. GAS API 設計注意事項

- 冷啟動 3–8 秒：前端 timeout 至少設 15–18 秒
- CORS：GAS Web App 部署為「任何人可存取」即自動帶 CORS headers
- 快取：前端 `CACHE_TTL = 300s`；GAS 本身也有 6 分鐘 script 快取
- `score1` / `score2` 留空 ≠ 0，務必區分 `null`（未踢）vs `0`（0 比 0）
- `clearAllScores()` 是手動 GAS 函式，不對外暴露，避免誤清真實比分

---

## 10. `overflow: visible` 子元素無法穿透父層的 `overflow: hidden`

**問題**：`.group-box { overflow: hidden }` 包著 `.gb-name { overflow: hidden }`。想透過 `.gb-name.xs { overflow: visible }` 讓文字不被 gb-name 自身裁切，結果「沒變化」。

**原因**：CSS 規範明定：當父元素 `overflow` 為非 `visible` 時，子元素的 `overflow: visible` 會被強制視為 `overflow: auto`。換言之，子元素永遠無法「穿透」父層的 `overflow: hidden` 讓內容溢出至父層外部。

**解法**：改用 `white-space: normal` 讓文字換行，徹底消除橫向溢出，不再需要依賴 overflow 穿透。

---

## 11. 窄容器 CJK 文字：用 `<br>` 注入控制換行位置

**問題**：`white-space: normal` 讓瀏覽器自行決定換行點，「沙烏地阿拉伯」（6 字）可能斷成「沙烏地阿 / 拉伯」（4+2），視覺上不對稱。

**解法**：在 JS 渲染時，於第 3 字後插入 `<br>` 強制對半斷行：

```javascript
const dn = nc === ' xs' ? name.slice(0, 3) + '<br>' + name.slice(3) : name;
```

結果固定為「沙烏地 / 阿拉伯」（3+3），`title` 屬性保留完整原名供 hover 顯示。適用於所有 ≥ 6 字的隊名（xs class）。

---

## 13. embed-loader.js 架構

CNA 要求使用 `data-src` lazy-load 模式。`embed-loader.js`：
1. 找所有 `.wc2026-embed[data-src]` div
2. 建立 `<iframe>` 替換 div，設 `data-loaded` 標記
3. 監聽 `message` 事件，比對 `e.source === iframe.contentWindow` 確保只更新對應的 iframe
4. 積分榜回報固定 600px，loader 直接套用；賽程/晉級圖回報動態高度

---

## 14. 賽程「今天」必須以台灣時間計算

**問題**：賽程頁初始日期用瀏覽器本地 `new Date()`，若讀者或測試環境不在台灣時區，台灣已跨日但本地尚未跨日，就會停在前一天，表面上像 API 沒更新今日內容。

**解法**：新增 `todayUTC8()`，用 UTC+8 產生 `YYYY-MM-DD`，`findInitialDate()` 以此選擇今日賽程。測試固定 `2026-06-11T18:00:00Z`，此時台灣日期應為 `2026-06-12`。

---

## 15. football-data live 狀態不能被 fullTime 空比分擋掉

**問題**：`syncScores()` 原本只有 `score.fullTime.home/away` 非空才寫入 Sheet。賽中 API 可能已回 `IN_PLAY`，但 `fullTime` 仍是 null，導致 `matches` 和 `比分編輯` 沒有更新為 live。

**解法**：將 football-data 狀態集中映射：
- `FINISHED` → `finished`
- `IN_PLAY` / `PAUSED` / `LIVE` → `live`
- 其他 → `upcoming`

live 或 finished 狀態即使 fullTime 尚空也要同步；比分為 null 時保留 Sheet 現有比分欄。`syncScores()` 有更新時也要呼叫 `refreshScoreEditorSheet(false)`，避免前端讀 `matches` 已更新，但編輯分頁看起來沒變。

---

## 16. 32 強對陣改為後端純函式解析（取代 football-data 鏡射）

**問題**：`syncBracket()` 原本鏡射 football-data.org 已解析好的淘汰賽對陣，但該免費 API 在小組賽結束後才寫入晉級隊伍，導致 32 強長期停在 TBD。

**解法**：以本地純函式取代外部依賴，由 `syncBracket()` 負責讀寫 Sheet：

- `rankGroup(teams, matches)` — FIFA 2026 對賽優先排序（對賽積分 → 對賽得失球 → 對賽進球 → 子集合重排 → 整體 gd/gf → team code fallback），**不可**與跨組第三名共用 comparator。
- `rankThirds(thirds)` — 跨組第三名以 pts → gd → gf 取前 8。
- `assignThirds(qualifiedGroups)` — 查 `getThirdPlaceAllocation()`（495 組組合表），非 8 組或查無組合回傳 null。
- `resolveR32(groups, matches)` — 協調者，輸出 `{matchId: {home, away}}`（match_id 73–88）。
- `resolveClinchedGroupRanks` — 以剩餘最高可得分保守判定，只有名次數學上鎖定才解析。

沿用 `tests/api-auto-update.test.js` 的 `loadFunctions(gasCode, [...])` vm 抽取模式做 TDD，無需測試框架。

---

## 17. GAS：存檔 ≠ 執行；time trigger 跨 re-paste 保留

**踩雷**：把新 `Code.gs` 貼進 Apps Script 編輯器並存檔後，Sheet 完全沒變。

**原因**：存檔只更新程式碼，不會執行任何函式。解析邏輯在 `syncBracket()` 內，要等到有函式被呼叫才會寫入：

```
[每 10 分 trigger] → syncScores → recalcGroups → syncBracket → 寫入 73–88
```

**重點**：
- Trigger 屬於 Apps Script **專案**層級，不在程式碼內——re-paste 程式碼**不會**新增或刪除 trigger，既有 trigger 會直接跑新版程式碼。沒裝過就跑一次 `setupSyncTrigger()`。
- 要立即看到結果就手動執行 `syncBracket`（或 `syncScores`，但後者會抓 API 比分覆寫手動測試資料）。
- 手動輸入比分走「套用比分編輯分頁」→ `recalcGroups()`，但**不會**呼叫 `syncBracket`；對戰表要等下一次 10 分 trigger 才填。

---

## 18. `SHEET_ID` 是整條管線的單一開關；多份 Sheet 容易誤判

`Code.gs` 第 2 行的 `SHEET_ID` 同時決定 `syncScores` / `recalcGroups` / `syncBracket` 讀寫哪份試算表，以及 `doGet` Web App API 對外提供哪份資料。`doGet` 即時讀 `SHEET_ID`，換 Sheet 不需重新部署。

**教訓**：除錯「跑了沒變」時，先確認**正在編輯的 Sheet** 與**程式碼指向的 Sheet** 是同一份——專案常有舊/新兩份試算表，貼錯或看錯就會以為功能壞了。本專案的正式 Sheet 是 `1YDuNRBG…`。

---

## 19. R32 seed map 已對照官方；第三名分配表待核對

`getR32SeedMap()`（後端）與 `R32_SEEDS`（前端 `wc2026-bracket.html`）兩份必須等價，已逐場比對 16 場 73–88 完全一致；並已對照 Wikipedia「2026 FIFA World Cup knockout stage」官方對陣表全部 16 場吻合（小組第 1/2 與第三名 pool 皆正確）。

**待辦**：`getThirdPlaceAllocation()` 的 495 組「最佳第三名 → slot」分配表為機器產生（自 Wikipedia 解析），組合 pool 已驗證，但**逐組合的 slot 指派尚未對照 FIFA 官方規程 Annex**。只在 8 隊晉級第三名全部確定後才影響顯示，賽前應完成核對。

---

## 20. GAS 多份部署 URL：欄位沒顯示可能是前端指向舊部署

**問題**：後端 `Code.gs` 已回傳新欄位（如 PK `pen1`/`pen2`），前台卻完全不顯示。
**原因**：同專案存在兩個 `/exec` 部署 URL——舊部署的 `getMatches` 尚未含新欄位（回傳缺 key），而各 HTML 檔散落指向不同 URL（bracket/schedule 指新版、scorers/admin 指舊版）。前端渲染缺失只是其中一半原因，另一半是資料來源本身就沒帶欄位。
**解法**：除錯「欄位沒顯示」先兵分兩路：①直接 curl 各 `/exec?action=getMatches` 確認該部署有無回傳該 key；②`grep -rl` 比對每個 HTML 打的是哪個 URL。兩者都對齊後，才是純前端 render 問題。本次同時發現 bracket.html 根本沒渲染 PK（schedule.html 有），並修正淘汰賽平手需以 pen 決勝、否則 `score1>score2` 會在決賽 1-1 時誤判 team2 為冠軍。
