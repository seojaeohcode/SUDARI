/* 수다리 — Electron 메인 프로세스
 * · 투명·프레임 없는 항상 위 창을 띄우고, 수달 위에 커서가 있을 때만 클릭을 받는다.
 * · 전역 커서 위치(폴링), 전역 키/휠 이벤트(PowerShell 후크), AI 상태(로컬 HTTP)를
 *   렌더러로 흘려보낸다.
 */
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, shell, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

// 펫 창은 포커스를 받지 않으므로, 소리를 내려면 자동재생 제한을 풀어야 한다.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const WIN_W = 320;
const WIN_H = 300;
const AGENT_PORT = 37421;

let petWin = null;
let settingsWin = null;
let tray = null;
let hookProc = null;
let uiohook = null;             // macOS/Linux 전역 입력 후크 (uiohook-napi)
let hookState = 'off';          // off | powershell | uiohook | no-permission | failed
let agentServer = null;
let cursorTimer = null;
let config = null;

const CONFIG_PATH = () => path.join(app.getPath('userData'), 'config.json');

const DEFAULT_CONFIG = {
  name: '',
  scale: 2,
  pattern: 'plain',
  baseColor: '#925f3f',
  volume: 0.5,
  muted: false,
  sleepAfterMin: 5,
  peek: false,
  pin: '',
  launchAtLogin: false,
  reactions: { mouse: true, keyboard: true, scroll: true, pet: true },
  stretch: { on: true, everyMin: 50 },
  water: { on: true, everyMin: 60 },
  pomodoro: { on: false, focusMin: 25, breakMin: 5, rounds: 4 },
  reminders: [],
  meals: { breakfast: '', lunch: '12:30', dinner: '18:30' },
  affection: { on: true, everyMin: 40 },
  ambient: { on: true }
};

function loadConfig() {
  try {
    // 메모장/PowerShell이 붙이는 BOM 때문에 설정이 통째로 초기화되지 않게 벗겨낸다
    const raw = fs.readFileSync(CONFIG_PATH(), 'utf8').replace(/^\uFEFF/, '');
    config = Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
  } catch (e) {
    console.error('[수다리] 설정 파일을 읽지 못해 기본값으로 시작합니다:', e.message);
    config = Object.assign({}, DEFAULT_CONFIG);
  }
  return config;
}

function saveConfig(next) {
  config = Object.assign({}, config, next);
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH()), { recursive: true });
    fs.writeFileSync(CONFIG_PATH(), JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[수다리] 설정 저장 실패:', e.message);
  }
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send('config', config);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('config', config);
  applyLaunchAtLogin();
}

function applyLaunchAtLogin() {
  if (process.platform === 'linux') return;
  try {
    app.setLoginItemSettings({ openAtLogin: !!config.launchAtLogin });
  } catch (e) { /* 권한 없으면 조용히 무시 */ }
}

// ------------------------------------------------------------------ 펫 창
function createPetWindow() {
  const wa = screen.getPrimaryDisplay().workArea;

  petWin = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: wa.x + wa.width - WIN_W - 24,
    y: wa.y + wa.height - WIN_H + 2,
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,        // 타이핑 중 포커스를 훔치지 않는다
    alwaysOnTop: true,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  petWin.setAlwaysOnTop(true, 'screen-saver');
  petWin.setIgnoreMouseEvents(true, { forward: true });
  petWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 펫 창은 개발자도구를 열기 번거로우니 렌더러 오류를 터미널로 끌어온다
  petWin.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 2) console.error('[렌더러] ' + message + '  (' + source + ':' + line + ')');
  });

  petWin.webContents.on('did-finish-load', () => {
    pushState();
    petWin.webContents.send('config', config);
    maybeDebugShot();
  });

  petWin.on('closed', () => { petWin = null; });
}

/**
 * 디버그용: SUDARI_SHOT=<파일경로> 로 실행하면 펫 창을 그대로 캡처해 저장하고 종료한다.
 * SUDARI_SHOT_CMD 로 캡처 전에 동작을 하나 시켜볼 수 있다 (예: shell, stretch).
 */
function maybeDebugShot() {
  const out = process.env.SUDARI_SHOT;
  if (!out) return;
  const cmd = process.env.SUDARI_SHOT_CMD;          // 쉼표로 여러 개 가능
  if (cmd) cmd.split(',').forEach((c, i) => setTimeout(() => petCommand(c.trim()), 1500 + i * 400));
  if (process.env.SUDARI_SHOT_SETTINGS) openSettings();
  setTimeout(() => {
    const target = process.env.SUDARI_SHOT_SETTINGS ? settingsWin : petWin;
    target.webContents.capturePage().then((img) => {
      fs.writeFileSync(out, img.toPNG());
      console.log('[수다리] 디버그 캡처 저장: ' + out);
      app.quit();
    }).catch((e) => { console.error(e); app.quit(); });
  }, cmd ? 3200 : 1800);
}

function pushState() {
  if (!petWin || petWin.isDestroyed()) return;
  const b = petWin.getBounds();
  const d = screen.getDisplayNearestPoint({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  petWin.webContents.send('state', { bounds: b, workArea: d.workArea });
}

/** 전역 커서 위치 폴링 — 시선 추적/사냥/쓰다듬기/드래그의 입력원. */
function startCursorPolling() {
  let last = { x: -1, y: -1 };
  cursorTimer = setInterval(() => {
    if (!petWin || petWin.isDestroyed()) return;
    const p = screen.getCursorScreenPoint();
    if (p.x !== last.x || p.y !== last.y) {
      last = p;
      petWin.webContents.send('cursor', p);
    }
  }, 16);
}

// ------------------------------------------------------------------ 전역 입력 후크
/**
 * "키가 눌렸다"와 "휠이 굴렀다"만 받는다. 어떤 키였는지는 어느 경로에서도 읽지 않는다.
 *   Windows : PowerShell + Win32 저수준 후크 (tools/input_hook.ps1)
 *   macOS/Linux : uiohook-napi (macOS 는 접근성·입력 모니터링 권한이 필요)
 * SUDARI_HOOK=uiohook|powershell 로 강제할 수 있다 (테스트용).
 */
function sendInput(kind, value) {
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send(kind, value);
}

function startInputHook() {
  const forced = process.env.SUDARI_HOOK;
  const usePowershell = forced ? forced === 'powershell' : process.platform === 'win32';
  if (usePowershell) return startPowershellHook();
  return startUiohook();
}

/** macOS 에서 접근성 권한이 있는지. prompt=true 면 시스템 설정으로 안내하는 대화상자가 뜬다. */
function macAccessibilityTrusted(prompt) {
  if (process.platform !== 'darwin') return true;
  try { return systemPreferences.isTrustedAccessibilityClient(!!prompt); } catch (e) { return false; }
}

function startUiohook() {
  if (process.platform === 'darwin' && !macAccessibilityTrusted(false)) {
    hookState = 'no-permission';
    console.log('[수다리] macOS 접근성 권한이 없어 키보드/스크롤 반응이 꺼져 있습니다. 트레이 메뉴에서 허용할 수 있어요.');
    return;
  }
  let mod;
  try {
    mod = require('uiohook-napi');
  } catch (e) {
    hookState = 'failed';
    console.error('[수다리] uiohook-napi 를 불러오지 못했습니다 — 키보드/스크롤 반응 없이 계속합니다:', e.message);
    return;
  }
  try {
    uiohook = mod.uIOhook;
    let firstKey = true;
    uiohook.on('keydown', () => {                 // 키 코드는 읽지 않는다
      if (firstKey) { firstKey = false; console.log('[수다리] uiohook 첫 키 이벤트 수신'); }
      sendInput('key');
    });
    uiohook.on('wheel', (e) => sendInput('wheel', Math.round((e.rotation || 1) * 120)));
    uiohook.start();
    hookState = 'uiohook';
    console.log('[수다리] 전역 입력 후크 준비됨 (uiohook)');
  } catch (e) {
    hookState = 'failed';
    uiohook = null;
    console.error('[수다리] uiohook 시작 실패 — 키보드/스크롤 반응 없이 계속합니다:', e.message);
  }
}

function startPowershellHook() {
  // 패키징되면 app.asar 안의 파일은 PowerShell이 읽을 수 없으므로 asarUnpack 된 실제 경로를 쓴다
  const script = path.join(__dirname, 'tools', 'input_hook.ps1').replace('app.asar', 'app.asar.unpacked');
  if (!fs.existsSync(script)) return;

  try {
    hookProc = spawn('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    console.error('[수다리] 입력 후크를 시작할 수 없습니다:', e.message);
    return;
  }

  let buf = '';
  hookProc.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line || !petWin || petWin.isDestroyed()) continue;
      if (line === 'K') sendInput('key');
      else if (line[0] === 'W') sendInput('wheel', parseInt(line.slice(1), 10) || 120);
      else if (line === 'READY') { hookState = 'powershell'; console.log('[수다리] 전역 입력 후크 준비됨 (PowerShell)'); }
    }
  });
  hookProc.stderr.on('data', (d) => console.error('[수다리] 후크:', d.toString().trim()));
  hookProc.on('exit', (code) => {
    // code === null 은 종료 시 우리가 kill한 정상 경로
    if (code) console.error('[수다리] 입력 후크 종료(code ' + code + ') — 키보드/스크롤 반응 없이 계속합니다.');
    hookProc = null;
  });
}

// ------------------------------------------------------------------ AI 에이전트 상태
/** 127.0.0.1 로컬 전용. 훅에서 POST 한 방이면 수달이 같이 고민하고 끝나면 점프한다. */
function startAgentServer() {
  agentServer = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    let state = u.searchParams.get('state') || '';
    if (!state) {
      if (u.pathname === '/thinking') state = 'thinking';
      else if (u.pathname === '/done') state = 'done';
    }
    const text = u.searchParams.get('text') || '';
    if (state && petWin && !petWin.isDestroyed()) {
      petWin.webContents.send('agent', { state, text });
    }
    res.writeHead(state ? 204 : 400);
    res.end();
  });
  agentServer.on('error', (e) => {
    console.error('[수다리] AI 상태 서버 실패(' + e.code + ') — 이 기능만 비활성화됩니다.');
    agentServer = null;
  });
  agentServer.listen(AGENT_PORT, '127.0.0.1');
}

// ------------------------------------------------------------------ 설정 창
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 460,
    height: 700,
    title: '수다리 설정',
    backgroundColor: '#211a15',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ------------------------------------------------------------------ 메뉴
function petCommand(cmd, arg) {
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send('command', cmd, arg);
}

function buildMenu() {
  const scaleItems = [2, 3, 4, 5].map((s) => ({
    label: s + '배',
    type: 'radio',
    checked: config.scale === s,
    click: () => saveConfig({ scale: s })
  }));

  return Menu.buildFromTemplate([
    { label: '수다리 🦦', enabled: false },
    { type: 'separator' },
    { label: '인사해줘', click: () => petCommand('wave') },
    { label: '사랑한다고 해줘 💕', click: () => petCommand('love') },
    { label: '새우 주기 🍤', click: () => petCommand('snack') },
    { label: '조개 까기', click: () => petCommand('crack') },
    { label: '폭죽 🎆', click: () => petCommand('fireworks') },
    { label: '같이 스트레칭', click: () => petCommand('stretch') },
    { label: '물 마시기 알림', click: () => petCommand('water') },
    { label: '배영하기 (둥둥)', click: () => petCommand('float') },
    { type: 'separator' },
    { label: '집중 타이머… (시간 정하기)', click: () => petCommand('timer-panel') },
    {
      label: config.pomodoro && config.pomodoro.on ? '집중 타이머 중단' : '집중 타이머 바로 시작',
      click: () => petCommand(config.pomodoro && config.pomodoro.on ? 'pomodoro-toggle' : 'pomodoro-start')
    },
    {
      label: '빼꼼 모드',
      type: 'checkbox',
      checked: !!config.peek,
      click: () => petCommand('peek-toggle')
    },
    { label: '크기', submenu: scaleItems },
    { type: 'separator' },
    ...(process.platform === 'darwin' && hookState !== 'uiohook' ? [{
      label: '키보드·스크롤 반응 켜기 (접근성 권한 허용)…',
      click: () => {
        macAccessibilityTrusted(true);            // 시스템 설정 안내 대화상자
        petCommand('say', '시스템 설정에서 Sudari 를 허용하고 앱을 다시 켜줘!');
      }
    }] : []),
    { label: '설정…', click: openSettings },
    {
      label: '사용법 / AI 연동 방법 보기',
      click: () => {
        // 패키징된 앱에서는 extraResources 로 복사된 README 를 연다
        const packaged = path.join(process.resourcesPath || '', 'README.md');
        shell.openPath(app.isPackaged && fs.existsSync(packaged) ? packaged : path.join(__dirname, 'README.md'));
      }
    },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() }
  ]);
}

function createTray() {
  // macOS 메뉴바는 22pt — 전용 아이콘(+@2x 자동 선택). 그 외는 32px.
  const icon = path.join(__dirname, 'assets', process.platform === 'darwin' ? 'tray-mac.png' : 'tray.png');
  tray = new Tray(icon);
  tray.setToolTip('수다리 — 내 컴퓨터에 사는 픽셀 수달');
  tray.setContextMenu(buildMenu());
  tray.on('double-click', () => petCommand('wave'));
}

function refreshMenus() {
  if (tray) tray.setContextMenu(buildMenu());
}

// ------------------------------------------------------------------ IPC
ipcMain.handle('config:get', () => config);
ipcMain.handle('config:reset', () => {
  config = Object.assign({}, DEFAULT_CONFIG);
  saveConfig({});
  refreshMenus();
  return config;
});
ipcMain.on('config:save', (_e, c) => { saveConfig(c); refreshMenus(); });

ipcMain.on('win:move', (_e, x, y) => {
  if (!petWin || petWin.isDestroyed()) return;
  petWin.setBounds({ x: Math.round(x), y: Math.round(y), width: WIN_W, height: WIN_H });
  pushState();
});

ipcMain.on('win:interactive', (_e, on) => {
  if (!petWin || petWin.isDestroyed()) return;
  petWin.setIgnoreMouseEvents(!on, { forward: true });
});

ipcMain.on('win:menu', () => {
  const menu = buildMenu();
  const pos = screen.getCursorScreenPoint();
  if (process.platform === 'darwin') {
    // macOS 의 NSMenu 는 비활성 창이 소유해도 바깥 클릭으로 정상 종료된다
    if (petWin && !petWin.isDestroyed()) menu.popup({ window: petWin });
  } else if (tray) {
    // Windows: 펫 창은 focusable:false 라 이 창이 소유한 팝업은 바깥을 클릭해도 닫히지 않는다.
    // 트레이 소유로 띄우면 정상적으로 닫힌다 (position 은 Windows 전용 인자).
    tray.popUpContextMenu(menu, { x: pos.x, y: pos.y });
  } else if (petWin && !petWin.isDestroyed()) {
    // 트레이가 없을 때의 대안: 메뉴가 떠 있는 동안만 창을 포커스 가능하게
    petWin.setFocusable(true);
    petWin.focus();
    menu.popup({
      window: petWin,
      callback: () => { if (petWin && !petWin.isDestroyed()) petWin.setFocusable(false); }
    });
  }
});

ipcMain.on('pet:command', (_e, c, a) => petCommand(c, a));
ipcMain.on('settings:close', () => {
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close();
});

// ------------------------------------------------------------------ 라이프사이클
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => petCommand('wave'));

  app.whenReady().then(() => {
    loadConfig();
    if (process.platform === 'darwin' && app.dock) app.dock.hide();   // 데스크톱 펫은 Dock 에 안 나온다
    createPetWindow();
    createTray();
    startCursorPolling();
    startInputHook();
    startAgentServer();
    applyLaunchAtLogin();

    screen.on('display-metrics-changed', pushState);
    app.on('activate', () => { if (!petWin) createPetWindow(); });
  });

  app.on('window-all-closed', (e) => { /* 트레이로 계속 살아있는다 */ });

  app.on('before-quit', () => {
    if (cursorTimer) clearInterval(cursorTimer);
    if (hookProc) { try { hookProc.kill(); } catch (e) { /* noop */ } }
    if (uiohook) { try { uiohook.stop(); } catch (e) { /* noop */ } }
    if (agentServer) { try { agentServer.close(); } catch (e) { /* noop */ } }
  });
}
