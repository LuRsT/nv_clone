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
        .unwrap()
        .clone()
        .ok_or_else(|| "No vault selected".to_string())
}

// ── Shared helper (also used by the file watcher) ────────────────────────────

/// List all notes in a vault directory, reading only the first 512 bytes of
/// each file for the excerpt. This is the single source of truth for both the
/// `notes_list` command and the watcher's `notes:changed` event payload.
pub fn list_notes_from_path(vault: &Path) -> Result<Vec<NoteInfo>, String> {
    let entries = std::fs::read_dir(vault).map_err(|e| format!("Cannot read vault: {e}"))?;

    let mut notes: Vec<NoteInfo> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let s = name.to_string_lossy();
            s.ends_with(".md") && !s.starts_with('.')
        })
        .filter_map(|e| {
            let path = e.path();
            let title = path.file_stem()?.to_string_lossy().into_owned();

            let mut file = std::fs::File::open(&path).ok()?;
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

            Some(NoteInfo {
                title,
                excerpt,
                body: String::new(),
                mtime,
            })
        })
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
pub fn notes_write(
    title: String,
    body: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let vault = get_vault(&state)?;
    let path = note_path(&vault, &title)?;
    std::fs::write(&path, body.as_bytes()).map_err(|e| format!("Cannot write note: {e}"))
}

#[tauri::command]
pub fn notes_delete(title: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = get_vault(&state)?;
    let path = note_path(&vault, &title)?;
    match std::fs::remove_file(&path) {
        Ok(()) | Err(_) => Ok(()), // already gone is fine
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
