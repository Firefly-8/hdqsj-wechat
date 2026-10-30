/**
 * V2.0a+ 开场 0–3 分钟脚本：最小断言（无 wx 运行时）
 * node _intro_v2a_check.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var fail = 0;
function ok(c, m) { if (!c) { console.error('FAIL:', m); fail++; } else console.log('OK:', m); }

var dataSrc = fs.readFileSync(path.join(__dirname, 'js/data.js'), 'utf8');
var renderSrc = fs.readFileSync(path.join(__dirname, 'js/render.js'), 'utf8');
var appSrc = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
var readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');

global.Game = {};
global.globalThis = global;
eval(dataSrc);
var D = Game.DATA;
ok(!!D, 'Game.DATA loaded');
ok(!!D.INTRO && D.INTRO.LINE_B3 === '岛上多了座棚' || (D.INTRO && /岛上多了座棚/.test(D.INTRO.LINE_B3)), 'INTRO.LINE_B3 岛上多了座棚');
ok(typeof D.setThemeForce === 'function' && typeof D.clearThemeForce === 'function', 'theme force API');
ok(!!D.ISLAND_SLOTS && D.islandSlotForStage(121), 'home slot 121');

// simulate theme force
D.setThemeForce('C');
ok(D.getThemeInfo().id === 'C', 'force C ignores hour');
D.clearThemeForce();
ok(D.getThemeForce() == null, 'clear theme force');

ok(appSrc.indexOf('introStep') >= 0 && appSrc.indexOf('introDone') >= 0, 'save fields introStep/introDone');
ok(appSrc.indexOf('introBias') >= 0, 'introBias field');
ok(appSrc.indexOf('onIntroWreckTap') >= 0, 'wreck tap');
ok(appSrc.indexOf('onIntroBuildShelter') >= 0, 'build shelter');
ok(appSrc.indexOf('onIntroBias') >= 0, 'bias choice');
ok(appSrc.indexOf('beginIntro') >= 0, 'beginIntro');
ok(appSrc.indexOf('_introMigrated') >= 0 || appSrc.indexOf('saveVer') >= 0, 'migration');
ok(appSrc.indexOf("setThemeForce('C')") >= 0 || appSrc.indexOf('setThemeForce("C")') >= 0, 'lock theme C in intro');
ok(appSrc.indexOf('clearThemeForce') >= 0, 'clear theme on b5');
ok(appSrc.indexOf("stages.push(121)") >= 0 || appSrc.indexOf('stages.push(121)') >= 0, 'push 121');
ok(appSrc.indexOf('campUp(121)') >= 0, 'campUp(121) glow');

ok(renderSrc.indexOf('introBoardHidden') >= 0, 'render hides board via introBoardHidden');
ok(renderSrc.indexOf('drawIntroWreck') >= 0, 'wreck hotspot');
ok(renderSrc.indexOf('drawEmptyHomeGuide') >= 0, 'empty home guide');
ok(renderSrc.indexOf('drawIntroNarrativeVeil') >= 0, 'narrative veil');
ok(renderSrc.indexOf('drawIntroActions') >= 0, 'intro actions');
ok(renderSrc.indexOf('半高迷你盘') >= 0 || renderSrc.indexOf('整页藏棋盘') >= 0, 'comment: full-page hide board');
ok(renderSrc.indexOf("onIntroBias('reinforce')") >= 0 && renderSrc.indexOf("onIntroBias('food')") >= 0, 'equal bias buttons');

ok(/开场/.test(readme) && (/残骸|庇护所|intro/.test(readme)), 'README mentions intro');

try { new Function(renderSrc); ok(true, 'render.js parses'); } catch (e) { ok(false, 'render parse ' + e.message); }
try { new Function(appSrc); ok(true, 'app.js parses'); } catch (e) { ok(false, 'app parse ' + e.message); }
try { new Function(dataSrc); ok(true, 'data.js parses'); } catch (e) { ok(false, 'data parse ' + e.message); }

// migration smoke: old progressed save skips intro
var normalizeMatch = /function normalizeSave[\s\S]*?return s;\n  }/.exec(appSrc);
ok(!!normalizeMatch, 'normalizeSave present');
ok(appSrc.indexOf('welcomed || s.entered') >= 0 || appSrc.indexOf('s.welcomed || s.entered') >= 0, 'old save skip intro');

console.log(fail ? ('\n' + fail + ' failed') : '\nAll intro v2a+ checks passed');
process.exit(fail ? 1 : 0);
