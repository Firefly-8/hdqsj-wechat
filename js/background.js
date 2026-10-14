/**
 * 程序绘制荒岛背景（0 位图）：天空渐变+太阳光晕、云、远景岛（大气透视）、海面光斑、
 * 浪花湿沙、沙滩纹理贝壳海星、两侧椰树框景、前景虚化叶片、暗角。
 * 静态层整体缓存到离屏 canvas；每帧只 drawImage + 少量浪线动画。
 */
(function () {
  'use strict';

  var BG = { caches: {}, t: 0 };
  var UI = function () {
    return Game.UI;
  };
  var INK = '#3B2414';

  function ell(c, x, y, rx, ry, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    c.scale(rx, ry);
    c.moveTo(1, 0);
    c.arc(0, 0, 1, 0, Math.PI * 2);
    c.restore();
  }

  function cloud(c, x, y, s, alpha) {
    var blobs = [[0, 0, 16], [18, -10, 20], [38, -4, 17], [54, 4, 12], [24, 6, 16]];
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = '#CFE6F2';
    c.beginPath();
    blobs.forEach(function (b) {
      c.moveTo(x + b[0] * s + b[2] * s, y + b[1] * s + 3 * s);
      c.arc(x + b[0] * s, y + b[1] * s + 3 * s, b[2] * s, 0, Math.PI * 2);
    });
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    blobs.forEach(function (b) {
      c.moveTo(x + b[0] * s + b[2] * s, y + b[1] * s);
      c.arc(x + b[0] * s, y + b[1] * s, b[2] * s, 0, Math.PI * 2);
    });
    c.fill();
    c.restore();
  }

  function frond(c, len, ang, curl, col, dark) {
    c.save();
    c.rotate(ang);
    var pts = [];
    for (var i = 0; i <= 14; i++) {
      var t = i / 14;
      pts.push([t * len, Math.sin(t * Math.PI * 0.9) * curl * len * 0.35 + t * t * curl * len * 0.25, t]);
    }
    for (var side = -1; side <= 1; side += 2) {
      for (var j = 2; j < 14; j++) {
        var p = pts[j], q = pts[j + 1] || p;
        var L = (1 - p[2]) * len * 0.32 + 6;
        c.beginPath();
        c.moveTo(p[0], p[1]);
        c.quadraticCurveTo(p[0] + L * 0.15, p[1] + side * L * 0.6, p[0] + L * 0.55, p[1] + side * L + L * 0.3 * curl);
        c.quadraticCurveTo(p[0] + L * 0.45, p[1] + side * L * 0.3, q[0], q[1]);
        c.closePath();
        c.fillStyle = side < 0 ? col : dark;
        c.fill();
        c.strokeStyle = INK;
        c.lineWidth = 1.6;
        c.stroke();
      }
    }
    c.beginPath();
    pts.forEach(function (p, k) {
      if (k) c.lineTo(p[0], p[1]);
      else c.moveTo(p[0], p[1]);
    });
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    c.stroke();
    c.strokeStyle = '#C9A24A';
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
  }

  function palm(c, x, y, flip, sc, lean) {
    c.save();
    c.translate(x, y);
    c.scale(flip ? -sc : sc, sc);
    var tx = 140 * lean, ty = -230, segs = 13;
    function at(t) {
      return [2 * (1 - t) * t * 20 + t * t * tx, t * ty];
    }
    for (var i = 0; i < segs; i++) {
      var a = at(i / segs), b = at((i + 1) / segs), wd = 15 - (i / segs) * 5;
      c.beginPath();
      c.moveTo(a[0] - wd, a[1]);
      c.lineTo(b[0] - wd + 1, b[1] + 2);
      c.lineTo(b[0] + wd - 1, b[1] + 2);
      c.lineTo(a[0] + wd, a[1]);
      c.closePath();
      var g = c.createLinearGradient(a[0] - wd, 0, a[0] + wd, 0);
      g.addColorStop(0, '#C88A4E');
      g.addColorStop(0.6, '#A86B36');
      g.addColorStop(1, '#7E4A22');
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.2;
      c.stroke();
    }
    c.translate(tx, ty);
    var fr = [[-3.3, 0.7], [-2.7, 0.9], [-2.1, 0.6], [-1.4, 0.2], [-0.5, -0.3], [0.2, 0.5], [0.9, 0.7]];
    fr.forEach(function (f, k) {
      frond(c, 120 - (k % 3) * 12, f[0], f[1], k % 2 ? '#6FBF4A' : '#5AAE3E', '#3F8E33');
    });
    [[-10, 8], [7, 12], [-2, 18]].forEach(function (p) {
      var g2 = c.createRadialGradient(p[0] - 3, p[1] - 3, 1, p[0], p[1], 10);
      g2.addColorStop(0, '#A9743F');
      g2.addColorStop(1, '#5A3418');
      c.fillStyle = g2;
      c.beginPath();
      c.arc(p[0], p[1], 9, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.stroke();
    });
    c.restore();
  }

  function shell(c, x, y, s, col) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(0, 8);
    for (var i = 0; i <= 8; i++) {
      var a = Math.PI + (i / 8) * Math.PI;
      c.lineTo(Math.cos(a) * 10, Math.sin(a) * 10.5);
    }
    c.closePath();
    c.fillStyle = col;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    c.stroke();
    c.strokeStyle = 'rgba(59,36,20,0.4)';
    c.lineWidth = 1;
    for (var j = 1; j < 8; j++) {
      var b = Math.PI + (j / 8) * Math.PI;
      c.beginPath();
      c.moveTo(0, 8);
      c.lineTo(Math.cos(b) * 9, Math.sin(b) * 9);
      c.stroke();
    }
    c.restore();
  }

  function starfish(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.rotate(0.3);
    UI().starPath(c, 0, 0, 11 * s, 5 * s, 0);
    c.fillStyle = '#F2865B';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.8;
    c.stroke();
    c.restore();
  }

  /** 绘制静态层。opt: {hz 地平线比例, shells} */
  function paint(c, W, H, opt) {
    var rnd = UI().seeded(11);
    var hz = Math.round(H * opt.hz);
    var g = c.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#4FB4E6');
    g.addColorStop(0.65, '#9ED9F2');
    g.addColorStop(1, '#E6F6F4');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    var sg = c.createRadialGradient(W * 0.8, H * 0.13, 5, W * 0.8, H * 0.13, 190);
    sg.addColorStop(0, 'rgba(255,248,214,0.9)');
    sg.addColorStop(0.3, 'rgba(255,240,190,0.35)');
    sg.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = sg;
    c.fillRect(0, 0, W, hz);
    cloud(c, -10, hz * 0.42, 1.1, 0.95);
    cloud(c, W - 125, hz * 0.62, 0.75, 0.85);
    cloud(c, W * 0.37, hz * 0.26, 0.5, 0.6);
    // 远景岛：大气透视（降饱和偏蓝）
    c.fillStyle = '#9CCFD6';
    c.beginPath();
    c.moveTo(W * 0.56, hz);
    c.quadraticCurveTo(W * 0.67, hz - 30, W * 0.76, hz - 22);
    c.quadraticCurveTo(W * 0.85, hz - 34, W * 0.96, hz);
    c.fill();
    c.fillStyle = '#B6DCE0';
    c.beginPath();
    c.moveTo(W * 0.05, hz);
    c.quadraticCurveTo(W * 0.16, hz - 16, W * 0.3, hz);
    c.fill();
    // 海
    var seaH = Math.round(H * (opt.sea || 0.11));
    var sea = c.createLinearGradient(0, hz, 0, hz + seaH);
    sea.addColorStop(0, '#5FC3D9');
    sea.addColorStop(0.4, '#2FA8C8');
    sea.addColorStop(1, '#1E93B8');
    c.fillStyle = sea;
    c.fillRect(0, hz, W, seaH + 30);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fillRect(0, hz, W, 1.5);
    for (var i = 0; i < 60; i++) {
      var yy = hz + 6 + Math.pow(rnd(), 1.4) * (seaH - 8), xx = rnd() * W, l = 4 + (rnd() * 14 * (yy - hz)) / seaH;
      c.fillStyle = 'rgba(255,255,255,' + (0.25 + rnd() * 0.5) + ')';
      c.fillRect(xx, yy, l, 1.6);
    }
    for (var k = 0; k < 14; k++) {
      c.fillStyle = 'rgba(255,252,220,0.9)';
      c.fillRect(W * 0.7 + rnd() * W * 0.22, hz + 4 + rnd() * 40, 6 + rnd() * 10, 1.5);
    }
    // 浪花 + 湿沙 + 沙滩
    var sy = hz + seaH;
    function shore(ph, off) {
      c.beginPath();
      c.moveTo(0, sy + off);
      for (var x = 0; x <= W; x += 5) c.lineTo(x, sy + off + Math.sin(x / 34 + ph) * 4 - Math.sin(x / 90) * 8);
      c.lineTo(W, H);
      c.lineTo(0, H);
      c.closePath();
    }
    shore(0.5, -8);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fill();
    shore(0.9, -2);
    c.fillStyle = '#D8BE86';
    c.fill();
    shore(1.3, 10);
    var sd = c.createLinearGradient(0, sy, 0, H);
    sd.addColorStop(0, '#F6DDA6');
    sd.addColorStop(1, '#EBC27F');
    c.fillStyle = sd;
    c.fill();
    c.strokeStyle = 'rgba(176,130,70,0.5)';
    c.lineWidth = 1.5;
    c.stroke();
    c.save();
    shore(1.3, 10);
    c.clip();
    for (var n = 0; n < (W * (H - sy)) / 18; n++) {
      c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(150,100,40,0.16)';
      c.fillRect(rnd() * W, sy + rnd() * (H - sy), 1.2, 1.2);
    }
    c.strokeStyle = 'rgba(190,140,80,0.28)';
    c.lineWidth = 1.5;
    for (var r = 0; r < 9; r++) {
      var ry = sy + 40 + rnd() * (H - sy - 60), rx = rnd() * W;
      c.beginPath();
      c.moveTo(rx, ry);
      c.quadraticCurveTo(rx + 20, ry - 4, rx + 46, ry);
      c.stroke();
    }
    c.restore();
    if (opt.shells !== false) {
      // 贝壳放在边缘，避开中央玩法区
      shell(c, 26, H - 150, 0.9, '#F7C9B5');
      shell(c, W - 28, sy + 70, 0.7, '#FBE7D0');
      starfish(c, W - 40, H - 128, 1);
      shell(c, 40, sy + 54, 0.6, '#FBE7D0');
    }
    palm(c, -30, sy + 120, false, 0.72, 0.5);
    palm(c, W + 28, sy + 90, true, 0.6, 0.45);
    c.save();
    c.globalAlpha = 0.9;
    c.translate(-30, H + 10);
    frond(c, 150, -0.9, 0.4, '#4C9C38', '#3A7E2C');
    c.restore();
    c.save();
    c.globalAlpha = 0.9;
    c.translate(W + 30, H + 20);
    frond(c, 140, -2.3, -0.35, '#4C9C38', '#3A7E2C');
    c.restore();
    var v = c.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.75);
    v.addColorStop(0, 'rgba(40,20,5,0)');
    v.addColorStop(1, 'rgba(40,20,5,0.26)');
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
    return { hz: hz, shoreY: sy };
  }

  var KINDS = {
    play: { hz: 0.33, shells: true },
    home: { hz: 0.52, sea: 0.15, shells: true }
  };

  BG.draw = function (ctx, kind) {
    var W = Game.W, H = Game.H;
    var opt = KINDS[kind] || KINDS.play;
    var key = kind + '|' + W + 'x' + H;
    var c = BG.caches[key];
    if (c === undefined) {
      var dpr = Game.RENDER_SCALE || 2;
      c = UI().newCanvas(Math.ceil(W * dpr), Math.ceil(H * dpr));
      if (c) {
        var cc = c.getContext('2d');
        cc.setTransform(dpr, 0, 0, dpr, 0, 0);
        c._info = paint(cc, W, H, opt);
      }
      BG.caches[key] = c || null;
    }
    var info;
    if (c) {
      ctx.drawImage(c, 0, 0, W, H);
      info = c._info;
    } else {
      info = paint(ctx, W, H, opt);
    }
    // 动态：岸边浪花线轻微起伏
    if (info) {
      var t = BG.t;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      var y0 = info.shoreY - 14 + Math.sin(t * 1.2) * 2;
      for (var x = 0; x <= W; x += 8) {
        var y = y0 + Math.sin(x / 26 + t * 1.5) * 2 - Math.sin(x / 90) * 8;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    return info;
  };

  BG.update = function (dt) {
    BG.t += dt;
  };

  Game.BG = BG;
})();
