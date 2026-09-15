/**
 * 绝望岛求生记 · 微信小游戏入口
 * 鲁滨逊漂流记主题 · 合成放置 · IAA
 * 模块通过全局 Game 单例挂载，避免 CommonJS 循环依赖
 */
require('./js/data.js');
require('./js/fx.js');
require('./js/ad.js');
require('./js/render.js');
require('./js/app.js');

Game.App.start();
