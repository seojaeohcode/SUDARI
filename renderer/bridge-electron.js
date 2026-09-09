/* Electron용 브리지 — 플랫폼 의존 입출력을 pet.js에서 격리한다. */
(function (global) {
  'use strict';
  var api = global.sudariAPI;
  if (!api) return;                       // 웹 데모에서는 web 브리지가 대신 붙는다

  var pos = { x: 0, y: 0 };
  var wa = { x: 0, y: 0, width: 1920, height: 1080 };
  var cur = { x: -99999, y: -99999 };
  var handlers = { key: [], wheel: [], agent: [], command: [], config: [] };

  api.onState(function (s) {
    if (s.bounds) { pos.x = s.bounds.x; pos.y = s.bounds.y; }
    if (s.workArea) wa = s.workArea;
  });
  api.onCursor(function (c) { cur.x = c.x; cur.y = c.y; });
  api.onKey(function () { handlers.key.forEach(function (h) { h(); }); });
  api.onWheel(function (d) { handlers.wheel.forEach(function (h) { h(d); }); });
  api.onAgent(function (m) { handlers.agent.forEach(function (h) { h(m); }); });
  // 펫이 아직 부팅 중(스프라이트 로딩)일 때 온 명령은 버리지 않고 모아두다가 첫 핸들러에 흘려준다
  var pendingCommands = [];
  api.onCommand(function (c, a) {
    if (!handlers.command.length) { pendingCommands.push([c, a]); return; }
    handlers.command.forEach(function (h) { h(c, a); });
  });
  api.onConfig(function (c) { handlers.config.forEach(function (h) { h(c); }); });

  global.Sudari = global.Sudari || {};
  global.Sudari.bridge = {
    isElectron: true,
    onKey: function (cb) { handlers.key.push(cb); },
    onWheel: function (cb) { handlers.wheel.push(cb); },
    onAgent: function (cb) { handlers.agent.push(cb); },
    onCommand: function (cb) {
      handlers.command.push(cb);
      var q = pendingCommands; pendingCommands = [];
      q.forEach(function (p) { cb(p[0], p[1]); });
    },
    onConfig: function (cb) { handlers.config.push(cb); },
    getConfig: function () { return api.getConfig(); },
    saveConfig: function (c) { api.saveConfig(c); },
    cursorGlobal: function () { return cur; },
    cursorLocal: function () { return { x: cur.x - pos.x, y: cur.y - pos.y }; },
    petPos: function () { return pos; },
    movePet: function (x, y) {
      pos.x = Math.round(x); pos.y = Math.round(y);
      api.movePet(pos.x, pos.y);
    },
    workArea: function () { return wa; },
    setInteractive: function (b) { api.setInteractive(b); },
    contextMenu: function () { api.contextMenu(); }
  };
})(window);
