use std::path::{Path, PathBuf};
use std::sync::mpsc;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_dialog::DialogExt;

use crate::AppState;

fn config_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("config.json"))
}

/// Validate, persist, and activate a new vault directory.
///
/// Returns `true` when the vault was successfully applied. Shared by the
/// `vault_select` command and the "Change Vault…" menu handler.
pub fn apply_vault<R: Runtime>(app: &AppHandle<R>, state: &AppState, vault_path: &Path) -> bool {
    if !vault_path.is_dir() {
        return false;
    }
    let probe = vault_path.join(".nv-access-check");
    if std::fs::write(&probe, b"").is_err() {
        return false;
    }
    let _ = std::fs::remove_file(&probe);

    write_config(app, vault_path);
    *state.vault_path.lock().unwrap_or_else(|e| e.into_inner()) = Some(vault_path.to_path_buf());
    crate::watcher::start(app, vault_path.to_path_buf());
    true
}

fn write_config<R: Runtime>(app: &AppHandle<R>, vault_path: &Path) {
    if let Some(cfg) = config_path(app) {
        if let Some(parent) = cfg.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let json = serde_json::json!({ "vaultPath": vault_path.to_string_lossy() });
        let _ = std::fs::write(&cfg, json.to_string());
    }
}

pub fn read_config_vault<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let cfg = config_path(app)?;
    let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(cfg).ok()?).ok()?;
    json.get("vaultPath")?.as_str().map(PathBuf::from)
}

#[tauri::command]
pub fn vault_get(state: State<'_, AppState>) -> Option<String> {
    state
        .vault_path
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_ref()
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn vault_select(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let (tx, rx) = mpsc::channel();
    app.dialog().file().pick_folder(move |result| {
        let _ = tx.send(result);
    });
    // Wait on a blocking thread so the async executor stays free to process
    // the main-thread dialog events that pick_folder dispatches.
    let folder = tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
        .await
        .map_err(|e| e.to_string())?;
    let folder = match folder {
        None => return Ok(None),
        Some(f) => f,
    };

    let vault_path: PathBuf = folder.into_path().map_err(|e| e.to_string())?;

    if !apply_vault(&app, &state, &vault_path) {
        return Ok(None);
    }

    Ok(Some(vault_path.to_string_lossy().into_owned()))
}
