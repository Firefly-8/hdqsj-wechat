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

  // 资源链：木材(1-3) / 食物(11-14 椰系加工链) / 石料(21-23)，与网页版一致
  // V1.9机制修复: 食物链语义自洽 —— 椰子→椰肉干(晒干)→椰油饼(压榨烤制)→炭烤椰排(火烤终极料理)
  // 原「椰肉干→烤鱼→烤肉」逻辑断裂（椰肉干不会变成鱼/肉），且 emoji 错位（椰肉干用米饭🍚、烤肉用饼干🍪）
  var ITEMS = {
    // V1.11 修正 emoji：浮木原为 \uD83E\uDDEB（U+1F9EB 培养皿）、木板原为 \uD83F\uDFCB（U+1FFCB 未分配码位，真机会显示豆腐块）
    1:  { name: '浮木',   em: '\uD83E\uDEB5', chain: 'wood',  lv: 1, next: 2  },
    2:  { name: '木板',   em: '\uD83E\uDDF1', chain: 'wood',  lv: 2, next: 3  },
    3:  { name: '木架',   em: '\uD83D\uDED6', chain: 'wood',  lv: 3, next: 0  },
    11: { name: '椰子',   em: '\uD83E\uDD65', chain: 'food',  lv: 1, next: 12 },
    12: { name: '椰肉干', em: '\uD83C\uDF58', chain: 'food',  lv: 2, next: 13 },
    13: { name: '椰油饼', em: '\uD83E\uDED3', chain: 'food',  lv: 3, next: 14 },
    14: { name: '炭烤椰排', em: '\uD83C\uDF56', chain: 'food',  lv: 4, next: 0 }, // V1.2 新增（终极料理）
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
        { id: 103, name: '箭塔', em: '\uD83C\uDFF9', need: { 3: 2, 23: 2, 14: 1 }, desc: '防御 +20', unlocks: '', prev: 102 },
        { id: 104, name: '瞭望塔', em: '\uD83D\uDC41', need: { 3: 3, 23: 2, 14: 1 }, desc: '哨塔值守，体力上限 +3', unlocks: 'energy', prev: 103 },
        { id: 105, name: '烽火台', em: '\uD83D\uDD25', need: { 3: 3, 23: 3, 14: 2 }, desc: '结局：部落发现', unlocks: 'end_defense', prev: 104 }
      ]
    },
    {
      id: 'gather',
      name: '采集',
      em: '\uD83C\uDFA3',
      nodes: [
        { id: 111, name: '结绳', em: '\uD83E\uDEA2', need: { 1: 3 }, desc: '采集效率 +15%', unlocks: '', prev: 0 },
        { id: 112, name: '渔网', em: '\uD83D\uDD78\uFE0F', need: { 2: 2, 1: 5 }, desc: '采集效率 +25%', unlocks: '', prev: 111 },
        { id: 113, name: '陷阱', em: '\uD83E\uDEA4', need: { 3: 1, 2: 2, 22: 2 }, desc: '采集效率 +35%，常获额外收获', unlocks: 'gather', prev: 112 },
        { id: 114, name: '盐田', em: '\uD83E\uDDC2', need: { 2: 3, 22: 2, 14: 1 }, desc: '腌制保鲜，饱食上限 +5', unlocks: 'foodcap', prev: 113 },
        { id: 115, name: '诱捕阵', em: '\uD83E\uDEA9', need: { 3: 2, 2: 3, 22: 2, 14: 2 }, desc: '结局：捕获商船', unlocks: 'end_gather', prev: 114 }
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
        { id: 131, name: '风筝', em: '\uD83E\uDE81', need: { 1: 2, 2: 1 }, desc: '探索范围 +1', unlocks: '', prev: 0 },
        { id: 132, name: '信号镜', em: '\uD83E\uDE9E', need: { 2: 2, 22: 1, 14: 1 }, desc: '探索范围 +2', unlocks: '', prev: 131 },
        { id: 133, name: '海图', em: '\uD83D\uDDFA\uFE0F', need: { 3: 1, 2: 2, 22: 1 }, desc: '绘制海图，每日漂流瓶 +1', unlocks: 'bottle', prev: 132 },
        { id: 134, name: '独木舟', em: '\uD83D\uDEF6', need: { 3: 2, 2: 2, 14: 1 }, desc: '探索范围 +3', unlocks: '', prev: 133 },
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

  // 日记（小说体 · 鲁滨逊漂流风格，与玩法进度联动解锁，共 23 篇 / 5 章）
  // V1.9机制修复: req = 解锁所需「累计生存天数」(totalDays)，故事跟随求生进度走、跨周目不倒退
  // 原机制用「行为进度分」解锁（进游戏/建造/事件/椰子都加分），导致开局几分钟日记就跳到第4篇，与游戏天数严重脱节
  // 结局篇 req=999 仅由对应结局触发显式解锁
  var LOGS = [
    { ch: 'ch1', title: '搁浅', text: '风暴撕碎了船帆，我被冲上这片无名礁岸。除了一身湿衣与几截浮木，我一无所有。' },
    { ch: 'ch1', title: '第一夜', text: '用浮木压住茅草，搭起第一个勉强遮风的窝棚。海风呜咽，我却第一次觉得——活着本身已是恩赐。' },
    { ch: 'ch1', title: '潮线', text: '退潮后的滩涂像被翻开的宝库：贝壳、浮木、缠网的玻璃瓶。我开始懂得，岛不是牢笼，是仓库。' },
    { ch: 'ch1', title: '绳与结', text: '拆下船索，学鲁滨逊那样把纤维搓成绳。一根绳，便是一双永远不会累的手。' },
    { ch: 'ch2', title: '棚屋', text: '第一座像样的棚屋立起来了。夜里不再畏寒，我甚至生出了「家」这个奢侈的念头。' },
    { ch: 'ch2', title: '结绳记事', text: '在棚柱上刻下一道道痕——这是我的历书。数字不会骗人，日子在变长。' },
    { ch: 'ch2', title: '椰林', text: '林子里有成片的椰子树。敲开一只，清甜的汁水滑过喉咙，饥饿第一次向我低头。' },
    { ch: 'ch2', title: '风暴夜', text: '又一场风暴。我蜷在棚里听天地咆哮，庆幸自己早筑了墙。恐惧仍在，却不再致命。' },
    { ch: 'ch3', title: '灶火', text: '两块石相击，火星落进枯草。火苗窜起的刹那，文明在指尖复活——我烤熟了第一块肉。' },
    { ch: 'ch3', title: '蓄水池', text: '挖凹处、铺蕉叶，我存下了雨水。水比金子贵，在岛上尤是。' },
    { ch: 'ch3', title: '远足', text: '循着兽径深入岛屿腹地，发现了淡水溪与野果丛。地图在脚下一寸寸展开。' },
    { ch: 'ch3', title: '遇兽', text: '野兽夜袭营地。我举起火把，它竟退去。原来「威胁」与「主人」之间，只差一道火光。' },
    { ch: 'ch3', title: '海图', text: '一只漂流瓶里塞着残破海图，墨迹晕开却仍能辨出海岸线。有人来过，或终将有人来。' },
    { ch: 'ch4', title: '围墙', text: '木桩围出营地，藤蔓缠紧缝隙。墙内是「我的」，墙外才是荒岛。' },
    { ch: 'ch4', title: '烽燧', text: '山顶垒起烽燧。若是过往的船看见这缕烟，我便不再是与世隔绝的幽灵。' },
    { ch: 'ch4', title: '陷阱', text: '在滩涂布下陷阱，用鱼作饵。耐心，是岛上最被低估的武器。' },
    { ch: 'ch4', title: '船坞', text: '清空一段海岸作船坞，龙骨的雏形卧在沙上。归途，第一次有了形状。' },
    { ch: 'ch4', title: '守望', text: '我常登高一望。海平线空荡荡，心里却踏实——因为一切都已就位，只等风来。' },
    { ch: 'ch5', title: '结局·部落', text: '烽烟引来近海的部落。他们划着独木舟靠岸，用我听不懂的语言邀我同住。历经风雨，我终于不再是孤岛上的独行者。', req: 999, ending: 'end_defense' },
    { ch: 'ch5', title: '结局·商船', text: '陷阱里卡住的，竟是一艘迷航的商船！船员们惊魂未定，却向我深深鞠躬。我乘他们的船，驶离了这片守了许久的岸。', req: 999, ending: 'end_gather' },
    { ch: 'ch5', title: '结局·归航', text: '最后一截木板钉牢，我的船下水了。它不大，却装得下全部家当与三年时光。扬帆那一刻，岛在身后缩小成一枚绿色的钉。', req: 999, ending: 'end_build' },
    { ch: 'ch5', title: '结局·新陆', text: '小舟顺流漂了数日，地平线终于隆起成陆。陌生的鸟鸣、陌生的风——又一场漂流，在另一片海岸重新开始。', req: 999, ending: 'end_explore' },
    { ch: 'ch5', title: '真结局·四象归一', text: '潮水数度涨落，我在岛上刻下的不只是年轮，还有四种活法。四象归一，荒岛不再是流放，而是一所学校。', req: 999, ending: 'true' }
  ];
  // 给前面 18 篇补上 req（所需累计天数，按章节递进；前 2 篇开局即解锁）
  LOGS[0].req = 0; LOGS[1].req = 0; LOGS[2].req = 2; LOGS[3].req = 3;
  LOGS[4].req = 4; LOGS[5].req = 5; LOGS[6].req = 6; LOGS[7].req = 7;
  LOGS[8].req = 8; LOGS[9].req = 9; LOGS[10].req = 10; LOGS[11].req = 11; LOGS[12].req = 12;
  LOGS[13].req = 13; LOGS[14].req = 14; LOGS[15].req = 15; LOGS[16].req = 16; LOGS[17].req = 17;

  // 日记章节顺序（用于日记页分组渲染）
  var DIARY_CHAPTERS = [
    { id: 'ch1', name: '第一章 · 搁浅' },
    { id: 'ch2', name: '第二章 · 安身' },
    { id: 'ch3', name: '第三章 · 谋生' },
    { id: 'ch4', name: '第四章 · 御险' },
    { id: 'ch5', name: '第五章 · 归途' }
  ];

  // 真结局收尾章（胜利庆祝页羊皮卷正文）
  var VICTORY_TEXT = '潮水数度涨落，我在岛上刻下的不只是年轮，还有四种活法。\n\n有人循着烽烟来，与我同火；有人被我的陷阱留住，载我远航；有人接过我手制的船，替我去看海平线之外；也有人随我的小舟，在另一片陆地重燃炉火。\n\n四象归一，荒岛不再是流放，而是一所学校——我学会了向风暴低头，也学会了在低谷里造船。\n\n谨以此记，赠每一个仍在某座岛上的人。';

  // 天数过渡素材
  var DT_ICONS = ['\u2600\uFE0F', '\uD83C\uDF24\uFE0F', '\uD83C\uDF04', '\uD83C\uDF19'];
  var DT_SUBS = ['又是新的一天', '日头西斜，该歇了', '晨光熹微', '夜幕降临'];

  // CG 打字文案
  // V1.12: 第三行为原著原文（笛福《鲁滨逊漂流记》中他刻在木柱上的第一句话）
  var CG_TEXT = '狂风骤雨，船触了礁。\n我醒来时，已在一片陌生的沙滩。\n1659 年 9 月 30 日，我在此上岸。';

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
      title: '\uD83C\uDFDB\uFE0F 发现遗迹', // V1.11: 修 emoji（原 \uD83E\uDDF8 = 🧸 泰迪熊，与遗迹无关）
      body: '你在海滩发现了一处古代遗迹，里面似乎有有用的材料！',
      options: [
        { label: '领取', primary: true, cb: 'ruins_claim' }
      ]
    },
    {
      id: 'bottle_rare',
      title: '\uD83C\uDF7E 神秘漂流瓶', // V1.11: 修 emoji（原 \uD83E\uDEB0 = 🪰 苍蝇）
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

  // ============ V1.12 鲁滨逊改编层（方案 A：轻量叠加） ============
  // 原著《鲁滨逊漂流记》(Robinson Crusoe) 笛福 1719 年出版、1731 年去世 → 早已进入公版（中国保护期＝作者终身+死后50年），
  // 角色、地名、情节细节均可自由使用；本层只做「内容层 + 彩蛋层」，不改动既有玩法骨架（四结局/轮回/合成链）。
  //
  // 上岸日期为原著原文：1659 年 9 月 30 日
  var CASTAWAY_DATE = '1659\u5E749\u670830\u65E5';
  // 木刻记日：原著中他在方柱四边每天刻一个凹口，每 7 天刻一个长一倍的，每月第一天再长一倍
  var NOTCH_RULE = { week: 7, month: 30 };
  // 原著岛名：绝望岛（Island of Despair）—— 他登陆后给岛起的名字
  var ISLAND_NAME = '\u7EDD\u671B\u5C9B';
  // 原著两季：旱季 / 雨季（笛福写他观察到岛上只有两季，与温带四季不同）
  var SEASONS = [
    { id: 0, name: '旱季', em: '\u2600\uFE0F', desc: '日头毒，椰子多，走两步就渴' },
    { id: 1, name: '雨季', em: '\uD83C\uDF27\uFE0F', desc: '雨一场接一场，滩涂全是烂泥' }
  ];
  var SEASON_DAYS = 10; // 每 10 天换一季

  // 原著细节事件（均为公版，可自由使用）
  var LORE_EVENTS = [
    {
      id: 'parrot',
      dayMin: 3, once: true,
      title: '\uD83E\uDD9C 一只小鹦鹉', // 原著：他捉到一只小鹦鹉，起名 Poll
      body: '林子里捡到一只羽翼未丰的小鹦鹉，它歪着头看你，像是在等一个名字。',
      options: [
        { label: '叫它 Poll', primary: true, cb: 'lore_parrot' },
        { label: '不养，放它走', primary: false, cb: 'lore_parrot_skip' }
      ]
    },
    {
      id: 'bigcanoe',
      dayMin: 5, once: true,
      title: '\uD83C\uDF32 一棵巨杉', // 原著：第6年砍倒大树造独木舟，花五六个月，太重拖不下海，前功尽弃
      body: '岛心立着一棵巨杉，树干粗得两人合抱。造一条能远航的大独木舟，一直是你心里那根刺。',
      options: [
        { label: '砍倒它，造大船', primary: true, cb: 'lore_bigcanoe' },
        { label: '算了，用现成的', primary: false, cb: 'lore_bigcanoe_skip' }
      ]
    },
    {
      id: 'footprint',
      dayMin: 9, once: true,
      title: '\uD83D\uDC63 沙滩上的脚印', // 原著：约第17年发现脚印，惊恐万分
      body: '退潮后的湿沙上，清清楚楚一个脚印——不是你的。你左右张望，只有浪声。',
      options: [
        { label: '追查脚印', primary: true, cb: 'lore_footprint' },
        { label: '当作没看见', primary: false, cb: 'lore_footprint_skip' }
      ]
    }
  ];

  globalThis.Game = globalThis.Game || {};
  Game.DATA = {
    C: C, ITEMS: ITEMS, L1: L1, L2_BONUS: L2_BONUS, STAGES: STAGES,
    TECH_TREES: TECH_TREES,
    E_INTERVAL: E_INTERVAL, MISS_LINES: MISS_LINES, FULL_LINES: FULL_LINES,
    LOGS: LOGS, DIARY_CHAPTERS: DIARY_CHAPTERS, VICTORY_TEXT: VICTORY_TEXT,
    DT_ICONS: DT_ICONS, DT_SUBS: DT_SUBS, CG_TEXT: CG_TEXT,
    MISS_RATE: MISS_RATE, ITEM_IMG: ITEM_IMG, DAILY_BOTTLE: DAILY_BOTTLE,
    BG_IMG: BG_IMG, WEATHER: WEATHER, EVENTS: EVENTS,
    // V1.12 原著改编层
    CASTAWAY_DATE: CASTAWAY_DATE, NOTCH_RULE: NOTCH_RULE, ISLAND_NAME: ISLAND_NAME,
    SEASONS: SEASONS, SEASON_DAYS: SEASON_DAYS, LORE_EVENTS: LORE_EVENTS
  };
})();
