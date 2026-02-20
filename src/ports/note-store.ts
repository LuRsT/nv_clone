import type { NoteInfo } from '../renderer/window';

export interface NoteStore {
  list(): Promise<NoteInfo[]>;
  read(title: string): Promise<string>;
  write(title: string, body: string): Promise<void>;
  delete(title: string): Promise<void>;
  rename(oldTitle: string, newTitle: string): Promise<void>;
}
