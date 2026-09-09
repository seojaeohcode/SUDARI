/* 수다리 행동 엔진
 * 입력(마우스/키보드/스크롤/AI 상태)과 타이머를 받아 애니메이션 상태를 결정한다.
 * 플랫폼 의존 부분은 전부 bridge로 분리 → Electron과 웹 데모가 같은 코드를 쓴다.
 */
(function (global) {
  'use strict';

  var PAD = 16;                   // sprite.js와 동일한 오프스크린 여유

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function now() { return performance.now(); }

  var I = global.Sudari.i18n;
  var DEFAULTS = global.Sudari.preferences.defaults;
  var LOVE_LINES = ['love1','love2','love3','love4','love5','love6'];

  function deepMerge(base, over) {
    var out = JSON.parse(JSON.stringify(base));
    Object.keys(over || {}).forEach(function (k) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && out[k]) {
        out[k] = deepMerge(out[k], over[k]);
      } else if (over[k] !== undefined) {
        out[k] = over[k];
      }
    });
    return out;
  }

  function Pet(o) {
    this.canvas = o.canvas;
    this.ctx = o.canvas.getContext('2d');
    this.sprite = o.sprite;
    this.bridge = o.bridge;
    this.ui = o.ui || {};
    this.audio = o.audio;
    this.cfg = global.Sudari.preferences.normalize(o.config);

    this.anim = 'idle';
    this.frame = 0;
    this.animT = 0;
    this.action = null;         // {anim, until, tag, once}
    this.yOff = 0;              // 점프 궤적 (px, 화면 기준)
    this.flip = false;

    this.idleT = 0;
    this.gaze = [0, 0];
    this.gazeTarget = [0, 0];
    this.lid = 0;
    this.nextBlink = 1.5 + Math.random() * 3;
    this.happy = 0;

    this.cursor = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0 };
    this.lastCursor = null;

    this.typeT = 0;             // 마지막 타이핑 이후 경과
    this.typeRate = 0;          // 초당 타수(EMA)
    this.overheat = 0;

    this.scrollProg = 0;
    this.shellCount = 0;

    this.drag = null;
    this.fall = { active: false, vy: 0 };
    this.shake = { flips: 0, lastDir: 0, t: 0 };

    this.agent = 'idle';
    this.fx = [];
    this.bubbleUntil = 0;

    this.t0 = now();
    this.tPrev = this.t0;
    this.stretchAt = this._minsFromNow(this.cfg.stretch.everyMin);
    this.waterAt = this._minsFromNow(this.cfg.water.everyMin);
    this.pomo = null;
    this.firedReminders = {};
    this.ambientAt = now() + 15000 + Math.random() * 20000;
    this.affectionAt = now() + this.cfg.affection.everyMin * 60000 * (0.5 + Math.random() * 0.5);
    this.loveT = 0;
    this.wander = { t: 0, x: 0, y: 0 };
    this.reducedMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.fw = { parts: [], until: 0, next: 0 };   // 폭죽

    this._wire();
    this._wirePanel();
    this.applyConfig(this.cfg, true);
    this.resize();
  }

  Pet.DEFAULTS = DEFAULTS;
  Pet.deepMerge = deepMerge;

  Pet.prototype._minsFromNow = function (m) { return now() + m * 60000; };

  // ------------------------------------------------------------------ 입력
  Pet.prototype._wire = function () {
    var s = this, b = this.bridge;

    b.onKey(function () {
      if (!s.cfg.reactions.keyboard || s.cfg.peek) return;
      s.typeRate = s.typeRate * 0.82 + 3.2;    // 대략 초당 타수로 수렴
      s.typeT = 0;
      s.idleT = 0;
      s.wake();
    });

    b.onWheel(function (delta) {
      if (!s.cfg.reactions.scroll || s.cfg.peek) return;
      s.scrollProg = clamp(s.scrollProg + Math.min(1, Math.abs(delta) / 120) * 0.22, 0, 1.6);
      s.idleT = 0;
      s.wake();
    });

    b.onAgent(function (msg) {
      var st = (msg && msg.state) || 'idle';
      if (st === 'thinking' || st === 'busy') {
        s.agent = 'thinking';
        s.wake();
      } else if (st === 'done') {
        s.agent = 'idle';
        s.celebrate(msg && msg.text);
      } else {
        s.agent = 'idle';
      }
    });

    b.onCommand(function (cmd, arg) { s.command(cmd, arg); });

    // 드래그 — 창을 잡아 옮기면서 모찌처럼 늘어난다. 단, 꼬리를 잡으면 화낸다.
    this.canvas.addEventListener('pointerdown', function (e) {
      if (e.button === 2) return;
      var bounds=s.canvas.getBoundingClientRect();
      if (s._isTail(e.clientX-bounds.left, e.clientY-bounds.top)) { s.tailPull(); return; }
      var p = s.bridge.petPos();
      var g = s.bridge.cursorGlobal();
      s.drag = { gx: g.x - p.x, gy: g.y - p.y, moved: 0 };
      s.shake = { flips: 0, lastDir: 0, t: 0 };
      s.fall.active = false;
      s.audio.squeak();
      s.say('dragLine', 900);
      try { s.canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });

    var release = function () {
      if (!s.drag) return;
      s.drag = null;
      s.fall.active = true;
      s.fall.vy = 0;
      s.audio.chirpUp();
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);

    this.canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      s.bridge.contextMenu();
    });

    window.addEventListener('resize', function () { s.resize(); });
  };

  Pet.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var w = this.canvas.clientWidth || window.innerWidth;
    var h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.vw = w;
    this.vh = h;
    this.scale = global.Sudari.layout.effectiveScale(this.cfg.scale, {width:w,height:h});
    if (this.ui.timer) this.ui.timer.style.setProperty("--timer-scale", this.scale / 2);
  };

  // ------------------------------------------------------------------ 설정
  Pet.prototype.applyConfig = function (cfg, initial) {
    var previous = this.cfg;
    var prevPattern = this.cfg && this.cfg.pattern;
    var prevPeek = !!(this.cfg && this.cfg.peek);
    this.cfg = global.Sudari.preferences.normalize(cfg);
    I.set(this.cfg.language); I.apply();
    this._timerTxt = null;
    if (!initial && this.ui.bubble) { this.ui.bubble.classList.remove("show"); this.bubbleUntil = 0; }
    this.audio.volume = this.cfg.volume;
    this.audio.muted = !!this.cfg.muted;
    this.scale = global.Sudari.layout.scale(this.cfg.scale);

    if (this.ui.timer) this.ui.timer.style.setProperty('--timer-scale', this.scale / 2);
    if (this.bridge.resizePet) this.bridge.resizePet(this.scale);

    var colors = global.Sudari.derivePalette(this.cfg.baseColor);
    if (this.sprite) this.sprite.recolor(colors);
    this.furColor = colors.FUR;

    if (this.ui.pin) {
      this.ui.pin.textContent = this.cfg.pin || '';
      this.ui.pin.style.display = this.cfg.pin ? 'block' : 'none';
    }
    if (!initial && this.cfg.pattern !== prevPattern && this.onPatternChange) {
      this.onPatternChange(this.cfg.pattern);
    }
    if (!initial && !!this.cfg.peek !== prevPeek) {       // 설정 창에서 켜고 꺼도 창이 움직인다
      if (this.cfg.peek) this.goPeek(); else this.leavePeek();
    }
    this.resize();
    if (this.ui.timerPanel) this._syncPanel();
    if (this.cfg.pomodoro.on && !this.pomo) this.startPomodoro();
    if (!this.cfg.pomodoro.on) { this.pomo = null; this._renderTimer(); }
    if (initial || !previous || previous.stretch.everyMin !== this.cfg.stretch.everyMin || previous.stretch.on !== this.cfg.stretch.on)
      this.stretchAt = this._minsFromNow(this.cfg.stretch.everyMin);
    if (initial || !previous || previous.water.everyMin !== this.cfg.water.everyMin || previous.water.on !== this.cfg.water.on)
      this.waterAt = this._minsFromNow(this.cfg.water.everyMin);
    if (initial || !previous || previous.affection.everyMin !== this.cfg.affection.everyMin || previous.affection.on !== this.cfg.affection.on)
      this.affectionAt = this._minsFromNow(this.cfg.affection.everyMin);
  };

  // ------------------------------------------------------------------ 액션
  Pet.prototype.setAction = function (anim, seconds, tag) {
    this.action = { anim: anim, until: now() + seconds * 1000, tag: tag || anim, t0: now() };
    this.anim = anim;
    this.frame = 0;
    this.animT = 0;
    this.idleT = 0;
  };

  Pet.prototype.say = function (text, ms) {
    if (!this.ui.bubble) return;
    if (I.messages.en[text]) text = I.t(text);
    var who = this.cfg.name ? this.cfg.name : '';
    // 이름이 없으면 {name} 과 그 옆의 쉼표/공백까지 자연스럽게 지운다
    var t = who ? text.replace(/\{name\}/g, who)
      : text.replace(/\s*\{name\},?\s*/g, ' ').replace(/\s+/g, ' ')
          .replace(/\s+([!?.,~])/g, '$1').trim();
    this.ui.bubble.textContent = t;
    this.ui.bubble.classList.add('show');
    this.bubbleUntil = now() + (ms || 2600);
  };

  Pet.prototype.wake = function () {
    if (this.anim === 'sleep' || this.anim === 'float') {
      this.action = null;
      this.anim = 'look';
      this.frame = 0;
    }
    this.idleT = 0;
  };

  Pet.prototype.celebrate = function (text) {
    this.setAction('jump', 1.5, 'jump');
    this.jumpT = 0;
    this.audio.done();
    this.spawnFx('spark', 3, 0, -12);
    this.say(text || 'done', 3000);
  };

  Pet.prototype.command = function (cmd, arg) {
    switch (cmd) {
      case 'stretch': this.doStretch(); break;
      case 'water': this.doWater(); break;
      case 'greet': this.greet(); break;
      case 'wave':
        this.setAction('wave', 1.6);
        this.audio.happy();
        this.say('hello', 2000);
        break;
      case 'jump': this.celebrate(arg); break;
      case 'sleep': this.setAction('sleep', 20); break;
      case 'float':
        this.setAction('float', 12);
        this.say('floatLine', 2000);
        break;
      case 'love': this.love(); break;
      case 'say': this.say(arg || '', 4200); break;
      case 'angry': this.tailPull(); break;
      case 'timer-panel': this.togglePanel(true); break;
      case 'fireworks':
        this.celebrate(arg || 'congrats');
        this.startFireworks(4.5);
        break;
      case 'pomodoro-start':
        this.cfg.pomodoro.on = true;
        this.startPomodoro();
        this.bridge.saveConfig(this.cfg);
        break;
      case 'meal': this.doMeal(arg); break;
      case 'crack':
        this.setAction('shell', 4.2, 'crack');
        break;
      case 'snack':                        // 서서 두 손으로 꼭 쥐고 먹는다 (절대 안 뺏김)
        this.setAction('hold', 4.6, 'snack');
        this.audio.happy();
        this.spawnFx('heart', 2, 0, -14);
        this.say('snackLine', 3200);
        break;
      case 'pomodoro-toggle':
        this.cfg.pomodoro.on = !this.cfg.pomodoro.on;
        if (this.cfg.pomodoro.on) this.startPomodoro(); else { this.pomo = null; this._renderTimer(); }
        this.bridge.saveConfig(this.cfg);
        break;
      case 'peek-toggle':
        this.cfg.peek = !this.cfg.peek;
        this.bridge.saveConfig(this.cfg);
        if (this.cfg.peek) this.goPeek(); else this.leavePeek();
        break;
      default: break;
    }
  };

  Pet.prototype.doStretch = function () {
    this.setAction('stretch', 4.2);
    this.audio.remind();
    this.say('stretchLine', 4000);
  };

  Pet.prototype.doWater = function () {
    this.setAction('drink', 4.0);
    this.audio.plop();
    this.spawnFx('drop', 3, 0, 10);
    this.say('waterLine', 4000);
  };

  // ------------------------------------------------------------------ 뽀모도로
  Pet.prototype.startPomodoro = function () {
    var p = this.cfg.pomodoro;
    this.pomo = { phase: 'focus', round: 1, endsAt: now() + p.focusMin * 60000 };
    this.say('focusLine', 2600);
    this.audio.chirpUp();
  };

  Pet.prototype._tickPomodoro = function () {
    if (!this.pomo) return;
    if (now() >= this.pomo.endsAt) {
      var p = this.cfg.pomodoro;
      if (this.pomo.phase === 'focus') {
        this.pomo.phase = 'break';
        this.pomo.endsAt = now() + p.breakMin * 60000;
        this.setAction('float', Math.min(8, p.breakMin * 60));
        this.audio.remind();
        this.say('breakLine', 4000);
      } else {
        this.pomo.round++;
        if (this.pomo.round > p.rounds) {
          this.pomo = null;
          this.cfg.pomodoro.on = false;
          this.celebrate('congrats');
          this.startFireworks(5.5);
          this.bridge.saveConfig(this.cfg);
        } else {
          this.pomo.phase = 'focus';
          this.pomo.endsAt = now() + p.focusMin * 60000;
          this.audio.chirpUp();
          this.say(I.t('roundLine', {round:this.pomo.round}), 2600);
        }
      }
    }
    this._renderTimer();
  };

  Pet.prototype._renderTimer = function () {
    var el = this.ui.timer;
    if (!el) return;
    if (!this.pomo) { el.classList.remove('show'); return; }
    var left = Math.max(0, this.pomo.endsAt - now());
    var m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
    var txt = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    var sub = I.t(this.pomo.phase) + ' · ' +
      this.pomo.round + '/' + this.cfg.pomodoro.rounds;
    if (this._timerTxt !== txt + sub) {              // 매 프레임 DOM을 건드리지 않게
      this._timerTxt = txt + sub;
      var host = el.querySelector('.shell') || el;
      host.textContent = '';
      var b = document.createElement('b'); b.textContent = txt; b.dir = 'ltr';
      var sm = document.createElement('small'); sm.className='phase';
      sm.textContent = (this.pomo.phase==='focus'?'◎ ':'☕ ')+I.t(this.pomo.phase);
      var round=document.createElement('span'); round.className='round';round.dir='ltr';round.textContent=this.pomo.round+' / '+this.cfg.pomodoro.rounds;
      host.appendChild(b); host.appendChild(sm);host.appendChild(round);
    }
    el.classList.toggle('break', this.pomo.phase === 'break');
    el.classList.add('show');
  };

  // ------------------------------------------------------------------ 타이머 설정 패널
  var PANEL_LIMITS = { focusMin: [5, 180], breakMin: [1, 60], rounds: [1, 12] };

  Pet.prototype._wirePanel = function () {
    var s = this, panel = this.ui.timerPanel;
    if (!panel) return;
    if (this.ui.timer) this.ui.timer.addEventListener('click', function () { s.togglePanel(true); });
    var btns = panel.querySelectorAll('button[data-k]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        var k = e.currentTarget.getAttribute('data-k');
        var d = parseInt(e.currentTarget.getAttribute('data-d'), 10);
        var lim = PANEL_LIMITS[k];
        s.cfg.pomodoro[k] = clamp((s.cfg.pomodoro[k] || 0) + d, lim[0], lim[1]);
        s.bridge.saveConfig(s.cfg);
        s._syncPanel();
        s.audio.chirpUp();
      });
    }
    panel.querySelector('#tp-start').addEventListener('click', function () {
      s.cfg.pomodoro.on = true;
      s.startPomodoro();
      s.bridge.saveConfig(s.cfg);
      s.togglePanel(false);
    });
    panel.querySelector('#tp-stop').addEventListener('click', function () {
      s.pomo = null;
      s.cfg.pomodoro.on = false;
      s._renderTimer();
      s.bridge.saveConfig(s.cfg);
      s.togglePanel(false);
      s.say('stoppedLine', 1600);
    });
    panel.querySelector('#tp-close').addEventListener('click', function () { s.togglePanel(false); });
  };

  Pet.prototype._syncPanel = function () {
    var p = this.ui.timerPanel, c = this.cfg.pomodoro;
    if (!p) return;
    p.querySelector('#tp-focus').textContent = c.focusMin;
    p.querySelector('#tp-break').textContent = c.breakMin;
    p.querySelector('#tp-rounds').textContent = c.rounds;
    p.querySelectorAll('button[data-k]').forEach(function(b){var k=b.dataset.k,d=Number(b.dataset.d),limits=PANEL_LIMITS[k];b.disabled=d<0?c[k]<=limits[0]:c[k]>=limits[1];b.setAttribute('aria-label',(d<0?'− ':'+ ')+I.t(k==='focusMin'?'focus':k==='breakMin'?'break':'rounds'));});
    p.querySelector('#tp-stop').style.display = this.pomo ? '' : 'none';
    p.querySelector('#tp-start').textContent = '▶ ' + I.t(this.pomo ? 'restart' : 'start');
  };

  Pet.prototype.togglePanel = function (show) {
    var p = this.ui.timerPanel;
    if (!p) return;
    if (show) this._syncPanel();
    p.classList.toggle('show', !!show);
    this.canvas.parentElement.classList.toggle('panel-open', !!show);
    if (show && this.ui.bubble) { this.ui.bubble.classList.remove('show'); this.bubbleUntil = 0; }
  };

  // ------------------------------------------------------------------ 알림/리마인더
  Pet.prototype._tickTimers = function () {
    var n = now();
    if (this.cfg.stretch.on && n >= this.stretchAt) {
      this.stretchAt = this._minsFromNow(this.cfg.stretch.everyMin);
      if (!this.action) this.doStretch();
    }
    if (this.cfg.water.on && n >= this.waterAt) {
      this.waterAt = this._minsFromNow(this.cfg.water.everyMin);
      if (!this.action) this.doWater();
    }
    var d = new Date();
    var hm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' +
      (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var key = d.toDateString() + hm;
    var s = this;
    (this.cfg.reminders || []).forEach(function (r, i) {
      if (r && r.time === hm && !s.firedReminders[key + i]) {
        s.firedReminders[key + i] = true;
        s.setAction('wave', 2.2);
        s.audio.remind();
        s.say(r.msg || 'reminderLine', 6000);
      }
    });
  };

  // ------------------------------------------------------------------ 꼬리
  var TAIL_POSES = { idle: 1, look: 1, knead: 1, wave: 1, think: 1, angry: 1 };
  var TAIL_LINES = ['tail1','tail2'];

  /** 앉은 자세에서 프레임 오른쪽 아래 = 꼬리. (빼꼼 모드로 뒤집혀 있으면 왼쪽 아래) */
  Pet.prototype._isTail = function (cx, cy) {
    if (!TAIL_POSES[this.anim]) return false;
    var box = this._petBox();
    var fx = (cx - box.x) / this.scale, fy = (cy - box.y) / this.scale;   // 프레임 픽셀
    if (this.flip) fx = this.sprite.fw - fx;
    return fx >= this.sprite.fw * .67 && fy >= this.sprite.fh * .66;
  };

  Pet.prototype.tailPull = function () {
    var t = now();
    if (!this.tailPullAt || t - this.tailPullAt > 12000) this.tailPulls = 0;
    this.tailPullAt = t;
    this.tailPulls++;
    this.idleT = 0;
    this.happy = 0;
    this.audio.purrOff();
    this.audio.grumble();
    this.wobble = 0.9;
    if (this.tailPulls >= 3) {                       // 세 번 연속이면 등 돌리고 삐짐
      this.tailPulls = 0;
      this.setAction('angry', 4.5, 'sulk');
      this.say('sulk', 3200);
    } else {
      this.setAction('angry', 1.9, 'angry');
      this.say(TAIL_LINES[Math.floor(Math.random() * TAIL_LINES.length)], 1900);
    }
  };

  // ------------------------------------------------------------------ 애정 표현 / 식사 / 혼자 놀기
  /** 켜자마자 하는 첫 인사 — 손 흔들며 "사랑해". */
  Pet.prototype.greet = function () {
    var lines = ['hello','love1','love2'];
    this.setAction('wave', 1.8, 'wave');
    this.loveT = 3.4;
    this.audio.happy();
    this.say(lines[Math.floor(Math.random() * lines.length)], 4200);
    this.spawnFx('heart', 3, 0, -12);
    var s = this;
    setTimeout(function () { s.spawnFx('heart', 2, 5, -14); }, 600);
    setTimeout(function () { s.spawnFx('heart', 2, -5, -13); }, 1300);
    if (!this.cfg.name) {                     // 첫 실행: 이름은 비어 있고, 본인이 설정에서 적는다
      setTimeout(function () {
        if (!s.cfg.name) s.say('nameLine', 4200);
      }, 4600);
    }
  };

  // ------------------------------------------------------------------ 폭죽
  var FW_COLORS = ['#ff7794', '#ffe17a', '#7ee0ff', '#ffb066', '#ffffff', '#c9a3ff', '#8dffb0'];

  Pet.prototype.startFireworks = function (seconds) {
    this.fw.until = now() + seconds * 1000;
    this.fw.next = 0;
  };

  Pet.prototype._launchFirework = function () {
    var S = this.scale;
    var cx = this.vw * (0.3 + Math.random() * 0.4);
    var cy = this.vh * (0.2 + Math.random() * 0.3);
    var c1 = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
    var c2 = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
    var n = this.reducedMotion ? 8 : 18 + Math.floor(Math.random() * 6);
    var speed = Math.min((28 + Math.random() * 12) * S, this.vw * .15);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      var v = speed * (0.7 + Math.random() * 0.4);
      this.fw.parts.push({
        x: cx, y: cy, px: cx, py: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 1.3 + Math.random() * 0.6, t: 0, color: i % 2 ? c1 : c2, big: i % 4 === 0
      });
    }
    this.fw.parts.push({ x: cx, y: cy, px: cx, py: cy, vx: 0, vy: 0, life: 0.16, t: 0,
      color: '#ffffff', flash: true });
    this.audio.pop();
  };

  Pet.prototype._tickFireworks = function (dt) {
    var n = now();
    if (n < this.fw.until && n >= this.fw.next) {
      this._launchFirework();
      if (Math.random() < 0.35) this._launchFirework();   // 가끔 두 발 동시에
      this.fw.next = n + 260 + Math.random() * 340;
    }
    var g = 26 * this.scale;
    for (var i = this.fw.parts.length - 1; i >= 0; i--) {
      var p = this.fw.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.fw.parts.splice(i, 1); continue; }
      p.px = p.x; p.py = p.y;                  // 잔상용 이전 위치
      p.vx *= Math.pow(0.42, dt);              // 공기 저항
      p.vy = p.vy * Math.pow(0.42, dt) + g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  };

  /** 화면 배율에 스냅한 정사각 점 + 짧은 잔상으로 그려서 픽셀아트 느낌을 유지한다. */
  Pet.prototype._drawFireworks = function (ctx) {
    var S = this.scale;
    for (var i = 0; i < this.fw.parts.length; i++) {
      var p = this.fw.parts[i];
      var k = p.t / p.life;
      if (k > 0.6) ctx.globalAlpha = Math.max(0,(1-k)/.4);   // 꺼질 때 깜빡깜빡
      var size = p.flash ? S * 5 : (p.big && k < 0.45 ? S * 3 : S * 2);
      if (!p.flash && k < 0.5) {                            // 잔상: 이전 위치에 어둡게 한 점
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.px / S) * S, Math.round(p.py / S) * S, S * 2, S * 2);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x / S) * S - (size - S * 2) / 2,
        Math.round(p.y / S) * S - (size - S * 2) / 2, size, size);
      ctx.globalAlpha = 1;
    }
  };

  Pet.prototype.love = function () {
    var line = LOVE_LINES[Math.floor(Math.random() * LOVE_LINES.length)];
    this.loveT = 3.2;
    this.idleT = 0;
    this.audio.happy();
    this.say(line, 4200);
    this.spawnFx('heart', 3, 0, -12);
    var s = this;
    setTimeout(function () { s.spawnFx('heart', 2, 4, -14); }, 700);
    setTimeout(function () { s.spawnFx('heart', 2, -4, -13); }, 1500);
  };

  Pet.prototype.doMeal = function (label) {
    this.setAction('hold', 5.5, 'meal');
    this.audio.remind();
    var what = label ? label + ' ' : '';
    this.say('mealLine', 6000);
    this.spawnFx('heart', 2, 0, -12);
  };

  Pet.prototype._tickMealsAffection = function () {
    var n = now();
    var d = new Date();
    var hm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' +
      (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var day = d.toDateString();
    var meals = this.cfg.meals || {};
    var names = { breakfast: '아침', lunch: '점심', dinner: '저녁' };
    for (var k in names) {
      if (meals[k] && meals[k] === hm && !this.firedReminders[day + 'meal' + k]) {
        this.firedReminders[day + 'meal' + k] = true;
        this.doMeal(names[k]);
      }
    }
    // 애정 표현: 사용자가 최근에 활동 중일 때만 (자는데 깨우지 않는다)
    if (this.cfg.affection.on && n >= this.affectionAt) {
      this.affectionAt = n + this.cfg.affection.everyMin * 60000 * (0.7 + Math.random() * 0.6);
      if (!this.action && !this.drag && !this.cfg.peek && this.idleT < 180) this.love();
    }
  };

  /** 심심할 때 혼자 노는 행동 — 가만히 있다가 문득 조개를 까거나, 둥둥 뜨거나, 기지개. */
  Pet.prototype._tickAmbient = function () {
    if (!this.cfg.ambient.on || this.action || this.drag || this.cfg.peek) return;
    if (this.anim !== 'idle' && this.anim !== 'look') return;
    if (now() < this.ambientAt) return;
    this.ambientAt = now() + 25000 + Math.random() * 50000;
    var r = Math.random();
    if (r < 0.30) {
      this.setAction('shell', 4.2, 'crack');        // 배 깔고 조개 까기
    } else if (r < 0.50) {
      this.setAction('float', 6, 'float');
      if (Math.random() < 0.5) this.say('floatLine', 1800);
    } else if (r < 0.68) {
      this.setAction('stretch', 2.6, 'stretch-lite');
    } else if (r < 0.82) {
      this.setAction('wave', 1.4, 'wave');
      this.audio.chirpUp();
    } else {
      this.setAction('hold', 3.2, 'snack');          // 새우 간식
      this.audio.squeak();
    }
  };

  // ------------------------------------------------------------------ 빼꼼 모드
  Pet.prototype.goPeek = function () {
    var wa = this.bridge.workArea();
    var p = this.bridge.petPos();
    var box = this._petBox();
    var petCenterInWin = box.x + box.w / 2;
    this.bridge.movePet(Math.round(wa.x + wa.width - petCenterInWin + 12 * this.scale), p.y);
    this.flip = true;
    this.say('peekLine', 2400);
  };

  Pet.prototype.leavePeek = function () {
    var wa = this.bridge.workArea();
    var p = this.bridge.petPos();
    this.bridge.movePet(Math.round(wa.x + wa.width - this.vw - 24), p.y);
    this.flip = false;
    this.setAction('wave', 1.4);
    this.audio.happy();
  };

  // ------------------------------------------------------------------ FX
  /** 머리 기준점에서 (dx,dy) 떨어진 곳에 파티클을 뿌린다. */
  Pet.prototype.spawnFx = function (row, n, dx, dy) {
    var m = this.sprite.meta(this.anim, this.frame);
    var h = (m && m.head) || [this.sprite.fw / 2, 14];
    for (var i = 0; i < n; i++) {
      this.fx.push({
        row: row, col: 0, t: 0, life: 0.9 + Math.random() * 0.5,
        x: h[0] + dx + (Math.random() * 14 - 7),
        y: h[1] + dy + (Math.random() * 6 - 3),
        vy: -8 - Math.random() * 8, vx: (Math.random() - 0.5) * 5
      });
    }
  };

  Pet.prototype._tickFx = function (dt) {
    for (var i = this.fx.length - 1; i >= 0; i--) {
      var f = this.fx[i];
      f.t += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.col = clamp(Math.floor(f.t / f.life * 3), 0, 2);
      if (f.t >= f.life) this.fx.splice(i, 1);
    }
  };

  // ------------------------------------------------------------------ 상태 결정
  Pet.prototype._pickAnim = function () {
    if (this.drag) return 'squish';
    if (this.cfg.peek) return 'look';   // 빼꼼은 창 위치로 표현. 몸 잘린 포즈는 쓰지 않는다
    if (this.action) return this.action.anim;
    if (this.overheat > 0.6) return 'overheat';
    if (this.typeT < 0.55 && this.cfg.reactions.keyboard) return 'knead';
    if (now() < (this.shellOpenUntil || 0)) return 'shell_open';
    if (this.scrollProg > 0.12) return 'shell';
    if (this.agent === 'thinking') return 'think';
    if (this.idleT > this.cfg.sleepAfterMin * 60) return 'sleep';
    if (this.happy > 0.5) return 'idle';
    if (this.cursor.speed > 900 && this.cursorDist < 340 && this.cfg.reactions.mouse) return 'hunt';
    if (this.cursorDist < 200 && this.cfg.reactions.mouse) return 'look';
    return 'idle';
  };

  Pet.prototype._petBox = function () {
    var S = this.scale;
    var fw = this.sprite.fw, fh = this.sprite.fh;
    var drawX = Math.round((this.vw - (fw + PAD * 2) * S) / 2);
    var groundY = this.vh - 10;   // 흰 테두리까지 잘리지 않게 아래 여유
    var drawY = Math.round(groundY - (PAD + fh) * S) - this.yOff;
    return {
      drawX: drawX, drawY: drawY,
      x: drawX + PAD * S, y: drawY + PAD * S, w: fw * S, h: fh * S
    };
  };

  /** 창 전체가 클릭을 통과하게 두고, 수달 위에 있을 때만 상호작용을 켠다. */
  Pet.prototype._hitTest = function (box) {
    var m = 4 * this.scale;
    var c = this.cursor;
    var x=(c.x-box.x)/this.scale,y=(c.y-box.y)/this.scale;
    if(this.flip !== !!(this.action && this.action.tag==='sulk'))x=this.sprite.fw-1-x;
    if(this.sprite.contains(this.anim,this.frame,x,y))return true;
    // 조개 타이머와 설정 패널도 클릭 대상
    var els = [this.ui.timer, this.ui.timerPanel];
    var origin = this.canvas.getBoundingClientRect();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el || !el.classList.contains('show') || getComputedStyle(el).visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      var margin = this.scale;
      if (c.x >= r.left - origin.left - margin && c.x <= r.right - origin.left + margin &&
          c.y >= r.top - origin.top - margin && c.y <= r.bottom - origin.top + margin) return true;
    }
    return false;
  };

  // ------------------------------------------------------------------ 프레임
  Pet.prototype.tick = function () {
    var t = now();
    var dt = Math.min(0.05, (t - this.tPrev) / 1000);
    this.tPrev = t;

    // --- 커서 추적
    var lc = this.bridge.cursorLocal();
    if (lc) {
      if (this.lastCursor) {
        var dx = lc.x - this.lastCursor.x, dy = lc.y - this.lastCursor.y;
        var sp = Math.hypot(dx, dy) / Math.max(dt, 0.001);
        this.cursor.speed = this.cursor.speed * 0.6 + sp * 0.4;
        this.cursor.vx = dx / Math.max(dt, 0.001);
      }
      this.cursor.x = lc.x; this.cursor.y = lc.y;
      this.lastCursor = { x: lc.x, y: lc.y };
    }

    var box = this._petBox();
    var cx = box.x + box.w / 2, cy = box.y + box.h * 0.42;
    this.cursorDist = Math.hypot(this.cursor.x - cx, this.cursor.y - cy);

    // --- 드래그 / 낙하
    if (this.drag) {
      var g = this.bridge.cursorGlobal();
      var nx = g.x - this.drag.gx, ny = g.y - this.drag.gy;
      var p = this.bridge.petPos();
      var mv = nx - p.x;
      if (Math.abs(mv) > 3) {
        var dir = mv > 0 ? 1 : -1;
        if (this.shake.lastDir && dir !== this.shake.lastDir) this.shake.flips++;
        this.shake.lastDir = dir;
      }
      this.shake.t += dt;
      if (this.shake.t > 0.6) { this.shake.t = 0; this.shake.flips = Math.max(0, this.shake.flips - 1); }
      if (this.shake.flips >= 3) {
        this.wobble = 1;
        this.shake.flips = 0;
        this.audio.squeak();
        this.say('shakeLine', 900);
      }
      // 발이 화면 아래로 사라지지 않게: 창 아래쪽은 작업영역 바닥까지만
      var waD = this.bridge.workArea();
      ny = Math.min(ny, waD.y + waD.height - this.vh + 2);
      ny = Math.max(ny, waD.y - this.vh * 0.5);
      this.bridge.movePet(nx, ny);
      this.idleT = 0;
    } else if (this.fall.active) {
      var wa = this.bridge.workArea();
      var pos = this.bridge.petPos();
      var restY = wa.y + wa.height - this.vh + 2;
      this.fall.vy += 1600 * dt;
      var y = pos.y + this.fall.vy * dt;
      var x = clamp(pos.x, wa.x - this.vw * 0.35, wa.x + wa.width - this.vw * 0.65);
      if (y >= restY) {
        y = restY;
        if (this.fall.vy > 380) { this.audio.plop(); this.setAction('squish', 0.28, 'land'); }
        this.fall.active = false;
      }
      this.bridge.movePet(Math.round(x), Math.round(y));
    }

    // --- 타이핑 / 과열
    this.typeT += dt;
    this.typeRate *= Math.pow(0.35, dt);
    // 과열은 정말 미친 속도(초당 8타 이상이 1초 넘게)일 때만. 보통 타자는 꾹꾹이만.
    if (this.typeRate > 24) {
      this.overheat = clamp(this.overheat + dt * 0.7, 0, 1);
    } else {
      this.overheat = clamp(this.overheat - dt * 0.6, 0, 1);
    }
    if (this.overheat > 0.6 && !this._saidHot) {
      this._saidHot = true;
      this.say('fastLine', 2200);
    }
    if (this.overheat < 0.3) this._saidHot = false;

    // --- 스크롤 → 조개 까기
    if (this.scrollProg > 0) {
      this.scrollProg = Math.max(0, this.scrollProg - dt * 0.30);
      this.shellCount += dt * (this.scrollProg > 0.5 ? 1 : 0);
      if (this.shellCount > 1.7) {
        this.shellCount = 0;
        this.shellOpenUntil = now() + 1600;    // 깐 조개를 잠깐 보여준다
        this.audio.crack();
        this.spawnFx('spark', 2, 6, 8);
        this.say('crackedLine', 1600);
      }
    }

    // --- 쓰다듬기
    var headBox = { x: box.x, y: box.y, w: box.w, h: box.h * 0.5 };
    var onHead = this.cursor.x > headBox.x && this.cursor.x < headBox.x + headBox.w &&
      this.cursor.y > headBox.y && this.cursor.y < headBox.y + headBox.h;
    if (onHead && this.cursor.speed > 40 && !this.drag && this.cfg.reactions.pet && !this.cfg.peek) {
      this.happy = clamp(this.happy + dt * 1.6, 0, 1.4);
      this.idleT = 0;
      if (this.happy > 0.5) {
        this.audio.purrOn();
        if (Math.random() < dt * 3) this.spawnFx('heart', 1, Math.random() * 8 - 4, -12);
        if (!this._saidPet) { this._saidPet = true; this.say('petLine', 2200); }
      }
    } else {
      this.happy = clamp(this.happy - dt * 0.9, 0, 1.4);
      if (this.happy <= 0.2) { this.audio.purrOff(); this._saidPet = false; }
    }

    // --- 시선: 커서가 가까우면 따라가고, 멀면 가끔 딴 데를 본다 (멍하니 노려보지 않게)
    var gx, gy;
    if (this.cursor.x < -9000 || this.cursorDist > 700) {
      this.wander.t -= dt;
      if (this.wander.t <= 0) {
        this.wander.t = 1.5 + Math.random() * 3;
        this.wander.x = (Math.random() - 0.5) * 2.4;
        this.wander.y = (Math.random() - 0.6) * 1.4;
      }
      gx = this.wander.x; gy = this.wander.y;
    } else {
      gx = clamp((this.cursor.x - cx) / (box.w * 1.4), -1, 1) * 1.3;
      gy = clamp((this.cursor.y - cy) / (box.h * 1.6), -1, 1) * 1.1;
    }
    this.gaze[0] += (gx - this.gaze[0]) * Math.min(1, dt * 12);
    this.gaze[1] += (gy - this.gaze[1]) * Math.min(1, dt * 12);

    // --- 깜빡임
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0.14;
      this.nextBlink = 2 + Math.random() * 4;
    }
    if (this.blinkT > 0) { this.blinkT -= dt; this.lid = 1; } else { this.lid = 0; }

    // --- 액션 만료
    if (this.action && now() >= this.action.until) this.action = null;

    this.idleT += dt;
    this.loveT = Math.max(0, this.loveT - dt);
    this._tickTimers();
    this._tickMealsAffection();
    this._tickAmbient();
    this._tickPomodoro();
    this._tickFx(dt);
    this._tickFireworks(dt);

    // 혼자 조개 까기: 1.8초 뒤에 '딱' 소리와 함께 열린다
    if (this.action && this.action.tag === 'crack' && !this.action.cracked &&
        now() - this.action.t0 > 1800) {
      this.action.cracked = true;
      this.action.anim = 'shell_open';         // 깐 조개를 든 프레임으로 바꿔 끼운다
      this.audio.crack();
      this.spawnFx('spark', 2, 6, 8);
    }

    // --- 애니메이션 프레임 진행
    var next = this._pickAnim();
    if (next !== this.anim) { this.anim = next; this.frame = 0; this.animT = 0; }
    var a = this.sprite.anim(this.anim);
    var fps = a.fps * (this.anim === 'overheat' ? 1 + this.overheat * 0.6 : 1);
    this.animT += dt;
    while (this.animT >= 1 / fps) {
      this.animT -= 1 / fps;
      this.frame = a.loop ? (this.frame + 1) % a.count : Math.min(this.frame + 1, a.count - 1);
    }

    // --- 점프 궤적 (스프라이트가 아니라 렌더러가 띄운다)
    if (this.action && this.action.tag === 'jump') {
      this.jumpT = (this.jumpT || 0) + dt;
      var ph = (this.jumpT % 0.5) / 0.5;
      this.yOff = Math.round(Math.sin(ph * Math.PI) * 14 * this.scale);
    } else if (this.anim === 'stretch') {
      this.yOff = 0;
    } else {
      this.yOff = 0;
    }

    // --- 버블 정리
    if (this.ui.bubble && this.bubbleUntil && now() > this.bubbleUntil) {
      this.ui.bubble.classList.remove('show');
      this.bubbleUntil = 0;
    }

    // --- 상호작용 영역 토글
    var hit = this._hitTest(box) || !!this.drag;
    if (hit !== this._interactive) {
      this._interactive = hit;
      this.bridge.setInteractive(hit);
    }

    this.draw(box);
  };

  Pet.prototype.draw = function (box) {
    var sp = this.sprite, ctx = this.ctx;
    ctx.clearRect(0, 0, this.vw, this.vh);

    sp.begin();
    sp.blitFrame(this.anim, this.frame);

    var eyeOpts = {
      gaze: this.gaze,
      lid: this.lid,
      happy: this.happy > 0.5 || this.loveT > 0 || (this.anim === 'jump'),
      wide: this.anim === 'hunt' ? 0.5 : (this.overheat > 0.6 ? 0.5 : 0)
    };
    if (this.anim === 'sleep') { eyeOpts.lid = 1; eyeOpts.happy = false; }
    sp.drawEyes(this.anim, this.frame, eyeOpts);

    // 상태별 FX — 위치는 스프라이트가 알려준 기준점(머리/배)에 붙인다
    var m = sp.meta(this.anim, this.frame);
    var head = (m && m.head) || [sp.fw / 2, 14];
    var hR = (m && m.headR) || [10, 8];
    var belly = (m && m.belly) || [sp.fw / 2, 32];
    var hands = (m && m.hands) || belly;
    var headX = head[0], headY = head[1];

    if (this.anim === 'overheat' || this.overheat > 0.6) {
      sp.tint('#ff4d3d', 0.20 + this.overheat * 0.18);
      var ph = Math.floor(now() / 130) % 3;
      sp.blitFx(sp.fx, 'steam', ph, headX - 8, headY - hR[1] - 8);
      sp.blitFx(sp.fx, 'steam', (ph + 1) % 3, headX + 8, headY - hR[1] - 11);
    }
    if (this.anim === 'sleep') {
      sp.blitFx(sp.fx, 'zzz', Math.floor(now() / 420) % 3, headX + 12, headY - hR[1] - 4);
    }
    if (this.anim === 'think') {
      sp.blitFx(sp.fx, 'mark', 0, headX + hR[0] + 3, headY - hR[1] - 6);
    }
    if (this.anim === 'angry' && this.action && this.action.tag === 'angry') {
      sp.blitFx(sp.fx, 'mark', 1, headX + hR[0] + 2, headY - hR[1] - 7);
    }
    // (돌·조개·새우는 프레임에 앞발과 함께 구워져 있어 런타임 FX가 필요 없다)
    if (this.anim === 'drink') {
      sp.blitFx(sp.fx, 'ring', Math.floor(now() / 260) % 3, headX + 2, headY + hR[1] + 6);
    }
    if (this.anim === 'float' && !(this.action && this.action.tag === 'snack')) {
      sp.blitFx(sp.fx, 'ring', Math.floor(now() / 500) % 3, belly[0] - 4, belly[1] + 8);
    }
    for (var i = 0; i < this.fx.length; i++) {
      var f = this.fx[i];
      sp.blitFx(sp.fx, f.row, f.col, f.x, f.y);
    }

    var jitter = 0;
    if (this.wobble > 0) {
      this.wobble -= 0.06;
      jitter = Math.round(Math.sin(now() / 26) * 3 * this.scale * this.wobble);
    }
    var sulking = this.action && this.action.tag === 'sulk';   // 삐지면 등을 돌린다
    sp.present(ctx, box.drawX + jitter, box.drawY, this.scale, this.flip !== !!sulking);
    if (this.fw.parts.length) this._drawFireworks(ctx);

    // Keep the shell close to the head. Reserve motion clearance only for the
    // current pose; breathing frames share one anchor so the button does not bob.
    var pose = sp.anim(this.anim);
    var poseTop = Math.min.apply(null, pose.frames.map(function(f){return f.head[1]-f.headR[1]-3;}));
    var jumping = this.action && this.action.tag === 'jump';
    var base = 10 + (this.sprite.fh - poseTop + (jumping ? 14 : 0)) * this.scale;
    var stack = base + 4;
    if (this.ui.timer) {
      this.ui.timer.style.bottom = stack + 'px';
      if (this.pomo) stack += 104 * this.scale / 2 + 8;
    }
    var topInset = this.ui.pin && this.cfg.pin ? this.ui.pin.offsetHeight + 20 : 12;
    if (this.ui.timerPanel) this.ui.timerPanel.style.bottom = Math.min(base,
      this.vh - this.ui.timerPanel.offsetHeight - topInset) + 'px';
    if (this.ui.bubble) {
      this.ui.bubble.style.bottom = stack + 'px';
      this.ui.bubble.style.maxHeight = Math.max(0,this.vh-stack-topInset) + 'px';
    }
  };

  Pet.prototype.start = function () {
    var s = this;
    function loop() { s.tick(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  };

  global.Sudari = global.Sudari || {};
  global.Sudari.Pet = Pet;
})(window);
