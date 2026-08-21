/**
 * 数据层：资源表 / 建造表 / 文案库 / 日记 / 颜色 / 全局单例
 */
(function () {
  'use strict';

  // 颜色（与网页版一致，绘本风）
  var C = {
    sea: '#2E7D9A', sand: '#F2D5A0', wood: '#8B5E3C', fire: '#E8763A',
    leaf: '#6FA860', ink: '#4A3428', paper: '#FAF1DD', paper2: '#E8D6B0',
    seaDark: '#1a3a4a', seaDeep: '#0a2a3a', cgDark: '#06182a',
    white: '#FFFFFF', black: '#000000', paper3: '#c9b893',
    okGreen: '#cfe8c0', gray: '#BBBBBB', btnShadow: '#b85a1f',
    disabled: '#BBBBBB', disabledText: '#888888',
    doneBg: '#e8f0e0', lockedBg: '#EFEFEF', lockedBorder: '#CCCCCC', lockedText: '#AAAAAA'
  };

  // 资源链：木材(1-3) / 食物(11-14) / 石料(21-23)，与网页版一致
  var ITEMS = {
    1:  { name: '浮木',   em: '\uD83E\uDDEB', chain: 'wood',  lv: 1, next: 2  },
    2:  { name: '木板',   em: '\uD83F\uDFCB', chain: 'wood',  lv: 2, next: 3  },
    3:  { name: '木架',   em: '\uD83D\uDED6', chain: 'wood',  lv: 3, next: 0  },
    11: { name: '椰子',   em: '\uD83E\uDD65', chain: 'food',  lv: 1, next: 12 },
    12: { name: '椰肉干', em: '\uD83C\uDF56', chain: 'food',  lv: 2, next: 13 },
    13: { name: '烤鱼',   em: '\uD83D\uDC1F', chain: 'food',  lv: 3, next: 14 },
    14: { name: '烤肉',   em: '\uD83C\uDF69', chain: 'food',  lv: 4, next: 0 }, // V1.2 新增
    21: { name: '石块',   em: '\uD83E\uDEA8', chain: 'stone', lv: 1, next: 22 },
    22: { name: '石斧',   em: '\uD83E\uDE93', chain: 'stone', lv: 2, next: 23 },
    23: { name: '铁镐',   em: '\u26CF\uFE0F', chain: 'stone', lv: 3, next: 0  }
  };
  // 物品手绘图映射（透明 WebP，沙色底融合；加载失败降级 emoji）
  var ITEM_IMG = {
    1: 'item_wood_1.webp', 2: 'item_wood_2.webp', 3: 'item_wood_3.webp',
    11: 'item_food_1.webp', 12: 'item_food_2.webp', 13: 'item_food_3.webp', 14: 'item_food_4.webp',
    21: 'item_stone_1.webp', 22: 'item_stone_2.webp', 23: 'item_stone_3.webp'
  };
  var L1 = [1, 11, 21];
  // 合成时高级奖励（漂流瓶 20% 档）
  var L2_BONUS = [2, 12, 22];

  // 场景背景图（绘本风，与网页 Demo 一致：首页海面 / CG 夜海 / 主界面海滩营地）
  var BG_IMG = {
    home: 'bg_home.png', cg: 'bg_cg.png', beach: 'bg_beach.png'
  };

  // V1.6 科技树结构（4 分支，每分支 5 级，结局放在第 5 级，内容更丰富、通关更久）
  var TECH_TREES = [
    {
      id: 'defense',
      name: '防御',
      em: '\uD83E\uDDF1',
      nodes: [
        { id: 101, name: '栅栏围墙', em: '\uD83E\uDDF1', need: { 3: 1, 23: 1 }, desc: '防御 +10', unlocks: '', prev: 0 },
        { id: 102, name: '木桩阵', em: '\uD83E\uDD94', need: { 3: 2, 23: 1, 1: 3 }, desc: '防御 +15', unlocks: '', prev: 101 },
        { id: 103, name: '箭塔', em: '\uD83D\uDDCD', need: { 3: 2, 23: 2, 14: 1 }, desc: '防御 +20', unlocks: '', prev: 102 },
        { id: 104, name: '瞭望塔', em: '\uD83D\uDC41', need: { 3: 3, 23: 2, 14: 1 }, desc: '哨塔值守，体力上限 +3', unlocks: 'energy', prev: 103 },
        { id: 105, name: '烽火台', em: '\uD83D\uDD25', need: { 3: 3, 23: 3, 14: 2 }, desc: '结局：部落发现', unlocks: 'end_defense', prev: 104 }
      ]
    },
    {
      id: 'gather',
      name: '采集',
      em: '\uD83C\uDFA3',
      nodes: [
        { id: 111, name: '结绳', em: '\uD83D\uDCDD', need: { 1: 3 }, desc: '采集效率 +15%', unlocks: '', prev: 0 },
        { id: 112, name: '渔网', em: '\uD83D\uDCA1', need: { 2: 2, 1: 5 }, desc: '采集效率 +25%', unlocks: '', prev: 111 },
        { id: 113, name: '陷阱', em: '\uD83E\uDDD8', need: { 3: 1, 2: 2, 22: 2 }, desc: '采集效率 +35%，常获额外收获', unlocks: 'gather', prev: 112 },
        { id: 114, name: '盐田', em: '\uD83C\uDFE6', need: { 2: 3, 22: 2, 14: 1 }, desc: '腌制保鲜，饱食上限 +5', unlocks: 'foodcap', prev: 113 },
        { id: 115, name: '诱捕阵', em: '\uD83D\uDDEF', need: { 3: 2, 2: 3, 22: 2, 14: 2 }, desc: '结局：捕获商船', unlocks: 'end_gather', prev: 114 }
      ]
    },
    {
      id: 'build',
      name: '建造',
      em: '\uD83D\uDED2',
      nodes: [
        { id: 121, name: '庇护所', em: '\u26FA', need: { 2: 3 }, desc: '解锁离线收益', unlocks: 'offline', prev: 0 },
        { id: 122, name: '仓储', em: '\uD83D\uDCE6', need: { 3: 1, 22: 1 }, desc: '棋盘容量 +10', unlocks: 'space', prev: 121 },
        { id: 123, name: '茅屋', em: '\uD83C\uDFE0', need: { 3: 2, 2: 2, 14: 1 }, desc: '棋盘容量 +6', unlocks: 'space2', prev: 122 },
        { id: 124, name: '工坊', em: '\uD83E\uDDF0', need: { 3: 2, 22: 2 }, desc: '烹饪附带额外饱食', unlocks: 'craft', prev: 123 },
        { id: 125, name: '船坞', em: '\uD83D\uDEA2', need: { 3: 4, 2: 3, 14: 3 }, desc: '结局：建造船只', unlocks: 'end_build', prev: 124 }
      ]
    },
    {
      id: 'explore',
      name: '探索',
      em: '\uD83D\uDED1',
      nodes: [
        { id: 131, name: '风筝', em: '\uD83C\uDF88', need: { 1: 2, 2: 1 }, desc: '探索范围 +1', unlocks: '', prev: 0 },
        { id: 132, name: '信号镜', em: '\uD83D\uDCA1', need: { 2: 2, 22: 1, 14: 1 }, desc: '探索范围 +2', unlocks: '', prev: 131 },
        { id: 133, name: '海图', em: '\uD83C\uDFF5', need: { 3: 1, 2: 2, 22: 1 }, desc: '绘制海图，每日漂流瓶 +1', unlocks: 'bottle', prev: 132 },
        { id: 134, name: '独木舟', em: '\uD83D\uDEF5', need: { 3: 2, 2: 2, 14: 1 }, desc: '探索范围 +3', unlocks: '', prev: 133 },
        { id: 135, name: '木筏', em: '\uD83D\uDEA4', need: { 3: 3, 2: 3, 14: 2 }, desc: '结局：自制木筏', unlocks: 'end_explore', prev: 134 }
      ]
    }
  ];

  // 兼容旧版 STAGES（用于 normalizeSave 等）
  var STAGES = TECH_TREES[0].nodes.concat(TECH_TREES[1].nodes).concat(TECH_TREES[2].nodes).concat(TECH_TREES[3].nodes);

  // 体力恢复间隔（demo 用 30s 便于体验；上线前调回 3-5 分钟）
  var E_INTERVAL = 30000;

  // 采集空手文案库（20 条，鲁滨逊风口语）
  var MISS_LINES = [
    '蹲半天就刨出个破瓦罐碴子，还扎了手。',
    '刚摸着根浮木，一个浪就给卷回去了。',
    '椰子树太高，爬一半摔个屁股墩。',
    '石缝里探出只螃蟹，钳子一夹，赶紧缩手。',
    '听见椰子掉下来，跑过去一看，早让螃蟹搬走了。',
    '太阳晒得直冒油，脑子都化了，空手回。',
    '林子里转晕了，出来还是原地，白转一圈。',
    '网兜漏了底，捡一个漏一个，白忙活。',
    '踩了泡鸟屎，鞋还陷泥里，物资一个没捞。',
    '潮水涨太快，扑腾着跑回来，两手空空。',
    '以为是根浮木，扒出来是截烂船板，扔了。',
    '追了半天野山羊，人家蹽蹄子就没影了。',
    '石缝里抠半天，抠出个空蜗牛壳，可笑。',
    '椰子树晃了一下，没掉椰子，掉个空鸟窝。',
    '摸鱼摸半天，摸着一截烂绳子，还系着死结。',
    '蹲沙滩发呆，被浪拍一身湿，啥也没得。',
    '今天运气差，连海风都跟我作对，吹一脸沙。',
    '扒拉半天，扒出块破陶片，瞅着像古董，其实不是。',
    '听见林子里有动静，过去一看，是风吹叶子。',
    '刚要捡贝壳，一个浪打过来，贝壳没了，我湿了。'
  ];
  var FULL_LINES = [
    '怀里塞不下了，先把东西用掉再采。',
    '背筐满当当的，去建个营腾腾地方。',
    '岛上物资多得拿不动，该建造了。'
  ];

  // 日记（28 天原著风，7 篇）
  var LOGS = [
    'Day 1 · 风暴把我卷上这片无名沙滩，除了几根浮木一无所有。',
    'Day 3 · 我搭起第一个避难棚，夜里终于能睡个安稳觉。',
    'Day 7 · 发现岛上有椰子林和石矿，食物不用愁了。',
    'Day 12 · 我把木板拼成木架，营地有了雏形。',
    'Day 18 · 捡到一只漂流瓶，里面竟是张残破的航海图。',
    'Day 25 · 围墙建好后，野兽再不敢夜袭。',
    'Day 28 · 我在山顶燃起烽火——远方，有船的影子。'
  ];

  // 天数过渡素材
  var DT_ICONS = ['\u2600\uFE0F', '\uD83C\uDF24\uFE0F', '\uD83C\uDF04', '\uD83C\uDF19'];
  var DT_SUBS = ['又是新的一天', '日头西斜，该歇了', '晨光熹微', '夜幕降临'];

  // CG 打字文案
  var CG_TEXT = '狂风骤雨，船触了礁。\n我醒来时，已在一片陌生的沙滩。';

  // 空手概率（demo 25% 便于体验文案；上线调回 8-12%）
  var MISS_RATE = 0.25;

  // 每日漂流瓶数量（demo 固定 3；正式可按 1-3 随机）
  var DAILY_BOTTLE = 3;

  // ============ V1.1 天气系统 ============
  // 天气类型：0=晴, 1=雨, 2=风暴
  var WEATHER = [
    { type: 0, name: '晴天', em: '\u2600\uFE0F', prob: 0.6, gatherBoost: 1.2, energyRate: 1.0, canGather: true },
    { type: 1, name: '雨天', em: '\uD83C\uDF27\uFE0F', prob: 0.3, gatherBoost: 1.0, energyRate: 0.5, canGather: true },
    { type: 2, name: '风暴', em: '\u26C8\uFE0F', prob: 0.1, gatherBoost: 0, energyRate: 0, canGather: false }
  ];

  // ============ V1.1 随机事件 ============
  var EVENTS = [
    {
      id: 'beast',
      title: '\uD83D\uDC3B 野兽袭击！',
      body: '一只野兽闯入营地，你会怎么做？',
      options: [
        { label: '战斗', primary: true, cb: 'beast_fight' },
        { label: '逃跑', primary: false, cb: 'beast_flee' }
      ]
    },
    {
      id: 'ruins',
      title: '\uD83E\uDDF8 发现遗迹',
      body: '你在海滩发现了一处古代遗迹，里面似乎有有用的材料！',
      options: [
        { label: '领取', primary: true, cb: 'ruins_claim' }
      ]
    },
    {
      id: 'bottle_rare',
      title: '\uD83E\uDEB0 神秘漂流瓶',
      body: '海岸边捡到一个神秘的瓶子，里面似乎装着珍贵的东西...',
      options: [
        { label: '打开', primary: true, cb: 'bottle_rare_claim' }
      ]
    },
    {
      id: 'sunny_gift',
      title: '\u2600\uFE0F 晴天惊喜',
      body: '今天天气不错，老天爷赏饭吃！',
      options: [
        { label: '谢谢老天', primary: true, cb: 'sunny_gift_claim' }
      ]
    }
  ];

  globalThis.Game = globalThis.Game || {};
  Game.DATA = {
    C: C, ITEMS: ITEMS, L1: L1, L2_BONUS: L2_BONUS, STAGES: STAGES,
    TECH_TREES: TECH_TREES,
    E_INTERVAL: E_INTERVAL, MISS_LINES: MISS_LINES, FULL_LINES: FULL_LINES,
    LOGS: LOGS, DT_ICONS: DT_ICONS, DT_SUBS: DT_SUBS, CG_TEXT: CG_TEXT,
    MISS_RATE: MISS_RATE, ITEM_IMG: ITEM_IMG, DAILY_BOTTLE: DAILY_BOTTLE,
    BG_IMG: BG_IMG, WEATHER: WEATHER, EVENTS: EVENTS
  };
})();
