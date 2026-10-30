/**
 * 绝望岛求生记 · 微信小游戏入口
 * 鲁滨逊漂流记主题 · 合成放置 · IAA
 * 模块通过全局 Game 单例挂载，避免 CommonJS 循环依赖
 *
 * V2 P0：默认横版荒岛生存（js/sidescroll.js）；旧棋盘仍保留，Game.PLAY_MODE='board' 可切回
 */
require('./js/data.js');
require('./js/fx.js');
require('./js/ad.js');
require('./js/render.js');
require('./js/app.js');
require('./js/sidescroll.js');

Game.App.start();
