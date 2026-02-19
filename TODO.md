# TODO

## In Progress

## To Do
- [ ] Scaffold Electron project (package.json, main/preload/renderer files, directory structure)
- [ ] Implement vault selection and persistence (first-launch folder picker, userData config)
- [ ] Implement main process IPC handlers (notes:list, notes:read, notes:write, notes:delete, vault:select)
- [ ] Integrate chokidar file watcher with IPC push events
- [ ] Build three-panel renderer UI layout (search bar, results list, editor)
- [ ] Implement search/filter logic with unit tests (substring match on title + body, sort by mtime)
- [ ] Implement arrow-key navigation in search bar and Enter to open/create note
- [ ] Implement Escape from editor returning focus to search bar
- [ ] Implement note deletion (Cmd/Ctrl+Delete, immediate, no confirmation)
- [ ] Implement editor autosave with 500ms debounce
- [ ] Implement OS theming via nativeTheme (light/dark CSS variables)
- [ ] Set up application menu (File: Change Vault/Quit, Edit: standard, View: DevTools)
- [ ] Create a Justfile with the basic commands to run and test this project

## Done
