import type { NoteRepository } from '../ports'
import type { ToastController } from './toast-controller'

const AUTOSAVE_DELAY_MS = 500;

export class AutosaveController {
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingTitle: string | null = null;
  private _pendingBody: string | null = null;
  private _notes: NoteRepository;
  private _toast: ToastController;

  constructor(notes: NoteRepository, toast: ToastController) {
    this._notes = notes;
    this._toast = toast;
  }

  /** The title of the note with a pending autosave, or null if idle. */
  get pendingTitle(): string | null {
    return this._pendingTitle;
  }

  schedule(title: string, body: string): void {
    this.cancel();
    this._pendingTitle = title;
    this._pendingBody = body;
    this._saveTimer = setTimeout(() => {
      const t = this._pendingTitle;
      const b = this._pendingBody;
      this._clearPending();
      if (t) this._save(t, b!);
    }, AUTOSAVE_DELAY_MS);
  }

  async cancelAndFlush(title: string, body: string): Promise<void> {
    if (!this._saveTimer) return;
    this.cancel();
    await this._save(title, body);
  }

  cancel(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._clearPending();
    }
  }

  private _clearPending(): void {
    this._saveTimer = null;
    this._pendingTitle = null;
    this._pendingBody = null;
  }

  private async _save(title: string, body: string): Promise<void> {
    if (!title) return;
    try {
      await this._notes.write(title, body);
    } catch (err) {
      this._toast.show(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
