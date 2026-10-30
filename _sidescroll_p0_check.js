/**
 * V2 P0 横版荒岛：静态断言（无 wx 画布）
 * node _sidescroll_p0_check.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var fail = 0;
function ok(c, m) { if (!c) { console.error('FAIL:', m); fail++; } else console.log('OK:', m); }

var root = __dirname;
var ssSrc = fs.readFileSync(path.join(root, 'js/sidescroll.js'), 'utf8');
var appSrc = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
var renderSrc = fs.readFileSync(path.join(root, 'js/render.js'), 'utf8');
var gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
var readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
var adSrc = fs.readFileSync(path.join(root, 'js/ad.js'), 'utf8');

ok(gameSrc.indexOf("require('./js/sidescroll.js')") >= 0, 'game.js loads sidescroll');
ok(/DEFAULT_MODE\s*=\s*'sidescroll'/.test(ssSrc), 'default mode sidescroll');
ok(ssSrc.indexOf('islandSave_ss_v1') >= 0, 'separate ss save key');
ok(ssSrc.indexOf('Game.SideScroll') >= 0, 'exports Game.SideScroll');
ok(ssSrc.indexOf("result: 'tool'") >= 0 && ssSrc.indexOf("result: 'plank'") >= 0, 'two trial recipes');
ok(ssSrc.indexOf('???') >= 0, 'unknown recipe placeholder');
ok(ssSrc.indexOf('看视频重生') >= 0, 'revive CTA');
ok(ssSrc.indexOf("showReward('revive'") >= 0, 'hooks AD revive');
ok(ssSrc.indexOf('简陋棚') >= 0 && ssSrc.indexOf('SHELTER_NEED') >= 0, 'shelter place');
ok(ssSrc.indexOf('野猪') >= 0, 'boar');
ok(ssSrc.indexOf('你在沙滩上醒来') >= 0, 'wake copy');
ok(ssSrc.indexOf('joy') >= 0 && ssSrc.indexOf('drawJoystick') >= 0, 'joystick');
ok(ssSrc.indexOf('drawContextBtn') >= 0, 'context button');

ok(appSrc.indexOf('shouldUseSideScroll') >= 0, 'app routes by shouldUseSideScroll');
ok(appSrc.indexOf('SideScroll.beginRun') >= 0, 'app beginRun');
ok(appSrc.indexOf('SideScroll.update') >= 0, 'app update tick');
ok(appSrc.indexOf('SideScroll.onTouchStart') >= 0, 'app joy touch');
ok(appSrc.indexOf("type === 'revive'") >= 0, 'openAdModal revive copy');

ok(renderSrc.indexOf("sc === 'sidescroll'") >= 0, 'render sidescroll branch');
ok(adSrc.indexOf('revive') >= 0, 'ad.js documents revive');

ok(/islandSave_ss_v1/.test(readme) && /横版/.test(readme), 'README how-to-try');
ok(/DEFAULT_MODE|PLAY_MODE/.test(readme), 'README mode switch');

try { new Function(ssSrc); ok(true, 'sidescroll.js parses'); } catch (e) { ok(false, 'sidescroll parse ' + e.message); }
try { new Function(appSrc); ok(true, 'app.js parses'); } catch (e) { ok(false, 'app parse ' + e.message); }
try { new Function(renderSrc); ok(true, 'render.js parses'); } catch (e) { ok(false, 'render parse ' + e.message); }

// Lightweight recipe matcher smoke (eval module with mocks)
global.Game = { PLAY_MODE: 'sidescroll', FX: { toast: function () {} }, hits: [] };
global.wx = {
  getStorageSync: function () { return ''; },
  setStorageSync: function () {},
  removeStorageSync: function () {}
};
global.globalThis = global;
eval(ssSrc);
ok(!!Game.SideScroll, 'SideScroll after eval');
ok(Game.SideScroll.shouldUseSideScroll() === true, 'shouldUseSideScroll true');
Game.SideScroll.beginRun(true);
ok(Game.scene === 'sidescroll', 'scene sidescroll after beginRun');
var st = Game.SideScroll.getState();
ok(st && st.worldDrops && st.worldDrops.length > 0, 'world drops spawned');
ok(st.playerX > 400 && st.playerX < 1000, 'spawn on beach');
ok(!st.shelterBuilt, 'no shelter at start');
ok(st.boar && st.boar.alive, 'boar alive');
ok(Game.SideScroll.RECIPES.length >= 2, '>=2 recipes');
ok(Game.SideScroll.SHELTER_NEED.driftwood === 4, 'shelter need wood 4');

// craft smoke
st.inv = { driftwood: 2, rope: 1 };
st.craftSlotA = 'driftwood';
st.craftSlotB = 'rope';
// call tryCraft via bag UI path — not exported; simulate match
var matched = null;
Game.SideScroll.RECIPES.forEach(function (r) {
  if ((r.a === 'driftwood' && r.b === 'rope') || (r.a === 'rope' && r.b === 'driftwood')) matched = r;
});
ok(matched && matched.result === 'tool', 'driftwood+rope => tool');

Game.PLAY_MODE = 'board';
ok(Game.SideScroll.shouldUseSideScroll() === false, 'board mode off');

console.log(fail ? ('\n' + fail + ' failed') : '\nAll sidescroll P0 checks passed');
process.exit(fail ? 1 : 0);
