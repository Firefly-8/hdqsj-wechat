/**
 * 简易 UI 命中与绘制：按钮、圆角矩形
 */
(function () {
  'use strict';

  var UI = {};

  UI.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r || 8, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  UI.hit = function (btn, x, y) {
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
  };

  UI.drawButton = function (ctx, btn, pressed) {
    ctx.save();
    var y = btn.y + (pressed ? 2 : 0);
    ctx.fillStyle = btn.bg || '#2A6B4F';
    UI.roundRect(ctx, btn.x, y, btn.w, btn.h, btn.r || 12);
    ctx.fill();
    if (btn.border) {
      ctx.strokeStyle = btn.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = btn.color || '#FFF8EE';
    ctx.font = btn.font || 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x + btn.w / 2, y + btn.h / 2);
    ctx.restore();
  };

  UI.drawLabel = function (ctx, text, x, y, opt) {
    opt = opt || {};
    ctx.save();
    ctx.fillStyle = opt.color || '#2A241C';
    ctx.font = opt.font || '14px sans-serif';
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.baseline || 'top';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  Game.UI = UI;
})();
