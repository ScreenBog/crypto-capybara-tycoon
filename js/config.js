/**
 * Crypto-Capybara Tycoon — баланс и константы.
 * Крути цифры здесь. Логика — в game.js / sdk.js.
 */
window.CCT_CONFIG = {
  SAVE_KEY: 'cct_save_v1',

  YANDEX: {
    // APP_ID: 000000,
    /**
     * Технические имена лидербордов — СОЗДАЙ ИХ В КОНСОЛИ
     * (вкладка «Лидерборды»), иначе SDK вернёт 404.
     */
    LB_EARNED: 'cct_earned',
    LB_CPS: 'cct_cps',
    LB_PRESTIGE: 'cct_prestige',
  },

  INTERSTITIAL_COOLDOWN_MS: 3 * 60 * 1000,
  INTERSTITIAL_FIRST_DELAY_MS: 90 * 1000,
  INTERSTITIAL_EVERY_N_PURCHASES: 3,

  BOOST_DURATION_MS: 60 * 1000,
  BOOST_MULTIPLIER: 2,

  COIN_BAG: {
    clickTimes: 90,
    secondsOfCps: 50,
    nextUpgradeShare: 0.38,
    min: 25,
  },

  OFFLINE: {
    minMsToShow: 45 * 1000,
    maxHours: 8,
    efficiency: 0.65,
  },

  AUTOSAVE_MS: 4000,
  TICK_MS: 100,
  LB_PUSH_MS: 4000,

  /**
   * Престиж / ребирт.
   * Очки = floor(sqrt(runEarned / UNIT)), минимум 1 при пороге.
   * Каждое очко даёт +PER_POINT к доходу навсегда.
   */
  PRESTIGE: {
    minRun: 25000,
    unit: 18000,
    perPoint: 0.08, // +8% за очко
    adBonus: 0.35, // +35% очков за рекламу перед ребиртом
  },

  /** Комбо-тапы. Окно в мс, пороги по серии. */
  COMBO: {
    windowMs: 420,
    tiers: [
      { at: 6, mult: 1.5 },
      { at: 16, mult: 2 },
      { at: 32, mult: 3 },
    ],
  },

  /**
   * Ежедневка. Индекс = (streak-1) % 7.
   * День 7 — жирный приз + шанс скина.
   */
  DAILY: {
    rewards: [500, 800, 1300, 2200, 3600, 6000, 16000],
    day7BoostMs: 90 * 1000,
  },

  UPGRADES: [
    { id: 'click', kind: 'click', branch: 'tap', baseCost: 15, costMult: 1.15, power: 1, icon: 'tap' },
    { id: 'hamster', kind: 'cps', branch: 'mine', baseCost: 50, costMult: 1.15, power: 1, icon: 'hamster' },
    { id: 'farm', kind: 'cps', branch: 'mine', baseCost: 480, costMult: 1.15, power: 8, icon: 'farm' },
    { id: 'pond', kind: 'cps', branch: 'mine', baseCost: 3200, costMult: 1.14, power: 28, icon: 'pond' },
    { id: 'influencer', kind: 'autotap', branch: 'social', baseCost: 8500, costMult: 1.15, power: 0.45, icon: 'influencer' },
    { id: 'pool', kind: 'cps', branch: 'stake', baseCost: 18000, costMult: 1.14, power: 95, icon: 'pool' },
    { id: 'nft', kind: 'pct', branch: 'stake', baseCost: 42000, costMult: 1.16, power: 0.02, icon: 'nft' },
    { id: 'exchange', kind: 'cps', branch: 'stake', baseCost: 110000, costMult: 1.13, power: 340, icon: 'exchange' },
    { id: 'city', kind: 'cps', branch: 'mine', baseCost: 850000, costMult: 1.13, power: 1250, icon: 'city' },
    { id: 'vault', kind: 'cps', branch: 'stake', baseCost: 6.5e6, costMult: 1.12, power: 4800, icon: 'vault' },
  ],

  BRANCHES: ['tap', 'mine', 'social', 'stake'],

  SKINS: [
    { id: 'classic', unlock: { type: 'free' } },
    { id: 'mogul', unlock: { type: 'prestige', n: 1 } },
    { id: 'astro', unlock: { type: 'prestige', n: 3 } },
    { id: 'cyber', unlock: { type: 'quests', n: 8 } },
    { id: 'king', unlock: { type: 'streak', n: 7 } },
    { id: 'ghost', unlock: { type: 'ad' } },
  ],

  /**
   * Квесты дня. targetFn(ctx) считает цель под текущий прогресс.
   * Каждый день берём 3 штуки по сиду даты.
   */
  QUEST_POOL: [
    { id: 'earn', stat: 'dayEarned', base: 4000 },
    { id: 'taps', stat: 'dayTaps', base: 180 },
    { id: 'buys', stat: 'dayBuys', base: 3 },
    { id: 'ads', stat: 'dayAds', base: 2 },
    { id: 'combo', stat: 'dayMaxCombo', base: 16 },
  ],

  WEEKLY: { id: 'weekEarn', stat: 'weekEarned', base: 250000 },

  RANKS: [
    { at: 0, id: 'stray' },
    { at: 500, id: 'miner' },
    { at: 8000, id: 'holder' },
    { at: 80000, id: 'whale' },
    { at: 750000, id: 'mogul' },
    { at: 8e6, id: 'legend' },
    { at: 1e8, id: 'myth' },
  ],

  /**
   * Лайв-ивенты по дню недели (локальное время игрока).
   * 0 вс … 6 сб
   */
  EVENTS: {
    0: { id: 'bull', mult: 2.5, minutes: 90 },
    3: { id: 'orange', comboBonus: 180, minutes: 90 },
    6: { id: 'bull', mult: 2.5, minutes: 90 },
  },
};
