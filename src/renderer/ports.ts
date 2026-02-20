import type { NoteInfo } from './window';

export interface NoteRepository {
  list(): Promise<NoteInfo[]>;
  read(title: string): Promise<string>;
  write(title: string, body: string): Promise<void>;
  delete(title: string): Promise<void>;
  rename(oldTitle: string, newTitle: string): Promise<void>;
  onChanged(cb: (notes: NoteInfo[]) => void): void;
}

export interface VaultService {
  getPath(): Promise<string | null>;
  select(): Promise<string | null>;
}

export interface ThemeService {
  isDark(): Promise<boolean>;
  onChanged(cb: (isDark: boolean) => void): void;
}
