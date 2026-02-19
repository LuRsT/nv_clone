const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  nativeTheme,
} = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { firstNonEmptyLine: _firstNonEmptyLine } = require('./notes-helpers');

// ── Vault config persistence ──────────────────────────────────────────────────

const _configPath = path.join(app.getPath('userData'), 'config.json');

function _readConfig() {
  try {
    return JSON.parse(fs.readFileSync(_configPath, 'utf8'));
  } catch {
    return {};
  }
}

function _writeConfig(data) {
  fs.mkdirSync(path.dirname(_configPath), { recursive: true });
  fs.writeFileSync(_configPath, JSON.stringify(data, null, 2));
}

let _vaultPath = _readConfig().vaultPath || null;
let _watcher = null;
let _mainWindow = null;

// ── Notes helpers ─────────────────────────────────────────────────────────────

function _notePath(title) {
  return path.join(_vaultPath, `${title}.md`);
}

function _listNotes() {
  if (!_vaultPath) return [];

  let files;
  try {
    files = fs.readdirSync(_vaultPath);
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .map((f) => {
      const title = f.slice(0, -3);
      const filePath = path.join(_vaultPath, f);
      let stat, body;
      try {
        stat = fs.statSync(filePath);
        body = fs.readFileSync(filePath, 'utf8');
      } catch {
        return null;
      }
      const excerpt = _firstNonEmptyLine(body);
      return { title, excerpt, mtime: stat.mtimeMs };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
}

// ── File watcher ──────────────────────────────────────────────────────────────

function _startWatcher() {
  if (_watcher) {
    _watcher.close();
    _watcher = null;
  }
  if (!_vaultPath) return;

  _watcher = chokidar.watch(path.join(_vaultPath, '*.md'), {
    depth: 0,
    ignoreInitial: true,
  });

  const _push = () => {
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send('notes:changed', _listNotes());
    }
  };

  _watcher.on('add', _push);
  _watcher.on('change', _push);
  _watcher.on('unlink', _push);
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('vault:get', () => _vaultPath);

ipcMain.handle('vault:select', async () => {
  const result = await dialog.showOpenDialog(_mainWindow, {
    title: 'Choose Vault Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  _vaultPath = result.filePaths[0];
  _writeConfig({ vaultPath: _vaultPath });
  _startWatcher();
  return _vaultPath;
});

ipcMain.handle('notes:list', () => _listNotes());

ipcMain.handle('notes:read', (_event, title) => {
  try {
    return fs.readFileSync(_notePath(title), 'utf8');
  } catch {
    return '';
  }
});

ipcMain.handle('notes:write', (_event, title, body) => {
  if (!_vaultPath) return;
  fs.writeFileSync(_notePath(title), body, 'utf8');
});

ipcMain.handle('notes:rename', (_event, oldTitle, newTitle) => {
  if (!_vaultPath) return;
  fs.renameSync(_notePath(oldTitle), _notePath(newTitle));
});

ipcMain.handle('notes:delete', (_event, title) => {
  if (!_vaultPath) return;
  try {
    fs.unlinkSync(_notePath(title));
  } catch {
    // already gone
  }
});

ipcMain.handle('theme:isDark', () => nativeTheme.shouldUseDarkColors);

// ── Application menu ──────────────────────────────────────────────────────────

function _buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Change Vault…',
          click: async () => {
            const result = await dialog.showOpenDialog(_mainWindow, {
              title: 'Choose Vault Folder',
              properties: ['openDirectory', 'createDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              _vaultPath = result.filePaths[0];
              _writeConfig({ vaultPath: _vaultPath });
              _startWatcher();
              _mainWindow.webContents.send('notes:changed', _listNotes());
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => _mainWindow.webContents.toggleDevTools(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow() {
  _mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
  });

  _mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Push theme changes to renderer
  nativeTheme.on('updated', () => {
    if (!_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors);
    }
  });

  _startWatcher();
  _buildMenu();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (_watcher) _watcher.close();
  if (process.platform !== 'darwin') app.quit();
});
