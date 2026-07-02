const { app, BrowserWindow, Menu, dialog, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');

const isDevelopment = !app.isPackaged;
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
let mainWindow;

function readWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    return {
      width: Math.max(900, Number(state.width) || 1280),
      height: Math.max(650, Number(state.height) || 820),
      ...(Number.isFinite(state.x) && Number.isFinite(state.y) ? { x: state.x, y: state.y } : {}),
      maximized: Boolean(state.maximized)
    };
  } catch {
    return { width: 1280, height: 820, maximized: false };
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

function createMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Application',
      submenu: [
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

function createWindow() {
  const state = readWindowState();
  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 900,
    minHeight: 650,
    show: false,
    backgroundColor: '#f7f8fc',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'SAS Academy Typing',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  if (state.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.on('close', saveWindowState);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:|^tel:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (url !== current && /^https?:|^mailto:|^tel:/.test(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  const page = isDevelopment
    ? mainWindow.loadURL('http://127.0.0.1:5173')
    : mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  page.catch((error) => dialog.showErrorBox('Unable to start SAS Academy Typing', error.message));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(createMenu());
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    if (!isDevelopment) {
      const publicRoot = path.join(__dirname, '..', 'client', 'dist');
      session.defaultSession.webRequest.onBeforeRequest({ urls: ['file:///*'] }, (details, callback) => {
        const requestedPath = fileURLToPath(details.url);
        const relativeAsset = requestedPath.replace(/^[/\\]+/, '');
        const isPublicAsset = relativeAsset === 'logo.png' || relativeAsset === 'favicon.png' || relativeAsset.startsWith(`assets${path.sep}`);
        if (isPublicAsset) callback({ redirectURL: pathToFileURL(path.join(publicRoot, relativeAsset)).href });
        else callback({});
      });
    }
    session.defaultSession.on('will-download', (_event, item) => {
      const selected = dialog.showSaveDialogSync(mainWindow, {
        title: 'Save download',
        defaultPath: item.getFilename()
      });
      if (selected) item.setSavePath(selected);
      else item.cancel();
    });
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
