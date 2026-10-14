/**
 * brain_v1 存档：关卡进度 + 每日免费提示/跳过 + 分享奖励计数
 * 与旧合成玩法 islandSave_v1 隔离，避免串档
 */
(function () {
  'use strict';

  var KEY = 'brain_v1';
  var mem = null; // Node / 无 Storage 环境回退

  function todayStr() {
    return new Date().toDateString();
  }

  function fresh() {
    var cfg = Game.Config;
    return {
      version: 1,
      levelIndex: 0,
      clearedMax: -1,
      hintFreeLeft: cfg.HINT_FREE_DAILY,
      skipFreeLeft: cfg.SKIP_FREE_DAILY,
      shareRewardDaily: 0,
      dailyDate: todayStr(),
      soundOn: true,
      clearCountSinceInterstitial: 0
    };
  }

  function normalize(s) {
    var d = fresh();
    if (!s || typeof s !== 'object') return d;
    for (var k in d) {
      if (s[k] === undefined) s[k] = d[k];
    }
    if (typeof s.levelIndex !== 'number' || s.levelIndex < 0) s.levelIndex = 0;
    if (typeof s.clearedMax !== 'number') s.clearedMax = -1;
    return s;
  }

  function rollDaily(s) {
    var cfg = Game.Config;
    var today = todayStr();
    if (s.dailyDate !== today) {
      s.dailyDate = today;
      s.hintFreeLeft = cfg.HINT_FREE_DAILY;
      s.skipFreeLeft = cfg.SKIP_FREE_DAILY;
      s.shareRewardDaily = 0;
    }
    return s;
  }

  var Storage = {};

  Storage.load = function () {
    var raw = null;
    try {
      if (typeof wx !== 'undefined' && wx.getStorageSync) {
        raw = wx.getStorageSync(KEY);
      }
    } catch (e) {}
    if (!raw && typeof localStorage !== 'undefined') {
      try {
        var t = localStorage.getItem(KEY);
        if (t) raw = JSON.parse(t);
      } catch (e2) {}
    }
    if (!raw && mem) raw = mem;
    return rollDaily(normalize(raw));
  };

  Storage.save = function (s) {
    s = rollDaily(normalize(s));
    mem = s;
    try {
      if (typeof wx !== 'undefined' && wx.setStorageSync) {
        wx.setStorageSync(KEY, s);
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(KEY, JSON.stringify(s));
      }
    } catch (e2) {}
    return s;
  };

  Storage.resetProgress = function (s) {
    s.levelIndex = 0;
    s.clearedMax = -1;
    s.clearCountSinceInterstitial = 0;
    return Storage.save(s);
  };

  Game.Storage = Storage;
})();
