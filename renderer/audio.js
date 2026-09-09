/* 수다리 사운드 — 오디오 파일 없이 WebAudio로 합성한다.
 * 수달은 "찍찍/삐익" 하는 높은 소리를 낸다는 점에 맞춰 짧은 피치 글라이드 처프를 쓴다.
 */
(function (global) {
  'use strict';

  function Audio2() {
    this.ctx = null;
    this.volume = 0.5;
    this.muted = false;
    this._purr = null;
  }

  Audio2.prototype._ac = function () {
    if (!this.ctx) {
      var C = global.AudioContext || global.webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  };

  /** 피치가 f0 → f1로 미끄러지는 짧은 처프. */
  Audio2.prototype.chirp = function (f0, f1, dur, gain, type) {
    if (this.muted || this.volume <= 0) return;
    var ac = this._ac(); if (!ac) return;
    var t = ac.currentTime;
    var o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((gain || 0.22) * this.volume, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(lp); lp.connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  };

  Audio2.prototype.noise = function (dur, gain, freq, q) {
    if (this.muted || this.volume <= 0) return;
    var ac = this._ac(); if (!ac) return;
    var n = Math.floor(ac.sampleRate * dur);
    var buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = ac.createBufferSource(); s.buffer = buf;
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = freq || 1600; bp.Q.value = q || 1.2;
    var g = ac.createGain(); g.gain.value = (gain || 0.2) * this.volume;
    s.connect(bp); bp.connect(g); g.connect(ac.destination);
    s.start();
  };

  // ---- 상황별 소리
  Audio2.prototype.squeak = function () { this.chirp(880, 1500, 0.09, 0.2); };
  Audio2.prototype.chirpUp = function () { this.chirp(700, 1250, 0.07, 0.18); };
  Audio2.prototype.happy = function () {
    this.chirp(900, 1400, 0.07, 0.2);
    var s = this;
    setTimeout(function () { s.chirp(1250, 1750, 0.09, 0.2); }, 85);
  };
  Audio2.prototype.done = function () {          // AI 작업 완료
    var s = this, n = [800, 1100, 1500];
    n.forEach(function (f, i) { setTimeout(function () { s.chirp(f, f * 1.35, 0.08, 0.2); }, i * 90); });
  };
  Audio2.prototype.remind = function () {
    var s = this;
    [0, 130].forEach(function (d) { setTimeout(function () { s.chirp(1050, 780, 0.12, 0.19); }, d); });
  };
  Audio2.prototype.crack = function () { this.noise(0.09, 0.24, 2400, 0.9); };
  Audio2.prototype.plop = function () { this.chirp(420, 130, 0.13, 0.22, 'sine'); };
  Audio2.prototype.sad = function () { this.chirp(700, 320, 0.22, 0.18); };
  Audio2.prototype.pop = function () {           // 폭죽 "펑" + 반짝
    this.noise(0.16, 0.22, 700, 0.7);
    var s = this;
    setTimeout(function () { s.chirp(1500, 2400, 0.09, 0.1, 'sine'); }, 60);
  };
  Audio2.prototype.grumble = function () {       // 꼬리 잡혔을 때 "끄릉"
    this.chirp(380, 250, 0.16, 0.2, 'sawtooth');
    var s = this;
    setTimeout(function () { s.chirp(520, 300, 0.1, 0.16, 'square'); }, 120);
  };

  /** 고롱고롱(수달 버전: 낮게 바르르) — 쓰다듬는 동안 지속. */
  Audio2.prototype.purrOn = function () {
    if (this.muted || this.volume <= 0 || this._purr) return;
    var ac = this._ac(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(),
      lg = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 62;
    lfo.type = 'sine'; lfo.frequency.value = 22;
    lg.gain.value = 0.5;
    lp.type = 'lowpass'; lp.frequency.value = 320;
    g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(0.16 * this.volume, ac.currentTime + 0.12);
    lfo.connect(lg); lg.connect(g.gain);
    o.connect(lp); lp.connect(g); g.connect(ac.destination);
    o.start(); lfo.start();
    this._purr = { o: o, g: g, lfo: lfo };
  };

  Audio2.prototype.purrOff = function () {
    if (!this._purr) return;
    var p = this._purr, ac = this.ctx;
    this._purr = null;
    try {
      p.g.gain.cancelScheduledValues(ac.currentTime);
      p.g.gain.setValueAtTime(p.g.gain.value, ac.currentTime);
      p.g.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.15);
      p.o.stop(ac.currentTime + 0.2); p.lfo.stop(ac.currentTime + 0.2);
    } catch (e) { /* 이미 정리됨 */ }
  };

  global.Sudari = global.Sudari || {};
  global.Sudari.Audio = Audio2;
})(window);
