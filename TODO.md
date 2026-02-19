# TODO

## In Progress

## To Do

## Done
- [x] Scaffold Electron project (package.json, main/preload/renderer files, directory structure)
- [x] Implement vault selection and persistence (first-launch folder picker, userData config)
- [x] Implement main process IPC handlers (notes:list, notes:read, notes:write, notes:delete, vault:select)
- [x] Integrate chokidar file watcher with IPC push events
- [x] Build three-panel renderer UI layout (search bar, results list, editor)
- [x] Implement search/filter logic with unit tests (substring match on title + body, sort by mtime)
- [x] Implement arrow-key navigation in search bar and Enter to open/create note
- [x] Implement Escape from editor returning focus to search bar
- [x] Implement note deletion (Cmd/Ctrl+Delete, immediate, no confirmation)
- [x] Implement editor autosave with 500ms debounce
- [x] Implement OS theming via nativeTheme (light/dark CSS variables)
- [x] Set up application menu (File: Change Vault/Quit, Edit: standard, View: DevTools)
- [x] Extract firstNonEmptyLine to notes-helpers module so tests import real code
- [x] Extract handleEnterDecision and restoreSelectionIndex to app-logic module with tests
