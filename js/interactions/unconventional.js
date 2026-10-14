/**
 * unconventional：点题干、摇一摇、拖出屏、旋转设备、长按、等待等
 */
(function () {
  'use strict';

  var Unconventional = {};

  Unconventional.create = function (level, scene, hooks) {
    var win = new Game.WinCtrl(level, scene, hooks);
    var sess = Game.InteractBase.createSession(scene, win);
    return {
      type: 'unconventional',
      win: win,
      sess: sess,
      onTouchStart: function (touches, x, y) {
        Game.InteractBase.onTouchStart(sess, touches, x, y);
      },
      onTouchMove: function (touches, x, y) {
        Game.InteractBase.onTouchMove(sess, touches, x, y);
      },
      onTouchEnd: function (x, y) {
        Game.InteractBase.onTouchEnd(sess, x, y);
      },
      update: function (dt) {
        Game.InteractBase.update(sess, dt);
      },
      onAccelerometer: function (res) {
        Game.InteractBase.onAccelerometer(sess, res);
      },
      /** 题干文字命中时由 play 场景调用 */
      tapTitleWord: function (word) {
        win.onTap({ id: 'title_word:' + word, visible: true }, 0, 0, {});
      },
      tapTitleText: function () {
        win.onTap({ id: 'title_text', visible: true }, 0, 0, {});
      },
      tapHintButtonLong: function (ms) {
        win.onLongPress({ id: 'hint_button' }, ms);
      },
      getHint: function () {
        return win.getHint();
      },
      progressText: function () {
        return win.progressText();
      }
    };
  };

  Game.Interactions = Game.Interactions || {};
  Game.Interactions.unconventional = Unconventional;
})();
