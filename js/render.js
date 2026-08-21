/**
 * 渲染层：全部界面绘制（首页 / CG / 游戏主界面 / 建造 / 日记 / 弹窗）
 * 触摸命中：每帧收集 Game.hits（可点区域），触摸时逆序匹配
 */
(function () {
  'use strict';

  // 模块级颜色对象（data.js 先于本文件加载，Game.DATA.C 已就绪）
  // 供 btn 等公共辅助函数使用，避免「C is not defined」作用域错误
  var C = Game.DATA.C;

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

  // 按钮注册（hit 区）
  function hit(x, y, w, h, cb) {
    Game.hits.push({ x: x, y: y, w: w, h: h, cb: cb });
  }

  // 背景图 cover 填充（等比缩放铺满，居中裁切）
  function drawCover(ctx, img, W, H) {
    var iw = img.width, ih = img.height;
    var s = Math.max(W / iw, H / ih);
    var dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  // 场景背景：已加载则铺图，否则返回 false（调用方降级为程序渐变）
  function drawSceneBg(ctx, key, W, H) {
    var img = Game.bgAssets && Game.bgAssets[key];
    if (img && img.complete && img.width) { drawCover(ctx, img, W, H); return true; }
    return false;
  }

  // 简单按钮绘制（支持按压下沉效果：按中时 y+2）
  function btn(ctx, x, y, w, h, label, bg, fg, active, pressed, r, fs) {
    var rr = r || 10;
    var pp = pressed || (Game.isPressed ? Game.isPressed(x, y, w, h) : false);
    var dy = pp ? 2 : 0;
    ctx.fillStyle = active ? bg : C.disabled;
    roundRect(ctx, x, y + dy, w, h, rr);
    ctx.fill();
    ctx.fillStyle = active ? (fg || C.white) : C.disabledText;
    ctx.font = 'bold ' + (fs || 13) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + dy + h / 2);
  }

  // ============ 首页 ============
  function drawHome(ctx, W, H, t) {
    var C = Game.DATA.C;
    // 首页背景：美术海面图（未加载完降级为程序渐变 + 波浪）
    var hasHome = drawSceneBg(ctx, 'home', W, H);
    if (!hasHome) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, C.seaDeep);
      g.addColorStop(0.6, '#1a5a6a');
      g.addColorStop(1, C.sea);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (var i = 0; i < 3; i++) {
        var phase = (t * 0.5 + i * 0.6) % 1;
        var waveW = W * 1.2;
        ctx.beginPath();
        ctx.moveTo(0, H - 20 - i * 12);
        for (var x = 0; x <= W; x += 4) {
          var yy = H - 20 - i * 12 + Math.sin((x / waveW) * Math.PI * 2 + phase * Math.PI * 2) * 5;
          ctx.lineTo(x, yy);
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 标题（上移至顶部，给背景图中间的孤岛剪影让出空间）
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('荒岛求生记', W / 2, H * 0.15);
    ctx.shadowBlur = 4;
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('鲁滨逊的漂流', W / 2, H * 0.15 + 30);
    ctx.restore();

    // 开始按钮（下移至底部，避免遮挡背景主体）
    var bw = 200, bh = 52, bx = (W - bw) / 2, by = H * 0.74;
    ctx.fillStyle = C.btnShadow;
    roundRect(ctx, bx, by + 6, bw, bh, 26);
    ctx.fill();
    btn(ctx, bx, by, bw, bh, Game.App.startLabel(), C.fire, '#FFFFFF', true, Game.pressed === 'start', 26, 17);
    hit(bx, by, bw, bh + 6, function () { Game.App.onStart(); });

    // 副标题（按钮正下方）
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('从一根浮木，到一座营地', W / 2, H * 0.87);
    ctx.restore();
  }

  // ============ CG 海难过渡 ============
  function drawCG(ctx, W, H, t) {
    var C = Game.DATA.C;
    // CG 背景：美术夜海图（未加载完降级为程序渐变）
    var hasCg = drawSceneBg(ctx, 'cg', W, H);
    if (!hasCg) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, C.cgDark);
      g.addColorStop(0.6, C.seaDeep);
      g.addColorStop(1, '#133a4a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // 船：颠簸旋转（对应 .cg-boat boat 动画）
    var cg = Game.cg;
    if (cg && cg.boatY !== undefined) {
      // 船已下沉（阶段2）
      ctx.globalAlpha = Math.max(0, 1 - cg.sink);
      var r = 20 * cg.sink;
      ctx.font = '56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\uD83D\uDEB2', W / 2, H * 0.4 + cg.boatY + cg.sink * 40);
      ctx.globalAlpha = 1;
    } else {
      var sway = Math.sin(t * 2.8);
      ctx.font = '56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\uD83D\uDEB2', W / 2 + sway * 8, H * 0.4 + sway * 6);
    }

    // 波浪（横移）
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (var i = 0; i < 4; i++) {
      var phase = (t * 0.8 + i * 0.4) % 1;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.55 + i * 12);
      for (var x = 0; x <= W; x += 4) {
        var yy = H * 0.55 + i * 12 + Math.sin((x / W) * Math.PI * 2 + phase * Math.PI * 2) * 4;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
    }

    // 打字文案（对应 .cg-text，逐字）
    if (cg) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var lines = cg.shown.split('\n');
      for (var li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], W / 2, H * 0.68 + li * 26);
      }
    }

    // 跳过提示
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('点击任意处跳过', W - 20, H - 20);
  }

  // ============ 游戏主界面 ============
  function drawGame(ctx, W, H) {
    var C = Game.DATA.C;
    var S = Game.S;
    var pressed = Game.pressed;

    // 主界面背景：美术海滩营地图（未加载完时海洋区兜底渐变仍生效）
    var hasBeach = drawSceneBg(ctx, 'beach', W, H);

    // 顶栏（对应 .topbar）
    ctx.fillStyle = C.sea;
    ctx.fillRect(0, 0, W, 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83C\uDFDD 荒岛求生记', 14, 22);
    // V1.1: 天气显示（右侧）
    var wInfo = Game.App.getWeatherInfo ? Game.App.getWeatherInfo() : null;
    var weatherText = wInfo ? (wInfo.em + ' ' + wInfo.name) : '';
    // V1.2: 饱食度显示
    var fInfo = Game.App.getFoodInfo ? Game.App.getFoodInfo() : null;
    var foodText = fInfo ? ('\uD83C\uDF69 ' + fInfo.food + '/' + fInfo.maxFood) : '';
    if (fInfo && fInfo.isHungry) foodText = '\uD83D\uDC94 饥饿'; // 饿肚子时显示警告
    ctx.textAlign = 'right';
    ctx.font = '12px sans-serif';
    ctx.fillText('第 ' + S.day + ' 天 ' + weatherText, W - 14, 22);
    // 第二行：饱食度
    if (foodText) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = fInfo && fInfo.isHungry ? '#FF6B6B' : '#FFFFFF';
      ctx.fillText(foodText, W - 14, 36);
    }
    hit(W - 90, 0, 90, 44, function () { Game.App.backHome(); });

    // 营地标签（含升级光晕动画）；海洋区蓝色底仅在背景图未加载时兜底
    if (!hasBeach) {
      ctx.fillStyle = C.sea;
      ctx.beginPath();
      ctx.moveTo(10, 48);
      ctx.lineTo(W - 10, 48);
      ctx.lineTo(W - 10, 98);
      ctx.arc(W / 2, 98, (W - 20) / 2, 0, Math.PI);
      ctx.lineTo(10, 98);
      ctx.closePath();
      ctx.fill();
    }

    // 营地标签（含升级光晕动画）
    var tagText = Game.App.campTagText();
    var tw = ctx.measureText(tagText).width + 24;
    var tx = (W - tw) / 2, ty = 74;
    var scale = 1, glow = 0;
    if (Game.FX.campUpActive()) {
      var cp = 1.1 - Game.FX.campUpTime(); // 动画进度
      if (cp < 0.25) scale = 1 + 0.18 * (cp / 0.25);
      else if (cp < 0.6) scale = 1.18 - 0.22 * ((cp - 0.25) / 0.35);
      else scale = 0.96 + 0.04 * ((cp - 0.6) / 0.4);
      glow = Math.sin(cp * Math.PI) * 18;
    }
    ctx.save();
    ctx.translate(W / 2, ty + 12);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -(ty + 12));
    if (glow > 0) {
      ctx.fillStyle = 'rgba(232,118,58,' + (0.4 * glow / 18) + ')';
      roundRect(ctx, tx - 6, ty - 6, tw + 12, 30, 14);
      ctx.fill();
    }
    ctx.fillStyle = C.wood;
    roundRect(ctx, tx, ty, tw, 24, 12);
    ctx.fill();
    ctx.fillStyle = C.sand;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, W / 2, ty + 12);
    ctx.restore();

    // 资源条（对应 .resbar：木材/食物/石料 棋盘内计数）
    var resData = [
      ['\uD83E\uDEB5 木材', Game.App.countChain('wood'), C.fire],
      ['\uD83E\uDD65 食物', Game.App.countChain('food'), C.fire],
      ['\uD83E\uDEA8 石料', Game.App.countChain('stone'), C.fire]
    ];
    var gap = 6, rw = (W - 20 - gap * 2) / 3, ry = 106;
    for (var i = 0; i < 3; i++) {
      var rx = 10 + i * (rw + gap);
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, rx, ry, rw, 34, 8);
      ctx.fill();
      ctx.strokeStyle = C.wood;
      ctx.lineWidth = 1.5;
      roundRect(ctx, rx, ry, rw, 34, 8);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(resData[i][0], rx + 8, ry + 17);
      ctx.fillStyle = resData[i][2];
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(resData[i][1]), rx + rw - 8, ry + 17);
    }

    // 棋盘面板（对应 .panel）- 改为 4 列，支持上下滚动
    var py = 148, ph = H - 148 - 118;
    // 滚动状态：boardScrollY，默认 0，最大值为 (总行数-可视行数) * 行高
    var boardScrollY = Game.boardScrollY || 0;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, 10, py, W - 20, ph, 12);
    ctx.fill();
    // 棋盘区域剪裁：超出部分不绘制
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, 10, py, W - 20, ph, 12);
    ctx.clip();

    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 2;
    roundRect(ctx, 10, py, W - 20, ph, 12);
    ctx.stroke();
    // 面板标题
    ctx.fillStyle = C.wood;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('合成棋盘（3连自动升级）', 20, py + 16);
    ctx.textAlign = 'right';
    var used = Game.App.boardUsed();
    ctx.fillText(used + '/' + S.space, W - 20, py + 16);

    // 棋盘格子（4 列，支持滚动）
    var cols = 4;
    var cellGap = 12;
    var bw2 = (W - 20 - 12 - cellGap * (cols - 1)) / cols;
    var bh2 = 52; // 固定格子高度
    var bx2 = 10 + 6, by2 = py + 24 - boardScrollY;
    // 计算总行数
    var totalRows = Math.ceil(S.space / cols);
    var visibleRows = Math.floor((ph - 26) / (bh2 + cellGap));
    // 绘制滚动指示器（当有内容时可滚动）
    var canScroll = totalRows > visibleRows;
    if (canScroll) {
      // 右侧滚动条轨道
      var trackX = W - 18, trackY = py + 24, trackH = ph - 26;
      ctx.fillStyle = C.paper3;
      roundRect(ctx, trackX, trackY, 4, trackH, 2);
      ctx.fill();
      // 滚动条滑块
      var scrollRatio = boardScrollY / (totalRows * (bh2 + cellGap) - (ph - 26));
      scrollRatio = Math.max(0, Math.min(1, scrollRatio));
      var thumbH = Math.max(20, trackH * (visibleRows / totalRows));
      var thumbY = trackY + scrollRatio * (trackH - thumbH);
      ctx.fillStyle = C.wood;
      roundRect(ctx, trackX, thumbY, 4, thumbH, 2);
      ctx.fill();
    }
    // 绘制格子
    for (var ci = 0; ci < S.space; ci++) {
      var row = Math.floor(ci / cols);
      var col = ci % cols;
      var cx = bx2 + col * (bw2 + cellGap);
      var cy = by2 + row * (bh2 + cellGap);
      // 仅绘制可视区域内的格子
      if (cy + bh2 < py || cy > py + ph) continue;
      var id = S.board[ci];
      // 合成弹跳动画（对应 .cell.merge pop）
      var popScale = 1;
      if (Game.mergeAnim[ci] && Game.mergeAnim[ci] > 0) {
        var mp = 1 - Game.mergeAnim[ci] / 0.35;
        popScale = mp < 0.6 ? 0.4 + (mp / 0.6) * 0.8 : 1.2 - (mp - 0.6) * 0.2;
      }
      ctx.save();
      ctx.translate(cx + bw2 / 2, cy + bh2 / 2);
      ctx.scale(popScale, popScale);
      ctx.translate(-(cx + bw2 / 2), -(cy + bh2 / 2));
      if (id) {
        var it = Game.DATA.ITEMS[id];
        // 方案一：格底统一为沙色 #F2D5A0，与手绘图投影自然融合
        ctx.fillStyle = C.sand;
        roundRect(ctx, cx, cy, bw2, bh2, 7);
        ctx.fill();
        ctx.strokeStyle = C.wood;
        ctx.lineWidth = 1.5;
        roundRect(ctx, cx, cy, bw2, bh2, 7);
        ctx.stroke();
        // 物品：优先手绘图，未加载完/失败降级 emoji
        var _a = Game.assets && Game.assets[id];
        if (_a && _a.complete && _a.width) {
          var _pad = bw2 * 0.12;
          ctx.drawImage(_a, cx + _pad, cy + _pad, bw2 - _pad * 2, bh2 - _pad * 2);
        } else {
          ctx.font = (bh2 * 0.6) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(it.em, cx + bw2 / 2, cy + bh2 / 2 - 2);
        }
        ctx.font = '8px sans-serif';
        ctx.fillStyle = C.wood;
        ctx.textAlign = 'right';
        ctx.fillText('Lv' + it.lv, cx + bw2 - 3, cy + bh2 - 3);
      } else {
        ctx.fillStyle = C.paper;
        roundRect(ctx, cx, cy, bw2, bh2, 7);
        ctx.fill();
        ctx.strokeStyle = C.paper3;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        roundRect(ctx, cx, cy, bw2, bh2, 7);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
    ctx.restore(); // 结束剪裁

    // 滚动提示（当可滚动时在底部显示）
    if (canScroll) {
      ctx.fillStyle = 'rgba(139,94,60,0.6)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(boardScrollY > 0 ? '\u25B2 上翻' : (totalRows > visibleRows ? '\u25BC 下翻' : ''), W / 2, py + ph - 6);
    }

    // 操作按钮区（采集 + 漂流瓶，对应 .acts）
    var ay = H - 112;
    var gatherW = (W - 20) * 0.58, bottleW = (W - 20) * 0.4;
    var gatherActive = S.energy > 0;
    // V1.2: 显示有效体力上限（饥饿时减半）
    var fInfo = Game.App.getFoodInfo ? Game.App.getFoodInfo() : null;
    var effectiveMax = fInfo ? fInfo.effectiveMaxEnergy : S.maxEnergy;
    var gLabel = '\uD83C\uDFA3 采集 ' + S.energy + '/' + effectiveMax;
    // V1.5: 采集动画进行中，按钮显示「采集中...」并隐藏倒计时
    var animating = Game.FX.gatherAnimActive && Game.FX.gatherAnimActive();
    if (animating) gLabel = '\uD83C\uDFA3 采集中...';
    // 体力倒计时（对应 #energyTimer）
    var timerTxt = Game.App.energyTimerText();
    if (timerTxt && !animating) gLabel += ' ' + timerTxt;
    btn(ctx, 10, ay, gatherW, 42, gLabel, C.fire, '#FFFFFF', gatherActive, pressed === 'gather', 10, 13);
    hit(10, ay, gatherW, 42, function () { Game.App.gather(); });
    btn(ctx, 10 + gatherW + 6, ay, bottleW, 42, '\uD83E\uDEB0 漂流瓶 ' + S.bottle, '#FFFFFF', C.sea, true, pressed === 'bottle', 10, 12);
    hit(10 + gatherW + 6, ay, bottleW, 42, function () { Game.App.bottle(); });

    // V1.5: 休息 + 分享按钮（替代广告按钮）
    var ay2 = H - 64;
    var btnW = (W - 20 - 6) / 2;
    // 休息按钮：每小时3次，+2体力
    var restInfo = Game.App.getRestInfo ? Game.App.getRestInfo() : null;
    var restLeft = restInfo ? restInfo.left : 0;
    var canRest = restLeft > 0;
    btn(ctx, 10, ay2, btnW, 28, canRest ? ('\uD83D\uDC4F 休息 +2 (' + restLeft + ')') : '\uD83D\uDC4F 休息冷却中', C.leaf, '#FFFFFF', canRest, pressed === 'rest', 8, 11);
    hit(10, ay2, btnW, 28, function () { Game.App.onRest(); });
    // 分享按钮：每天10次，+3体力
    var shareInfo = Game.App.getShareInfo ? Game.App.getShareInfo() : null;
    var shareLeft = shareInfo ? shareInfo.left : 0;
    var canShare = shareLeft > 0;
    btn(ctx, 10 + btnW + 6, ay2, btnW, 28, canShare ? ('\uD83D\uDD14 分享 +3 (' + shareLeft + ')') : '\uD83D\uDD14 今日次数用完', C.sea, '#FFFFFF', canShare, pressed === 'share', 8, 11);
    hit(10 + btnW + 6, ay2, btnW, 28, function () { Game.App.onShare(); });

    // Tab 栏（棋盘/建造/日记）抽到公共函数，保证每个 tab 页都有底部导航
    drawTabBar(ctx, W, H);
  }

  // 底部 Tab 栏（棋盘/建造/日记）—— 各 tab 页共用，确保任意页面都能切换返回
  function drawTabBar(ctx, W, H) {
    var C = Game.DATA.C;
    var ty2 = H - 30;
    var tabW = (W - 20 - 8) / 3;
    var tabs = [['棋盘', 'board'], ['建造', 'camp'], ['日记', 'log']];
    for (var ti = 0; ti < 3; ti++) {
      var txx = 10 + ti * (tabW + 4);
      var on = Game.tab === tabs[ti][1];
      btn(ctx, txx, ty2, tabW, 26, tabs[ti][0], on ? C.fire : C.wood, '#FFFFFF', true, false, 8, 11);
      hit(txx, ty2, tabW, 26, (function (tb) { return function () { Game.App.switchTab(tb); }; })(tabs[ti][1]));
    }
  }

  // ============ 建造 tab（列表视图，更直观） ============
  function drawCamp(ctx, W, H) {
    var C = Game.DATA.C;
    var S = Game.S;
    var pressed = Game.pressed;
    ctx.fillStyle = C.sand;
    ctx.fillRect(0, 0, W, H);

    // 标题
    ctx.fillStyle = C.wood;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83D\uDE80 建造', W / 2, 18);

    // V1.4: 显示被封锁的分支
    if (S.lockedTrees && S.lockedTrees.length > 0) {
      var lockedNames = S.lockedTrees.map(function (tid) {
        for (var tt = 0; tt < Game.DATA.TECH_TREES.length; tt++) {
          if (Game.DATA.TECH_TREES[tt].id === tid) return Game.DATA.TECH_TREES[tt].name;
        }
        return tid;
      }).join('、');
      ctx.fillStyle = '#FF6B6B';
      ctx.font = '9px sans-serif';
      ctx.fillText('\uD83D\uDD12 本周目封锁：' + lockedNames, W / 2, 32);
    }

    var startY = S.lockedTrees && S.lockedTrees.length > 0 ? 48 : 36;
    var y = startY;

    // 遍历所有科技树节点，以列表形式展示（V1.6: 支持滚动）
    var trees = Game.DATA.TECH_TREES;

    // 预计算内容总高度，用于裁剪与滚动范围
    var contentTop = startY;
    var bottom = H - 34;
    var preY = contentTop;
    for (var pt = 0; pt < trees.length; pt++) {
      preY += 24;
      for (var pn = 0; pn < trees[pt].nodes.length; pn++) {
        var pdone = S.stages.indexOf(trees[pt].nodes[pn].id) >= 0;
        preY += (pdone ? 58 : 88) + 8;
      }
      preY += 8;
    }
    var campMaxScroll = Math.max(0, preY - bottom);
    Game.campMaxScroll = campMaxScroll;
    Game.campScrollY = Math.max(0, Math.min(campMaxScroll, Game.campScrollY || 0));

    // 裁剪内容区，按 campScrollY 偏移绘制
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, contentTop, W, bottom - contentTop);
    ctx.clip();

    var y = contentTop;
    for (var t = 0; t < trees.length; t++) {
      var tree = trees[t];
      var isLocked = S.lockedTrees && S.lockedTrees.indexOf(tree.id) >= 0;

      // 分支标题
      var ty = y - Game.campScrollY;
      ctx.fillStyle = isLocked ? '#FF6B6B' : C.wood;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(tree.em + ' ' + tree.name + (isLocked ? ' \uD83D\uDD12' : ''), 16, ty + 14);
      y += 24;

      for (var n = 0; n < tree.nodes.length; n++) {
        var node = tree.nodes[n];
        var done = S.stages.indexOf(node.id) >= 0;
        var prevDone = node.prev === 0 || S.stages.indexOf(node.prev) >= 0;
        var branchLocked = isLocked;
        var can = prevDone && !done && !branchLocked;

        var cardH = done ? 58 : 88;
        var oy = y - Game.campScrollY;
        // 卡片背景
        ctx.fillStyle = done ? C.doneBg : (branchLocked ? C.lockedBg : (prevDone ? C.paper : C.lockedBg));
        roundRect(ctx, 10, oy, W - 20, cardH, 8);
        ctx.fill();
        ctx.strokeStyle = done ? C.leaf : (branchLocked ? '#FF6B6B' : (prevDone ? C.wood : C.lockedBorder));
        ctx.lineWidth = 1.5;
        roundRect(ctx, 10, oy, W - 20, cardH, 8);
        ctx.stroke();

        // 节点名称
        ctx.fillStyle = done ? C.ink : (branchLocked ? '#FF6B6B' : (prevDone ? C.ink : C.lockedText));
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(node.em + ' ' + node.name, 20, oy + 16);

        // 状态标签
        ctx.textAlign = 'right';
        ctx.font = '10px sans-serif';
        if (done) {
          ctx.fillStyle = C.leaf;
          ctx.fillText('\u2705 已建成', W - 20, oy + 16);
        } else if (branchLocked) {
          ctx.fillStyle = '#FF6B6B';
          ctx.fillText('\uD83D\uDD12 已封锁', W - 20, oy + 16);
        } else if (!prevDone) {
          ctx.fillStyle = C.lockedText;
          ctx.fillText('\uD83D\uDD12 前置未完成', W - 20, oy + 16);
        }

        if (!done && !branchLocked) {
          // 效果描述
          ctx.textAlign = 'left';
          ctx.fillStyle = C.wood;
          ctx.font = '10px sans-serif';
          ctx.fillText('效果：' + node.desc, 20, oy + 34);

          // 资源需求
          var nx = 20;
          var hasAllRes = true;
          for (var id in node.need) {
            var have = Game.App.countItem(+id);
            var need = node.need[id];
            var ok = have >= need;
            if (!ok) hasAllRes = false;
            var label = Game.DATA.ITEMS[id].em + have + '/' + need;
            var pw = ctx.measureText(label).width + 10;
            ctx.fillStyle = ok ? C.okGreen : C.paper2;
            roundRect(ctx, nx, oy + 42, pw, 16, 4);
            ctx.fill();
            ctx.fillStyle = C.ink;
            ctx.font = '9px sans-serif';
            ctx.fillText(label, nx + 4, oy + 53);
            nx += pw + 4;
          }

          // 建造按钮
          var bBtnW = 70, bBtnH = 22;
          btn(ctx, W - 20 - bBtnW, oy + cardH - 28, bBtnW, bBtnH, can ? '建造' : '不足', C.leaf, '#FFFFFF', hasAllRes && can, pressed === 'build' + node.id, 6, 10);
          hit(W - 20 - bBtnW, oy + cardH - 28, bBtnW, bBtnH, (function (nid) { return function () { Game.App.buildStage(nid); }; })(node.id));
        } else if (done) {
          // 效果描述
          ctx.textAlign = 'left';
          ctx.fillStyle = C.ink;
          ctx.font = '10px sans-serif';
          ctx.fillText('效果：' + node.desc, 20, oy + 38);
        }

        y += cardH + 8;
      }
      y += 8;
    }
    ctx.restore();

    // 右侧滚动条
    if (campMaxScroll > 0) {
      var trackX = W - 4, trackW = 3, trackY = contentTop, trackH = bottom - contentTop;
      var thumbH = Math.max(22, trackH * (trackH / (trackH + campMaxScroll)));
      var ratio = Game.campScrollY / campMaxScroll;
      var thumbY = trackY + ratio * (trackH - thumbH);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(trackX, trackY, trackW, trackH);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      roundRect(ctx, trackX, thumbY, trackW, thumbH, 2);
      ctx.fill();
    }

    // 底部导航
    drawTabBar(ctx, W, H);
  }

  // ============ 日记 tab ============
  function drawLog(ctx, W, H) {
    var C = Game.DATA.C;
    var S = Game.S;
    ctx.fillStyle = C.sand;
    ctx.fillRect(0, 0, W, H);

    var unlocked = Math.min(Game.DATA.LOGS.length, 1 + S.stages.length + Math.floor(S.day / 4));
    var y = 16;
    for (var i = 0; i < Game.DATA.LOGS.length; i++) {
      var locked = i >= unlocked;
      ctx.fillStyle = locked ? C.lockedBg : C.paper;
      roundRect(ctx, 10, y, W - 20, 46, 10);
      ctx.fill();
      ctx.strokeStyle = locked ? C.lockedBorder : C.wood;
      ctx.lineWidth = 1;
      roundRect(ctx, 10, y, W - 20, 46, 10);
      ctx.stroke();
      ctx.fillStyle = locked ? C.lockedText : C.ink;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(locked ? '\uD83D\uDD12 ???（继续探索解锁）' : '\uD83C\uDFDC ' + Game.DATA.LOGS[i], 22, y + 23);
      y += 54;
    }
    // 底部导航（与棋盘/建造页一致）
    drawTabBar(ctx, W, H);
  }

  // ============ 弹窗（对应 .overlay + .modal）============
  function drawModal(ctx, W, H) {
    var m = Game.modal;
    if (!m) return;
    var C = Game.DATA.C;
    ctx.fillStyle = 'rgba(20,40,50,0.55)';
    ctx.fillRect(0, 0, W, H);

    var mw = Math.min(W - 40, 340);
    // 标题
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var titleH = 40;
    var bodyLines = m.body.split('\n');
    var bodyH = bodyLines.length * 22 + 12;
    var btnH = m.buttons.length ? 44 : 0;
    var mh = 20 + titleH + bodyH + (btnH ? btnH + 12 : 0) + 16;
    var mx = (W - mw) / 2, my = (H - mh) / 2;

    ctx.fillStyle = C.paper;
    roundRect(ctx, mx, my, mw, mh, 16);
    ctx.fill();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 3;
    roundRect(ctx, mx, my, mw, mh, 16);
    ctx.stroke();

    ctx.fillStyle = C.wood;
    ctx.fillText(m.title, W / 2, my + 22);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    for (var li = 0; li < bodyLines.length; li++) {
      ctx.fillText(bodyLines[li], W / 2, my + 44 + li * 22);
    }

    // 按钮行
    var by = my + mh - 16 - btnH;
    if (btnH) {
      var bgap = 8;
      var bw = (mw - 40 - bgap * (m.buttons.length - 1)) / m.buttons.length;
      for (var bi = 0; bi < m.buttons.length; bi++) {
        var b = m.buttons[bi];
        var bxx = mx + 20 + bi * (bw + bgap);
        var bg = b.primary ? C.fire : C.wood;
        btn(ctx, bxx, by, bw, btnH - 10, b.label, bg, '#FFFFFF', true, Game.pressed === 'modal' + bi, 8, 13);
        hit(bxx, by, bw, btnH - 10, (function (idx) { return function () { Game.App.onModalBtn(idx); }; })(bi));
      }
    }
  }

  // ============ 加载过渡（进入游戏前的漂流 loading，约 2.5s） ============
  function drawLoading(ctx, W, H, t) {
    var C = Game.DATA.C;
    // 天空渐变（顶部浅蓝 → 海平线）
    var sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, '#BFE3F0');
    sky.addColorStop(1, '#EAF5F9');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // 海洋渐变（海平线 → 底部）
    var sea = ctx.createLinearGradient(0, H * 0.5, 0, H);
    sea.addColorStop(0, C.sea);
    sea.addColorStop(1, C.seaDeep);
    ctx.fillStyle = sea;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);

    var horizon = H * 0.52;
    // 远景海浪（在船之后）
    drawWave(ctx, W, H, horizon + 6, 5, 90, 1.1, 0.0, C.sea, 0.9, t);
    drawWave(ctx, W, H, horizon + 14, 6, 70, 1.4, 1.6, C.seaDark, 0.5, t);

    // 小船（随波起伏 + 随浪倾斜）
    var bx = W / 2;
    var by = horizon + 4 + Math.sin(t * 1.6) * 5;
    var tilt = Math.sin(t * 1.6 + 0.4) * 0.05;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(tilt);
    // 船体（木色梯形）
    ctx.fillStyle = C.wood;
    ctx.beginPath();
    ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.lineTo(19, 15); ctx.lineTo(-19, 15);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.btnShadow; ctx.lineWidth = 1.5; ctx.stroke();
    // 桅杆
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -36); ctx.stroke();
    // 帆
    ctx.fillStyle = C.paper;
    ctx.beginPath(); ctx.moveTo(2, -34); ctx.lineTo(2, -8); ctx.lineTo(22, -20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.paper2; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

    // 近景海浪（遮住船底，营造"船在海浪中"的层次）
    drawWave(ctx, W, H, horizon + 10, 7, 60, 1.8, 3.0, C.sea, 0.85, t);
    drawWave(ctx, W, H, horizon + 20, 6, 50, 2.2, 4.5, '#3E93B0', 0.6, t);

    // 轻遮罩，提升文字可读性（不压暗海洋）
    ctx.fillStyle = 'rgba(6,24,42,0.16)';
    ctx.fillRect(0, 0, W, H);

    // 标题（轻微浮动）
    var ty = H * 0.26 + Math.sin(t * 1.2) * 3;
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('荒岛求生记', W / 2, ty);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(74,52,40,0.85)';
    ctx.fillText('漂流中…', W / 2, ty + 30);

    // 底部加载进度条（2.5s 满）
    var p = Game.loadStart ? Math.min(1, (Date.now() - Game.loadStart) / 2500) : 0;
    var barW = W * 0.5, barX = (W - barW) / 2, barY = H - 46;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, barX, barY, barW, 5, 2.5); ctx.fill();
    ctx.fillStyle = C.fire;
    roundRect(ctx, barX, barY, barW * p, 5, 2.5); ctx.fill();
  }

  // 波浪辅助：从 baseY 起画一条正弦波并填充到屏幕底部
  function drawWave(ctx, W, H, baseY, amp, len, speed, phase, color, alpha, t) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (var x = 0; x <= W + 4; x += 6) {
      var y = baseY + Math.sin(x / len + t * speed + phase) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ============ 场景分发 ============
  function render(ctx, W, H, t) {
    Game.hits = [];
    var sc = Game.scene;
    if (sc === 'home') {
      drawHome(ctx, W, H, t);
    } else if (sc === 'cg') {
      drawCG(ctx, W, H, t);
    } else if (sc === 'loading') {
      drawLoading(ctx, W, H, t);
    } else {
      // game
      if (Game.tab === 'camp') drawCamp(ctx, W, H);
      else if (Game.tab === 'log') drawLog(ctx, W, H);
      else drawGame(ctx, W, H);
    }
    Game.FX.draw(ctx, W, H);
    drawModal(ctx, W, H);
  }

  Game.Render = { render: render, btn: btn, roundRect: roundRect, hit: hit };
})();
