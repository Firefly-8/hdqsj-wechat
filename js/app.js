/**
 * 主逻辑层：状态 / 合成 / 采集 / 建造 / 漂流瓶 / 离线收益 / 触摸 / 主循环
 * 机制与动效细节逐项复刻网页版 demo
 */
(function () {
  'use strict';

  // ============ 画布初始化（逻辑宽 375，等比缩放） ============
  var sys = wx.getSystemInfoSync();
  var W_RAW = sys.screenWidth, H_RAW = sys.screenHeight, DPR = sys.pixelRatio || 2;
  var LOGICAL_W = 375;
  var W = LOGICAL_W;
  var H = Math.round(LOGICAL_W * H_RAW / W_RAW);

  var canvas = wx.createCanvas(); // 主屏 canvas
  var ctx = canvas.getContext('2d');
  canvas.width = W_RAW * DPR;
  canvas.height = H_RAW * DPR;
  var scale = canvas.width / LOGICAL_W;

  var D = Game.DATA;
  var App = {};

  // ============ 存档 ============
  var S = null;
  var SAVE_KEY = 'islandSave_v1';

  function freshSave(maxE) {
    var today = new Date().toDateString();
    return {
      day: 1, energy: maxE || 10, maxEnergy: maxE || 10, energyTs: Date.now(),
      board: new Array(20).fill(0), stages: [], bottle: D.DAILY_BOTTLE, bottleDate: today,
      lastTs: Date.now(), space: 20, manualBonus: 0, offlineUnclaimed: false, entered: false,
      welcomed: false,
      // V1.1 天气系统
      weather: 0, weatherDate: today,
      // V1.1 事件系统
      eventDone: false, eventDate: today,
      // V1.2 饱食度系统
      food: 10, maxFood: 10, foodDate: today,
      // V1.4 轮回封锁（首次为空，轮回后随机生成）
      lockedTrees: []
    };
  }
  // 旧存档兼容：补齐缺失字段，防止读取崩溃
  function normalizeSave(s) {
    var d = freshSave(10);
    for (var k in d) if (s[k] === undefined) s[k] = d[k];
    if (!Array.isArray(s.board)) s.board = new Array(20).fill(0);
    if (s.board.length < s.space) s.board = s.board.concat(new Array(s.space - s.board.length).fill(0));
    if (s.board.length > s.space) s.space = s.board.length;
    if (!Array.isArray(s.stages)) s.stages = [];
    if (typeof s.bottleDate !== 'string') s.bottleDate = new Date().toDateString();
    return s;
  }
  // 每日漂流瓶重置（修复：原实现漂流瓶一次性消耗，再也不会刷新）
  function dailyBottleReset() {
    var today = new Date().toDateString();
    if (S.bottleDate !== today) {
      S.bottleDate = today;
      S.bottle = D.DAILY_BOTTLE;
    }
  }
  // V1.1: 每日天气刷新
  function dailyWeatherReset() {
    var today = new Date().toDateString();
    if (S.weatherDate !== today) {
      S.weatherDate = today;
      // 按概率随机天气
      var r = Math.random();
      var cum = 0;
      for (var i = 0; i < D.WEATHER.length; i++) {
        cum += D.WEATHER[i].prob;
        if (r < cum) {
          S.weather = D.WEATHER[i].type;
          break;
        }
      }
    }
  }
  // V1.1: 每日事件刷新
  function dailyEventReset() {
    var today = new Date().toDateString();
    if (S.eventDate !== today) {
      S.eventDate = today;
      S.eventDone = false;
    }
  }
  // V1.2: 每日饱食度刷新（新的一天到来时扣除饱食）
  function dailyFoodReset() {
    var today = new Date().toDateString();
    if (S.foodDate !== today) {
      S.foodDate = today;
      // 每天扣除 1 点饱食
      S.food = Math.max(0, S.food - 1);
    }
  }
  // V1.1: 获取当前天气信息
  function getWeatherInfo() {
    for (var i = 0; i < D.WEATHER.length; i++) {
      if (D.WEATHER[i].type === S.weather) return D.WEATHER[i];
    }
    return D.WEATHER[0];
  }
  // V1.1: 触发每日随机事件
  function triggerDailyEvent() {
    if (S.eventDone || S.day < 2) return; // 第1天不触发
    // 随机选择 1-2 个事件
    var eventCount = Math.random() < 0.3 ? 2 : 1;
    var shuffled = D.EVENTS.slice().sort(function () { return Math.random() - 0.5; });
    var selected = shuffled.slice(0, eventCount);
    S.eventDone = true;
    // 逐个弹事件（第一个弹完后再弹第二个）
    showNextEvent(selected, 0);
  }
  function showNextEvent(events, idx) {
    if (idx >= events.length) return;
    var ev = events[idx];
    openModal({
      title: ev.title,
      body: ev.body,
      buttons: ev.options.map(function (opt, i) {
        return {
          label: opt.label,
          primary: opt.primary,
          cb: (function (cb) { return function () { handleEventChoice(cb, events, idx); }; })(opt.cb)
        };
      })
    });
  }
  function handleEventChoice(cb, events, idx) {
    closeModal();
    var wx = D.WEATHER;
    // 处理各事件选项
    if (cb === 'beast_fight') {
      // 战斗：消耗 2 木
      var removed = 0;
      for (var i = S.space - 1; i >= 0 && removed < 2; i--) {
        if (S.board[i] === 1) { S.board[i] = 0; removed++; }
      }
      if (removed >= 2) {
        Game.FX.toast('战斗胜利！消耗 2 浮木');
      } else {
        Game.FX.toast('战斗中物资散落！');
      }
    } else if (cb === 'beast_flee') {
      // 逃跑：损失 1 随机资源
      var haveItems = [];
      for (var j = 0; j < S.space; j++) { if (S.board[j]) haveItems.push(j); }
      if (haveItems.length > 0) {
        var randIdx = haveItems[Math.floor(Math.random() * haveItems.length)];
        S.board[randIdx] = 0;
        Game.FX.toast('逃跑时掉落了 1 个资源！');
      } else {
        Game.FX.toast('逃跑成功，但啥也没掉。');
      }
    } else if (cb === 'ruins_claim') {
      // 遗迹：获得随机 L1 材料 × 2
      for (var k = 0; k < 2; k++) {
        var p = firstEmpty();
        if (p >= 0) S.board[p] = D.L1[Math.floor(Math.random() * 3)];
      }
      Game.FX.toast('发现遗迹！获得 2 个资源');
    } else if (cb === 'bottle_rare_claim') {
      // 神秘漂流瓶：获得随机 L2 材料
      var p2 = firstEmpty();
      if (p2 >= 0) S.board[p2] = D.L2_BONUS[Math.floor(Math.random() * 3)];
      Game.FX.toast('神秘漂流瓶：获得稀有材料！');
    } else if (cb === 'sunny_gift_claim') {
      // 晴天惊喜：本次采集 +1 体力（标记到 S，gather 时检查）
      S._sunnyGift = true;
      Game.FX.toast('晴天惊喜！下次采集体力 +1');
    }
    save();
    // 继续显示下一个事件
    if (idx + 1 < events.length) {
      setTimeout(function () { showNextEvent(events, idx + 1); }, 500);
    }
  }
  function load() {
    try {
      var raw = wx.getStorageSync(SAVE_KEY);
      if (raw) S = normalizeSave(JSON.parse(raw));
    } catch (e) {}
    if (!S) S = freshSave(10);
    // 离线时长
    var now = Date.now();
    S._offlineSec = Math.max(0, (now - (S.lastTs || now)) / 1000);
    // 离线补体力（按真实时间戳）
    if (S.energyTs) {
      var add = Math.floor((now - S.energyTs) / D.E_INTERVAL);
      S.energy = Math.min(S.maxEnergy, (S.energy || 0) + add);
    }
    S.energyTs = now;
    dailyBottleReset();
    // V1.1: 每日天气刷新
    dailyWeatherReset();
    // V1.1: 每日事件刷新
    dailyEventReset();
    // V1.2: 每日饱食度刷新
    dailyFoodReset();
  }
  function save() {
    S.lastTs = Date.now();
    try { wx.setStorageSync(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  // ============ 基础查询 ============
  function countItem(id) {
    var n = 0;
    for (var i = 0; i < S.space; i++) if (S.board[i] === id) n++;
    return n;
  }
  function countChain(chain) {
    var n = 0;
    for (var i = 0; i < S.space; i++) {
      var id = S.board[i];
      if (id && D.ITEMS[id].chain === chain) n++;
    }
    return n;
  }
  function firstEmpty() {
    for (var i = 0; i < S.space; i++) if (!S.board[i]) return i;
    return -1;
  }
  function boardUsed() { return S.board.filter(function (x) { return x; }).length; }

  // ============ 采集（含空手文案 + 飘字动效） ============
  function emptyLine(kind) {
    var arr = kind === 'full' ? D.FULL_LINES : D.MISS_LINES;
    Game.FX.toast(arr[Math.floor(Math.random() * arr.length)], kind === 'miss' ? 2400 : 1600);
  }
  function gather() {
    // V1.1: 风暴天禁止采集
    var wInfo = getWeatherInfo();
    if (!wInfo.canGather) { Game.FX.toast('\u26C8\uFE0F 风暴天无法外出采集！'); return; }
    // V1.2: 饱食度影响体力上限
    var effectiveMaxEnergy = S.food > 0 ? S.maxEnergy : Math.floor(S.maxEnergy * 0.5);
    if (S.energy <= 0) { Game.FX.toast('体力不足，看广告恢复'); return; }
    var pos = firstEmpty();
    if (pos < 0) { emptyLine('full'); return; } // 棋盘满
    // V1.1: 晴天惊喜体力 +1
    var energyCost = 1;
    if (S._sunnyGift) { energyCost = 0; S._sunnyGift = false; }
    S.energy -= energyCost;
    // V1.1: 晴天使采集产出概率提升
    var actualMissRate = D.MISS_RATE;
    if (wInfo.gatherBoost > 1) {
      // 采集产出加成：减少空手概率
      actualMissRate = D.MISS_RATE / wInfo.gatherBoost;
    }
    // V1.2: 采集成功率从 75% 提升到 80%（减少 5% 空手率）
    actualMissRate = Math.max(0.15, actualMissRate - 0.05);
    if (Math.random() < actualMissRate) {
      // 空手：体力照扣 + 趣味文案 + 💢 提示
      emptyLine('miss');
      var gb = getGatherBtnRect();
      Game.FX.floaty('\uD83D\uDCA2', gb.x + gb.w / 2, gb.y - 10);
      save();
      return;
    }
    var id = D.L1[Math.floor(Math.random() * 3)];
    S.board[pos] = id;
    var cellRect = getCellRect(pos);
    var bonus = wInfo.gatherBoost > 1 ? ' (+20%)' : '';
    Game.FX.floaty('\uD83C\uDFA3' + D.ITEMS[id].em + bonus, cellRect.x + cellRect.w / 2, cellRect.y - 8);
    // 采集物入格小弹跳
    if (!mergeAnim[pos]) mergeAnim[pos] = 0.35;
    setTimeout(function () { autoMerge(); }, 120);
    save();
  }

  // ============ 自动合并（3合1 连锁 + pop 弹跳 + 粒子） ============
  var mergeAnim = {};
  function autoMerge() {
    var merged = false;
    for (var id in D.ITEMS) {
      var it = D.ITEMS[id];
      if (!it.next) continue;
      var idxs = [];
      for (var i = 0; i < S.space; i++) if (S.board[i] === +id) idxs.push(i);
      if (idxs.length >= 3) {
        var keep = idxs[0];
        var next = it.next;
        S.board[keep] = next;
        S.board[idxs[1]] = 0;
        S.board[idxs[2]] = 0;
        // pop 弹跳动画（对应 .cell.merge）+ 粒子
        mergeAnim[keep] = 0.35;
        var r = getCellRect(keep);
        Game.FX.sparkle(r.x + r.w / 2, r.y + r.h / 2, D.C.fire, 10);
        Game.FX.floaty('\u2728' + D.ITEMS[next].em, r.x + r.w / 2, r.y - 8);
        Game.FX.toast(it.name + '\u00D73 \u2192 ' + D.ITEMS[next].name + '\uFF01');
        merged = true;
      }
    }
    if (merged) { autoMerge(); return; } // 连锁
    save();
  }

  // ============ 建造（V1.3 科技树 + V1.4 分支封锁 + 天数过渡 + 营地升级光晕 + 结局） ============
  function buildStage(stId) {
    var st = null;
    // V1.3: 科技树节点查找
    for (var t = 0; t < D.TECH_TREES.length; t++) {
      for (var n = 0; n < D.TECH_TREES[t].nodes.length; n++) {
        if (D.TECH_TREES[t].nodes[n].id === stId) {
          st = D.TECH_TREES[t].nodes[n];
          st._tree = D.TECH_TREES[t];
          break;
        }
      }
      if (st) break;
    }
    if (!st || S.stages.indexOf(stId) >= 0) return;
    // V1.4: 检查该分支是否被封锁
    if (S.lockedTrees && S.lockedTrees.indexOf(st._tree.id) >= 0) {
      Game.FX.toast('\uD83D\uDD12 ' + st._tree.name + '\u5206\u5DF2\u5C01\u9500\uFF0C\u65E0\u6CD5\u5EFA\u9020');
      return;
    }
    // V1.3: 检查前置节点是否已建造
    if (st.prev && S.stages.indexOf(st.prev) < 0) {
      Game.FX.toast('需先完成上一级科技');
      return;
    }
    for (var id in st.need) {
      if (countItem(+id) < st.need[id]) { Game.FX.toast('资源不足'); return; }
    }
    for (var id2 in st.need) {
      var n = st.need[id2];
      for (var k = S.space - 1; k >= 0 && n > 0; k--) {
        if (S.board[k] === +id2) { S.board[k] = 0; n--; }
      }
    }
    S.stages.push(stId);
    // 处理各类解锁效果
    if (st.unlocks === 'space') {
      S.space += 10;
      S.board = S.board.concat(new Array(10).fill(0));
    }
    // V1.3: 检查是否触发结局
    if (st.unlocks && st.unlocks.indexOf('end_') === 0) {
      S.day++;
      save();
      triggerEnding(st);
      return;
    }
    // 非结局节点，增加天数
    S.day++;
    save();
    // 天数过渡动画 → 营地升级光晕 → 提示
    Game.FX.dayTransition(S.day, function () {
      Game.FX.campUp();
      Game.FX.toast('\u5EFA\u6210\uFF1A' + st.name + '\uFF01');
    });
  }
  // V1.2: 烹饪功能（2 食物 → 1 烤肉，+3 饱食）
  function cookFood() {
    // 消耗 2 个 L2 食物（12=椰肉干）
    var consumed = 0;
    var consumedIdx = [];
    for (var i = S.space - 1; i >= 0 && consumed < 2; i--) {
      if (S.board[i] === 12) { S.board[i] = 0; consumedIdx.push(i); consumed++; }
    }
    if (consumed < 2) {
      // 退还已消耗的材料
      for (var j = 0; j < consumedIdx.length; j++) {
        S.board[consumedIdx[j]] = 12;
      }
      Game.FX.toast('需要 2 个椰肉干才能烹饪！');
      return;
    }
    // 获得 1 个烤肉
    var pos = firstEmpty();
    if (pos < 0) {
      // 退还材料
      for (var k = 0; k < consumedIdx.length; k++) {
        S.board[consumedIdx[k]] = 12;
      }
      Game.FX.toast('棋盘满了，先清空位置！');
      return;
    }
    S.board[pos] = 14; // 烤肉
    // 增加饱食度
    S.food = Math.min(S.maxFood, S.food + 3);
    Game.FX.toast('\uD83D\uDD25 烹饪成功！烤肉 +3 饱食');
    save();
  }

  // ============ 结局 / 轮回（V1.3 多结局） ============
  function triggerEnding(st) {
    // V1.3: 根据不同结局类型显示不同文案
    var endings = {
      'end_defense': { title: '\uD83C\uDF0A 部落发现！', body: '防御系统引来了附近部落的注意，他们邀请你加入村落。\n历经 ' + S.day + ' 天，你不再是孤独的漂流者。' },
      'end_gather': { title: '\uD83D\uDEA4 捕获商船！', body: '你设置的陷阱捕获了一艘经过的商船！\n历经 ' + S.day + ' 天，终于离开了荒岛。' },
      'end_build': { title: '\uD83D\uDEA2 船只建成！', body: '你亲手建造的船只完工了！\n历经 ' + S.day + ' 天，你驾驭自制的木筏驶向远方。' },
      'end_explore': { title: '\uD83D\uDED1 发现新大陆！', body: '你乘坐小舟漂流数日后，发现了未知陆地！\n历经 ' + S.day + ' 天，展开了新的冒险。' }
    };
    var ending = endings[st.unlocks] || endings['end_defense'];
    openModal({
      title: ending.title,
      body: ending.body + '\n\n开启新一周目？保留「求生手册」加成（体力上限+建成数）。',
      buttons: [
        { label: '再看看岛', primary: false, cb: function () { closeModal(); } },
        { label: '轮回重生', primary: true, cb: function () { rebirth(); } }
      ]
    });
  }
  function rebirth() {
    var keep = S.stages.length;
    var maxE = 10 + keep;
    var oldEnter = S.entered;
    // V1.4: 随机封锁 2 条科技分支
    var allTreeIds = ['defense', 'gather', 'build', 'explore'];
    var shuffled = allTreeIds.slice().sort(function () { return Math.random() - 0.5; });
    var lockedTrees = shuffled.slice(0, 2); // 封锁 2 条分支
    S = freshSave(maxE);
    S.manualBonus = keep;
    S.entered = oldEnter;
    // V1.4: 记录被封锁的分支
    S.lockedTrees = lockedTrees;
    dailyBottleReset();
    // 求生手册加成：新周目棋盘预置 keep 个一级资源作为启动优势
    for (var k = 0; k < keep; k++) { var p = firstEmpty(); if (p >= 0) S.board[p] = D.L1[k % 3]; }
    save();
    Game.S = S;
    Game.scene = 'home';
    // 显示本周目被封锁的分支
    var lockedNames = lockedTrees.map(function (tid) {
      for (var t = 0; t < D.TECH_TREES.length; t++) {
        if (D.TECH_TREES[t].id === tid) return D.TECH_TREES[t].name;
      }
      return tid;
    }).join('、');
    Game.FX.toast('\u65B0\u5468\u76EE\uFF01\u4F53\u529B\u4E0A\u9650 +' + keep + '\uFF0C\u83B7\u6C42\u751F\u624B\u518C\u542F\u52A8\u7269\u8D44\n\u672C\u5468\u76EE\u5C01\u9500\uFF1A' + lockedNames); // 新周目！体力上限 +keep，获求生手册启动物资 本周目封锁：xx
  }

  // ============ 漂流瓶 ============
  function bottle() {
    if (S.bottle <= 0) {
      Game.FX.toast('今日漂流瓶已捞完，看广告可多捞');
      Game.AD.showReward('bottle', function () { grantAd('bottle'); });
      return;
    }
    var pos = firstEmpty();
    if (pos < 0) { Game.FX.toast('棋盘满了，先合成或建造腾出空位'); return; } // 满盘不消耗漂流瓶
    S.bottle--;
    var r = Math.random();
    if (r < 0.5) {
      var id = D.L1[Math.floor(Math.random() * 3)];
      S.board[pos] = id;
      Game.FX.toast('\u6F02\u6D41\u74F6\u5F00\u51FA\uFF1A' + D.ITEMS[id].name); // 漂流瓶开出：xx
    } else if (r < 0.8) {
      var placed = 0;
      for (var k = 0; k < 3; k++) { var p = firstEmpty(); if (p >= 0) { S.board[p] = D.L1[k % 3]; placed++; } }
      Game.FX.toast(placed ? ('\u6F02\u6D41\u74F6\uFF1A\u83B7\u5F97 ' + placed + ' \u4E2A\u8D44\u6E90\uFF01') : '\u68CB\u76D8\u5DF2\u6EE1\uFF0C\u4EC0\u4E48\u4E5F\u6CA1\u635E\u5230');
      autoMerge();
      save();
      return;
    } else {
      var id2 = D.L2_BONUS[Math.floor(Math.random() * 3)];
      S.board[pos] = id2;
      Game.FX.toast('\u6F02\u6D41\u74F6\u5F00\u51FA\uFF1A' + D.ITEMS[id2].name);
    }
    autoMerge();
    save();
  }

  // ============ 广告 ============
  function grantAd(type) {
    if (type === 'energy') {
      S.energy = Math.min(S.maxEnergy, S.energy + 5);
      S.energyTs = Date.now();
      Game.FX.toast('体力 +5');
    } else if (type === 'bottle') {
      S.bottle++;
      Game.FX.toast('漂流瓶 +1');
    } else if (type === 'offline') {
      grantOffline(S._offlineReward * 2);
    }
    save();
  }
  function onAdEnergy() {
    if (S.energy >= S.maxEnergy) { Game.FX.toast('体力已满'); return; }
    Game.AD.showReward('energy', function () { grantAd('energy'); });
  }
  function onAdOffline() {
    if (!S.offlineUnclaimed) { Game.FX.toast('暂无离线收益'); return; }
    Game.AD.showReward('offline', function () { grantAd('offline'); });
  }
  // 演示模式广告弹窗（对应网页 openAd）
  App.openAdModal = function (type, onDone) {
    openModal({
      title: '\uD83D\uDCFA \u6FC0\u52B1\u89C6\u9891\u5E7F\u544A', // 激励视频广告
      body: '（演示模式，模拟真实广告）\n观看完成后可获得奖励。',
      buttons: [
        { label: '取消', primary: false, cb: function () { closeModal(); } },
        { label: '观看并领取', primary: true, cb: function () { closeModal(); if (onDone) onDone(); } }
      ]
    });
  };

  // ============ 离线收益 ============
  function calcOffline() {
    if (S.stages.indexOf(1) < 0) { S._offlineReward = 0; return; }
    var mins = Math.floor(S._offlineSec / 60);
    var cap = 30;
    S._offlineReward = Math.min(mins, cap);
    S.offlineUnclaimed = S._offlineReward > 0;
  }
  function grantOffline(times) {
    for (var i = 0; i < times; i++) {
      var p = firstEmpty();
      if (p < 0) break;
      S.board[p] = D.L1[Math.floor(Math.random() * 3)];
    }
    S.offlineUnclaimed = false;
    autoMerge();
    Game.FX.toast('\u9886\u53D6\u79BB\u7EBF\u6536\u76CA\uFF1A' + times + '\u4E2A\u8D44\u6E90'); // 领取离线收益：N个资源
    save();
  }

  // ============ Tab / 标签 ============
  function switchTab(t) { Game.tab = t; }

  // 体力倒计时文案（对应 #energyTimer）
  function energyTimerText() {
    if (S.energy >= S.maxEnergy) return '\u6EE1'; // 满
    var remain = Math.max(0, Math.ceil((D.E_INTERVAL - (Date.now() - S.energyTs)) / 1000));
    return remain + 's';
  }
  function tryTickEnergy() {
    if (S.energy < S.maxEnergy && S.energyTs) {
      // V1.1: 体力恢复受天气影响（雨夭 energyRate = 0.5）
      var wInfo = getWeatherInfo();
      var effectiveInterval = D.E_INTERVAL / wInfo.energyRate;
      if (Date.now() - S.energyTs >= effectiveInterval) {
        S.energy++;
        S.energyTs = Date.now();
        save();
      }
    }
  }

  // V1.3 营地标签文案（科技树）
  function campTagText() {
    var lvl = S.stages.length;
    // 计算已完成节点最多的分支
    var treeCounts = {};
    for (var t = 0; t < D.TECH_TREES.length; t++) {
      var treeId = D.TECH_TREES[t].id;
      var count = 0;
      for (var n = 0; n < D.TECH_TREES[t].nodes.length; n++) {
        if (S.stages.indexOf(D.TECH_TREES[t].nodes[n].id) >= 0) count++;
      }
      treeCounts[treeId] = count;
    }
    // 找到进度最快的分支
    var maxTree = null, maxCount = 0;
    for (var tid in treeCounts) {
      if (treeCounts[tid] > maxCount) { maxCount = treeCounts[tid]; maxTree = tid; }
    }
    if (lvl === 0) return '\u8425\u5730 Lv.0 \u00B7 \u521D\u59CB';
    var treeName = maxTree ? (function () {
      for (var tt = 0; tt < D.TECH_TREES.length; tt++) {
        if (D.TECH_TREES[tt].id === maxTree) return D.TECH_TREES[tt].name;
      }
    })() : '';
    return '\u8425\u5730 Lv.' + Math.floor(lvl / 3) + ' \u00B7 ' + treeName + ' ' + maxCount + '/3';
  }

  // ============ 首页 / CG ============
  var cg = null;

  function startLabel() {
    if (S.day > 1 || S.stages.length > 0 || S.entered) return '\u7EE7\u7EED\u5192\u9669'; // 继续冒险
    return '\u5F00\u59CB\u6F02\u6D41'; // 开始漂流
  }
  function onStart() {
    var isNew = S.day === 1 && S.stages.length === 0 && !S.board.some(function (x) { return x; }) && !S.entered;
    if (isNew) playCG();
    else enterGame();
  }
  function playCG() {
    Game.scene = 'cg';
    cg = { shown: '', sink: 0, started: false };
    Game.cg = cg;
    var text = D.CG_TEXT;
    var i = 0;
    var timer = setInterval(function () {
      i++;
      cg.shown = text.substring(0, i);
      if (i >= text.length) {
        clearInterval(timer);
        // 打字完成后船下沉
        cg.started = true;
        setTimeout(function () { enterGame(); }, 700);
      }
    }, 55);
    // 船 2.2s 后开始下沉
    setTimeout(function () {
      if (Game.scene === 'cg' && cg) { cg.sink = 1; } // 下沉（1 = 完全下沉淡出）
    }, 2200);
  }
  function skipCG() {
    if (Game.scene === 'cg') {
      Game.scene = 'home';
      enterGame();
    }
  }
  function enterGame() {
    // 进入主游戏前先显示约 1s 的加载过渡，更具真实感
    Game.scene = 'loading';
    S.entered = true;
    // 首次进入额外赠送体力（仅一次），让新用户多玩一会儿
    if (!S.welcomed) {
      S.maxEnergy += 10;
      S.energy = S.maxEnergy;
      S.welcomed = true;
    }
    save();
    // 1s 后进入主游戏（loading 期间不可操作）
    setTimeout(function () {
      Game.scene = 'game';
      // 加载完成后再弹离线/首玩引导，避免盖在 loading 之上
      if (S.offlineUnclaimed && S._offlineReward > 0) {
        openModal({
          title: '\uD83C\uDF0A \u6B22\u8FCE\u56DE\u5230\u830D\u5C9B', // 欢迎回到荒岛
          body: '你离开了 ' + Math.floor(S._offlineSec / 60) + ' 分钟\n营地为你攒下了 ' + S._offlineReward + ' 个资源',
          buttons: [
            { label: '直接领取', primary: false, cb: function () { closeModal(); grantOffline(S._offlineReward); triggerDailyEvent(); } },
            { label: '看广告翻倍', primary: true, cb: function () { closeModal(); Game.AD.showReward('offline', function () { grantAd('offline'); triggerDailyEvent(); }); } }
          ]
        });
      } else if (S.stages.indexOf(1) < 0 && S.day === 1) {
        Game.FX.toast('\u70B9\u91C7\u96C6\u6536\u96C6\u8D44\u6E90\uFF0C3\u4E2A\u540C\u7C7B\u81EA\u52A8\u5408\u6210\u5347\u7EA7');
        triggerDailyEvent();
      } else {
        // V1.1: 触发每日随机事件
        triggerDailyEvent();
      }
    }, 1000);
  }
  function backHome() {
    save();
    Game.scene = 'home';
  }

  // ============ 弹窗（对应 .overlay + .modal） ============
  var modal = null;
  function openModal(m) { modal = m; Game.modal = m; }
  function closeModal() { modal = null; Game.modal = null; }
  function onModalBtn(idx) {
    var m = Game.modal;
    if (!m || !m.buttons[idx]) return;
    var cb = m.buttons[idx].cb;
    if (cb) cb();
  }

  // ============ 触摸 + 滚动 ============
  var pendingHit = null;
  var scrollTouchStartY = null;
  var scrollTouchStartScrollY = null;

  function touchPos(e) {
    var t = e.touches && e.touches[0];
    if (!t) return null;
    return { x: t.clientX * (LOGICAL_W / W_RAW), y: t.clientY * (LOGICAL_W / W_RAW) };
  }
  function onTouchStart(e) {
    var p = touchPos(e);
    if (!p) return;
    // 弹窗优先
    if (modal) {
      // 命中弹窗按钮
      for (var i = Game.hits.length - 1; i >= 0; i--) {
        var h = Game.hits[i];
        if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
          pendingHit = h;
          pressedRect = h;
          return;
        }
      }
      pendingHit = null;
      pressedRect = null;
      return;
    }
    // CG 场景任意点击跳过
    if (Game.scene === 'cg') {
      pendingHit = { cb: skipCG };
      pressedRect = null;
      return;
    }
    // 棋盘面板区域（4列滚动）检测滑动
    var py = 148, ph = H - 148 - 118;
    if (Game.scene === 'game' && Game.tab === 'board' && p.x >= 10 && p.x <= W - 10 && p.y >= py && p.y <= py + ph) {
      scrollTouchStartY = p.y;
      scrollTouchStartScrollY = Game.boardScrollY || 0;
    } else {
      scrollTouchStartY = null;
    }
    // 正常场景：逆序命中（上层优先）
    for (var j = Game.hits.length - 1; j >= 0; j--) {
      var hj = Game.hits[j];
      if (p.x >= hj.x && p.x <= hj.x + hj.w && p.y >= hj.y && p.y <= hj.y + hj.h) {
        pendingHit = hj;
        pressedRect = hj;
        return;
      }
    }
    pendingHit = null;
    pressedRect = null;
  }
  function onTouchEnd(e) {
    // 处理棋盘滚动
    if (scrollTouchStartY !== null) {
      scrollTouchStartY = null;
      return;
    }
    if (pendingHit) {
      var cb = pendingHit.cb;
      pendingHit = null;
      pressedRect = null;
      if (cb) cb();
    } else {
      pressedRect = null;
    }
  }
  // 触摸移动：处理棋盘滚动
  function onTouchMove(e) {
    if (scrollTouchStartY === null || Game.scene !== 'game' || Game.tab !== 'board') return;
    var p = touchPos(e);
    if (!p) return;
    var dy = scrollTouchStartY - p.y; // 手指上滑为正
    var scrollDelta = dy * 1.5; // 滚动系数
    var newScrollY = scrollTouchStartScrollY + scrollDelta;
    // 计算最大滚动值
    var cols = 4, cellGap = 12, bh2 = 52;
    var totalRows = Math.ceil(S.space / cols);
    var visibleRows = Math.floor((H - 148 - 118 - 26) / (bh2 + cellGap));
    var maxScroll = Math.max(0, totalRows * (bh2 + cellGap) - (H - 148 - 118 - 26));
    newScrollY = Math.max(0, Math.min(maxScroll, newScrollY));
    Game.boardScrollY = newScrollY;
  }
  function onTouchCancel() {
    pendingHit = null;
    pressedRect = null;
    scrollTouchStartY = null;
  }

  // 按压反馈：判断某按钮矩形是否正被按下
  var pressedRect = null;
  function isPressed(x, y, w, h) {
    if (!pressedRect) return false;
    return x < pressedRect.x + pressedRect.w && x + w > pressedRect.x &&
           y < pressedRect.y + pressedRect.h && y + h > pressedRect.y;
  }

  // ============ 布局辅助（供飘字/动效定位） ============
  function getGatherBtnRect() {
    var ay = H - 112;
    return { x: 10, y: ay, w: (W - 20) * 0.58, h: 42 };
  }
  function getCellRect(ci) {
    var py = 148, ph = H - 148 - 118;
    var cols = 4, cellGap = 12;
    var bw = (W - 20 - 12 - cellGap * (cols - 1)) / cols;
    var bh = 52; // 与渲染层一致
    var boardScrollY = Game.boardScrollY || 0;
    return {
      x: 10 + 6 + (ci % cols) * (bw + cellGap),
      y: py + 24 - boardScrollY + Math.floor(ci / cols) * (bh + cellGap),
      w: bw, h: bh
    };
  }

  // ============ 主循环 ============
  var lastTime = Date.now();
  var lastSave = Date.now();

  function loop() {
    var now = Date.now();
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    // 动效更新 + 合并弹跳衰减
    Game.FX.update(dt);
    for (var k in mergeAnim) {
      mergeAnim[k] -= dt;
      if (mergeAnim[k] <= 0) delete mergeAnim[k];
    }
    tryTickEnergy();

    // 绘制
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    Game.Render.render(ctx, W, H, now / 1000);

    // 定时存档（每 5s）
    if (now - lastSave > 5000) { lastSave = now; save(); }

    requestAnimationFrame(loop);
  }

  // ============ 启动 ============
  App.start = function () {
    load();
    calcOffline();
    Game.S = S;
    Game.scene = 'home';
    Game.tab = 'board';
    Game.modal = null;
    Game.cg = null;
    Game.mergeAnim = mergeAnim;
    Game.AD.init();

    // 预加载物品手绘图（透明 WebP，失败降级 emoji）
    Game.assets = {};
    var _imgMap = D.ITEM_IMG || {};
    for (var _id in _imgMap) {
      var _img = wx.createImage();
      _img.src = 'images/' + _imgMap[_id];
      Game.assets[_id] = _img;
    }

    // 预加载场景背景图（首页/夜海/海滩，失败降级程序渐变）
    Game.bgAssets = {};
    var _bgMap = D.BG_IMG || {};
    for (var _bgk in _bgMap) {
      var _bg = wx.createImage();
      _bg.src = 'images/' + _bgMap[_bgk];
      Game.bgAssets[_bgk] = _bg;
    }

    // 暴露接口给渲染层
    Game.App = App;
    Game.isPressed = isPressed;
    Game.startLabel = startLabel;

    wx.onTouchStart(onTouchStart);
    wx.onTouchMove(onTouchMove);
    wx.onTouchEnd(onTouchEnd);
    wx.onTouchCancel(onTouchCancel);

    loop();
  };

  // 渲染层通过 Game.App 调用的方法
  App.startLabel = startLabel;
  App.onStart = onStart;
  App.backHome = backHome;
  App.gather = gather;
  App.bottle = bottle;
  App.buildStage = buildStage;
  App.switchTab = switchTab;
  App.countItem = countItem;
  App.countChain = countChain;
  App.boardUsed = boardUsed;
  App.energyTimerText = energyTimerText;
  App.campTagText = campTagText;
  App.offlineUnclaimed = function () { return S.offlineUnclaimed; };
  App.onAdEnergy = onAdEnergy;
  App.onAdOffline = onAdOffline;
  App.onModalBtn = onModalBtn;
  App.grantOffline = grantOffline;
  // V1.1: 天气信息
  App.getWeatherInfo = getWeatherInfo;
  // V1.2: 饱食度信息
  App.getFoodInfo = function () {
    return {
      food: S.food,
      maxFood: S.maxFood,
      isHungry: S.food === 0,
      effectiveMaxEnergy: S.food > 0 ? S.maxEnergy : Math.floor(S.maxEnergy * 0.5)
    };
  };

  Game.App = App;
})();
