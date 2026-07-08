# WC2026 互動圖表 — CNA 交接文件

> 最後更新：2026-06-29

## 元件清單

| 檔案 | 功能 | 建議嵌入高度 |
|------|------|-------------|
| `wc2026-schedule.html` | 賽程表（依日期切換，即時比分） | 自動調整（auto-resize） |
| `wc2026-groups.html` | 小組積分榜（A–L 可滾動） | 600 px（固定） |
| `wc2026-bracket.html` | 淘汰賽對陣圖 | 自動調整（auto-resize） |
| `wc2026-scorers.html` | 世界盃歷史射手競賽（步階折線圖） | 500 px |

部署根目錄：`https://ke22.github.io/world-cup-2026/`

---

## 嵌入方式

### 方式 A：`embed-loader.js`（推薦）

在文章頁面引入 loader，再放入 placeholder div：

```html
<!-- 在 <head> 或 <body> 底部引入一次 -->
<script src="https://ke22.github.io/world-cup-2026/embed-loader.js"></script>

<!-- 賽程表 -->
<div class="wc2026-embed"
     data-src="https://ke22.github.io/world-cup-2026/wc2026-schedule.html"
     data-title="FIFA 世界杯 2026 賽程"
     data-height="847"></div>

<!-- 小組積分榜 -->
<div class="wc2026-embed"
     data-src="https://ke22.github.io/world-cup-2026/wc2026-groups.html"
     data-title="FIFA 世界杯 2026 積分榜"
     data-height="600"></div>

<!-- 淘汰賽對陣圖 -->
<div class="wc2026-embed"
     data-src="https://ke22.github.io/world-cup-2026/wc2026-bracket.html"
     data-title="FIFA 世界杯 2026 晉級圖"
     data-height="600"></div>
```

`embed-loader.js` 會自動：
- 將 div 轉換為 `<iframe>`
- 接收 `postMessage` 並調整 iframe 高度（賽程 / 晉級圖）
- 積分榜高度固定 600 px，不需調整

### 方式 B：舊式直接 iframe（相容舊系統）

```html
<iframe src="https://ke22.github.io/world-cup-2026/wc2026-schedule.html"
        width="100%" height="847" frameborder="0" scrolling="no"
        id="cna-wc2026-schedule"></iframe>
```

若使用直接 iframe，需在頁面加入 resize listener（只需加一次）：

```html
<script>
(function () {
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'wc2026-resize') return;
    var frames = document.querySelectorAll('iframe[id^="cna-wc2026-"]');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) {
        frames[i].style.height = e.data.height + 'px';
        break;
      }
    }
  });
})();
</script>
```

---

## 比分更新流程

1. 開啟 [Google Sheet](https://docs.google.com/spreadsheets/d/1YDuNRBGTx5Jw3kZBYehlYUW4eIFPClDIC91TR_720js)
2. 日常編輯建議使用 `比分編輯` 工作表；原始 API 資料仍以 `matches` 工作表為準
3. 找到對應場次列：
   - `比分`：填入 `主隊-客隊`，例如 `2-1`
   - `狀態`：`未開賽` → `進行中` → `已結束`
4. 若要從 football-data.org 同步比分，在 Apps Script 執行 `syncScores()`
   - `syncScores()` 會更新 `matches`，並在有更新時自動刷新 `比分編輯`
   - `IN_PLAY` / `PAUSED` / `LIVE` 會同步為 `live`
   - 若賽中 API 尚未提供 fullTime 比分，會先保留既有比分欄並更新狀態
   - `matches` 的 R 欄 `manual` 若為勾選，該列會被自動同步略過
5. 前端目前每次載入都讀最新賽程（`CACHE_TTL = 0`），live 場次會每 60 秒重抓

> **注意**：score 欄留空（不是 0）= 尚未開賽，會顯示開賽時間。填 0 = 0:0 平局進行中。

### 清除所有測試比分

在 Google Apps Script 編輯器中執行 `clearAllScores()`，會將所有場次重置為 `upcoming`、比分清空。

---

## 射手競賽更新流程（`wc2026-scorers.html`）

射手圖的 2026 數字由 Google Sheet 的 **`scorers`** 工作表手動維護，歷史（2026 前）資料則寫死在 HTML 的 `HISTORICAL_DATA` 常數。

1. 開啟 Google Sheet → 若無 `scorers` 工作表，先用自訂選單 **「建立/更新 scorers 射手分頁」**（`onOpen` 註冊，呼叫 `setupScorersSheet`）建立。
2. 欄位：`match_id` / `player_name` / `player_code` / `goals`。**一列 = 一名球員在一場比賽進的球**（非生涯累計）。
3. `player_code` 有下拉驗證，僅允許 `mbappe` / `messi` / `ronaldo` / `kane` 四個 active 球員。後端 `getTopScorers()` 依 `player_code` 加總所有列。
4. 球員每場進球就新增一列，存檔即可。前端 `sessionStorage` 快取 60 秒，最多一分鐘後（或重整 / 開新分頁）圖表更新。
5. 只要某球員 `matches_played_2026 > 0`，`mergePlayerData()` 會用 Sheet 加總值覆蓋 HTML 寫死的 2026 數字。

> **凱恩（kane）2026 進球可由 Sheet 更新**：早期 `setupScorersSheet` 驗證清單漏了 `kane`（HTML 已將其列為 active），2026-06-29 補上。改 `Code.gs` 後須重跑「建立/更新 scorers 射手分頁」選單，現有分頁的下拉清單才會更新（詳見 `LEARNINGS.md` #21）。

> **國旗靠本地 `emoji/` 資產，不靠系統 emoji 字體**：球員標籤的國旗以 SVG `<image>` 畫出本地 twemoji SVG（emoji 直接放進 SVG `<text>` 不會渲染，英格蘭次級旗 🏴 必空白）。**新增球員時，先確認 `emoji/` 內有對應旗檔**（檔名 = code point 以 `-` 串接、去掉 `fe0f`），缺檔請從 twemoji 14.0.2 CDN 補下載，否則旗會 404 空白（詳見 `LEARNINGS.md` #22）。匈牙利 🇭🇺、秘魯 🇵🇪 已於 2026-06-29 補檔。
>
> **圖表座標慣例**：步階圖，某屆圓點畫在「該屆→下一屆」水平段中點；x 軸年份標籤也平移到間隔中點以對齊圓點，最後一屆（2026）用同樣半步往右移。Y 軸每 2 球標一格（2,4,6…）。詳見 `LEARNINGS.md` #23。

---

## 淘汰賽 32 強自動解析（後端）

32 強（match_id 73–88）的晉級隊伍由**後端純函式**依小組積分自動解析，**不再**依賴 football-data.org 的淘汰賽對陣。流程：

```
[每 10 分 trigger] → syncScores → recalcGroups → syncBracket → 寫入 matches 73–88
[bracket 頁面]     → 每 60 秒自動重抓並重繪
```

**運作要點**：

1. 對陣結構寫死在 `Code.gs` 的 `getR32SeedMap()`（與前端 `wc2026-bracket.html` 的 `R32_SEEDS` 等價，已對照官方 16 場），最佳第三名分配在 `getThirdPlaceAllocation()`。
2. **漸進式填入**：只有小組名次在數學上已鎖定才寫入該側，未確定的一側留空；最佳第三名要等 8 隊全部確定才解析。小組賽中對戰表大多仍是 TBD 屬**正常**。
3. **手動鎖定**：`matches` 工作表第 R 欄（`manual`）勾選的列整列跳過，不被自動覆寫。
4. 改完 `Code.gs` 後：貼進 Apps Script → 存檔 → **手動執行 `syncBracket` 才會立即生效**（存檔不等於執行）；否則等下一次 10 分 trigger。

> ⚠️ **待辦**：`getThirdPlaceAllocation()` 的 495 組分配表為機器產生，組合 pool 已驗證，但逐組合 slot 指派尚未對照 FIFA 官方規程，賽前需核對（詳見 `LEARNINGS.md` #19）。

---

## 資料 API

```
GAS URL（2026-06-30 起，所有頁面已統一；新增 PK 罰球欄位 pen1/pen2）：
https://script.google.com/macros/s/AKfycbzy0JSAlS2LRpEM3bZ8xv_qYW4saN8KkKptt91IMdjnpmMWm1ZpeuVG-5Rqie5odRg19Q/exec

舊 URL（已停用，仍跑舊碼，待全部頁面確認改用新 URL 後再刪部署）：
…uhahbq7Tg/exec

?action=getMatches      → 所有場次（104 場）
?action=getGroups       → 積分榜（12 組 × 4 隊）
?action=getBracket      → 淘汰賽對陣
?action=getTopScorers   → 2026 射手累計（讀 scorers 工作表）
```

GAS 冷啟動約需 3–8 秒，前端已實作 `stale-while-revalidate`：先從 localStorage 顯示舊資料，背景更新後重繪。

> ⚠️ **部署 URL 是寫死在每個 HTML 的 `GAS_URL` 常數裡**（根目錄 + `wc2026-v1.0-deploy/` 共 5 頁 × 2 份 = 10 個檔案）。**換部署 = 換 `/exec` URL = 必須改全部 10 檔並重新上傳 cna.com.tw**。務必「更新既有部署的新版本」而非「建新部署」，否則 URL 變動會打斷所有頁面（詳見 `LEARNINGS.md` #20）。

---

## 常見問題

**Q：瀏覽器 console 出現 `Invalid X-Frame-Options` 警告**
CNA 伺服器的 `X-Frame-Options` header 格式不合規範（應為 `SAMEORIGIN`，不是逗號分隔的域名清單）。瀏覽器會忽略該 header，iframe 正常載入，不影響功能。需由 CNA 後端修正。

**Q：積分榜 iframe 高度跑掉**
積分榜使用固定高度 600 px（內部可滾動），不會隨內容變高。賽程和淘汰賽才使用自動調整高度。

**Q：手機上切換積分榜組別，外層頁面會跳動**
已修正：組別按鈕使用 `container.scrollTop` 在 iframe 內部滾動，不會影響外層頁面。

**Q：電腦版淘汰賽對陣圖在 iframe 內無法左右滑動**
已修正：展開欄位後需等 CSS 寬度 transition（250ms）完成才能量到正確寬度，改用 `setTimeout(fitBracket, 280)` 延遲觸發，確保 scroll mode 正確啟用。

**Q：賽程和積分榜顯示的隊名與官方不同（波赫、民主剛果）**
前端有 `TEAM_NAMES` 對照表，將 API 回傳的原始名稱（波士尼亞、剛果）對應為中文慣用名稱（波赫、民主剛果），不需修改 Google Sheet 資料。

**Q：淘汰賽對陣圖小組欄「沙烏地阿拉伯」顯示不完整**
已修正：字數 ≥ 6 的隊名（xs class）在小組欄以 `<br>` 強制於第 3 字後換行，顯示為「沙烏地 / 阿拉伯」兩行，字級 0.50rem。
