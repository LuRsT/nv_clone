import path from 'path';
import fs from 'fs/promises';
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

  async list(): Promise<NoteInfo[]> {
    let files: string[];
    try {
      files = await fs.readdir(this._vaultPath);
    } catch {
      return [];
    }

    const results = await Promise.all(
      files
        .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
        .map(async (f) => {
          const title = f.slice(0, -3);
          const filePath = path.join(this._vaultPath, f);
          try {
            const [stat, body] = await Promise.all([
              fs.stat(filePath),
              fs.readFile(filePath, 'utf8'),
            ]);
            const excerpt = firstNonEmptyLine(body);
            return { title, excerpt, body, mtime: stat.mtimeMs };
          } catch {
            return null;
          }
        }),
    );

    return results
      .filter((n): n is NoteInfo => n !== null)
      .sort((a, b) => b.mtime - a.mtime);
  }

  async read(title: string): Promise<string> {
    try {
      return await fs.readFile(this._notePath(title), 'utf8');
    } catch {
      return '';
    }
  }

  async write(title: string, body: string): Promise<void> {
    await fs.writeFile(this._notePath(title), body, 'utf8');
  }

  async delete(title: string): Promise<void> {
    try {
      await fs.unlink(this._notePath(title));
    } catch {
      // already gone
    }
  }

  async rename(oldTitle: string, newTitle: string): Promise<void> {
    await fs.rename(this._notePath(oldTitle), this._notePath(newTitle));
  }
}
