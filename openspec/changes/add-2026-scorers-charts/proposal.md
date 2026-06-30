## Why

現有的 `wc2026-scorers.html` 把 1954 年至今的歷史射手（克洛澤、比利、穆勒等退役名將）與 2026 世界盃球員混在同一條累計進球折線圖上。當聚焦在 2026 參賽球員、且球員數從 4 名增加到 11 名時，單一疊圖會在左側（多數人累計進球都很低）擠成一團義大利麵，圓點互相覆蓋，無法閱讀。需要兩種「只顯示 2026 參賽球員」的新視覺化來解決重疊問題並提供比較。

## What Changes

- 新增兩個獨立的 HTML 圖表檔案，皆只顯示 2026 世界盃參賽的 11 名球員（姆巴佩、梅西、C 羅納度、凱恩 + 內馬爾、瓦倫西亞、羅德里格斯、盧卡庫、柏瑞斯奇、哈克波、維尼修斯），移除所有退役名將。
  - `wc2026-scorers-bars.html`：水平堆疊長條圖，每名球員一條，依屆別（2014/2018/2022/2026）分段，並依總進球數排序。完全無重疊。
  - `wc2026-scorers-lines.html`：沿用現有累計折線圖風格，X 軸壓縮為 2002–2026，11 名球員皆為彩色線，靜止狀態線條變細／變淡，點選某球員時其餘淡出（沿用現有 dim-others 互動）。
- 原始 `wc2026-scorers.html` 不更動，作為對照保留。
- 兩個新檔案共用：同一份球員資料（哈克波總進球數已修正為 6）、2026 進球數由 GAS `getTopScorers` 即時資料合併（靜態值為後備）、相同的 CNA header/panel 外觀與 `postMessage` iframe 高度回報。

## Non-Goals (optional)

- 不修改原始 `wc2026-scorers.html`。
- 不採用 bump／排名圖：因資料在早期屆別有大量平手（2014 年有四名球員累計皆為 0），排名列會再次重疊，反而無法解決問題。
- 不修改 GAS 後端；若新球員的 `player_code` 未出現在 getTopScorers 試算表，即時合併為無作用，顯示靜態後備值（此為已知限制，非本次後端工作範圍）。
- 不為兩個新檔案製作 a11y 高對比版本（屬 `accessible-chart-edition` 的後續工作）。

## Capabilities

### New Capabilities

- `scorers-2026-visualization`: 只顯示 2026 世界盃參賽球員的兩種射手競賽視覺化（水平堆疊長條圖與壓縮折線圖），含 11 名球員資料集、2026 即時資料合併規則、無重疊版面與既有 embed/resize 行為。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 `scorers-2026-visualization`
- Affected code:
  - New:
    - wc2026-scorers-bars.html
    - wc2026-scorers-lines.html
  - Modified: (none)
  - Removed: (none)
- Affected data/APIs:
  - 依賴既有 GAS `getTopScorers`（見 `data-api` spec）；需確認 11 名球員的 `player_code` 對應（目前僅有 `ronaldo→cronaldo` 別名）。
