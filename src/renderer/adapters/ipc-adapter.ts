import type { NoteInfo } from '../window';
import type { NoteRepository, VaultService, ThemeService } from '../ports';

export class IpcNoteRepository implements NoteRepository {
  list(): Promise<NoteInfo[]> {
    return window.api.listNotes();
  }

  read(title: string): Promise<string> {
    return window.api.readNote(title);
  }

  write(title: string, body: string): Promise<void> {
    return window.api.writeNote(title, body);
  }

  delete(title: string): Promise<void> {
    return window.api.deleteNote(title);
  }

  rename(oldTitle: string, newTitle: string): Promise<void> {
    return window.api.renameNote(oldTitle, newTitle);
  }

  onChanged(cb: (notes: NoteInfo[]) => void): void {
    window.api.onNotesChanged(cb);
  }
}

export class IpcVaultService implements VaultService {
  getPath(): Promise<string | null> {
    return window.api.getVaultPath();
  }

  select(): Promise<string | null> {
    return window.api.selectVault();
  }
}

export class IpcThemeService implements ThemeService {
  isDark(): Promise<boolean> {
    return window.api.isDarkMode();
  }

  onChanged(cb: (isDark: boolean) => void): void {
    window.api.onThemeChanged(cb);
  }
}
