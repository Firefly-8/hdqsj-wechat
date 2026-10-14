/**
 * 轻量埋点：console + 可扩展队列；若配置了 reportAnalytics 则尝试上报
 */
(function () {
  'use strict';

  var queue = [];
  var Analytics = {};

  Analytics.log = function (event, payload) {
    var row = {
      t: Date.now(),
      e: event,
      p: payload || {}
    };
    queue.push(row);
    if (queue.length > 200) queue.shift();
    try {
      console.log('[analytics]', event, payload || {});
    } catch (e) {}
    try {
      if (typeof wx !== 'undefined' && wx.reportAnalytics) {
        wx.reportAnalytics(event, payload || {});
      }
    } catch (e2) {}
  };

  Analytics.dump = function () {
    return queue.slice();
  };

  Game.Analytics = Analytics;
})();
