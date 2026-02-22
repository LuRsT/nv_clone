// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Work around WebKitGTK EGL crashes on certain Linux GPU/driver combos.
    // See: https://github.com/tauri-apps/tauri/issues/11988
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    nv_lib::run();
}
