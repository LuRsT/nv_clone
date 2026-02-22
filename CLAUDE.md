# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Notational Velocity clone: a keyboard-first, single-window Tauri app for plain-text markdown note-taking. Full spec is in `SPEC.txt`.

## Tech Stack

- **Framework:** Tauri v2 (Rust backend + WebView frontend)
- **Backend language:** Rust (2021 edition)
- **Frontend language:** TypeScript (strict mode, ES2020 target)
- **Build:** Tauri CLI (`tauri dev` / `tauri build`); esbuild via custom `build.js` bundles the renderer
- **Storage:** Plain `.md` files on disk — no database, no frontmatter
- **File watching:** `notify` crate (Rust) with 100ms debounce
- **Markdown preview:** marked + DOMPurify (XSS sanitization)
- **Testing (TS):** Node.js native test runner (`node:test`) with tsx
- **Testing (Rust):** `cargo test` in `src-tauri/`
- **Config persistence:** Tauri `app_data_dir()/config.json` for vault path

## Commands

```bash
npm start          # Launch Tauri dev mode (tauri dev)
npm test           # Run TS unit tests (tsx --test 'test/**/*.test.ts')
npm run typecheck  # Type-check without emitting (tsc --noEmit)
npm run build      # Production build (tauri build)
cd src-tauri && cargo test   # Run Rust unit tests
cd src-tauri && cargo check  # Type-check Rust without building
```

## Architecture

### Backend (`src-tauri/src/`)

Rust backend managed by Tauri:

- **Entry:** `lib.rs` — Tauri builder setup, state management (`AppState`, `WatcherState`), command registration
- **Commands:** `commands/vault.rs` (vault get/select/config), `commands/notes.rs` (CRUD + listing)
- **Menu:** `menu.rs` — native application menu (File, Edit, View), "Change Vault…" handler
- **Watcher:** `watcher.rs` — `notify`-based file watcher with debounce, emits `notes:changed` events
- **State:** `AppState` (vault path behind `Mutex`), `WatcherState` (watcher handle behind `Mutex`)

### Frontend (`src/renderer/`)

TypeScript frontend using ports/adapters pattern:

- **Ports:** `NoteRepository`, `VaultService`, `ThemeService` (`src/renderer/ports.ts`)
- **Adapters:** `TauriNoteRepository`, `TauriVaultService`, `TauriThemeService` (`src/renderer/adapters/tauri-adapter.ts`) — Tauri `invoke()` + `listen()` bridge
- **Entry point:** `src/renderer/index.ts` — creates `NVApp` with injected port implementations
- **Pure logic:** `app-logic.ts` (no DOM), `search.ts` (filtering)
- **Controllers (extracted from NVApp):** `toast`, `autosave`, `resize`, `font-size`, `preview`, `rename`, `help` — all in `src/renderer/controllers/`

### Tauri Commands

| Command | Purpose |
|---------|---------|
| `vault_get` | Get current vault path |
| `vault_select` | Open folder picker, validate, set vault |
| `notes_list` | List all notes (title, excerpt, body, mtime) |
| `notes_read` | Read note body by title |
| `notes_write` | Write note body to disk |
| `notes_delete` | Delete note file |
| `notes_rename` | Rename note file |

### Tauri Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `notes:changed` | backend → frontend | File watcher detected changes |

Theme changes are detected via Tauri's `onThemeChanged` window API.

### UI Layout

Three vertical panels in a single window (no sidebars, no toolbar):
1. **Search bar** — always focused on launch; filters by title + body; arrow keys navigate results; Escape clears query; Ctrl+R enters rename mode
2. **Results list** — sorted by last-modified descending; title + first non-empty body line as excerpt
3. **Editor** — raw markdown; autosaves with 500ms debounce; Escape returns focus to search bar; Ctrl+P toggles markdown preview

### Key Behaviors

- **Note identity = filename**: `<title>.md` — no frontmatter, no metadata files
- **Create note**: Enter in search bar when query doesn't exactly match an existing title → write `<query>.md` → focus editor
- **Delete note**: Cmd/Ctrl+Delete → immediate disk deletion, no confirmation
- **Rename note**: Ctrl+R → search bar becomes rename input → Enter confirms
- **Font size**: Ctrl+/Ctrl- adjusts, persisted in localStorage
- **Panel resize**: Draggable handle between results and editor, height persisted
- **File watching**: External changes reflected live via `notify` watcher
- **Theming**: Follows OS appearance via Tauri's window theme API (light/dark)

### Testing

**TypeScript** — unit tests cover pure logic only (no integration/E2E):
- `test/filter.test.ts` — `filterNotes()`
- `test/highlight.test.ts` — search highlighting
- `test/navigation.test.ts` — list navigation
- `test/app-logic.test.ts` — `handleEnterDecision()`, `restoreSelectionIndex()`, `adjustFontSize()`, `deleteWordBackward()`, `validateRename()`
- `test/autosave.test.ts` — autosave scheduling

**Rust** — unit tests in `src-tauri/src/commands/notes.rs`:
- `assert_safe_title` — path traversal validation
- `list_notes_from_path` — vault listing, sorting, filtering
- `first_non_empty_line` — excerpt extraction
- CRUD helpers — note path resolution, write/read/delete/rename

READ: AGENTS.MD
