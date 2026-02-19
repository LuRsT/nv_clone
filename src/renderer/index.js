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
    this._fontSize = parseInt(localStorage.getItem('app-font-size'), 10) || FONT_SIZE_DEFAULT;
  }

  async init() {
    await this._loadNotes();
    this._bindEvents();
    this._bindResizeHandle();
    this._applyResultsPanelHeight();
    this._applyFontSize();
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

      li.setAttribute('tabindex', '-1'); // roving tabindex — _highlightSelected promotes selected one to 0
      li.appendChild(titleEl);
      li.appendChild(excerptEl);
      this._resultsList.appendChild(li);
    });

    this._selectedIndex = restoreSelectionIndex(this._filtered, this._currentTitle);
    this._highlightSelected(false);
  }

  _highlightSelected(loadEditor = true) {
    const items = this._resultsList.querySelectorAll('li[data-title]');
    items.forEach((el, i) => {
      const selected = i === this._selectedIndex;
      el.classList.toggle('selected', selected);
      el.setAttribute('tabindex', selected ? '0' : '-1'); // roving tabindex
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
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault();
        this._moveSelectionInList(1);
      } else if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this._moveSelectionInList(-1);
      } else if (e.key === 'Escape') {
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

    // When focus lands on any list item (via Tab or click), sync selection and
    // load the note. _openNote guards against reloading the same title.
    this._resultsList.addEventListener('focusin', (e) => {
      const li = e.target.closest('li[data-title]');
      if (!li) return;
      const items = [...this._resultsList.querySelectorAll('li[data-title]')];
      const idx = items.indexOf(li);
      if (idx === -1) return;
      this._selectedIndex = idx;
      this._highlightSelected(false);
      this._openNote(this._filtered[idx]?.title);
    });

    // Keyboard handling while any list item has focus.
    this._resultsList.addEventListener('keydown', (e) => {
      if (!e.target.closest('li[data-title]')) return;
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
      }
    });

    window.api.onNotesChanged((notes) => {
      this._notes = notes;
      this._renderResults(this._searchInput.value);
      this._highlightSelected(true);
    });

    // Global font-size shortcuts — active regardless of which panel has focus.
    window.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); this._changeFontSize(1); }
      else if (e.key === '-') { e.preventDefault(); this._changeFontSize(-1); }
      else if (e.key === '0') { e.preventDefault(); this._changeFontSize(0); }
    });
  }

  // Moves selection and shifts DOM focus to the new list item so that
  // subsequent key events (Enter, Escape) fire on the list, not the search bar.
  _moveSelectionInList(delta) {
    if (this._filtered.length === 0) return;
    this._selectedIndex = Math.max(
      0,
      Math.min(this._filtered.length - 1, this._selectedIndex + delta)
    );
    this._highlightSelected(false); // update CSS + tabindex
    const items = this._resultsList.querySelectorAll('li[data-title]');
    const item = items[this._selectedIndex];
    item?.scrollIntoView({ block: 'nearest' });
    item?.focus(); // triggers focusin → _openNote
  }

  async _handleEnter() {
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

  _applyFontSize() {
    document.documentElement.style.setProperty('--app-font-size', `${this._fontSize}px`);
  }

  _changeFontSize(delta) {
    this._fontSize = adjustFontSize(this._fontSize, delta);
    localStorage.setItem('app-font-size', this._fontSize);
    this._applyFontSize();
  }
}
