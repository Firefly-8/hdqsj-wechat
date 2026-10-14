/**
 * 首页 / 大厅：岛名 + 一句话 + 开始/继续
 */
(function () {
  'use strict';

  var Home = {
    buttons: [],
    pressed: null,
    bob: 0
  };

  Home.enter = function () {
    Home.pressed = null;
    Home._layout();
    Game.Analytics && Game.Analytics.log('home_enter', {
      levelIndex: Game.save && Game.save.levelIndex
    });
  };

  Home._layout = function () {
    var W = Game.W;
    var H = Game.H;
    var save = Game.save;
    var idx = (save && save.levelIndex) || 0;
    var started = save && (save.clearedMax >= 0 || idx > 0);
    Home.buttons = [
      {
        id: 'play',
        x: W * 0.15,
        y: H * 0.62,
        w: W * 0.7,
        h: 52,
        label: started ? '继续闯关 · 第 ' + (idx + 1) + ' 关' : '开始闯关',
        bg: '#2A6B4F',
        r: 14
      },
      {
        id: 'share',
        x: W * 0.15,
        y: H * 0.62 + 68,
        w: W * 0.7,
        h: 46,
        label: '分享给好友',
        bg: '#3A5A7A',
        r: 12
      },
      {
        id: 'reset',
        x: W * 0.15,
        y: H * 0.62 + 128,
        w: W * 0.32,
        h: 40,
        label: '重新开始',
        bg: '#6A5A4A',
        font: '13px sans-serif',
        r: 10
      },
      {
        id: 'sound',
        x: W * 0.53,
        y: H * 0.62 + 128,
        w: W * 0.32,
        h: 40,
        label: save && save.soundOn === false ? '音效:关' : '音效:开',
        bg: '#6A5A4A',
        font: '13px sans-serif',
        r: 10
      }
    ];
  };

  Home.update = function (dt) {
    Home.bob += dt;
  };

  Home.draw = function (ctx) {
    var W = Game.W;
    var H = Game.H;
    var cfg = Game.Config;

    // beach bg
    var bg = Game.bgAssets && Game.bgAssets.beach;
    if (bg && bg.width) {
      ctx.drawImage(bg, 0, 0, W, H);
      ctx.fillStyle = 'rgba(20,30,40,0.35)';
      ctx.fillRect(0, 0, W, H);
    } else {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#7EB6D9');
      g.addColorStop(0.45, '#F0D5A0');
      g.addColorStop(1, '#C9A66B');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // floating island mark
    var bob = Math.sin(Home.bob * 1.6) * 6;
    ctx.save();
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏝️', W / 2, H * 0.28 + bob);
    ctx.restore();

    ctx.fillStyle = '#FFF8EE';
    ctx.font = 'bold 28px "Songti SC", "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.APP_NAME, W / 2, H * 0.42);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,248,238,0.9)';
    ctx.fillText(cfg.TAGLINE, W / 2, H * 0.42 + 32);

    var save = Game.save;
    if (save) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,248,238,0.75)';
      var cleared = save.clearedMax >= 0 ? '已过 ' + (save.clearedMax + 1) + ' 关' : '新存档';
      ctx.fillText(cleared + ' · 提示剩余 ' + save.hintFreeLeft, W / 2, H * 0.42 + 56);
    }

    Home._layout();
    for (var i = 0; i < Home.buttons.length; i++) {
      Game.UI.drawButton(ctx, Home.buttons[i], Home.pressed === Home.buttons[i].id);
    }
  };

  Home.onTouchStart = function (x, y) {
    Home.pressed = null;
    for (var i = 0; i < Home.buttons.length; i++) {
      if (Game.UI.hit(Home.buttons[i], x, y)) {
        Home.pressed = Home.buttons[i].id;
        break;
      }
    }
  };

  Home.onTouchEnd = function (x, y) {
    var id = Home.pressed;
    Home.pressed = null;
    if (!id) return;
    var btn = null;
    for (var i = 0; i < Home.buttons.length; i++) {
      if (Home.buttons[i].id === id && Game.UI.hit(Home.buttons[i], x, y)) btn = Home.buttons[i];
    }
    if (!btn) return;

    if (id === 'play') {
      Game.App.goPlay(Game.save.levelIndex || 0);
    } else if (id === 'share') {
      Game.App.shareFromHome();
    } else if (id === 'reset') {
      Game.save = Game.Storage.resetProgress(Game.save);
      Game.FX.toast('已从第 1 关重新开始');
      Home._layout();
    } else if (id === 'sound') {
      Game.save.soundOn = !Game.save.soundOn;
      Game.Storage.save(Game.save);
      Home._layout();
    }
  };

  Game.Scenes = Game.Scenes || {};
  Game.Scenes.home = Home;
})();
