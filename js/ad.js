/**
 * 广告封装：激励视频 + 插屏（无 Banner）
 * 空广告位 ID → mode:'none'，调用方走免费次数/toast 降级
 */
(function () {
  'use strict';

  var AD = {
    mode: 'none',
    interstitialReady: false
  };

  var rewardAd = null;
  var interstitialAd = null;
  var pendingDone = null;
  var pendingCancel = null;
  var lastInterstitialAt = 0;
  var startedAt = Date.now();

  function cfg() {
    return Game.Config;
  }

  AD.init = function () {
    var c = cfg();
    AD.mode = c.REWARD_UNIT ? 'real' : 'none';
    lastInterstitialAt = 0;
    startedAt = Date.now();

    if (c.REWARD_UNIT) {
      try {
        rewardAd = wx.createRewardedVideoAd({ adUnitId: c.REWARD_UNIT });
        rewardAd.onError(function (err) {
          console.error('激励视频错误', err);
          Game.Analytics && Game.Analytics.log('reward_error', { err: String(err && err.errMsg) });
        });
        rewardAd.onClose(function (res) {
          var done = pendingDone;
          var cancel = pendingCancel;
          pendingDone = null;
          pendingCancel = null;
          if (res && res.isEnded) {
            Game.Analytics && Game.Analytics.log('reward_ended', {});
            if (done) done();
          } else {
            Game.Analytics && Game.Analytics.log('reward_skip_close', {});
            if (cancel) cancel();
          }
        });
        rewardAd.load().catch(function () {});
      } catch (e) {
        console.error('激励初始化失败', e);
        AD.mode = 'none';
      }
    }

    if (c.INTERSTITIAL_UNIT) {
      try {
        interstitialAd = wx.createInterstitialAd({ adUnitId: c.INTERSTITIAL_UNIT });
        interstitialAd.onError(function (err) {
          console.error('插屏错误', err);
          Game.Analytics && Game.Analytics.log('interstitial_error', { err: String(err && err.errMsg) });
        });
        interstitialAd.onLoad(function () {
          AD.interstitialReady = true;
        });
        interstitialAd.onClose(function () {
          AD.interstitialReady = false;
          lastInterstitialAt = Date.now();
          try {
            interstitialAd.load();
          } catch (e2) {}
        });
        interstitialAd.load().catch(function () {});
      } catch (e3) {
        console.error('插屏初始化失败', e3);
        interstitialAd = null;
      }
    }
  };

  /**
   * 播放激励视频。无广告位时返回 false，由调用方走免费次数。
   * @returns {boolean} 是否已尝试拉起广告
   */
  AD.showReward = function (reason, onDone, onCancel) {
    Game.Analytics && Game.Analytics.log('reward_try', { reason: reason, mode: AD.mode });
    if (AD.mode !== 'real' || !rewardAd) {
      return false;
    }
    pendingDone = onDone;
    pendingCancel = onCancel;
    rewardAd
      .show()
      .catch(function () {
        return rewardAd.load().then(function () {
          return rewardAd.show();
        });
      })
      .catch(function () {
        pendingDone = null;
        pendingCancel = null;
        Game.Analytics && Game.Analytics.log('reward_show_fail', { reason: reason });
        if (onCancel) onCancel();
      });
    return true;
  };

  AD.hasRewardAd = function () {
    return AD.mode === 'real' && !!cfg().REWARD_UNIT;
  };

  AD.hasInterstitial = function () {
    return !!(cfg().INTERSTITIAL_UNIT && interstitialAd);
  };

  /**
   * 尝试展示插屏。开局冷却、间隔冷却；无 ID 则 no-op。
   * @param {string} reason
   * @param {boolean} force 忽略「每 N 关」计数（仍守冷却）
   */
  AD.tryInterstitial = function (reason, force) {
    var c = cfg();
    Game.Analytics && Game.Analytics.log('interstitial_try', { reason: reason, force: !!force });
    if (!AD.hasInterstitial()) return false;

    var now = Date.now();
    if (now - startedAt < c.INTERSTITIAL_STARTUP_COOLDOWN_SEC * 1000) {
      Game.Analytics && Game.Analytics.log('interstitial_blocked', { why: 'startup' });
      return false;
    }
    if (now - lastInterstitialAt < c.INTERSTITIAL_COOLDOWN_SEC * 1000) {
      Game.Analytics && Game.Analytics.log('interstitial_blocked', { why: 'cooldown' });
      return false;
    }

    try {
      interstitialAd
        .show()
        .then(function () {
          lastInterstitialAt = Date.now();
          Game.Analytics && Game.Analytics.log('interstitial_show', { reason: reason });
        })
        .catch(function () {
          return interstitialAd.load().then(function () {
            return interstitialAd.show();
          });
        })
        .catch(function (err) {
          Game.Analytics && Game.Analytics.log('interstitial_fail', { err: String(err && err.errMsg) });
        });
      return true;
    } catch (e) {
      return false;
    }
  };

  Game.AD = AD;
})();
