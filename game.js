/**
 * 绝望岛求生记 · 微信小游戏入口
 * 玩法：脑洞关卡 IAA（配置驱动）
 * 旧合成放置逻辑见 _legacy/（默认不加载）
 */
var Game = {};

require('./js/config.js');
require('./js/analytics.js');
require('./js/storage.js');
require('./js/ad.js');
require('./js/fx.js');
require('./js/ui.js');
require('./js/level_loader.js');
require('./js/scene_build.js');
require('./js/win.js');
require('./js/interactions/base.js');
require('./js/interactions/tap_find.js');
require('./js/interactions/drag_combine.js');
require('./js/interactions/unconventional.js');
require('./js/scenes/home.js');
require('./js/scenes/play.js');
require('./js/app.js');

Game.App.start();
