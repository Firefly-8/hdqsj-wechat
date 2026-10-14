/**
 * 逐关手工布局（覆盖 scene_build 的自动布局）
 * 每项：[id, label|null, zone, x, y, size, opt]
 *   zone: sky 天空 / sea 海面 / sand 沙滩（舞台）
 *   x: 0–1 屏宽中心比例；y: 0–1 分区内中心比例；size: 设计尺寸（812 屏，按分区高度自适应缩放）
 *   opt: { w, h 宽高倍率; z; hide 初始隐藏; hit 最小点击边长; tap:true 装饰也可点 }
 *   id 以 deco_ 开头 = 纯装饰（不可点，不参与判定）
 */
(function () {
  'use strict';
  var L = {};

  // ---- 1–20 中需要修正的关 ----
  L.lv_010 = [['sun', null, 'sky', 0.7, 0.45, 64, { z: 3 }], ['person', '🥵', 'sand', 0.42, 0.55, 96]];
  L.lv_012 = [
    ['banana_0', null, 'sand', 0.3, 0.16, 46], ['banana_1', null, 'sand', 0.43, 0.12, 46], ['banana_2', null, 'sand', 0.56, 0.16, 46],
    ['banana_3', null, 'sand', 0.69, 0.12, 46], ['banana_4', null, 'sand', 0.36, 0.34, 46], ['banana_5', null, 'sand', 0.5, 0.36, 46],
    ['banana_6', null, 'sand', 0.64, 0.34, 46], ['leaf', null, 'sand', 0.62, 0.3, 84, { z: 2 }],
    ['answer_5', null, 'sand', 0.17, 0.82, 56, { w: 1.15, h: 0.95 }], ['answer_6', null, 'sand', 0.39, 0.82, 56, { w: 1.15, h: 0.95 }],
    ['answer_7', null, 'sand', 0.61, 0.82, 56, { w: 1.15, h: 0.95 }], ['answer_8', null, 'sand', 0.83, 0.82, 56, { w: 1.15, h: 0.95 }]
  ];
  L.lv_016 = [['parrot', null, 'sand', 0.68, 0.22, 78], ['sleeper', null, 'sand', 0.34, 0.5, 70], ['deco_hammock', '🌴', 'sand', 0.86, 0.12, 60]];

  // ---- 21–100 ----
  L.lv_021 = [['torch', null, 'sand', 0.26, 0.6, 64], ['campfire', null, 'sand', 0.66, 0.42, 86], ['deco_log', '🪵', 'sand', 0.78, 0.66, 44]];
  L.lv_022 = [
    ['cloud_face', '☁️', 'sky', 0.3, 0.45, 60], ['coconut_face', '🥥', 'sand', 0.2, 0.3, 54], ['rock_face', '🪨', 'sand', 0.72, 0.24, 62],
    ['leaf_face', '🍃', 'sand', 0.5, 0.58, 52], ['shell_face', '🐚', 'sand', 0.8, 0.72, 48], ['deco_palm', '🌴', 'sand', 0.12, 0.72, 58]
  ];
  L.lv_023 = [['box', null, 'sand', 0.5, 0.45, 96], ['decoy_a', '🥥', 'sand', 0.2, 0.7, 48], ['decoy_b', '🐚', 'sand', 0.8, 0.72, 44]];
  L.lv_024 = [['top_left_fire', null, 'sand', 0.22, 0.2, 48], ['fires', null, 'sand', 0.72, 0.62, 48], ['deco_f1', '🔥', 'sand', 0.76, 0.18, 40], ['deco_f2', '🔥', 'sand', 0.28, 0.7, 40]];
  L.lv_025 = [['sun', null, 'sky', 0.76, 0.45, 60], ['bulb', null, 'sand', 0.32, 0.5, 64]];
  L.lv_026 = [['deco_head', '🧑‍🦲', 'sand', 0.5, 0.42, 110], ['hairs', '〰️', 'sand', 0.5, 0.12, 50, { z: 2 }],
    ['answer_2', null, 'sand', 0.17, 0.86, 52, { w: 1.15, h: 0.95 }], ['answer_3', null, 'sand', 0.39, 0.86, 52, { w: 1.15, h: 0.95 }],
    ['answer_4', null, 'sand', 0.61, 0.86, 52, { w: 1.15, h: 0.95 }], ['answer_5', null, 'sand', 0.83, 0.86, 52, { w: 1.15, h: 0.95 }]];
  L.lv_027 = [['person', null, 'sand', 0.5, 0.48, 100], ['fly', null, 'sky', 0.3, 0.5, 34, { hit: 48 }], ['glasses', null, 'sand', 0.18, 0.8, 52], ['deco_dog', '🐕', 'sand', 0.82, 0.68, 62]];
  L.lv_028 = [['cage_door', '🐥笼子', 'sand', 0.62, 0.38, 92], ['lock', null, 'sand', 0.62, 0.72, 46, { z: 2 }], ['key', null, 'sand', 0.2, 0.7, 48]];
  L.lv_029 = [['decoy_a', '🌧️', 'sky', 0.5, 0.45, 70], ['decoy_b', '🧍', 'sand', 0.5, 0.45, 96]];
  L.lv_030 = [['hexagon_icon', '⬡', 'sky', 0.86, 0.12, 30, { hit: 46 }], ['decoy_a', '🍊', 'sand', 0.28, 0.35, 60], ['decoy_b', '🍉', 'sand', 0.68, 0.5, 66],
    ['deco_cheese', '🧀', 'sand', 0.4, 0.72, 52], ['deco_apple', '🍎', 'sand', 0.82, 0.2, 48]];
  L.lv_031 = [['cake_center', '🎂', 'sand', 0.58, 0.45, 104], ['knife', null, 'sand', 0.18, 0.72, 52]];
  L.lv_032 = [['progress_knob', null, 'sand', 0.5, 0.28, 60], ['decoy_a', '🔴', 'sand', 0.26, 0.7, 58], ['decoy_b', '🎁', 'sand', 0.76, 0.66, 56]];
  // 共需点 5 颗星：云后藏 5 颗（star_b~e 可点）
  L.lv_033 = [['stars', null, 'sky', 0.5, 0.5, 40], ['star_b', '⭐', 'sky', 0.3, 0.35, 34, { tap: true }], ['star_c', '⭐', 'sky', 0.7, 0.35, 34, { tap: true }],
    ['star_d', '⭐', 'sky', 0.38, 0.75, 32, { tap: true }], ['star_e', '⭐', 'sky', 0.62, 0.75, 32, { tap: true }],
    ['clouds', null, 'sky', 0.5, 0.5, 92, { z: 3, w: 2.4 }], ['deco_moon', '🌙', 'sky', 0.1, 0.4, 40]];
  L.lv_034 = [['cat', '🐈', 'sand', 0.26, 0.4, 72], ['water_basin', '🛁', 'sand', 0.7, 0.6, 92]];
  L.lv_035 = [['decoy_a', '🪨', 'sand', 0.3, 0.35, 70], ['decoy_b', '🪵', 'sand', 0.7, 0.42, 66], ['ui_green_dot', '🟢', 'sand', 0.6, 0.96, 20, { hit: 44 }]];
  L.lv_036 = [['watermelon_slices', '🍉', 'sand', 0.3, 0.42, 64], ['bitten_one', '🍉', 'sand', 0.7, 0.42, 64], ['deco_w', '🍉', 'sand', 0.5, 0.74, 60]];
  L.lv_037 = [['tree_fork', '🦒', 'sand', 0.62, 0.38, 120], ['deco_tree', '🌳', 'sand', 0.8, 0.26, 90], ['saw', null, 'sand', 0.2, 0.74, 54]];
  L.lv_038 = [['decoy_a', '🕕', 'sand', 0.5, 0.4, 104], ['decoy_b', '🧍', 'sand', 0.84, 0.62, 70]];
  L.lv_039 = [['tree', '🌳', 'sand', 0.6, 0.36, 150], ['birds', null, 'sand', 0.48, 0.14, 38, { z: 2 }], ['bird_b', '🐦', 'sand', 0.7, 0.1, 38, { z: 2, tap: true }],
    ['bird_c', '🐦', 'sand', 0.42, 0.4, 38, { z: 2, tap: true }], ['bird_d', '🐦', 'sand', 0.78, 0.42, 38, { z: 2, tap: true }], ['bird_e', '🐦', 'sand', 0.6, 0.26, 36, { z: 2, tap: true }],
    ['net', null, 'sand', 0.16, 0.8, 56]];
  L.lv_040 = [['milk', null, 'sand', 0.2, 0.36, 60], ['ice', null, 'sand', 0.5, 0.3, 56], ['mix', '🥤', 'sand', 0.5, 0.72, 52], ['cone', null, 'sand', 0.8, 0.5, 64]];
  L.lv_041 = [['decoy_a', '🥚', 'sand', 0.45, 0.42, 72], ['decoy_b', '🌾', 'sand', 0.18, 0.66, 50], ['hen', null, 'sand', 0.97, 0.86, 46, { hit: 48 }]];
  L.lv_042 = [['rotate_six', '6', 'sand', 0.24, 0.3, 60], ['deco_9', '9', 'sand', 0.5, 0.22, 60], ['deco_0', '0', 'sand', 0.76, 0.32, 60],
    ['deco_3', '3', 'sand', 0.38, 0.62, 60], ['tap_level_number_if_8', '🎱', 'sand', 0.72, 0.66, 52]];
  L.lv_043 = [['big_box', null, 'sand', 0.32, 0.42, 110], ['small_box', '🎁', 'sand', 0.76, 0.6, 50]];
  L.lv_044 = [['semicircle_a', '🌓', 'sand', 0.26, 0.38, 60], ['semicircle_b', '🌗', 'sand', 0.72, 0.52, 60], ['deco_tri', '🔺', 'sand', 0.5, 0.18, 44], ['deco_sq', '🟦', 'sand', 0.5, 0.78, 44]];
  L.lv_045 = [['grandpa_forehead', '👴', 'sand', 0.42, 0.42, 116], ['decoy_a', '🪑', 'sand', 0.78, 0.5, 64], ['decoy_b', '📰', 'sand', 0.8, 0.84, 44]];
  L.lv_046 = [['deco_boat', '🛶', 'sea', 0.55, 0.55, 110], ['hole', null, 'sea', 0.6, 0.65, 34, { z: 2, hit: 48 }], ['cork', '🍾', 'sand', 0.24, 0.5, 52], ['cloth', '🧣', 'sand', 0.72, 0.62, 54]];
  L.lv_047 = [['sun', null, 'sky', 0.78, 0.45, 60], ['candle', null, 'sand', 0.36, 0.5, 66]];
  L.lv_048 = [['deco_pic_a', '🏖️', 'sand', 0.27, 0.36, 96], ['deco_pic_b', '🏖️', 'sand', 0.73, 0.36, 96], ['diff_0', '🦀', 'sand', 0.8, 0.72, 40, { hit: 46 }], ['diff_1', '🐚', 'sand', 0.62, 0.68, 34, { hit: 46 }]];
  L.lv_049 = [['rabbit', null, 'sand', 0.7, 0.42, 82], ['carrot', null, 'sand', 0.22, 0.66, 52], ['deco_basket', '🧺', 'sand', 0.2, 0.3, 44]];
  L.lv_050 = [['decoy_a', '👹', 'sand', 0.5, 0.42, 124], ['decoy_b', '🗡️', 'sand', 0.16, 0.8, 46]];
  L.lv_051 = [['coin_0', null, 'sand', 0.18, 0.26, 40], ['coin_1', null, 'sand', 0.44, 0.5, 40], ['coin_2', null, 'sand', 0.78, 0.22, 40],
    ['coin_3', null, 'sand', 0.66, 0.74, 40], ['coin_4', null, 'sand', 0.28, 0.82, 40], ['deco_shovel', '⛏️', 'sand', 0.86, 0.56, 44]];
  L.lv_052 = [['chest_lock', '🧰', 'sand', 0.68, 0.44, 92], ['deco_fish', '🐟', 'sand', 0.24, 0.3, 56], ['key_on_hook', '🔑', 'sand', 0.24, 0.62, 44]];
  L.lv_053 = [['cake', null, 'sky', 0.7, 0.4, 50], ['fridge_door', null, 'sand', 0.7, 0.4, 104], ['deco_me', '🧍', 'sand', 0.28, 0.5, 86]];
  L.lv_054 = [['alien', null, 'sand', 0.66, 0.46, 56], ['fake_rock', null, 'sand', 0.66, 0.46, 84, { z: 2 }], ['deco_rock', '🪨', 'sand', 0.26, 0.4, 70], ['deco_crab', '🦀', 'sand', 0.3, 0.8, 42]];
  L.lv_055 = [['cow', null, 'sand', 0.6, 0.32, 120], ['under_cow', '🌾', 'sand', 0.6, 0.66, 44], ['bucket', null, 'sand', 0.16, 0.74, 52]];
  L.lv_056 = [['triangle', null, 'sand', 0.5, 0.42, 96], ['decoy_a', '🔵', 'sand', 0.18, 0.74, 44], ['decoy_b', '🟩', 'sand', 0.82, 0.74, 44]];
  L.lv_057 = [['pingpong', null, 'sand', 0.62, 0.48, 40], ['cup', null, 'sand', 0.62, 0.42, 72, { z: 2 }], ['deco_plate', '🍽️', 'sand', 0.26, 0.44, 64], ['deco_cup', '🥛', 'sand', 0.3, 0.8, 44]];
  L.lv_058 = [['deco_thief', '🦹', 'sand', 0.76, 0.32, 90], ['front_of_thief', '👣', 'sand', 0.56, 0.48, 46], ['hole', null, 'sand', 0.76, 0.72, 52],
    ['shovel', '⛏️', 'sand', 0.18, 0.36, 52], ['straw', null, 'sand', 0.22, 0.76, 50]];
  L.lv_059 = [['digit_2a', '2', 'sand', 0.16, 0.42, 56], ['deco_plus', '➕', 'sand', 0.33, 0.42, 34], ['digit_2b', '2', 'sand', 0.5, 0.42, 56],
    ['deco_eq', '🟰', 'sand', 0.67, 0.42, 34], ['22', '？', 'sand', 0.84, 0.42, 56]];
  L.lv_060 = [['deco_key', '🗝️', 'sand', 0.18, 0.44, 60], ['matching_lock', null, 'sand', 0.66, 0.24, 52], ['decoy_a', '🪣', 'sand', 0.84, 0.56, 52], ['decoy_b', '🐚', 'sand', 0.56, 0.74, 48]];
  L.lv_061 = [['duck', null, 'sand', 0.24, 0.32, 64], ['water', null, 'sand', 0.74, 0.76, 66]];
  L.lv_062 = [['monster', null, 'sand', 0.52, 0.42, 120], ['decoy_a', '⚔️', 'sand', 0.16, 0.76, 46], ['decoy_b', '🛡️', 'sand', 0.86, 0.76, 46]];
  L.lv_063 = [['deco_hut_a', '🛖', 'sand', 0.27, 0.34, 100], ['deco_hut_b', '🛖', 'sand', 0.73, 0.34, 100], ['diff_0', '🪟', 'sand', 0.68, 0.36, 28, { hit: 44, z: 2 }],
    ['diff_1', '💨', 'sand', 0.8, 0.08, 30, { hit: 44, z: 2 }], ['diff_2', '🥥', 'sand', 0.84, 0.66, 34, { hit: 44 }]];
  L.lv_064 = [['drowning_person', '🙋', 'sea', 0.66, 0.45, 64], ['rope', null, 'sand', 0.22, 0.42, 56], ['deco_plank', '🪵', 'sand', 0.62, 0.62, 60]];
  L.lv_065 = [['deco_92', '92', 'sand', 0.3, 0.38, 84], ['deco_58', '58', 'sand', 0.7, 0.38, 84], ['tiny_digit_in_title', '1', 'sky', 0.86, 0.1, 22, { hit: 44 }]];
  L.lv_066 = [['sun', null, 'sky', 0.24, 0.45, 60], ['deco_tree', '🌳', 'sand', 0.62, 0.3, 120], ['owl', null, 'sand', 0.62, 0.26, 50, { z: 2 }]];
  L.lv_067 = [['apples', '🍎🍎🍎', 'sand', 0.5, 0.2, 54, { w: 3 }], ['knife', null, 'sand', 0.14, 0.44, 48],
    ['deco_p1', '🧍🧍🧍', 'sand', 0.5, 0.56, 48, { w: 3 }], ['deco_p2', '🧍🧍🧍', 'sand', 0.5, 0.82, 48, { w: 3 }]];
  L.lv_068 = [['deco_fan', '🌀', 'sand', 0.3, 0.32, 88], ['plug', null, 'sand', 0.3, 0.72, 50], ['outlet', '插座', 'sand', 0.76, 0.5, 64], ['deco_ice', '🧊', 'sand', 0.8, 0.86, 40]];
  L.lv_069 = [['eggs', null, 'sand', 0.22, 0.45, 58], ['deco_e1', '🥚', 'sand', 0.41, 0.45, 58], ['raw_egg', null, 'sand', 0.6, 0.45, 58], ['deco_e2', '🥚', 'sand', 0.79, 0.45, 58]];
  L.lv_070 = [['small_ball', '🟤', 'sand', 0.2, 0.3, 44], ['large_ball', '🟤', 'sand', 0.52, 0.62, 92], ['mid_ball', '🟤', 'sand', 0.82, 0.32, 66]];
  L.lv_071 = [['stone', null, 'sand', 0.5, 0.48, 120], ['char_重', null, 'sand', 0.5, 0.48, 50, { z: 2 }]];
  L.lv_072 = [['decoy_a', '🌴', 'sand', 0.3, 0.32, 84], ['decoy_b', '🪨', 'sand', 0.62, 0.56, 70], ['edge_arrow', '➡️', 'sand', 0.96, 0.82, 26, { hit: 46 }]];
  L.lv_073 = [['bamboo_tube', null, 'sand', 0.5, 0.36, 100], ['lens_a', null, 'sand', 0.18, 0.76, 48], ['lens_b', null, 'sand', 0.82, 0.76, 48]];
  L.lv_074 = [['decoy_a', '🦜', 'sand', 0.42, 0.38, 96], ['decoy_b', '🌴', 'sand', 0.82, 0.3, 72], ['volume_icon', null, 'sky', 0.14, 0.45, 46]];
  L.lv_075 = [['deco_9', '9', 'sand', 0.2, 0.3, 56], ['deco_98', '98', 'sand', 0.44, 0.3, 56], ['deco_99', '9.9', 'sand', 0.7, 0.3, 56, { w: 1.2 }],
    ['biggest_num', '999', 'sand', 0.5, 0.72, 62, { w: 1.4 }], ['fold', '📜', 'sand', 0.5, 0.72, 74, { z: 2, w: 1.2 }]];
  L.lv_076 = [['branch', null, 'sand', 0.42, 0.3, 96], ['rope', null, 'sand', 0.2, 0.68, 52], ['hook', '🪝', 'sand', 0.8, 0.72, 48], ['rope_end', null, 'sand', 0.8, 0.3, 42]];
  L.lv_077 = [['decoy_a', '🌴', 'sand', 0.3, 0.4, 80], ['decoy_b', '🐚', 'sand', 0.72, 0.6, 52]];
  L.lv_078 = [['decoy_a', '🍃', 'sand', 0.26, 0.36, 60], ['moving_leaf_bug', null, 'sand', 0.56, 0.5, 60], ['decoy_b', '🍃', 'sand', 0.8, 0.3, 60], ['deco_l', '🍂', 'sand', 0.4, 0.78, 54]];
  L.lv_079 = [['character', '🥵', 'sand', 0.5, 0.3, 96], ['fan', null, 'sand', 0.18, 0.76, 50], ['ice', null, 'sand', 0.5, 0.82, 50], ['wet_towel', null, 'sand', 0.82, 0.76, 50]];
  L.lv_080 = [['moon', null, 'sky', 0.62, 0.45, 60], ['sun', null, 'sky', 0.62, 0.45, 60, { hide: true }], ['deco_star', '⭐', 'sky', 0.2, 0.4, 30]];
  L.lv_081 = [['deco_t1', '🔺', 'sand', 0.5, 0.16, 70], ['deco_t2', '🔺', 'sand', 0.38, 0.4, 50], ['deco_t3', '🔺', 'sand', 0.62, 0.4, 50],
    ['answer_7', null, 'sand', 0.17, 0.82, 52, { w: 1.15, h: 0.95 }], ['answer_8', null, 'sand', 0.39, 0.82, 52, { w: 1.15, h: 0.95 }],
    ['answer_9', null, 'sand', 0.61, 0.82, 52, { w: 1.15, h: 0.95 }], ['answer_10', null, 'sand', 0.83, 0.82, 52, { w: 1.15, h: 0.95 }]];
  L.lv_082 = [['gap', '🌊断口', 'sea', 0.5, 0.5, 70], ['deco_b1', '🪵', 'sand', 0.12, 0.12, 50], ['deco_b2', '🪵', 'sand', 0.88, 0.12, 50],
    ['plank', '🪵', 'sand', 0.3, 0.62, 58], ['nails', null, 'sand', 0.7, 0.66, 46]];
  L.lv_083 = [['clouds', null, 'sand', 0.5, 0.36, 80, { z: 2 }], ['car', null, 'sand', 0.2, 0.42, 66], ['road_sign', '🪧', 'sand', 0.84, 0.4, 66]];
  L.lv_084 = [['rating_bar', null, 'sand', 0.5, 0.82, 52, { w: 3.4 }], ['star_0', null, 'sky', 0.16, 0.4, 36], ['star_1', null, 'sky', 0.86, 0.55, 36],
    ['star_2', null, 'sand', 0.2, 0.3, 36], ['star_3', null, 'sand', 0.6, 0.18, 36], ['star_4', null, 'sand', 0.82, 0.5, 36]];
  L.lv_085 = [['dirty_water', '🫗', 'sand', 0.2, 0.28, 60], ['filter_cloth', '🧣', 'sand', 0.5, 0.2, 52], ['filtered', '💧', 'sand', 0.2, 0.72, 46],
    ['bottle', '🍶', 'sand', 0.52, 0.66, 52], ['fire', null, 'sand', 0.82, 0.48, 70]];
  L.lv_086 = [['progress_knob', '🔘', 'sand', 0.16, 0.45, 48], ['progress_end', '🏁', 'sand', 0.86, 0.45, 56], ['deco_d1', '🟫', 'sand', 0.38, 0.45, 26], ['deco_d2', '🟫', 'sand', 0.6, 0.45, 26]];
  L.lv_087 = [['deco_f1', '🙂', 'sand', 0.2, 0.3, 58], ['deco_f2', '😐', 'sand', 0.8, 0.3, 58], ['deco_f3', '😊', 'sand', 0.26, 0.74, 58],
    ['happiest_face', '😆', 'sand', 0.66, 0.66, 62], ['hand', null, 'sand', 0.66, 0.64, 72, { z: 2 }]];
  L.lv_088 = [['dying_fire', null, 'sand', 0.5, 0.36, 54], ['wood', null, 'sand', 0.2, 0.72, 56], ['paper', null, 'sand', 0.8, 0.72, 50]];
  L.lv_089 = [['VI', '🥢🥢🥢', 'sand', 0.5, 0.42, 52, { w: 3 }], ['decoy_a', '🪨', 'sand', 0.16, 0.8, 46], ['decoy_b', '🐚', 'sand', 0.84, 0.8, 44]];
  L.lv_090 = [['deco_sun', '☀️', 'sky', 0.14, 0.45, 50], ['deco_man', '🧍', 'sand', 0.5, 0.22, 80], ['decoy_a', '👤', 'sand', 0.2, 0.72, 56],
    ['correct_shadow', '👤', 'sand', 0.8, 0.72, 56], ['decoy_b', '👤', 'sand', 0.5, 0.82, 56]];
  L.lv_091 = [['wolf', null, 'sand', 0.34, 0.4, 92], ['decoy_a', '🦆', 'sand', 0.76, 0.62, 56], ['decoy_b', '🌴', 'sand', 0.84, 0.18, 56]];
  L.lv_092 = [['balloon', null, 'sky', 0.5, 0.45, 70], ['decoy_a', '🧍', 'sand', 0.5, 0.4, 84], ['decoy_b', '🎀', 'sand', 0.8, 0.7, 40]];
  L.lv_093 = [['apple', null, 'sand', 0.2, 0.24, 54], ['banana', null, 'sand', 0.42, 0.18, 54], ['hexagon', null, 'sand', 0.76, 0.3, 54],
    ['circle', '🔵', 'sand', 0.3, 0.68, 50], ['square', '🟧', 'sand', 0.64, 0.72, 50]];
  L.lv_094 = [['puzzle_board', null, 'sand', 0.5, 0.3, 104], ['piece_0', '🧩', 'sand', 0.14, 0.8, 46], ['piece_1', '🧩', 'sand', 0.38, 0.84, 46],
    ['piece_2', '🧩', 'sand', 0.62, 0.84, 46], ['piece_3', '🧩', 'sand', 0.86, 0.8, 46]];
  L.lv_095 = [['decoy_target', '🗿', 'sand', 0.5, 0.42, 104], ['hint_button', null, 'sand', 0.5, 0.42, 40, { hide: true }]];
  L.lv_096 = [['deco_a1', '⬆️', 'sand', 0.2, 0.26, 50], ['deco_a2', '➡️', 'sand', 0.5, 0.2, 50], ['decoy_a', '⬅️', 'sand', 0.8, 0.3, 50],
    ['deco_a3', '↗️', 'sand', 0.32, 0.66, 50], ['decoy_b', '↖️', 'sand', 0.84, 0.7, 50], ['down_arrow', null, 'sand', 0.58, 0.8, 40, { hit: 48 }]];
  L.lv_097 = [['magnet', null, 'sand', 0.22, 0.4, 56], ['crack_with_key', '🔑缝里', 'sand', 0.68, 0.62, 44, { w: 1.4 }]];
  L.lv_098 = [['answer_97', null, 'sand', 0.3, 0.3, 60, { w: 1.3, h: 0.95 }], ['answer_99', null, 'sand', 0.7, 0.26, 60, { w: 1.3, h: 0.95 }],
    ['answer_100', null, 'sand', 0.32, 0.72, 60, { w: 1.5, h: 0.95 }], ['answer_98', null, 'sand', 0.72, 0.68, 60, { w: 1.3, h: 0.95 }]];
  L.lv_099 = [['tent_bulge', null, 'sand', 0.6, 0.4, 110], ['decoy_a', '🪨', 'sand', 0.18, 0.66, 54], ['decoy_b', '🐚', 'sand', 0.86, 0.82, 40]];
  L.lv_100 = [['torch', null, 'sand', 0.14, 0.78, 52], ['pile1', null, 'sand', 0.3, 0.28, 60], ['pile2', null, 'sand', 0.58, 0.4, 60], ['pile3', null, 'sand', 0.84, 0.26, 60]];

  Game.LevelLayouts = L;
})();
