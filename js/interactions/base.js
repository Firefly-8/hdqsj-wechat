/**
 * 交互公共：触摸拖拽状态、命中、摇一摇/旋转/捏合辅助
 */
(function () {
  'use strict';

  var Base = {};

  Base.createSession = function (scene, winCtrl) {
    return {
      scene: scene,
      win: winCtrl,
      drag: null,
      touching: false,
      longPress: null,
      fingers: 0,
      pinchStartDist: 0,
      pinchStartAngle: 0,
      shakeAcc: 0,
      lastAcc: null
    };
  };

  Base.onTouchStart = function (sess, touches, lx, ly) {
    sess.touching = true;
    sess.fingers = touches.length;
    if (touches.length >= 2) {
      var t0 = touches[0];
      var t1 = touches[1];
      sess.pinchStartDist = dist(t0, t1);
      sess.pinchStartAngle = angle(t0, t1);
      sess.drag = null;
      if (sess.fingers >= 2) {
        var ent2 = sess.scene.hit(lx, ly);
        sess.win.onTap(ent2, lx, ly, { fingers: sess.fingers });
      }
      return;
    }
    var ent = sess.scene.hit(lx, ly);
    sess.longPress = { ent: ent, t: 0, x: lx, y: ly };
    if (ent && ent.draggable) {
      sess.drag = {
        ent: ent,
        ox: ent.x,
        oy: ent.y,
        dx: lx - ent.x,
        dy: ly - ent.y
      };
    } else if (ent) {
      sess.win.onTap(ent, lx, ly, { fingers: 1 });
    } else {
      sess.win.onTap(null, lx, ly, { fingers: 1 });
    }
  };

  Base.onTouchMove = function (sess, touches, lx, ly) {
    if (touches.length >= 2 && sess.pinchStartDist) {
      var d = dist(touches[0], touches[1]);
      var a = angle(touches[0], touches[1]);
      var scale = d / (sess.pinchStartDist || d);
      var rot = a - sess.pinchStartAngle;
      sess.win.onPinch(scale, rot);
      return;
    }
    if (sess.longPress) {
      var lp = sess.longPress;
      if (Math.abs(lx - lp.x) > 12 || Math.abs(ly - lp.y) > 12) sess.longPress = null;
    }
    if (sess.drag && sess.drag.ent) {
      sess.drag.ent.x = lx - sess.drag.dx;
      sess.drag.ent.y = ly - sess.drag.dy;
    }
  };

  Base.onTouchEnd = function (sess, lx, ly) {
    sess.touching = false;
    sess.fingers = 0;
    if (sess.drag && sess.drag.ent) {
      var ent = sess.drag.ent;
      var target = null;
      var entities = sess.scene.entities;
      for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        if (e === ent || !e.visible) continue;
        if (sess.scene.overlap(ent, e, 12)) {
          if (!target || e.z >= target.z) target = e;
        }
      }
      sess.win.onDragEnd(ent, target, ent.id, lx, ly);
      sess.drag = null;
    }
    sess.longPress = null;
    sess.pinchStartDist = 0;
  };

  Base.update = function (sess, dt) {
    if (sess.longPress) {
      sess.longPress.t += dt * 1000;
      if (sess.longPress.t >= 500) {
        sess.win.onLongPress(sess.longPress.ent || { id: 'hint_button' }, sess.longPress.t);
      }
    }
    sess.win.onWaitTick(dt, sess.touching);
  };

  Base.onAccelerometer = function (sess, res) {
    // shake detection
    var x = res.x || 0;
    var y = res.y || 0;
    var z = res.z || 0;
    var mag = Math.sqrt(x * x + y * y + z * z);
    if (sess.lastAcc != null) {
      var delta = Math.abs(mag - sess.lastAcc);
      if (delta > 0.6) {
        sess.win.onShake(0.05);
      }
    }
    sess.lastAcc = mag;
    // upside down roughly
    if (y > 0.85 || (typeof res.y === 'number' && res.y > 0.7 && Math.abs(x) < 0.4)) {
      sess._orientFrames = (sess._orientFrames || 0) + 1;
      if (sess._orientFrames > 8) sess.win.onDeviceRotate('upside_down');
    } else {
      sess._orientFrames = 0;
    }
  };

  function dist(a, b) {
    var dx = (a.clientX || a.x) - (b.clientX || b.x);
    var dy = (a.clientY || a.y) - (b.clientY || b.y);
    return Math.sqrt(dx * dx + dy * dy) || 1;
  }

  function angle(a, b) {
    return Math.atan2((b.clientY || b.y) - (a.clientY || a.y), (b.clientX || a.x) - (a.clientX || a.x));
  }

  Game.InteractBase = Base;
})();
