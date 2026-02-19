# nv

A keyboard-first note-taking app inspired by [Notational Velocity](https://notational.net/). Notes are plain `.md` files in a folder you choose. There is no database, no sync, no proprietary format — just files.

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
| `↓` / `↑` | Search bar | Move to results list |
| `Enter` | Results list | Open selected note in editor |
| `Escape` | Results list | Return to search bar |
| `Escape` | Editor | Return to search bar |
| `Enter` | Search bar (no results) | Create new note named after the query |
| `Ctrl+Delete` | Anywhere | Delete the current note immediately (no undo) |

The search bar is focused on launch. Searching filters both note titles and body content simultaneously.

To **create a note**: type a name that has no results, then press `Enter`.

To **delete a note**: select it so it is open in the editor, then press `Ctrl+Delete`. The file is removed from disk instantly with no confirmation.

## Changing the vault

Go to **File → Change Vault…** in the menu bar to switch to a different folder.

## Development

Run the test suite:

```bash
just test
# or
npm test
```

Toggle developer tools from inside the app: **View → Toggle Developer Tools** (or `Ctrl+Shift+I`).
