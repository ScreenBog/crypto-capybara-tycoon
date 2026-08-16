/**
 * Обёртка над Yandex Games SDK.
 * Локально (без /sdk.js) работает в mock-режиме — можно кликать и смотреть баланс.
 *
 * Официальное подключение для архива в Консоль: <script src="/sdk.js"></script>
 * Старый URL app-api/app.js модерация больше не принимает.
 */
window.CCT_SDK = (function () {
  const CFG = () => window.CCT_CONFIG;
  let ysdk = null;
  let player = null;
  let ready = false;
  let mocked = false;
  let gameplayOn = false;
  let adOpen = false;
  let lastInterstitialAt = 0;
  let sessionStartedAt = Date.now();
  const listeners = { pause: [], resume: [] };

  function on(event, fn) {
    if (listeners[event]) listeners[event].push(fn);
  }

  function emit(event) {
    (listeners[event] || []).forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('[YG]', e);
      }
    });
  }

  function isMock() {
    return mocked;
  }

  function getLang() {
    const fromSdk = ysdk && ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang;
    const raw = (fromSdk || navigator.language || 'ru').toLowerCase();
    if (raw.startsWith('ru') || raw.startsWith('be') || raw.startsWith('uk') || raw.startsWith('kk') || raw.startsWith('uz')) {
      return 'ru';
    }
    return 'en';
  }

  function createMock() {
    mocked = true;
    console.info('[YG] SDK не найден — локальный режим. Реклама имитируется.');
    return {
      environment: { i18n: { lang: (navigator.language || 'ru').slice(0, 2) } },
      features: {
        LoadingAPI: { ready: function () {} },
        GameplayAPI: { start: function () {}, stop: function () {} },
      },
      adv: {
        showFullscreenAdv: function (opts) {
          const cb = (opts && opts.callbacks) || {};
          console.info('[YG mock] fullscreen');
          if (cb.onOpen) cb.onOpen();
          setTimeout(() => cb.onClose && cb.onClose(true), 200);
        },
        showRewardedVideo: function (opts) {
          const cb = (opts && opts.callbacks) || {};
          console.info('[YG mock] rewarded — награда выдаётся сразу');
          if (cb.onOpen) cb.onOpen();
          if (cb.onRewarded) cb.onRewarded();
          setTimeout(() => cb.onClose && cb.onClose(true), 200);
        },
      },
      getPlayer: function () {
        return Promise.resolve({
          isAuthorized: function () {
            return false;
          },
          getData: function () {
            return Promise.resolve({});
          },
          setData: function () {
            return Promise.resolve();
          },
          setStats: function () {
            return Promise.resolve();
          },
        });
      },
      auth: {
        openAuthDialog: function () {
          return Promise.reject(new Error('mock'));
        },
      },
      leaderboards: {
        setScore: function () {
          return Promise.resolve();
        },
        getEntries: function () {
          return Promise.resolve({ entries: [], userRank: 0 });
        },
        getPlayerEntry: function () {
          return Promise.reject({ code: 'LEADERBOARD_PLAYER_NOT_PRESENT' });
        },
      },
      getPayments: function () {
        return Promise.resolve({
          getCatalog: function () {
            return Promise.resolve([]);
          },
          getPurchases: function () {
            return Promise.resolve([]);
          },
          purchase: function (opts) {
            return Promise.resolve({ productID: opts.id, purchaseToken: 'mock-' + opts.id });
          },
          consumePurchase: function () {
            return Promise.resolve();
          },
        });
      },
      isAvailableMethod: function () {
        return Promise.resolve(false);
      },
      on: function () {},
      off: function () {},
    };
  }

  function init() {
    const real = (typeof YaGames !== 'undefined' && YaGames.init)
      ? YaGames.init()
      : Promise.resolve(null);

    return real
      .then((sdk) => {
        ysdk = sdk || createMock();
        ready = true;
        sessionStartedAt = Date.now();
        lastInterstitialAt = 0;

        try {
          if (ysdk.on) {
            ysdk.on('game_api_pause', function () {
              emit('pause');
            });
            ysdk.on('game_api_resume', function () {
              emit('resume');
            });
          }
        } catch (e) {
          /* optional API */
        }

        return ysdk.getPlayer()
          .then((p) => {
            player = p;
            return initPayments().then(function () {
              return ysdk;
            });
          })
          .catch(() => ysdk);
      })
      .catch((err) => {
        console.warn('[YG] init failed', err);
        ysdk = createMock();
        ready = true;
        return ysdk;
      });
  }

  function markReady() {
    try {
      ysdk && ysdk.features && ysdk.features.LoadingAPI && ysdk.features.LoadingAPI.ready();
    } catch (e) {
      /* ignore */
    }
  }

  function gameplayStart() {
    if (gameplayOn || adOpen) return;
    gameplayOn = true;
    try {
      ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.start();
    } catch (e) {
      /* ignore */
    }
  }

  function gameplayStop() {
    if (!gameplayOn) return;
    gameplayOn = false;
    try {
      ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.stop();
    } catch (e) {
      /* ignore */
    }
  }

  function canShowInterstitial() {
    const cfg = CFG();
    const now = Date.now();
    if (noAds) return false;
    if (adOpen) return false;
    if (now - sessionStartedAt < cfg.INTERSTITIAL_FIRST_DELAY_MS) return false;
    if (lastInterstitialAt && now - lastInterstitialAt < cfg.INTERSTITIAL_COOLDOWN_MS) return false;
    return true;
  }

  /**
   * Полноэкранная реклама. Вызывать только из логической паузы
   * (закрыли магазин, забрали оффлайн, купили апгрейд).
   */
  function showFullscreenAd(hooks) {
    hooks = hooks || {};
    if (!ysdk || !canShowInterstitial()) {
      if (hooks.onSkip) hooks.onSkip();
      return;
    }

    adOpen = true;
    gameplayStop();
    if (hooks.onBefore) hooks.onBefore();

    try {
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: function () {
            lastInterstitialAt = Date.now();
            if (hooks.onOpen) hooks.onOpen();
          },
          onClose: function (wasShown) {
            adOpen = false;
            if (wasShown) lastInterstitialAt = Date.now();
            if (hooks.onClose) hooks.onClose(wasShown);
            gameplayStart();
          },
          onError: function (error) {
            adOpen = false;
            console.warn('[YG] fullscreen error', error);
            if (hooks.onError) hooks.onError(error);
            gameplayStart();
          },
        },
      });
    } catch (e) {
      adOpen = false;
      if (hooks.onError) hooks.onError(e);
      gameplayStart();
    }
  }

  /**
   * Rewarded video. Награда ТОЛЬКО в onRewarded — не в onClose.
   * rewardType: 'boost' | 'bag' | 'offline_x2'
   */
  function showRewardedAd(rewardType, hooks) {
    hooks = hooks || {};
    if (!ysdk || adOpen) {
      if (hooks.onError) hooks.onError(new Error('busy'));
      return;
    }

    let rewarded = false;
    adOpen = true;
    gameplayStop();
    if (hooks.onBefore) hooks.onBefore();

    try {
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: function () {
            if (hooks.onOpen) hooks.onOpen();
          },
          onRewarded: function () {
            rewarded = true;
            if (hooks.onRewarded) hooks.onRewarded(rewardType);
          },
          onClose: function (wasShown) {
            adOpen = false;
            if (!rewarded && hooks.onSkipped) hooks.onSkipped(wasShown);
            if (hooks.onClose) hooks.onClose(wasShown, rewarded);
            gameplayStart();
          },
          onError: function (error) {
            adOpen = false;
            console.warn('[YG] rewarded error', error);
            if (hooks.onError) hooks.onError(error);
            gameplayStart();
          },
        },
      });
    } catch (e) {
      adOpen = false;
      if (hooks.onError) hooks.onError(e);
      gameplayStart();
    }
  }

  function loadCloud() {
    if (!player || !player.getData) return Promise.resolve(null);
    return player.getData(['progress']).then((data) => (data && data.progress) || null).catch(() => null);
  }

  function saveCloud(progress) {
    if (!player || !player.setData) return Promise.resolve();
    return player.setData({ progress: progress }, false).catch((e) => {
      console.warn('[YG] cloud save failed', e);
    });
  }

  function flushCloud(progress) {
    if (!player || !player.setData) return Promise.resolve();
    return player.setData({ progress: progress }, true).catch(() => {});
  }

  function saveStats(stats) {
    if (!player || !player.setStats) return Promise.resolve();
    return player.setStats(stats).catch(() => {});
  }

  function isAuthorized() {
    try {
      return !!(player && player.isAuthorized && player.isAuthorized());
    } catch (e) {
      return false;
    }
  }

  function openAuth() {
    if (!ysdk || !ysdk.auth || !ysdk.auth.openAuthDialog) {
      return Promise.reject(new Error('no-auth'));
    }
    return ysdk.auth.openAuthDialog().then(function () {
      return ysdk.getPlayer().then(function (p) {
        player = p;
        return p;
      });
    });
  }

  let payments = null;
  let noAds = false;

  function setNoAds(v) {
    noAds = !!v;
  }

  function initPayments() {
    if (!ysdk || !ysdk.getPayments) return Promise.resolve(null);
    return ysdk
      .getPayments({ signed: false })
      .then(function (p) {
        payments = p;
        return p;
      })
      .catch(function (e) {
        console.warn('[YG] payments unavailable', e);
        return null;
      });
  }

  function getCatalog() {
    if (!payments || !payments.getCatalog) return Promise.resolve([]);
    return payments.getCatalog().catch(function () {
      return [];
    });
  }

  function getPurchases() {
    if (!payments || !payments.getPurchases) return Promise.resolve([]);
    return payments.getPurchases().catch(function () {
      return [];
    });
  }

  function purchase(id) {
    if (!payments || !payments.purchase) {
      return Promise.resolve({ productID: id, purchaseToken: 'mock-' + id, mock: true });
    }
    return payments.purchase({ id: id });
  }

  function consumePurchase(token) {
    if (!token || String(token).indexOf('mock') === 0) return Promise.resolve();
    if (!payments || !payments.consumePurchase) return Promise.resolve();
    return payments.consumePurchase(token);
  }

  function vibrate(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms || 10);
    } catch (e) { /* ignore */ }
  }

  let lastScoreAt = 0;
  function setScore(name, score, extra) {
    if (!ysdk || !ysdk.leaderboards || !ysdk.leaderboards.setScore) return Promise.resolve();
    if (!isAuthorized()) return Promise.resolve();
    const now = Date.now();
    if (now - lastScoreAt < 1100) return Promise.resolve();
    lastScoreAt = now;
    const value = Math.max(0, Math.floor(Number(score) || 0));
    const check = ysdk.isAvailableMethod
      ? ysdk.isAvailableMethod('leaderboards.setScore')
      : Promise.resolve(true);
    return check
      .then(function (ok) {
        if (!ok) return;
        return ysdk.leaderboards.setScore(name, value, extra);
      })
      .catch(function (e) {
        console.warn('[YG] setScore', name, e);
      });
  }

  function getEntries(name) {
    if (!ysdk || !ysdk.leaderboards || !ysdk.leaderboards.getEntries) {
      return Promise.resolve({ entries: [], userRank: 0 });
    }
    return ysdk.leaderboards
      .getEntries(name, { quantityTop: 10, includeUser: isAuthorized(), quantityAround: 2 })
      .catch(function (e) {
        console.warn('[YG] getEntries', name, e);
        return { entries: [], userRank: 0, error: e };
      });
  }

  return {
    init: init,
    markReady: markReady,
    gameplayStart: gameplayStart,
    gameplayStop: gameplayStop,
    showFullscreenAd: showFullscreenAd,
    showRewardedAd: showRewardedAd,
    canShowInterstitial: canShowInterstitial,
    loadCloud: loadCloud,
    saveCloud: saveCloud,
    flushCloud: flushCloud,
    saveStats: saveStats,
    setScore: setScore,
    getEntries: getEntries,
    isAuthorized: isAuthorized,
    openAuth: openAuth,
    initPayments: initPayments,
    getCatalog: getCatalog,
    getPurchases: getPurchases,
    purchase: purchase,
    consumePurchase: consumePurchase,
    setNoAds: setNoAds,
    vibrate: vibrate,
    getLang: getLang,
    isMock: isMock,
    on: on,
    isAdOpen: function () {
      return adOpen;
    },
  };
})();
