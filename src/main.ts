import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  nativeTheme,
} from 'electron';
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import { FsNoteStore } from './adapters/fs-note-store';

// ── Vault config persistence ──────────────────────────────────────────────────

const _configPath = path.join(app.getPath('userData'), 'config.json');

function _readConfig(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(_configPath, 'utf8'));
  } catch {
    return {};
  }
}

function _writeConfig(data: Record<string, string>): void {
  fs.mkdirSync(path.dirname(_configPath), { recursive: true });
  fs.writeFileSync(_configPath, JSON.stringify(data, null, 2));
}

let _vaultPath: string | null = _readConfig().vaultPath || null;
let _noteStore: FsNoteStore | null = _vaultPath ? new FsNoteStore(_vaultPath) : null;
let _watcher: ReturnType<typeof chokidar.watch> | null = null;
let _mainWindow: BrowserWindow | null = null;

function _setVault(vaultPath: string): void {
  _vaultPath = vaultPath;
  if (_noteStore) {
    _noteStore.vaultPath = vaultPath;
  } else {
    _noteStore = new FsNoteStore(vaultPath);
  }
}

// ── File watcher ──────────────────────────────────────────────────────────────

function _startWatcher(): void {
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
    if (_mainWindow && !_mainWindow.isDestroyed() && _noteStore) {
      _mainWindow.webContents.send('notes:changed', _noteStore.list());
    }
  };

  _watcher.on('add', _push);
  _watcher.on('change', _push);
  _watcher.on('unlink', _push);
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('vault:get', () => _vaultPath);

ipcMain.handle('vault:select', async () => {
  const result = await dialog.showOpenDialog(_mainWindow!, {
    title: 'Choose Vault Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  _setVault(result.filePaths[0]);
  _writeConfig({ vaultPath: _vaultPath! });
  _startWatcher();
  return _vaultPath;
});

ipcMain.handle('notes:list', () => _noteStore?.list() ?? []);

ipcMain.handle('notes:read', (_event, title: string) => {
  return _noteStore?.read(title) ?? '';
});

ipcMain.handle('notes:write', (_event, title: string, body: string) => {
  _noteStore?.write(title, body);
});

ipcMain.handle('notes:rename', (_event, oldTitle: string, newTitle: string) => {
  _noteStore?.rename(oldTitle, newTitle);
});

ipcMain.handle('notes:delete', (_event, title: string) => {
  _noteStore?.delete(title);
});

ipcMain.handle('theme:isDark', () => nativeTheme.shouldUseDarkColors);

// ── Application menu ──────────────────────────────────────────────────────────

function _buildMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Change Vault…',
          click: async () => {
            const result = await dialog.showOpenDialog(_mainWindow!, {
              title: 'Choose Vault Folder',
              properties: ['openDirectory', 'createDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              _setVault(result.filePaths[0]);
              _writeConfig({ vaultPath: _vaultPath! });
              _startWatcher();
              _mainWindow!.webContents.send('notes:changed', _noteStore!.list());
            }
          },
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => _mainWindow!.webContents.toggleDevTools(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow(): void {
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
    if (_mainWindow && !_mainWindow.isDestroyed()) {
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
