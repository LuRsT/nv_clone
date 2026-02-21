import type { NoteRepository } from '../ports'
import type { ToastController } from './toast-controller'

const AUTOSAVE_DELAY_MS = 500;

export class AutosaveController {
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _notes: NoteRepository;
  private _toast: ToastController;

  constructor(notes: NoteRepository, toast: ToastController) {
    this._notes = notes;
    this._toast = toast;
  }

  schedule(title: string, body: string): void {
    this.cancel();
    this._saveTimer = setTimeout(() => this._save(title, body), AUTOSAVE_DELAY_MS);
  }

  async cancelAndFlush(title: string, body: string): Promise<void> {
    this.cancel();
    await this._save(title, body);
  }

  cancel(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
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
