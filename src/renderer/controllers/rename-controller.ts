import { validateRename } from '../app-logic'
import type { NoteRepository } from '../ports'
import type { ToastController } from './toast-controller'

export class RenameController {
  private _renameMode = false;
  private _savedQuery = '';
  private _notes: NoteRepository;
  private _toast: ToastController;

  constructor(notes: NoteRepository, toast: ToastController) {
    this._notes = notes;
    this._toast = toast;
  }

  get isActive(): boolean {
    return this._renameMode;
  }

  enter(currentTitle: string, searchInput: HTMLInputElement): void {
    if (!currentTitle) return;
    this._renameMode = true;
    this._savedQuery = searchInput.value;
    searchInput.value = currentTitle;
    searchInput.placeholder = 'Rename…';
    searchInput.classList.add('rename-mode');
    searchInput.select();
    searchInput.focus();
  }

  async commit(
    searchInput: HTMLInputElement,
    currentTitle: string,
    allTitles: string[],
  ): Promise<{ newTitle: string } | null> {
    const newTitle = searchInput.value.trim();
    const error = validateRename(newTitle, currentTitle, allTitles);
    if (error) {
      this._toast.show(error);
      return null;
    }

    if (newTitle !== currentTitle) {
      try {
        await this._notes.rename(currentTitle, newTitle);
      } catch (err) {
        this._toast.show(`Failed to rename: ${(err as Error).message}`);
        return null;
      }
    }
    this._exit(searchInput);
    return { newTitle };
  }

  cancel(searchInput: HTMLInputElement): void {
    this._exit(searchInput);
  }

  get savedQuery(): string {
    return this._savedQuery;
  }

  private _exit(searchInput: HTMLInputElement): void {
    this._renameMode = false;
    searchInput.placeholder = 'Search or create note…';
    searchInput.classList.remove('rename-mode');
    searchInput.value = this._savedQuery;
  }
}
