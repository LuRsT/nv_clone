# nv

A keyboard-first note-taking app inspired by [Notational Velocity](https://notational.net/). Notes are plain `.md` files in a folder you choose. There is no database, no sync, no proprietary format — just files.

NOTE: Apart from this line in the README.md I (Gil) didn't touch the code in this repo, this project is an experience in getting Claude to build an app in a language I don't know in an environment I have no experience with.

```
┌─────────────────────────────────┐
│         Search Bar              │
├─────────────────────────────────┤
│         Results List            │
├─────────────────────────────────┤
│         Editor                  │
└─────────────────────────────────┘
```

## Requirements

- Node.js ≥ 18
- npm
- A running display server (X11 or Wayland)

On Arch Linux:

```bash
sudo pacman -S nodejs npm
```

Electron requires some system libraries that are usually present but may be missing on a minimal install:

```bash
sudo pacman -S nss nspr at-spi2-core libdrm mesa libgbm alsa-lib
```

## Install

```bash
git clone <repo-url> nv
cd nv
npm install
```

## Run

```bash
just start
# or
npm start
```

On first launch you will be prompted to choose a vault folder — the directory where your `.md` files live. This path is remembered across sessions.

## Keyboard shortcuts

| Key | Context | Action |
|-----|---------|--------|
| Typing | Search bar | Filter notes live |
| `↓` / `↑` | Search bar | Move selection in results list |
| `Enter` | Search bar (has results) | Open selected note in editor |
| `Enter` | Search bar (no results) | Create new note named after the query |
| `Escape` | Search bar | Clear the search query |
| `Escape` | Editor | Return to search bar |
| `Ctrl+Delete` / `Ctrl+D` | Anywhere | Delete the current note (no undo) |
| `Ctrl+R` | Anywhere | Rename the current note |
| `Ctrl+P` | Anywhere | Toggle markdown preview |
| `Ctrl+W` | Search / Editor | Delete word backward |
| `Ctrl++` / `Ctrl+-` | Anywhere | Increase / decrease font size |
| `Ctrl+0` | Anywhere | Reset font size |

The search bar is focused on launch. Searching filters both note titles and body content simultaneously.

To **create a note**: type a name that has no results, then press `Enter`.

To **delete a note**: select it so it is open in the editor, then press `Ctrl+Delete`. The file is removed from disk instantly with no confirmation.

## Packaging

Build a standalone app you can run without Node.js:

```bash
npm run package
```

This produces an executable in `release/linux-unpacked/` (Linux), or a `.dmg` (macOS) / installer (Windows).

## Changing the vault

Go to **File → Change Vault…** in the menu bar to switch to a different folder.

## Development

```bash
npm test           # Run unit tests
npm run typecheck  # Type-check without emitting
just test          # Alternative: run tests via Justfile
```

Toggle developer tools from inside the app: **View → Toggle Developer Tools** (or `Ctrl+Shift+I`).
