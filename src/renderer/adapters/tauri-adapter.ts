import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { NoteInfo } from '../window';
import type { NoteRepository, VaultService, ThemeService } from '../ports';

export class TauriNoteRepository implements NoteRepository {
  list(): Promise<NoteInfo[] | null> {
    return invoke<NoteInfo[]>('notes_list');
  }

  read(title: string): Promise<string> {
    return invoke<string>('notes_read', { title });
  }

  write(title: string, body: string): Promise<void> {
    return invoke<void>('notes_write', { title, body });
  }

  delete(title: string): Promise<void> {
    return invoke<void>('notes_delete', { title });
  }

  rename(oldTitle: string, newTitle: string): Promise<void> {
    return invoke<void>('notes_rename', { oldTitle, newTitle });
  }

  onChanged(cb: (notes: NoteInfo[]) => void): void {
    listen<NoteInfo[]>('notes:changed', (event) => cb(event.payload));
  }
}

export class TauriVaultService implements VaultService {
  getPath(): Promise<string | null> {
    return invoke<string | null>('vault_get');
  }

  select(): Promise<string | null> {
    return invoke<string | null>('vault_select');
  }
}

export class TauriThemeService implements ThemeService {
  async isDark(): Promise<boolean> {
    const theme = await getCurrentWindow().theme();
    return theme === 'dark';
  }

  onChanged(cb: (isDark: boolean) => void): void {
    getCurrentWindow().onThemeChanged((event) => cb(event.payload === 'dark'));
  }
}
