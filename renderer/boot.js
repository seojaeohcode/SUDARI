/* 부팅: 아틀라스 → 스프라이트 로드 → Pet 시작. Electron/웹 공통. */
(function (global) {
  'use strict';

  var S = global.Sudari;
  var ASSETS = (global.SUDARI_ASSET_DIR || '../assets');

  function boot(cfg) {
    var pattern = (cfg && cfg.pattern) || 'plain';
    S.Sprite.load(ASSETS, pattern, global.SUDARI_ATLAS, global.SUDARI_PALETTE)
      .then(function (sprite) {
        var pet = new S.Pet({
          canvas: document.getElementById('pet'),
          sprite: sprite,
          bridge: S.bridge,
          audio: new S.Audio(),
          config: cfg,
          ui: {
            bubble: document.getElementById('bubble'),
            timer: document.getElementById('timer'),
            timerPanel: document.getElementById('timerpanel'),
            pin: document.getElementById('pin')
          }
        });

        // 무늬가 바뀌면 시트를 다시 읽는다
        pet.onPatternChange = function (p) {
          S.Sprite.load(ASSETS, p, global.SUDARI_ATLAS, global.SUDARI_PALETTE)
            .then(function (ns) {
              pet.sprite = ns;
              pet.applyConfig(pet.cfg, true);
            });
        };

        S.bridge.onConfig(function (c) { pet.applyConfig(c); });
        global.sudariPet = pet;
        pet.start();
        setTimeout(function () { pet.greet(); }, 500);   // 켜자마자 "사랑해"
      })
      .catch(function (e) {
        document.title = '수다리 로드 실패: ' + e;
        console.error('[수다리] 스프라이트 로드 실패', e);
      });
  }

  function begin() {
    if (!global.SUDARI_ATLAS) {
      console.error('[수다리] atlas.js 가 없습니다. python tools/gen_sprites.py 를 먼저 실행하세요.');
      return;
    }
    var b = S.bridge;
    if (b && b.getConfig) {
      Promise.resolve(b.getConfig()).then(boot, function () { boot(null); });
    } else {
      boot(null);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', begin);
  } else {
    begin();
  }
})(window);
