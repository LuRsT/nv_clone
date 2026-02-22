use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::State;

use crate::AppState;

#[derive(Serialize, Clone)]
pub struct NoteInfo {
    pub title: String,
    pub excerpt: String,
    pub body: String,
    pub mtime: f64,
}

/// Validate that a title is safe to use as a filename component.
///
/// Rejects empty strings, path separators, null bytes, dot-only names, and
/// dot-prefixed names, then double-checks via path arithmetic that the
/// resulting file stays inside the vault.
fn assert_safe_title(vault_path: &Path, title: &str) -> Result<(), String> {
    if title.is_empty()
        || title.contains('/')
        || title.contains('\\')
        || title.contains('\0')
        || title == "."
        || title == ".."
        || title.starts_with('.')
    {
        return Err(format!("Invalid note title: \"{title}\""));
    }

    let joined = vault_path.join(format!("{title}.md"));
    if !joined.starts_with(vault_path) {
        return Err(format!("Invalid note title: \"{title}\""));
    }

    Ok(())
}

fn note_path(vault_path: &Path, title: &str) -> Result<PathBuf, String> {
    assert_safe_title(vault_path, title)?;
    Ok(vault_path.join(format!("{title}.md")))
}

fn first_non_empty_line(text: &str) -> &str {
    text.lines()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("")
        .trim()
}

fn get_vault(state: &State<'_, AppState>) -> Result<PathBuf, String> {
    state
        .vault_path
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .ok_or_else(|| "No vault selected".to_string())
}

// ── Shared helpers (also used by the file watcher) ───────────────────────────

/// Read a single `.md` file into a `NoteInfo`. Returns `None` if the file
/// cannot be read or doesn't qualify (not `.md`, dot-prefixed, etc.).
pub fn read_note_info(path: &Path) -> Option<NoteInfo> {
    let name = path.file_name()?.to_string_lossy();
    if !name.ends_with(".md") || name.starts_with('.') {
        return None;
    }
    let title = path.file_stem()?.to_string_lossy().into_owned();

    let mut file = std::fs::File::open(path).ok()?;
    let meta = file.metadata().ok()?;
    let mtime = meta
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_millis() as f64;

    let mut buf = [0u8; 512];
    let n = file.read(&mut buf).unwrap_or(0);
    let preview = String::from_utf8_lossy(&buf[..n]);
    let excerpt = first_non_empty_line(&preview).to_string();
    let body = preview.into_owned();

    Some(NoteInfo {
        title,
        excerpt,
        body,
        mtime,
    })
}

/// List all notes in a vault directory, reading only the first 512 bytes of
/// each file for the excerpt.
pub fn list_notes_from_path(vault: &Path) -> Result<Vec<NoteInfo>, String> {
    let entries = std::fs::read_dir(vault).map_err(|e| format!("Cannot read vault: {e}"))?;

    let mut notes: Vec<NoteInfo> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| read_note_info(&e.path()))
        .collect();

    notes.sort_by(|a, b| b.mtime.partial_cmp(&a.mtime).unwrap());
    Ok(notes)
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// List all notes. Reads only the first 512 bytes of each file for the
/// excerpt; the full body is not sent to avoid large IPC payloads.
#[tauri::command]
pub fn notes_list(state: State<'_, AppState>) -> Result<Vec<NoteInfo>, String> {
    let vault = get_vault(&state)?;
    list_notes_from_path(&vault)
}

#[tauri::command]
pub fn notes_read(title: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault = get_vault(&state)?;
    let path = note_path(&vault, &title)?;
    std::fs::read_to_string(&path).map_err(|e| format!("Cannot read note: {e}"))
}

#[tauri::command]
pub fn notes_write(title: String, body: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = get_vault(&state)?;
    let path = note_path(&vault, &title)?;
    std::fs::write(&path, body.as_bytes()).map_err(|e| format!("Cannot write note: {e}"))
}

#[tauri::command]
pub fn notes_delete(title: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = get_vault(&state)?;
    let path = note_path(&vault, &title)?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Cannot delete note: {e}")),
    }
}

#[tauri::command]
pub fn notes_rename(
    old_title: String,
    new_title: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let vault = get_vault(&state)?;
    let old_path = note_path(&vault, &old_title)?;
    let new_path = note_path(&vault, &new_title)?;
    std::fs::rename(&old_path, &new_path).map_err(|e| format!("Cannot rename note: {e}"))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn tmp() -> TempDir {
        tempfile::tempdir().expect("create temp dir")
    }

    // ── assert_safe_title ────────────────────────────────────────────────────

    #[test]
    fn safe_title_accepts_valid() {
        let dir = tmp();
        assert!(assert_safe_title(dir.path(), "hello world").is_ok());
        assert!(assert_safe_title(dir.path(), "my-note").is_ok());
        assert!(assert_safe_title(dir.path(), "note 2024").is_ok());
    }

    #[test]
    fn safe_title_rejects_empty() {
        let dir = tmp();
        assert!(assert_safe_title(dir.path(), "").is_err());
    }

    #[test]
    fn safe_title_rejects_forward_slash() {
        let dir = tmp();
        assert!(assert_safe_title(dir.path(), "a/b").is_err());
    }

    #[test]
    fn safe_title_rejects_backslash() {
        let dir = tmp();
        assert!(assert_safe_title(dir.path(), "a\\b").is_err());
    }

    #[test]
    fn safe_title_rejects_null_byte() {
        let dir = tmp();
        assert!(assert_safe_title(dir.path(), "a\0b").is_err());
    }

    #[test]
    fn safe_title_rejects_dot() {
        let dir = tmp();
        assert!(assert_safe_title(dir.path(), ".").is_err());
    }

    #[test]
    fn safe_title_rejects_dotdot() {
        let dir = tmp();
        assert!(assert_safe_title(dir.path(), "..").is_err());
    }

    #[test]
    fn safe_title_rejects_dot_prefixed() {
        let dir = tmp();
        assert!(assert_safe_title(dir.path(), ".hidden").is_err());
    }

    #[test]
    fn safe_title_rejects_traversal_via_separator() {
        // The slash check fires before path arithmetic, but both layers block this.
        let dir = tmp();
        assert!(assert_safe_title(dir.path(), "../evil").is_err());
    }

    // ── list_notes_from_path ─────────────────────────────────────────────────

    #[test]
    fn list_empty_vault() {
        let dir = tmp();
        let notes = list_notes_from_path(dir.path()).unwrap();
        assert!(notes.is_empty());
    }

    #[test]
    fn list_ignores_non_md_files() {
        let dir = tmp();
        fs::write(dir.path().join("readme.txt"), "text").unwrap();
        let notes = list_notes_from_path(dir.path()).unwrap();
        assert!(notes.is_empty());
    }

    #[test]
    fn list_ignores_dot_md_files() {
        let dir = tmp();
        fs::write(dir.path().join(".hidden.md"), "secret").unwrap();
        let notes = list_notes_from_path(dir.path()).unwrap();
        assert!(notes.is_empty());
    }

    #[test]
    fn list_returns_title_and_excerpt() {
        let dir = tmp();
        fs::write(dir.path().join("alpha.md"), "\nexcerpt line\nmore text").unwrap();
        let notes = list_notes_from_path(dir.path()).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].title, "alpha");
        assert_eq!(notes[0].excerpt, "excerpt line");
        assert_eq!(notes[0].body, "\nexcerpt line\nmore text");
    }

    #[test]
    fn list_sorted_by_mtime_descending() {
        let dir = tmp();
        // Write two files with different modification times.
        let older = dir.path().join("older.md");
        let newer = dir.path().join("newer.md");
        fs::write(&older, "old").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        fs::write(&newer, "new").unwrap();

        let notes = list_notes_from_path(dir.path()).unwrap();
        assert_eq!(notes.len(), 2);
        assert!(notes[0].mtime >= notes[1].mtime);
        assert_eq!(notes[0].title, "newer");
    }

    // ── note_path / CRUD helpers ─────────────────────────────────────────────

    #[test]
    fn note_path_resolves_correctly() {
        let dir = tmp();
        let p = note_path(dir.path(), "my note").unwrap();
        assert_eq!(p, dir.path().join("my note.md"));
    }

    #[test]
    fn write_then_read() {
        let dir = tmp();
        let vault = dir.path();
        let path = note_path(vault, "test").unwrap();
        fs::write(&path, "hello world").unwrap();
        let body = fs::read_to_string(&path).unwrap();
        assert_eq!(body, "hello world");
    }

    #[test]
    fn delete_nonexistent_is_ok() {
        let dir = tmp();
        // Remove a file that doesn't exist — should not panic.
        let path = dir.path().join("ghost.md");
        let _ = fs::remove_file(&path); // mirrors notes_delete behaviour
    }

    #[test]
    fn rename_moves_file() {
        let dir = tmp();
        let old_path = note_path(dir.path(), "old").unwrap();
        let new_path = note_path(dir.path(), "new").unwrap();
        fs::write(&old_path, "content").unwrap();
        fs::rename(&old_path, &new_path).unwrap();
        assert!(!old_path.exists());
        assert!(new_path.exists());
    }

    #[test]
    fn rename_invalid_new_title_is_rejected() {
        let dir = tmp();
        assert!(note_path(dir.path(), "../evil").is_err());
    }

    // ── first_non_empty_line ─────────────────────────────────────────────────

    #[test]
    fn first_line_skips_blank_lines() {
        assert_eq!(
            first_non_empty_line("\n\n  actual line  \nmore"),
            "actual line"
        );
    }

    #[test]
    fn first_line_empty_string() {
        assert_eq!(first_non_empty_line(""), "");
    }

    #[test]
    fn first_line_all_blank() {
        assert_eq!(first_non_empty_line("\n\n   \n"), "");
    }
}
