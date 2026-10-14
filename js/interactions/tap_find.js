/**
 * tap_find：点找物 / 多步点选 / 揭示后点数等
 */
(function () {
  'use strict';

  var TapFind = {};

  TapFind.create = function (level, scene, hooks) {
    var win = new Game.WinCtrl(level, scene, hooks);
    var sess = Game.InteractBase.createSession(scene, win);
    return {
      type: 'tap_find',
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
      getHint: function () {
        return win.getHint();
      },
      progressText: function () {
        return win.progressText();
      }
    };
  };

  Game.Interactions = Game.Interactions || {};
  Game.Interactions.tap_find = TapFind;
})();
