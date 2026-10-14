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
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 50 + Math.random() * 80;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        t: 0,
        color: color || '#E8763A',
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
    if (toastBox) {
      var alpha = 1;
      if (toastBox.t < 120) alpha = toastBox.t / 120;
      else if (toastBox.t > toastBox.dur - 200) alpha = (toastBox.dur - toastBox.t) / 200;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      var tw = Math.min(W - 40, ctx.measureText ? 280 : 280);
      var text = toastBox.text;
      ctx.font = '14px sans-serif';
      var mw = Math.min(W - 48, Math.max(160, ctx.measureText(text).width + 36));
      var x = (W - mw) / 2;
      var y = 56;
      ctx.fillStyle = 'rgba(30,24,18,0.88)';
      roundRect(ctx, x, y, mw, 40, 10);
      ctx.fill();
      ctx.fillStyle = '#FFF8EE';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 2, y + 20);
      ctx.restore();
    }

    for (var i = 0; i < floaties.length; i++) {
      var f = floaties[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.t);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    for (var j = 0; j < particles.length; j++) {
      var p = particles[j];
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.6);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
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
