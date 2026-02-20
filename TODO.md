# TODO

## In Progress

## To Do

## Done
- [x] Add search highlight in results (title + excerpt)
- [x] Escape in search bar clears the query
- [x] Clear search bar after note creation
- [x] Fix search to match full note body, not just excerpt
- [x] Persist results panel height in localStorage
- [x] Convert synchronous file I/O to async in FsNoteStore
- [x] Extract centralized keyboard shortcut handler
- [x] Clean up inconsistent state management (_selectedIndex, _currentTitle)
- [x] Replace fragile regex HTML transform in build.js
- [x] Add null checks on DOM queries in NVApp constructor
- [x] Extract hardcoded magic numbers into named constants
- [x] Extract ToastController
- [x] Extract AutosaveController
- [x] Extract ResizeController
- [x] Extract FontSizeController
- [x] Extract PreviewController
- [x] Extract RenameController
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
- [x] Add Ctrl++/- font size adjustment with persistence
- [x] Add Ctrl+P markdown preview toggle
- [x] Add Delete and Ctrl+D shortcuts to delete selected note
- [x] Show toast notification when a note is deleted
- [x] Add Ctrl+W delete-word-backward for search input and editor
- [x] Add notes:rename IPC handler and preload binding
- [x] Add Ctrl+R rename mode using the search bar
