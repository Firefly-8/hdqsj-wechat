/**
 * V2.0a 岛面可见：最小断言（无 wx 运行时）
 * node _island_v2a_check.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var fail = 0;
function ok(c, m) { if (!c) { console.error('FAIL:', m); fail++; } else console.log('OK:', m); }

var dataSrc = fs.readFileSync(path.join(__dirname, 'js/data.js'), 'utf8');
var renderSrc = fs.readFileSync(path.join(__dirname, 'js/render.js'), 'utf8');
var appSrc = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
var fxSrc = fs.readFileSync(path.join(__dirname, 'js/fx.js'), 'utf8');

// Stub Game + load data.js
global.Game = {};
global.globalThis = global;
// data.js uses globalThis.Game
eval(dataSrc);
var D = Game.DATA;
ok(!!D, 'Game.DATA loaded');
ok(Array.isArray(D.ISLAND_SLOTS) && D.ISLAND_SLOTS.length >= 4, 'ISLAND_SLOTS >= 4');

var need = { 101: 'fence', 121: 'home', 123: 'home', 122: 'store', 125: 'dock' };
var seen = {};
D.ISLAND_SLOTS.forEach(function (s) {
  ok(s.stageIds && s.stageIds.length, 'slot ' + s.id + ' has stageIds');
  ok(s.nx >= 0 && s.nx <= 1 && s.ny >= 0 && s.ny <= 1, 'slot ' + s.id + ' nx/ny in 0-1');
  ok(s.scale >= 0.85 && s.scale <= 1.0, 'slot ' + s.id + ' scale 0.85-1');
  ok(typeof s.rw === 'number' && typeof s.rh === 'number', 'slot ' + s.id + ' has rw/rh rect');
  ok(s.img === '' || s.img == null, 'slot ' + s.id + ' img empty (placeholder)');
  s.stageIds.forEach(function (id) { seen[id] = s.id; });
});
Object.keys(need).forEach(function (id) {
  ok(seen[+id] === need[id], 'stage ' + id + ' on slot ' + need[id]);
});

// home upgrade: empty → 121 → 123 replaces
ok(!D.resolveIslandSlot(D.ISLAND_SLOTS[1], []), 'empty stages → no home');
var r121 = D.resolveIslandSlot(D.ISLAND_SLOTS.find(function (s) { return s.id === 'home'; }), [121]);
ok(r121 && r121.stageId === 121 && /庇护|庇护所/.test(r121.label) || r121.label.indexOf('庇护') >= 0 || r121.em, '121 shows shelter');
var r123 = D.resolveIslandSlot(D.ISLAND_SLOTS.find(function (s) { return s.id === 'home'; }), [121, 123]);
ok(r123 && r123.stageId === 123, '121+123 → show 123 only');

ok(!!D.islandSlotForStage(121) && !D.islandSlotForStage(111), 'islandSlotForStage filter');

// anchors not equal-spaced 5 across
var nxs = D.ISLAND_SLOTS.map(function (s) { return s.nx; }).sort();
ok(nxs.length === 4, 'exactly 4 anchors (not 5 equal)');
ok(nxs[0] < 0.25 && nxs[3] > 0.8, 'left rear + right water span');

ok(renderSrc.indexOf('drawIslandBuildings') >= 0, 'render has drawIslandBuildings');
ok(renderSrc.indexOf('drawIslandNightVeil') >= 0, 'render has night veil');
ok(renderSrc.indexOf("switchTab('camp')") >= 0 || renderSrc.indexOf('switchTab("camp")') >= 0 || renderSrc.indexOf("switchTab('camp')") >= 0, 'slot hit → camp');
ok(fxSrc.indexOf('campUpStageId') >= 0, 'fx binds campUpStageId');
ok(appSrc.indexOf('campUp(stId)') >= 0, 'app passes stId to campUp');
ok(appSrc.indexOf('已立在岛上') >= 0 || appSrc.indexOf('\\u5DF2\\u7ACB\\u5728\\u5C9B\\u4E0A') >= 0, 'toast 已立在岛上');

// syntax smoke: render/fx/app are IIFEs needing more stubs — at least parse
try { new Function(renderSrc); ok(true, 'render.js parses'); } catch (e) { ok(false, 'render parse ' + e.message); }
try { new Function(fxSrc); ok(true, 'fx.js parses'); } catch (e) { ok(false, 'fx parse ' + e.message); }
try { new Function(appSrc); ok(true, 'app.js parses'); } catch (e) { ok(false, 'app parse ' + e.message); }

console.log(fail ? ('\n' + fail + ' failed') : '\nAll island v2a checks passed');
process.exit(fail ? 1 : 0);
