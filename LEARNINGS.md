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

## 10. embed-loader.js 架構

CNA 要求使用 `data-src` lazy-load 模式。`embed-loader.js`：
1. 找所有 `.wc2026-embed[data-src]` div
2. 建立 `<iframe>` 替換 div，設 `data-loaded` 標記
3. 監聽 `message` 事件，比對 `e.source === iframe.contentWindow` 確保只更新對應的 iframe
4. 積分榜回報固定 600px，loader 直接套用；賽程/晉級圖回報動態高度
