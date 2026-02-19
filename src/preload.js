const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Vault
  selectVault: () => ipcRenderer.invoke('vault:select'),
  getVaultPath: () => ipcRenderer.invoke('vault:get'),

  // Notes CRUD
  listNotes: () => ipcRenderer.invoke('notes:list'),
  readNote: (title) => ipcRenderer.invoke('notes:read', title),
  writeNote: (title, body) => ipcRenderer.invoke('notes:write', title, body),
  deleteNote: (title) => ipcRenderer.invoke('notes:delete', title),
  renameNote: (oldTitle, newTitle) => ipcRenderer.invoke('notes:rename', oldTitle, newTitle),

  // File watcher push events
  onNotesChanged: (callback) => {
    ipcRenderer.on('notes:changed', (_event, notes) => callback(notes));
  },

  // Theme
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme:changed', (_event, isDark) => callback(isDark));
  },
  isDarkMode: () => ipcRenderer.invoke('theme:isDark'),
});
