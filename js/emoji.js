/**
 * 贴纸 emoji：优先使用预渲染 Twemoji 雪碧图（白边+描边已烘焙），缺失时回退系统 emoji
 */
(function () {
  'use strict';

  var E = { img: null, ready: false };

  E.load = function () {
    var A = Game.EmojiAtlas;
    if (!A || typeof wx === 'undefined' || !wx.createImage) return;
    try {
      var img = wx.createImage();
      img.onload = function () {
        E.ready = true;
      };
      img.src = A.src;
      E.img = img;
    } catch (e) {}
  };

  function cpAt(s, i) {
    var c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      var d = s.charCodeAt(i + 1);
      return { cp: (c - 0xd800) * 0x400 + (d - 0xdc00) + 0x10000, len: 2 };
    }
    return { cp: c, len: 1 };
  }

  /** 把 label 拆成 emoji 列表与文字 */
  E.split = function (s) {
    s = String(s == null ? '' : s);
    var emojis = [], text = '', cur = '', i = 0;
    while (i < s.length) {
      var r = cpAt(s, i), ch = s.substr(i, r.len), cp = r.cp;
      i += r.len;
      var isMod = cp === 0xfe0f || cp === 0x200d || (cp >= 0x1f3fb && cp <= 0x1f3ff) || cp === 0x20e3;
      var isEmo = cp >= 0x2190 && !(cp >= 0x3000 && cp <= 0x9fff) && !(cp >= 0xff00 && cp <= 0xffef);
      if (isMod && cur) {
        cur += ch;
        if (cp === 0x200d && i < s.length) {
          var n = cpAt(s, i);
          cur += s.substr(i, n.len);
          i += n.len;
        }
        continue;
      }
      if (cur) {
        emojis.push(cur);
        cur = '';
      }
      if (isEmo) cur = ch;
      else text += ch;
    }
    if (cur) emojis.push(cur);
    return { emojis: emojis, text: text.replace(/^\s+|\s+$/g, '') };
  };

  E.has = function (e) {
    var A = Game.EmojiAtlas;
    return !!(E.ready && A && A.map[e.replace(/\ufe0f/g, '')]);
  };

  /** 以 (cx,cy) 为中心绘制一个贴纸 emoji，size 为 emoji 本体尺寸 */
  E.draw = function (ctx, e, cx, cy, size) {
    var A = Game.EmojiAtlas;
    var pos = A && E.ready ? A.map[e.replace(/\ufe0f/g, '')] : null;
    if (pos) {
      var full = size * A.cell / (A.cell - A.pad * 2);
      ctx.drawImage(E.img, pos[0], pos[1], A.cell, A.cell, cx - full / 2, cy - full / 2, full, full);
      return true;
    }
    // 回退：白色圆底 + 系统 emoji / 字符
    var T = Game.Theme;
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = T.INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = T.INK;
    ctx.font = Math.round(size * 0.78) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e, cx, cy + size * 0.04);
    ctx.restore();
    return false;
  };

  Game.Emoji = E;
})();
