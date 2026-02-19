// Renderer entry point — runs in Chromium, window.api injected by preload.
// filterNotes is loaded via search.js (included before this script in index.html).

window.addEventListener('DOMContentLoaded', async () => {
  await initTheme();
  await initVault();
});

async function initTheme() {
  const dark = await window.api.isDarkMode();
  applyTheme(dark);
  window.api.onThemeChanged((isDark) => applyTheme(isDark));
}

function applyTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

async function initVault() {
  const vaultPath = await window.api.getVaultPath();
  if (!vaultPath) {
    await promptVaultSelection();
  } else {
    startApp();
  }
}

async function promptVaultSelection() {
  const overlay = document.createElement('div');
  overlay.id = 'vault-overlay';
  overlay.innerHTML = `
    <h1>Welcome to NV</h1>
    <p>Choose a folder to store your notes.</p>
    <button id="vault-pick-btn">Choose Vault Folder</button>
  `;
  document.body.appendChild(overlay);

  document.getElementById('vault-pick-btn').addEventListener('click', async () => {
    const chosen = await window.api.selectVault();
    if (chosen) {
      overlay.remove();
      startApp();
    }
  });
}

function startApp() {
  const app = new NVApp();
  app.init();
}

class NVApp {
  constructor() {
    this._searchInput = document.getElementById('search-input');
    this._resultsList = document.getElementById('results-list');
    this._editor = document.getElementById('editor');
    this._resizeHandle = document.getElementById('resize-handle');
    this._resultsPanel = document.getElementById('results-panel');

    this._notes = [];           // full list from main process, sorted by mtime desc
    this._filtered = [];        // subset matching current query
    this._selectedIndex = -1;
    this._currentTitle = null;  // title of note loaded in editor
    this._saveTimer = null;

    this._resultsPanelHeight = 200; // px, user-resizable
  }

  async init() {
    await this._loadNotes();
    this._bindEvents();
    this._bindResizeHandle();
    this._applyResultsPanelHeight();
    this._searchInput.focus();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  async _loadNotes() {
    this._notes = await window.api.listNotes();
    this._renderResults(this._searchInput.value);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _renderResults(query) {
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

    this._filtered.forEach((note, i) => {
      const li = document.createElement('li');
      li.dataset.title = note.title;

      const titleEl = document.createElement('div');
      titleEl.className = 'note-title';
      titleEl.textContent = note.title;

      const excerptEl = document.createElement('div');
      excerptEl.className = 'note-excerpt';
      excerptEl.textContent = note.excerpt;

      li.setAttribute('tabindex', '0');
      li.appendChild(titleEl);
      li.appendChild(excerptEl);
      li.addEventListener('click', () => {
        this._selectedIndex = i;
        this._highlightSelected(true);
      });
      li.addEventListener('keydown', (e) => {
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
        }
      });
      this._resultsList.appendChild(li);
    });

    // Restore selection: try to keep current note selected, otherwise pick first
    const idx = this._currentTitle
      ? this._filtered.findIndex((n) => n.title === this._currentTitle)
      : 0;
    this._selectedIndex = idx >= 0 ? idx : 0;
    this._highlightSelected(false);
  }

  _highlightSelected(loadEditor = true) {
    const items = this._resultsList.querySelectorAll('li[data-title]');
    items.forEach((el, i) => {
      el.classList.toggle('selected', i === this._selectedIndex);
    });

    if (loadEditor && this._selectedIndex >= 0 && this._filtered[this._selectedIndex]) {
      this._openNote(this._filtered[this._selectedIndex].title);
    }
  }

  // ── Note operations ───────────────────────────────────────────────────────

  async _openNote(title) {
    if (this._currentTitle === title) return;
    this._cancelSave();
    this._currentTitle = title;
    const body = await window.api.readNote(title);
    this._editor.value = body;
  }

  async _createNote(title) {
    await window.api.writeNote(title, '');
    await this._loadNotes();
    const idx = this._filtered.findIndex((n) => n.title === title);
    if (idx >= 0) this._selectedIndex = idx;
    this._highlightSelected(false);
    this._currentTitle = title;
    this._editor.value = '';
    this._editor.focus();
  }

  async _deleteCurrentNote() {
    if (!this._currentTitle) return;
    await window.api.deleteNote(this._currentTitle);
    this._currentTitle = null;
    this._editor.value = '';
    await this._loadNotes();
    this._searchInput.focus();
  }

  // ── Autosave ──────────────────────────────────────────────────────────────

  _scheduleAutosave() {
    this._cancelSave();
    this._saveTimer = setTimeout(() => this._save(), 500);
  }

  _cancelSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
  }

  async _save() {
    if (!this._currentTitle) return;
    await window.api.writeNote(this._currentTitle, this._editor.value);
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  _bindEvents() {
    this._searchInput.addEventListener('input', () => {
      this._renderResults(this._searchInput.value);
      this._highlightSelected(true);
    });

    this._searchInput.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this._moveSelection(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this._moveSelection(-1);
          break;
        case 'Enter':
          e.preventDefault();
          this._handleEnter();
          break;
        case 'Delete':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            this._deleteCurrentNote();
          }
          break;
      }
    });

    this._editor.addEventListener('input', () => this._scheduleAutosave());
    this._editor.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._cancelSave();
        this._save();
        this._searchInput.focus();
        const len = this._searchInput.value.length;
        this._searchInput.setSelectionRange(len, len);
      } else if (e.key === 'Delete' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this._deleteCurrentNote();
      }
    });

    window.api.onNotesChanged((notes) => {
      this._notes = notes;
      this._renderResults(this._searchInput.value);
      this._highlightSelected(true);
    });
  }

  _moveSelection(delta) {
    if (this._filtered.length === 0) return;
    this._selectedIndex = Math.max(
      0,
      Math.min(this._filtered.length - 1, this._selectedIndex + delta)
    );
    this._highlightSelected(true);
    const items = this._resultsList.querySelectorAll('li[data-title]');
    items[this._selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }

  // Like _moveSelection but also moves DOM focus to the new item (used when
  // the list itself has focus and the user presses arrow keys).
  _moveSelectionInList(delta) {
    this._moveSelection(delta);
    const items = this._resultsList.querySelectorAll('li[data-title]');
    items[this._selectedIndex]?.focus();
  }

  async _handleEnter() {
    const query = this._searchInput.value.trim();
    if (!query) return;

    const exact = this._filtered.find(
      (n) => n.title.toLowerCase() === query.toLowerCase()
    );
    if (exact) {
      this._currentTitle = exact.title;
      this._editor.value = await window.api.readNote(exact.title);
      this._editor.focus();
      return;
    }

    await this._createNote(query);
  }

  // ── Resize handle ─────────────────────────────────────────────────────────

  _bindResizeHandle() {
    let startY = 0;
    let startH = 0;

    this._resizeHandle.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startH = this._resultsPanelHeight;
      this._resizeHandle.classList.add('dragging');

      const onMove = (ev) => {
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

  _applyResultsPanelHeight() {
    this._resultsPanel.style.height = `${this._resultsPanelHeight}px`;
    this._resultsPanel.style.maxHeight = `${this._resultsPanelHeight}px`;
  }
}
