/**
 * 通关状态机：按 level.win.action 消费交互事件
 * 交互组件只负责上报 tap/drag/shake/rotate/pinch/longpress/wait 等事件
 */
(function () {
  'use strict';

  function WinCtrl(level, scene, hooks) {
    this.level = level;
    this.scene = scene;
    this.hooks = hooks || {};
    this.win = level.win || {};
    this.action = this.win.action || 'tap';
    this.done = false;
    this.state = this._initState();
    this.hintStep = 0;
  }

  WinCtrl.prototype._initState = function () {
    var w = this.win;
    var a = this.action;
    var st = {
      seqIdx: 0,
      dragged: {},
      tapped: {},
      probed: false,
      moved: {},
      revealed: false,
      merged: false,
      cleared: {},
      stacked: [],
      puzzleOk: 0,
      stars: 0,
      answers: null,
      waitAcc: 0,
      shakeAcc: 0,
      longAcc: 0,
      longTarget: null,
      pinchDone: false,
      rotateDone: false,
      twoFinger: false,
      muted: false
    };

    if (a === 'multi_tap' || a === 'sequence' || a === 'tap_sequence') {
      st.need = w.sequence || w.steps || w.order || [];
    }
    if (a === 'drag_sequence') {
      st.need = w.steps || [];
    }
    if (a === 'tap_all' || a === 'tap_all_diffs') {
      st.needCount = w.count || (w.targets && w.targets.length) || 0;
      st.needTargets = w.targets || null;
    }
    if (a === 'drag_then_tap_all' || a === 'swipe_reveal_then_tap' || a === 'tap_or_drag_stars') {
      st.needCount = w.count || 5;
    }
    if (a === 'drag_all' || a === 'drag_any_of') {
      st.needItems = (w.items || []).slice();
      st.needCount = w.need || st.needItems.length;
    }
    if (a === 'drag_stack') {
      st.need = w.order || [];
    }
    if (a === 'drag_puzzle') {
      st.needCount = w.pieces || 4;
    }
    if (a === 'drag_reveal_then_tap_diffs') {
      st.needCount = w.count || 2;
    }
    return st;
  };

  WinCtrl.prototype._success = function () {
    if (this.done) return;
    this.done = true;
    if (this.hooks.onWin) this.hooks.onWin();
  };

  WinCtrl.prototype._fail = function (msg) {
    if (this.done) return;
    if (this.hooks.onFail) this.hooks.onFail(msg || this.level.failToast || '再试试');
  };

  WinCtrl.prototype._idMatch = function (entityId, want) {
    if (!want) return false;
    if (entityId === want) return true;
    var e = this.scene.find(entityId);
    if (e && e.meta && e.meta.aliasOf === want) return true;
    if (e && e.meta && e.meta.stepId === want) return true;
    // sequence steps like tap_dogfood
    if (want.indexOf('tap_') === 0 && entityId === want.slice(4)) return true;
    if (want === 'drag_to_dog' && entityId === 'dog') return true;
    if (want === 'tap_ring' && entityId === 'ring') return true;
    if (want === 'tap_dogfood' && (entityId === 'dogfood' || entityId === 'food')) return true;
    return false;
  };

  WinCtrl.prototype.onTap = function (entity, x, y, extra) {
    if (this.done) return;
    var a = this.action;
    var w = this.win;
    var id = entity ? entity.id : null;
    extra = extra || {};

    // title word / title text handled by play scene via synthetic entity
    if (id && id.indexOf('title_word:') === 0) {
      if (w.target === id || (typeof w.target === 'string' && w.target === id)) {
        this._success();
        return;
      }
      if (a === 'drag_combine_or_tap' && id.indexOf('title_word:') === 0) {
        this._success();
        return;
      }
    }
    if (id === 'title_text' && (w.target === 'title_text' || a === 'tap' && w.target === 'title_text')) {
      this._success();
      return;
    }

    if (a === 'tap') {
      if (entity && this._idMatch(id, w.target)) this._success();
      else if (entity) this._fail();
      return;
    }

    if (a === 'multi_tap') {
      var need = this.state.need[this.state.seqIdx];
      if (entity && this._idMatch(id, need)) {
        if (entity.meta && entity.meta.covers) {
          var hid = this.scene.find(entity.meta.covers);
          if (hid) hid.visible = true;
          entity.visible = false;
        }
        this.state.seqIdx++;
        if (this.state.seqIdx >= this.state.need.length) this._success();
      } else if (entity) this._fail();
      return;
    }

    if (a === 'tap_sequence' || a === 'sequence') {
      // sequence may mix tap and drag steps — taps only advance tap_* steps
      var step = this.state.need[this.state.seqIdx];
      if (typeof step === 'string') {
        if (step.indexOf('drag') >= 0) {
          this._fail('先按提示拖一下');
          return;
        }
        if (entity && this._idMatch(id, step)) {
          if (id === 'dogfood') {
            entity.meta = entity.meta || {};
            entity.meta.opened = true;
            entity.label = '开罐粮';
          }
          if (id === 'ring') this._success();
          else {
            this.state.seqIdx++;
            if (this.state.seqIdx >= this.state.need.length) this._success();
            // reveal ring after feeding implied
            if (step.indexOf('dog') >= 0 || this.state.seqIdx >= 2) {
              var ring = this.scene.find('ring');
              if (ring) ring.visible = true;
            }
          }
        } else if (entity) this._fail();
      }
      return;
    }

    if (a === 'drag_then_tap') {
      var movedOk = this.state.moved[w.move] || this.state.dragged[w.from + '>' + (w.to || '')];
      if (w.move && !this.state.moved[w.move] && !movedOk) {
        // allow tap only after move
        if (entity && entity.id === w.move) {
          // ignore
        } else if (entity) this._fail('先挪开遮挡');
        return;
      }
      if (w.from && w.to && !this.state.dragged[w.from + '>' + w.to] && !this.state.dragged[w.from + '>' + (w.to || '')]) {
        if (!movedOk && w.then) {
          /* wait */
        }
      }
      var tapTarget = w.tap || w.then;
      if (w.move) {
        var moved = this.scene.find(w.move);
        if (moved && !this.state.moved[w.move]) {
          if (entity) this._fail('先拖开中间的');
          return;
        }
        var bitten = this.scene.find(w.tap);
        if (bitten) bitten.visible = true;
      }
      if (entity && this._idMatch(id, tapTarget)) this._success();
      else if (entity && w.then && this.state.dragged[w.from + '>' + w.to] && this._idMatch(id, w.then)) this._success();
      else if (entity) this._fail();
      return;
    }

    if (a === 'drag_probe_then_tap') {
      if (!this.state.probed) {
        if (entity) this._fail('先用肉试探');
        return;
      }
      if (entity && this._idMatch(id, w.tap)) this._success();
      else if (entity) this._fail();
      return;
    }

    if (a === 'reveal_then_count' || a === 'input_or_tap_answer' || a === 'tap_or_input' || a === 'drag_apart_then_answer') {
      if (a === 'reveal_then_count' && w.hide) {
        var leaf = this.scene.find(w.hide);
        if (leaf && leaf.visible && !this.state.revealed) {
          // still allow answer if they counted; but prefer reveal
        }
      }
      if (entity && entity.meta && entity.meta.answerValue != null) {
        if (entity.meta.answerValue === w.answer) this._success();
        else this._fail();
      } else if (entity && /^answer_/.test(id)) {
        if (parseInt(id.replace('answer_', ''), 10) === w.answer) this._success();
        else this._fail();
      }
      return;
    }

    if (a === 'tap_all' || a === 'tap_all_diffs') {
      if (!entity) return;
      if (this.state.tapped[id]) return;
      var ok = true;
      if (this.state.needTargets && this.state.needTargets.indexOf(id) < 0) ok = false;
      if (a === 'tap_all_diffs' && id.indexOf('diff_') !== 0) ok = false;
      if (!ok) {
        this._fail();
        return;
      }
      this.state.tapped[id] = true;
      var count = Object.keys(this.state.tapped).length;
      if (count >= this.state.needCount) this._success();
      return;
    }

    if (a === 'drag_then_tap_all') {
      if (!this.state.moved[w.move] && !(w.from && this.state.dragged[w.from + '>' + w.to])) {
        if (entity) this._fail('先拨开遮挡');
        return;
      }
      if (!entity) return;
      if (this.state.tapped[id]) return;
      this.state.tapped[id] = true;
      if (Object.keys(this.state.tapped).length >= (this.state.needCount || 1)) this._success();
      return;
    }

    if (a === 'drag_reveal_then_tap' || a === 'drag_offscreen_then_tap' || a === 'drag_crack_then_tap') {
      var ready =
        this.state.revealed ||
        this.state.moved[w.move] ||
        this.state.moved[w.targets] ||
        Object.keys(this.state.moved).length > 0 ||
        this.state.dragged_off;
      if (!ready && a !== 'drag_crack_then_tap') {
        // crack: allow tap after any egg drag
        if (entity) this._fail('先拖一拖看');
        return;
      }
      if (a === 'drag_crack_then_tap' && Object.keys(this.state.moved).length === 0 && !this.state.revealed) {
        if (entity) this._fail('先拖动鸡蛋');
        return;
      }
      if (entity && this._idMatch(id, w.tap)) this._success();
      else if (entity) this._fail();
      return;
    }

    if (a === 'drag_merge_then_tap') {
      if (!this.state.merged) {
        if (entity) this._fail('先合并火堆');
        return;
      }
      if (entity && (this._idMatch(id, w.mergeTo) || id === 'top_left_fire' || /fire/.test(id))) this._success();
      else if (entity) this._fail();
      return;
    }

    if (a === 'drag_reveal_then_tap_diffs') {
      if (Object.keys(this.state.moved).length === 0 && !this.state.revealed) {
        if (entity) this._fail('先移开遮挡');
        return;
      }
      if (!entity || entity.id.indexOf('diff_') !== 0) {
        if (entity) this._fail();
        return;
      }
      this.state.tapped[id] = true;
      if (Object.keys(this.state.tapped).length >= this.state.needCount) this._success();
      return;
    }

    if (a === 'swipe_reveal_then_tap' || a === 'tap_or_drag_stars') {
      if (!entity) return;
      if (/^(coin_|star_)/.test(id) || /star|coin/.test(id)) {
        this.state.tapped[id] = true;
        if (Object.keys(this.state.tapped).length >= this.state.needCount) this._success();
      }
      return;
    }

    if (a === 'device_rotate_or_tap') {
      // tap level number 8 path
      if (entity && (id === 'digit_8' || id.indexOf('8') >= 0 || (extra && extra.levelNumTap))) {
        this._success();
        return;
      }
      if (entity) this._fail();
      return;
    }

    if (a === 'drag_combine_or_tap') {
      // tap heart in title handled above; scene tap on combined later
      if (entity && /heart|爱心/.test(entity.label)) this._success();
      return;
    }

    if (a === 'tap_then_drag' || a === 'tap_then_reach') {
      if (entity && this._idMatch(id, w.pick || w.open)) {
        this.state.tapped[id] = true;
        if (w.open && id === w.open) {
          var cake = this.scene.find(w.then_tap || 'cake');
          if (cake) {
            cake.y += 40;
            cake.meta = cake.meta || {};
            cake.meta.reachable = true;
          }
        }
        return;
      }
      if (a === 'tap_then_reach' && entity && this._idMatch(id, w.then_tap) && this.state.tapped[w.open]) {
        this._success();
        return;
      }
      if (entity) this._fail();
      return;
    }

    if (a === 'pinch_zoom_out') {
      if (this.state.pinchDone && entity && this._idMatch(id, w.then_tap)) this._success();
      else if (entity) this._fail('先缩小画面');
      return;
    }

    if (a === 'long_press') {
      // completed in onLongPress
      return;
    }

    if (a === 'two_finger_tap') {
      if (extra.fingers >= 2 && entity && this._idMatch(id, w.target)) this._success();
      else if (entity) this._fail('试试两根手指');
      return;
    }

    if (a === 'clear_then_drag') {
      // taps not primary
      return;
    }

    // default: wrong tap soft fail
    if (entity && !/drag|shake|wait|rotate|pinch|mute|stack|puzzle|arrange|offscreen|off\b/.test(a)) {
      // ignore
    }
  };

  WinCtrl.prototype.onDragEnd = function (fromEnt, toEnt, fromId, x, y) {
    if (this.done || !fromEnt) return;
    var a = this.action;
    var w = this.win;
    var fid = fromEnt.id;
    var tid = toEnt ? toEnt.id : null;
    var key = fid + '>' + (tid || '');

    // offscreen?
    var area = this.scene.area;
    var off =
      fromEnt.x + fromEnt.w < area.x - 10 ||
      fromEnt.x > area.x + area.w + 10 ||
      fromEnt.y + fromEnt.h < area.y - 40 ||
      fromEnt.y > area.y + area.h + 40;

    if (a === 'drag' || a === 'drag_combine_or_tap') {
      var fromOk = this._idMatch(fid, w.from) || fid === w.from;
      var toOk = toEnt && (this._idMatch(tid, w.to) || tid === w.to);
      if (fromOk && toOk) {
        if (w.all) {
          fromEnt.visible = false;
          this.state.dragged[key] = true;
          // if multiple fruits, require all aliases gone
          var left = this.scene.findAll(function (e) {
            return e.visible && (e.id === w.from || (e.meta && e.meta.aliasOf === w.from));
          });
          if (left.length === 0) this._success();
          else Game.FX && Game.FX.toast('还有果子');
        } else {
          this._success();
        }
        return;
      }
      // unconventional drag variants using same action name
      if (a === 'drag' && fromOk && toOk) this._success();
      else if (toEnt) this._fail();
      return;
    }

    if (a === 'drag_offscreen' || a === 'drag_off') {
      if (this._idMatch(fid, w.target) && off) {
        fromEnt.visible = false;
        this.state.dragged_off = true;
        if (w.reveal) {
          var rev = this.scene.find(w.reveal);
          if (rev) rev.visible = true;
        }
        if (a === 'drag_off' && w.then_drag) {
          var stone = this.scene.find(w.then_drag);
          if (stone) stone.draggable = true;
          this.state.moved[fid] = true;
          return;
        }
        this._success();
        return;
      }
      if (a === 'drag_off' && this.state.moved[w.target] && this._idMatch(fid, w.then_drag)) {
        this._success();
        return;
      }
      return;
    }

    if (a === 'drag_offscreen_then_tap') {
      if (this._idMatch(fid, w.move) && off) {
        fromEnt.visible = false;
        this.state.moved[w.move] = true;
        this.state.dragged_off = true;
        var owl = this.scene.find(w.tap);
        if (owl) owl.label = '🦉醒来';
      }
      return;
    }

    if (a === 'drag_then_tap') {
      if (w.move && this._idMatch(fid, w.move)) {
        this.state.moved[w.move] = true;
        var bitten = this.scene.find(w.tap);
        if (bitten) bitten.visible = true;
        fromEnt.x = Math.min(fromEnt.x, area.x + 10);
        return;
      }
      if (w.from && w.to && this._idMatch(fid, w.from) && toEnt && this._idMatch(tid, w.to)) {
        this.state.dragged[w.from + '>' + w.to] = true;
        return;
      }
      return;
    }

    if (a === 'drag_probe_then_tap') {
      if (this._idMatch(fid, w.probe) && toEnt && (toEnt.meta && toEnt.meta.sheep || /sheep|wolf/.test(tid))) {
        this.state.probed = true;
        if (toEnt.meta && toEnt.meta.wolf) {
          toEnt.label = '🐺狼';
          toEnt.color = '#666';
        }
        Game.FX && Game.FX.toast('有反应！');
      }
      return;
    }

    if (a === 'reveal_then_count') {
      if (this._idMatch(fid, w.hide)) {
        fromEnt.visible = false;
        this.state.revealed = true;
      }
      return;
    }

    if (a === 'drag_sequence') {
      var step = this.state.need[this.state.seqIdx];
      if (!step) return;
      var okFrom = this._idMatch(fid, step.from) || (fromEnt.meta && fromEnt.meta.aliasOf === step.from);
      var okTo =
        step.to === 'each_other'
          ? toEnt && (toEnt.id === fid || (toEnt.meta && toEnt.meta.aliasOf === step.from) || /log/.test(toEnt.id))
          : toEnt && this._idMatch(tid, step.to);
      // allow drop on bundled_logs after first step creates it
      if (step.to === 'bundled_logs' && !this.scene.find('bundled_logs').visible) {
        // first create bundle from logs together
      }
      if (okFrom && (okTo || (step.to === 'each_other' && toEnt))) {
        this.state.seqIdx++;
        if (step.to === 'each_other') {
          var bundled = this.scene.find('bundled_logs');
          if (bundled) bundled.visible = true;
        }
        if (this.state.seqIdx >= this.state.need.length) this._success();
        else Game.FX && Game.FX.toast('下一步…');
      } else if (toEnt) this._fail();
      return;
    }

    if (a === 'sequence') {
      var s = this.state.need[this.state.seqIdx];
      if (typeof s === 'string' && s.indexOf('drag') >= 0) {
        if (toEnt && (this._idMatch(tid, 'dog') || tid === 'dog')) {
          this.state.seqIdx++;
          var ring = this.scene.find('ring');
          if (ring) ring.visible = true;
          if (this.state.seqIdx >= this.state.need.length) this._success();
        }
      }
      return;
    }

    if (a === 'drag_then_tap_all') {
      if (w.move && this._idMatch(fid, w.move)) {
        this.state.moved[w.move] = true;
        fromEnt.visible = false;
      }
      if (w.from && w.to && this._idMatch(fid, w.from) && toEnt && this._idMatch(tid, w.to)) {
        this.state.dragged[w.from + '>' + w.to] = true;
      }
      return;
    }

    if (a === 'drag_merge_then_tap') {
      if (toEnt && /fire/.test(fid) && /fire/.test(tid)) {
        fromEnt.visible = false;
        toEnt.w += 10;
        toEnt.h += 10;
        toEnt.label = '🔥大';
        this.state.merged = true;
      }
      return;
    }

    if (a === 'drag_reveal_then_tap' || a === 'drag_crack_then_tap' || a === 'drag_reveal_then_tap_diffs') {
      this.state.moved[fid] = true;
      this.state.revealed = true;
      if (w.tap) {
        var t = this.scene.find(w.tap);
        if (t) t.visible = true;
      }
      return;
    }

    if (a === 'drag_all' || a === 'drag_any_of') {
      if (toEnt && this._idMatch(tid, w.to) && w.items && w.items.indexOf(fid) >= 0) {
        fromEnt.visible = false;
        this.state.tapped[fid] = true;
        if (Object.keys(this.state.tapped).length >= this.state.needCount) this._success();
      }
      return;
    }

    if (a === 'drag_stack') {
      var order = this.state.need;
      var expect = order[this.state.stacked.length];
      if (this._idMatch(fid, expect)) {
        // drop near previous or base
        this.state.stacked.push(fid);
        if (this.state.stacked.length >= order.length) this._success();
      } else this._fail('按从大到小叠');
      return;
    }

    if (a === 'drag_puzzle') {
      if (toEnt && toEnt.id === 'puzzle_board' && /^piece_/.test(fid)) {
        fromEnt.visible = false;
        this.state.puzzleOk++;
        if (this.state.puzzleOk >= this.state.needCount) this._success();
      }
      return;
    }

    if (a === 'tap_then_drag') {
      if (!this.state.tapped[w.pick] && !this.state.tapped['key_on_hook']) {
        this._fail('先拿钥匙');
        // snap back
        fromEnt.x = fromEnt.ox;
        fromEnt.y = fromEnt.oy;
        return;
      }
      if (this._idMatch(fid, w.pick) && toEnt && this._idMatch(tid, w.to)) this._success();
      return;
    }

    if (a === 'clear_then_drag') {
      if (w.clear && w.clear.indexOf(fid) >= 0) {
        fromEnt.visible = false;
        this.state.cleared[fid] = true;
        return;
      }
      var allCleared = (w.clear || []).every(
        function (c) {
          return this.state.cleared[c] || (this.scene.find(c) && !this.scene.find(c).visible);
        }.bind(this)
      );
      // also treat missing clear targets as cleared
      allCleared =
        allCleared ||
        (w.clear || []).every(
          function (c) {
            var e = this.scene.find(c);
            return !e || !e.visible || this.state.cleared[c];
          }.bind(this)
        );
      if (!allCleared) {
        var left = (w.clear || []).filter(
          function (c) {
            var e = this.scene.find(c);
            return e && e.visible && !this.state.cleared[c];
          }.bind(this)
        );
        if (left.length) {
          this._fail('先清开路');
          fromEnt.x = fromEnt.ox;
          fromEnt.y = fromEnt.oy;
          return;
        }
      }
      if (this._idMatch(fid, w.from) && toEnt && this._idMatch(tid, w.to)) this._success();
      return;
    }

    if (a === 'pinch_then_drag') {
      if (!this.state.pinchDone) {
        this._fail('先捏合缩小');
        fromEnt.x = fromEnt.ox;
        fromEnt.y = fromEnt.oy;
        return;
      }
      if (this._idMatch(fid, w.target) && toEnt && this._idMatch(tid, w.to)) this._success();
      return;
    }

    if (a === 'drag_arrange') {
      // any drag of matches that ends near each other → success simplified
      this.state.moved[fid] = true;
      if (Object.keys(this.state.moved).length >= 2) this._success();
      return;
    }

    if (a === 'drag_apart_then_answer') {
      this.state.moved[fid] = true;
      this.state.revealed = true;
      return;
    }

    if (a === 'mute_or_volume_down') {
      if (fid === 'volume_icon' && (off || (toEnt && /mute|down/.test(tid)) || fromEnt.y > fromEnt.oy + 40)) {
        this.state.muted = true;
        fromEnt.label = '🔇';
        this._success();
      }
      return;
    }

    if (a === 'tap_or_drag_stars') {
      if (toEnt && this._idMatch(tid, w.to) && /star/.test(fid)) {
        this.state.tapped[fid] = true;
        if (Object.keys(this.state.tapped).length >= this.state.needCount) this._success();
      }
      return;
    }

    if (a === 'swipe_reveal_then_tap') {
      this.state.revealed = true;
      return;
    }

    // unconventional plain drag (lv_023 etc.)
    if (a === 'drag' && w.from && w.to) {
      /* handled */
    }
  };

  WinCtrl.prototype.onShake = function (dt) {
    if (this.done) return;
    if (this.action !== 'shake') return;
    this.state.shakeAcc += dt * 1000;
    if (this.state.shakeAcc >= (this.win.durationMs || 1500)) this._success();
  };

  WinCtrl.prototype.onDeviceRotate = function (orientation) {
    if (this.done) return;
    var a = this.action;
    if (a === 'device_rotate' || a === 'device_rotate_or_tap' || a === 'pinch_rotate') {
      if (!this.win.orientation || orientation === this.win.orientation || orientation === 'upside_down') {
        this._success();
      }
    }
  };

  WinCtrl.prototype.onPinch = function (scale, rotation) {
    if (this.done) return;
    var a = this.action;
    if (a === 'pinch_zoom_out' && scale < 0.85) {
      this.state.pinchDone = true;
      var hen = this.scene.find(this.win.then_tap || 'hen');
      if (hen) hen.visible = true;
      else {
        // create hen at edge
        this.scene.entities.push({
          id: this.win.then_tap || 'hen',
          x: 10,
          y: this.scene.area.y + 40,
          w: 50,
          h: 50,
          label: '🐔',
          color: '#E8B84A',
          visible: true,
          tappable: true,
          draggable: false,
          z: 2,
          meta: {},
          ox: 10,
          oy: this.scene.area.y + 40
        });
      }
      Game.FX && Game.FX.toast('边缘有东西');
    }
    if (a === 'pinch_then_drag' && scale < 0.85) {
      this.state.pinchDone = true;
      var box = this.scene.find(this.win.target);
      if (box) {
        box.w *= 0.6;
        box.h *= 0.6;
        box.label = '小箱';
      }
    }
    if (a === 'pinch_rotate' && Math.abs(rotation) > 1.2) {
      this._success();
    }
    if (a === 'two_finger_tap' && scale < 0.9) {
      // pinch as alternate
      this._success();
    }
  };

  WinCtrl.prototype.onLongPress = function (entity, ms) {
    if (this.done) return;
    if (this.action !== 'long_press') return;
    var need = this.win.durationMs || 3000;
    if (entity && this._idMatch(entity.id, this.win.target) && ms >= need) this._success();
    // special: hint_button is UI — play scene passes synthetic
    if (this.win.target === 'hint_button' && entity && entity.id === 'hint_button' && ms >= need) this._success();
  };

  WinCtrl.prototype.onWaitTick = function (dt, touching) {
    if (this.done) return;
    if (this.action !== 'wait') return;
    if (touching) {
      this.state.waitAcc = 0;
      return;
    }
    this.state.waitAcc += dt * 1000;
    if (this.state.waitAcc >= (this.win.durationMs || 15000)) this._success();
  };

  WinCtrl.prototype.getHint = function () {
    var steps = this.level.hintSteps || [];
    if (!steps.length) return '仔细观察场景与题干';
    var i = Math.min(this.hintStep, steps.length - 1);
    this.hintStep = Math.min(this.hintStep + 1, steps.length - 1);
    return steps[i];
  };

  WinCtrl.prototype.progressText = function () {
    if (this.action === 'wait') {
      var need = this.win.durationMs || 15000;
      return Math.min(100, Math.floor((this.state.waitAcc / need) * 100)) + '%';
    }
    if (this.action === 'shake') {
      var n = this.win.durationMs || 1500;
      return Math.min(100, Math.floor((this.state.shakeAcc / n) * 100)) + '%';
    }
    return '';
  };

  Game.WinCtrl = WinCtrl;
})();
