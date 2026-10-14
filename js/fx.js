/**
 * 轻量动效：toast / 飘字 / 简单粒子
 */
(function () {
  'use strict';

  var toastBox = null;
  var floaties = [];
  var particles = [];

  var FX = {};

  FX.toast = function (msg, dur) {
    toastBox = { text: String(msg || ''), t: 0, dur: dur || 1600 };
  };

  FX.floaty = function (text, x, y) {
    floaties.push({ text: text, x: x, y: y, t: 0 });
    if (floaties.length > 20) floaties.shift();
  };

  FX.sparkle = function (x, y, color) {
    for (var i = 0; i < 16; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 50 + Math.random() * 80;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        t: 0,
        color: color || '#FFC93A',
        size: 2 + Math.random() * 3
      });
    }
  };

  FX.update = function (dt) {
    if (toastBox) {
      toastBox.t += dt * 1000;
      if (toastBox.t >= toastBox.dur) toastBox = null;
    }
    for (var i = floaties.length - 1; i >= 0; i--) {
      floaties[i].t += dt;
      floaties[i].y -= 40 * dt;
      if (floaties[i].t > 1) floaties.splice(i, 1);
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      if (p.t > 0.6) particles.splice(j, 1);
    }
  };

  FX.draw = function (ctx, W) {
    var UI = Game.UI, T = Game.Theme, L = T.layout;
    if (toastBox) {
      var alpha = 1;
      if (toastBox.t < 120) alpha = toastBox.t / 120;
      else if (toastBox.t > toastBox.dur - 200) alpha = (toastBox.dur - toastBox.t) / 200;
      var pop = toastBox.t < 160 ? 0.9 + 0.1 * (toastBox.t / 160) : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.font = T.body(14, '900');
      var lines = UI.wrap(ctx, toastBox.text, W - 96, 2);
      var lw = 0;
      for (var li = 0; li < lines.length; li++) lw = Math.max(lw, ctx.measureText(lines[li]).width);
      var mw = Math.min(W - 40, Math.max(150, lw + 44));
      var mh = 22 + lines.length * 19;
      var y = (L ? L.bottomBarY : Game.H - 90) - mh - 26;
      var x = (W - mw) / 2;
      ctx.translate(W / 2, y + mh / 2);
      ctx.scale(pop, pop);
      ctx.translate(-W / 2, -(y + mh / 2));
      UI.pill(ctx, x, y, mw, mh, {});
      for (var lj = 0; lj < lines.length; lj++) {
        UI.text(ctx, lines[lj], W / 2, y + mh / 2 + (lj - (lines.length - 1) / 2) * 19, 14, T.INK, '900');
      }
      ctx.restore();
    }

    for (var i = 0; i < floaties.length; i++) {
      var f = floaties[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.t);
      UI.outlineText(ctx, f.text, f.x, f.y, 18, '#FFF3A0');
      ctx.restore();
    }

    for (var j = 0; j < particles.length; j++) {
      var p = particles[j];
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.6);
      UI.starPath(ctx, p.x, p.y, p.size * 1.8, p.size * 0.8, p.t * 6);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = T.INK;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  Game.FX = FX;
})();
