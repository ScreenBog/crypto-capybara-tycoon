(function () {
  const CFG = window.CCT_CONFIG;
  const SDK = window.CCT_SDK;
  const t = function (path, vars) {
    return window.CCT_t(state.lang, path, vars);
  };

  const state = {
    lang: 'ru',
    coins: 0,
    totalEarned: 0,
    runEarned: 0,
    upgrades: {},
    lastSeen: Date.now(),
    boostUntil: 0,
    muted: false,
    prestigePoints: 0,
    prestigeCount: 0,
    skin: 'classic',
    unlockedSkins: { classic: true },
    streak: 0,
    bestStreak: 0,
    dailyClaimedOn: '',
    dayKey: '',
    dayEarned: 0,
    dayTaps: 0,
    dayBuys: 0,
    dayAds: 0,
    dayMaxCombo: 0,
    questIds: [],
    claimedQuests: [],
    questsDone: 0,
    weekKey: '',
    weekEarned: 0,
    weeklyClaimed: false,
    eventId: null,
    eventDay: '',
    eventUntil: 0,
    maxCps: 0,
    adsTotal: 0,
    pendingRestore: false,
    combo: 0,
    lastTap: 0,
    tab: 'shop',
    purchasesSinceAd: 0,
    pendingOffline: 0,
    paused: false,
    shopOpen: false,
    oranges: 0,
    ascensionCount: 0,
    whale: {},
    achieved: {},
    accUnlocked: {},
    accOn: {},
    iap: { noAds: false, permMult: false, starter: false },
    lifetimeTaps: 0,
    bestCombo: 0,
    lastMiniAt: 0,
    title: '',
    seen: { daily: false, quests: false, skins: false, album: false },
  };

  let lastTick = 0;
  let lastSave = 0;
  let lastLb = 0;
  let toastTimer = 0;
  let audioCtx = null;
  let seenHowTo = false;
  let prestigeArmed = false;
  let lbCache = { name: '', at: 0, data: null };

  function $(id) {
    return document.getElementById(id);
  }

  function defById(id) {
    return CFG.UPGRADES.find((u) => u.id === id);
  }

  function defaultUpgrades() {
    const o = {};
    CFG.UPGRADES.forEach((u) => {
      o[u.id] = 0;
    });
    return o;
  }

  function todayStr(d) {
    const x = d || new Date();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return x.getFullYear() + '-' + m + '-' + day;
  }

  function weekKey(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + week;
  }

  function shiftDate(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return todayStr(d);
  }

  function daysBetween(a, b) {
    const da = new Date(a + 'T12:00:00');
    const db = new Date(b + 'T12:00:00');
    return Math.round((db - da) / 86400000);
  }

  function formatNum(n) {
    if (!isFinite(n)) return '0';
    const abs = Math.abs(n);
    if (abs < 1000) return Math.floor(n).toString();
    const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
    let u = 0;
    let v = abs;
    while (v >= 1000 && u < units.length - 1) {
      v /= 1000;
      u += 1;
    }
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    return (n < 0 ? '-' : '') + v.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1') + units[u];
  }

  function formatMult(n) {
    return '×' + (Math.round(n * 100) / 100).toString().replace(/\.0+$/, '');
  }

  function boostMult() {
    return state.boostUntil > Date.now() ? CFG.BOOST_MULTIPLIER : 1;
  }

  function prestigeMult() {
    return 1 + (state.prestigePoints || 0) * CFG.PRESTIGE.perPoint;
  }

  function nftMult() {
    const u = defById('nft');
    return 1 + (state.upgrades.nft || 0) * (u ? u.power : 0);
  }

  function eventDef() {
    return CFG.EVENTS[new Date().getDay()] || null;
  }

  function eventMult() {
    if (state.eventUntil <= Date.now()) return 1;
    if (state.eventId === 'bull' || state.eventId === 'bear') {
      const ev = eventDef();
      return (ev && ev.mult) || 1;
    }
    return 1;
  }

  function rewardMult() {
    if (state.eventId === 'bear' && state.eventUntil > Date.now()) {
      const ev = eventDef();
      return (ev && ev.rewardMult) || 2;
    }
    return 1;
  }

  function whaleLv(id) {
    return state.whale[id] || 0;
  }

  function whaleDef(id) {
    return CFG.WHALE.find((w) => w.id === id);
  }

  function whaleCost(id) {
    const u = whaleDef(id);
    return Math.floor(u.base * Math.pow(u.costMult, whaleLv(id)));
  }

  function comboWindow() {
    let w = CFG.COMBO.windowMs + whaleLv('juice') * (whaleDef('juice').power);
    if (state.eventId === 'orange' && state.eventUntil > Date.now()) {
      const ev = eventDef();
      w += (ev && ev.comboBonus) || 180;
    }
    return w;
  }

  function comboMult() {
    let m = 1;
    CFG.COMBO.tiers.forEach((tier) => {
      if (state.combo >= tier.at) m = tier.mult;
    });
    return m;
  }

  function whaleIncomeMult() {
    return 1 + whaleLv('fang') * whaleDef('fang').power;
  }

  function iapMult() {
    return state.iap.permMult ? 1 + CFG.IAP_PERMANENT_MULT : 1;
  }

  function incomeMult() {
    return prestigeMult() * nftMult() * eventMult() * boostMult() * whaleIncomeMult() * iapMult();
  }

  function clickBase() {
    const u = defById('click');
    return 1 + (state.upgrades.click || 0) * u.power;
  }

  function clickPower() {
    return clickBase() * incomeMult() * comboMult();
  }

  function rawCps() {
    let s = 0;
    CFG.UPGRADES.forEach((u) => {
      if (u.kind === 'cps') s += (state.upgrades[u.id] || 0) * u.power;
    });
    return s;
  }

  function autotapRate() {
    const u = defById('influencer');
    return (state.upgrades.influencer || 0) * (u ? u.power : 0);
  }

  function cps() {
    const m = incomeMult();
    return rawCps() * m + autotapRate() * clickBase() * m;
  }

  function upgradeCost(id) {
    const u = defById(id);
    const level = state.upgrades[id] || 0;
    return Math.floor(u.baseCost * Math.pow(u.costMult, level));
  }

  function cheapestUpgradeCost() {
    let min = Infinity;
    CFG.UPGRADES.forEach((u) => {
      const c = upgradeCost(u.id);
      if (c < min) min = c;
    });
    return min;
  }

  function nextInterestingCost() {
    let best = Infinity;
    CFG.UPGRADES.forEach((u) => {
      const c = upgradeCost(u.id);
      if (c > state.coins && c < best) best = c;
    });
    return isFinite(best) ? best : cheapestUpgradeCost();
  }

  function coinBagAmount() {
    const bag = CFG.COIN_BAG;
    const fromClick = clickPower() * bag.clickTimes;
    const fromCps = Math.max(cps(), 0.5) * bag.secondsOfCps;
    const gap = Math.max(0, nextInterestingCost() - state.coins) * bag.nextUpgradeShare;
    return Math.max(bag.min, Math.floor(Math.max(fromClick, fromCps, gap) * rewardMult()));
  }

  function rank() {
    let current = CFG.RANKS[0];
    CFG.RANKS.forEach((r) => {
      if (state.totalEarned >= r.at) current = r;
    });
    return current;
  }

  function grant(amount) {
    if (amount <= 0) return;
    state.coins += amount;
    state.totalEarned += amount;
    state.runEarned += amount;
    state.dayEarned += amount;
    state.weekEarned += amount;
    if (state.eventId === 'marathon' && state.eventUntil > Date.now()) {
      state.dayEarned += amount;
      state.weekEarned += amount;
    }
  }

  function snapshot() {
    return {
      v: 2,
      coins: state.coins,
      totalEarned: state.totalEarned,
      runEarned: state.runEarned,
      upgrades: Object.assign({}, state.upgrades),
      lastSeen: Date.now(),
      boostUntil: state.boostUntil,
      muted: state.muted,
      prestigePoints: state.prestigePoints,
      prestigeCount: state.prestigeCount,
      skin: state.skin,
      unlockedSkins: Object.assign({}, state.unlockedSkins),
      streak: state.streak,
      bestStreak: state.bestStreak,
      dailyClaimedOn: state.dailyClaimedOn,
      dayKey: state.dayKey,
      dayEarned: state.dayEarned,
      dayTaps: state.dayTaps,
      dayBuys: state.dayBuys,
      dayAds: state.dayAds,
      dayMaxCombo: state.dayMaxCombo,
      questIds: state.questIds.slice(),
      claimedQuests: state.claimedQuests.slice(),
      questsDone: state.questsDone,
      weekKey: state.weekKey,
      weekEarned: state.weekEarned,
      weeklyClaimed: state.weeklyClaimed,
      eventId: state.eventId,
      eventDay: state.eventDay,
      eventUntil: state.eventUntil,
      maxCps: state.maxCps,
      adsTotal: state.adsTotal,
      oranges: state.oranges,
      ascensionCount: state.ascensionCount,
      whale: Object.assign({}, state.whale),
      achieved: Object.assign({}, state.achieved),
      accUnlocked: Object.assign({}, state.accUnlocked),
      accOn: Object.assign({}, state.accOn),
      iap: Object.assign({}, state.iap),
      lifetimeTaps: state.lifetimeTaps,
      bestCombo: state.bestCombo,
      lastMiniAt: state.lastMiniAt,
      title: state.title,
      seen: Object.assign({}, state.seen),
    };
  }

  function applyProgress(data) {
    if (!data || typeof data !== 'object') return;
    const nums = [
      'coins', 'totalEarned', 'runEarned', 'boostUntil', 'prestigePoints', 'prestigeCount',
      'streak', 'bestStreak', 'dayEarned', 'dayTaps', 'dayBuys', 'dayAds', 'dayMaxCombo',
      'questsDone', 'weekEarned', 'eventUntil', 'maxCps', 'adsTotal', 'lastSeen',
      'oranges', 'ascensionCount', 'lifetimeTaps', 'bestCombo', 'lastMiniAt',
    ];
    nums.forEach((k) => {
      if (typeof data[k] === 'number' && isFinite(data[k])) state[k] = Math.max(0, data[k]);
    });
    if (typeof data.muted === 'boolean') state.muted = data.muted;
    if (typeof data.weeklyClaimed === 'boolean') state.weeklyClaimed = data.weeklyClaimed;
    if (typeof data.skin === 'string') state.skin = data.skin;
    ['dailyClaimedOn', 'dayKey', 'weekKey', 'eventId', 'eventDay'].forEach((k) => {
      if (typeof data[k] === 'string') state[k] = data[k];
    });
    if (data.upgrades && typeof data.upgrades === 'object') {
      CFG.UPGRADES.forEach((u) => {
        const n = data.upgrades[u.id];
        state.upgrades[u.id] = typeof n === 'number' && n > 0 ? Math.floor(n) : 0;
      });
    }
    if (data.unlockedSkins && typeof data.unlockedSkins === 'object') {
      state.unlockedSkins = Object.assign({ classic: true }, data.unlockedSkins);
    }
    if (Array.isArray(data.questIds)) state.questIds = data.questIds.slice();
    if (Array.isArray(data.claimedQuests)) state.claimedQuests = data.claimedQuests.slice();
    if (typeof data.runEarned !== 'number' && typeof data.coins === 'number') {
      state.runEarned = data.coins;
    }
    if (data.whale && typeof data.whale === 'object') state.whale = Object.assign({}, data.whale);
    if (data.achieved && typeof data.achieved === 'object') state.achieved = Object.assign({}, data.achieved);
    if (data.accUnlocked && typeof data.accUnlocked === 'object') state.accUnlocked = Object.assign({}, data.accUnlocked);
    if (data.accOn && typeof data.accOn === 'object') state.accOn = Object.assign({}, data.accOn);
    if (data.iap && typeof data.iap === 'object') state.iap = Object.assign({ noAds: false, permMult: false, starter: false }, data.iap);
    if (data.seen && typeof data.seen === 'object') state.seen = Object.assign({}, state.seen, data.seen);
    if (typeof data.title === 'string') state.title = data.title;
  }

  function mergeBetter(a, b) {
    if (!a) return b;
    if (!b) return a;
    const score = (p) => (p.ascensionCount || 0) * 1e18 + (p.prestigePoints || 0) * 1e15 + (p.oranges || 0) * 1e12 + (p.totalEarned || 0);
    return score(a) >= score(b) ? a : b;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(snapshot()));
    } catch (e) { /* quota */ }
  }

  function saveAll(flush) {
    state.lastSeen = Date.now();
    saveLocal();
    const snap = snapshot();
    if (flush) SDK.flushCloud(snap);
    else SDK.saveCloud(snap);
    SDK.setNoAds(!!state.iap.noAds);
    SDK.saveStats({
      coins: Math.floor(state.coins),
      totalEarned: Math.floor(state.totalEarned),
      prestigePoints: state.prestigePoints,
      maxCps: Math.floor(state.maxCps),
      streak: state.streak,
      oranges: state.oranges,
      ascensionCount: state.ascensionCount,
    });
  }

  function calcOffline(fromTs) {
    const now = Date.now();
    const elapsed = Math.max(0, now - (fromTs || state.lastSeen || now));
    if (elapsed < CFG.OFFLINE.minMsToShow) return 0;
    const capped = Math.min(elapsed, CFG.OFFLINE.maxHours * 3600 * 1000);
    const idle = rawCps() * prestigeMult() * nftMult() * whaleIncomeMult() * iapMult();
    if (idle <= 0) return 0;
    const eff = CFG.OFFLINE.efficiency + whaleLv('nap') * whaleDef('nap').power;
    return Math.floor((idle * (capped / 1000)) * Math.min(0.95, eff));
  }

  /* ---------- prestige ---------- */

  function prestigeGain(withAd) {
    const run = state.runEarned || 0;
    if (run < CFG.PRESTIGE.minRun) return 0;
    let pts = Math.max(1, Math.floor(Math.sqrt(run / CFG.PRESTIGE.unit)));
    pts += whaleLv('tip') * whaleDef('tip').power;
    if (withAd) pts = Math.max(pts + 1, Math.floor(pts * (1 + CFG.PRESTIGE.adBonus)));
    return pts;
  }

  function canPrestige() {
    return prestigeGain(false) > 0;
  }

  function doPrestige(withAd) {
    const gain = prestigeGain(!!withAd);
    if (!gain) return;
    state.prestigePoints += gain;
    state.prestigeCount += 1;
    state.coins = 0;
    state.runEarned = 0;
    state.upgrades = defaultUpgrades();
    state.boostUntil = 0;
    state.combo = 0;
    const nest = whaleLv('nest') * whaleDef('nest').power;
    if (nest > 0) grant(nest * clickBase() * prestigeMult());
    prestigeArmed = false;
    refreshSkinUnlocks();
    checkAchievements();
    playTone(280, 0.18, 'sawtooth');
    playTone(560, 0.2, 'sine');
    SDK.vibrate(40);
    shakeStage();
    toast(t('toastPrestige') + ' ' + formatMult(prestigeMult()));
    saveAll(true);
    pushLeaderboards(true);
    renderAll();
    spawnBurst(18);
  }

  /* ---------- daily / streak ---------- */

  function pickQuests(seed) {
    const rnd = (function (str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
      return function () {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        return (h >>> 0) / 4294967296;
      };
    })(seed);
    const pool = CFG.QUEST_POOL.slice();
    const out = [];
    while (out.length < 3 && pool.length) {
      const i = Math.floor(rnd() * pool.length);
      out.push(pool.splice(i, 1)[0].id);
    }
    return out;
  }

  function rollCalendar() {
    const today = todayStr();
    if (state.weekKey !== weekKey(today)) {
      state.weekKey = weekKey(today);
      state.weekEarned = 0;
      state.weeklyClaimed = false;
    }
    if (state.dayKey !== today) {
      state.dayKey = today;
      state.dayEarned = 0;
      state.dayTaps = 0;
      state.dayBuys = 0;
      state.dayAds = 0;
      state.dayMaxCombo = 0;
      state.claimedQuests = [];
      state.questIds = pickQuests(today);
    }
    if (!state.questIds.length) state.questIds = pickQuests(today);

    if (state.eventDay !== today) {
      const ev = eventDef();
      state.eventDay = today;
      if (ev) {
        state.eventId = ev.id;
        state.eventUntil = Date.now() + ev.minutes * 60 * 1000;
      } else {
        state.eventId = null;
        state.eventUntil = 0;
      }
    }

    state.pendingRestore = false;
    if (state.dailyClaimedOn && state.dailyClaimedOn !== today) {
      const gap = daysBetween(state.dailyClaimedOn, today);
      if (gap >= 2 && state.streak > 1) state.pendingRestore = gap === 2;
      if (gap > 2) state.streak = 0;
    }
  }

  function dailyIndex() {
    const next = state.dailyClaimedOn === todayStr() ? state.streak : state.streak + 1;
    return ((Math.max(1, next) - 1) % 7);
  }

  function dailyAmount() {
    const base = CFG.DAILY.rewards[dailyIndex()];
    const gift = 1 + whaleLv('gift') * whaleDef('gift').power;
    return Math.floor(base * prestigeMult() * Math.max(1, clickBase()) * gift * rewardMult());
  }

  function dailyAlready() {
    return state.dailyClaimedOn === todayStr();
  }

  function claimDaily(mult) {
    if (dailyAlready()) return;
    const today = todayStr();
    if (state.dailyClaimedOn === shiftDate(today, -1)) state.streak += 1;
    else state.streak = 1;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    state.dailyClaimedOn = today;
    const amount = dailyAmount() * (mult || 1);
    grant(amount);
    if (state.streak % 7 === 0) {
      state.boostUntil = Date.now() + CFG.DAILY.day7BoostMs;
      unlockSkin('king');
    }
    toast(mult > 1 ? t('toastDailyX2') : t('toastDaily'));
    hideModal('daily');
    saveAll(true);
    renderAll();
  }

  function restoreStreak() {
    state.dailyClaimedOn = shiftDate(todayStr(), -1);
    state.pendingRestore = false;
    hideModal('restore');
    toast(t('toastStreakSaved'));
    saveAll(true);
    showDaily();
  }

  function skipRestore() {
    state.streak = 0;
    state.pendingRestore = false;
    hideModal('restore');
    toast(t('toastStreakLost'));
    saveAll(true);
    showDaily();
  }

  /* ---------- quests / skins ---------- */

  function questById(id) {
    return CFG.QUEST_POOL.find((q) => q.id === id) || CFG.WEEKLY;
  }

  function questTarget(q) {
    if (q.stat === 'dayEarned') return Math.floor(q.base * prestigeMult() * Math.max(8, clickBase() * 12));
    if (q.stat === 'weekEarned') return Math.floor(q.base * prestigeMult() * Math.max(12, clickBase() * 30));
    return q.base;
  }

  function questProgress(q) {
    return state[q.stat] || 0;
  }

  function claimQuest(id, weekly) {
    const q = weekly ? CFG.WEEKLY : questById(id);
    if (!q) return;
    if (weekly && state.weeklyClaimed) return;
    if (!weekly && state.claimedQuests.indexOf(id) >= 0) return;
    if (questProgress(q) < questTarget(q)) return;
    const reward = Math.max(coinBagAmount(), dailyAmount());
    grant(reward);
    if (weekly) state.weeklyClaimed = true;
    else {
      state.claimedQuests.push(id);
      state.questsDone += 1;
    }
    refreshSkinUnlocks();
    toast(t('toastQuest') + ' +' + formatNum(reward));
    saveAll(true);
    renderAll();
  }

  function skinUnlocked(id) {
    return !!(state.unlockedSkins && state.unlockedSkins[id]);
  }

  function unlockSkin(id, silent) {
    if (skinUnlocked(id)) return false;
    state.unlockedSkins[id] = true;
    if (!silent) toast(t('toastSkin') + ' — ' + t('skins.' + id + '.name'));
    return true;
  }

  function refreshSkinUnlocks() {
    CFG.SKINS.forEach((s) => {
      const u = s.unlock;
      if (u.type === 'free') unlockSkin(s.id, true);
      if (u.type === 'prestige' && state.prestigeCount >= u.n) unlockSkin(s.id);
      if (u.type === 'quests' && state.questsDone >= u.n) unlockSkin(s.id);
      if (u.type === 'streak' && state.bestStreak >= u.n) unlockSkin(s.id);
      if (u.type === 'achieve' && state.achieved[u.id]) unlockSkin(s.id);
      if (u.type === 'event' && state.eventId === u.id && state.eventUntil > Date.now()) unlockSkin(s.id);
    });
    CFG.ACCESSORIES.forEach((a) => {
      const u = a.unlock;
      let ok = false;
      if (u.type === 'prestige' && state.prestigeCount >= u.n) ok = true;
      if (u.type === 'streak' && state.bestStreak >= u.n) ok = true;
      if (u.type === 'oranges' && state.oranges >= u.n) ok = true;
      if (u.type === 'achieve' && state.achieved[u.id]) ok = true;
      if (ok) state.accUnlocked[a.id] = true;
    });
  }

  function wearSkin(id) {
    if (!skinUnlocked(id)) return;
    state.skin = id;
    applySkin();
    saveAll(false);
    renderSkins();
  }

  function applySkin() {
    const el = $('capy-hit');
    if (!el) return;
    el.setAttribute('data-skin', state.skin || 'classic');
    CFG.ACCESSORIES.forEach((a) => {
      el.setAttribute('data-acc-' + a.id, state.accOn[a.id] ? '1' : '0');
    });
  }

  /* ---------- shop / tap ---------- */

  function buyUpgrade(id) {
    const cost = upgradeCost(id);
    if (state.coins < cost) {
      toast(t('toastNeedMore'));
      pulse('hud-coins');
      return false;
    }
    state.coins -= cost;
    state.upgrades[id] = (state.upgrades[id] || 0) + 1;
    state.purchasesSinceAd += 1;
    state.dayBuys += (state.eventId === 'marathon' && state.eventUntil > Date.now()) ? 2 : 1;
    unlockFeatures();
    playTone(520, 0.07, 'square');
    saveAll(false);
    renderAll();
    spawnBurst();
    if (state.purchasesSinceAd >= CFG.INTERSTITIAL_EVERY_N_PURCHASES && SDK.canShowInterstitial()) {
      state.purchasesSinceAd = 0;
      saveAll(true);
      SDK.showFullscreenAd();
    }
    return true;
  }

  function tapAt(clientX, clientY) {
    if (state.paused || SDK.isAdOpen()) return;
    const now = Date.now();
    if (now - state.lastTap <= comboWindow()) state.combo += 1;
    else state.combo = 1;
    state.lastTap = now;
    if (state.combo > state.dayMaxCombo) state.dayMaxCombo = state.combo;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    state.dayTaps += (state.eventId === 'marathon' && state.eventUntil > Date.now()) ? 2 : 1;
    state.lifetimeTaps += 1;
    const amount = clickPower();
    grant(amount);
    const fat = comboMult() >= 2;
    const label = (comboMult() > 1 ? 'x' + comboMult() + ' ' : '') + '+' + formatNum(amount);
    spawnFloater(clientX, clientY, label, fat);
    squashCapy();
    playTap();
    SDK.vibrate(comboMult() >= 3 ? 18 : 8);
    if (comboMult() >= 2) spawnBurst(comboMult() >= 3 ? 10 : 5);
    if (state.lifetimeTaps % 40 === 0) checkAchievements();
    renderHud();
  }

  /* ---------- audio / fx ---------- */

  function ensureAudio() {
    if (state.muted) return null;
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, dur, type) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function playTap() {
    const extra = 40 * Math.min(state.combo, 20);
    playTone(340 + extra + Math.random() * 40, 0.045, 'triangle');
  }

  function setMuted(next) {
    state.muted = next;
    if (next && audioCtx && audioCtx.suspend) audioCtx.suspend();
    const btn = $('btn-sound');
    if (btn) {
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
      btn.title = next ? t('muted') : t('unmuted');
      btn.querySelector('.icon-on').hidden = next;
      btn.querySelector('.icon-off').hidden = !next;
    }
    saveLocal();
  }

  function squashCapy() {
    const el = $('capy-hit');
    if (!el) return;
    el.classList.remove('is-hit');
    void el.offsetWidth;
    el.classList.add('is-hit');
  }

  function spawnFloater(x, y, text, fat) {
    const layer = $('float-layer');
    if (!layer) return;
    const node = document.createElement('div');
    node.className = 'floater' + (fat ? ' is-fat' : '');
    node.textContent = text;
    const rect = layer.getBoundingClientRect();
    node.style.left = x - rect.left + (Math.random() * 24 - 12) + 'px';
    node.style.top = y - rect.top + (Math.random() * 10 - 16) + 'px';
    layer.appendChild(node);
    setTimeout(function () { node.remove(); }, 850);
  }

  function shakeStage() {
    const stage = $('stage');
    if (!stage) return;
    stage.classList.remove('is-shake');
    void stage.offsetWidth;
    stage.classList.add('is-shake');
    setTimeout(function () { stage.classList.remove('is-shake'); }, 480);
  }

  function spawnBurst(n) {
    const stage = $('stage');
    if (!stage) return;
    const count = n || 6;
    for (let i = 0; i < count; i += 1) {
      const p = document.createElement('span');
      p.className = 'spark';
      p.style.setProperty('--dx', (Math.random() * 140 - 70) + 'px');
      p.style.setProperty('--dy', (Math.random() * -90 - 20) + 'px');
      p.style.left = '50%';
      p.style.top = '48%';
      stage.appendChild(p);
      setTimeout(function () { p.remove(); }, 700);
    }
  }

  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2400);
  }

  function pulse(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('is-pulse');
    void el.offsetWidth;
    el.classList.add('is-pulse');
  }

  /* ---------- render ---------- */

  function skinsOwned() {
    return Object.keys(state.unlockedSkins).filter((k) => state.unlockedSkins[k]).length;
  }

  function statValue(key) {
    if (key === 'skinsOwned') return skinsOwned();
    return state[key] || 0;
  }

  function checkAchievements() {
    let changed = false;
    CFG.ACHIEVEMENTS.forEach((a) => {
      if (state.achieved[a.id]) return;
      if (statValue(a.stat) < a.at) return;
      state.achieved[a.id] = true;
      changed = true;
      if (a.reward) {
        if (a.reward.oranges) state.oranges += a.reward.oranges;
        if (a.reward.skin) unlockSkin(a.reward.skin);
        if (a.reward.acc) state.accUnlocked[a.reward.acc] = true;
        if (a.reward.title) state.title = a.reward.title;
      }
      toast(t('ach.' + a.id + '.name'));
    });
    if (changed) {
      refreshSkinUnlocks();
      saveAll(false);
    }
  }

  function canAscend() {
    return state.prestigeCount >= CFG.ASCENSION.minPrestiges && state.prestigePoints >= CFG.ASCENSION.minPoints;
  }

  function ascendGain(withAd) {
    if (!canAscend()) return 0;
    let n = Math.max(1, Math.floor(state.prestigePoints / CFG.ASCENSION.unit));
    if (withAd) n = Math.max(n + 1, Math.floor(n * (1 + CFG.ASCENSION.adBonus)));
    return n;
  }

  function doAscend(withAd) {
    const gain = ascendGain(!!withAd);
    if (!gain) return;
    state.oranges += gain;
    state.ascensionCount += 1;
    state.prestigePoints = 0;
    state.coins = 0;
    state.runEarned = 0;
    state.upgrades = defaultUpgrades();
    state.boostUntil = 0;
    state.combo = 0;
    refreshSkinUnlocks();
    checkAchievements();
    playTone(180, 0.25, 'sawtooth');
    playTone(720, 0.22, 'sine');
    SDK.vibrate(55);
    shakeStage();
    toast(t('toastAscend') + ' +' + gain);
    saveAll(true);
    pushLeaderboards(true);
    renderAll();
    spawnBurst(22);
  }

  function buyWhale(id) {
    const u = whaleDef(id);
    if (!u || whaleLv(id) >= u.max) return;
    const cost = whaleCost(id);
    if (state.oranges < cost) {
      toast(t('toastNeedMore'));
      return;
    }
    state.oranges -= cost;
    state.whale[id] = whaleLv(id) + 1;
    saveAll(true);
    renderAll();
  }

  function featureOpen(name) {
    if (name === 'daily') return state.seen.daily || state.dayBuys >= CFG.ONBOARD.dailyAfterBuys || state.dailyClaimedOn;
    if (name === 'quests') return state.seen.quests || state.dayBuys >= CFG.ONBOARD.questsAfterBuys || state.questsDone > 0;
    if (name === 'skins') return state.seen.skins || state.prestigeCount >= CFG.ONBOARD.skinsAfterPrestige || skinsOwned() > 1;
    if (name === 'album') return state.seen.album || state.questsDone >= CFG.ONBOARD.albumAfterQuests || Object.keys(state.achieved).length > 0;
    return true;
  }

  function unlockFeatures() {
    if (!state.seen.daily && featureOpen('daily')) {
      state.seen.daily = true;
      toast(t('dailyTitle'));
    }
    if (!state.seen.quests && featureOpen('quests')) {
      state.seen.quests = true;
      toast(t('questsTitle'));
    }
    if (!state.seen.skins && featureOpen('skins')) {
      state.seen.skins = true;
      toast(t('tabSkins'));
    }
    if (!state.seen.album && featureOpen('album')) {
      state.seen.album = true;
      toast(t('albumTitle'));
    }
    const dailyBtn = $('btn-daily');
    if (dailyBtn) dailyBtn.hidden = !featureOpen('daily');
    ['quests', 'skins', 'album'].forEach((id) => {
      const el = $('tab-' + id);
      if (el) el.hidden = !featureOpen(id);
    });
  }

  function grantIap(kind) {
    if (kind === 'noAds') {
      state.iap.noAds = true;
      SDK.setNoAds(true);
    } else if (kind === 'permMult') {
      state.iap.permMult = true;
    } else if (kind === 'starter') {
      state.iap.starter = true;
      grant(Math.max(coinBagAmount() * 4, CFG.STARTER_PACK_CLICKS * clickPower()));
      state.boostUntil = Date.now() + CFG.BOOST_DURATION_MS * 2;
      unlockSkin('ghost');
    }
    saveAll(true);
    renderAll();
    toast(t('iapOwned'));
  }

  function buyIap(kind) {
    const id = CFG.YANDEX.IAP[kind];
    if (!id) return;
    if (kind !== 'starter' && state.iap[kind]) return;
    SDK.purchase(id)
      .then(function (res) {
        const token = res && (res.purchaseToken || (res.purchaseData && res.purchaseData.purchaseToken));
        grantIap(kind);
        if (kind === 'starter' && token) return SDK.consumePurchase(token);
      })
      .catch(function () {
        toast(t('toastAdError'));
      });
  }

  function restoreIap() {
    SDK.getPurchases().then(function (list) {
      (list || []).forEach(function (p) {
        const id = p.productID || p.productId;
        if (id === CFG.YANDEX.IAP.noAds) grantIap('noAds');
        if (id === CFG.YANDEX.IAP.permMult) grantIap('permMult');
        if (id === CFG.YANDEX.IAP.starter && p.purchaseToken) {
          SDK.consumePurchase(p.purchaseToken).then(function () {
            if (!state.iap.starter) grantIap('starter');
          });
        }
      });
    });
  }

  let miniArmed = false;
  function miniFreeReady() {
    return Date.now() - (state.lastMiniAt || 0) >= CFG.MINIGAME.cooldownMs;
  }

  function startMini(fromAd) {
    if (!fromAd && !miniFreeReady()) return;
    miniArmed = true;
    showModal('mini');
    const marker = $('mini-marker');
    if (marker) {
      marker.classList.remove('is-run');
      void marker.offsetWidth;
      marker.classList.add('is-run');
    }
    if ($('btn-mini-throw')) $('btn-mini-throw').disabled = false;
  }

  function throwMini() {
    if (!miniArmed) return;
    miniArmed = false;
    const marker = $('mini-marker');
    const track = $('mini-track');
    if (!marker || !track) return;
    marker.classList.remove('is-run');
    const left = marker.offsetLeft;
    const width = track.clientWidth || 1;
    const pct = left / width;
    const hit = pct >= 0.40 && pct <= 0.60;
    const amount = Math.floor((hit ? coinBagAmount() * 1.4 : coinBagAmount() * 0.25) * rewardMult());
    grant(amount);
    state.lastMiniAt = Date.now();
    hideModal('mini');
    toast(hit ? t('miniHit', { n: formatNum(amount) }) : t('miniMiss', { n: formatNum(amount) }));
    if (hit) spawnBurst(12);
    saveAll(true);
    renderHud();
  }

  function renderHud() {
    if ($('hud-coins')) $('hud-coins').textContent = formatNum(state.coins);
    if ($('hud-cps')) $('hud-cps').textContent = formatNum(cps()) + ' ' + t('perSec');
    if ($('hud-tap')) $('hud-tap').textContent = formatNum(clickPower()) + ' ' + t('perTap');
    if ($('hud-rank')) {
      const title = state.title ? t('titles.' + state.title) + ' · ' : '';
      $('hud-rank').textContent = title + t('ranks.' + rank().id);
    }
    if ($('hud-mult')) $('hud-mult').textContent = formatMult(prestigeMult() * nftMult() * whaleIncomeMult() * iapMult());
    renderBoost();
    renderCombo();
    renderEvent();
    renderRebirthChip();
    if ($('bag-amount')) $('bag-amount').textContent = '+' + formatNum(coinBagAmount());
    const dot = $('daily-dot');
    if (dot) dot.hidden = dailyAlready();
    const nowCps = cps();
    if (nowCps > state.maxCps) state.maxCps = nowCps;
  }

  function renderBoost() {
    const btn = $('btn-boost');
    const label = $('boost-label');
    const hint = $('boost-hint');
    const left = state.boostUntil - Date.now();
    if (!btn) return;
    if (left > 0) {
      btn.classList.add('is-active');
      btn.disabled = true;
      if (label) label.textContent = t('boostActive') + ' ' + Math.ceil(left / 1000) + 's';
      if (hint) hint.textContent = 'x' + CFG.BOOST_MULTIPLIER;
    } else {
      btn.classList.remove('is-active');
      btn.disabled = false;
      if (label) label.textContent = t('boost');
      if (hint) hint.textContent = t('boostHint');
    }
  }

  function renderCombo() {
    const el = $('combo');
    if (!el) return;
    if (Date.now() - state.lastTap > comboWindow()) state.combo = 0;
    const m = comboMult();
    if (m > 1 && state.combo > 0) {
      el.hidden = false;
      el.textContent = 'x' + m;
    } else el.hidden = true;
  }

  function renderEvent() {
    const el = $('event-banner');
    if (!el) return;
    if (!state.eventId || state.eventUntil <= Date.now()) {
      el.hidden = true;
      return;
    }
    const left = Math.max(0, state.eventUntil - Date.now());
    const mins = Math.ceil(left / 60000);
    let text = t('eventOrange');
    if (state.eventId === 'bull') text = t('eventBull', { n: String(eventMult()) });
    if (state.eventId === 'bear') text = t('eventBear', { n: String(eventMult()) });
    if (state.eventId === 'marathon') text = t('eventMarathon');
    if (state.eventId === 'festival') text = t('skins.festival.name');
    el.hidden = false;
    el.textContent = text + ' · ' + t('eventLeft', { n: mins + 'м' });
  }

  function renderRebirthChip() {
    const el = $('btn-rebirth-chip');
    if (!el) return;
    if (!canPrestige()) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = t('prestigeReady') + ' +' + prestigeGain(false);
  }

  function incomeLabel(u) {
    if (u.kind === 'click') return '+' + u.power + ' ' + t('perTap');
    if (u.kind === 'cps') return '+' + u.power + ' ' + t('perSec');
    if (u.kind === 'pct') return '+' + Math.round(u.power * 100) + '%';
    if (u.kind === 'autotap') return '+' + u.power + ' ' + t('perTap') + '/с';
    return '';
  }

  function renderShop() {
    const list = $('shop-list');
    if (!list) return;
    let html = '';
    let lastBranch = '';
    CFG.UPGRADES.forEach((u) => {
      if (u.branch !== lastBranch) {
        lastBranch = u.branch;
        html += '<div class="branch-label">' + t('branches.' + u.branch) + '</div>';
      }
      const level = state.upgrades[u.id] || 0;
      const cost = upgradeCost(u.id);
      const can = state.coins >= cost;
      const almost = !can && state.coins >= cost * 0.72;
      const meta = window.CCT_t(state.lang, 'upgrades.' + u.id);
      html +=
        '<article class="upg' + (can ? ' is-can' : '') + (almost ? ' is-almost' : '') + '">' +
          '<div class="upg-ico" data-ico="' + u.icon + '"></div>' +
          '<div class="upg-body">' +
            '<div class="upg-top"><h3>' + meta.name + '</h3><span class="upg-lv">' + t('level') + ' ' + level + '</span></div>' +
            '<p>' + meta.desc + '</p>' +
            '<div class="upg-gain">' + incomeLabel(u) + '</div>' +
          '</div>' +
          '<div class="upg-side">' +
            '<button type="button" class="btn-buy" data-buy="' + u.id + '"' + (can ? '' : ' disabled') + '>' +
              '<span>' + (can ? t('buy') : t('notEnough')) + '</span><b>' + formatNum(cost) + '</b>' +
            '</button>' +
            (almost ? '<button type="button" class="btn-almost" data-almost="' + u.id + '">' + t('almost') + '</button>' : '') +
          '</div>' +
        '</article>';
    });
    list.innerHTML = html;
    renderPrestigeCard();
  }

  function renderPrestigeCard() {
    const el = $('prestige-card');
    if (!el) return;
    const gain = prestigeGain(false);
    const need = Math.max(0, CFG.PRESTIGE.minRun - state.runEarned);
    const body = gain
      ? t('prestigeReady') + ' · ' + t('prestigeGain', { n: formatMult(1 + gain * CFG.PRESTIGE.perPoint) })
      : t('prestigeNeed', { n: formatNum(need) });
    el.innerHTML =
      '<h3>' + t('prestigeTitle') + ' · ' + t('prestigeNow', { n: (Math.round(prestigeMult() * 100) / 100) }) + '</h3>' +
      '<p>' + t('prestigeHint') + ' ' + body + '</p>' +
      '<div class="prestige-actions">' +
        '<button type="button" class="primary" id="btn-prestige"' + (gain ? '' : ' disabled') + '>' + t('prestigeDo') + '</button>' +
        '<button type="button" class="secondary" id="btn-prestige-ad"' + (gain ? '' : ' disabled') + '>' + t('prestigeAd') + '</button>' +
      '</div>';

    const ag = ascendGain(false);
    el.innerHTML +=
      '<h3 style="margin-top:12px">' + t('ascendTitle') + ' · ' + t('oranges') + ' ' + state.oranges + '</h3>' +
      '<p>' + t('ascendHint') + ' ' +
        (ag ? t('ascendGain', { n: ag }) : t('ascendNeed', { n: CFG.ASCENSION.minPrestiges })) +
      '</p>' +
      '<div class="prestige-actions">' +
        '<button type="button" class="primary" id="btn-ascend"' + (ag ? '' : ' disabled') + '>' + t('ascendDo') + '</button>' +
        '<button type="button" class="secondary" id="btn-ascend-ad"' + (ag ? '' : ' disabled') + '>' + t('ascendAd') + '</button>' +
      '</div>';

    if (state.ascensionCount > 0 || state.oranges > 0) {
      el.innerHTML += '<h3 style="margin-top:12px">' + t('whaleTitle') + '</h3>';
      CFG.WHALE.forEach((w) => {
        const lv = whaleLv(w.id);
        const cost = whaleCost(w.id);
        const maxed = lv >= w.max;
        el.innerHTML +=
          '<article class="upg" style="margin-top:6px">' +
            '<div class="upg-body"><h3>' + t('whale.' + w.id + '.name') + '</h3>' +
            '<p>' + t('whale.' + w.id + '.desc') + ' · ' + t('level') + ' ' + lv + '</p></div>' +
            '<button type="button" class="btn-buy" data-whale="' + w.id + '"' + (maxed || state.oranges < cost ? ' disabled' : '') + '>' +
              '<span>' + (maxed ? 'MAX' : t('buy')) + '</span><b>' + (maxed ? '' : cost + ' 🍊') + '</b>' +
            '</button>' +
          '</article>';
      });
    }

    el.innerHTML += '<h3 style="margin-top:12px">' + t('iapTitle') + '</h3>';
    [
      ['noAds', 'iapNoAds'],
      ['permMult', 'iapMult'],
      ['starter', 'iapStarter'],
    ].forEach((pair) => {
      const owned = pair[0] !== 'starter' && state.iap[pair[0]];
      el.innerHTML +=
        '<article class="upg" style="margin-top:6px">' +
          '<div class="upg-body"><h3>' + t(pair[1]) + '</h3></div>' +
          '<button type="button" class="btn-buy" data-iap="' + pair[0] + '"' + (owned ? ' disabled' : '') + '>' +
            '<span>' + (owned ? t('iapOwned') : t('iapBuy')) + '</span>' +
          '</button>' +
        '</article>';
    });
  }

  function renderQuests() {
    const list = $('quest-list');
    if (!list) return;
    const cards = state.questIds.map((id) => questCard(questById(id), false)).join('');
    const week = questCard(CFG.WEEKLY, true);
    list.innerHTML = cards + '<div class="branch-label">' + t('weekly') + '</div>' + week;
  }

  function questCard(q, weekly) {
    if (!q) return '';
    const target = questTarget(q);
    const prog = Math.min(questProgress(q), target);
    const pct = Math.min(100, Math.floor((prog / target) * 100));
    const done = weekly ? state.weeklyClaimed : state.claimedQuests.indexOf(q.id) >= 0;
    const ready = !done && prog >= target;
    const title = t('q' + q.id, { n: formatNum(target) });
    return (
      '<article class="quest-card">' +
        '<div class="upg-ico" data-ico="tap"></div>' +
        '<div class="upg-body">' +
          '<h3>' + title + '</h3>' +
          '<p>' + formatNum(prog) + ' / ' + formatNum(target) + '</p>' +
          '<div class="quest-bar"><i style="width:' + pct + '%"></i></div>' +
        '</div>' +
        '<button type="button" class="btn-buy" data-q="' + q.id + '"' + (weekly ? ' data-weekly="1"' : '') + (ready ? '' : ' disabled') + '>' +
          '<span>' + (done ? t('questDone') : t('questClaim')) + '</span>' +
        '</button>' +
      '</article>'
    );
  }

  function renderSkins() {
    const list = $('skin-list');
    if (!list) return;
    list.innerHTML = CFG.SKINS.map((s) => {
      const open = skinUnlocked(s.id);
      const on = state.skin === s.id;
      const ad = s.unlock.type === 'ad' && !open;
      let action;
      if (on) action = '<button type="button" class="btn-buy" disabled><span>' + t('wearing') + '</span></button>';
      else if (open) action = '<button type="button" class="btn-buy" data-wear="' + s.id + '"><span>' + t('wear') + '</span></button>';
      else if (ad) action = '<button type="button" class="btn-almost" data-skin-ad="' + s.id + '">' + t('unlockAd') + '</button>';
      else action = '<button type="button" class="btn-buy" disabled><span>' + t('locked') + '</span></button>';
      return (
        '<article class="skin-card">' +
          '<div class="skin-swatch" data-skin="' + s.id + '"></div>' +
          '<div class="upg-body"><h3>' + t('skins.' + s.id + '.name') + '</h3><p>' + t('skins.' + s.id + '.desc') + '</p></div>' +
          action +
        '</article>'
      );
    }).join('');
    list.innerHTML += '<div class="branch-label">' + t('tabSkins') + '</div>';
    list.innerHTML += CFG.ACCESSORIES.map((a) => {
      const open = !!state.accUnlocked[a.id];
      const on = !!state.accOn[a.id];
      const btn = open
        ? '<button type="button" class="btn-buy" data-acc="' + a.id + '"><span>' + (on ? t('hideAcc') : t('wearAcc')) + '</span></button>'
        : '<button type="button" class="btn-buy" disabled><span>' + t('locked') + '</span></button>';
      return (
        '<article class="skin-card">' +
          '<div class="upg-ico" data-ico="tap"></div>' +
          '<div class="upg-body"><h3>' + t('acc.' + a.id + '.name') + '</h3><p>' + t('acc.' + a.id + '.desc') + '</p></div>' +
          btn +
        '</article>'
      );
    }).join('');
  }

  function renderAlbum() {
    const list = $('album-list');
    if (!list) return;
    const done = CFG.ACHIEVEMENTS.filter((a) => state.achieved[a.id]).length;
    list.innerHTML = '<div class="branch-label">' + t('albumTitle') + ' ' + done + '/' + CFG.ACHIEVEMENTS.length + '</div>' +
      CFG.ACHIEVEMENTS.map((a) => {
        const got = !!state.achieved[a.id];
        const prog = Math.min(statValue(a.stat), a.at);
        const pct = Math.min(100, Math.floor((prog / a.at) * 100));
        return (
          '<article class="quest-card' + (got ? ' is-can' : '') + '">' +
            '<div class="upg-ico" data-ico="nft"></div>' +
            '<div class="upg-body">' +
              '<h3>' + t('ach.' + a.id + '.name') + '</h3>' +
              '<p>' + t('ach.' + a.id + '.desc') + ' · ' + formatNum(prog) + '/' + formatNum(a.at) + '</p>' +
              '<div class="quest-bar"><i style="width:' + pct + '%"></i></div>' +
            '</div>' +
          '</article>'
        );
      }).join('');
  }

  function renderLb(board) {
    const panel = $('lb-panel');
    if (!panel) return;
    board = board || 'earned';
    const names = { earned: CFG.YANDEX.LB_EARNED, cps: CFG.YANDEX.LB_CPS, prestige: CFG.YANDEX.LB_PRESTIGE };
    const tech = names[board];
    let html = '<div class="lb-switch">' +
      '<button type="button" class="tab' + (board === 'earned' ? ' is-on' : '') + '" data-lb="earned">' + t('lbEarned') + '</button>' +
      '<button type="button" class="tab' + (board === 'cps' ? ' is-on' : '') + '" data-lb="cps">' + t('lbCps') + '</button>' +
      '<button type="button" class="tab' + (board === 'prestige' ? ' is-on' : '') + '" data-lb="prestige">' + t('lbPrestige') + '</button>' +
      '</div>';

    if (!SDK.isAuthorized()) {
      html += '<div class="guest-box"><p>' + t('lbGuest') + '</p>' +
        '<button type="button" class="primary" id="btn-login">' + t('lbLogin') + '</button></div>';
    }

    const paint = function (data) {
      const entries = (data && data.entries) || [];
      if (!entries.length) {
        panel.innerHTML = html + '<p class="guest-box">' + t('lbEmpty') + '</p>';
        return;
      }
      const rows = entries.map((e, i) => {
        const name = (e.player && e.player.publicName) || t('lbYou');
        const me = e.rank && data.userRank === e.rank;
        let photo = '';
        try {
          photo = e.player && e.player.getAvatarSrc ? e.player.getAvatarSrc('small') : '';
        } catch (err) { photo = ''; }
        return (
          '<article class="lb-row' + (me ? ' is-can' : '') + '">' +
            (photo ? '<img class="lb-avatar" src="' + photo + '" alt="">' : '<div class="lb-avatar"></div>') +
            '<div class="upg-body"><h3>' + (e.rank || i + 1) + '. ' + name + '</h3><p>' + formatNum(e.score) + '</p></div>' +
          '</article>'
        );
      }).join('');
      panel.innerHTML = html + rows;
    };

    if (lbCache.name === tech && Date.now() - lbCache.at < 15000 && lbCache.data) {
      paint(lbCache.data);
      return;
    }
    panel.innerHTML = html + '<p class="guest-box">…</p>';
    SDK.getEntries(tech).then(function (data) {
      lbCache = { name: tech, at: Date.now(), data: data };
      if (state.tab === 'lb') paint(data);
    });
  }

  function setTab(name) {
    state.tab = name;
    document.querySelectorAll('#hub-tabs .tab').forEach((btn) => {
      btn.classList.toggle('is-on', btn.getAttribute('data-tab') === name);
    });
    const map = { shop: 'shop-list', quests: 'quest-list', skins: 'skin-list', album: 'album-list', lb: 'lb-panel' };
    Object.keys(map).forEach((k) => {
      const el = $(map[k]);
      if (el) el.hidden = k !== name;
    });
    if (name === 'shop') renderShop();
    if (name === 'quests') renderQuests();
    if (name === 'skins') renderSkins();
    if (name === 'album') renderAlbum();
    if (name === 'lb') renderLb('earned');
  }

  function renderDailyModal() {
    const idx = dailyIndex();
    const row = $('daily-days');
    if (row) {
      row.innerHTML = CFG.DAILY.rewards.map((_, i) => {
        const cls = i < idx ? ' is-done' : i === idx ? ' is-now' : '';
        return '<div class="day-cell' + cls + '">' + (i + 1) + '</div>';
      }).join('');
    }
    if ($('daily-amount')) $('daily-amount').textContent = '+' + formatNum(dailyAmount());
    if ($('daily-streak-label')) $('daily-streak-label').textContent = t('dailyStreak', { n: state.streak || 0 });
    const claimed = dailyAlready();
    if ($('btn-daily-claim')) $('btn-daily-claim').disabled = claimed;
    if ($('btn-daily-x2')) $('btn-daily-x2').disabled = claimed;
    if (claimed && $('daily-amount')) $('daily-amount').textContent = t('dailyDone');
  }

  function applyStaticText() {
    document.documentElement.lang = state.lang;
    document.title = t('title');
    const map = {
      'txt-title': 'title',
      'txt-tag': 'tagline',
      'txt-shop': 'shop',
      'txt-shop-title': 'shopTitle',
      'txt-bag': 'bag',
      'txt-bag-hint': 'bagHint',
      'txt-offline-title': 'offlineTitle',
      'txt-offline-sub': 'offlineSub',
      'txt-claim': 'claim',
      'txt-claim-x2': 'claimX2',
      'txt-how-title': 'how',
      'txt-how-body': 'howBody',
      'txt-gotit': 'gotIt',
      'txt-pause': 'pause',
      'txt-loading': 'loading',
      'tab-shop': 'tabShop',
      'tab-quests': 'tabQuests',
      'tab-skins': 'tabSkins',
      'tab-album': 'tabAlbum',
      'tab-lb': 'tabTop',
      'txt-mini-title': 'miniTitle',
      'txt-mini-hint': 'miniHint',
      'btn-mini-throw': 'miniGo',
      'btn-mini-ad': 'miniAd',
      'txt-daily-title': 'dailyTitle',
      'txt-daily-sub': 'dailySub',
      'btn-daily-claim': 'dailyClaim',
      'btn-daily-x2': 'dailyClaimX2',
      'txt-restore-title': 'toastStreakLost',
      'txt-restore-sub': 'dailyRestore',
      'btn-restore': 'restore',
      'btn-restore-skip': 'skipRestore',
    };
    Object.keys(map).forEach((id) => {
      const el = $(id);
      if (el) el.textContent = t(map[id]);
    });
    $('btn-sound') && setMuted(state.muted);
  }

  function renderAll() {
    renderHud();
    if (state.tab === 'shop') renderShop();
    else if (state.tab === 'quests') renderQuests();
    else if (state.tab === 'skins') renderSkins();
    else if (state.tab === 'album') renderAlbum();
    else renderPrestigeCard();
    applySkin();
    refreshSkinUnlocks();
    unlockFeatures();
    checkAchievements();
  }

  /* ---------- panels / ads ---------- */

  function setShop(open) {
    state.shopOpen = open;
    const sheet = $('shop');
    const dim = $('shop-dim');
    if (sheet) sheet.classList.toggle('is-open', open);
    if (dim) dim.classList.toggle('is-on', open);
    document.body.classList.toggle('shop-open', open);
    if (open) renderAll();
    else if (!window.matchMedia('(min-width: 900px)').matches && SDK.canShowInterstitial()) {
      saveAll(true);
      SDK.showFullscreenAd();
    }
  }

  function showModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add('is-on');
    SDK.gameplayStop();
  }

  function hideModal(id) {
    const el = $(id);
    if (el) el.classList.remove('is-on');
    if (!$('offline').classList.contains('is-on') && !$('howto').classList.contains('is-on') &&
        !$('daily').classList.contains('is-on') && !$('restore').classList.contains('is-on') &&
        !($('mini') && $('mini').classList.contains('is-on'))) {
      SDK.gameplayStart();
    }
  }

  function showDaily() {
    if (dailyAlready()) return false;
    renderDailyModal();
    showModal('daily');
    return true;
  }

  function setPaused(paused, reason) {
    state.paused = paused;
    const overlay = $('pause-overlay');
    if (overlay && reason === 'platform') overlay.classList.toggle('is-on', paused);
    if (paused) {
      state.combo = 0;
      SDK.gameplayStop();
      if (audioCtx && audioCtx.suspend) audioCtx.suspend();
    } else {
      lastTick = performance.now();
      SDK.gameplayStart();
    }
  }

  function showOffline(amount) {
    state.pendingOffline = amount;
    $('offline-amount').textContent = '+' + formatNum(amount);
    showModal('offline');
  }

  function collectOffline(mult) {
    const amount = Math.floor(state.pendingOffline * (mult || 1));
    if (amount > 0) grant(amount);
    state.pendingOffline = 0;
    hideModal('offline');
    saveAll(true);
    renderAll();
    toast(mult > 1 ? t('toastOfflineX2') : t('toastOffline'));
    if (mult === 1 && SDK.canShowInterstitial()) SDK.showFullscreenAd();
    afterGate();
  }

  function afterGate() {
    if (state.pendingRestore) {
      showModal('restore');
      return;
    }
    if (!dailyAlready()) {
      showDaily();
      return;
    }
    SDK.gameplayStart();
  }

  function noteAd() {
    state.dayAds += 1;
    state.adsTotal += 1;
  }

  function applyReward(type) {
    noteAd();
    if (type === 'boost') {
      state.boostUntil = Date.now() + CFG.BOOST_DURATION_MS;
      toast(t('toastBoost'));
    } else if (type === 'bag') {
      const amount = coinBagAmount();
      grant(amount);
      toast(t('toastBag') + ' +' + formatNum(amount));
    } else if (type === 'offline_x2') {
      collectOffline(2);
      return;
    } else if (type === 'daily_x2') {
      claimDaily(2);
      return;
    } else if (type === 'prestige_ad') {
      doPrestige(true);
      return;
    } else if (type === 'ascend_ad') {
      doAscend(true);
      return;
    } else if (type === 'mini_ad') {
      startMini(true);
      return;
    } else if (type === 'skin_ghost') {
      unlockSkin('ghost');
      wearSkin('ghost');
    } else if (type === 'streak_restore') {
      restoreStreak();
      return;
    }
    playTone(700, 0.1, 'sine');
    saveAll(true);
    renderAll();
  }

  function requestReward(type) {
    if (type === 'boost' && state.boostUntil > Date.now()) return;
    SDK.showRewardedAd(type, {
      onRewarded: applyReward,
      onSkipped: function () { toast(t('toastAdSkip')); },
      onError: function () { toast(t('toastAdError')); },
    });
  }

  function almostFinish(id) {
    const cost = upgradeCost(id);
    const need = Math.max(0, cost - state.coins);
    if (need <= 0) {
      buyUpgrade(id);
      return;
    }
    SDK.showRewardedAd('bag', {
      onRewarded: function () {
        noteAd();
        const amount = Math.max(coinBagAmount(), need);
        grant(amount);
        toast(t('toastBag') + ' +' + formatNum(amount));
        if (state.coins >= upgradeCost(id)) buyUpgrade(id);
        else renderAll();
        saveAll(true);
      },
      onSkipped: function () { toast(t('toastAdSkip')); },
      onError: function () { toast(t('toastAdError')); },
    });
  }

  function pushLeaderboards(force) {
    const now = Date.now();
    if (!force && now - lastLb < CFG.LB_PUSH_MS) return;
    lastLb = now;
    SDK.setScore(CFG.YANDEX.LB_EARNED, state.totalEarned);
    setTimeout(function () { SDK.setScore(CFG.YANDEX.LB_CPS, state.maxCps); }, 1200);
    setTimeout(function () { SDK.setScore(CFG.YANDEX.LB_PRESTIGE, state.prestigeCount); }, 2400);
  }

  /* ---------- loop ---------- */

  function tick(now) {
    requestAnimationFrame(tick);
    if (!lastTick) lastTick = now;
    const dt = Math.min(0.25, (now - lastTick) / 1000);
    lastTick = now;

    if (!state.paused && !SDK.isAdOpen() && !state.pendingOffline) {
      const gain = cps() * dt;
      if (gain > 0) grant(gain);
    }

    if (now - lastSave > CFG.AUTOSAVE_MS) {
      lastSave = now;
      saveAll(false);
      pushLeaderboards(false);
    }
    renderHud();
  }

  function onHidden() {
    saveAll(true);
    pushLeaderboards(true);
    setPaused(true, 'platform');
  }

  function onVisible() {
    const extra = calcOffline(state.lastSeen);
    setPaused(false, 'platform');
    lastTick = performance.now();
    rollCalendar();
    if (extra > 0 && !state.pendingOffline) showOffline(extra);
  }

  function bind() {
    const capy = $('capy-hit');
    capy.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { capy.setPointerCapture(e.pointerId); } catch (err) { /* old webviews */ }
      tapAt(e.clientX, e.clientY);
    });

    $('btn-shop').addEventListener('click', function () { setShop(true); });
    $('shop-dim').addEventListener('click', function () { setShop(false); });
    $('btn-shop-close').addEventListener('click', function () { setShop(false); });
    $('btn-boost').addEventListener('click', function () { requestReward('boost'); });
    $('btn-bag').addEventListener('click', function () { requestReward('bag'); });
    $('btn-claim').addEventListener('click', function () { collectOffline(1); });
    $('btn-claim-x2').addEventListener('click', function () { requestReward('offline_x2'); });
    $('btn-sound').addEventListener('click', function () { setMuted(!state.muted); });
    $('btn-how').addEventListener('click', function () { showModal('howto'); });
    $('btn-gotit').addEventListener('click', function () {
      hideModal('howto');
      seenHowTo = true;
      try { localStorage.setItem(CFG.SAVE_KEY + '_how', '1'); } catch (e) { /* ignore */ }
      afterGate();
    });
    $('btn-daily').addEventListener('click', function () {
      renderDailyModal();
      showModal('daily');
    });
    $('btn-daily-claim').addEventListener('click', function () { claimDaily(1); });
    $('btn-daily-x2').addEventListener('click', function () { requestReward('daily_x2'); });
    $('btn-restore').addEventListener('click', function () { requestReward('streak_restore'); });
    $('btn-restore-skip').addEventListener('click', function () { skipRestore(); });
    $('btn-mini').addEventListener('click', function () {
      if (miniFreeReady()) startMini(false);
      else requestReward('mini_ad');
    });
    $('btn-mini-throw').addEventListener('click', function () { throwMini(); });
    $('btn-mini-ad').addEventListener('click', function () { requestReward('mini_ad'); });

    $('btn-rebirth-chip').addEventListener('click', function () {
      setShop(true);
      setTab('shop');
      const card = $('prestige-card');
      if (card) card.scrollIntoView({ block: 'nearest' });
    });

    ['daily', 'restore', 'howto', 'mini'].forEach(function (id) {
      const el = $(id);
      if (!el) return;
      el.addEventListener('click', function (e) {
        if (e.target.id === id) hideModal(id);
      });
    });

    $('hub-tabs').addEventListener('click', function (e) {
      const tab = e.target.closest('[data-tab]');
      if (tab) setTab(tab.getAttribute('data-tab'));
    });

    $('shop').addEventListener('click', function (e) {
      const buy = e.target.closest('[data-buy]');
      if (buy) { buyUpgrade(buy.getAttribute('data-buy')); return; }
      const almost = e.target.closest('[data-almost]');
      if (almost) { almostFinish(almost.getAttribute('data-almost')); return; }
      const q = e.target.closest('[data-q]');
      if (q) { claimQuest(q.getAttribute('data-q'), q.hasAttribute('data-weekly')); return; }
      const wear = e.target.closest('[data-wear]');
      if (wear) { wearSkin(wear.getAttribute('data-wear')); return; }
      const skinAd = e.target.closest('[data-skin-ad]');
      if (skinAd) { requestReward('skin_ghost'); return; }
      const acc = e.target.closest('[data-acc]');
      if (acc) {
        const id = acc.getAttribute('data-acc');
        if (state.accUnlocked[id]) {
          state.accOn[id] = !state.accOn[id];
          applySkin();
          saveAll(false);
          renderSkins();
        }
        return;
      }
      const whale = e.target.closest('[data-whale]');
      if (whale) { buyWhale(whale.getAttribute('data-whale')); return; }
      const iap = e.target.closest('[data-iap]');
      if (iap) { buyIap(iap.getAttribute('data-iap')); return; }
      const lb = e.target.closest('[data-lb]');
      if (lb) { renderLb(lb.getAttribute('data-lb')); return; }
      if (e.target.id === 'btn-prestige') {
        if (!canPrestige()) return;
        if (!prestigeArmed) {
          prestigeArmed = true;
          e.target.textContent = t('prestigeConfirm').slice(0, 18) + '…';
          setTimeout(function () {
            prestigeArmed = false;
            renderPrestigeCard();
          }, 2500);
          return;
        }
        doPrestige(false);
        return;
      }
      if (e.target.id === 'btn-prestige-ad') requestReward('prestige_ad');
      if (e.target.id === 'btn-ascend') {
        if (!canAscend()) return;
        if (!e.target.dataset.arm) {
          e.target.dataset.arm = '1';
          e.target.textContent = t('ascendConfirm').slice(0, 18) + '…';
          setTimeout(function () { renderPrestigeCard(); }, 2500);
          return;
        }
        doAscend(false);
        return;
      }
      if (e.target.id === 'btn-ascend-ad') requestReward('ascend_ad');
      if (e.target.id === 'btn-login') {
        SDK.openAuth()
          .then(function () {
            toast(t('toastSaved'));
            renderLb('earned');
            saveAll(true);
          })
          .catch(function () { toast(t('toastAdError')); });
      }
    });

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) onHidden();
      else onVisible();
    });
    window.addEventListener('pagehide', function () { saveAll(true); });
    window.addEventListener('beforeunload', function () { saveAll(true); });
    SDK.on('pause', function () { setPaused(true, 'platform'); });
    SDK.on('resume', function () { onVisible(); });
  }

  function boot() {
    Object.assign(state, { upgrades: defaultUpgrades(), unlockedSkins: { classic: true } });

    SDK.init().then(function () {
      state.lang = SDK.getLang();
      applyStaticText();

      const local = loadLocal();
      return SDK.loadCloud().then(function (cloud) {
        const best = mergeBetter(local, cloud);
        if (best) applyProgress(best);
        rollCalendar();
        refreshSkinUnlocks();
        applySkin();
        SDK.setNoAds(!!state.iap.noAds);
        restoreIap();
        unlockFeatures();
        checkAchievements();

        const offline = calcOffline(best && best.lastSeen);
        saveLocal();

        $('boot').classList.add('is-gone');
        $('app').hidden = false;

        SDK.markReady();
        bind();
        setTab('shop');
        renderAll();

        try { seenHowTo = localStorage.getItem(CFG.SAVE_KEY + '_how') === '1'; } catch (e) { seenHowTo = false; }

        lastTick = performance.now();
        requestAnimationFrame(tick);
        pushLeaderboards(true);

        if (offline > 0) showOffline(offline);
        else if (!seenHowTo) showModal('howto');
        else afterGate();
      });
    });
  }

  window.CCT_boot = boot;
})();
