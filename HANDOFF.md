# WC2026 互動圖表 — CNA 交接文件

> 最後更新：2026-06-12

## 元件清單

| 檔案 | 功能 | 建議嵌入高度 |
|------|------|-------------|
| `wc2026-schedule.html` | 賽程表（依日期切換，即時比分） | 自動調整（auto-resize） |
| `wc2026-groups.html` | 小組積分榜（A–L 可滾動） | 600 px（固定） |
| `wc2026-bracket.html` | 淘汰賽對陣圖 | 自動調整（auto-resize） |

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

## 資料 API

```
GAS URL：https://script.google.com/macros/s/AKfycbw6CYUYELg_.../exec

?action=getMatches   → 所有場次（104 場）
?action=getGroups    → 積分榜（12 組 × 4 隊）
?action=getBracket   → 淘汰賽對陣
```

GAS 冷啟動約需 3–8 秒，前端已實作 `stale-while-revalidate`：先從 localStorage 顯示舊資料，背景更新後重繪。

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
