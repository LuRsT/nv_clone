# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Notational Velocity clone: a keyboard-first, single-window Electron app for plain-text markdown note-taking. Full spec is in `SPEC.txt`.

## Tech Stack

- **Language:** TypeScript (strict mode, ES2020 target)
- **Runtime:** Electron v40 (Node.js main process + Chromium renderer)
- **Build:** esbuild via custom `build.js` — compiles main, preload, and renderer bundles to `dist/`
- **Storage:** Plain `.md` files on disk — no database, no frontmatter
- **File watching:** chokidar
- **Markdown preview:** marked + DOMPurify (XSS sanitization)
- **Testing:** Node.js native test runner (`node:test`) with tsx
- **Config persistence:** `app.getPath('userData')/config.json` for vault path

## Commands

```bash
npm start          # Build + launch Electron app
npm test           # Run unit tests (tsx --test 'test/**/*.test.ts')
npm run typecheck  # Type-check without emitting (tsc --noEmit)
npm run build      # Build only (node build.js)
```

## Task Tracking

This project uses **bd** (beads) for issue tracking — not TODO.md or ad-hoc task files. See `AGENTS.md` for commands and workflow.

## Architecture

### Hexagonal Architecture (Ports & Adapters)

The codebase uses a ports/adapters pattern to separate business logic from infrastructure:

**Main process (`src/main.ts`):**
- Port: `NoteStore` interface (`src/ports/note-store.ts`)
- Adapter: `FsNoteStore` (`src/adapters/fs-note-store.ts`) — file I/O with path traversal validation
- Registers IPC handlers, manages chokidar file watcher, Electron lifecycle, native menu, theme subscription

**Preload (`src/preload.ts`):**
- `contextBridge` exposes `window.api` — typed IPC bridge between main and renderer

**Renderer (`src/renderer/`):**
- Ports: `NoteRepository`, `VaultService`, `ThemeService` (`src/renderer/ports.ts`)
- Adapters: `IpcNoteRepository`, `IpcVaultService`, `IpcThemeService` (`src/renderer/adapters/ipc-adapter.ts`)
- Entry point: `src/renderer/index.ts` — creates `NVApp` with injected port implementations
- Pure logic: `app-logic.ts` (no DOM), `search.ts` (filtering), `notes-helpers.ts`
- Controllers (extracted from NVApp): `toast`, `autosave`, `resize`, `font-size`, `preview`, `rename` — all in `src/renderer/controllers/`

### IPC Channels

Defined in `src/preload.ts`. Namespaces: `vault:*`, `notes:*`, `theme:*`. See `src/main.ts` for handlers.

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
- **File watching**: External changes reflected live in the UI
- **Theming**: Follows OS appearance via `nativeTheme` (light/dark)

### Testing

Unit tests cover pure logic only (no integration/E2E):
- `test/notes.test.ts` — `firstNonEmptyLine()`
- `test/filter.test.ts` — `filterNotes()`
- `test/highlight.test.ts` — search highlighting
- `test/navigation.test.ts` — list navigation
- `test/app-logic.test.ts` — `handleEnterDecision()`, `restoreSelectionIndex()`, `adjustFontSize()`, `deleteWordBackward()`, `validateRename()`
