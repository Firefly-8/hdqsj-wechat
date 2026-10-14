/**
 * 全局配置：广告位、插屏节奏、每日免费次数、分享轻激励
 * 广告位 ID 留空 = mode none（无流量主降级可玩）
 */
(function () {
  'use strict';

  var Config = {
    APP_NAME: '绝望岛求生记',
    TAGLINE: '脑子转一下，在岛上活下去',
    STORAGE_KEY: 'brain_v1',

    // 广告位：开通流量主后填入，勿编造
    REWARD_UNIT: '',
    INTERSTITIAL_UNIT: '',
    INTERSTITIAL_EVERY: 5,
    INTERSTITIAL_COOLDOWN_SEC: 60,
    INTERSTITIAL_STARTUP_COOLDOWN_SEC: 30,

    // 无广告位时的每日免费次数
    HINT_FREE_DAILY: 5,
    SKIP_FREE_DAILY: 2,
    SHARE_HINT_DAILY_CAP: 3,

    // 逻辑画布
    LOGICAL_W: 375,

    // 分包名（与 game.json subpackages 一致）
    SUBPACKAGE_PACK1: 'levels_pack1',
    // require 相对 js/level_loader.js；JSON 读盘用根路径
    PACK0_PATH: '../levels/pack0.js',
    PACK1_PATH: '../levels_pack1/levels/pack1.js',
    PACK0_JSON: 'levels/pack0.json',
    PACK1_JSON: 'levels_pack1/levels/pack1.json',

    // 旧合成玩法入口（默认关）
    LEGACY_ENABLED: false
  };

  Game.Config = Config;
})();
