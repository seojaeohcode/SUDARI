/* Real Electron regression test. Uses a separate profile; never changes user settings. */
const { app, BrowserWindow, screen } = require('electron');
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
  scale: 2, language:'en', languageChosen:true, muted: true, launchAtLogin: false,
  ambient: { on: false }, affection: { on: false, everyMin: 40 }
}));
const density = (process.argv.find(a=>a.startsWith('--force-device-scale-factor='))||'=1').split('=')[1];
const output = path.join(__dirname, '..', 'test-results', `${process.platform}-${process.arch}`, 'dpr-'+density);
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
const main = require('../main');

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
    const expected = layout.size(scale,screen.getDisplayMatching(win.getBounds()).workArea);
    const actualScale = layout.effectiveScale(scale,expected);
    await until(async () => await js(`sudariPet.scale === ${actualScale} && sudariPet.vh === innerHeight && sudariPet.vw === innerWidth && Math.abs(innerWidth - ${expected.width}) <= 1 && Math.abs(innerHeight - ${expected.height}) <= 1`));
    // Windows rounds physical pixel edges independently at fractional display density.
    assert.ok(Math.abs(win.getBounds().width - expected.width) <= 2, 'Native window width follows scale');
    assert.ok(Math.abs(win.getBounds().height - expected.height) <= 2, 'Native window height follows scale '+JSON.stringify({expected,actual:win.getBounds(),scale,area:screen.getDisplayMatching(win.getBounds()).workArea}));
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
      assert.ok(Math.abs(row.width - 132 * actualScale / 2) < 1, JSON.stringify(row));
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
    assert.ok(Math.abs(win.getBounds().width - expected.width) <= 2);
    assert.ok(Math.abs(win.getBounds().height - expected.height) <= 2);
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
  const stateChecks=await js(`(()=>{
    const p=sudariPet, deadlines=[p.stretchAt,p.waterAt,p.affectionAt];
    p.applyConfig({...p.cfg,name:'QA'});
    const same=JSON.stringify(deadlines)===JSON.stringify([p.stretchAt,p.waterAt,p.affectionAt]);
    const before=p.affectionAt;p.applyConfig(Sudari.Pet.deepMerge(p.cfg,{affection:{everyMin:6}}));
    const intervalChanged=p.affectionAt!==before;
    for(let i=0;i<12;i++)p.sprite.recolor(Sudari.derivePalette('#'+(0x445566+i*123).toString(16)));
    const cacheSize=Object.keys(p.sprite._recolorCache).length;p.applyConfig({...p.cfg,name:''});
    return {same,intervalChanged,cacheSize};
  })()`);
  assert.equal(stateChecks.same,true,'Unrelated settings retain reminder deadlines');
  assert.equal(stateChecks.intervalChanged,true,'Changing a reminder interval takes effect immediately');
  assert.ok(stateChecks.cacheSize<=8,'Color-picker memory stays bounded');
  // Every locale in native menu, timer and settings (including long translations and RTL).
  main.openSettings();
  const settings=await until(()=>BrowserWindow.getAllWindows().find(w=>w!==win));
  const sj=code=>settings.webContents.executeJavaScript(code);
  await until(async()=>!settings.webContents.isLoading() && await sj('!!document.getElementById("language").options.length'));
  main.openMenu();
  const menu=await until(()=>BrowserWindow.getAllWindows().find(w=>w!==win&&w!==settings));
  const mj=code=>menu.webContents.executeJavaScript(code);
  await until(async()=>!menu.webContents.isLoading()&&await mj('!!document.querySelector("#quick button")'));
  const I=require('../renderer/i18n');
  for(const language of I.languages){
    await js(`sudariAPI.saveConfig({...sudariPet.cfg,language:'${language.id}',pin:'',pomodoro:{on:true,focusMin:25,breakMin:5,rounds:4}})`);
    await until(()=>sj(`document.documentElement.lang==='${language.id}'`));
    await until(()=>js(`document.documentElement.lang==='${language.id}'`));
    const labels=main.buildMenu().items.map(i=>i.label).filter(Boolean);
    assert.ok(labels.some(l=>l.includes(I.t('settings',{},language.id))),labels.join(','));
    assert.ok(labels.every(l=>!l.includes('undefined')));
    await until(()=>mj(`document.documentElement.lang==='${language.id}'`));
    assert.equal(await mj('document.documentElement.scrollWidth>innerWidth'),false,language.id+' menu width');
    const checks=await sj(`({language:document.getElementById('language').value,overflow:document.documentElement.scrollWidth>innerWidth,dir:document.documentElement.dir,missing:[...document.querySelectorAll('[data-i18n]')].filter(e=>!e.textContent.trim()).length})`);
    assert.equal(checks.language,language.id);assert.equal(checks.dir,language.dir);assert.equal(checks.overflow,false);assert.equal(checks.missing,0);
    for(const key of ['appearance','reactions','timer','reminders','messages','system']){
      await sj(`document.getElementById('tab-${key}').click()`);
      assert.equal(await sj(`document.getElementById('section-${key}').hidden`),false);
      assert.equal(await sj('document.documentElement.scrollWidth>innerWidth'),false);
    }
    await sj(`document.getElementById('tab-appearance').click()`);
    await js(`sudariPet.togglePanel(true)`);await wait(30);
    const clipping=await js(`(()=>{const r=sudariPet.ui.timerPanel.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1;})()`);
    assert.equal(clipping,false,language.id+' panel');
    if(['en','ko','de','ar','ja'].includes(language.id)){
      fs.writeFileSync(path.join(output,'menu-'+language.id+'.png'),(await menu.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(output,'settings-'+language.id+'.png'),(await settings.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(output,'panel-'+language.id+'.png'),(await win.webContents.capturePage()).toPNG());
    }
    await js(`sudariPet.togglePanel(false)`);
  }
  menu.close();
  settings.setSize(440,680);await wait(80);
  assert.equal(await sj('document.documentElement.scrollWidth>innerWidth'),false,'Narrow settings do not overflow');
  fs.writeFileSync(path.join(output,'settings-narrow-ar.png'),(await settings.webContents.capturePage()).toPNG());
  settings.close();
  errors.push(...await js('smokeErrors'));
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(rows, null, 2));
  console.log(`PASS: ${process.platform}/${process.arch}, scales 2–5, shell clicks, panel controls, timer phases, window movement, DPR ${rows[0].dpr}`);
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
setTimeout(() => { console.error('Smoke test exceeded 120 seconds'); app.exit(1); }, 120000).unref();

