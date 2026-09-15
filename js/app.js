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
      lockedTrees: [],
      // V1.8: 小说日记进度（随玩法解锁）与真结局 meta
      diaryScore: 0, diary: [], earnedEndings: [], rebirths: 0, totalBuilds: 0, totalDays: 0,
      // V1.11: 真结局一次性闸门（earnedEndings 跨周目保留，原实现会让真结局被无限重复触发）
      trueEndingDone: false,
      // V1.11: 科技树解锁标记显式初始化（原为 undefined，靠 falsy 侥幸工作）
      craftBonus: false, gatherBonus: false, bottleBonus: false,
      // V1.11: 休息额度显式初始化
      _restCount: 3, _lastRest: 0
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
  // V1.8: 小说日记解锁（进度分驱动 + 结局显式解锁）
  function diaryUnlock(idx) {
    if (S.diary.indexOf(idx) < 0) S.diary.push(idx);
  }
  function recomputeDiary() {
    // V1.9机制修复: 改为按「累计生存天数」解锁（故事跟随求生进度走，跨周目不倒退）
    // 原按 diaryScore 行为分解锁，开局几分钟（进游戏+建1次+事件+椰子）就能跳到第4篇，与游戏天数严重脱节
    for (var i = 0; i < D.LOGS.length; i++) {
      var req = D.LOGS[i].req;
      if (req !== undefined && req <= S.totalDays) diaryUnlock(i);
    }
    S.diary.sort(function (a, b) { return a - b; });
  }
  function addDiaryScore(n) {
    S.diaryScore += n;
    recomputeDiary();
  }
  // 每日漂流瓶重置（修复：原实现漂流瓶一次性消耗，再也不会刷新）
  function dailyBottleReset() {
    var today = new Date().toDateString();
    if (S.bottleDate !== today) {
      S.bottleDate = today;
      S.bottle = D.DAILY_BOTTLE + (S.bottleBonus ? 1 : 0); // V1.6: 海图解锁后每日 +1
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
  // V1.11: 饥饿时体力上限减半 —— 统一出口，避免各处各算一份导致显示与行为不一致
  function effectiveMaxEnergy() {
    return S.food > 0 ? S.maxEnergy : Math.floor(S.maxEnergy * 0.5);
  }
  // 两个日期串之间的天数差（用于离线补算）
  function daysBetween(fromStr, toStr) {
    var a = new Date(fromStr), b = new Date(toStr);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1;
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
  }
  // V1.2: 每日饱食度刷新（新的一天到来时扣除饱食）
  // V1.11机制修复: 原实现固定只扣 1 点、不按间隔天数补算 → 离线 10 天回归也只掉 1 点，饱食度压力形同虚设
  function dailyFoodReset() {
    var today = new Date().toDateString();
    if (S.foodDate !== today) {
      var days = daysBetween(S.foodDate, today);
      S.foodDate = today;
      S.food = Math.max(0, S.food - days);
      // V1.11: 饥饿使上限减半后，当前体力需同步收敛，否则会出现「20/10」这种越界显示
      S.energy = Math.min(S.energy, effectiveMaxEnergy());
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
      // 战斗：消耗 2 浮木
      // V1.11机制修复: 原实现「边扣边判」—— 只有 1 个浮木时，那 1 个会先被扣掉，
      //   随后 removed<2 又走失败分支再扣 2 个随机资源，净损失 3 个，而提示只说「损失 2 个资源」。
      //   现先校验数量，不足则完全不扣浮木，直接进失败分支。
      if (countItem(1) >= 2) {
        var removed = 0;
        for (var i = S.space - 1; i >= 0 && removed < 2; i--) {
          if (S.board[i] === 1) { S.board[i] = 0; removed++; }
        }
        Game.FX.toast('战斗胜利！消耗 2 浮木');
      } else {
        // V1.10机制修复: 原「物资散落」无任何惩罚 = 战斗必胜（而逃跑必掉资源）→ 选项严重失衡
        // 改为：没有武器(浮木)硬刚野兽 → 战斗失败，损失 2 个随机资源
        var lostIdx = [];
        for (var li = 0; li < S.space; li++) if (S.board[li]) lostIdx.push(li);
        var lostCount = 0;
        for (var lk = 0; lk < 2 && lostIdx.length > 0; lk++) {
          var ri = Math.floor(Math.random() * lostIdx.length);
          S.board[lostIdx[ri]] = 0;
          lostIdx.splice(ri, 1);
          lostCount++;
        }
        Game.FX.toast(lostCount > 0 ? ('浮木不足，被野兽冲散！损失 ' + lostCount + ' 个资源') : '浮木不足，所幸没丢东西');
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
      // V1.11机制修复: 原实现棋盘满时静默丢弃，toast 仍报「获得 2 个资源」（谎报）
      var gotRuins = 0;
      for (var k = 0; k < 2; k++) {
        var p = firstEmpty();
        if (p >= 0) { S.board[p] = D.L1[Math.floor(Math.random() * 3)]; gotRuins++; }
      }
      Game.FX.toast(gotRuins > 0 ? ('发现遗迹！获得 ' + gotRuins + ' 个资源') : '发现遗迹，但背筐已满');
      autoMerge();
    } else if (cb === 'bottle_rare_claim') {
      // 神秘漂流瓶：获得随机 L2 材料
      var p2 = firstEmpty();
      if (p2 >= 0) {
        S.board[p2] = D.L2_BONUS[Math.floor(Math.random() * 3)];
        Game.FX.toast('神秘漂流瓶：获得稀有材料！');
      } else {
        Game.FX.toast('背筐已满，神秘漂流瓶没能收下');
      }
      autoMerge();
    } else if (cb === 'sunny_gift_claim') {
      // 晴天惊喜：下一次采集不消耗体力（标记到 S，gather 时检查 _sunnyGift）
      // V1.11: 文案原写「体力 +1」，但实现是「免消耗 1 点」，两者不等价（体力已满时前者仍有收益、后者没有）
      S._sunnyGift = true;
      Game.FX.toast('晴天惊喜！下次采集不耗体力');
    }
    // V1.9机制修复: 事件不再直接推进日记（日记改由累计天数驱动，避免开局速通解锁）
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
      // V1.11: 上限改用 effectiveMaxEnergy（饥饿时不该补到减半前的上限）
      S.energy = Math.min(effectiveMaxEnergy(), (S.energy || 0) + add);
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
  // V1.5: 获取当前采集工具等级（基于已建造的科技节点）
  function getGatherLevel() {
    var level = 1;
    // 采集分支：结绳(111) → 渔网(112) → 陷阱(113)
    if (S.stages.indexOf(113) >= 0) level = 4;
    else if (S.stages.indexOf(112) >= 0) level = 3;
    else if (S.stages.indexOf(111) >= 0) level = 2;
    return level;
  }
  // V1.5: 根据工具等级和天气计算物品等级概率
  function getRandomItemByLevel() {
    var wInfo = getWeatherInfo();
    var level = getGatherLevel();
    // 基础概率：Lv1=70% Lv1, 25% Lv2, 5% Lv3
    // Lv2: 40% Lv1, 45% Lv2, 15% Lv3
    // Lv3: 20% Lv1, 50% Lv2, 30% Lv3
    // Lv4: 10% Lv1, 40% Lv2, 50% Lv3
    var probs = {
      1: [0.70, 0.25, 0.05],
      2: [0.40, 0.45, 0.15],
      3: [0.20, 0.50, 0.30],
      4: [0.10, 0.40, 0.50]
    };
    var p = probs[level] || probs[1];
    // 天气加成：晴天额外 +5% 高品质
    if (wInfo && wInfo.gatherBoost > 1) {
      p[2] = Math.min(0.5, p[2] + 0.05);
      p[0] = Math.max(0.1, p[0] - 0.05);
    }
    var r = Math.random();
    // V1.5: 额外概率获得概率食物（椰子等）：挖到直接恢复体力，概率稍低
    if (r < 0.1) {
      return { type: 'food', id: 11 }; // 椰子
    }
    r = (r - 0.1) / 0.9; // 重新映射剩余概率（成功路径内）
    if (r < p[0]) return { type: 'item', id: D.L1[Math.floor(Math.random() * 3)] }; // L1
    else if (r < p[0] + p[1]) return { type: 'item', id: D.L2_BONUS[Math.floor(Math.random() * 3)] }; // L2
    // V1.10机制修复: L3 档原固定返回木架(3)，导致「高品质」永远只有木头，食物/石链 L3 只能靠合成
    else return { type: 'item', id: [3, 13, 23][Math.floor(Math.random() * 3)] }; // L3 三链随机
  }
  // V1.5: 计算本次采集空手率（受天气 / 版本影响）
  function computeMissRate() {
    var wInfo = getWeatherInfo();
    var rate = D.MISS_RATE;
    if (wInfo.gatherBoost > 1) rate = D.MISS_RATE / wInfo.gatherBoost; // 晴天降低空手率
    if (S.gatherBonus) rate *= 0.8; // V1.6: 陷阱解锁后空手率再降 20%
    return Math.max(0.12, rate - 0.05); // V1.2: 整体 -5% 空手
  }
  // V1.5: 采集成功后的落地（含椰子等概率食物恢复体力）
  function processGatherResult(pos) {
    // V1.11机制修复: 采集动画 2.4s 期间棋盘仍可被改动（例如烹饪会用 firstEmpty 放产物），
    //   原实现直接写回 S.board[pos]，会把动画期间落到该格的物品安静覆盖掉 —— 材料白费且玩家无从察觉。
    //   现先校验原位置是否已被占用，被占则另寻空位。
    if (S.board[pos]) {
      var alt = firstEmpty();
      if (alt < 0) { Game.FX.toast('棋盘满了，这次收获没地方放'); return; }
      pos = alt;
    }
    var cellRect = getCellRect(pos);
    var cx = cellRect.x + cellRect.w / 2;
    var cy = cellRect.y - 8;
    var result = getRandomItemByLevel();
    if (result.type === 'food') {
      // 椰子等概率食物：挖到直接恢复 1-2 点体力（概率较低）
      var gain = Math.floor(Math.random() * 2) + 1;
      S.energy = Math.min(S.maxEnergy, S.energy + gain);
      S.board[pos] = result.id; // 同时作为食物留在棋盘
      Game.FX.floaty('\uD83E\uDD65 +' + gain + '体力', cx, cy);
      Game.FX.toast('发现椰果！体力 +' + gain);
    } else {
      S.board[pos] = result.id;
      var toolLevel = getGatherLevel();
      var wInfo = getWeatherInfo();
      var bonus = (wInfo.gatherBoost > 1 || toolLevel > 1) ? (' Lv' + toolLevel) : '';
      Game.FX.floaty('\uD83C\uDFA3' + D.ITEMS[result.id].em + bonus, cx, cy);
    }
    // 采集物入格小弹跳
    if (!mergeAnim[pos]) mergeAnim[pos] = 0.35;
    setTimeout(function () { autoMerge(); }, 120);
    save();
  }
  function gather() {
    // V1.5: 动画进行中禁止重复触发，避免能量被多次扣除
    if (Game.FX.gatherAnimActive && Game.FX.gatherAnimActive()) return;
    // V1.1: 风暴天禁止采集
    var wInfo = getWeatherInfo();
    if (!wInfo.canGather) { Game.FX.toast('\u26C8\uFE0F 风暴天无法外出采集！'); return; }
    if (S.energy <= 0) { Game.FX.toast('体力不足，看广告恢复'); return; }
    var pos = firstEmpty();
    if (pos < 0) { emptyLine('full'); return; } // 棋盘满
    // 扣体力（晴天惊喜可免）
    var energyCost = S._sunnyGift ? 0 : 1;
    S._sunnyGift = false;
    S.energy -= energyCost;
    save();
    // 预判定空手率，但动画期间不揭晓，结束后再给反馈（更有「挖掘」代入感）
    var isMiss = Math.random() < computeMissRate();
    // V1.5: 触发采集动画（1.5s 挖掘过程），结束后落地结果
    Game.FX.gatherAnim(function () {
      if (isMiss) {
        // 空手：体力照扣 + 趣味文案 + 💢 提示
        emptyLine('miss');
        var gb = getGatherBtnRect();
        Game.FX.floaty('\uD83D\uDCA2', gb.x + gb.w / 2, gb.y - 10);
      } else {
        processGatherResult(pos);
      }
      save();
    });
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
    var st = null, stTree = null;
    // V1.3: 科技树节点查找
    // V1.11: 改用局部变量 —— 原实现把 _tree 挂到 D.TECH_TREES 的节点对象上，污染了全局常量
    for (var t = 0; t < D.TECH_TREES.length; t++) {
      for (var n = 0; n < D.TECH_TREES[t].nodes.length; n++) {
        if (D.TECH_TREES[t].nodes[n].id === stId) {
          st = D.TECH_TREES[t].nodes[n];
          stTree = D.TECH_TREES[t];
          break;
        }
      }
      if (st) break;
    }
    if (!st || S.stages.indexOf(stId) >= 0) return;
    // V1.4: 检查该分支是否被封锁
    if (S.lockedTrees && stTree && S.lockedTrees.indexOf(stTree.id) >= 0) {
      Game.FX.toast('\uD83D\uDD12 ' + stTree.name + '\u5206\u652F\u5DF2\u5C01\u9501\uFF0C\u65E0\u6CD5\u5EFA\u9020'); // V1.11: 修「分已封销」错字（应为「分支已封锁」）
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
    // 处理各类解锁效果（V1.6 扩展：space2/energy/foodcap/offline/gather/bottle/craft）
    if (st.unlocks === 'space') {
      S.space += 10;
      S.board = S.board.concat(new Array(10).fill(0));
    } else if (st.unlocks === 'space2') {
      S.space += 6;
      S.board = S.board.concat(new Array(6).fill(0));
    } else if (st.unlocks === 'energy') {
      S.maxEnergy += 3; S.energy += 3;
    } else if (st.unlocks === 'foodcap') {
      S.maxFood += 5; S.food += 5;
    } else if (st.unlocks === 'offline') {
      S.offlineUnlocked = true; // V1.6: 修正原 indexOf(1) 的判定错误
    } else if (st.unlocks === 'gather') {
      S.gatherBonus = true;
    } else if (st.unlocks === 'bottle') {
      S.bottleBonus = true;
    } else if (st.unlocks === 'craft') {
      S.craftBonus = true;
    }
    // V1.3: 检查是否触发结局
    if (st.unlocks && st.unlocks.indexOf('end_') === 0) {
      S.day++;
      S.totalBuilds++; S.totalDays++;
      recomputeDiary(); // V1.9: 天数推进后刷新日记解锁
      save();
      triggerEnding(st);
      return;
    }
    // 非结局节点，增加天数
    S.day++;
    S.totalBuilds++; S.totalDays++;
    recomputeDiary(); // V1.9: 天数推进后刷新日记解锁
    save();
    // 天数过渡动画 → 营地升级光晕 → 提示
    Game.FX.dayTransition(S.day, function () {
      Game.FX.campUp();
      Game.FX.toast('\u5EFA\u6210\uFF1A' + st.name + '\uFF01');
    });
  }
  // V1.2/V1.9: 烹饪功能（2 椰油饼 → 1 炭烤椰排，+3/4 饱食）
  // V1.10机制修复: ①原消耗 2 椰肉干(12) 是自动合成链(12→13→14 需 9 个 12)的 4.5 倍便宜，13 椰油饼形同虚设；
  //              ②cookFood 从未导出到 App、渲染层无按钮 → 饱食度系统根本无法恢复（饥饿=体力上限减半且无解）
  // 现改为消耗 2 个椰油饼(13) → 1 炭烤椰排(14)：13 成为必经材料、12 仅用于自动合成（不再被烹饪抢走）、比例仅略优于 3:1 合成
  function cookFood() {
    // 消耗 2 个 L3 食物（13=椰油饼）
    var consumed = 0;
    var consumedIdx = [];
    for (var i = S.space - 1; i >= 0 && consumed < 2; i--) {
      if (S.board[i] === 13) { S.board[i] = 0; consumedIdx.push(i); consumed++; }
    }
    if (consumed < 2) {
      // 退还已消耗的材料
      for (var j = 0; j < consumedIdx.length; j++) {
        S.board[consumedIdx[j]] = 13;
      }
      Game.FX.toast('需要 2 个椰油饼才能烹饪！');
      return;
    }
    // 获得 1 个炭烤椰排（终极料理）
    var pos = firstEmpty();
    if (pos < 0) {
      // 退还材料
      for (var k = 0; k < consumedIdx.length; k++) {
        S.board[consumedIdx[k]] = 13;
      }
      Game.FX.toast('棋盘满了，先清空位置！');
      return;
    }
    S.board[pos] = 14; // 炭烤椰排
    // 增加饱食度（V1.6: 工坊解锁后额外 +1）
    S.food = Math.min(S.maxFood, S.food + (S.craftBonus ? 4 : 3));
    Game.FX.toast('\uD83D\uDD25 烹饪成功！炭烤椰排 +' + (S.craftBonus ? 4 : 3) + ' 饱食');
    save();
  }

  // ============ 结局 / 轮回（V1.3 多结局 + V1.8 真结局） ============
  function triggerEnding(st) {
    // V1.3: 根据不同结局类型显示不同文案
    var endings = {
      'end_defense': { title: '\uD83C\uDF0A 部落发现！', body: '防御系统引来了附近部落的注意，他们邀请你加入村落。\n历经 ' + S.day + ' 天，你不再是孤独的漂流者。' },
      'end_gather': { title: '\uD83D\uDEA4 捕获商船！', body: '你设置的陷阱捕获了一艘经过的商船！\n历经 ' + S.day + ' 天，终于离开了荒岛。' },
      'end_build': { title: '\uD83D\uDEA2 船只建成！', body: '你亲手建造的船只完工了！\n历经 ' + S.day + ' 天，你驾驭自制的木筏驶向远方。' },
      'end_explore': { title: '\uD83D\uDED1 发现新大陆！', body: '你乘坐小舟漂流数日后，发现了未知陆地！\n历经 ' + S.day + ' 天，展开了新的冒险。' }
    };
    var ending = endings[st.unlocks] || endings['end_defense'];
    // V1.8: 记录已集齐结局 + 解锁对应日记篇
    if (S.earnedEndings.indexOf(st.unlocks) < 0) S.earnedEndings.push(st.unlocks);
    for (var li = 0; li < D.LOGS.length; li++) {
      if (D.LOGS[li].ending === st.unlocks) { diaryUnlock(li); break; }
    }
    save();
    // V1.8: 集齐四种归途 → 真结局胜利庆祝（大结局）
    // V1.11机制修复: 原实现只看 earnedEndings.length>=4，而该数组跨周目保留 →
    //   第二周目建出第一个结局节点就会被判定为「已集齐」，直接跳真结局页，且可无限重复。
    //   现加 trueEndingDone 一次性闸门。
    if (S.earnedEndings.length >= 4 && !S.trueEndingDone) {
      S.trueEndingDone = true;
      save();
      triggerVictory();
      return;
    }
    var got = S.earnedEndings.length;
    openModal({
      title: ending.title,
      body: ending.body + '\n\n【归途 ' + got + '/4】集齐四种结局可解锁「真结局·四象归一」大结局。\n开启新一周目？保留「求生手册」加成（体力上限+建成数）。',
      buttons: [
        { label: '再看看岛', primary: false, cb: function () { closeModal(); } },
        { label: '轮回重生', primary: true, cb: function () { rebirth(); } }
      ]
    });
  }
  // V1.8: 真结局 —— 集齐四种归途后进入精致胜利庆祝场景
  function triggerVictory() {
    diaryUnlock(D.LOGS.length - 1); // 解锁「真结局·四象归一」篇
    save();
    Game.victory = {
      day: S.day,
      rebirths: S.rebirths,
      builds: S.totalBuilds,
      endings: S.earnedEndings.length
    };
    Game.scene = 'victory';
  }
  // V1.8: 胜利页「再启新程」—— 保留已集齐结局图鉴，开启全新一周目
  function restartAfterVictory() {
    var keepEndings = S.earnedEndings.slice();
    var rb = S.rebirths + 1;
    // V1.8审查修复: 跨周目保留日记与累计统计
    var keepDiary = (S.diary || []).slice();
    var keepDiaryScore = S.diaryScore || 0;
    var keepTotalDays = S.totalDays || 0;
    var keepTotalBuilds = S.totalBuilds || 0;
    S = freshSave(10);
    S.earnedEndings = keepEndings;
    S.trueEndingDone = true; // V1.11: 从真结局页进入，闸门保持关闭状态
    S.rebirths = rb;
    S.diary = keepDiary;
    S.diaryScore = keepDiaryScore;
    S.totalDays = keepTotalDays;
    S.totalBuilds = keepTotalBuilds;
    S.entered = true;
    recomputeDiary();
    save();
    Game.S = S;
    // V1.8审查修复: 必须走 enterGame 才能真正进入游戏（原实现只切到 loading 场景却没启动 2.5s 倒计时，会永久卡在加载页）
    enterGame();
  }
  // V1.8: 胜利页「翻看日记」—— 直接跳到日记页回味小说
  function viewDiaryFromVictory() {
    Game.scene = 'game';
    Game.tab = 'log';
  }
  function rebirth() {
    // 关闭可能残留的弹窗（结局弹窗点击「轮回重生」时不会自动关，会导致弹窗卡在首页并可被重复点击）
    closeModal();
    var keep = S.stages.length;
    var maxE = 10 + keep;
    var oldEnter = S.entered;
    // V1.8: 保留已集齐结局图鉴与轮回计数（否则真结局进度会被清掉）
    var keepEndings = S.earnedEndings ? S.earnedEndings.slice() : [];
    // V1.8审查修复: 日记与累计统计应跨周目保留（否则刚写的小说日记/累计数据会在轮回时被清掉）
    var keepDiary = (S.diary || []).slice();
    var keepDiaryScore = S.diaryScore || 0;
    var keepTotalDays = S.totalDays || 0;
    var keepTotalBuilds = S.totalBuilds || 0;
    // V1.11: 真结局已达成需跨周目保留，否则闸门被重置 → 真结局可被重复触发
    var keepTrueEnding = !!S.trueEndingDone;
    var rb = (S.rebirths || 0) + 1;
    // V1.4: 随机封锁 2 条科技分支
    var allTreeIds = ['defense', 'gather', 'build', 'explore'];
    var shuffled = allTreeIds.slice().sort(function () { return Math.random() - 0.5; });
    var lockedTrees = shuffled.slice(0, 2); // 封锁 2 条分支
    S = freshSave(maxE);
    S.manualBonus = keep;
    S.entered = oldEnter;
    S.earnedEndings = keepEndings;
    S.trueEndingDone = keepTrueEnding;
    S.rebirths = rb;
    // V1.8审查修复: 跨周目保留日记与累计统计
    S.diary = keepDiary;
    S.diaryScore = keepDiaryScore;
    S.totalDays = keepTotalDays;
    S.totalBuilds = keepTotalBuilds;
    recomputeDiary();
    // V1.4: 记录被封锁的分支
    S.lockedTrees = lockedTrees;
    dailyBottleReset();
    // 求生手册加成：新周目棋盘预置一级资源作为启动优势
    // V1.11机制修复: 原按 keep（=上周目建造数，最多 20）全量预置，而 space 只有 20 →
    //   新周目开局棋盘直接满载，采集/捞瓶全被「棋盘已满」挡住，必须先建造腾位。
    //   现限制为最多 6 个，既保留启动优势又不锁死棋盘。
    var seedCount = Math.min(keep, 6);
    for (var k = 0; k < seedCount; k++) { var p = firstEmpty(); if (p >= 0) S.board[p] = D.L1[k % 3]; }
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
    Game.FX.toast('\u65B0\u5468\u76EE\uFF01\u4F53\u529B\u4E0A\u9650 +' + keep + '\uFF0C\u542F\u52A8\u7269\u8D44 ' + seedCount + ' \u4E2A\n\u672C\u5468\u76EE\u5C01\u9501\uFF1A' + lockedNames); // V1.11: 修「封销」错字 + 文案去掉冗余，toast 现支持多行
  }

  // ============ 漂流瓶 ============
  function bottle() {
    // V1.8审查修复: 采集动画进行中禁止漂流瓶，避免 2.4s 后落子时覆盖刚开出的格子
    if (Game.FX.gatherAnimActive && Game.FX.gatherAnimActive()) { Game.FX.toast('采集中，请稍候'); return; }
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
      // V1.11: 用 effectiveMaxEnergy，避免饥饿时看广告突破减半上限
      S.energy = Math.min(effectiveMaxEnergy(), S.energy + 5);
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
    if (S.energy >= effectiveMaxEnergy()) { Game.FX.toast('体力已满'); return; }
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

  // V1.8: 胜利庆祝页按钮回调（供 render.drawVictory 调用）
  App.restartAfterVictory = restartAfterVictory;
  App.viewDiaryFromVictory = viewDiaryFromVictory;
  // ============ 离线收益 ============
  function calcOffline() {
    if (!S.offlineUnlocked) { S._offlineReward = 0; return; }
    var mins = Math.floor(S._offlineSec / 60);
    var cap = 30;
    S._offlineReward = Math.min(mins, cap);
    S.offlineUnclaimed = S._offlineReward > 0;
  }
  function grantOffline(times) {
    var got = 0;
    for (var i = 0; i < times; i++) {
      var p = firstEmpty();
      if (p < 0) break;
      S.board[p] = D.L1[Math.floor(Math.random() * 3)];
      got++;
    }
    S.offlineUnclaimed = false;
    autoMerge();
    // V1.11机制修复: 原 toast 恒报 times，但棋盘满时实际入账为 0 → 谎报
    Game.FX.toast(got > 0
      ? ('\u9886\u53D6\u79BB\u7EBF\u6536\u76CA\uFF1A' + got + '\u4E2A\u8D44\u6E90')
      : '\u68CB\u76D8\u5DF2\u6EE1\uFF0C\u79BB\u7EBF\u6536\u76CA\u672A\u5165\u8D26');
    save();
  }

  // ============ Tab / 标签 ============
  function switchTab(t) { Game.tab = t; }

  // 体力倒计时文案（对应 #energyTimer）
  // V1.11机制修复: 倒计时改用与 tryTickEnergy 一致的「实际恢复间隔」
  //   原实现固定按 E_INTERVAL(30s) 计算，而雨天 energyRate=0.5 → 实际 60s 才 +1，
  //   导致倒计时归零后长时间卡在「0s」，玩家会以为体力系统坏了
  function energyTimerText() {
    if (S.energy >= effectiveMaxEnergy()) return '\u6EE1'; // 满
    // V1.8审查修复: 风暴天 energyRate=0，体力不会恢复，倒计时会误导玩家以为在回体力
    var w = getWeatherInfo();
    if (w && !w.energyRate) return '\u26C8\uFE0F 停';
    var interval = D.E_INTERVAL / (w && w.energyRate ? w.energyRate : 1);
    var remain = Math.max(0, Math.ceil((interval - (Date.now() - S.energyTs)) / 1000));
    return remain + 's';
  }
  function tryTickEnergy() {
    // V1.11: 上限改用 effectiveMaxEnergy —— 饥饿时体力不该恢复到减半前的上限
    var cap = effectiveMaxEnergy();
    if (S.energy < cap && S.energyTs) {
      // V1.1: 体力恢复受天气影响（雨天 energyRate = 0.5）
      var wInfo = getWeatherInfo();
      var effectiveInterval = D.E_INTERVAL / wInfo.energyRate;
      if (Date.now() - S.energyTs >= effectiveInterval) {
        S.energy = Math.min(cap, S.energy + 1);
        S.energyTs = Date.now();
        save();
      }
    }
  }

  // V1.3 营地标签文案（科技树）
  function campTagText() {
    var lvl = S.stages.length;
    // 计算已完成节点最多的分支
    var treeCounts = {}, treeMax = {};
    for (var t = 0; t < D.TECH_TREES.length; t++) {
      var treeId = D.TECH_TREES[t].id;
      var count = 0;
      for (var n = 0; n < D.TECH_TREES[t].nodes.length; n++) {
        if (S.stages.indexOf(D.TECH_TREES[t].nodes[n].id) >= 0) count++;
      }
      treeCounts[treeId] = count;
      treeMax[treeId] = D.TECH_TREES[t].nodes.length; // V1.8审查修复: 分支节点数已是5，原来写死 /3 会错位
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
    var maxNode = maxTree ? treeMax[maxTree] : 5;
    return '\u8425\u5730 Lv.' + Math.floor(lvl / 5) + ' \u00B7 ' + treeName + ' ' + maxCount + '/' + maxNode;
  }

  // ============ 首页 / CG ============
  var cg = null;
  var cgTimer = null, cgSinkTimer = null, cgEntered = false;

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
    cgEntered = false;
    cg = { shown: '', sink: 0, started: false };
    Game.cg = cg;
    var text = D.CG_TEXT;
    var i = 0;
    if (cgTimer) clearInterval(cgTimer);
    if (cgSinkTimer) clearTimeout(cgSinkTimer);
    cgTimer = setInterval(function () {
      i++;
      cg.shown = text.substring(0, i);
      if (i >= text.length) {
        clearInterval(cgTimer);
        cgTimer = null;
        // 打字完成后船下沉
        cg.started = true;
        // 仅当尚未进入游戏时才自动进入（防止跳过 CG 后二次 enterGame）
        if (!cgEntered) { cgEntered = true; setTimeout(function () { enterGame(); }, 700); }
      }
    }, 55);
    // 船 2.2s 后开始下沉（记录起始时刻，由 drawCG 平滑驱动，避免死代码）
    cgSinkTimer = setTimeout(function () {
      if (Game.scene === 'cg' && cg) { cg.sinkStart = Date.now() / 1000; cg.boatY = 0; }
    }, 2200);
  }
  function skipCG() {
    if (Game.scene === 'cg') {
      // 清理定时器，避免打字完成回调再次触发 enterGame（双重进入）
      if (cgTimer) { clearInterval(cgTimer); cgTimer = null; }
      if (cgSinkTimer) { clearTimeout(cgSinkTimer); cgSinkTimer = null; }
      cgEntered = true;
      Game.scene = 'home';
      enterGame();
    }
  }
  function enterGame() {
    // 进入主游戏前先显示约 1s 的加载过渡，更具真实感
    Game.scene = 'loading';
    Game.loadStart = Date.now();
    S.entered = true;
    // V1.9: 进入即按累计天数解锁前两篇（搁浅 / 第一夜，req=0 开局可得）
    recomputeDiary();
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
          title: '\uD83C\uDF0A \u6B22\u8FCE\u56DE\u5230\u8352\u5C9B', // V1.11: 修「茍岛」错字（\u830D → \u8352 荒）
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
    }, 2500);
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
  var campScrollMoved = false;

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
    var inScroll = false;
    if (Game.scene === 'game' && Game.tab === 'board' && p.x >= 10 && p.x <= W - 10 && p.y >= py && p.y <= py + ph) {
      scrollTouchStartY = p.y;
      scrollTouchStartScrollY = Game.boardScrollY || 0;
      inScroll = true;
    } else if (Game.scene === 'game' && Game.tab === 'camp' && p.x >= 10 && p.x <= W - 10 && p.y >= 36 && p.y <= H - 34) {
      // V1.6: 建造页滚动检测
      scrollTouchStartY = p.y;
      scrollTouchStartScrollY = Game.campScrollY || 0;
      campScrollMoved = false;
      inScroll = true;
    } else if (Game.scene === 'game' && Game.tab === 'log' && p.x >= 10 && p.x <= W - 10 && p.y >= 36 && p.y <= H - 34) {
      // V1.8: 日记页滚动检测
      scrollTouchStartY = p.y;
      scrollTouchStartScrollY = Game.logScrollY || 0;
      inScroll = true;
    }
    if (!inScroll) scrollTouchStartY = null;
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
    // 处理滚动手势：建造页需区分点击与滑动，棋盘页沿用原逻辑
    if (scrollTouchStartY !== null) {
      var wasCamp = (Game.scene === 'game' && Game.tab === 'camp');
      scrollTouchStartY = null;
      if (wasCamp) {
        if (!campScrollMoved && pendingHit) {
          var cb = pendingHit.cb;
          pendingHit = null;
          pressedRect = null;
          if (cb) cb();
        }
        campScrollMoved = false;
        return;
      }
      return; // 棋盘：拖动不触发点击
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
  // 触摸移动：处理棋盘 / 建造页滚动
  function onTouchMove(e) {
    if (scrollTouchStartY === null || Game.scene !== 'game') return;
    var p = touchPos(e);
    if (!p) return;
    if (Game.tab === 'board') {
      var dy = scrollTouchStartY - p.y; // 手指上滑为正
      var scrollDelta = dy * 1.5; // 滚动系数
      var newScrollY = scrollTouchStartScrollY + scrollDelta;
      // 计算最大滚动值
      var cols = 4, cellGap = 12, bh2 = 52;
      var totalRows = Math.ceil(S.space / cols);
      var maxScroll = Math.max(0, totalRows * (bh2 + cellGap) - (H - 148 - 118 - 26));
      newScrollY = Math.max(0, Math.min(maxScroll, newScrollY));
      Game.boardScrollY = newScrollY;
    } else if (Game.tab === 'camp') {
      // V1.6: 建造页滚动（区分点击与滑动）
      var cdy = scrollTouchStartY - p.y;
      if (Math.abs(cdy) > 6) campScrollMoved = true;
      var maxCamp = Game.campMaxScroll || 0;
      Game.campScrollY = Math.max(0, Math.min(maxCamp, scrollTouchStartScrollY + cdy * 1.5));
    } else if (Game.tab === 'log') {
      // V1.8: 日记页滚动
      var ldy = scrollTouchStartY - p.y;
      var maxLog = Game.logMaxScroll || 0;
      Game.logScrollY = Math.max(0, Math.min(maxLog, scrollTouchStartScrollY + ldy * 1.5));
    }
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
      effectiveMaxEnergy: effectiveMaxEnergy() // V1.11: 改用统一出口，避免与 tryTickEnergy 各算一份
    };
  };
  // V1.5: 休息功能（每小时3次，+2体力）
  App.getRestInfo = function () {
    var now = Date.now();
    var lastRest = S._lastRest || 0;
    var hourMs = 3600 * 1000;
    // 如果超过1小时，重置次数
    if (now - lastRest > hourMs) {
      S._restCount = 3;
      S._lastRest = now;
    }
    return { left: S._restCount || 0 };
  };
  App.onRest = function () {
    var info = App.getRestInfo();
    if (info.left <= 0) { Game.FX.toast('休息冷却中，请稍后再试'); return; }
    // V1.11: 满体力时不再白白消耗次数；上限改用 effectiveMaxEnergy（饥饿时不该突破减半上限）
    var cap = effectiveMaxEnergy();
    if (S.energy >= cap) { Game.FX.toast('体力已满，不用休息'); return; }
    S._restCount--;
    S.energy = Math.min(cap, S.energy + 2);
    S.energyTs = Date.now();
    Game.FX.toast('\uD83D\uDC4F 休息恢复 +2 体力');
    save();
  };
  // V1.5: 分享功能（每天10次，+3体力）
  App.getShareInfo = function () {
    var today = new Date().toDateString();
    if (S._shareDate !== today) {
      S._shareDate = today;
      S._shareCount = 10;
    }
    return { left: S._shareCount || 0 };
  };
  App.onShare = function () {
    var info = App.getShareInfo();
    if (info.left <= 0) { Game.FX.toast('今日分享次数已用完'); return; }
    // V1.11: 满体力时不再白白消耗次数；上限改用 effectiveMaxEnergy
    var cap = effectiveMaxEnergy();
    if (S.energy >= cap) { Game.FX.toast('体力已满，先去采集吧'); return; }
    S._shareCount--;
    S.energy = Math.min(cap, S.energy + 3);
    S.energyTs = Date.now();
    Game.FX.toast('\uD83D\uDD14 分享成功 +3 体力');
    save();
    // V1.11机制修复: 补上真实转发调用 —— 原实现只改本地数值，真机上点「分享」不会有任何反应
    // （分享面板是否发出由玩家决定，奖励即发；上架前需自查是否触碰平台「诱导分享」红线）
    try {
      if (wx.shareAppMessage) wx.shareAppMessage({ title: '我在荒岛上活到了第 ' + S.day + ' 天' });
    } catch (e) {}
  };
  // V1.10: 导出烹饪（此前 cookFood 未导出 → 渲染层无入口，饱食度无法恢复）
  App.cookFood = cookFood;

  Game.App = App;
})();
