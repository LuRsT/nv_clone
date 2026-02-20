// Renderer entry point — runs in Chromium, window.api injected by preload.

import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { filterNotes } from './search'
import {
  handleEnterDecision,
  restoreSelectionIndex,
  adjustFontSize,
  FONT_SIZE_DEFAULT,
  deleteWordBackward,
  validateRename,
} from './app-logic'
import type { NoteInfo } from './window'
import type { NoteRepository, VaultService, ThemeService } from './ports'
import { IpcNoteRepository, IpcVaultService, IpcThemeService } from './adapters/ipc-adapter'
import { ToastController } from './controllers/toast-controller'
import { AutosaveController } from './controllers/autosave-controller'

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

class NVApp {
  private _searchInput: HTMLInputElement;
  private _resultsList: HTMLUListElement;
  private _editor: HTMLTextAreaElement;
  private _preview: HTMLDivElement;
  private _resizeHandle: HTMLDivElement;
  private _resultsPanel: HTMLDivElement;

  private _notes: NoteInfo[] = [];
  private _filtered: NoteInfo[] = [];
  private _selectedIndex = -1;
  private _currentTitle: string | null = null;

  private _previewMode = false;
  private _renameMode = false;
  private _savedQuery = '';
  private _resultsPanelHeight = 200;
  private _fontSize: number;

  private _toast: ToastController;
  private _autosave: AutosaveController;
  private _ports: AppPorts;

  constructor(ports: AppPorts) {
    this._ports = ports;
    this._searchInput = document.getElementById('search-input') as HTMLInputElement;
    this._resultsList = document.getElementById('results-list') as HTMLUListElement;
    this._editor = document.getElementById('editor') as HTMLTextAreaElement;
    this._preview = document.getElementById('preview') as HTMLDivElement;
    this._resizeHandle = document.getElementById('resize-handle') as HTMLDivElement;
    this._resultsPanel = document.getElementById('results-panel') as HTMLDivElement;
    this._toast = new ToastController(document.getElementById('toast') as HTMLDivElement);
    this._autosave = new AutosaveController(ports.notes, this._toast);

    this._fontSize = parseInt(localStorage.getItem('app-font-size') ?? '', 10) || FONT_SIZE_DEFAULT;
  }

  async init(): Promise<void> {
    await this._loadNotes();
    this._bindEvents();
    this._bindResizeHandle();
    this._applyResultsPanelHeight();
    this._applyFontSize();
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
    if (this._previewMode) this._renderPreview();
  }

  private async _createNote(title: string): Promise<void> {
    try {
      await this._ports.notes.write(title, '');
    } catch (err) {
      this._toast.show(`Failed to create note: ${(err as Error).message}`);
      return;
    }
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

  // ── Rename mode ─────────────────────────────────────────────────────────────

  private _enterRenameMode(): void {
    if (!this._currentTitle) return;
    this._renameMode = true;
    this._savedQuery = this._searchInput.value;
    this._searchInput.value = this._currentTitle;
    this._searchInput.placeholder = 'Rename…';
    this._searchInput.classList.add('rename-mode');
    this._searchInput.select();
    this._searchInput.focus();
  }

  private async _commitRename(): Promise<void> {
    const newTitle = this._searchInput.value.trim();
    const error = validateRename(newTitle, this._currentTitle!, this._notes.map((n) => n.title));
    if (error) {
      this._toast.show(error);
      return;
    }

    const oldTitle = this._currentTitle!;
    if (newTitle !== oldTitle) {
      try {
        await this._ports.notes.rename(oldTitle, newTitle);
      } catch (err) {
        this._toast.show(`Failed to rename: ${(err as Error).message}`);
        return;
      }
      this._currentTitle = newTitle;
    }
    this._exitRenameMode(this._savedQuery);
  }

  private _cancelRename(): void {
    this._exitRenameMode(this._savedQuery);
  }

  private _exitRenameMode(query: string): void {
    this._renameMode = false;
    this._searchInput.placeholder = 'Search or create note…';
    this._searchInput.classList.remove('rename-mode');
    this._searchInput.value = query;
    this._renderResults(query);
    this._highlightSelected(false);
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
      if (this._renameMode) return;
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
        case 'j':
          if (e.ctrlKey) { e.preventDefault(); this._moveSelectionInList(1); }
          break;
        case 'k':
          if (e.ctrlKey) { e.preventDefault(); this._moveSelectionInList(-1); }
          break;
        case 'Enter':
          e.preventDefault();
          if (this._renameMode) { this._commitRename(); } else { this._handleEnter(); }
          break;
        case 'Escape':
          if (this._renameMode) { e.preventDefault(); this._cancelRename(); }
          break;
        case 'Delete':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            this._deleteCurrentNote();
          }
          break;
      }
    });

    this._editor.addEventListener('input', () => this._autosave.schedule(this._currentTitle!, () => this._editor.value));
    this._editor.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        this._applyWordBackspace(this._editor);
        this._autosave.schedule(this._currentTitle!, () => this._editor.value);
        return;
      }
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault();
        this._moveSelectionInList(1);
      } else if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this._moveSelectionInList(-1);
      } else if (e.key === 'Escape') {
        this._autosave.cancelAndFlush(this._currentTitle!, () => this._editor.value);
        this._searchInput.focus();
        const len = this._searchInput.value.length;
        this._searchInput.setSelectionRange(len, len);
      } else if (e.key === 'Delete' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this._deleteCurrentNote();
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
      } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) {
        e.preventDefault();
        this._moveSelectionInList(1);
      } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) {
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
      if (e.key === '+' || e.key === '=') { e.preventDefault(); this._changeFontSize(1); }
      else if (e.key === '-') { e.preventDefault(); this._changeFontSize(-1); }
      else if (e.key === '0') { e.preventDefault(); this._changeFontSize(0); }
      else if (e.key === 'p') { e.preventDefault(); this._togglePreview(); }
      else if (e.key === 'd') { e.preventDefault(); this._deleteCurrentNote(); }
      else if (e.key === 'r') { e.preventDefault(); this._enterRenameMode(); }
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

  // ── Resize handle ─────────────────────────────────────────────────────────

  private _bindResizeHandle(): void {
    let startY = 0;
    let startH = 0;

    this._resizeHandle.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startH = this._resultsPanelHeight;
      this._resizeHandle.classList.add('dragging');

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        this._resultsPanelHeight = Math.max(60, Math.min(500, startH + delta));
        this._applyResultsPanelHeight();
      };

      const onUp = () => {
        this._resizeHandle.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
  }

  private _applyResultsPanelHeight(): void {
    this._resultsPanel.style.height = `${this._resultsPanelHeight}px`;
    this._resultsPanel.style.maxHeight = `${this._resultsPanelHeight}px`;
  }

  private _togglePreview(): void {
    this._previewMode = !this._previewMode;
    this._editor.hidden = this._previewMode;
    this._preview.hidden = !this._previewMode;
    if (this._previewMode) {
      this._renderPreview();
    } else {
      this._editor.focus();
    }
  }

  private _renderPreview(): void {
    this._preview.innerHTML = DOMPurify.sanitize(marked.parse(this._editor.value || '') as string);
  }

  private _applyFontSize(): void {
    document.documentElement.style.setProperty('--app-font-size', `${this._fontSize}px`);
  }

  private _changeFontSize(delta: number): void {
    this._fontSize = adjustFontSize(this._fontSize, delta);
    localStorage.setItem('app-font-size', String(this._fontSize));
    this._applyFontSize();
  }
}
