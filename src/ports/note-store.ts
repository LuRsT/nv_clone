import type { NoteInfo } from '../renderer/window';

export interface NoteStore {
  list(): NoteInfo[];
  read(title: string): string;
  write(title: string, body: string): void;
  delete(title: string): void;
  rename(oldTitle: string, newTitle: string): void;
}
