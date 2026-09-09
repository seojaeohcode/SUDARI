/* Exercise the real event/IPC path after animations and lost pointer capture. */
const {app,BrowserWindow,screen}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sudari-input-'));
app.setPath('userData',profile);app.setLoginItemSettings=()=>{};
fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({language:'en',languageChosen:true,
  muted:false,volume:0.1,scale:2,ambient:{on:false},affection:{on:false,everyMin:40},launchAtLogin:false}));
let cursor={x:0,y:0};
app.whenReady().then(()=>{screen.getCursorScreenPoint=()=>cursor;});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f){for(let i=0;i<100;i++){if(await f())return;await wait(30);}throw Error('Input check timed out');}
const main=require('../main');
app.whenReady().then(async()=>{
  let win;await until(()=>{win=BrowserWindow.getAllWindows()[0];return win&&!win.webContents.isLoading();});
  const js=s=>win.webContents.executeJavaScript(s);
  await until(()=>js('!!window.sudariPet'));await wait(700);
  let interactive=null;
  const ignore=win.setIgnoreMouseEvents.bind(win);
  win.setIgnoreMouseEvents=(value,options)=>{interactive=!value;return ignore(value,options);};
  await js("window.inputErrors=[];addEventListener('error',e=>inputErrors.push(e.message))");
  async function grab(){
    await js('sudariPet.fall.active=false');
    const area=screen.getDisplayMatching(win.getBounds()).workArea;
    await js(`sudariPet.bridge.movePet(${area.x+Math.round(area.width/2-win.getBounds().width/2)},${area.y+area.height-win.getBounds().height})`);
    await wait(50);
    // Move outside first so the native hit-test state must transition back.
    cursor={x:-10000,y:-10000};await wait(80);
    const head=await js(`(()=>{const p=sudariPet,b=p._petBox(),h=p.sprite.meta(p.anim,p.frame).head;
      return {x:Math.round(b.x+h[0]*p.scale),y:Math.round(b.y+h[1]*p.scale)};})()`);
    const bounds=win.getBounds();cursor={x:bounds.x+head.x,y:bounds.y+head.y};
    await until(()=>interactive===true);
    win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...head});
    await until(()=>js('!!sudariPet.drag'));
    return head;
  }
  async function drag(label,during){
    const head=await grab(),before=win.getBounds();
    if(during)await during();
    cursor={x:cursor.x-35,y:cursor.y-15};
    try {
      await until(async()=>{
        assert.equal(await js('!!sudariPet.drag'),true,label+' drag ended before mouse release');
        return win.getBounds().x<before.x-20;
      });
    } catch(error) {
      throw new Error(label+': '+error.message+' '+JSON.stringify({before,after:win.getBounds(),cursor,
        renderer:await js('({drag:sudariPet.drag,cursor:sudariPet.cursor,position:sudariPet.bridge.petPos(),lastRelease:sudariPet._lastDragRelease})')}));
    }
    win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...head});
    await until(()=>js('!sudariPet.drag'));await wait(180);
  }
  for(const scale of [2,3,4,5]){
    await js(`sudariAPI.saveConfig({...sudariPet.cfg,scale:${scale}})`);
    await until(()=>js(`sudariPet.cfg.scale===${scale}`));await wait(100);
    const poses=await js('Object.keys(sudariPet.sprite.atlas.anims)');
    for(const pose of poses){
      await js(`sudariPet.setAction('${pose}',60)`);await wait(50);
      await drag(scale+'x '+pose);
    }
  }
  await js('sudariAPI.saveConfig({...sudariPet.cfg,scale:2})');await wait(180);
  for(const action of ['wave','love','snack','crack','fireworks','stretch','water','float','angry','angry','angry']){
    await js(`sudariPet.command('${action}')`);await wait(100);await drag(action);
  }
  for(const input of ['key','wheel']){
    await drag(input+' during drag',async()=>{
      for(let n=0;n<12;n++){win.webContents.send(input,120);await wait(15);}
    });
    await drag('after '+input);
  }
  // Open the actual right-click menu while dragging, then choose a real menu item.
  for(const key of ['wave','love','timer','settings']){
    const head=await grab();
    win.webContents.sendInputEvent({type:'mouseDown',button:'right',clickCount:1,...head});
    win.webContents.sendInputEvent({type:'mouseUp',button:'right',clickCount:1,...head});
    let menu;await until(()=>{menu=BrowserWindow.getAllWindows().find(w=>w!==win&&w.webContents.getURL().endsWith('menu.html'));return !!menu;});
    await until(()=>js('!sudariPet.drag'));
    win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...head});
    await until(()=>!menu.webContents.isLoading());
    await menu.webContents.executeJavaScript(`document.querySelector('[data-i18n="${key}"]').closest('button').click()`);
    await until(()=>menu.isDestroyed());await wait(120);
    if(key==='settings'){
      let settings;await until(()=>{settings=BrowserWindow.getAllWindows().find(w=>w!==win&&w.webContents.getURL().endsWith('settings.html'));return !!settings;});
      settings.close();
    }
    if(key==='timer')await js('sudariPet.togglePanel(false)');
    await drag('after menu '+key);
  }
  await js('sudariPet.action=null;sudariPet.idleT=100000');await wait(80);
  await grab();
  await js("sudariPet.canvas.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:1,bubbles:true}))");
  assert.equal(await js('!!sudariPet.drag'),false,'Losing capture releases the drag');
  await grab();
  await js("window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,bubbles:true}))");
  assert.equal(await js('!!sudariPet.drag'),false,'Release outside the canvas ends dragging');
  await grab();
  await js("window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))");
  assert.equal(await js('!!sudariPet.drag'),false,'Pointer cancellation recovers an interrupted drag');
  await drag('after missed release');
  assert.deepEqual(await js('inputErrors'),[]);
  console.log('PASS: 17 poses at sizes 2–5, commands, typing, scrolling, right-click menu, settings, idle and capture recovery');app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
setTimeout(()=>{console.error('Input test timeout');app.exit(1);},120000).unref();
