/**
 * 关卡页：题干 + 场景交互 + 提示/跳过/分享 + 过关层
 */
(function () {
  'use strict';

  var Play = {
    level: null,
    index: 0,
    scene: null,
    runner: null,
    buttons: [],
    pressed: null,
    overlay: null, // { type:'win'|'loading'|'error', text }
    titleHits: [],
    hintHold: null,
    loading: false
  };

  Play.enter = function (index) {
    Play.index = index;
    Play.overlay = null;
    Play.pressed = null;
    Play.runner = null;
    Play.scene = null;
    Play.loading = true;
    Play.overlay = { type: 'loading', text: '加载关卡…' };

    Game.LevelLoader.ensureIndex(index, function (err, level) {
      Play.loading = false;
      if (err || !level) {
        Play.overlay = {
          type: 'error',
          text: index >= Game.LevelLoader.pack0Count()
            ? '后续关卡分包加载失败，请检查 subpackages'
            : '关卡不存在'
        };
        return;
      }
      Play._startLevel(level, index);
    });
  };

  Play._startLevel = function (level, index) {
    Play.level = level;
    Play.index = index;
    Play.overlay = null;
    Play.scene = Game.SceneBuild.build(level, Game.W, Game.H);
    Play._buildTitleHits();

    var hooks = {
      onWin: function () {
        Play._onWin();
      },
      onFail: function (msg) {
        Game.FX.toast(msg || level.failToast || '再试试');
      }
    };

    var type = level.type || 'tap_find';
    var factory = Game.Interactions[type] || Game.Interactions.tap_find;
    Play.runner = factory.create(level, Play.scene, hooks);

    Play._layoutButtons();
    Game.Analytics && Game.Analytics.log('level_start', { id: level.id, index: index, type: type });

    // share message for this level
    Game.App.refreshShareMenu(level, index);
  };

  Play._buildTitleHits = function () {
    Play.titleHits = [];
    var level = Play.level;
    if (!level) return;
    var title = level.title || '';
    var W = Game.W;
    // whole title as title_text
    Play.titleHits.push({
      id: 'title_text',
      word: null,
      x: 24,
      y: 72,
      w: W - 48,
      h: 36
    });
    // extract possible words from win targets
    var words = [];
    var w = level.win || {};
    function collect(v) {
      if (typeof v === 'string' && v.indexOf('title_word:') === 0) words.push(v.slice(11));
      else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { collect(v[k]); });
    }
    collect(w);
    // also common chars in title for unconventional
    ['小鸟', '入口', '怪物', '这里', '一切', '心'].forEach(function (wd) {
      if (title.indexOf(wd) >= 0 && words.indexOf(wd) < 0) words.push(wd);
    });
    words.forEach(function (wd) {
      var idx = title.indexOf(wd);
      if (idx < 0) return;
      // approximate position by char index
      var charW = Math.min(22, (W - 48) / Math.max(title.length, 1));
      Play.titleHits.push({
        id: 'title_word:' + wd,
        word: wd,
        x: 24 + idx * charW,
        y: 72,
        w: Math.max(36, wd.length * charW),
        h: 36
      });
    });
  };

  Play._layoutButtons = function () {
    var W = Game.W;
    var H = Game.H;
    var y = H - 100;
    Play.buttons = [
      { id: 'hint', x: 16, y: y, w: 80, h: 40, label: '提示', bg: '#3A5A7A', r: 10, font: '14px sans-serif' },
      { id: 'skip', x: 106, y: y, w: 80, h: 40, label: '跳过', bg: '#6A5A4A', r: 10, font: '14px sans-serif' },
      { id: 'share', x: 196, y: y, w: 80, h: 40, label: '分享', bg: '#2A6B4F', r: 10, font: '14px sans-serif' },
      { id: 'home', x: 286, y: y, w: 72, h: 40, label: '大厅', bg: '#4A4A4A', r: 10, font: '14px sans-serif' }
    ];
    if (Play.overlay && Play.overlay.type === 'win') {
      Play.buttons = [
        {
          id: 'next',
          x: W * 0.15,
          y: H * 0.58,
          w: W * 0.7,
          h: 52,
          label: '下一关',
          bg: '#2A6B4F',
          r: 14
        },
        {
          id: 'home',
          x: W * 0.15,
          y: H * 0.58 + 66,
          w: W * 0.7,
          h: 44,
          label: '回大厅',
          bg: '#4A4A4A',
          r: 12
        }
      ];
    }
  };

  Play._onWin = function () {
    var level = Play.level;
    var index = Play.index;
    Game.FX.sparkle(Game.W / 2, Game.H * 0.45, '#E6C84A');
    Game.FX.toast(level.winToast || '过关！', 1400);

    var save = Game.save;
    if (index > save.clearedMax) save.clearedMax = index;
    save.levelIndex = index + 1;
    save.clearCountSinceInterstitial = (save.clearCountSinceInterstitial || 0) + 1;
    Game.Storage.save(save);

    Game.Analytics && Game.Analytics.log('level_clear', { id: level.id, index: index });

    Play.overlay = {
      type: 'win',
      text: level.winToast || '过关！'
    };
    Play._layoutButtons();

    // interstitial every N clears
    var every = Game.Config.INTERSTITIAL_EVERY || 5;
    if (save.clearCountSinceInterstitial >= every) {
      save.clearCountSinceInterstitial = 0;
      Game.Storage.save(save);
      Game.AD.tryInterstitial('after_clear');
    }
  };

  Play.skipLevel = function () {
    // treat as clear without playing
    var level = Play.level;
    if (!level) return;
    Game.Analytics && Game.Analytics.log('level_skip', { id: level.id, index: Play.index });
    Play._onWin();
  };

  Play.useHint = function () {
    if (!Play.runner) return;
    Game.Analytics && Game.Analytics.log('hint_click', { id: Play.level && Play.level.id });
    var save = Game.save;

    function grant() {
      var msg = Play.runner.getHint();
      Game.FX.toast(msg, 2200);
      Game.Analytics && Game.Analytics.log('hint_grant', { id: Play.level && Play.level.id });
    }

    if (Game.AD.hasRewardAd()) {
      var shown = Game.AD.showReward(
        'hint',
        function () {
          grant();
        },
        function () {
          Game.FX.toast('看完广告才能获得提示');
        }
      );
      if (shown) return;
    }

    // no ad: free daily
    if (save.hintFreeLeft > 0) {
      save.hintFreeLeft--;
      Game.Storage.save(save);
      grant();
      return;
    }
    Game.FX.toast('今日免费提示已用完（可分享+1，或等待明天）');
  };

  Play.trySkip = function () {
    var save = Game.save;
    Game.Analytics && Game.Analytics.log('skip_click', { id: Play.level && Play.level.id });

    function doSkip() {
      Play.skipLevel();
    }

    if (Game.AD.hasRewardAd()) {
      var shown = Game.AD.showReward(
        'skip',
        function () {
          doSkip();
        },
        function () {
          Game.FX.toast('看完广告才能跳过');
        }
      );
      if (shown) return;
    }

    if (save.skipFreeLeft > 0) {
      save.skipFreeLeft--;
      Game.Storage.save(save);
      doSkip();
      return;
    }
    Game.FX.toast('今日免费跳过已用完');
  };

  Play.update = function (dt) {
    if (Play.runner && !Play.overlay) Play.runner.update(dt);
    if (Play.hintHold) {
      Play.hintHold.t += dt * 1000;
      if (Play.level && Play.level.win && Play.level.win.action === 'long_press' && Play.level.win.target === 'hint_button') {
        if (Play.runner && Play.runner.tapHintButtonLong) {
          Play.runner.tapHintButtonLong(Play.hintHold.t);
        }
      }
    }
  };

  Play.draw = function (ctx) {
    var W = Game.W;
    var H = Game.H;
    var level = Play.level;

    // bg
    var bg = Game.bgAssets && Game.bgAssets.beach;
    if (bg && bg.width) {
      ctx.drawImage(bg, 0, 0, W, H);
      ctx.fillStyle = 'rgba(250,244,230,0.72)';
      ctx.fillRect(0, 0, W, H);
    } else {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#B8D4E8');
      g.addColorStop(1, '#E8D5B0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // header
    ctx.fillStyle = '#2A241C';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('第 ' + (Play.index + 1) + ' 关', 16, 36);
    if (level) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#5A5048';
      ctx.font = '12px sans-serif';
      ctx.fillText(level.type, W - 16, 36);
    }

    // title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1A1814';
    ctx.font = 'bold 20px "Songti SC", "Noto Serif SC", serif';
    var title = (level && level.title) || '';
    ctx.fillText(title, W / 2, 92);

    // scene desc
    if (level && !Play.overlay) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#5A5048';
      wrapText(ctx, level.scene || '', W / 2, 112, W - 40, 16);
    }

    // entities
    if (Play.scene && (!Play.overlay || Play.overlay.type === 'win')) {
      var ents = Play.scene.entities.slice().sort(function (a, b) {
        return (a.z || 0) - (b.z || 0);
      });
      for (var i = 0; i < ents.length; i++) Game.SceneBuild.drawEntity(ctx, ents[i]);
    }

    // progress for wait/shake
    if (Play.runner && !Play.overlay) {
      var prog = Play.runner.progressText();
      if (prog) {
        ctx.fillStyle = '#2A6B4F';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(prog, W / 2, H - 120);
      }
    }

    // free counts
    if (Game.save && !Play.overlay) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#6A6058';
      ctx.textAlign = 'left';
      ctx.fillText(
        '免费提示 ' + Game.save.hintFreeLeft + ' · 跳过 ' + Game.save.skipFreeLeft,
        16,
        H - 110
      );
    }

    Play._layoutButtons();
    if (!Play.overlay || Play.overlay.type === 'win') {
      for (var b = 0; b < Play.buttons.length; b++) {
        Game.UI.drawButton(ctx, Play.buttons[b], Play.pressed === Play.buttons[b].id);
      }
    }

    // overlays
    if (Play.overlay) {
      if (Play.overlay.type === 'win') {
        ctx.fillStyle = 'rgba(20,16,12,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#FFF8EE';
        ctx.font = 'bold 26px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('过关！', W / 2, H * 0.38);
        ctx.font = '15px sans-serif';
        ctx.fillText(Play.overlay.text || '', W / 2, H * 0.38 + 36);
        for (var j = 0; j < Play.buttons.length; j++) {
          Game.UI.drawButton(ctx, Play.buttons[j], Play.pressed === Play.buttons[j].id);
        }
      } else {
        ctx.fillStyle = 'rgba(20,16,12,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#FFF8EE';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Play.overlay.text || '', W / 2, H * 0.45);
        if (Play.overlay.type === 'error') {
          Game.UI.drawButton(
            ctx,
            { id: 'home', x: W * 0.2, y: H * 0.52, w: W * 0.6, h: 44, label: '回大厅', bg: '#4A4A4A', r: 12 },
            Play.pressed === 'home'
          );
        }
      }
    }
  };

  function wrapText(ctx, text, x, y, maxW, lineH) {
    var chars = text.split('');
    var line = '';
    var yy = y;
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = chars[i];
        yy += lineH;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  Play.onTouchStart = function (x, y, touches) {
    Play.pressed = null;
    Play.hintHold = null;

    // overlay buttons
    if (Play.overlay) {
      if (Play.overlay.type === 'error') {
        var hb = { id: 'home', x: Game.W * 0.2, y: Game.H * 0.52, w: Game.W * 0.6, h: 44 };
        if (Game.UI.hit(hb, x, y)) Play.pressed = 'home';
        return;
      }
      for (var i = 0; i < Play.buttons.length; i++) {
        if (Game.UI.hit(Play.buttons[i], x, y)) {
          Play.pressed = Play.buttons[i].id;
          return;
        }
      }
      return;
    }

    // UI buttons first
    for (var j = 0; j < Play.buttons.length; j++) {
      if (Game.UI.hit(Play.buttons[j], x, y)) {
        Play.pressed = Play.buttons[j].id;
        if (Play.buttons[j].id === 'hint') {
          Play.hintHold = { t: 0 };
        }
        return;
      }
    }

    // title hits
    for (var t = 0; t < Play.titleHits.length; t++) {
      var th = Play.titleHits[t];
      if (x >= th.x && x <= th.x + th.w && y >= th.y && y <= th.y + th.h) {
        if (Play.runner) {
          if (th.word && Play.runner.tapTitleWord) Play.runner.tapTitleWord(th.word);
          else if (Play.runner.win) Play.runner.win.onTap({ id: th.id, visible: true }, x, y, {});
          else if (th.id === 'title_text' && Play.runner.tapTitleText) Play.runner.tapTitleText();
        }
        return;
      }
    }

    if (Play.runner) Play.runner.onTouchStart(touches || [{ clientX: x, clientY: y }], x, y);
  };

  Play.onTouchMove = function (x, y, touches) {
    if (Play.overlay) return;
    if (Play.pressed) return;
    if (Play.runner) Play.runner.onTouchMove(touches || [{ clientX: x, clientY: y }], x, y);
  };

  Play.onTouchEnd = function (x, y) {
    var id = Play.pressed;
    Play.pressed = null;
    var heldHint = Play.hintHold;
    Play.hintHold = null;

    if (Play.overlay && Play.overlay.type === 'error' && id === 'home') {
      Game.App.goHome(true);
      return;
    }

    if (id) {
      // verify still on button
      var btn = null;
      for (var i = 0; i < Play.buttons.length; i++) {
        if (Play.buttons[i].id === id) btn = Play.buttons[i];
      }
      if (Play.overlay && Play.overlay.type === 'error') {
        btn = { id: 'home', x: Game.W * 0.2, y: Game.H * 0.52, w: Game.W * 0.6, h: 44 };
      }
      if (btn && Game.UI.hit(btn, x, y)) {
        if (id === 'hint') {
          // if long-press win consumed, skip normal hint
          if (!(heldHint && heldHint.t >= 3000 && Play.level && Play.level.win && Play.level.win.target === 'hint_button')) {
            Play.useHint();
          }
        } else if (id === 'skip') Play.trySkip();
        else if (id === 'share') Game.App.shareFromPlay();
        else if (id === 'home') Game.App.goHome(true);
        else if (id === 'next') {
          Game.App.goPlay(Play.index + 1);
        }
        return;
      }
    }

    if (!Play.overlay && Play.runner) Play.runner.onTouchEnd(x, y);
  };

  Play.onAccelerometer = function (res) {
    if (!Play.overlay && Play.runner && Play.runner.onAccelerometer) Play.runner.onAccelerometer(res);
  };

  Game.Scenes = Game.Scenes || {};
  Game.Scenes.play = Play;
})();
