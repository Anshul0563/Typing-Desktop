const { app, BrowserWindow, Menu, Notification, dialog, ipcMain, powerSaveBlocker, screen, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');

const APP_NAME = 'SAS Academy Typing';
const MIN_WIDTH = 900;
const MIN_HEIGHT = 650;
const DEFAULT_BOUNDS = { width: 1280, height: 820 };
const isDevelopment = !app.isPackaged;
let mainWindow;
let typingActive = false;
let powerSaveBlockerId = null;
let quitting = false;
let stateSaveTimer;

app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('in.sasacademy.typing');

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
const hasWindowState = () => fs.existsSync(stateFile());

function isVisibleOnAnyDisplay(bounds) {
  return screen.getAllDisplays().some(({ workArea }) => {
    const overlapWidth = Math.max(0, Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x));
    const overlapHeight = Math.max(0, Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y));
    return overlapWidth >= 100 && overlapHeight >= 100;
  });
}

function readWindowState() {
  try {
    const value = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const bounds = {
      width: Math.max(MIN_WIDTH, Number(value.width) || DEFAULT_BOUNDS.width),
      height: Math.max(MIN_HEIGHT, Number(value.height) || DEFAULT_BOUNDS.height),
      x: Number(value.x),
      y: Number(value.y)
    };
    const positioned = Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && isVisibleOnAnyDisplay(bounds);
    return { ...(positioned ? bounds : { width: bounds.width, height: bounds.height }), maximized: Boolean(value.maximized) };
  } catch {
    return { ...DEFAULT_BOUNDS, maximized: false };
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.isMaximized() ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }));
  } catch (error) {
    console.warn(`Could not save window state: ${error.message}`);
  }
}

function scheduleWindowStateSave() {
  clearTimeout(stateSaveTimer);
  stateSaveTimer = setTimeout(saveWindowState, 250);
}

function setTypingActive(active) {
  typingActive = Boolean(active);
  if (typingActive && powerSaveBlockerId === null) powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  if (!typingActive && powerSaveBlockerId !== null) {
    if (powerSaveBlocker.isStarted(powerSaveBlockerId)) powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
}

function confirmEndActiveTest() {
  if (!typingActive || !mainWindow || mainWindow.isDestroyed()) return true;
  return dialog.showMessageBoxSync(mainWindow, {
    type: 'warning',
    buttons: ['Keep typing', 'Close application'],
    defaultId: 0,
    cancelId: 0,
    title: 'Typing test in progress',
    message: 'A typing test is currently in progress.',
    detail: 'Closing the application may end the active attempt.'
  }) === 1;
}

function safeOpenExternal(url) {
  try {
    const protocol = new URL(url).protocol;
    if (['https:', 'http:', 'mailto:', 'tel:'].includes(protocol)) void shell.openExternal(url);
  } catch {
    // Ignore malformed or unsupported external URLs.
  }
}

function createMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Application',
      submenu: [
        { label: 'Home', accelerator: 'Alt+Home', click: () => mainWindow?.webContents.send('desktop:navigate', '/') },
        { role: 'reload' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
        ...(isDevelopment ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : [])
      ]
    },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] }
  ]);
}

function showNativeContextMenu(webContents, params) {
  const template = [];
  if (params.isEditable) {
    template.push(
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    );
  } else if (params.selectionText) template.push({ role: 'copy' }, { role: 'selectAll' });
  if (template.length) Menu.buildFromTemplate(template).popup({ window: BrowserWindow.fromWebContents(webContents) });
}

function registerDesktopIpc() {
  ipcMain.on('desktop:typing-active', (_event, active) => setTypingActive(active));
  ipcMain.handle('desktop:notify', (_event, { title, body } = {}) => {
    if (!Notification.isSupported()) return false;
    new Notification({ title: String(title || APP_NAME).slice(0, 80), body: String(body || '').slice(0, 240), icon: path.join(__dirname, 'assets', 'icon.png') }).show();
    return true;
  });
  ipcMain.handle('desktop:show-item', (_event, targetPath) => {
    if (typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) return false;
    shell.showItemInFolder(targetPath);
    return true;
  });
}

function createWindow() {
  const firstLaunch = !hasWindowState();
  const state = readWindowState();
  mainWindow = new BrowserWindow({
    ...state,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: '#f7f8fc',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: APP_NAME,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.webContents.setVisualZoomLevelLimits(0.75, 2);
  if (state.maximized || firstLaunch) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => { mainWindow.show(); mainWindow.focus(); });
  mainWindow.on('resize', scheduleWindowStateSave);
  mainWindow.on('move', scheduleWindowStateSave);
  mainWindow.on('close', (event) => {
    saveWindowState();
    if (!quitting && typingActive) {
      event.preventDefault();
      if (confirmEndActiveTest()) {
        quitting = true;
        setTypingActive(false);
        setImmediate(() => mainWindow?.destroy());
      }
    }
  });

  mainWindow.webContents.on('context-menu', showNativeContextMenu);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { safeOpenExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    const developmentOrigin = 'http://127.0.0.1:5173';
    const isInternal = url.startsWith('file:') || (isDevelopment && url.startsWith(developmentOrigin));
    if (url !== current && !isInternal) { event.preventDefault(); safeOpenExternal(url); }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    setTypingActive(false);
    if (quitting || details.reason === 'clean-exit') return;
    const response = dialog.showMessageBoxSync(mainWindow, {
      type: 'error', buttons: ['Restart application', 'Close'], defaultId: 0, cancelId: 1,
      title: `${APP_NAME} stopped responding`, message: 'The application renderer stopped unexpectedly.',
      detail: `Reason: ${details.reason}. Your saved results and account data are unaffected.`
    });
    if (response === 0) mainWindow.reload(); else mainWindow.close();
  });
  mainWindow.on('unresponsive', () => {
    const response = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning', buttons: ['Wait', 'Reload'], defaultId: 0, cancelId: 0,
      title: `${APP_NAME} is not responding`, message: 'The application is taking longer than expected to respond.'
    });
    if (response === 1) { setTypingActive(false); mainWindow.reload(); }
  });

  const page = isDevelopment
    ? mainWindow.loadURL('http://127.0.0.1:5173')
    : mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  page.catch((error) => dialog.showErrorBox(`Unable to start ${APP_NAME}`, error.message));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.on('before-quit', (event) => {
    if (!quitting && typingActive) {
      event.preventDefault();
      if (!confirmEndActiveTest()) return;
      quitting = true;
      setTypingActive(false);
      mainWindow?.destroy();
      app.quit();
      return;
    }
    quitting = true;
    setTypingActive(false);
    saveWindowState();
  });

  app.whenReady().then(() => {
    registerDesktopIpc();
    Menu.setApplicationMenu(createMenu());
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    if (!isDevelopment) {
      const publicRoot = path.resolve(__dirname, '..', 'client', 'dist');
      session.defaultSession.webRequest.onBeforeRequest({ urls: ['file:///*'] }, (details, callback) => {
        try {
          const requestedPath = fileURLToPath(details.url);
          const relativeAsset = requestedPath.replace(/^[/\\]+/, '');
          const target = path.resolve(publicRoot, relativeAsset);
          const allowed = target.startsWith(`${publicRoot}${path.sep}`) && (relativeAsset === 'logo.png' || relativeAsset === 'favicon.png' || relativeAsset.startsWith(`assets${path.sep}`));
          callback(allowed && fs.existsSync(target) ? { redirectURL: pathToFileURL(target).href } : {});
        } catch { callback({ cancel: true }); }
      });
    }
    session.defaultSession.on('will-download', (_event, item) => {
      const selected = dialog.showSaveDialogSync(mainWindow, { title: 'Save download', defaultPath: item.getFilename() });
      if (!selected) { item.cancel(); return; }
      item.setSavePath(selected);
      item.once('done', (_downloadEvent, state) => {
        if (state === 'completed' && Notification.isSupported()) {
          const notification = new Notification({ title: 'Download complete', body: path.basename(selected), icon: path.join(__dirname, 'assets', 'icon.png') });
          notification.on('click', () => shell.showItemInFolder(selected));
          notification.show();
        }
      });
    });
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch((error) => dialog.showErrorBox(`${APP_NAME} startup failed`, error.message));
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
