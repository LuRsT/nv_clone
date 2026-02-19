# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Notational Velocity clone: a keyboard-first, single-window Electron app for plain-text markdown note-taking. Full spec is in `SPEC.txt`.

## Tech Stack

- **Runtime:** Electron (Node.js main process + Chromium renderer)
- **Storage:** Plain `.md` files on disk — no database, no frontmatter
- **File watching:** `chokidar`
- **Config persistence:** `app.getPath('userData')` for vault path

## Commands

Once the project is initialized with `npm init` / `package.json`:

```bash
npm start          # Launch Electron app
npm run build      # Package app for distribution
npm test           # Run tests
```

To scaffold: `npm init electron-app@latest .` or `npx create-electron-app .`

## Architecture

### Process Model

- **Main process** (`src/main.js` or similar): vault selection, `chokidar` file watching, IPC handlers for CRUD on `.md` files, native menu, `nativeTheme` subscription
- **Renderer process** (`src/renderer/`): all UI — search bar, results list, editor
- **Preload script**: exposes a safe IPC bridge (`contextBridge`) between main and renderer

### UI Layout

Three vertical panels in a single window (no sidebars, no toolbar):
1. **Search bar** — always focused on launch; filters by title + body simultaneously; arrow keys navigate results without leaving the bar
2. **Results list** — sorted by last-modified descending; shows title + first non-empty body line as excerpt
3. **Editor** — raw markdown only (no preview); autosaves with ~500ms debounce; Escape returns focus to search bar

### Key Behaviors

- **Note identity = filename**: `<title>.md` — no frontmatter, no metadata files
- **Create note**: Enter in search bar when query doesn't exactly match an existing title → write `<query>.md` with empty body → focus editor
- **Delete note**: Cmd/Ctrl+Delete → immediate disk deletion, no confirmation, no trash
- **File watching**: external changes (add/modify/delete) are reflected live in the UI
- **Theming**: follows OS appearance via `nativeTheme` (light/dark); no custom theme picker

### IPC Conventions

All file I/O lives in the main process. The renderer communicates via named IPC channels (e.g., `notes:list`, `notes:read`, `notes:write`, `notes:delete`, `vault:select`). The preload script exposes these as a `window.api` object using `contextBridge`.
