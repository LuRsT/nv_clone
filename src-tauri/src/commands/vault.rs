use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::AppState;


fn config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("config.json"))
}

pub fn write_config(app: &AppHandle, vault_path: &PathBuf) {
    if let Some(cfg) = config_path(app) {
        if let Some(parent) = cfg.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let json = serde_json::json!({ "vaultPath": vault_path.to_string_lossy() });
        let _ = std::fs::write(&cfg, json.to_string());
    }
}

pub fn read_config_vault(app: &AppHandle) -> Option<PathBuf> {
    let cfg = config_path(app)?;
    let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(cfg).ok()?).ok()?;
    json.get("vaultPath")?.as_str().map(PathBuf::from)
}

#[tauri::command]
pub fn vault_get(state: State<'_, AppState>) -> Option<String> {
    state
        .vault_path
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn vault_select(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let folder = match app.dialog().file().blocking_pick_folder() {
        None => return Ok(None),
        Some(f) => f,
    };

    let vault_path: PathBuf = folder.into_path().map_err(|e| e.to_string())?;

    // Validate the directory is accessible for reading and writing.
    if !vault_path.is_dir() {
        return Ok(None);
    }
    let probe = vault_path.join(".nv-access-check");
    if std::fs::write(&probe, b"").is_err() {
        return Ok(None);
    }
    let _ = std::fs::remove_file(&probe);

    write_config(&app, &vault_path);
    *state.vault_path.lock().unwrap() = Some(vault_path.clone());

    Ok(Some(vault_path.to_string_lossy().into_owned()))
}
