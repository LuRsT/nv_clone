import { contextBridge, ipcRenderer } from 'electron';
import type { NoteInfo, WindowApi } from './renderer/window';
import { IPC } from './ipc-channels';

const api: WindowApi = {
  // Vault
  selectVault: () => ipcRenderer.invoke(IPC.VAULT_SELECT),
  getVaultPath: () => ipcRenderer.invoke(IPC.VAULT_GET),

  // Notes CRUD
  listNotes: () => ipcRenderer.invoke(IPC.NOTES_LIST),
  readNote: (title: string) => ipcRenderer.invoke(IPC.NOTES_READ, title),
  writeNote: (title: string, body: string) => ipcRenderer.invoke(IPC.NOTES_WRITE, title, body),
  deleteNote: (title: string) => ipcRenderer.invoke(IPC.NOTES_DELETE, title),
  renameNote: (oldTitle: string, newTitle: string) => ipcRenderer.invoke(IPC.NOTES_RENAME, oldTitle, newTitle),

  // File watcher push events
  onNotesChanged: (callback: (notes: NoteInfo[]) => void) => {
    ipcRenderer.on(IPC.NOTES_CHANGED, (_event, notes) => callback(notes));
  },

  // Theme
  onThemeChanged: (callback: (isDark: boolean) => void) => {
    ipcRenderer.on(IPC.THEME_CHANGED, (_event, isDark) => callback(isDark));
  },
  isDarkMode: () => ipcRenderer.invoke(IPC.THEME_IS_DARK),
};

contextBridge.exposeInMainWorld('api', api);
