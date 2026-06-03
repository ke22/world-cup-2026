## Context

現有三個 chart 頁面（v1.1）以新聞嵌入為主要場景設計，字型 14px、配色以品牌藍為主色。CNA 銀髮族讀者比例高，需要符合 WCAG 2.1 AA 且對長輩友善的替代版本。新版本以獨立 HTML 檔案形式存在（`*-a11y.html`），與原版共用同一 GAS 後端和 postMessage 機制，只改視覺呈現與無障礙語義。

## Goals / Non-Goals

**Goals:**
- WCAG 2.1 AA 合規（對比、焦點、鍵盤導覽、語義結構）
- 長輩閱讀友善（字型 ≥ 18px、觸控目標 ≥ 48px、簡化導覽）
- 功能完整保留（資料串接、postMessage、Twemoji 國旗）
- 不影響現有 v1.1 檔案

**Non-Goals:**
- 不修改任何 v1.1 HTML 檔案
- 不建立共用 CSS 外部檔案（保持單一 HTML 自包含）

## Decisions

### 設計系統：高對比配色 token

新版 `:root` 與 v1.1 完全分離：

```css
:root {
  --bg:       #ffffff;
  --surface:  #f5f5f5;
  --fg:       #1a1a1a;        /* 對原白底，對比 16.7:1 (AAA) */
  --muted:    #595959;        /* 對白底，對比 7.0:1 (AA) */
  --accent:   #0056b3;        /* 對白底，對比 7.2:1 (AAA) */
  --accent-2: #003d82;
  --border:   #767676;        /* 對白底，對比 4.54:1 (AA) */
  --live:     #c0392b;        /* 對白底，對比 5.1:1 (AA) */
  --header-bg:#003d82;        /* 對白字 #fff，對比 9.0:1 (AAA) */
  --focus:    #0056b3;
}
```

### 字型比例

| 用途 | v1.1 | a11y |
|------|------|------|
| body | 14px | 18px |
| 小標 | 12px | 15px |
| 時間/比分 | 26–30px | 30–36px |
| header 標題 | 17–18px | 22px |

全部改用 `rem` 相對單位（以 `html { font-size: 18px }` 為基準），讓系統字型放大設定生效。

### 觸控目標尺寸

所有互動元素 `min-height: 48px; min-width: 48px`，比 v1.1 的 44px 再寬鬆。

### 跳過導覽（Skip Navigation）

每頁最頂端加：
```html
<a href="#main-content" class="skip-link">跳至主要內容</a>
```
平時隱藏（`position: absolute; left: -9999px`），`focus` 時浮現（`left: 0`）。

### 焦點指示器

全域覆蓋瀏覽器預設：
```css
:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
  border-radius: 4px;
}
```

### ARIA 語義結構

| 元素 | 標記 |
|------|------|
| 整體容器 | `<main id="main-content">` |
| 日期/字母導覽 | `<nav aria-label="日期導覽">` / `<nav aria-label="跳至組別">` |
| 比賽列表 | `<section aria-label="今日賽事" aria-live="polite">` |
| 積分榜 | `<table aria-label="{G} 組積分">` （已有，保留） |
| 狀態訊息 | `role="status"` |
| 按鈕 | 每個按鈕均有可見文字（不依賴純圖示） |

### `prefers-contrast: more` 加強

```css
@media (prefers-contrast: more) {
  :root {
    --border: #000000;
    --muted:  #000000;
  }
  .match-card, .group-card { border-width: 2px; }
}
```

### bracket-a11y 簡化策略

桌機版 bracket 視覺複雜，a11y 版採用**清單模式**為主：
- 不顯示視覺賽程樹（對低視力用戶難以理解）
- 直接渲染各輪次的比賽卡片列表，按輪次分組（32強→16強→…→決賽）
- 仍保留完整資料

## Implementation Contract

**三個新檔案均須滿足：**
- WCAG 2.1 AA 對比比率（使用 `axe-core` 或 Chrome DevTools Accessibility 面板驗收）
- 所有互動元素可用鍵盤 Tab/Enter/Space 操作
- 無障礙樹（Accessibility Tree）中無 role 缺失或 aria-label 空值

**postMessage 合約（與 v1.1 相同）：**
- `{ type: 'wc2026-resize', height: document.documentElement.scrollHeight }`

**版本標識：**
- header 顯示 `v1.1-a11y`

**範圍邊界：**
- 僅新增三個 `*-a11y.html` 檔案和更新 `wc2026-embed-info.html`
- 不修改任何現有 HTML 或 JS

## Risks / Trade-offs

- [bracket 視覺樹取消] → 改用清單模式，功能完整但視覺呈現不同於 v1.1；對長輩反而更直觀
- [字型放大影響 iframe 高度] → postMessage 已處理動態高度，無須額外調整
- [對比色不符品牌藍] → a11y 版優先無障礙而非品牌一致性，這是刻意取捨
