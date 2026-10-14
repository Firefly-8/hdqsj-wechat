/**
 * Node 冒烟：校验题包、模块加载、WinCtrl 基础路径（无 wx）
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var passed = 0;
function ok(name, cond, detail) {
  if (!cond) {
    console.error('FAIL', name, detail || '');
    process.exitCode = 1;
    return;
  }
  passed++;
  console.log('OK  ', name);
}

// --- packs ---
var pack0 = require('./levels/pack0.js');
var pack1 = require('./levels_pack1/levels/pack1.js');
ok('pack0 count 20', pack0.levels.length === 20);
ok('pack1 count 80', pack1.levels.length === 80);
ok('lv_001 id', pack0.levels[0].id === 'lv_001');
ok('lv_021 id', pack1.levels[0].id === 'lv_021');
ok('lv_100 id', pack1.levels[79].id === 'lv_100');

var types = { tap_find: 0, drag_combine: 0, unconventional: 0 };
pack0.levels.concat(pack1.levels).forEach(function (l) {
  types[l.type] = (types[l.type] || 0) + 1;
  ok('has win.action ' + l.id, l.win && l.win.action, l.id);
});
ok('has all 3 types', types.tap_find && types.drag_combine && types.unconventional, JSON.stringify(types));

// --- stub Game + load modules ---
global.Game = {};
global.wx = undefined;
global.requestAnimationFrame = function () {};

function load(rel) {
  require(path.join(__dirname, rel));
}

load('js/config.js');
load('js/analytics.js');
load('js/storage.js');
load('js/ad.js');
load('js/fx.js');
load('js/ui.js');
load('js/level_loader.js');
load('js/scene_build.js');
load('js/win.js');
load('js/interactions/base.js');
load('js/interactions/tap_find.js');
load('js/interactions/drag_combine.js');
load('js/interactions/unconventional.js');

ok('Config name', Game.Config.APP_NAME === '绝望岛求生记');
ok('AD none mode', Game.AD.mode === 'none' || !Game.Config.REWARD_UNIT);
Game.AD.init();
ok('no fake reward unit', !Game.Config.REWARD_UNIT);
ok('showReward returns false without unit', Game.AD.showReward('hint', function () {}, function () {}) === false);
ok('interstitial no-op', Game.AD.tryInterstitial('test') === false);

// storage without wx uses memory/local fallback
var s = Game.Storage.load();
ok('storage fresh index 0', s.levelIndex === 0);
s.levelIndex = 5;
s.clearedMax = 4;
Game.Storage.save(s);
var s2 = Game.Storage.load();
ok('storage persist', s2.levelIndex === 5 && s2.clearedMax === 4);

Game.LevelLoader.initPack0();
ok('loader pack0', Game.LevelLoader.pack0Count() === 20);
ok('loader get 0', Game.LevelLoader.getByIndex(0).id === 'lv_001');

// ensure pack1 via local fallback
var pack1Done = false;
Game.LevelLoader.ensurePack1(function (err, pack) {
  pack1Done = true;
  ok('pack1 load', !err && pack && pack.levels.length === 80, err);
  ok('loader all 100', Game.LevelLoader.count() === 100);
  ok('get lv_100', Game.LevelLoader.getByIndex(99).id === 'lv_100');
});
ok('pack1 sync in node', pack1Done);

// scene + win smoke for first 20
pack0.levels.forEach(function (level, i) {
  var scene = Game.SceneBuild.build(level, 375, 667);
  ok('scene ents ' + level.id, scene.entities.length > 0);
  var won = false;
  var win = new Game.WinCtrl(level, scene, {
    onWin: function () {
      won = true;
    },
    onFail: function () {}
  });
  // simulate a few canonical clears
  if (level.id === 'lv_001') {
    win.onTap(scene.find('biggest_coconut'), 0, 0);
    ok('win lv_001', won);
  }
  if (level.id === 'lv_003') {
    win.onTap({ id: 'title_word:小鸟', visible: true }, 0, 0);
    ok('win lv_003 title', won);
  }
  if (level.id === 'lv_007') {
    win.onShake(2);
    ok('win lv_007 shake', won);
  }
  if (level.id === 'lv_010') {
    var sun = scene.find('sun');
    sun.x = -100;
    win.onDragEnd(sun, null, 'sun', 0, 0);
    ok('win lv_010 offscreen', won);
  }
  var factory = Game.Interactions[level.type];
  ok('interaction factory ' + level.id, !!factory);
  var runner = factory.create(level, scene, { onWin: function () {}, onFail: function () {} });
  ok('runner ' + level.id, runner && runner.getHint());
});

// game.json subpackages
var gj = JSON.parse(fs.readFileSync(path.join(__dirname, 'game.json'), 'utf8'));
ok('portrait', gj.deviceOrientation === 'portrait');
ok('subpackage configured', gj.subpackages && gj.subpackages[0].name === 'levels_pack1');

// legacy not required by game.js
var entry = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
ok('entry not legacy', entry.indexOf('_legacy') < 0 || entry.indexOf('不加载') >= 0);
ok('entry brain modules', entry.indexOf('level_loader') >= 0 && entry.indexOf('scenes/play') >= 0);

console.log('\nPassed', passed, 'checks');
if (process.exitCode) {
  console.error('SMOKE FAILED');
  process.exit(1);
}
console.log('SMOKE OK');
