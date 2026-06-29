// Verifies sw.js serves LIVE tournament data (network-first) so standings /
// bracket advancement update correctly, and only falls back to cache offline.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const swSrc = fs.readFileSync('sw.js', 'utf8');

// ---- Minimal Response/Cache/ServiceWorker mocks ----------------------------
function makeRes(body, ok = true) {
  return { body, ok, clone() { return makeRes(body, ok); } };
}

function makeEnv() {
  const store = new Map();                  // url -> response (the single cache)
  // v1 = stale leftover from a previous SW; v2 = current (created by fetch handler)
  const allCaches = { 'wc2026-v1': new Map(), 'wc2026-v2': new Map() };
  const listeners = {};
  let netResolver = null;                   // controls what fetch() returns

  const cacheApi = {
    match: req => Promise.resolve(store.get(req.url)),
    put: (req, res) => { store.set(req.url, res); return Promise.resolve(); },
  };
  const caches = {
    _store: store,
    _versions: allCaches,
    open: name => { allCaches[name] = allCaches[name] || new Map(); return Promise.resolve(cacheApi); },
    match: req => Promise.resolve(store.get(req.url)),
    keys: () => Promise.resolve(Object.keys(allCaches)),
    delete: name => { const had = name in allCaches; delete allCaches[name]; return Promise.resolve(had); },
  };

  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => Promise.resolve() },
  };

  const ctx = {
    self, caches, URL,
    fetch: req => netResolver(req),
    setNet: fn => { netResolver = fn; },
    Promise, console,
  };
  vm.createContext(ctx);
  vm.runInContext(swSrc, ctx);
  return { ctx, listeners, store, allCaches };
}

function dispatchFetch(listeners, request) {
  let responded;
  const event = { request, respondWith(p) { responded = p; } };
  listeners.fetch(event);
  return responded; // a promise, or undefined if handler passed through
}

const GAS = { url: 'https://script.google.com/macros/s/X/exec?action=getMatches' };
const OTHER = { url: 'https://example.com/wc2026-bracket.html' };

(async () => {
  // 1. ONLINE: fresh network response is returned even when a STALE copy is cached
  {
    const env = makeEnv();
    env.store.set(GAS.url, makeRes('STALE'));                   // stale cache present
    env.ctx.setNet(() => Promise.resolve(makeRes('FRESH')));    // network has new data
    const res = await dispatchFetch(env.listeners, GAS);
    assert.ok(res, 'GAS request is intercepted');
    const out = await res;
    assert.strictEqual(out.body, 'FRESH', 'online → serves FRESH network data, not stale cache');
    await new Promise(r => setTimeout(r, 0));                   // let background cache.put run
    assert.strictEqual(env.store.get(GAS.url).body, 'FRESH', 'cache is refreshed with latest data');
    console.log('  ✓ online: returns fresh data and updates cache');
  }

  // 2. OFFLINE: network fails → falls back to cached copy
  {
    const env = makeEnv();
    env.store.set(GAS.url, makeRes('CACHED-FALLBACK'));
    env.ctx.setNet(() => Promise.reject(new Error('offline')));
    const out = await (await dispatchFetch(env.listeners, GAS));
    assert.strictEqual(out.body, 'CACHED-FALLBACK', 'offline → serves cached fallback');
    console.log('  ✓ offline: falls back to cached response');
  }

  // 3. Non-OK network response is not written to cache
  {
    const env = makeEnv();
    env.store.set(GAS.url, makeRes('GOOD-CACHE'));
    env.ctx.setNet(() => Promise.resolve(makeRes('ERR-BODY', false))); // ok:false
    const out = await (await dispatchFetch(env.listeners, GAS));
    assert.strictEqual(out.body, 'ERR-BODY', 'still returns the network response');
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(env.store.get(GAS.url).body, 'GOOD-CACHE', 'bad response does NOT overwrite cache');
    console.log('  ✓ non-ok response does not poison the cache');
  }

  // 4. Non-GAS requests pass through untouched (HTML always from network/host)
  {
    const env = makeEnv();
    const responded = dispatchFetch(env.listeners, OTHER);
    assert.strictEqual(responded, undefined, 'non-GAS request is not intercepted by the SW');
    console.log('  ✓ non-GAS (page/asset) requests pass through');
  }

  // 5. activate purges the old cache version so stale entries cannot linger
  {
    const env = makeEnv();
    assert.ok('wc2026-v1' in env.allCaches, 'old cache present before activate');
    let waited;
    env.listeners.activate({ waitUntil: p => { waited = p; } });
    await waited;
    assert.ok(!('wc2026-v1' in env.allCaches), 'old wc2026-v1 cache deleted on activate');
    assert.ok('wc2026-v2' in env.allCaches, 'current wc2026-v2 cache retained');
    console.log('  ✓ activate purges stale cache version (v1 → v2)');
  }

  console.log('sw-cache-strategy tests passed');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
