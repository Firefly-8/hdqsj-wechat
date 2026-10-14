/**
 * 关卡加载：主包 pack0（lv_001–020），分包 levels_pack1（lv_021–100）
 */
(function () {
  'use strict';

  var Loader = {
    pack0: null,
    pack1: null,
    pack1Loading: false,
    pack1Error: null,
    all: []
  };

  function safeRequire(path) {
    try {
      return require(path);
    } catch (e) {
      console.warn('require fail', path, e);
      return null;
    }
  }

  function readJson(path) {
    try {
      if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
        var fs = wx.getFileSystemManager();
        var txt = fs.readFileSync(path, 'utf8');
        return JSON.parse(txt);
      }
    } catch (e) {
      console.warn('readJson fail', path, e);
    }
    return null;
  }

  function loadPackModule(jsPath, jsonPath) {
    var mod = safeRequire(jsPath);
    if (mod && mod.levels) return mod;
    var j = readJson(jsonPath);
    if (j && j.levels) return j;
    return null;
  }

  function rebuildAll() {
    var list = [];
    if (Loader.pack0 && Loader.pack0.levels) {
      list = list.concat(Loader.pack0.levels);
    }
    if (Loader.pack1 && Loader.pack1.levels) {
      list = list.concat(Loader.pack1.levels);
    }
    Loader.all = list;
  }

  Loader.initPack0 = function () {
    var c = Game.Config;
    Loader.pack0 = loadPackModule(c.PACK0_PATH, c.PACK0_JSON || 'levels/pack0.json');
    if (!Loader.pack0) {
      console.error('主包关卡加载失败');
      Loader.pack0 = { levels: [] };
    }
    rebuildAll();
    return Loader.pack0;
  };

  Loader.ensurePack1 = function (cb) {
    cb = cb || function () {};
    if (Loader.pack1 && Loader.pack1.levels) {
      cb(null, Loader.pack1);
      return;
    }
    if (Loader.pack1Loading) {
      var wait = setInterval(function () {
        if (!Loader.pack1Loading) {
          clearInterval(wait);
          cb(Loader.pack1Error, Loader.pack1);
        }
      }, 50);
      return;
    }

    var c = Game.Config;
    Loader.pack1Loading = true;
    Loader.pack1Error = null;

    function finishOk(pack) {
      Loader.pack1 = pack;
      Loader.pack1Loading = false;
      rebuildAll();
      Game.Analytics && Game.Analytics.log('pack1_loaded', { n: pack.levels.length });
      cb(null, pack);
    }

    function finishFail(err) {
      // 开发环境 / 无分包：尝试直接 require 同仓路径
      var local = loadPackModule(c.PACK1_PATH, c.PACK1_JSON || 'levels_pack1/levels/pack1.json');
      if (local && local.levels) {
        finishOk(local);
        return;
      }
      Loader.pack1Loading = false;
      Loader.pack1Error = err || new Error('pack1 load fail');
      console.error('分包关卡加载失败', Loader.pack1Error);
      cb(Loader.pack1Error, null);
    }

    if (typeof wx !== 'undefined' && wx.loadSubpackage) {
      wx.loadSubpackage({
        name: c.SUBPACKAGE_PACK1,
        success: function () {
          var pack = loadPackModule(c.PACK1_PATH, c.PACK1_JSON || 'levels_pack1/levels/pack1.json');
          if (pack && pack.levels) finishOk(pack);
          else finishFail(new Error('pack1 empty after subpackage'));
        },
        fail: function (err) {
          finishFail(err);
        }
      });
    } else {
      finishFail(new Error('no loadSubpackage'));
    }
  };

  Loader.getByIndex = function (index) {
    if (index < 0) return null;
    if (Loader.all[index]) return Loader.all[index];
    return null;
  };

  Loader.getById = function (id) {
    for (var i = 0; i < Loader.all.length; i++) {
      if (Loader.all[i].id === id) return Loader.all[i];
    }
    return null;
  };

  Loader.count = function () {
    return Loader.all.length;
  };

  Loader.pack0Count = function () {
    return (Loader.pack0 && Loader.pack0.levels && Loader.pack0.levels.length) || 0;
  };

  /**
   * 确保 index 对应关卡已加载（跨分包时自动拉 pack1）
   */
  Loader.ensureIndex = function (index, cb) {
    cb = cb || function () {};
    if (Loader.all[index]) {
      cb(null, Loader.all[index]);
      return;
    }
    if (index < Loader.pack0Count()) {
      cb(new Error('missing pack0 level'), null);
      return;
    }
    Loader.ensurePack1(function (err) {
      if (err) {
        cb(err, null);
        return;
      }
      cb(null, Loader.all[index] || null);
    });
  };

  Game.LevelLoader = Loader;
})();
