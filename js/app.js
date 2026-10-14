/**
 * 新主循环：首页 ↔ 闯关（脑洞 IAA）
 * 旧合成玩法在 _legacy/，默认不引用
 */
(function () {
  'use strict';

  var App = {};
  var lastTs = 0;
  var accelOn = false;

  function toLocal(t) {
    return {
      x: t.clientX * (Game.Config.LOGICAL_W / Game.W_RAW),
      y: t.clientY * (Game.Config.LOGICAL_W / Game.W_RAW)
    };
  }

  function currentScene() {
    return Game.Scenes[Game.scene];
  }

  App.start = function () {
    var sys = wx.getSystemInfoSync();
    Game.W_RAW = sys.screenWidth;
    Game.H_RAW = sys.screenHeight;
    Game.DPR = sys.pixelRatio || 2;
    Game.W = Game.Config.LOGICAL_W;
    Game.H = Math.round(Game.Config.LOGICAL_W * Game.H_RAW / Game.W_RAW);

    var canvas = wx.createCanvas();
    var ctx = canvas.getContext('2d');
    canvas.width = Game.W_RAW * Game.DPR;
    canvas.height = Game.H_RAW * Game.DPR;
    var scale = canvas.width / Game.W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    Game.canvas = canvas;
    Game.ctx = ctx;

    Game.save = Game.Storage.load();
    Game.LevelLoader.initPack0();
    Game.AD.init();

    // preload beach bg
    Game.bgAssets = {};
    try {
      var img = wx.createImage();
      img.src = 'images/bg_beach.jpg';
      Game.bgAssets.beach = img;
    } catch (e) {}

    Game.Analytics && Game.Analytics.log('app_enter', {
      pack0: Game.LevelLoader.pack0Count(),
      levelIndex: Game.save.levelIndex
    });

    // 预热分包（不阻塞开局）
    setTimeout(function () {
      Game.LevelLoader.ensurePack1(function () {});
    }, 800);

    App.setupShare();
    App.enableAccel();

    Game.scene = 'home';
    Game.Scenes.home.enter();

    wx.onTouchStart(function (e) {
      var t = e.touches[0];
      if (!t) return;
      var p = toLocal(t);
      var sc = currentScene();
      if (sc && sc.onTouchStart) sc.onTouchStart(p.x, p.y, e.touches);
    });
    wx.onTouchMove(function (e) {
      var t = e.touches[0];
      if (!t) return;
      var p = toLocal(t);
      var sc = currentScene();
      if (sc && sc.onTouchMove) sc.onTouchMove(p.x, p.y, e.touches);
    });
    wx.onTouchEnd(function (e) {
      var t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
      var p = t ? toLocal(t) : { x: 0, y: 0 };
      var sc = currentScene();
      if (sc && sc.onTouchEnd) sc.onTouchEnd(p.x, p.y);
    });
    wx.onTouchCancel(function (e) {
      var t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
      var p = t ? toLocal(t) : { x: 0, y: 0 };
      var sc = currentScene();
      if (sc && sc.onTouchEnd) sc.onTouchEnd(p.x, p.y);
    });

    lastTs = Date.now();
    function loop() {
      var now = Date.now();
      var dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      var sc = currentScene();
      if (sc && sc.update) sc.update(dt);
      Game.FX.update(dt);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (sc && sc.draw) sc.draw(ctx);
      Game.FX.draw(ctx, Game.W);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    Game.App = App;
  };

  App.goHome = function (fromPlay) {
    if (fromPlay) {
      Game.AD.tryInterstitial('back_home');
    }
    Game.scene = 'home';
    Game.Scenes.home.enter();
    App.refreshShareMenu(null, Game.save.levelIndex || 0);
  };

  App.goPlay = function (index) {
    index = Math.max(0, index | 0);
    // 若超过已加载总数且 pack1 未好，play 内会 ensure
    Game.scene = 'play';
    Game.Scenes.play.enter(index);
  };

  App.enableAccel = function () {
    if (accelOn) return;
    try {
      if (wx.startAccelerometer) {
        wx.startAccelerometer({ interval: 'game' });
        wx.onAccelerometerChange(function (res) {
          var sc = currentScene();
          if (sc && sc.onAccelerometer) sc.onAccelerometer(res);
        });
        accelOn = true;
      }
    } catch (e) {}
  };

  App.setupShare = function () {
    try {
      if (wx.showShareMenu) {
        wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
      }
    } catch (e) {}
    App.refreshShareMenu(null, (Game.save && Game.save.levelIndex) || 0);

    try {
      if (wx.onShareAppMessage) {
        wx.onShareAppMessage(function () {
          return App.getSharePayload();
        });
      }
    } catch (e2) {}
  };

  App._shareLevel = null;
  App._shareIndex = 0;

  App.refreshShareMenu = function (level, index) {
    App._shareLevel = level || null;
    App._shareIndex = index || 0;
  };

  App.getSharePayload = function () {
    var level = App._shareLevel;
    var idx = App._shareIndex || (Game.save && Game.save.levelIndex) || 0;
    var title;
    if (level && level.shareHook) title = level.shareHook;
    else title = '我卡在绝望岛第 ' + (idx + 1) + ' 关';
    Game.Analytics && Game.Analytics.log('share_payload', { title: title, index: idx });
    return { title: title };
  };

  App._grantShareHint = function () {
    var save = Game.save;
    var cap = Game.Config.SHARE_HINT_DAILY_CAP;
    if (save.shareRewardDaily >= cap) {
      Game.FX.toast('今日分享奖励已达上限');
      return;
    }
    save.shareRewardDaily++;
    save.hintFreeLeft++;
    Game.Storage.save(save);
    Game.FX.toast('分享成功，提示 +1');
    Game.Analytics && Game.Analytics.log('share_reward', { left: save.hintFreeLeft });
  };

  App.shareFromHome = function () {
    App.refreshShareMenu(null, Game.save.levelIndex || 0);
    App._doShare();
  };

  App.shareFromPlay = function () {
    var level = Game.Scenes.play.level;
    App.refreshShareMenu(level, Game.Scenes.play.index);
    App._doShare();
  };

  App._doShare = function () {
    Game.Analytics && Game.Analytics.log('share_click', {});
    var payload = App.getSharePayload();
    try {
      if (wx.shareAppMessage) {
        wx.shareAppMessage(payload);
        // 轻激励：调起即尝试发放（不强依赖回调；禁止强制分享才能过关）
        App._grantShareHint();
        return;
      }
    } catch (e) {}
    Game.FX.toast('请点击右上角分享');
  };

  Game.App = App;
})();
