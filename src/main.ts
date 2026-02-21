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
import fsPromises from 'fs/promises';
import chokidar from 'chokidar';
import { FsNoteStore } from './adapters/fs-note-store';

const WINDOW_WIDTH = 900;
const WINDOW_HEIGHT = 700;
const WINDOW_MIN_WIDTH = 500;
const WINDOW_MIN_HEIGHT = 400;

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

  let _pushTimer: ReturnType<typeof setTimeout> | null = null;
  const _push = () => {
    if (_pushTimer) clearTimeout(_pushTimer);
    _pushTimer = setTimeout(async () => {
      _pushTimer = null;
      if (_mainWindow && !_mainWindow.isDestroyed() && _noteStore) {
        _mainWindow.webContents.send('notes:changed', await _noteStore.list());
      }
    }, 100);
  };

  _watcher.on('add', _push);
  _watcher.on('change', _push);
  _watcher.on('unlink', _push);
  _watcher.on('error', (err) => {
    console.error('File watcher error:', err);
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('vault:get', () => _vaultPath);

ipcMain.handle('vault:select', async () => {
  if (!_mainWindow) return null;
  const result = await dialog.showOpenDialog(_mainWindow, {
    title: 'Choose Vault Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const selected = result.filePaths[0];
  try {
    await fsPromises.access(selected, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    return null;
  }

  _setVault(selected);
  _writeConfig({ vaultPath: _vaultPath as string });
  _startWatcher();
  return _vaultPath;
});

ipcMain.handle('notes:list', async () => {
  if (!_noteStore) return null;
  try {
    return await _noteStore.list();
  } catch {
    return [];
  }
});

ipcMain.handle('notes:read', async (_event, title: string) => {
  try {
    return (await _noteStore?.read(title)) ?? '';
  } catch {
    return '';
  }
});

ipcMain.handle('notes:write', async (_event, title: string, body: string) => {
  try {
    await _noteStore?.write(title, body);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to write note');
  }
});

ipcMain.handle('notes:rename', async (_event, oldTitle: string, newTitle: string) => {
  try {
    await _noteStore?.rename(oldTitle, newTitle);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to rename note');
  }
});

ipcMain.handle('notes:delete', async (_event, title: string) => {
  try {
    await _noteStore?.delete(title);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete note');
  }
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
            if (!_mainWindow) return;
            const result = await dialog.showOpenDialog(_mainWindow, {
              title: 'Choose Vault Folder',
              properties: ['openDirectory', 'createDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const selected = result.filePaths[0];
              try {
                await fsPromises.access(selected, fs.constants.R_OK | fs.constants.W_OK);
              } catch {
                return;
              }
              _setVault(selected);
              _writeConfig({ vaultPath: _vaultPath as string });
              _startWatcher();
              if (_noteStore && !_mainWindow.isDestroyed()) {
                _mainWindow.webContents.send('notes:changed', await _noteStore.list());
              }
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
          click: () => _mainWindow?.webContents.toggleDevTools(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow(): void {
  _mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
  });

  _mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Push theme changes to renderer (remove previous listener to avoid stacking)
  nativeTheme.removeAllListeners('updated');
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
