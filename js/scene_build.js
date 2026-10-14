/**
 * 关卡场景构建：根据 LevelConfig / win 生成可交互实体（占位几何 + emoji）
 * 无独立美术资源时用色块跑通；可复用 bg_beach.jpg
 */
(function () {
  'use strict';

  var EMOJI = {
    coconut: '🥥',
    fruit: '🍇',
    basket: '🧺',
    bird: '🐦',
    rock: '🪨',
    shell: '🐚',
    stick: '🪵',
    grass: '🌾',
    fire: '🔥',
    kettle: '🫖',
    water: '💧',
    crab: '🦀',
    sand: '⛰️',
    sun: '☀️',
    rope: '🪢',
    net: '🕸️',
    banana: '🍌',
    leaf: '🍃',
    stone: '🪨',
    parrot: '🦜',
    sheep: '🐑',
    wolf: '🐺',
    meat: '🥩',
    log: '🪵',
    dog: '🐕',
    food: '🥫',
    ring: '💍',
    fish: '🐟',
    person: '🧍',
    cloud: '☁️',
    star: '⭐',
    egg: '🥚',
    hen: '🐔',
    key: '🔑',
    lock: '🔒',
    cake: '🍰',
    monster: '👹',
    moon: '🌙',
    car: '🚗',
    balloon: '🎈',
    apple: '🍎',
    banana2: '🍌',
    box: '📦',
    ice: '🧊',
    fan: '🪭',
    towel: '🧻',
    glasses: '👓',
    fly: '🪰',
    chick: '🐤',
    cage: '🗄️',
    rain: '🌧️',
    clock: '🕐',
    heart: '❤️',
    coin: '🪙',
    chest: '🧰',
    fridge: '🧊',
    alien: '👽',
    cow: '🐄',
    bucket: '🪣',
    triangle: '🔺',
    cup: '☕',
    pingpong: '🏓',
    shovel: '🪓',
    straw: '🌾',
    owl: '🦉',
    ball: '⚪',
    lens: '🔍',
    bamboo: '🎋',
    mute: '🔇',
    wood: '🪵',
    paper: '📄',
    match: '🥢',
    map: '🗺️',
    torch: '🔦',
    pile: '🪵',
    duck: '🦆',
    wolf2: '🐺',
    hand: '✋',
    smile: '😊',
    face: '🙂',
    hex: '⬡',
    circle: '⭕',
    square: '⬜',
    num: '🔢',
    progress: '📶',
    bug: '🐛',
    tent: '⛺',
    rabbit: '🐇',
    cat: '🐱',
    carrot: '🥕',
    knife: '🔪',
    candle: '🕯️',
    plug: '🔌',
    outlet: '🔌',
    magnet: '🧲',
    bulb: '💡',
    saw: '🪚',
    box2: '📦',
    milk: '🥛',
    cone: '🍦',
    cork: '🪵',
    cloth: '🦺',
    hole: '🕳️',
    plank: '🧱',
    nails: '钉子',
    filter: '🧻',
    bottle: '🍼',
    dirty: '🫗',
    road: '🚧',
    rating: '☆',
    hair: '💆',
    volume: '🔊'
  };

  function ent(id, opt) {
    opt = opt || {};
    return {
      id: id,
      x: opt.x || 0,
      y: opt.y || 0,
      w: opt.w || 56,
      h: opt.h || 56,
      label: opt.label || '?',
      color: opt.color || '#D4A574',
      textColor: opt.textColor || '#2A241C',
      draggable: !!opt.draggable,
      tappable: opt.tappable !== false,
      visible: opt.visible !== false,
      z: opt.z || 0,
      meta: opt.meta || {},
      ox: opt.x || 0,
      oy: opt.y || 0
    };
  }

  function hitTest(list, x, y) {
    var best = null;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e.visible) continue;
      if (x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) {
        if (!best || e.z >= best.z) best = e;
      }
    }
    return best;
  }

  function overlap(a, b, pad) {
    pad = pad || 8;
    return !(
      a.x + a.w < b.x + pad ||
      b.x + b.w < a.x + pad ||
      a.y + a.h < b.y + pad ||
      b.y + b.h < a.y + pad
    );
  }

  function centerOf(e) {
    return { x: e.x + e.w / 2, y: e.y + e.h / 2 };
  }

  /** 手写前 20 关布局（主包验收重点） */
  var HAND = {
    lv_001: function (W, H, area) {
      var ys = area.y + 40;
      var sizes = [
        { id: 'c1', s: 44, l: EMOJI.coconut },
        { id: 'c2', s: 52, l: EMOJI.coconut },
        { id: 'biggest_coconut', s: 72, l: EMOJI.coconut },
        { id: 'c3', s: 48, l: EMOJI.coconut },
        { id: 'c4', s: 40, l: EMOJI.coconut }
      ];
      var ents = [];
      var gap = 8;
      var total = sizes.reduce(function (a, b) {
        return a + b.s;
      }, 0) + gap * (sizes.length - 1);
      var x = (W - total) / 2;
      for (var i = 0; i < sizes.length; i++) {
        var it = sizes[i];
        ents.push(
          ent(it.id, {
            x: x,
            y: ys + (72 - it.s) / 2,
            w: it.s,
            h: it.s,
            label: it.l,
            color: '#8B5A2B',
            meta: { size: it.s }
          })
        );
        x += it.s + gap;
      }
      return ents;
    },
    lv_002: function (W, H, area) {
      return [
        ent('wild_fruits', {
          x: 60,
          y: area.y + 80,
          w: 60,
          h: 60,
          label: EMOJI.fruit,
          color: '#6B8F3C',
          draggable: true
        }),
        ent('fruit_b', {
          x: 140,
          y: area.y + 120,
          w: 50,
          h: 50,
          label: EMOJI.fruit,
          color: '#6B8F3C',
          draggable: true,
          meta: { aliasOf: 'wild_fruits' }
        }),
        ent('basket', {
          x: W / 2 - 40,
          y: area.y + 220,
          w: 80,
          h: 70,
          label: EMOJI.basket,
          color: '#C4A35A'
        })
      ];
    },
    lv_003: function (W, H, area) {
      return [
        ent('tree', {
          x: 80,
          y: area.y + 60,
          w: 70,
          h: 100,
          label: '🌴',
          color: '#3F6B3A'
        }),
        ent('rock_decoy', {
          x: 220,
          y: area.y + 140,
          w: 70,
          h: 55,
          label: EMOJI.rock,
          color: '#8A8680'
        })
      ];
    },
    lv_004: function (W, H, area) {
      return [
        ent('shell', {
          x: W / 2 - 25,
          y: area.y + 150,
          w: 50,
          h: 40,
          label: EMOJI.shell,
          color: '#E8D5B7',
          visible: false,
          z: 1
        }),
        ent('rock', {
          x: W / 2 - 55,
          y: area.y + 120,
          w: 110,
          h: 90,
          label: EMOJI.rock,
          color: '#7A756E',
          z: 2,
          meta: { covers: 'shell' }
        })
      ];
    },
    lv_005: function (W, H, area) {
      return [
        ent('sticks', {
          x: 70,
          y: area.y + 100,
          w: 70,
          h: 60,
          label: EMOJI.stick,
          color: '#8B5A2B',
          draggable: true
        }),
        ent('dry_grass', {
          x: 220,
          y: area.y + 160,
          w: 80,
          h: 70,
          label: EMOJI.grass,
          color: '#C2A14D'
        })
      ];
    },
    lv_006: function (W, H, area) {
      var ents = [];
      var ids = ['c_a', 'c_b', 'middle_coconut', 'c_d', 'c_e'];
      for (var i = 0; i < 5; i++) {
        ents.push(
          ent(ids[i], {
            x: 40 + i * 64,
            y: area.y + 100,
            w: 54,
            h: 54,
            label: EMOJI.coconut,
            color: '#8B5A2B',
            draggable: ids[i] === 'middle_coconut'
          })
        );
      }
      ents.push(
        ent('bitten_coconut', {
          x: 40 + 2 * 64,
          y: area.y + 100,
          w: 54,
          h: 54,
          label: '🥥缺口',
          color: '#A05A2B',
          visible: false,
          z: 0
        })
      );
      return ents;
    },
    lv_007: function (W, H, area) {
      return [
        ent('campfire', {
          x: W / 2 - 40,
          y: area.y + 120,
          w: 80,
          h: 80,
          label: EMOJI.fire,
          color: '#E07A3A',
          meta: { burning: true }
        })
      ];
    },
    lv_008: function (W, H, area) {
      return [
        ent('empty_kettle', {
          x: 70,
          y: area.y + 100,
          w: 70,
          h: 70,
          label: EMOJI.kettle,
          color: '#6E8B9A',
          draggable: true
        }),
        ent('puddle', {
          x: 210,
          y: area.y + 180,
          w: 100,
          h: 70,
          label: EMOJI.water,
          color: '#4A90A4'
        })
      ];
    },
    lv_009: function (W, H, area) {
      return [
        ent('sand_mound_s', {
          x: 50,
          y: area.y + 160,
          w: 60,
          h: 45,
          label: EMOJI.sand,
          color: '#D2B48C'
        }),
        ent('sand_mound_large', {
          x: W / 2 - 45,
          y: area.y + 140,
          w: 90,
          h: 70,
          label: EMOJI.sand,
          color: '#C4A574'
        }),
        ent('empty_shell', {
          x: 260,
          y: area.y + 180,
          w: 55,
          h: 45,
          label: EMOJI.shell,
          color: '#E8D5B7'
        })
      ];
    },
    lv_010: function (W, H, area) {
      return [
        ent('person', {
          x: W / 2 - 30,
          y: area.y + 180,
          w: 60,
          h: 80,
          label: EMOJI.person,
          color: '#C9A66B'
        }),
        ent('sun', {
          x: W / 2 - 35,
          y: area.y + 30,
          w: 70,
          h: 70,
          label: EMOJI.sun,
          color: '#F0C040',
          draggable: true,
          z: 3
        })
      ];
    },
    lv_011: function (W, H, area) {
      return [
        ent('rope', {
          x: 60,
          y: area.y + 100,
          w: 70,
          h: 60,
          label: EMOJI.rope,
          color: '#B8956A',
          draggable: true
        }),
        ent('broken_net', {
          x: 200,
          y: area.y + 150,
          w: 100,
          h: 80,
          label: EMOJI.net,
          color: '#7A8B6E'
        })
      ];
    },
    lv_012: function (W, H, area) {
      var ents = [
        ent('leaf', {
          x: W / 2 - 40,
          y: area.y + 80,
          w: 80,
          h: 60,
          label: EMOJI.leaf,
          color: '#4F7A3A',
          draggable: true,
          z: 2
        })
      ];
      for (var i = 0; i < 7; i++) {
        ents.push(
          ent('banana_' + i, {
            x: 70 + (i % 4) * 55,
            y: area.y + 150 + Math.floor(i / 4) * 55,
            w: 48,
            h: 48,
            label: EMOJI.banana,
            color: '#E6C84A',
            meta: { countItem: true }
          })
        );
      }
      // answer pads 5/6/7/8
      [5, 6, 7, 8].forEach(function (n, i) {
        ents.push(
          ent('answer_' + n, {
            x: 40 + i * 80,
            y: area.y + area.h - 70,
            w: 64,
            h: 48,
            label: String(n),
            color: n === 7 ? '#2A6B4F' : '#8A7A66',
            textColor: '#FFF',
            meta: { answerValue: n }
          })
        );
      });
      return ents;
    },
    lv_013: function (W, H, area) {
      return [
        ent('forest', {
          x: 40,
          y: area.y + 60,
          w: W - 80,
          h: 180,
          label: '密林 🌴🌴🌴',
          color: '#2F5A32'
        })
      ];
    },
    lv_014: function (W, H, area) {
      var colors = [
        { id: 'c_red', c: '#D94F3D', l: '红' },
        { id: 'c_yellow', c: '#E6C84A', l: '黄' },
        { id: 'c_blue', c: '#3D7AD9', l: '蓝' },
        { id: 'c_green', c: '#3DAD5A', l: '绿' }
      ];
      return colors.map(function (it, i) {
        return ent(it.id, {
          x: 40 + (i % 2) * 150,
          y: area.y + 80 + Math.floor(i / 2) * 100,
          w: 120,
          h: 80,
          label: it.l,
          color: it.c,
          textColor: '#fff'
        });
      });
    },
    lv_015: function (W, H, area) {
      return [
        ent('sharp_stone', {
          x: 60,
          y: area.y + 100,
          w: 70,
          h: 60,
          label: '🔪石',
          color: '#8A8680',
          draggable: true
        }),
        ent('coconut', {
          x: 210,
          y: area.y + 150,
          w: 80,
          h: 80,
          label: EMOJI.coconut,
          color: '#8B5A2B'
        })
      ];
    },
    lv_016: function (W, H, area) {
      return [
        ent('parrot', {
          x: W / 2 - 40,
          y: area.y + 100,
          w: 80,
          h: 80,
          label: EMOJI.parrot,
          color: '#2A8B4F',
          meta: { noisy: true }
        }),
        ent('sleeper', {
          x: W / 2 - 30,
          y: area.y + 220,
          w: 60,
          h: 70,
          label: '😴',
          color: '#C9A66B'
        })
      ];
    },
    lv_017: function (W, H, area) {
      var ents = [
        ent('meat', {
          x: 30,
          y: area.y + 80,
          w: 56,
          h: 56,
          label: EMOJI.meat,
          color: '#B84A3A',
          draggable: true,
          z: 3
        })
      ];
      for (var i = 0; i < 4; i++) {
        var isWolf = i === 2;
        ents.push(
          ent(isWolf ? 'wolf_sheep' : 'sheep_' + i, {
            x: 70 + i * 70,
            y: area.y + 170,
            w: 60,
            h: 60,
            label: isWolf ? '👀🐑' : EMOJI.sheep,
            color: isWolf ? '#9A9A9A' : '#F0F0F0',
            meta: { sheep: true, wolf: isWolf, probed: false }
          })
        );
      }
      return ents;
    },
    lv_018: function (W, H, area) {
      return [
        ent('logs', {
          x: 50,
          y: area.y + 100,
          w: 70,
          h: 55,
          label: EMOJI.log,
          color: '#8B5A2B',
          draggable: true
        }),
        ent('log_b', {
          x: 140,
          y: area.y + 130,
          w: 70,
          h: 55,
          label: EMOJI.log,
          color: '#8B5A2B',
          draggable: true,
          meta: { aliasOf: 'logs' }
        }),
        ent('log_c', {
          x: 80,
          y: area.y + 180,
          w: 70,
          h: 55,
          label: EMOJI.log,
          color: '#8B5A2B',
          draggable: true,
          meta: { aliasOf: 'logs' }
        }),
        ent('rope', {
          x: 250,
          y: area.y + 90,
          w: 60,
          h: 55,
          label: EMOJI.rope,
          color: '#B8956A',
          draggable: true
        }),
        ent('bundled_logs', {
          x: W / 2 - 50,
          y: area.y + 250,
          w: 100,
          h: 50,
          label: '捆好的原木',
          color: '#6B4423',
          visible: false
        })
      ];
    },
    lv_019: function (W, H, area) {
      return [
        ent('dogfood', {
          x: 50,
          y: area.y + 100,
          w: 70,
          h: 60,
          label: EMOJI.food,
          color: '#C4A35A',
          meta: { stepId: 'tap_dogfood' }
        }),
        ent('dog', {
          x: 200,
          y: area.y + 160,
          w: 80,
          h: 70,
          label: EMOJI.dog,
          color: '#B8956A',
          meta: { stepId: 'drag_to_dog' }
        }),
        ent('ring', {
          x: 220,
          y: area.y + 200,
          w: 50,
          h: 40,
          label: EMOJI.ring,
          color: '#E6C84A',
          visible: false,
          meta: { stepId: 'tap_ring' }
        })
      ];
    },
    lv_020: function (W, H, area) {
      return [
        ent('fish', {
          x: W / 2 - 35,
          y: area.y + 80,
          w: 70,
          h: 50,
          label: EMOJI.fish,
          color: '#4A90A4'
        }),
        ent('water_zone', {
          x: 40,
          y: area.y + area.h - 90,
          w: W - 80,
          h: 70,
          label: '🌊 水在下方',
          color: '#3A7A9A',
          textColor: '#fff'
        })
      ];
    }
  };

  function genericFromWin(level, W, H, area) {
    var win = level.win || {};
    var action = win.action || 'tap';
    var ents = [];
    var y0 = area.y + 70;

    function addId(id, i, opts) {
      opts = opts || {};
      var col = 3;
      var gx = 40 + (i % col) * 100;
      var gy = y0 + Math.floor(i / col) * 90;
      ents.push(
        ent(id, {
          x: opts.x != null ? opts.x : gx,
          y: opts.y != null ? opts.y : gy,
          w: opts.w || 70,
          h: opts.h || 60,
          label: opts.label || guessLabel(id),
          color: opts.color || '#C4A574',
          draggable: !!opts.draggable,
          visible: opts.visible !== false,
          meta: opts.meta || {},
          z: opts.z || 0,
          textColor: opts.textColor
        })
      );
    }

    function guessLabel(id) {
      if (!id) return '?';
      if (id.indexOf('title_word:') === 0) return id.slice(11);
      if (EMOJI[id]) return EMOJI[id];
      var key = id.replace(/_\d+$/, '');
      if (EMOJI[key]) return EMOJI[key];
      if (/sun/.test(id)) return EMOJI.sun;
      if (/moon/.test(id)) return EMOJI.moon;
      if (/star/.test(id)) return EMOJI.star;
      if (/cloud/.test(id)) return EMOJI.cloud;
      if (/fire/.test(id)) return EMOJI.fire;
      if (/egg/.test(id)) return EMOJI.egg;
      if (/key/.test(id)) return EMOJI.key;
      if (/lock/.test(id)) return EMOJI.lock;
      if (/wolf/.test(id)) return EMOJI.wolf;
      if (/sheep/.test(id)) return EMOJI.sheep;
      if (/fish/.test(id)) return EMOJI.fish;
      if (/bird/.test(id)) return EMOJI.bird;
      if (/log|wood|stick|branch|plank/.test(id)) return EMOJI.log;
      if (/rope|net/.test(id)) return EMOJI.rope;
      if (/water|puddle|basin/.test(id)) return EMOJI.water;
      if (/fruit|apple|banana|coconut/.test(id)) return EMOJI.fruit;
      if (/monster/.test(id)) return EMOJI.monster;
      if (/balloon/.test(id)) return EMOJI.balloon;
      if (/car/.test(id)) return EMOJI.car;
      if (/cake/.test(id)) return EMOJI.cake;
      if (/coin/.test(id)) return EMOJI.coin;
      if (/map/.test(id)) return EMOJI.map;
      if (/torch|fire/.test(id)) return EMOJI.torch;
      if (/person|character|grandpa/.test(id)) return EMOJI.person;
      if (/num|digit|answer/.test(id)) return EMOJI.num;
      if (/triangle/.test(id)) return EMOJI.triangle;
      if (/hexagon/.test(id)) return EMOJI.hex;
      if (/circle/.test(id)) return EMOJI.circle;
      if (/square/.test(id)) return EMOJI.square;
      if (/hint/.test(id)) return '💡';
      if (/volume|mute/.test(id)) return EMOJI.volume;
      if (/hair/.test(id)) return '💇';
      if (/match/.test(id)) return EMOJI.match;
      return id.length > 6 ? id.slice(0, 4) : id;
    }

    var collected = [];
    function pushUnique(id) {
      if (!id || typeof id !== 'string') return;
      if (id.indexOf('title_word:') === 0) return;
      if (id === 'title_text' || id === 'title_overlay') return;
      if (collected.indexOf(id) >= 0) return;
      collected.push(id);
    }

    function walk(v) {
      if (!v) return;
      if (typeof v === 'string') {
        pushUnique(v);
        return;
      }
      if (Array.isArray(v)) {
        v.forEach(walk);
        return;
      }
      if (typeof v === 'object') {
        Object.keys(v).forEach(function (k) {
          walk(v[k]);
        });
      }
    }
    walk(win);

    // action-specific extras
    if (action === 'tap_all' && Array.isArray(win.targets)) {
      win.targets.forEach(pushUnique);
    }
    if (action === 'tap_sequence' && Array.isArray(win.order)) {
      win.order.forEach(pushUnique);
    }
    if (action === 'drag_stack' && Array.isArray(win.order)) {
      win.order.forEach(pushUnique);
    }
    if (action === 'drag_all' && Array.isArray(win.items)) {
      win.items.forEach(pushUnique);
    }
    if (action === 'drag_any_of' && Array.isArray(win.items)) {
      win.items.forEach(pushUnique);
    }
    if (action === 'drag_puzzle') {
      for (var p = 0; p < (win.pieces || 4); p++) pushUnique('piece_' + p);
      pushUnique('puzzle_board');
    }
    if (action === 'tap_all_diffs' || action === 'drag_reveal_then_tap_diffs') {
      var n = win.count || 2;
      for (var d = 0; d < n; d++) pushUnique('diff_' + d);
    }
    if (action === 'swipe_reveal_then_tap' || action === 'tap_or_drag_stars') {
      var cn = win.count || 5;
      for (var c = 0; c < cn; c++) pushUnique((action.indexOf('star') >= 0 ? 'star_' : 'coin_') + c);
      if (win.to) pushUnique(win.to);
    }
    if (action === 'input_or_tap_answer' || action === 'tap_or_input' || action === 'reveal_then_count' || action === 'drag_apart_then_answer') {
      var ans = win.answer;
      var opts = [ans, ans - 1, ans + 1, ans + 2].filter(function (x, i, a) {
        return x > 0 && a.indexOf(x) === i;
      });
      opts.forEach(function (n) {
        pushUnique('answer_' + n);
      });
    }
    if (action === 'mute_or_volume_down') {
      pushUnique('volume_icon');
    }
    if (action === 'wait') {
      pushUnique('progress_knob');
    }
    if (action === 'long_press' && win.target === 'hint_button') {
      // hint is UI; still add decoy
      pushUnique('decoy_target');
    }

    // ensure from/to exist as draggable when needed
    collected.forEach(function (id, i) {
      var drag =
        /^(from|move|probe|pick|items|clear|drag)/.test(JSON.stringify(win).slice(0, 200)) ||
        id === win.from ||
        id === win.move ||
        id === win.probe ||
        id === win.pick ||
        id === win.target && /drag|offscreen|off|arrange|stack|puzzle|clear/.test(action) ||
        (win.items && win.items.indexOf(id) >= 0) ||
        (win.clear && win.clear.indexOf(id) >= 0) ||
        /^piece_/.test(id) ||
        id === 'logs' ||
        id === 'rope' ||
        id === 'sun' ||
        id === 'moon' ||
        id === 'clouds' ||
        id === 'leaf' ||
        id === 'meat' ||
        id === 'glasses' ||
        id === 'key' ||
        id === 'key_on_hook' ||
        id === 'bucket' ||
        id === 'net' ||
        id === 'torch' ||
        id === 'car' ||
        id === 'volume_icon' ||
        id === 'char_重' ||
        id === 'hand' ||
        id === 'cup' ||
        id === 'fold' ||
        id === 'fake_rock' ||
        id === 'middle_coconut' ||
        id === 'big_box' ||
        id === 'semicircle_a' ||
        id === 'wolf' ||
        id === 'monster' && action.indexOf('drag') >= 0;

      // refine drag flags from win
      if (win.from === id || win.move === id || win.probe === id || win.pick === id) drag = true;
      if (win.items && win.items.indexOf(id) >= 0) drag = true;
      if (win.clear && win.clear.indexOf(id) >= 0) drag = true;
      if (action === 'drag_offscreen' && win.target === id) drag = true;
      if (action === 'drag_off' && win.target === id) drag = true;
      if (action === 'drag_stack' && win.order && win.order.indexOf(id) >= 0) drag = true;
      if (action === 'drag_puzzle' && /^piece_/.test(id)) drag = true;
      if (action === 'drag_arrange') drag = true;
      if (action === 'drag_all' && win.items && win.items.indexOf(id) >= 0) drag = true;
      if (action === 'drag_any_of' && win.items && win.items.indexOf(id) >= 0) drag = true;
      if (action === 'drag_sequence' && win.steps) {
        win.steps.forEach(function (s) {
          if (s.from === id) drag = true;
        });
      }
      if (action === 'mute_or_volume_down' && id === 'volume_icon') drag = true;
      if (action === 'wait' && id === 'progress_knob') drag = false;

      var label = guessLabel(id);
      if (/^answer_/.test(id)) label = id.replace('answer_', '');
      if (id === 'volume_icon') label = '🔊';
      if (id === 'char_重') label = '重';
      if (id === 'puzzle_board') label = '地图框';
      if (/^piece_/.test(id)) label = '🧩' + id.slice(6);
      if (/^diff_/.test(id)) label = '❗';
      if (/^star_/.test(id)) label = '⭐';
      if (/^coin_/.test(id)) label = '🪙';
      if (id === 'progress_knob') label = '⏳';
      if (id === 'rating_bar') label = '☆☆☆☆☆';

      addId(id, i, {
        draggable: drag,
        label: label,
        color: /^answer_/.test(id) ? '#2A6B4F' : '#C4A574',
        textColor: /^answer_/.test(id) ? '#fff' : '#2A241C',
        meta: /^answer_/.test(id) ? { answerValue: parseInt(id.replace('answer_', ''), 10) } : {}
      });
    });

    // decoys so scene isn't empty
    if (ents.length < 2) {
      addId('decoy_a', ents.length, { label: '🌴', color: '#3F6B3A' });
      addId('decoy_b', ents.length, { label: '🪨', color: '#8A8680' });
    }

    return ents;
  }

  var SceneBuild = {};

  SceneBuild.build = function (level, W, H) {
    var top = 130;
    var bottom = 120;
    var area = { x: 16, y: top, w: W - 32, h: H - top - bottom };
    var ents;
    if (HAND[level.id]) {
      ents = HAND[level.id](W, H, area);
    } else {
      ents = genericFromWin(level, W, H, area);
    }
    return {
      area: area,
      entities: ents,
      find: function (id) {
        for (var i = 0; i < ents.length; i++) if (ents[i].id === id) return ents[i];
        return null;
      },
      findAll: function (pred) {
        return ents.filter(pred);
      },
      hit: function (x, y) {
        return hitTest(ents, x, y);
      },
      overlap: overlap,
      centerOf: centerOf
    };
  };

  SceneBuild.drawEntity = function (ctx, e) {
    if (!e.visible) return;
    ctx.save();
    ctx.fillStyle = e.color;
    Game.UI.roundRect(ctx, e.x, e.y, e.w, e.h, 10);
    ctx.fill();
    ctx.fillStyle = e.textColor || '#2A241C';
    var fontSize = Math.min(22, Math.floor(e.w / 2.2));
    ctx.font = fontSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.label, e.x + e.w / 2, e.y + e.h / 2);
    ctx.restore();
  };

  Game.SceneBuild = SceneBuild;
})();
