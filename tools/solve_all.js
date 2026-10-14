/**
 * 全 100 关通关模拟 + 可点性检查（两种屏幕）
 * 对每关按 win.action 走标准解法，调用真实 WinCtrl；
 * 每次点击/拖拽前检查目标可见、非装饰，且在其包围盒内能被 hitTest 命中（未被遮挡）。
 * 用法：node tools/solve_all.js
 */
var path = require('path');
var ROOT = path.join(__dirname, '..');
global.Game = {};
global.wx = undefined;
['config', 'analytics', 'storage', 'ad', 'theme', 'fx', 'ui', 'emoji', 'level_loader', 'level_layouts', 'scene_build', 'win'].forEach(function (m) {
  require(path.join(ROOT, 'js', m + '.js'));
});
Game.FX = { toast: function () {}, sparkle: function () {} };
var levels = require(path.join(ROOT, 'levels/pack0.js')).levels.concat(require(path.join(ROOT, 'levels_pack1/levels/pack1.js')).levels);

function setScreen(H) {
  Game.W = 375;
  Game.H = H;
  var sb = H >= 800 ? 44 : 20;
  global.wx = { getMenuButtonBoundingClientRect: function () { return { left: 281, top: sb + 4, bottom: sb + 36, width: 87, height: 32 }; } };
  Game.Theme.computeLayout({ screenWidth: 375, screenHeight: H, statusBarHeight: sb, safeArea: { top: sb, bottom: H - (H >= 800 ? 34 : 0) } });
  global.wx = undefined;
}

function reachable(scene, e) {
  var pts = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]];
  for (var i = 0; i < pts.length; i++) {
    if (scene.hit(e.x + e.w * pts[i][0], e.y + e.h * pts[i][1]) === e) return true;
  }
  return false;
}

function solve(level, H) {
  var scene = Game.SceneBuild.build(level, 375, H);
  var won = false, errs = [];
  var w = level.win, a = w.action;
  var ctrl = new Game.WinCtrl(level, scene, { onWin: function () { won = true; }, onFail: function () {} });
  function get(id, why) {
    if (typeof id === 'string' && id.indexOf('title_') === 0) return { id: id, visible: true, x: 0, y: 0, w: 1, h: 1, synthetic: true };
    var e = scene.find(id);
    if (!e) { errs.push('缺实体 ' + id + ' (' + why + ')'); return { id: id, visible: true, x: 0, y: 0, w: 1, h: 1 }; }
    if (!e.visible) errs.push('不可见 ' + id + ' (' + why + ')');
    else if (e.deco) errs.push('装饰不可点 ' + id);
    else if (!reachable(scene, e)) errs.push('被遮挡/点不到 ' + id + ' (' + why + ')');
    return e;
  }
  function tap(id, extra) { ctrl.onTap(get(id, 'tap'), 0, 0, extra); }
  function drag(from, to) {
    var f = get(from, 'drag');
    var t = to ? get(to, 'drop') : null;
    ctrl.onDragEnd(f, t, f.id, 0, 0);
  }
  function dragOff(id) { var f = get(id, 'drag'); f.x = -600; ctrl.onDragEnd(f, null, f.id, 0, 0); }
  function tapN(re, n) {
    var c = 0;
    scene.entities.slice().forEach(function (e) {
      if (c < n && e.visible && !e.deco && re.test(e.id)) { tap(e.id); c++; }
    });
    if (c < n) errs.push('可点数量不足 ' + c + '/' + n);
  }
  function list(v) { return Array.isArray(v) ? v : v ? [v] : []; }
  switch (a) {
    case 'tap': tap(w.target); break;
    case 'drag': case 'drag_combine_or_tap':
      if (w.all) scene.entities.slice().forEach(function (e) { if (e.visible && (e.id === w.from || (e.meta && e.meta.aliasOf === w.from))) drag(e.id, w.to); });
      else drag(w.from, w.to);
      break;
    case 'drag_offscreen': dragOff(w.target); break;
    case 'drag_off': dragOff(w.target); drag(w.then_drag, null); break;
    case 'drag_offscreen_then_tap': dragOff(w.move); tap(w.tap); break;
    case 'drag_then_tap':
      if (w.move) drag(w.move, null); else drag(w.from, w.to);
      tap(w.tap || w.then); break;
    case 'drag_then_tap_all':
      if (w.move) drag(w.move, null); else drag(w.from, w.to);
      tapN(/./, w.count || 5); break;
    case 'tap_all': list(w.targets).forEach(function (t) { tap(t); }); break;
    case 'tap_all_diffs': for (var i = 0; i < (w.count || 2); i++) tap('diff_' + i); break;
    case 'reveal_then_count': if (w.hide) drag(w.hide, null); tap('answer_' + w.answer); break;
    case 'input_or_tap_answer': case 'tap_or_input': tap('answer_' + w.answer); break;
    case 'drag_apart_then_answer': drag(w.target, null); tap('answer_' + w.answer); break;
    case 'drag_sequence':
      (w.steps || []).forEach(function (s) {
        if (s.to === 'each_other') {
          var mate = scene.entities.filter(function (e) { return e.visible && e.id !== s.from && (/log/.test(e.id) || (e.meta && e.meta.aliasOf === s.from)); })[0];
          drag(s.from, mate && mate.id);
        } else drag(s.from, s.to);
      }); break;
    case 'drag_merge_then_tap': drag(w.targets, w.mergeTo); tap(w.mergeTo); break;
    case 'drag_reveal_then_tap': case 'drag_crack_then_tap':
      var mvId = w.move || (scene.find(w.targets) ? w.targets : w.tap);
      var mvE = scene.find(mvId);
      if (mvE && w.move) { mvE.x = 4; mvE.y = scene.area.y; } // 玩家把遮挡物拖到一边
      drag(mvId, null); tap(w.tap); break;
    case 'drag_reveal_then_tap_diffs':
      var mv = scene.entities.filter(function (e) { return e.visible && !e.deco && e.draggable; })[0] || scene.entities.filter(function (e) { return !e.deco; })[0];
      ctrl.onDragEnd(mv, null, mv.id, 0, 0);
      for (var d = 0; d < (w.count || 2); d++) tap('diff_' + d); break;
    case 'swipe_reveal_then_tap': ctrl.onDragEnd(scene.entities[0], null, '', 0, 0); tapN(/coin/, w.count || 5); break;
    case 'tap_or_drag_stars': tapN(/star/, w.count || 5); break;
    case 'device_rotate': case 'device_rotate_or_tap': ctrl.onDeviceRotate('upside_down'); break;
    case 'pinch_zoom_out': ctrl.onPinch(0.5, 0); tap(w.then_tap); break;
    case 'pinch_then_drag': ctrl.onPinch(0.5, 0); drag(w.target, w.to); break;
    case 'pinch_rotate': ctrl.onPinch(1, 3.1); break;
    case 'tap_then_drag': tap(w.pick); drag(w.pick, w.to); break;
    case 'tap_then_reach': tap(w.open); tap(w.then_tap); break;
    case 'long_press': ctrl.onLongPress(w.target === 'hint_button' ? { id: 'hint_button' } : get(w.target, 'long'), (w.durationMs || 3000) + 100); break;
    case 'two_finger_tap': tap(w.target, { fingers: 2 }); break;
    case 'clear_then_drag': list(w.clear).forEach(function (c) { if (c.indexOf('title_') === 0 || scene.find(c)) drag(c, null); }); drag(w.from, w.to); break;
    case 'drag_arrange':
      var mv2 = scene.entities.filter(function (e) { return e.visible && !e.deco; });
      mv2.slice(0, 2).forEach(function (e) { drag(e.id, null); }); break;
    case 'mute_or_volume_down': var v = get('volume_icon', 'drag'); v.y = v.oy + 60; ctrl.onDragEnd(v, null, v.id, 0, 0); break;
    case 'drag_all': case 'drag_any_of': (w.items || []).forEach(function (it) { drag(it, w.to); }); break;
    case 'drag_stack': (w.order || []).forEach(function (it) { drag(it, null); }); break;
    case 'drag_puzzle': for (var p = 0; p < (w.pieces || 4); p++) drag('piece_' + p, 'puzzle_board'); break;
    case 'wait': ctrl.onWaitTick(((w.durationMs || 15000) + 100) / 1000, false); break;
    case 'shake': ctrl.onShake(5); break;
    case 'tap_sequence': case 'multi_tap': list(w.order || w.sequence || w.steps).forEach(function (t) { tap(t); }); break;
    case 'sequence':
      list(w.sequence || w.steps).forEach(function (s) {
        if (s.indexOf('drag') >= 0) { var f = scene.entities.filter(function (e) { return e.draggable && e.visible; })[0] || scene.find('dogfood') || scene.find('food'); ctrl.onDragEnd(f, get('dog', 'drop'), f.id, 0, 0); }
        else tap(s.replace(/^tap_/, '') === 'dogfood' && !scene.find('dogfood') ? 'food' : (scene.find(s) ? s : s.replace(/^tap_/, '')));
      }); break;
    case 'drag_probe_then_tap':
      var sheep = scene.entities.filter(function (e) { return /sheep|wolf/.test(e.id) && e.visible; })[0];
      drag(w.probe, sheep && sheep.id); tap(w.tap); break;
    default: errs.push('未覆盖动作 ' + a);
  }
  if (!won) errs.push('未通关');
  return errs;
}

var bad = 0;
[812, 667].forEach(function (H) {
  setScreen(H);
  levels.forEach(function (lv) {
    var errs = solve(lv, H);
    if (errs.length) { bad++; console.log('[' + H + '] ' + lv.id + ' ' + lv.title + ' (' + lv.win.action + '): ' + errs.join('；')); }
  });
});
console.log(bad ? '\nSOLVE: ' + bad + ' 个问题' : 'SOLVE OK：100 关 × 2 屏全部可通关');
process.exit(bad ? 1 : 0);
