const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const BRACKET_FILES = [
  'wc2026-bracket.html',
  'wc2026-v1.0-deploy/wc2026-bracket.html',
];

const R32_TEAMS = [
  ['MEX', '墨西哥', '🇲🇽'], ['KOR', '韓國', '🇰🇷'],
  ['USA', '美國', '🇺🇸'], ['AUS', '澳洲', '🇦🇺'],
  ['BRA', '巴西', '🇧🇷'], ['JPN', '日本', '🇯🇵'],
  ['ARG', '阿根廷', '🇦🇷'], ['FRA', '法國', '🇫🇷'],
  ['ESP', '西班牙', '🇪🇸'], ['BEL', '比利時', '🇧🇪'],
  ['ENG', '英格蘭', '🏴'], ['POR', '葡萄牙', '🇵🇹'],
  ['GER', '德國', '🇩🇪'], ['NED', '荷蘭', '🇳🇱'],
  ['CAN', '加拿大', '🇨🇦'], ['SUI', '瑞士', '🇨🇭'],
  ['RSA', '南非', '🇿🇦'], ['CZE', '捷克', '🇨🇿'],
  ['PAR', '巴拉圭', '🇵🇾'], ['TUR', '土耳其', '🇹🇷'],
  ['MAR', '摩洛哥', '🇲🇦'], ['SWE', '瑞典', '🇸🇪'],
  ['URU', '烏拉圭', '🇺🇾'], ['SEN', '塞內加爾', '🇸🇳'],
  ['KSA', '沙烏地阿拉伯', '🇸🇦'], ['EGY', '埃及', '🇪🇬'],
  ['GHA', '迦納', '🇬🇭'], ['COL', '哥倫比亞', '🇨🇴'],
  ['CIV', '象牙海岸', '🇨🇮'], ['TUN', '突尼西亞', '🇹🇳'],
  ['QAT', '卡達', '🇶🇦'], ['CRO', '克羅埃西亞', '🇭🇷'],
];

// Verified against the official FIFA 2026 bracket by venue (each match-id's
// resolved teams match the official R32 fixture at that stadium).
const EXPECTED_R32_SEEDS = {
  73: ['2A', '2B'],
  74: ['1C', '2F'],
  75: ['1E', '3 ABCDF'],
  76: ['1F', '2C'],
  77: ['2E', '2I'],
  78: ['1I', '3 CDFGH'],
  79: ['1A', '3 CEFHI'],
  80: ['1L', '3 EHIJK'],
  81: ['1G', '3 AEHIJ'],
  82: ['1D', '3 BEFIJ'],
  83: ['1H', '2J'],
  84: ['2K', '2L'],
  85: ['1B', '3 EFGIJ'],
  86: ['2D', '2G'],
  87: ['1J', '2H'],
  88: ['1K', '3 DEIJL'],
};

const EXPECTED_GROUP_TEAMS = {
  A: ['墨西哥', '南非', '韓國', '捷克'],
  B: ['加拿大', '波赫', '瑞士', '卡達'],
  C: ['巴西', '摩洛哥', '海地', '蘇格蘭'],
  D: ['美國', '巴拉圭', '澳洲', '土耳其'],
  E: ['德國', '象牙海岸', '厄瓜多', '古拉索'],
  F: ['荷蘭', '日本', '瑞典', '突尼西亞'],
  G: ['比利時', '埃及', '伊朗', '紐西蘭'],
  H: ['西班牙', '維德角', '沙烏地阿拉伯', '烏拉圭'],
  I: ['法國', '塞內加爾', '伊拉克', '挪威'],
  J: ['阿根廷', '阿爾及利亞', '奧地利', '約旦'],
  K: ['葡萄牙', '烏茲別克', '哥倫比亞', '民主剛果'],
  L: ['英格蘭', '克羅埃西亞', '迦納', '巴拿馬'],
};

function extractMainScript(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  const script = scripts.find(s => s.includes('function renderDesktop'));
  assert(script, 'main bracket script not found');
  return script;
}

function loadBracketContext(file) {
  const html = fs.readFileSync(file, 'utf8');
  const elements = {
    'bracket-desktop': { innerHTML: '' },
  };
  const context = {
    console,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { search: '', pathname: '/wc2026-bracket.html', replace: () => {} },
    window: {
      innerWidth: 1024,
      addEventListener: () => {},
      parent: { postMessage: () => {} },
    },
    document: {
      body: {},
      addEventListener: () => {},
      getElementById: id => elements[id] || (elements[id] = { innerHTML: '' }),
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    navigator: { serviceWorker: { register: () => ({ catch: () => {} }) } },
    requestAnimationFrame: () => {},
    setTimeout: () => {},
    clearTimeout: () => {},
    fetch: async () => { throw new Error('fetch should not run in smoke test'); },
    URLSearchParams,
    Date,
    String,
    Number,
    RegExp,
    Set,
    Array,
    Math,
    JSON,
  };
  context.window.document = context.document;
  context.window.parent = context.window.parent;
  vm.createContext(context);
  vm.runInContext(`${extractMainScript(html)}
this.renderDesktop = renderDesktop;
this.renderMobile = renderMobile;
this.PHASE_LABELS = PHASE_LABELS;
this.PHASE_R32 = PHASE_R32;
this.PHASE_R16 = PHASE_R16;
this.PHASE_QF = PHASE_QF;
this.PHASE_SF = PHASE_SF;
this.PHASE_F = PHASE_F;
this.PHASE_3RD = PHASE_3RD;
this.R32_SEEDS = R32_SEEDS;
this.GROUPS_INFO = GROUPS_INFO;
this.formatSeed = formatSeed;
this.init = init;`, context);
  context.elements = elements;
  return context;
}

function team(index) {
  const [code, name, flag] = R32_TEAMS[index];
  return { code, name, flag };
}

function match(match_id, phase, team1, team2, status = 'upcoming', score1 = null, score2 = null) {
  return {
    match_id,
    date: '2026-06-29',
    time_utc8: '03:00',
    phase,
    group: '',
    round: 0,
    team1,
    team2,
    score1,
    score2,
    status,
    venue: 'Smoke Test Stadium',
    city: '測試市',
  };
}

function knockoutMatches(ctx) {
  const r32 = Array.from({ length: 16 }, (_, i) =>
    match(73 + i, ctx.PHASE_R32, team(i * 2), team(i * 2 + 1)));
  const r16 = Array.from({ length: 8 }, (_, i) =>
    match(89 + i, ctx.PHASE_R16, team(i * 2), team(i * 2 + 1)));
  const qf = Array.from({ length: 4 }, (_, i) =>
    match(97 + i, ctx.PHASE_QF, team(i * 2), team(i * 2 + 1)));
  const sf = Array.from({ length: 2 }, (_, i) =>
    match(101 + i, ctx.PHASE_SF, team(i * 2), team(i * 2 + 1)));
  return [
    ...r32,
    ...r16,
    ...qf,
    ...sf,
    match(103, ctx.PHASE_3RD, team(2), team(3)),
    match(104, ctx.PHASE_F, team(0), team(1), 'finished', 2, 1),
  ];
}

function tbdR32Matches(ctx) {
  const tbd = { code: '', name: '', flag: '' };
  return Object.keys(EXPECTED_R32_SEEDS).map(matchId =>
    match(Number(matchId), ctx.PHASE_R32, tbd, tbd));
}

(async () => {
  for (const file of BRACKET_FILES) {
    const ctx = loadBracketContext(file);
    assert.strictEqual(ctx.PHASE_LABELS[ctx.PHASE_QF], '8強', `${file} QF label should be correct`);
    assert.strictEqual(ctx.PHASE_LABELS[ctx.PHASE_SF], '4強', `${file} SF label should be correct`);
    assert.strictEqual(
      JSON.stringify(ctx.R32_SEEDS),
      JSON.stringify(EXPECTED_R32_SEEDS),
      `${file} R32 seed mapping should match official match numbers`
    );
    for (const [group, teams] of Object.entries(EXPECTED_GROUP_TEAMS)) {
      assert.strictEqual(
        JSON.stringify(ctx.GROUPS_INFO[group].teams.map(([, name]) => name)),
        JSON.stringify(teams),
        `${file} group ${group} teams should match the official draw`
      );
    }

    const seedHtml = ctx.renderDesktop(tbdR32Matches(ctx));
    for (const [matchId, seeds] of Object.entries(EXPECTED_R32_SEEDS)) {
      for (const seed of seeds) {
        const expectedLabel = ctx.formatSeed(seed);
        assert(seedHtml.includes(expectedLabel), `${file} match ${matchId} should render ${expectedLabel}`);
      }
    }

    const allMatches = [
      match(1, '小組賽', team(0), team(1)),
      ...knockoutMatches(ctx),
    ];
    const ko = allMatches.filter(m =>
      [ctx.PHASE_R32, ctx.PHASE_R16, ctx.PHASE_QF, ctx.PHASE_SF, ctx.PHASE_3RD, ctx.PHASE_F].includes(m.phase)
    );

    assert.strictEqual(ko.length, 32, `${file} should filter only knockout matches`);
    const desktopHtml = ctx.renderDesktop(ko);
    const mobileHtml = ctx.renderMobile(ko, ctx.PHASE_R32);

    for (const [, name] of R32_TEAMS) {
      assert(desktopHtml.includes(name), `${file} desktop should render ${name}`);
    }
    assert(mobileHtml.includes('墨西哥'), `${file} mobile should render R32 team names`);
    assert(mobileHtml.includes('季軍賽'), `${file} mobile should include third-place match under final`);
    assert(desktopHtml.includes('champion-name">墨西哥'), `${file} should render final winner`);
    assert(!desktopHtml.includes('A組第1'), `${file} should not show seed labels when teams are loaded`);

    ctx.fetch = async url => {
      assert(String(url).includes('action=getMatches'), `${file} should fetch matches`);
      return { ok: true, json: async () => ({ status: 'ok', data: allMatches }) };
    };
    await ctx.init();
    const loadedHtml = ctx.elements['bracket-desktop'].innerHTML;
    assert(loadedHtml.includes('墨西哥'), `${file} init should load knockout team names`);
    assert(loadedHtml.includes('克羅埃西亞'), `${file} init should load all R32 team names`);
    assert(!loadedHtml.includes('A組第1'), `${file} init should not show seed labels for loaded teams`);
  }

  console.log('bracket smoke tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
