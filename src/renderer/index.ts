// Renderer entry point — runs in Chromium, window.api injected by preload.

import { filterNotes } from './search'
import {
  handleEnterDecision,
  restoreSelectionIndex,
  deleteWordBackward,
} from './app-logic'
import type { NoteInfo } from './window'
import type { NoteRepository, VaultService, ThemeService } from './ports'
import { IpcNoteRepository, IpcVaultService, IpcThemeService } from './adapters/ipc-adapter'
import { ToastController } from './controllers/toast-controller'
import { AutosaveController } from './controllers/autosave-controller'
import { ResizeController } from './controllers/resize-controller'
import { FontSizeController } from './controllers/font-size-controller'
import { PreviewController } from './controllers/preview-controller'
import { RenameController } from './controllers/rename-controller'

export interface AppPorts {
  notes: NoteRepository;
  vault: VaultService;
  theme: ThemeService;
}

window.addEventListener('DOMContentLoaded', async () => {
  const ports: AppPorts = {
    notes: new IpcNoteRepository(),
    vault: new IpcVaultService(),
    theme: new IpcThemeService(),
  };
  await initTheme(ports.theme);
  await initVault(ports);
});

async function initTheme(theme: ThemeService): Promise<void> {
  const dark = await theme.isDark();
  applyTheme(dark);
  theme.onChanged((isDark) => applyTheme(isDark));
}

function applyTheme(isDark: boolean): void {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

async function initVault(ports: AppPorts): Promise<void> {
  const vaultPath = await ports.vault.getPath();
  if (!vaultPath) {
    await promptVaultSelection(ports);
  } else {
    startApp(ports);
  }
}

async function promptVaultSelection(ports: AppPorts): Promise<void> {
  const overlay = document.createElement('div');
  overlay.id = 'vault-overlay';
  overlay.innerHTML = `
    <h1>Welcome to NV</h1>
    <p>Choose a folder to store your notes.</p>
    <button id="vault-pick-btn">Choose Vault Folder</button>
  `;
  document.body.appendChild(overlay);

  document.getElementById('vault-pick-btn')!.addEventListener('click', async () => {
    const chosen = await ports.vault.select();
    if (chosen) {
      overlay.remove();
      startApp(ports);
    }
  });
}

function startApp(ports: AppPorts): void {
  const app = new NVApp(ports);
  app.init();
}

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Required DOM element #${id} not found`);
  return el as T;
}

class NVApp {
  private _searchInput: HTMLInputElement;
  private _resultsList: HTMLUListElement;
  private _editor: HTMLTextAreaElement;

  private _notes: NoteInfo[] = [];
  private _filtered: NoteInfo[] = [];
  private _selectedIndex = -1;
  private _currentTitle: string | null = null;

  private _toast: ToastController;
  private _autosave: AutosaveController;
  private _resize: ResizeController;
  private _fontSize: FontSizeController;
  private _preview: PreviewController;
  private _rename: RenameController;
  private _ports: AppPorts;

  constructor(ports: AppPorts) {
    this._ports = ports;
    this._searchInput = requireElement<HTMLInputElement>('search-input');
    this._resultsList = requireElement<HTMLUListElement>('results-list');
    this._editor = requireElement<HTMLTextAreaElement>('editor');
    const toastEl = requireElement<HTMLDivElement>('toast');
    this._toast = new ToastController(toastEl);
    this._autosave = new AutosaveController(ports.notes, this._toast);
    this._resize = new ResizeController(
      requireElement<HTMLDivElement>('resize-handle'),
      requireElement<HTMLDivElement>('results-panel'),
    );
    this._fontSize = new FontSizeController();
    this._preview = new PreviewController(
      this._editor,
      requireElement<HTMLDivElement>('preview'),
    );
    this._rename = new RenameController(ports.notes, this._toast);
  }

  async init(): Promise<void> {
    await this._loadNotes();
    this._bindEvents();
    this._resize.bind();
    this._fontSize.apply();
    this._searchInput.focus();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  private async _loadNotes(): Promise<void> {
    this._notes = await this._ports.notes.list();
    this._renderResults(this._searchInput.value);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private _renderResults(query: string): void {
    this._filtered = filterNotes(this._notes, query);
    this._resultsList.innerHTML = '';

    if (this._filtered.length === 0) {
      const li = document.createElement('li');
      li.id = 'empty-state';
      li.textContent = query ? `Press Enter to create "${query}"` : 'No notes yet';
      this._resultsList.appendChild(li);
      this._selectedIndex = -1;
      return;
    }

    this._filtered.forEach((note) => {
      const li = document.createElement('li');
      li.dataset.title = note.title;

      const titleEl = document.createElement('div');
      titleEl.className = 'note-title';
      titleEl.textContent = note.title;

      const excerptEl = document.createElement('div');
      excerptEl.className = 'note-excerpt';
      excerptEl.textContent = note.excerpt;

      li.setAttribute('tabindex', '-1');
      li.appendChild(titleEl);
      li.appendChild(excerptEl);
      this._resultsList.appendChild(li);
    });

    this._selectedIndex = restoreSelectionIndex(this._filtered, this._currentTitle);
    this._highlightSelected(false);
  }

  private _highlightSelected(loadEditor = true): void {
    const items = this._resultsList.querySelectorAll('li[data-title]');
    items.forEach((el, i) => {
      const selected = i === this._selectedIndex;
      el.classList.toggle('selected', selected);
      el.setAttribute('tabindex', selected ? '0' : '-1');
    });

    if (loadEditor && this._selectedIndex >= 0 && this._filtered[this._selectedIndex]) {
      this._openNote(this._filtered[this._selectedIndex].title);
    }
  }

  // ── Note operations ───────────────────────────────────────────────────────

  private async _openNote(title: string): Promise<void> {
    if (this._currentTitle === title) return;
    this._autosave.cancel();
    this._currentTitle = title;
    const body = await this._ports.notes.read(title);
    this._editor.value = body;
    if (this._preview.isActive) this._preview.render();
  }

  private async _createNote(title: string): Promise<void> {
    try {
      await this._ports.notes.write(title, '');
    } catch (err) {
      this._toast.show(`Failed to create note: ${(err as Error).message}`);
      return;
    }
    this._searchInput.value = '';
    await this._loadNotes();
    const idx = this._filtered.findIndex((n) => n.title === title);
    if (idx >= 0) this._selectedIndex = idx;
    this._highlightSelected(false);
    this._currentTitle = title;
    this._editor.value = '';
    this._editor.focus();
  }

  private async _deleteCurrentNote(): Promise<void> {
    if (!this._currentTitle) return;
    const deleted = this._currentTitle;
    try {
      await this._ports.notes.delete(deleted);
    } catch (err) {
      this._toast.show(`Failed to delete: ${(err as Error).message}`);
      return;
    }
    this._currentTitle = null;
    this._editor.value = '';
    await this._loadNotes();
    this._searchInput.focus();
    this._toast.show(`"${deleted}" deleted`);
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  private _applyWordBackspace(el: HTMLInputElement | HTMLTextAreaElement): void {
    const { newValue, newCursor } = deleteWordBackward(
      el.value, el.selectionStart!, el.selectionEnd!,
    );
    el.value = newValue;
    el.setSelectionRange(newCursor, newCursor);
  }

  private _bindEvents(): void {
    this._searchInput.addEventListener('input', () => {
      if (this._rename.isActive) return;
      this._renderResults(this._searchInput.value);
      this._highlightSelected(true);
    });

    this._searchInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        this._applyWordBackspace(this._searchInput);
        this._renderResults(this._searchInput.value);
        this._highlightSelected(true);
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this._moveSelectionInList(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this._moveSelectionInList(-1);
          break;
        case 'Enter':
          e.preventDefault();
          if (this._rename.isActive) { this._handleRenameCommit(); } else { this._handleEnter(); }
          break;
        case 'Escape':
          e.preventDefault();
          if (this._rename.isActive) {
            this._rename.cancel(this._searchInput);
            this._renderResults(this._rename.savedQuery);
            this._highlightSelected(false);
          } else if (this._searchInput.value) {
            this._searchInput.value = '';
            this._renderResults('');
            this._highlightSelected(true);
          }
          break;
      }
    });

    this._editor.addEventListener('input', () => {
      if (this._currentTitle) this._autosave.schedule(this._currentTitle, () => this._editor.value);
    });
    this._editor.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        this._applyWordBackspace(this._editor);
        if (this._currentTitle) this._autosave.schedule(this._currentTitle, () => this._editor.value);
        return;
      }
      if (e.key === 'Escape') {
        if (this._currentTitle) this._autosave.cancelAndFlush(this._currentTitle, () => this._editor.value);
        this._searchInput.focus();
        const len = this._searchInput.value.length;
        this._searchInput.setSelectionRange(len, len);
      }
    });

    this._resultsList.addEventListener('focusin', (e) => {
      const li = (e.target as Element).closest('li[data-title]');
      if (!li) return;
      const items = [...this._resultsList.querySelectorAll('li[data-title]')];
      const idx = items.indexOf(li);
      if (idx === -1) return;
      this._selectedIndex = idx;
      this._highlightSelected(false);
      this._openNote(this._filtered[idx]?.title);
    });

    this._resultsList.addEventListener('keydown', (e) => {
      if (!(e.target as Element).closest('li[data-title]')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        this._editor.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._moveSelectionInList(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._moveSelectionInList(-1);
      } else if (e.key === 'Escape') {
        this._searchInput.focus();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        this._deleteCurrentNote();
      }
    });

    this._ports.notes.onChanged((notes) => {
      this._notes = notes;
      this._renderResults(this._searchInput.value);
      this._highlightSelected(true);
    });

    window.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'j') { e.preventDefault(); this._moveSelectionInList(1); }
      else if (e.key === 'k') { e.preventDefault(); this._moveSelectionInList(-1); }
      else if (e.key === 'Delete') { e.preventDefault(); this._deleteCurrentNote(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); this._fontSize.change(1); }
      else if (e.key === '-') { e.preventDefault(); this._fontSize.change(-1); }
      else if (e.key === '0') { e.preventDefault(); this._fontSize.change(0); }
      else if (e.key === 'p') { e.preventDefault(); this._preview.toggle(); }
      else if (e.key === 'd') { e.preventDefault(); this._deleteCurrentNote(); }
      else if (e.key === 'r') { e.preventDefault(); if (this._currentTitle) this._rename.enter(this._currentTitle, this._searchInput); }
    });
  }

  private _moveSelectionInList(delta: number): void {
    if (this._filtered.length === 0) return;
    this._selectedIndex = Math.max(
      0,
      Math.min(this._filtered.length - 1, this._selectedIndex + delta)
    );
    this._highlightSelected(false);
    const items = this._resultsList.querySelectorAll('li[data-title]');
    const item = items[this._selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
    item?.focus();
  }

  private async _handleRenameCommit(): Promise<void> {
    if (!this._currentTitle) return;
    const result = await this._rename.commit(
      this._searchInput,
      this._currentTitle,
      this._notes.map((n) => n.title),
    );
    if (!result) return;
    this._currentTitle = result.newTitle;
    this._renderResults(this._rename.savedQuery);
    this._highlightSelected(false);
  }

  private async _handleEnter(): Promise<void> {
    const decision = handleEnterDecision(
      this._filtered,
      this._selectedIndex,
      this._searchInput.value,
    );
    if (!decision) return;

    if (decision.action === 'open') {
      await this._openNote(decision.title);
      this._editor.focus();
    } else {
      await this._createNote(decision.title);
    }
  }

}
