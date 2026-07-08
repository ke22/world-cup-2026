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
---

## 21. GAS「新部署」= 新 `/exec` URL；存舊碼也救不了，要更新既有部署

**踩雷**：射手圖（`wc2026-scorers.html`）一直「沒同步更新」，但 schedule / groups / bracket 都正常。

**追查**：直接 curl `?action=getTopScorers` 回 `{"status":"error","message":"Invalid action"}`，但同一 URL 的 `?action=getMatches` 正常 → 部署是活的，只是跑著**沒有 `getTopScorers` 路由的舊版程式碼**。前端 `main()` 對 GAS 失敗會靜默 fallback 到寫死的 `HISTORICAL_DATA`，所以圖表永遠顯示寫死的 2026 數字，從不讀 Sheet。

**原因**：在 Apps Script「**部署 → 建立新部署**」會產生一個**全新的 `/exec` URL**；舊 URL 仍服務舊版程式碼。而每個 HTML 的 `GAS_URL` 是寫死的舊 URL，所以新程式碼永遠到不了前端。

**正確做法**：要讓**同一個 URL** 服務新程式碼——「**部署 → 管理部署 → 編輯（✏️）既有部署 → 版本：新版本 → 部署**」。建新部署只在你**願意**換 URL 時才做。

**這次的收尾**（採「換 URL」路線）：

- 容器綁定（container-bound）的 Apps Script 必須**從試算表 `擴充功能 → Apps Script`** 開啟，才會是擁有正式部署的那個專案；從別處開的可能是另一個專案，改了也不會生效（呼應 #18）。
- 新 URL 確認 `status:"ok"` 後，把 `GAS_URL` 在**全部 10 個檔案**（根 + `wc2026-v1.0-deploy/`，5 頁 × 2 份）一起換掉，並全部重新上傳 cna.com.tw。
- **不要刪舊部署**，直到 5 頁的線上版都確認改用新 URL——schedule/groups/bracket/admin 在重新上傳前仍依賴舊 URL。
- 除錯指令：`curl -s ".../exec?action=getTopScorers"`——一行就能分辨「部署掛了」vs「部署活著但是舊碼」。

---

## 22. HTML 的 active 球員清單與 GAS 驗證清單必須一致（凱恩漏列）

**問題**：`wc2026-scorers.html` 把四名球員設為 `active: true`（mbappe / messi / cronaldo / kane），其 2026 進球應由 Sheet 動態合併；但 `Code.gs` 的 `setupScorersSheet` 中 `player_code` 下拉驗證只列 `['mbappe','messi','ronaldo']`，且 `setAllowInvalid(false)`——連手打 `kane` 都被拒，凱恩的 2026 數字只能改 HTML 原始碼。

**解法**：驗證清單補上 `kane`（2026-06-29）。改 `Code.gs` 後**必須重跑選單「建立/更新 scorers 射手分頁」**，現有分頁的下拉驗證才會套用新清單（驗證規則不會因存檔自動回填到既有列）。

**教訓**：前端的 active／可動態更新名單，與後端 Sheet 的輸入驗證清單是**同一份事實的兩個面向**，加球員時兩邊都要改，否則前端準備好接資料、後端卻擋住輸入，症狀是「某球員永遠不會動」。`player_code` 別名映射（如 scorers sheet 用 `ronaldo`、HTML key 是 `cronaldo`）由前端 `PLAYER_CODE_ALIASES` 處理；`kane` 兩邊同名，不需別名。

---

## 23. SVG `<text>` 裡的 emoji 國旗不會渲染——改畫 `<image>` 指向本地 twemoji SVG

**問題**：射手圖（`wc2026-scorers.html`）的球員標籤把國旗 emoji 直接放進 SVG `<text>`（`${p.flag} ${p.name}`）。多數系統根本不渲染 SVG text 內的 emoji，**英格蘭次級旗 🏴（subdivision flag）**幾乎一定變成空白或亂碼。

**原因**：HTML 內文可由 twemoji 把 emoji 換成 `<img>`，但 `twemoji.parse()` 不處理 SVG `<text>` 節點；而瀏覽器原生對 SVG text 的 emoji 字體 fallback 很不一致，旗幟（尤其 tag-sequence 組成的次級旗）最常失敗。

**解法**：比照 `wc2026-groups.html` 的資料來源（本地 `emoji/` 內的 twemoji SVG），但在 SVG 裡改用 `<image>` 直接畫旗：
- `emojiToCodePoint(emoji)`：逐 code point 轉 hex 以 `-` 串接，**丟掉 `fe0f`（variation selector）、保留 ZWJ／tag chars**。`for...of` 會正確處理 surrogate pair（🏴 是 `1f3f4`，後面 6 個 tag chars 各為 >0xFFFF 的單一 code point）。
- `flagHref(emoji)` → `emoji/<codepoints>.svg`；英格蘭旗對應 `1f3f4-e0067-e0062-e0065-e006e-e0067-e007f.svg`。
- `drawLabel(parent, x, y, anchor, flagEmoji, label, attrs)`：先放 `<image>`（旗），再放 `<text>`（名字＋數字），用粗估字寬置中。SVG `<image>` 用現代 `href`（非 `xlink:href`）即可。

**踩雷**：本地 `emoji/` 資料夾只有 50 個檔，**匈牙利 🇭🇺、秘魯 🇵🇪 缺檔**（柯西斯、庫比利亞斯用得到）。從 twemoji 14.0.2 CDN 補下載到 `emoji/` 維持自帶資產。加新球員國旗時務必先確認 `emoji/` 有對應檔，否則 `<image>` 404、旗一樣空白。

```js
function emojiToCodePoint(emoji) {
  const pts = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0).toString(16);
    if (cp !== 'fe0f') pts.push(cp);   // 丟 variation selector，留 ZWJ/tag
  }
  return pts.join('-');
}
```

---

## 24. 步階折線圖：x 軸年份標籤對齊「浮在中段的圓點」而非格線

**背景**：射手圖是**步階圖**——某屆的圓點刻意畫在該屆與下一屆之間的**水平段中點**（plateau 中點），代表「該屆的累計值」。但年份標籤原本畫在格線／刻度（屆別 x 位置）上，於是「圓點」與「年份」對不起來。

**解法**：刻度、格線維持在屆別位置（步階的轉角在此），但**年份標籤平移到「到下一屆的間隔中點」**，正好落在圓點下方。**最後一屆（2026）沒有後續水平段**，所以照樣用同樣的「半步」位移往右移，維持各標籤間距一致（否則 2026 會貼著 2022）。

```js
const labelX = i < WC_YEARS.length - 1
  ? (x + cx_year(WC_YEARS[i + 1])) / 2          // 間隔中點，對齊圓點
  : x + (x - cx_year(WC_YEARS[i - 1])) / 2;     // 最後一屆用前一段的半步往右
```

**教訓**：本案 x 軸是 17 屆**依索引等距**（1982/1986 因無人進球被略過，仍只佔一格），所以「間隔中點」對連續參賽的球員（如梅西）恰好等於其圓點位置。若某球員跨屆缺賽，其圓點中點＝midpoint(該屆, 該球員下一屆)，未必等於全域相鄰屆中點——但全域標籤只能有一個位置，取相鄰屆中點是最貼近多數情況的折衷。曾試過改成「圓點落在屆別格線上」的純折線圖，使用者不要，已 revert 回步階＋中點圓點。

---

## 25. 別亂改 R16 feed：原本就是對的，我用網路資料「修」反而改壞了（已 revert）

**正解（現行、已驗證）**：`getKnockoutFeed_()` 的 R16 接法本來就正確，**勿動**：

```
89:(73,76) 90:(75,78) 91:(74,77) 92:(79,80)
93:(84,83) 94:(82,81) 95:(87,86) 96:(85,88)
```

**怎麼驗的（這次才是可信來源）**：拉**線上實際資料** `?action=getMatches`（GAS，需 `curl -sL` 跟轉址），對照 **Sky Sports 真實球隊對陣表**：
- 線上 89 = 加拿大(W73) vs W76；而 76 = 荷蘭/摩洛哥。Sky：「Canada vs Winner(Netherlands/Morocco)」✓
- 線上 91 = 巴西(W74) vs W77；而 77 = 象牙海岸/挪威。Sky：「Brazil vs Winner(Ivory Coast/Norway)」✓
- 線上 90 = W75 vs W78 = 德國/巴拉圭 vs 法國/瑞典。Sky：「Paraguay vs Winner(France/Sweden)」✓

**我犯的錯**：上一輪我把 89 改成 (74,77)、90 改成 (73,75)…，依據是 `WebSearch`／Wikipedia raw wikitext。**那些來源用的是和本系統不同（或被小模型幻覺）的場次編號**——它說「match 74 = Germany/Paraguay」，但線上資料的 74 是巴西/日本、75 才是德國/巴拉圭。編號對不上，整個 feed 就被我改歪。前端 `R32_ORDER`/`R16_BRACKET_ORDER`（兩份 bracket.html）也一起改歪，於是出現「巴西在左上贏球、晉級卻跑到右邊 R16」的破圖。已全部 revert 回上述正解。

**教訓**：
1. **改後端晉級邏輯前，先 reproduce**（看實際 render / 拉線上資料），不要只憑網路對陣表就動手。網路來源的**場次編號**常和你係統的編號不一致，必須以「真實球隊配對」交叉驗證，而不是 match number。
2. 判斷對錯的黃金樣本是**線上 `getMatches` 已解析的 R16 隊伍** + **新聞的真實球隊對陣**（如 Sky）。Wikipedia bracket 圖經 `WebFetch` 轉 markdown 不可信（同頁三問三答）。
3. 系統「跨檔一致」（feed=前端排序=test=mock 全一致）不代表「對」——它們可能一致地錯，也可能本來就一致地對；要拿**外部真實資料**錨定，別自我循環論證。
4. R32 seed map（#19）與 R16 feed 是分開的事實，但**兩者本來都已對**；別把「seed map 已驗證、第三名待核」誤讀成「R16 feed 也待修」。

---

## 26. 前端新欄位不顯示，先 curl API：JSON 缺整個 key = 跑舊碼，不是前端 bug

**問題**：schedule 前端加了罰球比數（pen1/pen2）顯示，後端、試算表都填好了，前端就是不顯示。一直懷疑是前端渲染或快取問題。
**原因**：線上 `getMatches` 跑的是**舊版部署**，回傳的 JSON 連 `pen1`/`pen2` 這兩個 key 都沒有——前端再正確也沒資料可渲染。根因同 #20：在 GAS「建立新部署」會給一個**全新 `/exec` URL**，舊 URL 仍服務舊碼，而前端 `GAS_URL` 寫死指向舊 URL。`setupHeaders()`／手填儲存格都只動到「資料」，不會讓舊碼長出新欄位。
**解法**：
1. 診斷一行定位：`curl -sL ".../exec?action=getMatches" | python3 -c "import sys,json; print('pen1' in json.load(sys.stdin)['data'][0])"`——`False` = 欄位不存在 = 舊碼，**不要在前端找 bug**。
2. 首選「更新既有部署的新版本」保住同一 URL（見 #20）；這次走「換 URL」路線，就照 #20 清單把 `GAS_URL` 在**全 10 檔**（根 + `v1.0-deploy/`）一起換、重新上傳 cna.com.tw、**舊部署先別刪**。
3. 順手把 `syncScores` 每場寫入包 `try/catch`，避免單格 stale 驗證（擋 `live`）中斷整批同步。

## 27. 長條圖只分「近幾屆」→ entity 的早期資料被吞，總數對不上

**問題**：把射手圖改成只顯示 2026 參賽球員、長條依 2014/2018/2022/2026 分段，梅西、C 羅的總進球比實際少（梅西算出 17 而非 18、C 羅 8 而非 10）。
**原因**：梅西（2006）、C 羅（2006、2010）在 2014 前就有進球；分段欄位只涵蓋近四屆，等於把更早的進球丟掉。使用者給的資料表只列新球員（都 ≥2014），讓人誤以為「所有人都從 2014 起算」。
**解法**：堆疊段必須覆蓋每個 entity 的完整區間——新增「2014前」彙總段，確保長條總長＝完整總和。通則：用時間窗壓縮資料前，先驗證 `sum(segments) === total`，別假設欄位涵蓋所有人的全部資料。

## 28. 圖表 render 卡在 await 網路回應 → 首屏空白（GAS 冷啟動更明顯）

**問題**：折線圖打開後要等好幾秒才出現，期間畫面一片空白，感覺「載很慢」。
**原因**：`main()` 先 `await fetchScorerRace()` 拿資料、才 `render()`，畫面被網路請求擋住。GAS（Apps Script）冷啟動要 1–3 秒；更糟的是新 action 還沒部署時，請求仍會整個來回一趟、回傳 error，才退回內建 fallback——等於白等那幾秒只為畫出本來就有的資料。
**解法**：改成 stale-while-revalidate——先用內建 fallback `render()`「秒畫」並回報高度，再背景 `await` fetch，真的拿到資料才二次 `render()` 並重報高度；fetch 失敗就保留已畫好的 fallback。第一屏不再被任何網路請求阻擋。

## 29. 手改 career 分頁圖表卻不動——前端讀的 feed ≠ 你改的 tab（同一份 2026 進球散在三處）

**問題**：手動更新 `career` 分頁的 2026 進球，`wc2026-scorers-lines.html` 卻完全沒變化。
**原因**：`scorers-lines` 讀的是 `getTopScorers`（`scorers` 分頁，只有 4 名球員 + HTML 內硬編碼 `PLAYERS` fallback），而使用者改的是 `career` 分頁（`getScorerRace`）。同一份「2026 進球」實際上有三個各自獨立的來源，改到了沒被前端讀取的那一份。
**解法**：把 lines 圖改讀 `getScorerRace`（與 bars 圖同一來源），`career` 分頁成為單一真相來源；硬編碼 `PLAYERS` 只留離線 fallback。診斷法：`grep -l "getTopScorers\|getScorerRace" *.html` 先確認每個前端讀哪個 action，再對回它對應的 tab——別假設「圖表都吃同一份資料」。
