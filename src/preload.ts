import { contextBridge, ipcRenderer } from 'electron';
import type { NoteInfo, WindowApi } from './renderer/window';

const api: WindowApi = {
  // Vault
  selectVault: () => ipcRenderer.invoke('vault:select'),
  getVaultPath: () => ipcRenderer.invoke('vault:get'),

  // Notes CRUD
  listNotes: () => ipcRenderer.invoke('notes:list'),
  readNote: (title: string) => ipcRenderer.invoke('notes:read', title),
  writeNote: (title: string, body: string) => ipcRenderer.invoke('notes:write', title, body),
  deleteNote: (title: string) => ipcRenderer.invoke('notes:delete', title),
  renameNote: (oldTitle: string, newTitle: string) => ipcRenderer.invoke('notes:rename', oldTitle, newTitle),

  // File watcher push events
  onNotesChanged: (callback: (notes: NoteInfo[]) => void) => {
    ipcRenderer.on('notes:changed', (_event, notes) => callback(notes));
  },

  // Theme
  onThemeChanged: (callback: (isDark: boolean) => void) => {
    ipcRenderer.on('theme:changed', (_event, isDark) => callback(isDark));
  },
  isDarkMode: () => ipcRenderer.invoke('theme:isDark'),
};

contextBridge.exposeInMainWorld('api', api);
