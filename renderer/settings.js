/* 설정 창 — 입력을 바꾸면 즉시 저장되고 펫에 반영된다. 미리보기는 실제 스프라이트. */
(function () {
  'use strict';
  var api = window.sudariAPI;
  var S = window.Sudari;
  var cfg = null;
  var sprite = null;

  var PRESETS = [
    ['#925f3f', '강수달 (기본)'],
    ['#6b4a3c', '진갈색수달'],
    ['#4a3b36', '검은수달'],
    ['#c48a52', '금빛수달'],
    ['#8d8a86', '회색수달'],
    ['#e6dccb', '흰수달'],
    ['#d9a3ad', '분홍수달'],
    ['#7fa6a3', '민트수달']
  ];

  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------ 미리보기
  var prev = { anim: 'idle', frame: 0, t: 0, gaze: [0, 0], lid: 0, next: 2 };

  function loadSprite() {
    return S.Sprite.load('../assets', cfg.pattern, window.SUDARI_ATLAS, window.SUDARI_PALETTE)
      .then(function (s) {
        sprite = s;
        sprite.recolor(S.derivePalette(cfg.baseColor));
      });
  }

  function drawPreview(dt) {
    if (!sprite) return;
    var c = $('prev'), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    var a = sprite.anim(prev.anim);
    prev.t += dt;
    while (prev.t >= 1 / a.fps) { prev.t -= 1 / a.fps; prev.frame = (prev.frame + 1) % a.count; }
    prev.next -= dt;
    if (prev.next <= 0) { prev.lid = 1; prev.next = 2 + Math.random() * 3; }
    else if (prev.next < 1.87) { prev.lid = 0; }

    sprite.begin();
    sprite.blitFrame(prev.anim, prev.frame);
    sprite.drawEyes(prev.anim, prev.frame, { gaze: prev.gaze, lid: prev.lid });
    var sc = 2;
    sprite.present(ctx, (c.width - sprite.W * sc) / 2, c.height - sprite.H * sc + 15 * sc, sc, false);
  }

  var last = performance.now();
  function loop() {
    var t = performance.now();
    drawPreview(Math.min(0.05, (t - last) / 1000));
    last = t;
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ 바인딩
  function save(patch) {
    cfg = Object.assign({}, cfg, patch || {});
    api.saveConfig(cfg);
  }

  function bindText(id, get, set) {
    var el = $(id);
    el.value = get();
    el.addEventListener('input', function () { set(el.value); });
  }

  function bindNum(id, get, set) {
    var el = $(id);
    el.value = get();
    el.addEventListener('change', function () {
      var v = parseFloat(el.value);
      if (!isNaN(v)) set(v);
    });
  }

  function bindCheck(id, get, set) {
    var el = $(id);
    el.checked = !!get();
    el.addEventListener('change', function () { set(el.checked); });
  }

  function renderSwatches() {
    var box = $('swatches');
    box.innerHTML = '';
    PRESETS.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'sw' + (p[0].toLowerCase() === (cfg.baseColor || '').toLowerCase() ? ' on' : '');
      d.style.background = p[0];
      d.title = p[1];
      d.addEventListener('click', function () {
        cfg.baseColor = p[0];
        $('baseColor').value = p[0];
        save({ baseColor: p[0] });
        sprite.recolor(S.derivePalette(p[0]));
        renderSwatches();
      });
      box.appendChild(d);
    });
  }

  function renderReminders() {
    var box = $('reminders');
    box.innerHTML = '';
    (cfg.reminders || []).forEach(function (r, i) {
      var row = document.createElement('div');
      row.className = 'rem';
      var t = document.createElement('input'); t.type = 'time'; t.value = r.time || '';
      var m = document.createElement('input'); m.type = 'text'; m.value = r.msg || '';
      var del = document.createElement('button'); del.textContent = '삭제';
      t.addEventListener('change', function () { cfg.reminders[i].time = t.value; save(); });
      m.addEventListener('input', function () { cfg.reminders[i].msg = m.value; save(); });
      del.addEventListener('click', function () {
        cfg.reminders.splice(i, 1);
        save();
        renderReminders();
      });
      row.appendChild(t); row.appendChild(m); row.appendChild(del);
      box.appendChild(row);
    });
  }

  function bindAll() {
    bindText('name', function () { return cfg.name || ''; }, function (v) { save({ name: v }); });
    bindText('pin', function () { return cfg.pin || ''; }, function (v) { save({ pin: v }); });

    var col = $('baseColor');
    col.value = cfg.baseColor;
    col.addEventListener('input', function () {
      cfg.baseColor = col.value;
      save({ baseColor: col.value });
      if (sprite) sprite.recolor(S.derivePalette(col.value));
      renderSwatches();
    });

    var pat = $('pattern');
    pat.value = cfg.pattern;
    pat.addEventListener('change', function () {
      cfg.pattern = pat.value;
      save({ pattern: pat.value });
      loadSprite();
    });

    var sc = $('scale');
    sc.value = String(cfg.scale);
    sc.addEventListener('change', function () { save({ scale: parseInt(sc.value, 10) }); });

    bindCheck('r-mouse', function () { return cfg.reactions.mouse; },
      function (v) { cfg.reactions.mouse = v; save(); });
    bindCheck('r-keyboard', function () { return cfg.reactions.keyboard; },
      function (v) { cfg.reactions.keyboard = v; save(); });
    bindCheck('r-scroll', function () { return cfg.reactions.scroll; },
      function (v) { cfg.reactions.scroll = v; save(); });
    bindCheck('r-pet', function () { return cfg.reactions.pet; },
      function (v) { cfg.reactions.pet = v; save(); });

    var vol = $('volume');
    vol.value = cfg.volume;
    vol.addEventListener('input', function () { save({ volume: parseFloat(vol.value) }); });
    bindCheck('muted', function () { return cfg.muted; }, function (v) { save({ muted: v }); });
    bindNum('sleepAfterMin', function () { return cfg.sleepAfterMin; },
      function (v) { save({ sleepAfterMin: v }); });

    bindCheck('stretch-on', function () { return cfg.stretch.on; },
      function (v) { cfg.stretch.on = v; save(); });
    bindNum('stretch-min', function () { return cfg.stretch.everyMin; },
      function (v) { cfg.stretch.everyMin = v; save(); });
    bindCheck('water-on', function () { return cfg.water.on; },
      function (v) { cfg.water.on = v; save(); });
    bindNum('water-min', function () { return cfg.water.everyMin; },
      function (v) { cfg.water.everyMin = v; save(); });

    bindCheck('pomo-on', function () { return cfg.pomodoro.on; },
      function (v) { cfg.pomodoro.on = v; save(); });
    bindNum('pomo-focus', function () { return cfg.pomodoro.focusMin; },
      function (v) { cfg.pomodoro.focusMin = v; save(); });
    bindNum('pomo-break', function () { return cfg.pomodoro.breakMin; },
      function (v) { cfg.pomodoro.breakMin = v; save(); });
    bindNum('pomo-rounds', function () { return cfg.pomodoro.rounds; },
      function (v) { cfg.pomodoro.rounds = v; save(); });

    ['breakfast', 'lunch', 'dinner'].forEach(function (k) {
      var el = $('meal-' + k);
      cfg.meals = cfg.meals || {};
      el.value = cfg.meals[k] || '';
      el.addEventListener('change', function () { cfg.meals[k] = el.value; save(); });
    });
    bindCheck('aff-on', function () { return cfg.affection.on; },
      function (v) { cfg.affection.on = v; save(); });
    bindNum('aff-min', function () { return cfg.affection.everyMin; },
      function (v) { cfg.affection.everyMin = v; save(); });
    bindCheck('ambient-on', function () { return cfg.ambient.on; },
      function (v) { cfg.ambient.on = v; save(); });

    bindCheck('launchAtLogin', function () { return cfg.launchAtLogin; },
      function (v) { save({ launchAtLogin: v }); });
    bindCheck('peek', function () { return cfg.peek; }, function (v) { save({ peek: v }); });

    $('rem-add').addEventListener('click', function () {
      var t = $('rem-time').value, m = $('rem-msg').value;
      if (!t) return;
      cfg.reminders = cfg.reminders || [];
      cfg.reminders.push({ time: t, msg: m || '알림!' });
      save();
      $('rem-msg').value = '';
      renderReminders();
    });

    $('close').addEventListener('click', function () { api.closeSettings(); });
    $('hi').addEventListener('click', function () { api.runCommand('wave'); });
    $('reset').addEventListener('click', function () {
      api.resetConfig().then(function (c) {
        cfg = c;
        location.reload();
      });
    });
  }

  api.getConfig().then(function (c) {
    cfg = c;
    return loadSprite();
  }).then(function () {
    bindAll();
    renderSwatches();
    renderReminders();
    loop();
  });

  api.onConfig(function (c) { cfg = Object.assign({}, cfg, c); });
})();
