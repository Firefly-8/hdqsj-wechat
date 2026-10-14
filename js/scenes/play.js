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

  /** 题目木牌布局（标题字号自适应），供绘制与题干文字命中共用 */
  Play._boardLayout = function () {
    var L = Game.Theme.layout;
    var W = Game.W;
    var x = 22, w = W - 44;
    var title = (Play.level && Play.level.title) || '';
    var ctx = Game.ctx;
    var size = Game.UI.fitSize(ctx, title, w - 48, 25, Game.Theme.display, 15);
    ctx.font = Game.Theme.display(size);
    var tw = ctx.measureText(title).width;
    return { x: x, y: L.boardY, w: w, h: L.boardH, title: title, size: size, tw: tw, ty: L.boardY + 30 };
  };

  Play._buildTitleHits = function () {
    Play.titleHits = [];
    var level = Play.level;
    if (!level) return;
    var title = level.title || '';
    var B = Play._boardLayout();
    var ctx = Game.ctx;
    ctx.font = Game.Theme.display(B.size);
    var x0 = Game.W / 2 - B.tw / 2;
    Play.titleHits.push({ id: 'title_text', word: null, x: B.x + 10, y: B.ty - 20, w: B.w - 20, h: 40 });
    var words = [];
    var w = level.win || {};
    function collect(v) {
      if (typeof v === 'string' && v.indexOf('title_word:') === 0) words.push(v.slice(11));
      else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { collect(v[k]); });
    }
    collect(w);
    ['小鸟', '入口', '怪物', '这里', '一切', '心'].forEach(function (wd) {
      if (title.indexOf(wd) >= 0 && words.indexOf(wd) < 0) words.push(wd);
    });
    words.forEach(function (wd) {
      var idx = title.indexOf(wd);
      if (idx < 0) return;
      var px = x0 + ctx.measureText(title.slice(0, idx)).width;
      var ww = ctx.measureText(wd).width;
      Play.titleHits.push({ id: 'title_word:' + wd, word: wd, x: px - 6, y: B.ty - 20, w: Math.max(36, ww + 12), h: 40 });
    });
  };

  Play._layoutButtons = function () {
    var W = Game.W;
    var H = Game.H;
    var L = Game.Theme.layout;
    var save = Game.save || {};
    var by = L.bottomBarY;
    var cap = L.capsule;
    var r = 17;
    Play.topButtons = [
      Game.UI.iconHit({ id: 'home', cx: cap.left - 10 - r, cy: L.barY, r: r, icon: '🏠', base: '#6CC3E0' }),
      Game.UI.iconHit({ id: 'sound', cx: cap.left - 20 - r * 3, cy: L.barY, r: r, icon: save.soundOn === false ? '🔇' : '🔊', base: '#F3E2BE' })
    ];
    Play.buttons = [
      { id: 'hint', x: 20, y: by, w: 192, h: 60, label: '看提示', kind: 'primary', icon: '💡', badge: Game.AD.hasRewardAd() ? '' : save.hintFreeLeft },
      { id: 'skip', x: 228, y: by + 6, w: W - 248, h: 52, label: '跳过', kind: 'secondary', icon: '⏭️', badge: Game.AD.hasRewardAd() ? '' : save.skipFreeLeft }
    ].concat(Play.topButtons);
    if (Play.overlay && Play.overlay.type === 'win') {
      var P = Play._winPanel();
      Play.buttons = [
        { id: 'next', x: P.x + 26, y: P.y + P.h - 74, w: P.w - 52, h: 58, label: '下一关', kind: 'primary', fontSize: 28 },
        Game.UI.iconHit({ id: 'home', cx: W / 2 - 50, cy: P.y + P.h + 50, r: 24, icon: '🏠', base: '#F3E2BE', label: '回岛上' }),
        Game.UI.iconHit({ id: 'share', cx: W / 2 + 50, cy: P.y + P.h + 50, r: 24, icon: '📤', base: '#6CC3E0', label: '喊朋友' })
      ];
    } else if (Play.overlay && Play.overlay.type === 'error') {
      Play.buttons = [{ id: 'home', x: W * 0.2, y: H * 0.52, w: W * 0.6, h: 52, label: '回到岛上', kind: 'primary' }];
    }
  };

  Play._winPanel = function () {
    var W = Game.W, H = Game.H;
    var h = 300;
    var y = Math.max(Game.Theme.layout.capsule.bottom + 110, Math.round(H * 0.5 - h / 2 - 10));
    return { x: 30, y: y, w: W - 60, h: h };
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
    var UI = Game.UI, T = Game.Theme, L = T.layout;
    var level = Play.level;
    var ov = Play.overlay;
    if (!ov || ov.type !== 'error') Play._layoutButtons();

    Game.BG.draw(ctx, 'play');

    if (level && (!ov || ov.type !== 'win')) {
      // 题目木牌：麻绳吊挂
      var B = Play._boardLayout();
      UI.plank(ctx, B.x, B.y, B.w, B.h, { rows: 2, r: 14 });
      UI.outlineText(ctx, B.title, W / 2, B.ty, B.size, '#FFF6DA', 'rgba(59,36,20,0.95)');
      ctx.font = T.body(12.5, 'bold');
      var sub = UI.wrap(ctx, level.scene || '', B.w - 40, 2);
      for (var si = 0; si < sub.length; si++) {
        UI.text(ctx, sub[si], W / 2, B.y + (sub.length > 1 ? 54 : 61) + si * 16, 12.5, '#5A3216', 'bold');
      }
    }

    // 顶栏：关卡木牌 + 圆钮（避开胶囊）
    var showLevelUI = !ov || ov.type !== 'win';
    if (showLevelUI) {
      UI.plank(ctx, 14, L.barY - 18, 104, 36, { rows: 1, r: 12 });
      UI.outlineText(ctx, '第 ' + (Play.index + 1) + ' 关', 66, L.barY, 18, T.CREAM_TXT);
      for (var tb = 0; tb < (Play.topButtons || []).length; tb++) {
        UI.iconButton(ctx, Play.topButtons[tb], Play.pressed === Play.topButtons[tb].id);
      }
    }

    // 物体
    if (Play.scene && (!ov || ov.type === 'win')) {
      var ents = Play.scene.entities.slice().sort(function (a, b) {
        return (a.z || 0) - (b.z || 0);
      });
      for (var i = 0; i < ents.length; i++) Game.SceneBuild.drawEntity(ctx, ents[i]);
    }

    if (!ov) {
      // 进度（等待/摇一摇类）
      var prog = Play.runner && Play.runner.progressText();
      if (prog) {
        ctx.font = T.display(16);
        var pw = ctx.measureText(prog).width + 36;
        UI.pill(ctx, W / 2 - pw / 2, L.bottomBarY - 52, pw, 32);
        UI.text(ctx, prog, W / 2, L.bottomBarY - 36, 14, T.INK_SOFT, '900');
      }
      for (var b = 0; b < Play.buttons.length; b++) {
        var bt = Play.buttons[b];
        if (bt.cx != null) continue;
        UI.drawButton(ctx, bt, Play.pressed === bt.id);
      }
    }

    if (ov) {
      if (ov.type === 'win') Play._drawWin(ctx);
      else {
        ctx.fillStyle = T.MASK;
        ctx.fillRect(0, 0, W, H);
        var pw2 = W - 80, ph2 = ov.type === 'error' ? 170 : 96;
        var py2 = H * 0.5 - ph2 / 2 - 20;
        UI.paper(ctx, 40, py2, pw2, ph2, 22);
        ctx.font = T.body(15, '900');
        var lines = UI.wrap(ctx, ov.text || '', pw2 - 40, 3);
        for (var li = 0; li < lines.length; li++) UI.text(ctx, lines[li], W / 2, py2 + 36 + li * 22, 15, T.INK, '900');
        if (ov.type === 'error') {
          Play._layoutButtons();
          var eb = Play.buttons[0];
          eb.y = py2 + ph2 - 74;
          UI.drawButton(ctx, eb, Play.pressed === 'home');
        }
      }
    }
  };

  /** 胜利弹窗：放射光、金星、飘带、缝线纸面板 */
  Play._drawWin = function (ctx) {
    var W = Game.W, H = Game.H, UI = Game.UI, T = Game.Theme;
    var P = Play._winPanel();
    var t = Game.BG.t;
    ctx.fillStyle = T.MASK;
    ctx.fillRect(0, 0, W, H);
    var cy = P.y + 60;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    UI.rays(ctx, W / 2, cy, Math.max(W, H), 16, 'rgba(255,220,120,0.10)', t * 0.15);
    ctx.restore();
    var rg = ctx.createRadialGradient(W / 2, cy, 10, W / 2, cy, 260);
    rg.addColorStop(0, 'rgba(255,230,140,0.5)');
    rg.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    UI.paper(ctx, P.x, P.y, P.w, P.h, 26);
    UI.ribbon(ctx, W / 2, P.y - 26, P.w - 26, 54);
    UI.title(ctx, '过关啦', W / 2, P.y - 2, 34, { depth: 3, grad: ['#FFFFFF', '#FFF2C2'] });
    UI.star(ctx, W / 2 - 66, P.y - 62, 20, -0.25);
    UI.star(ctx, W / 2, P.y - 78, 28, 0);
    UI.star(ctx, W / 2 + 66, P.y - 62, 20, 0.25);
    // 主视觉：本关关键物体（优先胜利相关实体），否则 😎
    var hero = Play._winHero();
    var hy = P.y + 104;
    var hg = ctx.createRadialGradient(W / 2, hy, 5, W / 2, hy, 76);
    hg.addColorStop(0, 'rgba(255,214,90,0.5)');
    hg.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(P.x, hy - 76, P.w, 152);
    Game.Emoji.draw(ctx, hero, W / 2, hy, 84);
    ctx.font = T.body(16, '900');
    var lines = UI.wrap(ctx, (Play.overlay && Play.overlay.text) || '过关！', P.w - 48, 2);
    for (var i = 0; i < lines.length; i++) UI.text(ctx, lines[i], W / 2, P.y + 176 + i * 22 - (lines.length - 1) * 8, 16, T.INK, '900');
    if (Play.level && Play.level.shareHook) {
      ctx.font = T.body(12.5, 'bold');
      var sh = UI.wrap(ctx, Play.level.shareHook, P.w - 56, 1)[0];
      UI.text(ctx, sh, W / 2, P.y + 208, 12.5, T.SUB, 'bold');
    }
    for (var j = 0; j < Play.buttons.length; j++) {
      var b = Play.buttons[j];
      if (b.cx != null) UI.iconButton(ctx, b, Play.pressed === b.id);
      else UI.drawButton(ctx, b, Play.pressed === b.id);
    }
  };

  Play._winHero = function () {
    var lv = Play.level, sc = Play.scene;
    var EM = Game.Emoji;
    if (lv && sc && lv.win) {
      var ids = [lv.win.target, lv.win.to, lv.win.from, lv.win.tap];
      for (var i = 0; i < ids.length; i++) {
        var e = typeof ids[i] === 'string' ? sc.find(ids[i]) : null;
        if (e) {
          var em = EM.split(e.label).emojis;
          if (em.length && EM.has(em[0])) return em[0];
        }
      }
    }
    return '😎';
  };

  Play.onTouchStart = function (x, y, touches) {
    Play.pressed = null;
    Play.hintHold = null;

    // overlay buttons
    if (Play.overlay) {
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
      if (btn && Game.UI.hit(btn, x, y)) {
        if (id === 'hint') {
          // if long-press win consumed, skip normal hint
          if (!(heldHint && heldHint.t >= 3000 && Play.level && Play.level.win && Play.level.win.target === 'hint_button')) {
            Play.useHint();
          }
        } else if (id === 'skip') Play.trySkip();
        else if (id === 'share') Game.App.shareFromPlay();
        else if (id === 'home') Game.App.goHome(true);
        else if (id === 'sound') {
          Game.save.soundOn = Game.save.soundOn === false;
          Game.Storage.save(Game.save);
          Game.FX.toast(Game.save.soundOn ? '音效已开启' : '音效已关闭');
          Play._layoutButtons();
        }
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
