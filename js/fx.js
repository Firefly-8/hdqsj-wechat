/**
 * 动效层：飘字 / 粒子 / toast / 天数过渡 / 营地升级光晕
 * 全部用 Canvas 每帧更新，复刻网页版动效细节
 */
(function () {
  'use strict';

  var floaties = [];   // 上飘文字
  var particles = [];  // 合成粒子
  var toastBox = null; // toast 状态
  var dayTrans = null; // 天数过渡状态
  var campUpT = 0;     // 营地标签升级动画计时

  var FX = {};

  // ---- 飘字（对应网页 .floaty：上飘 40px + 淡出 1s）----
  FX.floaty = function (text, x, y) {
    floaties.push({ text: text, x: x, y: y, t: 0, life: 1 });
    if (floaties.length > 24) floaties.shift();
  };

  // ---- 合成粒子（对应网页 pop 的视觉补充）----
  FX.sparkle = function (x, y, color, n) {
    n = n || 8;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 60;
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        t: 0, life: 0.5, color: color || '#E8763A', size: 3 + Math.random() * 3
      });
    }
  };

  // ---- toast（对应网页 .toast：顶部弹出，1600/2400ms）----
  FX.toast = function (msg, dur) {
    toastBox = { text: msg, t: 0, dur: dur || 1600, shown: false };
  };

  // ---- 天数过渡（对应网页 #dayTrans：暗幕+太阳升起+第N天缩放，1.7s）----
  FX.dayTransition = function (day, cb) {
    var D = Game.DATA;
    var k = (day - 1) % 4;
    dayTrans = {
      t: 0, dur: 1700, day: day,
      icon: D.DT_ICONS[k], sub: D.DT_SUBS[k], cb: cb
    };
  };

  // ---- 营地升级光晕（对应网页 .camp-tag.up：scale 1→1.18→.96→1 + 光晕 1.1s）----
  FX.campUp = function () {
    campUpT = 1.1;
  };
  FX.campUpActive = function () { return campUpT > 0; };
  FX.campUpTime = function () { return campUpT; };

  // V1.5: 采集动画效果（1.5秒，包含抖动 + 光效 + 屏幕闪烁）
  var gatherAnimT = 0;
  var gatherAnimCb = null;
  FX.gatherAnim = function (cb) {
    gatherAnimT = 1.5; // 1.5秒动画
    gatherAnimCb = cb;
  };
  FX.gatherAnimActive = function () { return gatherAnimT > 0; };
  FX.gatherAnimTime = function () { return gatherAnimT; };

  // ---- 每帧更新 ----
  FX.update = function (dt) {
    var i;
    for (i = floaties.length - 1; i >= 0; i--) {
      var f = floaties[i];
      f.t += dt;
      if (f.t >= f.life) floaties.splice(i, 1);
    }
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt; // 重力
      if (p.t >= p.life) particles.splice(i, 1);
    }
    if (toastBox) {
      toastBox.t += dt * 1000;
      if (toastBox.t >= toastBox.dur) toastBox = null;
    }
    if (dayTrans) {
      dayTrans.t += dt * 1000;
      if (dayTrans.t >= dayTrans.dur) {
        var cb = dayTrans.cb;
        dayTrans = null;
        if (cb) cb();
      }
    }
    if (campUpT > 0) campUpT -= dt;
    // V1.5: 采集动画更新
    if (gatherAnimT > 0) {
      gatherAnimT -= dt;
      if (gatherAnimT <= 0 && gatherAnimCb) {
        var cb = gatherAnimCb;
        gatherAnimCb = null;
        if (cb) cb();
      }
    }
  };

  // ---- 绘制覆盖层（在场景绘制之后调用）----
  FX.draw = function (ctx, W, H) {
    var i;
    // 粒子
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      var pa = 1 - p.t / p.life;
      ctx.globalAlpha = pa;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + pa * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 飘字：上飘 40px + 淡出
    for (i = 0; i < floaties.length; i++) {
      var f = floaties[i];
      var fa = 1 - f.t / f.life;
      ctx.globalAlpha = fa;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4A3428';
      ctx.fillText(f.text, f.x, f.y - 40 * (f.t / f.life));
      ctx.globalAlpha = 1;
    }

    // toast：顶部 25% 位置，黑色圆角胶囊
    if (toastBox) {
      var t = toastBox;
      var alphaIn = t.t < 250 ? t.t / 250 : 1;
      ctx.globalAlpha = alphaIn;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      var tw = ctx.measureText(t.text).width + 32;
      var ty = H * 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, (W - tw) / 2, ty - 16, tw, 32, 16);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, W / 2, ty);
      ctx.globalAlpha = 1;
    }

    // 天数过渡
    if (dayTrans) {
      var d = dayTrans;
      var prog = d.t / d.dur;
      var a = 1;
      if (prog < 0.12) a = prog / 0.12;
      else if (prog > 0.72) a = 1 - (prog - 0.72) / 0.28;
      a = Math.max(0, Math.min(1, a));

      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, W, H);

      // 太阳/月亮升起：translateY 40→0→-10, scale .5→1
      var sProg = Math.min(1, prog / 0.4);
      var sy = (1 - sProg) * 40 - sProg * 10;
      var ss = 0.5 + sProg * 0.5;
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.icon, W / 2, H * 0.42 + sy);

      // 第 N 天：scale .3→1.15→1（对应 .dt-big dtbig 动画）
      var bigProg = Math.min(1, prog / 0.55);
      var bs = bigProg < 0.55 ? 0.3 + (bigProg / 0.55) * 0.85 : 1.15 - (bigProg - 0.55) * 0.15;
      ctx.save();
      ctx.translate(W / 2, H * 0.52);
      ctx.scale(bs, bs);
      ctx.translate(-W / 2, -H * 0.52);
      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('第 ' + d.day + ' 天', W / 2, H * 0.52);
      ctx.restore();
      // 副标题
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(d.sub, W / 2, H * 0.52 + 34);
      ctx.globalAlpha = 1;
    }

    // V1.5: 采集动画效果（闪光 + 挖掘动作 + 采集中提示）
    if (gatherAnimT > 0) {
      var prog = 1 - gatherAnimT / 1.5;
      // 中心闪光（开场更亮，逐渐淡出）
      if (prog < 0.5) {
        var flashAlpha = 1 - prog / 0.5;
        var gradient = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
        gradient.addColorStop(0, 'rgba(255,225,160,' + (flashAlpha * 0.45) + ')');
        gradient.addColorStop(1, 'rgba(255,225,160,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);
      }
      // 挖掘动作：采集按钮上方一个上下跳动的锄头 emoji，模拟刨挖
      var bob = Math.abs(Math.sin(prog * Math.PI * 5)) * 18;
      ctx.font = '34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u26CF\uFE0F', W / 2, H - 150 - bob);
      // 采集中... 提示（全程显示，结尾淡出）
      var tipA = prog > 0.8 ? (1 - (prog - 0.8) / 0.2) : 1;
      ctx.globalAlpha = tipA;
      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText('\u91C6\u96C6\u4E2D...', W / 2, H * 0.42);
      ctx.globalAlpha = 1;
    }
  };

  // 圆角矩形（全局工具）
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  FX._roundRect = roundRect;

  Game.FX = FX;
})();
