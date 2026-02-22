import { contextBridge, ipcRenderer } from 'electron';
import type { NoteInfo } from './renderer/window';
import { IPC } from './ipc-channels';

interface WindowApi {
  selectVault(): Promise<string | null>
  getVaultPath(): Promise<string | null>
  listNotes(): Promise<NoteInfo[] | null>
  readNote(title: string): Promise<string>
  writeNote(title: string, body: string): Promise<void>
  deleteNote(title: string): Promise<void>
  renameNote(oldTitle: string, newTitle: string): Promise<void>
  onNotesChanged(cb: (notes: NoteInfo[]) => void): void
  onThemeChanged(cb: (isDark: boolean) => void): void
  isDarkMode(): Promise<boolean>
}

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
