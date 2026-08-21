/**
 * 广告管理器：激励视频 + Banner
 * - demo 模式（未配置广告位ID）：弹模拟确认框，保留网页版体验
 * - 正式模式（填入 adUnitId）：wx.createRewardedVideoAd / createBannerAd
 * 开通流量主后，把下方 AD_UNIT 替换为真实广告位 ID 即可切换正式模式
 */
(function () {
  'use strict';

  // 激励视频广告位 ID（流量主开通后替换；留空 = 演示模式）
  var REWARD_UNIT = '';
  // Banner 广告位 ID（可选）
  var BANNER_UNIT = '';

  var rewardAd = null;
  var bannerAd = null;
  var pendingRewardCb = null;   // 当前等待广告关闭的"成功"回调
  var pendingRewardCancel = null; // 当前等待广告关闭的"取消/失败"回调

  var AD = {};

  AD.mode = REWARD_UNIT ? 'real' : 'demo';

  // 预加载激励视频（正式模式）
  AD.init = function () {
    if (AD.mode !== 'real') return;
    try {
      rewardAd = wx.createRewardedVideoAd({ adUnitId: REWARD_UNIT });
      rewardAd.onError(function (err) {
        console.error('激励视频错误', err);
      });
      // 关键修复：onClose 只注册一次，避免重复 showReward 累积监听器导致重复发奖
      rewardAd.onClose(function (res) {
        var done = pendingRewardCb, cancel = pendingRewardCancel;
        pendingRewardCb = null; pendingRewardCancel = null;
        if (res && res.isEnded) { if (done) done(); }
        else { if (cancel) cancel(); }
      });
      rewardAd.load().catch(function () {});
    } catch (e) { console.error('广告初始化失败', e); }

    // Banner（可选接入）
    if (BANNER_UNIT) {
      try {
        bannerAd = wx.createBannerAd({
          adUnitId: BANNER_UNIT,
          adIntervals: 30,
          style: { left: 0, top: 0, width: 375 }
        });
      } catch (e) { console.error('Banner 初始化失败', e); }
    }
  };

  /**
   * 播放激励视频
   * @param type  'energy' | 'bottle' | 'offline'  （奖励类型，回调时区分）
   * @param onDone 观看成功回调
   * @param onCancel 取消/失败回调（可选）
   */
  AD.showReward = function (type, onDone, onCancel) {
    if (AD.mode === 'demo') {
      // 演示模式：模拟激励视频确认框
      Game.App.openAdModal(type, onDone);
      return;
    }
    // 正式模式：把回调暂存，由 init 里注册的唯一 onClose 统一分发
    pendingRewardCb = onDone;
    pendingRewardCancel = onCancel;
    rewardAd.show().catch(function () {
      // 失败先重新加载再试一次
      return rewardAd.load().then(function () { return rewardAd.show(); });
    }).catch(function () {
      pendingRewardCb = null; pendingRewardCancel = null;
      if (onCancel) onCancel();
    });
  };

  // Banner 定位（底部居中）
  AD.showBanner = function (W) {
    if (!bannerAd || AD.mode !== 'real') return;
    try {
      bannerAd.style.left = Math.floor((W - bannerAd.style.realWidth) / 2);
      bannerAd.show();
    } catch (e) {}
  };
  AD.hideBanner = function () {
    if (bannerAd) { try { bannerAd.hide(); } catch (e) {} }
  };

  Game.AD = AD;
})();
