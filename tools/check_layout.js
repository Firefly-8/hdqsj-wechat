/**
 * 关卡布局自检：两种屏幕（375×812 / 375×667）
 * 检查：越界、遮挡标题板/底栏、地面物体不在沙滩、可点区域过小、非预期包围盒重叠
 * 预期叠放：布局里显式设置了 z 的实体之间，或 meta.covers 关系，不算重叠
 * 用法：node tools/check_layout.js
 */
var path = require('path');
var ROOT = path.join(__dirname, '..');
global.Game = {};
['config', 'analytics', 'storage', 'ad', 'theme', 'fx', 'ui', 'emoji', 'level_loader', 'level_layouts', 'scene_build', 'win'].forEach(function (m) {
  require(path.join(ROOT, 'js', m + '.js'));
});
var levels = require(path.join(ROOT, 'levels/pack0.js')).levels.concat(require(path.join(ROOT, 'levels_pack1/levels/pack1.js')).levels);
function setScreen(H) {
  Game.W = 375; Game.H = H;
  var sb = H >= 800 ? 44 : 20;
  global.wx = { getMenuButtonBoundingClientRect: function () { return { left: 281, top: sb + 4, bottom: sb + 36, width: 87, height: 32 }; } };
  Game.Theme.computeLayout({ screenWidth: 375, screenHeight: H, statusBarHeight: sb, safeArea: { top: sb, bottom: H - (H >= 800 ? 34 : 0) } });
  global.wx = undefined;
}
function inter(a, b) {
  var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
var total = 0;
[812, 667].forEach(function (H) {
  setScreen(H);
  var L = Game.Theme.layout, Z = Game.SceneBuild.zones(375, H);
  var top = L.boardY + L.boardH, bottom = L.bottomBarY;
  levels.forEach(function (lv) {
    var sc = Game.SceneBuild.build(lv, 375, H), spec = Game.LevelLayouts[lv.id] || [];
    var zOf = {}; spec.forEach(function (s) { if (s[6] && s[6].z != null) zOf[s[0]] = 1; });
    var es = sc.entities.filter(function (e) { return e.visible; });
    var errs = [];
    es.forEach(function (e) {
      var b = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (b.x < -1 || b.x + b.w > 376) errs.push('横向越界 ' + e.id);
      if (b.y < top - 2) errs.push('压标题板 ' + e.id + ' y=' + Math.round(b.y) + '<' + top);
      if (b.y + b.h > bottom + 2) errs.push('压底栏 ' + e.id + ' 底=' + Math.round(b.y + b.h) + '>' + bottom);
      if (!e.deco && (e.draggable || e.tappable !== false)) {
        var hb = e.drawSize ? Math.min(e.w, e.h) : Math.min(e.w, e.h);
        if (hb < 38) errs.push('可点区过小 ' + e.id + ' ' + Math.round(hb));
      }
      if (e._style !== 'sky' && e._style !== 'answer' && spec.length && (e.y + e.h) < Z.sand[0] - 4 && !zOf[e.id])
        errs.push('地面物体悬空 ' + e.id);
    });
    for (var i = 0; i < es.length; i++) for (var j = i + 1; j < es.length; j++) {
      var a = es[i], b = es[j];
      if (a.deco || b.deco || zOf[a.id] || zOf[b.id]) continue;
      if ((a.meta && a.meta.covers === b.id) || (b.meta && b.meta.covers === a.id)) continue;
      var s = inter(a, b), m = Math.min(a.w * a.h, b.w * b.h);
      if (m && s / m > 0.18) errs.push('重叠 ' + a.id + '×' + b.id + ' ' + Math.round(s / m * 100) + '%');
    }
    if (errs.length) { total += errs.length; console.log('[' + H + '] ' + lv.id + ' ' + lv.title + '：' + errs.join('；')); }
  });
});
console.log(total ? '\nCHECK: ' + total + ' 个问题' : 'CHECK OK：100 关 × 2 屏布局无越界/重叠');
process.exit(total ? 1 : 0);
