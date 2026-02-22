# nv

A keyboard-first note-taking app inspired by [Notational Velocity](https://notational.net/). Notes are plain `.md` files in a folder you choose. There is no database, no sync, no proprietary format — just files.

NOTE: Apart from this line in the README.md I (Gil) didn't touch the code in this repo, this project is an experience in getting Claude to build an app in a language I don't know in an environment I have no experience with.

<img width="938" height="730" alt="2026-02-21-192358_938x730_scrot" src="https://github.com/user-attachments/assets/a0740b29-479b-4a95-a7cb-5e4c1145734b" />

## Requirements

- [Rust](https://rustup.rs/) (stable toolchain — `rustup install stable`)
- Node.js ≥ 22
- npm
- A running display server (X11 or Wayland)

### Linux system libraries

On Arch Linux:

```bash
sudo pacman -S nodejs npm rust
```

WebKit and GTK development headers are required for the Tauri build:

```bash
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg patchelf
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
| `Ctrl+J` / `Ctrl+K` | Anywhere | Move selection down / up |
| `Enter` | Search bar (has results) | Open selected note in editor |
| `Enter` | Search bar (no results) | Create new note named after the query |
| `Tab` | Search bar | Focus editor |
| `Escape` | Search bar | Clear query (or cancel rename) |
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

Build a standalone app you can run without Node.js or Rust:

```bash
npm run build
```

This compiles a release binary and produces platform bundles in `src-tauri/target/release/bundle/`:

| Platform | Output |
|----------|--------|
| Linux    | `.AppImage` and `.deb` in `appimage/` and `deb/` |
| macOS    | `.dmg` in `dmg/` |
| Windows  | NSIS installer `.exe` in `nsis/` |

## Changing the vault

Go to **File → Change Vault…** in the menu bar to switch to a different folder.

## Releasing a new version

1. Bump the version in `package.json` and `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json`
2. Commit the change and push to `master`
3. Tag the commit and push the tag:

```bash
git tag v1.0.0
git push --tags
```

The `v*` tag push triggers the [release workflow](.github/workflows/release.yml), which builds Tauri bundles for Linux, macOS, and Windows and uploads them as a draft GitHub Release.

## Development

```bash
npm test           # Run unit tests
npm run typecheck  # Type-check without emitting
npm run lint       # Run ESLint
```

Toggle developer tools from inside the app: **View → Toggle Developer Tools** (or `Ctrl+Shift+I`).
