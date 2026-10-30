/**
 * V2 横版荒岛生存 P0（迷你饥荒式）
 * 场景：海→沙滩→林缘；左摇杆 / 右情境按钮；背包试错合成；首窝；野猪；死亡+激励视频占位
 * 默认启用：Game.PLAY_MODE === 'sidescroll'（见文件末尾与 app 挂钩）
 * 切回旧棋盘：把 Game.PLAY_MODE 设为 'board' 并清档，或改 DEFAULT_MODE
 */
(function () {
  'use strict';

  var DEFAULT_MODE = 'sidescroll'; // 'sidescroll' | 'board'
  var SAVE_KEY = 'islandSave_ss_v1';

  // —— 世界 ——
  var WORLD_W = 2200;
  var GROUND_Y_RATIO = 0.72; // 逻辑高比例：地面线
  var PLAYER_SPEED = 140;
  var CAM_LERP = 0.12;

  // 区域：海 / 沙滩 / 林缘
  var ZONE = {
    seaEnd: 380,
    beachEnd: 1450
  };

  // 物品（横版背包，与棋盘 ITEMS 独立）
  var SS_ITEMS = {
    driftwood: { id: 'driftwood', name: '浮木', em: '\uD83E\uDEB5' },
    rope: { id: 'rope', name: '绳', em: '\uD83E\uDEA2' },
    tool: { id: 'tool', name: '简易工具', em: '\uD83D\uDEE0\uFE0F' },
    plank: { id: 'plank', name: '木板', em: '\uD83E\uDDF1' }
  };

  // 试错配方：不全公开；UI 未发现显示 ???
  // a/b 无序匹配；result 产出
  var RECIPES = [
    { id: 'r_tool', a: 'driftwood', b: 'rope', result: 'tool', hintFail: '木头和绳子……好像差点火候？' },
    { id: 'r_plank', a: 'driftwood', b: 'driftwood', result: 'plank', hintFail: '' } // 失败静默（同物×2 才成）
  ];

  // 首窝材料
  var SHELTER_NEED = { driftwood: 4, tool: 1 };

  function freshState() {
    return {
      ver: 1,
      day: 1,
      timeOfDay: 0.35, // 0–1，早晨偏晚
      hp: 100,
      maxHp: 100,
      hunger: 80,
      maxHunger: 100,
      playerX: 620,
      facing: 1,
      inv: {}, // id -> count
      discoveredRecipes: {}, // recipeId -> true
      worldDrops: null, // filled on first spawn
      shelterBuilt: false,
      shelterX: 780,
      boar: {
        x: 1680, hp: 60, maxHp: 60, alive: true,
        aggro: false, atkCd: 0, hurtCd: 0
      },
      introSeen: false,
      dead: false,
      deathReason: '',
      bagOpen: false,
      craftSlotA: null,
      craftSlotB: null,
      placeMode: false,
      toast: '',
      toastUntil: 0,
      wakeTextUntil: 0
    };
  }

  var st = null;
  var camX = 0;
  var joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  var keys = { left: false, right: false }; // 非微信调试备用
  var LOGICAL_W = 375;
  var lastToast = '';

  function toast(msg, ms) {
    st.toast = msg || '';
    st.toastUntil = Date.now() + (ms || 1800);
    if (Game.FX && Game.FX.toast) Game.FX.toast(msg, ms || 1800);
  }

  function invCount(id) { return (st.inv[id] || 0); }
  function invAdd(id, n) {
    st.inv[id] = (st.inv[id] || 0) + (n || 1);
    if (st.inv[id] <= 0) delete st.inv[id];
  }
  function invHas(need) {
    for (var k in need) if (invCount(k) < need[k]) return false;
    return true;
  }
  function invSpend(need) {
    if (!invHas(need)) return false;
    for (var k in need) invAdd(k, -need[k]);
    return true;
  }

  function spawnWorldDrops() {
    var drops = [];
    // 沙滩浮木：固定 + 少量随机
    var fixedX = [480, 560, 700, 860, 980, 1120, 1280];
    for (var i = 0; i < fixedX.length; i++) {
      drops.push({ id: 'driftwood', x: fixedX[i], y: 0, taken: false, kind: 'pickup' });
    }
    // 绳：海草搓的绳，沙滩偏潮线
    var ropes = [520, 740, 1050, 1220];
    for (var r = 0; r < ropes.length; r++) {
      drops.push({ id: 'rope', x: ropes[r] + (r % 2) * 18, y: 0, taken: false, kind: 'pickup' });
    }
    // 额外随机浮木
    for (var j = 0; j < 3; j++) {
      drops.push({
        id: 'driftwood',
        x: 450 + Math.floor(Math.random() * 900),
        y: 0, taken: false, kind: 'pickup'
      });
    }
    return drops;
  }

  function load() {
    try {
      var raw = wx.getStorageSync(SAVE_KEY);
      if (raw) {
        st = JSON.parse(raw);
        var base = freshState();
        for (var k in base) if (st[k] === undefined) st[k] = base[k];
        if (!st.worldDrops) st.worldDrops = spawnWorldDrops();
        if (!st.boar) st.boar = base.boar;
        return;
      }
    } catch (e) {}
    st = freshState();
    st.worldDrops = spawnWorldDrops();
  }

  function save() {
    try { wx.setStorageSync(SAVE_KEY, JSON.stringify(st)); } catch (e) {}
  }

  function clearSave() {
    try { wx.removeStorageSync(SAVE_KEY); } catch (e) {}
    st = freshState();
    st.worldDrops = spawnWorldDrops();
  }

  function zoneAt(x) {
    if (x < ZONE.seaEnd) return 'sea';
    if (x < ZONE.beachEnd) return 'beach';
    return 'forest';
  }

  function nearestPickup(maxDist) {
    maxDist = maxDist || 55;
    var best = null, bestD = maxDist;
    for (var i = 0; i < st.worldDrops.length; i++) {
      var d = st.worldDrops[i];
      if (d.taken) continue;
      var dx = Math.abs(d.x - st.playerX);
      if (dx < bestD) { bestD = dx; best = d; }
    }
    return best;
  }

  function nearBoar(maxDist) {
    maxDist = maxDist || 70;
    if (!st.boar || !st.boar.alive) return false;
    return Math.abs(st.boar.x - st.playerX) < maxDist;
  }

  function nearShelterSite(maxDist) {
    maxDist = maxDist || 80;
    if (st.shelterBuilt) return Math.abs(st.shelterX - st.playerX) < maxDist;
    // 未建：沙滩中段可放置
    return st.playerX > 650 && st.playerX < 1100;
  }

  function canPlaceShelter() {
    return !st.shelterBuilt && invHas(SHELTER_NEED) && nearShelterSite(120);
  }

  function contextAction() {
    if (st.dead || st.bagOpen) return null;
    if (nearBoar(75)) return { type: 'attack', label: '攻击' };
    if (canPlaceShelter()) return { type: 'place', label: '建棚' };
    var p = nearestPickup(55);
    if (p) {
      var it = SS_ITEMS[p.id];
      return { type: 'gather', label: '采集', target: p, name: it ? it.name : '物资' };
    }
    if (!st.shelterBuilt && invHas(SHELTER_NEED)) {
      return { type: 'place_hint', label: '去沙滩建棚' };
    }
    return null;
  }

  function doGather(target) {
    if (!target || target.taken) return;
    target.taken = true;
    invAdd(target.id, 1);
    var it = SS_ITEMS[target.id];
    toast('获得 ' + (it ? it.name : target.id) + ' ×1');
    save();
  }

  function doAttack() {
    var b = st.boar;
    if (!b || !b.alive || !nearBoar(85)) return;
    if (b.hurtCd > 0) return;
    var dmg = invCount('tool') > 0 ? 18 : 8;
    b.hp -= dmg;
    b.hurtCd = 0.35;
    b.aggro = true;
    toast(dmg >= 15 ? '工具砸中！-' + dmg : '徒手打中 -' + dmg, 900);
    if (b.hp <= 0) {
      b.alive = false;
      b.hp = 0;
      invAdd('driftwood', 2);
      toast('野猪倒下了。获得浮木 ×2');
    }
    save();
  }

  function doPlaceShelter() {
    if (!canPlaceShelter()) {
      if (!invHas(SHELTER_NEED)) toast('材料不够：浮木×4 + 简易工具×1');
      else toast('在沙滩中段放置');
      return;
    }
    if (!invSpend(SHELTER_NEED)) return;
    st.shelterBuilt = true;
    st.shelterX = Math.max(700, Math.min(1000, st.playerX));
    toast('简陋棚立起来了。岛上有了第一个窝。');
    save();
  }

  function matchRecipe(a, b) {
    if (!a || !b) return null;
    for (var i = 0; i < RECIPES.length; i++) {
      var r = RECIPES[i];
      if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) return r;
      // 同物×2
      if (r.a === r.b && a === b && a === r.a) return r;
    }
    return null;
  }

  function tryCraft() {
    var a = st.craftSlotA, b = st.craftSlotB;
    if (!a || !b) { toast('选两样东西试试'); return; }
    if (invCount(a) < 1 || invCount(b) < (a === b ? 2 : 1)) {
      toast('材料不够');
      return;
    }
    var recipe = matchRecipe(a, b);
    if (!recipe) {
      toast('……没什么反应');
      st.craftSlotA = null;
      st.craftSlotB = null;
      return;
    }
    // 消耗
    if (a === b) {
      if (invCount(a) < 2) { toast('材料不够'); return; }
      invAdd(a, -2);
    } else {
      invAdd(a, -1);
      invAdd(b, -1);
    }
    invAdd(recipe.result, 1);
    st.discoveredRecipes[recipe.id] = true;
    var res = SS_ITEMS[recipe.result];
    toast('做成了 ' + (res ? res.name : recipe.result) + '！');
    st.craftSlotA = null;
    st.craftSlotB = null;
    save();
  }

  function killPlayer(reason) {
    st.dead = true;
    st.deathReason = reason || '你倒在了沙滩上。';
    st.bagOpen = false;
    joy.active = false;
    joy.dx = 0;
    save();
  }

  function reviveFromAd() {
    // 接现有 AD.showReward；demo 模式走 openAdModal
    var finish = function () {
      st.dead = false;
      st.hp = Math.floor(st.maxHp * 0.6);
      st.hunger = Math.max(st.hunger, 40);
      // 重生点：沙滩，远离野猪
      st.playerX = 650;
      if (st.boar && st.boar.alive) {
        st.boar.aggro = false;
        st.boar.atkCd = 2;
      }
      toast('你又睁开了眼。潮声还在。');
      save();
    };
    if (Game.AD && Game.AD.showReward) {
      Game.AD.showReward('revive', finish, function () {
        toast('没看完视频，没法续命');
      });
    } else {
      // 无广告模块时：直接占位确认
      finish();
    }
  }

  function beginRun(isNew) {
    load();
    if (isNew) {
      clearSave();
      st.introSeen = false;
    }
    camX = st.playerX - LOGICAL_W * 0.4;
    Game.scene = 'sidescroll';
    Game.ss = st;
    if (!st.introSeen) {
      st.wakeTextUntil = Date.now() + 4200;
      st.introSeen = true;
      save();
    }
  }

  // —— 更新 ——
  function update(dt, W, H) {
    if (!st || Game.scene !== 'sidescroll') return;
    if (st.dead) return;

    // 日夜推进（约 4 分钟一天）
    st.timeOfDay += dt / 240;
    if (st.timeOfDay >= 1) {
      st.timeOfDay -= 1;
      st.day += 1;
      toast('第 ' + st.day + ' 天');
    }

    // 饥饿
    st.hunger -= dt * 1.2;
    if (st.hunger < 0) st.hunger = 0;
    if (st.hunger <= 0) {
      st.hp -= dt * 4;
    } else if (st.hp < st.maxHp && st.hunger > 40 && st.shelterBuilt) {
      st.hp = Math.min(st.maxHp, st.hp + dt * 2);
    }

    // 移动
    var move = 0;
    if (joy.active) {
      if (Math.abs(joy.dx) > 0.2) move = joy.dx > 0 ? 1 : -1;
    }
    if (keys.left) move = -1;
    if (keys.right) move = 1;
    if (st.bagOpen) move = 0;

    // 海里减速
    var spd = PLAYER_SPEED;
    var z = zoneAt(st.playerX);
    if (z === 'sea') spd *= 0.45;
    st.playerX += move * spd * dt;
    if (move) st.facing = move > 0 ? 1 : -1;
    st.playerX = Math.max(40, Math.min(WORLD_W - 40, st.playerX));
    // 太深的海：缓慢掉血提示
    if (st.playerX < 120) {
      st.hp -= dt * 8;
      if (!lastToast || Date.now() > st._seaWarnAt) {
        toast('海水太深了！');
        st._seaWarnAt = Date.now() + 2500;
      }
    }

    // 野猪 AI
    var b = st.boar;
    if (b && b.alive) {
      if (b.hurtCd > 0) b.hurtCd -= dt;
      if (b.atkCd > 0) b.atkCd -= dt;
      var dist = st.playerX - b.x;
      var ad = Math.abs(dist);
      if (ad < 220) b.aggro = true;
      if (ad > 420) b.aggro = false;
      if (b.aggro && !st.bagOpen) {
        var dir = dist > 0 ? 1 : -1;
        b.x += dir * 95 * dt;
        b.x = Math.max(ZONE.beachEnd - 80, Math.min(WORLD_W - 60, b.x));
        if (ad < 48 && b.atkCd <= 0) {
          st.hp -= 18;
          b.atkCd = 1.1;
          toast('野猪撞过来！-18');
        }
      }
    }

    if (st.hp <= 0) {
      st.hp = 0;
      killPlayer(b && !b.alive ? '你耗尽了力气。' : (nearBoar(100) ? '你被野猪拱翻了。' : '你倒下了。'));
    }

    // 镜头
    var targetCam = st.playerX - W * 0.42;
    targetCam = Math.max(0, Math.min(WORLD_W - W, targetCam));
    camX += (targetCam - camX) * CAM_LERP;
  }

  // —— 绘制 ——
  function roundRect(ctx, x, y, w, h, r) {
    if (Game.Render && Game.Render.roundRect) return Game.Render.roundRect(ctx, x, y, w, h, r);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hit(x, y, w, h, cb) {
    if (!Game.hits) Game.hits = [];
    Game.hits.push({ x: x, y: y, w: w, h: h, cb: cb });
  }

  function drawSky(ctx, W, H, groundY) {
    var t = st.timeOfDay;
    var night = t < 0.22 || t > 0.78;
    var dusk = (t > 0.7 && t <= 0.78) || (t >= 0.22 && t < 0.28);
    var top, bot;
    if (night) { top = '#0a1a2e'; bot = '#1a3050'; }
    else if (dusk) { top = '#c45c2a'; bot = '#f0a060'; }
    else { top = '#6eb6e0'; bot = '#c8e8f8'; }
    var g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, groundY);
  }

  function worldToScreen(wx) { return wx - camX; }

  function drawWorld(ctx, W, H) {
    var groundY = Math.floor(H * GROUND_Y_RATIO);
    drawSky(ctx, W, H, groundY);

    // 海面带
    var seaScreenEnd = worldToScreen(ZONE.seaEnd);
    ctx.fillStyle = '#1a6a8a';
    ctx.fillRect(0, groundY - 8, Math.max(0, Math.min(W, seaScreenEnd)), H - groundY + 8);

    // 沙滩
    var beach0 = worldToScreen(ZONE.seaEnd);
    var beach1 = worldToScreen(ZONE.beachEnd);
    ctx.fillStyle = '#e8c888';
    ctx.fillRect(Math.max(0, beach0), groundY, Math.min(W, beach1) - Math.max(0, beach0), H - groundY);

    // 林缘地面
    var f0 = worldToScreen(ZONE.beachEnd);
    ctx.fillStyle = '#5a7a40';
    ctx.fillRect(Math.max(0, f0), groundY, W - Math.max(0, f0), H - groundY);

    // 海浪线
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    var waveX = worldToScreen(ZONE.seaEnd - 20);
    for (var i = 0; i < 24; i++) {
      var sx = waveX - 40 + i * 18;
      var sy = groundY - 4 + Math.sin(Date.now() / 400 + i) * 3;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // 林缘树色块
    for (var tx = ZONE.beachEnd + 40; tx < WORLD_W; tx += 70) {
      var sx2 = worldToScreen(tx);
      if (sx2 < -40 || sx2 > W + 40) continue;
      ctx.fillStyle = '#2d4a28';
      ctx.fillRect(sx2 - 10, groundY - 70, 22, 70);
      ctx.fillStyle = '#3d6a38';
      ctx.beginPath();
      ctx.arc(sx2 + 1, groundY - 78, 28, 0, Math.PI * 2);
      ctx.fill();
    }

    // 首窝
    if (st.shelterBuilt) {
      var shx = worldToScreen(st.shelterX);
      if (shx > -60 && shx < W + 60) {
        ctx.fillStyle = '#8B5E3C';
        ctx.fillRect(shx - 36, groundY - 48, 72, 48);
        ctx.fillStyle = '#6B4226';
        ctx.beginPath();
        ctx.moveTo(shx - 44, groundY - 48);
        ctx.lineTo(shx, groundY - 78);
        ctx.lineTo(shx + 44, groundY - 48);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4A3428';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('简陋棚', shx, groundY - 84);
      }
    } else if (nearShelterSite(150) && invHas(SHELTER_NEED)) {
      // 放置预览虚框
      var px = worldToScreen(Math.max(700, Math.min(1000, st.playerX)));
      ctx.strokeStyle = 'rgba(74,52,40,0.5)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(px - 36, groundY - 48, 72, 48);
      ctx.setLineDash([]);
    }

    // 掉落物
    for (var di = 0; di < st.worldDrops.length; di++) {
      var d = st.worldDrops[di];
      if (d.taken) continue;
      var dsx = worldToScreen(d.x);
      if (dsx < -20 || dsx > W + 20) continue;
      var it = SS_ITEMS[d.id];
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(it ? it.em : '?', dsx, groundY - 8);
    }

    // 野猪
    if (st.boar && st.boar.alive) {
      var bx = worldToScreen(st.boar.x);
      if (bx > -50 && bx < W + 50) {
        ctx.fillStyle = st.boar.hurtCd > 0 ? '#c06040' : '#5a4030';
        ctx.beginPath();
        // 兼容无 ellipse 的运行时：用缩放圆近似
        ctx.save();
        ctx.translate(bx, groundY - 18);
        ctx.scale(1.75, 1);
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#3a2818';
        ctx.fillRect(bx + 18, groundY - 28, 10, 6); // 嘴
        // 血条
        ctx.fillStyle = '#333';
        ctx.fillRect(bx - 22, groundY - 42, 44, 5);
        ctx.fillStyle = '#c44';
        ctx.fillRect(bx - 22, groundY - 42, 44 * (st.boar.hp / st.boar.maxHp), 5);
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText('野猪', bx, groundY - 46);
      }
    }

    // 玩家
    var psx = worldToScreen(st.playerX);
    ctx.save();
    ctx.translate(psx, groundY);
    ctx.scale(st.facing, 1);
    ctx.fillStyle = '#f5d0a0';
    ctx.beginPath();
    ctx.arc(0, -38, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a6ea5';
    ctx.fillRect(-9, -28, 18, 22);
    ctx.fillStyle = '#4A3428';
    ctx.fillRect(-8, -6, 7, 16);
    ctx.fillRect(1, -6, 7, 16);
    ctx.restore();
  }

  function drawHUD(ctx, W, H) {
    var C = (Game.DATA && Game.DATA.C) || {};
    // 顶栏
    ctx.fillStyle = 'rgba(20,30,40,0.55)';
    roundRect(ctx, 8, 8, W - 16, 36, 8);
    ctx.fill();

    // HP
    ctx.fillStyle = '#eee';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('生命', 16, 22);
    ctx.fillStyle = '#333';
    ctx.fillRect(48, 14, 70, 8);
    ctx.fillStyle = st.hp < 30 ? '#e04040' : '#5cb85c';
    ctx.fillRect(48, 14, 70 * (st.hp / st.maxHp), 8);

    // 饥饿
    ctx.fillStyle = '#eee';
    ctx.fillText('饥饿', 130, 22);
    ctx.fillStyle = '#333';
    ctx.fillRect(162, 14, 70, 8);
    ctx.fillStyle = st.hunger < 25 ? '#e08030' : '#f0c040';
    ctx.fillRect(162, 14, 70 * (st.hunger / st.maxHunger), 8);

    // 日夜
    var t = st.timeOfDay;
    var period = (t < 0.22 || t > 0.78) ? '夜' : (t > 0.7 ? '暮' : '昼');
    ctx.fillStyle = '#eee';
    ctx.textAlign = 'right';
    ctx.fillText('第' + st.day + '天 · ' + period, W - 16, 22);
    ctx.textAlign = 'left';
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    var z = zoneAt(st.playerX);
    var zn = z === 'sea' ? '海里' : (z === 'beach' ? '沙滩' : '林缘');
    ctx.fillText(zn, 16, 38);

    // 背包按钮
    var bagX = W - 58, bagY = 52, bagW = 48, bagH = 28;
    ctx.fillStyle = st.bagOpen ? '#E8763A' : '#8B5E3C';
    roundRect(ctx, bagX, bagY, bagW, bagH, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('背包', bagX + bagW / 2, bagY + 18);
    hit(bagX, bagY, bagW, bagH, function () {
      st.bagOpen = !st.bagOpen;
      st.craftSlotA = null;
      st.craftSlotB = null;
    });

    // 回首页
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(ctx, 8, 52, 40, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#4A3428';
    ctx.font = '11px sans-serif';
    ctx.fillText('首页', 28, 70);
    hit(8, 52, 40, 28, function () {
      save();
      joy.active = false;
      Game.scene = 'home';
      if (Game._homeT0 !== undefined) Game._homeT0 = null;
    });
  }

  function drawJoystick(ctx, W, H) {
    var cx = 64, cy = H - 72, R = 42;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    var knx = cx + joy.dx * (R - 14);
    var kny = cy + joy.dy * (R - 14);
    if (!joy.active) { knx = cx; kny = cy; }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(knx, kny, 16, 0, Math.PI * 2);
    ctx.fill();
    // 摇杆触摸区（由 touch 专用处理，也挂 hit 兜底点击左右）
    hit(cx - R - 8, cy - R - 8, R * 2 + 16, R * 2 + 16, function () {});
  }

  function drawContextBtn(ctx, W, H) {
    var act = contextAction();
    var bx = W - 100, by = H - 100, bw = 84, bh = 52;
    if (!act) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      roundRect(ctx, bx, by, bw, bh, 12);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('—', bx + bw / 2, by + 30);
      return;
    }
    var bg = act.type === 'attack' ? '#c04030' : (act.type === 'place' || act.type === 'place_hint' ? '#6FA860' : '#E8763A');
    ctx.fillStyle = bg;
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(act.label, bx + bw / 2, by + 32);
    hit(bx, by, bw, bh, function () {
      if (act.type === 'gather') doGather(act.target);
      else if (act.type === 'attack') doAttack();
      else if (act.type === 'place') doPlaceShelter();
      else if (act.type === 'place_hint') toast('走到沙滩中段再点「建棚」');
    });
  }

  function drawBag(ctx, W, H) {
    if (!st.bagOpen) return;
    var pw = W - 24, ph = Math.min(360, H - 120);
    var px = 12, py = 88;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    hit(0, 0, W, H, function () { st.bagOpen = false; });

    ctx.fillStyle = '#FAF1DD';
    roundRect(ctx, px, py, pw, ph, 12);
    ctx.fill();
    hit(px, py, pw, ph, function () {}); // 吞掉关闭

    ctx.fillStyle = '#4A3428';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('背包 · 试错合成', px + 14, py + 26);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#8a7060';
    ctx.fillText('点两格材料再点「合成」；配方靠发现', px + 14, py + 44);

    // 物品列表
    var ids = Object.keys(SS_ITEMS);
    var row = 0;
    var invIds = [];
    for (var i = 0; i < ids.length; i++) {
      if (invCount(ids[i]) > 0) invIds.push(ids[i]);
    }
    if (invIds.length === 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = '13px sans-serif';
      ctx.fillText('空空如也。去沙滩捡浮木吧。', px + 14, py + 80);
    }
    for (var j = 0; j < invIds.length; j++) {
      var id = invIds[j];
      var it = SS_ITEMS[id];
      var ix = px + 14 + (j % 4) * 78;
      var iy = py + 58 + Math.floor(j / 4) * 64;
      var selected = (st.craftSlotA === id || st.craftSlotB === id);
      ctx.fillStyle = selected ? '#f0d090' : '#fff';
      ctx.strokeStyle = selected ? '#E8763A' : '#c9b893';
      ctx.lineWidth = 2;
      roundRect(ctx, ix, iy, 70, 54, 8);
      ctx.fill();
      ctx.stroke();
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4A3428';
      ctx.fillText(it.em, ix + 35, iy + 28);
      ctx.font = '10px sans-serif';
      ctx.fillText(it.name + '×' + invCount(id), ix + 35, iy + 46);
      (function (itemId) {
        hit(ix, iy, 70, 54, function () {
          if (st.craftSlotA === itemId) { st.craftSlotA = null; return; }
          if (st.craftSlotB === itemId) { st.craftSlotB = null; return; }
          if (!st.craftSlotA) st.craftSlotA = itemId;
          else if (!st.craftSlotB) st.craftSlotB = itemId;
          else { st.craftSlotA = itemId; st.craftSlotB = null; }
        });
      })(id);
    }

    // 合成槽显示
    var slotY = py + ph - 120;
    ctx.fillStyle = '#4A3428';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    var aName = st.craftSlotA ? SS_ITEMS[st.craftSlotA].name : '？';
    var bName = st.craftSlotB ? SS_ITEMS[st.craftSlotB].name : '？';
    ctx.fillText('试做：' + aName + ' + ' + bName, px + 14, slotY);

    // 已知配方（未发现 ???）
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#8a7060';
    ctx.fillText('已知：', px + 14, slotY + 22);
    var rx = px + 50;
    for (var ri = 0; ri < RECIPES.length; ri++) {
      var rec = RECIPES[ri];
      var known = !!st.discoveredRecipes[rec.id];
      var label = known
        ? (SS_ITEMS[rec.a].name + '+' + SS_ITEMS[rec.b].name + '→' + SS_ITEMS[rec.result].name)
        : '???';
      ctx.fillStyle = known ? '#4A3428' : '#bbb';
      ctx.fillText(label, rx, slotY + 22);
      rx += ctx.measureText(label).width + 12;
    }

    // 合成按钮
    var cbx = px + 14, cby = py + ph - 52, cbw = 100, cbh = 36;
    ctx.fillStyle = '#E8763A';
    roundRect(ctx, cbx, cby, cbw, cbh, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('合成', cbx + cbw / 2, cby + 24);
    hit(cbx, cby, cbw, cbh, function () { tryCraft(); });

    // 关闭
    var clx = px + pw - 80, cly = cby;
    ctx.fillStyle = '#c9b893';
    roundRect(ctx, clx, cly, 66, cbh, 10);
    ctx.fill();
    ctx.fillStyle = '#4A3428';
    ctx.fillText('关闭', clx + 33, cly + 24);
    hit(clx, cly, 66, cbh, function () { st.bagOpen = false; });

    // 建棚提示
    if (!st.shelterBuilt) {
      ctx.textAlign = 'left';
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#8a7060';
      ctx.fillText('首窝：浮木×4 + 简易工具×1，沙滩中段放置', px + 14, py + ph - 62);
    }
  }

  function drawWake(ctx, W, H) {
    if (Date.now() > st.wakeTextUntil) return;
    ctx.fillStyle = 'rgba(6,20,36,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FAF1DD';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    var lines = ['你在沙滩上醒来。', '没有家园。', '潮水拍着岸，林子里有动静。'];
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, H * 0.38 + i * 28);
    }
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(250,241,221,0.7)';
    ctx.fillText('点任意处继续', W / 2, H * 0.38 + 100);
    hit(0, 0, W, H, function () { st.wakeTextUntil = 0; });
  }

  function drawDeath(ctx, W, H) {
    ctx.fillStyle = 'rgba(10,8,12,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FAF1DD';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('你死了', W / 2, H * 0.32);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#c9b893';
    ctx.fillText(st.deathReason || '', W / 2, H * 0.32 + 36);

    var bw = 200, bh = 44, bx = (W - bw) / 2, by = H * 0.48;
    ctx.fillStyle = '#E8763A';
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText('看视频重生', bx + bw / 2, by + 28);
    // 接 ad.js：Game.AD.showReward('revive', ...)
    // demo 模式会走 App.openAdModal；未配置广告位时同样可测通续命
    hit(bx, by, bw, bh, function () { reviveFromAd(); });

    var by2 = by + 56;
    ctx.fillStyle = '#8B5E3C';
    roundRect(ctx, bx, by2, bw, bh, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('放弃 · 回首页', bx + bw / 2, by2 + 28);
    hit(bx, by2, bw, bh, function () {
      clearSave();
      Game.scene = 'home';
    });

    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(250,241,221,0.45)';
    ctx.fillText('IAA 占位：激励视频挂重生，主循环不打断', W / 2, by2 + 70);
  }

  function render(ctx, W, H) {
    if (!st) return;
    Game.hits = Game.hits || [];
    // 横版自管 hits：先清空由 render 入口负责；此处只追加
    drawWorld(ctx, W, H);
    drawHUD(ctx, W, H);
    if (!st.dead && Date.now() > st.wakeTextUntil) {
      drawJoystick(ctx, W, H);
      drawContextBtn(ctx, W, H);
    }
    drawBag(ctx, W, H);
    if (st.dead) drawDeath(ctx, W, H);
    else drawWake(ctx, W, H);

    // 本地 toast（无 FX 时）
    if (st.toast && Date.now() < st.toastUntil && !(Game.FX && Game.FX.toast)) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      roundRect(ctx, 40, H * 0.2, W - 80, 36, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(st.toast, W / 2, H * 0.2 + 24);
    }
  }

  // —— 触摸（摇杆） ——
  function joyBase(H) { return { cx: 64, cy: H - 72, R: 42 }; }

  function onTouchStart(p, W, H) {
    if (!st || Game.scene !== 'sidescroll') return false;
    if (st.dead || st.bagOpen) return false; // 交给 hits
    if (Date.now() < st.wakeTextUntil) return false;
    var jb = joyBase(H);
    var dx = p.x - jb.cx, dy = p.y - jb.cy;
    if (dx * dx + dy * dy <= (jb.R + 24) * (jb.R + 24)) {
      joy.active = true;
      joy.ox = p.x; joy.oy = p.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var cl = Math.min(1, len / jb.R);
      joy.dx = (dx / len) * cl;
      joy.dy = (dy / len) * cl;
      return true;
    }
    return false;
  }

  function onTouchMove(p, W, H) {
    if (!joy.active) return false;
    var jb = joyBase(H);
    var dx = p.x - jb.cx, dy = p.y - jb.cy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var cl = Math.min(1, len / jb.R);
    joy.dx = (dx / len) * cl;
    joy.dy = (dy / len) * cl;
    return true;
  }

  function onTouchEnd() {
    if (!joy.active) return false;
    joy.active = false;
    joy.dx = 0;
    joy.dy = 0;
    return true;
  }

  function isActive() {
    return Game.scene === 'sidescroll';
  }

  function getState() { return st; }

  // 首页「开始」是否走横版
  function shouldUseSideScroll() {
    var mode = Game.PLAY_MODE || DEFAULT_MODE;
    return mode === 'sidescroll';
  }

  Game.PLAY_MODE = Game.PLAY_MODE || DEFAULT_MODE;
  Game.SideScroll = {
    DEFAULT_MODE: DEFAULT_MODE,
    SAVE_KEY: SAVE_KEY,
    SS_ITEMS: SS_ITEMS,
    RECIPES: RECIPES,
    SHELTER_NEED: SHELTER_NEED,
    beginRun: beginRun,
    update: update,
    render: render,
    onTouchStart: onTouchStart,
    onTouchMove: onTouchMove,
    onTouchEnd: onTouchEnd,
    isActive: isActive,
    getState: getState,
    shouldUseSideScroll: shouldUseSideScroll,
    clearSave: clearSave,
    save: save,
    load: load,
    toast: toast
  };
})();
