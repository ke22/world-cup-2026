(() => {
  const SELECTOR   = '.wc2026-embed';
  const LOADED     = 'data-wc2026-processed';
  const DEF_HEIGHT = 800;
  const MIN_HEIGHT = 320;
  const MAX_HEIGHT = 3000;

  function clampH(raw) {
    const n = parseInt(String(raw ?? DEF_HEIGHT), 10);
    return Number.isFinite(n) ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, n)) : DEF_HEIGHT;
  }

  function build(node) {
    const src = node.getAttribute('data-src');
    if (!src) return null;
    const iframe = document.createElement('iframe');
    iframe.src              = src;
    iframe.title            = node.getAttribute('data-title') || 'FIFA 世界杯 2026 互動圖表';
    iframe.width            = '100%';
    iframe.height           = clampH(node.getAttribute('data-height'));
    iframe.loading          = 'lazy';
    iframe.referrerPolicy   = 'strict-origin-when-cross-origin';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'yes');
    iframe.style.cssText    = 'width:100%;border:0;display:block;overflow:auto;';
    return iframe;
  }

  function process() {
    document.querySelectorAll(`${SELECTOR}:not([${LOADED}])`).forEach(node => {
      const iframe = build(node);
      if (!iframe) return;
      node.innerHTML = '';
      node.appendChild(iframe);
      node.setAttribute(LOADED, 'true');
    });
  }

  // Auto-resize via postMessage from iframe
  window.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'wc2026-resize') return;
    document.querySelectorAll(`${SELECTOR}[${LOADED}] iframe`).forEach(iframe => {
      if (iframe.contentWindow === e.source) {
        iframe.height = Math.max(e.data.height, MIN_HEIGHT);
        iframe.style.height = iframe.height + 'px';
      }
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', process, { once: true });
  } else {
    process();
  }

  new MutationObserver(muts => {
    if (muts.some(m => m.addedNodes.length)) process();
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.WC2026Embeds = { process };
})();
