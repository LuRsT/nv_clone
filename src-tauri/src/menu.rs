use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    App, Manager, Runtime,
};

use crate::AppState;

pub fn build<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let handle = app.handle();

    // ── File menu ─────────────────────────────────────────────────────────────
    let change_vault =
        MenuItem::with_id(handle, "change-vault", "Change Vault…", true, None::<&str>)?;
    let file_sep = PredefinedMenuItem::separator(handle)?;
    let quit = PredefinedMenuItem::quit(handle, None)?;
    let file_menu = Submenu::with_items(handle, "File", true, &[&change_vault, &file_sep, &quit])?;

    // ── Edit menu ─────────────────────────────────────────────────────────────
    let undo = PredefinedMenuItem::undo(handle, None)?;
    let redo = PredefinedMenuItem::redo(handle, None)?;
    let edit_sep = PredefinedMenuItem::separator(handle)?;
    let cut = PredefinedMenuItem::cut(handle, None)?;
    let copy = PredefinedMenuItem::copy(handle, None)?;
    let paste = PredefinedMenuItem::paste(handle, None)?;
    let select_all = PredefinedMenuItem::select_all(handle, None)?;
    let edit_menu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[&undo, &redo, &edit_sep, &cut, &copy, &paste, &select_all],
    )?;

    // ── View menu (debug only) ────────────────────────────────────────────────
    #[cfg(debug_assertions)]
    let devtools_accel = if cfg!(target_os = "macos") {
        "Alt+Command+I"
    } else {
        "Ctrl+Shift+I"
    };
    #[cfg(debug_assertions)]
    let devtools = MenuItem::with_id(
        handle,
        "toggle-devtools",
        "Toggle Developer Tools",
        true,
        Some(devtools_accel),
    )?;
    #[cfg(debug_assertions)]
    let view_menu = Submenu::with_items(handle, "View", true, &[&devtools])?;

    // ── macOS app menu ────────────────────────────────────────────────────────
    #[cfg(target_os = "macos")]
    let about = PredefinedMenuItem::about(handle, None, None)?;
    #[cfg(target_os = "macos")]
    let app_sep1 = PredefinedMenuItem::separator(handle)?;
    #[cfg(target_os = "macos")]
    let hide = PredefinedMenuItem::hide(handle, None)?;
    #[cfg(target_os = "macos")]
    let hide_others = PredefinedMenuItem::hide_others(handle, None)?;
    #[cfg(target_os = "macos")]
    let show_all = PredefinedMenuItem::show_all(handle, None)?;
    #[cfg(target_os = "macos")]
    let app_sep2 = PredefinedMenuItem::separator(handle)?;
    #[cfg(target_os = "macos")]
    let mac_quit = PredefinedMenuItem::quit(handle, None)?;
    #[cfg(target_os = "macos")]
    let app_menu = Submenu::with_items(
        handle,
        "NV",
        true,
        &[
            &about,
            &app_sep1,
            &hide,
            &hide_others,
            &show_all,
            &app_sep2,
            &mac_quit,
        ],
    )?;

    // ── Assemble ──────────────────────────────────────────────────────────────
    #[cfg(all(target_os = "macos", debug_assertions))]
    let menu = Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu, &view_menu])?;
    #[cfg(all(target_os = "macos", not(debug_assertions)))]
    let menu = Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu])?;
    #[cfg(all(not(target_os = "macos"), debug_assertions))]
    let menu = Menu::with_items(handle, &[&file_menu, &edit_menu, &view_menu])?;
    #[cfg(all(not(target_os = "macos"), not(debug_assertions)))]
    let menu = Menu::with_items(handle, &[&file_menu, &edit_menu])?;

    app.set_menu(menu)?;

    // ── Menu event handler ────────────────────────────────────────────────────
    app.on_menu_event(move |app, event| match event.id().as_ref() {
        "change-vault" => {
            let app = app.clone();
            std::thread::spawn(move || {
                use tauri_plugin_dialog::DialogExt;
                let Some(folder) = app.dialog().file().blocking_pick_folder() else {
                    return;
                };
                let Ok(vault_path) = folder.into_path() else {
                    return;
                };
                // apply_vault starts the watcher which seeds its cache and
                // emits notes:changed — no need to emit again here.
                crate::commands::vault::apply_vault(
                    &app,
                    app.state::<AppState>().inner(),
                    &vault_path,
                );
            });
        }
        #[cfg(debug_assertions)]
        "toggle-devtools" => {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_devtools_open() {
                    window.close_devtools();
                } else {
                    window.open_devtools();
                }
            }
        }
        _ => {}
    });

    Ok(())
}
