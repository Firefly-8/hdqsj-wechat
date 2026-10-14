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
    var L = Game.Theme.layout;
    var save = Game.save;
    var idx = (save && save.levelIndex) || 0;
    var started = save && (save.clearedMax >= 0 || idx > 0);
    var by = L.bottomBarY - 96;
    Home.levelTag = started ? '第 ' + (idx + 1) + ' 关' : '';
    Home.buttons = [
      { id: 'play', x: 48, y: by, w: W - 96, h: 68, label: started ? '继续闯关' : '开始闯关', kind: 'primary', fontSize: 30 },
      Game.UI.iconHit({ id: 'share', cx: W / 2 - 78, cy: by + 118, r: 25, icon: '📤', base: '#6CC3E0', label: '喊朋友', labelColor: '#5A3216' }),
      Game.UI.iconHit({ id: 'sound', cx: W / 2, cy: by + 118, r: 25, icon: save && save.soundOn === false ? '🔇' : '🔊', base: '#F3E2BE', label: '音效', labelColor: '#5A3216' }),
      Game.UI.iconHit({ id: 'reset', cx: W / 2 + 78, cy: by + 118, r: 25, icon: '🔄', base: '#F3E2BE', label: '从头玩', labelColor: '#5A3216' })
    ];
  };

  Home.update = function (dt) {
    Home.bob += dt;
  };

  Home.draw = function (ctx) {
    var W = Game.W;
    var H = Game.H;
    var UI = Game.UI, T = Game.Theme, L = T.layout;
    Game.BG.draw(ctx, 'home');

    // 主视觉：漂浮小岛（唯一记忆点）
    var bob = Math.sin(Home.bob * 1.6) * 5;
    var iy = Math.max(L.capsule.bottom + 90, H * 0.24);
    var gl = ctx.createRadialGradient(W / 2, iy, 10, W / 2, iy, 140);
    gl.addColorStop(0, 'rgba(255,250,220,0.8)');
    gl.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, iy - 140, W, 280);
    Game.Emoji.draw(ctx, '🏝️', W / 2, iy + bob, 140);

    var ty = iy + 118;
    UI.title(ctx, '绝望岛', W / 2 - 4, ty, 58, { depth: 6 });
    UI.title(ctx, '求生记', W / 2 + 60, ty + 52, 40, { depth: 4, grad: ['#FFFFFF', '#BDEBFF', '#5EC8F0'] });
    ctx.save();
    ctx.translate(108, ty + 98);
    ctx.rotate(-0.06);
    UI.plank(ctx, -74, -15, 132, 30, { rows: 1, r: 8 });
    UI.text(ctx, '动动脑子活下去', -8, 0, 12.5, T.CREAM_TXT, '900');
    ctx.restore();

    Home._layout();
    for (var i = 0; i < Home.buttons.length; i++) {
      var b = Home.buttons[i];
      if (b.cx != null) UI.iconButton(ctx, b, Home.pressed === b.id);
      else UI.drawButton(ctx, b, Home.pressed === b.id);
    }
    if (Home.levelTag) {
      var pb = Home.buttons[0];
      UI.plank(ctx, W / 2 - 50, pb.y - 18, 100, 26, { rows: 1, r: 8 });
      UI.text(ctx, Home.levelTag, W / 2, pb.y - 5, 12.5, T.CREAM_TXT, '900');
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
