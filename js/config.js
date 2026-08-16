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
    /**
     * Инапы — создай в Консоли → «Инап-покупки».
     * id должен совпадать один в один.
     */
    IAP: {
      noAds: 'cct_no_ads',
      permMult: 'cct_perm_mult',
      starter: 'cct_starter',
    },
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
      { at: 56, mult: 4 },
    ],
  },

  /**
   * Асценсия / китовый уровень.
   * Открывается после N ребиртов. Сжигает очки ребирта и фермы,
   * выдаёт апельсины — вечную валюту кита.
   */
  ASCENSION: {
    minPrestiges: 8,
    minPoints: 12,
    unit: 4,
    adBonus: 0.3,
  },

  WHALE: [
    { id: 'fang', max: 20, base: 1, costMult: 1.35, power: 0.03 },
    { id: 'nest', max: 10, base: 2, costMult: 1.4, power: 40 },
    { id: 'nap', max: 8, base: 2, costMult: 1.45, power: 0.04 },
    { id: 'juice', max: 6, base: 3, costMult: 1.5, power: 40 },
    { id: 'gift', max: 5, base: 3, costMult: 1.55, power: 0.15 },
    { id: 'tip', max: 5, base: 4, costMult: 1.6, power: 1 },
  ],

  ACCESSORIES: [
    { id: 'glasses', unlock: { type: 'achieve', id: 'earn100k' } },
    { id: 'hat', unlock: { type: 'achieve', id: 'ads15' } },
    { id: 'chain', unlock: { type: 'prestige', n: 2 } },
    { id: 'leaf', unlock: { type: 'oranges', n: 3 } },
    { id: 'bow', unlock: { type: 'streak', n: 3 } },
  ],

  ACHIEVEMENTS: [
    { id: 'taps500', stat: 'lifetimeTaps', at: 500, reward: { title: 'tapper' } },
    { id: 'taps5k', stat: 'lifetimeTaps', at: 5000, reward: { oranges: 1 } },
    { id: 'earn100k', stat: 'totalEarned', at: 100000, reward: { acc: 'glasses' } },
    { id: 'earn10m', stat: 'totalEarned', at: 1e7, reward: { skin: 'sunset' } },
    { id: 'prestige3', stat: 'prestigeCount', at: 3, reward: { title: 'reborn' } },
    { id: 'prestige12', stat: 'prestigeCount', at: 12, reward: { oranges: 2 } },
    { id: 'streak7', stat: 'bestStreak', at: 7, reward: { skin: 'king' } },
    { id: 'ads15', stat: 'adsTotal', at: 15, reward: { acc: 'hat' } },
    { id: 'combo32', stat: 'bestCombo', at: 32, reward: { title: 'rhythm' } },
    { id: 'quests12', stat: 'questsDone', at: 12, reward: { skin: 'mint' } },
    { id: 'ascend1', stat: 'ascensionCount', at: 1, reward: { skin: 'whale' } },
    { id: 'skins6', stat: 'skinsOwned', at: 6, reward: { oranges: 1 } },
  ],

  MINIGAME: {
    cooldownMs: 3 * 60 * 60 * 1000,
    windowMs: 12000,
  },

  IAP_PERMANENT_MULT: 0.08,
  STARTER_PACK_CLICKS: 400,

  ONBOARD: {
    dailyAfterBuys: 1,
    questsAfterBuys: 3,
    skinsAfterPrestige: 1,
    albumAfterQuests: 1,
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
    { id: 'sunset', unlock: { type: 'achieve', id: 'earn10m' } },
    { id: 'mint', unlock: { type: 'achieve', id: 'quests12' } },
    { id: 'whale', unlock: { type: 'achieve', id: 'ascend1' } },
    { id: 'festival', unlock: { type: 'event', id: 'festival' } },
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
    1: { id: 'bear', mult: 0.75, rewardMult: 2.2, minutes: 90 },
    3: { id: 'orange', comboBonus: 180, minutes: 90 },
    4: { id: 'festival', minutes: 90 },
    5: { id: 'marathon', minutes: 120 },
    6: { id: 'bull', mult: 2.5, minutes: 90 },
  },
};
