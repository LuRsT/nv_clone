mod commands;
mod watcher;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub vault_path: Mutex<Option<PathBuf>>,
}

pub struct WatcherState {
    pub handle: Mutex<Option<notify::RecommendedWatcher>>,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            vault_path: Mutex::new(None),
        })
        .manage(WatcherState {
            handle: Mutex::new(None),
        })
        .setup(|app| {
            // Restore vault path persisted from a previous session.
            if let Some(vault) = commands::vault::read_config_vault(app.handle()) {
                *app.state::<AppState>().vault_path.lock().unwrap() = Some(vault.clone());
                watcher::start(app.handle(), vault);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::vault::vault_get,
            commands::vault::vault_select,
            commands::notes::notes_list,
            commands::notes::notes_read,
            commands::notes::notes_write,
            commands::notes::notes_delete,
            commands::notes::notes_rename,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
