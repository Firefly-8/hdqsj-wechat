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
  FX.dayTransitionActive = function () { return !!dayTrans; };
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

  // V1.6: 采集动画效果（放慢到 2.4 秒，更有「挖掘」代入感）
  var GATHER_DUR = 2.4;
  var gatherAnimT = 0;
  var gatherAnimCb = null;
  FX.gatherAnim = function (cb) {
    gatherAnimT = GATHER_DUR; // 2.4 秒动画
    gatherAnimCb = cb;
  };
  FX.gatherAnimActive = function () { return gatherAnimT > 0; };
  FX.gatherAnimTime = function () { return gatherAnimT; };

  // V1.16: 建造敲击动画（短反馈，再接天数过渡）
  var BUILD_DUR = 0.95;
  var buildAnimT = 0;
  var buildAnimCb = null;
  var buildAnimMeta = null; // { name, em }
  FX.buildAnim = function (meta, cb) {
    buildAnimT = BUILD_DUR;
    buildAnimCb = cb || null;
    buildAnimMeta = meta || { name: '', em: '\uD83D\uDD28' };
    // 开场洒一点木屑粒子
    var W = (Game.canvas && Game.canvas.width) || 375;
    var H = (Game.canvas && Game.canvas.height) || 667;
    FX.sparkle(W / 2, H * 0.42, '#C4A574', 14);
    FX.sparkle(W / 2, H * 0.42, '#E8763A', 6);
  };
  FX.buildAnimActive = function () { return buildAnimT > 0; };

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
    if (buildAnimT > 0) {
      buildAnimT -= dt;
      // 中段再喷一次木屑
      if (buildAnimT > 0.45 && buildAnimT < 0.45 + dt) {
        var Ww = (Game.canvas && Game.canvas.width) || 375;
        var Hh = (Game.canvas && Game.canvas.height) || 667;
        FX.sparkle(Ww / 2, Hh * 0.42, '#8B5E3C', 10);
      }
      if (buildAnimT <= 0 && buildAnimCb) {
        var bcb = buildAnimCb;
        buildAnimCb = null;
        buildAnimMeta = null;
        if (bcb) bcb();
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
    // V1.11: 支持 \n 换行 + 限宽 —— 原实现只画单行，多行文案（如新周目提示）会挤成一行并溢出屏幕
    if (toastBox) {
      var t = toastBox;
      var alphaIn = t.t < 250 ? t.t / 250 : 1;
      ctx.globalAlpha = alphaIn;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // V1.17: toast 长行自动折行，避免超宽挤出屏幕
      var maxToastW = W - 40;
      var rawLines = String(t.text).split('\n');
      var tLines = [];
      for (var tr = 0; tr < rawLines.length; tr++) {
        var raw = rawLines[tr];
        if (!raw) { tLines.push(''); continue; }
        var cur = '';
        for (var ti = 0; ti < raw.length; ti++) {
          var ch = raw.charAt(ti);
          if (ctx.measureText(cur + ch).width > maxToastW && cur) {
            tLines.push(cur);
            cur = ch;
          } else cur = cur + ch;
        }
        if (cur) tLines.push(cur);
      }
      var tMaxW = 0;
      for (var tl = 0; tl < tLines.length; tl++) {
        var lw = ctx.measureText(tLines[tl]).width;
        if (lw > tMaxW) tMaxW = lw;
      }
      var tw = Math.min(W - 24, Math.max(120, tMaxW + 32));
      var tLh = 18;
      var tBoxH = tLines.length * tLh + 14;
      var ty = H * 0.22 - tBoxH / 2;
      if (ty < 12) ty = 12;
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      roundRect(ctx, (W - tw) / 2, ty, tw, tBoxH, Math.min(16, tBoxH / 2));
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      for (var tl2 = 0; tl2 < tLines.length; tl2++) {
        ctx.fillText(tLines[tl2], W / 2, ty + 7 + tLh / 2 + tl2 * tLh);
      }
      ctx.globalAlpha = 1;
    }

    // 天数过渡（V1.16: ease + 光晕，进出更柔）
    if (dayTrans) {
      var d = dayTrans;
      var prog = d.t / d.dur;
      function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
      function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
      var a = 1;
      if (prog < 0.15) a = easeOutCubic(prog / 0.15);
      else if (prog > 0.7) a = 1 - easeInOut((prog - 0.7) / 0.3);
      a = Math.max(0, Math.min(1, a));

      ctx.globalAlpha = a * 0.72;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
      // 中心暖光
      var glow = ctx.createRadialGradient(W / 2, H * 0.42, 8, W / 2, H * 0.42, W * 0.55);
      glow.addColorStop(0, 'rgba(255,200,120,' + (0.35 * a) + ')');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      ctx.globalAlpha = a;
      var sProg = easeOutCubic(Math.min(1, prog / 0.45));
      var sy = (1 - sProg) * 48 - sProg * 8;
      var ss = 0.45 + sProg * 0.55;
      ctx.save();
      ctx.translate(W / 2, H * 0.40 + sy);
      ctx.scale(ss, ss);
      ctx.font = '44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.icon, 0, 0);
      ctx.restore();

      var bigProg = easeOutCubic(Math.min(1, prog / 0.6));
      var bs = bigProg < 0.7 ? 0.25 + (bigProg / 0.7) * 0.9 : 1.15 - (bigProg - 0.7) * 0.5;
      ctx.save();
      ctx.translate(W / 2, H * 0.52);
      ctx.scale(bs, bs);
      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 8;
      ctx.fillText('第 ' + d.day + ' 天', 0, 0);
      ctx.restore();

      var subA = prog < 0.25 ? 0 : Math.min(1, (prog - 0.25) / 0.2);
      ctx.globalAlpha = a * subA;
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 0;
      ctx.fillText(d.sub, W / 2, H * 0.52 + 36);
      ctx.globalAlpha = 1;
    }

    // V1.6: 采集动画效果（闪光 + 挖掘动作 + 采集中提示，图标与文字贴近）
    if (gatherAnimT > 0) {
      var prog = 1 - gatherAnimT / GATHER_DUR;
      // 中心闪光（开场更亮，逐渐淡出）
      if (prog < 0.5) {
        var flashAlpha = 1 - prog / 0.5;
        var gradient = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
        gradient.addColorStop(0, 'rgba(255,225,160,' + (flashAlpha * 0.45) + ')');
        gradient.addColorStop(1, 'rgba(255,225,160,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);
      }
      // 挖掘动作：锄头在「采集中」文字正上方小幅上下跳动（图标与文字贴近，模拟刨挖）
      var bob = Math.abs(Math.sin(prog * Math.PI * 2.2)) * 14; // 放慢 + 减小幅度
      var cy = H * 0.40;
      ctx.font = '34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u26CF\uFE0F', W / 2, cy - 16 + bob);
      // V1.17: 「采集中」深色底 + 描边，沙滩背景下更易读
      var tipA = prog > 0.82 ? (1 - (prog - 0.82) / 0.18) : 1;
      ctx.globalAlpha = tipA;
      var tip = '\u91C6\u96C6\u4E2D...';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var tipW = ctx.measureText(tip).width + 28;
      var tipH = 32;
      var tipX = (W - tipW) / 2;
      var tipY = cy + 10;
      ctx.fillStyle = 'rgba(20, 30, 40, 0.78)';
      roundRect(ctx, tipX, tipY, tipW, tipH, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 225, 160, 0.55)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, tipX, tipY, tipW, tipH, 16);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(tip, W / 2, tipY + tipH / 2);
      ctx.fillStyle = '#FFF8E7';
      ctx.fillText(tip, W / 2, tipY + tipH / 2);
      ctx.globalAlpha = 1;
    }

    // V1.16: 建造敲击反馈
    if (buildAnimT > 0) {
      var bp = 1 - buildAnimT / BUILD_DUR;
      var ba = bp < 0.12 ? bp / 0.12 : (bp > 0.82 ? (1 - (bp - 0.82) / 0.18) : 1);
      ctx.globalAlpha = ba * 0.45;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = ba;
      var bMeta = buildAnimMeta || { name: '', em: '\uD83D\uDD28' };
      var bob = Math.abs(Math.sin(bp * Math.PI * 5)) * 10;
      var rot = Math.sin(bp * Math.PI * 5) * 0.25;
      ctx.save();
      ctx.translate(W / 2, H * 0.40);
      ctx.rotate(rot);
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bMeta.em || '\uD83D\uDD28', 0, bob);
      ctx.restore();
      // 冲击波圈
      if (bp > 0.15 && bp < 0.85) {
        var ring = ((bp - 0.15) % 0.28) / 0.28;
        ctx.globalAlpha = ba * (1 - ring) * 0.5;
        ctx.strokeStyle = '#F2D5A0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.40, 18 + ring * 46, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = ba;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('建造中 · ' + (bMeta.name || ''), W / 2, H * 0.40 + 48);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('叮叮——营地又结实了一点', W / 2, H * 0.40 + 72);
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
