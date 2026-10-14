/**
 * 视觉主题：卡通荒岛贴纸风（见 ui-unify-plan.md / game-ui-taste.md）
 * 色板、字体、布局（安全区 / 胶囊按钮）统一在此
 */
(function () {
  'use strict';

  var T = {
    INK: '#3B2414', // 全局描边（暖深棕，不用纯黑）
    INK_SOFT: '#5A3216',
    SUB: '#9A6A3A',
    PAPER: '#FFF9E8',
    PAPER_D: '#F6E3BA',
    WOOD: '#D99B5C',
    WOOD_D: '#8A5428',
    CREAM_TXT: '#FFF3D0',
    GREEN: '#5CC34A', // 唯一主色：主按钮
    SAND_BTN: '#F3E2BE', // 次按钮
    SKY_BTN: '#6CC3E0',
    GOLD: '#FFC93A', // 奖励色
    CORAL: '#E2553A',
    SHADOW: 'rgba(59,36,20,0.35)',
    MASK: 'rgba(30,18,8,0.58)',
    // 字体：DISPLAY 由 wx.loadFont 加载站酷快乐体子集，失败回退系统字体
    DISPLAY: 'sans-serif',
    BODY: '"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif',
    fontLoaded: false
  };

  T.shade = function (hex, a) {
    var n = parseInt(hex.slice(1), 16);
    var r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = a < 0 ? 0 : 255, t = Math.abs(a);
    r = Math.round(r + (f - r) * t);
    g = Math.round(g + (f - g) * t);
    b = Math.round(b + (f - b) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  };

  T.display = function (size) {
    return size + 'px ' + T.DISPLAY;
  };
  T.body = function (size, weight) {
    return (weight || 'bold') + ' ' + size + 'px ' + T.BODY;
  };

  /** 加载站酷快乐体子集（须在创建主 canvas 前调用） */
  T.loadFonts = function () {
    try {
      if (typeof wx !== 'undefined' && wx.loadFont) {
        var fam = wx.loadFont('assets/fonts/kuaile.ttf');
        if (fam) {
          T.DISPLAY = '"' + fam + '",' + T.BODY;
          T.fontLoaded = true;
        }
      }
    } catch (e) {}
    if (!T.fontLoaded) T.DISPLAY = T.BODY;
  };

  /** 安全区与胶囊按钮 → 逻辑坐标布局 */
  T.computeLayout = function (sys) {
    var k = Game.W / (sys.screenWidth || Game.W);
    var top = ((sys.safeArea && sys.safeArea.top) || sys.statusBarHeight || 20) * k;
    var bottomInset = 0;
    if (sys.safeArea && sys.screenHeight) bottomInset = Math.max(0, (sys.screenHeight - sys.safeArea.bottom) * k);
    var cap = null;
    try {
      if (wx.getMenuButtonBoundingClientRect) cap = wx.getMenuButtonBoundingClientRect();
    } catch (e) {}
    var capsule = cap && cap.width > 0 && cap.bottom > cap.top && cap.top < 200 && cap.left > 120
      ? { left: cap.left * k, top: cap.top * k, bottom: cap.bottom * k, h: cap.height * k }
      : { left: Game.W - 95, top: top + 6, bottom: top + 38, h: 32 };
    var barY = capsule.top + capsule.h / 2; // 顶栏中线与胶囊对齐
    var boardY = capsule.bottom + 18;
    var boardH = 84;
    T.layout = {
      safeTop: top,
      safeBottom: bottomInset,
      capsule: capsule,
      barY: barY,
      boardY: boardY,
      boardH: boardH,
      areaTop: boardY + boardH + 16,
      stageTop: Math.round(Game.H * 0.44) + 6, // 与 background.js play 地平线+海面高度一致
      bottomBarY: Game.H - Math.max(bottomInset, 10) - 76
    };
    return T.layout;
  };

  Game.Theme = T;
})();
