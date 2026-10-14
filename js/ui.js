/**
 * UI 组件库（贴纸风）：厚度光泽按钮、木牌、纸面板、飘带、多层描边标题、圆形图标按钮、角标
 * 复杂静态件渲染到离屏 canvas 缓存，每帧只 drawImage
 */
(function () {
  'use strict';

  var UI = {};
  var T = function () {
    return Game.Theme;
  };
  var cacheMap = {};
  var cacheCount = 0;
  var P = 18; // 缓存画布留白（容纳阴影）

  UI.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r || 8, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  var rr = UI.roundRect;

  function ell(c, x, y, rx, ry, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    c.scale(rx, ry);
    c.moveTo(1, 0);
    c.arc(0, 0, 1, 0, Math.PI * 2);
    c.restore();
  }
  UI.ell = ell;

  UI.hit = function (btn, x, y) {
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
  };

  function newCanvas(w, h) {
    var c = typeof wx !== 'undefined' && wx.createCanvas ? wx.createCanvas() : null;
    if (!c) return null;
    c.width = w;
    c.height = h;
    return c;
  }
  UI.newCanvas = newCanvas;

  /** 离屏缓存：fn(ctx, P) 在 (P,P) 偏移的逻辑坐标系中绘制 w×h 的组件 */
  UI.cached = function (ctx, key, x, y, w, h, fn) {
    var dpr = Game.RENDER_SCALE || 2;
    var c = cacheMap[key];
    if (c === undefined) {
      if (cacheCount > 160) {
        cacheMap = {};
        cacheCount = 0;
      }
      c = newCanvas(Math.ceil((w + P * 2) * dpr), Math.ceil((h + P * 2) * dpr));
      if (c) {
        var cc = c.getContext('2d');
        cc.setTransform(dpr, 0, 0, dpr, 0, 0);
        cc.translate(P, P);
        fn(cc);
      }
      cacheMap[key] = c || null;
      cacheCount++;
    }
    if (c) ctx.drawImage(c, x - P, y - P, w + P * 2, h + P * 2);
    else {
      ctx.save();
      ctx.translate(x, y);
      fn(ctx);
      ctx.restore();
    }
  };

  function seeded(seed) {
    var s = seed || 7;
    return function () {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  }
  UI.seeded = seeded;

  function dropShadow(ctx, blur, oy, color) {
    ctx.shadowColor = color || T().SHADOW;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetY = oy;
    ctx.shadowOffsetX = 0;
  }
  function noShadow(ctx) {
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  /** 厚度光泽块（局部坐标 0,0,w,h）：投影→底部厚边→渐变本体→高光带→高光点→内描边→外描边 */
  UI.glossBody = function (ctx, w, h, base, opt) {
    opt = opt || {};
    var th = T();
    var r = opt.r != null ? opt.r : h / 2;
    var d = opt.d != null ? opt.d : 6;
    ctx.save();
    dropShadow(ctx, 10, 5);
    ctx.fillStyle = th.INK;
    rr(ctx, -2.5, -2.5, w + 5, h + d + 5, r + 2.5);
    ctx.fill();
    noShadow(ctx);
    ctx.fillStyle = th.shade(base, -0.38);
    rr(ctx, 0, d, w, h, r);
    ctx.fill();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.shade(base, 0.3));
    g.addColorStop(0.55, base);
    g.addColorStop(1, th.shade(base, -0.12));
    ctx.fillStyle = g;
    rr(ctx, 0, 0, w, h, r);
    ctx.fill();
    ctx.save();
    rr(ctx, 0, 0, w, h, r);
    ctx.clip();
    var hg = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    hg.addColorStop(0, 'rgba(255,255,255,0.62)');
    hg.addColorStop(1, 'rgba(255,255,255,0.04)');
    ctx.fillStyle = hg;
    rr(ctx, 5, 3, w - 10, h * 0.42, Math.min(r, h * 0.21));
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ell(ctx, Math.min(r, 24) + 6, h * 0.22, 5, 3, -0.5);
    ctx.fill();
    ctx.strokeStyle = th.shade(base, 0.45);
    ctx.lineWidth = 1.5;
    rr(ctx, 2, 2, w - 4, h - 4, r - 2);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  };

  /** 白字深描边（按钮字 / 木牌字） */
  UI.outlineText = function (ctx, s, x, y, size, color, stroke) {
    var th = T();
    ctx.save();
    ctx.font = th.display(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.2);
    ctx.strokeStyle = stroke || 'rgba(59,36,20,0.92)';
    ctx.strokeText(s, x, y + 2);
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color || '#FFFFFF';
    ctx.fillText(s, x, y);
    ctx.restore();
  };

  UI.text = function (ctx, s, x, y, size, color, weight, align) {
    ctx.save();
    ctx.font = T().body(size, weight || 'bold');
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color || T().INK;
    ctx.fillText(s, x, y);
    ctx.restore();
  };

  /** 多层标题：厚度层→外粗描边→浅色内描边→渐变填充 */
  UI.title = function (ctx, s, x, y, size, opt) {
    opt = opt || {};
    var th = T();
    ctx.save();
    ctx.font = th.display(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    var depth = opt.depth != null ? opt.depth : 4;
    ctx.fillStyle = th.INK;
    ctx.strokeStyle = th.INK;
    ctx.lineWidth = size * 0.26;
    for (var i = depth; i > 0; i--) {
      ctx.strokeText(s, x, y + i);
      ctx.fillText(s, x, y + i);
    }
    ctx.strokeText(s, x, y);
    ctx.lineWidth = size * 0.11;
    ctx.strokeStyle = opt.inner || '#FFF4D6';
    ctx.strokeText(s, x, y);
    var cols = opt.grad || ['#FFF3A0', '#FFC93A', '#FF9A1F'];
    var g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    for (var j = 0; j < cols.length; j++) g.addColorStop(j / (cols.length - 1), cols[j]);
    ctx.fillStyle = g;
    ctx.fillText(s, x, y);
    ctx.restore();
  };

  /** 计算适配字号 */
  UI.fitSize = function (ctx, s, maxW, size, fontFn, min) {
    min = min || 10;
    while (size > min) {
      ctx.font = fontFn(size);
      if (ctx.measureText(s).width <= maxW) break;
      size -= 1;
    }
    return size;
  };

  UI.wrap = function (ctx, text, maxW, maxLines) {
    var lines = [], line = '';
    var chars = String(text || '').split('');
    for (var i = 0; i < chars.length; i++) {
      var t = line + chars[i];
      if (ctx.measureText(t).width > maxW && line) {
        lines.push(line);
        line = chars[i];
      } else line = t;
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
    }
    return lines;
  };

  var KIND = {
    primary: { base: '#5CC34A', text: '#FFFFFF' },
    secondary: { base: '#F3E2BE', text: '#6A4422' },
    sky: { base: '#6CC3E0', text: '#FFFFFF' },
    gray: { base: '#B9A88E', text: '#FFFFFF' }
  };

  /**
   * 胶囊按钮 btn: {x,y,w,h,label,kind,icon,badge,fontSize}
   */
  UI.drawButton = function (ctx, btn, pressed) {
    var th = T();
    var k = KIND[btn.kind || 'primary'] || KIND.primary;
    if (btn.bg) k = { base: btn.bg, text: btn.color || '#FFFFFF' };
    var d = pressed ? 2 : 6;
    var y = btn.y + (pressed ? 4 : 0);
    var key = 'btn|' + k.base + '|' + Math.round(btn.w) + 'x' + Math.round(btn.h) + '|' + d;
    UI.cached(ctx, key, btn.x, y, btn.w, btn.h + d, function (c) {
      UI.glossBody(c, btn.w, btn.h, k.base, { d: d, r: btn.r });
    });
    var size = btn.fontSize || Math.min(26, Math.round(btn.h * 0.42));
    var cy = y + btn.h / 2 + 1;
    var iconS = btn.icon ? Math.round(btn.h * 0.46) : 0;
    ctx.font = th.display(size);
    var maxTextW = btn.w - 24 - (iconS ? iconS + 8 : 0);
    size = UI.fitSize(ctx, btn.label, maxTextW, size, th.display, 12);
    ctx.font = th.display(size);
    var tw = ctx.measureText(btn.label).width;
    var gw = tw + (iconS ? iconS + 8 : 0);
    var gx = btn.x + (btn.w - gw) / 2;
    if (iconS) Game.Emoji.draw(ctx, btn.icon, gx + iconS / 2, cy - 1, iconS);
    var tx = gx + (iconS ? iconS + 8 : 0) + tw / 2;
    if (k.text === '#FFFFFF') UI.outlineText(ctx, btn.label, tx, cy, size, '#FFFFFF');
    else {
      ctx.save();
      ctx.font = th.display(size);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = k.text;
      ctx.fillText(btn.label, tx, cy);
      ctx.restore();
    }
    if (btn.badge != null && btn.badge !== '') {
      UI.badge(ctx, btn.x + btn.w - 10, y + 2, 12, String(btn.badge));
    }
  };

  /** 金币角标 */
  UI.badge = function (ctx, x, y, r, txt, col) {
    var th = T();
    col = col || th.GOLD;
    ctx.save();
    ctx.fillStyle = th.INK;
    ctx.beginPath();
    ctx.arc(x, y + 2, r + 2.5, 0, Math.PI * 2);
    ctx.fill();
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 1, x, y, r);
    g.addColorStop(0, th.shade(col, 0.5));
    g.addColorStop(1, th.shade(col, -0.1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ell(ctx, x - r * 0.35, y - r * 0.45, r * 0.3, r * 0.15, -0.6);
    ctx.fill();
    ctx.restore();
    UI.text(ctx, txt, x, y + 0.5, Math.round(r * (txt.length > 1 ? 0.9 : 1.1)), th.INK, '900');
  };

  /** 圆形图标按钮 b: {cx,cy,r,icon,base,label} ；命中框 x,y,w,h 由 UI.iconHit 生成 */
  UI.iconButton = function (ctx, b, pressed) {
    var th = T();
    var r = b.r;
    var oy = pressed ? 3 : 0;
    var key = 'ibtn|' + b.base + '|' + r + '|' + (pressed ? 1 : 0);
    UI.cached(ctx, key, b.cx - r, b.cy - r + oy, r * 2, r * 2 + 4, function (c) {
      c.save();
      dropShadow(c, 6, pressed ? 1 : 4);
      c.fillStyle = th.INK;
      c.beginPath();
      c.arc(r, r + 2, r + 2.5, 0, Math.PI * 2);
      c.fill();
      noShadow(c);
      c.fillStyle = th.shade(b.base, -0.35);
      c.beginPath();
      c.arc(r, r + (pressed ? 1.5 : 4), r, 0, Math.PI * 2);
      c.fill();
      var g = c.createLinearGradient(0, 0, 0, r * 2);
      g.addColorStop(0, th.shade(b.base, 0.32));
      g.addColorStop(1, b.base);
      c.fillStyle = g;
      c.beginPath();
      c.arc(r, r, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath();
      ell(c, r, r * 0.55, r * 0.6, r * 0.3, 0);
      c.fill();
      c.restore();
    });
    if (b.icon) Game.Emoji.draw(ctx, b.icon, b.cx, b.cy + oy, Math.round(r * 1.05));
    if (b.label) UI.text(ctx, b.label, b.cx, b.cy + r + 16, 12, b.labelColor || th.CREAM_TXT, '900');
  };
  UI.iconHit = function (b) {
    b.x = b.cx - b.r - 4;
    b.y = b.cy - b.r - 4;
    b.w = b.r * 2 + 8;
    b.h = b.r * 2 + 8;
    return b;
  };

  /** 木牌：木纹、木节、分缝、四角钉子 */
  UI.plank = function (ctx, x, y, w, h, opt) {
    opt = opt || {};
    var th = T();
    var r = opt.r != null ? opt.r : 10;
    var rows = opt.rows || 1;
    var nails = opt.nails !== false;
    var key = 'plank|' + Math.round(w) + 'x' + Math.round(h) + '|' + r + '|' + rows + '|' + nails;
    UI.cached(ctx, key, x, y, w, h + 6, function (c) {
      var rnd = seeded(31 + Math.round(w));
      c.save();
      dropShadow(c, 8, 5, 'rgba(59,36,20,0.4)');
      c.fillStyle = th.INK;
      rr(c, -2.5, -2.5, w + 5, h + 9, r + 2);
      c.fill();
      noShadow(c);
      c.fillStyle = th.WOOD_D;
      rr(c, 0, 5, w, h, r);
      c.fill();
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#E3AA68');
      g.addColorStop(1, '#C2834A');
      c.fillStyle = g;
      rr(c, 0, 0, w, h, r);
      c.fill();
      c.save();
      rr(c, 0, 0, w, h, r);
      c.clip();
      for (var i = 1; i < rows; i++) {
        c.fillStyle = 'rgba(90,50,20,0.45)';
        c.fillRect(0, (h * i) / rows - 1, w, 2);
        c.fillStyle = 'rgba(255,230,190,0.35)';
        c.fillRect(0, (h * i) / rows + 1, w, 1);
      }
      c.strokeStyle = 'rgba(110,62,26,0.26)';
      c.lineWidth = 1.2;
      var lines = Math.max(4, Math.round(h / 6));
      for (var l = 0; l < lines; l++) {
        var yy = rnd() * h, ph = rnd() * 6;
        c.beginPath();
        for (var xx = 0; xx <= w; xx += 6) {
          var py = yy + Math.sin(xx / 30 + ph) * 2.2;
          if (xx === 0) c.moveTo(xx, py);
          else c.lineTo(xx, py);
        }
        c.stroke();
      }
      if (w > 120 && h > 40) {
        for (var n = 0; n < 2; n++) {
          var kx = 30 + rnd() * (w - 60), ky = 10 + rnd() * (h - 20);
          c.strokeStyle = 'rgba(110,62,26,0.4)';
          c.beginPath();
          ell(c, kx, ky, 7, 3, 0);
          c.stroke();
          c.beginPath();
          ell(c, kx, ky, 3, 1.3, 0);
          c.stroke();
        }
      }
      c.fillStyle = 'rgba(255,240,210,0.35)';
      c.fillRect(0, 0, w, 3);
      c.restore();
      c.strokeStyle = th.INK;
      c.lineWidth = 2.5;
      rr(c, 0, 0, w, h, r);
      c.stroke();
      if (nails) {
        var inset = Math.min(10, h / 3.2);
        var pts = h >= 46 ? [[inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset]] : [[inset + 1, h / 2], [w - inset - 1, h / 2]];
        for (var p = 0; p < pts.length; p++) {
          var nx = pts[p][0], ny = pts[p][1];
          var ng = c.createRadialGradient(nx - 1, ny - 1, 0.5, nx, ny, 4);
          ng.addColorStop(0, '#F4F1EA');
          ng.addColorStop(1, '#6E6A66');
          c.fillStyle = ng;
          c.beginPath();
          c.arc(nx, ny, 3.4, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = th.INK;
          c.lineWidth = 1.2;
          c.stroke();
        }
      }
      c.restore();
    });
  };

  UI.rope = function (ctx, x1, y1, x2, y2) {
    var th = T();
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = th.INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = '#D9B77A';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,40,0.7)';
    ctx.lineWidth = 1;
    var n = Math.hypot(x2 - x1, y2 - y1) / 5;
    for (var i = 0; i < n; i++) {
      var t = i / n, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
      ctx.beginPath();
      ctx.moveTo(px - 1.5, py - 1.5);
      ctx.lineTo(px + 1.5, py + 1.5);
      ctx.stroke();
    }
    ctx.restore();
  };

  /** 纸面板：外阴影、厚边、渐变、纸纹、四周压暗、缝线、外描边 */
  UI.paper = function (ctx, x, y, w, h, r) {
    var th = T();
    var key = 'paper|' + Math.round(w) + 'x' + Math.round(h) + '|' + r;
    UI.cached(ctx, key, x, y, w, h + 8, function (c) {
      var rnd = seeded(97);
      c.save();
      dropShadow(c, 16, 9, 'rgba(40,20,5,0.45)');
      c.fillStyle = th.INK;
      rr(c, -3, -3, w + 6, h + 11, r + 3);
      c.fill();
      noShadow(c);
      c.fillStyle = '#D9B27A';
      rr(c, 0, 7, w, h, r);
      c.fill();
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, th.PAPER);
      g.addColorStop(1, th.PAPER_D);
      c.fillStyle = g;
      rr(c, 0, 0, w, h, r);
      c.fill();
      c.save();
      rr(c, 0, 0, w, h, r);
      c.clip();
      for (var i = 0; i < (w * h) / 22; i++) {
        c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(140,90,40,0.10)';
        c.fillRect(rnd() * w, rnd() * h, 1, 1);
      }
      var ig = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      ig.addColorStop(0, 'rgba(200,150,80,0)');
      ig.addColorStop(1, 'rgba(200,150,80,0.25)');
      c.fillStyle = ig;
      c.fillRect(0, 0, w, h);
      c.restore();
      c.setLineDash([5, 4]);
      c.strokeStyle = 'rgba(170,120,60,0.7)';
      c.lineWidth = 1.5;
      rr(c, 8, 8, w - 16, h - 16, Math.max(4, r - 6));
      c.stroke();
      c.setLineDash([]);
      c.strokeStyle = th.INK;
      c.lineWidth = 3;
      rr(c, 0, 0, w, h, r);
      c.stroke();
      c.restore();
    });
  };

  /** 折角飘带 */
  UI.ribbon = function (ctx, cx, y, w, h) {
    var th = T();
    var tail = 26;
    ctx.save();
    ctx.lineJoin = 'round';
    for (var s = -1; s <= 1; s += 2) {
      var ex = cx + s * (w / 2 + tail);
      ctx.beginPath();
      ctx.moveTo(cx + s * (w / 2 - 6), y + 10);
      ctx.lineTo(ex, y + 10);
      ctx.lineTo(ex - s * 12, y + 10 + h / 2);
      ctx.lineTo(ex, y + 10 + h);
      ctx.lineTo(cx + s * (w / 2 - 6), y + 10 + h);
      ctx.closePath();
      ctx.fillStyle = '#C9472E';
      ctx.fill();
      ctx.strokeStyle = th.INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * (w / 2 - 6), y + 10 + h);
      ctx.lineTo(cx + s * (w / 2), y + h);
      ctx.lineTo(cx + s * (w / 2), y + h + 12);
      ctx.closePath();
      ctx.fillStyle = '#7E2A1A';
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y);
    ctx.quadraticCurveTo(cx, y - 14, cx + w / 2, y);
    ctx.lineTo(cx + w / 2, y + h);
    ctx.quadraticCurveTo(cx, y + h - 14, cx - w / 2, y + h);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, y - 14, 0, y + h);
    g.addColorStop(0, '#FF8A5E');
    g.addColorStop(1, th.CORAL);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = th.INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y + 2);
    ctx.quadraticCurveTo(cx, y - 12, cx + w / 2, y + 2);
    ctx.lineTo(cx + w / 2, y + 12);
    ctx.quadraticCurveTo(cx, y - 2, cx - w / 2, y + 12);
    ctx.fill();
    ctx.restore();
  };

  UI.starPath = function (ctx, x, y, R, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = (rot || 0) - Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
  };

  /** 金星（带厚度与高光） */
  UI.star = function (ctx, x, y, R, rot, dim) {
    var th = T();
    ctx.save();
    ctx.lineJoin = 'round';
    dropShadow(ctx, 6, 4, 'rgba(40,20,5,0.4)');
    UI.starPath(ctx, x, y, R + 3, R * 0.5 + 3, rot);
    ctx.fillStyle = th.INK;
    ctx.fill();
    noShadow(ctx);
    UI.starPath(ctx, x, y, R, R * 0.5, rot);
    var g = ctx.createLinearGradient(0, y - R, 0, y + R);
    if (dim) {
      g.addColorStop(0, '#E8DCC4');
      g.addColorStop(1, '#BBA98A');
    } else {
      g.addColorStop(0, '#FFF2A0');
      g.addColorStop(0.5, '#FFC93A');
      g.addColorStop(1, '#F29A1A');
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ell(ctx, x - R * 0.2, y - R * 0.35, R * 0.22, R * 0.1, -0.5);
    ctx.fill();
    ctx.restore();
  };

  UI.rays = function (ctx, x, y, R, n, col, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = col;
    for (var i = 0; i < n; i++) {
      ctx.rotate((Math.PI * 2) / n);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(R, -R * 0.13);
      ctx.lineTo(R, R * 0.13);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  /** 纸色胶囊（提示气泡 / toast / 进度） */
  UI.pill = function (ctx, x, y, w, h, opt) {
    opt = opt || {};
    var th = T();
    ctx.save();
    dropShadow(ctx, 6, 3);
    ctx.fillStyle = th.INK;
    rr(ctx, x - 2.5, y - 2.5, w + 5, h + 7, h / 2 + 2.5);
    ctx.fill();
    noShadow(ctx);
    ctx.fillStyle = '#E9CF9C';
    rr(ctx, x, y + 3, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = opt.fill || th.PAPER;
    rr(ctx, x, y, w, h, h / 2);
    ctx.fill();
    if (opt.tail) {
      ctx.beginPath();
      ctx.moveTo(opt.tail - 8, y + h - 1);
      ctx.lineTo(opt.tail, y + h + 9);
      ctx.lineTo(opt.tail + 8, y + h - 1);
      ctx.fill();
    }
    ctx.restore();
  };

  /** 白色圆角标签（物体文字） */
  UI.tag = function (ctx, s, cx, cy, size) {
    var th = T();
    ctx.save();
    ctx.font = th.body(size, '900');
    var w = ctx.measureText(s).width + 14, h = size + 8;
    ctx.fillStyle = th.INK;
    rr(ctx, cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 5, h / 2 + 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.restore();
    UI.text(ctx, s, cx, cy + 0.5, size, th.INK, '900');
  };

  UI.drawLabel = function (ctx, text, x, y, opt) {
    opt = opt || {};
    ctx.save();
    ctx.fillStyle = opt.color || T().INK;
    ctx.font = opt.font || T().body(14);
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.baseline || 'top';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  Game.UI = UI;
})();
