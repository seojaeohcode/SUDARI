const { contextBridge, ipcRenderer } = require("electron");

// 렌더러에는 딱 필요한 창구만 노출한다 (nodeIntegration 없음).
contextBridge.exposeInMainWorld("sudariAPI", {
  onState: (cb) => ipcRenderer.on("state", (_e, s) => cb(s)),
  onCursor: (cb) => ipcRenderer.on("cursor", (_e, c) => cb(c)),
  onKey: (cb) => ipcRenderer.on("key", () => cb()),
  onWheel: (cb) => ipcRenderer.on("wheel", (_e, d) => cb(d)),
  onAgent: (cb) => ipcRenderer.on("agent", (_e, m) => cb(m)),
  onCommand: (cb) => ipcRenderer.on("command", (_e, c, a) => cb(c, a)),
  onConfig: (cb) => ipcRenderer.on("config", (_e, c) => cb(c)),

  menuAction: (action, value) => ipcRenderer.send("menu:action", action, value),
  completeWelcome: (language) =>
    ipcRenderer.invoke("welcome:complete", language),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (c) => ipcRenderer.send("config:save", c),
  resetConfig: () => ipcRenderer.invoke("config:reset"),

  movePet: (x, y) => ipcRenderer.send("win:move", x, y),
  setInteractive: (b) => ipcRenderer.send("win:interactive", b),
  contextMenu: () => ipcRenderer.send("win:menu"),
  closeSettings: () => ipcRenderer.send("settings:close"),
  runCommand: (c, a) => ipcRenderer.send("pet:command", c, a),
});
