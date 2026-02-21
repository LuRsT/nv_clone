export interface NoteInfo { title: string; excerpt: string; body: string; mtime: number }

export interface WindowApi {
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

declare global {
  interface Window { api: WindowApi }
}
