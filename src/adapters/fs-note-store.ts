import path from 'path';
import fs from 'fs';
import { firstNonEmptyLine } from '../notes-helpers';
import type { NoteInfo } from '../renderer/window';
import type { NoteStore } from '../ports/note-store';

export class FsNoteStore implements NoteStore {
  constructor(private _vaultPath: string) {}

  get vaultPath(): string {
    return this._vaultPath;
  }

  set vaultPath(p: string) {
    this._vaultPath = p;
  }

  private _assertSafeTitle(title: string): void {
    if (
      !title ||
      title.includes('/') ||
      title.includes('\\') ||
      title.includes('\0') ||
      title === '.' ||
      title === '..' ||
      title.startsWith('.')
    ) {
      throw new Error(`Invalid note title: "${title}"`);
    }
    const resolved = path.resolve(this._vaultPath, `${title}.md`);
    if (!resolved.startsWith(this._vaultPath + path.sep)) {
      throw new Error(`Invalid note title: "${title}"`);
    }
  }

  private _notePath(title: string): string {
    this._assertSafeTitle(title);
    return path.join(this._vaultPath, `${title}.md`);
  }

  list(): NoteInfo[] {
    let files: string[];
    try {
      files = fs.readdirSync(this._vaultPath);
    } catch {
      return [];
    }

    return files
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .map((f) => {
        const title = f.slice(0, -3);
        const filePath = path.join(this._vaultPath, f);
        let stat: fs.Stats, body: string;
        try {
          stat = fs.statSync(filePath);
          body = fs.readFileSync(filePath, 'utf8');
        } catch {
          return null;
        }
        const excerpt = firstNonEmptyLine(body);
        return { title, excerpt, mtime: stat.mtimeMs };
      })
      .filter((n): n is NoteInfo => n !== null)
      .sort((a, b) => b.mtime - a.mtime);
  }

  read(title: string): string {
    try {
      return fs.readFileSync(this._notePath(title), 'utf8');
    } catch {
      return '';
    }
  }

  write(title: string, body: string): void {
    fs.writeFileSync(this._notePath(title), body, 'utf8');
  }

  delete(title: string): void {
    try {
      fs.unlinkSync(this._notePath(title));
    } catch {
      // already gone
    }
  }

  rename(oldTitle: string, newTitle: string): void {
    fs.renameSync(this._notePath(oldTitle), this._notePath(newTitle));
  }
}
