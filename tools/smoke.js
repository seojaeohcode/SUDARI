/* Real Electron regression test. Uses a separate profile; never changes user settings. */
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const layout = require('../renderer/layout');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sudari-smoke-'));
app.setPath('userData', profile);
// A test profile must not change the user's OS login items.
app.setLoginItemSettings = () => {};
fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({
  scale: 2, muted: true, launchAtLogin: false,
  ambient: { on: false }, affection: { on: false, everyMin: 40 }
}));
const output = path.join(__dirname, '..', 'test-results', `${process.platform}-${process.arch}`);
fs.mkdirSync(output, { recursive: true });
const errors = [];
app.on('web-contents-created', (_event, contents) => {
  contents.on('render-process-gone', (_e, detail) => errors.push(JSON.stringify(detail)));
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 120; i++) {
    const result = await check();
    if (result) return result;
    await wait(50);
  }
  throw new Error('Timed out waiting for the pet');
}
require('../main');

app.whenReady().then(async () => {
  const win = await until(() => BrowserWindow.getAllWindows()[0]);
  const js = (source) => win.webContents.executeJavaScript(source);
  await until(async () => !win.webContents.isLoading() && await js('!!window.sudariPet'));
  await js(`window.smokeErrors = []; window.addEventListener('error', e => smokeErrors.push(e.message));`);
  // Confirm the native addon for the runner's CPU can be loaded without requesting permissions.
  assert.equal(typeof require('uiohook-napi').uIOhook.start, 'function');
  await wait(700); // Initial greeting is scheduled by boot.js.
  const rows = [];
  for (const scale of [2, 3, 4, 5, 2, 5]) {
    await js(`sudariAPI.saveConfig(Sudari.Pet.deepMerge(sudariPet.cfg, {scale: ${scale},
      muted: true, pin: '오늘도 같이 집중해요', pomodoro: {on: true, focusMin: 180, breakMin: 60, rounds: 12}}))`);
    const expected = layout.size(scale);
    await until(async () => await js(`sudariPet.scale === ${scale} && sudariPet.vh === innerHeight && sudariPet.vw === innerWidth && Math.abs(innerWidth - ${expected.width}) <= 1 && Math.abs(innerHeight - ${expected.height}) <= 1`));
    // Windows rounds physical pixel edges independently at fractional display density.
    assert.ok(Math.abs(win.getBounds().width - expected.width) <= 1, 'Native window width follows scale');
    assert.ok(Math.abs(win.getBounds().height - expected.height) <= 1, 'Native window height follows scale');
    const deadline = await js('sudariPet.pomo.endsAt');
    for (const phase of ['focus', 'break']) {
      const row = await js(`(() => {
        const p = sudariPet;
        p.pomo.phase = '${phase}'; p.pomo.round = 12;
        p._renderTimer();
        p.anim = 'jump'; p.frame = 0; p.yOff = 14 * p.scale;
        p.say('다 해냈어! 조개 반 줄까?', 5000); p.draw(p._petBox());
        const timer = p.ui.timer.getBoundingClientRect(), bubble = p.ui.bubble.getBoundingClientRect();
        const box = p._petBox();
        p.cursor.x = timer.left + timer.width / 2; p.cursor.y = timer.top + timer.height / 2;
        return {scale: p.scale, phase: '${phase}', width: timer.width, height: timer.height,
          top: timer.top, right: timer.right, bottom: timer.bottom,
          bubbleTop: bubble.top, bubbleBottom: bubble.bottom, hit: p._hitTest(box),
          breakClass: p.ui.timer.classList.contains('break'),
          dpr: devicePixelRatio, canvasWidth: p.canvas.width, viewport: innerWidth};
      })()`);
      assert.ok(Math.abs(row.width - 86 * scale / 2) < 1, JSON.stringify(row));
      assert.ok(row.top >= 8 && row.right <= expected.width && row.bottom <= expected.height, JSON.stringify(row));
      assert.ok(row.bubbleTop >= 0 && row.bubbleBottom < row.top, JSON.stringify(row));
      assert.equal(row.hit, true, 'Scaled shell receives clicks');
      assert.equal(row.breakClass, phase === 'break');
      assert.equal(row.canvasWidth, Math.round(row.viewport * row.dpr));
      rows.push(row);
    }
    // Open the shell by a real renderer mouse event, then use its controls.
    // The geometry checks above force the peak of a jump. Settle the pet before
    // measuring the click point, or the next animation frame moves it by 14*scale.
    await js(`sudariPet.setAction('idle', 60); sudariPet.yOff = 0; sudariPet.draw(sudariPet._petBox())`);
    await wait(80);
    const point = await js(`(() => { const r = sudariPet.ui.timer.getBoundingClientRect(); return {x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)}; })()`);
    win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
    await until(() => js(`sudariPet.ui.timerPanel.classList.contains('show')`));
    await wait(80); // Allow the next animation frame to lay out the newly visible panel.
    const panel = await js(`(() => { const r = sudariPet.ui.timerPanel.getBoundingClientRect();
      return {top: r.top, left: r.left, right: r.right, bottom: r.bottom}; })()`);
    assert.ok(panel.top >= 0 && panel.left >= 0 && panel.right <= expected.width + 1 && panel.bottom <= expected.height + 1, JSON.stringify({scale, panel}));
    await js(`document.querySelector('[data-k="focusMin"][data-d="-5"]').click(); document.getElementById('tp-close').click()`);
    assert.equal(await js('sudariPet.pomo.endsAt'), deadline, 'Resizing/editing does not restart the running session');
    // Moving the native window must never restore the old 320x300 dimensions.
    await js(`{ const p = sudariPet.bridge.petPos(); sudariAPI.movePet(p.x - 1, p.y); }`);
    await wait(80);
    assert.ok(Math.abs(win.getBounds().width - expected.width) <= 1);
    assert.ok(Math.abs(win.getBounds().height - expected.height) <= 1);
    await js(`sudariPet.action = null; sudariPet.anim = 'idle'; sudariPet.yOff = 0; sudariPet.bubbleUntil = 0; sudariPet.ui.bubble.classList.remove('show'); sudariPet.pomo.phase = 'focus'; sudariPet._renderTimer()`);
    await wait(180);
    const shot = await win.webContents.capturePage();
    assert.equal(shot.isEmpty(), false);
    fs.writeFileSync(path.join(output, `scale-${scale}.png`), shot.toPNG());
  }
  // Complete focus -> break -> final celebration without waiting 25 minutes.
  await js(`sudariPet.pomo.phase = 'focus'; sudariPet.pomo.endsAt = 0; sudariPet._tickPomodoro()`);
  assert.equal(await js('sudariPet.pomo.phase'), 'break');
  await js(`sudariPet.pomo.round = sudariPet.cfg.pomodoro.rounds; sudariPet.pomo.endsAt = 0; sudariPet._tickPomodoro()`);
  assert.equal(await js('sudariPet.pomo'), null);
  assert.equal(await js(`sudariPet.ui.timer.classList.contains('show')`), false);
  assert.equal(await js(`getComputedStyle(sudariPet.ui.timer).pointerEvents`), 'none');
  errors.push(...await js('smokeErrors'));
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(rows, null, 2));
  console.log(`PASS: ${process.platform}/${process.arch}, scales 2–5, shell clicks, panel controls, timer phases, window movement, DPR ${rows[0].dpr}`);
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
setTimeout(() => { console.error('Smoke test exceeded 60 seconds'); app.exit(1); }, 60000).unref();

